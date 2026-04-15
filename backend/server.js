require('dotenv').config();

const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
const rateLimit = require('express-rate-limit');

const app = express();
const port = process.env.PORT || 3001;

app.set('trust proxy', 1);

const createLimiter = ({ windowMs, max, message }) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: message },
  });

const generalLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: 'Too many requests from this IP. Please try again shortly.',
});

const resumeLimiter = createLimiter({
  windowMs: 24 * 60 * 60 * 1000,
  max: 20,
  message: 'Resume generation limit reached for this IP today. Please try again tomorrow.',
});

const bulletLimiter = createLimiter({
  windowMs: 24 * 60 * 60 * 1000,
  max: 30,
  message: 'Bullet generation limit reached for this IP today. Please try again tomorrow.',
});

const coverLetterLimiter = createLimiter({
  windowMs: 24 * 60 * 60 * 1000,
  max: 20,
  message: 'Cover letter generation limit reached for this IP today. Please try again tomorrow.',
});

const profileImportLimiter = createLimiter({
  windowMs: 24 * 60 * 60 * 1000,
  max: 15,
  message: 'Profile import limit reached for this IP today. Please try again tomorrow.',
});

const jobImportLimiter = createLimiter({
  windowMs: 24 * 60 * 60 * 1000,
  max: 20,
  message: 'Job import limit reached for this IP today. Please try again tomorrow.',
});

const contactLookupLimiter = createLimiter({
  windowMs: 24 * 60 * 60 * 1000,
  max: 20,
  message: 'Follow-up email lookup limit reached for this IP today. Please try again tomorrow.',
});

app.use(generalLimiter);

app.use(cors());
app.use(express.json({ limit: '5mb' }));

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const compactWhitespace = (value = '') => value.replace(/\s+/g, ' ').trim();

const trimTextForModel = (value = '', maxChars = 4500) => {
  const normalized = compactWhitespace(value);
  if (normalized.length <= maxChars) {
    return normalized;
  }

  return `${normalized.slice(0, maxChars).trim()}...`;
};

const extractMetaTag = (html = '', name) => {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${name}["'][^>]+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${name}["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${name}["']`, 'i'),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      return compactWhitespace(
        match[1]
          .replace(/&amp;/g, '&')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
      );
    }
  }

  return '';
};

const extractTitleTag = (html = '') => {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match?.[1] ? compactWhitespace(match[1]) : '';
};

const stripHtml = (html = '') =>
  compactWhitespace(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
  );

const extractWebSources = (response) => {
  const seen = new Set();
  const collected = [];
  const pushSource = (candidate) => {
    const url = compactWhitespace(candidate?.url || '');
    if (!url || seen.has(url)) return;
    seen.add(url);
    collected.push({
      title: compactWhitespace(candidate?.title || url),
      url,
    });
  };

  const outputItems = Array.isArray(response?.output) ? response.output : [];
  for (const item of outputItems) {
    const directSources = Array.isArray(item?.action?.sources) ? item.action.sources : [];
    directSources.forEach(pushSource);

    const contentItems = Array.isArray(item?.content) ? item.content : [];
    for (const content of contentItems) {
      const annotations = Array.isArray(content?.annotations) ? content.annotations : [];
      for (const annotation of annotations) {
        if (annotation?.type === 'url_citation') {
          pushSource(annotation);
        }
      }
    }
  }

  return collected.slice(0, 6);
};

app.get('/', (req, res) => {
  res.json({ message: 'Backend is running' });
});

app.get('/health', (req, res) => {
  res.status(200).json({
    ok: true,
    service: 'ResumAI backend',
  });
});

