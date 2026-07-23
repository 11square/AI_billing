const express = require('express');
const { Op } = require('sequelize');
const sequelize = require('../config/database');
const { Invoice, InvoiceItem, Payment } = require('../models/Invoice');
const { Customer } = require('../models/Customer');
const GroceryProduct = require('../models/GroceryProduct');
const FertilizerProduct = require('../models/FertilizerProduct');
const { RawMaterial, Recipe, applyMovement } = require('../models/Inventory');
const units = require('../services/units');
const { auth } = require('../middleware/auth');

const router = express.Router();

// -------------------------------------------------------------------------
// Recipe-driven raw-material deduction (own-source items only).
// Called from POST / (sale, direction=-1) and POST /:id/cancel (direction=+1).
//
// For each line item on the invoice:
//   * If the product is `sourceType='own'`, look up its recipe and either
//     deduct (sale) or restore (cancel) each raw material via applyMovement.
//     A single material used by multiple products aggregates into one row.
//   * Outsourced products don't touch raw materials — their finished-good
//     stock is decremented/restored by the existing GroceryProduct.decrement
//     logic in the caller. This helper only handles the raw-material tier.
// -------------------------------------------------------------------------
async function applyRecipeMovement({ invoice, items, direction, userId, transaction }) {
  const productIds = [...new Set(items.map(it => it.productId).filter(Boolean))];
  if (!productIds.length) return;

  // Fetch products to filter down to own-source only.
  const products = await GroceryProduct.findAll({
    where: { id: productIds, createdBy: userId }, transaction
  });
  const ownProductIds = products.filter(p => (p.sourceType || 'own') === 'own').map(p => p.id);
  if (!ownProductIds.length) return;

  // Load every recipe line for the own products in one query.
  const recipes = await Recipe.findAll({
    where: { productId: ownProductIds }, transaction
  });
  if (!recipes.length) return;

  const recipesByProduct = new Map();
  for (const r of recipes) {
    if (!recipesByProduct.has(r.productId)) recipesByProduct.set(r.productId, []);
    recipesByProduct.get(r.productId).push(r);
  }

  // Preload materials so unit conversion + stock write don't need refetches.
  const rawIds = [...new Set(recipes.map(r => r.rawMaterialId))];
  const materials = await RawMaterial.findAll({ where: { id: rawIds, createdBy: userId }, transaction });
  const matById = new Map(materials.map(m => [m.id, m]));

  // Aggregate consumption per raw material (in the material's own unit).
  const totals = new Map();
  for (const it of items) {
    const rec = recipesByProduct.get(it.productId);
    if (!rec) continue;
    const qtySold = parseFloat(it.quantity) || 0;
    for (const line of rec) {
      const mat = matById.get(line.rawMaterialId);
      if (!mat) continue;
      const lineQty = parseFloat(line.quantity) * qtySold;
      if (!lineQty) continue;
      const inMatUnit = units.convertBetween(lineQty, line.unit || mat.unit, mat.unit);
      totals.set(line.rawMaterialId, (totals.get(line.rawMaterialId) || 0) + inMatUnit);
    }
  }
  if (!totals.size) return;

  const reason = direction < 0 ? 'sale' : 'cancel';
  const noteText = direction < 0
    ? `Sale · ${invoice.invoiceNumber}`
    : `Cancelled · ${invoice.invoiceNumber}`;

  for (const [rmId, amount] of totals.entries()) {
    const mat = matById.get(rmId);
    if (!mat) continue;
    await applyMovement({
      material: mat,
      changeQty: amount * direction,
      reason,
      refType: 'invoice',
      refId: invoice.id,
      notes: noteText,
      userId, transaction
    });
  }
}

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

    let where = { createdBy: req.user.id };

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
    const invoice = await Invoice.findOne({
      where: { id: req.params.id, createdBy: req.user.id },
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

    if (customerId) {
      const ownedCustomer = await Customer.findOne({
        where: { id: customerId, createdBy: req.user.id },
        transaction: t
      });
      if (!ownedCustomer) throw new Error('Customer not found for this account');
    }

    // Calculate totals (GST removed — grandTotal = subTotal - discount)
    let subTotal = 0;
    for (const item of items) {
      subTotal += item.quantity * item.unitPrice;
    }

    const grandTotal = subTotal - (discount || 0);

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
      gstAmount: 0,
      grandTotal,
      paidAmount,
      paymentStatus,
      notes,
      createdBy: req.user.id
    }, { transaction: t });

    // Create invoice items and update stock (no GST — totalPrice = qty × unitPrice)
    for (const item of items) {
      const totalPrice = item.quantity * item.unitPrice;

      await InvoiceItem.create({
        invoiceId: invoice.id,
        productType: shopType,
        productId: item.productId,
        productName: item.productName,
        productNameTamil: item.productNameTamil || null,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: item.unitPrice,
        gstRate: 0,
        gstAmount: 0,
        totalPrice
      }, { transaction: t });

      // Update product stock — but ONLY for outsourced (finished-good) items.
      // Own-source items get their raw materials deducted via
      // applyRecipeMovement below, and don't carry a physical stock count.
      if (shopType === 'grocery') {
        const prod = await GroceryProduct.findOne({
          where: { id: item.productId, createdBy: req.user.id },
          transaction: t
        });
        if (!prod) throw new Error('Product not found for this account');
        if (prod && (prod.sourceType || 'own') !== 'own') {
          await GroceryProduct.decrement('stock', {
            by: item.quantity,
            where: { id: item.productId, createdBy: req.user.id },
            transaction: t
          });
        }
      } else {
        const product = await FertilizerProduct.findOne({
          where: { id: item.productId, createdBy: req.user.id },
          transaction: t
        });
        if (!product) throw new Error('Product not found for this account');
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

    // Auto-deduct raw materials for own-source items via their recipes.
    // Runs inside the same transaction — a stock failure rolls back the sale.
    await applyRecipeMovement({
      invoice, items, direction: -1,
      userId: req.user.id, transaction: t
    });

    // Update customer totals
    if (customerId) {
      await Customer.increment('totalPurchases', {
        by: grandTotal,
        where: { id: customerId, createdBy: req.user.id },
        transaction: t
      });

      if (paymentStatus !== 'paid') {
        await Customer.increment('totalCredit', {
          by: grandTotal - paidAmount,
          where: { id: customerId, createdBy: req.user.id },
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
    const invoice = await Invoice.findOne({
      where: { id: req.params.id, createdBy: req.user.id }
    });
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
        where: { id: invoice.customerId, createdBy: req.user.id },
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
    const invoice = await Invoice.findOne({
      where: { id: req.params.id, createdBy: req.user.id },
      include: [{ model: InvoiceItem, as: 'items' }]
    });

    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    if (invoice.paymentStatus === 'cancelled') {
      return res.status(400).json({ message: 'Invoice already cancelled' });
    }

    // Restore finished-good stock ONLY for outsourced items — own items are
    // restored below via applyRecipeMovement (raw-material tier).
    for (const item of invoice.items) {
      if (invoice.shopType === 'grocery') {
        const prod = await GroceryProduct.findOne({
          where: { id: item.productId, createdBy: req.user.id },
          transaction: t
        });
        if (prod && (prod.sourceType || 'own') !== 'own') {
          await GroceryProduct.increment('stock', {
            by: item.quantity,
            where: { id: item.productId, createdBy: req.user.id },
            transaction: t
          });
        }
      } else {
        const product = await FertilizerProduct.findOne({
          where: { id: item.productId, createdBy: req.user.id },
          transaction: t
        });
        if (product) {
          if (product.isLooseEnabled && item.unit !== product.unit) {
            await product.increment('looseStock', { by: item.quantity, transaction: t });
          } else {
            await product.increment('stock', { by: item.quantity, transaction: t });
          }
        }
      }
    }

    // Restore raw materials consumed by recipe deduction on the original sale.
    await applyRecipeMovement({
      invoice, items: invoice.items, direction: +1,
      userId: req.user.id, transaction: t
    });

    // revert customer stats
    if (invoice.customerId) {
      await Customer.decrement('totalPurchases', {
        by: invoice.grandTotal,
        where: { id: invoice.customerId, createdBy: req.user.id },
        transaction: t
      });

      if (invoice.paymentStatus !== 'paid') {
        // if it was unpaid/partial, we need to remove the credit amount
        const creditAmount = invoice.grandTotal - invoice.paidAmount;
        await Customer.decrement('totalCredit', {
          by: creditAmount,
          where: { id: invoice.customerId, createdBy: req.user.id },
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
