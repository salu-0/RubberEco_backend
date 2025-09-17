const mongoose = require('mongoose');

const staffSchema = new mongoose.Schema({
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
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6,
    select: false // Don't include password in queries by default
  },
  phone: {
    type: String,
    required: true,
    trim: true
  },
  role: {
    type: String,
    required: true,
    enum: ['field_officer', 'tapper', 'latex_collector', 'skilled_worker', 'trainer', 'supervisor', 'manager'],
    default: 'tapper'
  },
  department: {
    type: String,
    required: true,
    trim: true
  },
  location: {
    type: String,
    required: true,
    trim: true
  },
  avatar: {
    type: String,
    default: ''
  },
  hire_date: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended'],
    default: 'active'
  },
  performance_rating: {
    type: Number,
    min: 0,
    max: 5,
    default: 0
  },
  tasks_completed: {
    type: Number,
    default: 0
  },
  tasks_assigned: {
    type: Number,
    default: 0
  },
  last_active: {
    type: Date,
    default: Date.now
  },
  salary: {
    type: Number,
    default: 0
  },
  address: {
    street: String,
    city: String,
    state: String,
    pincode: String
  },
  emergency_contact: {
    name: String,
    phone: String,
    relationship: String
  },
  skills: [{
    type: String
  }],
  certifications: [{
    name: String,
    issued_date: Date,
    expiry_date: Date,
    issuer: String
  }],
  notes: {
    type: String,
    default: ''
  },
  // Farmer assignments for notification purposes
  assignedFarmers: [{
    farmerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    farmerName: String,
    farmerEmail: String,
    farmerPhone: String,
    assignedDate: {
      type: Date,
      default: Date.now
    },
    assignmentType: {
      type: String,
      enum: ['tapping', 'collection', 'supervision', 'training', 'maintenance'],
      default: 'tapping'
    },
    isActive: {
      type: Boolean,
      default: true
    }
  }],
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false // Temporarily optional to allow staff creation without auth
  },
  updated_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Indexes for better query performance
staffSchema.index({ email: 1 });
staffSchema.index({ role: 1 });
staffSchema.index({ status: 1 });
staffSchema.index({ location: 1 });
staffSchema.index({ department: 1 });

// Virtual for completion rate
staffSchema.virtual('completion_rate').get(function() {
  if (this.tasks_assigned === 0) return 0;
  return Math.round((this.tasks_completed / this.tasks_assigned) * 100);
});

// Method to assign farmer to staff
staffSchema.methods.assignFarmer = function(farmerData, assignmentType = 'tapping') {
  // Check if farmer is already assigned
  const existingAssignment = this.assignedFarmers.find(
    assignment => assignment.farmerId.toString() === farmerData.farmerId.toString()
  );

  if (existingAssignment) {
    existingAssignment.isActive = true;
    existingAssignment.assignmentType = assignmentType;
    existingAssignment.assignedDate = new Date();
  } else {
    this.assignedFarmers.push({
      farmerId: farmerData.farmerId,
      farmerName: farmerData.farmerName,
      farmerEmail: farmerData.farmerEmail,
      farmerPhone: farmerData.farmerPhone,
      assignmentType: assignmentType,
      isActive: true
    });
  }

  return this.save();
};

// Method to unassign farmer from staff
staffSchema.methods.unassignFarmer = function(farmerId) {
  const assignment = this.assignedFarmers.find(
    assignment => assignment.farmerId.toString() === farmerId.toString()
  );

  if (assignment) {
    assignment.isActive = false;
  }

  return this.save();
};

// Method to get active farmer assignments
staffSchema.methods.getActiveFarmers = function() {
  return this.assignedFarmers.filter(assignment => assignment.isActive);
};

// Ensure virtual fields are serialized
staffSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Staff', staffSchema, 'staff');
