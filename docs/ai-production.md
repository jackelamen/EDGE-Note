# AI Production Setup

EDGE Note uses an OpenAI-compatible chat completions endpoint for manual AI actions. For the current Hostinger setup, use Gemini through Google's OpenAI-compatible endpoint.

## Hostinger Environment Values

Set these in the Hostinger Node app environment screen:

```bash
AI_ENDPOINT_URL=https://generativelanguage.googleapis.com/v1beta/openai/chat/completions
AI_MODEL_NAME=gemini-2.5-flash
AI_API_KEY=<your rotated and restricted Google AI key>
AI_TIMEOUT_MS=30000
AI_MAX_OUTPUT_TOKENS=800
```

Do not commit the real API key. Keep it in Hostinger environment variables only.

## Verify The Endpoint

After setting the variables and restarting the Node app, run:

```bash
npm run verify:ai
```

The command sends a tiny JSON-only request to the configured endpoint and confirms the model responds.

Inside the logged-in app, `GET /api/ai/status` runs the same check and returns safe status details without exposing `AI_API_KEY`.

## Rotation Notes

If an API key was pasted into chat, screenshots, or any place outside the Hostinger secret store, rotate it in Google AI Studio or Google Cloud, then update `AI_API_KEY` in Hostinger.

Restrict the key where your Google console allows it. At minimum, keep it dedicated to EDGE Note so it can be revoked without affecting other tools.

## Runtime Behavior

- Endpoint-backed actions are cached in MySQL by note content, action, model, and question.
- Find related notes runs locally and does not need an AI endpoint.
- AI failures do not block normal note editing.
- Responses are requested as compact JSON and parsed defensively if a provider returns plain text.
