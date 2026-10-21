const Device = require("../models/Device");

// Create a new device
const createDevice = async (req, res) => {
  try {
    const device = await Device.create(req.body);

    res.status(201).json({
      success: true,
      message: "Device created successfully",
      data: device
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Get all devices
const getDevices = async (req, res) => {
  try {
    const devices = await Device.find().sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: devices.length,
      data: devices
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get a single device by id or deviceId
const getDeviceById = async (req, res) => {
  try {
    const isObjectId = req.params.id.match(/^[0-9a-fA-F]{24}$/);
    const query = isObjectId
      ? { $or: [{ _id: req.params.id }, { deviceId: req.params.id }] }
      : { deviceId: req.params.id };

    const device = await Device.findOne(query);

    if (!device) {
      return res.status(404).json({
        success: false,
        message: "Device not found"
      });
    }

    res.status(200).json({
      success: true,
      data: device
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  createDevice,
  getDevices,
  getDeviceById
};