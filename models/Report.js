const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// A generated daily/custom-range business report (data holds the computed summary JSON)
const DailyReport = sequelize.define('DailyReport', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  reportDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    field: 'report_date'
  },
  periodStart: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'period_start'
  },
  periodEnd: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'period_end'
  },
  trigger: {
    type: DataTypes.ENUM('auto', 'manual'),
    defaultValue: 'manual'
  },
  data: {
    type: DataTypes.JSON,
    allowNull: false
  },
  createdBy: {
    type: DataTypes.INTEGER,
    field: 'created_by'
  }
}, {
  tableName: 'daily_reports',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false
});

// Simple key/value app settings (e.g. report_time = "06:00")
const Setting = sequelize.define('Setting', {
  key: {
    type: DataTypes.STRING(50),
    primaryKey: true
  },
  value: {
    type: DataTypes.STRING(255)
  }
}, {
  tableName: 'settings',
  timestamps: false
});

module.exports = { DailyReport, Setting };
