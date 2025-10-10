const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load environment variables
const result = dotenv.config();

if (result.error) {
  console.error('Error loading .env file:', result.error);
}

const DB = process.env.MONGO_URI;

// Check if DB URI is loaded
if (!DB) {
  console.error('MONGO_URI not found in environment variables');
  process.exit(1);
}

console.log('Attempting to connect to MongoDB...');

mongoose.connect(DB, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log("MongoDB connected successfully"))
.catch((err) => {
  console.error("MongoDB connection error:", err);
  process.exit(1);
});
