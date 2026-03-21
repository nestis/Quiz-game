const { createApp } = require('./app');
const { initDB }    = require('./db');

const PORT = process.env.PORT || 3000;

(async () => {
  console.log('Initialising database...');
  await initDB();

  if (process.env.SEED_ON_START === 'true') {
    const { seedIfEmpty } = require('./seed');
    await seedIfEmpty();
  }

  createApp().listen(PORT, () =>
    console.log(`QuizBlitz running → http://localhost:${PORT}`)
  );
})();
