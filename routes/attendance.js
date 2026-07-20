const express = require('express');
const { Op } = require('sequelize');
const { Staff, Attendance } = require('../models/Staff');
const { auth } = require('../middleware/auth');

const router = express.Router();

const SHIFTS = ['morning', 'evening'];

// @route   GET /api/attendance?date=YYYY-MM-DD
// Returns the day sheet: every active staff with their morning/evening status.
router.get('/', auth, async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().slice(0, 10);

    const staff = await Staff.findAll({ where: { isActive: true }, order: [['name', 'ASC']] });
    const records = await Attendance.findAll({ where: { date } });

    const byKey = {};
    for (const r of records) byKey[`${r.staffId}|${r.shift}`] = r;

    const sheet = staff.map(s => {
      const shifts = {};
      for (const sh of SHIFTS) {
        const rec = byKey[`${s.id}|${sh}`];
        shifts[sh] = rec
          ? { status: rec.status, checkIn: rec.checkIn, checkOut: rec.checkOut, notes: rec.notes }
          : null;
      }
      return {
        staffId: s.id,
        name: s.name,
        role: s.role,
        photo: s.photo,
        defaultShift: s.defaultShift,
        shifts
      };
    });

    res.json({ date, shifts: SHIFTS, sheet });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   POST /api/attendance
// Bulk upsert a day sheet: { date, records: [{ staffId, shift, status, checkIn, checkOut, notes }] }
router.post('/', auth, async (req, res) => {
  try {
    const { date, records } = req.body;
    if (!date || !Array.isArray(records)) {
      return res.status(400).json({ message: 'date and records[] are required' });
    }

    let saved = 0;
    for (const r of records) {
      if (!r.staffId || !SHIFTS.includes(r.shift)) continue;
      const existing = await Attendance.findOne({
        where: { staffId: r.staffId, date, shift: r.shift }
      });
      const payload = {
        staffId: r.staffId,
        date,
        shift: r.shift,
        status: r.status || 'present',
        checkIn: r.checkIn || null,
        checkOut: r.checkOut || null,
        notes: r.notes || null
      };
      if (existing) await existing.update(payload);
      else await Attendance.create(payload);
      saved++;
    }

    res.json({ message: 'Attendance saved', saved });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/attendance/summary?month=&year=  (all staff monthly totals)
router.get('/summary', auth, async (req, res) => {
  try {
    const now = new Date();
    const month = req.query.month ? parseInt(req.query.month) : now.getMonth() + 1;
    const year = req.query.year ? parseInt(req.query.year) : now.getFullYear();
    const pad = n => String(n).padStart(2, '0');
    const start = `${year}-${pad(month)}-01`;
    const end = `${year}-${pad(month)}-${pad(new Date(year, month, 0).getDate())}`;

    const staff = await Staff.findAll({ where: { isActive: true }, order: [['name', 'ASC']] });
    const records = await Attendance.findAll({
      where: { date: { [Op.between]: [start, end] } }
    });

    const summary = staff.map(s => {
      const mine = records.filter(r => r.staffId === s.id);
      // 2 shifts = 1 full shift-credit each; present shifts / 2 = days worked
      const presentShifts = mine.filter(r => r.status === 'present').length;
      const absentShifts = mine.filter(r => r.status === 'absent').length;
      const leaveShifts = mine.filter(r => r.status === 'leave').length;
      const weekOffShifts = mine.filter(r => r.status === 'week_off').length;
      const perDay = s.defaultShift === 'both' ? 2 : 1;
      const salary = parseFloat(s.monthlySalary) || 0;
      return {
        staffId: s.id,
        name: s.name,
        role: s.role,
        monthlySalary: salary,
        presentShifts,
        absentShifts,
        leaveShifts,
        weekOffShifts,
        daysWorked: +(presentShifts / 2).toFixed(1),
        expectedShiftsPerDay: perDay
      };
    });

    res.json({ month, year, summary });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/attendance/staff/:id?month=&year=  (one staff, day-by-day)
router.get('/staff/:id', auth, async (req, res) => {
  try {
    const now = new Date();
    const month = req.query.month ? parseInt(req.query.month) : now.getMonth() + 1;
    const year = req.query.year ? parseInt(req.query.year) : now.getFullYear();
    const pad = n => String(n).padStart(2, '0');
    const start = `${year}-${pad(month)}-01`;
    const end = `${year}-${pad(month)}-${pad(new Date(year, month, 0).getDate())}`;

    const records = await Attendance.findAll({
      where: { staffId: req.params.id, date: { [Op.between]: [start, end] } },
      order: [['date', 'ASC'], ['shift', 'ASC']]
    });
    res.json(records);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
