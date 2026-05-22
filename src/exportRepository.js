import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { gzipSync } from "node:zlib";
import { listAllAttachments } from "./attachmentsRepository.js";
import { config } from "./config.js";
import { listNotebooks } from "./notebooksRepository.js";
import { listNotes } from "./notesRepository.js";
import { listTags } from "./tagsRepository.js";

function dateStamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function cleanFilename(value, maxLength = 70) {
  return String(value || "untitled")
    .trim()
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, " ")
    .slice(0, maxLength) || "untitled";
}

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
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

async function exportData({ userId }) {
  const [notebooks, tags, notes, attachments] = await Promise.all([
    listNotebooks({ userId }),
    listTags({ userId }),
    listNotes({ userId, limit: 1000 }),
    listAllAttachments({ userId })
  ]);

  return { notebooks, tags, notes, attachments };
}

function publicAttachment(attachment) {
  const { absolutePath, thumbnailAbsolutePath, ...safeAttachment } = attachment;
  return safeAttachment;
}

async function attachmentHealth(attachments) {
  const missingAttachments = [];
  const missingThumbnails = [];
  let totalAttachmentBytes = 0;
  let totalThumbnailBytes = 0;

  for (const attachment of attachments) {
    try {
      const file = await stat(attachment.absolutePath);
      totalAttachmentBytes += file.size;
    } catch {
      missingAttachments.push({
        id: attachment.id,
        noteId: attachment.noteId,
        filename: attachment.filename,
        storagePath: attachment.storagePath
      });
    }

    if (attachment.thumbnailAbsolutePath) {
      try {
        const file = await stat(attachment.thumbnailAbsolutePath);
        totalThumbnailBytes += file.size;
      } catch {
        missingThumbnails.push({
          id: attachment.id,
          noteId: attachment.noteId,
          filename: attachment.filename,
          thumbnailPath: attachment.thumbnailPath
        });
      }
    }
  }

  return {
    missingAttachments,
    missingThumbnails,
    totalAttachmentBytes,
    totalThumbnailBytes
  };
}

async function exportSummary({ notebooks, tags, notes, attachments }) {
  const health = await attachmentHealth(attachments);
  return {
    generatedAt: new Date().toISOString(),
    counts: {
      notebooks: notebooks.length,
      tags: tags.length,
      notes: notes.length,
      attachments: attachments.length,
      attachmentBytes: health.totalAttachmentBytes,
      thumbnailBytes: health.totalThumbnailBytes
    },
    ok: !health.missingAttachments.length && !health.missingThumbnails.length,
    missingAttachments: health.missingAttachments,
    missingThumbnails: health.missingThumbnails
  };
}

export async function buildExportStatus({ userId }) {
  const data = await exportData({ userId });
  return exportSummary(data);
}

export async function buildJsonExport({ userId }) {
  const data = await exportData({ userId });
  const summary = await exportSummary(data);
  const { notebooks, tags, notes, attachments } = data;

  return {
    filename: `edge-note-backup-${dateStamp()}.json`,
    contentType: "application/json; charset=utf-8",
    body: JSON.stringify({
      exportedAt: new Date().toISOString(),
      format: "edge-note-json-v1",
      summary,
      notebooks,
      tags,
      notes,
      attachments: attachments.map(publicAttachment)
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
  const data = await exportData({ userId });
  const summary = await exportSummary(data);
  const { notebooks, tags, notes, attachments } = data;
  const manifest = {
    exportedAt: new Date().toISOString(),
    format: "edge-note-archive-v1",
    summary,
    notebooks,
    tags,
    notes,
    attachments: attachments.map(publicAttachment),
    files: []
  };
  const entries = [
    tarEntry("manifest.json", JSON.stringify(manifest, null, 2)),
    ...notes.map((note) => {
      const filename = `notes/${note.id}-${cleanFilename(note.title, 62)}.md`;
      const body = markdownForNote(note);
      manifest.files.push({
        path: filename,
        type: "note",
        noteId: note.id,
        sizeBytes: Buffer.byteLength(body),
        checksum: sha256(body)
      });
      return tarEntry(filename, body, note.updatedAt);
    })
  ];

  for (const attachment of attachments) {
    const filename = `attachments/note-${attachment.noteId}/${attachment.id}-${cleanFilename(attachment.filename, 36)}`;
    try {
      const body = await readFile(attachment.absolutePath);
      manifest.files.push({
        path: filename,
        type: "attachment",
        attachmentId: attachment.id,
        noteId: attachment.noteId,
        sizeBytes: body.length,
        checksum: sha256(body)
      });
      entries.push(tarEntry(filename, body, attachment.createdAt));
    } catch {}

    if (attachment.thumbnailAbsolutePath) {
      const thumbName = `thumbnails/note-${attachment.noteId}/${attachment.id}-thumbnail`;
      try {
        const body = await readFile(attachment.thumbnailAbsolutePath);
        manifest.files.push({
          path: thumbName,
          type: "thumbnail",
          attachmentId: attachment.id,
          noteId: attachment.noteId,
          sizeBytes: body.length,
          checksum: sha256(body)
        });
        entries.push(tarEntry(thumbName, body, attachment.createdAt));
      } catch {}
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

function safeBackupFilename(filename) {
  const clean = basename(String(filename || ""));
  return /^edge-note-archive-[\w.-]+\.tar\.gz$/.test(clean) ? clean : null;
}

export async function createStoredBackup({ userId }) {
  await mkdir(config.backups.root, { recursive: true });

  const archive = await buildArchiveExport({ userId });
  const filename = archive.filename;
  const filePath = join(config.backups.root, filename);
  await writeFile(filePath, archive.body);

  const checksum = sha256(archive.body);
  const info = {
    filename,
    createdAt: new Date().toISOString(),
    sizeBytes: archive.body.length,
    checksum,
    downloadUrl: `/api/backups/${encodeURIComponent(filename)}/download`
  };
  await writeFile(`${filePath}.json`, JSON.stringify(info, null, 2));

  return info;
}

export async function listStoredBackups() {
  await mkdir(config.backups.root, { recursive: true });
  const files = await readdir(config.backups.root);
  const backups = [];

  for (const filename of files.filter((file) => safeBackupFilename(file))) {
    const filePath = join(config.backups.root, filename);
    const fileStat = await stat(filePath).catch(() => null);
    if (!fileStat?.isFile()) continue;

    const metadata = await readFile(`${filePath}.json`, "utf8")
      .then((value) => JSON.parse(value))
      .catch(() => ({}));

    backups.push({
      filename,
      createdAt: metadata.createdAt || fileStat.mtime.toISOString(),
      sizeBytes: fileStat.size,
      checksum: metadata.checksum || null,
      downloadUrl: `/api/backups/${encodeURIComponent(filename)}/download`
    });
  }

  return backups.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

export async function buildStoredBackupDownload({ filename }) {
  const safeFilename = safeBackupFilename(filename);
  if (!safeFilename) return null;

  const filePath = join(config.backups.root, safeFilename);
  const body = await readFile(filePath).catch(() => null);
  if (!body) return null;

  return {
    filename: safeFilename,
    contentType: "application/gzip",
    body
  };
}
