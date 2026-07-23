const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const FertilizerProduct = sequelize.define('FertilizerProduct', {
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
    type: DataTypes.STRING(50)
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
  compositionN: {
    type: DataTypes.STRING(10),
    field: 'composition_n'
  },
  compositionP: {
    type: DataTypes.STRING(10),
    field: 'composition_p'
  },
  compositionK: {
    type: DataTypes.STRING(10),
    field: 'composition_k'
  },
  activeIngredient: {
    type: DataTypes.STRING(200),
    field: 'active_ingredient'
  },
  concentration: {
    type: DataTypes.STRING(50)
  },
  dosage: {
    type: DataTypes.TEXT
  },
  safetyPrecautions: {
    type: DataTypes.TEXT,
    field: 'safety_precautions'
  },
  storageConditions: {
    type: DataTypes.STRING(200),
    field: 'storage_conditions'
  },
  targetCrops: {
    type: DataTypes.JSON,
    field: 'target_crops'
  },
  unit: {
    type: DataTypes.STRING(20),
    defaultValue: 'kg'
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
    defaultValue: 5,
    field: 'min_stock'
  },
  batchNumber: {
    type: DataTypes.STRING(50),
    field: 'batch_number'
  },
  manufacturingDate: {
    type: DataTypes.DATEONLY,
    field: 'manufacturing_date'
  },
  expiryDate: {
    type: DataTypes.DATEONLY,
    field: 'expiry_date'
  },
  hazardLevel: {
    type: DataTypes.ENUM('low', 'medium', 'high', 'extreme'),
    defaultValue: 'low',
    field: 'hazard_level'
  },
  licenseRequired: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'license_required'
  },
  registrationNumber: {
    type: DataTypes.STRING(50),
    field: 'registration_number'
  },
  isLooseEnabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_loose_enabled'
  },
  weightPerBag: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
    field: 'weight_per_bag'
  },
  pricePerKg: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
    field: 'price_per_kg'
  },
  looseStock: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
    field: 'loose_stock'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active'
  },
  createdBy: {
    type: DataTypes.INTEGER,
    field: 'created_by'
  }
}, {
  tableName: 'fertilizer_products',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { unique: true, fields: ['created_by', 'barcode'] }
  ]
});

module.exports = FertilizerProduct;
