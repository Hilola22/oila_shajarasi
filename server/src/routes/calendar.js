import { HttpError, Reply } from '../http.js';
import { buildBirthdayEvent, buildIcs, fullName, googleCalendarUrl, todayISO, REMINDER_YEARS } from '../calendar.js';

const MAX_PEOPLE = 2;

export function registerCalendarRoutes(router, { db, guards, now }) {
  // ?ids=3,7 — bitta yoki ikkita a'zo
  function loadEvents(ctx) {
    const raw = String(ctx.query.get('ids') || '');
    const ids = [...new Set(raw.split(',').map((s) => s.trim()).filter(Boolean))];
    if (ids.length < 1 || ids.length > MAX_PEOPLE) {
      throw new HttpError(422, `Bitta yoki ikkita odamni tanlang (ids=1,2)`);
    }
    const today = todayISO(now());
    return ids.map((rawId) => {
      if (!/^\d+$/.test(rawId)) throw new HttpError(422, "Identifikator noto'g'ri");
      const member = db.prepare('SELECT * FROM members WHERE id = ?').get(Number(rawId));
      if (!member) throw new HttpError(404, `Oila a'zosi topilmadi (id=${rawId})`);
      if (!member.birth_date) {
        throw new HttpError(422, `${fullName(member)} uchun tug'ilgan sana kiritilmagan`);
      }
      return { member, event: buildBirthdayEvent(member, today, REMINDER_YEARS) };
    });
  }

  // Google Calendar'da tayyor "yangi tadbir" oynasini ochadigan havolalar (har yili takrorlanadi, 10 yil).
  router.get('/api/calendar/google', guards.requireAuth, async (ctx) => ({
    years: REMINDER_YEARS,
    events: loadEvents(ctx).map(({ member, event }) => ({
      member_id: member.id,
      name: fullName(member),
      first_date: event.start,
      last_year: event.lastYear,
      url: googleCalendarUrl(event),
    })),
  }));

  // Google Calendar, Apple Calendar, Outlook'ga import qilish mumkin bo'lgan .ics fayl.
  router.get('/api/calendar/ics', guards.requireAuth, async (ctx) => {
    const items = loadEvents(ctx);
    const body = buildIcs(items.map((i) => i.event), now());
    return new Reply(200, body, {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="tugilgan-kunlar.ics"',
    });
  });
}
