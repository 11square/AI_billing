// One-time ownership backfill for databases created before account isolation.
// Existing shared records belong to the account that already owns the most
// invoices (normally the original shop admin). New records always receive
// createdBy in their route handlers, so subsequent boots are no-ops.
const sequelize = require('../config/database');
const User = require('../models/User');
const GroceryProduct = require('../models/GroceryProduct');
const FertilizerProduct = require('../models/FertilizerProduct');
const { Customer } = require('../models/Customer');
const { Staff } = require('../models/Staff');
const { Vendor, Purchase } = require('../models/Purchase');
const { Invoice } = require('../models/Invoice');
const { RawMaterial, InventoryMovement } = require('../models/Inventory');
const { DailyReport } = require('../models/Report');

async function findLegacyOwnerId() {
  const [rows] = await sequelize.query(`
    SELECT created_by AS ownerId, COUNT(*) AS invoiceCount
    FROM invoices
    WHERE created_by IS NOT NULL
    GROUP BY created_by
    ORDER BY invoiceCount DESC
    LIMIT 1
  `);
  if (rows[0]?.ownerId) return Number(rows[0].ownerId);

  const preferred = await User.findOne({ where: { email: 'admin@cafe.com' } });
  if (preferred) return preferred.id;
  const oldest = await User.findOne({ order: [['id', 'ASC']] });
  return oldest?.id || null;
}

async function backfillLegacyOwnership() {
  const ownerId = await findLegacyOwnerId();
  if (!ownerId) return;

  const models = [
    GroceryProduct,
    FertilizerProduct,
    Customer,
    Staff,
    Vendor,
    Purchase,
    Invoice,
    RawMaterial,
    InventoryMovement,
    DailyReport
  ];

  let changed = 0;
  for (const Model of models) {
    const [count] = await Model.update(
      { createdBy: ownerId },
      { where: { createdBy: null } }
    );
    changed += count;
  }

  if (changed > 0) {
    console.log(`✅ Assigned ${changed} legacy records to account ${ownerId}`);
  }
}

module.exports = { backfillLegacyOwnership };
