import { readFile, writeFile } from 'node:fs/promises';
import { importTour } from '../src/tour.js';

const [key, file] = process.argv.slice(2);
if (!key || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(key) || !file) {
  throw new Error('Uso: npm run catalogo -- clave-del-recorrido ruta/al/archivo.virtualtours.json');
}
const tour = JSON.parse(await readFile(file, 'utf8'));
const validated = importTour(tour, { preserveSpaceIds: true });
if (!validated.spaces.length) throw new Error('El recorrido público necesita al menos un espacio.');

const entries = JSON.parse(await readFile('catalog.json', 'utf8'));
const index = entries.findIndex(entry => entry.key === key);
const entry = { key, tour: { ...tour, published: true } };
if (index < 0) entries.push(entry);
else entries[index] = entry;
await writeFile('catalog.json', JSON.stringify(entries, null, 2) + '\n');
console.log(`Ruta pública después del despliegue: #publico/${key}`);
