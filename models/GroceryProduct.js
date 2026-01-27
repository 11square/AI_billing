const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const GroceryProduct = sequelize.define('GroceryProduct', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING(200),
    allowNull: false
  },
  barcode: {
    type: DataTypes.STRING(50),
    unique: true
  },
  brand: {
    type: DataTypes.STRING(100)
  },
  category: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT
  },
  unit: {
    type: DataTypes.STRING(20),
    defaultValue: 'piece'
  },
  mrp: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  sellingPrice: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    field: 'selling_price'
  },
  purchasePrice: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    field: 'purchase_price'
  },
  gstRate: {
    type: DataTypes.DECIMAL(5, 2),
    defaultValue: 5,
    field: 'gst_rate'
  },
  hsnCode: {
    type: DataTypes.STRING(20),
    field: 'hsn_code'
  },
  stock: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  minStock: {
    type: DataTypes.INTEGER,
    defaultValue: 10,
    field: 'min_stock'
  },
  expiryDate: {
    type: DataTypes.DATEONLY,
    field: 'expiry_date'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active'
  }
}, {
  tableName: 'grocery_products',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = GroceryProduct;
