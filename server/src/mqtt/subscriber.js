require("dotenv").config();

const mqtt = require("mqtt");

const connectDB = require("../config/db");
const Device = require("../models/Device");
const SecurityEvent = require("../models/SecurityEvent");
const Incident = require("../models/Incident");
const Firmware = require("../models/Firmware");

const { checkAnomalies, checkAnomalyRecovery } = require("../rules/anomalyRules");


// ==================================================
// START MQTT SUBSCRIBER
// ==================================================

const startSubscriber = (io) => {

  // ------------------------------------------------
  // DATABASE CONNECTION
  // ------------------------------------------------

  connectDB();


  // ------------------------------------------------
  // MQTT CONNECTION
  // ------------------------------------------------

  const MQTT_BROKER = "mqtt://localhost:1883";

  const client = mqtt.connect(MQTT_BROKER, {
    clientId: "sentricore-backend"
  });


  // ------------------------------------------------
  // MQTT CONNECT
  // ------------------------------------------------

  client.on("connect", () => {

    console.log("Backend connected to MQTT broker");


    // Subscribe to device telemetry
    client.subscribe(
      "sentricore/devices/+/telemetry",
      (error) => {

        if (error) {
          console.error(
            "Telemetry subscription failed:",
            error.message
          );

          return;
        }

        console.log(
          "Subscribed to device telemetry"
        );
      }
    );


    // Subscribe to firmware status
    client.subscribe(
      "sentricore/devices/+/firmware/status",
      (error) => {

        if (error) {
          console.error(
            "Firmware status subscription failed:",
            error.message
          );

          return;
        }

        console.log(
          "Subscribed to firmware status"
        );
      }
    );
  });


  // ------------------------------------------------
  // MQTT MESSAGE HANDLING
  // ------------------------------------------------

  const processingLocks = new Set();

  client.on("message", async (topic, message) => {
    try {
      const payload = JSON.parse(message.toString());

      // ==================================================
      // FIRMWARE STATUS HANDLING
      // ==================================================
      if (topic.includes("/firmware/status")) {
        console.log("Firmware status received:", payload);

        const {
          deviceId,
          status,
          progress,
          errorMessage,
          firmwareId
        } = payload;

        if (!deviceId || !status) {
          console.error("Invalid firmware status payload");
          return;
        }

        // Find active firmware update by ID if present, or active record for device
        let firmware = null;
        if (firmwareId) {
          firmware = await Firmware.findById(firmwareId);
        }
        if (!firmware) {
          firmware = await Firmware.findOne({
            deviceId,
            status: {
              $in: [
                "pending",
                "downloading",
                "installing",
                "verifying"
              ]
            }
          }).sort({
            createdAt: -1
          });
        }

        if (!firmware) {
          console.log(`No active firmware update found for ${deviceId}`);
          return;
        }

        firmware.status = status;
        if (progress !== undefined) {
          firmware.progress = progress;
        }
        if (errorMessage !== undefined) {
          firmware.errorMessage = errorMessage;
        }

        if (
          status === "success" ||
          status === "failed" ||
          status === "rolled_back"
        ) {
          firmware.completedAt = new Date();
        }

        await firmware.save();

        if (status === "success") {
          const updatedDevice = await Device.findOneAndUpdate(
            { deviceId },
            { firmwareVersion: firmware.targetVersion },
            { returnDocument: "after" }
          );

          console.log(
            `Device firmware updated: ${deviceId} → ${firmware.targetVersion}`
          );

          if (updatedDevice) {
            io.emit("device:updated", updatedDevice);
          }
        }

        io.emit("firmware:updated", {
          deviceId,
          firmwareId: firmware._id.toString(),
          status,
          progress: progress ?? 0,
          errorMessage: errorMessage ?? null,
          targetVersion: firmware.targetVersion
        });

        console.log(
          `Firmware update tracked: ${deviceId} → ${status} (${progress ?? 0}%)`
        );
        return;
      }

      // ==================================================
      // DEVICE TELEMETRY HANDLING
      // ==================================================
      if (topic.includes("/telemetry")) {
        const telemetry = payload;

        if (!telemetry || !telemetry.deviceId) {
          console.warn("Discarding malformed telemetry: missing deviceId");
          return;
        }

        // ------------------------------------------------
        // UPDATE OR PROVISION DEVICE IN DATABASE
        // ------------------------------------------------
        const device = await Device.findOneAndUpdate(
          { deviceId: telemetry.deviceId },
          {
            $set: {
              status: "online",
              temperature: telemetry.temperature ?? null,
              battery: telemetry.battery ?? null,
              cpuUsage: telemetry.cpuUsage ?? null,
              networkStatus: telemetry.networkStatus ?? null,
              networkLatency: telemetry.networkLatency ?? null,
              storageUsage: telemetry.storageUsage ?? null,
              lockState: telemetry.lockState ?? null,
              lastHeartbeat: new Date()
            },
            $setOnInsert: {
              deviceId: telemetry.deviceId,
              name: telemetry.name || `Device ${telemetry.deviceId}`,
              type: telemetry.type || "temperature_sensor",
              ipAddress: telemetry.ipAddress || null,
              firmwareVersion: "1.0.0"
            }
          },
          {
            returnDocument: "after",
            upsert: true
          }
        );

        if (device) {
          io.emit("device:updated", device);
          telemetry.expectedIpAddress = device.ipAddress;
        }

        // ==================================================
        // RULE-BASED ANOMALY DETECTION
        // ==================================================
        const anomalies = checkAnomalies(telemetry);
        const currentAnomalyTypes = new Set(anomalies.map((a) => a.eventType));

        // ------------------------------------------------
        // ANOMALY RECOVERY DETECTION & RESOLUTION
        // ------------------------------------------------
        // Recover an event ONLY when sufficient valid telemetry demonstrates
        // that its triggering condition has cleared (never on missing/null fields).
        const activeEventsForDevice = await SecurityEvent.find({
          deviceId: telemetry.deviceId,
          isRecovered: false,
        });

        for (const activeEvt of activeEventsForDevice) {
          if (checkAnomalyRecovery(activeEvt.eventType, telemetry)) {
            // Anomaly condition is verified healthy by telemetry -> recovered
            activeEvt.isRecovered = true;
            activeEvt.recoveredAt = new Date();

            // When condition physically recovers, mark resolved and close active incident
            activeEvt.resolved = true;
            activeEvt.resolvedAt = new Date();

            await activeEvt.save();
            console.log(
              `Anomaly recovered & resolved: ${activeEvt.eventType} on ${telemetry.deviceId}`
            );
            io.emit("security-event:updated", activeEvt);

            // Auto-resolve corresponding active incident
            const linkedIncident = await Incident.findOne({
              $or: [
                { sourceEventId: activeEvt._id },
                {
                  deviceId: telemetry.deviceId,
                  sourceEventType: activeEvt.eventType,
                  status: { $in: ["open", "acknowledged"] }
                }
              ]
            });

            if (linkedIncident) {
              linkedIncident.status = "resolved";
              linkedIncident.resolvedAt = new Date();
              await linkedIncident.save();
              io.emit("incident:updated", linkedIncident);
              console.log(
                `Incident ${linkedIncident.incidentId} auto-resolved after recovery.`
              );
            }
          }
        }

        // ------------------------------------------------
        // PROCESS ACTIVE ANOMALIES (DUPLICATE-PROTECTED)
        // ------------------------------------------------
        for (const anomaly of anomalies) {
          const lockKey = `${telemetry.deviceId}:${anomaly.eventType}`;
          if (processingLocks.has(lockKey)) {
            continue;
          }

          try {
            processingLocks.add(lockKey);

            // Check if there is an active event (unrecovered)
            // Crucial: acknowledged: true DOES NOT trigger a duplicate!
            const existingEvent = await SecurityEvent.findOne({
              deviceId: telemetry.deviceId,
              eventType: anomaly.eventType,
              isRecovered: false
            });

            if (existingEvent) {
              // Still continuously active, do not recreate
              continue;
            }

            // Create new Security Event with E11000 duplicate key protection
            let securityEvent = null;
            try {
              securityEvent = await SecurityEvent.create({
                deviceId: telemetry.deviceId,
                eventType: anomaly.eventType,
                severity: anomaly.severity,
                message: anomaly.message,
                value: anomaly.value,
                detectedAt: new Date(),
                acknowledged: false,
                isRecovered: false,
                resolved: false
              });

              console.log(
                `Security Event created: ${anomaly.eventType} on ${telemetry.deviceId}`
              );
              io.emit("security-event:created", securityEvent);
            } catch (eventCreateErr) {
              if (eventCreateErr.code === 11000) {
                console.log(
                  `Duplicate active event suppressed via index constraint for ${telemetry.deviceId}:${anomaly.eventType}`
                );
                securityEvent = await SecurityEvent.findOne({
                  deviceId: telemetry.deviceId,
                  eventType: anomaly.eventType,
                  isRecovered: false
                });
              } else {
                throw eventCreateErr;
              }
            }

            // ==============================================
            // INCIDENT CREATION (DETERMINISTIC & DEDUPED)
            // ==============================================
            const existingIncident = await Incident.findOne({
              deviceId: telemetry.deviceId,
              sourceEventType: anomaly.eventType,
              status: {
                $in: ["open", "acknowledged"]
              }
            });

            if (!existingIncident) {
              let incidentId;
              let attempts = 0;
              while (!incidentId && attempts < 5) {
                attempts++;
                const count = await Incident.countDocuments();
                const candidateId = `INC-${String(count + attempts).padStart(4, "0")}`;
                const exists = await Incident.findOne({ incidentId: candidateId });
                if (!exists) {
                  incidentId = candidateId;
                }
              }
              if (!incidentId) {
                incidentId = `INC-${Date.now().toString().slice(-6)}`;
              }

              try {
                const incident = await Incident.create({
                  incidentId,
                  deviceId: telemetry.deviceId,
                  title: `${anomaly.eventType.replace(/_/g, " ")} detected`,
                  description: anomaly.message,
                  severity: anomaly.severity,
                  status: "open",
                  sourceEventType: anomaly.eventType,
                  sourceEventId: securityEvent ? securityEvent._id : null,
                  detectedAt: securityEvent ? securityEvent.detectedAt : new Date()
                });

                console.log(
                  `Incident created: ${incidentId} for ${telemetry.deviceId}`
                );
                io.emit("incident:created", incident);
              } catch (incidentCreateErr) {
                if (incidentCreateErr.code === 11000) {
                  console.log(
                    `Duplicate active incident suppressed via index constraint for ${telemetry.deviceId}:${anomaly.eventType}`
                  );
                } else {
                  throw incidentCreateErr;
                }
              }
            }
          } finally {
            processingLocks.delete(lockKey);
          }
        }
      }
    } catch (error) {
      console.error("MQTT message processing failed:", error.message);
    }
  });

  client.on("error", (error) => {
    console.error("MQTT error:", error.message);
  });
};


// ==================================================
// EXPORT
// ==================================================

module.exports = {
  startSubscriber
};