app.post('/import-job', jobImportLimiter, async (req, res) => {
  try {
    const { jobUrl } = req.body;

    if (!jobUrl || typeof jobUrl !== 'string') {
      return res.status(400).json({
        error: 'Missing or invalid job URL.',
      });
    }

    let parsedUrl;
    try {
      parsedUrl = new URL(jobUrl);
    } catch {
      return res.status(400).json({
        error: 'Please enter a valid job URL.',
      });
    }

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return res.status(400).json({
        error: 'Only http and https job URLs are supported.',
      });
    }

    const response = await fetch(parsedUrl.toString(), {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      return res.status(400).json({
        error: 'Failed to fetch that job posting. Try pasting the description manually instead.',
      });
    }

    const html = await response.text();
    const titleHint =
      extractMetaTag(html, 'og:title') ||
      extractMetaTag(html, 'twitter:title') ||
      extractTitleTag(html);
    const descriptionHint =
      extractMetaTag(html, 'og:description') ||
      extractMetaTag(html, 'twitter:description') ||
      extractMetaTag(html, 'description');
    const bodyText = trimTextForModel(stripHtml(html), 12000);

    const prompt = `
You are an expert job posting parser.

Extract structured job data from the fetched page content.

Return valid JSON only in this exact structure:
{
  "title": "string",
  "company": "string",
  "location": "string",
  "description": "string",
  "requirements": ["string"],
  "keywords": ["string"],
  "parseSucceeded": true
}

Rules:
- Use only information clearly supported by the page content
- Do not invent missing details
- Prefer the actual employer name over the recruiting platform name
- Keep requirements to the most important 4 to 6 lines
- Keep keywords to high-signal technical or domain terms only
- If parsing is weak or uncertain, set "parseSucceeded" to false
- If a field is unavailable, return an empty string or empty array

Source host:
${parsedUrl.hostname}

Title hint:
${titleHint}

Description hint:
${descriptionHint}

Fetched page text:
${bodyText}
`;

    const parsed = await client.responses.create({
      model: 'gpt-5-mini',
      input: prompt,
    });

    const text = (parsed.output_text || '').trim();

    let job;
    try {
      job = JSON.parse(text);
    } catch {
      console.error('JSON PARSE ERROR /import-job:', text);
      return res.status(500).json({
        error: 'Failed to parse job posting.',
      });
    }

    const requirements = Array.isArray(job.requirements)
      ? job.requirements.map((item) => compactWhitespace(String(item))).filter(Boolean).slice(0, 6)
      : [];
    const keywords = Array.isArray(job.keywords)
      ? job.keywords.map((item) => compactWhitespace(String(item))).filter(Boolean).slice(0, 8)
      : [];

    const description = compactWhitespace(job.description || '');
    const jobDescriptionText = [description, requirements.length ? `Key requirements:\n- ${requirements.join('\n- ')}` : '']
      .filter(Boolean)
      .join('\n\n');

    return res.json({
      title: compactWhitespace(job.title || ''),
      company: compactWhitespace(job.company || ''),
      location: compactWhitespace(job.location || ''),
      description,
      requirements,
      keywords,
      sourceUrl: parsedUrl.toString(),
      parseSucceeded: Boolean(job.parseSucceeded),
      jobDescriptionText,
    });
  } catch (error) {
    console.error('OPENAI ERROR /import-job:', error);

    return res.status(500).json({
      error: error?.message || 'Failed to import job posting.',
    });
  }
});

app.post('/parse-profile', profileImportLimiter, async (req, res) => {
  try {
    const { resumeText, existingProfile } = req.body;

    if (!resumeText || resumeText.trim().length < 50) {
      return res.status(400).json({
        error: 'Missing or invalid resume text.',
      });
    }

    const prompt = `
You are an expert resume parser.

Your job is to convert pasted resume text into a structured user profile.

Return valid JSON only in this exact structure:
{
  "fullName": "string",
  "email": "string",
  "phone": "string",
  "location": "string",
  "summaryHint": "string",
  "skills": "comma-separated string",
  "education": [
    {
      "school": "string",
      "degree": "string",
      "fieldOfStudy": "string",
      "startDate": "string",
      "endDate": "string",
      "details": "string"
    }
  ],
  "experience": [
    {
      "company": "string",
      "title": "string",
      "startDate": "string",
      "endDate": "string",
      "location": "string",
      "technologies": "string",
      "description": "string"
    }
  ],
  "projects": [
    {
      "name": "string",
      "role": "string",
      "technologies": "string",
      "link": "string",
      "description": "string"
    }
  ],
  "certifications": [
    {
      "name": "string",
      "issuer": "string",
      "issueDate": "string",
      "expiryDate": "string",
      "credentialId": "string",
      "details": "string"
    }
  ],
}

Rules:
- Extract only what is supported by the pasted resume
- Do not invent missing details
- If something is missing, return an empty string
- Skills should be a comma-separated string
- Descriptions can be concise but useful
- If existing profile data exists, prefer not to duplicate obvious repeated items

Existing Profile:
${JSON.stringify(existingProfile || {}, null, 2)}

Pasted Resume:
${resumeText}
`;

    const response = await client.responses.create({
      model: 'gpt-5-mini',
      input: prompt,
    });

    const text = (response.output_text || '').trim();

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (parseError) {
      console.error('JSON PARSE ERROR /parse-profile:', text);
      return res.status(500).json({
        error: 'Failed to parse imported profile.',
      });
    }

    return res.json(parsed);
  } catch (error) {
    console.error('OPENAI ERROR /parse-profile:', error);

    return res.status(500).json({
      error: error?.message || 'Failed to parse profile.',
    });
  }
});

