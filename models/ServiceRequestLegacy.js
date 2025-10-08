const mongoose = require('mongoose');

// This legacy model points to the lowercased default collection name
// that older deployments might have used ("servicerequests").
// It mirrors the core fields we need for read operations.
const legacySchema = new mongoose.Schema({
  requestId: String,
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  farmerName: String,
  farmerEmail: String,
  serviceType: String,
  title: String,
  farmLocation: String,
  farmSize: String,
  numberOfTrees: String,
  lastFertilizerDate: String,
  fertilizerType: String,
  rainGuardType: String,
  urgency: String,
  preferredDate: String,
  ratePerTree: String,
  specialRequirements: String,
  contactPhone: String,
  contactEmail: String,
  documents: [
    {
      name: String,
      url: String,
      uploadDate: Date
    }
  ],
  status: String,
  assignedProvider: {
    providerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    name: String,
    contact: String,
    rating: Number,
    experience: String,
    assignedDate: Date
  },
  reviewedBy: {
    workerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    workerName: String,
    reviewDate: Date,
    reviewNotes: String
  },
  submittedDate: Date,
  approvedDate: Date,
  completedDate: Date,
  estimatedCost: Number,
  finalCost: Number,
  farmerFeedback: {
    rating: Number,
    comment: String,
    feedbackDate: Date
  },
  notifications: [
    {
      type: String,
      sentDate: Date,
      emailSent: Boolean
    }
  ],
  negotiation: {
    staffProposal: Object,
    farmerCounter: Object,
    history: Array,
    awaiting: String
  }
}, {
  collection: 'servicerequests',
  timestamps: true
});

module.exports = mongoose.model('ServiceRequestLegacy', legacySchema);


