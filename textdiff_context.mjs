import { readFileSync } from 'fs';
import { diffWords } from 'diff';

function extractText(html) {
  return html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);?/g, (_, n) => String.fromCodePoint(parseInt(n, 10)))
    .replace(/\s+/g, ' ')
    .trim();
}

const t1 = extractText(readFileSync('../Viningfamilies/Cfamilies.htm', 'utf8'));
const t2 = extractText(readFileSync('dist/Viningfamilies/Cfamilies.htm', 'utf8'));

const changes = diffWords(t1, t2);
let lastContext = '';
for (const part of changes) {
  if (part.added || part.removed) {
    const prefix = part.added ? '+ ' : '- ';
    const val = part.value.trim();
    console.log(prefix + val + '  [ctx: ...' + lastContext.slice(-80) + '...]');
  } else {
    lastContext = part.value.trim();
  }
}
