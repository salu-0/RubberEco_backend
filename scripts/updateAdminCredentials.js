const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

// Database connection
const connectDB = async () => {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/RubberEco', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ MongoDB Connected to RubberEco database');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

const updateAdminCredentials = async () => {
  try {
    console.log('🔧 Updating admin credentials...');

    // New admin credentials
    const newAdminEmail = 'admin@gmail.com';
    const newAdminPassword = 'admin@47';

    // Hash the new password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(newAdminPassword, saltRounds);

    // Check if admin user already exists with new email
    let adminUser = await User.findOne({ email: newAdminEmail });
    
    if (adminUser) {
      console.log('📝 Admin user with new email already exists. Updating password...');
      
      // Update existing admin user
      adminUser.password = hashedPassword;
      adminUser.role = 'admin';
      adminUser.isVerified = true;
      await adminUser.save();
      
      console.log('✅ Updated existing admin user');
    } else {
      console.log('👤 Creating new admin user...');
      
      // Create new admin user
      adminUser = new User({
        name: 'System Administrator',
        email: newAdminEmail,
        password: hashedPassword,
        role: 'admin',
        isVerified: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      await adminUser.save();
      console.log('✅ Created new admin user');
    }

    // Check for old admin users and update their role to farmer (optional cleanup)
    const oldAdminEmails = [
      'salumanoj2026@mca.ajce.in',
      'admin@rubbereco.com'
    ];

    for (const oldEmail of oldAdminEmails) {
      const oldAdmin = await User.findOne({ email: oldEmail });
      if (oldAdmin && oldAdmin.role === 'admin' && oldEmail !== newAdminEmail) {
        console.log(`🔄 Found old admin user: ${oldEmail}. Converting to farmer role...`);
        oldAdmin.role = 'farmer';
        await oldAdmin.save();
        console.log(`✅ Converted ${oldEmail} from admin to farmer`);
      }
    }

    console.log('\n🎉 Admin credentials update completed successfully!');
    console.log('\n📋 New Admin Login Credentials:');
    console.log(`   Email: ${newAdminEmail}`);
    console.log(`   Password: ${newAdminPassword}`);
    console.log(`   Role: admin`);
    console.log('\n🚀 You can now login with these new credentials!');

  } catch (error) {
    console.error('❌ Error updating admin credentials:', error);
  }
};

const main = async () => {
  await connectDB();
  await updateAdminCredentials();
  await mongoose.connection.close();
  console.log('🔌 Database connection closed');
  process.exit(0);
};

// Run the script
main().catch(console.error);
