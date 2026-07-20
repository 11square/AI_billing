// Business report computation + auto-generation scheduler
const { Op } = require('sequelize');
const { Invoice, InvoiceItem, Payment } = require('../models/Invoice');
const GroceryProduct = require('../models/GroceryProduct');
const { DailyReport, Setting } = require('../models/Report');

const DEFAULT_REPORT_TIME = '06:00';

const pad = (n) => String(n).padStart(2, '0');
const localDateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// ---------- settings ----------
async function getReportTime() {
  const row = await Setting.findByPk('report_time');
  return (row && row.value) || DEFAULT_REPORT_TIME;
}

async function setReportTime(value) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
    throw new Error('Time must be in HH:MM (24h) format');
  }
  await Setting.upsert({ key: 'report_time', value });
  return value;
}

// ---------- core summary ----------
async function computeSummary(start, end) {
  const invoices = await Invoice.findAll({
    where: { shopType: 'grocery', created_at: { [Op.between]: [start, end] } },
    include: [{ model: InvoiceItem, as: 'items' }]
  });

  const active = invoices.filter(i => i.paymentStatus !== 'cancelled');
  const cancelledCount = invoices.length - active.length;

  // headline totals (billed in period)
  let subTotal = 0, gstAmount = 0, discount = 0, grandTotal = 0, creditGiven = 0;
  for (const inv of active) {
    subTotal += parseFloat(inv.subTotal);
    gstAmount += parseFloat(inv.gstAmount);
    discount += parseFloat(inv.discount);
    grandTotal += parseFloat(inv.grandTotal);
    if (inv.paymentStatus !== 'paid') {
      creditGiven += parseFloat(inv.grandTotal) - parseFloat(inv.paidAmount);
    }
  }

  // amount collected in period (includes dues cleared on older invoices)
  const payments = await Payment.findAll({
    where: { paymentDate: { [Op.between]: [start, end] } },
    include: [{ model: Invoice, attributes: ['id', 'shopType', 'paymentStatus'], required: true }]
  });
  const groceryPayments = payments.filter(p => p.Invoice.shopType === 'grocery' && p.Invoice.paymentStatus !== 'cancelled');
  let amountCollected = 0;
  const byMethod = { cash: 0, card: 0, upi: 0, credit: 0 };
  for (const p of groceryPayments) {
    const amt = parseFloat(p.amount);
    amountCollected += amt;
    byMethod[p.method] = (byMethod[p.method] || 0) + amt;
  }

  // per-product aggregation (own vs outsourced + BOQ consumption)
  const soldByProduct = new Map(); // productId -> { name, qty, amount }
  let totalItemsBilled = 0;
  for (const inv of active) {
    for (const it of inv.items) {
      totalItemsBilled += it.quantity;
      const cur = soldByProduct.get(it.productId) || { name: it.productName, qty: 0, amount: 0 };
      cur.qty += it.quantity;
      cur.amount += parseFloat(it.totalPrice);
      soldByProduct.set(it.productId, cur);
    }
  }

  const products = await GroceryProduct.findAll({
    where: { id: [...soldByProduct.keys()].filter(Boolean) }
  });
  const pmap = new Map(products.map(p => [p.id, p]));

  const own = { qty: 0, amount: 0, items: [] };
  const outsourced = { qty: 0, amount: 0, items: [] };
  const boqTotals = new Map(); // "ingredient|unit" -> qty

  for (const [pid, sold] of soldByProduct) {
    const product = pmap.get(pid);
    const source = product ? (product.sourceType || 'own') : 'outsourced';
    const bucket = source === 'own' ? own : outsourced;
    bucket.qty += sold.qty;
    bucket.amount += sold.amount;
    bucket.items.push({ name: sold.name, qty: sold.qty, amount: +sold.amount.toFixed(2) });

    // BOQ consumption = boq per unit × units sold (own products only)
    if (source === 'own' && product && Array.isArray(product.boq)) {
      for (const line of product.boq) {
        if (!line || !line.ingredient) continue;
        const key = `${String(line.ingredient).trim().toLowerCase()}|${(line.unit || '').trim().toLowerCase()}`;
        const prev = boqTotals.get(key) || { ingredient: String(line.ingredient).trim(), unit: (line.unit || '').trim(), qty: 0 };
        prev.qty += (parseFloat(line.qty) || 0) * sold.qty;
        boqTotals.set(key, prev);
      }
    }
  }
  own.items.sort((a, b) => b.qty - a.qty);
  outsourced.items.sort((a, b) => b.qty - a.qty);

  const topItems = [...soldByProduct.values()]
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 10)
    .map(x => ({ name: x.name, qty: x.qty, amount: +x.amount.toFixed(2) }));

  const round = (n) => +n.toFixed(2);
  return {
    periodStart: start,
    periodEnd: end,
    totalInvoices: active.length,
    cancelledInvoices: cancelledCount,
    totalItemsBilled,
    subTotal: round(subTotal),
    gstAmount: round(gstAmount),
    discount: round(discount),
    totalBilled: round(grandTotal),
    amountCollected: round(amountCollected),
    creditGiven: round(creditGiven),
    paymentBreakdown: Object.fromEntries(Object.entries(byMethod).map(([k, v]) => [k, round(v)])),
    own: { qty: own.qty, amount: round(own.amount), items: own.items },
    outsourced: { qty: outsourced.qty, amount: round(outsourced.amount), items: outsourced.items },
    boqConsumption: [...boqTotals.values()]
      .map(b => ({ ...b, qty: round(b.qty) }))
      .sort((a, b) => a.ingredient.localeCompare(b.ingredient)),
    topItems
  };
}

// ---------- generate & save ----------
// opts: { date: 'YYYY-MM-DD' } for a full day, or { start, end } for a custom range
async function generateAndSave(opts = {}, trigger = 'manual') {
  let start, end, reportDate;
  if (opts.start && opts.end) {
    start = new Date(opts.start);
    end = new Date(opts.end);
    if (isNaN(start) || isNaN(end) || start >= end) throw new Error('Invalid custom range');
    reportDate = localDateStr(start);
  } else {
    const dateStr = opts.date || localDateStr(new Date());
    const [y, m, d] = dateStr.split('-').map(Number);
    if (!y || !m || !d) throw new Error('Invalid date');
    start = new Date(y, m - 1, d, 0, 0, 0, 0);
    end = new Date(y, m - 1, d, 23, 59, 59, 999);
    reportDate = dateStr;
  }

  const data = await computeSummary(start, end);
  const report = await DailyReport.create({
    reportDate,
    periodStart: start,
    periodEnd: end,
    trigger,
    data
  });
  return report;
}

// ---------- scheduler ----------
// Every 30s: when local HH:MM matches the configured report time, generate
// yesterday's report once (dedup by reportDate + trigger 'auto').
function startScheduler() {
  setInterval(async () => {
    try {
      const now = new Date();
      const hhmm = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
      const configured = await getReportTime();
      if (hhmm !== configured) return;

      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const dateStr = localDateStr(yesterday);

      const exists = await DailyReport.findOne({ where: { reportDate: dateStr, trigger: 'auto' } });
      if (exists) return;

      const report = await generateAndSave({ date: dateStr }, 'auto');
      console.log(`📄 Auto daily report generated for ${dateStr} (id ${report.id})`);
    } catch (err) {
      console.error('Report scheduler error:', err.message);
    }
  }, 30 * 1000);
  console.log('⏰ Daily report scheduler started');
}

module.exports = { computeSummary, generateAndSave, getReportTime, setReportTime, startScheduler, localDateStr };
