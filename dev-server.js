// Dev server with COOP/COEP headers, required so the page is cross-origin
// isolated and SharedArrayBuffer is available. WASM transport needs that.
//
// Run:   node dev-server.js
// Then:  http://localhost:8080/

const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT = parseInt(process.env.PORT || '8080', 10);
const ROOT = path.resolve(process.cwd());

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js':   'application/javascript; charset=utf-8',
    '.mjs':  'application/javascript; charset=utf-8',
    '.css':  'text/css; charset=utf-8',
    '.wasm': 'application/wasm',
    '.json': 'application/json; charset=utf-8',
    '.png':  'image/png',
    '.jpg':  'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg':  'image/svg+xml',
    '.ico':  'image/x-icon',
    '.txt':  'text/plain; charset=utf-8',
    '.map':  'application/json',
};

function safeJoin(root, urlPath) {
    const decoded = decodeURIComponent(urlPath);
    const target  = path.normalize(path.join(root, decoded));
    if (target !== root && !target.startsWith(root + path.sep)) return null;
    return target;
}

const server = http.createServer((req, res) => {
    let url = req.url.split('?')[0].split('#')[0];
    if (url.endsWith('/')) url += 'index.html';

    const target = safeJoin(ROOT, url);
    if (!target) { res.writeHead(403); return res.end('Forbidden'); }

    fs.stat(target, (err, stat) => {
        if (err || !stat.isFile()) { res.writeHead(404); return res.end('Not found: ' + url); }
        const ext = path.extname(target).toLowerCase();
        res.writeHead(200, {
            'Content-Type':                 MIME[ext] || 'application/octet-stream',
            'Cross-Origin-Opener-Policy':   'same-origin',
            'Cross-Origin-Embedder-Policy': 'require-corp',
            'Cross-Origin-Resource-Policy': 'same-origin',
            'Cache-Control':                'no-cache, no-store, must-revalidate',
        });
        fs.createReadStream(target).pipe(res);
    });
});

server.listen(PORT, () => {
    console.log(`Serving ${ROOT}`);
    console.log(`  http://localhost:${PORT}/`);
    console.log(`  COOP/COEP enabled (SharedArrayBuffer available)`);
});
