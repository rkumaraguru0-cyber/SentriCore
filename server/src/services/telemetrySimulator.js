const mqtt = require("mqtt");

const MQTT_BROKER = process.env.MQTT_BROKER_URL || "mqtt://localhost:1883";
const TELEMETRY_INTERVAL = 12000; // Publish every 12 seconds

const devices = [
  { deviceId: "DEV-TS-001", name: "Server Room Temperature", type: "temperature_sensor", ipAddress: "192.168.1.101" },
  { deviceId: "DEV-CAM-001", name: "Main Entrance Camera", type: "camera", ipAddress: "192.168.1.102" },
  { deviceId: "DEV-SL-001", name: "Server Room Smart Lock", type: "smart_lock", ipAddress: "192.168.1.103" },
  { deviceId: "DEV-TS-002", name: "Cold Storage Sensor", type: "temperature_sensor", ipAddress: "192.168.1.104" },
  { deviceId: "DEV-TS-003", name: "HVAC Duct Sensor", type: "temperature_sensor", ipAddress: "192.168.1.105" },
  { deviceId: "DEV-CAM-002", name: "Perimeter Security Camera", type: "camera", ipAddress: "192.168.1.106" },
  { deviceId: "DEV-CAM-003", name: "Loading Dock Camera", type: "camera", ipAddress: "192.168.1.107" },
  { deviceId: "DEV-CAM-004", name: "Parking Garage Camera", type: "camera", ipAddress: "192.168.1.108" },
  { deviceId: "DEV-SL-002", name: "Data Center Door Lock", type: "smart_lock", ipAddress: "192.168.1.109" },
  { deviceId: "DEV-SL-003", name: "Executive Suite Smart Lock", type: "smart_lock", ipAddress: "192.168.1.110" },
  { deviceId: "DEV-GW-001", name: "Building A Core IoT Gateway", type: "gateway", ipAddress: "192.168.1.111" },
  { deviceId: "DEV-GW-002", name: "Industrial Automation Gateway", type: "gateway", ipAddress: "192.168.1.112" },
  { deviceId: "DEV-MED-001", name: "ICU Bedside Vital Monitor", type: "medical_monitor", ipAddress: "192.168.1.113" },
  { deviceId: "DEV-MED-002", name: "Operating Room Vital Monitor", type: "medical_monitor", ipAddress: "192.168.1.114" }
];

function generateTelemetry(device) {
  const common = {
    deviceId: device.deviceId,
    name: device.name,
    type: device.type,
    ipAddress: device.ipAddress,
    battery: Math.floor(75 + Math.random() * 24),
    cpuUsage: Math.floor(20 + Math.random() * 30),
    timestamp: new Date().toISOString()
  };

  if (device.type === "temperature_sensor") {
    return {
      ...common,
      temperature: Number((21 + Math.random() * 7).toFixed(1))
    };
  }

  if (device.type === "camera") {
    return {
      ...common,
      networkStatus: "connected",
      networkLatency: Math.floor(25 + Math.random() * 50),
      storageUsage: Number((45 + Math.random() * 30).toFixed(1))
    };
  }

  if (device.type === "smart_lock") {
    return {
      ...common,
      lockState: "locked"
    };
  }

  if (device.type === "gateway") {
    return {
      ...common,
      networkStatus: "connected",
      networkLatency: Math.floor(15 + Math.random() * 25),
      storageUsage: Number((35 + Math.random() * 25).toFixed(1))
    };
  }

  if (device.type === "medical_monitor") {
    return {
      ...common,
      heartRate: Math.floor(68 + Math.random() * 22),
      spO2: Math.floor(96 + Math.random() * 4),
      networkStatus: "connected"
    };
  }

  return common;
}

let simulationTimer = null;
let client = null;

function startTelemetrySimulator() {
  if (client) return;

  client = mqtt.connect(MQTT_BROKER, {
    clientId: "sentricore-embedded-telemetry-simulator",
    reconnectPeriod: 5000,
  });

  client.on("connect", () => {
    console.log("Embedded IoT Telemetry Simulator connected to MQTT broker");

    const broadcast = () => {
      devices.forEach((dev) => {
        const payload = generateTelemetry(dev);
        const topic = `sentricore/devices/${dev.deviceId}/telemetry`;
        client.publish(topic, JSON.stringify(payload), { qos: 0 });
      });
    };

    // Broadcast immediately on connect
    broadcast();

    // Broadcast continuously on interval
    if (simulationTimer) clearInterval(simulationTimer);
    simulationTimer = setInterval(broadcast, TELEMETRY_INTERVAL);
  });

  client.on("error", (err) => {
    if (err.code !== "ECONNREFUSED") {
      console.error("Telemetry simulator MQTT error:", err.message);
    }
  });
}

module.exports = {
  startTelemetrySimulator
};
