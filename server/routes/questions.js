const router = require('express').Router();
const { v4: uuid } = require('uuid');
const { db, T, PutCommand, GetCommand, QueryCommand, DeleteCommand, UpdateCommand } = require('../db');

// Helper: update question count on the parent game
async function refreshCount(gameId) {
  const { Count } = await db.send(new QueryCommand({
    TableName: T.QUESTIONS,
    KeyConditionExpression: 'gameId = :gid',
    ExpressionAttributeValues: { ':gid': gameId },
    Select: 'COUNT',
  }));
  await db.send(new UpdateCommand({
    TableName: T.GAMES,
    Key: { id: gameId },
    UpdateExpression: 'SET questionCount = :c, updatedAt = :u',
    ExpressionAttributeValues: { ':c': Count, ':u': new Date().toISOString() },
  }));
}

// List questions for a game
router.get('/:gameId/questions', async (req, res, next) => {
  try {
    const { Items } = await db.send(new QueryCommand({
      TableName: T.QUESTIONS,
      KeyConditionExpression: 'gameId = :gid',
      ExpressionAttributeValues: { ':gid': req.params.gameId },
    }));
    res.json(Items || []);
  } catch (e) { next(e); }
});

// Add a question
router.post('/:gameId/questions', async (req, res, next) => {
  try {
    const gameId = req.params.gameId;
    const { type, category, emoji, question, answers, correct, time } = req.body;

    if (!question || !answers || correct === undefined) {
      return res.status(400).json({ error: 'question, answers, and correct are required' });
    }

    const item = {
      id: uuid(),
      gameId,
      type:     type || 'quiz',
      category: category || 'General',
      emoji:    emoji || '❓',
      question,
      answers,
      correct:  Number(correct),
      time:     Number(time) || 20,
    };
    await db.send(new PutCommand({ TableName: T.QUESTIONS, Item: item }));
    await refreshCount(gameId);
    res.status(201).json(item);
  } catch (e) { next(e); }
});

// Bulk-add questions (used by seed)
router.post('/:gameId/questions/bulk', async (req, res, next) => {
  try {
    const gameId = req.params.gameId;
    const questions = req.body.questions || [];
    const created = [];

    for (const q of questions) {
      const item = {
        id: uuid(),
        gameId,
        type:     q.type || 'quiz',
        category: q.category || 'General',
        emoji:    q.emoji || '❓',
        question: q.question,
        answers:  q.answers,
        correct:  Number(q.correct),
        time:     Number(q.time) || 20,
      };
      await db.send(new PutCommand({ TableName: T.QUESTIONS, Item: item }));
      created.push(item);
    }

    await refreshCount(gameId);
    res.status(201).json(created);
  } catch (e) { next(e); }
});

// Update a question
router.put('/:gameId/questions/:id', async (req, res, next) => {
  try {
    const { type, category, emoji, question, answers, correct, time } = req.body;
    const updates = [];
    const values  = {};
    const names   = {};

    if (type !== undefined)     { updates.push('#tp = :tp');  names['#tp'] = 'type';     values[':tp'] = type; }
    if (category !== undefined) { updates.push('category = :cat'); values[':cat'] = category; }
    if (emoji !== undefined)    { updates.push('emoji = :em');     values[':em']  = emoji; }
    if (question !== undefined) { updates.push('question = :q');   values[':q']   = question; }
    if (answers !== undefined)  { updates.push('answers = :a');    values[':a']   = answers; }
    if (correct !== undefined)  { updates.push('correct = :c');    values[':c']   = Number(correct); }
    if (time !== undefined)     { updates.push('#tm = :tm');  names['#tm'] = 'time';     values[':tm'] = Number(time); }

    if (!updates.length) return res.status(400).json({ error: 'Nothing to update' });

    const { Attributes } = await db.send(new UpdateCommand({
      TableName: T.QUESTIONS,
      Key: { gameId: req.params.gameId, id: req.params.id },
      UpdateExpression: 'SET ' + updates.join(', '),
      ExpressionAttributeNames: Object.keys(names).length ? names : undefined,
      ExpressionAttributeValues: values,
      ReturnValues: 'ALL_NEW',
    }));
    res.json(Attributes);
  } catch (e) { next(e); }
});

// Delete a question
router.delete('/:gameId/questions/:id', async (req, res, next) => {
  try {
    await db.send(new DeleteCommand({
      TableName: T.QUESTIONS,
      Key: { gameId: req.params.gameId, id: req.params.id },
    }));
    await refreshCount(req.params.gameId);
    res.json({ deleted: true });
  } catch (e) { next(e); }
});

module.exports = router;
