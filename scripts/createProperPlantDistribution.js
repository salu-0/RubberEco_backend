const mongoose = require('mongoose');
const NurseryCenter = require('../models/NurseryCenter');
const NurseryPlant = require('../models/NurseryPlant');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/RubberEco', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function createProperPlantDistribution() {
  try {
    console.log('🔄 Creating proper plant distribution for each nursery center...');
    
    // Get all nursery centers
    const centers = await NurseryCenter.find({ isActive: true }).sort({ _id: 1 });
    console.log(`📋 Found ${centers.length} nursery centers`);
    
    // Clear all existing plants
    console.log('🗑️  Clearing all existing plants...');
    await NurseryPlant.deleteMany({});
    
    // Create 2 plants for each nursery center
    const plantVarieties = [
      'RRII 105', 'RRII 203', 'RRII 414', 'RRII 422', 'RRII 430',
      'GT 1', 'PB 217', 'PB 235', 'PB 260', 'PB 280',
      'RRII 300', 'RRII 400', 'RRII 500', 'RRII 600', 'RRII 700'
    ];
    
    for (let i = 0; i < centers.length; i++) {
      const center = centers[i];
      console.log(`\n🏢 Creating plants for: ${center.name}`);
      
      // Create 2 plants for this center
      for (let j = 0; j < 2; j++) {
        const varietyIndex = (i * 2 + j) % plantVarieties.length;
        const variety = plantVarieties[varietyIndex];
        
        const plant = new NurseryPlant({
          name: variety,
          variety: variety,
          clone: variety,
          origin: 'Kerala, India',
          features: 'High yielding, disease resistant',
          bestFor: 'Commercial rubber production',
          description: `Premium ${variety} rubber plant variety`,
          unitPrice: 25 + (Math.random() * 20), // Random price between 25-45
          stockAvailable: 30 + Math.floor(Math.random() * 50), // Random stock between 30-80
          minOrderQty: 1,
          nurseryCenterId: center._id,
          isActive: true
        });
        
        await plant.save();
        console.log(`   ✅ Created: ${variety} (Stock: ${plant.stockAvailable}, Price: ₹${plant.unitPrice})`);
      }
    }
    
    // Verify the distribution
    console.log('\n🔍 Verifying plant distribution...');
    for (const center of centers) {
      const centerPlants = await NurseryPlant.find({ 
        nurseryCenterId: center._id,
        isActive: true 
      });
      console.log(`   ${center.name}: ${centerPlants.length} plants`);
      centerPlants.forEach(plant => {
        console.log(`      - ${plant.name} (Stock: ${plant.stockAvailable}, Price: ₹${plant.unitPrice})`);
      });
    }
    
    console.log('\n✅ Plant distribution completed successfully!');
    console.log('🎉 Each nursery admin now has exactly 2 plants to manage!');
    
  } catch (error) {
    console.error('❌ Error creating plant distribution:', error);
  } finally {
    mongoose.connection.close();
  }
}

createProperPlantDistribution();

