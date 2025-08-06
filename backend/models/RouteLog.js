const mongoose = require('mongoose');

const routeSchema = new mongoose.Schema({
  deliveryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Delivery' },
  agentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  routePath: [{
    lat: Number,
    lng: Number,
    timestamp: Date
  }],
  trafficIncidents: [String],
  rerouted: { type: Boolean, default: false }
});

module.exports = mongoose.model('RouteLog', routeSchema);
