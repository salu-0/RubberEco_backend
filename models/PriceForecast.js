const mongoose = require('mongoose');

const priceForecastSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true
  },
  year: {
    type: Number,
    required: true,
    index: true
  },
  month: {
    type: Number,
    required: true,
    min: 1,
    max: 12
  },
  market: {
    type: String,
    required: true,
    default: 'Kottayam',
    index: true
  },
  grade: {
    type: String,
    required: true,
    default: 'RSS-4',
    enum: ['RSS-4', 'RSS-3', 'RSS-5', 'ISNR-20', 'Latex']
  },
  predictedPrice: {
    type: Number,
    required: true
  },
  lowerCI: {
    type: Number,
    default: null
  },
  upperCI: {
    type: Number,
    default: null
  },
  trend: {
    type: String,
    enum: ['Rising', 'Stable', 'Falling'],
    default: 'Stable'
  },
  percentChange: {
    type: Number,
    default: 0
  },
  model: {
    type: String,
    default: 'SARIMA'
  },
  isForecast: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Compound index for efficient queries
priceForecastSchema.index({ year: 1, month: 1, market: 1, grade: 1 });

// Static method to get forecasts for a specific period
priceForecastSchema.statics.getForecastsForPeriod = async function(startYear, startMonth, endYear, endMonth, market = 'Kottayam', grade = 'RSS-4') {
  const startDate = new Date(startYear, startMonth - 1, 1);
  const endDate = new Date(endYear, endMonth, 0);
  
  return this.find({
    date: { $gte: startDate, $lte: endDate },
    market,
    grade
  }).sort({ date: 1 });
};

// Static method to get next N months forecast
priceForecastSchema.statics.getNextMonthsForecasts = async function(months = 6, market = 'Kottayam', grade = 'RSS-4') {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  
  return this.find({
    $or: [
      { year: currentYear, month: { $gte: currentMonth } },
      { year: { $gt: currentYear } }
    ],
    market,
    grade,
    isForecast: true
  })
  .sort({ year: 1, month: 1 })
  .limit(months);
};

// Static method to get historical prices
priceForecastSchema.statics.getHistoricalPrices = async function(years = 5, market = 'Kottayam', grade = 'RSS-4') {
  const cutoffYear = new Date().getFullYear() - years;
  
  return this.find({
    year: { $gte: cutoffYear },
    market,
    grade,
    isForecast: false
  }).sort({ date: 1 });
};

module.exports = mongoose.model('PriceForecast', priceForecastSchema);

