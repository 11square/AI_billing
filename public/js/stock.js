// ===== Stock page =====
// Stock & Purchase Orders used to share one page — they're now separate nav
// items. This object handles the Stock overview only. Purchase orders and
// vendors live in the `PurchaseOrders` object below (same file for now).
const Stock = {
  products: [],
  vendors: [],
  purchases: [],
  sourceFilter: 'outsourced',

  render(el) {
    el.innerHTML = '<div class="loader"></div>';
    this.stockTab(el);
  },

  // Modal save handlers call this.loadTab() after a change. They're shared
  // between the Stock page and the Purchase Orders page, so we route by the
  // current URL hash — otherwise a vendor edit on the PO page would try to
  // refresh a Stock DOM that isn't mounted.
  loadTab() {
    const hash = (location.hash || '').slice(1);
    const box = document.getElementById('page');
    if (!box) return;
    if (hash === 'po') PurchaseOrders.loadTab();
    else this.stockTab(box);
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
            <button class="btn btn-green btn-sm" data-add="${p.id}">+ Add stock</button>
            ${(p.sourceType || 'own') === 'outsourced'
              ? `<button class="btn btn-ghost btn-sm" data-po="${p.id}" title="Record as a formal purchase order">+ PO</button>`
              : ''}
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
      // Manual "+ Add stock" — bumps stock without going through the PO flow.
      document.querySelectorAll('#stk-table [data-add]').forEach(b => b.addEventListener('click', () => {
        const p = this.products.find(x => x.id === parseInt(b.dataset.add));
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
      </div>
      <div class="card" style="padding:8px 6px"><div id="stk-table"></div></div>`;
    Ui.hydrateIcons(box);
    box.querySelectorAll('[data-f]').forEach(b => b.addEventListener('click', () => {
      this.sourceFilter = b.dataset.f;
      box.querySelectorAll('[data-f]').forEach(x => x.classList.toggle('active', x === b));
      render();
    }));
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

    const dashIf = v => v ? Ui.fmtDate(v) : '<span class="muted">—</span>';
    // Delivery status → coloured chip (badge classes reused).
    const deliveryChip = (s) => {
      const map = {
        delivered:            { cls: 'paid',    label: 'delivered' },
        partially_delivered:  { cls: 'partial', label: 'partial' },
        approved:             { cls: 'partial', label: 'approved' },
        pending:              { cls: 'unpaid',  label: 'pending' },
        cancelled:            { cls: 'unpaid',  label: 'cancelled' }
      };
      const m = map[s] || map.pending;
      return `<span class="badge ${m.cls}">${m.label}</span>`;
    };
    const rows = this.purchases.map(po => {
      const notFullyReceived = po.deliveryStatus !== 'delivered' && po.deliveryStatus !== 'cancelled';
      return `
      <tr>
        <td><b>PO-${String(po.id).padStart(4, '0')}</b>${po.vendorBillNo ? `<div class="muted">Bill: ${Ui.esc(po.vendorBillNo)}</div>` : ''}</td>
        <td>${Ui.esc(po.vendorName)}</td>
        <td class="muted" style="white-space:nowrap">${dashIf(po.orderDate)}</td>
        <td class="muted" style="white-space:nowrap">${dashIf(po.expectedDelivery)}</td>
        <td class="muted" style="white-space:nowrap">${dashIf(po.receivedDate)}</td>
        <td>${(po.items || []).length} items</td>
        <td><b>${Ui.fmt(po.grandTotal)}</b></td>
        <td>${deliveryChip(po.deliveryStatus || 'pending')}</td>
        <td><span class="badge ${po.status === 'paid' ? 'paid' : po.status === 'partial' ? 'partial' : 'unpaid'}">${po.status}</span></td>
        <td style="text-align:right;white-space:nowrap">
          <button class="btn btn-ghost btn-sm" data-act="view" data-id="${po.id}">View</button>
          ${notFullyReceived ? `<button class="btn btn-green btn-sm" data-act="receive" data-id="${po.id}">📦 Receive</button>` : ''}
          ${po.status !== 'paid' ? `<button class="btn btn-ghost btn-sm" data-act="paid" data-id="${po.id}">Mark Paid</button>` : ''}
          <button class="btn btn-danger btn-sm" data-act="del" data-id="${po.id}">🗑</button>
        </td>
      </tr>`;
    }).join('');

    box.innerHTML = `
      <div class="toolbar">
        <div class="muted" style="font-weight:600">Purchase orders are requests to suppliers — stock updates only when you record a delivery.</div>
        <div class="spacer"></div>
        <button class="btn btn-primary" id="po-new"><span data-icon="plus"></span> New Purchase Order</button>
      </div>
      <div class="card" style="padding:8px 6px">
        ${this.purchases.length ? `<table class="tbl"><thead><tr><th>PO</th><th>Vendor</th><th>Ordered</th><th>Expected</th><th>Received</th><th>Items</th><th>Total</th><th>Delivery</th><th>Payment</th><th style="text-align:right">Actions</th></tr></thead><tbody>${rows}</tbody></table>`
        : '<div class="empty-state"><div class="big">📝</div><h3>No purchase orders yet</h3><p>Create a PO to request raw materials or outsourced products from a supplier</p></div>'}
      </div>`;
    Ui.hydrateIcons(box);
    box.querySelector('#po-new').addEventListener('click', () => this.openPoForm());
    box.querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', () => {
      const po = this.purchases.find(x => x.id === parseInt(b.dataset.id));
      if (b.dataset.act === 'view') this.viewPo(po);
      else if (b.dataset.act === 'receive') this.openReceiveForm(po);
      else if (b.dataset.act === 'paid') this.markPaid(po);
      else this.deletePo(po);
    }));
  },

  // ---------- Record Delivery (Stock In) ----------
  openReceiveForm(po) {
    if (!po.items || !po.items.length) { Ui.toast('This PO has no items', 'error'); return; }
    const fmtQty = n => { const v = parseFloat(n) || 0; return v % 1 ? v.toFixed(3) : v.toString(); };
    const lineRow = (item) => {
      const ordered = parseFloat(item.quantity);
      const already = parseFloat(item.quantityReceived);
      const remaining = ordered - already;
      const disabled = remaining <= 0 ? 'disabled' : '';
      const kind = item.rawMaterialId ? '🥣 raw material' : (item.productId ? '🚚 product' : '—');
      return `
        <tr>
          <td><b>${Ui.esc(item.name)}</b><div class="muted" style="font-size:11.5px">${kind}</div></td>
          <td class="muted">${fmtQty(ordered)} ${Ui.esc(item.unit)}</td>
          <td class="muted">${fmtQty(already)} ${Ui.esc(item.unit)}</td>
          <td>
            <input class="rc-qty" type="number" min="0" step="any" max="${remaining}"
              value="${remaining > 0 ? remaining : 0}" data-item="${item.id}" data-remaining="${remaining}"
              placeholder="0" ${disabled}/>
            <div class="muted" style="font-size:11.5px">of ${fmtQty(remaining)} ${Ui.esc(item.unit)} remaining</div>
          </td>
        </tr>`;
    };
    const modal = Ui.modal({
      title: `📦 Record delivery · PO-${String(po.id).padStart(4, '0')}`,
      wide: true,
      body: `
        <div class="pay-summary" style="margin-bottom:14px">
          <div class="tot-row"><span>Vendor</span><span><b>${Ui.esc(po.vendorName)}</b></span></div>
          ${po.expectedDelivery ? `<div class="tot-row"><span>Expected</span><span>${Ui.fmtDate(po.expectedDelivery)}</span></div>` : ''}
          <div class="tot-row"><span>Status</span><span><b>${Ui.esc(po.deliveryStatus || 'pending')}</b></span></div>
        </div>
        <div class="card" style="padding:8px 6px">
          <table class="tbl">
            <thead><tr><th>Item</th><th>Ordered</th><th>Already received</th><th>Receiving now</th></tr></thead>
            <tbody>${po.items.map(lineRow).join('')}</tbody>
          </table>
        </div>
        <div class="field full" style="margin-top:12px"><label>Remarks (optional)</label>
          <input id="rc-remarks" placeholder="e.g. delivered by Karthik, box 3 damaged"/>
        </div>
        <div class="muted" style="font-size:12px;margin-top:10px">Zero out any line that wasn't in this delivery. Raw materials will land in your inventory with a stock_in movement; outsourced product stock is bumped directly.</div>`,
      foot: `<button class="btn btn-ghost" id="rc-cancel">Cancel</button>
             <button class="btn btn-primary" id="rc-save">Record delivery</button>`
    });
    modal.el.querySelector('#rc-cancel').addEventListener('click', modal.close);
    modal.el.querySelector('#rc-save').addEventListener('click', async () => {
      const lines = [...modal.el.querySelectorAll('.rc-qty')]
        .map(inp => ({
          purchaseItemId: parseInt(inp.dataset.item),
          quantityReceived: parseFloat(inp.value) || 0
        }))
        .filter(l => l.quantityReceived > 0);
      if (!lines.length) { Ui.toast('Enter quantity for at least one line', 'error'); return; }
      try {
        const updated = await Api.post(`/purchases/${po.id}/receive`, {
          lines,
          remarks: modal.el.querySelector('#rc-remarks').value.trim() || null,
          date: new Date().toISOString().slice(0, 10)
        });
        Ui.toast(`Stock received · PO is now ${updated.deliveryStatus.replace('_', ' ')}`);
        modal.close();
        if ((location.hash || '') === '#po') PurchaseOrders.loadTab();
      } catch (e) { Ui.toast(e.message, 'error'); }
    });
  },

  async openPoForm(prefillProduct) {
    // Load products + vendors + raw materials in parallel. The item catalog
    // spans both: raw materials (kind='raw') AND outsourced products
    // (kind='product'). Own products don't belong on a PO.
    let rawMaterials = [];
    try {
      const [prod, vRes, raw] = await Promise.all([
        this.products.length ? Promise.resolve({ products: this.products }) : Api.get('/grocery'),
        Api.get('/vendors'),
        Api.get('/raw-materials')
      ]);
      this.products = prod.products || this.products;
      this.vendors = vRes.vendors || [];
      rawMaterials = raw || [];
    } catch (e) { Ui.toast(e.message, 'error'); return; }

    const outsourced = this.products.filter(p => (p.sourceType || 'own') === 'outsourced');
    // Combined catalog: raw materials first (they're the primary PO subject
    // now that recipes drive most of the shop), then outsourced products.
    const catalog = [
      ...rawMaterials.map(rm => ({
        key: `raw:${rm.id}`, kind: 'raw', id: rm.id,
        label: `🥣 ${rm.name}`, name: rm.name, unit: rm.unit,
        defaultCost: 0
      })),
      ...outsourced.map(p => ({
        key: `product:${p.id}`, kind: 'product', id: p.id,
        label: `🚚 ${p.name}`, name: p.name, unit: p.unit,
        category: p.category, defaultCost: parseFloat(p.purchasePrice) || 0,
        sellingPrice: parseFloat(p.sellingPrice) || 0,
        mrp: parseFloat(p.mrp) || 0
      }))
    ];

    const today = new Date();
    const pad = n => String(n).padStart(2, '0');
    const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
    const prefillKey = prefillProduct ? `product:${prefillProduct.id}` : (catalog[0] ? catalog[0].key : null);

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
          <div class="field"><label>Order placed on *</label><input type="date" id="po-order-date" value="${todayStr}"/></div>
          <div class="field"><label>Bill / invoice date</label><input type="date" id="po-date" value="${todayStr}"/></div>
          <div class="field"><label>Expected delivery</label><input type="date" id="po-expected"/></div>
          <div class="field"><label>Vendor bill no.</label><input id="po-billno" placeholder="optional"/></div>
          <div class="field"><label>Payment</label>
            <select id="po-pay">
              <option value="pending">Credit — pay later</option>
              <option value="paid">Paid now</option>
            </select></div>
        </div>
        <label style="display:block;font-size:12.5px;font-weight:700;color:var(--ink-2);margin:6px 0">Items *</label>
        <div class="muted" style="font-size:11.5px;margin-bottom:8px">🥣 raw materials · 🚚 outsourced (finished) products. Own-made items are not ordered directly.</div>
        <div id="po-rows"></div>
        <button type="button" class="btn btn-ghost btn-sm" id="po-add-row">+ Add item</button>
        <div class="field full" style="margin-top:12px"><label>Notes</label>
          <textarea id="po-notes" rows="2" placeholder="Anything the supplier or receiver should know…"></textarea>
        </div>
        <div class="pay-summary" style="margin-top:14px">
          <div class="tot-row grand"><span>PO Total</span><span id="po-total">₹0</span></div>
        </div>
        <div class="muted" style="font-size:11.5px;margin-top:10px">Creating a PO records the request only — no inventory changes yet. Use <b>Record delivery</b> from the PO's View screen when goods arrive.</div>`,
      foot: `<button class="btn btn-ghost" id="po-cancel">Cancel</button>
             <button class="btn btn-primary" id="po-save">Create Purchase Order</button>`
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
    const addRow = (preselectKey) => {
      if (!catalog.length) {
        rowsEl.innerHTML = '<div class="empty-state"><div class="big">🥣</div><h3>Nothing to order</h3><p>Add raw materials or outsourced products first.</p></div>';
        return;
      }
      const row = document.createElement('div');
      row.className = 'po-row';
      row.innerHTML = `
        <select class="po-prod">${catalog.map(c => `<option value="${c.key}" ${preselectKey === c.key ? 'selected' : ''}>${Ui.esc(c.label)} (${Ui.esc(c.unit)})</option>`).join('')}</select>
        <input class="po-qty" type="number" min="0" step="any" placeholder="Qty" value="10"/>
        <input class="po-cost" type="number" min="0" step="0.01" placeholder="Cost ₹"/>
        <span class="po-line-total">₹0</span>
        <button type="button" class="bq-del" title="Remove">✕</button>`;
      const syncCost = () => {
        const c = catalog.find(x => x.key === row.querySelector('.po-prod').value);
        if (c) row.querySelector('.po-cost').value = c.defaultCost;
        updateTotal();
      };
      row.querySelector('.po-prod').addEventListener('change', syncCost);
      row.querySelector('.po-qty').addEventListener('input', updateTotal);
      row.querySelector('.po-cost').addEventListener('input', updateTotal);
      row.querySelector('.bq-del').addEventListener('click', () => { row.remove(); updateTotal(); });
      rowsEl.appendChild(row);
      syncCost();
    };
    addRow(prefillKey);
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
        const c = catalog.find(x => x.key === r.querySelector('.po-prod').value);
        const quantity = parseFloat(r.querySelector('.po-qty').value) || 0;
        const cost = parseFloat(r.querySelector('.po-cost').value) || 0;
        if (!c || quantity <= 0) return null;
        const line = {
          name: c.name, category: c.category || null, unit: c.unit,
          quantity, cost, totalCost: quantity * cost
        };
        if (c.kind === 'raw') line.rawMaterialId = c.id;
        else { line.productId = c.id; line.sellingPrice = c.sellingPrice; line.mrp = c.mrp; }
        return line;
      }).filter(Boolean);
      if (!items.length) { Ui.toast('Add at least one item with quantity', 'error'); return; }

      const totalAmount = items.reduce((s, i) => s + i.totalCost, 0);
      const status = $('#po-pay').value;
      try {
        await Api.post('/purchases', {
          vendorId, vendorName: vendor.name,
          vendorBillNo: $('#po-billno').value.trim() || undefined,
          billDate: $('#po-date').value,
          orderDate: $('#po-order-date').value || undefined,
          expectedDelivery: $('#po-expected').value || undefined,
          notes: $('#po-notes').value.trim() || undefined,
          paymentMode: status === 'paid' ? 'cash' : 'credit',
          paymentDate: status === 'paid' ? new Date().toISOString() : undefined,
          items, totalAmount, grandTotal: totalAmount, status,
          deliveryStatus: 'pending'
        });
        Ui.toast('Purchase order created — no stock yet. Use “Record delivery” when goods arrive.');
        m.close();
        if ((location.hash || '') === '#po') PurchaseOrders.loadTab();
        else location.hash = '#po';
      } catch (e) { Ui.toast(e.message, 'error'); }
    });
  },

  viewPo(po) {
    const fmtQty = n => { const v = parseFloat(n) || 0; return v % 1 ? v.toFixed(3) : v.toString(); };
    const notFullyReceived = po.deliveryStatus !== 'delivered' && po.deliveryStatus !== 'cancelled';
    const modal = Ui.modal({
      title: `PO-${String(po.id).padStart(4, '0')} · ${Ui.esc(po.vendorName)}`,
      wide: true,
      body: `
        <div class="pay-summary">
          ${po.orderDate ? `<div class="tot-row"><span>📝 Order placed</span><span>${Ui.fmtDate(po.orderDate)}</span></div>` : ''}
          ${po.expectedDelivery ? `<div class="tot-row"><span>📅 Expected delivery</span><span>${Ui.fmtDate(po.expectedDelivery)}</span></div>` : ''}
          <div class="tot-row"><span>🧾 Purchased / bill date</span><span>${Ui.fmtDate(po.billDate)}</span></div>
          ${po.receivedDate ? `<div class="tot-row"><span>📦 Goods received</span><span>${Ui.fmtDate(po.receivedDate)}</span></div>` : '<div class="tot-row"><span>📦 Goods received</span><span class="muted">not yet received</span></div>'}
          ${po.vendorBillNo ? `<div class="tot-row"><span>Vendor bill</span><span>${Ui.esc(po.vendorBillNo)}</span></div>` : ''}
          <div class="tot-row"><span>Delivery</span><span class="badge ${po.deliveryStatus === 'delivered' ? 'paid' : po.deliveryStatus === 'partially_delivered' ? 'partial' : 'unpaid'}">${po.deliveryStatus || 'pending'}</span></div>
          <div class="tot-row"><span>Payment</span><span class="badge ${po.status === 'paid' ? 'paid' : 'unpaid'}">${po.status}</span></div>
          ${po.notes ? `<div class="tot-row"><span>Notes</span><span class="muted">${Ui.esc(po.notes)}</span></div>` : ''}
        </div>
        <table class="tbl">
          <thead><tr><th>Item</th><th>Ordered</th><th>Received</th><th>Cost</th><th style="text-align:right">Total</th></tr></thead>
          <tbody>
            ${(po.items || []).map(i => {
              const kind = i.rawMaterialId ? '🥣' : (i.productId ? '🚚' : '');
              const remaining = parseFloat(i.quantity) - parseFloat(i.quantityReceived);
              const fill = remaining <= 0 ? '<span class="badge paid">complete</span>'
                : parseFloat(i.quantityReceived) > 0 ? `<span class="badge partial">${fmtQty(i.quantityReceived)} of ${fmtQty(i.quantity)}</span>`
                : `<span class="badge unpaid">0 of ${fmtQty(i.quantity)}</span>`;
              return `<tr>
                <td>${kind} <b>${Ui.esc(i.name)}</b></td>
                <td>${fmtQty(i.quantity)} ${Ui.esc(i.unit || '')}</td>
                <td>${fill}</td>
                <td>${Ui.fmt(i.cost)}</td>
                <td style="text-align:right"><b>${Ui.fmt(i.totalCost)}</b></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
        <div class="tot-row grand" style="margin-top:8px"><span>Total</span><span>${Ui.fmt(po.grandTotal)}</span></div>`,
      foot: `<button class="btn btn-ghost" id="pv-close">Close</button>
             ${notFullyReceived ? '<button class="btn btn-primary" id="pv-receive">📦 Record delivery</button>' : ''}`
    });
    modal.el.querySelector('#pv-close').addEventListener('click', modal.close);
    const rc = modal.el.querySelector('#pv-receive');
    if (rc) rc.addEventListener('click', () => { modal.close(); this.openReceiveForm(po); });
  },

  async markPaid(po) {
    try {
      await Api.request('PATCH', `/purchases/${po.id}/status`, { status: 'paid' });
      Ui.toast('Marked as paid');
      this.loadTab();
    } catch (e) { Ui.toast(e.message, 'error'); }
  },

  async deletePo(po) {
    const ok = await Ui.confirm('Delete PO?',
      `PO-${String(po.id).padStart(4, '0')} will be permanently removed.<br>Note: this only works if no goods have been received yet — received stock stays in inventory forever.`,
      'Delete PO');
    if (!ok) return;
    try {
      await Api.del(`/purchases/${po.id}`);
      Ui.toast('PO deleted');
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

// ===== Purchase Orders page =====
// Split off from Stock so the sidebar has separate nav items. Reuses the
// existing Stock.poTab / Stock.vendorsTab / Stock.openPoForm implementations
// so behaviour and modals stay in sync between pages.
const PurchaseOrders = {
  tab: 'po',   // 'po' | 'vendors'

  render(el) {
    el.innerHTML = `
      <div class="rep-tabs" id="po-tabs">
        <button class="rep-tab ${this.tab === 'po' ? 'active' : ''}" data-t="po">📝 Purchase Orders</button>
        <button class="rep-tab ${this.tab === 'vendors' ? 'active' : ''}" data-t="vendors">🏢 Vendors</button>
      </div>
      <div id="po-body"><div class="loader"></div></div>`;
    el.querySelector('#po-tabs').addEventListener('click', e => {
      const b = e.target.closest('.rep-tab'); if (!b) return;
      this.tab = b.dataset.t;
      el.querySelectorAll('.rep-tab').forEach(x => x.classList.toggle('active', x === b));
      this.loadTab();
    });
    this.loadTab();
  },

  loadTab() {
    const box = document.getElementById('po-body');
    if (!box) return;
    if (this.tab === 'po') Stock.poTab(box);
    else Stock.vendorsTab(box);
  }
};
