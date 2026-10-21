const mongoose = require("mongoose");

let isConnecting = false;

const connectDB = async () => {
  // 1 = connected, 2 = connecting
  if (mongoose.connection.readyState >= 1) {
    return mongoose.connection;
  }

  if (isConnecting) {
    return;
  }

  try {
    isConnecting = true;
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("MongoDB connected successfully");
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  } finally {
    isConnecting = false;
  }
};

module.exports = connectDB;