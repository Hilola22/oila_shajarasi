import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const SERVER_ROOT = path.resolve(here, '..');

// Kichik .env o'quvchi (dotenv kerak emas). Haqiqiy muhit o'zgaruvchilari ustun turadi.
function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i < 1) continue;
    const key = line.slice(0, i).trim();
    let val = line.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

loadEnvFile(path.join(SERVER_ROOT, '.env'));

export function loadConfig(overrides = {}) {
  const env = { ...process.env, ...overrides };
  const ownerName = env.OWNER_NAME || "Hilola O'rozaliyeva";
  return {
    port: Number(env.PORT) || 4000,
    dbPath: env.DB_PATH || path.join(SERVER_ROOT, 'data', 'shajara.db'),
    secret: env.APP_SECRET || '',
    appName: env.APP_NAME || 'Nasl Daraxti',
    ownerName,
    adminName: env.ADMIN_NAME || ownerName,
    adminEmail: String(env.ADMIN_EMAIL || 'admin@example.com').trim().toLowerCase(),
    adminPassword: env.ADMIN_PASSWORD || '',
    clientDist: env.CLIENT_DIST || path.resolve(SERVER_ROOT, '..', 'client', 'dist'),
    corsOrigin: env.CORS_ORIGIN || '',
    tokenTtlHours: Number(env.TOKEN_TTL_HOURS) || 12,
  };
}
