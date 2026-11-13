import { createHash } from "node:crypto";
import { config } from "./config.js";
import { query } from "./db.js";
import { findRelatedNotes, getNote, searchNotesByTerms } from "./notesRepository.js";

// Every action states the exact JSON shape it expects back and answers in
// the note's own language (EDGE Note is used in English and Korean).
const sameLanguage = "Write in the same language as the note (Korean notes get Korean output).";

// House style for everything shown in the app: no em dashes.
const styleRule = "Never use em dashes; use commas, colons or periods instead.";

// Backstop for the style rule: models still slip, and older cached answers
// predate it. Applied to every AI output (strings, arrays, objects).
export function withoutEmDashes(value) {
  if (typeof value === "string") {
    return value
      .replace(/(\S)\s*\u2014\s*(\S)/g, "$1, $2")
      .replace(/\s*\u2014\s*/g, " ")
      .trim();
  }
  if (Array.isArray(value)) return value.map(withoutEmDashes);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, withoutEmDashes(item)]));
  }
  return value;
}

const actions = {
  summarize: {
    label: "summarize",
    instruction: `Summarize the note in 3 to 5 concise bullet points. ${sameLanguage} Return JSON: {"summary": ["point", ...]}`
  },
  "extract-tasks": {
    label: "extract tasks",
    instruction: `List the concrete, actionable tasks in the note, each as a short imperative phrase. Skip tasks already marked done. ${sameLanguage} Return JSON: {"tasks": ["task", ...]} (an empty array if there are none).`
  },
  "suggest-tags": {
    label: "suggest tags",
    instruction: 'Suggest 3 to 6 short lowercase tags (single words or hyphenated, no "#") that would help find this note later. Return JSON: {"tags": ["tag", ...]}'
  },
  "create-title": {
    label: "create title",
    instruction: `Write a short, specific title for this note (at most 8 words, no quotes). ${sameLanguage} Return JSON: {"title": "..."}`
  },
  "clean-up": {
    label: "clean up",
    long: true,
    instruction: `Rewrite the note for clarity and structure while keeping every fact, name, number and the author's voice. Fix spelling and grammar. Use simple Markdown: "## " headings, "- " bullets, "- [ ] " for open tasks, "- [x] " for done tasks, **bold** for key terms. ${sameLanguage} Return JSON: {"markdown": "..."}`
  },
  translate: {
    label: "translate",
    long: true,
    instruction: 'Translate the note. If it is mainly Korean, translate it into natural English; otherwise translate it into natural Korean. Keep names, numbers and the structure. Use simple Markdown ("## " headings, "- " bullets, "- [ ] " tasks). Return JSON: {"language": "en" or "ko" (the language you translated INTO), "markdown": "..."}'
  },
  "find-related": {
    label: "find related",
    local: true
  },
  "ask-note": {
    label: "ask note",
    instruction: 'Answer the question using only this note. Reply in the language of the question. If the note does not contain the answer, say so briefly. Return JSON: {"answer": "..."}'
  }
};

export const aiActionNames = Object.keys(actions);

const maxNoteChars = 24000;
const askAllNoteChars = 4000;
const askAllTotalChars = 20000;

