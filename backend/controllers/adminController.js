const User = require('../models/User');
const Delivery = require('../models/Delivery');
const RiskAlert = require('../models/RiskAlert');

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

module.exports = {
  getAllUsers,
  getAllDeliveries,
  updateUserRole,
  deleteUser
};