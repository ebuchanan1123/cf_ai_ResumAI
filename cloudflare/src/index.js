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

const sanitizeText = (value, fallback = '') =>
  typeof value === 'string' ? value.trim() : fallback;

const safeJson = async (request) => {
  try {
    return await request.json();
  } catch {
    return null;
  }
};

const compactJson = (value, maxChars = 6000) => {
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
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const extractAiText = (result) => {
  if (!result || typeof result !== 'object') return '';

  return (
    sanitizeText(result.response) ||
    sanitizeText(result.result?.response) ||
    sanitizeText(result.output_text)
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
  },
};

export class ChatSession {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
  }

  async fetch(request) {
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
      const history = [...stored.messages, userMessage].slice(-12);
      const prompt = `${buildSystemPrompt(nextContext, history)}\n\nLatest user request:\n${userMessage.content}`;

      const aiResult = await this.env.AI.run(MODEL, { prompt });
      const aiText = extractAiText(aiResult);
      const parsed = parseModelJson(aiText);
      const answer =
        sanitizeText(parsed?.answer) ||
        sanitizeText(aiText) ||
        'I could not generate a useful answer from the assistant yet.';
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
  }
}
