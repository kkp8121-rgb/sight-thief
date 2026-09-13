const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8' };
function createServer() {
  return http.createServer((req, res) => {
    let relative;
    try { relative = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/^\/sight-thief(?=\/|$)/, '').replace(/^\/+/, ''); }
    catch { res.writeHead(400).end('Bad request'); return; }
    if (!relative || relative.endsWith('/')) relative += 'index.html';
    const target = path.resolve(root, relative);
    if (!target.startsWith(root + path.sep) || !fs.existsSync(target) || !fs.statSync(target).isFile()) {
      res.writeHead(404).end('Not found'); return;
    }
    res.writeHead(200, { 'Content-Type': mime[path.extname(target)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    fs.createReadStream(target).pipe(res);
  });
}
module.exports = { createServer };
if (require.main === module) createServer().listen(Number(process.env.PORT) || 4178, '127.0.0.1', () => console.log('SIGHT THIEF local server: http://127.0.0.1:4178/sight-thief/'));
