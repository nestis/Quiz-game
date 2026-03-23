const http = require('http');
const { createApp }      = require('./app');
const { initDB }         = require('./db');
const { attachSocketIO } = require('./socket');

const PORT = process.env.PORT || 3000;

(async () => {
  // Start listening immediately so AppRunner health checks pass right away
  const app    = createApp();
  const server = http.createServer(app);
  attachSocketIO(server);

  await new Promise(resolve => server.listen(PORT, resolve));
  console.log(`QuizBlitz running → http://localhost:${PORT}`);

  // DB init and seeding run in the background – failures are logged but
  // never kill the already-running server
  (async () => {
    console.log('Initialising database…');
    await initDB();

    if (process.env.SEED_ON_START === 'true') {
      const { seedIfEmpty, seedAdmin } = require('./seed');
      await seedIfEmpty();
      await seedAdmin();
    }
    console.log('Database ready.');
  })().catch(err => console.error('DB init error (non-fatal):', err));
})().catch(err => { console.error('Fatal startup error:', err); process.exit(1); });
