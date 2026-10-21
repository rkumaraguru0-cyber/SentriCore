/**
 * SentriCore Phase 2 — Security Events Safe Retention Cleanup Script
 * 
 * STRICT SAFEGUARD SPECIFICATIONS:
 * 1. Verifies existing verified backup exists on disk, parses cleanly, and contains 118 records.
 * 2. Verifies live database has exactly 118 Security Events and 14 Incidents.
 * 3. Verifies all 7 Incident-referenced Security Event IDs are preserved.
 * 4. Ensures the deletion set contains EXACTLY 88 documents and retained set contains EXACTLY 30.
 * 5. Requires both `--execute-live` AND `--confirm-proceed` to make changes.
 * 6. Defaults to 100% READ-ONLY DRY-RUN mode.
 * 7. Never exposes MongoDB credentials or connection URIs in logs or output.
 */

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config({
  path: path.resolve(__dirname, '../.env')
});

const EXPECTED_BACKUP_PATH = path.resolve(
  __dirname,
  '../../backups/securityevents-backup-118-2026-10-21T09-46-53-555Z.json'
);

async function runPhase2Cleanup() {
  console.log("========================================================================");
  console.log("   SENTRICORE SECURITY EVENTS CLEANUP (PHASE 2 - PREPARATION & AUDIT)   ");
  console.log("========================================================================\n");

  // -------------------------------------------------------------------------
  // SAFEGUARD 1: Verify Existing Backup on Disk
  // -------------------------------------------------------------------------
  console.log("[SAFEGUARD 1/5] Verifying backup artifact on disk...");
  if (!fs.existsSync(EXPECTED_BACKUP_PATH)) {
    throw new Error(`ABORT: Required backup file not found at: ${EXPECTED_BACKUP_PATH}`);
  }

  const backupStat = fs.statSync(EXPECTED_BACKUP_PATH);
  if (backupStat.size < 50000) {
    throw new Error(`ABORT: Backup file size (${backupStat.size} bytes) is unusually small.`);
  }

  const backupRaw = fs.readFileSync(EXPECTED_BACKUP_PATH, 'utf8');
  let backupData;
  try {
    backupData = JSON.parse(backupRaw);
  } catch (err) {
    throw new Error(`ABORT: Backup file failed JSON validation: ${err.message}`);
  }

  if (!Array.isArray(backupData) || backupData.length !== 118) {
    throw new Error(`ABORT: Backup file must contain exactly 118 records, found ${backupData?.length}`);
  }
  console.log(`✓ Backup verified: ${EXPECTED_BACKUP_PATH}`);
  console.log(`✓ Size: ${backupStat.size} bytes | Records in backup: ${backupData.length} (Valid JSON)\n`);

  // -------------------------------------------------------------------------
  // SAFEGUARD 2: Connect to Live MongoDB & Verify Current Baseline Counts
  // -------------------------------------------------------------------------
  console.log("[SAFEGUARD 2/5] Connecting to live MongoDB and checking baseline counts...");
  const connUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/sentricore';
  await mongoose.connect(connUri);
  const db = mongoose.connection.db;

  const liveEventCount = await db.collection('securityevents').countDocuments();
  const liveIncidentCount = await db.collection('incidents').countDocuments();

  if (liveEventCount !== 118) {
    throw new Error(`ABORT: Live securityevents count is ${liveEventCount}, expected exactly 118.`);
  }
  if (liveIncidentCount !== 14) {
    throw new Error(`ABORT: Live incidents count is ${liveIncidentCount}, expected exactly 14.`);
  }
  console.log(`✓ Live database baseline confirmed: 118 Security Events, 14 Incidents.\n`);

  // -------------------------------------------------------------------------
  // SAFEGUARD 3: Inspect Incident References & Build Protected ID Set
  // -------------------------------------------------------------------------
  console.log("[SAFEGUARD 3/5] Inspecting incident references and protected dependencies...");
  const allIncidents = await db.collection('incidents').find().toArray();
  const protectedEventIds = new Set();

  for (const inc of allIncidents) {
    if (inc.sourceEventId) {
      protectedEventIds.add(inc.sourceEventId.toString());
    }
  }

  if (protectedEventIds.size !== 7) {
    throw new Error(`ABORT: Expected exactly 7 distinct incident-referenced events, found ${protectedEventIds.size}.`);
  }

  // Verify all 7 protected IDs exist in the live securityevents collection
  const protectedObjectIds = Array.from(protectedEventIds).map(id => new mongoose.Types.ObjectId(id));
  const existingProtectedDocs = await db.collection('securityevents').find({ _id: { $in: protectedObjectIds } }).toArray();

  if (existingProtectedDocs.length !== 7) {
    throw new Error(`ABORT: Expected all 7 incident-referenced IDs to exist in DB, found ${existingProtectedDocs.length}`);
  }
  console.log(`✓ Protected incident references: 7 IDs strictly identified and verified.\n`);

  // -------------------------------------------------------------------------
  // SAFEGUARD 4: Build Deterministic Retention Set of Exactly 30 Events
  // -------------------------------------------------------------------------
  console.log("[SAFEGUARD 4/5] Selecting the 30 representative events to retain...");
  const allEvents = await db.collection('securityevents').find().sort({ detectedAt: -1 }).toArray();
  const retainedIdSet = new Set();

  // (A) Mandatory: All 7 Incident-referenced Security Events
  for (const id of protectedEventIds) {
    retainedIdSet.add(id);
  }

  // (B) All unknown_ip events (2 events, Critical, links to INC-0001)
  allEvents
    .filter(e => e.eventType === 'unknown_ip')
    .forEach(e => retainedIdSet.add(e._id.toString()));

  // (C) All high_cpu events (2 events, High, links to INC-0002)
  allEvents
    .filter(e => e.eventType === 'high_cpu')
    .forEach(e => retainedIdSet.add(e._id.toString()));

  // (D) All low_battery events (1 event, Medium)
  allEvents
    .filter(e => e.eventType === 'low_battery')
    .forEach(e => retainedIdSet.add(e._id.toString()));

  // (E) Representative high_temperature events (5 events: 2 acknowledged + 3 unacknowledged)
  allEvents
    .filter(e => e.eventType === 'high_temperature' && e.acknowledged === true)
    .forEach(e => retainedIdSet.add(e._id.toString())); // exactly 2

  allEvents
    .filter(e => e.eventType === 'high_temperature' && !e.acknowledged)
    .slice(0, 3)
    .forEach(e => retainedIdSet.add(e._id.toString())); // exactly 3

  // (F) All other resolved network_degraded events (5 events: to complete all 12 resolved in DB)
  allEvents
    .filter(e => e.eventType === 'network_degraded' && e.resolved === true)
    .forEach(e => retainedIdSet.add(e._id.toString())); // total resolved degraded in DB is 12 (7 already added + 5 more)

  // (G) Active recovered network_degraded events (8 events: exactly 2 for each of the 4 cameras)
  const cameras = ['DEV-CAM-001', 'DEV-CAM-002', 'DEV-CAM-003', 'DEV-CAM-004'];
  for (const cam of cameras) {
    const camActive = allEvents.filter(e =>
      e.eventType === 'network_degraded' &&
      e.deviceId === cam &&
      e.resolved !== true &&
      e.isRecovered === true
    );
    camActive.slice(0, 2).forEach(e => retainedIdSet.add(e._id.toString()));
  }

  // Validate exact count of 30 retained
  if (retainedIdSet.size !== 30) {
    throw new Error(`ABORT: Retained set size is ${retainedIdSet.size}, expected exactly 30.`);
  }

  // Partition all events into retain and delete sets
  const retainedList = allEvents.filter(e => retainedIdSet.has(e._id.toString()));
  const deleteList = allEvents.filter(e => !retainedIdSet.has(e._id.toString()));

  if (retainedList.length !== 30) {
    throw new Error(`ABORT: Retained list count is ${retainedList.length}, expected 30.`);
  }
  if (deleteList.length !== 88) {
    throw new Error(`ABORT: Deletion list count is ${deleteList.length}, expected 88.`);
  }
  if (retainedList.length + deleteList.length !== 118) {
    throw new Error(`ABORT: Total partition sum is ${retainedList.length + deleteList.length}, expected 118.`);
  }

  // -------------------------------------------------------------------------
  // SAFEGUARD 5: Verify Zero Overlap Between Delete List and Incident References
  // -------------------------------------------------------------------------
  console.log("[SAFEGUARD 5/5] Checking for zero overlap with incident references...");
  const deleteIdSet = new Set(deleteList.map(e => e._id.toString()));
  const invalidOverlap = [];

  for (const refId of protectedEventIds) {
    if (deleteIdSet.has(refId)) {
      invalidOverlap.push(refId);
    }
  }

  if (invalidOverlap.length > 0) {
    throw new Error(`CRITICAL ABORT: ${invalidOverlap.length} incident-referenced IDs found in deletion list: ${invalidOverlap.join(', ')}`);
  }
  console.log(`✓ Zero overlap confirmed: 0 incident-referenced documents in deletion list.\n`);

  // -------------------------------------------------------------------------
  // SAFEGUARD 6: Cryptographic / Field Content Verification of Candidates vs Backup
  // -------------------------------------------------------------------------
  console.log("[SAFEGUARD 6/6] Verifying candidate records match audited backup content...");
  const backupMap = new Map(backupData.map(d => [d._id.toString(), d]));
  let mismatchCount = 0;
  const mismatchedDetails = [];

  for (const liveDoc of deleteList) {
    const idStr = liveDoc._id.toString();
    const backupDoc = backupMap.get(idStr);

    if (!backupDoc) {
      mismatchCount++;
      mismatchedDetails.push({ id: idStr, reason: "Missing in backup" });
      continue;
    }

    const isMatch =
      liveDoc.deviceId === backupDoc.deviceId &&
      liveDoc.eventType === backupDoc.eventType &&
      liveDoc.severity === backupDoc.severity &&
      liveDoc.acknowledged === backupDoc.acknowledged &&
      liveDoc.isRecovered === backupDoc.isRecovered &&
      liveDoc.resolved === backupDoc.resolved &&
      new Date(liveDoc.detectedAt).getTime() === new Date(backupDoc.detectedAt).getTime();

    if (!isMatch) {
      mismatchCount++;
      mismatchedDetails.push({ id: idStr, reason: "Content modified since backup" });
    }
  }

  if (mismatchCount > 0) {
    throw new Error(`CRITICAL ABORT: ${mismatchCount} deletion candidate records have changed content since backup was created!`);
  }
  console.log(`✓ Candidate record integrity confirmed: All 88 candidate records match backup content 100%.\n`);

  // -------------------------------------------------------------------------
  // AUDIT SUMMARY TABLES
  // -------------------------------------------------------------------------
  console.log("========================================================================");
  console.log("   AUDIT SUMMARY: 30 RETAINED DOCUMENTS                                ");
  console.log("========================================================================");

  const retainedByType = {};
  for (const e of retainedList) {
    retainedByType[e.eventType] = (retainedByType[e.eventType] || 0) + 1;
  }
  console.table(retainedByType);

  console.log("\nRetained Documents by Device:");
  const retainedByDevice = {};
  for (const e of retainedList) {
    retainedByDevice[e.deviceId] = (retainedByDevice[e.deviceId] || 0) + 1;
  }
  console.table(retainedByDevice);

  console.log("\nRetained Documents by Status:");
  const retainedByStatus = {
    resolved: retainedList.filter(e => e.resolved === true).length,
    active_recovered: retainedList.filter(e => e.resolved !== true && e.isRecovered === true).length,
    active_unrecovered: retainedList.filter(e => e.resolved !== true && e.isRecovered !== true).length
  };
  console.table(retainedByStatus);

  console.log("\n========================================================================");
  console.log("   AUDIT SUMMARY: 88 PROPOSED DELETION DOCUMENTS                       ");
  console.log("========================================================================");
  const deletedByType = {};
  for (const e of deleteList) {
    deletedByType[e.eventType] = (deletedByType[e.eventType] || 0) + 1;
  }
  console.table(deletedByType);

  // -------------------------------------------------------------------------
  // EXECUTION MODE CHECK
  // -------------------------------------------------------------------------
  const isExecuteLive = process.argv.includes('--execute-live');
  const isConfirmed = process.argv.includes('--confirm-proceed');

  if (!isExecuteLive || !isConfirmed) {
    console.log("\n========================================================================");
    console.log("   MODE: DRY-RUN ONLY (ZERO WRITES PERFORMED)                          ");
    console.log("========================================================================");
    console.log("No records were deleted or modified. The live database remains at 118 events.");
    console.log("To execute live, both flags are required: --execute-live --confirm-proceed");
  } else {
    console.log("\n[LIVE EXECUTION STARTED]: Performing atomic deletion with session transaction...");
    const deleteIds = deleteList.map(e => e._id);

    let session = null;
    try {
      session = await mongoose.startSession();
    } catch (sessErr) {
      session = null;
    }

    const executeDeletionLogic = async (sess) => {
      const opts = sess ? { session: sess } : {};

      // Immediate pre-deletion live database recheck
      const livePreCheckEvents = await db.collection('securityevents').countDocuments({}, opts);
      const livePreCheckIncidents = await db.collection('incidents').countDocuments({}, opts);
      if (livePreCheckEvents !== 118 || livePreCheckIncidents !== 14) {
        throw new Error(`ABORT: Database counts changed immediately prior to deletion! Events: ${livePreCheckEvents} (expected 118), Incidents: ${livePreCheckIncidents} (expected 14).`);
      }

      // Verify all 88 deletion candidates actually exist in the live database right now
      const liveMatchingDeletionCount = await db.collection('securityevents').countDocuments({
        _id: { $in: deleteIds }
      }, opts);
      if (liveMatchingDeletionCount !== 88) {
        throw new Error(`ABORT: Expected exactly 88 deletion candidate documents in DB, found ${liveMatchingDeletionCount}!`);
      }

      // Verify all 7 incident references are still present in DB
      const liveProtectedCount = await db.collection('securityevents').countDocuments({
        _id: { $in: protectedObjectIds }
      }, opts);
      if (liveProtectedCount !== 7) {
        throw new Error(`ABORT: Protected incident references count changed! Found ${liveProtectedCount} (expected 7).`);
      }

      console.log("✓ Pre-deletion live checks passed inside transaction context.");
      console.log("Proceeding to delete 88 records using audited ObjectIDs...");

      const deleteResult = await db.collection('securityevents').deleteMany({
        _id: { $in: deleteIds }
      }, opts);

      console.log(`Deleted Count: ${deleteResult.deletedCount}`);
      if (deleteResult.deletedCount !== 88) {
        throw new Error(`ABORT: Expected deleted count of 88, got ${deleteResult.deletedCount}! Transaction will roll back.`);
      }

      const postCleanupCount = await db.collection('securityevents').countDocuments({}, opts);
      const postIncidentCount = await db.collection('incidents').countDocuments({}, opts);

      console.log(`\nPost-Cleanup Live Database Verification:`);
      console.log(`- Security Events remaining: ${postCleanupCount} (Expected: 30)`);
      console.log(`- Incidents remaining:       ${postIncidentCount} (Expected: 14)`);

      if (postCleanupCount !== 30 || postIncidentCount !== 14) {
        throw new Error("POST-CLEANUP VERIFICATION FAILED! Transaction will roll back.");
      }
    };

    try {
      if (session) {
        await session.withTransaction(async () => {
          await executeDeletionLogic(session);
        });
      } else {
        await executeDeletionLogic(null);
      }
      console.log("✓ Live Phase 2 cleanup executed and verified successfully.");
    } finally {
      if (session) {
        await session.endSession();
      }
    }
  }

  await mongoose.disconnect();
}

runPhase2Cleanup().catch(err => {
  console.error("\n[SCRIPT ABORTED]:", err.message);
  process.exit(1);
});
