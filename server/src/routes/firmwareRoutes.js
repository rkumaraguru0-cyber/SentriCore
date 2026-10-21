const express = require("express");

const {
  startFirmwareUpdate,
  getFirmwareUpdates,
  updateFirmwareStatus
} = require("../controllers/firmwareController");

const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

// Start firmware update
router.post("/", protect, startFirmwareUpdate);

// Get all firmware updates
router.get("/", protect, getFirmwareUpdates);

// Update firmware status/progress
router.patch(
  "/:id/status",
  protect,
  updateFirmwareStatus
);

module.exports = router;