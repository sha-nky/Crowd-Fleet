const AnalyticsLog = require('../models/AnalyticsLog');
const Delivery = require('../models/Delivery');
const User = require('../models/User');
const RiskAlert = require('../models/RiskAlert');

// Get dashboard statistics
const getDashboardStats = async (req, res) => {
  try {
    const totalDeliveries = await Delivery.countDocuments();
    const pendingDeliveries = await Delivery.countDocuments({ status: 'pending' });
    const activeDeliveries = await Delivery.countDocuments({ status: 'in_transit' });
    const completedDeliveries = await Delivery.countDocuments({ status: 'delivered' });
    
    const totalAgents = await User.countDocuments({ role: 'agent' });
    const availableAgents = await User.countDocuments({ role: 'agent', availability: true });
    
    const recentRiskAlerts = await RiskAlert.countDocuments({
      timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    });

    res.json({
      totalDeliveries,
      pendingDeliveries,
      activeDeliveries,
      completedDeliveries,
      totalAgents,
      availableAgents,
      recentRiskAlerts
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ message: 'Server error fetching dashboard stats' });
  }
};

// Get delivery analytics
const getDeliveryAnalytics = async (req, res) => {
  try {
    // Get deliveries by status
    const statusDistribution = await Delivery.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get deliveries by date (last 7 days)
    const deliveryTrend = await Delivery.aggregate([
      {
        $match: {
          createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    res.json({
      statusDistribution,
      deliveryTrend
    });
  } catch (error) {
    console.error('Delivery analytics error:', error);
    res.status(500).json({ message: 'Server error fetching delivery analytics' });
  }
};

// Get agent performance metrics
const getAgentPerformance = async (req, res) => {
  try {
    const agentStats = await Delivery.aggregate([
      {
        $match: {
          status: 'delivered',
          agentId: { $exists: true }
        }
      },
      {
        $group: {
          _id: '$agentId',
          totalDeliveries: { $sum: 1 },
          avgDeliveryTime: { $avg: { $subtract: ['$completedAt', '$createdAt'] } }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'agentInfo'
        }
      },
      {
        $unwind: '$agentInfo'
      },
      {
        $project: {
          _id: 1,
          name: '$agentInfo.name',
          totalDeliveries: 1,
          avgDeliveryTime: { $divide: ['$avgDeliveryTime', 60000] } // Convert to minutes
        }
      },
      {
        $sort: { totalDeliveries: -1 }
      }
    ]);

    res.json(agentStats);
  } catch (error) {
    console.error('Agent performance error:', error);
    res.status(500).json({ message: 'Server error fetching agent performance' });
  }
};

module.exports = {
  getDashboardStats,
  getDeliveryAnalytics,
  getAgentPerformance
};