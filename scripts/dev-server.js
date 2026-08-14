const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.resolve(path.join(__dirname, '..'));
const port = Number(process.env.PORT) || 3000;

function loadEnv() {
  for (const name of ['.env', '.env.local']) {
    const file = path.join(root, name);
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx === -1) continue;
      const key = trimmed.slice(0, idx).trim();
      const value = trimmed.slice(idx + 1).trim();
      if (!process.env[key]) process.env[key] = value;
    }
  }
}

loadEnv();

function loadHandler(modulePath) {
  const resolved = require.resolve(modulePath);
  delete require.cache[resolved];
  return require(resolved);
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
};

function isInsideRoot(resolved) {
  const normRoot = root.toLowerCase();
  const normResolved = path.resolve(resolved).toLowerCase();
  return normResolved === normRoot || normResolved.startsWith(normRoot + path.sep);
}

function safePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  let rel = decoded.replace(/^\/+/, '') || 'index.html';
  if (rel.endsWith('/')) rel = rel.slice(0, -1);
  const resolved = path.resolve(root, rel);
  if (!isInsideRoot(resolved)) return null;
  return resolved;
}

function resolveFile(urlPath) {
  let filePath = safePath(urlPath);
  if (!filePath) return null;
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }
  return filePath;
}

const SECURITY_HEADERS = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self' blob: https://unpkg.com https://cdn.jsdelivr.net https://maps.googleapis.com; style-src 'self' https://fonts.googleapis.com 'unsafe-inline'; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https://images.unsplash.com https://cdn.jsdelivr.net https://maps.googleapis.com https://maps.gstatic.com; connect-src 'self' https://iaqquovppuvxmhwhnxso.supabase.co https://api.resend.com https://maps.googleapis.com; frame-src 'self'; worker-src 'self' blob:; media-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self';",
  'X-Frame-Options': 'SAMEORIGIN',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin'
};

const server = http.createServer(async (req, res) => {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    res.setHeader(key, value);
  }
  const url = new URL(req.url, `http://localhost:${port}`);

  if (url.pathname === '/api/leads') {
    return loadHandler('../api/leads')(req, res);
  }

  if (url.pathname === '/api/config') {
    return loadHandler('../api/config')(req, res);
  }

  if (url.pathname === '/api/contact') {
    return loadHandler('../api/contact')(req, res);
  }

  if (url.pathname === '/api/admin/login') {
    return loadHandler('../api/admin/login')(req, res);
  }
  if (url.pathname === '/api/admin/logout') {
    return loadHandler('../api/admin/logout')(req, res);
  }
  if (url.pathname === '/api/admin/leads') {
    return loadHandler('../api/admin/leads')(req, res);
  }
  if (url.pathname === '/api/admin/lead') {
    return loadHandler('../api/admin/lead')(req, res);
  }
  if (url.pathname === '/api/admin/report') {
    return loadHandler('../api/admin/report')(req, res);
  }
  if (url.pathname === '/api/admin/mortgage-rates') {
    return loadHandler('../api/admin/mortgage-rates')(req, res);
  }
  if (url.pathname === '/api/admin/calculator-rate') {
    return loadHandler('../api/admin/calculator-rate')(req, res);
  }

  const adminPath = url.pathname.replace(/\/+$/, '') || '/';
  if (adminPath === '/admin') {
    const adminIndex = path.join(root, 'admin', 'index.html');
    if (fs.existsSync(adminIndex)) {
      res.writeHead(200, Object.assign({ 'Content-Type': MIME['.html'] }, SECURITY_HEADERS));
      fs.createReadStream(adminIndex).pipe(res);
      return;
    }
  }

  const filePath = resolveFile(url.pathname);
  if (!filePath || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    const notFoundPage = path.join(root, '404.html');
    if (fs.existsSync(notFoundPage)) {
      res.writeHead(404, Object.assign({ 'Content-Type': MIME['.html'] }, SECURITY_HEADERS));
      fs.createReadStream(notFoundPage).pipe(res);
      return;
    }
    res.writeHead(404, Object.assign({ 'Content-Type': 'text/plain; charset=utf-8' }, SECURITY_HEADERS));
    res.end('Not found');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const headers = Object.assign({ 'Content-Type': MIME[ext] || 'application/octet-stream' }, SECURITY_HEADERS);
  if (['.css', '.webp', '.png', '.jpg', '.jpeg', '.svg', '.woff2', '.ico'].includes(ext)) {
    headers['Cache-Control'] = 'public, max-age=31536000, immutable';
  } else if (ext === '.js') {
    headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
  }
  res.writeHead(200, headers);
  fs.createReadStream(filePath).pipe(res);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${port} was busy on default interface. Trying 127.0.0.1...`);
    server.listen(port, '127.0.0.1');
  } else {
    console.error('Dev server error:', err);
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Wealthify dev server running at http://localhost:${port}`);
  console.log('Open that URL in your browser — do not open HTML files directly.');
});

