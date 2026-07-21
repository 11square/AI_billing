// ===== Dashboard page =====
const Dashboard = {
  // Selected date for the "Today" panel — defaults to actual today.
  // Kept in local YYYY-MM-DD form so it lines up with the backend anchor.
  _selectedDate: null,

  _todayStr() {
    const d = new Date();
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  },

  _isToday(dateStr) {
    return dateStr === this._todayStr();
  },

  _prettyDate(dateStr) {
    // "20 Jul 2026" style, matches Ui.fmtDate but from YYYY-MM-DD in local time
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric'
    });
  },

  async render(el) {
    if (!this._selectedDate) this._selectedDate = this._todayStr();
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

    const isToday = this._isToday(this._selectedDate);
    const headingLabel = isToday ? "Today's overview" : `Overview · ${this._prettyDate(this._selectedDate)}`;

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

    // ---------- Staff attendance (conditional half-day / sick-leave) ----------
    const att = d.attendance || {
      morningPresent: 0, morningAbsent: 0,
      eveningPresent: 0, eveningAbsent: 0,
      halfDays: 0, sickLeaves: 0
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

    // ---------- Render ----------
    el.innerHTML = `
      <section class="dash-section">
        <div class="dash-section-head">
          <div>
            <h2 class="dash-section-title">${headingLabel}</h2>
            <div class="muted" style="font-size:12.5px">Profit, orders and sales for the selected day</div>
          </div>
          <div class="dash-date-pick">
            <label for="dash-date">Date</label>
            <input id="dash-date" type="date" value="${this._selectedDate}" max="${this._todayStr()}">
          </div>
        </div>
        <div class="stat-grid">
          <div class="stat-card"><div class="stat-ic" style="background:var(--brand-soft)">📈</div><div class="stat-val">${Ui.fmt(d.todayProfit)}</div><div class="stat-lbl">Profit</div></div>
          <div class="stat-card"><div class="stat-ic" style="background:var(--blue-soft)">🧾</div><div class="stat-val">${d.todayInvoiceCount}</div><div class="stat-lbl">Orders</div></div>
          <div class="stat-card"><div class="stat-ic" style="background:var(--green-soft)">💰</div><div class="stat-val">${Ui.fmt(d.todaySales)}</div><div class="stat-lbl">Sales</div></div>
        </div>
      </section>

      <section class="dash-section">
        <div class="dash-section-head">
          <div>
            <h2 class="dash-section-title">Staff attendance</h2>
            <div class="muted" style="font-size:12.5px">${isToday ? 'Today' : this._prettyDate(this._selectedDate)} · morning &amp; evening shifts</div>
          </div>
        </div>
        <div class="stat-grid">
          <div class="stat-card"><div class="stat-ic" style="background:var(--green-soft)">🌅</div><div class="stat-val">${att.morningPresent}</div><div class="stat-lbl">Morning · Present</div></div>
          <div class="stat-card"><div class="stat-ic" style="background:var(--green-soft)">🌆</div><div class="stat-val">${att.eveningPresent}</div><div class="stat-lbl">Evening · Present</div></div>
          <div class="stat-card"><div class="stat-ic" style="background:var(--red-soft)">🌅</div><div class="stat-val">${att.morningAbsent}</div><div class="stat-lbl">Morning · Absent</div></div>
          <div class="stat-card"><div class="stat-ic" style="background:var(--red-soft)">🌆</div><div class="stat-val">${att.eveningAbsent}</div><div class="stat-lbl">Evening · Absent</div></div>
          ${halfDayCard}
          ${sickLeaveCard}
        </div>
      </section>

      <section class="dash-section">
        <div class="dash-section-head">
          <div>
            <h2 class="dash-section-title">Shop status</h2>
            <div class="muted" style="font-size:12.5px">Month-to-date sales and inventory alerts</div>
          </div>
        </div>
        <div class="stat-grid">
          <div class="stat-card"><div class="stat-ic" style="background:var(--green-soft)">🗓️</div><div class="stat-val">${Ui.fmt(d.monthSales)}</div><div class="stat-lbl">This Month · Sales</div></div>
          <div class="stat-card"><div class="stat-ic" style="background:var(--red-soft)">📦</div><div class="stat-val">${d.lowStockCount}</div><div class="stat-lbl">Low Stock Items</div></div>
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

    // Wire up the date picker — re-render this same page on change.
    const dateInput = el.querySelector('#dash-date');
    if (dateInput) {
      dateInput.addEventListener('change', ev => {
        const v = ev.target.value;
        if (!v) return;
        this._selectedDate = v;
        this.render(el);
      });
    }
  }
};
