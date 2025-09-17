const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Invalid email']
  },
  password: {
    type: String,
    required: true,
    minlength: 6,
    select: false
  },
  role: {
    type: String,
    required: true,
    trim: true
  },
  phone: {
    type: String,
    trim: true,
    default: ''
  },
  location: {
    type: String,
    trim: true,
    default: ''
  },
  bio: {
    type: String,
    trim: true,
    default: ''
  },
  profileImage: {
    type: String,
    default: ''
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  googleId: {
    type: String,
    sparse: true // Allows multiple null values
  },
  resetPasswordToken: {
    type: String,
    default: null
  },
  resetPasswordExpires: {
    type: Date,
    default: null
  },

  // Broker-specific fields
  brokerProfile: {
    licenseNumber: {
      type: String,
      trim: true,
      sparse: true // Allows multiple null values, unique when not null
    },
    experience: {
      type: String,
      trim: true
    },
    specialization: [{
      type: String,
      trim: true
    }],
    companyName: {
      type: String,
      trim: true
    },
    companyAddress: {
      type: String,
      trim: true
    },
    education: {
      type: String,
      trim: true
    },
    previousWork: {
      type: String,
      trim: true
    },
    verificationStatus: {
      type: String,
      enum: ['pending', 'verified', 'rejected'],
      default: 'pending'
    },
    verificationDate: {
      type: Date
    },
    rating: {
      type: Number,
      min: 0,
      max: 5,
      default: 0
    },
    totalDeals: {
      type: Number,
      default: 0
    },
    successfulDeals: {
      type: Number,
      default: 0
    }
  }

}, {
  timestamps: true,
  collection: 'Register' // Targets your existing collection
});

module.exports = mongoose.model('User', userSchema);
