const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config();

const RainfallForecast = require('../models/RainfallForecast');

// Simple Mongo connection (same DB as other scripts)
const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/RubberEco';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

// Read yearly rainy-season totals (Jun–Sep) from CSV
const loadHistoricalRainySeasonData = () => {
  const csvPath = path.join(__dirname, '..', 'rainy_season_yearly_1948_2022.csv');
  const raw = fs.readFileSync(csvPath, 'utf8');

  const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  // First line is header: ",MonthlyTotal"
  const dataLines = lines.slice(1);

  const records = [];

  for (const line of dataLines) {
    const [yearStr, totalStr] = line.split(',');
    const year = parseInt(yearStr, 10);
    const total = parseFloat(totalStr);

    if (!Number.isNaN(year) && !Number.isNaN(total)) {
      records.push({ year, rainfall: total, isForecast: false });
    }
  }

  return records;
};

// Compute historical average
const computeHistoricalAverage = records => {
  if (!records.length) return 0;
  const sum = records.reduce((acc, r) => acc + r.rainfall, 0);
  return sum / records.length;
};

// Classify risk as High / Normal / Low
const makeRiskClassifier = historicalAvg => {
  return value => {
    if (value > historicalAvg * 1.1) {
      return 'High';
    } else if (value < historicalAvg * 0.9) {
      return 'Low';
    }
    return 'Normal';
  };
};

const importRainfallForecasts = async () => {
  try {
    console.log('🌧️  Loading historical rainy season data (Jun–Sep)...');
    const records = loadHistoricalRainySeasonData();

    if (!records.length) {
      console.error('No data found in rainy_season_yearly_1948_2022.csv');
      return;
    }

    // Historical average based only on past observed years
    const historicalAvg = computeHistoricalAverage(records.filter(r => !r.isForecast));
    const classifyRisk = makeRiskClassifier(historicalAvg);

    console.log(`📊 Historical average rainy season rainfall: ${historicalAvg.toFixed(2)}`);

    // Extend data with simple forecasts for future years (e.g. up to 2026)
    const lastHistoricalYear = Math.max(...records.map(r => r.year));
    const recentYears = records
      .filter(r => r.year > lastHistoricalYear - 5 && !r.isForecast);
    const recentAvg = computeHistoricalAverage(recentYears);

    const futureYears = [2023, 2024, 2025, 2026];
    futureYears.forEach(year => {
      if (year > lastHistoricalYear) {
        records.push({
          year,
          rainfall: recentAvg,
          isForecast: true
        });
      }
    });

    const bulkOps = records.map(r => {
      const roundedRainfall = Number(r.rainfall.toFixed(2));
      const riskLevel = classifyRisk(r.rainfall);

      const doc = {
        year: r.year,
        season: 'Monsoon',
        months: ['June', 'July', 'August', 'September'],
        predictedRainfall: roundedRainfall,
        riskLevel,
        model: 'SARIMA',
        isForecast: r.isForecast || false,
        createdAt: new Date()
      };

      // Use upsert so you can safely re-run the script
      return {
        updateOne: {
          filter: { year: r.year, season: 'Monsoon' },
          update: { $set: doc },
          upsert: true
        }
      };
    });

    console.log(`📝 Preparing to upsert ${bulkOps.length} rainfall forecast documents...`);

    const result = await RainfallForecast.bulkWrite(bulkOps);

    console.log('✅ Rainfall forecasts stored/updated in MongoDB Atlas');
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('❌ Error importing rainfall forecasts:', error);
  }
};

const run = async () => {
  await connectDB();
  await importRainfallForecasts();
  await mongoose.connection.close();
  console.log('🔌 Database connection closed');
  process.exit(0);
};

if (require.main === module) {
  run();
}


