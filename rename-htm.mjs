import { readdirSync, renameSync, readFileSync, writeFileSync } from 'fs';
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

function patchSitemaps(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      patchSitemaps(full);
    } else if (entry.name.endsWith('.xml')) {
      const original = readFileSync(full, 'utf8');
      // Add .htm to any <loc> URL that has a path but no file extension.
      // Skips: root URL, .xml references (sitemap index), already-.htm URLs.
      const patched = original.replace(
        /(<loc>https:\/\/vining-family\.org\/)((?:[^<](?!\.[a-z]{2,4}<))*[^<])(<\/loc>)/g,
        (_, prefix, path, suffix) => {
          if (path.match(/\.[a-z]{2,4}$/)) return prefix + path + suffix;
          return prefix + path + '.htm' + suffix;
        }
      );
      if (patched !== original) {
        writeFileSync(full, patched);
        const count = (patched.match(/\.htm<\/loc>/g) || []).length;
        console.log(`Patched ${count} URLs → .htm in ${entry.name}`);
      }
    }
  }
}

renameHtml('./dist');
console.log('Renamed .html → .htm in dist/');

patchSitemaps('./dist');
