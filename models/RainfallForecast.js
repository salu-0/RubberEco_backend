const mongoose = require('mongoose');

const rainfallForecastSchema = new mongoose.Schema(
  {
    year: {
      type: Number,
      required: true
    },
    district: {
      type: String,
      required: true
    },
    month: {
      type: Number, // 1-12 for January-December
      required: true
    },
    monthName: {
      type: String, // "January", "February", etc.
      required: true
    },
    season: {
      type: String,
      default: 'Monsoon'
    },
    predictedRainfall: {
      type: Number,
      required: true
    },
    riskLevel: {
      type: String,
      enum: ['High', 'Normal', 'Low'],
      required: true
    },
    model: {
      type: String,
      default: 'SARIMA'
    },
    isForecast: {
      type: Boolean,
      default: false
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

// Ensure one document per year, district & month
rainfallForecastSchema.index({ year: 1, district: 1, month: 1 }, { unique: true });

module.exports = mongoose.model('RainfallForecast', rainfallForecastSchema);


