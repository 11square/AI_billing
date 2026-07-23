// ===== Dashboard page =====
const Dashboard = {
  _selectedDate: null,
  // Per-card period selection (Profit / Orders / Sales boxes).
  // Defaults to 'day' so the initial render matches the picked date.
  _cardPeriod: { profit: 'day', orders: 'day', sales: 'day' },
  // Cached quick-stats values keyed by "period|date" so we don't refetch
  // when the user just re-opens the menu on the same card.
  _quickCache: {},

  PERIOD_LABELS: {
    day: 'Day', week: 'Week', month: 'Month', year: 'Year', fy: 'Financial Year'
  },

  _todayStr() {
    const d = new Date();
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  },
  _isToday(dateStr) { return dateStr === this._todayStr(); },
  _prettyDate(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  },

  async render(el) {
    if (!this._selectedDate) this._selectedDate = this._todayStr();
    this._cleanupMetricHandlers();
    el.innerHTML = '<div class="loader"></div>';

    let d, daily;
    try {
      [d, daily] = await Promise.all([
        Api.get(`/reports/dashboard?shopType=grocery&date=${this._selectedDate}`),
        Api.get(`/reports/daily?shopType=grocery&date=${this._selectedDate}`)
      ]);
    } catch (e) {
      el.innerHTML = `<div class="empty-state"><div class="big">⚠️</div><h3>Could not load dashboard</h3><p>${Ui.esc(e.message)}</p></div>`;
      return;
    }

    // Prime the cache with the values the dashboard endpoint already gave us
    // for period=day, so the first render doesn't need a second fetch.
    const dayKey = `day|${this._selectedDate}`;
    this._quickCache[dayKey] = {
      sales: d.todaySales, orders: d.todayInvoiceCount, profit: d.todayProfit,
      label: this._prettyDate(this._selectedDate)
    };

    const isToday = this._isToday(this._selectedDate);
    const headingLabel = isToday ? 'Business snapshot' : `Business snapshot · ${this._prettyDate(this._selectedDate)}`;

    // ---------- Weekly chart ----------
    const maxAmt = Math.max(...d.weeklyChart.map(x => x.amount), 1);
    const bars = d.weeklyChart.map(x => `
      <div class="bar-wrap">
        <div class="bar" style="height:${Math.max((x.amount / maxAmt) * 100, 2)}%" data-val="${Ui.fmt(x.amount)}"></div>
        <div class="bar-lbl">${x.day}</div>
      </div>`).join('');

    // ---------- Recent orders ----------
    const recent = d.recentInvoices.length ? d.recentInvoices.map(inv => `
      <tr>
        <td><b>${Ui.esc(inv.invoiceNumber)}</b><div class="muted">${Ui.fmtDate(inv.createdAt)} · ${Ui.fmtTime(inv.createdAt)}</div></td>
        <td>${Ui.esc(inv.customerName)}</td>
        <td><b>${Ui.fmt(inv.grandTotal)}</b></td>
        <td><span class="badge ${inv.paymentStatus}">${inv.paymentStatus}</span></td>
      </tr>`).join('') : '<tr><td colspan="4" class="muted" style="text-align:center;padding:30px">No orders yet — create your first bill from the POS 🍽️</td></tr>';

    // ---------- Top sellers ----------
    const top = daily.topProducts.length ? daily.topProducts.slice(0, 6).map((p, i) => `
      <div class="list-row">
        <span><span class="rank">${i + 1}</span>${Ui.esc(p.name)}</span>
        <span><b>${p.quantity}</b> sold · ${Ui.fmt(p.total)}</span>
      </div>`).join('') : '<div class="empty-state" style="padding:26px"><div class="big">🥐</div>Nothing sold on this day</div>';

    // ---------- Staff attendance (2 headline boxes + conditional half-day/sick-leave) ----------
    const att = d.attendance || {
      presentStaff: 0, absentStaff: 0, halfDays: 0, sickLeaves: 0
    };
    const halfDayCard = att.halfDays > 0 ? `
      <div class="stat-card">
        <div class="stat-ic" style="background:var(--amber-soft)">🌓</div>
        <div class="stat-val">${att.halfDays}</div>
        <div class="stat-lbl">Half Days</div>
      </div>` : '';
    const sickLeaveCard = att.sickLeaves > 0 ? `
      <div class="stat-card">
        <div class="stat-ic" style="background:var(--red-soft)">🤒</div>
        <div class="stat-val">${att.sickLeaves}</div>
        <div class="stat-lbl">Sick Leaves</div>
      </div>` : '';

    // ---------- Metric card with period switcher ----------
    // Each metric card carries its own picker; the picker only pops open on
    // hover (desktop) or click (touch), so the row stays clean.
    const metricCard = (key, icon, iconBg, valueHtml) => {
      const period = this._cardPeriod[key] || 'day';
      const pretty = this.PERIOD_LABELS[period];
      const opts = Object.entries(this.PERIOD_LABELS).map(([k, lbl]) =>
        `<button class="metric-opt ${k === period ? 'active' : ''}" data-p="${k}">${lbl}</button>`
      ).join('');
      return `
        <div class="stat-card metric-card" data-metric="${key}">
          <div class="metric-head">
            <div class="stat-ic" style="background:${iconBg}">${icon}</div>
            <button type="button" class="metric-toggle" title="Change period">${pretty} ▾</button>
          </div>
          <div class="stat-val" data-role="value">${valueHtml}</div>
          <div class="stat-lbl">${this._metricLabel(key)}</div>
          <div class="metric-menu" hidden>
            <div class="metric-menu-title">Show ${this._metricLabel(key).toLowerCase()} for</div>
            ${opts}
          </div>
        </div>`;
    };

    // ---------- Render ----------
    el.innerHTML = `
      <section class="dash-section">
        <div class="dash-section-head">
          <div>
            <h2 class="dash-section-title">${headingLabel}</h2>
            <div class="muted" style="font-size:12.5px">Sales, profit, orders (tap the ▾ on any card to switch period) · low-stock alerts</div>
          </div>
          <div class="dash-date-pick">
            <label for="dash-date">Date</label>
            <input id="dash-date" type="date" value="${this._selectedDate}" max="${this._todayStr()}">
          </div>
        </div>
        <div class="stat-grid stat-grid-4">
          ${metricCard('sales', '💰', 'var(--green-soft)', Ui.fmt(d.todaySales))}
          ${metricCard('profit', '📈', 'var(--brand-soft)', Ui.fmt(d.todayProfit))}
          ${metricCard('orders', '🧾', 'var(--blue-soft)', d.todayInvoiceCount)}
          <a href="#stock" class="stat-card low-stock-card" title="See what needs restocking">
            <div class="stat-ic" style="background:var(--red-soft)">📦</div>
            <div class="stat-val">${d.lowStockCount}</div>
            <div class="stat-lbl">Products low on stock</div>
            <div class="muted" style="font-size:11px;margin-top:4px">${d.lowStockCount > 0 ? 'Tap to restock →' : 'All well stocked'}</div>
          </a>
        </div>
      </section>

      <section class="dash-section">
        <div class="dash-section-head">
          <div>
            <h2 class="dash-section-title">Staff attendance</h2>
            <div class="muted" style="font-size:12.5px">${isToday ? 'Today' : this._prettyDate(this._selectedDate)}</div>
          </div>
        </div>
        <div class="stat-grid">
          <div class="stat-card"><div class="stat-ic" style="background:var(--green-soft)">✅</div><div class="stat-val">${att.presentStaff}</div><div class="stat-lbl">Present</div></div>
          <div class="stat-card"><div class="stat-ic" style="background:var(--red-soft)">🚫</div><div class="stat-val">${att.absentStaff}</div><div class="stat-lbl">Absent</div></div>
          ${halfDayCard}
          ${sickLeaveCard}
        </div>
      </section>

      <div class="grid-2">
        <div class="card">
          <div class="card-title">Last 7 days sales</div>
          <div class="chart">${bars}</div>
        </div>
        <div class="card">
          <div class="card-title">Top sellers ${isToday ? 'today' : 'on ' + this._prettyDate(this._selectedDate)}</div>
          ${top}
        </div>
      </div>
      <div class="card" style="margin-top:16px">
        <div class="card-title">Recent orders <a href="#invoices" style="font-size:12.5px;color:var(--brand-2)">View all →</a></div>
        <table class="tbl">
          <thead><tr><th>Invoice</th><th>Customer</th><th>Total</th><th>Status</th></tr></thead>
          <tbody>${recent}</tbody>
        </table>
      </div>`;

    // Date picker → full re-render
    el.querySelector('#dash-date')?.addEventListener('change', ev => {
      const v = ev.target.value;
      if (!v) return;
      this._selectedDate = v;
      this.render(el);
    });

    // Wire per-card period switchers
    el.querySelectorAll('.metric-card').forEach(card => this._wireMetricCard(card));
  },

  _metricLabel(key) {
    return ({ profit: 'Profit', orders: 'Orders', sales: 'Sales' })[key] || key;
  },

  // Helper: close every OTHER metric-card menu on the page so only one
  // dropdown is visible at any moment. Also clears their pinned state.
  _closeOtherMetricMenus(exceptCard) {
    document.querySelectorAll('.metric-card').forEach(c => {
      if (c === exceptCard) return;
      const m = c.querySelector('.metric-menu');
      if (m && !m.hidden) m.hidden = true;
      c._clickPinned = false;
    });
  },

  _wireMetricCard(card) {
    const key = card.dataset.metric;
    const menu = card.querySelector('.metric-menu');
    const toggle = card.querySelector('.metric-toggle');
    card._clickPinned = false;   // stored on the node so _closeOtherMetricMenus can reset it

    // Menus are click-only — the earlier hover-to-open behaviour left every
    // card's menu stuck open when the cursor drifted across them.
    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const willOpen = !card._clickPinned;
      this._closeOtherMetricMenus(card);
      card._clickPinned = willOpen;
      menu.hidden = !willOpen;
    });

    // A single shared outside-click listener across every metric card, wired
    // once per Dashboard.render(). Storing the array on `this` makes it easy
    // to detach on the next render so listeners don't accumulate.
    this._metricCloseHandlers = this._metricCloseHandlers || [];
    const closeIfOutside = (e) => {
      if (card._clickPinned && !card.contains(e.target)) {
        card._clickPinned = false;
        menu.hidden = true;
      }
    };
    document.addEventListener('click', closeIfOutside);
    this._metricCloseHandlers.push(closeIfOutside);

    menu.querySelectorAll('.metric-opt').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const period = btn.dataset.p;
        this._cardPeriod[key] = period;
        menu.querySelectorAll('.metric-opt').forEach(b => b.classList.toggle('active', b === btn));
        toggle.textContent = this.PERIOD_LABELS[period] + ' ▾';
        card._clickPinned = false;
        menu.hidden = true;
        await this._refreshMetric(card, key, period);
      });
    });
  },

  // Detach any doc-level click handlers from the previous render so they
  // don't pile up as the dashboard refreshes.
  _cleanupMetricHandlers() {
    (this._metricCloseHandlers || []).forEach(h => document.removeEventListener('click', h));
    this._metricCloseHandlers = [];
  },

  // Fetch (or reuse cached) quick-stats for the picked period and swap the
  // headline value on that one card.
  async _refreshMetric(card, key, period) {
    const cacheKey = `${period}|${this._selectedDate}`;
    const valueEl = card.querySelector('[data-role="value"]');
    valueEl.classList.add('metric-loading');
    try {
      let stats = this._quickCache[cacheKey];
      if (!stats) {
        stats = await Api.get(`/reports/quick-stats?shopType=grocery&period=${period}&date=${this._selectedDate}`);
        this._quickCache[cacheKey] = stats;
      }
      const rendered =
        key === 'orders' ? String(stats.orders) :
        Ui.fmt(key === 'sales' ? stats.sales : stats.profit);
      valueEl.textContent = rendered;
    } catch (e) {
      Ui.toast('Could not load period stats: ' + e.message, 'error');
    } finally {
      valueEl.classList.remove('metric-loading');
    }
  }
};
