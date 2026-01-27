const express = require('express');
const router = express.Router();
const { Vendor } = require('../models/Purchase');
const { auth } = require('../middleware/auth');

// Get all vendors
router.get('/', auth, async (req, res) => {
    try {
        const vendors = await Vendor.findAll({
            where: { shopType: req.user.activeShop },
            order: [['name', 'ASC']]
        });

        res.json({ vendors });
    } catch (error) {
        console.error('Error fetching vendors:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get single vendor
router.get('/:id', auth, async (req, res) => {
    try {
        const vendor = await Vendor.findByPk(req.params.id);

        if (!vendor) {
            return res.status(404).json({ message: 'Vendor not found' });
        }

        res.json(vendor);
    } catch (error) {
        console.error('Error fetching vendor:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Create vendor
router.post('/', auth, async (req, res) => {
    try {
        const { name, phone, email, address, gstin } = req.body;

        if (!name) {
            return res.status(400).json({ message: 'Vendor name is required' });
        }

        const vendor = await Vendor.create({
            name,
            phone: phone || null,
            email: email || null,
            address: address || null,
            gstin: gstin || null,
            shopType: req.user.activeShop
        });

        res.status(201).json(vendor);
    } catch (error) {
        console.error('Error creating vendor:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Update vendor
router.put('/:id', auth, async (req, res) => {
    try {
        const { name, phone, email, address, gstin } = req.body;

        const vendor = await Vendor.findByPk(req.params.id);
        if (!vendor) {
            return res.status(404).json({ message: 'Vendor not found' });
        }

        await vendor.update({
            name: name || vendor.name,
            phone: phone !== undefined ? phone : vendor.phone,
            email: email !== undefined ? email : vendor.email,
            address: address !== undefined ? address : vendor.address,
            gstin: gstin !== undefined ? gstin : vendor.gstin
        });

        res.json(vendor);
    } catch (error) {
        console.error('Error updating vendor:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Delete vendor
router.delete('/:id', auth, async (req, res) => {
    try {
        const vendor = await Vendor.findByPk(req.params.id);
        if (!vendor) {
            return res.status(404).json({ message: 'Vendor not found' });
        }

        await vendor.destroy();
        res.json({ message: 'Vendor deleted successfully' });
    } catch (error) {
        console.error('Error deleting vendor:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
