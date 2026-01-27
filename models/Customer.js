const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Customer = sequelize.define('Customer', {
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
    type: DataTypes.STRING(20),
    allowNull: false
  },
  email: {
    type: DataTypes.STRING(100)
  },
  address: {
    type: DataTypes.TEXT
  },
  aadhar: {
    type: DataTypes.STRING(12),
    field: 'gstin'
  },
  totalPurchases: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0,
    field: 'total_purchases'
  },
  totalCredit: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0,
    field: 'total_credit'
  }
}, {
  tableName: 'customers',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

const FarmerDetails = sequelize.define('FarmerDetails', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  customerId: {
    type: DataTypes.INTEGER,
    unique: true,
    field: 'customer_id'
  },
  farmSize: {
    type: DataTypes.STRING(50),
    field: 'farm_size'
  },
  village: {
    type: DataTypes.STRING(100)
  },
  soilType: {
    type: DataTypes.STRING(50),
    field: 'soil_type'
  },
  irrigationType: {
    type: DataTypes.STRING(50),
    field: 'irrigation_type'
  },
  crops: {
    type: DataTypes.JSON
  }
}, {
  tableName: 'farmer_details',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false
});

Customer.hasOne(FarmerDetails, { foreignKey: 'customerId', as: 'farmerDetails' });
FarmerDetails.belongsTo(Customer, { foreignKey: 'customerId' });

module.exports = { Customer, FarmerDetails };
