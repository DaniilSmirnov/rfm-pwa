import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const pkg = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
const lock = JSON.parse(await readFile(resolve(root, 'package-lock.json'), 'utf8'));
const meta = JSON.parse(await readFile(resolve(root, 'version.json'), 'utf8'));
if (!/^\d+\.\d+\.\d+(?:\.\d+)?$/.test(String(pkg.version || '')))
  throw new Error('Invalid package.json version');
if (lock.version !== pkg.version || lock.packages?.['']?.version !== pkg.version)
  throw new Error('package-lock.json version must match package.json');
if (!String(meta.codename || '').trim()) throw new Error('Invalid version.json codename');

const expectations = {
  'index.html': ['__APP_VERSION__', '__APP_CODENAME__'],
  'sw.js': ['__APP_VERSION_CACHE__', '__APP_CODENAME_SLUG__'],
  '_worker.js': ['__APP_VERSION__'],
};
for (const [file, tokens] of Object.entries(expectations)) {
  const text = await readFile(resolve(root, file), 'utf8');
  for (const token of tokens) {
    if (!text.includes(token))
      throw new Error(`${file} must use ${token} instead of a hard-coded release value`);
  }
}
const serviceWorker = await readFile(resolve(root, 'sw.js'), 'utf8');
if (!/\/\*__BUILD_ASSETS__\*\/\s*\[\]/.test(serviceWorker))
  throw new Error('sw.js must use the build asset placeholder instead of a hard-coded list');
console.log(`Release metadata OK: ${pkg.version} · ${meta.codename}`);
