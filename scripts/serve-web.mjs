import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const mime = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.css': 'text/css',
  '.wasm': 'application/wasm',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};
for (const [index, app] of ['player', 'owner', 'admin'].entries()) {
  const root = resolve(`apps/${app}/build/web`);
  createServer(async (request, response) => {
    try {
      const path = resolve(
        root,
        '.' +
          decodeURIComponent(new URL(request.url, 'http://localhost').pathname),
      );
      if (path !== root && !path.startsWith(root + sep)) {
        response.writeHead(403).end();
        return;
      }
      const file = path === root ? resolve(root, 'index.html') : path;
      const data = await readFile(file);
      response
        .writeHead(200, {
          'Content-Type': mime[extname(file)] ?? 'application/octet-stream',
          'Cache-Control': 'no-store',
        })
        .end(data);
    } catch {
      response.writeHead(404).end();
    }
  }).listen(5173 + index, '127.0.0.1');
}
console.log('Local MAYDON web apps listening on ports 5173–5175.');
