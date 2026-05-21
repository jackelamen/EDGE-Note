import { createHash } from "node:crypto";
import { config } from "./config.js";
import { query } from "./db.js";
import { getNote } from "./notesRepository.js";

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
  }
};

function checksumFor(note, action) {
  return createHash("sha256")
    .update(action)
    .update("\n")
    .update(note.title || "")
    .update("\n")
    .update(note.body || "")
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
  try {
    return JSON.parse(content);
  } catch {
    return { text: content };
  }
}

async function callAiEndpoint({ action, note }) {
  if (!config.ai.endpointUrl) {
    const error = new Error("Configure AI_ENDPOINT_URL before running AI actions.");
    error.status = 503;
    throw error;
  }

  const response = await fetch(config.ai.endpointUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(config.ai.apiKey ? { authorization: `Bearer ${config.ai.apiKey}` } : {})
    },
    body: JSON.stringify({
      model: config.ai.modelName,
      messages: [
        {
          role: "system",
          content: "You are EDGE Note's private notes assistant. Return compact valid JSON only."
        },
        {
          role: "user",
          content: `${actions[action].instruction}\n\nTitle: ${note.title}\n\nBody:\n${note.body}`
        }
      ],
      temperature: 0.2
    })
  });

  if (!response.ok) {
    const error = new Error("AI endpoint request failed.");
    error.status = response.status;
    throw error;
  }

  const payload = await response.json();
  const content = payload.choices?.[0]?.message?.content || payload.output || payload.response || "";
  return parseJsonContent(content);
}

export async function runAiAction({ userId, noteId, action }) {
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

  const modelName = config.ai.modelName;
  const inputChecksum = checksumFor(note, action);
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

  const output = await callAiEndpoint({ action, note });
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
