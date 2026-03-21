/**
 * QuizBlitz – main game controller
 * Kahoot-style quiz with AI opponents, timer, streaks, scoreboard & confetti.
 * Now integrated with the backend API for persistence.
 */

const ANSWER_STYLES = [
  { cls: 'ans-red',    icon: '▲' },
  { cls: 'ans-blue',   icon: '◆' },
  { cls: 'ans-yellow', icon: '●' },
  { cls: 'ans-green',  icon: '■' },
];

const AI_ROSTER = [
  { name: 'Zara',  emoji: '🦊', skill: 0.88 },
  { name: 'Max',   emoji: '🐺', skill: 0.72 },
  { name: 'Luna',  emoji: '🦋', skill: 0.93 },
  { name: 'Kai',   emoji: '🐉', skill: 0.60 },
  { name: 'Nova',  emoji: '⭐', skill: 0.78 },
  { name: 'Blaze', emoji: '🔥', skill: 0.65 },
  { name: 'Iris',  emoji: '🌈', skill: 0.82 },
];

const _$ = id => document.getElementById(id);

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

class QuizGame {
  constructor() {
    this.audio      = new AudioEngine();
    this.players    = [];
    this.questions  = [];
    this.qIndex     = 0;
    this.state      = 'home';

    this._selectedGameId = null;
    this._sessionId      = null;

    this._timerRAF   = null;
    this._timerStart = 0;
    this._timerDur   = 0;
    this._answered   = false;
    this._aiTimers   = [];
    this._circumference = 2 * Math.PI * 52;
  }

