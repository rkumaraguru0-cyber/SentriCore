const express = require("express");

const {
  createFirmwareRelease,
  getFirmwareReleases,
  checkDeviceFirmwareUpdate,
} = require("../controllers/firmwareReleaseController");

const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

// Create firmware release
router.post("/", protect, createFirmwareRelease);

// Get all firmware releases
router.get("/", protect, getFirmwareReleases);

// Check firmware update availability for a device
router.get(
  "/device/:deviceId",
  protect,
  checkDeviceFirmwareUpdate
);

module.exports = router;