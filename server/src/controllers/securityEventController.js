const SecurityEvent = require("../models/SecurityEvent");
const Incident = require("../models/Incident");
const mongoose = require("mongoose");

// Get all security events
const getSecurityEvents = async (req, res) => {
  try {
    const events = await SecurityEvent.find()
      .sort({ detectedAt: -1 });

    res.status(200).json({
      success: true,
      count: events.length,
      data: events
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Acknowledge a security event (Atomic Transaction)
const acknowledgeSecurityEvent = async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid security event ID format"
    });
  }

  let session = null;
  try {
    session = await mongoose.startSession();
  } catch (sessErr) {
    session = null;
  }

  try {
    let event = null;
    let linkedIncident = null;

    const executeUpdates = async (sess) => {
      const opts = { returnDocument: "after" };
      if (sess) opts.session = sess;

      event = await SecurityEvent.findByIdAndUpdate(
        req.params.id,
        {
          acknowledged: true
        },
        opts
      );

      if (!event) {
        return;
      }

      linkedIncident = await Incident.findOneAndUpdate(
        {
          $or: [
            { sourceEventId: event._id },
            { deviceId: event.deviceId, sourceEventType: event.eventType }
          ],
          status: "open"
        },
        {
          status: "acknowledged",
          acknowledgedAt: new Date()
        },
        opts
      );
    };

    if (session) {
      try {
        await session.withTransaction(async () => {
          await executeUpdates(session);
        });
      } catch (txErr) {
        if (txErr.message && txErr.message.includes("Transaction numbers are only allowed")) {
          await executeUpdates(null);
        } else {
          throw txErr;
        }
      }
    } else {
      await executeUpdates(null);
    }

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Security event not found"
      });
    }

    if (linkedIncident) {
      req.app.get("io")?.emit("incident:updated", linkedIncident);
    }
    req.app.get("io")?.emit("security-event:updated", event);

    res.status(200).json({
      success: true,
      message: "Security event acknowledged successfully",
      data: event
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  } finally {
    if (session) {
      await session.endSession();
    }
  }
};

// Resolve a security event (Atomic Transaction)
// Note: An operator can resolve an event manually even if physical telemetry has not yet
// returned to normal (isRecovered stays false until verified by telemetry).
const resolveSecurityEvent = async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid security event ID format"
    });
  }

  let session = null;
  try {
    session = await mongoose.startSession();
  } catch (sessErr) {
    session = null;
  }

  try {
    let event = null;
    let linkedIncident = null;

    const executeUpdates = async (sess) => {
      const opts = { returnDocument: "after" };
      if (sess) opts.session = sess;

      event = await SecurityEvent.findByIdAndUpdate(
        req.params.id,
        {
          resolved: true,
          resolvedAt: new Date()
        },
        opts
      );

      if (!event) {
        return;
      }

      linkedIncident = await Incident.findOneAndUpdate(
        {
          $or: [
            { sourceEventId: event._id },
            { deviceId: event.deviceId, sourceEventType: event.eventType }
          ],
          status: { $in: ["open", "acknowledged"] }
        },
        {
          status: "resolved",
          resolvedAt: new Date()
        },
        opts
      );
    };

    if (session) {
      try {
        await session.withTransaction(async () => {
          await executeUpdates(session);
        });
      } catch (txErr) {
        if (txErr.message && txErr.message.includes("Transaction numbers are only allowed")) {
          await executeUpdates(null);
        } else {
          throw txErr;
        }
      }
    } else {
      await executeUpdates(null);
    }

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Security event not found"
      });
    }

    if (linkedIncident) {
      req.app.get("io")?.emit("incident:updated", linkedIncident);
    }
    req.app.get("io")?.emit("security-event:updated", event);

    res.status(200).json({
      success: true,
      message: "Security event resolved successfully",
      data: event
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  } finally {
    if (session) {
      await session.endSession();
    }
  }
};

module.exports = {
  getSecurityEvents,
  acknowledgeSecurityEvent,
  resolveSecurityEvent
};