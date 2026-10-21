require("dotenv").config();
const jwt = require("jsonwebtoken");
const assert = require("assert");
const { io } = require("socket.io-client");
const mqtt = require("mqtt");
const mongoose = require("mongoose");

const SecurityEvent = require("../src/models/SecurityEvent");
const Incident = require("../src/models/Incident");

async function runLiveE2ETest() {
  console.log("=== SENTRICORE LIVE END-TO-END VERIFICATION AUDIT ===");

  const BASE_URL = "http://localhost:5000";
  const MQTT_URL = "mqtt://localhost:1883";

  // 1. Generate valid test token
  const testToken = jwt.sign(
    { userId: "audit-admin-001", role: "admin" },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
  );

  const authHeaders = {
    Authorization: `Bearer ${testToken}`,
    "Content-Type": "application/json"
  };

  // 2. Test Live HTTP Health Endpoint
  console.log("\n1. Testing Live Backend Health Endpoint...");
  const healthRes = await fetch(`${BASE_URL}/api/health`);
  assert.strictEqual(healthRes.status, 200, "Health check should return 200");
  const healthData = await healthRes.json();
  assert.strictEqual(healthData.success, true);
  console.log("✓ Backend is alive and responsive:", healthData.service);

  // 3. Test Live Devices Endpoint
  console.log("\n2. Testing Devices Endpoints...");
  const devRes = await fetch(`${BASE_URL}/api/devices`, { headers: authHeaders });
  assert.strictEqual(devRes.status, 200, "GET /api/devices should return 200");
  const devData = await devRes.json();
  assert.strictEqual(devData.success, true);
  assert(Array.isArray(devData.data), "Devices data should be an array");
  console.log(`✓ GET /api/devices returned ${devData.data.length} provisioned devices`);

  // 4. Test Live Device By ID Endpoint
  if (devData.data.length > 0) {
    const targetDevId = devData.data[0].deviceId;
    const singleDevRes = await fetch(`${BASE_URL}/api/devices/${targetDevId}`, { headers: authHeaders });
    assert.strictEqual(singleDevRes.status, 200, `GET /api/devices/${targetDevId} should return 200`);
    const singleDevData = await singleDevRes.json();
    assert.strictEqual(singleDevData.success, true);
    assert.strictEqual(singleDevData.data.deviceId, targetDevId);
    console.log(`✓ GET /api/devices/:id returned device ${targetDevId} successfully`);
  }

  // 5. Test Live Socket.IO Connection
  console.log("\n3. Testing Real-Time Socket.IO Live Connection...");
  const socketConnected = await new Promise((resolve, reject) => {
    const socket = io(BASE_URL, {
      transports: ["polling", "websocket"],
      timeout: 5000
    });
    socket.on("connect", () => {
      const socketId = socket.id;
      socket.disconnect();
      resolve(socketId);
    });
    socket.on("connect_error", (err) => {
      socket.disconnect();
      reject(err);
    });
  });
  assert(socketConnected, "Socket.IO must establish connection");
  console.log(`✓ Real-time Socket.IO connected with socket id: ${socketConnected}`);

  // 6. Test Live MQTT Broker Connection & Publish/Subscribe
  console.log("\n4. Testing Real-Time Aedes MQTT Broker Connection...");
  const mqttVerified = await new Promise((resolve, reject) => {
    const mqttClient = mqtt.connect(MQTT_URL, { clientId: "live-e2e-tester" });
    const testTopic = "sentricore/test/e2e-ping";
    const testMsg = JSON.stringify({ ping: "pong", timestamp: Date.now() });

    const timeout = setTimeout(() => {
      mqttClient.end();
      reject(new Error("MQTT Pub/Sub timed out after 5000ms"));
    }, 5000);

    mqttClient.on("connect", () => {
      mqttClient.subscribe(testTopic, (subErr) => {
        if (subErr) {
          clearTimeout(timeout);
          mqttClient.end();
          return reject(subErr);
        }
        mqttClient.publish(testTopic, testMsg);
      });
    });

    mqttClient.on("message", (topic, msg) => {
      if (topic === testTopic) {
        clearTimeout(timeout);
        mqttClient.end();
        resolve(JSON.parse(msg.toString()));
      }
    });

    mqttClient.on("error", (err) => {
      clearTimeout(timeout);
      mqttClient.end();
      reject(err);
    });
  });
  assert.strictEqual(mqttVerified.ping, "pong");
  console.log("✓ Live MQTT broker pub/sub verified successfully");

  // 7. Test Live Security Events & Incidents Synchronization via REST
  console.log("\n5. Testing Live Security Events & Incidents Sync...");
  await mongoose.connect(process.env.MONGODB_URI);

  const testSyncDevId = "TEST-DEV-E2E-LIVE";

  try {
    await SecurityEvent.deleteMany({ deviceId: testSyncDevId });
    await Incident.deleteMany({ deviceId: testSyncDevId });

    const testEvent = await SecurityEvent.create({
      deviceId: testSyncDevId,
      eventType: "high_temperature",
      severity: "high",
      message: "Live E2E temperature alert",
      value: 58.0,
      acknowledged: false,
      isRecovered: false,
      resolved: false
    });

    const testInc = await Incident.create({
      incidentId: `INC-${Date.now().toString().slice(-6)}`,
      deviceId: testSyncDevId,
      title: "High temperature detected",
      description: "Live E2E temperature alert",
      severity: "high",
      status: "open",
      sourceEventType: "high_temperature",
      sourceEventId: testEvent._id
    });

    // Acknowledge incident via live REST API
    const ackIncRes = await fetch(`${BASE_URL}/api/incidents/${testInc._id}/acknowledge`, {
      method: "PATCH",
      headers: authHeaders
    });
    assert.strictEqual(ackIncRes.status, 200, "PATCH /api/incidents/:id/acknowledge should return 200");
    const ackIncData = await ackIncRes.json();
    assert.strictEqual(ackIncData.success, true);
    assert.strictEqual(ackIncData.data.status, "acknowledged");

    // Verify linked SecurityEvent was automatically synchronized in MongoDB
    const syncedEvent = await SecurityEvent.findById(testEvent._id);
    assert.strictEqual(syncedEvent.acknowledged, true, "Linked SecurityEvent MUST be acknowledged automatically");
    console.log("✓ Live REST incident acknowledge synchronized linked SecurityEvent");

    // Resolve SecurityEvent via live REST API
    const resEvtRes = await fetch(`${BASE_URL}/api/security-events/${testEvent._id}/resolve`, {
      method: "PATCH",
      headers: authHeaders
    });
    assert.strictEqual(resEvtRes.status, 200, "PATCH /api/security-events/:id/resolve should return 200");
    const resEvtData = await resEvtRes.json();
    assert.strictEqual(resEvtData.success, true);
    assert.strictEqual(resEvtData.data.resolved, true);

    // Verify linked Incident was automatically resolved in MongoDB
    const syncedInc = await Incident.findById(testInc._id);
    assert.strictEqual(syncedInc.status, "resolved", "Linked Incident MUST be resolved automatically");
    console.log("✓ Live REST security event resolve synchronized linked Incident");
  } finally {
    try {
      await SecurityEvent.deleteMany({ deviceId: testSyncDevId });
      await Incident.deleteMany({ deviceId: testSyncDevId });
    } catch (_) {}
    await mongoose.disconnect();
  }

  console.log("\n==================================================");
  console.log("ALL LIVE END-TO-END VERIFICATION CHECKS PASSED!");
  console.log("==================================================\n");
}

runLiveE2ETest()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Live E2E Verification failed:", err);
    process.exit(1);
  });
