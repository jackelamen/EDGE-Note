import { randomUUID } from "node:crypto";
import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { config } from "../src/config.js";

async function assertWritableDirectory(label, directory) {
  await mkdir(directory, { recursive: true });
  const info = await stat(directory);
  if (!info.isDirectory()) {
    throw new Error(`${label} is not a directory: ${directory}`);
  }

  const probe = join(directory, `.edge-note-write-test-${randomUUID()}`);
  await writeFile(probe, "ok");
  await rm(probe, { force: true });
}

try {
  await assertWritableDirectory("ATTACHMENT_ROOT", config.attachments.root);
  await assertWritableDirectory("BACKUP_ROOT", config.backups.root);
  console.log("EDGE Note data safety check passed.");
} catch (error) {
  console.error(`Data safety check failed: ${error.message}`);
  process.exitCode = 1;
}
