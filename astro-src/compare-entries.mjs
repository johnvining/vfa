import { readFileSync, writeFileSync } from 'fs';
import { diffWords } from 'diff';

const OLD_DIR = '../Viningfamilies';
const NEW_DIR = './dist/Viningfamilies';
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const OUTPUT_FILE = 'entry-diff-report.txt';

function decodeEntities(html) {
  return html
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);?/g, (_, n) => String.fromCodePoint(parseInt(n, 10)))
    .replace(/&mdash;/g, '—')
    .replace(/&ldquo;/g, '“')
    .replace(/&rdquo;/g, '”')
    .replace(/&hellip;/g, '…')
    .replace(/&[a-z]+;/g, '');
}

function stripHtml(html) {
  return html.replace(/<[^>]+>/g, ' ');
}

function normalize(html) {
  return decodeEntities(stripHtml(html))
    .toLowerCase()
    // normalize Unicode space variants to regular space
    .replace(/[   -   　]/g, ' ')
    // strip invisible/zero-width characters
    .replace(/[​‌‍⁠﻿]/g, '')
    // strip punctuation — only alphanumeric content and spaces matter
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractEntries(html) {
  const entries = new Map();
  const blocks = html.split(/<hr[^>]*people-divider[^>]*\/?>/i);
  for (const block of blocks) {
    // Handle malformed anchors: missing quotes, href instead of name, missing closing >
    // ID must start with uppercase (excludes mailto:, http:// etc.)
    const match = block.match(/<a\s+(?:name|href)=["']?([A-Z][A-Za-z0-9]*\d[A-Za-z0-9]*)/);
    if (!match) continue;
    // Only compare content from the anchor onwards, ignoring page header/nav
    const content = block.slice(match.index);
    entries.set(match[1], normalize(content));
  }
  return entries;
}

function isSignificant(value) {
  if (!/[a-z0-9]/i.test(value)) return false;
  // Ignore lone digits (marriage number spacing artefacts)
  if (/^\d+$/.test(value.trim())) return false;
  return true;
}

// Results buckets
const onlyInNew = []; // { id, letter }
const onlyInOld = []; // { id, letter }
const different = []; // { id, letter, removed[], added[] }

for (const letter of LETTERS) {
  const oldPath = `${OLD_DIR}/${letter}families.htm`;
  const newPath = `${NEW_DIR}/${letter}families.htm`;

  let oldHtml, newHtml;
  try { oldHtml = readFileSync(oldPath, 'utf8'); } catch { continue; }
  try { newHtml = readFileSync(newPath, 'utf8'); } catch { continue; }

  const oldEntries = extractEntries(oldHtml);
  const newEntries = extractEntries(newHtml);

  for (const [id, oldText] of oldEntries) {
    if (!newEntries.has(id)) {
      onlyInOld.push({ id, letter });
      continue;
    }
    const newText = newEntries.get(id);
    if (oldText === newText) continue;

    const changes = diffWords(oldText, newText);
    const significant = changes.filter(p => (p.added || p.removed) && isSignificant(p.value));
    if (significant.length === 0) continue;

    const removed = significant.filter(p => p.removed).map(p => p.value.trim());
    const added   = significant.filter(p => p.added).map(p => p.value.trim());

    // Cancel out removed/added pairs with identical trimmed content (positional moves)
    const removedCopy = [...removed];
    const cancelledAdded = new Set();
    const cancelledRemoved = new Set();
    for (let i = 0; i < added.length; i++) {
      const j = removedCopy.indexOf(added[i]);
      if (j !== -1) { cancelledAdded.add(i); cancelledRemoved.add(j); removedCopy[j] = null; }
    }
    const realRemoved = removed.filter((_, i) => !cancelledRemoved.has(i));
    const realAdded   = added.filter((_, i) => !cancelledAdded.has(i));
    if (realRemoved.length === 0 && realAdded.length === 0) continue;

    // Suppress if removed and added contain the same characters, just split differently
    const removedChars = realRemoved.join('').replace(/\s/g, '');
    const addedChars   = realAdded.join('').replace(/\s/g, '');
    if (removedChars === addedChars) continue;

    different.push({ id, letter, removed: realRemoved, added: realAdded });
  }

  for (const id of newEntries.keys()) {
    if (!oldEntries.has(id)) onlyInNew.push({ id, letter });
  }
}

const out = [];

out.push('ENTRY DIFF REPORT');
out.push('=================');
out.push(`In new only:  ${onlyInNew.length}`);
out.push(`Different:    ${different.length}`);
out.push(`In old only:  ${onlyInOld.length}`);
out.push('');
out.push('Case, punctuation-only, and whitespace-only differences are suppressed.');
out.push('');

out.push('');
out.push('═══════════════════════════════════════════');
out.push('  IN NEW ONLY  (not present in old site)');
out.push('═══════════════════════════════════════════');
if (onlyInNew.length === 0) {
  out.push('  (none)');
} else {
  for (const { id, letter } of onlyInNew) out.push(`  [${id}]  (${letter})`);
}

out.push('');
out.push('═══════════════════════════════════════════');
out.push('  DIFFERENT  (exist in both, content differs)');
out.push('═══════════════════════════════════════════');
if (different.length === 0) {
  out.push('  (none)');
} else {
  for (const { id, letter, removed, added } of different) {
    out.push(`  [${id}]  (${letter})`);
    for (const v of removed) out.push(`    old: ${v}`);
    for (const v of added)   out.push(`    new: ${v}`);
  }
}

out.push('');
out.push('═══════════════════════════════════════════');
out.push('  IN OLD ONLY  (missing from new site)');
out.push('═══════════════════════════════════════════');
if (onlyInOld.length === 0) {
  out.push('  (none)');
} else {
  for (const { id, letter } of onlyInOld) out.push(`  [${id}]  (${letter})`);
}

out.push('');

const output = out.join('\n') + '\n';
writeFileSync(OUTPUT_FILE, output);
console.log(output);
console.log(`Report written to ${OUTPUT_FILE}`);
