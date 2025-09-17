const mongoose = require('mongoose');

const nurseryPlantSchema = new mongoose.Schema({
  name: { type: String, required: true },
  variety: { type: String },
  clone: { type: String },
  origin: { type: String },
  features: { type: String },
  bestFor: { type: String },
  description: { type: String },
  unitPrice: { type: Number, required: true },
  stockAvailable: { type: Number, required: true, default: 0 },
  minOrderQty: { type: Number, default: 1 },
  imageUrl: { type: String },
  nurseryCenterId: { type: mongoose.Schema.Types.ObjectId, ref: 'NurseryCenter', required: true },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('NurseryPlant', nurseryPlantSchema);





