const RainfallForecast = require('../models/RainfallForecast');

// Map month number (1-12) to simple season labels
const getSeasonForMonth = (month) => {
  if ([6, 7, 8, 9].includes(month)) return 'Monsoon';
  if ([10, 11].includes(month)) return 'Post-monsoon';
  if ([12, 1, 2].includes(month)) return 'Winter';
  return 'Summer';
};

// GET /api/weather/next-month
exports.getNextMonthForecast = async (req, res) => {
  try {
    const now = new Date();
    const targetYear = now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear();
    const month = ((now.getMonth() + 1) % 12) + 1; // next month in 1-12

    // Get district-wise forecasts for target year
    let districtForecasts = await RainfallForecast.find({ 
      year: targetYear,
      season: 'Monsoon'
    }).lean();

    // If no forecasts for target year, get latest available year
    if (!districtForecasts || districtForecasts.length === 0) {
      const latestYearDoc = await RainfallForecast.findOne()
        .sort({ year: -1 })
        .lean();
      
      if (latestYearDoc) {
        districtForecasts = await RainfallForecast.find({
          year: latestYearDoc.year,
          season: 'Monsoon'
        }).lean();
      }
    }

    if (!districtForecasts || districtForecasts.length === 0) {
      return res.status(404).json({
        message: 'No rainfall forecast data found in the database. Please run: npm run import-kerala-rainfall'
      });
    }

    const season = getSeasonForMonth(month);
    const forecastYear = districtForecasts[0].year;

    // Calculate Kerala state average (sum of all districts)
    const keralaTotalRainfall = districtForecasts.reduce(
      (sum, doc) => sum + (doc.predictedRainfall || 0), 
      0
    );

    // Compute historical average (Kerala state level)
    const historicalDocs = await RainfallForecast.find({ 
      isForecast: { $ne: true },
      season: 'Monsoon'
    }).lean();

    // Group by year and sum districts to get Kerala total per year
    const keralaYearlyTotals = {};
    historicalDocs.forEach(doc => {
      if (!keralaYearlyTotals[doc.year]) {
        keralaYearlyTotals[doc.year] = 0;
      }
      keralaYearlyTotals[doc.year] += doc.predictedRainfall || 0;
    });

    const historicalYears = Object.keys(keralaYearlyTotals).map(Number);
    const historicalTotals = Object.values(keralaYearlyTotals);
    const historicalAverage = historicalTotals.length 
      ? historicalTotals.reduce((a, b) => a + b, 0) / historicalTotals.length 
      : null;

    const percentOfAverage = historicalAverage
      ? keralaTotalRainfall / historicalAverage
      : null;

    // Build time series for chart (Kerala state totals per year)
    const allYears = [...new Set(historicalDocs.map(d => d.year))].sort();
    const series = [];
    
    for (const year of allYears) {
      const yearDocs = await RainfallForecast.find({ year, season: 'Monsoon' }).lean();
      const yearTotal = yearDocs.reduce((sum, doc) => sum + (doc.predictedRainfall || 0), 0);
      const avgRisk = yearDocs.length > 0 
        ? yearDocs[0].riskLevel // Use first district's risk as proxy
        : 'Normal';
      const isForecast = yearDocs.length > 0 ? !!yearDocs[0].isForecast : false;
      
      series.push({
        year,
        rainfall: yearTotal,
        riskLevel: avgRisk,
        isForecast
      });
    }

    // Add forecast years if not in series
    const forecastYearDocs = await RainfallForecast.find({ 
      year: forecastYear, 
      season: 'Monsoon' 
    }).lean();
    if (forecastYearDocs.length > 0 && !series.find(s => s.year === forecastYear)) {
      const forecastTotal = forecastYearDocs.reduce(
        (sum, doc) => sum + (doc.predictedRainfall || 0), 
        0
      );
      series.push({
        year: forecastYear,
        rainfall: forecastTotal,
        riskLevel: forecastYearDocs[0].riskLevel,
        isForecast: true
      });
    }

    series.sort((a, b) => a.year - b.year);

    return res.json({
      year: forecastYear,
      month,
      monthName: new Date(2000, month - 1, 1).toLocaleString('en-US', { month: 'long' }),
      season,
      predictedSeasonRainfall: keralaTotalRainfall,
      riskLevel: districtForecasts[0].riskLevel, // Use first district as proxy
      model: districtForecasts[0].model || 'SARIMA',
      createdAt: districtForecasts[0].createdAt,
      isForecast: !!districtForecasts[0].isForecast,
      historicalAverage,
      percentOfAverage,
      series,
      districts: districtForecasts.map(doc => ({
        district: doc.district,
        predictedRainfall: doc.predictedRainfall,
        riskLevel: doc.riskLevel
      }))
    });
  } catch (error) {
    console.error('Error fetching next month forecast:', error);
    return res.status(500).json({ message: 'Failed to fetch weather forecast' });
  }
};


