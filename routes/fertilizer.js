const express = require('express');
const { Op } = require('sequelize');
const FertilizerProduct = require('../models/FertilizerProduct');
const { auth } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/fertilizer
router.get('/', auth, async (req, res) => {
  try {
    const { category, search, targetCrop, lowStock } = req.query;

    let where = { isActive: true };

    if (category) {
      where.category = category;
    }

    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { barcode: { [Op.like]: `%${search}%` } },
        { brand: { [Op.like]: `%${search}%` } },
        { activeIngredient: { [Op.like]: `%${search}%` } }
      ];
    }

    const products = await FertilizerProduct.findAll({
      where,
      order: [['name', 'ASC']]
    });

    let result = products;

    if (targetCrop) {
      result = result.filter(p =>
        p.targetCrops && p.targetCrops.includes(targetCrop)
      );
    }

    if (lowStock === 'true') {
      result = result.filter(p => p.stock <= p.minStock);
    }

    res.json({ products: result, total: result.length });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/fertilizer/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const product = await FertilizerProduct.findByPk(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.json(product);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/fertilizer/barcode/:barcode
router.get('/barcode/:barcode', auth, async (req, res) => {
  try {
    const product = await FertilizerProduct.findOne({
      where: { barcode: req.params.barcode, isActive: true }
    });
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.json(product);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   POST /api/fertilizer
router.post('/', auth, async (req, res) => {
  try {
    const product = await FertilizerProduct.create(req.body);
    res.status(201).json(product);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   PUT /api/fertilizer/:id
router.put('/:id', auth, async (req, res) => {
  try {
    const product = await FertilizerProduct.findByPk(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    await product.update(req.body);
    res.json(product);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   PUT /api/fertilizer/:id/restock
// Adds quantity and optionally updates prices
router.put('/:id/restock', auth, async (req, res) => {
  try {
    const product = await FertilizerProduct.findByPk(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const { quantity, purchasePrice, sellingPrice, mrp } = req.body;

    if (!quantity || quantity <= 0) {
      return res.status(400).json({ message: 'Quantity must be greater than 0' });
    }

    // Build update object
    const updateData = {
      stock: product.stock + parseInt(quantity)
    };

    // Only update prices if provided
    if (purchasePrice !== undefined) {
      updateData.purchasePrice = parseFloat(purchasePrice);
    }
    if (sellingPrice !== undefined) {
      updateData.sellingPrice = parseFloat(sellingPrice);
    }
    if (mrp !== undefined) {
      updateData.mrp = parseFloat(mrp);
    }

    await product.update(updateData);
    res.json({
      message: 'Product restocked successfully',
      product,
      addedQuantity: quantity,
      newStock: product.stock
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   DELETE /api/fertilizer/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const product = await FertilizerProduct.findByPk(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    await product.update({ isActive: false });
    res.json({ message: 'Product deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
