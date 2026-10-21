require("dotenv").config();
const jwt = require("jsonwebtoken");
const assert = require("assert");
const mongoose = require("mongoose");

const Firmware = require("../src/models/Firmware");
const Device = require("../src/models/Device");

async function runLiveFirmwareAudit() {
  console.log("=== SENTRICORE LIVE FIRMWARE UPDATE API & LIFECYCLE AUDIT ===");

  const BASE_URL = "http://localhost:5000";
  const testToken = jwt.sign(
    { userId: "audit-admin-001", role: "admin" },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
  );

  const authHeaders = {
    Authorization: `Bearer ${testToken}`,
    "Content-Type": "application/json"
  };

  await mongoose.connect(process.env.MONGODB_URI);
  const testDevId = "TEST-DEV-FW-001";

  // Clean initial test data if any
  await Firmware.deleteMany({ deviceId: testDevId });
  await Device.deleteMany({ deviceId: testDevId });

  // Ensure test device exists with initial version 1.0.0
  await Device.create({
    deviceId: testDevId,
    name: "Test Firmware Device",
    type: "gateway",
    firmwareVersion: "1.0.0",
    status: "online"
  });

  try {
    // 1. Start firmware update
    console.log("\n1. Starting firmware update via POST /api/firmware/start...");
    const startRes = await fetch(`${BASE_URL}/api/firmware`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ deviceId: testDevId, targetVersion: "1.2.0" })
    });
    assert.strictEqual(startRes.status, 201, "POST /api/firmware should return 201");
    const startData = await startRes.json();
    assert.strictEqual(startData.success, true);
    assert.strictEqual(startData.data.status, "pending");
    const firmwareId = startData.data._id;
    console.log(`✓ Firmware update initiated in 'pending' status (ID: ${firmwareId})`);

    // 2. Duplicate concurrent update prevention
    console.log("\n2. Testing duplicate concurrent update prevention...");
    const dupRes = await fetch(`${BASE_URL}/api/firmware`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ deviceId: testDevId, targetVersion: "1.3.0" })
    });
    assert.strictEqual(dupRes.status, 409, "Duplicate update request MUST return 409 Conflict");
    console.log("✓ Duplicate concurrent update correctly blocked with 409 Conflict");

    // 3. Test Invalid State Transition (Illegal Jump: pending -> success)
    console.log("\n3. Testing invalid state transition rejection (pending -> success)...");
    const illegalRes = await fetch(`${BASE_URL}/api/firmware/${firmwareId}/status`, {
      method: "PATCH",
      headers: authHeaders,
      body: JSON.stringify({ status: "success", progress: 100 })
    });
    assert.strictEqual(illegalRes.status, 400, "Illegal jump transition MUST return 400 Bad Request");
    const illegalData = await illegalRes.json();
    assert(illegalData.message.includes("Invalid firmware state transition"));
    console.log("✓ Illegal transition correctly rejected with 400:", illegalData.message);

    // 4. Test Legal State Transition: pending -> downloading
    console.log("\n4. Testing legal progression: pending -> downloading...");
    const dlRes = await fetch(`${BASE_URL}/api/firmware/${firmwareId}/status`, {
      method: "PATCH",
      headers: authHeaders,
      body: JSON.stringify({ status: "downloading", progress: 25 })
    });
    assert.strictEqual(dlRes.status, 200);
    const dlData = await dlRes.json();
    assert.strictEqual(dlData.data.status, "downloading");
    assert.strictEqual(dlData.data.progress, 25);
    console.log("✓ Transitioned to 'downloading' (25%)");

    // 5. Test Invalid Backward Transition: downloading -> pending
    console.log("\n5. Testing invalid backward transition rejection (downloading -> pending)...");
    const backRes = await fetch(`${BASE_URL}/api/firmware/${firmwareId}/status`, {
      method: "PATCH",
      headers: authHeaders,
      body: JSON.stringify({ status: "pending", progress: 0 })
    });
    assert.strictEqual(backRes.status, 400);
    console.log("✓ Backward transition correctly rejected with 400");

    // 6. Complete remaining steps: installing -> verifying -> success
    console.log("\n6. Progressing through installing -> verifying -> success...");
    await fetch(`${BASE_URL}/api/firmware/${firmwareId}/status`, {
      method: "PATCH",
      headers: authHeaders,
      body: JSON.stringify({ status: "installing", progress: 50 })
    });

    await fetch(`${BASE_URL}/api/firmware/${firmwareId}/status`, {
      method: "PATCH",
      headers: authHeaders,
      body: JSON.stringify({ status: "verifying", progress: 90 })
    });

    const successRes = await fetch(`${BASE_URL}/api/firmware/${firmwareId}/status`, {
      method: "PATCH",
      headers: authHeaders,
      body: JSON.stringify({ status: "success", progress: 100 })
    });
    assert.strictEqual(successRes.status, 200);
    console.log("✓ Successfully completed update to 'success' (100%)");

    // 7. Verify device firmwareVersion in DB updated to 1.2.0
    const updatedDevice = await Device.findOne({ deviceId: testDevId });
    assert.strictEqual(
      updatedDevice.firmwareVersion,
      "1.2.0",
      "Device firmwareVersion MUST be updated to targetVersion (1.2.0) upon success"
    );
    console.log(`✓ Verified device firmwareVersion in database is now: ${updatedDevice.firmwareVersion}`);

    // 8. Test Failed update does not modify device version
    console.log("\n7. Testing failure handling: failed OTA does NOT alter device version...");
    const failStart = await fetch(`${BASE_URL}/api/firmware`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ deviceId: testDevId, targetVersion: "2.0.0-fail" })
    });
    const failData = await failStart.json();
    const failFwId = failData.data._id;

    await fetch(`${BASE_URL}/api/firmware/${failFwId}/status`, {
      method: "PATCH",
      headers: authHeaders,
      body: JSON.stringify({ status: "failed", errorMessage: "Checksum mismatch" })
    });

    const devAfterFail = await Device.findOne({ deviceId: testDevId });
    assert.strictEqual(
      devAfterFail.firmwareVersion,
      "1.2.0",
      "Failed update MUST NOT modify device firmwareVersion"
    );
    console.log("✓ Failed update safely preserves current device version (1.2.0)");

    console.log("\n==================================================");
    console.log("ALL LIVE FIRMWARE UPDATE AUDITS PASSED WITH ZERO ERRORS.");
    console.log("==================================================\n");
  } finally {
    try {
      await Firmware.deleteMany({ deviceId: testDevId });
      await Device.deleteMany({ deviceId: testDevId });
    } catch (_) {}
    await mongoose.disconnect();
  }
}

runLiveFirmwareAudit()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Live Firmware Audit failed:", err);
    process.exit(1);
  });
