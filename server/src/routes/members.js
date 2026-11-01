import { HttpError, created, noContent } from '../http.js';
import { tx } from '../db.js';
import { daysUntil, nextBirthday, parseISODate, todayISO } from '../calendar.js';

const GENDERS = ['erkak', 'ayol'];

const LABELS = {
  first_name: 'Ism',
  last_name: 'Familiya',
  middle_name: "Otasining ismi",
  birth_place: "Tug'ilgan joy",
  phone: 'Telefon',
  occupation: 'Kasbi',
  bio: "Qisqacha ma'lumot",
  photo_url: 'Rasm havolasi',
  birth_date: "Tug'ilgan sana",
  death_date: 'Vafot sanasi',
};

const TEXT_LIMITS = {
  first_name: 60,
  last_name: 60,
  middle_name: 60,
  birth_place: 120,
  phone: 30,
  occupation: 120,
  bio: 2000,
  photo_url: 500,
};

const COLUMNS = [
  'first_name',
  'last_name',
  'middle_name',
  'gender',
  'birth_date',
  'death_date',
  'birth_place',
  'phone',
  'occupation',
  'bio',
  'photo_url',
  'father_id',
  'mother_id',
];

function cleanText(value, field, max) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') throw new HttpError(422, `${LABELS[field]} matn bo'lishi kerak`);
  const text = value.trim();
  if (!text) return null;
  if (text.length > max) throw new HttpError(422, `${LABELS[field]} ${max} belgidan oshmasligi kerak`);
  return text;
}

function cleanId(value, label) {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
  if (!Number.isInteger(n) || n < 1) throw new HttpError(422, `${label} noto'g'ri`);
  return n;
}

// Faqat yuborilgan maydonlarni tekshiradi va tozalaydi.
export function parseMemberInput(body) {
  const patch = {};

  for (const [field, max] of Object.entries(TEXT_LIMITS)) {
    if (field in body) patch[field] = cleanText(body[field], field, max);
  }
  if (patch.photo_url && !/^https?:\/\/\S+$/i.test(patch.photo_url)) {
    throw new HttpError(422, "Rasm havolasi http:// yoki https:// bilan boshlanishi kerak");
  }
  if (patch.phone && !/^\+?[\d\s()-]{5,}$/.test(patch.phone)) {
    throw new HttpError(422, "Telefon raqami noto'g'ri");
  }

  if ('gender' in body) {
    if (!GENDERS.includes(body.gender)) throw new HttpError(422, "Jins 'erkak' yoki 'ayol' bo'lishi kerak");
    patch.gender = body.gender;
  }

  for (const field of ['birth_date', 'death_date']) {
    if (!(field in body)) continue;
    const value = cleanText(body[field], field, 10);
    if (value) {
      const parsed = parseISODate(value);
      if (!parsed || parsed.y < 1000) {
        throw new HttpError(422, `${LABELS[field]} YYYY-OO-KK ko'rinishida bo'lishi kerak`);
      }
    }
    patch[field] = value;
  }

  if ('father_id' in body) patch.father_id = cleanId(body.father_id, 'Ota');
  if ('mother_id' in body) patch.mother_id = cleanId(body.mother_id, 'Ona');
  if ('spouse_id' in body) patch.spouse_id = cleanId(body.spouse_id, 'Turmush o\'rtog\'i');

  return patch;
}

function descendantsOf(db, id) {
  const rows = db.prepare('SELECT id, father_id, mother_id FROM members').all();
  const children = new Map();
  for (const r of rows) {
    for (const parent of [r.father_id, r.mother_id]) {
      if (!parent) continue;
      if (!children.has(parent)) children.set(parent, []);
      children.get(parent).push(r.id);
    }
  }
  const result = new Set();
  const stack = [...(children.get(id) || [])];
  while (stack.length) {
    const current = stack.pop();
    if (result.has(current)) continue;
    result.add(current);
    stack.push(...(children.get(current) || []));
  }
  return result;
}

function validateMerged(db, id, m, today) {
  if (!m.first_name) throw new HttpError(422, 'Ismni kiriting');
  if (!GENDERS.includes(m.gender)) throw new HttpError(422, 'Jinsni tanlang');
  if (m.birth_date && m.birth_date > today) {
    throw new HttpError(422, "Tug'ilgan sana kelajakda bo'la olmaydi");
  }
  if (m.birth_date && m.death_date && m.death_date < m.birth_date) {
    throw new HttpError(422, "Vafot sanasi tug'ilgan sanadan oldin bo'la olmaydi");
  }

  const lookup = db.prepare('SELECT id, gender FROM members WHERE id = ?');

  if (m.father_id != null) {
    if (m.father_id === id) throw new HttpError(422, "Inson o'zining otasi bo'la olmaydi");
    const father = lookup.get(m.father_id);
    if (!father) throw new HttpError(422, 'Tanlangan ota topilmadi');
    if (father.gender !== 'erkak') throw new HttpError(422, "Ota 'erkak' bo'lishi kerak");
  }
  if (m.mother_id != null) {
    if (m.mother_id === id) throw new HttpError(422, "Inson o'zining onasi bo'la olmaydi");
    const mother = lookup.get(m.mother_id);
    if (!mother) throw new HttpError(422, 'Tanlangan ona topilmadi');
    if (mother.gender !== 'ayol') throw new HttpError(422, "Ona 'ayol' bo'lishi kerak");
  }
  if (m.spouse_id != null) {
    if (m.spouse_id === id) throw new HttpError(422, "O'zini turmush o'rtog'i qilib bo'lmaydi");
    if (!lookup.get(m.spouse_id)) throw new HttpError(422, "Turmush o'rtog'i topilmadi");
  }

  if (id != null) {
    const descendants = descendantsOf(db, id);
    for (const parent of [m.father_id, m.mother_id]) {
      if (parent != null && descendants.has(parent)) {
        throw new HttpError(422, "Avlodni ota-ona qilib bo'lmaydi (aylana bog'lanish)");
      }
    }
  }
}

// Turmush o'rtog'i bog'lanishi ikki tomonlama saqlanadi.
function linkSpouse(db, id, spouseId) {
  const current = db.prepare('SELECT spouse_id FROM members WHERE id = ?').get(id);
  if (current.spouse_id && current.spouse_id !== spouseId) {
    db.prepare('UPDATE members SET spouse_id = NULL WHERE id = ?').run(current.spouse_id);
  }
  if (spouseId) {
    const other = db.prepare('SELECT spouse_id FROM members WHERE id = ?').get(spouseId);
    if (other.spouse_id && other.spouse_id !== id) {
      db.prepare('UPDATE members SET spouse_id = NULL WHERE id = ?').run(other.spouse_id);
    }
    db.prepare('UPDATE members SET spouse_id = ? WHERE id = ?').run(spouseId, id);
    db.prepare('UPDATE members SET spouse_id = ? WHERE id = ?').run(id, spouseId);
  } else {
    db.prepare('UPDATE members SET spouse_id = NULL WHERE id = ?').run(id);
  }
}

export function registerMemberRoutes(router, { db, guards, now }) {
  const getMember = (id) => db.prepare('SELECT * FROM members WHERE id = ?').get(id);

  const loadOr404 = (rawId) => {
    const id = Number(rawId);
    const member = Number.isInteger(id) ? getMember(id) : null;
    if (!member) throw new HttpError(404, "Oila a'zosi topilmadi");
    return member;
  };

  router.get('/api/members', guards.requireAuth, async () => ({
    members: db.prepare('SELECT * FROM members ORDER BY id').all(),
  }));

  // ":id" dan oldin ro'yxatdan o'tishi shart.
  router.get('/api/members/upcoming-birthdays', guards.requireAuth, async (ctx) => {
    const limit = Math.min(Math.max(parseInt(ctx.query.get('limit'), 10) || 5, 1), 50);
    const today = todayISO(now());
    const upcoming = db
      .prepare('SELECT * FROM members WHERE birth_date IS NOT NULL AND death_date IS NULL')
      .all()
      .map((m) => {
        const next = nextBirthday(m.birth_date, today);
        return {
          id: m.id,
          first_name: m.first_name,
          last_name: m.last_name,
          birth_date: m.birth_date,
          next_birthday: next,
          days_left: daysUntil(next, today),
          turning: parseISODate(next).y - parseISODate(m.birth_date).y,
        };
      })
      .sort((a, b) => a.days_left - b.days_left)
      .slice(0, limit);
    return { upcoming };
  });

  router.get('/api/members/:id', guards.requireAuth, async (ctx) => ({
    member: loadOr404(ctx.params.id),
  }));

  router.post('/api/members', guards.requireAdmin, async (ctx) => {
    const patch = parseMemberInput(ctx.body);
    const merged = {
      first_name: null,
      last_name: null,
      middle_name: null,
      gender: null,
      birth_date: null,
      death_date: null,
      birth_place: null,
      phone: null,
      occupation: null,
      bio: null,
      photo_url: null,
      father_id: null,
      mother_id: null,
      spouse_id: null,
      ...patch,
    };
    validateMerged(db, null, merged, todayISO(now()));

    const id = tx(db, () => {
      const placeholders = COLUMNS.map(() => '?').join(', ');
      const { lastInsertRowid } = db
        .prepare(`INSERT INTO members (${COLUMNS.join(', ')}, created_by) VALUES (${placeholders}, ?)`)
        .run(...COLUMNS.map((c) => merged[c] ?? null), ctx.user.id);
      const newId = Number(lastInsertRowid);
      if (merged.spouse_id) linkSpouse(db, newId, merged.spouse_id);
      return newId;
    });
    return created({ member: getMember(id) });
  });

  router.put('/api/members/:id', guards.requireAdmin, async (ctx) => {
    const existing = loadOr404(ctx.params.id);
    const patch = parseMemberInput(ctx.body);
    const merged = { ...existing, ...patch };
    validateMerged(db, existing.id, merged, todayISO(now()));

    tx(db, () => {
      const assignments = COLUMNS.map((c) => `${c} = ?`).join(', ');
      db.prepare(`UPDATE members SET ${assignments}, updated_at = datetime('now') WHERE id = ?`).run(
        ...COLUMNS.map((c) => merged[c] ?? null),
        existing.id,
      );
      if ('spouse_id' in patch) linkSpouse(db, existing.id, merged.spouse_id ?? null);
    });
    return { member: getMember(existing.id) };
  });

  router.delete('/api/members/:id', guards.requireAdmin, async (ctx) => {
    const member = loadOr404(ctx.params.id);
    // Bog'langan ota-ona / turmush o'rtog'i havolalari ON DELETE SET NULL bilan tozalanadi.
    db.prepare('DELETE FROM members WHERE id = ?').run(member.id);
    return noContent();
  });
}
