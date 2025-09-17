const mongoose = require('mongoose');
const PracticalTraining = require('./models/PracticalTraining');
require('dotenv').config({ path: './.env' });

const checkTrainings = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const trainings = await PracticalTraining.find({});
    console.log(`📚 Found ${trainings.length} trainings in database`);

    trainings.forEach(training => {
      console.log(`\n📋 ${training.title}`);
      console.log(`   Status: ${training.status}`);
      console.log(`   Registration Deadline: ${training.enrollment.registrationDeadline}`);
      console.log(`   Current Date: ${new Date()}`);
      console.log(`   Deadline Passed: ${new Date() > training.enrollment.registrationDeadline}`);
      console.log(`   Enrollments: ${training.enrollment.currentEnrollments}/${training.enrollment.maxParticipants}`);
      console.log(`   Available: ${training.enrollment.currentEnrollments < training.enrollment.maxParticipants}`);
    });

    // Check what the findAvailableTrainings method returns
    console.log('\n🔍 Checking available trainings using model method...');
    const availableTrainings = await PracticalTraining.findAvailableTrainings();
    console.log(`📚 Available trainings: ${availableTrainings.length}`);

    availableTrainings.forEach(training => {
      console.log(`   ✅ ${training.title} - ${training.status}`);
    });

    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  } catch (error) {
    console.error('❌ Error:', error);
  }
};

checkTrainings();
