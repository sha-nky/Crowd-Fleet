const User = require('../models/User');
const Delivery = require('../models/Delivery');
const RiskAlert = require('../models/RiskAlert');
const AnalyticsLog = require('../models/AnalyticsLog');

// Get all users (admin only)
const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json(users);
  } catch (error) {
    console.error('Fetching users error:', error);
    res.status(500).json({ message: 'Server error fetching users' });
  }
};

// Get all deliveries (admin only)
const getAllDeliveries = async (req, res) => {
  try {
    const deliveries = await Delivery.find()
      .populate('customerId', 'name email')
      .populate('agentId', 'name email');
    res.json(deliveries);
  } catch (error) {
    console.error('Fetching deliveries error:', error);
    res.status(500).json({ message: 'Server error fetching deliveries' });
  }
};

// Update user role (admin only)
const updateUserRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    const user = await User.findByIdAndUpdate(
      userId,
      { role },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      message: 'User role updated successfully',
      user
    });
  } catch (error) {
    console.error('Updating user role error:', error);
    res.status(500).json({ message: 'Server error updating user role' });
  }
};

// Delete user (admin only)
const deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findByIdAndDelete(userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Also delete user's deliveries
    await Delivery.deleteMany({ customerId: userId });

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Deleting user error:', error);
    res.status(500).json({ message: 'Server error deleting user' });
  }
};

// Get recent activities (admin only)
const getRecentActivities = async (req, res) => {
  try {
    // Get recent analytics logs (last 24 hours)
    const recentLogs = await AnalyticsLog.find({
      timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    })
    .sort({ timestamp: -1 })
    .limit(10)
    .populate('userId', 'name')
    .populate('deliveryId');

    // Transform logs into activity items
    const activities = recentLogs.map(log => {
      let activityText = '';
      let icon = 'D'; // Default icon
      let iconColor = 'bg-blue-500'; // Default color
      
      switch (log.event) {
        case 'delivery_created':
          activityText = 'New delivery request created';
          icon = 'D';
          iconColor = 'bg-blue-500';
          break;
        case 'delivery_assigned':
          activityText = 'Agent assigned to delivery';
          icon = 'A';
          iconColor = 'bg-green-500';
          break;
        case 'delivery_in_transit':
          activityText = 'Delivery marked as in transit';
          icon = 'T';
          iconColor = 'bg-indigo-500';
          break;
        case 'delivery_delivered':
          activityText = 'Delivery marked as delivered';
          icon = '✓';
          iconColor = 'bg-green-500';
          break;
        case 'risk_detected':
          activityText = 'New risk alert detected';
          icon = 'R';
          iconColor = 'bg-yellow-500';
          break;
        default:
          activityText = log.event.replace('_', ' ');
          icon = 'I';
          iconColor = 'bg-gray-500';
      }
      
      return {
        id: log._id,
        text: activityText,
        timestamp: log.timestamp,
        icon,
        iconColor,
        user: log.userId ? log.userId.name : 'System'
      };
    });

    res.json(activities);
  } catch (error) {
    console.error('Fetching recent activities error:', error);
    res.status(500).json({ message: 'Server error fetching recent activities' });
  }
};

module.exports = {
  getAllUsers,
  getAllDeliveries,
  updateUserRole,
  deleteUser,
  getRecentActivities
};