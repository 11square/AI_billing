const express = require('express');
const cors = require('cors');

if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const sequelize = require('./config/database');

// Routes
const authRoutes = require('./routes/auth');
const groceryRoutes = require('./routes/grocery');
const fertilizerRoutes = require('./routes/fertilizer');
const customerRoutes = require('./routes/customers');
const invoiceRoutes = require('./routes/invoices');
const reportRoutes = require('./routes/reports');
const purchaseRoutes = require('./routes/purchases');
const vendorRoutes = require('./routes/vendors');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/grocery', groceryRoutes);
app.use('/api/fertilizer', fertilizerRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/vendors', vendorRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Billing API is running' });
});

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ MySQL Connected Successfully');

    await sequelize.sync({ alter: true });
    console.log('✅ Database synced');

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('❌ Database connection error:', error);
    process.exit(1);
  }
};

startServer();