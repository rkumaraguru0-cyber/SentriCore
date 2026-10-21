require("dotenv").config();
const connectDB = require("./config/db");
const Device = require("./models/Device");
const FirmwareRelease = require("./models/FirmwareRelease");
const User = require("./models/User");
const bcrypt = require("bcryptjs");

// Defined device list: 3 original + 11 additional = 14 total devices
const INITIAL_DEVICES = [
  // Original 3 devices
  {
    deviceId: "DEV-TS-001",
    name: "Server Room Temperature",
    type: "temperature_sensor",
    ipAddress: "192.168.1.101"
  },
  {
    deviceId: "DEV-CAM-001",
    name: "Main Entrance Camera",
    type: "camera",
    ipAddress: "192.168.1.102"
  },
  {
    deviceId: "DEV-SL-001",
    name: "Server Room Smart Lock",
    type: "smart_lock",
    ipAddress: "192.168.1.103"
  },
  // 11 Additional Unique Devices
  {
    deviceId: "DEV-TS-002",
    name: "Cold Storage Sensor",
    type: "temperature_sensor",
    ipAddress: "192.168.1.104"
  },
  {
    deviceId: "DEV-TS-003",
    name: "HVAC Duct Sensor",
    type: "temperature_sensor",
    ipAddress: "192.168.1.105"
  },
  {
    deviceId: "DEV-CAM-002",
    name: "Perimeter Security Camera",
    type: "camera",
    ipAddress: "192.168.1.106"
  },
  {
    deviceId: "DEV-CAM-003",
    name: "Loading Dock Camera",
    type: "camera",
    ipAddress: "192.168.1.107"
  },
  {
    deviceId: "DEV-CAM-004",
    name: "Parking Garage Camera",
    type: "camera",
    ipAddress: "192.168.1.108"
  },
  {
    deviceId: "DEV-SL-002",
    name: "Data Center Door Lock",
    type: "smart_lock",
    ipAddress: "192.168.1.109"
  },
  {
    deviceId: "DEV-SL-003",
    name: "Executive Suite Smart Lock",
    type: "smart_lock",
    ipAddress: "192.168.1.110"
  },
  {
    deviceId: "DEV-GW-001",
    name: "Building A Core IoT Gateway",
    type: "gateway",
    ipAddress: "192.168.1.111"
  },
  {
    deviceId: "DEV-GW-002",
    name: "Industrial Automation Gateway",
    type: "gateway",
    ipAddress: "192.168.1.112"
  },
  {
    deviceId: "DEV-MED-001",
    name: "ICU Bedside Vital Monitor",
    type: "medical_monitor",
    ipAddress: "192.168.1.113"
  },
  {
    deviceId: "DEV-MED-002",
    name: "Operating Room Vital Monitor",
    type: "medical_monitor",
    ipAddress: "192.168.1.114"
  }
];

const seedDevices = async () => {
  try {
    await connectDB();
    console.log("Seeding SentriCore devices idempotently...");

    let insertedCount = 0;
    let existingCount = 0;

    for (const dev of INITIAL_DEVICES) {
      const result = await Device.updateOne(
        { deviceId: dev.deviceId },
        {
          $setOnInsert: {
            deviceId: dev.deviceId,
            name: dev.name,
            type: dev.type,
            ipAddress: dev.ipAddress,
            status: "offline",
            firmwareVersion: "1.0.0",
            temperature: null,
            battery: null,
            cpuUsage: null,
            networkStatus: null,
            networkLatency: null,
            storageUsage: null,
            lockState: null,
            lastHeartbeat: null
          }
        },
        { upsert: true }
      );

      if (result.upsertedCount > 0) {
        insertedCount++;
      } else {
        existingCount++;
      }
    }

    console.log(
      `Device provisioning complete: ${insertedCount} newly provisioned, ${existingCount} preserved untouched.`
    );

    // Idempotently ensure initial firmware release is available for OTA testing
    const existingRelease = await FirmwareRelease.findOne({ version: "1.1.0" });
    if (!existingRelease) {
      await FirmwareRelease.create({
        version: "1.1.0",
        releaseName: "SentriCore Security Patch 1.1.0",
        description: "Critical security patch addressing TLS encryption and telemetry efficiency.",
        status: "available"
      });
      console.log("Initial firmware release v1.1.0 provisioned.");
    }

    // Ensure default admin user exists
    const existingAdmin = await User.findOne({ email: "admin@sentricore.com" });
    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash("Admin@123", 10);
      await User.create({
        name: "Administrator",
        email: "admin@sentricore.com",
        password: hashedPassword,
        role: "admin"
      });
      console.log("Default admin account provisioned.");
    }

    // Ensure default operator user exists
    const existingOperator = await User.findOne({ email: "operator@sentricore.com" });
    if (!existingOperator) {
      const hashedPassword = await bcrypt.hash("Operator@123", 10);
      await User.create({
        name: "SOC Operator",
        email: "operator@sentricore.com",
        password: hashedPassword,
        role: "operator"
      });
      console.log("Default operator account provisioned.");
    }

    const totalDevices = await Device.countDocuments();
    console.log(`Total devices currently in database: ${totalDevices}`);

    return { insertedCount, existingCount, totalDevices };
  } catch (error) {
    console.error("Device seeding failed:", error.message);
    throw error;
  }
};

if (require.main === module) {
  seedDevices()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = {
  INITIAL_DEVICES,
  seedDevices
};
