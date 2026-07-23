const express = require('express');
const { Op } = require('sequelize');
const { Staff, Attendance } = require('../models/Staff');
const { auth } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/staff
router.get('/', auth, async (req, res) => {
  try {
    const { search, includeInactive } = req.query;
    let where = { createdBy: req.user.id };
    if (includeInactive !== 'true') where.isActive = true;
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { phone: { [Op.like]: `%${search}%` } },
        { role: { [Op.like]: `%${search}%` } }
      ];
    }
    const staff = await Staff.findAll({ where, order: [['name', 'ASC']] });
    res.json(staff);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/staff/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const staff = await Staff.findOne({ where: { id: req.params.id, createdBy: req.user.id } });
    if (!staff) return res.status(404).json({ message: 'Staff not found' });
    res.json(staff);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   POST /api/staff
router.post('/', auth, async (req, res) => {
  try {
    if (!req.body.name) return res.status(400).json({ message: 'Name is required' });
    const staff = await Staff.create({ ...req.body, createdBy: req.user.id });
    res.status(201).json(staff);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   PUT /api/staff/:id
router.put('/:id', auth, async (req, res) => {
  try {
    const staff = await Staff.findOne({ where: { id: req.params.id, createdBy: req.user.id } });
    if (!staff) return res.status(404).json({ message: 'Staff not found' });
    const { createdBy, ...updates } = req.body;
    await staff.update(updates);
    res.json(staff);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   DELETE /api/staff/:id  (soft delete)
router.delete('/:id', auth, async (req, res) => {
  try {
    const staff = await Staff.findOne({ where: { id: req.params.id, createdBy: req.user.id } });
    if (!staff) return res.status(404).json({ message: 'Staff not found' });
    await staff.update({ isActive: false });
    res.json({ message: 'Staff deactivated' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
