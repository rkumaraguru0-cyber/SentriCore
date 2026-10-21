const mongoose = require("mongoose");

const deviceSchema = new mongoose.Schema(
  {
    deviceId: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },

    name: {
      type: String,
      required: true,
      trim: true
    },

    type: {
      type: String,
      required: true,
      enum: [
        "temperature_sensor",
        "camera",
        "smart_lock",
        "gateway",
        "medical_monitor"
      ]
    },

    ipAddress: {
      type: String,
      default: null
    },

    status: {
      type: String,
      enum: ["online", "offline", "warning", "critical"],
      default: "offline"
    },

    // Common telemetry
    temperature: {
      type: Number,
      default: null
    },

    battery: {
      type: Number,
      default: null
    },

    cpuUsage: {
      type: Number,
      default: null
    },

    // Camera and network health
    networkStatus: {
      type: String,
      enum: ["connected", "disconnected", "degraded"],
      default: null
    },

    networkLatency: {
      type: Number,
      default: null
    },

    storageUsage: {
      type: Number,
      default: null
    },

    // Smart lock telemetry
    lockState: {
      type: String,
      enum: ["locked", "unlocked", "jammed"],
      default: null
    },

    firmwareVersion: {
      type: String,
      default: "1.0.0"
    },

    lastHeartbeat: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Device", deviceSchema);