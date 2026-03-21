/**
 * QuizBlitz – main game controller
 * Kahoot-style quiz with AI opponents, timer, streaks, scoreboard & confetti.
 */

// ── Answer shapes & colours ──────────────────────────────────────────────────
const ANSWER_STYLES = [
  { cls: 'ans-red',    icon: '▲' },
  { cls: 'ans-blue',   icon: '◆' },
  { cls: 'ans-yellow', icon: '●' },
  { cls: 'ans-green',  icon: '■' },
];

// ── AI player roster ─────────────────────────────────────────────────────────
const AI_ROSTER = [
  { name: 'Zara',  emoji: '🦊', skill: 0.88 },
  { name: 'Max',   emoji: '🐺', skill: 0.72 },
  { name: 'Luna',  emoji: '🦋', skill: 0.93 },
  { name: 'Kai',   emoji: '🐉', skill: 0.60 },
  { name: 'Nova',  emoji: '⭐', skill: 0.78 },
  { name: 'Blaze', emoji: '🔥', skill: 0.65 },
  { name: 'Iris',  emoji: '🌈', skill: 0.82 },
];

// ── Helpers ──────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── QuizGame ─────────────────────────────────────────────────────────────────
class QuizGame {
  constructor() {
    this.audio    = new AudioEngine();
    this.players  = [];       // [human, ...AI]
    this.questions = [];
    this.qIndex   = 0;
    this.state    = 'home';

    this._timerRAF  = null;   // requestAnimationFrame handle
    this._timerStart = 0;     // performance.now() when timer started
    this._timerDur  = 0;      // total question time in ms
    this._answered  = false;  // has human answered?
    this._aiTimers  = [];     // setTimeout handles for AI answer simulation

    // Timer SVG constants
    this._circumference = 2 * Math.PI * 52; // r=52
  }

