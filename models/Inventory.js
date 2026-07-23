// ============================================================================
// Inventory tier — raw materials, per-product recipes, and the movement log
// that records every change to any raw-material stock (Stock-In, POS sale,
// cancel-restore, manual adjust, opening balance).
//
// Design notes:
//   * Only `sourceType='own'` menu products carry a recipe. Outsourced items
//     stay stocked as finished goods via GroceryProduct.stock.
//   * A stock change is ONLY authoritative if it is accompanied by a matching
//     InventoryMovement row — that's the source of truth for the audit trail.
//   * We never delete movements. Soft-deleting a material keeps its history.
// ============================================================================
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const GroceryProduct = require('./GroceryProduct');

const RawMaterial = sequelize.define('RawMaterial', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING(120), allowNull: false, unique: true },
  // Base unit the material is stocked in (g / kg / ml / l / pc / pack ...).
  // Recipes may specify a different unit within the same family and we'll
  // convert at deduction time (see services/units.js).
  unit: { type: DataTypes.STRING(24), allowNull: false, defaultValue: 'unit' },
  currentStock: {
    type: DataTypes.DECIMAL(14, 3),
    allowNull: false,
    defaultValue: 0,
    field: 'current_stock'
  },
  minStock: {
    type: DataTypes.DECIMAL(14, 3),
    allowNull: false,
    defaultValue: 0,
    field: 'min_stock'
  },
  notes: { type: DataTypes.STRING(255) },
  isActive: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    field: 'is_active'
  }
}, {
  tableName: 'raw_materials',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

// One row per (product, raw_material). `quantity` is what's needed to make
// ONE serving of the product. `unit` overrides the material's base unit
// when the recipe is more convenient in a different unit (e.g. tracking
// sugar in kg but writing the cappuccino recipe as "5 g").
const Recipe = sequelize.define('Recipe', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  productId: { type: DataTypes.INTEGER, allowNull: false, field: 'product_id' },
  rawMaterialId: { type: DataTypes.INTEGER, allowNull: false, field: 'raw_material_id' },
  quantity: { type: DataTypes.DECIMAL(14, 4), allowNull: false, defaultValue: 0 },
  unit: { type: DataTypes.STRING(24) }
}, {
  tableName: 'recipes',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    // A product should reference any single material at most once.
    { unique: true, fields: ['product_id', 'raw_material_id'] }
  ]
});

// Signed audit log. Positive changeQty = stock added (stock_in / cancel /
// adjust up / initial). Negative = stock consumed (sale / adjust down).
const InventoryMovement = sequelize.define('InventoryMovement', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  rawMaterialId: { type: DataTypes.INTEGER, allowNull: false, field: 'raw_material_id' },
  changeQty: {
    type: DataTypes.DECIMAL(14, 3),
    allowNull: false,
    field: 'change_qty'
  },
  balanceAfter: {
    type: DataTypes.DECIMAL(14, 3),
    allowNull: false,
    field: 'balance_after'
  },
  reason: {
    //   stock_in  — goods received (via a PO or standalone)
    //   sale      — auto-deducted from a completed invoice
    //   cancel    — restored because an invoice was cancelled/refunded
    //   adjust    — manual +/- adjustment (spoilage, count fix)
    //   initial   — opening balance set when the material was created
    type: DataTypes.ENUM('stock_in', 'sale', 'cancel', 'adjust', 'initial'),
    allowNull: false
  },
  // What triggered the movement — refType='purchase' + refId=poId for a
  // stock-in from a delivery, refType='invoice' + refId=invoiceId for a
  // sale/cancel, null otherwise.
  refType: { type: DataTypes.STRING(24), field: 'ref_type' },
  refId: { type: DataTypes.INTEGER, field: 'ref_id' },
  notes: { type: DataTypes.STRING(255) },
  createdBy: { type: DataTypes.INTEGER, field: 'created_by' }
}, {
  tableName: 'inventory_movements',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['raw_material_id', 'created_at'] },
    { fields: ['ref_type', 'ref_id'] },
    { fields: ['reason', 'created_at'] }
  ]
});

// ---- Associations --------------------------------------------------------
Recipe.belongsTo(RawMaterial, { foreignKey: 'rawMaterialId', as: 'rawMaterial' });
RawMaterial.hasMany(Recipe, { foreignKey: 'rawMaterialId', as: 'usedInRecipes' });

Recipe.belongsTo(GroceryProduct, { foreignKey: 'productId', as: 'product' });
GroceryProduct.hasMany(Recipe, { foreignKey: 'productId', as: 'recipe', onDelete: 'CASCADE' });

InventoryMovement.belongsTo(RawMaterial, { foreignKey: 'rawMaterialId', as: 'rawMaterial' });
RawMaterial.hasMany(InventoryMovement, { foreignKey: 'rawMaterialId', as: 'movements', onDelete: 'CASCADE' });

// ---- Shared movement helper (used by receive + sale + cancel + adjust) --
// Applies a signed stock change AND writes the audit row inside one tx.
async function applyMovement({ material, changeQty, reason, refType, refId, notes, userId, transaction }) {
  const before = parseFloat(material.currentStock);
  const after = +(before + parseFloat(changeQty)).toFixed(3);
  await material.update({ currentStock: after }, { transaction });
  await InventoryMovement.create({
    rawMaterialId: material.id,
    changeQty: +parseFloat(changeQty).toFixed(3),
    balanceAfter: after,
    reason,
    refType: refType || null,
    refId: refId || null,
    notes: notes || null,
    createdBy: userId || null
  }, { transaction });
  return after;
}

module.exports = { RawMaterial, Recipe, InventoryMovement, applyMovement };
