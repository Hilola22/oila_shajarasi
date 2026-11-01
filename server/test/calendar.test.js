import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addDays,
  buildBirthdayEvent,
  buildIcs,
  daysUntil,
  googleCalendarUrl,
  nextBirthday,
  parseISODate,
} from '../src/calendar.js';

test('parseISODate noto\'g\'ri sanalarni rad etadi', () => {
  assert.deepEqual(parseISODate('2000-02-29'), { y: 2000, m: 2, d: 29 });
  assert.equal(parseISODate('2001-02-29'), null);
  assert.equal(parseISODate('2001-13-01'), null);
  assert.equal(parseISODate('01.02.2001'), null);
  assert.equal(parseISODate(null), null);
});

test('nextBirthday: bugun tug\'ilgan kun bo\'lsa bugunning o\'zi qaytadi', () => {
  assert.equal(nextBirthday('1990-11-01', '2026-11-01'), '2026-11-01');
});

test('nextBirthday: bu yil o\'tib ketgan bo\'lsa keyingi yil', () => {
  assert.equal(nextBirthday('1990-10-31', '2026-11-01'), '2027-10-31');
  assert.equal(nextBirthday('1990-11-02', '2026-11-01'), '2026-11-02');
});

test('nextBirthday: 29-fevral kabisa bo\'lmagan yilda 28-fevralga tushadi', () => {
  assert.equal(nextBirthday('1984-02-29', '2026-11-01'), '2027-02-28');
  assert.equal(nextBirthday('1984-02-29', '2027-03-01'), '2028-02-29');
});

test('addDays va daysUntil oy/yil chegarasida to\'g\'ri ishlaydi', () => {
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2028-02-28', 1), '2028-02-29');
  assert.equal(daysUntil('2026-11-11', '2026-11-01'), 10);
  assert.equal(daysUntil('2027-01-01', '2026-12-31'), 1);
});

test('buildBirthdayEvent: 10 yillik takrorlanish', () => {
  const ev = buildBirthdayEvent(
    { id: 5, first_name: 'Aziz', last_name: 'Karimov', birth_date: '1990-11-14' },
    '2026-11-01',
  );
  assert.equal(ev.start, '2026-11-14');
  assert.equal(ev.end, '2026-11-15');
  assert.equal(ev.rrule, 'FREQ=YEARLY;COUNT=10');
  assert.equal(ev.lastYear, 2035);
  assert.match(ev.title, /Aziz Karimov/);
});

test('buildBirthdayEvent: 29-fevral uchun oyning oxirgi kuniga bog\'langan qoida', () => {
  const ev = buildBirthdayEvent({ id: 1, first_name: 'Dilshod', birth_date: '1984-02-29' }, '2026-11-01');
  assert.equal(ev.start, '2027-02-28');
  assert.equal(ev.rrule, 'FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=-1;COUNT=10');
});

test('googleCalendarUrl kerakli parametrlarni o\'z ichiga oladi', () => {
  const ev = buildBirthdayEvent({ id: 5, first_name: 'Aziz', last_name: 'Karimov', birth_date: '1990-11-14' }, '2026-11-01');
  const url = new URL(googleCalendarUrl(ev));
  assert.equal(url.origin + url.pathname, 'https://calendar.google.com/calendar/render');
  assert.equal(url.searchParams.get('action'), 'TEMPLATE');
  assert.equal(url.searchParams.get('dates'), '20261114/20261115');
  assert.equal(url.searchParams.get('recur'), 'RRULE:FREQ=YEARLY;COUNT=10');
  assert.match(url.searchParams.get('text'), /Aziz Karimov/);
});

test('buildIcs: CRLF, 75 oktetdan oshmaydigan satrlar, ikkita VEVENT', () => {
  const events = [
    buildBirthdayEvent({ id: 1, first_name: "Muhammadjon-Abdurahmonbek", last_name: "O'rozaliyev", birth_date: '1990-11-14' }, '2026-11-01'),
    buildBirthdayEvent({ id: 2, first_name: 'Hilola', last_name: "O'rozaliyeva", birth_date: '2001-05-03' }, '2026-11-01'),
  ];
  const ics = buildIcs(events, new Date(Date.UTC(2026, 10, 1, 6, 0, 0)));
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n'));
  assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 2);
  assert.equal((ics.match(/RRULE:FREQ=YEARLY;COUNT=10/g) || []).length, 2);
  assert.equal((ics.match(/BEGIN:VALARM/g) || []).length, 4);
  assert.match(ics, /DTSTAMP:20261101T060000Z/);
  assert.match(ics, /DTSTART;VALUE=DATE:20261114/);
  assert.match(ics, /DTSTART;VALUE=DATE:20270503/);
  for (const line of ics.split('\r\n')) {
    assert.ok(Buffer.byteLength(line) <= 75, `satr juda uzun: ${line}`);
  }
  // Bukilgan satrlarni qayta yig'ganda matn buzilmasligi kerak
  const unfolded = ics.replace(/\r\n /g, '');
  assert.match(unfolded, /SUMMARY:🎂 Muhammadjon-Abdurahmonbek O'rozaliyev — tug'ilgan kun/);
});
