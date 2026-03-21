/**
 * QuizBlitz – Admin / Game Management UI controller
 */
const $ = id => document.getElementById(id);

class Admin {
  constructor() {
    this._currentGameId = null;
    this._questions = [];
  }

  // ── DASHBOARD ────────────────────────────────────────────────────────────
  async showDashboard() {
    game.showScreen('dashboard');
    $('games-grid').innerHTML = '<div class="loading">Loading games…</div>';

    const games = await API.getGames();
    if (!games.length) {
      $('games-grid').innerHTML = '<div class="empty-state">No games yet. Create your first game!</div>';
      return;
    }

    $('games-grid').innerHTML = games.map(g => `
      <div class="game-card" data-id="${g.id}">
        <div class="game-card-header">
          <h3>${this._esc(g.name)}</h3>
          <span class="game-status status-${g.status || 'draft'}">${g.status || 'draft'}</span>
        </div>
        <p class="game-card-desc">${this._esc(g.description || 'No description')}</p>
        <div class="game-card-meta">
          <span>📝 ${g.questionCount || 0} questions</span>
          <span>🎮 Played ${g.timesPlayed || 0}×</span>
        </div>
        <div class="game-card-actions">
          <button class="btn-sm btn-play" onclick="admin.playGame('${g.id}')">▶ Play</button>
          <button class="btn-sm btn-edit" onclick="admin.editGame('${g.id}')">✏️ Edit</button>
          <button class="btn-sm btn-hist" onclick="admin.showGameHistory('${g.id}')">📊 History</button>
          <button class="btn-sm btn-del"  onclick="admin.deleteGame('${g.id}','${this._esc(g.name)}')">🗑️</button>
        </div>
      </div>
    `).join('');
  }

  // ── CREATE GAME ─────────────────────────────────────────────────────────
  showCreateForm() {
    this._currentGameId = null;
    $('editor-title').textContent = 'Create New Game';
    $('game-name-input').value = '';
    $('game-desc-input').value = '';
    $('editor-questions-section').classList.add('hidden');
    $('delete-game-btn').classList.add('hidden');
    $('game-status-select').value = 'draft';
    game.showScreen('editor');
  }

  async saveGame() {
    const name = $('game-name-input').value.trim();
    const desc = $('game-desc-input').value.trim();
    const status = $('game-status-select').value;
    if (!name) { $('game-name-input').focus(); return; }

    if (this._currentGameId) {
      await API.updateGame(this._currentGameId, { name, description: desc, status });
    } else {
      const g = await API.createGame(name, desc);
      this._currentGameId = g.id;
      $('editor-title').textContent = 'Edit Game';
      $('editor-questions-section').classList.remove('hidden');
      $('delete-game-btn').classList.remove('hidden');
      await API.updateGame(g.id, { status });
    }
    this._showToast('Game saved!');
  }

  async deleteGame(id, name) {
    if (!confirm(`Delete "${name}" and all its questions?`)) return;
    await API.deleteGame(id);
    this.showDashboard();
  }

  // ── EDIT GAME ───────────────────────────────────────────────────────────
  async editGame(id) {
    this._currentGameId = id;
    const g = await API.getGame(id);
    $('editor-title').textContent = 'Edit Game';
    $('game-name-input').value = g.name || '';
    $('game-desc-input').value = g.description || '';
    $('game-status-select').value = g.status || 'draft';
    $('editor-questions-section').classList.remove('hidden');
    $('delete-game-btn').classList.remove('hidden');
    game.showScreen('editor');
    await this.loadQuestions();
  }

  // ── QUESTIONS ───────────────────────────────────────────────────────────
  async loadQuestions() {
    this._questions = await API.getQuestions(this._currentGameId);
    this._renderQuestions();
  }