  // ── Screen management ──────────────────────────────────────────────────
  showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    _$(`screen-${id}`).classList.add('active');
    this.state = id;
  }

  init() { this.showScreen('home'); }

  // ── GAME SELECT SCREEN ─────────────────────────────────────────────────
  async showSelectScreen() {
    this.audio.init();
    this.audio.resume();
    if (!this.audio.muted) this.audio.playLobbyMusic();
    this.showScreen('select');
    _$('select-games').innerHTML = '<div class="loading">Loading games…</div>';

    const games = await API.getGames();
    const active = games.filter(g => g.status === 'active');

    if (!active.length) {
      _$('select-games').innerHTML = '<div class="empty-state">No active games available. Create one in Game Manager!</div>';
      return;
    }

    _$('select-games').innerHTML = active.map(g => `
      <div class="select-card" onclick="game.selectGame('${g.id}')">
        <h3>${escHtml(g.name)}</h3>
        <p>${escHtml(g.description || '')}</p>
        <div class="select-card-meta">
          <span>📝 ${g.questionCount || 0} questions</span>
          <span>🎮 Played ${g.timesPlayed || 0}×</span>
        </div>
      </div>`).join('');
  }

  async selectGame(gameId) {
    this._selectedGameId = gameId;
    this.audio.init();
    this.audio.resume();
    if (!this.audio.muted) this.audio.playLobbyMusic();
    this.showScreen('name');
    setTimeout(() => _$('player-name').focus(), 120);
  }

  // ── NAME + LOBBY ───────────────────────────────────────────────────────
  joinGame() {
    const input = _$('player-name');
    const name  = input.value.trim();
    if (!name) {
      input.classList.remove('shake');
      void input.offsetWidth;
      input.classList.add('shake');
      return;
    }
    this._playerName = name;
    this._buildLobby(name);
  }

  async _buildLobby(name) {
    this.showScreen('lobby');

    // Create session via API
    const session = await API.createSession(this._selectedGameId);
    this._sessionId = session.id;
    _$('game-pin').textContent = session.pin.replace(/(\d{3})(\d{3})/, '$1 $2');

    // Load game info for lobby subtitle
    const gameInfo = await API.getGame(this._selectedGameId);
    _$('lobby-game-name').textContent = gameInfo.name;

    // Human player
    this.players = [{
      name, emoji: '😊', score: 0, streak: 0, isAI: false
    }];
    this._renderLobby();

    // AI players join one by one
    const roster = shuffle(AI_ROSTER).slice(0, 5);
    roster.forEach((ai, i) => {
      setTimeout(() => {
        this.players.push({ ...ai, score: 0, streak: 0, isAI: true });
        this._renderLobby();
      }, (i + 1) * 700 + Math.random() * 300);
    });
  }

  _renderLobby() {
    _$('lobby-players').innerHTML = this.players.map(p => `
      <div class="lobby-player ${p.isAI ? '' : 'human'}">
        <span class="player-emoji">${p.emoji}</span>
        <span class="player-name">${p.name}</span>
      </div>`).join('');
    const n = this.players.length;
    _$('player-count').textContent = `${n} player${n !== 1 ? 's' : ''} joined`;
  }

  // ── START GAME ─────────────────────────────────────────────────────────
  async startGame() {
    // Load questions from API
    const allQ = await API.getQuestions(this._selectedGameId);
    const quizQ = shuffle(allQ.filter(q => q.type === 'quiz'));
    const tfQ   = shuffle(allQ.filter(q => q.type === 'true_false'));

    // Pick up to 10 questions with a mix
    const quizCount = Math.min(7, quizQ.length);
    const tfCount   = Math.min(3, tfQ.length);
    this.questions  = shuffle([...quizQ.slice(0, quizCount), ...tfQ.slice(0, tfCount)]);

    // If still under 10, fill with more of whatever's available
    if (this.questions.length < 10) {
      const remaining = allQ.filter(q => !this.questions.includes(q));
      this.questions.push(...shuffle(remaining).slice(0, 10 - this.questions.length));
    }

    this.qIndex = 0;
    this.players.forEach(p => { p.score = 0; p.streak = 0; });
    this.audio.stopAll();
    this._showCountdown();
  }

  // ── COUNTDOWN ──────────────────────────────────────────────────────────
  _showCountdown() {
    this.showScreen('countdown');
    let n = 3;
    const el = _$('countdown-number');

    const tick = () => {
      el.textContent = n > 0 ? n : 'GO! 🚀';
      el.style.animation = 'none';
      void el.offsetWidth;
      el.style.animation = '';

      this.audio.playCountdownBeep(n === 0 ? 0 : n);

      if (n === 0) {
        setTimeout(() => this._showQuestion(), 700);
      } else {
        n--;
        setTimeout(tick, 1000);
      }
    };
    tick();
  }

  // ── QUESTION ───────────────────────────────────────────────────────────
  _showQuestion() {
    const q = this.questions[this.qIndex];
    this._answered = false;

    _$('q-num').textContent = `Q${this.qIndex + 1} / ${this.questions.length}`;
    _$('q-cat').textContent = `${q.emoji || '❓'} ${q.category || 'General'}`;
    _$('q-pts').textContent = '1000 pts';
    _$('q-answered').textContent = '0 answered';
    _$('question-text').textContent = q.question;

    const grid = _$('answers-grid');
    grid.className = `answers-grid${q.type === 'true_false' ? ' tf-grid' : ''}`;
    grid.innerHTML = q.answers.map((ans, i) => {
      const s = ANSWER_STYLES[i];
      return `
        <button class="answer-btn ${s.cls}"
                data-idx="${i}"
                onclick="game._selectAnswer(${i})"
                style="animation-delay:${i * 0.08}s">
          <span class="answer-icon">${s.icon}</span>
          <span class="answer-text">${escHtml(ans)}</span>
        </button>`;
    }).join('');

    // Streak badge
    const human = this.players[0];
    const badge = _$('streak-badge');
    if (human.streak >= 2) {
      _$('streak-count').textContent = human.streak;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }

    // Timer reset
    const ring = _$('timer-ring');
    ring.style.strokeDashoffset = '0';
    ring.style.stroke = '#46c1f6';
    _$('timer-num').style.color = '';
    _$('timer-num').textContent = q.time;
    _$('screen-question').classList.remove('timer-warn', 'timer-danger');

    this.showScreen('question');
    this.audio.playQuestionMusic(q.time);
    this._scheduleAI(q);

    this._timerDur   = q.time * 1000;
    this._timerStart = performance.now();
    this._tickTimer();
  }

  // ── TIMER ──────────────────────────────────────────────────────────────
  _tickTimer() {
    const elapsed   = performance.now() - this._timerStart;
    const remaining = Math.max(0, this._timerDur - elapsed);
    const ratio     = remaining / this._timerDur;

    _$('timer-ring').style.strokeDashoffset = this._circumference * (1 - ratio);
    _$('timer-num').textContent = Math.ceil(remaining / 1000);

    const qs = _$('screen-question');
    if (ratio <= 0.25) {
      qs.classList.add('timer-danger'); qs.classList.remove('timer-warn');
    } else if (ratio <= 0.5) {
      qs.classList.add('timer-warn'); qs.classList.remove('timer-danger');
    }

    if (!this._answered) this._updateAnsweredCount();

    if (remaining <= 0) {
      cancelAnimationFrame(this._timerRAF);
      this._timeUp();
    } else {
      this._timerRAF = requestAnimationFrame(() => this._tickTimer());
    }
  }

  _updateAnsweredCount() {
    const elapsed = performance.now() - this._timerStart;
    const aiAnswered = this.players.slice(1).filter(p => p._answerDelay != null && p._answerDelay <= elapsed).length;
    const total = aiAnswered + (this._answered ? 1 : 0);
    _$('q-answered').textContent = `${total} answered`;
  }

  // ── AI ─────────────────────────────────────────────────────────────────
  _scheduleAI(q) {
    this._aiTimers.forEach(t => clearTimeout(t));
    this._aiTimers = [];

    this.players.slice(1).forEach(ai => {
      if (Math.random() > 0.95) { ai._answerDelay = null; ai._answeredCorrect = false; return; }
      ai._answeredCorrect = Math.random() < ai.skill;
      const minMs = 1200;
      const maxMs = q.time * 1000 * 0.88;
      ai._answerDelay = minMs + (1 - ai.skill) * (maxMs - minMs) * Math.random();
      const t = setTimeout(() => { if (this.state === 'question') this._updateAnsweredCount(); }, ai._answerDelay);
      this._aiTimers.push(t);
    });
  }

  // ── ANSWER ─────────────────────────────────────────────────────────────
  _selectAnswer(idx) {
    if (this._answered || this.state !== 'question') return;
    this._answered = true;
    cancelAnimationFrame(this._timerRAF);

    document.querySelectorAll('.answer-btn').forEach((btn, i) => {
      btn.disabled = true;
      if (i === idx) btn.classList.add('selected');
      else btn.classList.add('dimmed');
    });
    this._updateAnsweredCount();
    setTimeout(() => this._resolveQuestion(idx), 1200);
  }

  _timeUp() {
    if (this._answered) return;
    this._answered = true;
    document.querySelectorAll('.answer-btn').forEach(b => { b.disabled = true; });
    this._resolveQuestion(null);
  }

  // ── RESOLVE ────────────────────────────────────────────────────────────
  _resolveQuestion(humanIdx) {
    cancelAnimationFrame(this._timerRAF);
    this._aiTimers.forEach(t => clearTimeout(t));
    this.audio.stopAll();

    const q = this.questions[this.qIndex];
    const elapsed = performance.now() - this._timerStart;

    let humanPoints = 0, humanCorrect = false;

    if (humanIdx !== null) {
      humanCorrect = (humanIdx === q.correct);
      if (humanCorrect) {
        const ratio = Math.max(0, (this._timerDur - elapsed) / this._timerDur);
        humanPoints = Math.round(500 + 500 * ratio);
        this.players[0].streak++;
        humanPoints += Math.min(this.players[0].streak - 1, 5) * 60;
      } else {
        this.players[0].streak = 0;
      }
    } else {
      this.players[0].streak = 0;
    }
    this.players[0].score += humanPoints;

    // AI scores
    this.players.slice(1).forEach(ai => {
      if (ai._answeredCorrect && ai._answerDelay != null) {
        const ratio = Math.max(0, (this._timerDur - ai._answerDelay) / this._timerDur);
        let pts = Math.round(500 + 500 * ratio);
        ai.streak++;
        pts += Math.min(ai.streak - 1, 5) * 60;
        ai.score += pts;
      } else {
        ai.streak = 0;
      }
    });

    // Reveal
    document.querySelectorAll('.answer-btn').forEach((btn, i) => {
      btn.classList.remove('selected', 'dimmed');
      btn.classList.add(i === q.correct ? 'correct-reveal' : 'wrong-reveal');
    });

    if (humanIdx === null) this.audio.playTimeout();
    else if (humanCorrect) this.audio.playCorrect();
    else                   this.audio.playWrong();

    setTimeout(() => this._showResult(humanCorrect, humanPoints, humanIdx, q), 1600);
  }

  // ── RESULT ─────────────────────────────────────────────────────────────
  _showResult(correct, points, humanIdx, q) {
    let icon, label, labelClass;
    if (humanIdx === null)   { icon = '⏱️'; label = "Time's Up!"; labelClass = 'timeout'; }
    else if (correct)        { icon = '✓';  label = 'Correct!';    labelClass = 'correct'; }
    else                     { icon = '✗';  label = 'Wrong!';      labelClass = 'wrong'; }

    const iconEl = _$('result-icon');
    iconEl.textContent = icon;
    iconEl.className   = `result-icon ${labelClass}`;

    const labelEl = _$('result-label');
    labelEl.textContent = label;
    labelEl.className   = `result-label ${labelClass}`;

    _$('result-points').textContent = correct ? `+${points}` : '+0';

    const streak = this.players[0].streak;
    _$('result-streak').textContent = streak >= 2 ? `🔥 ${streak} streak!` : '';
    _$('correct-answer-text').textContent = q.answers[q.correct];

    this.showScreen('result');
    setTimeout(() => this._showScoreboard(), 2800);
  }

  // ── SCOREBOARD ─────────────────────────────────────────────────────────
  _showScoreboard() {
    this.showScreen('scoreboard');
    this.audio.playScoreboard();

    const sorted = [...this.players].sort((a, b) => b.score - a.score);
    _$('scoreboard-list').innerHTML = sorted.map((p, i) => {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`;
      const you   = !p.isAI ? ' <span style="font-size:12px;color:var(--muted)">(You)</span>' : '';
      return `
        <div class="score-entry${p.isAI ? '' : ' is-you'}" style="animation-delay:${i * 0.08}s">
          <span class="score-rank">${medal}</span>
          <span class="score-emoji">${p.emoji}</span>
          <span class="score-name">${p.name}${you}</span>
          <span class="score-pts">${p.score.toLocaleString()}</span>
        </div>`;
    }).join('');

    let t = 5;
    _$('next-timer').textContent = t;
    const iv = setInterval(() => {
      t--;
      if (_$('next-timer')) _$('next-timer').textContent = t;
      if (t <= 0) { clearInterval(iv); this._nextQuestion(); }
    }, 1000);
  }

  _nextQuestion() {
    this.qIndex++;
    if (this.qIndex >= this.questions.length) this._showWinner();
    else this._showCountdown();
  }

  // ── WINNER ─────────────────────────────────────────────────────────────
  async _showWinner() {
    this.showScreen('winner');
    this.audio.playWinner();

    const sorted = [...this.players].sort((a, b) => b.score - a.score);

    // Save results to API
    if (this._sessionId) {
      try {
        await API.finishSession(this._sessionId, sorted.map((p, i) => ({
          id: p.id || undefined,
          name: p.name,
          emoji: p.emoji,
          isAI: p.isAI,
          score: p.score,
          streak: p.streak,
          finalRank: i + 1,
        })));
      } catch (e) {
        console.error('Failed to save results:', e);
      }
    }

    // Podium
    const slots = [
      { player: sorted[1], cls: 'place-2', label: '🥈 2nd', delay: 0.3 },
      { player: sorted[0], cls: 'place-1', label: '🥇 1st', delay: 0 },
      { player: sorted[2], cls: 'place-3', label: '🥉 3rd', delay: 0.6 },
    ].filter(s => s.player);

    _$('podium-row').innerHTML = slots.map(s => `
      <div class="podium-place ${s.cls}" style="animation-delay:${s.delay}s">
        <div class="podium-player">
          <div class="podium-emoji">${s.player.emoji}</div>
          <div class="podium-name">${s.player.name}${!s.player.isAI ? ' 🌟' : ''}</div>
          <div class="podium-score">${s.player.score.toLocaleString()} pts</div>
        </div>
        <div class="podium-block">${s.label}</div>
      </div>`).join('');

    _$('final-list').innerHTML = sorted.map((p, i) => `
      <div class="final-row${p.isAI ? '' : ' is-you'}" style="animation-delay:${i*0.07}s">
        <span class="final-pos">${i + 1}</span>
        <span class="final-name">${p.emoji} ${p.name}${!p.isAI ? ' (You)' : ''}</span>
        <span class="final-score">${p.score.toLocaleString()} pts</span>
      </div>`).join('');

    this._startConfetti();
  }

  // ── CONFETTI ───────────────────────────────────────────────────────────
  _startConfetti() {
    const canvas = _$('confetti-canvas');
    const ctx    = canvas.getContext('2d');
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;

    const COLORS = ['#e21b3c','#1368ce','#d89e00','#26890c','#ff6b35','#a855f7','#ffffff'];
    const particles = Array.from({ length: 180 }, () => ({
      x:  Math.random() * canvas.width,
      y:  Math.random() * canvas.height - canvas.height,
      vx: (Math.random() - 0.5) * 5,
      vy: Math.random() * 4 + 2,
      w:  Math.random() * 10 + 5,
      h:  Math.random() * 6  + 3,
      rot: Math.random() * 360,
      rv:  (Math.random() - 0.5) * 8,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
    }));

    const frame = () => {
      if (this.state !== 'winner') return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy; p.rot += p.rv;
        if (p.y > canvas.height + 20) { p.y = -20; p.x = Math.random() * canvas.width; }
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot * Math.PI / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });
      requestAnimationFrame(frame);
    };
    frame();
  }

  // ── Mute ───────────────────────────────────────────────────────────────
  toggleMute() {
    this.audio.init();
    const muted = this.audio.toggleMute();
    document.querySelectorAll('.mute-btn').forEach(b => { b.textContent = muted ? '🔇' : '🔊'; });
    if (!muted && ['home','lobby','name','select'].includes(this.state)) {
      this.audio.playLobbyMusic();
    }
  }

  // ── Restart ────────────────────────────────────────────────────────────
  restart() {
    cancelAnimationFrame(this._timerRAF);
    this._aiTimers.forEach(t => clearTimeout(t));
    this.audio.stopAll();
    this._sessionId = null;
    this.showScreen('home');
  }
}

// HTML escaping helper
function escHtml(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}

// ── Bootstrap ────────────────────────────────────────────────────────────
const game = new QuizGame();

window.addEventListener('DOMContentLoaded', () => game.init());
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && game.state === 'name') game.joinGame();
});
document.addEventListener('keydown', e => {
  if (game.state !== 'question') return;
  const map = { '1': 0, '2': 1, '3': 2, '4': 3 };
  if (map[e.key] !== undefined) game._selectAnswer(map[e.key]);
});
window.addEventListener('resize', () => {
  const c = document.getElementById('confetti-canvas');
  if (c) { c.width = window.innerWidth; c.height = window.innerHeight; }
});
