const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: String,
  password: { type: String, required: true },
  role: {
    type: String,
    enum: ['admin', 'customer', 'agent'],
    default: 'customer'
  },
  location: {
    lat: Number,
    lng: Number
  },
  availability: { type: Boolean, default: true }, // Specific to agents
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);
