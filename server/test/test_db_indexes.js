require("dotenv").config();
const mongoose = require("mongoose");
const assert = require("assert");

const SecurityEvent = require("../src/models/SecurityEvent");
const Incident = require("../src/models/Incident");

async function verifyDatabaseIndexes() {
  console.log("=== Verifying Database Indexes Against Live MongoDB ===");
  const testDeviceId = "TEST-DEV-AUDIT-001";
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB successfully.");

    // 1. Check MongoDB server version
    const adminDb = mongoose.connection.db.admin();
    const buildInfo = await adminDb.buildInfo();
    console.log(`✓ MongoDB Server Version: ${buildInfo.version}`);

    // Ensure models have synced indexes with MongoDB
    await SecurityEvent.init();
    await Incident.init();

    // 2. Inspect SecurityEvent indexes
    const secIndexes = await SecurityEvent.collection.indexes();
    console.log("SecurityEvent Indexes in DB:");
    secIndexes.forEach((idx) => {
      console.log(`  - ${idx.name}: ${JSON.stringify(idx.key)} (unique: ${!!idx.unique}, partial: ${JSON.stringify(idx.partialFilterExpression || null)})`);
    });

    const activeSecIdx = secIndexes.find((i) => i.key.deviceId === 1 && i.key.eventType === 1 && i.unique);
    assert(activeSecIdx, "SecurityEvent MUST have a unique index on deviceId + eventType");
    assert(
      activeSecIdx.partialFilterExpression && activeSecIdx.partialFilterExpression.isRecovered === false,
      "SecurityEvent unique index MUST have partialFilterExpression: { isRecovered: false }"
    );
    console.log("✓ SecurityEvent partial unique index verified in database");

    // 3. Inspect Incident indexes
    const incIndexes = await Incident.collection.indexes();
    console.log("Incident Indexes in DB:");
    incIndexes.forEach((idx) => {
      console.log(`  - ${idx.name}: ${JSON.stringify(idx.key)} (unique: ${!!idx.unique}, partial: ${JSON.stringify(idx.partialFilterExpression || null)})`);
    });

    const activeIncIdx = incIndexes.find((i) => i.key.deviceId === 1 && i.key.sourceEventType === 1 && i.unique);
    assert(activeIncIdx, "Incident MUST have a unique index on deviceId + sourceEventType");
    assert(
      activeIncIdx.partialFilterExpression && activeIncIdx.partialFilterExpression.status,
      "Incident unique index MUST have partialFilterExpression for status in ['open', 'acknowledged']"
    );
    console.log("✓ Incident partial unique index verified in database");

    // 4. Test actual database enforcement of partial unique index on SecurityEvent
    await SecurityEvent.deleteMany({ deviceId: testDeviceId });

    // Insert first active event
    const evt1 = await SecurityEvent.create({
      deviceId: testDeviceId,
      eventType: "high_temperature",
      severity: "high",
      message: "Test audit event 1",
      isRecovered: false,
      resolved: false
    });
    assert(evt1._id, "First active event must be inserted");

    // Attempt second active event for same device + eventType -> MUST throw E11000
    let duplicateBlocked = false;
    try {
      await SecurityEvent.create({
        deviceId: testDeviceId,
        eventType: "high_temperature",
        severity: "high",
        message: "Test audit event 2 duplicate",
        isRecovered: false,
        resolved: false
      });
    } catch (err) {
      if (err.code === 11000) {
        duplicateBlocked = true;
      } else {
        throw err;
      }
    }
    assert.strictEqual(duplicateBlocked, true, "MongoDB MUST throw E11000 on duplicate active SecurityEvent");
    console.log("✓ MongoDB strictly enforces E11000 on concurrent active SecurityEvent insertion");

    // Test historical preservation: Recover the event, then insert another recovered one
    evt1.isRecovered = true;
    evt1.resolved = true;
    await evt1.save();

    const evt2 = await SecurityEvent.create({
      deviceId: testDeviceId,
      eventType: "high_temperature",
      severity: "high",
      message: "Test audit event 3 (new occurrence after recovery)",
      isRecovered: false,
      resolved: false
    });
    assert(evt2._id, "New active event must be accepted after previous event recovered");

    // Multiple historical recovered records can coexist
    evt2.isRecovered = true;
    evt2.resolved = true;
    await evt2.save();

    const evt3 = await SecurityEvent.create({
      deviceId: testDeviceId,
      eventType: "high_temperature",
      severity: "high",
      message: "Test audit event 4 (historical record)",
      isRecovered: true,
      resolved: true
    });
    assert(evt3._id, "Historical recovered records must coexist");
    console.log("✓ Historical recovered SecurityEvents are retained without index conflict");

    // Clean up test events
    await SecurityEvent.deleteMany({ deviceId: testDeviceId });

    // 5. Test actual database enforcement of partial unique index on Incident
    await Incident.deleteMany({ deviceId: testDeviceId });

    const inc1 = await Incident.create({
      incidentId: "INC-TEST-001",
      deviceId: testDeviceId,
      title: "Test Audit Incident",
      description: "Test description",
      severity: "high",
      status: "open",
      sourceEventType: "high_temperature"
    });
    assert(inc1._id, "First open incident must be inserted");

    let duplicateIncBlocked = false;
    try {
      await Incident.create({
        incidentId: "INC-TEST-002",
        deviceId: testDeviceId,
        title: "Test Audit Incident 2",
        description: "Test description duplicate",
        severity: "high",
        status: "open",
        sourceEventType: "high_temperature"
      });
    } catch (err) {
      if (err.code === 11000) {
        duplicateIncBlocked = true;
      } else {
        throw err;
      }
    }
    assert.strictEqual(duplicateIncBlocked, true, "MongoDB MUST throw E11000 on duplicate active Incident");
    console.log("✓ MongoDB strictly enforces E11000 on concurrent active Incident insertion");

    // Resolve inc1 and insert new open incident
    inc1.status = "resolved";
    await inc1.save();

    const inc3 = await Incident.create({
      incidentId: "INC-TEST-003",
      deviceId: testDeviceId,
      title: "Test Audit Incident 3",
      description: "New incident after resolution",
      severity: "high",
      status: "open",
      sourceEventType: "high_temperature"
    });
    assert(inc3._id, "New incident must be accepted after previous resolved");
    console.log("✓ Historical resolved Incidents are retained without index conflict");

    console.log("\nALL DATABASE INDEX AUDITS PASSED WITH ZERO ERRORS.\n");
  } finally {
    try {
      await SecurityEvent.deleteMany({ deviceId: testDeviceId });
      await Incident.deleteMany({ deviceId: testDeviceId });
    } catch (_) {}
    await mongoose.disconnect();
  }
}

verifyDatabaseIndexes()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Database index verification failed:", err);
    process.exit(1);
  });
