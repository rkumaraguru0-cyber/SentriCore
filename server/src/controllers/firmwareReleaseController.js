const FirmwareRelease = require("../models/FirmwareRelease");
const Device = require("../models/Device");

const {
  checkFirmwareUpdate,
} = require("../services/firmwareVersionService");

// Create firmware release
const createFirmwareRelease = async (req, res) => {
  try {
    const {
      version,
      releaseName,
      description,
    } = req.body;

    if (!version || !releaseName) {
      return res.status(400).json({
        success: false,
        message:
          "version and releaseName are required",
      });
    }

    const existingRelease =
      await FirmwareRelease.findOne({
        version,
      });

    if (existingRelease) {
      return res.status(409).json({
        success: false,
        message:
          "Firmware release with this version already exists",
      });
    }

    const release =
      await FirmwareRelease.create({
        version,
        releaseName,
        description,
      });

    res.status(201).json({
      success: true,
      message:
        "Firmware release created successfully",
      data: release,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get all firmware releases
const getFirmwareReleases = async (req, res) => {
  try {
    const releases = await FirmwareRelease.find()
      .sort({ releasedAt: -1 });

    res.status(200).json({
      success: true,
      count: releases.length,
      data: releases,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Check firmware update for a device
const checkDeviceFirmwareUpdate = async (
  req,
  res
) => {
  try {
    const { deviceId } = req.params;

    const device = await Device.findOne({
      deviceId,
    });

    if (!device) {
      return res.status(404).json({
        success: false,
        message: "Device not found",
      });
    }

    const result = await checkFirmwareUpdate(
      device.firmwareVersion
    );

    res.status(200).json({
      success: true,
      data: {
        deviceId: device.deviceId,
        deviceName: device.name,
        currentVersion:
          result.currentVersion,
        latestVersion:
          result.latestVersion,
        updateAvailable:
          result.updateAvailable,
        release: result.release,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  createFirmwareRelease,
  getFirmwareReleases,
  checkDeviceFirmwareUpdate,
};