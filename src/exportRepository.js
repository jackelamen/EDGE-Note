import { listNotebooks } from "./notebooksRepository.js";
import { listNotes } from "./notesRepository.js";
import { listTags } from "./tagsRepository.js";

function dateStamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function cleanFilename(value) {
  return String(value || "untitled")
    .trim()
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, " ")
    .slice(0, 90) || "untitled";
}

function markdownForNote(note) {
  const tags = note.tags?.length ? note.tags.map((tag) => `#${tag}`).join(" ") : "";
  const notebook = note.notebookName ? `Notebook: ${note.notebookName}` : "Notebook: None";
  const updated = note.updatedAt ? `Updated: ${new Date(note.updatedAt).toISOString()}` : "";

  return [
    `# ${note.title || "Untitled note"}`,
    "",
    notebook,
    tags ? `Tags: ${tags}` : "",
    updated,
    "",
    "---",
    "",
    note.body || ""
  ].filter((line, index, lines) => line || lines[index - 1] !== "").join("\n");
}

export async function buildJsonExport({ userId }) {
  const [notebooks, tags, notes] = await Promise.all([
    listNotebooks({ userId }),
    listTags({ userId }),
    listNotes({ userId, limit: 1000 })
  ]);

  return {
    filename: `edge-note-backup-${dateStamp()}.json`,
    contentType: "application/json; charset=utf-8",
    body: JSON.stringify({
      exportedAt: new Date().toISOString(),
      format: "edge-note-json-v1",
      notebooks,
      tags,
      notes
    }, null, 2)
  };
}

export async function buildMarkdownExport({ userId }) {
  const notes = await listNotes({ userId, limit: 1000 });
  const body = notes.map((note) => [
    `<!-- ${cleanFilename(note.title)}.md -->`,
    markdownForNote(note)
  ].join("\n")).join("\n\n\n");

  return {
    filename: `edge-note-markdown-${dateStamp()}.md`,
    contentType: "text/markdown; charset=utf-8",
    body
  };
}
