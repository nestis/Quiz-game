/**
 * auth.js – frontend authentication module
 * Stores JWT and user info in localStorage; exposes helper methods.
 */
const Auth = (() => {
  const TOKEN_KEY = 'qb_token';
  const USER_KEY  = 'qb_user';

  function getToken() { return localStorage.getItem(TOKEN_KEY); }
  function getUser()  {
    try { return JSON.parse(localStorage.getItem(USER_KEY)); }
    catch { return null; }
  }
  function isLoggedIn() { return !!getToken(); }

  function setSession(token, user) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  function headers() {
    const t = getToken();
    return t ? { Authorization: `Bearer ${t}` } : {};
  }

  async function login(username, password) {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');
    setSession(data.token, data.user);
    return data.user;
  }

  function logout() {
    clearSession();
    window.location.reload();
  }

  // Redirect to login screen if not authenticated
  function requireAuth(onSuccess) {
    if (isLoggedIn()) {
      if (onSuccess) onSuccess(getUser());
    } else {
      showScreen('screen-login');
    }
  }

  return { getToken, getUser, isLoggedIn, headers, login, logout, requireAuth };
})();
