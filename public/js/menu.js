// ===== Menu items (products) page =====
const Menu = {
  products: [],
  search: '',
  category: 'All',

  async render(el) {
    el.innerHTML = '<div class="loader"></div>';
    try {
      const res = await Api.get('/grocery');
      this.products = res.products || [];
    } catch (e) {
      el.innerHTML = `<div class="empty-state"><div class="big">⚠️</div><h3>Could not load menu</h3><p>${Ui.esc(e.message)}</p></div>`;
      return;
    }

    const cats = ['All', ...new Set(this.products.map(p => p.category))];
    el.innerHTML = `
      <div class="toolbar">
        <div class="search-box"><span data-icon="search"></span><input id="menu-search" placeholder="Search items…" value="${Ui.esc(this.search)}"/></div>
        <select class="select" id="menu-cat">${cats.map(c => `<option ${c === this.category ? 'selected' : ''}>${Ui.esc(c)}</option>`).join('')}</select>
        <div class="spacer"></div>
        <button class="btn btn-primary" id="menu-add"><span data-icon="plus"></span> Add Item</button>
      </div>
      <div class="menu-grid" id="menu-grid"></div>`;
    Ui.hydrateIcons(el);

    el.querySelector('#menu-search').addEventListener('input', e => { this.search = e.target.value.toLowerCase(); this.renderGrid(); });
    el.querySelector('#menu-cat').addEventListener('change', e => { this.category = e.target.value; this.renderGrid(); });
    el.querySelector('#menu-add').addEventListener('click', () => this.openForm(null));
    this.renderGrid();
  },

  renderGrid() {
    const grid = document.getElementById('menu-grid');
    if (!grid) return;
    const items = this.products.filter(p =>
      (this.category === 'All' || p.category === this.category) &&
      (!this.search || p.name.toLowerCase().includes(this.search))
    );
    if (!items.length) {
      grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><div class="big">🍽️</div><h3>No menu items</h3><p>Add your first item to start billing</p></div>';
      return;
    }
    grid.innerHTML = items.map(p => {
      const stockCls = p.stock <= 0 ? 'out' : (p.stock <= p.minStock ? 'low' : '');
      return `
      <div class="menu-card">
        ${Ui.imgTag(p.image, p.category, 'item-img')}
        <div class="menu-card-body">
          <div class="mc-cat">${Ui.esc(p.category)}</div>
          <div class="mc-name">${Ui.esc(p.name)}</div>
          <div class="mc-row">
            <span class="item-price">${Ui.fmt(p.sellingPrice)} <span class="muted" style="font-size:11px">/ ${Ui.esc(p.unit)}</span></span>
            <span class="item-stock ${stockCls}">${p.stock <= 0 ? 'Out of stock' : p.stock + ' in stock'}</span>
          </div>
          <div class="mc-row">
            <span class="src-badge ${p.sourceType === 'outsourced' ? 'out' : 'own'}">${p.sourceType === 'outsourced' ? '🚚 Outsourced' : '🏭 Own'}</span>
            ${p.sourceType !== 'outsourced' ? `<span class="muted" style="font-size:11px">${(p.boq || []).length ? `BOQ · ${(p.boq || []).length} items` : 'No BOQ set'}</span>` : ''}
          </div>
          <div class="mc-actions">
            <button class="btn btn-ghost btn-sm" data-act="edit" data-id="${p.id}">✏️ Edit</button>
            <button class="btn btn-ghost btn-sm" data-act="restock" data-id="${p.id}">📦 Restock</button>
            <button class="btn btn-danger btn-sm" data-act="del" data-id="${p.id}" style="flex:0 0 auto">🗑</button>
          </div>
        </div>
      </div>`;
    }).join('');

    grid.querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', () => {
      const p = this.products.find(x => x.id === parseInt(b.dataset.id));
      if (b.dataset.act === 'edit') this.openForm(p);
      else if (b.dataset.act === 'restock') this.openRestock(p);
      else this.remove(p);
    }));
  },

  openForm(p) {
    const isEdit = !!p;
    const m = Ui.modal({
      title: isEdit ? `Edit · ${Ui.esc(p.name)}` : 'Add Menu Item',
      wide: true,
      body: `
        <img class="img-preview" id="mf-preview" src="${p?.image ? Ui.esc(p.image) : Ui.placeholder(p?.category)}" onerror="this.src='${Ui.placeholder(p?.category)}'"/>
        <div class="form-grid">
          <div class="field full"><label>Item name *</label><input id="mf-name" value="${Ui.esc(p?.name || '')}" placeholder="e.g. Cappuccino"/></div>
          <div class="field"><label>Category *</label><input id="mf-cat" list="mf-cats" value="${Ui.esc(p?.category || '')}" placeholder="Coffee / Snacks…"/>
            <datalist id="mf-cats">${['Coffee','Tea','Snacks','Desserts','Beverages'].map(c => `<option>${c}</option>`).join('')}</datalist></div>
          <div class="field"><label>Unit</label><input id="mf-unit" value="${Ui.esc(p?.unit || 'piece')}" placeholder="cup / plate / piece"/></div>
          <div class="field"><label>Selling price ₹ *</label><input id="mf-price" type="number" min="0" step="0.01" value="${p?.sellingPrice || ''}"/></div>
          <div class="field"><label>MRP ₹</label><input id="mf-mrp" type="number" min="0" step="0.01" value="${p?.mrp || ''}"/></div>
          <div class="field"><label>Cost price ₹ *</label><input id="mf-cost" type="number" min="0" step="0.01" value="${p?.purchasePrice || ''}"/></div>
          ${isEdit ? '' : `<div class="field"><label>Opening stock</label><input id="mf-stock" type="number" min="0" value="0"/></div>`}
          <div class="field"><label>Low-stock alert at</label><input id="mf-minstock" type="number" min="0" value="${p?.minStock ?? 10}"/></div>
          <div class="field ${isEdit ? '' : 'full'}"><label>Barcode (optional)</label><input id="mf-barcode" value="${Ui.esc(p?.barcode || '')}"/></div>
          <div class="field full"><label>Image URL</label><input id="mf-img" value="${Ui.esc(p?.image || '')}" placeholder="https://…jpg"/></div>
          <div class="field full"><label>Description</label><textarea id="mf-desc" rows="2">${Ui.esc(p?.description || '')}</textarea></div>
          <div class="field full"><label>Source *</label>
            <select id="mf-source">
              <option value="own" ${(p?.sourceType || 'own') === 'own' ? 'selected' : ''}>🏭 Own — manufactured by us</option>
              <option value="outsourced" ${p?.sourceType === 'outsourced' ? 'selected' : ''}>🚚 Outsourced — purchased from vendor</option>
            </select>
          </div>
          <div class="full" id="mf-boq-wrap">
            <label style="display:block;font-size:12.5px;font-weight:700;color:var(--ink-2);margin-bottom:6px">BOQ — Bill of Quantities (per 1 ${Ui.esc(p?.unit || 'unit')} sold)</label>
            <div id="mf-boq-rows"></div>
            <button type="button" class="btn btn-ghost btn-sm" id="mf-boq-add">+ Add ingredient</button>
          </div>
          <div class="full" id="mf-out-hint" style="display:none">
            <div class="pay-summary" style="margin-bottom:14px">🚚 Outsourced items are stocked through <b>Purchase Orders</b> — manage them in the <b>Stock &amp; PO</b> module.</div>
          </div>
        </div>`,
      foot: `<button class="btn btn-ghost" id="mf-cancel">Cancel</button>
             <button class="btn btn-primary" id="mf-save">${isEdit ? 'Save Changes' : 'Add Item'}</button>`
    });

    const $ = s => m.el.querySelector(s);
    $('#mf-img').addEventListener('input', e => { $('#mf-preview').src = e.target.value || Ui.placeholder($('#mf-cat').value); });
    $('#mf-cancel').addEventListener('click', m.close);

    // ----- BOQ editor -----
    const boqRows = $('#mf-boq-rows');
    const addBoqRow = (line = {}) => {
      const row = document.createElement('div');
      row.className = 'boq-row';
      row.innerHTML = `
        <input class="bq-ing" placeholder="Ingredient (e.g. Milk)" value="${Ui.esc(line.ingredient || '')}"/>
        <input class="bq-qty" type="number" min="0" step="any" placeholder="Qty" value="${line.qty ?? ''}"/>
        <input class="bq-unit" placeholder="Unit (g / ml / pc)" value="${Ui.esc(line.unit || '')}"/>
        <button type="button" class="bq-del" title="Remove">✕</button>`;
      row.querySelector('.bq-del').addEventListener('click', () => row.remove());
      boqRows.appendChild(row);
    };
    (Array.isArray(p?.boq) && p.boq.length ? p.boq : [{}]).forEach(addBoqRow);
    $('#mf-boq-add').addEventListener('click', () => addBoqRow());

    const syncSource = () => {
      const own = $('#mf-source').value === 'own';
      $('#mf-boq-wrap').style.display = own ? '' : 'none';
      $('#mf-out-hint').style.display = own ? 'none' : '';
    };
    syncSource();
    $('#mf-source').addEventListener('change', syncSource);
    $('#mf-save').addEventListener('click', async () => {
      const body = {
        name: $('#mf-name').value.trim(),
        category: $('#mf-cat').value.trim() || 'Other',
        unit: $('#mf-unit').value.trim() || 'piece',
        sellingPrice: parseFloat($('#mf-price').value),
        mrp: parseFloat($('#mf-mrp').value) || parseFloat($('#mf-price').value),
        purchasePrice: parseFloat($('#mf-cost').value),
        gstRate: 0,
        minStock: parseInt($('#mf-minstock').value) || 0,
        barcode: $('#mf-barcode').value.trim() || undefined,
        image: $('#mf-img').value.trim() || null,
        description: $('#mf-desc').value.trim() || null,
        sourceType: $('#mf-source').value
      };
      if (body.sourceType === 'own') {
        body.boq = [...m.el.querySelectorAll('.boq-row')].map(r => ({
          ingredient: r.querySelector('.bq-ing').value.trim(),
          qty: parseFloat(r.querySelector('.bq-qty').value) || 0,
          unit: r.querySelector('.bq-unit').value.trim()
        })).filter(l => l.ingredient && l.qty > 0);
      } else {
        body.boq = [];
      }
      if (!body.name || isNaN(body.sellingPrice) || isNaN(body.purchasePrice)) {
        Ui.toast('Name, selling price and cost price are required', 'error'); return;
      }
      if (!isEdit) body.stock = parseInt($('#mf-stock').value) || 0;
      try {
        if (isEdit) await Api.put(`/grocery/${p.id}`, body);
        else await Api.post('/grocery', body);
        Ui.toast(isEdit ? 'Item updated' : 'Item added to menu');
        m.close();
        this.render(document.getElementById('page'));
      } catch (e) { Ui.toast(e.message, 'error'); }
    });
  },

  openRestock(p) {
    const m = Ui.modal({
      title: `Restock · ${Ui.esc(p.name)}`,
      body: `
        <div class="pay-summary"><div class="tot-row"><span>Current stock</span><span><b>${p.stock} ${Ui.esc(p.unit)}</b></span></div></div>
        <div class="field"><label>Add quantity *</label><input id="rs-qty" type="number" min="1" placeholder="e.g. 50"/></div>
        <div class="form-grid">
          <div class="field"><label>New cost price ₹ (optional)</label><input id="rs-cost" type="number" min="0" step="0.01" placeholder="${p.purchasePrice}"/></div>
          <div class="field"><label>New selling price ₹ (optional)</label><input id="rs-price" type="number" min="0" step="0.01" placeholder="${p.sellingPrice}"/></div>
        </div>`,
      foot: `<button class="btn btn-ghost" id="rs-cancel">Cancel</button>
             <button class="btn btn-primary" id="rs-save">Add Stock</button>`
    });
    m.el.querySelector('#rs-cancel').addEventListener('click', m.close);
    m.el.querySelector('#rs-save').addEventListener('click', async () => {
      const qty = parseInt(m.el.querySelector('#rs-qty').value);
      if (!qty || qty <= 0) { Ui.toast('Enter a quantity to add', 'error'); return; }
      const body = { quantity: qty };
      const cost = parseFloat(m.el.querySelector('#rs-cost').value);
      const price = parseFloat(m.el.querySelector('#rs-price').value);
      if (!isNaN(cost)) body.purchasePrice = cost;
      if (!isNaN(price)) body.sellingPrice = price;
      try {
        await Api.put(`/grocery/${p.id}/restock`, body);
        Ui.toast(`Added ${qty} × ${p.name}`);
        m.close();
        this.render(document.getElementById('page'));
      } catch (e) { Ui.toast(e.message, 'error'); }
    });
  },

  async remove(p) {
    const ok = await Ui.confirm('Remove item?', `<b>${Ui.esc(p.name)}</b> will be removed from the menu. Past invoices are not affected.`, 'Remove');
    if (!ok) return;
    try {
      await Api.del(`/grocery/${p.id}`);
      Ui.toast('Item removed');
      this.render(document.getElementById('page'));
    } catch (e) { Ui.toast(e.message, 'error'); }
  }
};
