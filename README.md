# Nasl Daraxti — oila shajarasi

Oila a'zolarini, ularning o'zaro qarindoshlik bog'lanishlarini va tug'ilgan kunlarini bitta daraxtda saqlaydigan veb-ilova.

**Loyiha egasi:** Hilola O'rozaliyeva

## Imkoniyatlar

- **Oila daraxti** — ajdoddan avlodgacha, er-xotin va farzandlar bog'lanishi bilan avtomatik chiziladi.
- **Rollar** — `admin` oila a'zolarini erkin qo'shadi, tahrirlaydi, o'chiradi va foydalanuvchilarni boshqaradi; `member` faqat ko'ra oladi.
- **A'zolar ro'yxati** — qidiruv, jins va holat bo'yicha filtr.
- **Tug'ilgan kunni Google Kalendarga qo'shish** — bitta yoki ikkita odamni tanlang, kalendar tug'ilgan kunni har yili **10 yil davomida** eslatib turadi:
  - *Google Kalendar* tugmasi tayyor tadbir oynasini ochadi (har yili takrorlanadi, 10 marta);
  - `.ics` fayl ikkala odamni birdaniga qo'shadi va eslatmalarni (kundan oldin soat 09:00 hamda tug'ilgan kuni soat 09:00) o'zi o'rnatadi (Google, Apple va Outlook kalendariga import qilinadi).
  - 29-fevralda tug'ilganlar uchun kabisa bo'lmagan yillarda eslatma 28-fevralga tushadi.
- **Yaqinlashayotgan tug'ilgan kunlar** ro'yxati.
- Parolni almashtirish, foydalanuvchi boshqaruvi (admin uchun).

## Texnologiyalar

| Qism | Nima ishlatilgan |
| --- | --- |
| Backend | Node.js **22.5+**, tashqi paketlarsiz: `node:http`, `node:sqlite`, `node:crypto` (scrypt + HS256 token) |
| Ma'lumotlar bazasi | SQLite (`server/data/shajara.db`, avtomatik yaratiladi) |
| Frontend | React 19 + Vite |

Backend'da hech qanday npm paket yo'q — `npm install` faqat frontend uchun kerak.

## Ishga tushirish

Talab: Node.js **22.5 yoki yangi** (`node -v` bilan tekshiring).

```bash
# 1) Sozlamalar
cp server/.env.example server/.env
#    server/.env ichida ADMIN_EMAIL va ADMIN_PASSWORD ni belgilang

# 2) Frontend paketlari
npm run install:client

# 3) Rivojlantirish rejimi (ikkita terminalda)
npm run dev:server      # http://localhost:4000  (API)
npm run dev:client      # http://localhost:5173  (interfeys, /api ni backendga yo'naltiradi)
```

Birinchi ishga tushishda `ADMIN_EMAIL` / `ADMIN_PASSWORD` bilan **admin** yaratiladi (ismi: Hilola O'rozaliyeva). `ADMIN_PASSWORD` bo'sh bo'lsa, tasodifiy parol konsolga bir marta chiqariladi.

### Ishlab chiqarish (bitta server)

```bash
npm run install:client
npm run build           # client/dist yaratiladi
npm start               # server frontend'ni ham o'zi uzatadi: http://localhost:4000
```

Ishlab chiqarishda `server/.env` ichida kuchli `APP_SECRET` va `ADMIN_PASSWORD` bering, HTTPS ortida (masalan Nginx / Caddy) ishga tushiring.

## Testlar

```bash
npm test                # backend: 24 ta avtomatik test (API, rollar, kalendar mantig'i)
```

## Loyiha tuzilishi

```
server/
  src/
    app.js            HTTP server, router, statik fayllar
    auth.js           parol xeshlash (scrypt), token (HS256)
    calendar.js       tug'ilgan kun hisobi, Google havola, .ics
    db.js             SQLite sxemasi
    routes/           auth, users, members, calendar
  test/               node:test testlari
client/
  src/
    App.jsx           bo'limlar, modal oynalar
    components/       Tree, MemberList, MemberForm, BirthdayCalendar, AdminUsers ...
    styles.css        dizayn
```

## API qisqacha

| Metod va yo'l | Ruxsat | Vazifasi |
| --- | --- | --- |
| `POST /api/auth/login` | ochiq | Kirish, token olish |
| `GET /api/auth/me` | kirgan | Joriy foydalanuvchi |
| `GET /api/members` | kirgan | Barcha a'zolar |
| `POST /api/members` · `PUT /api/members/:id` · `DELETE /api/members/:id` | admin | A'zo qo'shish / tahrirlash / o'chirish |
| `GET /api/members/upcoming-birthdays` | kirgan | Yaqin tug'ilgan kunlar |
| `GET /api/calendar/google?ids=1,2` | kirgan | Google Kalendar havolalari (1–2 kishi) |
| `GET /api/calendar/ics?ids=1,2` | kirgan | `.ics` fayl |
| `GET/POST/PATCH/DELETE /api/users` | admin | Foydalanuvchilarni boshqarish |

## Xavfsizlik eslatmalari

- Parollar scrypt bilan xeshlanadi, kirishda urinishlar soni cheklangan.
- `server/data/` va `.env` `.gitignore` da — oila ma'lumotlari va sirlar GitHub'ga tushmaydi.
- Google Kalendar bilan integratsiya havola/`.ics` orqali ishlaydi, Google akkauntingizga kirish huquqi so'ralmaydi.

## Muallif

Hilola O'rozaliyeva
