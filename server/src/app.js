import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { loadConfig } from './config.js';
import { openDb, getSetting, setSetting } from './db.js';
import { hashPassword } from './auth.js';
import { HttpError, Reply, createRouter, readJson, sendJson } from './http.js';
import { createGuards, registerAuthRoutes } from './routes/auth.js';
import { registerUserRoutes } from './routes/users.js';
import { registerMemberRoutes } from './routes/members.js';
import { registerCalendarRoutes } from './routes/calendar.js';

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
  '.txt': 'text/plain; charset=utf-8',
};

const CSP = [
  "default-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: https:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
].join('; ');

function securityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
}

function resolveSecret(db, config) {
  if (config.secret) return config.secret;
  let stored = getSetting(db, 'token_secret');
  if (!stored) {
    stored = crypto.randomBytes(48).toString('hex');
    setSetting(db, 'token_secret', stored);
  }
  return stored;
}

// Birinchi ishga tushganda admin yaratiladi (loyiha egasi: Hilola O'rozaliyeva).
function seedAdmin(db, config) {
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM users').get();
  if (n > 0) return null;
  const generated = !config.adminPassword;
  const password = config.adminPassword || crypto.randomBytes(9).toString('base64url');
  db.prepare("INSERT INTO users (full_name, email, password_hash, role) VALUES (?, ?, ?, 'admin')").run(
    config.adminName,
    config.adminEmail,
    hashPassword(password),
  );
  return { email: config.adminEmail, password: generated ? password : null };
}

function serveStatic(config, req, res, url) {
  const root = path.resolve(config.clientDist);
  const indexFile = path.join(root, 'index.html');
  if (!fs.existsSync(indexFile)) {
    sendJson(res, url.pathname === '/' ? 200 : 404, {
      message: url.pathname === '/'
        ? "API ishlayapti. Frontend hali build qilinmagan (client papkasida 'npm run build')."
        : 'Topilmadi',
    });
    return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    sendJson(res, 405, { error: 'Metod ruxsat etilmagan' });
    return;
  }
  let rel;
  try {
    rel = decodeURIComponent(url.pathname);
  } catch {
    sendJson(res, 400, { error: "Manzil noto'g'ri" });
    return;
  }
  let file = path.normalize(path.join(root, rel));
  if (file !== root && !file.startsWith(root + path.sep)) {
    sendJson(res, 403, { error: 'Taqiqlangan' });
    return;
  }
  const isFile = fs.existsSync(file) && fs.statSync(file).isFile();
  if (!isFile) {
    // Fayl kengaytmasi bor, ammo topilmadi -> 404; aks holda React yo'nalishi -> index.html
    if (path.extname(rel)) {
      sendJson(res, 404, { error: 'Topilmadi' });
      return;
    }
    file = indexFile;
  }
  const ext = path.extname(file).toLowerCase();
  const headers = { 'Content-Type': MIME[ext] || 'application/octet-stream' };
  if (ext === '.html') {
    headers['Content-Security-Policy'] = CSP;
    headers['Cache-Control'] = 'no-cache';
  } else if (rel.startsWith('/assets/')) {
    headers['Cache-Control'] = 'public, max-age=31536000, immutable';
  }
  res.writeHead(200, headers);
  if (req.method === 'HEAD') res.end();
  else fs.createReadStream(file).pipe(res);
}

export function createApp(overrides = {}, options = {}) {
  const now = options.now || (() => new Date());
  const config = loadConfig(overrides);
  const db = openDb(config.dbPath);
  const secret = resolveSecret(db, config);
  const seeded = seedAdmin(db, config);

  const router = createRouter();
  const guards = createGuards({ db, secret });
  const deps = { db, config, secret, guards, now };
  registerAuthRoutes(router, deps);
  registerUserRoutes(router, deps);
  // Muhim: calendar va members ichidagi aniq yo'llar ":id" dan oldin turadi.
  registerMemberRoutes(router, deps);
  registerCalendarRoutes(router, deps);

  async function handleApi(req, res, url) {
    try {
      const { route, params, pathMatched } = router.find(req.method, url.pathname);
      if (!route) throw new HttpError(pathMatched ? 405 : 404, pathMatched ? 'Metod ruxsat etilmagan' : 'Topilmadi');
      const ctx = { req, res, url, params, query: url.searchParams, body: {}, user: null };
      if (['POST', 'PUT', 'PATCH'].includes(req.method)) ctx.body = await readJson(req);
      let result;
      for (const handler of route.handlers) result = await handler(ctx);
      if (result instanceof Reply) {
        if (typeof result.body === 'string') {
          res.writeHead(result.status, {
            'Content-Length': Buffer.byteLength(result.body),
            ...result.headers,
          });
          res.end(result.body);
        } else {
          sendJson(res, result.status, result.body, result.headers);
        }
      } else {
        sendJson(res, 200, result ?? { ok: true });
      }
    } catch (err) {
      if (err instanceof HttpError) {
        sendJson(res, err.status, { error: err.message, ...(err.details ? { details: err.details } : {}) });
      } else {
        console.error(err);
        sendJson(res, 500, { error: 'Serverda xatolik yuz berdi' });
      }
    }
  }

  const server = http.createServer((req, res) => {
    securityHeaders(res);
    const url = new URL(req.url, 'http://localhost');
    if (config.corsOrigin) {
      res.setHeader('Access-Control-Allow-Origin', config.corsOrigin);
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }
    }
    if (url.pathname.startsWith('/api/')) {
      handleApi(req, res, url);
    } else {
      serveStatic(config, req, res, url);
    }
  });

  return {
    server,
    db,
    config,
    seeded,
    close: () =>
      new Promise((resolve) => {
        server.close(() => {
          db.close();
          resolve();
        });
        server.closeAllConnections?.();
      }),
  };
}