  _renderQuestions() {
    const list = $('editor-questions-list');
    if (!this._questions.length) {
      list.innerHTML = '<div class="empty-state">No questions yet. Add your first question!</div>';
      return;
    }
    list.innerHTML = this._questions.map((q, i) => `
      <div class="q-card">
        <div class="q-card-num">#${i + 1}</div>
        <div class="q-card-body">
          <div class="q-card-type">${q.emoji || '❓'} ${q.category} · ${q.type === 'true_false' ? 'True/False' : 'Quiz'} · ${q.time}s</div>
          <div class="q-card-text">${this._esc(q.question)}</div>
          <div class="q-card-answers">
            ${q.answers.map((a, j) => `<span class="q-ans ${j === q.correct ? 'q-ans-correct' : ''}">${this._esc(a)}</span>`).join('')}
          </div>
        </div>
        <div class="q-card-actions">
          <button class="btn-icon" onclick="admin.editQuestion(${i})" title="Edit">✏️</button>
          <button class="btn-icon" onclick="admin.deleteQuestion(${i})" title="Delete">🗑️</button>
        </div>
      </div>
    `).join('');
  }

  // Show question modal (add or edit)
  showAddQuestion() {
    this._editingQuestionIdx = null;
    $('qmodal-title').textContent = 'Add Question';
    $('qm-type').value = 'quiz';
    $('qm-category').value = '';
    $('qm-emoji').value = '❓';
    $('qm-question').value = '';
    $('qm-ans1').value = '';
    $('qm-ans2').value = '';
    $('qm-ans3').value = '';
    $('qm-ans4').value = '';
    $('qm-correct').value = '0';
    $('qm-time').value = '20';
    this._toggleTFMode('quiz');
    $('question-modal').classList.remove('hidden');
  }

  editQuestion(idx) {
    const q = this._questions[idx];
    this._editingQuestionIdx = idx;
    $('qmodal-title').textContent = 'Edit Question';
    $('qm-type').value = q.type;
    $('qm-category').value = q.category || '';
    $('qm-emoji').value = q.emoji || '❓';
    $('qm-question').value = q.question;
    $('qm-ans1').value = q.answers[0] || '';
    $('qm-ans2').value = q.answers[1] || '';
    $('qm-ans3').value = q.answers[2] || '';
    $('qm-ans4').value = q.answers[3] || '';
    $('qm-correct').value = String(q.correct);
    $('qm-time').value = String(q.time);
    this._toggleTFMode(q.type);
    $('question-modal').classList.remove('hidden');
  }

  closeQuestionModal() {
    $('question-modal').classList.add('hidden');
  }

  _toggleTFMode(type) {
    const isTF = type === 'true_false';
    $('qm-ans3').parentElement.style.display = isTF ? 'none' : '';
    $('qm-ans4').parentElement.style.display = isTF ? 'none' : '';
    if (isTF) {
      $('qm-ans1').value = $('qm-ans1').value || 'True';
      $('qm-ans2').value = $('qm-ans2').value || 'False';
    }
    // Update correct answer options
    const sel = $('qm-correct');
    sel.innerHTML = isTF
      ? '<option value="0">Answer 1</option><option value="1">Answer 2</option>'
      : '<option value="0">Answer 1</option><option value="1">Answer 2</option><option value="2">Answer 3</option><option value="3">Answer 4</option>';
  }

  async saveQuestion() {
    const type     = $('qm-type').value;
    const isTF     = type === 'true_false';
    const answers  = isTF
      ? [$('qm-ans1').value.trim(), $('qm-ans2').value.trim()]
      : [$('qm-ans1').value.trim(), $('qm-ans2').value.trim(), $('qm-ans3').value.trim(), $('qm-ans4').value.trim()];

    const data = {
      type,
      category: $('qm-category').value.trim() || 'General',
      emoji:    $('qm-emoji').value.trim() || '❓',
      question: $('qm-question').value.trim(),
      answers,
      correct:  Number($('qm-correct').value),
      time:     Number($('qm-time').value) || 20,
    };

    if (!data.question || answers.some(a => !a)) {
      this._showToast('Please fill in all fields', true);
      return;
    }

    if (this._editingQuestionIdx !== null) {
      const q = this._questions[this._editingQuestionIdx];
      await API.updateQuestion(this._currentGameId, q.id, data);
    } else {
      await API.addQuestion(this._currentGameId, data);
    }

    this.closeQuestionModal();
    await this.loadQuestions();
    this._showToast('Question saved!');
  }

