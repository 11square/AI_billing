const express = require('express');
const router = express.Router();
const { Vendor, Purchase, PurchaseItem } = require('../models/Purchase');
const User = require('../models/User');
const GroceryProduct = require('../models/GroceryProduct');
const FertilizerProduct = require('../models/FertilizerProduct');
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
            paymentMode,
            paymentDate,
            items,
            totalAmount,
            totalTax,
            discount,
            grandTotal,
            status
        } = req.body;

        // Create purchase
        const purchase = await Purchase.create({
            vendorName,
            vendorId: vendorId || null,
            invoiceNo: invoiceNo || null,
            vendorBillNo: vendorBillNo || null,
            billDate: new Date(billDate),
            paymentMode: paymentMode || 'cash',
            paymentDate: paymentDate ? new Date(paymentDate) : null,
            totalAmount,
            totalTax: totalTax || 0,
            discount: discount || 0,
            grandTotal,
            status: status || 'pending',
            shopType: req.user.activeShop,
            createdBy: req.user.id
        }, { transaction: t });

        // Create purchase items and update product stock
        if (items && items.length > 0) {
            for (const item of items) {
                await PurchaseItem.create({
                    purchaseId: purchase.id,
                    productId: item.productId || null,
                    productType: req.user.activeShop,
                    name: item.name,
                    category: item.category || null,
                    unit: item.unit,
                    quantity: item.quantity,
                    cost: item.cost,
                    sellingPrice: item.sellingPrice,
                    mrp: item.mrp,
                    tax: item.tax || 0,
                    totalCost: item.totalCost
                }, { transaction: t });

                // Update product stock (add to stock since this is a purchase)
                console.log(`[Purchase] Processing item: ${item.name}, ProductID: ${item.productId}, Qty: ${item.quantity}`);
                if (item.productId) {
                    if (req.user.activeShop === 'grocery') {
                        console.log(`[Purchase] Updating Grocery Stock for ID: ${item.productId}`);
                        const incrementResult = await GroceryProduct.increment('stock', {
                            by: item.quantity,
                            where: { id: item.productId },
                            transaction: t
                        });
                        console.log(`[Purchase] Stock increment result:`, incrementResult);

                        // Update prices if provided
                        console.log(`[Purchase] Updating Prices - Cost: ${item.cost}, Selling: ${item.sellingPrice}`);
                        await GroceryProduct.update({
                            purchasePrice: item.cost,
                            sellingPrice: item.sellingPrice,
                            mrp: item.mrp
                        }, {
                            where: { id: item.productId },
                            transaction: t
                        });
                    } else {
                        await FertilizerProduct.increment('stock', {
                            by: item.quantity,
                            where: { id: item.productId },
                            transaction: t
                        });
                        // Update prices if provided
                        await FertilizerProduct.update({
                            purchasePrice: item.cost,
                            sellingPrice: item.sellingPrice,
                            mrp: item.mrp
                        }, {
                            where: { id: item.productId },
                            transaction: t
                        });
                    }
                }
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
        const { status } = req.body;

        const purchase = await Purchase.findByPk(req.params.id);
        if (!purchase) {
            return res.status(404).json({ message: 'Purchase not found' });
        }

        await purchase.update({ status });
        res.json(purchase);
    } catch (error) {
        console.error('Error updating purchase status:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Delete purchase
router.delete('/:id', auth, async (req, res) => {
    const t = await sequelize.transaction();

    try {
        const purchase = await Purchase.findByPk(req.params.id, {
            include: [{ model: PurchaseItem, as: 'items' }]
        });

        if (!purchase) {
            await t.rollback();
            return res.status(404).json({ message: 'Purchase not found' });
        }

        // Reverse stock updates
        for (const item of purchase.items) {
            if (item.productId) {
                if (purchase.shopType === 'grocery') {
                    await GroceryProduct.decrement('stock', {
                        by: item.quantity,
                        where: { id: item.productId },
                        transaction: t
                    });
                } else {
                    await FertilizerProduct.decrement('stock', {
                        by: item.quantity,
                        where: { id: item.productId },
                        transaction: t
                    });
                }
            }
        }

        // Delete items
        await PurchaseItem.destroy({
            where: { purchaseId: purchase.id },
            transaction: t
        });

        // Delete purchase
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
