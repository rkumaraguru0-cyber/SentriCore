const mqtt = require("mqtt");

const MQTT_BROKER = "mqtt://localhost:1883";
const TELEMETRY_INTERVAL = 10000;

const devices = [
  // Original 3 devices
  {
    deviceId: "DEV-TS-001",
    name: "Server Room Temperature",
    type: "temperature_sensor",
    ipAddress: "192.168.1.101"
  },
  {
    deviceId: "DEV-CAM-001",
    name: "Main Entrance Camera",
    type: "camera",
    ipAddress: "192.168.1.102"
  },
  {
    deviceId: "DEV-SL-001",
    name: "Server Room Smart Lock",
    type: "smart_lock",
    ipAddress: "192.168.1.103"
  },
  // 11 Additional Unique Devices (Total 14)
  {
    deviceId: "DEV-TS-002",
    name: "Cold Storage Sensor",
    type: "temperature_sensor",
    ipAddress: "192.168.1.104"
  },
  {
    deviceId: "DEV-TS-003",
    name: "HVAC Duct Sensor",
    type: "temperature_sensor",
    ipAddress: "192.168.1.105"
  },
  {
    deviceId: "DEV-CAM-002",
    name: "Perimeter Security Camera",
    type: "camera",
    ipAddress: "192.168.1.106"
  },
  {
    deviceId: "DEV-CAM-003",
    name: "Loading Dock Camera",
    type: "camera",
    ipAddress: "192.168.1.107"
  },
  {
    deviceId: "DEV-CAM-004",
    name: "Parking Garage Camera",
    type: "camera",
    ipAddress: "192.168.1.108"
  },
  {
    deviceId: "DEV-SL-002",
    name: "Data Center Door Lock",
    type: "smart_lock",
    ipAddress: "192.168.1.109"
  },
  {
    deviceId: "DEV-SL-003",
    name: "Executive Suite Smart Lock",
    type: "smart_lock",
    ipAddress: "192.168.1.110"
  },
  {
    deviceId: "DEV-GW-001",
    name: "Building A Core IoT Gateway",
    type: "gateway",
    ipAddress: "192.168.1.111"
  },
  {
    deviceId: "DEV-GW-002",
    name: "Industrial Automation Gateway",
    type: "gateway",
    ipAddress: "192.168.1.112"
  },
  {
    deviceId: "DEV-MED-001",
    name: "ICU Bedside Vital Monitor",
    type: "medical_monitor",
    ipAddress: "192.168.1.113"
  },
  {
    deviceId: "DEV-MED-002",
    name: "Operating Room Vital Monitor",
    type: "medical_monitor",
    ipAddress: "192.168.1.114"
  }
];

const clients = new Map();
const deviceIntervals = new Map();
const firmwareUpdates = new Set();
const transientAnomalies = new Map();

function createTelemetry(device) {
  // Check if a transient test anomaly is queued for this device
  if (transientAnomalies.has(device.deviceId)) {
    const override = transientAnomalies.get(device.deviceId);
    transientAnomalies.delete(device.deviceId);
    console.log(`[${device.deviceId}] Injecting transient test anomaly:`, override);
    return {
      deviceId: device.deviceId,
      name: device.name,
      type: device.type,
      ipAddress: device.ipAddress,
      battery: 90,
      cpuUsage: 25,
      timestamp: new Date().toISOString(),
      ...override
    };
  }

  const common = {
    deviceId: device.deviceId,
    name: device.name,
    type: device.type,
    ipAddress: device.ipAddress,
    battery: Math.floor(85 + Math.random() * 15),
    cpuUsage: Math.floor(20 + Math.random() * 30),
    timestamp: new Date().toISOString()
  };

  if (device.type === "temperature_sensor") {
    return {
      ...common,
      temperature: Number((22 + Math.random() * 8).toFixed(2))
    };
  }

  if (device.type === "camera") {

    return {
      ...common,
      networkStatus: "connected",
      networkLatency: Math.floor(30 + Math.random() * 120),
      storageUsage: Number((40 + Math.random() * 35).toFixed(2))
    };
  }

  if (device.type === "smart_lock") {
    return {
      ...common,
      lockState: Math.random() < 0.8 ? "locked" : "unlocked"
    };
  }

  if (device.type === "gateway") {
    return {
      ...common,
      networkStatus: "connected",
      networkLatency: Math.floor(15 + Math.random() * 30),
      storageUsage: Number((30 + Math.random() * 30).toFixed(2))
    };
  }

  if (device.type === "medical_monitor") {
    return {
      ...common,
      temperature: Number((36.5 + Math.random() * 0.7).toFixed(1)),
      networkStatus: "connected",
      networkLatency: Math.floor(20 + Math.random() * 25)
    };
  }

  return common;
}

function publishTelemetry(device, client) {
  const telemetry = createTelemetry(device);
  const topic = `sentricore/devices/${device.deviceId}/telemetry`;

  client.publish(topic, JSON.stringify(telemetry), (error) => {
    if (error) {
      console.error(`[${device.deviceId}] Telemetry publish failed:`, error.message);
      return;
    }

    console.log(`[${device.deviceId}] Telemetry published:`, telemetry);
  });
}

