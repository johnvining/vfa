// migrate-divorces.mjs
// Converts free-text "divorced ..." in spouse strings and head-marriage notes
// into a structured `divorce: { date, place, note }` block.
//
// Operates as line-level text editing to preserve YAML formatting.
// Reports cases that don't match a known pattern; those should be fixed by hand.

import fs from 'fs';
import path from 'path';

const ROOT = path.join(import.meta.dirname, '..', 'src/content/genealogy');

function listYamls(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listYamls(p));
    else if (entry.name.endsWith('.yaml')) out.push(p);
  }
  return out;
}

// Strip YAML quoting around a scalar value (handles "..." and '...').
function unquote(s) {
  s = s.trim();
  if (s.startsWith('"') && s.endsWith('"')) {
    return s.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }
  if (s.startsWith("'") && s.endsWith("'")) {
    return s.slice(1, -1).replace(/''/g, "'");
  }
  return s;
}

// Quote a scalar for YAML if it contains punctuation that makes it ambiguous.
// Mirrors the existing repo style: prefer plain, but quote if value contains
// commas, leading/trailing whitespace, or starts with special chars.
function yquote(s) {
  if (s === '') return '""';
  if (/^[\s]/.test(s) || /[\s]$/.test(s)) return JSON.stringify(s);
  // Plain scalars can contain most chars but quoting on , or # or : helps
  if (/[#:,\[\]{}]/.test(s) || s.startsWith('-') || s.startsWith('?') || s.startsWith('*')
      || s.startsWith('&') || s.startsWith('!') || s.startsWith('|') || s.startsWith('>')
      || s.startsWith('"') || s.startsWith("'") || s.startsWith('@') || s.startsWith('`')
      || s.startsWith('%') || s.startsWith(',') || s.startsWith('[') || s.startsWith('{')
      || /^(true|false|null|yes|no|on|off|~)$/i.test(s)
      || /^-?\d+(\.\d+)?$/.test(s)) {
    return JSON.stringify(s);
  }
  return s;
}

// True if the string looks like a marriage date (digits + month names) rather
// than a person name. Used to avoid treating a date with trailing "," as a name.
function looksLikeDate(s) {
  s = s.trim();
  if (/^\d/.test(s)) return true;
  if (/^(ca\.|c\.|before|after|abt\.?|circa)\b/i.test(s)) return true;
  return false;
}

// Parse the divorce trailer (everything after the literal word "divorced ").
// Returns a Divorce object: { date?, place?, note? } or {} if empty.
//
// Heuristics:
//   - If the trailer starts with "(", treat the entire parenthetical as `note`.
//   - Otherwise split on triple-space:
//       first chunk -> date, remaining -> place
//   - If the date chunk ends with " (...)", peel that into `note`.
function parseDivorceTrailer(trailer) {
  trailer = trailer.replace(/^[\s]+/, '').replace(/[\s;]+$/, '');
  const out = {};
  if (trailer === '') return out;

  // Pure parenthetical: divorced (something)
  if (trailer.startsWith('(') && trailer.endsWith(')')) {
    out.note = trailer.slice(1, -1);
    return out;
  }

  // Trailing parenthetical "1965 (she m. (2) Floyd Tremper)"
  // Peel only if balanced parens AND parens are at very end.
  const parenMatch = trailer.match(/^(.*?)\s*\(([^()]*(?:\([^()]*\)[^()]*)*)\)\s*$/);
  if (parenMatch) {
    trailer = parenMatch[1].trim();
    out.note = parenMatch[2];
  }

  if (trailer === '') return out;

  // Split on triple-space (date   place)
  const tripleIdx = trailer.search(/\s{3,}/);
  if (tripleIdx >= 0) {
    out.date = trailer.slice(0, tripleIdx).trim();
    out.place = trailer.slice(tripleIdx).trim();
  } else if (looksLikeDateExpr(trailer)) {
    out.date = trailer;
  } else {
    // No date-like prefix and no triple-space — treat as a bare place.
    out.place = trailer;
  }

  if (out.date === '') delete out.date;
  if (out.place === '') delete out.place;
  return out;
}

// True if the trailer reads as a date expression (digits, month names, "ca.", etc.)
// rather than a place. Used when there's no triple-space separator.
function looksLikeDateExpr(s) {
  s = s.trim();
  if (s === '') return false;
  if (/^\d/.test(s)) return true;
  if (/^(ca\.|c\.|before|after|abt\.?|circa|n\.\s|\[)/i.test(s)) return true;
  if (/^(January|February|March|April|May|June|July|August|September|October|November|December|Jan\.?|Feb\.?|Mar\.?|Apr\.?|Jun\.?|Jul\.?|Aug\.?|Sept?\.?|Oct\.?|Nov\.?|Dec\.?)\b/.test(s)) return true;
  return false;
}

// Render a divorce object as YAML lines.
// `firstPrefix` is the literal prefix for the `divorce:` line (may include `- `).
// Inner keys are aligned at firstPrefix.length + 2.
function renderDivorce(d, firstPrefix) {
  const inner = ' '.repeat(firstPrefix.length + 2);
  if (Object.keys(d).length === 0) return [firstPrefix + 'divorce: {}'];
  const lines = [firstPrefix + 'divorce:'];
  if (d.date) lines.push(inner + 'date: ' + yquote(d.date));
  if (d.place) lines.push(inner + 'place: ' + yquote(d.place));
  if (d.note) lines.push(inner + 'note: ' + yquote(d.note));
  return lines;
}

// Build a continuation prefix from an original key prefix that may contain a
// `- ` array marker. Strips the dash so subsequent keys align under the first.
function continuationPrefix(prefix) {
  return ' '.repeat(prefix.length);
}

// Process a single file's text.
// Returns { text, changes, unhandled } where:
//   - changes: count of converted divorces
//   - unhandled: array of { line, content } for lines that contain "divorced"
//                but couldn't be matched by any pattern.
function processFile(text) {
  const lines = text.split('\n');
  const out = [];
  let changes = 0;
  const unhandled = [];

  // Track whether we're inside a `raw: |-` (or similar) block — its content
  // is the frozen pre-conversion HTML and must not be modified or flagged.
  let inRawBlock = false;
  let rawBlockIndent = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect entry into a `raw:` block scalar (literal/folded).
    if (!inRawBlock) {
      const rm = line.match(/^(raw|rawArchival):\s*[|>][-+]?\s*$/);
      if (rm) {
        inRawBlock = true;
        rawBlockIndent = -1;  // determined from first content line
        out.push(line);
        continue;
      }
    } else {
      // Inside raw block: figure out indent on first content line.
      const indentMatch = line.match(/^(\s*)/);
      const lineIndent = indentMatch ? indentMatch[1].length : 0;
      const isBlank = line.trim() === '';
      if (rawBlockIndent === -1 && !isBlank) rawBlockIndent = lineIndent;
      // We've left the block when a non-blank line has indent <= 0 (top-level key)
      if (!isBlank && lineIndent === 0) {
        inRawBlock = false;
        // fall through and process this line normally
      } else {
        out.push(line);
        continue;
      }
    }

    // Pattern: head-level marriage note containing "divorced"
    //   "    note: divorced ..."   or   "    note: \"divorced ...\""
    //   "  - note: divorced ..."   (first array item)
    {
      const m = line.match(/^(\s+(?:-\s+)?)note:\s*(.*)$/);
      if (m) {
        const prefix = m[1];
        const value = unquote(m[2]);
        if (/^divorced\b/.test(value)) {
          const trailer = value.replace(/^divorced\s*/, '');
          const d = parseDivorceTrailer(trailer);
          out.push(...renderDivorce(d, prefix));
          changes++;
          continue;
        }
        // "YYYY   divorced" — date BEFORE the word divorced
        const yd = value.match(/^(\d{4})\s+divorced\s*$/);
        if (yd) {
          out.push(...renderDivorce({ date: yd[1] }, prefix));
          changes++;
          continue;
        }
        // Multi-line note with "separated ... \\n divorced ..." — split into note + divorce
        if (/\bdivorced\b/.test(value) && value.includes('\n')) {
          const lines2 = value.split('\n');
          const divLineIdx = lines2.findIndex(l => /^\s*divorced\b/.test(l));
          if (divLineIdx >= 0) {
            const before = lines2.slice(0, divLineIdx).join('\n').trim();
            const divLine = lines2[divLineIdx].trim().replace(/^divorced\s*/, '');
            const after = lines2.slice(divLineIdx + 1).join('\n').trim();
            const d = parseDivorceTrailer(divLine + (after ? '   ' + after : ''));
            if (before) out.push(prefix + 'note: ' + yquote(before));
            // If we already emitted a `note:` line in place, the divorce continuation
            // shouldn't carry a `- ` marker.
            const divPrefix = before ? continuationPrefix(prefix) : prefix;
            out.push(...renderDivorce(d, divPrefix));
            changes++;
            continue;
          }
        }
      }
    }

    // Pattern: child marriage spouse containing divorced (this line + maybe prev)
    //   "            spouse: \"Name,   divorced 2015\""
    //   "            spouse: Name;   divorced ca. 2009"
    //   "            spouse: divorced ..."   <-- mis-parse where prev "date:" had spouse
    //   "  - spouse: \"...,   divorced ...\""   (first array item form)
    {
      const m = line.match(/^(\s+(?:-\s+)?)spouse:\s*(.*)$/);
      if (m) {
        const prefix = m[1];
        const value = unquote(m[2]);
        if (/\bdivorced\b/.test(value) || /\b\d{4}\s*divorced\b/.test(value)) {
          let mm;
          // (d): line starts with "divorced"
          if (/^divorced\b/.test(value) || value === 'divorced') {
            const prevIdx = out.length - 1;
            if (prevIdx >= 0) {
              const prev = out[prevIdx];
              const dm = prev.match(/^(\s+(?:-\s+)?)date:\s*(.*)$/);
              if (dm) {
                const dateValue = unquote(dm[2]);
                const sm = dateValue.match(/^(.+?)[,;]\s*$/);
                if (sm && !looksLikeDate(sm[1])) {
                  const spouse = sm[1].trim();
                  const trailer = value.replace(/^divorced\s*/, '');
                  const d = parseDivorceTrailer(trailer);
                  out[prevIdx] = dm[1] + 'spouse: ' + yquote(spouse);
                  out.push(...renderDivorce(d, continuationPrefix(prefix)));
                  changes++;
                  continue;
                }
              }
            }
            unhandled.push({ line: i + 1, content: line });
            out.push(line);
            continue;
          }

          mm = value.match(/^(.+?)[,;]\s+(\d{4})\s+divorced\s*$/);
          if (mm) {
            const spouse = mm[1].trim();
            const date = mm[2];
            out.push(prefix + 'spouse: ' + yquote(spouse));
            out.push(...renderDivorce({ date }, continuationPrefix(prefix)));
            changes++;
            continue;
          }

          mm = value.match(/^(.+?)[,;]\s+divorced\b\s*(.*)$/);
          if (mm) {
            const spouse = mm[1].trim();
            const trailer = mm[2];
            const d = parseDivorceTrailer(trailer);
            out.push(prefix + 'spouse: ' + yquote(spouse));
            out.push(...renderDivorce(d, continuationPrefix(prefix)));
            changes++;
            continue;
          }

          mm = value.match(/^(.+?)[,;]\s+\[divorced\?\]\s*$/);
          if (mm) {
            const spouse = mm[1].trim();
            out.push(prefix + 'spouse: ' + yquote(spouse));
            out.push(...renderDivorce({ note: 'uncertain' }, continuationPrefix(prefix)));
            changes++;
            continue;
          }

          unhandled.push({ line: i + 1, content: line });
          out.push(line);
          continue;
        }
      }
    }

    // Pattern: child marriage `date:` field that contains the entire spouse + divorce text
    //   - date: "Helen Parker,   divorced"
    //   - date: "Margaret Beth Smith, divorced"
    //   - date: "Wendell Charles Jorgensen, divorced 16 October 1992"
    {
      const m = line.match(/^(\s+(?:-\s+)?)date:\s*(.*)$/);
      if (m) {
        const prefix = m[1];
        const value = unquote(m[2]);
        const mm = value.match(/^(.+?)[,;]\s*divorced\b\s*(.*)$/);
        if (mm && mm[1].trim() !== '') {
          const nextLine = lines[i + 1] ?? '';
          const nextM = nextLine.match(/^(\s+(?:-\s+)?)spouse:\s*(.*)$/);
          if (nextM) {
            const nv = unquote(nextM[2]);
            if (/^divorced\b/.test(nv)) {
              // handled by the spouse branch on next line
              out.push(line);
              continue;
            }
          }
          const spouse = mm[1].trim().replace(/[;,]\s*$/, '');
          const trailer = mm[2].replace(/[;,]\s*$/, '');
          const d = parseDivorceTrailer(trailer);
          out.push(prefix + 'spouse: ' + yquote(spouse));
          out.push(...renderDivorce(d, continuationPrefix(prefix)));
          changes++;
          continue;
        }
      }
    }

    out.push(line);

    // Flag any other line that mentions divorced (catch-all)
    if (/\bdivorced\b/i.test(line)) {
      unhandled.push({ line: i + 1, content: line });
    }
  }

  return { text: out.join('\n'), changes, unhandled };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const dryRun = process.argv.includes('--dry-run');
const verbose = process.argv.includes('--verbose');
let totalChanges = 0;
let filesChanged = 0;
const allUnhandled = [];

for (const file of listYamls(ROOT)) {
  const text = fs.readFileSync(file, 'utf8');
  if (!/divorced/i.test(text)) continue;
  const { text: newText, changes, unhandled } = processFile(text);
  if (changes > 0) {
    totalChanges += changes;
    filesChanged++;
    if (!dryRun) fs.writeFileSync(file, newText);
    if (verbose) console.log(`${path.relative(ROOT, file)}: ${changes} change(s)`);
  }
  for (const u of unhandled) {
    allUnhandled.push({ file: path.relative(ROOT, file), ...u });
  }
}

console.log(`\nTotal: ${totalChanges} divorces converted across ${filesChanged} files`);
if (dryRun) console.log('(dry run; no files written)');

if (allUnhandled.length > 0) {
  console.log(`\nUnhandled lines containing "divorced" — review manually:`);
  for (const u of allUnhandled) {
    console.log(`  ${u.file}:${u.line}: ${u.content}`);
  }
}
