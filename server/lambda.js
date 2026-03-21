/**
 * AWS Lambda entry point.
 * Wraps the Express app with serverless-http so it handles
 * API Gateway HTTP API (v2 payload format) events.
 *
 * The handler is initialised once per Lambda container (warm start),
 * subsequent invocations reuse the same Express app and DB connection.
 */
const serverless    = require('serverless-http');
const { createApp } = require('./app');
const { initDB }    = require('./db');
const { seedIfEmpty } = require('./seed');

let _handler;

module.exports.handler = async (event, context) => {
  // Cold start – initialise once
  if (!_handler) {
    await initDB();
    await seedIfEmpty();        // no-op if data already exists
    _handler = serverless(createApp());
  }
  return _handler(event, context);
};
