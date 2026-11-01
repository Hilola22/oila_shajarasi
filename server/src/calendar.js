// Tug'ilgan kun eslatmalari: Google Calendar havolasi va .ics fayl.
// Barcha sana amallari "YYYY-MM-DD" matnlari va UTC orqali bajariladi (vaqt zonasi xatosi bo'lmasligi uchun).

export const REMINDER_YEARS = 10;

const pad = (n, width = 2) => String(n).padStart(width, '0');

export function isLeap(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function parseISODate(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > daysInMonth(y, mo)) return null;
  return { y, m: mo, d };
}

export function toISO({ y, m, d }) {
  return `${pad(y, 4)}-${pad(m)}-${pad(d)}`;
}

export function todayISO(now = new Date()) {
  return toISO({ y: now.getFullYear(), m: now.getMonth() + 1, d: now.getDate() });
}

export function addDays(iso, days) {
  const { y, m, d } = parseISODate(iso);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return toISO({ y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() });
}

export function daysUntil(targetISO, fromISO) {
  const a = parseISODate(targetISO);
  const b = parseISODate(fromISO);
  return Math.round((Date.UTC(a.y, a.m - 1, a.d) - Date.UTC(b.y, b.m - 1, b.d)) / 86_400_000);
}

// Eng yaqin tug'ilgan kun (bugun bo'lsa, bugunning o'zi). 29-fevral kabisa bo'lmagan yilda 28-fevralga tushadi.
export function nextBirthday(birthISO, todayStr) {
  const b = parseISODate(birthISO);
  const t = parseISODate(todayStr);
  if (!b || !t) return null;
  const pick = (year) => ({
    y: year,
    m: b.m,
    d: b.m === 2 && b.d === 29 && !isLeap(year) ? 28 : b.d,
  });
  let candidate = pick(t.y);
  if (toISO(candidate) < toISO(t)) candidate = pick(t.y + 1);
  return toISO(candidate);
}

export function fullName(member) {
  return [member.first_name, member.last_name].filter(Boolean).join(' ');
}

function formatDMY(iso) {
  const { y, m, d } = parseISODate(iso);
  return `${pad(d)}.${pad(m)}.${y}`;
}

export function buildBirthdayEvent(member, todayStr, years = REMINDER_YEARS) {
  const b = parseISODate(member.birth_date);
  if (!b) throw new Error("Tug'ilgan sana kiritilmagan");
  const start = nextBirthday(member.birth_date, todayStr);
  const end = addDays(start, 1);
  const lastStartYear = parseISODate(start).y + years - 1;
  // 29-fevralda tug'ilganlar uchun: kabisa yilda 29-, boshqa yillarda 28-fevral.
  const feb29 = b.m === 2 && b.d === 29;
  const rrule = feb29
    ? `FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=-1;COUNT=${years}`
    : `FREQ=YEARLY;COUNT=${years}`;
  const name = fullName(member);
  return {
    memberId: member.id,
    title: `🎂 ${name} — tug'ilgan kun`,
    description: `${name}ning tug'ilgan sanasi: ${formatDMY(member.birth_date)}. Oila shajarasidan qo'shildi.`,
    start,
    end,
    rrule,
    years,
    lastYear: lastStartYear,
  };
}

const compact = (iso) => iso.replaceAll('-', '');

export function googleCalendarUrl(event) {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${compact(event.start)}/${compact(event.end)}`,
    details: event.description,
    recur: `RRULE:${event.rrule}`,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function escapeIcsText(value) {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

// RFC 5545: satr 75 oktetdan oshmasligi kerak (UTF-8 belgilarni bo'lmasdan).
function foldLine(line) {
  const parts = [];
  let current = '';
  let bytes = 0;
  for (const ch of line) {
    const size = Buffer.byteLength(ch);
    const limit = parts.length === 0 ? 75 : 74;
    if (bytes + size > limit) {
      parts.push(current);
      current = '';
      bytes = 0;
    }
    current += ch;
    bytes += size;
  }
  parts.push(current);
  return parts.join('\r\n ');
}

function icsStamp(now) {
  return (
    `${pad(now.getUTCFullYear(), 4)}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}` +
    `T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`
  );
}

export function buildIcs(events, now = new Date()) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Nasl Daraxti//Tugilgan kunlar//UZ',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Oila tug\'ilgan kunlari',
  ];
  for (const event of events) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:birthday-${event.memberId}@nasl-daraxti`,
      `DTSTAMP:${icsStamp(now)}`,
      `DTSTART;VALUE=DATE:${compact(event.start)}`,
      `DTEND;VALUE=DATE:${compact(event.end)}`,
      `RRULE:${event.rrule}`,
      `SUMMARY:${escapeIcsText(event.title)}`,
      `DESCRIPTION:${escapeIcsText(event.description)}`,
      'TRANSP:TRANSPARENT',
      // Kundan oldingi kuni soat 09:00 va tug'ilgan kunning o'zida soat 09:00.
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapeIcsText(`Ertaga: ${event.title}`)}`,
      'TRIGGER:-PT15H',
      'END:VALARM',
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapeIcsText(`Bugun: ${event.title}`)}`,
      'TRIGGER:PT9H',
      'END:VALARM',
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return `${lines.map(foldLine).join('\r\n')}\r\n`;
}
