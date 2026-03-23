const router = require('express').Router();
const { v4: uuid } = require('uuid');
const { db, T, PutCommand, GetCommand, ScanCommand, DeleteCommand, UpdateCommand, QueryCommand } = require('../db');
const { requireAdmin } = require('../middleware/auth');

// List all games
router.get('/', async (_req, res, next) => {
  try {
    const { Items } = await db.send(new ScanCommand({ TableName: T.GAMES }));
    const games = (Items || []).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    res.json(games);
  } catch (e) { next(e); }
});

// Get single game
router.get('/:id', async (req, res, next) => {
  try {
    const { Item } = await db.send(new GetCommand({
      TableName: T.GAMES, Key: { id: req.params.id }
    }));
    if (!Item) return res.status(404).json({ error: 'Game not found' });
    res.json(Item);
  } catch (e) { next(e); }
});

// Create game
router.post('/', requireAdmin, async (req, res, next) => {
  try {
    const { name, description } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });

    const game = {
      id: uuid(),
      name: name.trim(),
      description: (description || '').trim(),
      questionCount: 0,
      timesPlayed: 0,
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await db.send(new PutCommand({ TableName: T.GAMES, Item: game }));
    res.status(201).json(game);
  } catch (e) { next(e); }
});

// Update game
router.put('/:id', requireAdmin, async (req, res, next) => {
  try {
    const { name, description, status } = req.body;
    const updates = [];
    const names  = {};
    const values = {};

    if (name !== undefined)        { updates.push('#n = :n');  names['#n']  = 'name';        values[':n']  = name.trim(); }
    if (description !== undefined) { updates.push('#d = :d');  names['#d']  = 'description'; values[':d']  = (description || '').trim(); }
    if (status !== undefined)      { updates.push('#s = :s');  names['#s']  = 'status';      values[':s']  = status; }
    updates.push('updatedAt = :u'); values[':u'] = new Date().toISOString();

    const { Attributes } = await db.send(new UpdateCommand({
      TableName: T.GAMES,
      Key: { id: req.params.id },
      UpdateExpression: 'SET ' + updates.join(', '),
      ExpressionAttributeNames: Object.keys(names).length ? names : undefined,
      ExpressionAttributeValues: values,
      ReturnValues: 'ALL_NEW',
    }));
    res.json(Attributes);
  } catch (e) { next(e); }
});

// Delete game (also deletes its questions)
router.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    const gameId = req.params.id;
    // Delete all questions for this game
    const { Items } = await db.send(new QueryCommand({
      TableName: T.QUESTIONS,
      KeyConditionExpression: 'gameId = :gid',
      ExpressionAttributeValues: { ':gid': gameId },
    }));
    for (const q of (Items || [])) {
      await db.send(new DeleteCommand({ TableName: T.QUESTIONS, Key: { gameId, id: q.id } }));
    }
    await db.send(new DeleteCommand({ TableName: T.GAMES, Key: { id: gameId } }));
    res.json({ deleted: true });
  } catch (e) { next(e); }
});

module.exports = router;
