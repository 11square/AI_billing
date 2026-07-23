// Raw material CRUD + manual stock adjust + per-material history.
// Stock changes on this route go through `applyMovement` so every touch is
// audit-logged. Automated changes (POS sales, PO Stock-In) call the same
// helper from their own routes.
const express = require('express');
const { Op } = require('sequelize');
const sequelize = require('../config/database');
const { RawMaterial, InventoryMovement, applyMovement } = require('../models/Inventory');
const units = require('../services/units');
const { auth } = require('../middleware/auth');

const router = express.Router();

// ---- GET /api/raw-materials/units-catalog ---------------------------------
// Single source of truth for the frontend's unit pickers.
router.get('/units-catalog', auth, (req, res) => {
  const catalog = units.UNIT_CATALOG;
  const familyOf = {};
  Object.values(catalog).flat().forEach(u => { familyOf[u] = units.familyOf(u); });
  res.json({ catalog, familyOf });
});

// ---- GET /api/raw-materials ----------------------------------------------
router.get('/', auth, async (req, res) => {
  try {
    const materials = await RawMaterial.findAll({
      where: { isActive: true },
      order: [['name', 'ASC']]
    });
    const enriched = materials.map(m => {
      const stock = parseFloat(m.currentStock);
      const min = parseFloat(m.minStock);
      let status = 'ok';
      if (stock <= 0) status = 'out';
      else if (stock <= min) status = 'low';
      return { ...m.toJSON(), status };
    });
    res.json(enriched);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ---- POST /api/raw-materials ---------------------------------------------
router.post('/', auth, async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { name, unit, currentStock = 0, minStock = 0, notes } = req.body;
    if (!name || !name.trim()) throw new Error('Name is required');

    const material = await RawMaterial.create({
      name: name.trim(),
      unit: (unit || 'unit').trim(),
      currentStock: 0,      // set below via applyMovement so opening balance is logged
      minStock: parseFloat(minStock) || 0,
      notes: notes || null
    }, { transaction: t });

    const opening = parseFloat(currentStock) || 0;
    if (opening !== 0) {
      await applyMovement({
        material, changeQty: opening, reason: 'initial',
        notes: 'Opening balance', userId: req.user.id, transaction: t
      });
    }

    await t.commit();
    const fresh = await RawMaterial.findByPk(material.id);
    res.status(201).json(fresh);
  } catch (error) {
    await t.rollback();
    res.status(400).json({ message: error.message });
  }
});

// ---- PUT /api/raw-materials/:id (metadata only) ---------------------------
router.put('/:id', auth, async (req, res) => {
  try {
    const material = await RawMaterial.findByPk(req.params.id);
    if (!material) return res.status(404).json({ message: 'Not found' });
    const { name, unit, minStock, notes, isActive } = req.body;
    await material.update({
      name: name?.trim() ?? material.name,
      unit: unit?.trim() ?? material.unit,
      minStock: minStock !== undefined ? parseFloat(minStock) : material.minStock,
      notes: notes !== undefined ? notes : material.notes,
      isActive: isActive !== undefined ? !!isActive : material.isActive
    });
    res.json(material);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// ---- DELETE /api/raw-materials/:id — soft delete --------------------------
router.delete('/:id', auth, async (req, res) => {
  try {
    const material = await RawMaterial.findByPk(req.params.id);
    if (!material) return res.status(404).json({ message: 'Not found' });
    await material.update({ isActive: false });
    res.json({ message: 'Raw material archived' });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// ---- POST /api/raw-materials/:id/adjust -----------------------------------
// { changeQty (signed), reason ('stock_in'|'adjust'), notes }
// Standalone stock-in (no PO) uses reason='stock_in'.
router.post('/:id/adjust', auth, async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const material = await RawMaterial.findByPk(req.params.id, { transaction: t });
    if (!material) { await t.rollback(); return res.status(404).json({ message: 'Not found' }); }

    const { changeQty, reason = 'adjust', notes } = req.body;
    const qty = parseFloat(changeQty);
    if (!Number.isFinite(qty) || qty === 0) {
      await t.rollback();
      return res.status(400).json({ message: 'changeQty must be a non-zero number' });
    }
    if (!['stock_in', 'adjust'].includes(reason)) {
      await t.rollback();
      return res.status(400).json({ message: 'reason must be stock_in or adjust' });
    }
    if (reason === 'stock_in' && qty <= 0) {
      await t.rollback();
      return res.status(400).json({ message: 'stock_in must be a positive quantity' });
    }

    const balance = await applyMovement({
      material, changeQty: qty, reason,
      notes, userId: req.user.id, transaction: t
    });

    await t.commit();
    res.json({ id: material.id, currentStock: balance });
  } catch (error) {
    await t.rollback();
    res.status(400).json({ message: error.message });
  }
});

// ---- GET /api/raw-materials/:id/history?limit=100 -------------------------
router.get('/:id/history', auth, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 500);
    const rows = await InventoryMovement.findAll({
      where: { rawMaterialId: req.params.id },
      order: [['created_at', 'DESC']],
      limit
    });
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ---- GET /api/raw-materials/movements/day?date=YYYY-MM-DD -----------------
// All movements on a given day, joined with material name — used by reports.
router.get('/movements/day', auth, async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().slice(0, 10);
    const [y, m, d] = date.split('-').map(Number);
    const start = new Date(y, m - 1, d, 0, 0, 0, 0);
    const end = new Date(y, m - 1, d, 23, 59, 59, 999);
    const rows = await InventoryMovement.findAll({
      where: { created_at: { [Op.between]: [start, end] } },
      include: [{ model: RawMaterial, as: 'rawMaterial', attributes: ['id', 'name', 'unit'] }],
      order: [['created_at', 'ASC']]
    });
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
