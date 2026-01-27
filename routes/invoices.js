const express = require('express');
const { Op } = require('sequelize');
const sequelize = require('../config/database');
const { Invoice, InvoiceItem, Payment } = require('../models/Invoice');
const { Customer } = require('../models/Customer');
const GroceryProduct = require('../models/GroceryProduct');
const FertilizerProduct = require('../models/FertilizerProduct');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Generate Invoice Number
const generateInvoiceNumber = async (shopType) => {
  const prefix = shopType === 'grocery' ? 'GRO' : 'FER';
  const date = new Date();
  const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;

  const count = await Invoice.count({
    where: {
      shopType,
      created_at: {
        [Op.gte]: new Date(date.getFullYear(), date.getMonth(), date.getDate())
      }
    }
  });

  return `${prefix}-${dateStr}-${String(count + 1).padStart(4, '0')}`;
};

// @route   GET /api/invoices
router.get('/', auth, async (req, res) => {
  try {
    const { shopType, startDate, endDate, paymentStatus } = req.query;

    let where = {};

    if (shopType) {
      where.shopType = shopType;
    }

    if (startDate && endDate) {
      where.created_at = {
        [Op.between]: [new Date(startDate), new Date(endDate)]
      };
    }

    if (paymentStatus) {
      where.paymentStatus = paymentStatus;
    }

    if (req.query.customerId) {
      where.customerId = req.query.customerId;
    }

    const invoices = await Invoice.findAll({
      where,
      include: [
        { model: InvoiceItem, as: 'items' },
        { model: Payment, as: 'payments' }
      ],
      order: [['created_at', 'DESC']]
    });

    res.json(invoices);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/invoices/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const invoice = await Invoice.findByPk(req.params.id, {
      include: [
        { model: InvoiceItem, as: 'items' },
        { model: Payment, as: 'payments' }
      ]
    });

    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    res.json(invoice);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   POST /api/invoices
router.post('/', auth, async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const { shopType, customerId, customerName, customerPhone, items, discount, payments, notes } = req.body;

    // Calculate totals
    let subTotal = 0;
    let gstAmount = 0;

    for (const item of items) {
      const itemTotal = item.quantity * item.unitPrice;
      const itemGst = itemTotal * (item.gstRate / 100);
      subTotal += itemTotal;
      gstAmount += itemGst;
    }

    const grandTotal = subTotal + gstAmount - (discount || 0);

    // Calculate paid amount
    let paidAmount = 0;
    if (payments && payments.length > 0) {
      paidAmount = payments.reduce((sum, p) => sum + p.amount, 0);
    }

    // Determine payment status
    let paymentStatus = 'unpaid';
    if (paidAmount >= grandTotal) {
      paymentStatus = 'paid';
    } else if (paidAmount > 0) {
      paymentStatus = 'partial';
    }

    // Generate invoice number
    const invoiceNumber = await generateInvoiceNumber(shopType);

    // Create invoice
    const invoice = await Invoice.create({
      invoiceNumber,
      shopType,
      customerId,
      customerName,
      customerPhone,
      subTotal,
      discount: discount || 0,
      gstAmount,
      grandTotal,
      paidAmount,
      paymentStatus,
      notes,
      createdBy: req.user.id
    }, { transaction: t });

    // Create invoice items and update stock
    for (const item of items) {
      const itemGst = (item.quantity * item.unitPrice) * (item.gstRate / 100);
      const totalPrice = (item.quantity * item.unitPrice) + itemGst;

      await InvoiceItem.create({
        invoiceId: invoice.id,
        productType: shopType,
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: item.unitPrice,
        gstRate: item.gstRate,
        gstAmount: itemGst,
        totalPrice
      }, { transaction: t });

      // Update product stock
      if (shopType === 'grocery') {
        await GroceryProduct.decrement('stock', {
          by: item.quantity,
          where: { id: item.productId },
          transaction: t
        });
      } 
       else {
        const product = await FertilizerProduct.findByPk(item.productId, { transaction: t });
        if (product) {
          // Check for loose sale
          // Assuming product.unit is the "Bag" unit (e.g. 'Bag', 'Box') and item.unit is 'kg' or 'L'
          // We check if item.unit matches product.unit. If distinct and loose is enabled, it's a loose sale.
          if (product.isLooseEnabled && item.unit !== product.unit) {
            let currentLoose = parseFloat(product.looseStock);
            let currentBags = parseInt(product.stock);
            let qtySold = parseFloat(item.quantity);
            const weightPerBag = parseFloat(product.weightPerBag);

            if (currentLoose >= qtySold) {
              currentLoose -= qtySold;
            } else {
              // Need to open bags
              const deficit = qtySold - currentLoose;
              // If weightPerBag is 0 (error case), avoid division by zero
              if (weightPerBag > 0) {
                const bagsToOpen = Math.ceil(deficit / weightPerBag);
                currentBags -= bagsToOpen;
                currentLoose = (currentLoose + (bagsToOpen * weightPerBag)) - qtySold;
              } else {
                // Fallback if config error: just reduce loose stock into negative
                currentLoose -= qtySold;
              }
            }

            await product.update({ stock: currentBags, looseStock: currentLoose }, { transaction: t });
          } else {
            // Normal bag sale
            await product.decrement('stock', {
              by: item.quantity,
              transaction: t
            });
          }
        }
      }
    }

    // Create payments
    if (payments && payments.length > 0) {
      for (const payment of payments) {
        await Payment.create({
          invoiceId: invoice.id,
          amount: payment.amount,
          method: payment.method,
          referenceNumber: payment.referenceNumber
        }, { transaction: t });
      }
    }

    // Update customer totals
    if (customerId) {
      await Customer.increment('totalPurchases', {
        by: grandTotal,
        where: { id: customerId },
        transaction: t
      });

      if (paymentStatus !== 'paid') {
        await Customer.increment('totalCredit', {
          by: grandTotal - paidAmount,
          where: { id: customerId },
          transaction: t
        });
      }
    }

    await t.commit();

    // Fetch complete invoice
    const result = await Invoice.findByPk(invoice.id, {
      include: [
        { model: InvoiceItem, as: 'items' },
        { model: Payment, as: 'payments' }
      ]
    });

    res.status(201).json(result);
  } catch (error) {
    await t.rollback();
    res.status(500).json({ message: error.message });
  }
});

// @route   POST /api/invoices/:id/payment
router.post('/:id/payment', auth, async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const invoice = await Invoice.findByPk(req.params.id);
    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    const { amount, method, referenceNumber } = req.body;

    // Create payment
    await Payment.create({
      invoiceId: invoice.id,
      amount,
      method,
      referenceNumber
    }, { transaction: t });

    // Update invoice
    const newPaidAmount = parseFloat(invoice.paidAmount) + amount;
    let paymentStatus = 'partial';
    if (newPaidAmount >= invoice.grandTotal) {
      paymentStatus = 'paid';
    }

    await invoice.update({
      paidAmount: newPaidAmount,
      paymentStatus
    }, { transaction: t });

    // Update customer credit
    if (invoice.customerId) {
      await Customer.decrement('totalCredit', {
        by: amount,
        where: { id: invoice.customerId },
        transaction: t
      });
    }

    await t.commit();

    const result = await Invoice.findByPk(invoice.id, {
      include: [
        { model: InvoiceItem, as: 'items' },
        { model: Payment, as: 'payments' }
      ]
    });

    res.json(result);
  } catch (error) {
    await t.rollback();
    res.status(500).json({ message: error.message });
  }
});

