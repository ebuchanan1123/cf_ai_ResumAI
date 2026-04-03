# ResumAI

ResumAI is an AI-powered resume builder that helps candidates tailor resumes, generate cover letters, analyze ATS fit, and now chat with a Cloudflare-powered assistant about a specific job application.

## What It Does

- Generate a tailored resume from a saved profile and pasted job description
- Generate a matching cover letter for the same role
- Score ATS alignment and surface keyword gaps
- Build an application kit with recruiter messaging and supporting materials
- Export resume and cover letter PDFs
- Open a floating AI chat widget to ask:
  - why an ATS score is low
  - what keywords are missing
  - how to improve bullets
  - how to rewrite a summary for a role

## Cloudflare AI Assistant

The assistant was added as a Cloudflare-native layer on top of the existing app data model.

### Cloudflare Components Used

- `Workers AI`
  - Runs the LLM used by the in-app assistant
- `Cloudflare Worker`
  - Accepts chat requests from the app
  - packages profile, job description, tailored resume, and ATS context
  - coordinates the response flow
- `Durable Objects`
  - Store per-session chat memory so the assistant can continue a conversation

### Why This Approach Works

ResumAI already had rich application context:

- saved user profile
- pasted job description
- generated resume result
- ATS insight data

That makes the Cloudflare piece more useful than a generic chatbot. The assistant answers questions grounded in the actual job application the user is working on.

## Architecture

### Frontend

- Expo
- React Native
- Expo Router
- Hosted on Vercel for the web app

### Existing Backend

- Node.js
- Express
- OpenAI-backed resume and cover letter generation endpoints

### Cloudflare Assistant Backend

- `wrangler.jsonc`
- [cloudflare/src/index.js](./cloudflare/src/index.js)
- Workers AI model call
- Durable Object session memory

### Deployment Split

- `Vercel`
  - main ResumAI web app
- `Render`
  - existing Express API
- `Cloudflare`
  - assistant chat backend

## Main User Flow

1. User pastes a job description
2. ResumAI generates a tailored resume
3. ATS analysis scores alignment and surfaces missing terms
4. The user opens the floating AI assistant
5. The app sends:
   - profile
   - job description
   - tailored resume
   - ATS insights
6. The Cloudflare Worker calls Workers AI
7. Durable Objects keep the conversation state for that session
8. The response is shown in the in-app chat widget

## Repo Notes

### Important Files

- [app/(tabs)/resume.tsx](./app/(tabs)/resume.tsx)
- [backend/server.js](./backend/server.js)
- [cloudflare/src/index.js](./cloudflare/src/index.js)
- [wrangler.jsonc](./wrangler.jsonc)
- [docs/cloudflare-assistant-setup.md](./docs/cloudflare-assistant-setup.md)
- [docs/cloudflare-project-summary.md](./docs/cloudflare-project-summary.md)

### Environment Variables

Frontend:

- `EXPO_PUBLIC_RESUMAI_ASSISTANT_URL`

Backend:

- existing OpenAI backend environment variables for resume generation

### Cloudflare Bindings

- `AI`
- `CHAT_SESSIONS`

## Local Development

Install dependencies:

```bash
npm install
cd backend && npm install
```

Run the app:

```bash
npx expo start
```

Run the existing backend:

```bash
cd backend
node server.js
```

Run the Cloudflare assistant locally:

```bash
npm run cf:dev
```

Deploy the Cloudflare assistant directly:

```bash
npm run cf:deploy
```

## Submission Notes

For the Cloudflare application, this project now includes all four requested pieces:

- `LLM`: Workers AI
- `Workflow / coordination`: Cloudflare Worker
- `User input via chat`: in-app floating chat UI
- `Memory / state`: Durable Objects

## Author

Created by Evan Buchanan.
