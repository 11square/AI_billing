// ===== Reports page =====
const Reports = {
  tab: 'generated',

  render(el) {
    el.innerHTML = `
      <div class="rep-tabs" id="rep-tabs">
        <button class="rep-tab ${this.tab === 'generated' ? 'active' : ''}" data-t="generated">🗂️ Daily Reports</button>
        <button class="rep-tab ${this.tab === 'daily' ? 'active' : ''}" data-t="daily">📅 Day Analytics</button>
        <button class="rep-tab ${this.tab === 'monthly' ? 'active' : ''}" data-t="monthly">🗓️ Monthly</button>
        <button class="rep-tab ${this.tab === 'stock' ? 'active' : ''}" data-t="stock">📦 Stock</button>
      </div>
      <div id="rep-body"><div class="loader"></div></div>`;
    el.querySelector('#rep-tabs').addEventListener('click', e => {
      const b = e.target.closest('.rep-tab'); if (!b) return;
      this.tab = b.dataset.t;
      el.querySelectorAll('.rep-tab').forEach(x => x.classList.toggle('active', x === b));
      this.loadTab();
    });
    this.loadTab();
  },

  loadTab() {
    const box = document.getElementById('rep-body');
    if (!box) return;
    if (this.tab === 'generated') this.generated(box);
    else if (this.tab === 'daily') this.daily(box);
    else if (this.tab === 'monthly') this.monthly(box);
    else this.stock(box);
  },

  // ---------- GENERATED DAILY REPORTS ----------
  async generated(box) {
    box.innerHTML = '<div class="loader"></div>';
    let schedule, reports;
    try {
      [schedule, reports] = await Promise.all([Api.get('/reports/schedule'), Api.get('/reports/generated')]);
    } catch (e) { box.innerHTML = `<div class="empty-state">${Ui.esc(e.message)}</div>`; return; }

    const pad = n => String(n).padStart(2, '0');
    const now = new Date();
    const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);
    const dstr = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    box.innerHTML = `
      <div class="grid-2" style="margin-bottom:16px">
        <div class="card">
          <div class="card-title">⏰ Auto report schedule</div>
          <p class="muted" style="margin-bottom:12px;line-height:1.6">A full business report for the <b>previous day</b> is generated automatically every day at this time.</p>
          <div class="toolbar" style="margin:0">
            <input type="time" class="date-input" id="rg-time" value="${Ui.esc(schedule.time)}"/>
            <button class="btn btn-primary" id="rg-save-time">Save Time</button>
          </div>
        </div>
        <div class="card">
          <div class="card-title">⚡ Generate now</div>
          <div class="toolbar" style="margin:0 0 10px">
            <input type="date" class="date-input" id="rg-date" value="${dstr(yesterday)}" max="${dstr(now)}"/>
            <button class="btn btn-green" id="rg-gen-day">Generate for Day</button>
          </div>
          <details>
            <summary style="cursor:pointer;font-weight:700;font-size:12.5px;color:var(--brand-2);margin-bottom:8px">Custom date &amp; time range</summary>
            <div class="toolbar" style="margin:8px 0 0">
              <input type="datetime-local" class="date-input" id="rg-start"/>
              <span class="muted">to</span>
              <input type="datetime-local" class="date-input" id="rg-end"/>
              <button class="btn btn-green btn-sm" id="rg-gen-range">Generate Range</button>
            </div>
          </details>
        </div>
      </div>
      <div class="card" style="padding:8px 6px">
        <div id="rg-list">
        ${reports.length ? `
          <table class="tbl">
            <thead><tr><th>Report for</th><th>Period</th><th>Generated</th><th>Type</th><th>Billed</th><th>Collected</th><th style="text-align:right">Actions</th></tr></thead>
            <tbody>${reports.map(r => `
              <tr>
                <td><b>${Ui.fmtDate(r.reportDate)}</b></td>
                <td class="muted">${Ui.fmtTime(r.periodStart)} → ${Ui.fmtTime(r.periodEnd)}</td>
                <td class="muted">${Ui.fmtDate(r.created_at)} ${Ui.fmtTime(r.created_at)}</td>
                <td><span class="badge ${r.trigger === 'auto' ? 'paid' : 'partial'}">${r.trigger === 'auto' ? '⏰ auto' : '⚡ manual'}</span></td>
                <td><b>${Ui.fmt(r.data.totalBilled)}</b></td>
                <td>${Ui.fmt(r.data.amountCollected)}</td>
                <td style="text-align:right"><button class="btn btn-ghost btn-sm" data-view="${r.id}">View</button></td>
              </tr>`).join('')}</tbody>
          </table>` : '<div class="empty-state"><div class="big">🗂️</div><h3>No reports yet</h3><p>Reports auto-generate daily, or click Generate for Day</p></div>'}
        </div>
      </div>`;

    box.querySelector('#rg-save-time').addEventListener('click', async () => {
      try {
        const r = await Api.put('/reports/schedule', { time: box.querySelector('#rg-time').value });
        Ui.toast(`Auto report time set to ${r.time}`);
      } catch (e) { Ui.toast(e.message, 'error'); }
    });
    box.querySelector('#rg-gen-day').addEventListener('click', async () => {
      try {
        const report = await Api.post('/reports/generate', { date: box.querySelector('#rg-date').value });
        Ui.toast('Report generated');
        this.viewReport(report);
        this.generated(box);
      } catch (e) { Ui.toast(e.message, 'error'); }
    });
    box.querySelector('#rg-gen-range').addEventListener('click', async () => {
      const start = box.querySelector('#rg-start').value, end = box.querySelector('#rg-end').value;
      if (!start || !end) { Ui.toast('Pick both start and end date-time', 'error'); return; }
      try {
        const report = await Api.post('/reports/generate', { start, end });
        Ui.toast('Report generated');
        this.viewReport(report);
        this.generated(box);
      } catch (e) { Ui.toast(e.message, 'error'); }
    });
    box.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => {
      const r = reports.find(x => x.id === parseInt(b.dataset.view));
      this.viewReport(r);
    }));
  },

  reportHtml(r) {
    const d = r.data;
    const srcRow = (label, s, cls) => `
      <div class="list-row"><span><span class="src-badge ${cls}">${label}</span></span>
      <span><b>${s.qty}</b> items · <b>${Ui.fmt(s.amount)}</b></span></div>`;
    return `
      <div class="rep-doc">
        <div class="r-center" style="text-align:center;margin-bottom:12px">
          <h2 style="font-size:18px">🍞 Amman Bakes — Daily Business Report</h2>
          <div class="muted">${Ui.fmtDate(r.reportDate)} · ${Ui.fmtTime(r.periodStart)} → ${Ui.fmtTime(r.periodEnd)} · generated ${Ui.fmtDate(r.created_at)} ${Ui.fmtTime(r.created_at)} (${r.trigger})</div>
        </div>
        <div class="pay-summary">
          <div class="tot-row"><span>Total orders</span><span><b>${d.totalInvoices}</b>${d.cancelledInvoices ? ` <span class="muted">(+${d.cancelledInvoices} cancelled)</span>` : ''}</span></div>
          <div class="tot-row"><span>Total items billed</span><span><b>${d.totalItemsBilled}</b></span></div>
          <div class="tot-row"><span>Subtotal</span><span>${Ui.fmt(d.subTotal)}</span></div>
          <div class="tot-row"><span>Discount</span><span>− ${Ui.fmt(d.discount)}</span></div>
          <div class="tot-row grand"><span>Total billed</span><span>${Ui.fmt(d.totalBilled)}</span></div>
          <div class="tot-row"><span>💰 Amount collected</span><span><b>${Ui.fmt(d.amountCollected)}</b> <span class="muted">(cash ${Ui.fmt(d.paymentBreakdown.cash)} · upi ${Ui.fmt(d.paymentBreakdown.upi)} · card ${Ui.fmt(d.paymentBreakdown.card)})</span></span></div>
          <div class="tot-row"><span>📒 Credit given</span><span>${Ui.fmt(d.creditGiven)}</span></div>
        </div>
        <h4 style="margin:14px 0 6px">Own vs Outsourced</h4>
        ${srcRow('🏭 Own made', d.own, 'own')}
        ${srcRow('🚚 Outsourced', d.outsourced, 'out')}
        <h4 style="margin:14px 0 6px">BOQ consumed (own production)</h4>
        ${d.boqConsumption.length ? `
          <table class="tbl"><thead><tr><th>Ingredient</th><th style="text-align:right">Total used</th></tr></thead>
          <tbody>${d.boqConsumption.map(b => `<tr><td>${Ui.esc(b.ingredient)}</td><td style="text-align:right"><b>${b.qty}</b> ${Ui.esc(b.unit)}</td></tr>`).join('')}</tbody></table>`
        : '<div class="muted" style="padding:6px 0">No BOQ data for items sold in this period.</div>'}
        <h4 style="margin:14px 0 6px">Item-wise sales</h4>
        <table class="tbl"><thead><tr><th>Item</th><th>Qty</th><th style="text-align:right">Amount</th></tr></thead>
        <tbody>
          ${[...d.own.items.map(i => ({ ...i, src: '🏭' })), ...d.outsourced.items.map(i => ({ ...i, src: '🚚' }))]
            .sort((a, b) => b.qty - a.qty)
            .map(i => `<tr><td>${i.src} ${Ui.esc(i.name)}</td><td>${i.qty}</td><td style="text-align:right">${Ui.fmt(i.amount)}</td></tr>`).join('')
            || '<tr><td colspan="3" class="muted">No sales in this period</td></tr>'}
        </tbody></table>
      </div>`;
  },

  viewReport(r) {
    const html = this.reportHtml(r);
    const m = Ui.modal({
      title: `Daily Report · ${Ui.fmtDate(r.reportDate)}`,
      wide: true,
      body: html,
      foot: `<button class="btn btn-ghost" id="rv-close">Close</button>
             <button class="btn btn-primary" id="rv-print"><span data-icon="print"></span> Print</button>`
    });
    m.el.querySelector('#rv-close').addEventListener('click', m.close);
    m.el.querySelector('#rv-print').addEventListener('click', () => Ui.printHtml(html));
  },

  async daily(box, date) {
    const today = new Date().toISOString().slice(0, 10);
    date = date || today;
    box.innerHTML = `
      <div class="toolbar"><input type="date" class="date-input" id="rd-date" value="${date}" max="${today}"/></div>
      <div id="rd-out"><div class="loader"></div></div>`;
    box.querySelector('#rd-date').addEventListener('change', e => this.daily(box, e.target.value));
    let r;
    try { r = await Api.get(`/reports/daily?shopType=grocery&date=${date}`); }
    catch (e) { box.querySelector('#rd-out').innerHTML = `<div class="empty-state">${Ui.esc(e.message)}</div>`; return; }
    const top = r.topProducts.length ? r.topProducts.map((p, i) => `
      <div class="list-row"><span><span class="rank">${i + 1}</span>${Ui.esc(p.name)}</span><span><b>${p.quantity}</b> sold · ${Ui.fmt(p.total)}</span></div>`).join('')
      : '<div class="empty-state" style="padding:26px"><div class="big">☕</div>No sales on this day</div>';
    box.querySelector('#rd-out').innerHTML = `
      <div class="stat-grid">
        <div class="stat-card"><div class="stat-ic" style="background:var(--green-soft)">💰</div><div class="stat-val">${Ui.fmt(r.totalSales)}</div><div class="stat-lbl">Total Sales</div></div>
        <div class="stat-card"><div class="stat-ic" style="background:var(--blue-soft)">🧾</div><div class="stat-val">${r.invoiceCount}</div><div class="stat-lbl">Orders</div></div>
        <div class="stat-card"><div class="stat-ic" style="background:var(--amber-soft)">📒</div><div class="stat-val">${Ui.fmt(r.creditSales)}</div><div class="stat-lbl">Credit Sales</div></div>
      </div>
      <div class="card"><div class="card-title">Top sellers</div>${top}</div>`;
  },

  async monthly(box, month, year) {
    const now = new Date();
    month = month || now.getMonth() + 1;
    year = year || now.getFullYear();
    const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    box.innerHTML = `
      <div class="toolbar">
        <select class="select" id="rm-month">${months.map((mn, i) => `<option value="${i + 1}" ${i + 1 === +month ? 'selected' : ''}>${mn}</option>`).join('')}</select>
        <select class="select" id="rm-year">${[year - 2, year - 1, year, year + 1].filter(y => y <= now.getFullYear()).map(y => `<option ${y === +year ? 'selected' : ''}>${y}</option>`).join('')}</select>
      </div>
      <div id="rm-out"><div class="loader"></div></div>`;
    const reload = () => this.monthly(box, box.querySelector('#rm-month').value, box.querySelector('#rm-year').value);
    box.querySelector('#rm-month').addEventListener('change', reload);
    box.querySelector('#rm-year').addEventListener('change', reload);
    let r;
    try { r = await Api.get(`/reports/monthly?shopType=grocery&month=${month}&year=${year}`); }
    catch (e) { box.querySelector('#rm-out').innerHTML = `<div class="empty-state">${Ui.esc(e.message)}</div>`; return; }
    box.querySelector('#rm-out').innerHTML = `
      <div class="stat-grid">
        <div class="stat-card"><div class="stat-ic" style="background:var(--green-soft)">💰</div><div class="stat-val">${Ui.fmt(r.totalRevenue)}</div><div class="stat-lbl">Revenue</div></div>
        <div class="stat-card"><div class="stat-ic" style="background:var(--blue-soft)">🧾</div><div class="stat-val">${r.totalInvoices}</div><div class="stat-lbl">Orders</div></div>
        <div class="stat-card"><div class="stat-ic" style="background:var(--brand-soft)">📊</div><div class="stat-val">${Ui.fmt(r.avgPerDay)}</div><div class="stat-lbl">Avg / Day</div></div>
        <div class="stat-card"><div class="stat-ic" style="background:var(--red-soft)">📒</div><div class="stat-val">${Ui.fmt(r.creditPending)}</div><div class="stat-lbl">Credit Pending</div></div>
      </div>`;
  },

  async stock(box) {
    box.innerHTML = '<div class="loader"></div>';
    let r;
    try { r = await Api.get('/reports/stock?shopType=grocery'); }
    catch (e) { box.innerHTML = `<div class="empty-state">${Ui.esc(e.message)}</div>`; return; }
    const low = r.lowStockProducts.length ? r.lowStockProducts.map(p => `
      <div class="list-row"><span>${Ui.esc(p.name)}</span><span class="badge partial">${p.stock} left · min ${p.minStock}</span></div>`).join('')
      : '<div class="empty-state" style="padding:26px"><div class="big">✅</div>All items well stocked</div>';
    const out = r.outOfStockProducts.length ? r.outOfStockProducts.map(p => `
      <div class="list-row"><span>${Ui.esc(p.name)}</span><span class="badge unpaid">Out of stock</span></div>`).join('')
      : '<div class="empty-state" style="padding:26px"><div class="big">🎉</div>Nothing is sold out</div>';
    box.innerHTML = `
      <div class="stat-grid">
        <div class="stat-card"><div class="stat-ic" style="background:var(--blue-soft)">🍽️</div><div class="stat-val">${r.totalProducts}</div><div class="stat-lbl">Menu Items</div></div>
        <div class="stat-card"><div class="stat-ic" style="background:var(--amber-soft)">⚠️</div><div class="stat-val">${r.lowStockCount}</div><div class="stat-lbl">Low Stock</div></div>
        <div class="stat-card"><div class="stat-ic" style="background:var(--red-soft)">🚫</div><div class="stat-val">${r.outOfStockCount}</div><div class="stat-lbl">Out of Stock</div></div>
        <div class="stat-card"><div class="stat-ic" style="background:var(--green-soft)">💎</div><div class="stat-val">${Ui.fmt(r.stockValue)}</div><div class="stat-lbl">Stock Value (cost)</div></div>
      </div>
      <div class="grid-2">
        <div class="card"><div class="card-title">Low stock — restock soon</div>${low}</div>
        <div class="card"><div class="card-title">Out of stock</div>${out}</div>
      </div>`;
  }
};
