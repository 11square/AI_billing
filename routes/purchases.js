const express = require('express');
const router = express.Router();
const { Vendor, Purchase, PurchaseItem } = require('../models/Purchase');
const User = require('../models/User');
const GroceryProduct = require('../models/GroceryProduct');
const FertilizerProduct = require('../models/FertilizerProduct');
const { RawMaterial, applyMovement } = require('../models/Inventory');
const { auth } = require('../middleware/auth');
const sequelize = require('../config/database');

// Get all purchases
router.get('/', auth, async (req, res) => {
    try {
        const purchases = await Purchase.findAll({
            where: { shopType: req.user.activeShop },
            include: [
                { model: PurchaseItem, as: 'items' },
                { model: Vendor, as: 'vendor' },
                { model: User, as: 'creator', attributes: ['id', 'name', 'email'] }
            ],
            order: [['created_at', 'DESC']]
        });

        res.json({ purchases });
    } catch (error) {
        console.error('Error fetching purchases:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get single purchase
router.get('/:id', auth, async (req, res) => {
    try {
        const purchase = await Purchase.findByPk(req.params.id, {
            include: [
                { model: PurchaseItem, as: 'items' },
                { model: Vendor, as: 'vendor' },
                { model: User, as: 'creator', attributes: ['id', 'name', 'email'] }
            ]
        });

        if (!purchase) {
            return res.status(404).json({ message: 'Purchase not found' });
        }

        res.json(purchase);
    } catch (error) {
        console.error('Error fetching purchase:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Create purchase
router.post('/', auth, async (req, res) => {
    const t = await sequelize.transaction();

    try {
        const {
            vendorName,
            vendorId,
            invoiceNo,
            vendorBillNo,
            billDate,
            orderDate,
            receivedDate,
            expectedDelivery,
            notes,
            paymentMode,
            paymentDate,
            items,
            totalAmount,
            totalTax,
            discount,
            grandTotal,
            status,
            deliveryStatus
        } = req.body;

        // Create purchase — NOTE: this is a REQUEST to the supplier and does
        // NOT touch inventory. Stock only moves when goods are physically
        // received via POST /api/purchases/:id/receive (see below).
        const purchase = await Purchase.create({
            vendorName,
            vendorId: vendorId || null,
            invoiceNo: invoiceNo || null,
            vendorBillNo: vendorBillNo || null,
            billDate: new Date(billDate),
            orderDate: orderDate || null,
            receivedDate: receivedDate || null,
            expectedDelivery: expectedDelivery || null,
            notes: notes || null,
            paymentMode: paymentMode || 'cash',
            paymentDate: paymentDate ? new Date(paymentDate) : null,
            totalAmount,
            totalTax: totalTax || 0,
            discount: discount || 0,
            grandTotal,
            status: status || 'pending',
            deliveryStatus: deliveryStatus || 'pending',
            shopType: req.user.activeShop,
            createdBy: req.user.id
        }, { transaction: t });

        // Persist the line items. A line can reference either a raw material
        // (rawMaterialId) or a finished product (productId). Stock stays put
        // until goods are received.
        if (items && items.length > 0) {
            for (const item of items) {
                await PurchaseItem.create({
                    purchaseId: purchase.id,
                    productId: item.productId || null,
                    productType: item.productId ? req.user.activeShop : null,
                    rawMaterialId: item.rawMaterialId || null,
                    name: item.name,
                    category: item.category || null,
                    unit: item.unit,
                    quantity: item.quantity,
                    quantityReceived: 0,
                    cost: item.cost,
                    sellingPrice: item.sellingPrice,
                    mrp: item.mrp,
                    tax: item.tax || 0,
                    totalCost: item.totalCost
                }, { transaction: t });
            }
        }

        await t.commit();

        // Fetch the complete purchase with items
        const completePurchase = await Purchase.findByPk(purchase.id, {
            include: [
                { model: PurchaseItem, as: 'items' },
                { model: Vendor, as: 'vendor' },
                { model: User, as: 'creator', attributes: ['id', 'name', 'email'] }
            ]
        });

        res.status(201).json(completePurchase);
    } catch (error) {
        await t.rollback();
        console.error('Error creating purchase:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Update purchase status
router.patch('/:id/status', auth, async (req, res) => {
    try {
        const { status, deliveryStatus } = req.body;
        const purchase = await Purchase.findByPk(req.params.id);
        if (!purchase) return res.status(404).json({ message: 'Purchase not found' });

        const updates = {};
        if (status !== undefined) updates.status = status;
        if (deliveryStatus !== undefined) updates.deliveryStatus = deliveryStatus;
        await purchase.update(updates);
        res.json(purchase);
    } catch (error) {
        console.error('Error updating purchase status:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// ---- POST /api/purchases/:id/receive --------------------------------------
// Record goods received against a PO — this is where inventory actually moves.
// Body: { date?, receivedBy?, remarks?, lines: [{ purchaseItemId, quantityReceived }] }
//
// Semantics:
//   * Each line's quantityReceived may be less than the ordered qty (partial delivery).
//   * Raw-material lines increment RawMaterial.currentStock AND write an
//     InventoryMovement (reason='stock_in', refType='purchase', refId=poId).
//   * Product lines increment the finished-good stock directly.
//   * After receipt: PO.deliveryStatus recomputed —
//     0 received on every line -> pending
//     some received but not all lines full -> partially_delivered
//     every line fully received -> delivered
//   * receivedDate stamped only when status becomes delivered.
router.post('/:id/receive', auth, async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const purchase = await Purchase.findByPk(req.params.id, {
            include: [{ model: PurchaseItem, as: 'items' }],
            transaction: t
        });
        if (!purchase) { await t.rollback(); return res.status(404).json({ message: 'Purchase order not found' }); }
        if (purchase.deliveryStatus === 'cancelled') {
            await t.rollback();
            return res.status(400).json({ message: 'Cannot receive against a cancelled PO' });
        }

        const { date, remarks, lines } = req.body;
        if (!Array.isArray(lines) || lines.length === 0) {
            await t.rollback();
            return res.status(400).json({ message: 'lines[] is required' });
        }

        const itemById = new Map(purchase.items.map(i => [i.id, i]));
        const receiveNote = remarks || `Received against PO-${String(purchase.id).padStart(4, '0')}`;

        for (const line of lines) {
            const item = itemById.get(parseInt(line.purchaseItemId));
            if (!item) continue;
            const incoming = parseFloat(line.quantityReceived);
            if (!Number.isFinite(incoming) || incoming <= 0) continue;

            const ordered = parseFloat(item.quantity);
            const already = parseFloat(item.quantityReceived);
            const remaining = ordered - already;
            if (incoming > remaining + 0.001) {
                await t.rollback();
                return res.status(400).json({ message: `Line "${item.name}" — cannot receive ${incoming} ${item.unit}; only ${remaining} remaining` });
            }

            // Apply the stock movement per line type.
            if (item.rawMaterialId) {
                const material = await RawMaterial.findByPk(item.rawMaterialId, { transaction: t });
                if (!material) { await t.rollback(); return res.status(400).json({ message: `Raw material for line "${item.name}" was deleted` }); }
                await applyMovement({
                    material, changeQty: incoming, reason: 'stock_in',
                    refType: 'purchase', refId: purchase.id,
                    notes: receiveNote, userId: req.user.id, transaction: t
                });
            } else if (item.productId) {
                const Model = purchase.shopType === 'grocery' ? GroceryProduct : FertilizerProduct;
                await Model.increment('stock', {
                    by: incoming, where: { id: item.productId }, transaction: t
                });
            }

            // Track partial delivery on the line.
            await item.update({
                quantityReceived: +(already + incoming).toFixed(3)
            }, { transaction: t });
        }

        // Recompute overall delivery status.
        const refreshedItems = await PurchaseItem.findAll({
            where: { purchaseId: purchase.id }, transaction: t
        });
        const allDone = refreshedItems.every(i => parseFloat(i.quantityReceived) >= parseFloat(i.quantity) - 0.001);
        const anyReceived = refreshedItems.some(i => parseFloat(i.quantityReceived) > 0);
        const newStatus = allDone ? 'delivered' : anyReceived ? 'partially_delivered' : 'pending';
        const stampDate = allDone && !purchase.receivedDate
            ? (date || new Date().toISOString().slice(0, 10))
            : purchase.receivedDate;
        await purchase.update({
            deliveryStatus: newStatus,
            receivedDate: stampDate
        }, { transaction: t });

        await t.commit();
        const complete = await Purchase.findByPk(purchase.id, {
            include: [{ model: PurchaseItem, as: 'items' }, { model: Vendor, as: 'vendor' }]
        });
        res.json(complete);
    } catch (error) {
        await t.rollback();
        console.error('Error receiving PO:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Delete purchase — safe to delete only if no goods have been received.
// (Preserves inventory audit trail; users should cancel a received PO instead.)
router.delete('/:id', auth, async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const purchase = await Purchase.findByPk(req.params.id, {
            include: [{ model: PurchaseItem, as: 'items' }],
            transaction: t
        });
        if (!purchase) {
            await t.rollback();
            return res.status(404).json({ message: 'Purchase not found' });
        }
        const anyReceived = purchase.items.some(i => parseFloat(i.quantityReceived) > 0);
        if (anyReceived) {
            await t.rollback();
            return res.status(400).json({
                message: 'Goods have been received against this PO. Cancel it instead of deleting.'
            });
        }
        await PurchaseItem.destroy({ where: { purchaseId: purchase.id }, transaction: t });
        await purchase.destroy({ transaction: t });
        await t.commit();
        res.json({ message: 'Purchase deleted successfully' });
    } catch (error) {
        await t.rollback();
        console.error('Error deleting purchase:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
