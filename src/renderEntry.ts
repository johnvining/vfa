// Renders a genealogy entry from structured YAML data to the HTML fragment
// used inside the <pre> block on letter pages.

type DatePlace = { date?: string; place?: string; lastResidence?: string } | undefined;
type Burial = { place?: string; description?: string } | undefined;

interface Spouse {
  givenName?: string;
  surname?: string;
  nee?: string;
  from?: string;
  widowOf?: string;
  parents?: string;
  birth?: DatePlace;
  death?: DatePlace;
  burial?: Burial;
}

interface Divorce {
  date?: string;
  place?: string;
  note?: string;
}

interface Marriage {
  number?: number | string;
  date?: string;
  place?: string;
  note?: string;
  spouse?: Spouse;
  divorce?: Divorce;
}

interface ChildMarriage {
  number?: number | string;
  date?: string;
  place?: string;
  spouse?: string;
  spouseDeath?: string;
  note?: string;
  divorce?: Divorce;
}

interface Child {
  name: string;
  entryId?: string;
  entryLetter?: string;
  hasUnlistedChildren?: boolean;
  leadingDash?: boolean;
  birth?: DatePlace;
  baptism?: DatePlace;
  adoptedDate?: string;
  marriages?: ChildMarriage[];
  middleNote?: string;
  note?: string;
  death?: DatePlace;
  burial?: Burial;
}

interface ChildrenGroup {
  spouseRef?: string;
  children: Child[];
}

interface Update {
  date: string;    // YYYY-MM or YYYY-MM-DD
  what?: string;
  url?: string;
  thanks?: string;
}

interface OpenQuestion {
  posted: string;
  question: string;
  background?: string;
  resolved?: string;
  updates?: Update[];
}

interface Lead {
  posted: string;
  note: string;
  url?: string;
  resolved?: string;
}

interface EntryData {
  id: string;
  letter: string;
  relationship?: 'son' | 'dau.' | 'daughter' | 'adopted son' | 'adopted dau.' | '[adopted?] son' | '[adopted?] dau.';
  parentId?: string;
  parentLetter?: string;
  parentDesc?: string;
  head: {
    givenName: string;
    surname?: string;
    headingNote?: string;
    birth?: DatePlace;
    baptism?: DatePlace;
    adoptedDate?: string;
    death?: DatePlace;
    burial?: Burial;
  };
  marriages?: Marriage[];
  childrenGroups?: ChildrenGroup[];
  docsUrl?: string;
  notes?: string;
  updates?: Update[];
  openQuestions?: OpenQuestion[];
  leads?: Lead[];
}

function formatUpdateDate(dateStr: string): string {
  const [y, m] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1))
    .toLocaleString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

function dp(field: DatePlace): string {
  if (!field) return '';
  const parts = [field.date, field.place].filter(Boolean) as string[];
  return parts.join('   ');
}

