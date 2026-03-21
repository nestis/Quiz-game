const express = require('express');
const path    = require('path');
const { initDB } = require('./db');

const app = express();
app.use(express.json({ limit: '1mb' }));

// Serve static frontend files
app.use(express.static(path.join(__dirname, '..')));

// API routes
app.use('/api/games',    require('./routes/games'));
app.use('/api/games',    require('./routes/questions'));   // /api/games/:gameId/questions
app.use('/api/sessions', require('./routes/sessions'));

// SPA fallback
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// Global error handler
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;

(async () => {
  console.log('Initialising database...');
  await initDB();

  // Auto-seed on first start (local dev)
  if (process.env.SEED_ON_START === 'true') {
    const { seedIfEmpty } = require('./seed');
    await seedIfEmpty();
  }

  app.listen(PORT, () => console.log(`QuizBlitz running → http://localhost:${PORT}`));
})();
