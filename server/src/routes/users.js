import { HttpError, created, noContent } from '../http.js';
import { hashPassword } from '../auth.js';
import { publicUser } from './auth.js';

const ROLES = ['admin', 'member'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function adminCount(db) {
  return db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'").get().n;
}

export function registerUserRoutes(router, { db, guards }) {
  router.get('/api/users', guards.requireAdmin, async () => ({
    users: db.prepare('SELECT * FROM users ORDER BY id').all().map(publicUser),
  }));

  router.post('/api/users', guards.requireAdmin, async (ctx) => {
    const full_name = String(ctx.body.full_name || '').trim();
    const email = String(ctx.body.email || '').trim().toLowerCase();
    const password = String(ctx.body.password || '');
    const role = ctx.body.role ?? 'member';
    if (!full_name) throw new HttpError(422, 'Ism-familiyani kiriting');
    if (!EMAIL_RE.test(email)) throw new HttpError(422, "Email noto'g'ri");
    if (password.length < 8) throw new HttpError(422, "Parol kamida 8 belgidan iborat bo'lsin");
    if (!ROLES.includes(role)) throw new HttpError(422, "Rol 'admin' yoki 'member' bo'lishi kerak");
    if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) {
      throw new HttpError(409, "Bu email bilan foydalanuvchi allaqachon bor");
    }
    const { lastInsertRowid } = db
      .prepare('INSERT INTO users (full_name, email, password_hash, role) VALUES (?, ?, ?, ?)')
      .run(full_name, email, hashPassword(password), role);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(lastInsertRowid));
    return created({ user: publicUser(user) });
  });

  router.patch('/api/users/:id', guards.requireAdmin, async (ctx) => {
    const id = Number(ctx.params.id);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!user) throw new HttpError(404, 'Foydalanuvchi topilmadi');

    const next = { full_name: user.full_name, role: user.role, password_hash: user.password_hash };
    if ('full_name' in ctx.body) {
      const v = String(ctx.body.full_name || '').trim();
      if (!v) throw new HttpError(422, 'Ism-familiya bo\'sh bo\'lmasin');
      next.full_name = v;
    }
    if ('role' in ctx.body) {
      if (!ROLES.includes(ctx.body.role)) throw new HttpError(422, "Rol noto'g'ri");
      if (user.role === 'admin' && ctx.body.role !== 'admin' && adminCount(db) <= 1) {
        throw new HttpError(409, "Oxirgi adminni oddiy a'zoga o'tkazib bo'lmaydi");
      }
      next.role = ctx.body.role;
    }
    if ('password' in ctx.body) {
      const pw = String(ctx.body.password || '');
      if (pw.length < 8) throw new HttpError(422, "Parol kamida 8 belgidan iborat bo'lsin");
      next.password_hash = hashPassword(pw);
    }
    db.prepare('UPDATE users SET full_name = ?, role = ?, password_hash = ? WHERE id = ?').run(
      next.full_name,
      next.role,
      next.password_hash,
      id,
    );
    return { user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id)) };
  });

  router.delete('/api/users/:id', guards.requireAdmin, async (ctx) => {
    const id = Number(ctx.params.id);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!user) throw new HttpError(404, 'Foydalanuvchi topilmadi');
    if (id === ctx.user.id) throw new HttpError(409, "O'zingizni o'chira olmaysiz");
    if (user.role === 'admin' && adminCount(db) <= 1) {
      throw new HttpError(409, "Oxirgi adminni o'chirib bo'lmaydi");
    }
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
    return noContent();
  });
}
