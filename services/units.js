// Unit families + conversion helpers for raw-material stock movements.
//
// Two auto-conversion families:
//   weight: g <-> kg (kg = 1000 g)   [also mg for future]
//   volume: ml <-> L (L = 1000 ml)
//
// Everything else — pc, dozen, pack, bottle, cup, plate ... — has no family
// and must match exactly across recipe/material/PO lines, else we throw so
// nobody silently deducts the wrong amount.
const FAMILIES = {
  weight: { base: 'g',  units: { g: 1,  kg: 1000, mg: 0.001 } },
  volume: { base: 'ml', units: { ml: 1, l:  1000 } }
};

const norm = (u) => String(u || '').trim().toLowerCase();

function familyOf(unit) {
  const u = norm(unit);
  for (const [name, fam] of Object.entries(FAMILIES)) {
    if (u in fam.units) return name;
  }
  return null;
}

// Convert qty from unit `from` into unit `to`.
// Throws for cross-family or free-form-mismatched units.
function convertBetween(qty, from, to) {
  const a = norm(from), b = norm(to);
  const n = parseFloat(qty);
  if (!Number.isFinite(n)) throw new Error('Quantity must be a number');
  if (a === b) return n;

  const famA = familyOf(a), famB = familyOf(b);
  if (famA && famB) {
    if (famA !== famB) {
      throw new Error(`Cannot convert ${a} to ${b} — different unit families (${famA} vs ${famB})`);
    }
    const fam = FAMILIES[famA];
    const inBase = n * fam.units[a];
    return inBase / fam.units[b];
  }
  if (a !== b) {
    throw new Error(`Cannot convert "${from}" to "${to}" — units must match or belong to the same family (weight or volume)`);
  }
  return n;
}

function sameFamily(a, b) {
  const na = norm(a), nb = norm(b);
  if (na === nb) return true;
  const fa = familyOf(na), fb = familyOf(nb);
  return !!(fa && fb && fa === fb);
}

// Grouped catalog for UI pickers.
const UNIT_CATALOG = {
  weight: ['g', 'kg', 'mg'],
  volume: ['ml', 'l'],
  count:  ['pc', 'dozen', 'pack', 'bottle', 'box', 'bag', 'cup', 'plate', 'slice']
};

module.exports = { FAMILIES, UNIT_CATALOG, familyOf, sameFamily, convertBetween };
