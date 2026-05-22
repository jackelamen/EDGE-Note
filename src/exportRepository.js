import { readFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { listAllAttachments } from "./attachmentsRepository.js";
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

function tarChecksum(header) {
  let sum = 0;
  for (const byte of header) sum += byte;
  return sum;
}

function writeOctal(header, value, offset, length) {
  const text = Math.max(0, Number(value) || 0).toString(8).slice(0, length - 1).padStart(length - 1, "0");
  header.write(`${text}\0`, offset, length, "ascii");
}

function tarHeader(name, size, mtime = Date.now()) {
  const header = Buffer.alloc(512, 0);
  const cleanName = name.replace(/^\/+/, "").slice(0, 100);
  header.write(cleanName, 0, Math.min(Buffer.byteLength(cleanName), 100), "utf8");
  writeOctal(header, 0o644, 100, 8);
  writeOctal(header, 0, 108, 8);
  writeOctal(header, 0, 116, 8);
  writeOctal(header, size, 124, 12);
  writeOctal(header, Math.floor(new Date(mtime).getTime() / 1000), 136, 12);
  header.fill(" ", 148, 156);
  header.write("0", 156, 1, "ascii");
  header.write("ustar", 257, 5, "ascii");
  header.write("00", 263, 2, "ascii");
  writeOctal(header, tarChecksum(header), 148, 8);
  return header;
}

function tarEntry(name, content, mtime) {
  const body = Buffer.isBuffer(content) ? content : Buffer.from(String(content), "utf8");
  const padding = Buffer.alloc((512 - (body.length % 512)) % 512, 0);
  return Buffer.concat([tarHeader(name, body.length, mtime), body, padding]);
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
  const [notebooks, tags, notes, attachments] = await Promise.all([
    listNotebooks({ userId }),
    listTags({ userId }),
    listNotes({ userId, limit: 1000 }),
    listAllAttachments({ userId })
  ]);

  return {
    filename: `edge-note-backup-${dateStamp()}.json`,
    contentType: "application/json; charset=utf-8",
    body: JSON.stringify({
      exportedAt: new Date().toISOString(),
      format: "edge-note-json-v1",
      notebooks,
      tags,
      notes,
      attachments: attachments.map(({ absolutePath, thumbnailAbsolutePath, ...attachment }) => attachment)
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

export async function buildArchiveExport({ userId }) {
  const [notebooks, tags, notes, attachments] = await Promise.all([
    listNotebooks({ userId }),
    listTags({ userId }),
    listNotes({ userId, limit: 1000 }),
    listAllAttachments({ userId })
  ]);
  const manifest = {
    exportedAt: new Date().toISOString(),
    format: "edge-note-archive-v1",
    notebooks,
    tags,
    notes,
    attachments: attachments.map(({ absolutePath, thumbnailAbsolutePath, ...attachment }) => attachment),
    missingAttachments: [],
    missingThumbnails: []
  };
  const entries = [
    tarEntry("manifest.json", JSON.stringify(manifest, null, 2)),
    ...notes.map((note) => tarEntry(`notes/${note.id}-${cleanFilename(note.title)}.md`, markdownForNote(note), note.updatedAt))
  ];

  for (const attachment of attachments) {
    const filename = `attachments/note-${attachment.noteId}/${attachment.id}-${cleanFilename(attachment.filename)}`;
    try {
      entries.push(tarEntry(filename, await readFile(attachment.absolutePath), attachment.createdAt));
    } catch {
      manifest.missingAttachments.push({
        id: attachment.id,
        noteId: attachment.noteId,
        filename: attachment.filename,
        storagePath: attachment.storagePath
      });
    }

    if (attachment.thumbnailAbsolutePath) {
      const thumbName = `thumbnails/note-${attachment.noteId}/${attachment.id}-thumbnail`;
      try {
        entries.push(tarEntry(thumbName, await readFile(attachment.thumbnailAbsolutePath), attachment.createdAt));
      } catch {
        manifest.missingThumbnails.push({
          id: attachment.id,
          noteId: attachment.noteId,
          filename: attachment.filename,
          thumbnailPath: attachment.thumbnailPath
        });
      }
    }
  }

  entries[0] = tarEntry("manifest.json", JSON.stringify(manifest, null, 2));
  const tar = Buffer.concat([...entries, Buffer.alloc(1024, 0)]);
  return {
    filename: `edge-note-archive-${dateStamp()}.tar.gz`,
    contentType: "application/gzip",
    body: gzipSync(tar)
  };
}