app.post('/generate', bulletLimiter, async (req, res) => {
  try {
    const { jobTitle, experience, tone, jobDescription } = req.body;

    if (!jobTitle || !experience || experience.trim().length < 20) {
      return res.status(400).json({
        error: 'Missing or invalid input.',
      });
    }

    const hasJobDescription =
      typeof jobDescription === 'string' && jobDescription.trim().length > 20;

    const prompt = `
You are an expert technical resume writer.

Transform the user's raw experience into exactly 4 strong, ATS-friendly resume bullet points.

Rules:
- Start each bullet with a strong action verb
- Do not use first person
- Do not use bullet symbols or numbering
- Maximum 25 words per bullet
- Keep each bullet concise, specific, and professional
- Emphasize technologies, responsibilities, and impact when supported by the input
- Do not invent fake metrics, fake technologies, or fake achievements
- If a job description is provided, tailor wording toward the most relevant keywords naturally
- Return exactly 4 bullet points, one per line

Job Title:
${jobTitle}

Tone:
${tone || 'Technical'}

Raw Experience:
${experience}

${hasJobDescription ? `Target Job Description:\n${jobDescription}` : ''}
`;

    const response = await client.responses.create({
      model: 'gpt-5-mini',
      input: prompt,
    });

    const text = response.output_text || '';

    const bullets = text
      .split('\n')
      .map((line) => line.replace(/^[\-\u2022*\d.\s]+/, '').trim())
      .filter(Boolean)
      .slice(0, 4);

    return res.json({ bullets });
  } catch (error) {
    console.error('OPENAI ERROR /generate:', error);

    return res.status(500).json({
      error: error?.message || 'Failed to generate resume bullets.',
    });
  }
});