// @route   POST /api/invoices/:id/cancel
router.post('/:id/cancel', auth, async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const invoice = await Invoice.findByPk(req.params.id, {
      include: [{ model: InvoiceItem, as: 'items' }]
    });

    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    if (invoice.paymentStatus === 'cancelled') {
      return res.status(400).json({ message: 'Invoice already cancelled' });
    }

    // revert stock
    for (const item of invoice.items) {
      if (invoice.shopType === 'grocery') {
        await GroceryProduct.increment('stock', {
          by: item.quantity,
          where: { id: item.productId },
          transaction: t
        });
      } else {
        const product = await FertilizerProduct.findByPk(item.productId, { transaction: t });
        if (product) {
          if (product.isLooseEnabled && item.unit !== product.unit) {
            // Revert loose sale: just add back to looseStock
            // We do not re-bag items automatically
            await product.increment('looseStock', { by: item.quantity, transaction: t });
          } else {
            await product.increment('stock', { by: item.quantity, transaction: t });
          }
        }
      }
    }

    // revert customer stats
    if (invoice.customerId) {
      await Customer.decrement('totalPurchases', {
        by: invoice.grandTotal,
        where: { id: invoice.customerId },
        transaction: t
      });

      if (invoice.paymentStatus !== 'paid') {
        // if it was unpaid/partial, we need to remove the credit amount
        const creditAmount = invoice.grandTotal - invoice.paidAmount;
        await Customer.decrement('totalCredit', {
          by: creditAmount,
          where: { id: invoice.customerId },
          transaction: t
        });
      }
    }

    await invoice.update({ paymentStatus: 'cancelled' }, { transaction: t });

    await t.commit();
    res.json({ message: 'Invoice cancelled successfully', invoice });
  } catch (error) {
    await t.rollback();
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
