const express = require('express');
const path    = require('path');

function createApp() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use(express.static(path.join(__dirname, '..')));
  app.use('/api/games',    require('./routes/games'));
  app.use('/api/games',    require('./routes/questions'));
  app.use('/api/sessions', require('./routes/sessions'));
  app.get('*', (_req, res) => res.sendFile(path.join(__dirname, '..', 'index.html')));
  app.use((err, _req, res, _next) => { console.error(err); res.status(500).json({ error: 'Internal server error' }); });
  return app;
}

module.exports = { createApp };
