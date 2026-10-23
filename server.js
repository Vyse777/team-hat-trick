import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT, 10) || 3000;
const HOST = process.env.HOST || 'localhost';

const MIME_TYPES = {
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
  '.ico': 'image/x-icon',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json'
};

const server = http.createServer((req, res) => {
  // Only allow GET and HEAD requests
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Allow', 'GET, HEAD');
    res.end('405 Method Not Allowed');
    return;
  }

  // Parse requested URL pathname
  let reqPath;
  try {
    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    reqPath = decodeURIComponent(parsedUrl.pathname);
  } catch {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('400 Bad Request');
    return;
  }

  // Prevent directory traversal
  const normalizedPath = path.normalize(reqPath).replace(/^(\.\.[\/\\])+/, '');
  let resolvedPath = path.resolve(__dirname, '.' + normalizedPath);

  // Security check: ensure the resolved path is within __dirname
  if (!resolvedPath.startsWith(__dirname)) {
    res.statusCode = 403;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('403 Forbidden');
    return;
  }

  fs.stat(resolvedPath, (err, stats) => {
    if (err) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end('404 Not Found');
      return;
    }

    if (stats.isDirectory()) {
      resolvedPath = path.join(resolvedPath, 'index.html');
    }

    fs.stat(resolvedPath, (fileErr, fileStats) => {
      if (fileErr || !fileStats.isFile()) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.end('404 Not Found');
        return;
      }

      const ext = path.extname(resolvedPath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';

      res.statusCode = 200;
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Length', fileStats.size);
      // Disable caching for local development convenience
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

      if (req.method === 'HEAD') {
        res.end();
        return;
      }

      const stream = fs.createReadStream(resolvedPath);
      stream.on('error', () => {
        if (!res.headersSent) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'text/plain; charset=utf-8');
          res.end('500 Internal Server Error');
        }
      });
      stream.pipe(res);
    });
  });
});

server.listen(PORT, HOST, () => {
  console.log(`🏒 Team Hat Trick server running at http://${HOST}:${PORT}/`);
  console.log(`Serving files from: ${__dirname}`);
  console.log(`Press Ctrl+C to stop.`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  server.close(() => {
    process.exit(0);
  });
});
process.on('SIGTERM', () => {
  server.close(() => {
    process.exit(0);
  });
});
