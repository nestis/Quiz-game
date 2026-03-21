/**
 * server/socket.js – Real-time multiplayer game room manager.
 *
 * Room lifecycle:
 *   lobby → question → revealing → scoreboard → (repeat) → finished
 *
 * The first socket to join a PIN is the admin/host.
 * The server owns the timer and auto-reveals when it expires.
 */
const { Server } = require('socket.io');
const { v4: uuid } = require('uuid');
const { db, T, QueryCommand, PutCommand, UpdateCommand } = require('./db');

const shuffle = arr => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/** In-memory rooms keyed by PIN string */
const rooms = new Map();

class GameRoom {
  constructor({ sessionId, pin, gameId, gameName }) {
    this.sessionId = sessionId;
    this.pin       = pin;
    this.gameId    = gameId;
    this.gameName  = gameName;
    this.adminId   = null;        // socket.id of the host
    this.players   = new Map();   // socketId → PlayerState
    this.questions = [];
    this.qIdx      = -1;
    this.phase     = 'lobby';     // lobby|question|revealing|scoreboard|finished
    this.answers   = new Map();   // socketId → {answerIdx, timeRatio}
    this._timer    = null;
  }

  sorted() {
    return [...this.players.values()].sort((a, b) => b.score - a.score);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function fetchQuestions(gameId) {
  const { Items } = await db.send(new QueryCommand({
    TableName: T.QUESTIONS,
    KeyConditionExpression: 'gameId = :g',
    ExpressionAttributeValues: { ':g': gameId },
  }));
  return shuffle(Items || []).slice(0, 20);
}

// ── Game phase helpers ────────────────────────────────────────────────────────

function sendQuestion(io, room) {
  room.phase   = 'question';
  room.answers = new Map();
  room.qIdx++;

  for (const p of room.players.values()) p.answered = false;

  const q = room.questions[room.qIdx];

  io.to(room.pin).emit('show-question', {
    questionIdx : room.qIdx,
    total       : room.questions.length,
    category    : q.category,
    emoji       : q.emoji || '❓',
    type        : q.type,
    question    : q.question,
    answers     : q.answers,
    timeLimit   : q.time,
    // correct is intentionally omitted – revealed later
  });

  // Server-owned timer: auto-reveal when time is up (+0.8s buffer for latency)
  room._timer = setTimeout(() => {
    if (room.phase === 'question') doReveal(io, room);
  }, (q.time + 0.8) * 1000);
}

function doReveal(io, room) {
  clearTimeout(room._timer);
  room._timer = null;
  room.phase = 'revealing';

  const q = room.questions[room.qIdx];

  for (const [sid, ans] of room.answers) {
    const p = room.players.get(sid);
    if (!p) continue;
    if (ans.answerIdx === q.correct) {
      const pts   = Math.round(500 + 500 * (ans.timeRatio || 0));
      p.streak++;
      const bonus = Math.min(p.streak - 1, 5) * 60;
      p.score    += pts + bonus;
      ans.points  = pts + bonus;
    } else {
      p.streak  = 0;
      ans.points = 0;
    }
  }
  // Players who didn't answer lose streak
  for (const [sid, p] of room.players) {
    if (!room.answers.has(sid)) p.streak = 0;
  }

  io.to(room.pin).emit('answer-revealed', {
    correct     : q.correct,
    correctText : q.answers[q.correct],
    players     : room.sorted(),
  });

  setTimeout(() => doScoreboard(io, room), 4000);
}

function doScoreboard(io, room) {
  room.phase = 'scoreboard';
  const isLast = room.qIdx >= room.questions.length - 1;
  io.to(room.pin).emit('show-scoreboard', {
    players : room.sorted(),
    isLast,
  });
}

async function doGameOver(io, room) {
  room.phase = 'finished';
  const players = room.sorted();
  io.to(room.pin).emit('game-over', { players });

  try {
    await db.send(new UpdateCommand({
      TableName: T.SESSIONS,
      Key: { id: room.sessionId },
      UpdateExpression: 'SET #s=:s, finishedAt=:f, winnerName=:wn, winnerScore=:ws, playerCount=:pc',
      ExpressionAttributeNames: { '#s': 'status' },
      ExpressionAttributeValues: {
        ':s': 'finished', ':f': new Date().toISOString(),
        ':wn': players[0]?.name || '', ':ws': players[0]?.score || 0,
        ':pc': players.length,
      },
    }));
    for (const [i, p] of players.entries()) {
      await db.send(new PutCommand({
        TableName: T.PLAYERS,
        Item: { id: p.dbId, sessionId: room.sessionId, name: p.name, emoji: p.emoji, isAI: false, score: p.score, streak: p.streak, finalRank: i + 1 },
      }));
    }
  } catch (e) { console.error('Persist error:', e); }

  rooms.delete(room.pin);
}

// ── Main attach function ──────────────────────────────────────────────────────

function attachSocketIO(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
  });

