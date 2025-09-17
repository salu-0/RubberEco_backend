const mongoose = require('mongoose');
const NurseryPlant = require('../models/NurseryPlant');

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/rubbereco');
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

// Sample plant data with variety information
const plantData = [
  {
    name: 'Rubber Plant RRII 105',
    clone: 'RRII 105',
    variety: 'RRII 105',
    origin: 'India',
    features: 'High yield, early tapping',
    bestFor: 'Lowlands & midlands',
    description: 'High-yielding rubber clone suitable for lowland and midland areas',
    unitPrice: 25,
    stockAvailable: 0,
    minOrderQty: 1,
    isActive: true
  },
  {
    name: 'Rubber Plant RRII 430',
    clone: 'RRII 430',
    variety: 'RRII 430',
    origin: 'India',
    features: 'Disease resistant, high yield',
    bestFor: 'Highlands & midlands',
    description: 'Disease-resistant rubber clone with high yield potential',
    unitPrice: 30,
    stockAvailable: 0,
    minOrderQty: 1,
    isActive: true
  },
  {
    name: 'Rubber Plant PB 235',
    clone: 'PB 235',
    variety: 'PB 235',
    origin: 'Malaysia',
    features: 'Excellent latex quality, moderate yield',
    bestFor: 'All terrains',
    description: 'Premium rubber clone with excellent latex quality',
    unitPrice: 35,
    stockAvailable: 0,
    minOrderQty: 1,
    isActive: true
  },
  {
    name: 'Rubber Plant RRII 414',
    clone: 'RRII 414',
    variety: 'RRII 414',
    origin: 'India',
    features: 'Early maturity, good yield',
    bestFor: 'Lowlands',
    description: 'Early maturing rubber clone suitable for lowland cultivation',
    unitPrice: 28,
    stockAvailable: 0,
    minOrderQty: 1,
    isActive: true
  },
  {
    name: 'Rubber Plant GT 1',
    clone: 'GT 1',
    variety: 'GT 1',
    origin: 'Thailand',
    features: 'High latex content, vigorous growth',
    bestFor: 'Midlands & highlands',
    description: 'Vigorous growing rubber clone with high latex content',
    unitPrice: 32,
    stockAvailable: 0,
    minOrderQty: 1,
    isActive: true
  },
  {
    name: 'Rubber Plant RRII 417',
    clone: 'RRII 417',
    variety: 'RRII 417',
    origin: 'India',
    features: 'Drought tolerant, good yield',
    bestFor: 'Dry areas & midlands',
    description: 'Drought-tolerant rubber clone suitable for dry areas',
    unitPrice: 26,
    stockAvailable: 0,
    minOrderQty: 1,
    isActive: true
  },
  {
    name: 'Rubber Plant RRII 422',
    clone: 'RRII 422',
    variety: 'RRII 422',
    origin: 'India',
    features: 'High yield, disease resistant',
    bestFor: 'All terrains',
    description: 'High-yielding disease-resistant rubber clone',
    unitPrice: 29,
    stockAvailable: 0,
    minOrderQty: 1,
    isActive: true
  }
];

const updateNurseryPlants = async () => {
  try {
    console.log('🌱 Starting nursery plants update...');
    
    // Clear existing plants
    await NurseryPlant.deleteMany({});
    console.log('🗑️ Cleared existing plants');
    
    // Insert new plants with variety data
    const plants = await NurseryPlant.insertMany(plantData);
    console.log(`✅ Inserted ${plants.length} plants with variety information`);
    
    // Display the inserted plants
    console.log('\n📋 Inserted Plants:');
    plants.forEach((plant, index) => {
      console.log(`${index + 1}. ${plant.name} (${plant.clone}) - ${plant.origin} - ₹${plant.unitPrice}`);
    });
    
    console.log('\n🎉 Nursery plants update completed successfully!');
    
  } catch (error) {
    console.error('❌ Error updating nursery plants:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
};

// Run the update
const runUpdate = async () => {
  await connectDB();
  await updateNurseryPlants();
};

runUpdate();


