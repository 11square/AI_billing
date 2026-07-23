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
        // Kept for backwards-compat: date on the vendor's bill / invoice.
        type: DataTypes.DATE,
        allowNull: false,
        field: 'bill_date'
    },
    orderDate: {
        // When the order was placed with the vendor.
        type: DataTypes.DATEONLY,
        field: 'order_date'
    },
    receivedDate: {
        // When goods physically arrived / were counted in.
        type: DataTypes.DATEONLY,
        field: 'received_date'
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
        // NOTE: this field tracks PAYMENT status of the PO.
        // Delivery state lives in `deliveryStatus` below (five explicit states).
        type: DataTypes.ENUM('pending', 'paid', 'partial'),
        defaultValue: 'pending'
    },
    deliveryStatus: {
        // Where the goods are in their lifecycle:
        //   pending             — created, waiting for supplier
        //   approved            — supplier confirmed
        //   partially_delivered — some raw-material lines received
        //   delivered           — all lines fully received
        //   cancelled           — PO cancelled, no goods will arrive
        type: DataTypes.ENUM('pending', 'approved', 'partially_delivered', 'delivered', 'cancelled'),
        defaultValue: 'pending',
        field: 'delivery_status'
    },
    expectedDelivery: {
        type: DataTypes.DATEONLY,
        field: 'expected_delivery'
    },
    notes: {
        type: DataTypes.STRING(500)
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
        // Nullable — set when the PO line is for a finished (outsourced) product.
        type: DataTypes.INTEGER,
        field: 'product_id'
    },
    productType: {
        type: DataTypes.ENUM('grocery', 'fertilizer'),
        field: 'product_type'
    },
    rawMaterialId: {
        // Nullable — set when the PO line is for a raw material (ingredient).
        // Exactly one of productId or rawMaterialId is expected to be present.
        type: DataTypes.INTEGER,
        field: 'raw_material_id'
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
        // Decimal so we can order 2.5 kg of coffee beans, etc.
        type: DataTypes.DECIMAL(14, 3),
        allowNull: false
    },
    quantityReceived: {
        // Runs from 0 up to `quantity` as partial deliveries land.
        // Drives the PO's deliveryStatus.
        type: DataTypes.DECIMAL(14, 3),
        allowNull: false,
        defaultValue: 0,
        field: 'quantity_received'
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
