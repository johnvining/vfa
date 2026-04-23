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
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);?/g, (_, n) => String.fromCodePoint(parseInt(n, 10)))
    .replace(/&mdash;/g, '—')
    .replace(/&ldquo;/g, '"')
    .replace(/&rdquo;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

const letter = process.argv[2] || 'C';
const text1 = extractText(readFileSync(`/Users/johnvining/Documents/GitHub/vfa/Viningfamilies/${letter}families.htm`, 'utf8'));
const text2 = extractText(readFileSync(`/Users/johnvining/Documents/GitHub/vfa/astro-src/dist/Viningfamilies/${letter}families.htm`, 'utf8'));

const changes = diffWords(text1, text2);
for (let i = 0; i < changes.length; i++) {
  const part = changes[i];
  if (part.added || part.removed) {
    const before = changes.slice(Math.max(0,i-2), i).map(p=>p.value).join('');
    const after = changes.slice(i+1, i+3).map(p=>p.value).join('');
    console.log('BEFORE:', JSON.stringify(before.slice(-150)));
    console.log((part.added ? '+ ' : '- ') + JSON.stringify(part.value));
    console.log('AFTER:', JSON.stringify(after.slice(0,150)));
    console.log('---');
  }
}
