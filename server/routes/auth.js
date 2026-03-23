const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { v4: uuid } = require('uuid');
const { db, T, PutCommand, QueryCommand, ScanCommand, DeleteCommand, UpdateCommand } = require('../db');
const { requireAdmin, secret } = require('../middleware/auth');

// ── Login ─────────────────────────────────────────────────────────────────────
router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ error: 'Username and password are required' });

    const { Items } = await db.send(new QueryCommand({
      TableName: T.USERS,
      IndexName: 'username-index',
      KeyConditionExpression: 'username = :u',
      ExpressionAttributeValues: { ':u': username.toLowerCase().trim() },
    }));

    const user = Items?.[0];
    if (!user || !(await bcrypt.compare(password, user.passwordHash)))
      return res.status(401).json({ error: 'Invalid username or password' });

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      secret(),
      { expiresIn: '7d' }
    );
    res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
  } catch (e) { next(e); }
});

// ── Current user ──────────────────────────────────────────────────────────────
router.get('/me', requireAdmin, (req, res) => {
  res.json({ user: req.user });
});

// ── List admin users ──────────────────────────────────────────────────────────
router.get('/users', requireAdmin, async (req, res, next) => {
  try {
    const { Items } = await db.send(new ScanCommand({ TableName: T.USERS }));
    res.json((Items || [])
      .map(u => ({ id: u.id, username: u.username, role: u.role, createdAt: u.createdAt }))
      .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || '')));
  } catch (e) { next(e); }
});

// ── Create admin user (existing admin only) ───────────────────────────────────
router.post('/users', requireAdmin, async (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ error: 'Username and password are required' });
    if (password.length < 8)
      return res.status(400).json({ error: 'Password must be at least 8 characters' });

    const clean = username.toLowerCase().trim();
    const { Items } = await db.send(new QueryCommand({
      TableName: T.USERS,
      IndexName: 'username-index',
      KeyConditionExpression: 'username = :u',
      ExpressionAttributeValues: { ':u': clean },
    }));
    if (Items?.length) return res.status(409).json({ error: 'Username already taken' });

    const user = {
      id: uuid(), username: clean, role: 'admin',
      passwordHash: await bcrypt.hash(password, 10),
      createdAt: new Date().toISOString(),
    };
    await db.send(new PutCommand({ TableName: T.USERS, Item: user }));
    res.status(201).json({ id: user.id, username: user.username, role: user.role });
  } catch (e) { next(e); }
});

// ── Delete admin user (cannot delete self) ────────────────────────────────────
router.delete('/users/:id', requireAdmin, async (req, res, next) => {
  try {
    if (req.params.id === req.user.id)
      return res.status(400).json({ error: "You cannot delete your own account" });
    await db.send(new DeleteCommand({ TableName: T.USERS, Key: { id: req.params.id } }));
    res.json({ deleted: true });
  } catch (e) { next(e); }
});

// ── Change own password ───────────────────────────────────────────────────────
router.put('/password', requireAdmin, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword)
      return res.status(400).json({ error: 'Both passwords are required' });
    if (newPassword.length < 8)
      return res.status(400).json({ error: 'New password must be at least 8 characters' });

    const { Items } = await db.send(new QueryCommand({
      TableName: T.USERS,
      IndexName: 'username-index',
      KeyConditionExpression: 'username = :u',
      ExpressionAttributeValues: { ':u': req.user.username },
    }));
    const user = Items?.[0];
    if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash)))
      return res.status(401).json({ error: 'Current password is incorrect' });

    await db.send(new UpdateCommand({
      TableName: T.USERS,
      Key: { id: user.id },
      UpdateExpression: 'SET passwordHash = :h',
      ExpressionAttributeValues: { ':h': await bcrypt.hash(newPassword, 10) },
    }));
    res.json({ updated: true });
  } catch (e) { next(e); }
});

module.exports = router;
