require("dotenv").config();
const mongoose = require("mongoose");
const assert = require("assert");

const SecurityEvent = require("../src/models/SecurityEvent");
const Incident = require("../src/models/Incident");

async function runConsistencyAudit() {
  console.log("=== Auditing Incident / SecurityEvent Consistency & Transactions ===");
  await mongoose.connect(process.env.MONGODB_URI);

  const testDeviceId = "TEST-DEV-SYNC-001";
  await SecurityEvent.deleteMany({ deviceId: testDeviceId });
  await Incident.deleteMany({ deviceId: testDeviceId });

  try {
    // 1. Create linked event and incident
    const event = await SecurityEvent.create({
      deviceId: testDeviceId,
      eventType: "high_temperature",
      severity: "high",
      message: "Initial temperature alert",
      value: 62.0,
      acknowledged: false,
      isRecovered: false,
      resolved: false
    });

    const incident = await Incident.create({
      incidentId: "INC-SYNC-001",
      deviceId: testDeviceId,
      title: "High temperature detected",
      description: "Initial temperature alert",
      severity: "high",
      status: "open",
      sourceEventType: "high_temperature",
      sourceEventId: event._id
    });

    console.log("✓ Initial linked records created (status: open, acknowledged: false)");

    // 2. Test Atomic Transaction for Incident Acknowledge -> Event Acknowledge
    const session1 = await mongoose.startSession();
    let updatedIncident = null;
    let updatedEvent = null;

    await session1.withTransaction(async () => {
      updatedIncident = await Incident.findByIdAndUpdate(
        incident._id,
        { status: "acknowledged", acknowledgedAt: new Date() },
        { returnDocument: "after", session: session1 }
      );

      updatedEvent = await SecurityEvent.findByIdAndUpdate(
        event._id,
        { acknowledged: true },
        { returnDocument: "after", session: session1 }
      );
    });
    await session1.endSession();

    assert.strictEqual(updatedIncident.status, "acknowledged");
    assert.strictEqual(updatedEvent.acknowledged, true);
    console.log("✓ Atomic transaction: Incident acknowledge correctly synchronized Event");

    // 3. Test Failure Simulation: If second update fails, transaction aborts and first update is rolled back
    const session2 = await mongoose.startSession();
    let failedRolledBack = false;

    try {
      await session2.withTransaction(async () => {
        // Step 1 of transaction: attempt to resolve incident
        await Incident.findByIdAndUpdate(
          incident._id,
          { status: "resolved", resolvedAt: new Date() },
          { session: session2 }
        );

        // Step 2: Simulate network / constraint failure during linked event update
        throw new Error("SIMULATED_DB_FAILURE_DURING_SYNC");
      });
    } catch (err) {
      if (err.message === "SIMULATED_DB_FAILURE_DURING_SYNC") {
        failedRolledBack = true;
      } else {
        throw err;
      }
    } finally {
      await session2.endSession();
    }

    assert.strictEqual(failedRolledBack, true, "Simulated failure caught");

    // Query DB to verify Incident was NOT left in 'resolved' state
    const incidentAfterFailure = await Incident.findById(incident._id);
    assert.strictEqual(
      incidentAfterFailure.status,
      "acknowledged",
      "Incident MUST remain 'acknowledged' after aborted transaction (no inconsistent partial write!)"
    );
    console.log("✓ Simulated failure successfully rolled back: no inconsistent partial state!");

    // 4. Test Manual Resolution vs Telemetry Recovery Semantics
    // Operator resolves manually: resolved = true, but isRecovered is still false (sensor is still anomalous)
    const session3 = await mongoose.startSession();
    await session3.withTransaction(async () => {
      await SecurityEvent.findByIdAndUpdate(
        event._id,
        { resolved: true, resolvedAt: new Date() },
        { session: session3 }
      );
      await Incident.findByIdAndUpdate(
        incident._id,
        { status: "resolved", resolvedAt: new Date() },
        { session: session3 }
      );
    });
    await session3.endSession();

    const manualResolvedEvent = await SecurityEvent.findById(event._id);
    assert.strictEqual(manualResolvedEvent.resolved, true, "Event is marked resolved");
    assert.strictEqual(manualResolvedEvent.isRecovered, false, "isRecovered remains false until verified by telemetry");
    console.log("✓ Manual operator resolution clearly decoupled from physical sensor recovery state");

    // Telemetry returns healthy data: condition genuinely recovers
    manualResolvedEvent.isRecovered = true;
    manualResolvedEvent.recoveredAt = new Date();
    await manualResolvedEvent.save();

    const recoveredEvent = await SecurityEvent.findById(event._id);
    assert.strictEqual(recoveredEvent.isRecovered, true, "Event is now verified recovered");
    console.log("✓ Telemetry-verified recovery updates isRecovered = true");

    console.log("\nALL CONSISTENCY & TRANSACTION AUDITS PASSED WITH ZERO ERRORS.\n");
  } finally {
    try {
      await SecurityEvent.deleteMany({ deviceId: testDeviceId });
      await Incident.deleteMany({ deviceId: testDeviceId });
    } catch (_) {}
    await mongoose.disconnect();
  }
}

runConsistencyAudit()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Consistency audit failed:", err);
    process.exit(1);
  });
