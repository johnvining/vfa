import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const srcDir = '/Users/johnvining/Documents/GitHub/vfa/Viningcensus';
const outDir = '/Users/johnvining/Documents/GitHub/vfa/astro-src/src/pages/Viningcensus';
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

const years = ['1790', '1800', '1810', '1820', '1830', '1840'];

for (const year of years) {
  const inFile = join(srcDir, `Viningcensus${year}.htm`);
  let html;
  try {
    html = readFileSync(inFile, 'utf8');
  } catch {
    console.log(`Skipping ${year} — file not found`);
    continue;
  }

  const titleMatch = html.match(/<TITLE>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : `${year} Census Data for Vining Families`;

  const descMatch = html.match(/<META[^>]+NAME="description"[^>]+CONTENT="([^"]+)"/i);
  const description = descMatch ? descMatch[1] : `${year} Census data for Vining families`;

  const kwMatch = html.match(/<META[^>]+NAME="keywords"[^>]+CONTENT="([^"]+)"/i);
  const keywords = kwMatch ? kwMatch[1] : 'census, Vining, Vining family, genealogy';

  const divider = '<hr class="nav-divider" />';
  const parts = html.split(divider);
  if (parts.length < 3) {
    console.log(`Warning: unexpected structure in Viningcensus${year}.htm`);
    continue;
  }

  let body = parts.slice(2).join(divider);
  body = body.replace(/\s*<\/body>\s*<\/html>\s*$/i, '').trimEnd();
  body = body.replace(/<<([a-zA-Z])/g, '<$1');
  body = body.replace(/\{([^}]*)\}/g, '&#123;$1&#125;');
  body = body.replace(/<\/?([A-Z][A-Z0-9]*)([\s>\/])/g, (m, tag, rest) => `<${tag.toLowerCase()}${rest}`);

  const astro = `---
import BaseInner from '../../layouts/BaseInner.astro';
---

<BaseInner
  title="${title.replace(/"/g, '&quot;')}"
  description="${description.replace(/"/g, '&quot;')}"
  keywords="${keywords.replace(/"/g, '&quot;')}"
  activePage="Census Records"
>
${body}
</BaseInner>
`;

  const outFile = join(outDir, `Viningcensus${year}.astro`);
  writeFileSync(outFile, astro);
  console.log(`✓ Viningcensus${year}.astro`);
}
