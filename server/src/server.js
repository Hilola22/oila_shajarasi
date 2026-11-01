import { createApp } from './app.js';

const app = createApp();

if (app.seeded) {
  console.log('────────────────────────────────────────────');
  console.log('Birinchi admin yaratildi:');
  console.log(`  Ism:    ${app.config.adminName}`);
  console.log(`  Email:  ${app.seeded.email}`);
  if (app.seeded.password) {
    console.log(`  Parol:  ${app.seeded.password}   (faqat bir marta ko'rsatiladi — saqlab qo'ying)`);
  } else {
    console.log("  Parol:  .env faylidagi ADMIN_PASSWORD");
  }
  console.log('────────────────────────────────────────────');
}

app.server.listen(app.config.port, () => {
  console.log(`${app.config.appName} serveri: http://localhost:${app.config.port}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => {
    await app.close();
    process.exit(0);
  });
}
