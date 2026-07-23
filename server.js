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
const rawMaterialRoutes = require('./routes/rawMaterials');
const recipeRoutes = require('./routes/recipes');

const app = express();

// Railway (and most PaaS) sit behind a proxy — trust it so req.ip and
// req.protocol reflect the real client, and cookies with `secure` still work.
app.set('trust proxy', 1);

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
app.use('/api/raw-materials', rawMaterialRoutes);
app.use('/api/recipes', recipeRoutes);

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
    console.log('✅ MySQL connected');

    // In production we don't want alter to run on every deploy — it can lock
    // large tables and race between instances. Set DB_SYNC=alter to force it
    // for one boot (useful right after a schema change), otherwise skip.
    const shouldSync = process.env.NODE_ENV !== 'production' || process.env.DB_SYNC === 'alter';
    if (shouldSync) {
      await sequelize.sync({ alter: true });
      console.log('✅ Database schema synced (alter mode)');
    } else {
      console.log('ℹ️  Skipping schema sync (set DB_SYNC=alter to force)');
    }

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server listening on port ${PORT}`);
    });

    require('./services/reportService').startScheduler();
  } catch (error) {
    console.error('❌ Database connection error:', error);
    process.exit(1);
  }
};

startServer();