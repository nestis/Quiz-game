const router = require('express').Router();
const { v4: uuid } = require('uuid');
const { db, T, PutCommand, GetCommand, QueryCommand, ScanCommand, UpdateCommand } = require('../db');
const { requireAdmin } = require('../middleware/auth');

// Generate a 6-digit PIN not already in use
async function generatePin() {
  for (let attempt = 0; attempt < 10; attempt++) {
    const pin = String(Math.floor(100000 + Math.random() * 900000));
    const { Items } = await db.send(new QueryCommand({
      TableName: T.SESSIONS,
      IndexName: 'pin-index',
      KeyConditionExpression: 'pin = :p',
      ExpressionAttributeValues: { ':p': pin },
    }));
    if (!Items || Items.length === 0) return pin;
  }
  return String(Math.floor(100000 + Math.random() * 900000));
}

// Create a session (start a game)
router.post('/', requireAdmin, async (req, res, next) => {
  try {
    const { gameId } = req.body;
    if (!gameId) return res.status(400).json({ error: 'gameId is required' });

    // Verify game exists
    const { Item: game } = await db.send(new GetCommand({ TableName: T.GAMES, Key: { id: gameId } }));
    if (!game) return res.status(404).json({ error: 'Game not found' });

    const pin = await generatePin();
    const session = {
      id: uuid(),
      gameId,
      gameName: game.name,
      pin,
      status: 'lobby',
      createdAt: new Date().toISOString(),
    };
    await db.send(new PutCommand({ TableName: T.SESSIONS, Item: session }));

    // Increment timesPlayed on the game
    await db.send(new UpdateCommand({
      TableName: T.GAMES,
      Key: { id: gameId },
      UpdateExpression: 'SET timesPlayed = if_not_exists(timesPlayed, :zero) + :one',
      ExpressionAttributeValues: { ':zero': 0, ':one': 1 },
    }));

    res.status(201).json(session);
  } catch (e) { next(e); }
});

// Get session by ID
router.get('/:id', async (req, res, next) => {
  try {
    const { Item } = await db.send(new GetCommand({ TableName: T.SESSIONS, Key: { id: req.params.id } }));
    if (!Item) return res.status(404).json({ error: 'Session not found' });
    res.json(Item);
  } catch (e) { next(e); }
});

// List sessions for a game
router.get('/game/:gameId', async (req, res, next) => {
  try {
    const { Items } = await db.send(new QueryCommand({
      TableName: T.SESSIONS,
      IndexName: 'gameId-index',
      KeyConditionExpression: 'gameId = :gid',
      ExpressionAttributeValues: { ':gid': req.params.gameId },
    }));
    const sessions = (Items || []).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    res.json(sessions);
  } catch (e) { next(e); }
});

// List all sessions (recent)
router.get('/', async (_req, res, next) => {
  try {
    const { Items } = await db.send(new ScanCommand({ TableName: T.SESSIONS }));
    const sessions = (Items || []).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    res.json(sessions);
  } catch (e) { next(e); }
});

// Add player to session
router.post('/:id/players', async (req, res, next) => {
  try {
    const { name, emoji, isAI, skill } = req.body;
    const player = {
      id: uuid(),
      sessionId: req.params.id,
      name: name || 'Player',
      emoji: emoji || '😊',
      isAI: !!isAI,
      skill: skill || 0,
      score: 0,
      streak: 0,
      finalRank: null,
    };
    await db.send(new PutCommand({ TableName: T.PLAYERS, Item: player }));
    res.status(201).json(player);
  } catch (e) { next(e); }
});

// Get players for a session
router.get('/:id/players', async (req, res, next) => {
  try {
    const { Items } = await db.send(new QueryCommand({
      TableName: T.PLAYERS,
      KeyConditionExpression: 'sessionId = :sid',
      ExpressionAttributeValues: { ':sid': req.params.id },
    }));
    res.json(Items || []);
  } catch (e) { next(e); }
});

// Finish session – save final standings
router.post('/:id/finish', async (req, res, next) => {
  try {
    const { players } = req.body; // array of { id, name, emoji, isAI, score, streak, finalRank }
    if (!players || !players.length) return res.status(400).json({ error: 'players required' });

    const sorted = [...players].sort((a, b) => b.score - a.score);
    const winner = sorted[0];

    // Update session
    await db.send(new UpdateCommand({
      TableName: T.SESSIONS,
      Key: { id: req.params.id },
      UpdateExpression: 'SET #st = :s, finishedAt = :f, winnerName = :wn, winnerScore = :ws, playerCount = :pc',
      ExpressionAttributeNames: { '#st': 'status' },
      ExpressionAttributeValues: {
        ':s':  'finished',
        ':f':  new Date().toISOString(),
        ':wn': winner.name,
        ':ws': winner.score,
        ':pc': players.length,
      },
    }));

    // Upsert each player with final data
    for (const [idx, p] of sorted.entries()) {
      await db.send(new PutCommand({
        TableName: T.PLAYERS,
        Item: {
          id:        p.id || uuid(),
          sessionId: req.params.id,
          name:      p.name,
          emoji:     p.emoji,
          isAI:      !!p.isAI,
          score:     p.score,
          streak:    p.streak || 0,
          finalRank: idx + 1,
        },
      }));
    }

    res.json({ status: 'finished', winner: winner.name, winnerScore: winner.score });
  } catch (e) { next(e); }
});

module.exports = router;
