const mongoose = require('mongoose');

const registerSchema = new mongoose.Schema({
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
    brokerProfile: {
      licenseNumber: {
        type: String,
        trim: true,
        sparse: true
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
        enum: ['pending', 'approved', 'rejected', 'under_review'],
        default: 'pending'
      },
      verificationDate: {
        type: Date
      },
      ocrValidationStatus: {
        type: String,
        enum: ['passed', 'failed', 'not_checked'],
        default: 'not_checked'
      },
      ocrValidationReason: {
        type: String,
        default: ''
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
    },
  profileImage: {
    type: String,
    default: ''
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date,
    default: null
  },
  resetPasswordToken: {
    type: String,
    default: null
  },
  resetPasswordExpires: {
    type: Date,
    default: null
  },
  emailVerificationToken: {
    type: String,
    default: null
  },
  emailVerificationExpires: {
    type: Date,
    default: null
  },
  
  // Farmer specific fields
  farmDetails: {
    farmSize: {
      type: String,
      default: ''
    },
    farmLocation: {
      type: String,
      default: ''
    },
    cropTypes: [{
      type: String
    }],
    experience: {
      type: String,
      default: ''
    }
  },

  // Staff specific fields
  staffDetails: {
    department: {
      type: String,
      default: ''
    },
    position: {
      type: String,
      default: ''
    },
    employeeId: {
      type: String,
      default: ''
    },
    joiningDate: {
      type: Date,
      default: null
    },
    salary: {
      type: Number,
      default: 0
    }
  },

  // Broker specific fields
  brokerDetails: {
    companyName: {
      type: String,
      default: ''
    },
    licenseNumber: {
      type: String,
      default: ''
    },
    rating: {
      type: Number,
      default: 0
    },
    successfulDeals: {
      type: Number,
      default: 0
    }
  },

  // Nursery admin specific fields
  nurseryCenterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'NurseryCenter',
    default: null
  },
  nurseryCenterName: {
    type: String,
    default: ''
  },
  permissions: {
    managePlants: {
      type: Boolean,
      default: true
    },
    manageStock: {
      type: Boolean,
      default: true
    },
    managePricing: {
      type: Boolean,
      default: true
    },
    manageShipments: {
      type: Boolean,
      default: true
    },
    managePayments: {
      type: Boolean,
      default: true
    },
    viewReports: {
      type: Boolean,
      default: true
    }
  }

}, {
  timestamps: true,
  collection: 'Register' // Targets your existing collection
});

module.exports = mongoose.model('Register', registerSchema);
