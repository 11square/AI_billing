// ===== App shell: auth + routing =====
const App = {
  pages: {
    dashboard: { title: 'Dashboard', mod: () => Dashboard },
    pos:       { title: 'Billing / POS', mod: () => Pos },
    invoices:  { title: 'Invoices', mod: () => Invoices },
    menu:      { title: 'Menu Items', mod: () => Menu },
    stock:     { title: 'Stock & Purchase Orders', mod: () => Stock },
    customers: { title: 'Customers', mod: () => Customers },
    staff:     { title: 'Staff & Attendance', mod: () => Staff },
    reports:   { title: 'Reports', mod: () => Reports }
  },
  registerMode: false,

  init() {
    Ui.hydrateIcons();
    document.getElementById('page-date').textContent =
      new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    // login form
    document.getElementById('login-form').addEventListener('submit', e => { e.preventDefault(); this.submitAuth(); });
    document.getElementById('login-toggle-link').addEventListener('click', e => { e.preventDefault(); this.toggleMode(); });
    document.getElementById('btn-logout').addEventListener('click', () => this.logout());
    document.getElementById('btn-new-order').addEventListener('click', () => { location.hash = '#pos'; });
    window.addEventListener('hashchange', () => this.route());

    if (Api.token && Api.user()) this.showApp();
    else this.showLogin();
  },

  // ---------- auth ----------
  toggleMode() {
    this.registerMode = !this.registerMode;
    document.getElementById('login-title').textContent = this.registerMode ? 'Create account' : 'Welcome back';
    document.getElementById('login-sub').textContent = this.registerMode ? 'Set up your staff account' : 'Sign in to start billing';
    document.getElementById('fld-name').style.display = this.registerMode ? '' : 'none';
    document.getElementById('fld-phone').style.display = this.registerMode ? '' : 'none';
    document.getElementById('login-btn').textContent = this.registerMode ? 'Create Account' : 'Sign In';
    document.getElementById('login-toggle-text').textContent = this.registerMode ? 'Already have an account?' : 'New here?';
    document.getElementById('login-toggle-link').textContent = this.registerMode ? 'Sign in' : 'Create an account';
    document.getElementById('login-error').classList.add('hidden');
  },

  async submitAuth() {
    const btn = document.getElementById('login-btn');
    const errEl = document.getElementById('login-error');
    errEl.classList.add('hidden');
    btn.disabled = true;
    btn.textContent = 'Please wait…';
    try {
      const email = document.getElementById('login-email').value.trim();
      const password = document.getElementById('login-password').value;
      let user;
      if (this.registerMode) {
        user = await Api.post('/auth/register', {
          name: document.getElementById('login-name').value.trim(),
          phone: document.getElementById('login-phone').value.trim(),
          email, password
        });
      } else {
        user = await Api.post('/auth/login', { email, password });
      }
      Api.setSession(user);
      this.showApp();
    } catch (e) {
      errEl.textContent = e.message;
      errEl.classList.remove('hidden');
    } finally {
      btn.disabled = false;
      btn.textContent = this.registerMode ? 'Create Account' : 'Sign In';
    }
  },

  logout() {
    Api.clearSession();
    this.showLogin();
  },

  showLogin() {
    document.getElementById('app').classList.add('hidden');
    document.getElementById('login-screen').classList.remove('hidden');
  },

  showApp() {
    const user = Api.user();
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    document.getElementById('user-name').textContent = user.name;
    document.getElementById('user-role').textContent = user.role;
    document.getElementById('user-avatar').textContent = (user.name || 'U')[0].toUpperCase();
    if (!location.hash || !this.pages[location.hash.slice(1)]) location.hash = '#dashboard';
    this.route();
  },

  // ---------- routing ----------
  route() {
    if (!Api.token) return;
    const key = (location.hash || '#dashboard').slice(1);
    const page = this.pages[key] || this.pages.dashboard;
    if (key !== 'pos' && window.Voice) Voice.stop();
    document.querySelectorAll('.nav-item').forEach(a => a.classList.toggle('active', a.dataset.page === key));
    document.getElementById('page-title').textContent = page.title;
    document.getElementById('btn-new-order').style.display = key === 'pos' ? 'none' : '';
    page.mod().render(document.getElementById('page'));
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
