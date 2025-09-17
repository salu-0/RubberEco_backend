const mongoose = require('mongoose');
const PracticalTraining = require('../models/PracticalTraining');
const Staff = require('../models/Staff');
require('dotenv').config();

// Connect to MongoDB
const connectDB = async () => {
  try {
    // Use the same database name as in the connection string (RubberEco with capital R)
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/RubberEco';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

// Sample training data matching the courses in the image
const sampleTrainings = [
  {
    sessionId: 'RT_ADV_001',
    title: 'Advanced Rubber Tapping Techniques',
    description: 'Learn professional rubber tapping methods with hands-on practice in real plantation environments.',
    category: 'rubber_tapping',
    level: 'Advanced',
    instructor: {
      name: 'Dr. Rajesh Kumar',
      specialization: 'Rubber Tapping Expert',
      experience: 15
    },
    schedule: {
      startDate: new Date('2025-09-15'),
      endDate: new Date('2025-09-20'),
      duration: 40,
      timeSlots: [
        { day: 'Monday', startTime: '09:00', endTime: '17:00' },
        { day: 'Tuesday', startTime: '09:00', endTime: '17:00' },
        { day: 'Wednesday', startTime: '09:00', endTime: '17:00' },
        { day: 'Thursday', startTime: '09:00', endTime: '17:00' },
        { day: 'Friday', startTime: '09:00', endTime: '17:00' }
      ],
      totalSessions: 5
    },
    location: {
      type: 'field_location',
      address: 'Rubber Research Institute, Kottayam, Kerala',
      coordinates: { latitude: 9.5915, longitude: 76.5222 },
      facilities: ['equipment_storage', 'first_aid', 'restroom'],
      capacity: 8
    },
    enrollment: {
      maxParticipants: 8,
      currentEnrollments: 0,
      registrationDeadline: new Date('2025-09-10'),
      fee: 5000,
      includesEquipment: true,
      includesMaterials: true,
      includesRefreshments: true
    },
    status: 'registration_open',
    curriculum: [
      {
        sessionNumber: 1,
        topic: 'Advanced Tapping Panel Management',
        objectives: ['Master panel opening techniques', 'Optimize yield extraction'],
        activities: ['demonstration', 'hands_on_practice'],
        duration: 480,
        materials: ['Tapping knives', 'Collection cups', 'Measuring tools']
      }
    ],
    prerequisites: {
      experienceLevel: 'intermediate',
      requiredModules: []
    }
  },
  {
    sessionId: 'PM_BEG_001',
    title: 'Beginner Rubber Plantation Management',
    description: 'Complete introduction to rubber plantation management for new farmers.',
    category: 'plantation_management',
    level: 'Beginner',
    instructor: {
      name: 'Prof. Meera Nair',
      specialization: 'Plantation Management',
      experience: 12
    },
    schedule: {
      startDate: new Date('2025-09-22'),
      endDate: new Date('2025-09-24'),
      duration: 24,
      timeSlots: [
        { day: 'Sunday', startTime: '09:00', endTime: '17:00' },
        { day: 'Monday', startTime: '09:00', endTime: '17:00' },
        { day: 'Tuesday', startTime: '09:00', endTime: '17:00' }
      ],
      totalSessions: 3
    },
    location: {
      type: 'training_center',
      address: 'Agricultural Training Center, Thrissur, Kerala',
      coordinates: { latitude: 10.5276, longitude: 76.2144 },
      facilities: ['parking', 'restroom', 'cafeteria'],
      capacity: 22
    },
    enrollment: {
      maxParticipants: 22,
      currentEnrollments: 0,
      registrationDeadline: new Date('2025-09-18'),
      fee: 3000,
      includesEquipment: false,
      includesMaterials: true,
      includesRefreshments: true
    },
    status: 'registration_open',
    curriculum: [
      {
        sessionNumber: 1,
        topic: 'Plantation Planning and Setup',
        objectives: ['Site selection', 'Soil preparation', 'Planting techniques'],
        activities: ['demonstration', 'group_exercise'],
        duration: 480,
        materials: ['Handouts', 'Soil samples', 'Planning tools']
      }
    ],
    prerequisites: {
      experienceLevel: 'none',
      requiredModules: []
    }
  },
  {
    sessionId: 'DP_INT_001',
    title: 'Disease Prevention & Treatment Workshop',
    description: 'Comprehensive training on identifying and treating common rubber tree diseases.',
    category: 'disease_control',
    level: 'Intermediate',
    instructor: {
      name: 'Dr. Suresh Babu',
      specialization: 'Plant Pathology',
      experience: 18
    },
    schedule: {
      startDate: new Date('2025-10-05'),
      endDate: new Date('2025-10-06'),
      duration: 16,
      timeSlots: [
        { day: 'Sunday', startTime: '09:00', endTime: '17:00' },
        { day: 'Monday', startTime: '09:00', endTime: '17:00' }
      ],
      totalSessions: 2
    },
    location: {
      type: 'training_center',
      address: 'Rubber Board Research Station, Kottayam, Kerala',
      coordinates: { latitude: 9.5915, longitude: 76.5222 },
      facilities: ['equipment_storage', 'first_aid', 'parking'],
      capacity: 10
    },
    enrollment: {
      maxParticipants: 10,
      currentEnrollments: 0,
      registrationDeadline: new Date('2025-09-30'),
      fee: 2500,
      includesEquipment: true,
      includesMaterials: true,
      includesRefreshments: false
    },
    status: 'registration_open',
    curriculum: [
      {
        sessionNumber: 1,
        topic: 'Disease Identification & Diagnosis',
        objectives: ['Identify common diseases', 'Use diagnostic tools'],
        activities: ['demonstration', 'hands_on_practice', 'field_work'],
        duration: 480,
        materials: ['Microscopes', 'Sample containers', 'Field guides']
      }
    ],
    prerequisites: {
      experienceLevel: 'basic',
      requiredModules: []
    }
  }
  ,
  // EXTRA SESSIONS (to ensure >3 available with future deadlines)
  {
    sessionId: 'LH_ADV_002',
    title: 'Professional Latex Harvesting Techniques',
    description: 'Master the art of latex collection with optimal yield and quality techniques.',
    category: 'harvesting',
    level: 'Advanced',
    instructor: {
      name: 'Mr. Ravi Chandran',
      specialization: 'Latex Processing',
      experience: 20
    },
    schedule: {
      startDate: new Date('2025-10-08'),
      endDate: new Date('2025-10-11'),
      duration: 32,
      timeSlots: [
        { day: 'Wednesday', startTime: '06:00', endTime: '14:00' },
        { day: 'Thursday', startTime: '06:00', endTime: '14:00' },
        { day: 'Friday', startTime: '06:00', endTime: '14:00' },
        { day: 'Saturday', startTime: '06:00', endTime: '14:00' }
      ],
      totalSessions: 4
    },
    location: {
      type: 'field_location',
      address: 'Commercial Rubber Estate, Idukki, Kerala',
      coordinates: { latitude: 9.85, longitude: 76.97 },
      facilities: ['parking', 'restroom', 'processing_unit', 'storage'],
      capacity: 15
    },
    enrollment: {
      maxParticipants: 15,
      currentEnrollments: 5,
      registrationDeadline: new Date('2025-10-03'),
      fee: 4500,
      includesEquipment: true,
      includesMaterials: true,
      includesRefreshments: true
    },
    status: 'registration_open',
    curriculum: [
      {
        sessionNumber: 1,
        topic: 'Optimal Harvesting Timing',
        objectives: ['Weather assessment', 'Tree readiness', 'Yield optimization'],
        activities: ['demonstration', 'hands_on_practice', 'assessment'],
        duration: 480
      }
    ],
    prerequisites: { experienceLevel: 'intermediate', requiredModules: [] }
  },
  {
    sessionId: 'EQ_INT_002',
    title: 'Equipment Maintenance & Repair Workshop',
    description: 'Maintain and repair essential rubber farming equipment and machinery.',
    category: 'equipment_maintenance',
    level: 'Intermediate',
    instructor: {
      name: 'Mr. Anil Kumar',
      specialization: 'Agricultural Engineering',
      experience: 14
    },
    schedule: {
      startDate: new Date('2025-10-15'),
      endDate: new Date('2025-10-17'),
      duration: 24,
      timeSlots: [
        { day: 'Wednesday', startTime: '09:00', endTime: '17:00' },
        { day: 'Thursday', startTime: '09:00', endTime: '17:00' },
        { day: 'Friday', startTime: '09:00', endTime: '17:00' }
      ],
      totalSessions: 3
    },
    location: {
      type: 'training_center',
      address: 'Technical Training Institute, Ernakulam, Kerala',
      coordinates: { latitude: 9.98, longitude: 76.28 },
      facilities: ['parking', 'restroom', 'workshop', 'tool_storage', 'cafeteria'],
      capacity: 20
    },
    enrollment: {
      maxParticipants: 20,
      currentEnrollments: 3,
      registrationDeadline: new Date('2025-10-10'),
      fee: 3500,
      includesEquipment: false,
      includesMaterials: true,
      includesRefreshments: true
    },
    status: 'registration_open',
    curriculum: [
      { sessionNumber: 1, topic: 'Tapping Tools Maintenance', objectives: ['Tool sharpening', 'Handle replacement'], activities: ['demonstration', 'hands_on_practice'], duration: 480 }
    ],
    prerequisites: { experienceLevel: 'basic', requiredModules: [] }
  },
  {
    sessionId: 'SP_BEG_002',
    title: 'Safety Protocols & Emergency Response',
    description: 'Essential safety training for rubber plantation workers and emergency procedures.',
    category: 'safety_protocols',
    level: 'Beginner',
    instructor: {
      name: 'Ms. Priya Nair',
      specialization: 'Occupational Safety',
      experience: 10
    },
    schedule: {
      startDate: new Date('2025-11-20'),
      endDate: new Date('2025-11-21'),
      duration: 16,
      timeSlots: [
        { day: 'Thursday', startTime: '09:00', endTime: '17:00' },
        { day: 'Friday', startTime: '09:00', endTime: '17:00' }
      ],
      totalSessions: 2
    },
    location: {
      type: 'training_center',
      address: 'Safety Training Center, Kochi, Kerala',
      coordinates: { latitude: 9.93, longitude: 76.26 },
      facilities: ['parking', 'restroom', 'first_aid_station', 'simulation_area'],
      capacity: 30
    },
    enrollment: {
      maxParticipants: 30,
      currentEnrollments: 12,
      registrationDeadline: new Date('2025-11-15'),
      fee: 2000,
      includesEquipment: true,
      includesMaterials: true,
      includesRefreshments: true
    },
    status: 'registration_open',
    curriculum: [
      { sessionNumber: 1, topic: 'Workplace Safety Standards', objectives: ['Safety equipment', 'Emergency procedures'], activities: ['demonstration', 'group_exercise'], duration: 480 }
    ],
    prerequisites: { experienceLevel: 'none', requiredModules: [] }
  }
];

// Seed the database
const seedTrainingData = async () => {
  try {
    console.log('🌱 Starting to seed training data...');

    // Clear existing training data
    await PracticalTraining.deleteMany({});
    console.log('🗑️ Cleared existing training data');

    // Create a sample staff member for instructor reference
    let sampleStaff = await Staff.findOne({ email: 'trainer@rubbereco.com' });
    if (!sampleStaff) {
      sampleStaff = new Staff({
        name: 'Sample Trainer',
        email: 'trainer@rubbereco.com',
        phone: '+91 9876543210',
        role: 'trainer',
        department: 'Training & Development',
        location: 'Kottayam, Kerala',
        password: 'hashedpassword123' // In real scenario, this should be properly hashed
      });
      await sampleStaff.save();
      console.log('👤 Created sample staff member');
    }

    // Add staff ID to instructor data and createdBy field
    const trainingsWithStaffId = sampleTrainings.map(training => ({
      ...training,
      instructor: {
        ...training.instructor,
        staffId: sampleStaff._id
      },
      createdBy: sampleStaff._id,
      updatedBy: sampleStaff._id
    }));

    // Insert training data
    const insertedTrainings = await PracticalTraining.insertMany(trainingsWithStaffId);
    console.log(`✅ Successfully inserted ${insertedTrainings.length} training sessions`);

    // Display created trainings
    insertedTrainings.forEach(training => {
      console.log(`📚 ${training.title} - ${training.level} (${training.status})`);
    });

    console.log('🎉 Training data seeding completed successfully!');
  } catch (error) {
    console.error('❌ Error seeding training data:', error);
  }
};

// Run the seeding
const runSeed = async () => {
  await connectDB();
  await seedTrainingData();
  await mongoose.connection.close();
  console.log('🔌 Database connection closed');
  process.exit(0);
};

// Execute if run directly
if (require.main === module) {
  runSeed();
}

module.exports = { seedTrainingData, sampleTrainings };