// Notes are stored as editor HTML; send the model readable plain text with
// list and checkbox structure preserved (fewer tokens, better answers).
export function htmlToPlainText(html) {
  return String(html || "")
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
    .replace(/<li\b[^>]*>\s*<input\b[^>]*\bchecked\b[^>]*>\s*/gi, "\n- [x] ")
    .replace(/<li\b[^>]*>\s*<input\b[^>]*>\s*/gi, "\n- [ ] ")
    .replace(/<li\b[^>]*>\s*/gi, "\n- ")
    .replace(/<h[1-6]\b[^>]*>/gi, "\n\n## ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|blockquote|pre|tr|ul|ol)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function noteText(note, limit = maxNoteChars) {
  const text = note.bodyFormat === "html" || /<[a-z][\s\S]*>/i.test(note.body || "")
    ? htmlToPlainText(note.body)
    : String(note.body || "");
  return text.length > limit ? `${text.slice(0, limit)}\n…(truncated)` : text;
}

function checksumFor(note, action, extra = "") {
  return createHash("sha256")
    .update(action)
    .update("\n")
    .update(note.title || "")
    .update("\n")
    .update(note.body || "")
    .update("\n")
    .update(extra)
    .digest("hex");
}

// The ai_outputs cache only saves repeat calls. It must never block an
// answer: if the table is missing or the database rejects the query, log it
// and carry on without the cache.
function logCacheProblem(step, error) {
  console.error(`AI cache ${step} skipped: ${error.code || ""} ${error.sqlMessage || error.message}`);
}

async function getCachedOutput({ noteId, outputType, modelName, inputChecksum }) {
  try {
    const rows = await query(
      `SELECT output_json AS outputJson, created_at AS createdAt
       FROM ai_outputs
       WHERE note_id = :noteId
         AND output_type = :outputType
         AND model_name = :modelName
         AND input_checksum = :inputChecksum
       LIMIT 1`,
      { noteId, outputType, modelName, inputChecksum }
    );
    const row = rows[0];
    if (!row) return null;
    // MySQL returns a JSON column parsed; MariaDB (JSON = LONGTEXT) returns text.
    const outputJson = typeof row.outputJson === "string" ? JSON.parse(row.outputJson) : row.outputJson;
    return { ...row, outputJson: withoutEmDashes(outputJson) };
  } catch (error) {
    logCacheProblem("read", error);
    return null;
  }
}

async function cacheOutput({ noteId, outputType, modelName, inputChecksum, outputJson }) {
  try {
    // Plain JSON text: valid for a MySQL JSON column and for MariaDB, which
    // rejects CAST(... AS JSON) (Hostinger's shared databases are MariaDB).
    await query(
      `INSERT INTO ai_outputs
         (note_id, output_type, model_name, input_checksum, output_json)
       VALUES
         (:noteId, :outputType, :modelName, :inputChecksum, :outputJson)
       ON DUPLICATE KEY UPDATE
         output_json = VALUES(output_json),
         created_at = CURRENT_TIMESTAMP`,
      {
        noteId,
        outputType,
        modelName,
        inputChecksum,
        outputJson: JSON.stringify(outputJson)
      }
    );
  } catch (error) {
    logCacheProblem("write", error);
  }
}

export function parseJsonContent(content) {
  const cleanContent = String(content || "")
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(cleanContent);
  } catch {
    // Some models wrap JSON in prose; take the outermost object if present.
    const match = cleanContent.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        // fall through
      }
    }
    return { text: cleanContent || content };
  }
}

function aiRequestHeaders() {
  return {
    "content-type": "application/json",
    ...(config.ai.apiKey ? { authorization: `Bearer ${config.ai.apiKey}` } : {})
  };
}

export function aiRequestBody({ messages, temperature = 0.2, long = false }) {
  const body = {
    model: config.ai.modelName,
    messages,
    temperature,
    // Rewrites and translations return the whole note, so they get a larger
    // budget than the configured default.
    max_tokens: long ? Math.max(config.ai.maxOutputTokens, 4000) : config.ai.maxOutputTokens,
    response_format: { type: "json_object" }
  };
  // Reasoning models (gpt-oss on Groq) spend output tokens on thinking;
  // keep that short so the answer fits the budget and returns fast.
  if (/gpt-oss/i.test(config.ai.modelName)) {
    body.reasoning_effort = "low";
  }
  return body;
}

function providerError(status, details) {
  const messages = {
    400: "The AI provider rejected the request. Check AI_MODEL_NAME.",
    401: "The AI provider rejected the API key. Check AI_API_KEY.",
    403: "The AI provider refused access. Check AI_API_KEY and the model's permissions.",
    404: "The AI model or endpoint was not found. Check AI_ENDPOINT_URL and AI_MODEL_NAME.",
    413: "This note is too long for the AI model.",
    429: "AI rate limit reached. Wait a minute and try again."
  };
  const error = new Error(messages[status] || `The AI provider returned an error (${status}).`);
  // Surface provider problems as 502 so the app never mistakes a provider
  // 401 for its own login having expired.
  error.status = status === 429 ? 429 : 502;
  error.details = details;
  return error;
}

