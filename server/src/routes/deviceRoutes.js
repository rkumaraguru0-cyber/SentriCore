const express = require("express");

const {
  createDevice,
  getDevices,
  getDeviceById
} = require("../controllers/deviceController");

const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/", protect, createDevice);
router.get("/", protect, getDevices);
router.get("/:id", protect, getDeviceById);

module.exports = router;