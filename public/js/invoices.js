// ===== Invoices page =====
const Invoices = {
  list: [],
  status: '',
  from: '',
  to: '',

  async render(el) {
    el.innerHTML = `
      <div class="toolbar">
        <select class="select" id="inv-status">
          <option value="">All statuses</option>
          <option value="paid">Paid</option>
          <option value="partial">Partial</option>
          <option value="unpaid">Unpaid</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <input type="date" class="date-input" id="inv-from" value="${this.from}"/>
        <span class="muted">to</span>
        <input type="date" class="date-input" id="inv-to" value="${this.to}"/>
        <button class="btn btn-ghost btn-sm" id="inv-clear">Clear</button>
        <div class="spacer"></div>
      </div>
      <div class="card" style="padding:8px 6px"><div id="inv-table"><div class="loader"></div></div></div>`;

    const sel = el.querySelector('#inv-status');
    sel.value = this.status;
    sel.addEventListener('change', e => { this.status = e.target.value; this.load(); });
    el.querySelector('#inv-from').addEventListener('change', e => { this.from = e.target.value; this.load(); });
    el.querySelector('#inv-to').addEventListener('change', e => { this.to = e.target.value; this.load(); });
    el.querySelector('#inv-clear').addEventListener('click', () => { this.status = this.from = this.to = ''; this.render(el); });
    this.load();
  },

  async load() {
    const box = document.getElementById('inv-table');
    if (!box) return;
    box.innerHTML = '<div class="loader"></div>';
    try {
      let url = '/invoices?shopType=grocery';
      if (this.status) url += `&paymentStatus=${this.status}`;
      if (this.from && this.to) url += `&startDate=${this.from}&endDate=${this.to}T23:59:59`;
      this.list = await Api.get(url);
    } catch (e) {
      box.innerHTML = `<div class="empty-state"><div class="big">⚠️</div>${Ui.esc(e.message)}</div>`;
      return;
    }
    if (!this.list.length) {
      box.innerHTML = '<div class="empty-state"><div class="big">🧾</div><h3>No invoices found</h3><p>Bills you create in the POS will show up here</p></div>';
      return;
    }
    box.innerHTML = `
      <table class="tbl">
        <thead><tr><th>Invoice</th><th>Customer</th><th>Items</th><th>Total</th><th>Paid</th><th>Status</th><th style="text-align:right">Actions</th></tr></thead>
        <tbody>
          ${this.list.map(inv => {
            const due = parseFloat(inv.grandTotal) - parseFloat(inv.paidAmount);
            return `
            <tr>
              <td><b>${Ui.esc(inv.invoiceNumber)}</b><div class="muted">${Ui.fmtDate(inv.created_at)} · ${Ui.fmtTime(inv.created_at)}</div></td>
              <td>${Ui.esc(inv.customerName || 'Walk-in')}</td>
              <td>${(inv.items || []).length}</td>
              <td><b>${Ui.fmt(inv.grandTotal)}</b></td>
              <td>${Ui.fmt(inv.paidAmount)}${due > 0.009 && inv.paymentStatus !== 'cancelled' ? `<div class="muted" style="color:var(--red)">due ${Ui.fmt(due)}</div>` : ''}</td>
              <td><span class="badge ${inv.paymentStatus}">${inv.paymentStatus}</span></td>
              <td style="text-align:right;white-space:nowrap">
                <button class="btn btn-ghost btn-sm" data-act="view" data-id="${inv.id}">View</button>
                ${(inv.paymentStatus === 'unpaid' || inv.paymentStatus === 'partial') ? `<button class="btn btn-green btn-sm" data-act="pay" data-id="${inv.id}">Pay</button>` : ''}
                ${inv.paymentStatus !== 'cancelled' ? `<button class="btn btn-danger btn-sm" data-act="cancel" data-id="${inv.id}">✕</button>` : ''}
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>`;
    box.querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', () => {
      const inv = this.list.find(x => x.id === parseInt(b.dataset.id));
      if (b.dataset.act === 'view') this.view(inv);
      else if (b.dataset.act === 'pay') this.recordPayment(inv);
      else this.cancel(inv);
    }));
  },

  view(inv) {
    const curLang = Ui.getLang();
    const m = Ui.modal({
      title: `Invoice · ${Ui.esc(inv.invoiceNumber)}`,
      body: `
        <div class="lang-toggle">
          <button class="lang-chip ${curLang === 'en' ? 'active' : ''}" data-lang="en">English</button>
          <button class="lang-chip ${curLang === 'ta' ? 'active' : ''}" data-lang="ta">தமிழ்</button>
        </div>
        <div class="receipt-modal-wrap">${Ui.receiptHtml(inv)}</div>`,
      foot: `<button class="btn btn-ghost" id="iv-close">Close</button>
             ${(inv.paymentStatus === 'unpaid' || inv.paymentStatus === 'partial') ? '<button class="btn btn-green" id="iv-pay">Record Payment</button>' : ''}
             <button class="btn btn-primary" id="iv-print"><span data-icon="print"></span> Print</button>`
    });
    m.el.querySelector('#iv-close').addEventListener('click', m.close);
    m.el.querySelector('#iv-print').addEventListener('click', () => Ui.printReceipt(inv, Ui.getLang()));
    Ui.attachLangToggle(m.el, inv, curLang);
    const payBtn = m.el.querySelector('#iv-pay');
    if (payBtn) payBtn.addEventListener('click', () => { m.close(); this.recordPayment(inv); });
  },

  recordPayment(inv) {
    const due = parseFloat(inv.grandTotal) - parseFloat(inv.paidAmount);
    const m = Ui.modal({
      title: `Payment · ${Ui.esc(inv.invoiceNumber)}`,
      body: `
        <div class="pay-summary">
          <div class="tot-row"><span>Total</span><span>${Ui.fmt(inv.grandTotal)}</span></div>
          <div class="tot-row"><span>Already paid</span><span>${Ui.fmt(inv.paidAmount)}</span></div>
          <div class="tot-row grand"><span>Balance due</span><span>${Ui.fmt(due)}</span></div>
        </div>
        <div class="field"><label>Amount received *</label><input id="rp-amt" type="number" min="0" step="0.01" value="${due.toFixed(2)}"/></div>
        <div class="field"><label>Method</label>
          <select id="rp-method"><option value="cash">Cash</option><option value="upi">UPI</option><option value="card">Card</option></select></div>
        <div class="field"><label>Reference (optional)</label><input id="rp-ref" placeholder="Txn / slip number"/></div>`,
      foot: `<button class="btn btn-ghost" id="rp-cancel">Cancel</button>
             <button class="btn btn-green" id="rp-save">Record Payment</button>`
    });
    m.el.querySelector('#rp-cancel').addEventListener('click', m.close);
    m.el.querySelector('#rp-save').addEventListener('click', async () => {
      const amount = parseFloat(m.el.querySelector('#rp-amt').value);
      if (!amount || amount <= 0) { Ui.toast('Enter a valid amount', 'error'); return; }
      if (amount > due + 0.009) { Ui.toast(`Amount exceeds balance due (${Ui.fmt(due)})`, 'error'); return; }
      try {
        await Api.post(`/invoices/${inv.id}/payment`, {
          amount, method: m.el.querySelector('#rp-method').value,
          referenceNumber: m.el.querySelector('#rp-ref').value || undefined
        });
        Ui.toast('Payment recorded');
        m.close();
        this.load();
      } catch (e) { Ui.toast(e.message, 'error'); }
    });
  },

  async cancel(inv) {
    const ok = await Ui.confirm('Cancel invoice?', `Invoice <b>${Ui.esc(inv.invoiceNumber)}</b> will be cancelled and stock returned to the menu. This cannot be undone.`, 'Cancel Invoice');
    if (!ok) return;
    try {
      await Api.post(`/invoices/${inv.id}/cancel`);
      Ui.toast('Invoice cancelled');
      this.load();
    } catch (e) { Ui.toast(e.message, 'error'); }
  }
};
