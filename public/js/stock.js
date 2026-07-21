// ===== Stock & Purchase Orders page =====
const Stock = {
  tab: 'stock',
  products: [],
  vendors: [],
  purchases: [],
  sourceFilter: 'outsourced',

  render(el) {
    el.innerHTML = `
      <div class="rep-tabs" id="stk-tabs">
        <button class="rep-tab ${this.tab === 'stock' ? 'active' : ''}" data-t="stock">📦 Stock Overview</button>
        <button class="rep-tab ${this.tab === 'po' ? 'active' : ''}" data-t="po">📝 Purchase Orders</button>
        <button class="rep-tab ${this.tab === 'vendors' ? 'active' : ''}" data-t="vendors">🏢 Vendors</button>
      </div>
      <div id="stk-body"><div class="loader"></div></div>`;
    el.querySelector('#stk-tabs').addEventListener('click', e => {
      const b = e.target.closest('.rep-tab'); if (!b) return;
      this.tab = b.dataset.t;
      el.querySelectorAll('.rep-tab').forEach(x => x.classList.toggle('active', x === b));
      this.loadTab();
    });
    this.loadTab();
  },

  loadTab() {
    const box = document.getElementById('stk-body');
    if (!box) return;
    if (this.tab === 'stock') this.stockTab(box);
    else if (this.tab === 'po') this.poTab(box);
    else this.vendorsTab(box);
  },

  // ---------- STOCK OVERVIEW ----------
  async stockTab(box) {
    box.innerHTML = '<div class="loader"></div>';
    try {
      const res = await Api.get('/grocery');
      this.products = res.products || [];
    } catch (e) { box.innerHTML = `<div class="empty-state">${Ui.esc(e.message)}</div>`; return; }

    const render = () => {
      const items = this.products.filter(p => this.sourceFilter === 'all' || (p.sourceType || 'own') === this.sourceFilter);
      const rows = items.map(p => {
        const st = p.stock <= 0 ? '<span class="badge unpaid">Out of stock</span>'
          : p.stock <= p.minStock ? '<span class="badge partial">Low stock</span>'
          : '<span class="badge paid">In stock</span>';
        return `
        <tr>
          <td style="display:flex;align-items:center;gap:10px">${Ui.imgTag(p.image, p.category, 'stk-thumb')}<div><b>${Ui.esc(p.name)}</b><div class="muted">${Ui.esc(p.category)}</div></div></td>
          <td><span class="src-badge ${(p.sourceType || 'own') === 'outsourced' ? 'out' : 'own'}">${(p.sourceType || 'own') === 'outsourced' ? '🚚 Outsourced' : '🏭 Own'}</span></td>
          <td><b>${p.stock}</b> ${Ui.esc(p.unit)}</td>
          <td class="muted">min ${p.minStock}</td>
          <td>${Ui.fmt(p.purchasePrice)}</td>
          <td>${st}</td>
          <td style="text-align:right;white-space:nowrap">
            ${(p.sourceType || 'own') === 'outsourced'
              ? `<button class="btn btn-primary btn-sm" data-po="${p.id}">+ PO</button>`
              : `<button class="btn btn-ghost btn-sm" data-make="${p.id}">📦 Restock</button>`}
          </td>
        </tr>`;
      }).join('');

      document.getElementById('stk-table').innerHTML = items.length ? `
        <table class="tbl">
          <thead><tr><th>Item</th><th>Source</th><th>Stock</th><th>Alert</th><th>Cost</th><th>Status</th><th style="text-align:right">Action</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>` : '<div class="empty-state"><div class="big">📦</div>No items for this filter</div>';

      document.querySelectorAll('#stk-table [data-po]').forEach(b => b.addEventListener('click', () => {
        const p = this.products.find(x => x.id === parseInt(b.dataset.po));
        this.openPoForm(p);
      }));
      document.querySelectorAll('#stk-table [data-make]').forEach(b => b.addEventListener('click', () => {
        const p = this.products.find(x => x.id === parseInt(b.dataset.make));
        Menu.products = this.products;
        Stock._restock(p);
      }));
    };

    const low = this.products.filter(p => p.stock <= p.minStock).length;
    const outsourcedCount = this.products.filter(p => (p.sourceType || 'own') === 'outsourced').length;
    box.innerHTML = `
      <div class="stat-grid">
        <div class="stat-card"><div class="stat-ic" style="background:var(--blue-soft)">🍽️</div><div class="stat-val">${this.products.length}</div><div class="stat-lbl">Total Items</div></div>
        <div class="stat-card"><div class="stat-ic" style="background:var(--brand-soft)">🚚</div><div class="stat-val">${outsourcedCount}</div><div class="stat-lbl">Outsourced</div></div>
        <div class="stat-card"><div class="stat-ic" style="background:var(--green-soft)">🏭</div><div class="stat-val">${this.products.length - outsourcedCount}</div><div class="stat-lbl">Own Made</div></div>
        <div class="stat-card"><div class="stat-ic" style="background:var(--amber-soft)">⚠️</div><div class="stat-val">${low}</div><div class="stat-lbl">Low / Out of Stock</div></div>
      </div>
      <div class="toolbar">
        ${['outsourced', 'own', 'all'].map(f => `<button class="cat-chip ${this.sourceFilter === f ? 'active' : ''}" data-f="${f}">${f === 'outsourced' ? '🚚 Outsourced' : f === 'own' ? '🏭 Own' : 'All items'}</button>`).join('')}
        <div class="spacer"></div>
        <button class="btn btn-primary" id="stk-new-po"><span data-icon="plus"></span> New Purchase Order</button>
      </div>
      <div class="card" style="padding:8px 6px"><div id="stk-table"></div></div>`;
    Ui.hydrateIcons(box);
    box.querySelectorAll('[data-f]').forEach(b => b.addEventListener('click', () => {
      this.sourceFilter = b.dataset.f;
      box.querySelectorAll('[data-f]').forEach(x => x.classList.toggle('active', x === b));
      render();
    }));
    box.querySelector('#stk-new-po').addEventListener('click', () => this.openPoForm());
    render();
  },

  _restock(p) {
    const m = Ui.modal({
      title: `Restock · ${Ui.esc(p.name)}`,
      body: `
        <div class="pay-summary"><div class="tot-row"><span>Current stock</span><span><b>${p.stock} ${Ui.esc(p.unit)}</b></span></div></div>
        <div class="field"><label>Add quantity *</label><input id="rs-qty" type="number" min="1" placeholder="e.g. 50"/></div>`,
      foot: `<button class="btn btn-ghost" id="rs-cancel">Cancel</button><button class="btn btn-primary" id="rs-save">Add Stock</button>`
    });
    m.el.querySelector('#rs-cancel').addEventListener('click', m.close);
    m.el.querySelector('#rs-save').addEventListener('click', async () => {
      const qty = parseInt(m.el.querySelector('#rs-qty').value);
      if (!qty || qty <= 0) { Ui.toast('Enter a quantity', 'error'); return; }
      try {
        await Api.put(`/grocery/${p.id}/restock`, { quantity: qty });
        Ui.toast(`Added ${qty} × ${p.name}`);
        m.close();
        this.loadTab();
      } catch (e) { Ui.toast(e.message, 'error'); }
    });
  },

  // ---------- PURCHASE ORDERS ----------
  async poTab(box) {
    box.innerHTML = '<div class="loader"></div>';
    try {
      const [poRes, vRes] = await Promise.all([Api.get('/purchases'), Api.get('/vendors')]);
      this.purchases = poRes.purchases || [];
      this.vendors = vRes.vendors || [];
    } catch (e) { box.innerHTML = `<div class="empty-state">${Ui.esc(e.message)}</div>`; return; }

    const rows = this.purchases.map(po => `
      <tr>
        <td><b>PO-${String(po.id).padStart(4, '0')}</b><div class="muted">${Ui.fmtDate(po.billDate)}</div></td>
        <td>${Ui.esc(po.vendorName)}${po.vendorBillNo ? `<div class="muted">Bill: ${Ui.esc(po.vendorBillNo)}</div>` : ''}</td>
        <td>${(po.items || []).length} items · ${(po.items || []).reduce((s, i) => s + i.quantity, 0)} qty</td>
        <td><b>${Ui.fmt(po.grandTotal)}</b></td>
        <td><span class="badge ${po.status === 'paid' ? 'paid' : po.status === 'partial' ? 'partial' : 'unpaid'}">${po.status}</span></td>
        <td style="text-align:right;white-space:nowrap">
          <button class="btn btn-ghost btn-sm" data-act="view" data-id="${po.id}">View</button>
          ${po.status !== 'paid' ? `<button class="btn btn-green btn-sm" data-act="paid" data-id="${po.id}">Mark Paid</button>` : ''}
          <button class="btn btn-danger btn-sm" data-act="del" data-id="${po.id}">🗑</button>
        </td>
      </tr>`).join('');

    box.innerHTML = `
      <div class="toolbar">
        <div class="muted" style="font-weight:600">Purchase orders add received quantity straight into stock.</div>
        <div class="spacer"></div>
        <button class="btn btn-primary" id="po-new"><span data-icon="plus"></span> New Purchase Order</button>
      </div>
      <div class="card" style="padding:8px 6px">
        ${this.purchases.length ? `<table class="tbl"><thead><tr><th>PO</th><th>Vendor</th><th>Items</th><th>Total</th><th>Payment</th><th style="text-align:right">Actions</th></tr></thead><tbody>${rows}</tbody></table>`
        : '<div class="empty-state"><div class="big">📝</div><h3>No purchase orders yet</h3><p>Create a PO to stock your outsourced items</p></div>'}
      </div>`;
    Ui.hydrateIcons(box);
    box.querySelector('#po-new').addEventListener('click', () => this.openPoForm());
    box.querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', () => {
      const po = this.purchases.find(x => x.id === parseInt(b.dataset.id));
      if (b.dataset.act === 'view') this.viewPo(po);
      else if (b.dataset.act === 'paid') this.markPaid(po);
      else this.deletePo(po);
    }));
  },

  async openPoForm(prefillProduct) {
    // ensure products & vendors are loaded
    try {
      if (!this.products.length) this.products = (await Api.get('/grocery')).products || [];
      this.vendors = (await Api.get('/vendors')).vendors || [];
    } catch (e) { Ui.toast(e.message, 'error'); return; }

    const outsourced = this.products.filter(p => (p.sourceType || 'own') === 'outsourced');
    const pool = outsourced.length ? outsourced : this.products;
    const today = new Date();
    const pad = n => String(n).padStart(2, '0');
    const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

    const m = Ui.modal({
      title: 'New Purchase Order',
      wide: true,
      body: `
        <div class="form-grid">
          <div class="field"><label>Vendor *</label>
            <select id="po-vendor">
              <option value="">— select vendor —</option>
              ${this.vendors.map(v => `<option value="${v.id}">${Ui.esc(v.name)}</option>`).join('')}
              <option value="__new">➕ Add new vendor…</option>
            </select></div>
          <div class="field"><label>Bill date *</label><input type="date" id="po-date" value="${todayStr}"/></div>
          <div class="field"><label>Vendor bill no.</label><input id="po-billno" placeholder="optional"/></div>
          <div class="field"><label>Payment</label>
            <select id="po-pay">
              <option value="pending">Credit — pay later</option>
              <option value="paid">Paid now</option>
            </select></div>
        </div>
        <label style="display:block;font-size:12.5px;font-weight:700;color:var(--ink-2);margin:6px 0">Items *</label>
        <div id="po-rows"></div>
        <button type="button" class="btn btn-ghost btn-sm" id="po-add-row">+ Add item</button>
        <div class="pay-summary" style="margin-top:14px">
          <div class="tot-row grand"><span>PO Total</span><span id="po-total">₹0</span></div>
        </div>`,
      foot: `<button class="btn btn-ghost" id="po-cancel">Cancel</button>
             <button class="btn btn-primary" id="po-save">Create PO &amp; Add Stock</button>`
    });
    const $ = s => m.el.querySelector(s);

    const rowsEl = $('#po-rows');
    const updateTotal = () => {
      let total = 0;
      rowsEl.querySelectorAll('.po-row').forEach(r => {
        const qty = parseFloat(r.querySelector('.po-qty').value) || 0;
        const cost = parseFloat(r.querySelector('.po-cost').value) || 0;
        r.querySelector('.po-line-total').textContent = Ui.fmt(qty * cost);
        total += qty * cost;
      });
      $('#po-total').textContent = Ui.fmt(total);
    };
    const addRow = (product) => {
      const row = document.createElement('div');
      row.className = 'po-row';
      row.innerHTML = `
        <select class="po-prod">${pool.map(p => `<option value="${p.id}" ${product && p.id === product.id ? 'selected' : ''}>${Ui.esc(p.name)}</option>`).join('')}</select>
        <input class="po-qty" type="number" min="1" placeholder="Qty" value="10"/>
        <input class="po-cost" type="number" min="0" step="0.01" placeholder="Cost ₹"/>
        <span class="po-line-total">₹0</span>
        <button type="button" class="bq-del" title="Remove">✕</button>`;
      const syncCost = () => {
        const p = pool.find(x => x.id === parseInt(row.querySelector('.po-prod').value));
        if (p) row.querySelector('.po-cost').value = parseFloat(p.purchasePrice);
        updateTotal();
      };
      row.querySelector('.po-prod').addEventListener('change', syncCost);
      row.querySelector('.po-qty').addEventListener('input', updateTotal);
      row.querySelector('.po-cost').addEventListener('input', updateTotal);
      row.querySelector('.bq-del').addEventListener('click', () => { row.remove(); updateTotal(); });
      rowsEl.appendChild(row);
      syncCost();
    };
    addRow(prefillProduct);
    $('#po-add-row').addEventListener('click', () => addRow());

    $('#po-vendor').addEventListener('change', async e => {
      if (e.target.value !== '__new') return;
      const name = prompt('New vendor name:');
      if (!name) { e.target.value = ''; return; }
      try {
        const v = await Api.post('/vendors', { name });
        e.target.insertAdjacentHTML('afterbegin', `<option value="${v.id}">${Ui.esc(v.name)}</option>`);
        e.target.value = v.id;
        this.vendors.push(v);
        Ui.toast('Vendor added');
      } catch (err) { Ui.toast(err.message, 'error'); e.target.value = ''; }
    });

    $('#po-cancel').addEventListener('click', m.close);
    $('#po-save').addEventListener('click', async () => {
      const vendorId = parseInt($('#po-vendor').value);
      const vendor = this.vendors.find(v => v.id === vendorId);
      if (!vendor) { Ui.toast('Select a vendor', 'error'); return; }
      const items = [...rowsEl.querySelectorAll('.po-row')].map(r => {
        const p = pool.find(x => x.id === parseInt(r.querySelector('.po-prod').value));
        const quantity = parseInt(r.querySelector('.po-qty').value) || 0;
        const cost = parseFloat(r.querySelector('.po-cost').value) || 0;
        return p && quantity > 0 ? {
          productId: p.id, name: p.name, category: p.category, unit: p.unit,
          quantity, cost, sellingPrice: parseFloat(p.sellingPrice), mrp: parseFloat(p.mrp),
          totalCost: quantity * cost
        } : null;
      }).filter(Boolean);
      if (!items.length) { Ui.toast('Add at least one item with quantity', 'error'); return; }

      const totalAmount = items.reduce((s, i) => s + i.totalCost, 0);
      const status = $('#po-pay').value;
      try {
        await Api.post('/purchases', {
          vendorId, vendorName: vendor.name,
          vendorBillNo: $('#po-billno').value.trim() || undefined,
          billDate: $('#po-date').value,
          paymentMode: status === 'paid' ? 'cash' : 'credit',
          paymentDate: status === 'paid' ? new Date().toISOString() : undefined,
          items, totalAmount, grandTotal: totalAmount, status
        });
        Ui.toast('PO created — stock updated 📦');
        m.close();
        this.tab = 'po';
        this.render(document.getElementById('page'));
      } catch (e) { Ui.toast(e.message, 'error'); }
    });
  },

  viewPo(po) {
    Ui.modal({
      title: `PO-${String(po.id).padStart(4, '0')} · ${Ui.esc(po.vendorName)}`,
      body: `
        <div class="pay-summary">
          <div class="tot-row"><span>Bill date</span><span>${Ui.fmtDate(po.billDate)}</span></div>
          ${po.vendorBillNo ? `<div class="tot-row"><span>Vendor bill</span><span>${Ui.esc(po.vendorBillNo)}</span></div>` : ''}
          <div class="tot-row"><span>Payment</span><span class="badge ${po.status === 'paid' ? 'paid' : 'unpaid'}">${po.status}</span></div>
        </div>
        ${(po.items || []).map(i => `
          <div class="list-row"><span>${Ui.esc(i.name)}<div class="muted">${i.quantity} ${Ui.esc(i.unit || '')} × ${Ui.fmt(i.cost)}</div></span><b>${Ui.fmt(i.totalCost)}</b></div>`).join('')}
        <div class="tot-row grand" style="margin-top:8px"><span>Total</span><span>${Ui.fmt(po.grandTotal)}</span></div>`
    });
  },

  async markPaid(po) {
    try {
      await Api.request('PATCH', `/purchases/${po.id}/status`, { status: 'paid' });
      Ui.toast('Marked as paid');
      this.loadTab();
    } catch (e) { Ui.toast(e.message, 'error'); }
  },

  async deletePo(po) {
    const ok = await Ui.confirm('Delete PO?', `PO-${String(po.id).padStart(4, '0')} will be deleted and the received stock <b>reversed</b> from inventory.`, 'Delete PO');
    if (!ok) return;
    try {
      await Api.del(`/purchases/${po.id}`);
      Ui.toast('PO deleted, stock reversed');
      this.loadTab();
    } catch (e) { Ui.toast(e.message, 'error'); }
  },

  // ---------- VENDORS ----------
  async vendorsTab(box) {
    box.innerHTML = '<div class="loader"></div>';
    try {
      this.vendors = (await Api.get('/vendors')).vendors || [];
    } catch (e) { box.innerHTML = `<div class="empty-state">${Ui.esc(e.message)}</div>`; return; }

    box.innerHTML = `
      <div class="toolbar">
        <div class="spacer"></div>
        <button class="btn btn-primary" id="vn-add"><span data-icon="plus"></span> Add Vendor</button>
      </div>
      <div class="card" style="padding:8px 6px">
        ${this.vendors.length ? `
        <table class="tbl">
          <thead><tr><th>Vendor</th><th>Contact</th><th style="text-align:right">Actions</th></tr></thead>
          <tbody>${this.vendors.map(v => `
            <tr>
              <td><b>${Ui.esc(v.name)}</b></td>
              <td>${Ui.esc(v.phone || '—')}${v.email ? `<div class="muted">${Ui.esc(v.email)}</div>` : ''}</td>
              <td style="text-align:right;white-space:nowrap">
                <button class="btn btn-ghost btn-sm" data-edit="${v.id}">Edit</button>
                <button class="btn btn-danger btn-sm" data-del="${v.id}">🗑</button>
              </td>
            </tr>`).join('')}</tbody>
        </table>` : '<div class="empty-state"><div class="big">🏢</div><h3>No vendors yet</h3><p>Add suppliers you buy outsourced items from</p></div>'}
      </div>`;
    Ui.hydrateIcons(box);
    box.querySelector('#vn-add').addEventListener('click', () => this.vendorForm(null));
    box.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => this.vendorForm(this.vendors.find(v => v.id === parseInt(b.dataset.edit)))));
    box.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', async () => {
      const v = this.vendors.find(x => x.id === parseInt(b.dataset.del));
      const ok = await Ui.confirm('Delete vendor?', `<b>${Ui.esc(v.name)}</b> will be removed. Past POs remain.`, 'Delete');
      if (!ok) return;
      try { await Api.del(`/vendors/${v.id}`); Ui.toast('Vendor deleted'); this.loadTab(); }
      catch (e) { Ui.toast(e.message, 'error'); }
    }));
  },

  vendorForm(v) {
    const isEdit = !!v;
    const m = Ui.modal({
      title: isEdit ? `Edit · ${Ui.esc(v.name)}` : 'Add Vendor',
      body: `
        <div class="field"><label>Name *</label><input id="vf-name" value="${Ui.esc(v?.name || '')}"/></div>
        <div class="form-grid">
          <div class="field"><label>Phone</label><input id="vf-phone" value="${Ui.esc(v?.phone || '')}"/></div>
          <div class="field"><label>Email</label><input id="vf-email" value="${Ui.esc(v?.email || '')}"/></div>
        </div>
        <div class="field"><label>Address</label><textarea id="vf-addr" rows="2">${Ui.esc(v?.address || '')}</textarea></div>`,
      foot: `<button class="btn btn-ghost" id="vf-cancel">Cancel</button><button class="btn btn-primary" id="vf-save">${isEdit ? 'Save' : 'Add Vendor'}</button>`
    });
    m.el.querySelector('#vf-cancel').addEventListener('click', m.close);
    m.el.querySelector('#vf-save').addEventListener('click', async () => {
      const body = {
        name: m.el.querySelector('#vf-name').value.trim(),
        phone: m.el.querySelector('#vf-phone').value.trim() || null,
        email: m.el.querySelector('#vf-email').value.trim() || null,
        address: m.el.querySelector('#vf-addr').value.trim() || null
      };
      if (!body.name) { Ui.toast('Vendor name is required', 'error'); return; }
      try {
        if (isEdit) await Api.put(`/vendors/${v.id}`, body);
        else await Api.post('/vendors', body);
        Ui.toast(isEdit ? 'Vendor updated' : 'Vendor added');
        m.close();
        this.loadTab();
      } catch (e) { Ui.toast(e.message, 'error'); }
    });
  }
};
