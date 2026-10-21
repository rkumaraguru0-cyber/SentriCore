const mongoose = require("mongoose");

const firmwareSchema = new mongoose.Schema(
  {
    deviceId: {
      type: String,
      required: true,
      trim: true
    },

    currentVersion: {
      type: String,
      required: true,
      trim: true
    },

    targetVersion: {
      type: String,
      required: true,
      trim: true
    },

    status: {
      type: String,
      enum: [
        "pending",
        "downloading",
        "installing",
        "verifying",
        "success",
        "failed",
        "rolled_back"
      ],
      default: "pending"
    },

    progress: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    },

    errorMessage: {
      type: String,
      default: null
    },

    startedAt: {
      type: Date,
      default: null
    },

    completedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Firmware", firmwareSchema);