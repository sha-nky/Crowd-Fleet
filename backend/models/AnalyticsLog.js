const mongoose = require('mongoose');

const analyticsLogSchema = new mongoose.Schema({
  event: String, // e.g., 'delivery_assigned', 'risk_detected'
  deliveryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Delivery' },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  timestamp: { type: Date, default: Date.now },
  meta: mongoose.Schema.Types.Mixed
});

module.exports = mongoose.model('AnalyticsLog', analyticsLogSchema);
