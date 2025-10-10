const express = require("express");
const { 
  getSample,
  register,
  login,
  getProfile,
  updateProfile,
  createDelivery,
  getCustomerDeliveries,
  getAvailableDeliveries,
  assignDelivery,
  updateDeliveryStatus,
  getDeliveryById,
  getDashboardStats,
  getDeliveryAnalytics,
  getAgentPerformance,
  getAgentDeliveries,
  createRiskAlert,
  getAllRiskAlerts,
  getNearbyRiskAlerts,
  getDeliveryAffectedByRisks,
  getAllUsers,
  getAllDeliveries,
  updateUserRole,
  deleteUser
} = require('../controllers');

const { auth, authorizeRoles } = require('../middleware/authMiddleware');

const router = new express.Router();

// Public routes
router.get('/', (req, res) => {
    res.send('Welcome to the Crowd-Fleet API!');
});

router.get('/api/sample', getSample);

// Auth routes
router.post('/api/auth/register', register);
router.post('/api/auth/login', login);

// Protected routes
router.get('/api/profile', auth, getProfile);
router.put('/api/profile', auth, updateProfile);

// Delivery routes
router.post('/api/deliveries', auth, createDelivery);
router.get('/api/deliveries/customer', auth, getCustomerDeliveries);
router.get('/api/deliveries/agent', auth, authorizeRoles('agent'), getAgentDeliveries);
router.get('/api/deliveries/available', auth, authorizeRoles('agent'), getAvailableDeliveries);
router.put('/api/deliveries/:deliveryId/assign', auth, authorizeRoles('agent'), assignDelivery);
router.put('/api/deliveries/:deliveryId/status', auth, updateDeliveryStatus);
router.get('/api/deliveries/:deliveryId', auth, getDeliveryById);

// Analytics routes
router.get('/api/analytics/dashboard', auth, authorizeRoles('admin'), getDashboardStats);
router.get('/api/analytics/deliveries', auth, authorizeRoles('admin'), getDeliveryAnalytics);
router.get('/api/analytics/agents', auth, authorizeRoles('admin'), getAgentPerformance);

// Risk routes
router.post('/api/risk/alerts', auth, authorizeRoles('admin'), createRiskAlert);
router.get('/api/risk/alerts', getAllRiskAlerts);
router.get('/api/risk/nearby', getNearbyRiskAlerts);
router.get('/api/risk/affecting-deliveries', auth, authorizeRoles('admin'), getDeliveryAffectedByRisks);

// Admin routes
router.get('/api/admin/users', auth, authorizeRoles('admin'), getAllUsers);
router.get('/api/admin/deliveries', auth, authorizeRoles('admin'), getAllDeliveries);
router.put('/api/admin/users/:userId/role', auth, authorizeRoles('admin'), updateUserRole);
router.delete('/api/admin/users/:userId', auth, authorizeRoles('admin'), deleteUser);

module.exports = router;
