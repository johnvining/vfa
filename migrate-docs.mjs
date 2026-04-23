// migrate-docs.mjs
// Usage: node migrate-docs.mjs A
// Converts old HTML doc files + images for one letter to YAML + copied images.

import fs from 'fs';
import path from 'path';
import { dump } from './node_modules/js-yaml/dist/js-yaml.mjs';

const OLD_BASE = '/Users/johnvining/Documents/GitHub/vfa/Viningfamilies';
const NEW_CONTENT_BASE = path.join(import.meta.dirname, 'src/content/genealogy-docs');
const NEW_IMAGES_BASE = path.join(import.meta.dirname, 'public/genealogy-images');

const letter = process.argv[2];
if (!letter || letter.length !== 1) {
  console.error('Usage: node migrate-docs.mjs LETTER');
  process.exit(1);
}

const L = letter.toUpperCase();
const l = letter.toLowerCase();

const sourcesDir = path.join(OLD_BASE, `${L}sources`);
const imagesDir = path.join(sourcesDir, `${L}images`);
const outContentDir = path.join(NEW_CONTENT_BASE, l);
const outImagesDir = path.join(NEW_IMAGES_BASE, l);

// ─── HTML helpers ─────────────────────────────────────────────────────────────

function decodeEntities(str) {
  return str
    .replace(/&nbsp;/g, ' ')
    .replace(/&#8220;/g, '“')
    .replace(/&#8221;/g, '”')
    .replace(/&#8216;/g, '‘')
    .replace(/&#8217;/g, '’')
    .replace(/&#8211;/g, '–')
    .replace(/&#8212;/g, '—')
    .replace(/&#8230;/g, '…')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"');
}

function stripTags(str) {
  return str.replace(/<[^>]+>/g, '');
}

function cleanInline(html) {
  // Decode entities, strip tags, collapse whitespace — for captions and labels
  return decodeEntities(html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ''))
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanBlock(html) {
  // Preserve line breaks from <br>, strip other tags
  return decodeEntities(html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ''))
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function extractImages(html) {
  // Normalize malformed <img> tags missing closing > (e.g. <img src="file.jpg"<br>)
  html = html.replace(/(<img\s[^<>]*?)(?=\s*<(?!img\s)|\s*$)/gi, '$1>');
  const images = [];
  const re = /<img\s([^>]+)>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const attrs = m[1];
    const srcM = attrs.match(/src=["']?([^"'\s>]+)["']?/i);
    const htM = attrs.match(/height=["']?(\d+)["']?/i);
    if (srcM) {
      const img = { src: path.basename(srcM[1]) };
      if (htM) img.height = parseInt(htM[1]);
      images.push(img);
    }
  }
  return images;
}

function isInlineImages(html) {
  return /&nbsp;&nbsp;&nbsp;/.test(html);
}

// ─── Section type mapping ─────────────────────────────────────────────────────

function headingToType(text) {
  const t = text.toLowerCase();
  if (t.includes('census')) return 'census';
  if (t.includes('death')) return 'death';
  if (t.includes('birth')) return 'birth';
  if (t.includes('marriage')) return 'marriage';
  if (t.includes('military')) return 'military';
  if (t.includes('family')) return 'family';
  if (t.startsWith('note')) return 'notes';
  if (t.includes('research')) return 'research';
  return 'other';
}

const DEFAULT_HEADINGS = {
  census: 'Census Data',
  death: 'Death Data',
  birth: 'Birth Data',
  marriage: 'Marriage Data',
  military: 'Military Data',
  family: 'Family Data',
  notes: 'Notes',
  research: 'Research Opportunity',
};

// ─── Census table parser ──────────────────────────────────────────────────────

function parseCensusTable(tableHtml) {
  const columns = [];
  const rows = [];

  // Extract all <tr> blocks
  const trRe = /<tr>([\s\S]*?)<\/tr>/gi;
  let trM;
  let firstRow = true;

  while ((trM = trRe.exec(tableHtml)) !== null) {
    const rowHtml = trM[1];
    // Extract all <td> blocks
    const cells = [];
    const tdRe = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let tdM;
    while ((tdM = tdRe.exec(rowHtml)) !== null) {
      cells.push(tdM[1]);
    }
    if (cells.length === 0) continue;

    if (firstRow) {
      // First row: year column headers (skip first cell which is blank)
      for (let i = 1; i < cells.length; i++) {
        columns.push(cleanInline(cells[i]));
      }
      firstRow = false;
    } else {
      // Person row
      const nameRaw = cells[0];
      // Detect indent: &nbsp;&nbsp;&nbsp;&nbsp; at start
      const indent = /^\s*(&nbsp;){4}/.test(nameRaw) ||
                     /^\s* {4}/.test(decodeEntities(nameRaw));
      const label = cleanInline(nameRaw.replace(/^(\s*&nbsp;)+/i, '').trim());
      if (!label) continue;

      const values = [];
      for (let i = 1; i < cells.length; i++) {
        // Preserve <br> as newline within cell values
        const val = cleanBlock(cells[i]);
        values.push(val);
      }

      const row = { label, values };
      if (indent) row.indent = true;
      rows.push(row);
    }
  }

  return { columns, rows };
}

// ─── Census year entries ──────────────────────────────────────────────────────

function parseCensusEntries(html) {
  // Strip HTML comments (they sometimes contain <br><br><br> which breaks splitting)
  html = html.replace(/<!--[\s\S]*?-->/g, '');
  // Remove leading/trailing <br> clutter
  html = html.replace(/^(\s*<br\s*\/?>\s*)+/i, '').trim();

  // Split on triple <br> to get chunks
  const chunks = html.split(/<br\s*\/?>\s*<br\s*\/?>\s*<br\s*\/?>/i);
  const entries = [];

  for (const chunk of chunks) {
    const trimmed = chunk.trim();
    if (!trimmed) continue;

    // Strip any leading <br> tags (some entries are preceded by extra <br><br>)
    const stripped = trimmed.replace(/^(\s*<br\s*\/?>\s*)+/i, '').trim();
    if (!stripped) continue;

    // Check if this chunk starts with a year entry
    const yearM = stripped.match(/^<font\s+size=\+1><b>(\d{4}[a-z]?)<\/b><\/font>([\s\S]*)$/i);
    if (!yearM) {
      // Orphan image chunk — attach to previous entry if images-only
      const orphanImages = extractImages(stripped);
      const textOnly = stripped.replace(/<img[^>]*>/gi, '').replace(/<br\s*\/?>/gi, '').trim();
      if (orphanImages.length > 0 && !textOnly && entries.length > 0) {
        const prev = entries[entries.length - 1];
        if (!prev.images) prev.images = [];
        prev.images.push(...orphanImages);
      } else if (stripped && (orphanImages.length > 0 || textOnly)) {
        // Non-year content with text or images — store as trailing item on a special key
        if (!entries._trailing) entries._trailing = [];
        const imgIdx = stripped.search(/<img/i);
        const item = {};
        if (imgIdx >= 0) {
          const cap = cleanInline(stripped.slice(0, imgIdx));
          if (cap) item.caption = cap.replace(/:\s*$/, '').trim();
          item.images = orphanImages;
          if (isInlineImages(stripped) && orphanImages.length > 1) item.inline = true;
        } else {
          const cap = cleanInline(stripped);
          if (cap) item.caption = cap;
        }
        if (Object.keys(item).length > 0) entries._trailing.push(item);
      }
      continue;
    }

    const year = yearM[1];
    const rest = yearM[2]; // everything after </font>

    // Split caption from images at first <img>
    const imgIdx = rest.search(/<img/i);
    let caption = '';
    let imagesHtml = '';

    if (imgIdx >= 0) {
      caption = cleanInline(rest.slice(0, imgIdx));
      imagesHtml = rest.slice(imgIdx);
    } else {
      caption = cleanInline(rest);
    }

    // Strip trailing colon from caption
    caption = caption.replace(/:\s*$/, '').trim();

    const images = extractImages(imagesHtml);
    const inline = isInlineImages(imagesHtml);

    const entry = { year };
    if (caption) entry.caption = caption;
    if (images.length > 0) entry.images = images;
    if (inline && images.length > 1) entry.inline = true;

    entries.push(entry);
  }

  return entries;
}

// ─── Items section parser ─────────────────────────────────────────────────────

function parseItemsContent(html) {
  html = html.replace(/^(\s*<br\s*\/?>\s*)+/i, '').trim();

  const chunks = html.split(/<br\s*\/?>\s*<br\s*\/?>\s*<br\s*\/?>/i);
  const items = [];

  for (const chunk of chunks) {
    const trimmed = chunk.trim();
    if (!trimmed) continue;
    // Skip chunks that are just <br> tags
    if (/^(<br\s*\/?>\s*)+$/i.test(trimmed)) continue;

    const imgIdx = trimmed.search(/<img/i);
    let caption = '';
    let imagesHtml = '';

    if (imgIdx >= 0) {
      caption = cleanInline(trimmed.slice(0, imgIdx));
      imagesHtml = trimmed.slice(imgIdx);
    } else {
      caption = cleanInline(trimmed);
    }

    const images = extractImages(imagesHtml);
    const inline = isInlineImages(imagesHtml);

    const item = {};
    if (caption) item.caption = caption;
    if (images.length > 0) item.images = images;
    if (inline && images.length > 1) item.inline = true;

    if (Object.keys(item).length > 0) items.push(item);
  }

  return items;
}

// ─── Text section parser ──────────────────────────────────────────────────────

function parseTextContent(html) {
  return cleanBlock(html);
}

// ─── Main doc file parser ─────────────────────────────────────────────────────

function parseDocFile(html, personId) {
  // Extract title
  const titleM = html.match(/<TITLE>([\s\S]*?)<\/TITLE>/i);
  const title = titleM ? decodeEntities(titleM[1].trim()) : personId;

  // Extract body
  const bodyM = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (!bodyM) return { id: personId, title };
  let body = bodyM[1];

  // Extract display title from center block before removing it
  let displayTitle = null;
  const centerM = body.match(/<center>([\s\S]*?)<\/center>/si);
  if (centerM) {
    const centerText = cleanInline(centerM[1]);
    const docForM = centerText.match(/^Documentation\s+for\s+(.+)$/i);
    if (docForM) displayTitle = docForM[1].trim();
  }

  // Remove center title block
  body = body.replace(/<center>[\s\S]*?<\/center>/si, '');

  // Split body by section headings
  // Heading pattern: <P>...<font size=+N>...(optional <b>)text(/b)...</font>...</P>
  const headingRe = /<P>\s*<font\s+size=\+([12])>\s*(?:<b>)?([\s\S]*?)(?:<\/b>)?\s*(?:<br\s*\/?>\s*)?\s*<\/font>\s*<\/P>/gi;

  const parts = [];
  let lastIdx = 0;
  let m;

  while ((m = headingRe.exec(body)) !== null) {
    if (m.index > lastIdx) {
      parts.push({ type: 'content', html: body.slice(lastIdx, m.index) });
    }
    const headingText = decodeEntities(stripTags(m[2])).trim();
    parts.push({ type: 'heading', size: parseInt(m[1]), text: headingText });
    lastIdx = m.index + m[0].length;
  }
  if (lastIdx < body.length) {
    parts.push({ type: 'content', html: body.slice(lastIdx) });
  }

  // Group into intro + sections
  let introHtml = '';
  const rawSections = [];
  let current = null;

  for (const part of parts) {
    if (part.type === 'heading') {
      if (current) rawSections.push(current);
      current = { headingText: part.text, headingSize: part.size, content: '' };
    } else {
      if (current) {
        current.content += part.html;
      } else {
        introHtml += part.html;
      }
    }
  }
  if (current) rawSections.push(current);

  // Parse intro
  const introItems = parseItemsContent(introHtml);

  // Parse sections — returns a flat array (census trailing content becomes a separate section)
  const sections = rawSections.flatMap(sec => {
    const type = headingToType(sec.headingText);
    const result = { type };

    // Only include heading if non-default
    const defaultH = DEFAULT_HEADINGS[type];
    if (!defaultH || sec.headingText !== defaultH) {
      result.heading = sec.headingText;
    }
    if (sec.headingSize === 2) result.headingLarge = true;

    if (type === 'census') {
      // Extract table
      const tableM = sec.content.match(/<table[\s\S]*?<\/table>/i);
      if (tableM) {
        result.table = parseCensusTable(tableM[0]);
        const afterTable = sec.content.slice(sec.content.indexOf(tableM[0]) + tableM[0].length);
        const entries = parseCensusEntries(afterTable);
        if (entries.length > 0) result.entries = entries;
        if (entries._trailing && entries._trailing.length > 0) {
          return [result, { type: 'other', items: entries._trailing }];
        }
      } else {
        // No table, just year entries
        const entries = parseCensusEntries(sec.content);
        if (entries.length > 0 || entries._trailing) {
          if (entries.length > 0) result.entries = entries;
          if (entries._trailing && entries._trailing.length > 0) {
            return [result, { type: 'other', items: entries._trailing }];
          }
        } else {
          // No year entries either — mislabeled heading; treat as items (e.g. gravestone under "Census Data")
          const items = parseItemsContent(sec.content);
          if (items.length > 0) {
            result.type = 'other';
            result.items = items;
          }
        }
      }
      return [result];
    } else if (type === 'notes' || type === 'research' || type === 'other') {
      // If images are present, try items parsing first (preserves image+caption pairs)
      if (/<img/i.test(sec.content)) {
        const items = parseItemsContent(sec.content);
        if (items.some(i => i.images && i.images.length > 0)) {
          result.items = items;
        } else {
          const text = parseTextContent(sec.content);
          if (text) result.text = text;
        }
      } else {
        const text = parseTextContent(sec.content);
        if (text) result.text = text;
      }
    } else {
      const items = parseItemsContent(sec.content);
      if (items.length > 0) result.items = items;
    }

    return [result];
  });

  const doc = { id: personId, title };
  if (displayTitle && displayTitle !== title) doc.displayTitle = displayTitle;
  if (introItems.length > 0) doc.intro = introItems;
  if (sections.length > 0) doc.sections = sections;

  return doc;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

fs.mkdirSync(outContentDir, { recursive: true });
fs.mkdirSync(outImagesDir, { recursive: true });

// Copy images
if (fs.existsSync(imagesDir)) {
  const imgFiles = fs.readdirSync(imagesDir);
  for (const f of imgFiles) {
    fs.copyFileSync(path.join(imagesDir, f), path.join(outImagesDir, f));
  }
  console.log(`Copied ${imgFiles.length} images → public/genealogy-images/${l}/`);
} else {
  console.log(`No images directory found at ${imagesDir}`);
}

// Process each doc file
const docFiles = fs.readdirSync(sourcesDir)
  .filter(f => f.endsWith('doc.htm'))
  .sort();

console.log(`Processing ${docFiles.length} files for letter ${L}...`);

let ok = 0, err = 0;
for (const file of docFiles) {
  const personId = file.replace('doc.htm', '');
  try {
    const html = fs.readFileSync(path.join(sourcesDir, file), 'utf-8');
    const doc = parseDocFile(html, personId);
    const yamlStr = dump(doc, {
      lineWidth: 120,
      quotingType: '"',
      forceQuotes: false,
      noRefs: true,
    });
    fs.writeFileSync(path.join(outContentDir, `${personId}.yaml`), yamlStr);
    ok++;
  } catch (e) {
    console.error(`  ERROR ${file}: ${e.message}`);
    err++;
  }
}

console.log(`Done: ${ok} OK, ${err} errors`);
