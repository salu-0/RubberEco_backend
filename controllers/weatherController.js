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
    const year = now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear();
    const month = ((now.getMonth() + 1) % 12) + 1; // next month in 1-12

    // For now we only have yearly Monsoon totals in RainfallForecast.
    // We return a yearly monsoon forecast plus derived metadata for the farmer UI.
    const forecast = await RainfallForecast.findOne({ year }).lean();

    if (!forecast) {
      return res.status(404).json({
        message: 'No rainfall forecast available for next month/year yet. Please run the rainfall import script.'
      });
    }

    const season = getSeasonForMonth(month);

    return res.json({
      year: forecast.year,
      month,
      monthName: new Date(2000, month - 1, 1).toLocaleString('en-US', { month: 'long' }),
      season,
      // Use monsoon total as a proxy risk indicator for the coming season
      predictedSeasonRainfall: forecast.predictedRainfall,
      riskLevel: forecast.riskLevel,
      model: forecast.model,
      createdAt: forecast.createdAt
    });
  } catch (error) {
    console.error('Error fetching next month forecast:', error);
    return res.status(500).json({ message: 'Failed to fetch weather forecast' });
  }
};


