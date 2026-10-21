const Incident = require("../models/Incident");
const SecurityEvent = require("../models/SecurityEvent");
const mongoose = require("mongoose");

// Get all incidents
const getIncidents = async (req, res) => {
  try {
    const incidents = await Incident.find()
      .sort({ detectedAt: -1 });

    res.status(200).json({
      success: true,
      count: incidents.length,
      data: incidents
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get a single incident
const getIncidentById = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid incident ID format"
      });
    }

    const incident = await Incident.findById(req.params.id);

    if (!incident) {
      return res.status(404).json({
        success: false,
        message: "Incident not found"
      });
    }

    res.status(200).json({
      success: true,
      data: incident
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Acknowledge an incident (Atomic Transaction)
const acknowledgeIncident = async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid incident ID format"
    });
  }

  let session = null;
  try {
    session = await mongoose.startSession();
  } catch (sessErr) {
    session = null;
  }

  try {
    let incident = null;
    let linkedEvent = null;

    const executeUpdates = async (sess) => {
      const opts = { returnDocument: "after" };
      if (sess) opts.session = sess;

      incident = await Incident.findByIdAndUpdate(
        req.params.id,
        {
          status: "acknowledged",
          acknowledgedAt: new Date()
        },
        opts
      );

      if (!incident) {
        return;
      }

      const eventQuery = incident.sourceEventId
        ? { _id: incident.sourceEventId }
        : { deviceId: incident.deviceId, eventType: incident.sourceEventType, resolved: false };

      linkedEvent = await SecurityEvent.findOneAndUpdate(
        eventQuery,
        { acknowledged: true },
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

    if (!incident) {
      return res.status(404).json({
        success: false,
        message: "Incident not found"
      });
    }

    if (linkedEvent) {
      req.app.get("io")?.emit("security-event:updated", linkedEvent);
    }
    req.app.get("io")?.emit("incident:updated", incident);

    res.status(200).json({
      success: true,
      message: "Incident acknowledged successfully",
      data: incident
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

// Resolve an incident (Atomic Transaction)
const resolveIncident = async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid incident ID format"
    });
  }

  let session = null;
  try {
    session = await mongoose.startSession();
  } catch (sessErr) {
    session = null;
  }

  try {
    let incident = null;
    let linkedEvent = null;

    const executeUpdates = async (sess) => {
      const opts = { returnDocument: "after" };
      if (sess) opts.session = sess;

      incident = await Incident.findByIdAndUpdate(
        req.params.id,
        {
          status: "resolved",
          resolvedAt: new Date()
        },
        opts
      );

      if (!incident) {
        return;
      }

      const eventQuery = incident.sourceEventId
        ? { _id: incident.sourceEventId }
        : { deviceId: incident.deviceId, eventType: incident.sourceEventType, resolved: false };

      linkedEvent = await SecurityEvent.findOneAndUpdate(
        eventQuery,
        { resolved: true, resolvedAt: new Date() },
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

    if (!incident) {
      return res.status(404).json({
        success: false,
        message: "Incident not found"
      });
    }

    if (linkedEvent) {
      req.app.get("io")?.emit("security-event:updated", linkedEvent);
    }
    req.app.get("io")?.emit("incident:updated", incident);

    res.status(200).json({
      success: true,
      message: "Incident resolved successfully",
      data: incident
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
  getIncidents,
  getIncidentById,
  acknowledgeIncident,
  resolveIncident
};