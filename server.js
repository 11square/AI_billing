const express = require('express');
const path = require('path');
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
const staffRoutes = require('./routes/staff');
const attendanceRoutes = require('./routes/attendance');

const app = express();

app.use(cors());
app.use(express.json({ limit: '5mb' }));

// Serve frontend
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/auth', authRoutes);
app.use('/api/grocery', groceryRoutes);
app.use('/api/fertilizer', fertilizerRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/attendance', attendanceRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Billing API is running' });
});

// SPA fallback for non-API routes
app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ MySQL Connected Successfully');

    await sequelize.sync({ alter: true });
    console.log('✅ Database synced');

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
      console.log(`🌐 Access via http://192.168.1.37:${PORT}`);
    });

    require('./services/reportService').startScheduler();
  } catch (error) {
    console.error('❌ Database connection error:', error);
    process.exit(1);
  }
};

startServer();