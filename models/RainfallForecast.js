const mongoose = require('mongoose');

/**
 * Rainfall Forecast Schema
 * ========================
 * Stores historical and predicted monsoon rainfall data for Kerala.
 * 
 * Model: SARIMA (Seasonal AutoRegressive Integrated Moving Average)
 * - Trained using statsmodels in Python (backend/ml/sarima_rainfall_model.py)
 * - Historical data: Kerala-Rainfall-Historical.csv (1901-2017)
 * - Forecasts include 95% confidence intervals
 */
const rainfallForecastSchema = new mongoose.Schema(
  {
    year: {
      type: Number,
      required: true
    },
    state: {
      type: String,
      default: 'Kerala',
      index: true
    },
    // Kerala's 14 districts
    districts: {
      type: [String],
      default: [
        'Thiruvananthapuram', 'Kollam', 'Pathanamthitta', 'Alappuzha',
        'Kottayam', 'Idukki', 'Ernakulam', 'Thrissur', 'Palakkad',
        'Malappuram', 'Kozhikode', 'Wayanad', 'Kannur', 'Kasaragod'
      ]
    },
    // Districts with significant rubber cultivation
    rubberBeltDistricts: {
      type: [String],
      default: [
        'Kottayam', 'Idukki', 'Ernakulam', 'Thrissur', 'Palakkad',
        'Kozhikode', 'Kannur', 'Kasaragod', 'Pathanamthitta', 'Kollam',
        'Thiruvananthapuram', 'Malappuram', 'Wayanad'
      ]
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
    // Confidence intervals (95%) for forecast uncertainty
    lowerCI: {
      type: Number,
      default: null
    },
    upperCI: {
      type: Number,
      default: null
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
    // Model order for reference (e.g., "(1, 1, 1)")
    modelOrder: {
      type: String,
      default: null
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

// Ensure one document per year & season
rainfallForecastSchema.index({ year: 1, season: 1 }, { unique: true });

module.exports = mongoose.model('RainfallForecast', rainfallForecastSchema);