  async deleteQuestion(idx) {
    const q = this._questions[idx];
    if (!confirm('Delete this question?')) return;
    await API.deleteQuestion(this._currentGameId, q.id);
    await this.loadQuestions();
  }

  // ── PLAY GAME (from dashboard) ──────────────────────────────────────────
  playGame(gameId) {
    mp.beginHostFlow(gameId);
  }

  // ── HISTORY ─────────────────────────────────────────────────────────────
  async showHistory() {
    game.showScreen('history');
    $('history-list').innerHTML = '<div class="loading">Loading…</div>';
    const sessions = await API.getSessions();
    this._renderHistory(sessions);
  }

  async showGameHistory(gameId) {
    game.showScreen('history');
    $('history-list').innerHTML = '<div class="loading">Loading…</div>';
    const sessions = await API.getSessionsByGame(gameId);
    this._renderHistory(sessions);
  }

  _renderHistory(sessions) {
    if (!sessions.length) {
      $('history-list').innerHTML = '<div class="empty-state">No games played yet.</div>';
      return;
    }

    $('history-list').innerHTML = sessions.map(s => {
      const date = s.finishedAt ? new Date(s.finishedAt).toLocaleDateString() : 'In progress';
      return `
        <div class="history-card">
          <div class="history-card-header">
            <h3>${this._esc(s.gameName || 'Game')}</h3>
            <span class="history-date">${date}</span>
          </div>
          <div class="history-card-body">
            <span>🏆 Winner: <strong>${this._esc(s.winnerName || '—')}</strong></span>
            <span>🎯 Score: <strong>${s.winnerScore != null ? s.winnerScore.toLocaleString() : '—'}</strong></span>
            <span>👥 ${s.playerCount || '?'} players</span>
            <span>📌 PIN: ${s.pin}</span>
          </div>
          <button class="btn-sm btn-hist" onclick="admin.showSessionDetail('${s.id}')">View Details</button>
        </div>`;
    }).join('');
  }

  async showSessionDetail(sessionId) {
    const [session, players] = await Promise.all([
      API.getSession(sessionId),
      API.getPlayers(sessionId),
    ]);
    const sorted = players.sort((a, b) => (a.finalRank || 999) - (b.finalRank || 999));

    $('history-list').innerHTML = `
      <button class="btn-ghost" onclick="admin.showHistory()" style="margin-bottom:16px">← Back to History</button>
      <div class="history-card">
        <div class="history-card-header">
          <h3>${this._esc(session.gameName || 'Game')}</h3>
          <span class="history-date">${session.finishedAt ? new Date(session.finishedAt).toLocaleDateString() : ''}</span>
        </div>
        <h4 style="margin:12px 0 8px">Final Standings</h4>
        <div class="history-standings">
          ${sorted.map((p, i) => `
            <div class="history-player ${p.isAI ? '' : 'is-you'}">
              <span class="hist-rank">${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '#' + (i+1)}</span>
              <span>${p.emoji} ${this._esc(p.name)}${p.isAI ? '' : ' (You)'}</span>
              <span class="hist-score">${(p.score || 0).toLocaleString()} pts</span>
            </div>
          `).join('')}
        </div>
      </div>`;
  }

  // ── Helpers ─────────────────────────────────────────────────────────────
  _esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }

  _showToast(msg, isError) {
    let toast = $('admin-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'admin-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.className = `admin-toast show ${isError ? 'error' : ''}`;
    setTimeout(() => toast.classList.remove('show'), 2500);
  }
}

const admin = new Admin();
