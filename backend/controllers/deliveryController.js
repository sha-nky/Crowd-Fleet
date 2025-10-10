const Delivery = require('../models/Delivery');
const User = require('../models/User');
const RouteLog = require('../models/RouteLog');
const RiskAlert = require('../models/RiskAlert');
const AnalyticsLog = require('../models/AnalyticsLog');

// Create a new delivery request
const createDelivery = async (req, res) => {
  try {
    const { pickupLocation, dropoffLocation, packageDetails } = req.body;
    
    // Calculate estimated price (simplified)
    const price = calculateDeliveryPrice(pickupLocation, dropoffLocation, packageDetails);
    
    const delivery = new Delivery({
      customerId: req.user.userId,
      pickupLocation,
      dropoffLocation,
      packageDetails,
      price
    });

    await delivery.save();

    // Log analytics
    await AnalyticsLog.create({
      event: 'delivery_created',
      deliveryId: delivery._id,
      userId: req.user.userId
    });

    res.status(201).json({
      message: 'Delivery request created successfully',
      delivery
    });
  } catch (error) {
    console.error('Delivery creation error:', error);
    res.status(500).json({ message: 'Server error creating delivery' });
  }
};

// Get all deliveries for a customer
const getCustomerDeliveries = async (req, res) => {
  try {
    const deliveries = await Delivery.find({ customerId: req.user.userId })
      .populate('agentId', 'name phone')
      .sort({ createdAt: -1 });

    res.json(deliveries);
  } catch (error) {
    console.error('Fetching deliveries error:', error);
    res.status(500).json({ message: 'Server error fetching deliveries' });
  }
};

// Get all available deliveries for agents
const getAvailableDeliveries = async (req, res) => {
  try {
    const deliveries = await Delivery.find({ status: 'pending' })
      .populate('customerId', 'name phone')
      .sort({ createdAt: -1 });

    res.json(deliveries);
  } catch (error) {
    console.error('Fetching available deliveries error:', error);
    res.status(500).json({ message: 'Server error fetching available deliveries' });
  }
};

// Get all deliveries assigned to an agent
const getAgentDeliveries = async (req, res) => {
  try {
    const deliveries = await Delivery.find({ agentId: req.user.userId })
      .populate('customerId', 'name phone')
      .sort({ createdAt: -1 });

    res.json(deliveries);
  } catch (error) {
    console.error('Fetching agent deliveries error:', error);
    res.status(500).json({ message: 'Server error fetching agent deliveries' });
  }
};

// Assign delivery to agent
const assignDelivery = async (req, res) => {
  try {
    const { deliveryId } = req.params;
    const agentId = req.user.userId;

    // Check if agent is available
    const agent = await User.findById(agentId);
    if (!agent || !agent.availability) {
      return res.status(400).json({ message: 'Agent not available' });
    }

    // Update delivery
    const delivery = await Delivery.findByIdAndUpdate(
      deliveryId,
      {
        agentId,
        status: 'assigned'
      },
      { new: true }
    ).populate('customerId', 'name phone');

    if (!delivery) {
      return res.status(404).json({ message: 'Delivery not found' });
    }

    // Log analytics
    await AnalyticsLog.create({
      event: 'delivery_assigned',
      deliveryId: delivery._id,
      userId: agentId
    });

    res.json({
      message: 'Delivery assigned successfully',
      delivery
    });
  } catch (error) {
    console.error('Delivery assignment error:', error);
    res.status(500).json({ message: 'Server error assigning delivery' });
  }
};

