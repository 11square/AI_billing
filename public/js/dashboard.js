// ===== Dashboard page =====
const Dashboard = {
  async render(el) {
    el.innerHTML = '<div class="loader"></div>';
    let d, daily;
    try {
      [d, daily] = await Promise.all([
        Api.get('/reports/dashboard?shopType=grocery'),
        Api.get('/reports/daily?shopType=grocery')
      ]);
    } catch (e) {
      el.innerHTML = `<div class="empty-state"><div class="big">⚠️</div><h3>Could not load dashboard</h3><p>${Ui.esc(e.message)}</p></div>`;
      return;
    }

    const maxAmt = Math.max(...d.weeklyChart.map(x => x.amount), 1);
    const bars = d.weeklyChart.map(x => `
      <div class="bar-wrap">
        <div class="bar" style="height:${Math.max((x.amount / maxAmt) * 100, 2)}%" data-val="${Ui.fmt(x.amount)}"></div>
        <div class="bar-lbl">${x.day}</div>
      </div>`).join('');

    const recent = d.recentInvoices.length ? d.recentInvoices.map(inv => `
      <tr>
        <td><b>${Ui.esc(inv.invoiceNumber)}</b><div class="muted">${Ui.fmtDate(inv.createdAt)} · ${Ui.fmtTime(inv.createdAt)}</div></td>
        <td>${Ui.esc(inv.customerName)}</td>
        <td><b>${Ui.fmt(inv.grandTotal)}</b></td>
        <td><span class="badge ${inv.paymentStatus}">${inv.paymentStatus}</span></td>
      </tr>`).join('') : '<tr><td colspan="4" class="muted" style="text-align:center;padding:30px">No orders yet — create your first bill from the POS 🍽️</td></tr>';

    const top = daily.topProducts.length ? daily.topProducts.slice(0, 6).map((p, i) => `
      <div class="list-row">
        <span><span class="rank">${i + 1}</span>${Ui.esc(p.name)}</span>
        <span><b>${p.quantity}</b> sold · ${Ui.fmt(p.total)}</span>
      </div>`).join('') : '<div class="empty-state" style="padding:26px"><div class="big">🥐</div>Nothing sold today yet</div>';

    el.innerHTML = `
      <div class="stat-grid">
        <div class="stat-card"><div class="stat-ic" style="background:var(--green-soft)">💰</div><div class="stat-val">${Ui.fmt(d.todaySales)}</div><div class="stat-lbl">Today's Sales</div></div>
        <div class="stat-card"><div class="stat-ic" style="background:var(--blue-soft)">🧾</div><div class="stat-val">${d.todayInvoiceCount}</div><div class="stat-lbl">Orders Today</div></div>
        <div class="stat-card"><div class="stat-ic" style="background:var(--brand-soft)">📈</div><div class="stat-val">${Ui.fmt(d.todayProfit)}</div><div class="stat-lbl">Today's Profit</div></div>
        <div class="stat-card"><div class="stat-ic" style="background:var(--amber-soft)">⏳</div><div class="stat-val">${Ui.fmt(d.totalPendingDues)}</div><div class="stat-lbl">Pending Dues</div></div>
        <div class="stat-card"><div class="stat-ic" style="background:var(--red-soft)">📦</div><div class="stat-val">${d.lowStockCount}</div><div class="stat-lbl">Low Stock Items</div></div>
        <div class="stat-card"><div class="stat-ic" style="background:var(--green-soft)">🗓️</div><div class="stat-val">${Ui.fmt(d.monthSales)}</div><div class="stat-lbl">This Month</div></div>
      </div>
      <div class="grid-2">
        <div class="card">
          <div class="card-title">Last 7 days sales</div>
          <div class="chart">${bars}</div>
        </div>
        <div class="card">
          <div class="card-title">Top sellers today</div>
          ${top}
        </div>
      </div>
      <div class="card" style="margin-top:16px">
        <div class="card-title">Recent orders <a href="#invoices" style="font-size:12.5px;color:var(--brand-2)">View all →</a></div>
        <table class="tbl">
          <thead><tr><th>Invoice</th><th>Customer</th><th>Total</th><th>Status</th></tr></thead>
          <tbody>${recent}</tbody>
        </table>
      </div>`;
  }
};
