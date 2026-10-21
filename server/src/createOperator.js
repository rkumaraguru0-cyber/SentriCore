require("dotenv").config();

const bcrypt = require("bcryptjs");
const connectDB = require("./config/db");
const User = require("./models/User");

const createOperator = async () => {
  try {
    await connectDB();

    const existingUser = await User.findOne({
      email: "operator@sentricore.com",
    });

    if (existingUser) {
      console.log("Operator user already exists in database.");
      process.exit(0);
    }

    const hashedPassword = await bcrypt.hash(
      "Operator@123",
      10
    );

    const operator = await User.create({
      name: "SOC Operator",
      email: "operator@sentricore.com",
      password: hashedPassword,
      role: "operator",
    });

    console.log("Operator user created successfully!");
    console.log("ID:", operator._id);
    console.log("Email: operator@sentricore.com");
    console.log("Role:", operator.role);

    process.exit(0);
  } catch (error) {
    console.error("Operator creation failed:", error.message);
    process.exit(1);
  }
};

createOperator();
