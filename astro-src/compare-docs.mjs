// compare-docs.mjs
// Usage: node compare-docs.mjs [LETTER]
//   No letter = all letters A-W
//   With letter = just that one letter
//
// Compares old HTML doc pages (read from disk) vs new Astro-rendered pages
// (fetched from localhost:4321). Outputs results to compare-docs-results.txt.
//
// Requirements: dev server must be running on localhost:4321

import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const OLD_BASE = '/Users/johnvining/Documents/GitHub/vfa/Viningfamilies';
const ASTRO_BASE = 'http://localhost:4321';
const OUT_FILE = path.join(import.meta.dirname, 'compare-docs-results.txt');
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').filter(l =>
  fs.existsSync(path.join(OLD_BASE, `${l}sources`))
);

// ─── Text normalization ────────────────────────────────────────────────────────

function decodeEntities(str) {
  return str
    .replace(/&nbsp;/g, ' ')
    .replace(/&#8220;/g, '"').replace(/&#8221;/g, '"')
    .replace(/&#8216;/g, '‘').replace(/&#8217;/g, '’')
    .replace(/&#8211;/g, '–').replace(/&#8212;/g, '—')
    .replace(/&#8230;/g, '…')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)))
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"');
}

function extractText(html) {
  return decodeEntities(
    html
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function extractImages(html) {
  const images = new Set();
  const re = /<img\s[^>]*>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const srcM = m[0].match(/src=["']?([^"'\s>]+)["']?/i);
    if (srcM) images.add(path.basename(srcM[1]).toLowerCase());
  }
  return images;
}

function stripComments(html) {
  return html.replace(/<!--[\s\S]*?-->/g, '');
}

function getDocBody(html) {
  // Extract everything from "Documentation for" heading onward
  const bodyM = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (!bodyM) return html;
  const body = stripComments(bodyM[1]);
  const docIdx = body.search(/Documentation\s+for/i);
  return docIdx >= 0 ? body.slice(docIdx) : body;
}

function normalizeForCompare(html) {
  const body = getDocBody(html);
  return extractText(body);
}

function setDiff(a, b) {
  const onlyA = [...a].filter(x => !b.has(x));
  const onlyB = [...b].filter(x => !a.has(x));
  return { onlyA, onlyB };
}

// ─── Word-level diff ───────────────────────────────────────────────────────────

function wordDiff(a, b, maxContext = 8) {
  const wordsA = a.split(/\s+/).filter(Boolean);
  const wordsB = b.split(/\s+/).filter(Boolean);

  // Simple LCS-based diff — report first few differences
  const diffs = [];
  let i = 0, j = 0;
  while (i < wordsA.length && j < wordsB.length) {
    if (wordsA[i] === wordsB[j]) { i++; j++; continue; }
    // Find resync point
    let foundA = -1, foundB = -1;
    for (let look = 1; look <= 20; look++) {
      if (i + look < wordsA.length && wordsA[i + look] === wordsB[j]) { foundA = i + look; break; }
      if (j + look < wordsB.length && wordsA[i] === wordsB[j + look]) { foundB = j + look; break; }
      if (i + look < wordsA.length && j + look < wordsB.length && wordsA[i + look] === wordsB[j + look]) {
        foundA = i + look; foundB = j + look; break;
      }
    }
    const ctxA = wordsA.slice(Math.max(0, i - 3), i + 5).join(' ');
    const ctxB = wordsB.slice(Math.max(0, j - 3), j + 5).join(' ');
    diffs.push(`  OLD: ...${ctxA}...`);
    diffs.push(`  NEW: ...${ctxB}...`);
    if (diffs.length >= maxContext * 2) { diffs.push('  (more differences truncated)'); break; }
    if (foundA >= 0) { i = foundA; continue; }
    if (foundB >= 0) { j = foundB; continue; }
    i++; j++;
  }
  return diffs;
}

// ─── Fetch with timeout ────────────────────────────────────────────────────────

async function fetchPage(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return { ok: false, status: res.status };
    const text = await res.text();
    return { ok: true, text };
  } catch (e) {
    return { ok: false, error: e.message };
  } finally {
    clearTimeout(timer);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const filterLetter = process.argv[2]?.toUpperCase();
const letters = filterLetter ? [filterLetter] : LETTERS;

const lines = [];
const summary = { identical: 0, textDiff: 0, imageDiff: 0, both: 0, fetchError: 0, noOld: 0 };

function log(s) { lines.push(s); process.stdout.write(s + '\n'); }

log(`compare-docs.mjs — ${new Date().toISOString()}`);
log(`Letters: ${letters.join(', ')}`);
log('');

for (const L of letters) {
  const l = L.toLowerCase();
  const sourcesDir = path.join(OLD_BASE, `${L}sources`);
  if (!fs.existsSync(sourcesDir)) {
    log(`[${L}] No sources directory, skipping.`);
    continue;
  }

  const docFiles = fs.readdirSync(sourcesDir)
    .filter(f => f.endsWith('doc.htm'))
    .sort();

  log(`[${L}] ${docFiles.length} files`);

  for (const file of docFiles) {
    const personId = file.replace('doc.htm', '');
    const oldPath = path.join(sourcesDir, file);
    const newUrl = `${ASTRO_BASE}/Viningfamilies/${L}sources/${personId}doc`;

    // Read old HTML
    let oldHtml;
    try {
      oldHtml = fs.readFileSync(oldPath, 'utf-8');
    } catch (e) {
      log(`  SKIP ${personId}: cannot read old file — ${e.message}`);
      summary.noOld++;
      continue;
    }

    // Fetch new page
    const result = await fetchPage(newUrl);
    if (!result.ok) {
      log(`  FETCH_ERROR ${personId}: ${result.status ?? result.error}`);
      summary.fetchError++;
      continue;
    }

    const oldText = normalizeForCompare(oldHtml);
    const newText = normalizeForCompare(result.text);
    const oldImages = extractImages(getDocBody(oldHtml));
    const newImages = extractImages(getDocBody(result.text));

    const textSame = oldText === newText;
    const { onlyA: imgOnlyOld, onlyB: imgOnlyNew } = setDiff(oldImages, newImages);
    const imagesSame = imgOnlyOld.length === 0 && imgOnlyNew.length === 0;

    if (textSame && imagesSame) {
      summary.identical++;
      // Silent for identical pages
    } else {
      const tag = !textSame && !imagesSame ? 'BOTH_DIFF' : !textSame ? 'TEXT_DIFF' : 'IMAGE_DIFF';
      if (tag === 'BOTH_DIFF') summary.both++;
      else if (tag === 'TEXT_DIFF') summary.textDiff++;
      else summary.imageDiff++;

      log(`  ${tag} ${personId}`);
      if (!textSame) {
        const diffs = wordDiff(oldText, newText);
        diffs.forEach(d => log(d));
      }
      if (!imagesSame) {
        if (imgOnlyOld.length > 0) log(`    Images only in OLD: ${imgOnlyOld.join(', ')}`);
        if (imgOnlyNew.length > 0) log(`    Images only in NEW: ${imgOnlyNew.join(', ')}`);
      }
    }
  }

  log('');
}

log('─'.repeat(60));
log(`SUMMARY`);
log(`  Identical:   ${summary.identical}`);
log(`  Text diff:   ${summary.textDiff}`);
log(`  Image diff:  ${summary.imageDiff}`);
log(`  Both diff:   ${summary.both}`);
log(`  Fetch error: ${summary.fetchError}`);
log(`  No old file: ${summary.noOld}`);
log(`  TOTAL ISSUES: ${summary.textDiff + summary.imageDiff + summary.both + summary.fetchError}`);

fs.writeFileSync(OUT_FILE, lines.join('\n') + '\n');
console.log(`\nResults written to ${OUT_FILE}`);
