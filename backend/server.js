require('dotenv').config();

const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '5mb' }));

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.get('/', (req, res) => {
  res.json({ message: 'Backend is running' });
});

app.post('/generate', async (req, res) => {
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
${tone}

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

app.post('/tailor-resume', async (req, res) => {
  try {
    const { resumeText, jobDescription, tone } = req.body;

    if (
      !resumeText ||
      resumeText.trim().length < 50 ||
      !jobDescription ||
      jobDescription.trim().length < 30
    ) {
      return res.status(400).json({
        error: 'Missing or invalid resume text or job description.',
      });
    }

    const prompt = `
You are an expert technical resume writer.

Your task is to tailor a resume to a target job description.

Return your answer in valid JSON only, with this exact structure:
{
  "summary": "string",
  "experienceBullets": ["string", "string", "string", "string"],
  "skillsToHighlight": ["string", "string", "string", "string", "string"],
  "missingKeywords": ["string", "string", "string", "string", "string"]
}

Rules:
- Keep the summary concise, professional, and tailored to the job
- Write exactly 4 improved experience bullets
- Start each bullet with a strong action verb
- Do not use first person
- Do not invent fake achievements, fake metrics, or fake technologies
- skillsToHighlight should contain the most relevant skills already present or strongly supported
- missingKeywords should contain useful keywords that seem important for the role but are weak or missing from the resume
- The tone should be: ${tone}

Current Resume:
${resumeText}

Target Job Description:
${jobDescription}
`;

    const response = await client.responses.create({
      model: 'gpt-5-mini',
      input: prompt,
    });

    const text = response.output_text || '';

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
      summary: parsed.summary || '',
      experienceBullets: Array.isArray(parsed.experienceBullets)
        ? parsed.experienceBullets.slice(0, 4)
        : [],
      skillsToHighlight: Array.isArray(parsed.skillsToHighlight)
        ? parsed.skillsToHighlight.slice(0, 5)
        : [],
      missingKeywords: Array.isArray(parsed.missingKeywords)
        ? parsed.missingKeywords.slice(0, 5)
        : [],
    });
  } catch (error) {
    console.error('OPENAI ERROR /tailor-resume:', error);

    return res.status(500).json({
      error: error?.message || 'Failed to tailor resume.',
    });
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${port}`);
});