const mongoose = require("mongoose");

const incidentSchema = new mongoose.Schema(
  {
    incidentId: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },

    deviceId: {
      type: String,
      required: true,
      trim: true
    },

    title: {
      type: String,
      required: true,
      trim: true
    },

    description: {
      type: String,
      required: true,
      trim: true
    },

    severity: {
      type: String,
      required: true,
      enum: ["low", "medium", "high", "critical"]
    },

    status: {
      type: String,
      enum: ["open", "acknowledged", "resolved"],
      default: "open"
    },

    sourceEventType: {
      type: String,
      required: true,
      trim: true
    },

    sourceEventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SecurityEvent",
      default: null
    },

    detectedAt: {
      type: Date,
      default: Date.now
    },

    acknowledgedAt: {
      type: Date,
      default: null
    },

    resolvedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

incidentSchema.index(
  { deviceId: 1, sourceEventType: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: ["open", "acknowledged"] }
    }
  }
);

module.exports = mongoose.model("Incident", incidentSchema);