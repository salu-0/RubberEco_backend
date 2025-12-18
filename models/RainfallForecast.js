const mongoose = require('mongoose');

const rainfallForecastSchema = new mongoose.Schema(
  {
    year: {
      type: Number,
      required: true
    },
    season: {
      type: String,
      default: 'Monsoon'
    },
    months: {
      type: [String],
      default: ['June', 'July', 'August', 'September']
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
    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

// Ensure one document per year & season
rainfallForecastSchema.index({ year: 1, season: 1 }, { unique: true });

module.exports = mongoose.model('RainfallForecast', rainfallForecastSchema);


