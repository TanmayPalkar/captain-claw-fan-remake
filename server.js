import http from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)));
const PORT = Number(process.env.PORT) || 5173;
const HOST = process.env.HOST || '127.0.0.1';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.txt': 'text/plain; charset=utf-8',
};

function send(res, status, message) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(message);
}

const server = http.createServer((req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, `http://${req.headers.host || HOST}`).pathname);
  } catch {
    send(res, 400, 'Bad request');
    return;
  }

  if (pathname === '/') pathname = '/index.html';

  // Resolve inside ROOT only, so ../ can never escape the project folder.
  const target = normalize(join(ROOT, pathname));
  if (target !== ROOT && !target.startsWith(ROOT + sep)) {
    send(res, 403, 'Forbidden');
    return;
  }

  let stats;
  try {
    stats = statSync(target);
  } catch {
    send(res, 404, 'Not found');
    return;
  }

  if (stats.isDirectory()) {
    const indexPath = join(target, 'index.html');
    try {
      stats = statSync(indexPath);
      serveFile(indexPath, stats, res);
    } catch {
      send(res, 404, 'Not found');
    }
    return;
  }

  serveFile(target, stats, res);
});

function serveFile(filePath, stats, res) {
  const type = MIME[extname(filePath).toLowerCase()] || 'application/octet-stream';
  res.writeHead(200, {
    'Content-Type': type,
    'Content-Length': stats.size,
    'Cache-Control': 'no-cache',
  });
  const stream = createReadStream(filePath);
  stream.on('error', () => {
    if (!res.headersSent) send(res, 500, 'Read error');
    else res.end();
  });
  stream.pipe(res);
}

server.listen(PORT, HOST, () => {
  console.log('');
  console.log('  ⚓  Captain Claw — The Curse of Pirate Isle');
  console.log(`  ▶  http://${HOST}:${PORT}`);
  console.log('');
  console.log('  Press Ctrl+C to stop the server.');
});
