import { readdirSync, renameSync } from 'fs';
import { join } from 'path';

function renameHtml(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      renameHtml(full);
    } else if (entry.name.endsWith('.html')) {
      renameSync(full, full.slice(0, -5) + '.htm');
    }
  }
}

renameHtml('./dist');
console.log('Renamed .html → .htm in dist/');
