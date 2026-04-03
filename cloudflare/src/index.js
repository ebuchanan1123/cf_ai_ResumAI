const MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const SESSION_KEY = 'session';
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const json = (body, init) =>
  new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS,
      ...(init?.headers || {}),
    },
  });

const jsonError = (message, status = 500, details) =>
  json(
    {
      error: message,
      ...(details ? { details } : {}),
    },
    { status }
  );

const sanitizeText = (value, fallback = '') =>
  typeof value === 'string' ? value.trim() : fallback;

const safeJson = async (request) => {
  try {
    return await request.json();
  } catch {
    return null;
  }
};

const compactJson = (value, maxChars = 3500) => {
  const serialized = JSON.stringify(value ?? {}, null, 2);
  if (serialized.length <= maxChars) {
    return serialized;
  }

  return `${serialized.slice(0, maxChars).trim()}...`;
};

const buildSystemPrompt = (context, history) => `
You are the ResumAI Assistant inside a resume builder.

Your job is to help a candidate improve a tailored resume for a specific role.

Rules:
- Be practical, concise, and specific
- Use only the provided context
- Do not invent experience, metrics, projects, technologies, or certifications
- Suggest truthful keyword alignment and resume improvements
- Explain ATS issues in plain English
- If asked to rewrite content, keep it polished and ATS-friendly
- Avoid em dashes; use commas, periods, or standard hyphens instead
- Return valid JSON only in this exact format:
{
  "answer": "string",
  "suggestedActions": ["string", "string", "string"]
}

Conversation so far:
${history.map((message) => `${message.role.toUpperCase()}: ${message.content}`).join('\n')}

Current profile:
${compactJson(context.profile)}

Current job description:
${sanitizeText(context.jobDescription)}

Current tailored resume:
${compactJson(context.resumeResult)}

Current ATS insights:
${compactJson(context.atsInsights)}
`.trim();

const parseModelJson = (value) => {
  if (!value) return null;

  try {
    return JSON.parse(value);
  } catch {
    const fencedMatch = value.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fencedMatch?.[1]) {
      try {
        return JSON.parse(fencedMatch[1].trim());
      } catch {
        // fall through
      }
    }

    const objectMatch = value.match(/\{[\s\S]*\}/);
    if (objectMatch?.[0]) {
      try {
        return JSON.parse(objectMatch[0]);
      } catch {
        return null;
      }
    }

    return null;
  }
};

const extractAiText = (result) => {
  if (!result) return '';
  if (typeof result === 'string') return sanitizeText(result);
  if (Array.isArray(result)) {
    return result.map((item) => extractAiText(item)).find(Boolean) || '';
  }
  if (typeof result !== 'object') return '';

  return (
    sanitizeText(result.response) ||
    sanitizeText(result.result?.response) ||
    sanitizeText(result.output_text) ||
    sanitizeText(result.text) ||
    sanitizeText(result.content?.[0]?.text) ||
    sanitizeText(result.choices?.[0]?.message?.content) ||
    sanitizeText(result.choices?.[0]?.text)
  );
};

const makeMessage = (role, content) => ({
  id: crypto.randomUUID(),
  role,
  content,
  createdAt: new Date().toISOString(),
});

const isAuthorized = (request, env) => {
  const expected = sanitizeText(env.RESUMAI_ASSISTANT_TOKEN);
  if (!expected) return true;

  const header = request.headers.get('Authorization') || '';
  const token = header.replace(/^Bearer\s+/i, '').trim();
  return token === expected;
};

