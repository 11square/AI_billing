// ===== API client =====
const Api = {
  token: localStorage.getItem('cafe_token') || null,

  setSession(user) {
    this.token = user.token;
    localStorage.setItem('cafe_token', user.token);
    localStorage.setItem('cafe_user', JSON.stringify(user));
  },

  clearSession() {
    this.token = null;
    localStorage.removeItem('cafe_token');
    localStorage.removeItem('cafe_user');
  },

  user() {
    try { return JSON.parse(localStorage.getItem('cafe_user')); } catch { return null; }
  },

  async request(method, url, body) {
    const opts = { method, headers: {} };
    if (this.token) opts.headers['Authorization'] = `Bearer ${this.token}`;
    if (body !== undefined) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    const res = await fetch(`/api${url}`, opts);
    if (res.status === 401 && !url.startsWith('/auth/login') && !url.startsWith('/auth/register')) {
      this.clearSession();
      window.App && window.App.showLogin();
      throw new Error('Session expired. Please sign in again.');
    }
    let data = null;
    try { data = await res.json(); } catch { /* empty body */ }
    if (!res.ok) throw new Error((data && data.message) || `Request failed (${res.status})`);
    return data;
  },

  get(url) { return this.request('GET', url); },
  post(url, body) { return this.request('POST', url, body); },
  put(url, body) { return this.request('PUT', url, body); },
  del(url) { return this.request('DELETE', url); }
};
