import { createHash } from "node:crypto";
import { config } from "./config.js";
import { query } from "./db.js";
import { findRelatedNotes, getNote } from "./notesRepository.js";

const actions = {
  summarize: {
    label: "summarize",
    instruction: "Summarize the note in 3 concise bullets. Return JSON with a summary array."
  },
  "extract-tasks": {
    label: "extract tasks",
    instruction: "Extract actionable tasks from the note. Return JSON with a tasks array."
  },
  "suggest-tags": {
    label: "suggest tags",
    instruction: "Suggest 3 to 8 lowercase tags for this note. Return JSON with a tags array."
  },
  "create-title": {
    label: "create title",
    instruction: "Create a short clear title for this note. Return JSON with a title string."
  },
  "clean-up": {
    label: "clean up",
    instruction: "Clean up the note for clarity while preserving the author's intent and details. Return JSON with a text string."
  },
  "find-related": {
    label: "find related",
    local: true
  },
  "ask-note": {
    label: "ask note",
    instruction: "Answer the user's question using only this note. If the note does not contain the answer, say so. Return JSON with an answer string."
  }
};

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

async function getCachedOutput({ noteId, outputType, modelName, inputChecksum }) {
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

  return rows[0] || null;
}

async function cacheOutput({ noteId, outputType, modelName, inputChecksum, outputJson }) {
  await query(
    `INSERT INTO ai_outputs
       (note_id, output_type, model_name, input_checksum, output_json)
     VALUES
       (:noteId, :outputType, :modelName, :inputChecksum, CAST(:outputJson AS JSON))
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
}

function parseJsonContent(content) {
  const cleanContent = String(content || "")
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(cleanContent);
  } catch {
    return { text: cleanContent || content };
  }
}

function aiRequestHeaders() {
  return {
    "content-type": "application/json",
    ...(config.ai.apiKey ? { authorization: `Bearer ${config.ai.apiKey}` } : {})
  };
}

function aiRequestBody({ messages, temperature = 0.2 }) {
  return {
    model: config.ai.modelName,
    messages,
    temperature,
    max_tokens: config.ai.maxOutputTokens,
    response_format: { type: "json_object" }
  };
}

async function postAiChat(body) {
  if (!config.ai.endpointUrl) {
    const error = new Error("Configure AI_ENDPOINT_URL before running AI actions.");
    error.status = 503;
    throw error;
  }

  const response = await fetch(config.ai.endpointUrl, {
    method: "POST",
    headers: aiRequestHeaders(),
    signal: AbortSignal.timeout(config.ai.timeoutMs),
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const error = new Error("AI endpoint request failed.");
    error.status = response.status;
    error.details = await response.text().catch(() => "");
    throw error;
  }

  const payload = await response.json();
  const content = payload.choices?.[0]?.message?.content || payload.output || payload.response || "";
  return parseJsonContent(content);
}

async function callAiEndpoint({ action, note, question = "" }) {
  return postAiChat(aiRequestBody({
    messages: [
      {
        role: "system",
        content: "You are EDGE Note's private notes assistant. Return compact valid JSON only."
      },
      {
        role: "user",
        content: `${actions[action].instruction}${question ? `\n\nQuestion: ${question}` : ""}\n\nTitle: ${note.title}\n\nBody:\n${note.body}`
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

  if (action === "ask-note" && !String(question || "").trim()) {
    const error = new Error("Ask a question before running this AI action.");
    error.status = 400;
    throw error;
  }

  const modelName = config.ai.modelName;
  const inputChecksum = checksumFor(note, action, question);
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

  const output = await callAiEndpoint({ action, note, question });
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