// Returns true if the date string has its own prefix (bapt., int., etc.)
// and should not receive an additional b. or d. prefix
function hasSelfPrefix(date: string | undefined): boolean {
  if (!date) return false;
  return /^(bapt\.|int\.|chr\.|baptized|christened|n\.|\[b\.|b,|stillborn)/.test(date);
}

function bur(b: Burial, indent: number): string[] {
  if (!b) return [];
  const pad = ' '.repeat(indent);
  const lines: string[] = [];
  if (b.place) {
    lines.push(`${pad}bur. ${b.place}`);
    if (b.description) lines.push(' '.repeat(indent + 6) + b.description);
  } else if (b.description) {
    lines.push(pad + b.description);
  }
  return lines;
}

// Splits a widowOf value on ";" so multiple other marriages each get their own
// "m. ..." line at the given indent. Single-value strings (no semicolons) render
// as one line, matching the prior behavior.
function widow(s: string | undefined, indent: number): string[] {
  if (!s) return [];
  const pad = ' '.repeat(indent);
  return s.split(';').map(part => pad + 'm. ' + part.trim());
}

// Inserts " SURNAME" (default "Vining") before any trailing suffix (Jr., Sr., roman numerals)
function withVining(givenName: string, surname: string = 'Vining'): string {
  const m = givenName.match(/^(.*?)(\s+(?:Jr\.?|Sr\.?|[IVX]+))$/);
  if (m) return m[1] + ' ' + surname + m[2];
  return givenName + ' ' + surname;
}

// Builds a spouse name string with optional "(née X)" and "(of HOMETOWN)" suffixes.
function spouseNameLine(s: Spouse): string {
  let line = [s.givenName, s.surname].filter(Boolean).join(' ');
  if (s.nee) line += ` (n&#233;e ${s.nee})`;
  if (s.from) line += ` (of ${s.from})`;
  return line;
}

// Renders a numbered marriage spouse block.
// If spouse has givenName, renders name line at 15 then details at 21/27.
// If spouse has no givenName (inline-name marriage), renders details at 21/27 directly.
function renderNumberedSpouseBlock(m: Marriage): string[] {
  const lines: string[] = [];
  if (!m.spouse) return lines;
  const s = m.spouse;

  if (s.givenName) {
    // Normal: separate spouse name line at 15
    lines.push(' '.repeat(15) + spouseNameLine(s));
    if (s.parents) lines.push(' '.repeat(21) + s.parents);
    if (s.birth) {
      const prefix = hasSelfPrefix(s.birth.date) ? '' : 'b. ';
      lines.push(' '.repeat(21) + prefix + dp(s.birth));
    }
    if (s.death) lines.push(' '.repeat(21) + 'd. ' + dp(s.death));
    lines.push(...widow(s.widowOf, 21));
    lines.push(...bur(s.burial, 27));
  } else {
    // Inline-name marriage: date line contains the name, details directly at 21
    if (s.parents) lines.push(' '.repeat(21) + s.parents);
    if (s.birth) {
      const prefix = hasSelfPrefix(s.birth.date) ? '' : 'b. ';
      lines.push(' '.repeat(21) + prefix + dp(s.birth));
    }
    if (s.death) lines.push(' '.repeat(21) + 'd. ' + dp(s.death));
    lines.push(...widow(s.widowOf, 21));
    lines.push(...bur(s.burial, 27));
  }
  return lines;
}

function renderSpouseBlock(m: Marriage, spouseIndent: number, detailIndent: number, burialIndent: number): string[] {
  const lines: string[] = [];
  if (!m.spouse) return lines;
  const s = m.spouse;

  lines.push(' '.repeat(spouseIndent) + spouseNameLine(s));

  if (s.parents) lines.push(' '.repeat(detailIndent) + s.parents);
  if (s.birth) {
    const prefix = hasSelfPrefix(s.birth.date) ? '' : 'b. ';
    lines.push(' '.repeat(detailIndent) + prefix + dp(s.birth));
  }
  if (s.death) lines.push(' '.repeat(detailIndent) + 'd. ' + dp(s.death));
  lines.push(...widow(s.widowOf, detailIndent));
  lines.push(...bur(s.burial, burialIndent));

  return lines;
}

// "divorced 2015" / "divorced 1893   Texas" / "divorced (she m. (2) Floyd Tremper)"
// A note alongside a date/place renders in parens; a note without one renders bare.
function renderDivorceBare(d: Divorce): string {
  let s = 'divorced';
  if (d.date) s += ' ' + d.date;
  if (d.place) s += '   ' + d.place;
  if (d.note) {
    s += (d.date || d.place) ? ' (' + d.note + ')' : ' ' + d.note;
  }
  return s;
}

function renderChildLine(child: Child): string {
  const parts: string[] = [];

  // Name with optional link
  let nameStr: string;
  if (child.entryId) {
    const href = child.entryLetter
      ? `${child.entryLetter}families.htm#${child.entryId}`
      : `#${child.entryId}`;
    nameStr = `<a href="${href}">${child.name}</a>`;
  } else {
    nameStr = child.name;
  }
  if (child.hasUnlistedChildren) nameStr += ' +';

  // Collect segments separated by "   -   "
  const segments: string[] = [];
  if (child.birth) {
    const prefix = hasSelfPrefix(child.birth.date) ? '' : 'b. ';
    segments.push(prefix + dp(child.birth));
  }
  if (child.baptism) {
    const prefix = hasSelfPrefix(child.baptism.date) ? '' : 'bapt. ';
    segments.push(prefix + dp(child.baptism));
  }

  if (child.adoptedDate) segments.push('adopted ' + child.adoptedDate);

  if (child.marriages && child.marriages.length > 0) {
    const hasNumbered = child.marriages.some(m => m.number !== undefined);
    if (hasNumbered) {
      // Numbered marriages: m. (1) DATE   PLACE   SPOUSE;   (2) ...
      // String numbers in `[...]` form (e.g. "[1?]") render without parens.
      const mParts = child.marriages.map(m => {
        const numStr = (typeof m.number === 'string' && m.number.startsWith('['))
          ? `${m.number} `
          : `(${m.number}) `;
        const tail: string[] = [];
        if (m.date) tail.push(m.date);
        if (m.place) tail.push(m.place);
        if (m.spouse) tail.push(m.spouse);
        let s = numStr + tail.join('   ');
        if (m.divorce) s += (m.spouse ? ',' : '') + '   ' + renderDivorceBare(m.divorce);
        return s;
      });
      segments.push('m. ' + mParts.join(';   '));
    } else {
      // Unnumbered: m. DATE   PLACE   SPOUSE
      const mStrings = child.marriages.map(m => {
        const parts: string[] = [];
        if (m.date) parts.push(m.date);
        if (m.place) parts.push(m.place);
        if (m.spouse) parts.push(m.spouse);
        let line = 'm. ' + parts.join('   ');
        if (m.divorce) line += (m.spouse ? ',' : '') + '   ' + renderDivorceBare(m.divorce);
        return line;
      });
      segments.push(...mStrings);
    }
  }

  if (child.middleNote) segments.push(child.middleNote);
  if (child.note && !child.death) segments.push(child.note);
  if (child.death) segments.push('d. ' + dp(child.death));
  if (child.burial?.place) segments.push('bur. ' + child.burial.place);
  else if (child.burial?.description) segments.push(child.burial.description);
  if (child.note && child.death) segments.push(child.note);

  const segStr = segments.join('   -   ');
  if (segStr && child.leadingDash) {
    return '   ' + nameStr + '   -   ' + segStr;
  }
  return '   ' + (segStr ? nameStr + '   ' + segStr : nameStr);
}

export function renderEntry(data: EntryData): string {
  const lines: string[] = [];

  // Header
  const headingName = withVining(data.head.givenName, data.head.surname ?? 'Vining');
  const headingNote = data.head.headingNote ? ' ' + data.head.headingNote : '';
  lines.push(`<a name="${data.id}"></a><span class="geo-name">${headingName}</span>${headingNote}`);

  // Parent reference
  if (data.parentDesc) {
    if (data.relationship) {
      const relMap: Record<string, string> = {
        'son': 'son', 'dau.': 'dau.', 'daughter': 'daughter',
        'adopted son': 'adopted son', 'adopted dau.': 'adopted dau.',
        '[adopted?] son': '[adopted?] son', '[adopted?] dau.': '[adopted?] dau.',
      };
      const rel = relMap[data.relationship!] ?? 'son';
      if (data.parentId) {
        const href = data.parentLetter
          ? `${data.parentLetter}families.htm#${data.parentId}`
          : `#${data.parentId}`;
        lines.push(`   (${rel} of <a href="${href}">${data.parentDesc}</a>)`);
      } else {
        lines.push(`   (${rel} of ${data.parentDesc})`);
      }
    } else {
      lines.push(`   ${data.parentDesc}`);
    }
  }

  // Head birth
  if (data.head.birth) {
    const prefix = hasSelfPrefix(data.head.birth.date) ? '   ' : '   b. ';
    lines.push(prefix + dp(data.head.birth));
  }
  if (data.head.baptism) {
    const prefix = hasSelfPrefix(data.head.baptism.date) ? '   ' : '   bapt. ';
    lines.push(prefix + dp(data.head.baptism));
  }
  if (data.head.adoptedDate) lines.push('         adopted ' + data.head.adoptedDate);

  // Marriages
  const marriages = data.marriages ?? [];
  const hasNumbered = marriages.some(m => m.number !== undefined);

  if (marriages.length > 0) {
    if (hasNumbered) {
      // First numbered marriage: "m. (1) DATE   PLACE"
      const first = marriages[0];
      let mLine = `   m. (${first.number}) `;
      if (first.date) mLine += first.date;
      if (first.place) mLine += (first.date ? '   ' : '') + first.place;
      lines.push(mLine);
      lines.push(...renderNumberedSpouseBlock(first));
      if (first.divorce) lines.push('               ' + renderDivorceBare(first.divorce));
      if (first.note) {
        for (const noteLine of first.note.split('\n')) {
          lines.push('               ' + noteLine);
        }
      }

      // Subsequent numbered marriages: "(2) DATE   PLACE"
      for (const m of marriages.slice(1)) {
        let mLine = `         (${m.number}) `;
        if (m.date) mLine += m.date;
        if (m.place) mLine += (m.date ? '   ' : '') + m.place;
        lines.push(mLine);
        lines.push(...renderNumberedSpouseBlock(m));
        if (m.divorce) lines.push('               ' + renderDivorceBare(m.divorce));
        if (m.note) {
          for (const noteLine of m.note.split('\n')) {
            lines.push('               ' + noteLine);
          }
        }
      }
    } else {
      // Unnumbered marriages
      for (const m of marriages) {
        // Inline spouse (no date/place, spouse set directly, with givenName)
        const isInline = !m.date && !m.place && m.spouse?.givenName;
        if (isInline) {
          const s = m.spouse!;
          lines.push('   m. ' + spouseNameLine(s));
          // Inline spouse details at indent 12
          if (s.parents) lines.push('            ' + s.parents);
          if (s.birth) lines.push('            b. ' + dp(s.birth));
          if (s.death) lines.push('            d. ' + dp(s.death));
          lines.push(...widow(s.widowOf, 12));
          lines.push(...bur(s.burial, 18));
          if (m.divorce) lines.push('         ' + renderDivorceBare(m.divorce));
          if (m.note) {
            for (const noteLine of m.note.split('\n')) lines.push('         ' + noteLine);
          }
        } else {
          // Normal unnumbered marriage (date and/or place on m. line, spouse block below)
          let mLine = '   m. ';
          if (m.date) mLine += m.date;
          if (m.place) mLine += (m.date ? '   ' : '') + m.place;
          lines.push(mLine);
          if (m.spouse) lines.push(...renderSpouseBlock(m, 9, 15, 21));
          if (m.divorce) lines.push('         ' + renderDivorceBare(m.divorce));
          if (m.note) {
            for (const noteLine of m.note.split('\n')) lines.push('         ' + noteLine);
          }
        }
      }
    }
  }

  // Head death
  if (data.head.death) lines.push('   d. ' + dp(data.head.death));

  // Head burial
  lines.push(...bur(data.head.burial, 9));

  lines.push('');

  // Children groups
  for (const group of (data.childrenGroups as any[]) ?? []) {
    if (group.headingText) {
      if (group.headingText.toLowerCase() !== 'children') {
        lines.push(`<span class="geo-children-label">${group.headingText}:</span>`);
      } else {
        lines.push('<span class="geo-children-label">children:</span>');
      }
    } else if (group.spouseRef) {
      lines.push(`<span class="geo-children-label">children by ${group.spouseRef}:</span>`);
    } else {
      lines.push('<span class="geo-children-label">children:</span>');
    }
    for (const child of group.children) {
      lines.push(renderChildLine(child));
    }
  }

  lines.push('');

  // Docs and updates links — on one line, dot-separated if both present
  const docLinks: string[] = [];
  if (data.docsUrl) {
    docLinks.push(`<a href="${data.docsUrl}">documentation and notes</a>`);
  }
  if (data.updates && data.updates.length > 0) {
    const updatesUrl = `${data.letter.toUpperCase()}sources/${data.id}updates.htm`;
    docLinks.push(`<a href="${updatesUrl}">update history</a>`);
  }
  if (data.openQuestions && data.openQuestions.length > 0) {
    const open = data.openQuestions.filter(q => !q.resolved).length;
    const questionsUrl = `${data.letter.toUpperCase()}sources/${data.id}questions.htm`;
    const label = open > 0 ? `open questions (${open})` : 'open questions';
    docLinks.push(`<a href="${questionsUrl}">${label}</a>`);
  }
  if (data.leads && data.leads.length > 0) {
    const open = data.leads.filter(l => !l.resolved).length;
    const leadsUrl = `${data.letter.toUpperCase()}sources/${data.id}leads.htm`;
    const label = open > 0 ? `leads (${open})` : 'leads';
    docLinks.push(`<a href="${leadsUrl}">${label}</a>`);
  }
  if (docLinks.length > 0) {
    lines.push(`<span class="geo-entry-links">${docLinks.join(' · ')}</span>`);
  }

  // Notes (e.g. surname change, annotation — rendered after docs link, matching original layout)
  if (data.notes) lines.push('');
  if (data.notes) lines.push(`   ${data.notes}`);

  return lines.join('\n');
}
