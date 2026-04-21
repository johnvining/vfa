import { readFileSync } from 'fs';
import { diffWords } from 'diff';

function extractText(html) {
  return html
    .replace(/<!--[\s\S]*?-->/g, '')        // strip comments
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')               // strip tags
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);?/g, (_, n) => String.fromCodePoint(parseInt(n, 10)))
    .replace(/&mdash;/g, '—')
    .replace(/&ldquo;/g, '"')
    .replace(/&rdquo;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

const [,, file1, file2] = process.argv;
if (!file1 || !file2) {
  console.error('Usage: node textdiff.mjs <original.htm> <built.htm>');
  process.exit(1);
}

const text1 = extractText(readFileSync(file1, 'utf8'));
const text2 = extractText(readFileSync(file2, 'utf8'));

if (text1 === text2) {
  console.log('✓ Text content identical');
  process.exit(0);
}

const changes = diffWords(text1, text2);
let hasDiff = false;
for (const part of changes) {
  if (part.added || part.removed) {
    hasDiff = true;
    const prefix = part.added ? '+ ' : '- ';
    console.log(prefix + part.value.trim());
  }
}
if (!hasDiff) {
  console.log('✓ Text content identical (whitespace differences only)');
}
