const mongoose = require("mongoose");

const securityEventSchema = new mongoose.Schema(
  {
    deviceId: {
      type: String,
      required: true,
      trim: true
    },

    eventType: {
      type: String,
      required: true,
      enum: [
        "high_temperature",
        "high_cpu",
        "low_battery",
        "unknown_ip",
        "network_disconnected",
        "network_degraded",
        "high_network_latency",
        "high_storage_usage",
        "smart_lock_jammed",
        "brute_force_attack"
      ]
    },

    severity: {
      type: String,
      required: true,
      enum: ["low", "medium", "high", "critical"]
    },

    message: {
      type: String,
      required: true,
      trim: true
    },

    value: {
      type: Number,
      default: null
    },

    detectedAt: {
      type: Date,
      default: Date.now
    },

    acknowledged: {
      type: Boolean,
      default: false
    },

    isRecovered: {
      type: Boolean,
      default: false
    },

    recoveredAt: {
      type: Date,
      default: null
    },

    resolved: {
      type: Boolean,
      default: false
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

securityEventSchema.index(
  { deviceId: 1, eventType: 1 },
  {
    unique: true,
    partialFilterExpression: { isRecovered: false }
  }
);

securityEventSchema.index({ deviceId: 1, eventType: 1, resolved: 1 });

module.exports = mongoose.model("SecurityEvent", securityEventSchema);