async function postAiChat(body) {
  if (!config.ai.endpointUrl) {
    const error = new Error("AI is not set up. Add AI_ENDPOINT_URL, AI_MODEL_NAME and AI_API_KEY to the server environment.");
    error.status = 503;
    throw error;
  }

  const send = (payload) => fetch(config.ai.endpointUrl, {
    method: "POST",
    headers: aiRequestHeaders(),
    signal: AbortSignal.timeout(config.ai.timeoutMs),
    body: JSON.stringify(payload)
  });

  let response;
  try {
    response = await send(body);
    // Not every model supports JSON mode / reasoning_effort; retry once
    // without the optional parameters instead of failing.
    if (response.status === 400) {
      const details = await response.text().catch(() => "");
      if (/response_format|json_object|reasoning_effort|json mode/i.test(details)) {
        const { response_format: _rf, reasoning_effort: _re, ...plain } = body;
        response = await send(plain);
      } else {
        throw providerError(400, details);
      }
    }
  } catch (error) {
    if (error.status) throw error;
    const timeout = error.name === "TimeoutError" || error.name === "AbortError";
    const wrapped = new Error(timeout ? "The AI provider took too long to answer. Try again." : "Could not reach the AI provider.");
    wrapped.status = 504;
    throw wrapped;
  }

  if (!response.ok) {
    throw providerError(response.status, await response.text().catch(() => ""));
  }

  const payload = await response.json();
  const content = payload.choices?.[0]?.message?.content || payload.output || payload.response || "";
  if (!String(content).trim()) {
    const error = new Error("The AI returned an empty answer. Try again, or raise AI_MAX_OUTPUT_TOKENS.");
    error.status = 502;
    throw error;
  }
  return withoutEmDashes(parseJsonContent(content));
}

async function callAiEndpoint({ action, note, question = "" }) {
  return postAiChat(aiRequestBody({
    long: Boolean(actions[action].long),
    messages: [
      {
        role: "system",
        content: `You are EDGE Note's private notes assistant. Follow the requested JSON shape exactly. ${styleRule} Return compact valid JSON only.`
      },
      {
        role: "user",
        content: `${actions[action].instruction}${question ? `\n\nQuestion: ${question}` : ""}\n\nTitle: ${note.title}\n\nNote:\n${noteText(note)}`
      }
    ]
  }));
}

function relatedOutput(notes) {
  return {
    related: notes.map((note) => ({
      id: note.id,
      title: note.title,
      notebookName: note.notebookName,
      tags: note.tags,
      updatedAt: note.updatedAt
    }))
  };
}

export async function checkAiEndpoint() {
  if (!config.ai.endpointUrl) {
    return {
      ok: false,
      configured: false,
      modelName: config.ai.modelName,
      message: "AI endpoint is not configured."
    };
  }

  try {
    const output = await postAiChat(aiRequestBody({
      messages: [
        {
          role: "system",
          content: "Return compact valid JSON only."
        },
        {
          role: "user",
          content: "Return {\"ok\":true,\"label\":\"edge-note-ai-check\"}."
        }
      ],
      temperature: 0
    }));

    return {
      ok: true,
      configured: true,
      modelName: config.ai.modelName,
      output
    };
  } catch (error) {
    return {
      ok: false,
      configured: true,
      modelName: config.ai.modelName,
      status: error.status || null,
      message: error.message
    };
  }
}

export async function runAiAction({ userId, noteId, action, question = "" }) {
  if (!actions[action]) {
    const error = new Error("Unknown AI action.");
    error.status = 404;
    throw error;
  }

  const note = await getNote({ userId, noteId });
  if (!note) {
    const error = new Error("Note not found.");
    error.status = 404;
    throw error;
  }

  if (action === "find-related") {
    return {
      action,
      modelName: "local-search",
      cached: false,
      output: relatedOutput(await findRelatedNotes({ userId, noteId })),
      createdAt: new Date().toISOString()
    };
  }

  const cleanQuestion = String(question || "").trim().slice(0, 1000);
  if (action === "ask-note" && !cleanQuestion) {
    const error = new Error("Ask a question before running this AI action.");
    error.status = 400;
    throw error;
  }

  const modelName = config.ai.modelName;
  const inputChecksum = checksumFor(note, action, cleanQuestion);
  const cached = await getCachedOutput({
    noteId,
    outputType: action,
    modelName,
    inputChecksum
  });

  if (cached) {
    return {
      action,
      modelName,
      cached: true,
      output: cached.outputJson,
      createdAt: cached.createdAt
    };
  }

  const output = await callAiEndpoint({ action, note, question: cleanQuestion });
  await cacheOutput({
    noteId,
    outputType: action,
    modelName,
    inputChecksum,
    outputJson: output
  });

  return {
    action,
    modelName,
    cached: false,
    output,
    createdAt: new Date().toISOString()
  };
}

// ─── Ask across all notes ──────────────────────────────────────────────
const questionStopWords = new Set([
  "a", "an", "and", "are", "about", "did", "do", "does", "for", "from", "have", "how",
  "i", "in", "is", "it", "me", "my", "of", "on", "or", "the", "to", "was", "we", "what",
  "when", "where", "which", "who", "why", "with", "you", "your", "notes", "note",
  "무엇", "어떻게", "언제", "어디", "누가", "왜", "있나요", "있어", "알려줘", "관련"
]);

