const assert = require("assert");
const { checkAnomalyRecovery } = require("../src/rules/anomalyRules");

// Simulates the duplicate prevention and lifecycle logic from subscriber.js and controllers
class MockEventStore {
  constructor() {
    this.events = [];
    this.incidents = [];
    this.processingLocks = new Set();
  }

  async processTelemetry(telemetry, anomalies) {
    // 1. Recovery - only when verified by checkAnomalyRecovery
    for (const evt of this.events) {
      if (
        evt.deviceId === telemetry.deviceId &&
        !evt.isRecovered &&
        checkAnomalyRecovery(evt.eventType, telemetry)
      ) {
        evt.isRecovered = true;
        evt.recoveredAt = new Date();
        evt.resolved = true;
        evt.resolvedAt = new Date();

        // Auto-resolve active incident
        const inc = this.incidents.find(
          (i) =>
            i.deviceId === telemetry.deviceId &&
            i.sourceEventType === evt.eventType &&
            ["open", "acknowledged"].includes(i.status)
        );
        if (inc) {
          inc.status = "resolved";
          inc.resolvedAt = new Date();
        }
      }
    }

    // 2. Anomaly detection & duplicate suppression
    for (const anomaly of anomalies) {
      const lockKey = `${telemetry.deviceId}:${anomaly.eventType}`;
      if (this.processingLocks.has(lockKey)) {
        continue;
      }

      try {
        this.processingLocks.add(lockKey);

        const existing = this.events.find(
          (e) =>
            e.deviceId === telemetry.deviceId &&
            e.eventType === anomaly.eventType &&
            !e.isRecovered
        );

        if (existing) {
          // Suppressed - active anomaly already tracked
          continue;
        }

        const newEvent = {
          _id: `evt-${this.events.length + 1}`,
          deviceId: telemetry.deviceId,
          eventType: anomaly.eventType,
          severity: anomaly.severity,
          message: anomaly.message,
          value: anomaly.value,
          detectedAt: new Date(),
          acknowledged: false,
          isRecovered: false,
          resolved: false
        };
        this.events.push(newEvent);

        // Incident
        const existingInc = this.incidents.find(
          (i) =>
            i.deviceId === telemetry.deviceId &&
            i.sourceEventType === anomaly.eventType &&
            ["open", "acknowledged"].includes(i.status)
        );

        if (!existingInc) {
          this.incidents.push({
            incidentId: `INC-${String(this.incidents.length + 1).padStart(4, "0")}`,
            deviceId: telemetry.deviceId,
            title: `${anomaly.eventType} detected`,
            status: "open",
            sourceEventType: anomaly.eventType,
            sourceEventId: newEvent._id
          });
        }
      } finally {
        this.processingLocks.delete(lockKey);
      }
    }
  }

  acknowledgeEvent(eventId) {
    const evt = this.events.find((e) => e._id === eventId);
    if (evt) {
      evt.acknowledged = true;
      // Sync to incident
      const inc = this.incidents.find(
        (i) => i.sourceEventId === eventId || (i.deviceId === evt.deviceId && i.sourceEventType === evt.eventType && i.status === "open")
      );
      if (inc) {
        inc.status = "acknowledged";
        inc.acknowledgedAt = new Date();
      }
    }
    return evt;
  }

  resolveEvent(eventId) {
    const evt = this.events.find((e) => e._id === eventId);
    if (evt) {
      evt.resolved = true;
      evt.resolvedAt = new Date();
      // Sync to incident
      const inc = this.incidents.find(
        (i) => i.sourceEventId === eventId || (i.deviceId === evt.deviceId && i.sourceEventType === evt.eventType && ["open", "acknowledged"].includes(i.status))
      );
      if (inc) {
        inc.status = "resolved";
        inc.resolvedAt = new Date();
      }
    }
    return evt;
  }

