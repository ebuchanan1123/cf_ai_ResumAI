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

app.get('/', (req, res) => {
  res.json({ message: 'Backend is running' });
});

app.get('/health', (req, res) => {
  res.status(200).json({
    ok: true,
    service: 'ResumAI backend',
  });
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
    const { profile, jobDescription, tone } = req.body;

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

    const prompt = `
You are an expert technical resume writer.

Generate a tailored resume from the user's profile and the target job description.

Return your answer in valid JSON only, with this exact structure:
{
  "summary": "string",
  "skills": ["string", "string", "string", "string", "string", "string"],
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
- For skills, return the most relevant skills for this role
- Include relevant certifications when they strengthen the application
- Keep the tone: ${tone || 'Technical'}

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
      summary: typeof parsed.summary === 'string' ? parsed.summary : '',
      skills: Array.isArray(parsed.skills) ? parsed.skills.slice(0, 6) : [],
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
