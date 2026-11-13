# AI Production Setup

EDGE Note talks to any OpenAI-compatible chat completions endpoint (bearer key, `/chat/completions`, JSON mode). The default provider is **Groq**: it has a free plan, low pay-as-you-go pricing, very fast responses, and it also offers Whisper speech-to-text (Korean supported) for future voice notes.

## Hostinger Environment Values (Groq)

1. Create a free account at https://console.groq.com and create an API key dedicated to EDGE Note.
2. Set these in the Hostinger Node app environment screen:

```bash
AI_ENDPOINT_URL=https://api.groq.com/openai/v1/chat/completions
AI_MODEL_NAME=openai/gpt-oss-120b
AI_API_KEY=<your Groq API key>
AI_TIMEOUT_MS=30000
AI_MAX_OUTPUT_TOKENS=800
```

`openai/gpt-oss-120b` is the default model: strong at structured JSON, good multilingual (English/Korean) output. Groq's model list changes over time; check https://console.groq.com/docs/models and swap `AI_MODEL_NAME` if a model is retired. A smaller, cheaper option is `openai/gpt-oss-20b`.

Do not commit the real API key. Keep it in Hostinger environment variables only.

### Cost

Groq's Free plan is $0 with daily request/token caps (see your account's Limits page). On the pay-as-you-go Developer plan, `gpt-oss-120b` was listed at about $0.15 per million input tokens and $0.60 per million output tokens. A typical note action (~1,500 tokens in, ~300 out) costs roughly $0.0004, so 1,000 actions a month is about $0.40. Set a spend limit in the Groq console if you upgrade.

## Alternative: Gemini

Any OpenAI-compatible provider works by changing the same three values. For Google Gemini:

```bash
AI_ENDPOINT_URL=https://generativelanguage.googleapis.com/v1beta/openai/chat/completions
AI_MODEL_NAME=gemini-2.5-flash
AI_API_KEY=<your Google AI key>
```

## Verify The Endpoint

After setting the variables and restarting the Node app, run:

```bash
npm run verify:ai
```

The command sends a tiny JSON-only request to the configured endpoint and confirms the model responds.

## In The App

Open a note and tap **Assistant** (sparkle button in the editor header):

- **Summarize**, **Action items**, **Suggest tags**, **Better title**, **Clean up**, **Translate KO ⇄ EN**, **Related notes**
- **Ask** a question about *this note* or *all notes* (answers cite the notes they used)
- Results never change the note until you tap an apply button (add summary, add checklist, add tags, use title, replace, add translation). Replacements stay recoverable in version history.

The **microphone** button records a voice note (Korean or English) and adds the transcript to the note, using Whisper on the same provider. Optional settings:

```bash
AI_TRANSCRIBE_MODEL=whisper-large-v3-turbo   # default
AI_TRANSCRIBE_URL=                          # default: /audio/transcriptions next to AI_ENDPOINT_URL
```

API routes (login required): `GET /api/ai/status`, `POST /api/notes/:id/ai` (`{action, question}`), `POST /api/ai/ask` (`{question}`), `POST /api/ai/transcribe` (multipart `file`).

## Rotation Notes

If an API key was pasted into chat, screenshots, or any place outside the Hostinger secret store, revoke it in the provider console (Groq: API Keys page), create a new one, and update `AI_API_KEY` in Hostinger.

Keep the key dedicated to EDGE Note so it can be revoked without affecting other tools.

## Runtime Behavior

- Endpoint-backed actions are cached in MySQL by note content, action, model, and question.
- Find related notes runs locally and does not need an AI endpoint.
- AI failures do not block normal note editing.
- Responses are requested as compact JSON and parsed defensively if a provider returns plain text.
