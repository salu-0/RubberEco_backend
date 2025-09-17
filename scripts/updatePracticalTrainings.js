const mongoose = require('mongoose');
const PracticalTraining = require('../models/PracticalTraining');
require('dotenv').config();

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/RubberEco';

// Helper to add days
const addDays = (date, days) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

// Three additional sessions to insert if they don't exist
const extraSessions = [
  {
    sessionId: 'LH_ADV_002',
    title: 'Professional Latex Harvesting Techniques',
    description: 'Master latex collection with optimal yield and quality techniques.',
    category: 'harvesting',
    level: 'Advanced',
    instructor: { name: 'Mr. Ravi Chandran', specialization: 'Latex Processing', experience: 20 },
    schedule: { startDate: new Date('2025-10-08'), endDate: new Date('2025-10-11'), duration: 32, totalSessions: 4, timeSlots: [] },
    location: { type: 'field_location', address: 'Commercial Rubber Estate, Idukki, Kerala', capacity: 15, facilities: ['parking','restroom','processing_unit','storage'] },
    enrollment: { maxParticipants: 15, currentEnrollments: 5, registrationDeadline: new Date('2025-10-25'), fee: 4500, includesEquipment: true, includesMaterials: true, includesRefreshments: true },
    status: 'registration_open',
    createdBy: undefined
  },
  {
    sessionId: 'EQ_INT_002',
    title: 'Equipment Maintenance & Repair Workshop',
    description: 'Maintain and repair essential rubber farming equipment and machinery.',
    category: 'equipment_maintenance',
    level: 'Intermediate',
    instructor: { name: 'Mr. Anil Kumar', specialization: 'Agricultural Engineering', experience: 14 },
    schedule: { startDate: new Date('2025-10-15'), endDate: new Date('2025-10-17'), duration: 24, totalSessions: 3, timeSlots: [] },
    location: { type: 'training_center', address: 'Technical Training Institute, Ernakulam, Kerala', capacity: 20, facilities: ['parking','restroom','workshop','tool_storage','cafeteria'] },
    enrollment: { maxParticipants: 20, currentEnrollments: 3, registrationDeadline: new Date('2025-10-28'), fee: 3500, includesEquipment: false, includesMaterials: true, includesRefreshments: true },
    status: 'registration_open',
    createdBy: undefined
  },
  {
    sessionId: 'SP_BEG_002',
    title: 'Safety Protocols & Emergency Response',
    description: 'Essential safety training and emergency procedures for plantation workers.',
    category: 'safety_protocols',
    level: 'Beginner',
    instructor: { name: 'Ms. Priya Nair', specialization: 'Occupational Safety', experience: 10 },
    schedule: { startDate: new Date('2025-11-20'), endDate: new Date('2025-11-21'), duration: 16, totalSessions: 2, timeSlots: [] },
    location: { type: 'training_center', address: 'Safety Training Center, Kochi, Kerala', capacity: 30, facilities: ['parking','restroom','first_aid_station','simulation_area'] },
    enrollment: { maxParticipants: 30, currentEnrollments: 12, registrationDeadline: new Date('2025-11-30'), fee: 2000, includesEquipment: true, includesMaterials: true, includesRefreshments: true },
    status: 'registration_open',
    createdBy: undefined
  }
];

async function main() {
  await mongoose.connect(MONGO_URI);

  // 1) Extend deadlines and ensure status is registration_open for all sessions
  const now = new Date();
  const defaultExtensionDays = 40;

  const trainings = await PracticalTraining.find({});
  const fallbackStaffId = trainings[0]?.instructor?.staffId;
  for (const t of trainings) {
    const currentDeadline = t.enrollment?.registrationDeadline || now;
    const newDeadline = currentDeadline > now ? addDays(currentDeadline, 20) : addDays(now, defaultExtensionDays);
    t.enrollment.registrationDeadline = newDeadline;
    if (t.enrollment.currentEnrollments < t.enrollment.maxParticipants) {
      t.status = 'registration_open';
    }
    await t.save();
    console.log(`Updated deadline for ${t.sessionId} -> ${newDeadline.toISOString().slice(0,10)}`);
  }

  // 2) Upsert the three extra sessions (keep existing if already there)
  for (const sess of extraSessions) {
    const existing = await PracticalTraining.findOne({ sessionId: sess.sessionId });
    if (existing) {
      console.log(`Session ${sess.sessionId} already exists. Skipping insert.`);
      continue;
    }
    // Reuse createdBy from any existing document to satisfy schema requirement
    const any = trainings[0] || (await PracticalTraining.findOne({}));
    const createdBy = any ? any.createdBy : undefined;
    // Ensure valid facilities per schema and required instructor.staffId
    const normalizedFacilities = Array.from(new Set(
      (sess.location?.facilities || [])
        .map(f => {
          if (['processing_unit', 'storage', 'workshop', 'tool_storage'].includes(f)) return 'equipment_storage';
          return f;
        })
        .filter(f => ['parking','restroom','cafeteria','equipment_storage','first_aid','accommodation'].includes(f))
    ));
    const instructor = { ...sess.instructor, staffId: fallbackStaffId || any?.instructor?.staffId };
    const doc = new PracticalTraining({
      ...sess,
      instructor,
      location: { ...sess.location, facilities: normalizedFacilities },
      createdBy: createdBy || new mongoose.Types.ObjectId()
    });
    await doc.save();
    console.log(`Inserted new session ${sess.sessionId}`);
  }

  await mongoose.disconnect();
  console.log('Done.');
}

if (require.main === module) {
  main().catch(err => { console.error(err); process.exit(1); });
}

module.exports = { main };


