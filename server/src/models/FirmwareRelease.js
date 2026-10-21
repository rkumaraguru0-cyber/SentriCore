const mongoose = require("mongoose");

const firmwareReleaseSchema = new mongoose.Schema(
  {
    version: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    releaseName: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      default: "",
      trim: true,
    },

    status: {
      type: String,
      enum: ["available", "deprecated"],
      default: "available",
    },

    releasedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model(
  "FirmwareRelease",
  firmwareReleaseSchema
);