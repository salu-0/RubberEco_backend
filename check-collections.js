const mongoose = require('mongoose');
require('dotenv').config({ path: './.env' });

const checkCollections = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    
    console.log(`📚 Found ${collections.length} collections:`);
    collections.forEach(collection => {
      console.log(`   - ${collection.name}`);
    });

    // Check if practical trainings collection exists with different name
    const practicalTrainingCollections = collections.filter(c => 
      c.name.toLowerCase().includes('training') || 
      c.name.toLowerCase().includes('practical')
    );

    if (practicalTrainingCollections.length > 0) {
      console.log('\n🎯 Training-related collections:');
      for (const collection of practicalTrainingCollections) {
        console.log(`   📋 ${collection.name}`);
        const count = await db.collection(collection.name).countDocuments();
        console.log(`      Documents: ${count}`);
        
        if (count > 0) {
          const sample = await db.collection(collection.name).findOne();
          console.log(`      Sample document keys: ${Object.keys(sample).join(', ')}`);
        }
      }
    }

    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  } catch (error) {
    console.error('❌ Error:', error);
  }
};

checkCollections();
