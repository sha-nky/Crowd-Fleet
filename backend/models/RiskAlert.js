const mongoose = require('mongoose');

const riskAlertSchema = new mongoose.Schema({
  source: String,
  type: String, // e.g., 'protest', 'accident', 'natural_disaster'
  description: String,
  severity: { type: String, enum: ['low', 'medium', 'high'], default: 'low' },
  location: {
    lat: Number,
    lng: Number
  },
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('RiskAlert', riskAlertSchema);