export default {
  async fetch(request, env) {
    try {
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          status: 204,
          headers: CORS_HEADERS,
        });
      }

      const url = new URL(request.url);

      if (url.pathname === '/health') {
        return json({
          ok: true,
          service: 'ResumAI Cloudflare assistant',
          date: new Date().toISOString(),
        });
      }

      if (!isAuthorized(request, env)) {
        return json({ error: 'Unauthorized' }, { status: 401 });
      }

      if (request.method === 'POST' && url.pathname === '/assistant/session') {
        const body = (await safeJson(request)) || {};
        const sessionId = body.sessionId || crypto.randomUUID();
        const stub = env.CHAT_SESSIONS.get(env.CHAT_SESSIONS.idFromName(sessionId));
        const response = await stub.fetch('https://session.local/init', {
          method: 'POST',
          body: JSON.stringify({
            sessionId,
            profile: body.profile,
            jobDescription: body.jobDescription,
            resumeResult: body.resumeResult,
            atsInsights: body.atsInsights,
          }),
        });

        return new Response(response.body, {
          status: response.status,
          headers: {
            ...CORS_HEADERS,
            'Content-Type': 'application/json',
          },
        });
      }

      if (request.method === 'POST' && url.pathname === '/assistant/message') {
        const body = await safeJson(request);
        if (!sanitizeText(body?.message)) {
          return json({ error: 'Message is required.' }, { status: 400 });
        }

        const sessionId = body.sessionId || crypto.randomUUID();
        const stub = env.CHAT_SESSIONS.get(env.CHAT_SESSIONS.idFromName(sessionId));
        const response = await stub.fetch('https://session.local/message', {
          method: 'POST',
          body: JSON.stringify({
            sessionId,
            message: sanitizeText(body.message),
            profile: body.profile,
            jobDescription: body.jobDescription,
            resumeResult: body.resumeResult,
            atsInsights: body.atsInsights,
          }),
        });

        return new Response(response.body, {
          status: response.status,
          headers: {
            ...CORS_HEADERS,
            'Content-Type': 'application/json',
          },
        });
      }

      return json({ error: 'Not found' }, { status: 404 });
    } catch (error) {
      return jsonError(
        'Assistant worker request failed.',
        500,
        error instanceof Error ? error.message : String(error)
      );
    }
  },
};

export class ChatSession {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
  }

  async fetch(request) {
    try {
      const url = new URL(request.url);
      const body = (await safeJson(request)) || {};
      const stored =
        (await this.ctx.storage.get(SESSION_KEY)) || {
          context: {},
          messages: [],
          updatedAt: new Date().toISOString(),
        };

      if (url.pathname === '/init') {
        const nextSession = {
          context: {
            profile: body.profile ?? stored.context.profile,
            jobDescription: body.jobDescription ?? stored.context.jobDescription,
            resumeResult: body.resumeResult ?? stored.context.resumeResult,
            atsInsights: body.atsInsights ?? stored.context.atsInsights,
          },
          messages: stored.messages,
          updatedAt: new Date().toISOString(),
        };

        await this.ctx.storage.put(SESSION_KEY, nextSession);

        return json({
          sessionId: body.sessionId || this.ctx.id.toString(),
          messages: nextSession.messages,
        });
      }

      if (url.pathname === '/message') {
        const nextContext = {
          profile: body.profile ?? stored.context.profile,
          jobDescription: body.jobDescription ?? stored.context.jobDescription,
          resumeResult: body.resumeResult ?? stored.context.resumeResult,
          atsInsights: body.atsInsights ?? stored.context.atsInsights,
        };

        const userMessage = makeMessage('user', sanitizeText(body.message));
        const history = [...stored.messages, userMessage].slice(-8);
        const aiResult = await this.env.AI.run(MODEL, {
          messages: [
            {
              role: 'system',
              content: buildSystemPrompt(nextContext, history),
            },
            {
              role: 'user',
              content: userMessage.content,
            },
          ],
          max_tokens: 260,
          temperature: 0.2,
        });

        const aiText = extractAiText(aiResult);
        const parsed = parseModelJson(aiText);
        const answer =
          sanitizeText(parsed?.answer) ||
          sanitizeText(aiText) ||
          'The assistant returned an empty response. Check the Worker logs for the raw model output.';
        const suggestedActions = Array.isArray(parsed?.suggestedActions)
          ? parsed.suggestedActions
              .map((item) => sanitizeText(item))
              .filter(Boolean)
              .slice(0, 4)
          : [];

        const assistantMessage = makeMessage('assistant', answer);
        const nextMessages = [...history, assistantMessage].slice(-14);
        const nextSession = {
          context: nextContext,
          messages: nextMessages,
          updatedAt: new Date().toISOString(),
        };

        await this.ctx.storage.put(SESSION_KEY, nextSession);

        return json({
          sessionId: body.sessionId || this.ctx.id.toString(),
          answer,
          messages: nextMessages,
          suggestedActions,
        });
      }

      return json({ error: 'Not found' }, { status: 404 });
    } catch (error) {
      return jsonError(
        'Assistant session request failed.',
        500,
        error instanceof Error ? error.message : String(error)
      );
    }
  }
}
