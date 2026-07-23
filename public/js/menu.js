// ===== Menu items (products) page =====
const Menu = {
  products: [],
  search: '',
  category: 'All',

  // Built-in serving units. A cafe sells things in wildly different shapes —
  // a single croissant is "piece", biscotti come in "g" or a labelled pack,
  // ground coffee is "kg", milk is "ml"/"L", loose cookies use "loose pc".
  // Anything the shop doesn't see here can be typed via the Custom option.
  SERVING_UNITS: {
    'Per piece / count': ['piece', 'loose pc', 'dozen', 'pack of 2', 'pack of 4', 'pack of 6', 'pack of 12'],
    'By weight':         ['g', 'kg'],
    'By volume':         ['ml', 'l'],
    'Serving container': ['plate', 'cup', 'glass', 'bowl', 'cone', 'bottle', 'jar', 'box', 'loaf', 'slice']
  },

  // Grouped select + "Custom…" option that swaps in a free-text input.
  servingUnitSelectHtml(current) {
    const cur = String(current ?? 'piece').toLowerCase();
    const allBuiltIn = Object.values(this.SERVING_UNITS).flat();
    const isCustom = current && !allBuiltIn.includes(cur);
    const groupOpts = (label, arr) =>
      `<optgroup label="${label}">${arr.map(u =>
        `<option value="${u}" ${cur === u ? 'selected' : ''}>${u}</option>`
      ).join('')}</optgroup>`;
    return `
      <select id="mf-unit" class="unit-select">
        ${Object.entries(this.SERVING_UNITS).map(([lbl, arr]) => groupOpts(lbl, arr)).join('')}
        <option value="__custom__" ${isCustom ? 'selected' : ''}>Custom…</option>
      </select>
      <input id="mf-unit-custom" class="unit-custom"
        placeholder="e.g. half plate / 250g pack / kilo"
        value="${isCustom ? Ui.esc(current) : ''}"
        style="display:${isCustom ? 'block' : 'none'};margin-top:6px"/>`;
  },

  wireServingUnit(root) {
    const sel = root.querySelector('#mf-unit');
    const inp = root.querySelector('#mf-unit-custom');
    if (!sel || !inp) return;
    sel.addEventListener('change', () => {
      const custom = sel.value === '__custom__';
      inp.style.display = custom ? 'block' : 'none';
      if (custom) inp.focus();
    });
  },

  readServingUnit(root) {
    const sel = root.querySelector('#mf-unit');
    const inp = root.querySelector('#mf-unit-custom');
    if (!sel) return 'piece';
    return sel.value === '__custom__' ? (inp?.value.trim() || 'piece') : sel.value;
  },

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
            ${p.sourceType !== 'outsourced' ? `<span class="muted" style="font-size:11px">Recipe-based</span>` : ''}
          </div>
          <div class="mc-actions">
            <button class="btn btn-ghost btn-sm" data-act="edit" data-id="${p.id}">✏️ Edit</button>
            <button class="btn btn-danger btn-sm" data-act="del" data-id="${p.id}" style="flex:0 0 auto">🗑</button>
          </div>
        </div>
      </div>`;
    }).join('');

    grid.querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', () => {
      const p = this.products.find(x => x.id === parseInt(b.dataset.id));
      if (b.dataset.act === 'edit') this.openForm(p);
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
          <div class="field full"><label>Item name in Tamil script (optional)</label>
            <input id="mf-name-tamil" value="${Ui.esc(p?.nameTamil || '')}" placeholder="e.g. கப்புச்சினோ — shown on receipts when Tamil is picked" style="font-family:'Noto Sans Tamil',inherit"/>
            <div class="muted" style="font-size:11.5px;margin-top:4px">Type the same pronunciation in Tamil letters. Leave blank to keep the English name on Tamil receipts.</div>
          </div>
          <div class="field"><label>Category *</label><input id="mf-cat" list="mf-cats" value="${Ui.esc(p?.category || '')}" placeholder="Coffee / Snacks…"/>
            <datalist id="mf-cats">${['Coffee','Tea','Snacks','Desserts','Beverages'].map(c => `<option>${c}</option>`).join('')}</datalist></div>
          <div class="field"><label>Serving unit</label>
            ${Menu.servingUnitSelectHtml(p?.unit)}
          </div>
          <div class="field"><label>Selling price ₹ *</label><input id="mf-price" type="number" min="0" step="0.01" value="${p?.sellingPrice || ''}"/></div>
          <div class="field"><label>MRP ₹</label><input id="mf-mrp" type="number" min="0" step="0.01" value="${p?.mrp || ''}"/></div>
          <div class="field"><label>Cost price ₹ *</label><input id="mf-cost" type="number" min="0" step="0.01" value="${p?.purchasePrice || ''}"/></div>
          ${isEdit ? '' : `<div class="field"><label>Opening stock</label><input id="mf-stock" type="number" min="0" value="0"/></div>`}
          <div class="field"><label>Low-stock alert at</label><input id="mf-minstock" type="number" min="0" value="${p?.minStock ?? 10}"/></div>
          <div class="field ${isEdit ? '' : 'full'}"><label>Barcode (optional)</label><input id="mf-barcode" value="${Ui.esc(p?.barcode || '')}"/></div>
          <div class="field full">
            <label>Item image</label>
            <div class="img-upload-row">
              <label class="btn btn-ghost btn-sm img-upload-btn" for="mf-img-file">📁 Choose image…</label>
              <input type="file" id="mf-img-file" accept="image/*" hidden/>
              <button type="button" class="btn btn-danger btn-sm" id="mf-img-clear" style="display:${p?.image ? '' : 'none'}">🗑 Remove image</button>
              <span class="muted" id="mf-img-name" style="font-size:12px;align-self:center">${p?.image ? 'Current image loaded' : 'No image selected'}</span>
            </div>
            <input type="hidden" id="mf-img" value="${Ui.esc(p?.image || '')}"/>
          </div>
          <div class="field full"><label>Description</label><textarea id="mf-desc" rows="2">${Ui.esc(p?.description || '')}</textarea></div>
          <div class="field full"><label>Source *</label>
            <select id="mf-source">
              <option value="own" ${(p?.sourceType || 'own') === 'own' ? 'selected' : ''}>🏭 Own — manufactured by us</option>
              <option value="outsourced" ${p?.sourceType === 'outsourced' ? 'selected' : ''}>🚚 Outsourced — purchased from vendor</option>
            </select>
          </div>
          <div class="full" id="mf-recipe-wrap">
            <label style="display:block;font-size:12.5px;font-weight:700;color:var(--ink-2);margin-bottom:6px">Recipe — raw materials consumed per 1 ${Ui.esc(p?.unit || 'unit')} sold</label>
            <div id="mf-recipe-rows"></div>
            <button type="button" class="btn btn-ghost btn-sm" id="mf-recipe-add">+ Add ingredient</button>
            <div class="muted" style="font-size:11.5px;margin-top:6px" id="mf-recipe-hint">Ingredients are auto-deducted from Raw Materials on every completed sale.</div>
          </div>
          <div class="full" id="mf-out-hint" style="display:none">
            <div class="pay-summary" style="margin-bottom:14px">🚚 Outsourced items are stocked through <b>Purchase Orders</b> — the finished product itself carries stock and no recipe is needed.</div>
          </div>
        </div>`,
      foot: `<button class="btn btn-ghost" id="mf-cancel">Cancel</button>
             <button class="btn btn-primary" id="mf-save">${isEdit ? 'Save Changes' : 'Add Item'}</button>`
    });

    const $ = s => m.el.querySelector(s);
    $('#mf-cancel').addEventListener('click', m.close);
    this.wireServingUnit(m.el);

    // ----- Image upload (device file → resized JPEG → base64 in hidden field) -----
    // Downscale to fit within a 800px box before storing so the DB doesn't
    // blow up with multi-megabyte payloads from phone cameras.
    const MAX_DIM = 800;
    const JPEG_QUALITY = 0.82;
    const readFileAsDataUrl = f => new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(f);
    });
    const resizeToDataUrl = (srcDataUrl) => new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        // JPEG keeps the payload tiny; PNG would balloon for photos.
        resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY));
      };
      img.onerror = reject;
      img.src = srcDataUrl;
    });

    $('#mf-img-file').addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) { Ui.toast('Pick an image file', 'error'); return; }
      $('#mf-img-name').textContent = 'Processing…';
      try {
        const raw = await readFileAsDataUrl(file);
        const shrunk = await resizeToDataUrl(raw);
        $('#mf-img').value = shrunk;
        $('#mf-preview').src = shrunk;
        $('#mf-img-name').textContent = `${file.name} · ${Math.round(shrunk.length / 1024)} KB (resized)`;
        $('#mf-img-clear').style.display = '';
      } catch (err) {
        $('#mf-img-name').textContent = 'Failed to read image';
        Ui.toast('Could not process image', 'error');
      }
    });

    $('#mf-img-clear').addEventListener('click', () => {
      $('#mf-img').value = '';
      $('#mf-img-file').value = '';
      $('#mf-preview').src = Ui.placeholder($('#mf-cat').value);
      $('#mf-img-name').textContent = 'No image selected';
      $('#mf-img-clear').style.display = 'none';
    });

    // ----- Recipe editor (own items only) -----
    // Loaded on demand from /api/raw-materials + existing recipe.
    const recipeRows = $('#mf-recipe-rows');
    let rawMaterials = [];
    let existingRecipe = [];
    let unitsMeta = { catalog: {}, familyOf: {} };

    const loadRecipeData = async () => {
      try {
        const [mats, rec, uc] = await Promise.all([
          Api.get('/raw-materials'),
          isEdit ? Api.get(`/recipes/product/${p.id}`) : Promise.resolve([]),
          Api.get('/raw-materials/units-catalog')
        ]);
        rawMaterials = mats;
        existingRecipe = rec;
        unitsMeta = uc;
      } catch (e) {
        Ui.toast('Could not load raw materials: ' + e.message, 'error');
      }
    };
    const materialOptions = (selectedId) => {
      if (!rawMaterials.length) return '<option value="">— No raw materials yet —</option>';
      return '<option value="">— Select —</option>' + rawMaterials.map(rm =>
        `<option value="${rm.id}" ${parseInt(selectedId) === rm.id ? 'selected' : ''}>${Ui.esc(rm.name)} (${Ui.esc(rm.unit)})</option>`
      ).join('');
    };
    const compatibleUnitsFor = (matUnit) => {
      const cat = unitsMeta.catalog || {};
      const fam = unitsMeta.familyOf?.[String(matUnit || '').toLowerCase()];
      return fam && cat[fam] ? cat[fam] : [matUnit];
    };
    const unitOptionsFor = (mat, currentUnit) => {
      const opts = compatibleUnitsFor(mat.unit);
      const cur = (currentUnit || mat.unit).toLowerCase();
      return opts.map(u => `<option value="${u}" ${cur === u ? 'selected' : ''}>${u}</option>`).join('');
    };
    const addRecipeRow = (line = {}) => {
      const row = document.createElement('div');
      row.className = 'boq-row';
      const mat = rawMaterials.find(x => x.id === parseInt(line.rawMaterialId));
      row.innerHTML = `
        <select class="bq-mat">${materialOptions(line.rawMaterialId)}</select>
        <input class="bq-qty" type="number" min="0" step="any" placeholder="Qty per unit" value="${line.quantity ?? ''}"/>
        <select class="bq-unit">${mat ? unitOptionsFor(mat, line.unit) : '<option>—</option>'}</select>
        <button type="button" class="bq-del" title="Remove">✕</button>`;
      const matSel = row.querySelector('.bq-mat');
      const unitSel = row.querySelector('.bq-unit');
      matSel.addEventListener('change', () => {
        const rm = rawMaterials.find(x => x.id === parseInt(matSel.value));
        unitSel.innerHTML = rm ? unitOptionsFor(rm, rm.unit) : '<option>—</option>';
      });
      row.querySelector('.bq-del').addEventListener('click', () => row.remove());
      recipeRows.appendChild(row);
    };
    loadRecipeData().then(() => {
      recipeRows.innerHTML = '';
      if (existingRecipe.length) existingRecipe.forEach(addRecipeRow);
      else addRecipeRow();
      if (!rawMaterials.length) {
        $('#mf-recipe-hint').innerHTML = 'You have no raw materials yet — add them in <b>Raw Materials</b> first, then come back to build the recipe.';
      } else {
        $('#mf-recipe-hint').innerHTML = 'Auto-deducted on every completed sale. Weight (g/kg) and volume (ml/L) convert automatically.';
      }
    });
    $('#mf-recipe-add').addEventListener('click', () => addRecipeRow());

    // Show/hide the recipe editor based on source (own vs outsourced).
    const syncSource = () => {
      const own = $('#mf-source').value === 'own';
      $('#mf-recipe-wrap').style.display = own ? '' : 'none';
      $('#mf-out-hint').style.display = own ? 'none' : '';
    };
    syncSource();
    $('#mf-source').addEventListener('change', syncSource);

    $('#mf-save').addEventListener('click', async () => {
      const body = {
        name: $('#mf-name').value.trim(),
        nameTamil: $('#mf-name-tamil').value.trim() || null,
        category: $('#mf-cat').value.trim() || 'Other',
        unit: this.readServingUnit(m.el),
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
      body.boq = [];

      // Recipe payload is collected here but sent AFTER the product save so
      // we have a productId to attach it to.
      const recipeLines = body.sourceType === 'own'
        ? [...m.el.querySelectorAll('.boq-row')].map(r => ({
            rawMaterialId: parseInt(r.querySelector('.bq-mat').value) || null,
            quantity: parseFloat(r.querySelector('.bq-qty').value) || 0,
            unit: r.querySelector('.bq-unit')?.value || null
          })).filter(l => l.rawMaterialId && l.quantity > 0)
        : [];

      if (!body.name || isNaN(body.sellingPrice) || isNaN(body.purchasePrice)) {
        Ui.toast('Name, selling price and cost price are required', 'error'); return;
      }
      if (!isEdit) body.stock = parseInt($('#mf-stock').value) || 0;
      try {
        let productId;
        if (isEdit) {
          await Api.put(`/grocery/${p.id}`, body);
          productId = p.id;
        } else {
          const created = await Api.post('/grocery', body);
          productId = created?.id || created?.product?.id;
        }
        if (productId) {
          try { await Api.put(`/recipes/product/${productId}`, { lines: recipeLines }); }
          catch (e) { Ui.toast('Item saved, but recipe failed: ' + e.message, 'error'); }
        }
        Ui.toast(isEdit ? 'Item updated' : 'Item added to menu');
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