// Pull search terms out of a natural-language question. Korean words carry
// particles (가격은, 온보딩을); drop a trailing particle so LIKE still matches.
export function questionTerms(question) {
  const words = String(question || "").toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}'-]*/gu) || [];
  const terms = [];
  for (const raw of words) {
    let word = raw;
    if (/^[가-힣]+$/.test(word) && word.length >= 3 && /[은는이가을를의에도와과로]$/.test(word)) {
      word = word.slice(0, -1);
    }
    const minLength = /[가-힣]/.test(word) ? 2 : 3;
    if (word.length < minLength || questionStopWords.has(word) || terms.includes(word)) continue;
    terms.push(word);
  }
  return terms.slice(0, 8);
}

export async function askAllNotes({ userId, question }) {
  const cleanQuestion = String(question || "").trim().slice(0, 1000);
  if (!cleanQuestion) {
    const error = new Error("Ask a question first.");
    error.status = 400;
    throw error;
  }

  const notes = await searchNotesByTerms({ userId, terms: questionTerms(cleanQuestion), limit: 6 });
  if (!notes.length) {
    return { answer: "I couldn't find any notes about that.", sources: [], modelName: config.ai.modelName };
  }

  let budget = askAllTotalChars;
  const context = [];
  for (const note of notes) {
    if (budget <= 0) break;
    const text = noteText(note, Math.min(askAllNoteChars, budget));
    budget -= text.length;
    context.push(`[Note ${note.id}] ${note.title}${note.tags?.length ? ` (tags: ${note.tags.join(", ")})` : ""}\n${text}`);
  }

  const output = await postAiChat(aiRequestBody({
    messages: [
      {
        role: "system",
        content: `You are EDGE Note's private notes assistant. Answer only from the notes provided. ${styleRule} Return compact valid JSON only.`
      },
      {
        role: "user",
        content: `Answer the question using only these notes. Reply in the language of the question, concisely. If the notes don't contain the answer, say so. Return JSON: {"answer": "...", "sourceIds": [note ids you used]}\n\nQuestion: ${cleanQuestion}\n\n${context.join("\n\n---\n\n")}`
      }
    ]
  }));

  // Only cite notes that were actually provided (ignore invented ids).
  const byId = new Map(notes.map((note) => [Number(note.id), note]));
  const sources = (Array.isArray(output.sourceIds) ? output.sourceIds : [])
    .map((id) => byId.get(Number(id)))
    .filter(Boolean)
    .map((note) => ({ id: note.id, title: note.title }));

  return {
    answer: String(output.answer || output.text || "").trim() || "No answer.",
    sources,
    modelName: config.ai.modelName
  };
}

// ─── Voice notes: speech to text ───────────────────────────────────────
// Groq (and OpenAI) serve Whisper at /audio/transcriptions next to
// /chat/completions; derive it unless AI_TRANSCRIBE_URL is set.
export function transcribeUrl() {
  if (config.ai.transcribeUrl) return config.ai.transcribeUrl;
  if (/\/chat\/completions\/?$/.test(config.ai.endpointUrl)) {
    return config.ai.endpointUrl.replace(/\/chat\/completions\/?$/, "/audio/transcriptions");
  }
  return "";
}

export async function transcribeAudio({ file }) {
  const url = transcribeUrl();
  if (!url) {
    const error = new Error("Voice notes need an OpenAI-compatible AI endpoint (or AI_TRANSCRIBE_URL).");
    error.status = 503;
    throw error;
  }
  if (!file?.buffer?.length) {
    const error = new Error("No audio was received.");
    error.status = 400;
    throw error;
  }

  const form = new FormData();
  form.append("file", new Blob([file.buffer], { type: file.mimeType || "audio/webm" }), file.filename || "voice.webm");
  form.append("model", config.ai.transcribeModel);
  form.append("response_format", "json");
  form.append("temperature", "0");

  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: config.ai.apiKey ? { authorization: `Bearer ${config.ai.apiKey}` } : {},
      signal: AbortSignal.timeout(Math.max(config.ai.timeoutMs, 60000)),
      body: form
    });
  } catch (error) {
    const wrapped = new Error("Could not reach the transcription service.");
    wrapped.status = 504;
    throw wrapped;
  }

  if (!response.ok) {
    throw providerError(response.status, await response.text().catch(() => ""));
  }

  const payload = await response.json();
  return { text: withoutEmDashes(String(payload.text || "").trim()), modelName: config.ai.transcribeModel };
}
