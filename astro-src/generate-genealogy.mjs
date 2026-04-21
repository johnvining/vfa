// Parses Viningfamilies/Xfamilies.htm letter pages into YAML content collection files.
// Usage: node generate-genealogy.mjs [Q]  (no arg = all letters)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.join(__dirname, '..', 'Viningfamilies');
const OUT_DIR = path.join(__dirname, 'src', 'content', 'genealogy');

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const LETTERS_WITH_DATA = LETTERS.filter(l => {
  const ax = path.join(SRC_DIR, `Axfamilies.htm`);
  const normal = path.join(SRC_DIR, `${l}families.htm`);
  return fs.existsSync(normal);
});

function stripTags(html) {
  return html.replace(/<[^>]+>/g, '').trim();
}

function decodeEntities(str) {
  return str
    .replace(/&#8220;/g, '\u201c')
    .replace(/&#8221;/g, '\u201d')
    .replace(/&#8217;/g, '\u2019')
    .replace(/&#8212;/g, '\u2014')
    .replace(/&#8230;/g, '\u2026')
    .replace(/&nbsp;/g, '\u00a0')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function extractLastUpdated(html) {
  const m = html.match(/\(updated ([^)]+)\)/);
  return m ? m[1].trim() : undefined;
}

function extractPreBlock(html) {
  // Try closed <pre>...</pre> first
  const closed = html.match(/<PRE>([\s\S]*?)<\/PRE>/i);
  let content;
  if (closed) {
    content = closed[1];
  } else {
    // Unclosed <pre>: grab everything from <pre> to </body> or end
    const open = html.match(/<PRE>([\s\S]*?)(?:<\/body>|$)/i);
    if (!open) return '';
    content = open[1];
  }
  // Remove outer <FONT FACE=...> or <font face=...> wrapper
  content = content.replace(/^\s*<font face="[^"]*">\s*/i, '');
  content = content.replace(/\s*<\/font>\s*$/i, '');
  return content;
}

// Split pre block into entry blocks by <hr class="people-divider" />
function splitEntries(preContent) {
  return preContent
    .split(/<hr class="people-divider" \/>/i)
    .map(s => s.trim())
    .filter(s => s.length > 0 && /<a name="/i.test(s));
}

function parseParentRef(line) {
  // (son of <a href="Bfamilies.htm#BertrandG01">...</a>) or same-page #ID
  const rel = line.match(/\((son|dau\.) of/i);
  const relationship = rel ? (rel[1].toLowerCase() === 'son' ? 'son' : 'dau.') : undefined;

  const linkMatch = line.match(/href="([A-Za-z]+families\.htm)?#([A-Za-z0-9]+)"/);
  let parentId, parentLetter;
  if (linkMatch) {
    parentId = linkMatch[2];
    if (linkMatch[1]) {
      parentLetter = linkMatch[1].replace('families.htm', '').toUpperCase();
    }
  }
  const desc = stripTags(line).replace(/^\((son|dau\.) of\s*/i, '').replace(/\)\s*$/, '').trim();
  return { relationship, parentId, parentLetter, parentDesc: desc || undefined };
}

function parseDatePlace(text) {
  // "DATE   PLACE" or "DATE   -" or just "DATE"
  text = text.trim();
  if (!text) return undefined;
  const tripleSpace = text.indexOf('   ');
  if (tripleSpace === -1) {
    return { date: text };
  }
  const date = text.slice(0, tripleSpace).trim();
  const place = text.slice(tripleSpace).trim();
  if (place === '-') return { date };
  return { date, place };
}

function parseBurialLine(text) {
  // "bur. PLACE   CITY, ..."
  text = text.replace(/^bur\.\s*/i, '').trim();
  if (!text) return undefined;
  return { place: text };
}

function countLeadingSpaces(line) {
  const m = line.match(/^( *)/);
  return m ? m[1].length : 0;
}

// Parse a child line (already stripped of leading 3-space indent)
// Format: NAME   b. DATE   PLACE   -   m. DATE PLACE SPOUSE   -   d. DATE PLACE
// Segments separated by "   -   " (triple-space dash triple-space)
function parseChildLine(rawLine) {
  // Extract name and optional link
  let name = '';
  let entryId, entryLetter;
  let rest = rawLine.trim();

  const linkMatch = rest.match(/^<a href="([A-Za-z]+families\.htm)?#([A-Za-z0-9]+)">(.*?)<\/a>/i);
  if (linkMatch) {
    if (linkMatch[1]) entryLetter = linkMatch[1].replace('families.htm', '').toUpperCase();
    entryId = linkMatch[2];
    name = stripTags(linkMatch[3]);
    rest = rest.slice(linkMatch[0].length).trim();
    // Remove leading spaces/separators after link
    rest = rest.replace(/^\s+/, '');
  } else {
    // Name is text before first "   b." or "   -"
    const nameSepIdx = rest.search(/\s{3}(b\.|m\.|d\.|bur\.|-)/);
    if (nameSepIdx !== -1) {
      name = stripTags(rest.slice(0, nameSepIdx)).trim();
      rest = rest.slice(nameSepIdx).trim();
    } else {
      name = stripTags(rest).trim();
      rest = '';
    }
  }

  // Split remaining by "   -   "
  const segments = rest ? rest.split(/\s{3}-\s+/) : [];

  let birth, death, burial;
  const marriages = [];
  let hasUnlistedChildren = false;

  for (const seg of segments) {
    const s = seg.trim();
    if (!s || s === '-') continue;

    if (s.startsWith('b.')) {
      const dp = parseDatePlace(s.slice(2).trim());
      if (dp) birth = dp;
    } else if (s.startsWith('d.')) {
      const dp = parseDatePlace(s.slice(2).trim());
      if (dp) death = dp;
    } else if (s.startsWith('bur.')) {
      burial = parseBurialLine(s);
    } else if (s.startsWith('m.')) {
      // Marriage segment: "m. (1) DATE   PLACE SPOUSE; (2) DATE   PLACE SPOUSE"
      // or "m. DATE   PLACE   SPOUSE"
      const marriageText = s.slice(2).trim();

      // Check for numbered marriages "(1) ...; (2) ..."
      if (/^\(1\)/.test(marriageText)) {
        // Split by ";   (N)" patterns
        const parts = marriageText.split(/;\s+(?=\(\d+\))/);
        for (const part of parts) {
          const numMatch = part.match(/^\((\d+)\)\s+/);
          const num = numMatch ? parseInt(numMatch[1]) : undefined;
          const mText = numMatch ? part.slice(numMatch[0].length) : part;
          marriages.push(parseChildMarriage(mText, num));
        }
      } else {
        marriages.push(parseChildMarriage(marriageText, undefined));
      }
    } else if (s.startsWith('+')) {
      hasUnlistedChildren = true;
    }
  }

  const child = { name };
  if (entryId) child.entryId = entryId;
  if (entryLetter) child.entryLetter = entryLetter;
  if (hasUnlistedChildren) child.hasUnlistedChildren = true;
  if (birth) child.birth = birth;
  if (marriages.length > 0) child.marriages = marriages;
  if (death) child.death = death;
  if (burial) child.burial = burial;
  return child;
}

// Parse "DATE   PLACE SPOUSE" or "DATE   PLACE   SPOUSE" from child marriage segment
function parseChildMarriage(text, number) {
  const m = {};
  if (number !== undefined) m.number = number;

  // Date is before first triple-space or before comma+space after date-like string
  const triIdx = text.indexOf('   ');
  if (triIdx === -1) {
    m.date = text.trim();
    return m;
  }
  m.date = text.slice(0, triIdx).trim();
  const afterDate = text.slice(triIdx).trim();

  // After date: "PLACE   SPOUSE" or just "SPOUSE" (if no triple-space)
  const tri2 = afterDate.indexOf('   ');
  if (tri2 === -1) {
    // Could be place or spouse — use heuristic: if it contains a state name or "County" it's a place
    if (/County|Maine|Mass|New|Virginia|Mississippi|Louisiana|Pennsylvania|Ohio|Indiana|Michigan|Wisconsin|Iowa|Minnesota|Kansas|Missouri|Illinois|Connecticut|Vermont|Hampshire|Rhode|Jersey|York|Carolina|Georgia|Florida|Tennessee|Kentucky|Alabama|Texas|California|Oregon|Washington/.test(afterDate)) {
      m.place = afterDate;
    } else {
      m.spouse = afterDate;
    }
    return m;
  }

  const potentialPlace = afterDate.slice(0, tri2).trim();
  const potentialSpouse = afterDate.slice(tri2).trim();

  if (/County|Maine|Mass|New |Virginia|Mississippi|Louisiana|Pennsylvania|Ohio|Indiana|Michigan|Wisconsin|Iowa|Minnesota|Kansas|Missouri|Illinois|Connecticut|Vermont|Hampshire|Rhode|Jersey|York|Carolina|Georgia|Florida|Tennessee|Kentucky|Alabama|Texas|California|Oregon|Washington/.test(potentialPlace)) {
    m.place = potentialPlace;
    if (potentialSpouse) m.spouse = potentialSpouse;
  } else {
    m.spouse = afterDate;
  }
  return m;
}

function parseEntry(block, letter) {
  const lines = block.split('\n');

  // Extract id and head name
  const headerLine = lines.find(l => /<a name=/.test(l));
  if (!headerLine) return null;

  const idMatch = headerLine.match(/<a name="([^"]+)"><\/a>/i);
  if (!idMatch) return null;
  const id = idMatch[1];

  const nameMatch = headerLine.match(/<font size=["']?\+2["']?>([^<]+)(?:<\/[^>]*>)*/i);
  // Remove "Vining" suffix and trailing space
  let fullName = nameMatch ? nameMatch[1].replace(/\s+Vining\s*$/, '').trim() : '';
  // Handle "Vining Jr." etc.
  fullName = fullName.replace(/\s+Vining(\s+(Jr\.|Sr\.|I+|II|III|IV|V))\s*$/, '$1').trim();
  // Actually just remove " Vining" and keep remainder as given name
  const givenName = nameMatch ?
    nameMatch[1].replace(/\s+Vining(\s+Jr\.?|\s+Sr\.?|\s+[IV]+)?$/, '$1').replace(/^\s+/, '').trim() : '';

  // Find parent reference line
  let relationship, parentId, parentLetter, parentDesc;
  const parentLine = lines.find(l => /^\s+\((son|dau\.) of/i.test(l));
  if (parentLine) {
    const parsed = parseParentRef(parentLine);
    ({ relationship, parentId, parentLetter, parentDesc } = parsed);
  }

  // Parse body: lines after header, before children/docs
  const headerIdx = lines.indexOf(headerLine);
  const childrenIdx = lines.findIndex(l => /<font size=["']?\+1["']?>children/i.test(l));
  const docsIdx = lines.findIndex(l => /documentation and notes/.test(l));

  const bodyLines = lines.slice(headerIdx + 1, childrenIdx !== -1 ? childrenIdx : (docsIdx !== -1 ? docsIdx : lines.length));

  // Parse head birth/death/burial and marriages from body lines.
  // Indentation conventions:
  //   Unnumbered m.: spouse at mIndent+6, spouse details at mIndent+12, spouse bur at mIndent+18
  //   Numbered m.(1) at indent 3: spouse at 15 (3+12), details at 21, bur at 27
  //   Continuation (N) at indent 9: spouse at 15 (9+6), details at 21, bur at 27
  let headBirth, headDeath, headBurial;
  const marriages = [];
  let currentMarriage = null;
  let inSpouseBlock = false;
  let expectedSpouseIndent = 9;  // adjusted when marriage format changes
  let isNumberedMarriage = false;

  function startMarriage(m) {
    currentMarriage = m;
    inSpouseBlock = true;
    marriages.push(currentMarriage);
  }

  for (const line of bodyLines) {
    if (!line.trim()) continue;
    if (/^\s+\((son|dau\.) of/i.test(line)) continue;

    const indent = countLeadingSpaces(line);
    const content = line.trim();

    if (indent === 3) {
      if (content.startsWith('b.')) {
        headBirth = parseDatePlace(content.slice(2).trim()) || undefined;
      } else if (content.startsWith('d.')) {
        headDeath = parseDatePlace(content.slice(2).trim()) || undefined;
        inSpouseBlock = false;
        currentMarriage = null;
      } else if (content.startsWith('m.')) {
        const m = {};
        const numMatch = content.match(/^m\.\s+\((\d+)\)\s*/);
        if (numMatch) {
          // Numbered marriage: m. (1) DATE — spouse will be at indent 15
          m.number = parseInt(numMatch[1]);
          const rest = content.slice(numMatch[0].length).trim();
          const dp = parseDatePlace(rest);
          if (dp) { m.date = dp.date; m.place = dp.place; }
          isNumberedMarriage = true;
          expectedSpouseIndent = 15;
        } else {
          const rest = content.slice(2).trim();
          const triIdx = rest.indexOf('   ');
          if (triIdx === -1) {
            if (/^\d|^ca\./.test(rest)) {
              m.date = rest;
            } else {
              // Inline spouse name (no date)
              const parts = rest.split(' ');
              m.spouse = { givenName: parts.slice(0, -1).join(' ') || rest, surname: parts[parts.length - 1] };
              inSpouseBlock = false;
            }
          } else {
            m.date = rest.slice(0, triIdx).trim();
            const afterDate = rest.slice(triIdx).trim();
            const tri2 = afterDate.indexOf('   ');
            if (tri2 !== -1) {
              m.place = afterDate.slice(0, tri2).trim();
            } else {
              m.place = afterDate;
            }
          }
          isNumberedMarriage = false;
          expectedSpouseIndent = 9;
        }
        startMarriage(m);
      } else if (content.startsWith('bur.')) {
        headBurial = parseBurialLine(content);
      }
    } else if (indent === 9) {
      if (inSpouseBlock && /^\(\d+\)\s/.test(content)) {
        // Numbered marriage continuation: (2) DATE   PLACE
        const m = {};
        const numMatch = content.match(/^\((\d+)\)\s+/);
        m.number = parseInt(numMatch[1]);
        const rest = content.slice(numMatch[0].length).trim();
        const dp = parseDatePlace(rest);
        if (dp) { m.date = dp.date; m.place = dp.place; }
        isNumberedMarriage = true;
        expectedSpouseIndent = 15;
        startMarriage(m);
      } else if (inSpouseBlock && content.startsWith('bur.')) {
        headBurial = parseBurialLine(content);
        inSpouseBlock = false;
      } else if (inSpouseBlock && currentMarriage && !currentMarriage.spouse && expectedSpouseIndent === 9) {
        // Unnumbered marriage: spouse name at indent 9
        const parts = content.split(' ');
        currentMarriage.spouse = { givenName: parts.slice(0, -1).join(' ') || content, surname: parts[parts.length - 1] };
      }
    } else if (indent === 15 && inSpouseBlock && currentMarriage) {
      if (!currentMarriage.spouse) {
        // Numbered marriage: spouse name at indent 15
        const parts = content.split(' ');
        currentMarriage.spouse = { givenName: parts.slice(0, -1).join(' ') || content, surname: parts[parts.length - 1] };
      } else {
        // Spouse details
        if (/^\(dau\. of|^\(son of/i.test(content)) {
          currentMarriage.spouse.parents = content.replace(/^\(dau\. of\s*|\(son of\s*/i, '').replace(/\)$/, '').trim();
        } else if (content.startsWith('b.')) {
          currentMarriage.spouse.birth = parseDatePlace(content.slice(2).trim());
        } else if (content.startsWith('d.')) {
          currentMarriage.spouse.death = parseDatePlace(content.slice(2).trim());
        } else if (content.startsWith('m.')) {
          if (!currentMarriage.spouse.widowOf) currentMarriage.spouse.widowOf = content.slice(2).trim();
        }
      }
    } else if (indent === 21 && inSpouseBlock && currentMarriage && currentMarriage.spouse) {
      if (content.startsWith('b.')) {
        currentMarriage.spouse.birth = parseDatePlace(content.slice(2).trim());
      } else if (content.startsWith('d.')) {
        currentMarriage.spouse.death = parseDatePlace(content.slice(2).trim());
      } else if (content.startsWith('bur.')) {
        currentMarriage.spouse.burial = parseBurialLine(content);
      }
    } else if (indent === 27 && inSpouseBlock && currentMarriage && currentMarriage.spouse) {
      if (content.startsWith('bur.')) {
        currentMarriage.spouse.burial = parseBurialLine(content);
      }
    }
  }

  // Parse children — handle multiple groups ("children by X:")
  let childrenGroups = [];
  const endIdx = docsIdx !== -1 ? docsIdx : lines.length;
  let scanIdx = childrenIdx !== -1 ? childrenIdx : -1;

  while (scanIdx !== -1 && scanIdx < endIdx) {
    const headingLine = lines[scanIdx];
    // Extract spouse ref from "children by X:" or "children with X:"
    const byMatch = headingLine.match(/<font[^>]+>children (?:by|with) ([^<:]+)/i);
    const spouseRef = byMatch ? byMatch[1].trim() : undefined;

    // Find the next children heading or end
    const nextHeadingIdx = lines.findIndex((l, i) => i > scanIdx && /<font size=["']?\+1["']?>children/i.test(l));
    const groupEnd = nextHeadingIdx !== -1 && nextHeadingIdx < endIdx ? nextHeadingIdx : endIdx;

    const groupLines = lines.slice(scanIdx + 1, groupEnd);
    const children = groupLines
      .filter(l => {
        const t = l.trim();
        // Allow anchor-wrapped children (<a href...>Name</a>) but exclude bare tag-only lines (<table>, <tr>, etc)
        const isTagOnly = /^</.test(t) && !stripTags(t).trim();
        return countLeadingSpaces(l) >= 3 && t && !/<font/.test(l) && !isTagOnly;
      })
      .map(l => parseChildLine(l.trim()));

    if (children.length > 0) {
      const group = { children };
      if (spouseRef) group.spouseRef = spouseRef;
      childrenGroups.push(group);
    }

    scanIdx = nextHeadingIdx !== -1 && nextHeadingIdx < endIdx ? nextHeadingIdx : -1;
  }

  // Parse docs URL
  let docsUrl;
  if (docsIdx !== -1) {
    const docsLine = lines[docsIdx];
    const docsMatch = docsLine.match(/href="([^"]+)"/);
    if (docsMatch) docsUrl = docsMatch[1];
  }

  // Build entry object
  const entry = {
    id,
    letter,
  };
  if (relationship) entry.relationship = relationship;
  if (parentId) entry.parentId = parentId;
  if (parentLetter) entry.parentLetter = parentLetter;
  if (parentDesc) entry.parentDesc = parentDesc;

  entry.head = { givenName };
  if (headBirth) entry.head.birth = headBirth;
  if (headDeath) entry.head.death = headDeath;
  if (headBurial) entry.head.burial = headBurial;

  if (marriages.length > 0) {
    entry.marriages = marriages.map(m => {
      const out = {};
      if (m.number !== undefined) out.number = m.number;
      if (m.date) out.date = m.date;
      if (m.place) out.place = m.place;
      if (m.note) out.note = m.note;
      if (m.spouse) {
        const s = {};
        if (m.spouse.givenName) s.givenName = m.spouse.givenName;
        if (m.spouse.surname) s.surname = m.spouse.surname;
        if (m.spouse.nee) s.nee = m.spouse.nee;
        if (m.spouse.widowOf) s.widowOf = m.spouse.widowOf;
        if (m.spouse.parents) s.parents = m.spouse.parents;
        if (m.spouse.birth) s.birth = m.spouse.birth;
        if (m.spouse.death) s.death = m.spouse.death;
        if (m.spouse.burial) s.burial = m.spouse.burial;
        if (Object.keys(s).length > 0) out.spouse = s;
      }
      return out;
    });
  }

  if (childrenGroups.length > 0) entry.childrenGroups = childrenGroups;
  if (docsUrl) entry.docsUrl = docsUrl;

  // Store raw block for faithful rendering
  entry.raw = block;

  return entry;
}

function toYaml(obj, indent = 0) {
  const pad = ' '.repeat(indent);
  const lines = [];

  for (const [key, val] of Object.entries(obj)) {
    if (val === undefined || val === null) continue;

    if (typeof val === 'string') {
      // Escape if needed
      const needsQuotes = /[:#\[\]{},&*?|<>=!%@`]/.test(val) || val.includes('\n') || val.startsWith(' ') || val.endsWith(' ') || val === 'true' || val === 'false' || val === 'null' || /^\d/.test(val);
      if (needsQuotes) {
        // Use double quotes, escape backslash and double quote
        const escaped = val.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
        lines.push(`${pad}${key}: "${escaped}"`);
      } else {
        lines.push(`${pad}${key}: ${val}`);
      }
    } else if (typeof val === 'number') {
      lines.push(`${pad}${key}: ${val}`);
    } else if (typeof val === 'boolean') {
      lines.push(`${pad}${key}: ${val}`);
    } else if (Array.isArray(val)) {
      lines.push(`${pad}${key}:`);
      for (const item of val) {
        if (typeof item === 'object' && item !== null) {
          const itemLines = toYaml(item, indent + 4);
          const itemLineArr = itemLines.split('\n');
          lines.push(`${pad}  - ${itemLineArr[0].trimStart()}`);
          for (const il of itemLineArr.slice(1)) {
            if (il.trim()) lines.push(`${pad}    ${il.trimStart()}`);
          }
        } else {
          lines.push(`${pad}  - ${item}`);
        }
      }
    } else if (typeof val === 'object') {
      lines.push(`${pad}${key}:`);
      lines.push(toYaml(val, indent + 2));
    }
  }
  return lines.join('\n');
}

function serializeEntry(entry) {
  // Use js-yaml style serialization for the raw field (multiline)
  let yaml = '';

  const simpleFields = ['id', 'letter', 'lastUpdated', 'relationship', 'parentId', 'parentLetter', 'parentDesc'];
  for (const f of simpleFields) {
    if (entry[f] !== undefined) {
      yaml += `${f}: ${yamlStr(entry[f])}\n`;
    }
  }

  // head
  yaml += 'head:\n';
  yaml += serializeGivenName(entry.head.givenName);
  if (entry.head.birth) yaml += serializeDatePlace('birth', entry.head.birth, 2);
  if (entry.head.death) yaml += serializeDatePlace('death', entry.head.death, 2);
  if (entry.head.burial) yaml += serializeBurial(entry.head.burial, 2);

  // marriages
  if (entry.marriages && entry.marriages.length > 0) {
    yaml += 'marriages:\n';
    for (const m of entry.marriages) {
      yaml += '  -';
      let first = true;
      const addField = (k, v) => {
        if (first) { yaml += ` ${k}: ${yamlStr(v)}\n`; first = false; }
        else yaml += `    ${k}: ${yamlStr(v)}\n`;
      };
      if (m.number !== undefined) addField('number', m.number);
      if (m.date) addField('date', m.date);
      if (m.place) addField('place', m.place);
      if (m.note) addField('note', m.note);
      if (m.spouse) {
        if (first) { yaml += ` spouse:\n`; first = false; }
        else yaml += `    spouse:\n`;
        const s = m.spouse;
        if (s.givenName) yaml += `      givenName: ${yamlStr(s.givenName)}\n`;
        if (s.surname) yaml += `      surname: ${yamlStr(s.surname)}\n`;
        if (s.nee) yaml += `      nee: ${yamlStr(s.nee)}\n`;
        if (s.widowOf) yaml += `      widowOf: ${yamlStr(s.widowOf)}\n`;
        if (s.parents) yaml += `      parents: ${yamlStr(s.parents)}\n`;
        if (s.birth) yaml += serializeDatePlace('birth', s.birth, 6);
        if (s.death) yaml += serializeDatePlace('death', s.death, 6);
        if (s.burial) yaml += serializeBurial(s.burial, 6);
      }
    }
  }

  // childrenGroups
  if (entry.childrenGroups && entry.childrenGroups.length > 0) {
    yaml += 'childrenGroups:\n';
    for (const group of entry.childrenGroups) {
      yaml += '  -';
      let groupFirst = true;
      if (group.spouseRef) {
        yaml += ` spouseRef: ${yamlStr(group.spouseRef)}\n`;
        groupFirst = false;
      }
      if (groupFirst) yaml += ` children:\n`;
      else yaml += `    children:\n`;
      for (const child of group.children) {
        yaml += serializeChild(child);
      }
    }
  }

  if (entry.docsUrl) yaml += `docsUrl: ${entry.docsUrl}\n`;
  if (entry.notes) {
    const escaped = entry.notes.replace(/"/g, '\\"');
    yaml += `notes: "${escaped}"\n`;
  }

  // raw field as literal block scalar
  if (entry.raw) {
    yaml += 'raw: |-\n';
    const rawLines = entry.raw.replace(/\r\n/g, '\n').split('\n');
    for (const line of rawLines) {
      yaml += `  ${line}\n`;
    }
  }

  return yaml;
}

function serializeGivenName(name) {
  return `  givenName: ${yamlStr(name || '[?]')}\n`;
}

function yamlStr(v) {
  if (typeof v !== 'string') return String(v);
  const needsQuotes = /[:#\[\]{},&*?|<>=!%@`]/.test(v)
    || v.startsWith(' ') || v.endsWith(' ')
    || v === '-' || v.startsWith('- ')  // bare dash = YAML list indicator
    || /^\d+$/.test(v)  // pure number string
    || v === 'true' || v === 'false' || v === 'null';
  return needsQuotes ? `"${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"` : v;
}

function serializeDatePlace(field, dp, indent) {
  const pad = ' '.repeat(indent);
  let out = `${pad}${field}:\n`;
  if (dp.date) out += `${pad}  date: ${yamlStr(dp.date)}\n`;
  if (dp.place) out += `${pad}  place: ${yamlStr(dp.place)}\n`;
  if (dp.lastResidence) out += `${pad}  lastResidence: ${yamlStr(dp.lastResidence)}\n`;
  return out;
}

function serializeBurial(b, indent) {
  const pad = ' '.repeat(indent);
  let out = `${pad}burial:\n`;
  if (b.place) out += `${pad}  place: ${yamlStr(b.place)}\n`;
  if (b.description) out += `${pad}  description: ${yamlStr(b.description)}\n`;
  return out;
}

function serializeChild(child) {
  let yaml = '      - ';
  let first = true;
  const addField = (k, v) => {
    const val = typeof v === 'boolean' ? v : yamlStr(String(v));
    if (first) { yaml += `${k}: ${val}\n`; first = false; }
    else yaml += `        ${k}: ${val}\n`;
  };
  addField('name', child.name);
  if (child.entryId) addField('entryId', child.entryId);
  if (child.entryLetter) addField('entryLetter', child.entryLetter);
  if (child.hasUnlistedChildren) addField('hasUnlistedChildren', true);
  if (child.birth) yaml += serializeDatePlace('birth', child.birth, 8);
  if (child.marriages) {
    yaml += '        marriages:\n';
    for (const m of child.marriages) {
      yaml += '          -';
      let mFirst = true;
      const addM = (k, v) => {
        const val = typeof v === 'number' ? v : yamlStr(String(v));
        if (mFirst) { yaml += ` ${k}: ${val}\n`; mFirst = false; }
        else yaml += `            ${k}: ${val}\n`;
      };
      if (m.number !== undefined) addM('number', m.number);
      if (m.date) addM('date', m.date);
      if (m.place) addM('place', m.place);
      if (m.spouse) addM('spouse', m.spouse);
      if (m.spouseDeath) addM('spouseDeath', m.spouseDeath);
    }
  }
  if (child.death) yaml += serializeDatePlace('death', child.death, 8);
  if (child.burial) yaml += serializeBurial(child.burial, 8);
  return yaml;
}

function processLetter(letter, letterArg) {
  // Try Axfamilies for special case
  const isAx = letter === 'AX';
  const filename = isAx ? 'Axfamilies.htm' : `${letter}families.htm`;
  const srcPath = path.join(SRC_DIR, filename);

  if (!fs.existsSync(srcPath)) {
    console.log(`  No file found for ${letter}`);
    return;
  }

  const html = fs.readFileSync(srcPath, 'utf8');
  const lastUpdated = extractLastUpdated(html);
  const preContent = extractPreBlock(html);

  if (!preContent.trim()) {
    console.log(`  No PRE content in ${filename}`);
    return;
  }

  const entryBlocks = splitEntries(preContent);
  console.log(`  ${filename}: ${entryBlocks.length} entries`);

  const outDir = path.join(OUT_DIR, letter.toLowerCase());
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  for (const block of entryBlocks) {
    const entry = parseEntry(block, letter);
    if (!entry) {
      console.warn(`  Could not parse entry in ${filename}`);
      continue;
    }
    if (lastUpdated) entry.lastUpdated = lastUpdated;

    const yaml = serializeEntry(entry);
    const outPath = path.join(outDir, `${entry.id}.yaml`);
    fs.writeFileSync(outPath, yaml, 'utf8');
    console.log(`    Written: ${entry.id}.yaml`);
  }
}

// Main
const targetLetter = process.argv[2]?.toUpperCase();
const letters = targetLetter ? [targetLetter] : LETTERS_WITH_DATA;

for (const letter of letters) {
  processLetter(letter);
}
