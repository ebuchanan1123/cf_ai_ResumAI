# Cloudflare Project Summary

## One-Line Summary

ResumAI adds a Cloudflare-powered AI career assistant directly inside a resume tailoring workflow, using Workers AI for inference, a Worker for orchestration, and Durable Objects for session memory.

## Problem

Candidates do not just need a generated resume. They also need fast, context-aware feedback on:

- why their ATS score is low
- which keywords are missing
- how to improve a bullet
- how to rewrite a summary for a specific role

A generic chatbot is not enough because the advice needs to be grounded in the actual job description and the user’s current resume draft.

## Solution

ResumAI already had the right context available:

- saved user profile
- target job description
- generated tailored resume
- ATS analysis data

The Cloudflare assistant sits on top of that workflow and lets the user open a floating chat widget inside the app to ask targeted questions about the exact role they are applying for.

## Cloudflare Services Used

### 1. Workers AI

Used as the LLM layer for the assistant.

The model receives:

- profile context
- target job description
- tailored resume result
- ATS insights
- recent chat history

### 2. Cloudflare Worker

Used as the orchestration layer.

The Worker:

- accepts chat requests from the frontend
- packages the relevant application context
- calls Workers AI
- returns a structured answer to the UI

### 3. Durable Objects

Used for per-session chat memory.

Each chat session stores:

- prior user messages
- assistant responses
- latest contextual snapshot of the resume workflow

This lets the assistant continue a conversation instead of treating each question as stateless.

## User Experience

Inside the resume generator page, the user can:

- generate a tailored resume
- inspect ATS analysis
- open the floating AI assistant
- ask questions like:
  - Why is my ATS score low?
  - What keywords am I missing?
  - How can I improve this bullet?
  - Rewrite my summary for this role

The assistant replies in context, using the current job application data rather than generic advice.

## Architecture

### Frontend

- Expo / React Native / Expo Router
- deployed on Vercel for the web app

### Existing App Services

- Express backend for resume and cover letter generation

### Cloudflare Layer

- Worker endpoint for chat
- Workers AI for inference
- Durable Object for session memory

## Why This Is A Good Cloudflare Submission

This project clearly demonstrates all required components:

- `LLM`
  - Workers AI
- `Workflow / coordination`
  - Cloudflare Worker
- `User input via chat`
  - embedded chat UI in the application
- `Memory / state`
  - Durable Objects

It also shows a practical product use case rather than a generic demo. The assistant is integrated into a real workflow where context matters.

## Important Files

- [../cloudflare/src/index.js](../cloudflare/src/index.js)
- [../wrangler.jsonc](../wrangler.jsonc)
- [../app/(tabs)/resume.tsx](../app/(tabs)/resume.tsx)
- [cloudflare-assistant-setup.md](./cloudflare-assistant-setup.md)

## Suggested Demo Script

1. Open ResumAI
2. Paste a job description
3. Generate a tailored resume
4. Show ATS analysis
5. Open the floating AI assistant
6. Ask why the ATS score is low
7. Ask what keywords are missing
8. Ask for a stronger summary rewrite
9. Explain that the Worker uses Durable Objects to keep chat memory for the session
