// Seeds the database with a 100-item café + bakery menu, an admin user and sample customers.
// Run: node seed-cafe.js
require('dotenv').config();

const sequelize = require('./config/database');
const User = require('./models/User');
const GroceryProduct = require('./models/GroceryProduct');
const { Customer } = require('./models/Customer');
const { Staff } = require('./models/Staff');

const img = (id) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=500&q=60`;
const item = (name, category, sellingPrice, purchasePrice, photoId, opts = {}) => ({
  name, category, sellingPrice, purchasePrice,
  mrp: opts.mrp || sellingPrice,
  gstRate: opts.gst ?? 5,
  stock: opts.stock ?? 80,
  unit: opts.unit || 'piece',
  image: img(photoId),
  description: opts.desc || null,
  sourceType: opts.source || 'own',
  boq: opts.boq || null
});
const boq = (...lines) => lines.map(([ingredient, qty, unit]) => ({ ingredient, qty, unit }));

const MENU = [
  // ================= COFFEE (11) =================
  item('Espresso', 'Coffee', 90, 30, 'photo-1510707577719-ae7c14805e3a', { unit: 'cup', stock: 150, desc: 'Strong single shot of coffee',
    boq: boq(['Coffee Beans', 18, 'g']) }),
  item('Cappuccino', 'Coffee', 140, 45, 'photo-1572442388796-11668a67e53d', { unit: 'cup', stock: 150, desc: 'Espresso with steamed milk foam',
    boq: boq(['Coffee Beans', 18, 'g'], ['Milk', 150, 'ml'], ['Sugar', 10, 'g']) }),
  item('Caffe Latte', 'Coffee', 150, 48, 'photo-1561047029-3000c68339ca', { unit: 'cup', stock: 150, desc: 'Smooth espresso with steamed milk',
    boq: boq(['Coffee Beans', 18, 'g'], ['Milk', 200, 'ml'], ['Sugar', 10, 'g']) }),
  item('Americano', 'Coffee', 110, 35, 'photo-1551030173-122aabc4489c', { unit: 'cup', stock: 150, desc: 'Espresso with hot water',
    boq: boq(['Coffee Beans', 18, 'g']) }),
  item('Caffe Mocha', 'Coffee', 160, 55, 'photo-1578314675249-a6910f80cc4e', { unit: 'cup', stock: 150, desc: 'Chocolate flavoured coffee delight' }),
  item('Cold Coffee', 'Coffee', 170, 60, 'photo-1461023058943-07fcbe16d735', { unit: 'glass', stock: 120, desc: 'Chilled blended coffee with ice cream',
    boq: boq(['Coffee Beans', 15, 'g'], ['Milk', 200, 'ml'], ['Ice Cream', 50, 'g'], ['Sugar', 15, 'g']) }),
  item('Flat White', 'Coffee', 150, 48, 'photo-1577968897966-3d4325b36b61', { unit: 'cup', stock: 120, desc: 'Velvety micro-foam over double shot' }),
  item('Macchiato', 'Coffee', 120, 38, 'photo-1485808191679-5f86510681a2', { unit: 'cup', stock: 120, desc: 'Espresso marked with foam' }),
  item('Caramel Latte', 'Coffee', 180, 60, 'photo-1599398054066-846f28917f38', { unit: 'cup', stock: 120, desc: 'Latte sweetened with caramel' }),
  item('Iced Americano', 'Coffee', 130, 40, 'photo-1517701604599-bb29b565090c', { unit: 'glass', stock: 120, desc: 'Chilled espresso over ice' }),
  item('Filter Coffee', 'Coffee', 60, 18, 'photo-1559496417-e7f25cb247f3', { unit: 'cup', stock: 200, desc: 'South Indian style filter kaapi' }),

  // ================= TEA (6) =================
  item('Masala Chai', 'Tea', 50, 15, 'photo-1571934811356-5cc061b6821f', { unit: 'cup', stock: 200, desc: 'Traditional Indian spiced tea',
    boq: boq(['Milk', 100, 'ml'], ['Tea Leaves', 8, 'g'], ['Sugar', 12, 'g'], ['Chai Masala', 2, 'g']) }),
  item('Green Tea', 'Tea', 70, 20, 'photo-1627435601361-ec25f5b1d0e5', { unit: 'cup', stock: 150, desc: 'Refreshing antioxidant-rich tea' }),
  item('Iced Lemon Tea', 'Tea', 100, 30, 'photo-1556679343-c7306c1976bc', { unit: 'glass', stock: 120, desc: 'Chilled tea with fresh lemon' }),
  item('Ginger Chai', 'Tea', 55, 16, 'photo-1597318181409-cf64d0b5d8a2', { unit: 'cup', stock: 200, desc: 'Adrak wali kadak chai' }),
  item('Elaichi Chai', 'Tea', 60, 18, 'photo-1561336313-0bd5e0b27ec8', { unit: 'cup', stock: 200, desc: 'Cardamom infused milk tea' }),
  item('Lemon Honey Tea', 'Tea', 80, 24, 'photo-1544787219-7f47ccb76574', { unit: 'cup', stock: 120, desc: 'Soothing honey lemon brew' }),

  // ================= SNACKS (20) =================
  item('French Fries', 'Snacks', 120, 40, 'photo-1573080496219-bb080dd4f877', { unit: 'plate', desc: 'Crispy golden salted fries',
    boq: boq(['Potato', 200, 'g'], ['Cooking Oil', 30, 'ml'], ['Salt', 3, 'g']) }),
  item('Peri Peri Fries', 'Snacks', 140, 48, 'photo-1630384060421-cb20d0e0649d', { unit: 'plate', desc: 'Fries tossed in peri peri spice' }),
  item('Veg Sandwich', 'Snacks', 110, 35, 'photo-1528735602780-2552fd46c7af', { desc: 'Fresh veggies with mint chutney' }),
  item('Grilled Cheese Sandwich', 'Snacks', 150, 50, 'photo-1481070555726-e2fe8357725c', { desc: 'Golden grilled with melted cheese' }),
  item('Paneer Tikka Sandwich', 'Snacks', 160, 55, 'photo-1553909489-cd47e0907980', { desc: 'Smoky paneer tikka filling' }),
  item('Club Sandwich', 'Snacks', 180, 62, 'photo-1567234669003-dce7a7a88821', { desc: 'Triple decker loaded sandwich' }),
  item('Corn & Cheese Sandwich', 'Snacks', 140, 48, 'photo-1475090169767-40ed8d18f67d', { desc: 'Sweet corn with gooey cheese' }),
  item('Samosa (2 pc)', 'Snacks', 40, 12, 'photo-1601050690597-df0568f70950', { unit: 'plate', stock: 150, desc: 'Crispy potato-stuffed pastry' }),
  item('Veg Burger', 'Snacks', 130, 45, 'photo-1571091718767-18b5b1457add', { desc: 'Juicy veg patty with fresh lettuce',
    boq: boq(['Burger Bun', 1, 'pc'], ['Veg Patty', 1, 'pc'], ['Lettuce', 20, 'g'], ['Mayonnaise', 15, 'g'], ['Cheese Slice', 1, 'pc']) }),
  item('Cheese Burger', 'Snacks', 160, 55, 'photo-1568901346375-23c9450c58cd', { desc: 'Double cheese loaded burger' }),
  item('Veg Momos (6 pc)', 'Snacks', 100, 32, 'photo-1626074353765-517a681e40be', { unit: 'plate', desc: 'Steamed veg dumplings with chutney' }),
  item('Spring Rolls (4 pc)', 'Snacks', 120, 40, 'photo-1606491956689-2ea866880c84', { unit: 'plate', desc: 'Crunchy veg spring rolls' }),
  item('Garlic Bread', 'Snacks', 110, 35, 'photo-1573140247632-f8fd74997d5c', { unit: 'plate', desc: 'Toasted herb garlic baguette' }),
  item('Cheese Garlic Bread', 'Snacks', 140, 48, 'photo-1600628421055-4d30de868b8f', { unit: 'plate', desc: 'Garlic bread with mozzarella' }),
  item('Veg Maggi', 'Snacks', 80, 25, 'photo-1612929633738-8fe44f7ec841', { unit: 'bowl', desc: 'Masala maggi with veggies' }),
  item('Cheese Maggi', 'Snacks', 100, 32, 'photo-1585032226651-759b368d7246', { unit: 'bowl', desc: 'Maggi loaded with cheese' }),
  item('Nachos with Salsa', 'Snacks', 150, 50, 'photo-1513456852971-30c0b8199d4d', { unit: 'plate', desc: 'Corn nachos, salsa & cheese dip' }),
  item('White Sauce Pasta', 'Snacks', 180, 60, 'photo-1621996346565-e3dbc646d9a9', { unit: 'plate', desc: 'Creamy Italian pasta' }),
  item('Margherita Pizza (7")', 'Snacks', 220, 80, 'photo-1513104890138-7c749659a591', { desc: 'Classic cheese and basil pizza',
    boq: boq(['Pizza Base', 1, 'pc'], ['Mozzarella', 80, 'g'], ['Pizza Sauce', 40, 'g'], ['Basil', 2, 'g']) }),
  item('Farmhouse Pizza (7")', 'Snacks', 260, 95, 'photo-1574071318508-1cdbab80d002', { desc: 'Loaded veggie pizza' }),

  // ================= DESSERTS (16) =================
  item('Chocolate Brownie', 'Desserts', 120, 40, 'photo-1606313564200-e75d5e30476c', { desc: 'Warm fudgy chocolate brownie',
    boq: boq(['Flour', 40, 'g'], ['Cocoa Powder', 15, 'g'], ['Butter', 30, 'g'], ['Sugar', 35, 'g'], ['Egg', 0.5, 'pc']) }),
  item('Chocolate Cake Slice', 'Desserts', 140, 45, 'photo-1578985545062-69928b1d9587', { unit: 'slice', desc: 'Rich layered chocolate cake' }),
  item('Blueberry Cheesecake', 'Desserts', 180, 65, 'photo-1533134242443-d4fd215305ad', { unit: 'slice', desc: 'Creamy baked cheesecake' }),
  item('Ice Cream Sundae', 'Desserts', 160, 55, 'photo-1563805042-7684c019e1cb', { unit: 'cup', desc: 'Loaded with nuts and chocolate sauce' }),
  item('Glazed Donut', 'Desserts', 80, 25, 'photo-1551024601-bec78aea704b', { desc: 'Soft donut with sweet glaze' }),
  item('Butter Croissant', 'Desserts', 100, 32, 'photo-1555507036-ab1f4038808a', { desc: 'Flaky French butter croissant',
    boq: boq(['Flour', 60, 'g'], ['Butter', 35, 'g'], ['Yeast', 2, 'g']) }),
  item('Choco Chip Muffin', 'Desserts', 90, 28, 'photo-1607958996333-41aef7caefaa', { desc: 'Soft muffin loaded with choco chips' }),
  item('Cookies (3 pc)', 'Desserts', 70, 20, 'photo-1499636136210-6f4ee915583e', { unit: 'plate', desc: 'Freshly baked crunchy cookies' }),
  item('Tiramisu', 'Desserts', 220, 80, 'photo-1571877227200-a0d98ea607e9', { unit: 'cup', desc: 'Coffee-soaked Italian classic' }),
  item('Choco Lava Cake', 'Desserts', 130, 42, 'photo-1624353365286-3f8d62daad51', { desc: 'Molten chocolate centre cake' }),
  item('Gulab Jamun (2 pc)', 'Desserts', 60, 18, 'photo-1601050690117-94f5f6fa8bd7', { unit: 'bowl', desc: 'Soft khoya dumplings in syrup' }),
  item('Rasmalai (2 pc)', 'Desserts', 90, 30, 'photo-1601050690117-94f5f6fa8bd7', { unit: 'bowl', desc: 'Saffron milk soaked chenna discs' }),
  item('Fruit Custard', 'Desserts', 110, 35, 'photo-1488477181946-6428a0291777', { unit: 'bowl', desc: 'Chilled custard with fresh fruit' }),
  item('Brownie Sundae', 'Desserts', 190, 65, 'photo-1541783245831-57d6fb0926d3', { unit: 'cup', desc: 'Brownie + ice cream + hot fudge' }),
  item('Belgian Waffle', 'Desserts', 170, 58, 'photo-1562376552-0d160a2f238d', { desc: 'Crisp waffle with maple & chocolate' }),
  item('Pancakes (3 pc)', 'Desserts', 160, 52, 'photo-1567620905732-2d1ec7ab7445', { unit: 'plate', desc: 'Fluffy pancakes with maple syrup' }),

  // ================= BEVERAGES (14) =================
  item('Fresh Orange Juice', 'Beverages', 120, 40, 'photo-1600271886742-f049cd451bba', { unit: 'glass', desc: 'Freshly squeezed oranges' }),
  item('Mango Smoothie', 'Beverages', 150, 50, 'photo-1546173159-315724a31696', { unit: 'glass', desc: 'Thick creamy mango smoothie' }),
  item('Oreo Shake', 'Beverages', 170, 55, 'photo-1572490122747-3968b75cc699', { unit: 'glass', desc: 'Chilled shake blended with Oreos' }),
  item('Fresh Lime Soda', 'Beverages', 80, 22, 'photo-1621263764928-df1444c5e859', { unit: 'glass', desc: 'Zesty lime with sparkling soda' }),
  item('Hot Chocolate', 'Beverages', 150, 50, 'photo-1517578239113-b03992dcdd25', { unit: 'cup', desc: 'Rich Belgian hot chocolate' }),
  item('Mineral Water', 'Beverages', 20, 12, 'photo-1548839140-29a749e1cf4d', { unit: 'bottle', stock: 300, gst: 0, desc: 'Packaged drinking water 1L', source: 'outsourced' }),
  item('Strawberry Shake', 'Beverages', 160, 52, 'photo-1579954115545-a95591f28bfc', { unit: 'glass', desc: 'Creamy shake with real strawberries' }),
  item('Chocolate Shake', 'Beverages', 160, 52, 'photo-1541658016709-82535e94bc69', { unit: 'glass', desc: 'Thick chocolate milkshake' }),
  item('KitKat Shake', 'Beverages', 180, 60, 'photo-1553787499-6f9133860278', { unit: 'glass', desc: 'Crunchy KitKat blended shake' }),
  item('Banana Smoothie', 'Beverages', 130, 42, 'photo-1553530666-ba11a7da3888', { unit: 'glass', desc: 'Banana, milk & honey blend' }),
  item('Mixed Berry Smoothie', 'Beverages', 170, 58, 'photo-1502741224143-90386d7f8c82', { unit: 'glass', desc: 'Strawberry, blueberry & yogurt' }),
  item('Watermelon Juice', 'Beverages', 100, 30, 'photo-1587049352846-4a222e784d38', { unit: 'glass', desc: 'Cooling fresh watermelon' }),
  item('Pineapple Juice', 'Beverages', 110, 35, 'photo-1550258987-190a2d41a8ba', { unit: 'glass', desc: 'Tangy fresh pineapple' }),
  item('Virgin Mojito', 'Beverages', 140, 45, 'photo-1551538827-9c037cb4f32a', { unit: 'glass', desc: 'Mint, lime & crushed ice' }),

  // ================= BAKERY (13) =================
  item('Veg Puff', 'Bakery', 35, 10, 'photo-1509365465985-25d11c17e812', { stock: 120, desc: 'Flaky puff with spiced veg filling' }),
  item('Paneer Puff', 'Bakery', 45, 14, 'photo-1620921575116-fb8902865f81', { stock: 120, desc: 'Puff pastry with paneer masala' }),
  item('Egg Puff', 'Bakery', 40, 12, 'photo-1608039829572-78524f79c4c7', { stock: 100, desc: 'Bakery classic with boiled egg' }),
  item('Khari (200g)', 'Bakery', 60, 20, 'photo-1509440159596-0249088772ff', { unit: 'pack', stock: 80, desc: 'Crispy flaky puff biscuits', source: 'outsourced' }),
  item('Rusk Toast (300g)', 'Bakery', 70, 24, 'photo-1590080875515-8a3a8dc5735e', { unit: 'pack', stock: 80, desc: 'Crunchy tea-time rusk', source: 'outsourced' }),
  item('Chocolate Croissant', 'Bakery', 130, 42, 'photo-1530610476181-d83430b64dcd', { desc: 'Croissant with dark chocolate' }),
  item('Almond Croissant', 'Bakery', 150, 50, 'photo-1555507036-ab1f4038808a', { desc: 'Frangipane filled, flaked almonds' }),
  item('Chocolate Donut', 'Bakery', 90, 28, 'photo-1527515637462-cff94eecc1ac', { desc: 'Donut dipped in chocolate' }),
  item('Strawberry Donut', 'Bakery', 90, 28, 'photo-1533910534207-90f31029a78e', { desc: 'Strawberry glaze with sprinkles' }),
  item('Cinnamon Sugar Donut', 'Bakery', 85, 26, 'photo-1626094309830-abbb0c99da4a', { desc: 'Warm donut rolled in cinnamon sugar' }),
  item('Blueberry Muffin', 'Bakery', 100, 32, 'photo-1587668178277-295251f900ce', { desc: 'Bursting with blueberries' }),
  item('Banana Walnut Muffin', 'Bakery', 100, 32, 'photo-1558401391-7899b4bd5bbf', { desc: 'Moist banana muffin with walnuts' }),
  item('Cinnamon Roll', 'Bakery', 120, 40, 'photo-1509365390695-33aee754301f', { desc: 'Gooey roll with cream cheese glaze' }),

  // ================= BREADS (7) =================
  item('White Bread Loaf', 'Breads', 45, 22, 'photo-1509440159596-0249088772ff', { unit: 'loaf', stock: 60, gst: 0, desc: 'Soft daily sandwich bread 400g',
    boq: boq(['Flour', 250, 'g'], ['Yeast', 4, 'g'], ['Milk', 50, 'ml'], ['Butter', 10, 'g'], ['Sugar', 8, 'g']) }),
  item('Whole Wheat Bread', 'Breads', 55, 28, 'photo-1598373182133-52452f7691ef', { unit: 'loaf', stock: 60, gst: 0, desc: '100% atta bread 400g' }),
  item('Multigrain Loaf', 'Breads', 70, 35, 'photo-1586444248902-2f64eddc13df', { unit: 'loaf', stock: 50, gst: 0, desc: 'Seven-grain healthy loaf' }),
  item('Milk Bread', 'Breads', 50, 25, 'photo-1549931319-a545dcf3bc73', { unit: 'loaf', stock: 50, gst: 0, desc: 'Extra soft milk loaf' }),
  item('French Baguette', 'Breads', 90, 40, 'photo-1568471173242-461f0a730452', { stock: 40, gst: 0, desc: 'Crusty artisan baguette' }),
  item('Pav Buns (6 pc)', 'Breads', 40, 18, 'photo-1568051243851-f9b136146e97', { unit: 'pack', stock: 80, gst: 0, desc: 'Soft ladi pav' }),
  item('Burger Buns (4 pc)', 'Breads', 50, 22, 'photo-1590301157890-4810ed352733', { unit: 'pack', stock: 60, gst: 0, desc: 'Sesame topped burger buns' }),

  // ================= CAKES & PASTRIES (8) =================
  item('Black Forest Cake (500g)', 'Cakes & Pastries', 450, 180, 'photo-1606890737304-57a1ca8a5b62', { unit: 'cake', stock: 25, desc: 'Cherry topped classic' }),
  item('Pineapple Cake (500g)', 'Cakes & Pastries', 400, 160, 'photo-1524351199678-941a58a3df50', { unit: 'cake', stock: 25, desc: 'Fresh cream pineapple cake' }),
  item('Red Velvet Cake (500g)', 'Cakes & Pastries', 550, 220, 'photo-1586788680434-30d324b2d46f', { unit: 'cake', stock: 20, desc: 'Cream cheese frosted red velvet' }),
  item('Chocolate Truffle Cake (500g)', 'Cakes & Pastries', 550, 220, 'photo-1602351447937-745cb720612f', { unit: 'cake', stock: 20, desc: 'Dark chocolate ganache cake' }),
  item('Black Forest Pastry', 'Cakes & Pastries', 90, 30, 'photo-1551024506-0bccd828d307', { desc: 'Single serve black forest',
    boq: boq(['Chocolate Sponge', 1, 'pc'], ['Whipped Cream', 40, 'g'], ['Cherries', 15, 'g'], ['Chocolate Shavings', 10, 'g']) }),
  item('Pineapple Pastry', 'Cakes & Pastries', 80, 26, 'photo-1464305795204-6f5bbfc7fb81', { desc: 'Single serve pineapple cream' }),
  item('Butterscotch Pastry', 'Cakes & Pastries', 90, 30, 'photo-1488900128323-21503983a07e', { desc: 'Crunchy praline butterscotch' }),
  item('Chocolate Eclair', 'Cakes & Pastries', 110, 36, 'photo-1612201142855-7873bc1661b4', { desc: 'Choux pastry with chocolate' }),

  // ================= COOKIES & BISCUITS (5) =================
  item('Butter Cookies (250g)', 'Cookies & Biscuits', 120, 48, 'photo-1558961363-fa8fdf82db35', { unit: 'pack', stock: 60, desc: 'Melt-in-mouth butter cookies' }),
  item('Oatmeal Raisin Cookies (250g)', 'Cookies & Biscuits', 140, 56, 'photo-1490567674331-72de84794694', { unit: 'pack', stock: 50, desc: 'Chewy oats & raisin cookies' }),
  item('Coconut Cookies (250g)', 'Cookies & Biscuits', 110, 44, 'photo-1499636136210-6f4ee915583e', { unit: 'pack', stock: 60, desc: 'Crisp coconut crunch' }),
  item('Almond Biscotti (200g)', 'Cookies & Biscuits', 160, 64, 'photo-1481391319762-47dff72954d9', { unit: 'pack', stock: 40, desc: 'Twice-baked Italian biscotti', source: 'outsourced' }),
  item('Jeera Biscuits (250g)', 'Cookies & Biscuits', 90, 36, 'photo-1590080962330-747c6aba8028', { unit: 'pack', stock: 60, desc: 'Sweet & salty cumin biscuits', source: 'outsourced' })
];

const seed = async () => {
  try {
    await sequelize.authenticate();
    await sequelize.sync({ alter: true });
    console.log('✅ Database connected & synced');
    console.log(`ℹ️ Menu size: ${MENU.length} items`);

    // Admin user
    const [admin, created] = await User.findOrCreate({
      where: { email: 'admin@cafe.com' },
      defaults: { name: 'Cafe Admin', email: 'admin@cafe.com', phone: '9876543210', password: 'admin123', role: 'admin', activeShop: 'grocery' }
    });
    console.log(created ? '✅ Admin created (admin@cafe.com / admin123)' : 'ℹ️ Admin already exists');

    // Menu items
    let added = 0, updated = 0;
    for (const it of MENU) {
      const existing = await GroceryProduct.findOne({ where: { name: it.name, createdBy: admin.id } });
      if (existing) {
        const upd = { image: it.image, category: it.category, description: it.description, isActive: true, sourceType: it.sourceType };
        if (it.boq) upd.boq = it.boq; // don't wipe manually entered BOQs
        await existing.update(upd);
        updated++;
      } else {
        await GroceryProduct.create({ ...it, minStock: 10, createdBy: admin.id });
        added++;
      }
    }
    console.log(`✅ Menu: ${added} items added, ${updated} refreshed`);

    // Sample customers
    const customers = [
      { name: 'Walk-in Regular', phone: '9000000001', email: 'regular@example.com' },
      { name: 'Priya Sharma', phone: '9812345678', email: 'priya@example.com' },
      { name: 'Rahul Verma', phone: '9823456789', email: 'rahul@example.com' }
    ];
    for (const c of customers) {
      await Customer.findOrCreate({
        where: { phone: c.phone, createdBy: admin.id },
        defaults: { ...c, createdBy: admin.id }
      });
    }
    console.log('✅ Sample customers ready');

    // Sample staff
    const staff = [
      { name: 'Arun Kumar', role: 'Barista', phone: '9700000001', defaultShift: 'morning', monthlySalary: 18000, joinDate: '2025-01-15' },
      { name: 'Sneha Patel', role: 'Baker', phone: '9700000002', defaultShift: 'morning', monthlySalary: 22000, joinDate: '2024-11-01' },
      { name: 'Vikram Singh', role: 'Cashier', phone: '9700000003', defaultShift: 'evening', monthlySalary: 16000, joinDate: '2025-03-10' },
      { name: 'Meera Nair', role: 'Waiter', phone: '9700000004', defaultShift: 'evening', monthlySalary: 14000, joinDate: '2025-02-20' },
      { name: 'Rohit Sharma', role: 'Manager', phone: '9700000005', defaultShift: 'both', monthlySalary: 32000, joinDate: '2024-08-05' }
    ];
    for (const s of staff) {
      await Staff.findOrCreate({
        where: { phone: s.phone, createdBy: admin.id },
        defaults: { ...s, createdBy: admin.id }
      });
    }
    console.log('✅ Sample staff ready');

    console.log('🎉 Café & bakery seed complete');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  }
};

seed();
