const { Sequelize } = require('sequelize');
require('dotenv').config();

const sharedOptions = {
  logging: false,
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
};

const sequelize = process.env.DATABASE_URL
  ? new Sequelize(process.env.DATABASE_URL, {
      ...sharedOptions,
      dialect: 'postgres',
      dialectOptions: process.env.NODE_ENV === 'production'
        ? { ssl: { require: true, rejectUnauthorized: false } }
        : {}
    })
  : new Sequelize(
      process.env.DB_NAME,
      process.env.DB_USER,
      process.env.DB_PASSWORD,
      {
        ...sharedOptions,
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        dialect: 'mysql'
      }
    );

module.exports = sequelize;
