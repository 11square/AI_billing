// ===== Staff & Attendance module =====
const Staff = {
  tab: 'attendance',
  list: [],
  search: '',

  // attendance state
  date: new Date().toISOString().slice(0, 10),
  sheet: [],
  dirty: {},   // `${staffId}|${shift}` -> record

  STATUSES: [
    { key: 'present', label: 'Present', cls: 'present', short: 'P' },
    { key: 'absent',  label: 'Absent',  cls: 'absent',  short: 'A' },
    { key: 'leave',   label: 'Leave',   cls: 'leave',   short: 'L' },
    { key: 'week_off',label: 'Week Off',cls: 'weekoff', short: 'W' }
  ],
  SHIFT_LABEL: { morning: '🌅 Morning', evening: '🌆 Evening' },

  render(el) {
    el.innerHTML = `
      <div class="rep-tabs" id="stf-tabs">
        <button class="rep-tab ${this.tab === 'attendance' ? 'active' : ''}" data-t="attendance">🗓️ Attendance</button>
        <button class="rep-tab ${this.tab === 'staff' ? 'active' : ''}" data-t="staff">👤 Staff</button>
        <button class="rep-tab ${this.tab === 'summary' ? 'active' : ''}" data-t="summary">📊 Monthly Summary</button>
      </div>
      <div id="stf-body"><div class="loader"></div></div>`;
    el.querySelector('#stf-tabs').addEventListener('click', e => {
      const b = e.target.closest('.rep-tab'); if (!b) return;
      this.tab = b.dataset.t;
      el.querySelectorAll('.rep-tab').forEach(x => x.classList.toggle('active', x === b));
      this.loadTab();
    });
    this.loadTab();
  },

  loadTab() {
    const box = document.getElementById('stf-body');
    if (!box) return;
    if (this.tab === 'attendance') this.attendanceTab(box);
    else if (this.tab === 'staff') this.staffTab(box);
    else this.summaryTab(box);
  },

  // ---------- ATTENDANCE DAY SHEET ----------
  async attendanceTab(box) {
    box.innerHTML = '<div class="loader"></div>';
    try {
      const res = await Api.get(`/attendance?date=${this.date}`);
      this.sheet = res.sheet;
      this.dirty = {};
    } catch (e) { box.innerHTML = `<div class="empty-state">${Ui.esc(e.message)}</div>`; return; }

    if (!this.sheet.length) {
      box.innerHTML = `
        <div class="toolbar"><input type="date" class="date-input" id="att-date" value="${this.date}"/></div>
        <div class="empty-state"><div class="big">👥</div><h3>No staff added yet</h3><p>Add staff in the Staff tab to start marking attendance</p></div>`;
      box.querySelector('#att-date').addEventListener('change', e => { this.date = e.target.value; this.attendanceTab(box); });
      return;
    }

    const rows = this.sheet.map(s => `
      <tr data-staff="${s.staffId}">
        <td style="display:flex;align-items:center;gap:10px">
          <div class="stf-avatar">${Ui.esc((s.name || '?')[0].toUpperCase())}</div>
          <div><b>${Ui.esc(s.name)}</b><div class="muted">${Ui.esc(s.role || 'Staff')}</div></div>
        </td>
        ${['morning', 'evening'].map(sh => this.shiftCell(s, sh)).join('')}
      </tr>`).join('');

    box.innerHTML = `
      <div class="toolbar">
        <input type="date" class="date-input" id="att-date" value="${this.date}"/>
        <div class="spacer"></div>
        <button class="btn btn-ghost btn-sm" id="att-all-m">All present · Morning</button>
        <button class="btn btn-ghost btn-sm" id="att-all-e">All present · Evening</button>
        <button class="btn btn-primary" id="att-save"><span data-icon="plus"></span> Save Attendance</button>
      </div>
      <div class="att-legend">
        ${this.STATUSES.map(s => `<span class="att-chip ${s.cls}">${s.short} ${s.label}</span>`).join('')}
        <span class="muted" style="margin-left:auto">Tap a shift to cycle status</span>
      </div>
      <div class="card" style="padding:8px 6px">
        <table class="tbl att-tbl">
          <thead><tr><th>Staff</th><th style="text-align:center">🌅 Morning</th><th style="text-align:center">🌆 Evening</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
    Ui.hydrateIcons(box);

    box.querySelector('#att-date').addEventListener('change', e => { this.date = e.target.value; this.attendanceTab(box); });
    box.querySelector('#att-save').addEventListener('click', () => this.saveAttendance());
    box.querySelector('#att-all-m').addEventListener('click', () => this.markAll('morning'));
    box.querySelector('#att-all-e').addEventListener('click', () => this.markAll('evening'));

    box.querySelectorAll('.att-cell').forEach(cell => {
      cell.addEventListener('click', () => this.cycleCell(cell));
    });
  },

  shiftCell(s, shift) {
    const rec = s.shifts[shift];
    const status = rec ? rec.status : '';
    const st = this.STATUSES.find(x => x.key === status);
    const cls = st ? st.cls : 'unset';
    const label = st ? st.label : 'Mark';
    return `<td style="text-align:center">
      <button class="att-cell ${cls}" data-staff="${s.staffId}" data-shift="${shift}" data-status="${status}">${label}</button>
    </td>`;
  },

  cycleCell(cell) {
    const order = ['', 'present', 'absent', 'leave', 'week_off'];
    const cur = cell.dataset.status || '';
    const next = order[(order.indexOf(cur) + 1) % order.length];
    this.applyStatus(cell, next);
  },

  applyStatus(cell, status) {
    const st = this.STATUSES.find(x => x.key === status);
    cell.dataset.status = status;
    cell.className = 'att-cell ' + (st ? st.cls : 'unset');
    cell.textContent = st ? st.label : 'Mark';
    const key = `${cell.dataset.staff}|${cell.dataset.shift}`;
    if (status) this.dirty[key] = { staffId: parseInt(cell.dataset.staff), shift: cell.dataset.shift, status };
    else delete this.dirty[key];
  },

  markAll(shift) {
    document.querySelectorAll(`.att-cell[data-shift="${shift}"]`).forEach(cell => this.applyStatus(cell, 'present'));
    Ui.toast(`All marked present for ${shift} shift`);
  },

  async saveAttendance() {
    const records = Object.values(this.dirty);
    if (!records.length) { Ui.toast('Nothing changed to save', 'error'); return; }
    try {
      const res = await Api.post('/attendance', { date: this.date, records });
      Ui.toast(`Attendance saved (${res.saved} shifts) ✓`);
      this.attendanceTab(document.getElementById('stf-body'));
    } catch (e) { Ui.toast(e.message, 'error'); }
  },

  // ---------- STAFF LIST ----------
  async staffTab(box) {
    box.innerHTML = `
      <div class="toolbar">
        <div class="search-box"><span data-icon="search"></span><input id="stf-search" placeholder="Search name / role…" value="${Ui.esc(this.search)}"/></div>
        <div class="spacer"></div>
        <button class="btn btn-primary" id="stf-add"><span data-icon="plus"></span> Add Staff</button>
      </div>
      <div id="stf-list"><div class="loader"></div></div>`;
    Ui.hydrateIcons(box);
    let t;
    box.querySelector('#stf-search').addEventListener('input', e => { this.search = e.target.value; clearTimeout(t); t = setTimeout(() => this.loadStaffList(), 250); });
    box.querySelector('#stf-add').addEventListener('click', () => this.form(null));
    this.loadStaffList();
  },

  async loadStaffList() {
    const wrap = document.getElementById('stf-list');
    if (!wrap) return;
    wrap.innerHTML = '<div class="loader"></div>';
    try {
      this.list = await Api.get('/staff' + (this.search ? `?search=${encodeURIComponent(this.search)}` : ''));
    } catch (e) { wrap.innerHTML = `<div class="empty-state">${Ui.esc(e.message)}</div>`; return; }
    if (!this.list.length) {
      wrap.innerHTML = '<div class="empty-state"><div class="big">👤</div><h3>No staff yet</h3><p>Add your baristas, bakers and cashiers</p></div>';
      return;
    }
    wrap.innerHTML = `<div class="stf-grid">${this.list.map(s => `
      <div class="stf-card">
        <div class="stf-card-top">
          <div class="stf-avatar lg">${Ui.esc((s.name || '?')[0].toUpperCase())}</div>
          <div style="min-width:0">
            <div class="stf-name">${Ui.esc(s.name)}</div>
            <div class="mc-cat">${Ui.esc(s.role || 'Staff')}</div>
          </div>
        </div>
        <div class="stf-meta">
          ${s.phone ? `<div>📞 ${Ui.esc(s.phone)}</div>` : ''}
          <div>🕐 ${this.shiftText(s.defaultShift)}</div>
          ${parseFloat(s.monthlySalary) > 0 ? `<div>💰 ${Ui.fmt(s.monthlySalary)}/mo</div>` : ''}
          ${s.joinDate ? `<div class="muted">Joined ${Ui.fmtDate(s.joinDate)}</div>` : ''}
        </div>
        <div class="mc-actions">
          <button class="btn btn-ghost btn-sm" data-edit="${s.id}">✏️ Edit</button>
          <button class="btn btn-danger btn-sm" data-del="${s.id}">🗑</button>
        </div>
      </div>`).join('')}</div>`;
    wrap.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => this.form(this.list.find(s => s.id === parseInt(b.dataset.edit)))));
    wrap.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => this.remove(this.list.find(s => s.id === parseInt(b.dataset.del)))));
  },

  shiftText(sh) {
    return sh === 'both' ? 'Both shifts' : sh === 'evening' ? 'Evening shift' : 'Morning shift';
  },

  form(s) {
    const isEdit = !!s;
    const m = Ui.modal({
      title: isEdit ? `Edit · ${Ui.esc(s.name)}` : 'Add Staff',
      body: `
        <div class="field"><label>Full name *</label><input id="sf-name" value="${Ui.esc(s?.name || '')}" placeholder="e.g. Arun Kumar"/></div>
        <div class="form-grid">
          <div class="field"><label>Role</label><input id="sf-role" list="sf-roles" value="${Ui.esc(s?.role || '')}" placeholder="Barista / Baker…"/>
            <datalist id="sf-roles">${['Barista','Baker','Cashier','Waiter','Chef','Manager','Cleaner','Helper'].map(r => `<option>${r}</option>`).join('')}</datalist></div>
          <div class="field"><label>Phone</label><input id="sf-phone" value="${Ui.esc(s?.phone || '')}" placeholder="98765 43210"/></div>
          <div class="field"><label>Default shift</label>
            <select id="sf-shift">
              <option value="morning" ${(s?.defaultShift || 'morning') === 'morning' ? 'selected' : ''}>🌅 Morning</option>
              <option value="evening" ${s?.defaultShift === 'evening' ? 'selected' : ''}>🌆 Evening</option>
              <option value="both" ${s?.defaultShift === 'both' ? 'selected' : ''}>🌗 Both shifts</option>
            </select></div>
          <div class="field"><label>Monthly salary ₹</label><input id="sf-salary" type="number" min="0" value="${s?.monthlySalary || ''}" placeholder="0"/></div>
          <div class="field"><label>Join date</label><input id="sf-join" type="date" value="${s?.joinDate || ''}"/></div>
          <div class="field"><label>Email</label><input id="sf-email" type="email" value="${Ui.esc(s?.email || '')}" placeholder="optional"/></div>
        </div>
        <div class="field"><label>Address</label><textarea id="sf-addr" rows="2">${Ui.esc(s?.address || '')}</textarea></div>`,
      foot: `<button class="btn btn-ghost" id="sf-cancel">Cancel</button><button class="btn btn-primary" id="sf-save">${isEdit ? 'Save' : 'Add Staff'}</button>`
    });
    m.el.querySelector('#sf-cancel').addEventListener('click', m.close);
    m.el.querySelector('#sf-save').addEventListener('click', async () => {
      const body = {
        name: m.el.querySelector('#sf-name').value.trim(),
        role: m.el.querySelector('#sf-role').value.trim() || 'Staff',
        phone: m.el.querySelector('#sf-phone').value.trim() || null,
        email: m.el.querySelector('#sf-email').value.trim() || null,
        defaultShift: m.el.querySelector('#sf-shift').value,
        monthlySalary: parseFloat(m.el.querySelector('#sf-salary').value) || 0,
        joinDate: m.el.querySelector('#sf-join').value || null,
        address: m.el.querySelector('#sf-addr').value.trim() || null
      };
      if (!body.name) { Ui.toast('Name is required', 'error'); return; }
      try {
        if (isEdit) await Api.put(`/staff/${s.id}`, body);
        else await Api.post('/staff', body);
        Ui.toast(isEdit ? 'Staff updated' : 'Staff added');
        m.close();
        this.loadStaffList();
      } catch (e) { Ui.toast(e.message, 'error'); }
    });
  },

  async remove(s) {
    const ok = await Ui.confirm('Remove staff?', `<b>${Ui.esc(s.name)}</b> will be deactivated. Past attendance records remain.`, 'Remove');
    if (!ok) return;
    try {
      await Api.del(`/staff/${s.id}`);
      Ui.toast('Staff removed');
      this.loadStaffList();
    } catch (e) { Ui.toast(e.message, 'error'); }
  },

  // ---------- MONTHLY SUMMARY ----------
  async summaryTab(box, month, year) {
    const now = new Date();
    month = month || now.getMonth() + 1;
    year = year || now.getFullYear();
    const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    box.innerHTML = `
      <div class="toolbar">
        <select class="select" id="sm-month">${months.map((mn, i) => `<option value="${i + 1}" ${i + 1 === +month ? 'selected' : ''}>${mn}</option>`).join('')}</select>
        <select class="select" id="sm-year">${[year - 1, year].map(y => `<option ${y === +year ? 'selected' : ''}>${y}</option>`).join('')}</select>
      </div>
      <div id="sm-out"><div class="loader"></div></div>`;
    const reload = () => this.summaryTab(box, box.querySelector('#sm-month').value, box.querySelector('#sm-year').value);
    box.querySelector('#sm-month').addEventListener('change', reload);
    box.querySelector('#sm-year').addEventListener('change', reload);

    let res;
    try { res = await Api.get(`/attendance/summary?month=${month}&year=${year}`); }
    catch (e) { box.querySelector('#sm-out').innerHTML = `<div class="empty-state">${Ui.esc(e.message)}</div>`; return; }

    if (!res.summary.length) {
      box.querySelector('#sm-out').innerHTML = '<div class="empty-state"><div class="big">📊</div>No staff to summarise</div>';
      return;
    }
    box.querySelector('#sm-out').innerHTML = `
      <div class="card" style="padding:8px 6px">
        <table class="tbl">
          <thead><tr><th>Staff</th><th>Days Worked</th><th>Present</th><th>Absent</th><th>Leave</th><th>Week Off</th><th>Salary</th></tr></thead>
          <tbody>${res.summary.map(s => `
            <tr>
              <td><b>${Ui.esc(s.name)}</b><div class="muted">${Ui.esc(s.role)}</div></td>
              <td><b>${s.daysWorked}</b> <span class="muted">days</span></td>
              <td><span class="att-chip present">${s.presentShifts}</span></td>
              <td><span class="att-chip absent">${s.absentShifts}</span></td>
              <td><span class="att-chip leave">${s.leaveShifts}</span></td>
              <td><span class="att-chip weekoff">${s.weekOffShifts}</span></td>
              <td>${s.monthlySalary > 0 ? Ui.fmt(s.monthlySalary) : '—'}</td>
            </tr>`).join('')}</tbody>
        </table>
        <div class="muted" style="padding:10px 12px">Days worked = present shifts ÷ 2 (two shifts count as one full day).</div>
      </div>`;
  }
};
