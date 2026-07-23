const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Staff = sequelize.define('Staff', {
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
  role: {
    type: DataTypes.STRING(50),
    defaultValue: 'Staff'
  },
  monthlySalary: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
    field: 'monthly_salary'
  },
  // Default shift this staff usually works: morning | evening | both
  defaultShift: {
    type: DataTypes.ENUM('morning', 'evening', 'both'),
    defaultValue: 'morning',
    field: 'default_shift'
  },
  joinDate: {
    type: DataTypes.DATEONLY,
    field: 'join_date'
  },
  address: {
    type: DataTypes.TEXT
  },
  photo: {
    type: DataTypes.TEXT('long')
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
  tableName: 'staff',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

// One attendance row per staff, per date, per shift (2 shifts a day)
const Attendance = sequelize.define('Attendance', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  staffId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'staff_id'
  },
  date: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  shift: {
    type: DataTypes.ENUM('morning', 'evening'),
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('present', 'absent', 'leave', 'week_off'),
    allowNull: false,
    defaultValue: 'present'
  },
  checkIn: {
    type: DataTypes.STRING(5),          // "HH:MM"
    field: 'check_in'
  },
  checkOut: {
    type: DataTypes.STRING(5),          // "HH:MM"
    field: 'check_out'
  },
  notes: {
    type: DataTypes.STRING(255)
  }
}, {
  tableName: 'attendance',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { unique: true, fields: ['staff_id', 'date', 'shift'] }
  ]
});

Staff.hasMany(Attendance, { foreignKey: 'staffId', as: 'attendance', onDelete: 'CASCADE' });
Attendance.belongsTo(Staff, { foreignKey: 'staffId', as: 'staff' });

module.exports = { Staff, Attendance };
