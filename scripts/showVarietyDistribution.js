const mongoose = require('mongoose');
const NurseryPlant = require('../models/NurseryPlant');
const NurseryCenter = require('../models/NurseryCenter');
const { RUBBER_VARIETIES_POOL, getVarietiesForCenter } = require('../constants/rubberVarieties');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/rubbereco', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function showVarietyDistribution() {
  try {
    console.log('📊 Showing variety distribution across nursery centers...\n');
    
    // Get all nursery centers
    const centers = await NurseryCenter.find({ isActive: true }).sort({ _id: 1 });
    console.log(`Found ${centers.length} nursery centers\n`);
    
    if (centers.length === 0) {
      console.log('❌ No nursery centers found.');
      return;
    }
    
    // Show variety pool
    console.log('🌱 Available Variety Pool:');
    RUBBER_VARIETIES_POOL.forEach((variety, index) => {
      console.log(`   ${index + 1}. ${variety.name} - ${variety.description}`);
    });
    console.log('');
    
    // Show distribution for each center
    console.log('🏢 Center Variety Distribution:');
    console.log('=' .repeat(60));
    
    for (let i = 0; i < centers.length; i++) {
      const center = centers[i];
      const assignedVarieties = getVarietiesForCenter(i, centers.length);
      
      console.log(`\n${i + 1}. ${center.name}`);
      console.log(`   Location: ${center.location}`);
      console.log(`   Email: ${center.email}`);
      console.log(`   Assigned Varieties:`);
      
      assignedVarieties.forEach((variety, index) => {
        console.log(`     ${index + 1}. ${variety.name} - ${variety.description}`);
        console.log(`        Characteristics: ${variety.characteristics.join(', ')}`);
      });
      
      // Get actual plants for this center
      const plants = await NurseryPlant.find({ 
        nurseryCenterId: center._id,
        isActive: true 
      });
      
      console.log(`   Actual Plants: ${plants.length}`);
      plants.forEach(plant => {
        console.log(`     - ${plant.name} (Stock: ${plant.stockAvailable}, Price: ₹${plant.unitPrice})`);
      });
    }
    
    // Show variety usage summary
    console.log('\n📈 Variety Usage Summary:');
    console.log('=' .repeat(60));
    
    const varietyUsage = new Map();
    for (const variety of RUBBER_VARIETIES_POOL) {
      const centersWithVariety = [];
      for (let i = 0; i < centers.length; i++) {
        const centerVarieties = getVarietiesForCenter(i, centers.length);
        if (centerVarieties.some(v => v.name === variety.name)) {
          centersWithVariety.push(centers[i].name);
        }
      }
      varietyUsage.set(variety.name, centersWithVariety);
    }
    
    for (const [varietyName, centersList] of varietyUsage) {
      console.log(`\n${varietyName}:`);
      console.log(`   Used by ${centersList.length} center(s):`);
      centersList.forEach(centerName => {
        console.log(`     - ${centerName}`);
      });
    }
    
    // Show distribution pattern
    console.log('\n🔄 Distribution Pattern:');
    console.log('=' .repeat(60));
    console.log('Each center gets exactly 2 varieties from the pool of 6.');
    console.log('Varieties are distributed in a cycling pattern to ensure diversity.');
    console.log(`With ${centers.length} centers and 6 varieties, the pattern repeats every ${Math.ceil(6/2)} center(s).`);
    
  } catch (error) {
    console.error('❌ Failed to show distribution:', error);
  } finally {
    mongoose.connection.close();
  }
}

// Run distribution display
showVarietyDistribution();


