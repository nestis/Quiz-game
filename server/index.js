const http = require('http');
const { createApp }      = require('./app');
const { initDB }         = require('./db');
const { attachSocketIO } = require('./socket');

const PORT = process.env.PORT || 3000;

(async () => {
  console.log('Initialising database…');
  await initDB();

  if (process.env.SEED_ON_START === 'true') {
    const { seedIfEmpty } = require('./seed');
    await seedIfEmpty();
  }

  const app    = createApp();
  const server = http.createServer(app);
  attachSocketIO(server);

  server.listen(PORT, () =>
    console.log(`QuizBlitz running → http://localhost:${PORT}`)
  );
})();