// Update delivery status
const updateDeliveryStatus = async (req, res) => {
  try {
    const { deliveryId } = req.params;
    const { status, agentLocation } = req.body;

    // First, fetch the delivery to check its current status
    const delivery = await Delivery.findById(deliveryId);
    
    if (!delivery) {
      return res.status(404).json({ message: 'Delivery not found' });
    }

    // Block status updates if delivery is already delivered or cancelled
    if (delivery.status === 'delivered' || delivery.status === 'cancelled') {
      return res.status(400).json({ 
        message: `Cannot update status of a ${delivery.status} delivery` 
      });
    }

    // If status is being updated to 'delivered', verify agent is within 200m of dropoff
    if (status === 'delivered') {
      // Check if agent location is provided
      if (!agentLocation || !agentLocation.lat || !agentLocation.lng) {
        return res.status(400).json({ 
          message: 'Agent location is required to mark delivery as delivered' 
        });
      }

      // Calculate distance between agent and dropoff location
      const distance = calculateDistance(
        agentLocation.lat, agentLocation.lng,
        delivery.dropoffLocation.lat, delivery.dropoffLocation.lng
      );

      // Check if agent is within 200 meters of dropoff
      if (distance > 200) {
        return res.status(400).json({ 
          message: `Agent is ${Math.round(distance)} meters from dropoff point. Must be within 200 meters to mark as delivered.` 
        });
      }
    }

    // Update the delivery status
    const updatedDelivery = await Delivery.findByIdAndUpdate(
      deliveryId,
      { status, completedAt: status === 'delivered' ? new Date() : undefined },
      { new: true }
    );

    if (!updatedDelivery) {
      return res.status(404).json({ message: 'Delivery not found' });
    }

    // Log analytics
    await AnalyticsLog.create({
      event: `delivery_${status}`,
      deliveryId: updatedDelivery._id,
      userId: req.user.userId
    });

    res.json({
      message: `Delivery status updated to ${status}`,
      delivery: updatedDelivery
    });
  } catch (error) {
    console.error('Delivery status update error:', error);
    res.status(500).json({ message: 'Server error updating delivery status' });
  }
};

// Get delivery by ID
const getDeliveryById = async (req, res) => {
  try {
    console.log('Fetching delivery by ID:', req.params.deliveryId);
    console.log('User info:', req.user);
    
    const delivery = await Delivery.findById(req.params.deliveryId)
      .populate('customerId', 'name phone')
      .populate('agentId', 'name phone');

    if (!delivery) {
      console.log('Delivery not found');
      return res.status(404).json({ message: 'Delivery not found' });
    }

    console.log('Found delivery:', JSON.stringify(delivery, null, 2));
    console.log('Customer ID:', delivery.customerId);
    console.log('Agent ID:', delivery.agentId);

    // Check permissions
    // Convert ObjectIds to strings for comparison
    const customerIdStr = delivery.customerId?._id?.toString();
    const agentIdStr = delivery.agentId?._id?.toString();
    const userIdStr = req.user.userId.toString(); // Convert user ID to string
    
    console.log('Permission check:', {
      userRole: req.user.role,
      userId: userIdStr,
      customerId: customerIdStr,
      agentId: agentIdStr,
      isCustomerMatch: customerIdStr === userIdStr,
      isAgentMatch: agentIdStr === userIdStr,
      isAdmin: req.user.role === 'admin'
    });
    
    // Allow access if user is admin OR if user is the customer OR if user is the assigned agent
    const hasAccess = req.user.role === 'admin' || 
                     customerIdStr === userIdStr || 
                     (agentIdStr && agentIdStr === userIdStr);
    
    console.log('Has access:', hasAccess);
    
    if (!hasAccess) {
      console.log('Access denied for user:', userIdStr);
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json(delivery);
  } catch (error) {
    console.error('Fetching delivery error:', error);
    res.status(500).json({ message: 'Server error fetching delivery' });
  }
};

// Helper function to calculate delivery price
const calculateDeliveryPrice = (pickup, dropoff, packageDetails) => {
  // Simplified pricing logic - in a real app, this would be more complex
  const basePrice = 5.0;
  const distanceFactor = 0.5; // Price per unit distance
  const weightFactor = 0.1; // Price per kg
  
  // Calculate approximate distance (simplified)
  const distance = Math.sqrt(
    Math.pow(dropoff.lat - pickup.lat, 2) + 
    Math.pow(dropoff.lng - pickup.lng, 2)
  );
  
  const weightPrice = packageDetails.weightKg ? packageDetails.weightKg * weightFactor : 0;
  
  return basePrice + (distance * distanceFactor) + weightPrice;
};

// Helper function to calculate distance between two points in meters using Haversine formula
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3; // Earth radius in meters
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;
  
  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  
  return R * c;
};

module.exports = {
  createDelivery,
  getCustomerDeliveries,
  getAvailableDeliveries,
  assignDelivery,
  updateDeliveryStatus,
  getDeliveryById,
  getAgentDeliveries
};