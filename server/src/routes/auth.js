import { HttpError } from '../http.js';
import { DUMMY_HASH, hashPassword, signToken, verifyPassword, verifyToken } from '../auth.js';

export const publicUser = (u) => ({
  id: u.id,
  full_name: u.full_name,
  email: u.email,
  role: u.role,
  created_at: u.created_at,
});

export function createGuards({ db, secret }) {
  // Token orqali foydalanuvchini aniqlaydi; rol har safar bazadan olinadi (o'zgargan rol darrov kuchga kiradi).
  async function requireAuth(ctx) {
    const header = String(ctx.req.headers.authorization || '');
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    const payload = verifyToken(token, secret);
    if (!payload) throw new HttpError(401, 'Avval tizimga kiring');
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.sub);
    if (!user) throw new HttpError(401, 'Foydalanuvchi topilmadi');
    ctx.user = user;
  }

  async function requireAdmin(ctx) {
    await requireAuth(ctx);
    if (ctx.user.role !== 'admin') {
      throw new HttpError(403, "Bu amal faqat admin uchun");
    }
  }

  return { requireAuth, requireAdmin };
}

export function registerAuthRoutes(router, { db, config, secret, guards }) {
  const attempts = new Map(); // "ip|email" -> { count, resetAt }
  const MAX_ATTEMPTS = 8;
  const WINDOW_MS = 15 * 60 * 1000;

  router.get('/api/meta', async () => ({
    app_name: config.appName,
    owner_name: config.ownerName,
  }));

  router.post('/api/auth/login', async (ctx) => {
    const email = String(ctx.body.email || '').trim().toLowerCase();
    const password = String(ctx.body.password || '');
    if (!email || !password) throw new HttpError(422, 'Email va parolni kiriting');

    const key = `${ctx.req.socket.remoteAddress}|${email}`;
    const now = Date.now();
    const entry = attempts.get(key);
    if (entry && entry.resetAt > now && entry.count >= MAX_ATTEMPTS) {
      throw new HttpError(429, "Urinishlar ko'p. Birozdan so'ng qayta urinib ko'ring");
    }

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    const ok = verifyPassword(password, user ? user.password_hash : DUMMY_HASH) && Boolean(user);
    if (!ok) {
      const fresh = entry && entry.resetAt > now ? entry : { count: 0, resetAt: now + WINDOW_MS };
      fresh.count += 1;
      attempts.set(key, fresh);
      throw new HttpError(401, "Email yoki parol noto'g'ri");
    }
    attempts.delete(key);
    const token = signToken({ sub: user.id, role: user.role }, secret, config.tokenTtlHours);
    return { token, user: publicUser(user) };
  });

  router.get('/api/auth/me', guards.requireAuth, async (ctx) => ({ user: publicUser(ctx.user) }));

  router.post('/api/auth/change-password', guards.requireAuth, async (ctx) => {
    const current = String(ctx.body.current_password || '');
    const next = String(ctx.body.new_password || '');
    if (!verifyPassword(current, ctx.user.password_hash)) {
      throw new HttpError(401, "Joriy parol noto'g'ri");
    }
    if (next.length < 8) throw new HttpError(422, "Yangi parol kamida 8 belgidan iborat bo'lsin");
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(next), ctx.user.id);
    return { ok: true };
  });
}
