// ===== Customers page =====
const Customers = {
  list: [],
  search: '',

  async render(el) {
    el.innerHTML = `
      <div class="toolbar">
        <div class="search-box"><span data-icon="search"></span><input id="cust-search" placeholder="Search name / phone…" value="${Ui.esc(this.search)}"/></div>
        <div class="spacer"></div>
        <button class="btn btn-primary" id="cust-add"><span data-icon="plus"></span> Add Customer</button>
      </div>
      <div class="card" style="padding:8px 6px"><div id="cust-table"><div class="loader"></div></div></div>`;
    Ui.hydrateIcons(el);

    let t;
    el.querySelector('#cust-search').addEventListener('input', e => {
      this.search = e.target.value;
      clearTimeout(t); t = setTimeout(() => this.load(), 300);
    });
    el.querySelector('#cust-add').addEventListener('click', () => this.openForm(null, () => this.load()));
    this.load();
  },

  async load() {
    const box = document.getElementById('cust-table');
    if (!box) return;
    box.innerHTML = '<div class="loader"></div>';
    try {
      this.list = await Api.get('/customers' + (this.search ? `?search=${encodeURIComponent(this.search)}` : ''));
    } catch (e) {
      box.innerHTML = `<div class="empty-state"><div class="big">⚠️</div>${Ui.esc(e.message)}</div>`;
      return;
    }
    if (!this.list.length) {
      box.innerHTML = '<div class="empty-state"><div class="big">👥</div><h3>No customers yet</h3><p>Add regulars to track their orders and credit (khata)</p></div>';
      return;
    }
    box.innerHTML = `
      <table class="tbl">
        <thead><tr><th>Customer</th><th>Contact</th><th>Total Purchases</th><th>Credit Due</th><th style="text-align:right">Actions</th></tr></thead>
        <tbody>
          ${this.list.map(c => `
            <tr>
              <td><b>${Ui.esc(c.name)}</b></td>
              <td>${Ui.esc(c.phone)}${c.email ? `<div class="muted">${Ui.esc(c.email)}</div>` : ''}</td>
              <td><b>${Ui.fmt(c.totalPurchases)}</b></td>
              <td>${parseFloat(c.totalCredit) > 0.009 ? `<span class="badge unpaid">${Ui.fmt(c.totalCredit)}</span>` : '<span class="badge paid">Clear</span>'}</td>
              <td style="text-align:right;white-space:nowrap">
                <button class="btn btn-ghost btn-sm" data-act="hist" data-id="${c.id}">Orders</button>
                <button class="btn btn-ghost btn-sm" data-act="edit" data-id="${c.id}">Edit</button>
                <button class="btn btn-danger btn-sm" data-act="del" data-id="${c.id}">🗑</button>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>`;
    box.querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', () => {
      const c = this.list.find(x => x.id === parseInt(b.dataset.id));
      if (b.dataset.act === 'edit') this.openForm(c, () => this.load());
      else if (b.dataset.act === 'hist') this.history(c);
      else this.remove(c);
    }));
  },

  openForm(c, onSaved) {
    const isEdit = !!c;
    const m = Ui.modal({
      title: isEdit ? `Edit · ${Ui.esc(c.name)}` : 'Add Customer',
      body: `
        <div class="field"><label>Name *</label><input id="cf-name" value="${Ui.esc(c?.name || '')}" placeholder="Customer name"/></div>
        <div class="field"><label>Phone *</label><input id="cf-phone" value="${Ui.esc(c?.phone || '')}" placeholder="98765 43210"/></div>
        <div class="field"><label>Email</label><input id="cf-email" type="email" value="${Ui.esc(c?.email || '')}" placeholder="optional"/></div>
        <div class="field"><label>Address</label><textarea id="cf-address" rows="2" placeholder="optional">${Ui.esc(c?.address || '')}</textarea></div>`,
      foot: `<button class="btn btn-ghost" id="cf-cancel">Cancel</button>
             <button class="btn btn-primary" id="cf-save">${isEdit ? 'Save' : 'Add Customer'}</button>`
    });
    m.el.querySelector('#cf-cancel').addEventListener('click', m.close);
    m.el.querySelector('#cf-save').addEventListener('click', async () => {
      const body = {
        name: m.el.querySelector('#cf-name').value.trim(),
        phone: m.el.querySelector('#cf-phone').value.trim(),
        email: m.el.querySelector('#cf-email').value.trim() || null,
        address: m.el.querySelector('#cf-address').value.trim() || null
      };
      if (!body.name || !body.phone) { Ui.toast('Name and phone are required', 'error'); return; }
      try {
        const saved = isEdit ? await Api.put(`/customers/${c.id}`, body) : await Api.post('/customers', body);
        Ui.toast(isEdit ? 'Customer updated' : 'Customer added');
        m.close();
        onSaved && onSaved(saved);
      } catch (e) { Ui.toast(e.message, 'error'); }
    });
  },

  async history(c) {
    let invoices = [];
    try { invoices = await Api.get(`/invoices?customerId=${c.id}`); } catch (e) { Ui.toast(e.message, 'error'); return; }
    const rows = invoices.length ? invoices.map(inv => `
      <div class="list-row">
        <span><b>${Ui.esc(inv.invoiceNumber)}</b><div class="muted">${Ui.fmtDate(inv.created_at)}</div></span>
        <span style="text-align:right"><b>${Ui.fmt(inv.grandTotal)}</b><div><span class="badge ${inv.paymentStatus}">${inv.paymentStatus}</span></div></span>
      </div>`).join('') : '<div class="empty-state" style="padding:26px"><div class="big">🧾</div>No orders yet</div>';
    Ui.modal({
      title: `${Ui.esc(c.name)} · Order history`,
      body: `
        <div class="pay-summary">
          <div class="tot-row"><span>Total purchases</span><span><b>${Ui.fmt(c.totalPurchases)}</b></span></div>
          <div class="tot-row"><span>Credit due</span><span style="color:${parseFloat(c.totalCredit) > 0 ? 'var(--red)' : 'var(--green)'}"><b>${Ui.fmt(c.totalCredit)}</b></span></div>
        </div>
        ${rows}`
    });
  },

  async remove(c) {
    const ok = await Ui.confirm('Delete customer?', `<b>${Ui.esc(c.name)}</b> will be permanently deleted. Their past invoices remain.`, 'Delete');
    if (!ok) return;
    try {
      await Api.del(`/customers/${c.id}`);
      Ui.toast('Customer deleted');
      this.load();
    } catch (e) { Ui.toast(e.message, 'error'); }
  }
};
