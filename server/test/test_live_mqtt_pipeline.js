require("dotenv").config();
const mqtt = require("mqtt");
const mongoose = require("mongoose");
const assert = require("assert");

const Device = require("../src/models/Device");
const SecurityEvent = require("../src/models/SecurityEvent");
const Incident = require("../src/models/Incident");
const { checkDeviceHealth } = require("../src/services/healthMonitor");

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runLiveMqttPipelineAudit() {
  console.log("=== SENTRICORE LIVE MQTT PIPELINE & ANOMALY RECOVERY AUDIT ===");

  await mongoose.connect(process.env.MONGODB_URI);
  const testDevId = "TEST-DEV-PIPE-001";

  // Clean initial test data
  await Device.deleteMany({ deviceId: testDevId });
  await SecurityEvent.deleteMany({ deviceId: testDevId });
  await Incident.deleteMany({ deviceId: testDevId });

  const mqttClient = mqtt.connect("mqtt://localhost:1883", {
    clientId: "live-pipeline-auditor"
  });

  await new Promise((resolve) => mqttClient.on("connect", resolve));
  console.log("Connected to live MQTT broker.");

  try {
    const telemetryTopic = `sentricore/devices/${testDevId}/telemetry`;

    // 1. Initial anomaly triggers SecurityEvent and Incident
    console.log("\n1. Publishing initial anomaly telemetry (temperature = 58°C)...");
    mqttClient.publish(
      telemetryTopic,
      JSON.stringify({
        deviceId: testDevId,
        name: "Test Pipe Device",
        type: "temperature_sensor",
        temperature: 58.0,
        battery: 85
      })
    );
    await wait(1500);

    const initialEvents = await SecurityEvent.find({ deviceId: testDevId });
    assert.strictEqual(initialEvents.length, 1, "Exactly 1 SecurityEvent should be created");
    assert.strictEqual(initialEvents[0].eventType, "high_temperature");
    assert.strictEqual(initialEvents[0].isRecovered, false);
    assert.strictEqual(initialEvents[0].resolved, false);

    const initialIncidents = await Incident.find({ deviceId: testDevId });
    assert.strictEqual(initialIncidents.length, 1, "Exactly 1 Incident should be created");
    assert.strictEqual(initialIncidents[0].status, "open");
    assert.strictEqual(
      initialIncidents[0].sourceEventId.toString(),
      initialEvents[0]._id.toString(),
      "Incident must be linked to source SecurityEvent"
    );
    console.log("✓ Initial anomaly triggered exactly 1 SecurityEvent and 1 linked Incident");

    // 2. Repeated anomalous telemetry is deduplicated
    console.log("\n2. Publishing repeated anomalous messages (testing duplicate suppression)...");
    mqttClient.publish(
      telemetryTopic,
      JSON.stringify({
        deviceId: testDevId,
        temperature: 61.0,
        battery: 84
      })
    );
    mqttClient.publish(
      telemetryTopic,
      JSON.stringify({
        deviceId: testDevId,
        temperature: 62.5,
        battery: 84
      })
    );
    await wait(1500);

    const afterDupEvents = await SecurityEvent.find({ deviceId: testDevId });
    assert.strictEqual(afterDupEvents.length, 1, "Repeated anomalous messages MUST NOT create duplicate events");
    const afterDupIncidents = await Incident.find({ deviceId: testDevId });
    assert.strictEqual(afterDupIncidents.length, 1, "Repeated anomalous messages MUST NOT create duplicate incidents");
    console.log("✓ Repeated telemetry safely deduplicated (records count remained 1)");

    // 3. Incomplete / missing telemetry must NOT trigger recovery
    console.log("\n3. Publishing incomplete telemetry (missing/null temperature)...");
    mqttClient.publish(
      telemetryTopic,
      JSON.stringify({
        deviceId: testDevId,
        battery: 90
        // temperature is missing!
      })
    );
    mqttClient.publish(
      telemetryTopic,
      JSON.stringify({
        deviceId: testDevId,
        temperature: null // temperature is null!
      })
    );
    await wait(1500);

    const activeCheckEvt = await SecurityEvent.findById(initialEvents[0]._id);
    assert.strictEqual(activeCheckEvt.isRecovered, false, "Missing/null field MUST NOT recover event");
    assert.strictEqual(activeCheckEvt.resolved, false, "Event must remain unresolved");
    console.log("✓ Incomplete telemetry safely rejected from recovery (event remains active)");

    // 4. Valid healthy telemetry triggers verified recovery
    console.log("\n4. Publishing verified healthy telemetry (temperature = 23.5°C)...");
    mqttClient.publish(
      telemetryTopic,
      JSON.stringify({
        deviceId: testDevId,
        temperature: 23.5,
        battery: 85
      })
    );
    await wait(1500);

    const recoveredEvt = await SecurityEvent.findById(initialEvents[0]._id);
    assert.strictEqual(recoveredEvt.isRecovered, true, "Event MUST be marked isRecovered = true");
    assert.strictEqual(recoveredEvt.resolved, true, "Event MUST be marked resolved = true upon recovery");

    const recoveredInc = await Incident.findById(initialIncidents[0]._id);
    assert.strictEqual(recoveredInc.status, "resolved", "Active incident MUST be resolved upon recovery");
    console.log("✓ Valid healthy telemetry recovered event and resolved linked incident");

    // 5. Subsequent anomaly recurrence creates fresh occurrence
    console.log("\n5. Publishing subsequent spike anomaly after recovery...");
    mqttClient.publish(
      telemetryTopic,
      JSON.stringify({
        deviceId: testDevId,
        temperature: 65.0,
        battery: 84
      })
    );
    await wait(1500);

    const allEventsAfterSpike = await SecurityEvent.find({ deviceId: testDevId });
    assert.strictEqual(allEventsAfterSpike.length, 2, "New spike after recovery MUST create fresh event");
    const allIncidentsAfterSpike = await Incident.find({ deviceId: testDevId });
    assert.strictEqual(allIncidentsAfterSpike.length, 2, "New spike after recovery MUST create fresh incident");
    console.log("✓ Anomaly recurrence after recovery created new event & incident");

    // 6. Test Heartbeat and Online/Offline Detection
    console.log("\n6. Testing heartbeat timeout and online/offline transitions...");
    // Age the heartbeat by 2 minutes
    await Device.updateOne(
      { deviceId: testDevId },
      { $set: { lastHeartbeat: new Date(Date.now() - 120000) } }
    );

    // Run health check
    await checkDeviceHealth(null);

    const deviceAfterTimeout = await Device.findOne({ deviceId: testDevId });
    assert.strictEqual(deviceAfterTimeout.status, "offline", "Device MUST transition to offline after timeout");
    console.log("✓ Device transitioned to 'offline' after heartbeat timeout");

    // Reconnection: publish valid heartbeat / telemetry
    mqttClient.publish(
      telemetryTopic,
      JSON.stringify({
        deviceId: testDevId,
        temperature: 24.0,
        battery: 88
      })
    );
    await wait(1500);

    const deviceAfterReconnect = await Device.findOne({ deviceId: testDevId });
    assert.strictEqual(deviceAfterReconnect.status, "online", "Device MUST restore to online upon telemetry");
    console.log("✓ Device restored to 'online' upon receiving fresh telemetry packet");

    console.log("\n==================================================");
    console.log("ALL LIVE MQTT PIPELINE & RECOVERY CHECKS PASSED!");
    console.log("==================================================\n");
  } finally {
    try {
      await Device.deleteMany({ deviceId: testDevId });
      await SecurityEvent.deleteMany({ deviceId: testDevId });
      await Incident.deleteMany({ deviceId: testDevId });
    } catch (_) {}
    mqttClient.end();
    await mongoose.disconnect();
  }
}

runLiveMqttPipelineAudit()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Live MQTT Pipeline Audit failed:", err);
    process.exit(1);
  });
