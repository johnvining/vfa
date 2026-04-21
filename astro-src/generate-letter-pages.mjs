import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const srcDir = '/Users/johnvining/Documents/GitHub/vfa/Viningfamilies';
const outDir = '/Users/johnvining/Documents/GitHub/vfa/astro-src/src/pages/Viningfamilies';
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

const letters = 'ABCDEFGHIJKLMNOPQRSTUVW'.split('');

for (const letter of letters) {
  const inFile = join(srcDir, `${letter}families.htm`);
  let html;
  try {
    html = readFileSync(inFile, 'utf8');
  } catch {
    console.log(`Skipping ${letter} — file not found`);
    continue;
  }

  // Extract title
  const titleMatch = html.match(/<TITLE>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : `Vining Genealogy - "${letter}" List`;

  // Split on nav-dividers to extract sections
  const divider = '<hr class="nav-divider" />';
  const parts = html.split(divider);
  // parts[2] = intro text, parts[3] = letter nav block, parts[4+] = genealogy data
  if (parts.length < 4) {
    console.log(`Warning: unexpected structure in ${letter}families.htm`);
    continue;
  }

  // Body content = intro + letter nav + genealogy data (strip </body></html>)
  let body = parts.slice(2).join(divider);
  body = body.replace(/\s*<\/body>\s*<\/html>\s*$/i, '').trimEnd();
  // Fix malformed double-< tags (e.g. <<font)
  body = body.replace(/<<([a-zA-Z])/g, '<$1');
  // Escape bare curly braces outside of tags (Astro treats {…} as JS expressions)
  body = body.replace(/\{([^}]*)\}/g, '&#123;$1&#125;');
  // Lowercase all HTML tag names (Astro treats uppercase as components)
  body = body.replace(/<\/?([A-Z][A-Z0-9]*)([\s>\/])/g, (m, tag, rest) => `<${tag.toLowerCase()}${rest}`);

  const astro = `---
import BaseInner from '../../layouts/BaseInner.astro';
---

<BaseInner
  title="${title.replace(/"/g, '&quot;')}"
  description="Vining families with on-line scanned documentation such as birth, marriage, and death certificates; census records; and images of gravestones; plus links from one family to another so lineages can be followed."
  keywords="Vining, Vining family, genealogy"
  activePage="Online Genealogy"
>
${body}
</BaseInner>
`;

  const outFile = join(outDir, `${letter}families.astro`);
  writeFileSync(outFile, astro);
  console.log(`✓ ${letter}families.astro`);
}
