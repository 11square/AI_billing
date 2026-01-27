const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const { Customer } = require('./Customer');
const User = require('./User');

const Invoice = sequelize.define('Invoice', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  invoiceNumber: {
    type: DataTypes.STRING(50),
    unique: true,
    allowNull: false,
    field: 'invoice_number'
  },
  shopType: {
    type: DataTypes.ENUM('grocery', 'fertilizer'),
    allowNull: false,
    field: 'shop_type'
  },
  customerId: {
    type: DataTypes.INTEGER,
    field: 'customer_id'
  },
  customerName: {
    type: DataTypes.STRING(100),
    field: 'customer_name'
  },
  customerPhone: {
    type: DataTypes.STRING(20),
    field: 'customer_phone'
  },
  subTotal: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    field: 'sub_total'
  },
  discount: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  gstAmount: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
    field: 'gst_amount'
  },
  grandTotal: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    field: 'grand_total'
  },
  paidAmount: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0,
    field: 'paid_amount'
  },
  paymentStatus: {
    type: DataTypes.ENUM('paid', 'partial', 'unpaid', 'cancelled'),
    defaultValue: 'unpaid',
    field: 'payment_status'
  },
  notes: {
    type: DataTypes.TEXT
  },
  createdBy: {
    type: DataTypes.INTEGER,
    field: 'created_by'
  }
}, {
  tableName: 'invoices',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

const InvoiceItem = sequelize.define('InvoiceItem', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  invoiceId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'invoice_id'
  },
  productType: {
    type: DataTypes.ENUM('grocery', 'fertilizer'),
    allowNull: false,
    field: 'product_type'
  },
  productId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'product_id'
  },
  productName: {
    type: DataTypes.STRING(200),
    allowNull: false,
    field: 'product_name'
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  unit: {
    type: DataTypes.STRING(20)
  },
  unitPrice: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    field: 'unit_price'
  },
  gstRate: {
    type: DataTypes.DECIMAL(5, 2),
    defaultValue: 0,
    field: 'gst_rate'
  },
  gstAmount: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
    field: 'gst_amount'
  },
  totalPrice: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    field: 'total_price'
  }
}, {
  tableName: 'invoice_items',
  timestamps: false
});

const Payment = sequelize.define('Payment', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  invoiceId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'invoice_id'
  },
  amount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false
  },
  method: {
    type: DataTypes.ENUM('cash', 'card', 'upi', 'credit'),
    allowNull: false
  },
  referenceNumber: {
    type: DataTypes.STRING(100),
    field: 'reference_number'
  },
  paymentDate: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    field: 'payment_date'
  }
}, {
  tableName: 'payments',
  timestamps: false
});

// Associations
Invoice.belongsTo(Customer, { foreignKey: 'customerId', as: 'customer' });
Invoice.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });
Invoice.hasMany(InvoiceItem, { foreignKey: 'invoiceId', as: 'items' });
Invoice.hasMany(Payment, { foreignKey: 'invoiceId', as: 'payments' });
InvoiceItem.belongsTo(Invoice, { foreignKey: 'invoiceId' });
Payment.belongsTo(Invoice, { foreignKey: 'invoiceId' });

module.exports = { Invoice, InvoiceItem, Payment };
