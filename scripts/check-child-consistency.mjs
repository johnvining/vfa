/**
 * check-child-consistency.mjs  —  read-only audit (Phase 0)
 *
 * The same person's facts can live in two places: their own headname entry
 * (head/marriages) and the child line of their parent's entry (the child with a
 * matching `entryId`). Those two copies drift over time. This script cross-checks
 * every entryId-linked child line against the linked entry and classifies the
 * difference, so we can (a) see the scope and (b) later gate CI on it.
 *
 * It NEVER writes anything. Run: `npm run check:children`.
 *
 * Classification per pair (worst field wins):
 *   contradiction   - parent and entry give different concrete facts (needs a human + source)
 *   swap            - a child line's date/place columns look reversed
 *   spouse-mismatch - first-marriage spouse names share no token (spelling or wrong person)
 *   entry-missing   - parent line has a concrete fact the entry lacks (move it INTO the entry)
 *   parent-coarser  - parent is consistent but less complete than the entry (the routine case)
 *   identical       - compared fields match
 */
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

const ROOT = 'src/content/genealogy';

// ---- load every entry ----
const byId = {};
const all = [];
for (const dir of fs.readdirSync(ROOT)) {
  const dirPath = path.join(ROOT, dir);
  if (!fs.statSync(dirPath).isDirectory()) continue;
  for (const f of fs.readdirSync(dirPath)) {
    if (!f.endsWith('.yaml')) continue;
    let data;
    try { data = yaml.load(fs.readFileSync(path.join(dirPath, f), 'utf8')); }
    catch { continue; }
    if (!data || !data.id) continue;
    data.__file = `${dir}/${f}`;
    byId[data.id] = data;
    all.push(data);
  }
}

