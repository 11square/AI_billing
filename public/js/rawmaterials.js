// ===== Raw Materials page =====
// Owner-facing raw-material inventory. Everything on this page ultimately
// hits /api/raw-materials — the backend logs every movement so we don't
// track state locally beyond the current list snapshot.
const RawMaterials = {
  materials: [],
  unitsCatalog: null,

  async ensureUnitsCatalog() {
    if (this.unitsCatalog) return this.unitsCatalog;
    try { this.unitsCatalog = await Api.get('/raw-materials/units-catalog'); }
    catch { this.unitsCatalog = { catalog: { weight: ['g', 'kg'], volume: ['ml', 'l'], count: ['pc', 'pack'] }, familyOf: {} }; }
    return this.unitsCatalog;
  },

  async render(el) {
    el.innerHTML = '<div class="loader"></div>';
    try {
      [this.materials] = await Promise.all([
        Api.get('/raw-materials'),
        this.ensureUnitsCatalog()
      ]);
    } catch (e) {
      el.innerHTML = `<div class="empty-state"><div class="big">⚠️</div><h3>Could not load raw materials</h3><p>${Ui.esc(e.message)}</p></div>`;
      return;
    }

    const total = this.materials.length;
    const low = this.materials.filter(m => m.status === 'low').length;
    const out = this.materials.filter(m => m.status === 'out').length;

    el.innerHTML = `
      <div class="stat-grid">
        <div class="stat-card"><div class="stat-ic" style="background:var(--blue-soft)">🥣</div><div class="stat-val">${total}</div><div class="stat-lbl">Raw Materials</div></div>
        <div class="stat-card"><div class="stat-ic" style="background:var(--amber-soft)">⚠️</div><div class="stat-val">${low}</div><div class="stat-lbl">Low Stock</div></div>
        <div class="stat-card"><div class="stat-ic" style="background:var(--red-soft)">🚫</div><div class="stat-val">${out}</div><div class="stat-lbl">Out of Stock</div></div>
      </div>

      <div class="toolbar">
        <div class="search-box"><span data-icon="search"></span><input id="rm-search" placeholder="Search materials…"/></div>
        <button class="btn btn-primary" id="rm-add"><span data-icon="plus"></span> Add Raw Material</button>
      </div>

      <div class="card" style="padding:8px 6px">
        <div id="rm-list"></div>
      </div>`;

    Ui.hydrateIcons(el);
    el.querySelector('#rm-add').addEventListener('click', () => this.form(null));
    el.querySelector('#rm-search').addEventListener('input', e => this.renderList(e.target.value));
    this.renderList('');
  },

  renderList(query) {
    const box = document.getElementById('rm-list');
    if (!box) return;
    const q = (query || '').toLowerCase();
    const rows = this.materials.filter(m => !q || m.name.toLowerCase().includes(q));

    if (!rows.length) {
      box.innerHTML = '<div class="empty-state"><div class="big">🥣</div><h3>No raw materials yet</h3><p>Add ingredients like milk, coffee beans, sugar…</p></div>';
      return;
    }

    box.innerHTML = `
      <table class="tbl">
        <thead><tr><th>Material</th><th>Stock</th><th>Min</th><th>Status</th><th style="text-align:right">Actions</th></tr></thead>
        <tbody>
          ${rows.map(m => `
            <tr>
              <td>
                <b>${Ui.esc(m.name)}</b>
                ${m.notes ? `<div class="muted">${Ui.esc(m.notes)}</div>` : ''}
              </td>
              <td><b>${this.fmtQty(m.currentStock)}</b> <span class="muted">${Ui.esc(m.unit)}</span></td>
              <td class="muted">${this.fmtQty(m.minStock)} ${Ui.esc(m.unit)}</td>
              <td>${this.statusChip(m.status)}</td>
              <td style="text-align:right;white-space:nowrap">
                <button class="btn btn-ghost btn-sm" data-adj="${m.id}">+/−</button>
                <button class="btn btn-ghost btn-sm" data-hist="${m.id}">History</button>
                <button class="btn btn-ghost btn-sm" data-edit="${m.id}">Edit</button>
                <button class="btn btn-danger btn-sm" data-del="${m.id}">🗑</button>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>`;

    box.querySelectorAll('[data-adj]').forEach(b =>
      b.addEventListener('click', () => this.adjustForm(this.byId(b.dataset.adj))));
    box.querySelectorAll('[data-hist]').forEach(b =>
      b.addEventListener('click', () => this.history(this.byId(b.dataset.hist))));
    box.querySelectorAll('[data-edit]').forEach(b =>
      b.addEventListener('click', () => this.form(this.byId(b.dataset.edit))));
    box.querySelectorAll('[data-del]').forEach(b =>
      b.addEventListener('click', () => this.remove(this.byId(b.dataset.del))));
  },

  byId(id) { return this.materials.find(m => m.id === parseInt(id)); },
  fmtQty(n) { const v = parseFloat(n) || 0; return v % 1 ? v.toFixed(3) : v.toString(); },
  statusChip(s) {
    if (s === 'out') return '<span class="badge unpaid">Out of stock</span>';
    if (s === 'low') return '<span class="badge partial">Low</span>';
    return '<span class="badge paid">OK</span>';
  },

  // Grouped <select> of common units + "Custom…" fallback.
  unitSelectHtml(id, current) {
    const cat = (this.unitsCatalog || {}).catalog || {};
    const cur = (current || '').toLowerCase();
    const groupOpts = (label, arr) => arr.length
      ? `<optgroup label="${label}">${arr.map(u => `<option value="${u}" ${cur === u ? 'selected' : ''}>${u}</option>`).join('')}</optgroup>`
      : '';
    const allBuiltIn = [...(cat.weight || []), ...(cat.volume || []), ...(cat.count || [])];
    const isCustom = current && !allBuiltIn.includes(cur);
    return `
      <select id="${id}" class="unit-select">
        ${groupOpts('Weight', cat.weight || [])}
        ${groupOpts('Volume', cat.volume || [])}
        ${groupOpts('Count / Pack', cat.count || [])}
        <option value="__custom__" ${isCustom ? 'selected' : ''}>Custom…</option>
      </select>
      <input id="${id}-custom" class="unit-custom" placeholder="type unit…"
        value="${isCustom ? Ui.esc(current) : ''}"
        style="display:${isCustom ? 'block' : 'none'};margin-top:6px"/>`;
  },
  wireUnitSelect(root, id) {
    const sel = root.querySelector('#' + id);
    const inp = root.querySelector('#' + id + '-custom');
    if (!sel || !inp) return;
    sel.addEventListener('change', () => {
      const custom = sel.value === '__custom__';
      inp.style.display = custom ? 'block' : 'none';
      if (custom) inp.focus();
    });
  },
  readUnit(root, id) {
    const sel = root.querySelector('#' + id);
    const inp = root.querySelector('#' + id + '-custom');
    if (!sel) return 'unit';
    return sel.value === '__custom__' ? (inp?.value.trim() || 'unit') : sel.value;
  },

  // ---------- Add / Edit ----------
  form(m) {
    const isEdit = !!m;
    const modal = Ui.modal({
      title: isEdit ? `Edit · ${Ui.esc(m.name)}` : 'Add Raw Material',
      body: `
        <div class="form-grid">
          <div class="field full"><label>Name *</label>
            <input id="rf-name" value="${Ui.esc(m?.name || '')}" placeholder="e.g. Whole Milk"/></div>
          <div class="field"><label>Unit *</label>
            ${this.unitSelectHtml('rf-unit', m?.unit)}
          </div>
          <div class="field"><label>${isEdit ? 'Current stock (read-only)' : 'Opening stock'}</label>
            <input id="rf-stock" type="number" min="0" step="any"
              value="${isEdit ? m.currentStock : ''}" ${isEdit ? 'disabled' : ''} placeholder="0"/></div>
          <div class="field"><label>Low-stock alert at</label>
            <input id="rf-min" type="number" min="0" step="any" value="${m?.minStock ?? 0}"/></div>
          <div class="field full"><label>Notes</label>
            <textarea id="rf-notes" rows="2" placeholder="Supplier, storage tips, batch info…">${Ui.esc(m?.notes || '')}</textarea></div>
        </div>
        ${isEdit ? '<div class="muted" style="font-size:12px;margin-top:8px">Use the +/− button on the row to change stock — that keeps an audit trail.</div>' : ''}`,
      foot: `<button class="btn btn-ghost" id="rf-cancel">Cancel</button>
             <button class="btn btn-primary" id="rf-save">${isEdit ? 'Save changes' : 'Add material'}</button>`
    });

    const $ = s => modal.el.querySelector(s);
    this.wireUnitSelect(modal.el, 'rf-unit');
    $('#rf-cancel').addEventListener('click', modal.close);
    $('#rf-save').addEventListener('click', async () => {
      const body = {
        name: $('#rf-name').value.trim(),
        unit: this.readUnit(modal.el, 'rf-unit'),
        minStock: parseFloat($('#rf-min').value) || 0,
        notes: $('#rf-notes').value.trim() || null
      };
      if (!body.name) { Ui.toast('Name is required', 'error'); return; }
      if (!isEdit) body.currentStock = parseFloat($('#rf-stock').value) || 0;
      try {
        if (isEdit) await Api.put(`/raw-materials/${m.id}`, body);
        else await Api.post('/raw-materials', body);
        Ui.toast(isEdit ? 'Material updated' : 'Material added');
        modal.close();
        this.render(document.getElementById('page'));
      } catch (e) { Ui.toast(e.message, 'error'); }
    });
  },

  // ---------- Adjust stock (+/-) ----------
  adjustForm(m) {
    const modal = Ui.modal({
      title: `Adjust stock · ${Ui.esc(m.name)}`,
      body: `
        <div class="pay-summary" style="margin-bottom:14px">
          Current stock: <b>${this.fmtQty(m.currentStock)} ${Ui.esc(m.unit)}</b>
        </div>
        <div class="form-grid">
          <div class="field"><label>Direction *</label>
            <select id="rf-dir">
              <option value="1">➕ Add stock (goods received / restock)</option>
              <option value="-1">➖ Remove stock (spoilage / manual fix)</option>
            </select></div>
          <div class="field"><label>Reason *</label>
            <select id="rf-reason">
              <option value="stock_in">stock_in (received / restocked)</option>
              <option value="adjust">adjust (spoilage / count fix)</option>
            </select></div>
          <div class="field full"><label>Quantity (${Ui.esc(m.unit)}) *</label>
            <input id="rf-qty" type="number" min="0" step="any" placeholder="0"/></div>
          <div class="field full"><label>Notes</label>
            <input id="rf-notes" placeholder="Reason / reference…"/></div>
        </div>
        <div class="muted" style="font-size:12px;margin-top:8px">Stock arriving via a Purchase Order should be logged via the PO's <b>Record delivery</b> action instead — that keeps the PO status accurate.</div>`,
      foot: `<button class="btn btn-ghost" id="rf-cancel">Cancel</button>
             <button class="btn btn-primary" id="rf-save">Apply</button>`
    });
    const $ = s => modal.el.querySelector(s);
    // "stock_in" must be positive; auto-flip direction when picked.
    $('#rf-reason').addEventListener('change', () => {
      if ($('#rf-reason').value === 'stock_in') $('#rf-dir').value = '1';
    });
    $('#rf-cancel').addEventListener('click', modal.close);
    $('#rf-save').addEventListener('click', async () => {
      const qty = parseFloat($('#rf-qty').value);
      if (!qty || qty <= 0) { Ui.toast('Quantity must be > 0', 'error'); return; }
      const dir = parseInt($('#rf-dir').value);
      const reason = $('#rf-reason').value;
      if (reason === 'stock_in' && dir < 0) { Ui.toast('Stock-in must add stock, not remove', 'error'); return; }
      try {
        await Api.post(`/raw-materials/${m.id}/adjust`, {
          changeQty: dir * qty,
          reason,
          notes: $('#rf-notes').value.trim() || null
        });
        Ui.toast('Stock updated');
        modal.close();
        this.render(document.getElementById('page'));
      } catch (e) { Ui.toast(e.message, 'error'); }
    });
  },

  // ---------- History drawer ----------
  async history(m) {
    let rows = [];
    try { rows = await Api.get(`/raw-materials/${m.id}/history?limit=100`); }
    catch (e) { Ui.toast(e.message, 'error'); return; }

    const body = rows.length ? `
      <table class="tbl">
        <thead><tr><th>When</th><th>Reason</th><th>Change</th><th>Balance</th><th>Notes</th></tr></thead>
        <tbody>
          ${rows.map(r => {
            const chg = parseFloat(r.changeQty);
            const sign = chg > 0 ? '+' : '';
            const cls = chg > 0 ? 'paid' : chg < 0 ? 'unpaid' : 'partial';
            return `
              <tr>
                <td class="muted">${Ui.fmtDate(r.created_at)} ${Ui.fmtTime(r.created_at)}</td>
                <td><span class="badge ${cls}">${Ui.esc(r.reason)}</span></td>
                <td><b>${sign}${this.fmtQty(chg)}</b> ${Ui.esc(m.unit)}</td>
                <td>${this.fmtQty(r.balanceAfter)} ${Ui.esc(m.unit)}</td>
                <td class="muted">${Ui.esc(r.notes || '—')}</td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>`
      : '<div class="empty-state"><div class="big">📜</div><h3>No movements yet</h3><p>Stock changes will appear here</p></div>';

    Ui.modal({
      title: `History · ${Ui.esc(m.name)}`,
      wide: true,
      body,
      foot: '<button class="btn btn-ghost" onclick="this.closest(\'.modal-backdrop\').querySelector(\'.modal-x\').click()">Close</button>'
    });
  },

  async remove(m) {
    const ok = await Ui.confirm('Archive raw material?',
      `<b>${Ui.esc(m.name)}</b> will be hidden. Existing history and recipes stay intact.`,
      'Archive');
    if (!ok) return;
    try {
      await Api.del(`/raw-materials/${m.id}`);
      Ui.toast('Material archived');
      this.render(document.getElementById('page'));
    } catch (e) { Ui.toast(e.message, 'error'); }
  }
};