  io.on('connection', socket => {
    let myPin = null;

    // ── Join room ─────────────────────────────────────────────────────────
    socket.on('join-room', async ({ pin, name, emoji }) => {
      try {
        const { Items } = await db.send(new QueryCommand({
          TableName: T.SESSIONS,
          IndexName: 'pin-index',
          KeyConditionExpression: 'pin = :p',
          ExpressionAttributeValues: { ':p': String(pin) },
        }));

        if (!Items?.length) {
          socket.emit('join-error', { message: 'Game not found. Check the PIN.' });
          return;
        }
        const session = Items[0];
        if (session.status === 'finished') {
          socket.emit('join-error', { message: 'This game has already finished.' });
          return;
        }

        myPin = String(pin);
        socket.join(myPin);

        if (!rooms.has(myPin)) {
          rooms.set(myPin, new GameRoom({
            sessionId: session.id, pin: myPin,
            gameId: session.gameId, gameName: session.gameName,
          }));
        }
        const room = rooms.get(myPin);

        // First socket to join becomes admin
        const isAdmin = room.adminId === null;
        if (isAdmin) room.adminId = socket.id;

        const player = {
          id: socket.id, dbId: uuid(),
          name: (name || 'Player').trim().slice(0, 20),
          emoji: emoji || '😊',
          score: 0, streak: 0, answered: false, isAdmin,
        };
        room.players.set(socket.id, player);

        socket.emit('room-joined', {
          pin: myPin, gameName: room.gameName,
          isAdmin, players: room.sorted(),
        });
        // Broadcast updated roster to everyone
        io.to(myPin).emit('players-updated', { players: room.sorted() });
      } catch (e) {
        console.error('join-room error', e);
        socket.emit('join-error', { message: 'Failed to join. Please try again.' });
      }
    });

    // ── Admin starts game ─────────────────────────────────────────────────
    socket.on('start-game', async ({ pin }) => {
      const room = rooms.get(pin);
      if (!room || room.adminId !== socket.id || room.phase !== 'lobby') return;

      room.questions = await fetchQuestions(room.gameId);
      if (!room.questions.length) {
        socket.emit('join-error', { message: 'No questions found for this game.' });
        return;
      }
      io.to(pin).emit('game-starting', { questionCount: room.questions.length });
      setTimeout(() => sendQuestion(io, room), 3500);
    });

    // ── Player submits answer ─────────────────────────────────────────────
    socket.on('submit-answer', ({ pin, answerIdx, timeLeft, timeLimit }) => {
      const room = rooms.get(pin);
      if (!room || room.phase !== 'question' || room.answers.has(socket.id)) return;

      const timeRatio = timeLimit > 0 ? Math.max(0, timeLeft / timeLimit) : 0;
      room.answers.set(socket.id, { answerIdx, timeRatio });

      const p = room.players.get(socket.id);
      if (p) p.answered = true;

      const answered = room.answers.size;
      const total    = room.players.size;

      // Push live count to the admin
      io.to(room.adminId).emit('answer-count', { answered, total });

      // If everyone has answered, reveal early
      if (answered >= total) {
        clearTimeout(room._timer);
        doReveal(io, room);
      }
    });

    // ── Admin advances after scoreboard ──────────────────────────────────
    socket.on('next-question', ({ pin }) => {
      const room = rooms.get(pin);
      if (!room || room.adminId !== socket.id || room.phase !== 'scoreboard') return;
      room.qIdx >= room.questions.length - 1 ? doGameOver(io, room) : sendQuestion(io, room);
    });

    // ── Admin ends game early ─────────────────────────────────────────────
    socket.on('end-game', ({ pin }) => {
      const room = rooms.get(pin);
      if (!room || room.adminId !== socket.id) return;
      clearTimeout(room._timer);
      doGameOver(io, room);
    });

    // ── Disconnect ────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      if (!myPin || !rooms.has(myPin)) return;
      const room = rooms.get(myPin);
      room.players.delete(socket.id);

      if (room.players.size === 0) {
        clearTimeout(room._timer);
        rooms.delete(myPin);
        return;
      }
      // Re-assign admin if host left
      if (room.adminId === socket.id) {
        const [newId] = room.players.keys();
        room.adminId = newId;
        room.players.get(newId).isAdmin = true;
        io.to(newId).emit('promoted-to-admin', {});
      }
      io.to(myPin).emit('players-updated', { players: room.sorted() });
    });
  });

  return io;
}

module.exports = { attachSocketIO };