function publishFirmwareStatus(
  device,
  client,
  status,
  progress,
  errorMessage = null,
  firmwareId = null
) {
  const topic = `sentricore/devices/${device.deviceId}/firmware/status`;

  const payload = {
    deviceId: device.deviceId,
    firmwareId,
    status,
    progress,
    errorMessage,
    timestamp: new Date().toISOString()
  };

  client.publish(topic, JSON.stringify(payload), (error) => {
    if (error) {
      console.error(`[${device.deviceId}] Firmware status publish failed:`, error.message);
      return;
    }

    console.log(`[${device.deviceId}] Firmware status published:`, payload);
  });
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function simulateFirmwareUpdate(device, client, targetVersion, firmwareId = null) {
  if (firmwareUpdates.has(device.deviceId)) {
    console.log(`[${device.deviceId}] Firmware update already in progress; ignoring new command.`);
    return;
  }

  firmwareUpdates.add(device.deviceId);

  try {
    console.log(`[${device.deviceId}] Starting firmware update to ${targetVersion} (firmwareId: ${firmwareId})`);

    publishFirmwareStatus(device, client, "downloading", 25, null, firmwareId);
    await wait(2500);

    publishFirmwareStatus(device, client, "installing", 50, null, firmwareId);
    await wait(2500);

    publishFirmwareStatus(device, client, "verifying", 90, null, firmwareId);
    await wait(2000);

    // Support simulated failure if target version specifies fail
    if (targetVersion.includes("fail")) {
      throw new Error("Simulated checksum verification failed");
    }

    publishFirmwareStatus(device, client, "success", 100, null, firmwareId);
    console.log(`[${device.deviceId}] Firmware update simulation completed: ${targetVersion}`);
  } catch (error) {
    publishFirmwareStatus(device, client, "failed", 0, error.message, firmwareId);
    console.error(`[${device.deviceId}] Firmware update failed:`, error.message);
  } finally {
    firmwareUpdates.delete(device.deviceId);
  }
}

function startDevice(device) {
  const client = mqtt.connect(MQTT_BROKER, {
    clientId: `simulator-${device.deviceId}`
  });

  clients.set(device.deviceId, client);

  client.on("connect", () => {
    console.log(`[${device.deviceId}] Connected to MQTT broker`);

    const firmwareCommandTopic = `sentricore/devices/${device.deviceId}/firmware/update`;
    const testAnomalyTopic = `sentricore/devices/${device.deviceId}/test-anomaly`;

    client.subscribe([firmwareCommandTopic, testAnomalyTopic], (error) => {
      if (error) {
        console.error(`[${device.deviceId}] Subscription failed:`, error.message);
        return;
      }
      console.log(`[${device.deviceId}] Subscribed to commands: ${firmwareCommandTopic}`);
    });

    // Clear existing interval to avoid duplicate intervals upon reconnection
    if (deviceIntervals.has(device.deviceId)) {
      clearInterval(deviceIntervals.get(device.deviceId));
    }

    publishTelemetry(device, client);

    const intervalId = setInterval(() => {
      if (client.connected) {
        publishTelemetry(device, client);
      }
    }, TELEMETRY_INTERVAL);

    deviceIntervals.set(device.deviceId, intervalId);
  });

  client.on("message", async (topic, message) => {
    const firmwareCommandTopic = `sentricore/devices/${device.deviceId}/firmware/update`;
    const testAnomalyTopic = `sentricore/devices/${device.deviceId}/test-anomaly`;

    if (topic === firmwareCommandTopic) {
      try {
        const command = JSON.parse(message.toString());
        console.log(`[${device.deviceId}] Firmware command received:`, command);

        if (!command.targetVersion) {
          console.error(`[${device.deviceId}] Firmware command missing targetVersion`);
          return;
        }

        await simulateFirmwareUpdate(
          device,
          client,
          command.targetVersion,
          command.firmwareId || null
        );
      } catch (error) {
        console.error(`[${device.deviceId}] Firmware command processing failed:`, error.message);
      }
    } else if (topic === testAnomalyTopic) {
      try {
        const anomalyPayload = JSON.parse(message.toString());
        console.log(`[${device.deviceId}] Queuing transient anomaly test:`, anomalyPayload);
        transientAnomalies.set(device.deviceId, anomalyPayload);
        // Publish immediately to trigger test event
        publishTelemetry(device, client);
      } catch (error) {
        console.error(`[${device.deviceId}] Anomaly test payload error:`, error.message);
      }
    }
  });

  client.on("error", (error) => {
    console.error(`[${device.deviceId}] MQTT error:`, error.message);
  });

  client.on("close", () => {
    console.log(`[${device.deviceId}] MQTT connection closed`);
  });
}

devices.forEach(startDevice);

process.on("SIGINT", () => {
  console.log("\nStopping SentriCore device simulators...");

  for (const interval of deviceIntervals.values()) {
    clearInterval(interval);
  }

  for (const client of clients.values()) {
    client.end();
  }

  process.exit(0);
});

module.exports = {
  devices,
  createTelemetry
};