// ---- normalization helpers ----
const norm = s => String(s ?? '')
  .toLowerCase()
  .replace(/&#\d+;/g, '')
  .replace(/["“”‘’'.,()]/g, '')
  .replace(/\s+/g, ' ')
  .trim();
const yearOf = s => { const m = String(s ?? '').match(/\b(1[6-9]\d\d|20\d\d)\b/); return m ? +m[1] : null; };
// A date phrased as an inference, not a recorded date — its embedded year is not the event year.
const isEstimate = s => /age |census|as of|at death|at marriage|prior to|\bbefore\b|\bafter\b|ca\.|\[|\?/i.test(String(s ?? ''));
const hasContent = s => norm(s).length > 0;
const looksDate = s => /\d/.test(String(s ?? ''));
const looksPlaceOnly = s => /[a-z]{3,}/i.test(String(s ?? '')) && !/\d/.test(String(s ?? ''));
const tokens = s => new Set(norm(s).split(' ').filter(Boolean));

// proper subset: every token of `a` is in `b`, and `b` has more
function properSubset(a, b) {
  const A = tokens(a), B = tokens(b);
  if (!A.size || !B.size || A.size >= B.size) return false;
  return [...A].every(t => B.has(t));
}

// Compare one date field. Returns a status string.
function compareDate(parent, entry) {
  const p = norm(parent), e = norm(entry);
  if (!p && !e) return 'both-empty';
  if (p === e) return 'identical';
  if (!p) return 'parent-empty';
  if (!e) return 'entry-empty';
  const pe = isEstimate(parent), ee = isEstimate(entry);
  const py = yearOf(parent), ey = yearOf(entry);
  if (!pe && !ee && py && ey && py !== ey) return 'contradiction';
  if (!pe && ee) return 'entry-missing';   // parent recorded, entry only inferred
  if (pe && !ee) return 'parent-coarser';  // entry recorded, parent only inferred
  return 'parent-coarser';                  // same year / differing precision
}

// Compare one place field.
function comparePlace(parent, entry) {
  const p = norm(parent), e = norm(entry);
  if (!p && !e) return 'both-empty';
  if (p === e) return 'identical';
  if (!p) return 'parent-empty';
  if (!e) return 'entry-empty';
  if (properSubset(parent, entry)) return 'parent-coarser';
  if (properSubset(entry, parent)) return 'entry-missing';
  const shared = [...tokens(parent)].filter(t => t.length > 3 && tokens(entry).has(t));
  return shared.length ? 'parent-coarser' : 'contradiction';
}

// ---- evaluate every linked pair ----
const buckets = { contradiction: [], swap: [], 'spouse-mismatch': [], 'entry-missing': [], 'parent-coarser': [], identical: [] };

for (const P of all) {
  for (const g of P.childrenGroups ?? []) {
    for (const c of g.children ?? []) {
      if (!c.entryId || !byId[c.entryId]) continue;
      const E = byId[c.entryId];
      const H = E.head ?? {};
      const findings = [];

      // field swap inside the child line itself
      for (const ev of ['birth', 'death']) {
        const cd = c[ev]?.date, cp = c[ev]?.place;
        if (cd && cp && looksPlaceOnly(cd) && looksDate(cp))
          findings.push({ kind: 'swap', detail: `${ev}: date="${cd}" place="${cp}"` });
      }
      // dates + places vs the entry
      for (const ev of ['birth', 'death']) {
        const ds = compareDate(c[ev]?.date, H[ev]?.date);
        if (ds === 'contradiction') findings.push({ kind: 'contradiction', detail: `${ev}.date parent="${c[ev]?.date}" vs entry="${H[ev]?.date}"` });
        else if (ds === 'entry-missing') findings.push({ kind: 'entry-missing', detail: `${ev}.date in parent="${c[ev]?.date}" but entry="${H[ev]?.date ?? '(none)'}"` });
        else if (ds === 'parent-coarser') findings.push({ kind: 'parent-coarser', detail: `${ev}.date` });

        const ps = comparePlace(c[ev]?.place, H[ev]?.place);
        if (ps === 'contradiction') findings.push({ kind: 'contradiction', detail: `${ev}.place parent="${c[ev]?.place}" vs entry="${H[ev]?.place}"` });
        else if (ps === 'entry-missing') findings.push({ kind: 'entry-missing', detail: `${ev}.place in parent="${c[ev]?.place}" but entry="${H[ev]?.place ?? '(none)'}"` });
        else if (ps === 'parent-coarser') findings.push({ kind: 'parent-coarser', detail: `${ev}.place` });
      }
      // first-marriage spouse
      const csRaw = c.marriages?.[0]?.spouse;
      const cs = norm(typeof csRaw === 'string' ? csRaw : csRaw?.givenName);
      const hsRaw = E.marriages?.[0]?.spouse?.givenName;
      const hs = norm(hsRaw);
      if (cs && hs && cs !== hs) {
        const shared = hs.split(' ').some(t => t.length > 2 && tokens(csRaw).has(t));
        if (!shared) findings.push({ kind: 'spouse-mismatch', detail: `spouse parent="${csRaw}" vs entry="${hsRaw}"` });
        else findings.push({ kind: 'parent-coarser', detail: 'spouse' });
      }

      const rec = { entry: E.id, name: H.givenName, parent: P.id, file: P.__file, findings };
      // worst category wins for the headline bucket
      const order = ['contradiction', 'swap', 'spouse-mismatch', 'entry-missing', 'parent-coarser'];
      const worst = order.find(k => findings.some(f => f.kind === k));
      buckets[worst ?? 'identical'].push(rec);
    }
  }
}

// ---- report ----
const total = Object.values(buckets).reduce((n, a) => n + a.length, 0);
console.log(`Linked child↔entry pairs: ${total}`);
for (const k of ['identical', 'parent-coarser', 'entry-missing', 'spouse-mismatch', 'swap', 'contradiction'])
  console.log(`  ${k.padEnd(16)} ${buckets[k].length}`);

const detail = (title, key) => {
  const arr = buckets[key];
  if (!arr.length) return;
  console.log(`\n===== ${title} (${arr.length}) =====`);
  for (const r of arr) {
    console.log(`  ${r.entry}  ${r.name}  —  child line in ${r.file}`);
    for (const f of r.findings.filter(x => x.kind === key)) console.log(`      ${f.detail}`);
  }
};
detail('CONTRADICTIONS — different concrete facts (need a source)', 'contradiction');
detail('FIELD SWAPS — date/place reversed in the parent child line', 'swap');
detail('SPOUSE MISMATCH — no shared name token', 'spouse-mismatch');
detail('ENTRY MISSING — parent has a fact the entry lacks (move into entry)', 'entry-missing');

console.log(`\n(parent-coarser = parent consistent but less complete; the routine "update to match" case)`);
