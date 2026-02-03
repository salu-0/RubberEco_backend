/**
 * Import Price Forecasts into MongoDB
 * ====================================
 * Run this script after training the SARIMA price model
 * to import the generated forecasts into MongoDB.
 * 
 * Usage: node scripts/importPriceForecasts.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// MongoDB connection
const connectDB = require('../config/db');

// Price Forecast Model Schema
const priceForecastSchema = new mongoose.Schema({
  date: { type: Date, required: true },
  year: { type: Number, required: true, index: true },
  month: { type: Number, required: true, min: 1, max: 12 },
  market: { type: String, required: true, default: 'Kottayam', index: true },
  grade: { type: String, required: true, default: 'RSS-4' },
  predictedPrice: { type: Number, required: true },
  lowerCI: { type: Number, default: null },
  upperCI: { type: Number, default: null },
  trend: { type: String, enum: ['Rising', 'Stable', 'Falling'], default: 'Stable' },
  percentChange: { type: Number, default: 0 },
  model: { type: String, default: 'SARIMA' },
  isForecast: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

// Compound index for efficient queries
priceForecastSchema.index({ year: 1, month: 1, market: 1, grade: 1 });

const PriceForecast = mongoose.model('PriceForecast', priceForecastSchema);

async function importForecasts() {
  console.log('=' .repeat(60));
  console.log('💰 PRICE FORECAST IMPORT SCRIPT');
  console.log('=' .repeat(60));
  
  try {
    // Connect to database
    await connectDB();
    console.log('✅ Connected to MongoDB');
    
    // Read the forecast JSON file
    const forecastPath = path.join(__dirname, '..', 'ml', 'forecasts', 'price_forecasts.json');
    
    if (!fs.existsSync(forecastPath)) {
      console.log('⚠️  Forecast file not found:', forecastPath);
      console.log('📝 Please run the SARIMA price model first:');
      console.log('   cd backend/ml');
      console.log('   python sarima_price_model.py');
      process.exit(1);
    }
    
    const forecastData = JSON.parse(fs.readFileSync(forecastPath, 'utf-8'));
    console.log(`📊 Loaded ${forecastData.length} records from forecast file`);
    
    // Clear existing forecasts (optional - can be configured)
    const deleteResult = await PriceForecast.deleteMany({});
    console.log(`🗑️  Cleared ${deleteResult.deletedCount} existing records`);
    
    // Prepare records for insertion
    const records = forecastData.map(record => ({
      date: new Date(record.date),
      year: record.year,
      month: record.month,
      market: record.market || 'Kottayam',
      grade: record.grade || 'RSS-4',
      predictedPrice: record.predictedPrice,
      lowerCI: record.lowerCI || null,
      upperCI: record.upperCI || null,
      trend: record.trend || 'Stable',
      percentChange: record.percentChange || 0,
      model: record.model || 'SARIMA',
      isForecast: record.isForecast !== false
    }));
    
    // Insert in batches
    const batchSize = 100;
    let insertedCount = 0;
    
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      await PriceForecast.insertMany(batch);
      insertedCount += batch.length;
      console.log(`📤 Inserted ${insertedCount}/${records.length} records`);
    }
    
    // Verify import
    const totalCount = await PriceForecast.countDocuments();
    const forecastCount = await PriceForecast.countDocuments({ isForecast: true });
    const historicalCount = await PriceForecast.countDocuments({ isForecast: false });
    
    console.log('\n' + '=' .repeat(60));
    console.log('✅ IMPORT COMPLETE!');
    console.log('=' .repeat(60));
    console.log(`\n📊 Database Statistics:`);
    console.log(`   - Total records: ${totalCount}`);
    console.log(`   - Historical: ${historicalCount}`);
    console.log(`   - Forecasts: ${forecastCount}`);
    
    // Show sample forecast
    const sampleForecast = await PriceForecast.findOne({ isForecast: true }).sort({ date: 1 });
    if (sampleForecast) {
      console.log(`\n📈 Sample Forecast:`);
      console.log(`   - Date: ${sampleForecast.date.toISOString().split('T')[0]}`);
      console.log(`   - Market: ${sampleForecast.market}`);
      console.log(`   - Grade: ${sampleForecast.grade}`);
      console.log(`   - Predicted Price: ₹${sampleForecast.predictedPrice}/kg`);
      console.log(`   - Trend: ${sampleForecast.trend}`);
    }
    
  } catch (error) {
    console.error('❌ Import failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
    process.exit(0);
  }
}

// Run import
importForecasts();