  // ── Screen management ──────────────────────────────────────────────────────
  showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    $(`screen-${id}`).classList.add('active');
    this.state = id;
  }

  // ── Initialise on page load ────────────────────────────────────────────────
  init() {
    this.showScreen('home');
  }

  // ── HOME → NAME ENTRY ──────────────────────────────────────────────────────
  startNameEntry() {
    this.audio.init();
    this.audio.resume();
    this.audio.playLobbyMusic();
    this.showScreen('name');
    setTimeout(() => $('player-name').focus(), 120);
  }

  joinGame() {
    const input = $('player-name');
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

  // ── LOBBY ─────────────────────────────────────────────────────────────────
  _buildLobby(name) {
    this.showScreen('lobby');

    // Randomise PIN display
    $('game-pin').textContent = String(Math.floor(100000 + Math.random() * 900000))
      .replace(/(\d{3})(\d{3})/, '$1 $2');

    // Human player is always index 0
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
    const grid = $('lobby-players');
    grid.innerHTML = this.players.map(p => `
      <div class="lobby-player ${p.isAI ? '' : 'human'}">
        <span class="player-emoji">${p.emoji}</span>
        <span class="player-name">${p.name}</span>
      </div>`).join('');
    const n = this.players.length;
    $('player-count').textContent = `${n} player${n !== 1 ? 's' : ''} joined`;
  }

  // ── START GAME ─────────────────────────────────────────────────────────────
  startGame() {
    // Pick 10 random questions, always mixed types
    const quizQ = shuffle(ALL_QUESTIONS.filter(q => q.type === 'quiz'));
    const tfQ   = shuffle(ALL_QUESTIONS.filter(q => q.type === 'true_false'));
    this.questions = shuffle([...quizQ.slice(0, 7), ...tfQ.slice(0, 3)]);
    this.qIndex    = 0;

    this.players.forEach(p => { p.score = 0; p.streak = 0; });
    this.audio.stopAll();
    this._showCountdown();
  }

  // ── COUNTDOWN 3-2-1-GO ─────────────────────────────────────────────────────
  _showCountdown() {
    this.showScreen('countdown');
    let n = 3;
    const el = $('countdown-number');

    const tick = () => {
      el.textContent = n > 0 ? n : 'GO! 🚀';
      // Re-trigger animation
      el.style.animation = 'none';
      void el.offsetWidth;
      el.style.animation = '';

      if (n > 0) this.audio.playCountdownBeep(n);
      else        this.audio.playCountdownBeep(0);

      if (n === 0) {
        setTimeout(() => this._showQuestion(), 700);
      } else {
        n--;
        setTimeout(tick, 1000);
      }
    };
    tick();
  }

  // ── QUESTION ───────────────────────────────────────────────────────────────
  _showQuestion() {
    const q = this.questions[this.qIndex];
    this._answered = false;

    // Header
    $('q-num').textContent = `Q${this.qIndex + 1} / ${this.questions.length}`;
    $('q-cat').textContent = `${q.emoji} ${q.category}`;
    $('q-pts').textContent = `1000 pts`;
    $('q-answered').textContent = '0 answered';
    $('question-text').textContent = q.question;

    // Build answer buttons
    const grid = $('answers-grid');
    grid.className = `answers-grid${q.type === 'true_false' ? ' tf-grid' : ''}`;
    grid.innerHTML = q.answers.map((ans, i) => {
      const s = ANSWER_STYLES[i];
      return `
        <button class="answer-btn ${s.cls}"
                data-idx="${i}"
                onclick="game._selectAnswer(${i})"
                style="animation-delay:${i * 0.08}s">
          <span class="answer-icon">${s.icon}</span>
          <span class="answer-text">${ans}</span>
        </button>`;
    }).join('');

    // Streak badge
    const human  = this.players[0];
    const badge  = $('streak-badge');
    if (human.streak >= 2) {
      $('streak-count').textContent = human.streak;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }

    // Reset timer ring
    const ring = $('timer-ring');
    ring.style.strokeDashoffset = '0';
    ring.style.stroke = '#46c1f6';
    $('timer-num').style.color  = '';
    $('timer-num').textContent  = q.time;
    $('screen-question').classList.remove('timer-warn', 'timer-danger');

    this.showScreen('question');
    this.audio.playQuestionMusic(q.time);

    // Schedule AI answers
    this._scheduleAI(q);

    // Start countdown
    this._timerDur   = q.time * 1000;
    this._timerStart = performance.now();
    this._tickTimer();
  }

  // ── TIMER ──────────────────────────────────────────────────────────────────
  _tickTimer() {
    const elapsed  = performance.now() - this._timerStart;
    const remaining = Math.max(0, this._timerDur - elapsed);
    const ratio     = remaining / this._timerDur;
    const secs      = Math.ceil(remaining / 1000);

    // SVG ring
    const ring = $('timer-ring');
    ring.style.strokeDashoffset = this._circumference * (1 - ratio);

    // Number
    $('timer-num').textContent = secs;

    // Colour zones
    const qScreen = $('screen-question');
    if (ratio <= 0.25) {
      qScreen.classList.add('timer-danger');
      qScreen.classList.remove('timer-warn');
    } else if (ratio <= 0.5) {
      qScreen.classList.add('timer-warn');
      qScreen.classList.remove('timer-danger');
    }

    // Update answered count
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
    const aiAnswered = this._aiTimers
      ? this.players.slice(1).filter(p => p._answerDelay != null && p._answerDelay <= elapsed).length
      : 0;
    const total = aiAnswered + (this._answered ? 1 : 0);
    $('q-answered').textContent = `${total} answered`;
  }

  // ── AI SIMULATION ──────────────────────────────────────────────────────────
  _scheduleAI(q) {
    // Clear previous
    this._aiTimers.forEach(t => clearTimeout(t));
    this._aiTimers = [];

    this.players.slice(1).forEach(ai => {
      // ~95 % chance AI answers
      if (Math.random() > 0.95) {
        ai._answerDelay    = null;
        ai._answeredCorrect = false;
        return;
      }

      const correct = Math.random() < ai.skill;
      ai._answeredCorrect = correct;

      // Skilled AIs answer faster
      const minMs  = 1200;
      const maxMs  = q.time * 1000 * 0.88;
      const delay  = minMs + (1 - ai.skill) * (maxMs - minMs) * Math.random();
      ai._answerDelay = delay;

      const t = setTimeout(() => {
        if (this.state === 'question') this._updateAnsweredCount();
      }, delay);
      this._aiTimers.push(t);
    });
  }

  // ── HUMAN SELECTS ANSWER ───────────────────────────────────────────────────
  _selectAnswer(idx) {
    if (this._answered || this.state !== 'question') return;
    this._answered = true;
    cancelAnimationFrame(this._timerRAF);

    const q = this.questions[this.qIndex];

    // Visual feedback on buttons
    document.querySelectorAll('.answer-btn').forEach((btn, i) => {
      btn.disabled = true;
      if (i === idx) btn.classList.add('selected');
      else            btn.classList.add('dimmed');
    });

    this._updateAnsweredCount();

    // Wait a moment then resolve
    setTimeout(() => this._resolveQuestion(idx), 1200);
  }

  // ── TIME UP (human didn't answer) ─────────────────────────────────────────
  _timeUp() {
    if (this._answered) return;
    this._answered = true;
    document.querySelectorAll('.answer-btn').forEach(b => { b.disabled = true; });
    this._resolveQuestion(null);
  }

  // ── RESOLVE: calculate scores, show reveal ─────────────────────────────────
  _resolveQuestion(humanIdx) {
    cancelAnimationFrame(this._timerRAF);
    this._aiTimers.forEach(t => clearTimeout(t));
    this.audio.stopAll();

    const q       = this.questions[this.qIndex];
    const elapsed = performance.now() - this._timerStart; // ms

    // ── Human score ──
    let humanPoints  = 0;
    let humanCorrect = false;

    if (humanIdx !== null) {
      humanCorrect = (humanIdx === q.correct);
      if (humanCorrect) {
        const ratio   = Math.max(0, (this._timerDur - elapsed) / this._timerDur);
        humanPoints   = Math.round(500 + 500 * ratio);           // 500-1000 based on speed
        this.players[0].streak++;
        humanPoints  += Math.min(this.players[0].streak - 1, 5) * 60; // streak bonus
      } else {
        this.players[0].streak = 0;
      }
    } else {
      this.players[0].streak = 0;
    }
    this.players[0].score += humanPoints;

    // ── AI scores ──
    this.players.slice(1).forEach(ai => {
      if (ai._answeredCorrect && ai._answerDelay != null) {
        const ratio = Math.max(0, (this._timerDur - ai._answerDelay) / this._timerDur);
        let pts     = Math.round(500 + 500 * ratio);
        ai.streak++;
        pts += Math.min(ai.streak - 1, 5) * 60;
        ai.score += pts;
      } else {
        ai.streak = 0;
      }
    });

    // ── Reveal correct answer on question screen ──
    document.querySelectorAll('.answer-btn').forEach((btn, i) => {
      btn.classList.remove('selected', 'dimmed');
      if (i === q.correct) btn.classList.add('correct-reveal');
      else                  btn.classList.add('wrong-reveal');
    });

    // Play SFX
    if (humanIdx === null)   this.audio.playTimeout();
    else if (humanCorrect)   this.audio.playCorrect();
    else                     this.audio.playWrong();

    setTimeout(() => this._showResult(humanCorrect, humanPoints, humanIdx, q), 1600);
  }

  // ── RESULT SCREEN ──────────────────────────────────────────────────────────
  _showResult(correct, points, humanIdx, q) {
    let icon, label, labelClass;

    if (humanIdx === null) {
      icon = '⏱️'; label = "Time's Up!"; labelClass = 'timeout';
    } else if (correct) {
      icon = '✓';  label = 'Correct!';    labelClass = 'correct';
    } else {
      icon = '✗';  label = 'Wrong!';      labelClass = 'wrong';
    }

    const iconEl = $('result-icon');
    iconEl.textContent = icon;
    iconEl.className   = `result-icon ${labelClass}`;

    const labelEl = $('result-label');
    labelEl.textContent = label;
    labelEl.className   = `result-label ${labelClass}`;

    $('result-points').textContent = correct ? `+${points}` : '+0';

    const streak = this.players[0].streak;
    $('result-streak').textContent = streak >= 2 ? `🔥 ${streak} streak!` : '';

    $('correct-answer-text').textContent = q.answers[q.correct];

    this.showScreen('result');
    setTimeout(() => this._showScoreboard(), 2800);
  }

  // ── SCOREBOARD ─────────────────────────────────────────────────────────────
  _showScoreboard() {
    this.showScreen('scoreboard');
    this.audio.playScoreboard();

    const sorted = [...this.players].sort((a, b) => b.score - a.score);

    $('scoreboard-list').innerHTML = sorted.map((p, i) => {
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

    // Countdown to next question
    let t = 5;
    $('next-timer').textContent = t;
    const iv = setInterval(() => {
      t--;
      if ($('next-timer')) $('next-timer').textContent = t;
      if (t <= 0) {
        clearInterval(iv);
        this._nextQuestion();
      }
    }, 1000);
  }

  // ── NEXT QUESTION OR WINNER ────────────────────────────────────────────────
  _nextQuestion() {
    this.qIndex++;
    if (this.qIndex >= this.questions.length) {
      this._showWinner();
    } else {
      this._showCountdown();
    }
  }

  // ── WINNER SCREEN ──────────────────────────────────────────────────────────
  _showWinner() {
    this.showScreen('winner');
    this.audio.playWinner();

    const sorted = [...this.players].sort((a, b) => b.score - a.score);

    // Podium (2nd, 1st, 3rd order for display)
    const podiumRow = $('podium-row');
    const slots = [
      { player: sorted[1], cls: 'place-2', label: '🥈 2nd', delay: 0.3 },
      { player: sorted[0], cls: 'place-1', label: '🥇 1st', delay: 0   },
      { player: sorted[2], cls: 'place-3', label: '🥉 3rd', delay: 0.6 },
    ].filter(s => s.player);

    podiumRow.innerHTML = slots.map(s => `
      <div class="podium-place ${s.cls}" style="animation-delay:${s.delay}s">
        <div class="podium-player">
          <div class="podium-emoji">${s.player.emoji}</div>
          <div class="podium-name">${s.player.name}${!s.player.isAI ? ' 🌟' : ''}</div>
          <div class="podium-score">${s.player.score.toLocaleString()} pts</div>
        </div>
        <div class="podium-block">${s.label}</div>
      </div>`).join('');

    // Full standings
    $('final-list').innerHTML = sorted.map((p, i) => `
      <div class="final-row${p.isAI ? '' : ' is-you'}" style="animation-delay:${i*0.07}s">
        <span class="final-pos">${i + 1}</span>
        <span class="final-name">${p.emoji} ${p.name}${!p.isAI ? ' (You)' : ''}</span>
        <span class="final-score">${p.score.toLocaleString()} pts</span>
      </div>`).join('');

    this._startConfetti();
  }

  // ── CONFETTI ────────────────────────────────────────────────────────────────
  _startConfetti() {
    const canvas = $('confetti-canvas');
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
        p.x   += p.vx;
        p.y   += p.vy;
        p.rot += p.rv;
        if (p.y > canvas.height + 20) {
          p.y = -20;
          p.x = Math.random() * canvas.width;
        }
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

  // ── PUBLIC: toggle mute ────────────────────────────────────────────────────
  toggleMute() {
    const muted = this.audio.toggleMute();
    document.querySelectorAll('.mute-btn').forEach(b => {
      b.textContent = muted ? '🔇' : '🔊';
    });
    // Restart lobby music if unmuting on home/lobby
    if (!muted && (this.state === 'home' || this.state === 'lobby' || this.state === 'name')) {
      this.audio.playLobbyMusic();
    }
  }

  // ── RESTART ────────────────────────────────────────────────────────────────
  restart() {
    cancelAnimationFrame(this._timerRAF);
    this._aiTimers.forEach(t => clearTimeout(t));
    this.audio.stopAll();
    this.audio.playLobbyMusic();
    this.showScreen('home');
  }
}

// ── Bootstrap ────────────────────────────────────────────────────────────────
const game = new QuizGame();

window.addEventListener('DOMContentLoaded', () => game.init());

// Keyboard: Enter to confirm name
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && game.state === 'name') game.joinGame();
});

// Keyboard 1–4 to select answers
document.addEventListener('keydown', e => {
  if (game.state !== 'question') return;
  const map = { '1': 0, '2': 1, '3': 2, '4': 3 };
  if (map[e.key] !== undefined) game._selectAnswer(map[e.key]);
});

// Handle window resize for confetti canvas
window.addEventListener('resize', () => {
  const c = document.getElementById('confetti-canvas');
  if (c) { c.width = window.innerWidth; c.height = window.innerHeight; }
});
