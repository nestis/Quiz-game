/**
 * QuizBlitz – Online Multiplayer Controller
 *
 * Owns the Socket.io connection and drives all real-time game screens.
 * - Host:   select a game → enter name → creates session → lobby as admin
 * - Player: enter PIN + name → lobby as player
 *
 * Admin controls: Start, Next Question, End Game
 * Server owns the reveal timer; clients just render what they receive.
 */

const ANSWER_STYLES = [
  { cls: 'ans-red',    icon: '▲' },
  { cls: 'ans-blue',   icon: '◆' },
  { cls: 'ans-yellow', icon: '●' },
  { cls: 'ans-green',  icon: '■' },
];

const _$  = id => document.getElementById(id);
const esc = str => { const d = document.createElement('div'); d.textContent = str || ''; return d.innerHTML; };

class Multiplayer {
  constructor() {
    this.socket      = null;
    this.pin         = null;
    this.isAdmin     = false;
    this.gameName    = '';
    this.players     = [];

    // Host flow: set before going to name screen
    this.pendingGameId = null;

    // Current question state
    this._qData      = null;
    this._answered   = false;
    this._timerRAF   = null;
    this._timerStart = 0;
    this._C          = 2 * Math.PI * 52; // svg circumference
  }

  // ── Connection ──────────────────────────────────────────────────────────────

  _connect() {
    if (this.socket?.connected) return;
    this.socket = io();   // connects to same origin
    this._bind();
  }

  _bind() {
    const s = this.socket;

    s.on('room-joined', ({ pin, gameName, isAdmin, players }) => {
      this.pin      = pin;
      this.isAdmin  = isAdmin;
      this.gameName = gameName;
      this.players  = players;
      this._showLobby();
    });

    s.on('players-updated', ({ players }) => {
      this.players = players;
      if (game.state === 'lobby') this._renderLobbyPlayers();
    });

    s.on('game-starting', () => {
      game.audio.stopAll();
      this._countdown();
    });

    s.on('show-question', qData => {
      this._qData    = qData;
      this._answered = false;
      this._renderQuestion(qData);
    });

    s.on('answer-count', ({ answered, total }) => {
      if (this.isAdmin) {
        const el = _$('admin-answer-count');
        if (el) { el.textContent = `${answered} / ${total} answered`; el.classList.remove('hidden'); }
      }
    });

    s.on('answer-revealed', ({ correct, correctText, players }) => {
      const me = this.players.find(p => p.id === this.socket.id);
      const prevScore = me?.score ?? 0;
      this.players = players;
      const newScore = players.find(p => p.id === this.socket.id)?.score ?? 0;
      this._revealAnswer(correct, correctText, newScore - prevScore);
    });

    s.on('show-scoreboard', ({ players, isLast }) => {
      this.players = players;
      this._renderScoreboard(isLast);
    });

    s.on('game-over', ({ players }) => {
      this.players = players;
      this._renderWinner();
    });

    s.on('promoted-to-admin', () => {
      this.isAdmin = true;
      this._toast('You are now the host! 👑');
      // If on scoreboard, show admin controls
      if (game.state === 'scoreboard') {
        const ctrl = _$('admin-next-controls');
        if (ctrl) ctrl.classList.remove('hidden');
      }
    });

    s.on('join-error', ({ message }) => this._toast(message, true));

    s.on('disconnect', () => {
      if (!['home', 'join', 'select', 'name'].includes(game.state)) {
        this._toast('Connection lost – please refresh.', true);
      }
    });
  }

  // ── Host flow ───────────────────────────────────────────────────────────────

  /** Called when admin clicks "Host" on a game card */
  beginHostFlow(gameId) {
    this.pendingGameId = gameId;
    _$('name-screen-title').textContent = 'Your host name';
    _$('player-name').value = '';
    game.showScreen('name');
    setTimeout(() => _$('player-name').focus(), 120);
  }

  /** Called when admin submits their name on the name screen */
  async startHostFlow() {
    const name = (_$('player-name')?.value || '').trim();
    if (!name) { _$('player-name').classList.remove('shake'); void _$('player-name').offsetWidth; _$('player-name').classList.add('shake'); return; }

    const session = await API.createSession(this.pendingGameId);
    this.pendingGameId = null;

    game.audio.init(); game.audio.resume();
    if (!game.audio.muted) game.audio.playLobbyMusic();

    this._connect();
    this.socket.emit('join-room', { pin: session.pin, name, emoji: '👑' });
  }

