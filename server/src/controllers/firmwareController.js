const Firmware = require("../models/Firmware");
const Device = require("../models/Device");
const mqtt = require("mqtt");

const MQTT_BROKER = "mqtt://localhost:1883";

const mqttClient = mqtt.connect(MQTT_BROKER, {
  clientId: "sentricore-firmware-controller"
});

mqttClient.on("connect", () => {
  console.log("Firmware controller connected to MQTT broker");
});

mqttClient.on("error", (error) => {
  console.error(
    "Firmware controller MQTT error:",
    error.message
  );
});

// Start firmware update
const startFirmwareUpdate = async (req, res) => {
  try {
    const { deviceId, targetVersion } = req.body;

    if (!deviceId || !targetVersion) {
      return res.status(400).json({
        success: false,
        message: "deviceId and targetVersion are required"
      });
    }

    const device = await Device.findOne({ deviceId });

    if (!device) {
      return res.status(404).json({
        success: false,
        message: "Device not found"
      });
    }

    // Prevent multiple firmware updates for the same device
    const existingUpdate = await Firmware.findOne({
      deviceId,
      status: {
        $in: [
          "pending",
          "downloading",
          "installing",
          "verifying"
        ]
      }
    });

    if (existingUpdate) {
      return res.status(409).json({
        success: false,
        message: "Firmware update already in progress for this device"
      });
    }

    const firmware = await Firmware.create({
      deviceId,
      currentVersion: device.firmwareVersion,
      targetVersion,
      status: "pending",
      progress: 0,
      startedAt: new Date()
    });

    req.app.get("io")?.emit("firmware:updated", {
      deviceId,
      firmwareId: firmware._id.toString(),
      status: "pending",
      progress: 0,
      targetVersion
    });

    // Publish firmware update command to the IoT device
    const firmwareCommandTopic =
      `sentricore/devices/${deviceId}/firmware/update`;

    const firmwareCommand = {
      deviceId,
      targetVersion,
      firmwareId: firmware._id.toString()
    };

    mqttClient.publish(
      firmwareCommandTopic,
      JSON.stringify(firmwareCommand),
      (error) => {
        if (error) {
          console.error(
            "Firmware command publish failed:",
            error.message
          );
          return;
        }

        console.log(
          `Firmware update command published: ${deviceId} → ${targetVersion}`
        );
      }
    );

    res.status(201).json({
      success: true,
      message: "Firmware update created and command published successfully",
      data: firmware
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get all firmware updates
const getFirmwareUpdates = async (req, res) => {
  try {
    const updates = await Firmware.find()
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: updates.length,
      data: updates
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// State transitions map
const VALID_FIRMWARE_TRANSITIONS = {
  pending: ["downloading", "failed"],
  downloading: ["installing", "failed", "rolled_back"],
  installing: ["verifying", "failed", "rolled_back"],
  verifying: ["success", "failed", "rolled_back"],
  success: [],
  failed: [],
  rolled_back: []
};

// Update firmware status and progress
const updateFirmwareStatus = async (req, res) => {
  try {
    const { status, progress, errorMessage } = req.body;

    const allowedStatuses = [
      "pending",
      "downloading",
      "installing",
      "verifying",
      "success",
      "failed",
      "rolled_back"
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid firmware status"
      });
    }

    const firmware = await Firmware.findById(req.params.id);

    if (!firmware) {
      return res.status(404).json({
        success: false,
        message: "Firmware update not found"
      });
    }

    // Enforce valid state transitions
    if (firmware.status !== status) {
      const allowedNext = VALID_FIRMWARE_TRANSITIONS[firmware.status] || [];
      if (!allowedNext.includes(status)) {
        return res.status(400).json({
          success: false,
          message: `Invalid firmware state transition from '${firmware.status}' to '${status}'`
        });
      }
    }

    // Update status
    firmware.status = status;

    // Update progress if provided
    if (progress !== undefined) {
      firmware.progress = progress;
    }

    // Update error message if provided
    if (errorMessage !== undefined) {
      firmware.errorMessage = errorMessage;
    }

    // Mark completion time for final states
    if (
      status === "success" ||
      status === "failed" ||
      status === "rolled_back"
    ) {
      firmware.completedAt = new Date();
    }

    await firmware.save();

    // Update device firmware version after successful OTA
    if (status === "success") {
      const updatedDevice = await Device.findOneAndUpdate(
        { deviceId: firmware.deviceId },
        {
          firmwareVersion: firmware.targetVersion
        },
        { returnDocument: "after" }
      );
      if (updatedDevice) {
        req.app.get("io")?.emit("device:updated", updatedDevice);
      }
    }

    req.app.get("io")?.emit("firmware:updated", {
      deviceId: firmware.deviceId,
      firmwareId: firmware._id.toString(),
      status: firmware.status,
      progress: firmware.progress,
      errorMessage: firmware.errorMessage,
      targetVersion: firmware.targetVersion
    });

    res.status(200).json({
      success: true,
      message: "Firmware status updated successfully",
      data: firmware
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  startFirmwareUpdate,
  getFirmwareUpdates,
  updateFirmwareStatus
};