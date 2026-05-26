import { readFile } from "node:fs/promises";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const readme = await readFile("README.md", "utf8");
const smoke = await readFile("docs/smoke-test.md", "utf8");
const daily = await readFile("docs/daily-use-qa.md", "utf8");
const app = await readFile("public/app.v66.js", "utf8");
const html = await readFile("public/index.html", "utf8");

assert(!readme.includes("Cmd/Ctrl+P"), "README still documents removed preview shortcut.");
assert(!smoke.includes("Toggle Preview"), "Smoke test still expects removed preview mode.");
assert(app.includes("beforeunload"), "App is missing unsynced-work close warning.");
assert(app.includes("hasUnsyncedWork"), "App is missing unsynced-work detection.");
assert(html.includes("data-mobile-tabs"), "Mobile tab navigation hook is missing.");
assert(html.includes("data-backup-list"), "Saved backup list hook is missing.");
assert(daily.includes("Safety Flow"), "Daily use QA doc is missing safety flow.");
assert(daily.includes("Mobile Width Flow"), "Daily use QA doc is missing mobile flow.");

console.log("EDGE Note daily use QA check passed.");
