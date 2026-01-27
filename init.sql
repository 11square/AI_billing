-- Initialize billing database
USE billing_db;

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    phone VARCHAR(20),
    password VARCHAR(255) NOT NULL,
    role ENUM('admin', 'manager', 'cashier') DEFAULT 'cashier',
    active_shop ENUM('grocery', 'fertilizer') DEFAULT 'grocery',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Customers table
CREATE TABLE IF NOT EXISTS customers (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(100),
    address TEXT,
    gstin VARCHAR(20),
    total_purchases DECIMAL(12,2) DEFAULT 0,
    total_credit DECIMAL(12,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Farmer details for fertilizer shop customers
CREATE TABLE IF NOT EXISTS farmer_details (
    id INT PRIMARY KEY AUTO_INCREMENT,
    customer_id INT UNIQUE,
    farm_size VARCHAR(50),
    village VARCHAR(100),
    soil_type VARCHAR(50),
    irrigation_type VARCHAR(50),
    crops JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

-- Grocery products table
CREATE TABLE IF NOT EXISTS grocery_products (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(200) NOT NULL,
    barcode VARCHAR(50) UNIQUE,
    brand VARCHAR(100),
    category VARCHAR(50) NOT NULL,
    description TEXT,
    unit VARCHAR(20) DEFAULT 'piece',
    mrp DECIMAL(10,2) NOT NULL,
    selling_price DECIMAL(10,2) NOT NULL,
    purchase_price DECIMAL(10,2) NOT NULL,
    gst_rate DECIMAL(5,2) DEFAULT 5,
    hsn_code VARCHAR(20),
    stock INT DEFAULT 0,
    min_stock INT DEFAULT 10,
    expiry_date DATE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Fertilizer products table
CREATE TABLE IF NOT EXISTS fertilizer_products (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(200) NOT NULL,
    barcode VARCHAR(50) UNIQUE,
    brand VARCHAR(100),
    category VARCHAR(50) NOT NULL,
    description TEXT,
    composition_n VARCHAR(10),
    composition_p VARCHAR(10),
    composition_k VARCHAR(10),
    active_ingredient VARCHAR(200),
    concentration VARCHAR(50),
    dosage TEXT,
    safety_precautions TEXT,
    storage_conditions VARCHAR(200),
    target_crops JSON,
    unit VARCHAR(20) DEFAULT 'kg',
    mrp DECIMAL(10,2) NOT NULL,
    selling_price DECIMAL(10,2) NOT NULL,
    purchase_price DECIMAL(10,2) NOT NULL,
    gst_rate DECIMAL(5,2) DEFAULT 5,
    hsn_code VARCHAR(20),
    stock INT DEFAULT 0,
    min_stock INT DEFAULT 5,
    batch_number VARCHAR(50),
    manufacturing_date DATE,
    expiry_date DATE,
    hazard_level ENUM('low', 'medium', 'high', 'extreme') DEFAULT 'low',
    license_required BOOLEAN DEFAULT FALSE,
    registration_number VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Invoices table
CREATE TABLE IF NOT EXISTS invoices (
    id INT PRIMARY KEY AUTO_INCREMENT,
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    shop_type ENUM('grocery', 'fertilizer') NOT NULL,
    customer_id INT,
    customer_name VARCHAR(100),
    customer_phone VARCHAR(20),
    sub_total DECIMAL(12,2) NOT NULL,
    discount DECIMAL(10,2) DEFAULT 0,
    gst_amount DECIMAL(10,2) DEFAULT 0,
    grand_total DECIMAL(12,2) NOT NULL,
    paid_amount DECIMAL(12,2) DEFAULT 0,
    payment_status ENUM('paid', 'partial', 'unpaid') DEFAULT 'unpaid',
    notes TEXT,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Invoice items table
CREATE TABLE IF NOT EXISTS invoice_items (
    id INT PRIMARY KEY AUTO_INCREMENT,
    invoice_id INT NOT NULL,
    product_type ENUM('grocery', 'fertilizer') NOT NULL,
    product_id INT NOT NULL,
    product_name VARCHAR(200) NOT NULL,
    quantity INT NOT NULL,
    unit VARCHAR(20),
    unit_price DECIMAL(10,2) NOT NULL,
    gst_rate DECIMAL(5,2) DEFAULT 0,
    gst_amount DECIMAL(10,2) DEFAULT 0,
    total_price DECIMAL(12,2) NOT NULL,
    FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
);

-- Payments table
CREATE TABLE IF NOT EXISTS payments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    invoice_id INT NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    method ENUM('cash', 'card', 'upi', 'credit') NOT NULL,
    reference_number VARCHAR(100),
    payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
);

-- Vendors table
CREATE TABLE IF NOT EXISTS vendors (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(100),
    address TEXT,
    gstin VARCHAR(20),
    shop_type ENUM('grocery', 'fertilizer') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Purchases table
CREATE TABLE IF NOT EXISTS purchases (
    id INT PRIMARY KEY AUTO_INCREMENT,
    vendor_id INT,
    vendor_name VARCHAR(100) NOT NULL,
    invoice_no VARCHAR(50),
    vendor_bill_no VARCHAR(50),
    bill_date DATE NOT NULL,
    payment_mode ENUM('cash', 'online', 'credit', 'split') DEFAULT 'cash',
    payment_date DATE,
    total_amount DECIMAL(12,2) NOT NULL,
    total_tax DECIMAL(10,2) DEFAULT 0,
    discount DECIMAL(10,2) DEFAULT 0,
    grand_total DECIMAL(12,2) NOT NULL,
    status ENUM('pending', 'paid', 'partial') DEFAULT 'pending',
    shop_type ENUM('grocery', 'fertilizer') NOT NULL,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Purchase items table
CREATE TABLE IF NOT EXISTS purchase_items (
    id INT PRIMARY KEY AUTO_INCREMENT,
    purchase_id INT NOT NULL,
    product_id INT,
    product_type ENUM('grocery', 'fertilizer'),
    name VARCHAR(200) NOT NULL,
    category VARCHAR(50),
    unit VARCHAR(20),
    quantity INT NOT NULL,
    cost DECIMAL(10,2) NOT NULL,
    selling_price DECIMAL(10,2),
    mrp DECIMAL(10,2),
    tax DECIMAL(10,2) DEFAULT 0,
    total_cost DECIMAL(12,2) NOT NULL,
    FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE
);

-- Insert default admin user (password: admin123)
INSERT INTO users (name, email, phone, password, role) VALUES 
('Admin', 'admin@billing.com', '9999999999', '$2a$10$xVWsKxT5xK5xK5xK5xK5xOxK5xK5xK5xK5xK5xK5xK5xK5xK5xK5x', 'admin')
ON DUPLICATE KEY UPDATE name=name;

-- Insert sample grocery products
INSERT INTO grocery_products (name, category, unit, mrp, selling_price, purchase_price, stock, min_stock) VALUES
('Amul Milk 500ml', 'dairy', 'packet', 30, 28, 25, 100, 20),
('Aashirvaad Atta 5kg', 'grains', 'packet', 280, 270, 240, 50, 10),
('Tata Salt 1kg', 'spices', 'packet', 28, 25, 20, 80, 15),
('Fortune Sunflower Oil 1L', 'oils', 'bottle', 180, 170, 150, 40, 10),
('Parle-G Biscuits', 'snacks', 'packet', 10, 10, 8, 200, 50),
('Maggi Noodles', 'instant_food', 'packet', 14, 14, 11, 150, 30),
('Coca Cola 750ml', 'beverages', 'bottle', 45, 42, 35, 100, 20),
('Tomato 1kg', 'vegetables', 'kg', 40, 40, 30, 50, 10),
('Apple 1kg', 'fruits', 'kg', 180, 180, 150, 30, 10),
('Amul Butter 100g', 'dairy', 'packet', 56, 54, 48, 60, 15)
ON DUPLICATE KEY UPDATE name=name;

-- Insert sample fertilizer products
INSERT INTO fertilizer_products (name, category, unit, mrp, selling_price, purchase_price, stock, min_stock, composition_n, composition_p, composition_k, hazard_level) VALUES
('Urea 50kg', 'nitrogen_fertilizers', 'bag', 450, 430, 380, 100, 20, '46', '0', '0', 'low'),
('DAP 50kg', 'complex_fertilizers', 'bag', 1350, 1300, 1150, 80, 15, '18', '46', '0', 'low'),
('MOP 50kg', 'potash_fertilizers', 'bag', 900, 870, 780, 60, 10, '0', '0', '60', 'low'),
('NPK 10:26:26', 'complex_fertilizers', 'bag', 1200, 1150, 1020, 70, 15, '10', '26', '26', 'low'),
('Imidacloprid 17.8% SL', 'insecticides', 'liter', 850, 820, 720, 40, 10, NULL, NULL, NULL, 'medium'),
('Glyphosate 41% SL', 'herbicides', 'liter', 550, 530, 460, 35, 8, NULL, NULL, NULL, 'high'),
('Mancozeb 75% WP', 'fungicides', 'kg', 480, 460, 400, 45, 10, NULL, NULL, NULL, 'medium'),
('Tomato Seeds Hybrid', 'seeds', 'packet', 120, 110, 85, 100, 20, NULL, NULL, NULL, 'low'),
('Drip Irrigation Kit', 'irrigation', 'set', 2500, 2400, 2100, 15, 5, NULL, NULL, NULL, 'low'),
('Sprayer 16L', 'farm_tools', 'piece', 1800, 1750, 1550, 20, 5, NULL, NULL, NULL, 'low')
ON DUPLICATE KEY UPDATE name=name;
