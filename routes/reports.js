const express = require('express');
const { Op } = require('sequelize');
const sequelize = require('../config/database');
const { Invoice, InvoiceItem } = require('../models/Invoice');
const GroceryProduct = require('../models/GroceryProduct');
const FertilizerProduct = require('../models/FertilizerProduct');
const { Staff, Attendance } = require('../models/Staff');
const { auth } = require('../middleware/auth');
const { DailyReport } = require('../models/Report');
const reportService = require('../services/reportService');

const router = express.Router();

// ===== Generated daily reports =====

// @route   GET /api/reports/schedule — current auto-generation time
router.get('/schedule', auth, async (req, res) => {
  try {
    res.json({ time: await reportService.getReportTime() });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   PUT /api/reports/schedule — set auto-generation time (HH:MM)
router.put('/schedule', auth, async (req, res) => {
  try {
    const time = await reportService.setReportTime(req.body.time);
    res.json({ time });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// @route   POST /api/reports/generate — { date } or { start, end }
router.post('/generate', auth, async (req, res) => {
  try {
    const report = await reportService.generateAndSave(req.body, 'manual');
    res.status(201).json(report);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// @route   GET /api/reports/generated — list saved reports
router.get('/generated', auth, async (req, res) => {
  try {
    const reports = await DailyReport.findAll({
      order: [['created_at', 'DESC']],
      limit: 60
    });
    res.json(reports);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/reports/generated/:id
router.get('/generated/:id', auth, async (req, res) => {
  try {
    const report = await DailyReport.findByPk(req.params.id);
    if (!report) return res.status(404).json({ message: 'Report not found' });
    res.json(report);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/reports/daily
router.get('/daily', auth, async (req, res) => {
  try {
    const { date, shopType } = req.query;
    const targetDate = date ? new Date(date) : new Date();

    const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
    const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));

    let where = {
      created_at: { [Op.between]: [startOfDay, endOfDay] }
    };

    if (shopType) {
      where.shopType = shopType;
    }

    const invoices = await Invoice.findAll({ where });

    const totalSales = invoices.reduce((sum, inv) => sum + parseFloat(inv.grandTotal), 0);
    const invoiceCount = invoices.length;
    const cashSales = invoices.filter(i => i.paymentStatus === 'paid').reduce((sum, inv) => sum + parseFloat(inv.paidAmount), 0);
    const creditSales = invoices.filter(i => i.paymentStatus !== 'paid').reduce((sum, inv) => sum + (parseFloat(inv.grandTotal) - parseFloat(inv.paidAmount)), 0);

    // Top products
    const items = await InvoiceItem.findAll({
      include: [{
        model: Invoice,
        where,
        attributes: []
      }],
      attributes: [
        'productName',
        [sequelize.fn('SUM', sequelize.col('quantity')), 'quantity'],
        [sequelize.fn('SUM', sequelize.col('total_price')), 'total']
      ],
      group: ['productName'],
      order: [[sequelize.fn('SUM', sequelize.col('quantity')), 'DESC']],
      limit: 10
    });

    res.json({
      date: startOfDay,
      totalSales,
      invoiceCount,
      cashSales,
      digitalSales: totalSales - cashSales - creditSales,
      creditSales,
      topProducts: items.map(i => ({
        name: i.productName,
        quantity: i.dataValues.quantity,
        total: i.dataValues.total
      }))
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/reports/monthly
router.get('/monthly', auth, async (req, res) => {
  try {
    const { month, year, shopType } = req.query;
    const targetMonth = month ? parseInt(month) - 1 : new Date().getMonth();
    const targetYear = year ? parseInt(year) : new Date().getFullYear();

    const startOfMonth = new Date(targetYear, targetMonth, 1);
    const endOfMonth = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59, 999);

    let where = {
      created_at: { [Op.between]: [startOfMonth, endOfMonth] }
    };

    if (shopType) {
      where.shopType = shopType;
    }

    const invoices = await Invoice.findAll({ where });

    const totalRevenue = invoices.reduce((sum, inv) => sum + parseFloat(inv.grandTotal), 0);
    const totalInvoices = invoices.length;
    const creditPending = invoices.reduce((sum, inv) => {
      if (inv.paymentStatus !== 'paid') {
        return sum + (parseFloat(inv.grandTotal) - parseFloat(inv.paidAmount));
      }
      return sum;
    }, 0);

    const daysInMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
    const avgPerDay = totalRevenue / daysInMonth;

    res.json({
      month: targetMonth + 1,
      year: targetYear,
      totalRevenue,
      totalInvoices,
      avgPerDay,
      creditPending
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/reports/stock
router.get('/stock', auth, async (req, res) => {
  try {
    const { shopType } = req.query;

    let products = [];

    if (!shopType || shopType === 'grocery') {
      const groceryProducts = await GroceryProduct.findAll({
        where: { isActive: true }
      });
      products = products.concat(groceryProducts.map(p => ({
        ...p.toJSON(),
        type: 'grocery'
      })));
    }

    if (!shopType || shopType === 'fertilizer') {
      const fertilizerProducts = await FertilizerProduct.findAll({
        where: { isActive: true }
      });
      products = products.concat(fertilizerProducts.map(p => ({
        ...p.toJSON(),
        type: 'fertilizer'
      })));
    }

    const totalProducts = products.length;
    const lowStockProducts = products.filter(p => p.stock <= p.minStock && p.stock > 0);
    const outOfStockProducts = products.filter(p => p.stock === 0);

    const stockValue = products.reduce((sum, p) => {
      return sum + (p.stock * parseFloat(p.purchasePrice));
    }, 0);

    res.json({
      totalProducts,
      lowStockCount: lowStockProducts.length,
      outOfStockCount: outOfStockProducts.length,
      stockValue,
      lowStockProducts: lowStockProducts.map(p => ({
        id: p.id,
        name: p.name,
        stock: p.stock,
        minStock: p.minStock,
        type: p.type
      })),
      outOfStockProducts: outOfStockProducts.map(p => ({
        id: p.id,
        name: p.name,
        type: p.type
      }))
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/reports/dashboard?date=YYYY-MM-DD
router.get('/dashboard', auth, async (req, res) => {
  try {
    const { shopType, date } = req.query;

    // Anchor "today" to the caller-supplied date if present, else server-local today.
    // Parsed as YYYY-MM-DD in local time (not UTC) so a picked date maps to the shop's day.
    let anchor;
    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      const [y, m, d] = date.split('-').map(Number);
      anchor = new Date(y, m - 1, d);
    } else {
      anchor = new Date();
    }
    const startOfToday = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
    const endOfToday = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate(), 23, 59, 59, 999);
    const pad = n => String(n).padStart(2, '0');
    const dateStr = `${anchor.getFullYear()}-${pad(anchor.getMonth() + 1)}-${pad(anchor.getDate())}`;

    // Get 7-day range for weekly data (ending on the selected day)
    const weekAgo = new Date(anchor);
    weekAgo.setDate(weekAgo.getDate() - 6);
    const startOfWeek = new Date(weekAgo.getFullYear(), weekAgo.getMonth(), weekAgo.getDate());

    let where = {};
    if (shopType) {
      where.shopType = shopType;
    }

    // Today's invoices
    const todayInvoices = await Invoice.findAll({
      where: { ...where, created_at: { [Op.between]: [startOfToday, endOfToday] } },
      include: [{
        model: InvoiceItem,
        as: 'items'
      }]
    });

    const todaySales = todayInvoices.reduce((sum, inv) => sum + parseFloat(inv.grandTotal), 0);
    const todayInvoiceCount = todayInvoices.length;

    // Calculate Today's Profit
    let todayProfit = 0;
    for (const inv of todayInvoices) {
      for (const item of inv.items) {
        let product;
        if (item.productType === 'grocery') {
          product = await GroceryProduct.findByPk(item.productId);
        } else {
          product = await FertilizerProduct.findByPk(item.productId);
        }

        if (product) {
          const costPrice = parseFloat(product.purchasePrice);
          const sellingPrice = parseFloat(item.unitPrice); // Use unit price from invoice item
          const profit = (sellingPrice - costPrice) * item.quantity;
          todayProfit += profit;
        }
      }
    }

    // This month stats (relative to selected anchor date)
    const startOfMonth = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const monthInvoices = await Invoice.findAll({
      where: { ...where, created_at: { [Op.between]: [startOfMonth, endOfToday] } },
      include: [{
        model: InvoiceItem,
        as: 'items'
      }]
    });
    const monthSales = monthInvoices.reduce((sum, inv) => sum + parseFloat(inv.grandTotal), 0);

    // Calculate Month's Profit
    let monthProfit = 0;
    for (const inv of monthInvoices) {
      for (const item of inv.items) {
        let product;
        if (item.productType === 'grocery') {
          product = await GroceryProduct.findByPk(item.productId);
        } else {
          product = await FertilizerProduct.findByPk(item.productId);
        }

        if (product) {
          const costPrice = parseFloat(product.purchasePrice);
          const sellingPrice = parseFloat(item.unitPrice);
          const profit = (sellingPrice - costPrice) * item.quantity;
          monthProfit += profit;
        }
      }
    }

    // Week's invoices for chart
    const weekInvoices = await Invoice.findAll({
      where: { ...where, created_at: { [Op.between]: [startOfWeek, endOfToday] } }
    });

    // Group by day for chart
    const dailySales = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(d.getDate() + i);
      const key = `${d.getDate()}/${d.getMonth() + 1}`;
      dailySales[key] = 0;
    }

    weekInvoices.forEach(inv => {
      const d = new Date(inv.created_at);
      const key = `${d.getDate()}/${d.getMonth() + 1}`;
      if (dailySales[key] !== undefined) {
        dailySales[key] += parseFloat(inv.grandTotal);
      }
    });

    // Pending dues
    const pendingInvoices = await Invoice.findAll({
      where: { ...where, paymentStatus: { [Op.ne]: 'paid' } }
    });
    const totalPendingDues = pendingInvoices.reduce((sum, inv) =>
      sum + (parseFloat(inv.grandTotal) - parseFloat(inv.paidAmount)), 0);

    // Low stock count - simplified approach
    let lowStockCount = 0;
    try {
      if (!shopType || shopType === 'grocery') {
        const groceryProducts = await GroceryProduct.findAll({
          where: { isActive: true }
        });
        lowStockCount += groceryProducts.filter(p => p.stock <= p.minStock).length;
      }
      if (!shopType || shopType === 'fertilizer') {
        const fertilizerProducts = await FertilizerProduct.findAll({
          where: { isActive: true }
        });
        lowStockCount += fertilizerProducts.filter(p => p.stock <= p.minStock).length;
      }
    } catch (e) {
      // If low stock check fails, continue with 0
      lowStockCount = 0;
    }

    // Recent invoices
    const recentInvoices = await Invoice.findAll({
      where,
      order: [['created_at', 'DESC']],
      limit: 5,
      attributes: ['id', 'invoiceNumber', 'customerName', 'grandTotal', 'paymentStatus', 'created_at']
    });

    // ----- Staff attendance for the selected day -----
    // Counts are per-staff (not per-shift-row). "Absent" folds together the
    // `absent` and `week_off` statuses; `leave` is treated as sick leave.
    // Half-day = staff whose default shift is 'both' but who were present in
    // exactly one of the two shifts on this date.
    let attendance = {
      morningPresent: 0, morningAbsent: 0,
      eveningPresent: 0, eveningAbsent: 0,
      halfDays: 0, sickLeaves: 0
    };
    try {
      const activeStaff = await Staff.findAll({ where: { isActive: true } });
      const dayRecords = await Attendance.findAll({ where: { date: dateStr } });

      const byKey = {};
      for (const r of dayRecords) byKey[`${r.staffId}|${r.shift}`] = r.status;

      const staffWithLeave = new Set();
      let halfDayCount = 0;

      for (const s of activeStaff) {
        const morningStatus = byKey[`${s.id}|morning`] || null;
        const eveningStatus = byKey[`${s.id}|evening`] || null;

        const isPresent = st => st === 'present';
        const isAbsent = st => st === 'absent' || st === 'week_off';

        // Column counts only include staff scheduled for that shift.
        const worksMorning = s.defaultShift === 'morning' || s.defaultShift === 'both';
        const worksEvening = s.defaultShift === 'evening' || s.defaultShift === 'both';

        if (worksMorning) {
          if (isPresent(morningStatus)) attendance.morningPresent++;
          else if (isAbsent(morningStatus)) attendance.morningAbsent++;
        }
        if (worksEvening) {
          if (isPresent(eveningStatus)) attendance.eveningPresent++;
          else if (isAbsent(eveningStatus)) attendance.eveningAbsent++;
        }

        if (morningStatus === 'leave' || eveningStatus === 'leave') {
          staffWithLeave.add(s.id);
        }

        // Half-day: both-shift staff, present in exactly one shift
        if (s.defaultShift === 'both') {
          const p = (isPresent(morningStatus) ? 1 : 0) + (isPresent(eveningStatus) ? 1 : 0);
          if (p === 1) halfDayCount++;
        }
      }

      attendance.halfDays = halfDayCount;
      attendance.sickLeaves = staffWithLeave.size;
    } catch (e) {
      // If attendance tables aren't ready yet, fall back to zeros silently.
    }

    res.json({
      date: dateStr,
      todaySales,
      todayProfit,
      todayInvoiceCount,
      totalPendingDues,
      lowStockCount,
      monthSales,
      monthProfit,
      monthInvoiceCount: monthInvoices.length,
      attendance,
      weeklyChart: Object.entries(dailySales).map(([day, amount]) => ({ day, amount })),
      recentInvoices: recentInvoices.map(inv => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        customerName: inv.customerName || 'Walk-in',
        grandTotal: parseFloat(inv.grandTotal),
        paymentStatus: inv.paymentStatus,
        createdAt: inv.created_at
      }))
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
