import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';

const rootArg = process.argv.find((arg, index) => process.argv[index - 1] === '--root') || 'dist';
const portArg = process.argv.find((arg, index) => process.argv[index - 1] === '--port') || '4173';
const root = resolve(rootArg);
const port = Number(portArg);
const mime = new Map([
  ['.css', 'text/css; charset=utf-8'], ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'], ['.mjs', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'], ['.webmanifest', 'application/manifest+json; charset=utf-8'],
  ['.svg', 'image/svg+xml'], ['.png', 'image/png'], ['.webp', 'image/webp'],
  ['.woff2', 'font/woff2'], ['.ttf', 'font/ttf'], ['.pbf', 'application/x-protobuf'],
]);

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url || '/', 'http://127.0.0.1');
    let pathname;
    try { pathname = decodeURIComponent(url.pathname); }
    catch { response.writeHead(400).end('Bad request'); return; }
    const target = resolve(root, `.${pathname}`);
    if (target !== root && !target.startsWith(root + sep)) { response.writeHead(403).end('Forbidden'); return; }
    let file = target;
    let info;
    try { info = await stat(file); }
    catch {
      if (pathname === '/') { file = resolve(root, 'index.html'); info = await stat(file); }
      else { response.writeHead(404).end('Not found'); return; }
    }
    if (info.isDirectory()) { file = resolve(file, 'index.html'); info = await stat(file); }
    const headers = {
      'content-type': mime.get(extname(file)) || 'application/octet-stream',
      'content-length': info.size,
      'cache-control': file.endsWith('/sw.js') ? 'no-cache' : 'no-store',
      'x-content-type-options': 'nosniff',
    };
    response.writeHead(200, headers);
    if (request.method === 'HEAD') response.end();
    else createReadStream(file).pipe(response);
  } catch {
    if (!response.headersSent) response.writeHead(500);
    response.end('Server error');
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Serving ${root} at http://127.0.0.1:${port}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
