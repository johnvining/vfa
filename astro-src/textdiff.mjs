import { readFileSync } from 'fs';
import { diffLines } from 'diff';

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
    .replace(/&mdash;|&#8212;/g, '—')
    .replace(/&ldquo;|&#8220;/g, '"')
    .replace(/&rdquo;|&#8221;/g, '"')
    .replace(/&#8230;/g, '…')
    .replace(/&#146;/g, "'")
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

const changes = diffLines(text1, text2, { ignoreWhitespace: true });
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
