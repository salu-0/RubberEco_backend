const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Staff = require('../models/Staff');

// MongoDB connection
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/RubberEco', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ MongoDB connected successfully');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

const createTrainers = async () => {
  try {
    console.log('🎯 Creating sample trainers...');

    // Check if trainers already exist
    const existingTrainers = await Staff.find({ role: 'trainer' });
    if (existingTrainers.length > 0) {
      console.log(`📚 Found ${existingTrainers.length} existing trainers. Skipping creation.`);
      return;
    }

    // Hash password for all trainers
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash('trainer123', saltRounds);

    const trainers = [
      {
        name: 'Dr. Sarah Johnson',
        email: 'sarah.johnson@rubbereco.com',
        password: hashedPassword,
        phone: '+91 98765 43210',
        role: 'trainer',
        department: 'Training & Development',
        location: 'Kottayam District, Kerala',
        status: 'active',
        performance_rating: 4.8,
        tasks_completed: 45,
        tasks_assigned: 50,
        salary: 65000,
        address: {
          street: '123 Training Center Road',
          city: 'Kottayam',
          state: 'Kerala',
          pincode: '686001'
        },
        emergency_contact: {
          name: 'John Johnson',
          phone: '+91 98765 43211',
          relationship: 'Spouse'
        },
        skills: ['Rubber Plantation Management', 'Training Delivery', 'Curriculum Development'],
        notes: 'Expert trainer with 15+ years experience in rubber plantation management',
        last_active: new Date()
      },
      {
        name: 'Prof. Rajesh Kumar',
        email: 'rajesh.kumar@rubbereco.com',
        password: hashedPassword,
        phone: '+91 87654 32109',
        role: 'trainer',
        department: 'Field Training',
        location: 'Thrissur District, Kerala',
        status: 'active',
        performance_rating: 4.9,
        tasks_completed: 38,
        tasks_assigned: 40,
        salary: 58000,
        address: {
          street: '456 Field Training Center',
          city: 'Thrissur',
          state: 'Kerala',
          pincode: '680001'
        },
        emergency_contact: {
          name: 'Priya Kumar',
          phone: '+91 87654 32110',
          relationship: 'Spouse'
        },
        skills: ['Advanced Tapping Techniques', 'Quality Control', 'Field Operations'],
        notes: 'Specialist in sustainable rubber farming techniques and field training',
        last_active: new Date()
      },
      {
        name: 'Ms. Priya Nair',
        email: 'priya.nair@rubbereco.com',
        password: hashedPassword,
        phone: '+91 76543 21098',
        role: 'trainer',
        department: 'Technical Training',
        location: 'Ernakulam District, Kerala',
        status: 'active',
        performance_rating: 4.7,
        tasks_completed: 28,
        tasks_assigned: 35,
        salary: 52000,
        address: {
          street: '789 Technical Institute Lane',
          city: 'Ernakulam',
          state: 'Kerala',
          pincode: '682001'
        },
        emergency_contact: {
          name: 'Ravi Nair',
          phone: '+91 76543 21099',
          relationship: 'Father'
        },
        skills: ['Modern Plantation Techniques', 'Technology Integration', 'Digital Training'],
        notes: 'Young and dynamic trainer specializing in modern plantation techniques',
        last_active: new Date()
      },
      {
        name: 'Mr. Arun Menon',
        email: 'arun.menon@rubbereco.com',
        password: hashedPassword,
        phone: '+91 65432 10987',
        role: 'trainer',
        department: 'Safety Training',
        location: 'Kollam District, Kerala',
        status: 'active',
        performance_rating: 4.6,
        tasks_completed: 32,
        tasks_assigned: 40,
        salary: 55000,
        address: {
          street: '321 Safety Training Complex',
          city: 'Kollam',
          state: 'Kerala',
          pincode: '691001'
        },
        emergency_contact: {
          name: 'Suma Menon',
          phone: '+91 65432 10988',
          relationship: 'Spouse'
        },
        skills: ['Safety Protocols', 'Risk Management', 'Emergency Response'],
        notes: 'Safety expert with focus on plantation worker safety and risk management',
        last_active: new Date()
      },
      {
        name: 'Dr. Lakshmi Pillai',
        email: 'lakshmi.pillai@rubbereco.com',
        password: hashedPassword,
        phone: '+91 54321 09876',
        role: 'trainer',
        department: 'Research & Training',
        location: 'Palakkad District, Kerala',
        status: 'active',
        performance_rating: 4.9,
        tasks_completed: 42,
        tasks_assigned: 45,
        salary: 70000,
        address: {
          street: '567 Research Center Road',
          city: 'Palakkad',
          state: 'Kerala',
          pincode: '678001'
        },
        emergency_contact: {
          name: 'Suresh Pillai',
          phone: '+91 54321 09877',
          relationship: 'Spouse'
        },
        skills: ['Research Methodology', 'Data Analysis', 'Advanced Training Techniques'],
        notes: 'Senior researcher and trainer with PhD in Agricultural Sciences',
        last_active: new Date()
      }
    ];

    // Create trainers
    const createdTrainers = await Staff.insertMany(trainers);
    console.log(`✅ Successfully created ${createdTrainers.length} trainers:`);
    
    createdTrainers.forEach((trainer, index) => {
      console.log(`   ${index + 1}. ${trainer.name} (${trainer.email}) - ${trainer.department}`);
    });

    console.log('\n📚 Trainer creation completed successfully!');
    console.log('🔑 Default password for all trainers: trainer123');
    console.log('📧 You can now log in with any trainer email and the default password');

  } catch (error) {
    console.error('❌ Error creating trainers:', error);
  }
};

const main = async () => {
  await connectDB();
  await createTrainers();
  await mongoose.connection.close();
  console.log('🔌 Database connection closed');
  process.exit(0);
};

// Run the script
if (require.main === module) {
  main();
}

module.exports = { createTrainers };
