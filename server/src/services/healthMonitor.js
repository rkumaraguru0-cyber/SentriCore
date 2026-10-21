const Device = require("../models/Device");

const HEARTBEAT_TIMEOUT = 60 * 1000; // 1 minute
let monitorIntervalId = null;

const checkDeviceHealth = async (io) => {
  try {
    const timeoutTime = new Date(Date.now() - HEARTBEAT_TIMEOUT);

    const offlineDevices = await Device.find({
      status: {
        $ne: "offline"
      },
      $or: [
        {
          lastHeartbeat: {
            $ne: null,
            $lt: timeoutTime
          }
        },
        {
          $and: [
            { lastHeartbeat: null },
            { createdAt: { $lt: timeoutTime } }
          ]
        }
      ]
    });

    if (offlineDevices.length === 0) {
      return;
    }

    const deviceIds = offlineDevices.map((device) => device._id);

    await Device.updateMany(
      {
        _id: {
          $in: deviceIds
        }
      },
      {
        $set: {
          status: "offline"
        }
      }
    );

    for (const device of offlineDevices) {
      const updatedDevice = {
        ...device.toObject(),
        status: "offline"
      };

      if (io) {
        io.emit("device:updated", updatedDevice);
      }

      console.log(
        `Health Monitor: ${device.deviceId} marked offline`
      );
    }
  } catch (error) {
    console.error("Health Monitor error:", error.message);
  }
};

const startHealthMonitor = (io) => {
  if (monitorIntervalId) {
    clearInterval(monitorIntervalId);
  }

  console.log("Device health monitor started");
  checkDeviceHealth(io);

  monitorIntervalId = setInterval(() => {
    checkDeviceHealth(io);
  }, 10000);
};

module.exports = {
  checkDeviceHealth,
  startHealthMonitor
};