  // ── Player join flow ────────────────────────────────────────────────────────

  goToJoin() {
    game.showScreen('join');
    setTimeout(() => _$('join-pin')?.focus(), 120);
  }

  // Pre-fill PIN from URL ?pin= parameter and open the join screen
  checkUrlPin() {
    const params = new URLSearchParams(window.location.search);
    const pin = params.get('pin');
    if (!pin) return;
    // Strip the param from the URL without reloading
    const clean = window.location.pathname + window.location.hash;
    history.replaceState(null, '', clean);
    // Open join screen with PIN pre-filled
    this.goToJoin();
    const el = _$('join-pin');
    if (el) { el.value = pin.replace(/\s/g, ''); }
    _$('join-name')?.focus();
  }

  playerJoin() {
    const pin  = (_$('join-pin')?.value || '').replace(/\s/g, '');
    const name = (_$('join-name')?.value || '').trim();

    const pinEl  = _$('join-pin');
    const nameEl = _$('join-name');
    if (pin.length < 4)  { pinEl.classList.remove('shake');  void pinEl.offsetWidth;  pinEl.classList.add('shake');  return; }
    if (!name)            { nameEl.classList.remove('shake'); void nameEl.offsetWidth; nameEl.classList.add('shake'); return; }

    game.audio.init(); game.audio.resume();
    if (!game.audio.muted) game.audio.playLobbyMusic();

    this._connect();
    this.socket.emit('join-room', { pin, name, emoji: '😊' });
  }

  // ── Lobby ───────────────────────────────────────────────────────────────────

  _showLobby() {
    _$('game-pin').textContent       = this.pin.replace(/(\d{3})(\d{3})/, '$1 $2');
    _$('lobby-game-name').textContent = this.gameName;

    // Show the join link
    const joinUrl = `${location.origin}${location.pathname}?pin=${this.pin}`;
    const linkEl = _$('lobby-join-link');
    if (linkEl) { linkEl.value = joinUrl; }

    // Start button visible only to admin
    const startBtn = _$('start-btn');
    startBtn.style.display = this.isAdmin ? '' : 'none';
    startBtn.onclick = () => this.adminStart();

    _$('lobby-waiting-msg').style.display = this.isAdmin ? 'none' : '';

    this._renderLobbyPlayers();
    game.showScreen('lobby');
  }

  copyJoinLink() {
    const linkEl = _$('lobby-join-link');
    if (!linkEl) return;
    linkEl.select();
    navigator.clipboard?.writeText(linkEl.value).catch(() => document.execCommand('copy'));
    const btn = _$('copy-link-btn');
    if (btn) { btn.textContent = '✓ Copied!'; setTimeout(() => { btn.textContent = '🔗 Copy link'; }, 2000); }
  }

  _renderLobbyPlayers() {
    _$('lobby-players').innerHTML = this.players.map(p => `
      <div class="lobby-player ${p.isAdmin ? 'human' : ''}">
        <span class="player-emoji">${p.emoji}</span>
        <span class="player-name">${esc(p.name)}${p.isAdmin ? ' 👑' : ''}</span>
      </div>`).join('');
    const n = this.players.length;
    _$('player-count').textContent = `${n} player${n !== 1 ? 's' : ''} joined`;
  }

  adminStart() {
    if (!this.isAdmin) return;
    this.socket.emit('start-game', { pin: this.pin });
  }

  // ── Countdown ───────────────────────────────────────────────────────────────

  _countdown() {
    game.showScreen('countdown');
    let n = 3;
    const el = _$('countdown-number');
    const tick = () => {
      el.textContent = n > 0 ? n : 'GO! 🚀';
      el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
      game.audio.playCountdownBeep(n);
      if (n-- > 0) setTimeout(tick, 1000);
      // server will send show-question after 3.5s
    };
    tick();
  }

  // ── Question ────────────────────────────────────────────────────────────────

