const { DynamoDBClient, CreateTableCommand, ListTablesCommand } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand,
        ScanCommand, DeleteCommand, UpdateCommand, BatchWriteCommand } = require('@aws-sdk/lib-dynamodb');

// ── Client setup ─────────────────────────────────────────────────────────────
const clientOpts = { region: process.env.AWS_REGION || 'us-east-1' };
if (process.env.DYNAMODB_ENDPOINT) {
  clientOpts.endpoint = process.env.DYNAMODB_ENDPOINT;
  clientOpts.credentials = { accessKeyId: 'local', secretAccessKey: 'local' };
}
const raw = new DynamoDBClient(clientOpts);
const db  = DynamoDBDocumentClient.from(raw, {
  marshallOptions: { removeUndefinedValues: true }
});

// ── Table names (overridable via env for CDK) ────────────────────────────────
const T = {
  GAMES:     process.env.GAMES_TABLE     || 'QuizBlitz_Games',
  QUESTIONS: process.env.QUESTIONS_TABLE || 'QuizBlitz_Questions',
  SESSIONS:  process.env.SESSIONS_TABLE  || 'QuizBlitz_Sessions',
  PLAYERS:   process.env.PLAYERS_TABLE   || 'QuizBlitz_Players',
};

// ── Create tables for local DynamoDB ─────────────────────────────────────────
async function initDB() {
  if (!process.env.DYNAMODB_ENDPOINT) return; // production tables created by CDK

  const { TableNames } = await raw.send(new ListTablesCommand({}));
  const existing = TableNames || [];

  const defs = [
    {
      TableName: T.GAMES,
      KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
      AttributeDefinitions: [{ AttributeName: 'id', AttributeType: 'S' }],
    },
    {
      TableName: T.QUESTIONS,
      KeySchema: [
        { AttributeName: 'gameId', KeyType: 'HASH' },
        { AttributeName: 'id',     KeyType: 'RANGE' },
      ],
      AttributeDefinitions: [
        { AttributeName: 'gameId', AttributeType: 'S' },
        { AttributeName: 'id',     AttributeType: 'S' },
      ],
    },
    {
      TableName: T.SESSIONS,
      KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
      AttributeDefinitions: [
        { AttributeName: 'id',     AttributeType: 'S' },
        { AttributeName: 'pin',    AttributeType: 'S' },
        { AttributeName: 'gameId', AttributeType: 'S' },
      ],
      GlobalSecondaryIndexes: [
        {
          IndexName: 'pin-index',
          KeySchema: [{ AttributeName: 'pin', KeyType: 'HASH' }],
          Projection: { ProjectionType: 'ALL' },
        },
        {
          IndexName: 'gameId-index',
          KeySchema: [{ AttributeName: 'gameId', KeyType: 'HASH' }],
          Projection: { ProjectionType: 'ALL' },
        },
      ],
    },
    {
      TableName: T.PLAYERS,
      KeySchema: [
        { AttributeName: 'sessionId', KeyType: 'HASH' },
        { AttributeName: 'id',        KeyType: 'RANGE' },
      ],
      AttributeDefinitions: [
        { AttributeName: 'sessionId', AttributeType: 'S' },
        { AttributeName: 'id',        AttributeType: 'S' },
      ],
    },
  ];

  for (const def of defs) {
    if (existing.includes(def.TableName)) continue;
    await raw.send(new CreateTableCommand({ ...def, BillingMode: 'PAY_PER_REQUEST' }));
    console.log(`  Created table: ${def.TableName}`);
  }
}

module.exports = { db, raw, T, initDB,
  PutCommand, GetCommand, QueryCommand, ScanCommand,
  DeleteCommand, UpdateCommand, BatchWriteCommand };
