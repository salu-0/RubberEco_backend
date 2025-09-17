const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Staff = require('../models/Staff');
require('dotenv').config();

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ MongoDB Connected');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

// Create a test staff user
const createStaffUser = async () => {
  try {
    // Check if staff user already exists
    const existingStaff = await Staff.findOne({ email: 'staff@rubbereco.com' });
    if (existingStaff) {
      console.log('✅ Staff user already exists:', existingStaff.email);
      return;
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash('staff123', saltRounds);

    // Create staff user
    const staffUser = new Staff({
      name: 'Ravi Kumar',
      email: 'staff@rubbereco.com',
      password: hashedPassword,
      phone: '+91 9876543210',
      role: 'field_officer',
      department: 'Field Operations',
      location: 'Kottayam District - Blocks A, B, C',
      status: 'active',
      performance_rating: 4.8,
      tasks_completed: 127,
      tasks_assigned: 150,
      salary: 35000,
      address: {
        street: '123 Rubber Estate Road',
        city: 'Kottayam',
        state: 'Kerala',
        pincode: '686001'
      },
      emergency_contact: {
        name: 'Priya Kumar',
        phone: '+91 9876543211',
        relationship: 'Spouse'
      },
      skills: ['Latex Collection', 'Quality Assessment', 'Team Management', 'Field Operations'],
      certifications: [
        {
          name: 'Rubber Plantation Management',
          issued_date: new Date('2021-06-15'),
          expiry_date: new Date('2024-06-15'),
          issuer: 'Kerala Agricultural University'
        }
      ],
      notes: 'Experienced field officer with excellent performance record'
    });

    await staffUser.save();
    console.log('✅ Staff user created successfully:');
    console.log('📧 Email: staff@rubbereco.com');
    console.log('🔑 Password: staff123');
    console.log('👤 Role: staff (field_officer)');
    console.log('📍 Location:', staffUser.location);

  } catch (error) {
    console.error('❌ Error creating staff user:', error);
  }
};

// Create additional staff members
const createAdditionalStaff = async () => {
  try {
    const additionalStaff = [
      {
        name: 'Deepak Singh',
        email: 'deepak@rubbereco.com',
        password: await bcrypt.hash('deepak123', 12),
        phone: '+91 9876543212',
        role: 'tapper',
        department: 'Production',
        location: 'Kottayam District - Block D',
        status: 'active',
        performance_rating: 4.2,
        tasks_completed: 89,
        tasks_assigned: 95,
        salary: 25000
      },
      {
        name: 'Maya Pillai',
        email: 'maya@rubbereco.com',
        password: await bcrypt.hash('maya123', 12),
        phone: '+91 9876543213',
        role: 'supervisor',
        department: 'Quality Control',
        location: 'Kottayam District - Blocks E, F',
        status: 'active',
        performance_rating: 4.6,
        tasks_completed: 156,
        tasks_assigned: 170,
        salary: 40000
      }
    ];

    for (const staffData of additionalStaff) {
      const existingStaff = await Staff.findOne({ email: staffData.email });
      if (!existingStaff) {
        const staff = new Staff(staffData);
        await staff.save();
        console.log(`✅ Created staff: ${staffData.name} (${staffData.email})`);
      } else {
        console.log(`✅ Staff already exists: ${staffData.email}`);
      }
    }

  } catch (error) {
    console.error('❌ Error creating additional staff:', error);
  }
};

// Main function
const main = async () => {
  await connectDB();
  await createStaffUser();
  await createAdditionalStaff();
  
  console.log('\n🎉 Staff users setup complete!');
  console.log('\n📋 Test Credentials:');
  console.log('1. Email: staff@rubbereco.com | Password: staff123 | Role: Field Officer');
  console.log('2. Email: deepak@rubbereco.com | Password: deepak123 | Role: Tapper');
  console.log('3. Email: maya@rubbereco.com | Password: maya123 | Role: Supervisor');
  console.log('\n🚀 You can now test staff login with these credentials!');
  
  mongoose.connection.close();
};

// Run the script
main().catch(console.error);
