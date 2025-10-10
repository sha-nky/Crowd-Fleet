const RiskAlert = require('../models/RiskAlert');
const Delivery = require('../models/Delivery');

// Create a new risk alert
const createRiskAlert = async (req, res) => {
  try {
    const { source, type, description, severity, location } = req.body;

    const riskAlert = new RiskAlert({
      source,
      type,
      description,
      severity,
      location
    });

    await riskAlert.save();

    res.status(201).json({
      message: 'Risk alert created successfully',
      riskAlert
    });
  } catch (error) {
    console.error('Risk alert creation error:', error);
    res.status(500).json({ message: 'Server error creating risk alert' });
  }
};

// Get all risk alerts
const getAllRiskAlerts = async (req, res) => {
  try {
    const { type, severity, limit = 50 } = req.query;
    const filter = {};

    if (type) filter.type = type;
    if (severity) filter.severity = severity;

    const riskAlerts = await RiskAlert.find(filter)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit));

    res.json(riskAlerts);
  } catch (error) {
    console.error('Fetching risk alerts error:', error);
    res.status(500).json({ message: 'Server error fetching risk alerts' });
  }
};

// Get risk alerts near a location
const getNearbyRiskAlerts = async (req, res) => {
  try {
    const { lat, lng, radius = 10 } = req.query; // radius in km

    if (!lat || !lng) {
      return res.status(400).json({ message: 'Latitude and longitude required' });
    }

    // Convert radius from km to degrees (approximate)
    const radiusInDegrees = radius / 111;

    const riskAlerts = await RiskAlert.find({
      'location.lat': {
        $gte: parseFloat(lat) - radiusInDegrees,
        $lte: parseFloat(lat) + radiusInDegrees
      },
      'location.lng': {
        $gte: parseFloat(lng) - radiusInDegrees,
        $lte: parseFloat(lng) + radiusInDegrees
      }
    }).sort({ timestamp: -1 });

    res.json(riskAlerts);
  } catch (error) {
    console.error('Fetching nearby risk alerts error:', error);
    res.status(500).json({ message: 'Server error fetching nearby risk alerts' });
  }
};

// Get risk alerts affecting deliveries
const getDeliveryAffectedByRisks = async (req, res) => {
  try {
    // Get recent high severity risk alerts
    const recentHighRiskAlerts = await RiskAlert.find({
      severity: 'high',
      timestamp: { $gte: new Date(Date.now() - 2 * 60 * 60 * 1000) } // Last 2 hours
    });

    // Get active deliveries
    const activeDeliveries = await Delivery.find({
      status: { $in: ['assigned', 'in_transit'] }
    }).populate('agentId', 'name');

    // Simple proximity check (in a real app, this would be more sophisticated)
    const affectedDeliveries = activeDeliveries.filter(delivery => {
      return recentHighRiskAlerts.some(alert => {
        if (!delivery.pickupLocation || !delivery.dropoffLocation || !alert.location) {
          return false;
        }

        // Check if risk is near pickup, dropoff, or along the route
        const pickupDistance = calculateDistance(
          delivery.pickupLocation.lat,
          delivery.pickupLocation.lng,
          alert.location.lat,
          alert.location.lng
        );

        const dropoffDistance = calculateDistance(
          delivery.dropoffLocation.lat,
          delivery.dropoffLocation.lng,
          alert.location.lat,
          alert.location.lng
        );

        // If risk is within 5km of pickup or dropoff
        return pickupDistance <= 5 || dropoffDistance <= 5;
      });
    });

    res.json({
      riskAlerts: recentHighRiskAlerts,
      affectedDeliveries
    });
  } catch (error) {
    console.error('Fetching delivery risk analysis error:', error);
    res.status(500).json({ message: 'Server error fetching delivery risk analysis' });
  }
};

// Helper function to calculate distance between two points (in km)
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return d;
};

const deg2rad = (deg) => {
  return deg * (Math.PI / 180);
};

module.exports = {
  createRiskAlert,
  getAllRiskAlerts,
  getNearbyRiskAlerts,
  getDeliveryAffectedByRisks
};