app.post('/tailor-resume', resumeLimiter, async (req, res) => {
  try {
    const { profile, jobDescription, tone, optimizationMode } = req.body;

    if (
      !profile ||
      typeof profile !== 'object' ||
      !jobDescription ||
      jobDescription.trim().length < 30
    ) {
      return res.status(400).json({
        error: 'Missing or invalid profile or job description.',
      });
    }

    const trimmedJobDescription = trimTextForModel(jobDescription, 4500);
    const compactProfileJson = JSON.stringify(profile);
    const modeGuidanceMap = {
      'ATS-first': [
        'Maximize alignment with the target job posting while staying truthful.',
        'Prioritize exact role terminology, clearer section language, and high-signal keywords.',
      ],
      'Recruiter-friendly': [
        'Optimize for readability, flow, and strong first impression in a short skim.',
        'Prefer smooth phrasing and fast scanning over density.',
      ],
      'Technical-heavy': [
        'Emphasize stack choices, architecture, APIs, databases, AI integrations, deployment, and engineering ownership.',
        'Use more systems language where supported by the profile.',
      ],
      Concise: [
        'Keep wording tighter, trim fluff aggressively, and prefer punchy bullets over longer explanations.',
      ],
      'Leadership/impact': [
        'Highlight initiative, ownership, collaboration, and concrete outcomes where supported.',
        'Prefer language that signals decision-making or delivery impact.',
      ],
      'Entry-level student': [
        'Optimize for an early-career student candidate.',
        'Prioritize relevant projects, coursework, and transferable technical experience over weak unrelated experience.',
      ],
      'Startup-focused': [
        'Emphasize product building, shipping, iteration speed, ownership, and cross-functional execution where supported.',
        'Make projects feel like real products rather than class assignments when truthful.',
      ],
    };
    const selectedMode = typeof optimizationMode === 'string' ? optimizationMode : 'Recruiter-friendly';
    const modeGuidance = (modeGuidanceMap[selectedMode] || modeGuidanceMap['Recruiter-friendly']).join(
      '\n- '
    );

    const prompt = `
You are an expert technical resume writer.

Generate a tailored resume from the user's profile and the target job description.

Return your answer in valid JSON only, with this exact structure:
{
  "companyName": "string",
  "summary": "string",
  "skills": ["string", "string", "string", "string", "string", "string", "string", "string", "string", "string", "string", "string"],
  "experience": [
    {
      "company": "string",
      "title": "string",
      "startDate": "string",
      "endDate": "string",
      "location": "string",
      "bullets": ["string", "string", "string"]
    }
  ],
  "projects": [
    {
      "name": "string",
      "role": "string",
      "bullets": ["string", "string"]
    }
  ],
  "education": [
    {
      "school": "string",
      "degree": "string",
      "fieldOfStudy": "string",
      "startDate": "string",
      "endDate": "string",
      "details": "string"
    }
  ],
  "missingKeywords": ["string", "string", "string", "string", "string", "string", "string", "string"]
}

Rules:
- Tailor the content to the target job description
- Be concise, professional, and ATS-friendly
- Do not use first person
- Do not invent fake experience, fake metrics, or fake technologies
- Use only information that is supported by the profile
- Prioritize the most relevant experience and projects for the role
- For student or internship roles, prioritize relevant projects over unrelated work experience when appropriate
- Keep education near the top when it is relevant to the role
- Select the most relevant experience and projects instead of trying to include everything
- Write strong bullet points starting with action verbs
- Sound confident and technically credible, but stay fully truthful
- Favor sharper, more specific language over generic phrasing
- For project bullets, emphasize architecture, integrations, deployment, data flow, APIs, AI features, databases, authentication, and product readiness when supported by the profile
- For project bullets, make the first bullet a standout summary line that quickly explains what the product/system is and why it is impressive
- For both project and experience bullets, emphasize scope, ownership, technical depth, and outcomes when they are supported by the profile
- If metrics are not available, use concrete engineering impact instead of inventing numbers
- Prefer bullets that make a recruiter curious enough to click links or ask follow-up questions
- When supported by the profile, make project names slightly more descriptive and compelling without becoming long or flashy
- If a project is deployed, production-ready, user-facing, or a live product based on the profile, reflect that signal naturally in the wording
- For skills, return 8 to 12 of the most relevant skills for this role when possible
- Do not limit skills to exact keywords copied from the job description
- Include adjacent or supporting skills that are still truthful and supported by the profile when they strengthen the match
- Prefer specific tools, frameworks, platforms, technical concepts, and domain capabilities over generic soft skills
- Avoid duplicates, near-duplicates, and vague filler skills
- Include relevant certifications when they strengthen the application
- For summary, sound polished, ambitious, and specific; avoid weak filler phrases
- For companyName, return the employer or hiring company this resume is being tailored to
- Prefer the actual employer name over a job board, recruiting platform, or generic heading
- If the employer is unclear, return an empty string
- For missingKeywords, include only high-value role-specific technical terms or domain terms that are clearly relevant and truly absent
- Do not include duplicate, overlapping, generic, or low-signal missing keywords
- Keep the tone: ${tone || 'Technical'}
- Optimization mode: ${selectedMode}
- Mode-specific priorities:
- ${modeGuidance}

User Profile:
${compactProfileJson}

Target Job Description:
${trimmedJobDescription}
`;

    const response = await client.responses.create({
      model: 'gpt-5-mini',
      input: prompt,
    });

    const text = (response.output_text || '').trim();

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (parseError) {
      console.error('JSON PARSE ERROR /tailor-resume:', text);
      return res.status(500).json({
        error: 'Failed to parse tailored resume response.',
      });
    }

    return res.json({
      companyName: typeof parsed.companyName === 'string' ? compactWhitespace(parsed.companyName) : '',
      summary: typeof parsed.summary === 'string' ? parsed.summary : '',
      skills: Array.isArray(parsed.skills) ? parsed.skills.slice(0, 12) : [],
      experience: Array.isArray(parsed.experience) ? parsed.experience.slice(0, 3) : [],
      projects: Array.isArray(parsed.projects) ? parsed.projects.slice(0, 3) : [],
      education: Array.isArray(parsed.education) ? parsed.education.slice(0, 2) : [],
      certifications: Array.isArray(parsed.certifications)
        ? parsed.certifications.slice(0, 3)
        : [],
      missingKeywords: Array.isArray(parsed.missingKeywords)
        ? parsed.missingKeywords.slice(0, 8)
        : [],
    });
  } catch (error) {
    console.error('OPENAI ERROR /tailor-resume:', error);

    return res.status(500).json({
      error: error?.message || 'Failed to tailor resume.',
    });
  }
});

