import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';

const root = resolve('dist');
const port = Number(process.env.PORT || 4173);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url, 'http://localhost').pathname.replace(/^\/VirtualTours(?=\/|$)/, '');
    const path = resolve(root, '.' + decodeURIComponent(pathname), ...(pathname.endsWith('/') ? ['index.html'] : []));
    if (!path.startsWith(root + sep) || !(await stat(path)).isFile()) throw new Error();
    response.writeHead(200, { 'Content-Type': types[extname(path)] || 'application/octet-stream' });
    createReadStream(path).pipe(response);
  } catch {
    response.writeHead(404).end('Archivo no encontrado.');
  }
}).listen(port, '0.0.0.0', () => console.log(`VirtualTours: http://localhost:${port}/VirtualTours/`));
