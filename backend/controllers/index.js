const sampleController = require('./sampleController');
const authController = require('./authController');
const deliveryController = require('./deliveryController');
const analyticsController = require('./analyticsController');
const riskController = require('./riskController');
const adminController = require('./adminController');

module.exports = {
  ...sampleController,
  ...authController,
  ...deliveryController,
  ...analyticsController,
  ...riskController,
  ...adminController
};
