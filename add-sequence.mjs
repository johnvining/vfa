// One-time script to add sequence numbers to YAML files based on original HTML order.
// Usage: node add-sequence.mjs B
// Reads ../Viningfamilies/Bfamilies.htm, extracts <a name="..."> anchors in order,
// then adds or updates `sequence: N` in each corresponding YAML.

import fs from 'fs';
import path from 'path';

const letter = process.argv[2];
if (!letter) { console.error('Usage: node add-sequence.mjs <LETTER>'); process.exit(1); }

const htmlFile = path.resolve(`../Viningfamilies/${letter}families.htm`);
const yamlDir = path.resolve(`src/content/genealogy/${letter.toLowerCase()}`);

const html = fs.readFileSync(htmlFile, 'utf8');

// Extract all <a name="ID"> anchors (quoted or unquoted)
const anchors = [];
const re = /<a\s+name=["']?([A-Za-z0-9_]+)["']?\s*>/gi;
let m;
while ((m = re.exec(html)) !== null) {
  anchors.push(m[1]);
}

console.log(`Found ${anchors.length} anchors in ${htmlFile}`);

let updated = 0;
for (let i = 0; i < anchors.length; i++) {
  const id = anchors[i];
  const yamlFile = path.join(yamlDir, `${id}.yaml`);
  if (!fs.existsSync(yamlFile)) {
    console.log(`  SKIP ${id} — no YAML file`);
    continue;
  }
  let content = fs.readFileSync(yamlFile, 'utf8');
  const seq = i + 1;
  if (/^sequence:/m.test(content)) {
    // Update existing sequence
    content = content.replace(/^sequence:\s*\d+/m, `sequence: ${seq}`);
  } else {
    // Insert after the `letter:` line
    content = content.replace(/^(letter:.+)$/m, `$1\nsequence: ${seq}`);
  }
  fs.writeFileSync(yamlFile, content);
  updated++;
}

console.log(`Updated ${updated} YAML files with sequence numbers.`);
