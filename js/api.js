/**
 * QuizBlitz API client
 */
const API = {
  // ── Games ─────────────────────────────────────────────────────────
  async getGames() {
    const r = await fetch('/api/games');
    return r.json();
  },

  async getGame(id) {
    const r = await fetch(`/api/games/${id}`);
    return r.json();
  },

  async createGame(name, description) {
    const r = await fetch('/api/games', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...Auth.headers() },
      body: JSON.stringify({ name, description }),
    });
    if (r.status === 401) { Auth.logout(); return; }
    return r.json();
  },

  async updateGame(id, data) {
    const r = await fetch(`/api/games/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...Auth.headers() },
      body: JSON.stringify(data),
    });
    if (r.status === 401) { Auth.logout(); return; }
    return r.json();
  },

  async deleteGame(id) {
    const r = await fetch(`/api/games/${id}`, {
      method: 'DELETE',
      headers: Auth.headers(),
    });
    if (r.status === 401) { Auth.logout(); return; }
    return r.json();
  },

  // ── Questions ─────────────────────────────────────────────────────
  async getQuestions(gameId) {
    const r = await fetch(`/api/games/${gameId}/questions`);
    return r.json();
  },

  async addQuestion(gameId, question) {
    const r = await fetch(`/api/games/${gameId}/questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...Auth.headers() },
      body: JSON.stringify(question),
    });
    if (r.status === 401) { Auth.logout(); return; }
    return r.json();
  },

  async updateQuestion(gameId, questionId, data) {
    const r = await fetch(`/api/games/${gameId}/questions/${questionId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...Auth.headers() },
      body: JSON.stringify(data),
    });
    if (r.status === 401) { Auth.logout(); return; }
    return r.json();
  },

  async deleteQuestion(gameId, questionId) {
    const r = await fetch(`/api/games/${gameId}/questions/${questionId}`, {
      method: 'DELETE',
      headers: Auth.headers(),
    });
    if (r.status === 401) { Auth.logout(); return; }
    return r.json();
  },

  // ── Sessions ──────────────────────────────────────────────────────
  async createSession(gameId) {
    const r = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...Auth.headers() },
      body: JSON.stringify({ gameId }),
    });
    if (r.status === 401) { Auth.logout(); return; }
    return r.json();
  },

  async getSessions() {
    const r = await fetch('/api/sessions');
    return r.json();
  },

  async getSessionsByGame(gameId) {
    const r = await fetch(`/api/sessions/game/${gameId}`);
    return r.json();
  },

  async getSession(id) {
    const r = await fetch(`/api/sessions/${id}`);
    return r.json();
  },

  async getPlayers(sessionId) {
    const r = await fetch(`/api/sessions/${sessionId}/players`);
    return r.json();
  },

  async finishSession(sessionId, players) {
    const r = await fetch(`/api/sessions/${sessionId}/finish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ players }),
    });
    return r.json();
  },

  // ── Admin users ───────────────────────────────────────────────────
  async getAdminUsers() {
    const r = await fetch('/api/auth/users', { headers: Auth.headers() });
    if (r.status === 401) { Auth.logout(); return []; }
    return r.json();
  },

  async createAdminUser(username, password) {
    const r = await fetch('/api/auth/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...Auth.headers() },
      body: JSON.stringify({ username, password }),
    });
    if (r.status === 401) { Auth.logout(); return; }
    return r.json();
  },

  async deleteAdminUser(id) {
    const r = await fetch(`/api/auth/users/${id}`, {
      method: 'DELETE',
      headers: Auth.headers(),
    });
    if (r.status === 401) { Auth.logout(); return; }
    return r.json();
  },

  async changePassword(currentPassword, newPassword) {
    const r = await fetch('/api/auth/password', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...Auth.headers() },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    if (r.status === 401) { Auth.logout(); return; }
    return r.json();
  },
};
