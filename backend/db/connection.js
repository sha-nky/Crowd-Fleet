const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const DB = process.env.MONGO_URI;

mongoose.connect(DB, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log("MongoDB connected successfully"))
.catch((err) => console.error("MongoDB connection error:", err));
