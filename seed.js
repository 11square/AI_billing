const sequelize = require('./config/database');
const User = require('./models/User');

const seedUser = async () => {
    try {
        await sequelize.authenticate();
        console.log('✅ Connected to database');

        // Check if admin user exists
        const adminEmail = 'admin@billing.com';
        const existingUser = await User.findOne({ where: { email: adminEmail } });

        if (existingUser) {
            console.log('ℹ️ Admin user already exists. Updating password...');
            existingUser.password = 'admin123';
            await existingUser.save();
            console.log('✅ Admin password updated to admin123');
        } else {
            console.log('Creating admin user...');
            await User.create({
                name: 'Admin',
                email: adminEmail,
                phone: '9999999999',
                password: 'admin123', // Will be hashed by beforeCreate hook
                role: 'admin',
                activeShop: 'grocery'
            });
            console.log('✅ Admin user created successfully');
        }
    } catch (error) {
        console.error('❌ Error seeding user:', error);
    } finally {
        await sequelize.close();
        process.exit();
    }
};

seedUser();
