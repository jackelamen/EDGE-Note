// Builds public/lucide-sprite.svg containing only the icons the app references.
// The full lucide-static sprite is ~470 KB / 1,700 icons; the app injects the
// sprite into the page on every load, so shipping all of it made startup slow.
// Re-run after adding a new icon:  node scripts/build-icon-sprite.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("..", import.meta.url));
const source = readFileSync(join(root, "node_modules/lucide-static/sprite.svg"), "utf8");
const publicDir = join(root, "public");

// Everything that can name an icon: markup and the app/graph scripts.
// The app bundle is versioned; use whichever one index.html loads.
const indexHtml = readFileSync(join(publicDir, "index.html"), "utf8");
const appBundle = indexHtml.match(/\/(app\.v\d+\.js)/)[1];
const code = ["index.html", "graph.html", "graph.v1.js", appBundle]
  .map((file) => readFileSync(join(publicDir, file), "utf8"))
  .join("\n");

const symbols = [...source.matchAll(/<symbol\b[^>]*\bid="([^"]+)"[\s\S]*?<\/symbol>/g)];
const escapeRe = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const kept = symbols.filter(([, id]) => new RegExp(`(?<![\\w-])${escapeRe(id)}(?![\\w-])`).test(code));

const header = source.slice(0, source.indexOf("<defs>"));
const output = `${header}<defs>\n${kept.map(([block]) => `    ${block.trim()}`).join("\n")}\n  </defs>\n</svg>\n`;
writeFileSync(join(publicDir, "lucide-sprite.svg"), output);
console.log(`lucide-sprite.svg: ${kept.length} of ${symbols.length} icons, ${(output.length / 1024).toFixed(1)} KB`);
