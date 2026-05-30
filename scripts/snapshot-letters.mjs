/**
 * snapshot-letters.mjs  —  golden-file snapshot of rendered genealogy (Phase 0)
 *
 * Captures the exact rendered genealogy content of every letter page so we can
 * diff before/after a rendering change (Phases 3–4) and SEE precisely what moved.
 *
 * Each source line renders to one `<div class="geo-line" style="…">…</div>` with
 * no nested divs, so we extract those verbatim (indent style included) and write
 * one snapshot file per letter. Nav/intro/footer are excluded — only the geo body.
 *
 * Requires a fresh build first (reads from dist/). Read-only w.r.t. source.
 *
 *   npm run build            # produce dist/
 *   node scripts/snapshot-letters.mjs [outDir]   # default outDir: snapshots/
 *
 * Workflow: snapshot to before/, make the change + rebuild, snapshot to after/,
 * then `diff -ru before after`.
 */
import fs from 'node:fs';
import path from 'node:path';

const DIST = 'dist/Viningfamilies';
const outDir = process.argv[2] ?? 'snapshots';
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

if (!fs.existsSync(DIST)) {
  console.error(`No ${DIST}/ — run \`npm run build\` first.`);
  process.exit(1);
}
fs.mkdirSync(outDir, { recursive: true });

const GEO_LINE = /<div class="geo-line"[^>]*>.*?<\/div>/g;
let written = 0, totalLines = 0;
for (const L of LETTERS) {
  const file = path.join(DIST, `${L}families.htm`);
  if (!fs.existsSync(file)) continue;
  const html = fs.readFileSync(file, 'utf8');
  const lines = html.match(GEO_LINE) ?? [];
  // one geo-line per output line keeps diffs line-oriented and readable
  fs.writeFileSync(path.join(outDir, `${L}.txt`), lines.join('\n') + '\n');
  written++;
  totalLines += lines.length;
}
console.log(`Wrote ${written} letter snapshots (${totalLines} geo-lines) to ${outDir}/`);
