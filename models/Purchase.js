const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./User');

const Vendor = sequelize.define('Vendor', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    name: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    phone: {
        type: DataTypes.STRING(20)
    },
    email: {
        type: DataTypes.STRING(100)
    },
    address: {
        type: DataTypes.TEXT
    },
    gstin: {
        type: DataTypes.STRING(20)
    },
    shopType: {
        type: DataTypes.ENUM('grocery', 'fertilizer'),
        allowNull: false,
        field: 'shop_type'
    }
}, {
    tableName: 'vendors',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

const Purchase = sequelize.define('Purchase', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    vendorId: {
        type: DataTypes.INTEGER,
        field: 'vendor_id'
    },
    vendorName: {
        type: DataTypes.STRING(100),
        allowNull: false,
        field: 'vendor_name'
    },
    invoiceNo: {
        type: DataTypes.STRING(50),
        field: 'invoice_no'
    },
    vendorBillNo: {
        type: DataTypes.STRING(50),
        field: 'vendor_bill_no'
    },
    billDate: {
        type: DataTypes.DATE,
        allowNull: false,
        field: 'bill_date'
    },
    paymentMode: {
        type: DataTypes.ENUM('cash', 'online', 'credit', 'split'),
        allowNull: false,
        defaultValue: 'cash',
        field: 'payment_mode'
    },
    paymentDate: {
        type: DataTypes.DATE,
        field: 'payment_date'
    },
    totalAmount: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        field: 'total_amount'
    },
    totalTax: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0,
        field: 'total_tax'
    },
    discount: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0
    },
    grandTotal: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        field: 'grand_total'
    },
    status: {
        type: DataTypes.ENUM('pending', 'paid', 'partial'),
        defaultValue: 'pending'
    },
    shopType: {
        type: DataTypes.ENUM('grocery', 'fertilizer'),
        allowNull: false,
        field: 'shop_type'
    },
    createdBy: {
        type: DataTypes.INTEGER,
        field: 'created_by'
    }
}, {
    tableName: 'purchases',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

const PurchaseItem = sequelize.define('PurchaseItem', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    purchaseId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'purchase_id'
    },
    productId: {
        type: DataTypes.INTEGER,
        field: 'product_id'
    },
    productType: {
        type: DataTypes.ENUM('grocery', 'fertilizer'),
        field: 'product_type'
    },
    name: {
        type: DataTypes.STRING(200),
        allowNull: false
    },
    category: {
        type: DataTypes.STRING(50)
    },
    unit: {
        type: DataTypes.STRING(20)
    },
    quantity: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    cost: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    sellingPrice: {
        type: DataTypes.DECIMAL(10, 2),
        field: 'selling_price'
    },
    mrp: {
        type: DataTypes.DECIMAL(10, 2)
    },
    tax: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0
    },
    totalCost: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        field: 'total_cost'
    }
}, {
    tableName: 'purchase_items',
    timestamps: false
});

// Associations
Purchase.belongsTo(Vendor, { foreignKey: 'vendorId', as: 'vendor' });
Purchase.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });
Purchase.hasMany(PurchaseItem, { foreignKey: 'purchaseId', as: 'items' });
PurchaseItem.belongsTo(Purchase, { foreignKey: 'purchaseId' });
Vendor.hasMany(Purchase, { foreignKey: 'vendorId', as: 'purchases' });

module.exports = { Vendor, Purchase, PurchaseItem };