  _renderQuestion(q) {
    game.showScreen('question');
    game.audio.playQuestionMusic(q.timeLimit);

    _$('q-num').textContent      = `Q${q.questionIdx + 1} / ${q.total}`;
    _$('q-cat').textContent      = `${q.emoji} ${q.category}`;
    _$('q-pts').textContent      = '1000 pts';
    _$('q-answered').textContent = '';

    _$('question-text').textContent = q.question;

    // Admin answer-count badge
    const cnt = _$('admin-answer-count');
    if (cnt) { cnt.textContent = `0 / ${this.players.length} answered`; cnt.classList.toggle('hidden', !this.isAdmin); }

    // Build answer grid
    const grid = _$('answers-grid');
    grid.className = `answers-grid${q.type === 'true_false' ? ' tf-grid' : ''}`;
    grid.innerHTML = q.answers.map((ans, i) => {
      const s = ANSWER_STYLES[i];
      return `<button class="answer-btn ${s.cls}" onclick="mp._pick(${i})" style="animation-delay:${i*0.08}s">
        <span class="answer-icon">${s.icon}</span>
        <span class="answer-text">${esc(ans)}</span>
      </button>`;
    }).join('');

    // Reset timer ring
    _$('timer-ring').style.strokeDashoffset = '0';
    _$('timer-ring').style.stroke = '#46c1f6';
    _$('timer-num').textContent = q.timeLimit;
    _$('screen-question').classList.remove('timer-warn', 'timer-danger');
    _$('streak-badge').classList.add('hidden');

    // Visual-only client countdown
    cancelAnimationFrame(this._timerRAF);
    this._timerStart = performance.now();
    this._tickTimer(q.timeLimit);
  }

  _tickTimer(totalSec) {
    const elapsed   = performance.now() - this._timerStart;
    const remaining = Math.max(0, totalSec * 1000 - elapsed);
    const ratio     = remaining / (totalSec * 1000);

    _$('timer-ring').style.strokeDashoffset = this._C * (1 - ratio);
    _$('timer-num').textContent = Math.ceil(remaining / 1000);

    const qs = _$('screen-question');
    if (ratio <= 0.25)     { qs.classList.add('timer-danger'); qs.classList.remove('timer-warn'); }
    else if (ratio <= 0.5) { qs.classList.add('timer-warn');   qs.classList.remove('timer-danger'); }

    if (remaining > 0 && !this._answered)
      this._timerRAF = requestAnimationFrame(() => this._tickTimer(totalSec));
  }

  _pick(idx) {
    if (this._answered || game.state !== 'question') return;
    this._answered = true;
    cancelAnimationFrame(this._timerRAF);

    document.querySelectorAll('.answer-btn').forEach((b, i) => {
      b.disabled = true;
      b.classList.add(i === idx ? 'selected' : 'dimmed');
    });

    const elapsed  = performance.now() - this._timerStart;
    const timeLeft = Math.max(0, this._qData.timeLimit * 1000 - elapsed) / 1000;

    this.socket.emit('submit-answer', {
      pin: this.pin, answerIdx: idx,
      timeLeft, timeLimit: this._qData.timeLimit,
    });
  }

  // ── Answer revealed ─────────────────────────────────────────────────────────

  _revealAnswer(correctIdx, correctText, pointsDelta) {
    cancelAnimationFrame(this._timerRAF);
    game.audio.stopAll();

    const myBtn = [...document.querySelectorAll('.answer-btn')].find(b => b.classList.contains('selected'));
    const myIdx = myBtn ? +myBtn.dataset.idx : null;
    const isCorrect = myIdx !== null && myIdx === correctIdx;

    document.querySelectorAll('.answer-btn').forEach((b, i) => {
      b.disabled = true;
      b.classList.remove('selected', 'dimmed');
      b.classList.add(i === correctIdx ? 'correct-reveal' : 'wrong-reveal');
    });

    if (myIdx === null)   game.audio.playTimeout();
    else if (isCorrect)   game.audio.playCorrect();
    else                  game.audio.playWrong();

    setTimeout(() => {
      let icon, label, cls;
      if (myIdx === null) { icon = '⏱️'; label = "Time's Up!"; cls = 'timeout'; }
      else if (isCorrect) { icon = '✓';  label = 'Correct!';   cls = 'correct'; }
      else                { icon = '✗';  label = 'Wrong!';     cls = 'wrong';   }

      _$('result-icon').textContent  = icon;  _$('result-icon').className  = `result-icon ${cls}`;
      _$('result-label').textContent = label; _$('result-label').className = `result-label ${cls}`;
      _$('result-points').textContent  = isCorrect ? `+${pointsDelta}` : '+0';
      _$('result-streak').textContent  = '';
      _$('correct-answer-text').textContent = correctText;
      game.showScreen('result');
    }, 1800);
  }

