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

    // For now we only have yearly Monsoon totals in RainfallForecast (historical).
    // Try to get forecast for the target year; if not present (e.g. 2025) fall back
    // to the latest available year so the UI still shows useful guidance.
    let forecast = await RainfallForecast.findOne({ year: targetYear }).lean();

    if (!forecast) {
      forecast = await RainfallForecast.findOne().sort({ year: -1 }).lean();
    }

    if (!forecast) {
      return res.status(404).json({
        message: 'No rainfall forecast data found in the database. Please run the rainfall import script.'
      });
    }

    const season = getSeasonForMonth(month);

    // Compute long-term historical average (only non-forecast years)
    const historicalDocs = await RainfallForecast.find({ isForecast: { $ne: true } }).lean();
    let historicalAverage = null;
    let percentOfAverage = null;

    if (historicalDocs.length) {
      const sum = historicalDocs.reduce((acc, doc) => acc + (doc.predictedRainfall || 0), 0);
      historicalAverage = sum / historicalDocs.length;
      percentOfAverage = historicalAverage
        ? forecast.predictedRainfall / historicalAverage
        : null;
    }

    return res.json({
      year: forecast.year,
      month,
      monthName: new Date(2000, month - 1, 1).toLocaleString('en-US', { month: 'long' }),
      season,
      predictedSeasonRainfall: forecast.predictedRainfall,
      riskLevel: forecast.riskLevel,
      model: forecast.model,
      createdAt: forecast.createdAt,
      isForecast: !!forecast.isForecast,
      historicalAverage,
      percentOfAverage
    });
  } catch (error) {
    console.error('Error fetching next month forecast:', error);
    return res.status(500).json({ message: 'Failed to fetch weather forecast' });
  }
};


