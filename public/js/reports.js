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
        <button class="rep-tab ${this.tab === 'raw' ? 'active' : ''}" data-t="raw">🥣 Raw Materials</button>
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
    else if (this.tab === 'raw') this.raw(box);
    else this.stock(box);
  },

  // Human label for each period preset.
  periodLabel(p) {
    return ({ day: 'Day', week: 'Week', month: 'Month', year: 'Year', fy: 'FY' })[p] || p;
  },

  // Given an anchor date (YYYY-MM-DD) and a preset, return the local-time
  // start/end + a display label. Week is Mon–Sun. FY is Apr 1 → Mar 31 (India).
  periodRange(anchorStr, preset) {
    const [y, m, d] = anchorStr.split('-').map(Number);
    const anchor = new Date(y, m - 1, d);
    const pad = n => String(n).padStart(2, '0');
    const iso = dt => `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
    const isoDT = dt => `${iso(dt)}T${pad(dt.getHours())}:${pad(dt.getMinutes())}:${pad(dt.getSeconds())}`;
    const monthName = i => ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][i];
    const dayLabel = dt => `${dt.getDate()} ${monthName(dt.getMonth())} ${dt.getFullYear()}`;

    let start, end, label, isDay = false;
    if (preset === 'day') {
      start = new Date(y, m - 1, d, 0, 0, 0);
      end   = new Date(y, m - 1, d, 23, 59, 59);
      label = dayLabel(anchor);
      isDay = true;                      // day uses {date:} not {start,end}
    } else if (preset === 'week') {
      // Monday-anchored week: getDay() Sun=0 → shift so Mon=0.
      const dow = (anchor.getDay() + 6) % 7;
      start = new Date(y, m - 1, d - dow, 0, 0, 0);
      end   = new Date(y, m - 1, d - dow + 6, 23, 59, 59);
      label = `${dayLabel(start)} → ${dayLabel(end)}`;
    } else if (preset === 'month') {
      start = new Date(y, m - 1, 1, 0, 0, 0);
      end   = new Date(y, m,     0, 23, 59, 59);       // day 0 of next month = last day of this month
      label = `${monthName(m - 1)} ${y}`;
    } else if (preset === 'year') {
      start = new Date(y, 0, 1, 0, 0, 0);
      end   = new Date(y, 11, 31, 23, 59, 59);
      label = `${y}`;
    } else if (preset === 'fy') {
      // Indian FY: Apr 1 – Mar 31. Anchor month < Apr → FY started previous year.
      const fyStartYear = (anchor.getMonth() < 3) ? y - 1 : y;
      start = new Date(fyStartYear,     3, 1, 0, 0, 0);
      end   = new Date(fyStartYear + 1, 2, 31, 23, 59, 59);
      label = `FY ${fyStartYear}-${String(fyStartYear + 1).slice(-2)}`;
    }
    return { start: isoDT(start), end: isoDT(end), label, isDay };
  },

  // Turn a picker value + preset into an anchor date (YYYY-MM-DD, local time).
  // The anchor is any day inside the chosen period; periodRange() expands it.
  _anchorFromPicker(preset, value) {
    const pad = n => String(n).padStart(2, '0');
    if (preset === 'day') {
      // native <input type="date"> gives YYYY-MM-DD directly
      return value;
    }
    if (preset === 'week') {
      // native <input type="week"> gives YYYY-Www — resolve to that week's Monday
      const [yStr, wStr] = value.split('-W');
      const year = parseInt(yStr), week = parseInt(wStr);
      // ISO 8601: week 1 is the one containing Jan 4.
      const jan4 = new Date(year, 0, 4);
      const dow = (jan4.getDay() + 6) % 7;              // shift so Mon=0
      const week1Mon = new Date(jan4); week1Mon.setDate(jan4.getDate() - dow);
      const monday = new Date(week1Mon); monday.setDate(week1Mon.getDate() + (week - 1) * 7);
      return `${monday.getFullYear()}-${pad(monday.getMonth() + 1)}-${pad(monday.getDate())}`;
    }
    if (preset === 'month') {
      // native <input type="month"> gives YYYY-MM — anchor at day 1
      return `${value}-01`;
    }
    if (preset === 'year') {
      return `${value}-01-01`;
    }
    if (preset === 'fy') {
      // FY value is the start year (Apr 1 of that year)
      return `${value}-04-01`;
    }
    return value;
  },

  // Open the right picker for the chosen preset, then generate on submit.
  openPeriodPicker(preset, hostBox) {
    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);
    const yStr = `${yesterday.getFullYear()}-${pad(yesterday.getMonth() + 1)}-${pad(yesterday.getDate())}`;
    const curYear = now.getFullYear();
    const curFy = now.getMonth() < 3 ? curYear - 1 : curYear;

    // ISO week string for "current week"
    const isoWeek = (d) => {
      const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
      const dow = (t.getUTCDay() + 6) % 7;
      t.setUTCDate(t.getUTCDate() - dow + 3);            // Thursday of that week
      const week1 = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
      const week = 1 + Math.round(((t - week1) / 86400000 - 3 + ((week1.getUTCDay() + 6) % 7)) / 7);
      return `${t.getUTCFullYear()}-W${pad(week)}`;
    };

    // Build the picker HTML + read function per preset.
    let bodyHtml, readValue, title;
    if (preset === 'day') {
      title = '📅 Pick a day';
      bodyHtml = `<div class="field"><label>Day</label><input type="date" class="date-input" id="pp-val" value="${yStr}" max="${todayStr}"/></div>`;
      readValue = (root) => root.querySelector('#pp-val').value;
    } else if (preset === 'week') {
      title = '🗓️ Pick a week';
      bodyHtml = `<div class="field"><label>Week (Monday → Sunday)</label><input type="week" class="date-input" id="pp-val" value="${isoWeek(yesterday)}" max="${isoWeek(now)}"/></div>`;
      readValue = (root) => root.querySelector('#pp-val').value;
    } else if (preset === 'month') {
      title = '📆 Pick a month';
      bodyHtml = `<div class="field"><label>Month</label><input type="month" class="date-input" id="pp-val" value="${curYear}-${pad(now.getMonth() + 1)}" max="${curYear}-${pad(now.getMonth() + 1)}"/></div>`;
      readValue = (root) => root.querySelector('#pp-val').value;
    } else if (preset === 'year') {
      title = '🎯 Pick a year';
      // Show last 10 years — plenty for a small POS, no future years.
      const years = [];
      for (let i = 0; i < 10; i++) years.push(curYear - i);
      bodyHtml = `<div class="field"><label>Year</label><select class="select" id="pp-val" style="width:100%">${years.map(y => `<option value="${y}">${y}</option>`).join('')}</select></div>`;
      readValue = (root) => root.querySelector('#pp-val').value;
    } else if (preset === 'fy') {
      title = '🏦 Pick a financial year';
      // Indian FY: Apr 1 → Mar 31 of the next year. Show last 10 FYs.
      const fys = [];
      for (let i = 0; i < 10; i++) fys.push(curFy - i);
      bodyHtml = `<div class="field"><label>Financial Year (Apr – Mar)</label><select class="select" id="pp-val" style="width:100%">${fys.map(y => `<option value="${y}">FY ${y}-${String(y + 1).slice(-2)}</option>`).join('')}</select></div>`;
      readValue = (root) => root.querySelector('#pp-val').value;
    }

    const modal = Ui.modal({
      title,
      body: `${bodyHtml}<div class="muted" id="pp-hint" style="margin-top:10px;font-size:12px"></div>`,
      foot: `<button class="btn btn-ghost" id="pp-cancel">Cancel</button>
             <button class="btn btn-primary" id="pp-go">Generate report</button>`
    });

    const $ = s => modal.el.querySelector(s);
    const refreshHint = () => {
      const raw = readValue(modal.el);
      if (!raw) { $('#pp-hint').textContent = ''; return; }
      try {
        const anchor = this._anchorFromPicker(preset, raw);
        const r = this.periodRange(anchor, preset);
        $('#pp-hint').innerHTML = `Report will cover <b>${r.label}</b>.`;
      } catch { $('#pp-hint').textContent = ''; }
    };
    $('#pp-val').addEventListener('change', refreshHint);
    $('#pp-val').addEventListener('input', refreshHint);
    refreshHint();

    $('#pp-cancel').addEventListener('click', modal.close);
    $('#pp-go').addEventListener('click', async () => {
      const raw = readValue(modal.el);
      if (!raw) { Ui.toast('Pick a value first', 'error'); return; }
      const anchor = this._anchorFromPicker(preset, raw);
      const { start, end, label, isDay } = this.periodRange(anchor, preset);
      try {
        const payload = isDay ? { date: anchor } : { start, end };
        const report = await Api.post('/reports/generate', payload);
        Ui.toast(`Report generated · ${label}`);
        modal.close();
        this.viewReport(report);
        this.generated(hostBox);
      } catch (e) { Ui.toast(e.message, 'error'); }
    });
  },

  // ---------- GENERATED DAILY REPORTS ----------
  async generated(box) {
    box.innerHTML = '<div class="loader"></div>';
    let schedule, reports;
    try {
      [schedule, reports] = await Promise.all([Api.get('/reports/schedule'), Api.get('/reports/generated')]);
    } catch (e) { box.innerHTML = `<div class="empty-state">${Ui.esc(e.message)}</div>`; return; }

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
          <p class="muted" style="margin-bottom:10px;line-height:1.5">Pick the period type — a calendar opens so you can choose the exact day / week / month / year / financial year to report on.</p>
          <div class="period-btns">
            <button class="btn btn-green btn-sm" data-period="day">📅 Day</button>
            <button class="btn btn-green btn-sm" data-period="week">🗓️ Week</button>
            <button class="btn btn-green btn-sm" data-period="month">📆 Month</button>
            <button class="btn btn-green btn-sm" data-period="year">🎯 Year</button>
            <button class="btn btn-green btn-sm" data-period="fy">🏦 Financial Year</button>
          </div>
          <details style="margin-top:12px">
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

    box.querySelectorAll('[data-period]').forEach(btn => {
      btn.addEventListener('click', () => this.openPeriodPicker(btn.dataset.period, box));
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
  },

  // ----- Raw materials report: daily movements + live stock snapshot -----
  async raw(box, date) {
    const today = new Date().toISOString().slice(0, 10);
    date = date || today;
    box.innerHTML = `
      <div class="toolbar">
        <input type="date" class="date-input" id="rr-date" value="${date}" max="${today}"/>
        <div class="muted" style="font-weight:600">All raw-material movements on the selected day + live stock snapshot.</div>
      </div>
      <div id="rr-out"><div class="loader"></div></div>`;
    box.querySelector('#rr-date').addEventListener('change', e => this.raw(box, e.target.value));

    let materials, movements;
    try {
      [materials, movements] = await Promise.all([
        Api.get('/raw-materials'),
        Api.get(`/raw-materials/movements/day?date=${date}`)
      ]);
    } catch (e) {
      box.querySelector('#rr-out').innerHTML = `<div class="empty-state">${Ui.esc(e.message)}</div>`;
      return;
    }

    const fmtQty = n => { const v = parseFloat(n) || 0; return v % 1 ? v.toFixed(3) : v.toString(); };

    // Aggregate consumed / added per material for the day.
    const consumed = new Map(), added = new Map();
    for (const mv of movements) {
      const id = mv.rawMaterialId;
      const q = parseFloat(mv.changeQty);
      if (mv.reason === 'sale') consumed.set(id, (consumed.get(id) || 0) + Math.abs(q));
      else if (q > 0) added.set(id, (added.get(id) || 0) + q);
    }

    const low = materials.filter(m => m.status === 'low' || m.status === 'out');
    const topConsumed = materials
      .map(m => ({ ...m, consumedToday: consumed.get(m.id) || 0 }))
      .filter(m => m.consumedToday > 0)
      .sort((a, b) => b.consumedToday - a.consumedToday)
      .slice(0, 10);

    const topRows = topConsumed.length ? topConsumed.map((m, i) => `
      <div class="list-row">
        <span><span class="rank">${i + 1}</span>${Ui.esc(m.name)}</span>
        <span><b>${fmtQty(m.consumedToday)}</b> ${Ui.esc(m.unit)}</span>
      </div>`).join('')
      : '<div class="empty-state" style="padding:26px"><div class="big">☕</div>No raw materials consumed on this day</div>';

    const lowRows = low.length ? low.map(m => `
      <div class="list-row">
        <span>${Ui.esc(m.name)}</span>
        <span class="badge ${m.status === 'out' ? 'unpaid' : 'partial'}">
          ${fmtQty(m.currentStock)} ${Ui.esc(m.unit)} · min ${fmtQty(m.minStock)}
        </span>
      </div>`).join('')
      : '<div class="empty-state" style="padding:26px"><div class="big">✅</div>All raw materials well stocked</div>';

    const materialRows = materials.length ? `
      <table class="tbl">
        <thead><tr><th>Material</th><th>Consumed today</th><th>Added today</th><th>In stock</th><th>Status</th></tr></thead>
        <tbody>
          ${materials.map(m => `
            <tr>
              <td><b>${Ui.esc(m.name)}</b></td>
              <td>${fmtQty(consumed.get(m.id) || 0)} ${Ui.esc(m.unit)}</td>
              <td>${fmtQty(added.get(m.id) || 0)} ${Ui.esc(m.unit)}</td>
              <td><b>${fmtQty(m.currentStock)}</b> ${Ui.esc(m.unit)}</td>
              <td>${m.status === 'out' ? '<span class="badge unpaid">Out</span>'
                    : m.status === 'low' ? '<span class="badge partial">Low</span>'
                    : '<span class="badge paid">OK</span>'}</td>
            </tr>`).join('')}
        </tbody>
      </table>`
      : '<div class="empty-state"><div class="big">🥣</div><h3>No raw materials configured</h3><p>Add them in Raw Materials to start tracking.</p></div>';

    const movementTable = movements.length ? `
      <table class="tbl">
        <thead><tr><th>When</th><th>Material</th><th>Reason</th><th>Change</th><th>Balance</th><th>Notes</th></tr></thead>
        <tbody>
          ${movements.map(mv => {
            const chg = parseFloat(mv.changeQty);
            const sign = chg > 0 ? '+' : '';
            const cls = chg > 0 ? 'paid' : 'unpaid';
            return `<tr>
              <td class="muted">${Ui.fmtTime(mv.created_at)}</td>
              <td>${Ui.esc(mv.rawMaterial?.name || '—')}</td>
              <td><span class="badge ${cls}">${Ui.esc(mv.reason)}</span></td>
              <td><b>${sign}${fmtQty(chg)}</b> ${Ui.esc(mv.rawMaterial?.unit || '')}</td>
              <td>${fmtQty(mv.balanceAfter)}</td>
              <td class="muted">${Ui.esc(mv.notes || '—')}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>`
      : '<div class="empty-state" style="padding:26px"><div class="big">🗒️</div>No movements on this day</div>';

    box.querySelector('#rr-out').innerHTML = `
      <div class="stat-grid">
        <div class="stat-card"><div class="stat-ic" style="background:var(--blue-soft)">🥣</div><div class="stat-val">${materials.length}</div><div class="stat-lbl">Raw Materials</div></div>
        <div class="stat-card"><div class="stat-ic" style="background:var(--amber-soft)">⚠️</div><div class="stat-val">${low.length}</div><div class="stat-lbl">Low / Out</div></div>
        <div class="stat-card"><div class="stat-ic" style="background:var(--brand-soft)">📜</div><div class="stat-val">${movements.length}</div><div class="stat-lbl">Movements Today</div></div>
      </div>
      <div class="grid-2">
        <div class="card"><div class="card-title">Top consumed on ${Ui.fmtDate(date)}</div>${topRows}</div>
        <div class="card"><div class="card-title">Low &amp; out of stock</div>${lowRows}</div>
      </div>
      <div class="card" style="margin-top:16px">
        <div class="card-title">Live raw-material snapshot</div>
        ${materialRows}
      </div>
      <div class="card" style="margin-top:16px">
        <div class="card-title">Movement log · ${Ui.fmtDate(date)}</div>
        ${movementTable}
      </div>`;
  }
};