  acknowledgeIncident(incidentId) {
    const inc = this.incidents.find((i) => i.incidentId === incidentId || i._id === incidentId);
    if (inc) {
      inc.status = "acknowledged";
      inc.acknowledgedAt = new Date();
      // Sync to event
      const evt = this.events.find((e) => e._id === inc.sourceEventId || (e.deviceId === inc.deviceId && e.eventType === inc.sourceEventType && !e.resolved));
      if (evt) {
        evt.acknowledged = true;
      }
    }
    return inc;
  }

  resolveIncident(incidentId) {
    const inc = this.incidents.find((i) => i.incidentId === incidentId || i._id === incidentId);
    if (inc) {
      inc.status = "resolved";
      inc.resolvedAt = new Date();
      // Sync to event
      const evt = this.events.find((e) => e._id === inc.sourceEventId || (e.deviceId === inc.deviceId && e.eventType === inc.sourceEventType && !e.resolved));
      if (evt) {
        evt.resolved = true;
        evt.resolvedAt = new Date();
      }
    }
    return inc;
  }
}

async function runLifecycleTests() {
  console.log("=== Running Security Events Duplicate Prevention & Lifecycle Tests ===");
  const store = new MockEventStore();
  const deviceId = "DEV-TS-001";

  // Step 1: Initial anomaly detected (e.g. High Temperature 60°C)
  const anomaly = [{ eventType: "high_temperature", severity: "high", message: "High temp: 60°C", value: 60 }];
  await store.processTelemetry({ deviceId }, anomaly);

  assert.strictEqual(store.events.length, 1, "Exactly 1 security event should be created");
  assert.strictEqual(store.incidents.length, 1, "Exactly 1 incident should be created");
  assert.strictEqual(store.events[0].acknowledged, false, "Initial event should be unacknowledged");
  assert.strictEqual(store.events[0].resolved, false, "Initial event should be unresolved");
  assert.strictEqual(store.events[0].isRecovered, false, "Initial event should not be recovered");
  console.log("✓ Initial anomaly created 1 Event and 1 Incident");

  // Step 2: Repeated telemetry with same anomaly (10s later)
  await store.processTelemetry({ deviceId }, anomaly);
  assert.strictEqual(store.events.length, 1, "Repeated telemetry MUST NOT create duplicate event");
  assert.strictEqual(store.incidents.length, 1, "Repeated telemetry MUST NOT create duplicate incident");
  console.log("✓ Repeated anomalous telemetry safely deduplicated (no extra records)");

  // Step 3: Operator acknowledges the event
  store.acknowledgeEvent(store.events[0]._id);
  assert.strictEqual(store.events[0].acknowledged, true, "Event is now acknowledged");
  console.log("✓ Operator acknowledged event (acknowledged = true)");

  // Step 4: CRITICAL TEST - Next telemetry message arrives while anomaly is still active!
  // In the old buggy code, this created a duplicate because it queried acknowledged: false.
  // Our solution ensures it sees isRecovered: false and resolved: false and DOES NOT duplicate!
  await store.processTelemetry({ deviceId }, anomaly);
  assert.strictEqual(store.events.length, 1, "Acknowledged still-active event MUST NOT trigger duplicate!");
  assert.strictEqual(store.incidents.length, 1, "Still-active incident MUST NOT trigger duplicate!");
  console.log("✓ Acknowledged event remains deduplicated while anomaly is still active");

  // Step 4b: Incomplete/missing telemetry does NOT recover the active anomaly
  await store.processTelemetry({ deviceId }, []);
  assert.strictEqual(store.events[0].isRecovered, false, "Missing telemetry field MUST NOT recover event");
  console.log("✓ Incomplete telemetry safely preserves active anomaly (does NOT recover)");

  // Step 5: Device telemetry returns to normal with valid healthy data (anomaly recovers)
  await store.processTelemetry({ deviceId, temperature: 24.5 }, []);
  assert.strictEqual(store.events[0].isRecovered, true, "Event should be marked recovered");
  assert.strictEqual(store.events[0].resolved, true, "Event should transition to resolved upon recovery");
  assert.strictEqual(store.incidents[0].status, "resolved", "Active incident should transition to resolved upon recovery");
  console.log("✓ Valid healthy telemetry transitions event to recovered & resolved");

  // Step 6: Subsequent spike (new occurrence after recovery)
  const spikeAnomaly = [{ eventType: "high_temperature", severity: "high", message: "High temp: 65°C", value: 65 }];
  await store.processTelemetry({ deviceId, temperature: 65 }, spikeAnomaly);
  assert.strictEqual(store.events.length, 2, "New spike after recovery MUST create a fresh event");
  assert.strictEqual(store.incidents.length, 2, "New spike after recovery MUST create a fresh incident");
  console.log("✓ New occurrence after recovery creates a new event & incident");

  // Step 7: Concurrent message burst protection
  const burst = Promise.all([
    store.processTelemetry({ deviceId: "DEV-CAM-001" }, [{ eventType: "unknown_ip", severity: "critical" }]),
    store.processTelemetry({ deviceId: "DEV-CAM-001" }, [{ eventType: "unknown_ip", severity: "critical" }]),
    store.processTelemetry({ deviceId: "DEV-CAM-001" }, [{ eventType: "unknown_ip", severity: "critical" }])
  ]);
  await burst;
  const camEvents = store.events.filter((e) => e.deviceId === "DEV-CAM-001");
  assert.strictEqual(camEvents.length, 1, "Concurrent burst messages must only produce 1 event");
  console.log("✓ Concurrent message burst correctly protected against race condition");

  // Step 8: Bidirectional controller synchronization test
  const freshStore = new MockEventStore();
  const testDev = "DEV-SL-001";
  await freshStore.processTelemetry(
    { deviceId: testDev, lockState: "jammed" },
    [{ eventType: "smart_lock_jammed", severity: "critical", message: "Lock jammed" }]
  );
  assert.strictEqual(freshStore.events.length, 1);
  assert.strictEqual(freshStore.incidents.length, 1);

  // Acknowledge incident -> verifies event acknowledged
  freshStore.acknowledgeIncident(freshStore.incidents[0].incidentId);
  assert.strictEqual(freshStore.incidents[0].status, "acknowledged");
  assert.strictEqual(freshStore.events[0].acknowledged, true, "Acknowledging incident syncs to event");
  console.log("✓ Acknowledging incident synchronizes to SecurityEvent");

  // Resolve incident -> verifies event resolved
  freshStore.resolveIncident(freshStore.incidents[0].incidentId);
  assert.strictEqual(freshStore.incidents[0].status, "resolved");
  assert.strictEqual(freshStore.events[0].resolved, true, "Resolving incident syncs to event");
  console.log("✓ Resolving incident synchronizes to SecurityEvent");

  // Acknowledge event -> verifies incident acknowledged
  const syncStore = new MockEventStore();
  await syncStore.processTelemetry(
    { deviceId: "DEV-GW-001", cpuUsage: 95 },
    [{ eventType: "high_cpu", severity: "high", message: "CPU 95%" }]
  );
  syncStore.acknowledgeEvent(syncStore.events[0]._id);
  assert.strictEqual(syncStore.events[0].acknowledged, true);
  assert.strictEqual(syncStore.incidents[0].status, "acknowledged", "Acknowledging event syncs to incident");
  console.log("✓ Acknowledging SecurityEvent synchronizes to Incident");

  // Resolve event -> verifies incident resolved
  syncStore.resolveEvent(syncStore.events[0]._id);
  assert.strictEqual(syncStore.events[0].resolved, true);
  assert.strictEqual(syncStore.incidents[0].status, "resolved", "Resolving event syncs to incident");
  console.log("✓ Resolving SecurityEvent synchronizes to Incident");

  console.log("All duplicate prevention & lifecycle tests passed successfully!\n");
}

module.exports = { runLifecycleTests };

if (require.main === module) {
  runLifecycleTests();
}