app.post('/find-company-contact-email', contactLookupLimiter, async (req, res) => {
  try {
    const { companyName, sourceUrl, jobTitle, jobDescription, location } = req.body;

    if (!companyName || typeof companyName !== 'string' || !companyName.trim()) {
      return res.status(400).json({
        error: 'Missing or invalid company name.',
      });
    }

    const trimmedCompanyName = compactWhitespace(companyName);
    const trimmedSourceUrl = compactWhitespace(sourceUrl || '');
    const trimmedJobTitle = compactWhitespace(jobTitle || '');
    const trimmedLocation = compactWhitespace(location || '');
    const trimmedJobDescription = trimTextForModel(jobDescription || '', 1200);

    const prompt = `
You are a recruiting contact researcher.

Use web search to look for a public follow-up email address for a candidate who wants to politely follow up on an application.

Return valid JSON only in this exact structure:
{
  "companyName": "string",
  "email": "string",
  "status": "found" | "not_found",
  "message": "string"
}

Rules:
- Search the public web for the company's recruiting, careers, talent acquisition, hiring, HR, or contact pages
- Only return an email if it is explicitly shown on a public webpage
- Prefer a recruiting or careers email on the company's own domain
- If no recruiting-specific email is found, a public general contact email on the company's own domain is acceptable
- Never guess a person's email address and never infer an email pattern
- Do not use people-search, scraped contact, or data broker sites
- If you cannot verify a public email, return status "not_found", email "" and the message "We couldn't find a public recruiting email for this company."
- If you find an email, keep the message short and user-facing, for example "Public follow-up email found."

Company:
${trimmedCompanyName}

Job title:
${trimmedJobTitle}

Location:
${trimmedLocation}

Job/source URL:
${trimmedSourceUrl}

Job description excerpt:
${trimmedJobDescription}
`;

    const response = await client.responses.create({
      model: 'gpt-5',
      reasoning: { effort: 'low' },
      tools: [
        {
          type: 'web_search',
          user_location: {
            type: 'approximate',
            country: 'US',
          },
        },
      ],
      include: ['web_search_call.action.sources'],
      input: prompt,
    });

    const text = (response.output_text || '').trim();

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      console.error('JSON PARSE ERROR /find-company-contact-email:', text);
      return res.status(500).json({
        error: 'Failed to parse follow-up email lookup.',
      });
    }

    const email = compactWhitespace(parsed.email || '');
    const status = parsed.status === 'found' && email ? 'found' : 'not_found';

    return res.json({
      companyName: compactWhitespace(parsed.companyName || trimmedCompanyName),
      email,
      status,
      message:
        status === 'found'
          ? compactWhitespace(parsed.message || 'Public follow-up email found.')
          : "We couldn't find a public recruiting email for this company.",
      sources: extractWebSources(response),
    });
  } catch (error) {
    console.error('OPENAI ERROR /find-company-contact-email:', error);

    return res.status(500).json({
      error: error?.message || 'Failed to look up a follow-up email.',
    });
  }
});

app.post('/generate-cover-letter', coverLetterLimiter, async (req, res) => {
  try {
    const { profile, jobDescription, tone, companyContext, hiringManager } = req.body;

    if (
      !profile ||
      typeof profile !== 'object' ||
      !jobDescription ||
      jobDescription.trim().length < 30
    ) {
      return res.status(400).json({
        error: 'Missing or invalid profile or job description.',
      });
    }

    const prompt = `
You are an expert cover letter writer for students and early-career applicants.

Write a tailored cover letter using the user's profile and the target job description.

Return valid JSON only in this exact structure:
{
  "coverLetter": "string"
}

Rules:
- Write one complete cover letter, ready to edit and send
- Keep it professional, specific, and enthusiastic
- Do not use placeholders like [Company] or [Hiring Manager] unless the information is truly unavailable
- If the hiring manager is not known, begin with "Dear Hiring Team,"
- Keep it to about 250 to 350 words
- Do not use em dashes; use commas, periods, or standard hyphens instead
- Use only information supported by the profile
- Do not invent fake metrics, employers, achievements, or technologies
- Show clear alignment with the role and company where possible
- Emphasize relevant projects, experience, and skills from the profile
- Keep the tone: ${tone || 'Technical'}

User Profile:
${JSON.stringify(profile, null, 2)}

Target Job Description:
${jobDescription}

Optional Company Context:
${companyContext || ''}

Optional Hiring Manager:
${hiringManager || ''}
`;

    const response = await client.responses.create({
      model: 'gpt-5-mini',
      input: prompt,
    });

    const text = (response.output_text || '').trim();

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (parseError) {
      console.error('JSON PARSE ERROR /generate-cover-letter:', text);
      return res.status(500).json({
        error: 'Failed to parse cover letter response.',
      });
    }

    return res.json({
      coverLetter: typeof parsed.coverLetter === 'string' ? parsed.coverLetter.trim() : '',
    });
  } catch (error) {
    console.error('OPENAI ERROR /generate-cover-letter:', error);

    return res.status(500).json({
      error: error?.message || 'Failed to generate cover letter.',
    });
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${port}`);
});
