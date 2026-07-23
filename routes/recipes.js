// Recipe API — the mapping between a menu product and the raw materials
// consumed to make one serving of it. Only own-source products have recipes.
const express = require('express');
const sequelize = require('../config/database');
const { Recipe, RawMaterial } = require('../models/Inventory');
const GroceryProduct = require('../models/GroceryProduct');
const units = require('../services/units');
const { auth } = require('../middleware/auth');

const router = express.Router();

// ---- GET /api/recipes/product/:productId ----------------------------------
router.get('/product/:productId', auth, async (req, res) => {
  try {
    const rows = await Recipe.findAll({
      where: { productId: req.params.productId },
      include: [{ model: RawMaterial, as: 'rawMaterial', attributes: ['id', 'name', 'unit'] }],
      order: [['id', 'ASC']]
    });
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ---- PUT /api/recipes/product/:productId ----------------------------------
// { lines: [{ rawMaterialId, quantity, unit? }] }
// Full-replace semantics. Validates every line before deleting anything.
router.put('/product/:productId', auth, async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const product = await GroceryProduct.findByPk(req.params.productId, { transaction: t });
    if (!product) { await t.rollback(); return res.status(404).json({ message: 'Product not found' }); }

    const lines = Array.isArray(req.body.lines) ? req.body.lines : [];

    // Pre-fetch referenced materials so we validate before any destructive op.
    const referencedIds = [...new Set(
      lines.filter(l => l && l.rawMaterialId).map(l => parseInt(l.rawMaterialId))
    )];
    const materials = await RawMaterial.findAll({ where: { id: referencedIds }, transaction: t });
    const matById = new Map(materials.map(m => [m.id, m]));

    // Dedup by rawMaterialId (unique index); last write wins.
    const seen = new Map();
    for (const line of lines) {
      if (!line || !line.rawMaterialId) continue;
      const qty = parseFloat(line.quantity);
      if (!Number.isFinite(qty) || qty <= 0) continue;
      const rmId = parseInt(line.rawMaterialId);
      const mat = matById.get(rmId);
      if (!mat) throw new Error(`Raw material #${rmId} not found`);

      const lineUnit = (line.unit || '').trim() || mat.unit;
      if (!units.sameFamily(lineUnit, mat.unit)) {
        throw new Error(`Recipe unit "${lineUnit}" is incompatible with ${mat.name}'s stock unit "${mat.unit}"`);
      }
      seen.set(rmId, {
        productId: product.id,
        rawMaterialId: rmId,
        quantity: qty,
        // Store only when it actually differs from the material's base unit.
        unit: lineUnit === mat.unit ? null : lineUnit
      });
    }

    await Recipe.destroy({ where: { productId: product.id }, transaction: t });
    if (seen.size > 0) {
      await Recipe.bulkCreate([...seen.values()], { transaction: t });
    }

    await t.commit();
    const fresh = await Recipe.findAll({
      where: { productId: product.id },
      include: [{ model: RawMaterial, as: 'rawMaterial', attributes: ['id', 'name', 'unit'] }],
      order: [['id', 'ASC']]
    });
    res.json(fresh);
  } catch (error) {
    await t.rollback();
    res.status(400).json({ message: error.message });
  }
});

module.exports = router;
