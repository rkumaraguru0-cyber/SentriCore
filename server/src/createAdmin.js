require("dotenv").config();

const bcrypt = require("bcryptjs");

const connectDB = require("./config/db");
const User = require("./models/User");

const createAdmin = async () => {
  try {
    await connectDB();

    const existingUser = await User.findOne({
      email: "admin@sentricore.com",
    });

    if (existingUser) {
      console.log("Admin user already exists");
      process.exit(0);
    }

    const hashedPassword = await bcrypt.hash(
      "Admin@123",
      10
    );

    await User.create({
      name: "Administrator",
      email: "admin@sentricore.com",
      password: hashedPassword,
      role: "admin",
    });

    console.log("Admin user created successfully");
    console.log("Email: admin@sentricore.com");
    console.log("Password: Admin@123");

    process.exit(0);
  } catch (error) {
    console.error("Admin creation failed:", error.message);
    process.exit(1);
  }
};

createAdmin();