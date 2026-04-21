// Renders a genealogy entry from structured YAML data to the HTML fragment
// used inside the <pre> block on letter pages.

type DatePlace = { date?: string; place?: string; lastResidence?: string } | undefined;
type Burial = { place?: string; description?: string } | undefined;

interface Spouse {
  givenName?: string;
  surname?: string;
  nee?: string;
  widowOf?: string;
  parents?: string;
  birth?: DatePlace;
  death?: DatePlace;
  burial?: Burial;
}

interface Marriage {
  number?: number;
  date?: string;
  place?: string;
  note?: string;
  spouse?: Spouse;
}

interface ChildMarriage {
  number?: number;
  date?: string;
  place?: string;
  spouse?: string;
  spouseDeath?: string;
}

interface Child {
  name: string;
  entryId?: string;
  entryLetter?: string;
  hasUnlistedChildren?: boolean;
  leadingDash?: boolean;
  birth?: DatePlace;
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

interface EntryData {
  id: string;
  letter: string;
  relationship?: 'son' | 'dau.' | 'adopted son' | 'adopted dau.';
  parentId?: string;
  parentLetter?: string;
  parentDesc?: string;
  noCloseParen?: boolean;
  head: {
    givenName: string;
    surname?: string;
    headingNote?: string;
    birth?: DatePlace;
    adoptedDate?: string;
    death?: DatePlace;
    burial?: Burial;
  };
  marriages?: Marriage[];
  childrenGroups?: ChildrenGroup[];
  docsUrl?: string;
  notes?: string;
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

// Inserts " SURNAME" (default "Vining") before any trailing suffix (Jr., Sr., roman numerals)
function withVining(givenName: string, surname: string = 'Vining'): string {
  const m = givenName.match(/^(.*?)(\s+(?:Jr\.?|Sr\.?|[IVX]+))$/);
  if (m) return m[1] + ' ' + surname + m[2];
  return givenName + ' ' + surname;
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
    const nameParts = [s.givenName, s.surname].filter(Boolean);
    lines.push(' '.repeat(15) + nameParts.join(' '));
    if (s.parents) lines.push(' '.repeat(21) + s.parents);
    if (s.birth) {
      const prefix = hasSelfPrefix(s.birth.date) ? '' : 'b. ';
      lines.push(' '.repeat(21) + prefix + dp(s.birth));
    }
    if (s.death) lines.push(' '.repeat(21) + 'd. ' + dp(s.death));
    if (s.widowOf) lines.push(' '.repeat(21) + 'm. ' + s.widowOf);
    lines.push(...bur(s.burial, 27));
  } else {
    // Inline-name marriage: date line contains the name, details directly at 21
    if (s.parents) lines.push(' '.repeat(21) + s.parents);
    if (s.birth) {
      const prefix = hasSelfPrefix(s.birth.date) ? '' : 'b. ';
      lines.push(' '.repeat(21) + prefix + dp(s.birth));
    }
    if (s.death) lines.push(' '.repeat(21) + 'd. ' + dp(s.death));
    if (s.widowOf) lines.push(' '.repeat(21) + 'm. ' + s.widowOf);
    lines.push(...bur(s.burial, 27));
  }
  return lines;
}

function renderSpouseBlock(m: Marriage, spouseIndent: number, detailIndent: number, burialIndent: number): string[] {
  const lines: string[] = [];
  if (!m.spouse) return lines;
  const s = m.spouse;

  const nameParts = [s.givenName, s.surname].filter(Boolean);
  lines.push(' '.repeat(spouseIndent) + nameParts.join(' '));

  if (s.parents) lines.push(' '.repeat(detailIndent) + s.parents);
  if (s.birth) {
    const prefix = hasSelfPrefix(s.birth.date) ? '' : 'b. ';
    lines.push(' '.repeat(detailIndent) + prefix + dp(s.birth));
  }
  if (s.death) lines.push(' '.repeat(detailIndent) + 'd. ' + dp(s.death));
  if (s.widowOf) lines.push(' '.repeat(detailIndent) + 'm. ' + s.widowOf);
  lines.push(...bur(s.burial, burialIndent));

  return lines;
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

  if (child.adoptedDate) segments.push('adopted ' + child.adoptedDate);

  if (child.marriages && child.marriages.length > 0) {
    const hasNumbered = child.marriages.some(m => m.number !== undefined);
    if (hasNumbered) {
      // Numbered marriages: m. (1) DATE   PLACE   SPOUSE;   (2) ...
      const mParts = child.marriages.map(m => {
        let s = `(${m.number}) `;
        if (m.date) s += m.date;
        if (m.place) s += '   ' + m.place;
        if (m.spouse) s += '   ' + m.spouse;
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
        return 'm. ' + parts.join('   ');
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
  lines.push(`<a name="${data.id}"></a><font size="+2">${headingName}</font>${headingNote}`);

  // Parent reference
  if (data.relationship && data.parentDesc) {
    const rel = data.relationship === 'adopted dau.' ? 'adopted dau.'
      : data.relationship === 'adopted son' ? 'adopted son'
      : data.relationship === 'dau.' ? 'dau.'
      : 'son';
    const closeParen = data.noCloseParen ? '' : ')';
    if (data.parentId) {
      const href = data.parentLetter
        ? `${data.parentLetter}families.htm#${data.parentId}`
        : `#${data.parentId}`;
      lines.push(`   (${rel} of <a href="${href}">${data.parentDesc}</a>${closeParen}`);
    } else {
      lines.push(`   (${rel} of ${data.parentDesc}${closeParen}`);
    }
  }

  // Notes (e.g. name change, adoption note)
  if (data.notes) lines.push(`   ${data.notes}`);

  // Head birth
  if (data.head.birth) {
    const prefix = hasSelfPrefix(data.head.birth.date) ? '   ' : '   b. ';
    lines.push(prefix + dp(data.head.birth));
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
          const nameParts = [s.givenName, s.surname].filter(Boolean);
          lines.push('   m. ' + nameParts.join(' '));
          // Inline spouse details at indent 12
          if (s.parents) lines.push('            ' + s.parents);
          if (s.birth) lines.push('            b. ' + dp(s.birth));
          if (s.death) lines.push('            d. ' + dp(s.death));
          if (s.widowOf) lines.push('            m. ' + s.widowOf);
          lines.push(...bur(s.burial, 18));
          if (m.note) lines.push('         ' + m.note);
        } else {
          // Normal unnumbered marriage (date and/or place on m. line, spouse block below)
          let mLine = '   m. ';
          if (m.date) mLine += m.date;
          if (m.place) mLine += (m.date ? '   ' : '') + m.place;
          lines.push(mLine);
          if (m.spouse) lines.push(...renderSpouseBlock(m, 9, 15, 21));
          if (m.note) lines.push('         ' + m.note);
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
        lines.push(`<font size="+1">${group.headingText}:</font>`);
      } else {
        lines.push('<font size="+1">children:</font>');
      }
    } else if (group.spouseRef) {
      lines.push(`<font size="+1">children by ${group.spouseRef}:</font>`);
    } else {
      lines.push('<font size="+1">children:</font>');
    }
    for (const child of group.children) {
      lines.push(renderChildLine(child));
    }
  }

  lines.push('');

  // Docs link
  if (data.docsUrl) {
    lines.push(`<a href="${data.docsUrl}">documentation and notes</a>`);
  }

  return lines.join('\n');
}
