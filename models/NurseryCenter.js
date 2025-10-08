const mongoose = require('mongoose');

const nurseryCenterSchema = new mongoose.Schema({
  name: { type: String, required: true },
  location: { type: String, required: true },
  lat: { type: Number },
  lng: { type: Number },
  contact: { type: String },
  email: { type: String },
  specialty: { type: String },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('NurseryCenter', nurseryCenterSchema);





