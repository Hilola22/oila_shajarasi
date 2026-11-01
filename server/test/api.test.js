import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';

let app;
let base;
let adminToken;
let memberToken;

const FIXED_NOW = new Date(2026, 10, 1, 12, 0, 0); // 2026-11-01

async function api(method, url, { token, body, raw } = {}) {
  const res = await fetch(base + url, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (raw) return res;
  const text = await res.text();
  return { status: res.status, data: text ? JSON.parse(text) : null };
}

before(async () => {
  app = createApp(
    {
      DB_PATH: ':memory:',
      APP_SECRET: 'test-secret',
      ADMIN_EMAIL: 'admin@test.uz',
      ADMIN_PASSWORD: 'Parol12345',
      CLIENT_DIST: '/yo-q-papka',
    },
    { now: () => FIXED_NOW },
  );
  await new Promise((resolve) => app.server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${app.server.address().port}`;
});

after(async () => {
  await app.close();
});

test('meta ochiq va loyiha egasini qaytaradi', async () => {
  const { status, data } = await api('GET', '/api/meta');
  assert.equal(status, 200);
  assert.equal(data.owner_name, "Hilola O'rozaliyeva");
});

test('login: noto\'g\'ri parol 401, to\'g\'ri parol token beradi', async () => {
  const bad = await api('POST', '/api/auth/login', { body: { email: 'admin@test.uz', password: 'xato' } });
  assert.equal(bad.status, 401);

  const ok = await api('POST', '/api/auth/login', { body: { email: 'ADMIN@test.uz', password: 'Parol12345' } });
  assert.equal(ok.status, 200);
  assert.equal(ok.data.user.role, 'admin');
  assert.equal(ok.data.user.full_name, "Hilola O'rozaliyeva");
  assert.ok(!('password_hash' in ok.data.user));
  adminToken = ok.data.token;
});

test('tokensiz so\'rov 401', async () => {
  assert.equal((await api('GET', '/api/members')).status, 401);
  assert.equal((await api('GET', '/api/members', { token: 'soxta.token.qiymati' })).status, 401);
});

test('admin oddiy foydalanuvchi yaratadi; u faqat o\'qiy oladi', async () => {
  const made = await api('POST', '/api/users', {
    token: adminToken,
    body: { full_name: 'Mehmon', email: 'mehmon@test.uz', password: 'Mehmon1234', role: 'member' },
  });
  assert.equal(made.status, 201);

  const login = await api('POST', '/api/auth/login', { body: { email: 'mehmon@test.uz', password: 'Mehmon1234' } });
  memberToken = login.data.token;

  assert.equal((await api('GET', '/api/members', { token: memberToken })).status, 200);
  const denied = await api('POST', '/api/members', {
    token: memberToken,
    body: { first_name: 'X', gender: 'erkak' },
  });
  assert.equal(denied.status, 403);
  assert.equal((await api('GET', '/api/users', { token: memberToken })).status, 403);
});

let aziz;
let malika;
let dilshod;

test('oila a\'zolarini qo\'shish va turmush o\'rtog\'ini ikki tomonlama bog\'lash', async () => {
  const a = await api('POST', '/api/members', {
    token: adminToken,
    body: { first_name: 'Aziz', last_name: 'Karimov', gender: 'erkak', birth_date: '1955-03-12' },
  });
  assert.equal(a.status, 201);
  aziz = a.data.member;

  const m = await api('POST', '/api/members', {
    token: adminToken,
    body: { first_name: 'Malika', last_name: 'Karimova', gender: 'ayol', birth_date: '1958-07-30', spouse_id: aziz.id },
  });
  assert.equal(m.status, 201);
  malika = m.data.member;
  assert.equal(malika.spouse_id, aziz.id);

  const refreshed = await api('GET', `/api/members/${aziz.id}`, { token: adminToken });
  assert.equal(refreshed.data.member.spouse_id, malika.id);

  const d = await api('POST', '/api/members', {
    token: adminToken,
    body: {
      first_name: 'Dilshod', last_name: 'Karimov', gender: 'erkak', birth_date: '1984-02-29',
      father_id: aziz.id, mother_id: malika.id,
    },
  });
  assert.equal(d.status, 201);
  dilshod = d.data.member;
  assert.equal(dilshod.father_id, aziz.id);
});

test('tekshiruvlar: jins, aylana bog\'lanish, sana, majburiy maydonlar', async () => {
  const wrongFather = await api('POST', '/api/members', {
    token: adminToken,
    body: { first_name: 'Test', gender: 'erkak', father_id: malika.id },
  });
  assert.equal(wrongFather.status, 422);

  const cycle = await api('PUT', `/api/members/${aziz.id}`, { token: adminToken, body: { father_id: dilshod.id } });
  assert.equal(cycle.status, 422);

  const future = await api('POST', '/api/members', {
    token: adminToken,
    body: { first_name: 'Kelajak', gender: 'erkak', birth_date: '2030-01-01' },
  });
  assert.equal(future.status, 422);

  const badDate = await api('POST', '/api/members', {
    token: adminToken,
    body: { first_name: 'Xato', gender: 'erkak', birth_date: '2001-02-30' },
  });
  assert.equal(badDate.status, 422);

  const noName = await api('POST', '/api/members', { token: adminToken, body: { gender: 'ayol' } });
  assert.equal(noName.status, 422);

  const order = await api('POST', '/api/members', {
    token: adminToken,
    body: { first_name: 'Teskari', gender: 'ayol', birth_date: '2000-01-02', death_date: '1999-01-01' },
  });
  assert.equal(order.status, 422);

  assert.equal((await api('GET', '/api/members/9999', { token: adminToken })).status, 404);
});

test('tahrirlash: faqat yuborilgan maydonlar o\'zgaradi', async () => {
  const res = await api('PUT', `/api/members/${dilshod.id}`, {
    token: adminToken,
    body: { occupation: 'Muhandis', phone: '+998 90 123 45 67' },
  });
  assert.equal(res.status, 200);
  assert.equal(res.data.member.occupation, 'Muhandis');
  assert.equal(res.data.member.first_name, 'Dilshod');
  assert.equal(res.data.member.father_id, aziz.id);
});

test('yaqin tug\'ilgan kunlar tartiblangan (bugun 2026-11-01)', async () => {
  const { data } = await api('GET', '/api/members/upcoming-birthdays?limit=3', { token: memberToken });
  const dates = data.upcoming.map((u) => u.next_birthday);
  assert.deepEqual(dates, [...dates].sort());
  assert.equal(data.upcoming[0].first_name, 'Dilshod'); // 2027-02-28
  assert.equal(data.upcoming[0].turning, 43);
});

test('Google Calendar havolasi: 10 yillik yillik takrorlanish', async () => {
  const { status, data } = await api('GET', `/api/calendar/google?ids=${aziz.id},${malika.id}`, { token: memberToken });
  assert.equal(status, 200);
  assert.equal(data.years, 10);
  assert.equal(data.events.length, 2);
  const url = new URL(data.events[0].url);
  assert.equal(url.searchParams.get('dates'), '20270312/20270313');
  assert.equal(url.searchParams.get('recur'), 'RRULE:FREQ=YEARLY;COUNT=10');
  assert.equal(data.events[0].last_year, 2036);

  const leap = await api('GET', `/api/calendar/google?ids=${dilshod.id}`, { token: adminToken });
  const leapUrl = new URL(leap.data.events[0].url);
  assert.equal(leapUrl.searchParams.get('dates'), '20270228/20270301');
  assert.match(leapUrl.searchParams.get('recur'), /BYMONTHDAY=-1/);
});

test('ICS fayl yuklab olish', async () => {
  const res = await api('GET', `/api/calendar/ics?ids=${aziz.id},${dilshod.id}`, { token: adminToken, raw: true });
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/calendar/);
  assert.match(res.headers.get('content-disposition'), /tugilgan-kunlar\.ics/);
  const text = await res.text();
  assert.equal((text.match(/BEGIN:VEVENT/g) || []).length, 2);
  assert.match(text, /RRULE:FREQ=YEARLY;COUNT=10/);
});

test('kalendar: 0 yoki 3 kishi, sanasiz a\'zo, mavjud bo\'lmagan a\'zo rad etiladi', async () => {
  assert.equal((await api('GET', '/api/calendar/google', { token: adminToken })).status, 422);
  assert.equal((await api('GET', '/api/calendar/google?ids=1,2,3', { token: adminToken })).status, 422);
  assert.equal((await api('GET', '/api/calendar/google?ids=abc', { token: adminToken })).status, 422);
  assert.equal((await api('GET', '/api/calendar/google?ids=9999', { token: adminToken })).status, 404);
  const nodate = await api('POST', '/api/members', {
    token: adminToken,
    body: { first_name: 'Sanasiz', gender: 'ayol' },
  });
  const res = await api('GET', `/api/calendar/ics?ids=${nodate.data.member.id}`, { token: adminToken });
  assert.equal(res.status, 422);
});

test("a'zoni o'chirganda bog'lanishlar tozalanadi", async () => {
  assert.equal((await api('DELETE', `/api/members/${aziz.id}`, { token: adminToken })).status, 204);
  const child = await api('GET', `/api/members/${dilshod.id}`, { token: adminToken });
  assert.equal(child.data.member.father_id, null);
  assert.equal(child.data.member.mother_id, malika.id);
  const wife = await api('GET', `/api/members/${malika.id}`, { token: adminToken });
  assert.equal(wife.data.member.spouse_id, null);
});

test('oxirgi adminni o\'chirib yoki pasaytirib bo\'lmaydi', async () => {
  const me = await api('GET', '/api/auth/me', { token: adminToken });
  const id = me.data.user.id;
  assert.equal((await api('DELETE', `/api/users/${id}`, { token: adminToken })).status, 409);
  const demote = await api('PATCH', `/api/users/${id}`, { token: adminToken, body: { role: 'member' } });
  assert.equal(demote.status, 409);
});

test('parolni almashtirish', async () => {
  const wrong = await api('POST', '/api/auth/change-password', {
    token: memberToken,
    body: { current_password: 'noto\'g\'ri', new_password: 'YangiParol123' },
  });
  assert.equal(wrong.status, 401);
  const ok = await api('POST', '/api/auth/change-password', {
    token: memberToken,
    body: { current_password: 'Mehmon1234', new_password: 'YangiParol123' },
  });
  assert.equal(ok.status, 200);
  const relogin = await api('POST', '/api/auth/login', { body: { email: 'mehmon@test.uz', password: 'YangiParol123' } });
  assert.equal(relogin.status, 200);
});

test('API: mavjud bo\'lmagan yo\'l 404, noto\'g\'ri JSON 400', async () => {
  assert.equal((await api('GET', '/api/yoq', { token: adminToken })).status, 404);
  const res = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{buzuq',
  });
  assert.equal(res.status, 400);
});