  // ── Scoreboard ──────────────────────────────────────────────────────────────

  _renderScoreboard(isLast) {
    game.showScreen('scoreboard');
    game.audio.playScoreboard();

    const myId = this.socket.id;

    _$('scoreboard-list').innerHTML = this.players.map((p, i) => {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`;
      const isMe  = p.id === myId;
      return `<div class="score-entry${isMe ? ' is-you' : ''}" style="animation-delay:${i*0.08}s">
        <span class="score-rank">${medal}</span>
        <span class="score-emoji">${p.emoji}</span>
        <span class="score-name">${esc(p.name)}${isMe ? ' <span style="font-size:12px;color:var(--muted)">(You)</span>' : ''}</span>
        <span class="score-pts">${p.score.toLocaleString()}</span>
      </div>`;
    }).join('');

    // Hide default "next in Xs" countdown – server drives pacing
    const nextTimer = _$('scoreboard-next');
    if (nextTimer) nextTimer.style.display = 'none';

    // Admin controls
    const ctrl   = _$('admin-next-controls');
    const waiting = _$('scoreboard-waiting');
    if (ctrl) {
      ctrl.classList.toggle('hidden', !this.isAdmin);
      const btn = _$('admin-next-btn');
      if (btn) { btn.textContent = isLast ? '🏆 End Game' : 'Next Question →'; btn.dataset.last = isLast; }
    }
    if (waiting) waiting.style.display = this.isAdmin ? 'none' : '';
  }

  nextQuestion() {
    if (!this.isAdmin) return;
    this.socket.emit('next-question', { pin: this.pin });
  }

  endGame() {
    if (!this.isAdmin) return;
    this.socket.emit('end-game', { pin: this.pin });
  }

  adminNextOrEnd() {
    const btn = _$('admin-next-btn');
    btn?.dataset.last === 'true' ? this.endGame() : this.nextQuestion();
  }

  // ── Winner ──────────────────────────────────────────────────────────────────

  _renderWinner() {
    game.showScreen('winner');
    game.audio.playWinner();

    const myId  = this.socket.id;
    const sorted = this.players;

    const slots = [
      { player: sorted[1], cls: 'place-2', label: '🥈 2nd', delay: 0.3 },
      { player: sorted[0], cls: 'place-1', label: '🥇 1st', delay: 0   },
      { player: sorted[2], cls: 'place-3', label: '🥉 3rd', delay: 0.6 },
    ].filter(s => s.player);

    _$('podium-row').innerHTML = slots.map(s => `
      <div class="podium-place ${s.cls}" style="animation-delay:${s.delay}s">
        <div class="podium-player">
          <div class="podium-emoji">${s.player.emoji}</div>
          <div class="podium-name">${esc(s.player.name)}</div>
          <div class="podium-score">${s.player.score.toLocaleString()} pts</div>
        </div>
        <div class="podium-block">${s.label}</div>
      </div>`).join('');

    _$('final-list').innerHTML = sorted.map((p, i) => `
      <div class="final-row${p.id === myId ? ' is-you' : ''}" style="animation-delay:${i*0.07}s">
        <span class="final-pos">${i + 1}</span>
        <span class="final-name">${p.emoji} ${esc(p.name)}${p.id === myId ? ' (You)' : ''}</span>
        <span class="final-score">${p.score.toLocaleString()} pts</span>
      </div>`).join('');

    game._startConfetti();
  }

  // ── Utilities ───────────────────────────────────────────────────────────────

  _toast(msg, isError = false) {
    let t = document.getElementById('mp-toast');
    if (!t) { t = document.createElement('div'); t.id = 'mp-toast'; document.body.appendChild(t); }
    t.textContent = msg;
    t.className   = `admin-toast show${isError ? ' error' : ''}`;
    setTimeout(() => t.classList.remove('show'), 3500);
  }

  goHome() {
    this.socket?.disconnect();
    this.socket    = null;
    this.pin       = null;
    this.isAdmin   = false;
    game.showScreen('home');
  }
}

const mp = new Multiplayer();
