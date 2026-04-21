import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const srcDir = '/Users/johnvining/Documents/GitHub/vfa/Viningmigration';
const outDir = '/Users/johnvining/Documents/GitHub/vfa/astro-src/src/pages/Viningmigration';
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

const years = ['1660', '1670', '1680', '1690', '1700', '1790', '1800', '1810', '1820', '1830', '1840'];

for (const year of years) {
  const inFile = join(srcDir, `Viningmigration${year}.htm`);
  let html;
  try {
    html = readFileSync(inFile, 'utf8');
  } catch {
    console.log(`Skipping ${year} — file not found`);
    continue;
  }

  const titleMatch = html.match(/<TITLE>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : `Vining Family Migration ${year}`;

  const descMatch = html.match(/<META[^>]+NAME="[Dd]escription"[^>]+CONTENT="([^"]+)"/i);
  const description = descMatch ? descMatch[1] : 'Vining family migration patterns.';

  const kwMatch = html.match(/<META[^>]+NAME="keywords"[^>]+CONTENT="([^"]+)"/i);
  const keywords = kwMatch ? kwMatch[1] : `genealogy, ${year}, Vining, Vining family`;

  // Strip HTML comments (contains the old commented-out header)
  let content = html.replace(/<!--[\s\S]*?-->/g, '');

  // Strip the nav <P ALIGN="CENTER">...</P> block
  content = content.replace(/<P[^>]*ALIGN="CENTER"[^>]*>[\s\S]*?<\/P>/i, '');

  // Strip <html><head>...</head><body ...> preamble
  content = content.replace(/^[\s\S]*?<body[^>]*>/i, '');

  let body = content.replace(/\s*<\/body>\s*<\/html>\s*$/i, '').trimEnd();
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
  activePage="Vining Migration"
>
${body}
</BaseInner>
`;

  const outFile = join(outDir, `Viningmigration${year}.astro`);
  writeFileSync(outFile, astro);
  console.log(`✓ Viningmigration${year}.astro`);
}
