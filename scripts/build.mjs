import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

await rm('dist', { recursive: true, force: true });
await mkdir('dist/vendor', { recursive: true });
for (const path of ['index.html', 'manifest.webmanifest', 'catalog.json', 'assets', 'src']) {
  await cp(path, join('dist', path), { recursive: true });
}
for (const path of ['pannellum.js', 'pannellum.css']) {
  await cp(join('node_modules/pannellum/build', path), join('dist/vendor', path));
}
await cp('node_modules/pannellum/COPYING', 'dist/vendor/LICENSE.txt');

const files = (await readdir('dist', { recursive: true, withFileTypes: true }))
  .filter(entry => entry.isFile())
  .map(entry => join(entry.parentPath, entry.name).slice(5))
  .sort();
const digest = createHash('sha256');
for (const path of files) digest.update(await readFile(join('dist', path)));
const worker = await readFile('sw.js', 'utf8');
digest.update(worker);
await writeFile('dist/sw.js', worker
  .replace('__CACHE_VERSION__', digest.digest('hex').slice(0, 16))
  .replace('__PRECACHE__', JSON.stringify(files.map(path => './' + path))));
