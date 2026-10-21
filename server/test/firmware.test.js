const assert = require("assert");

class MockFirmwareEngine {
  constructor() {
    this.devices = new Map([
      ["DEV-TS-001", { deviceId: "DEV-TS-001", firmwareVersion: "1.0.0" }],
      ["DEV-CAM-001", { deviceId: "DEV-CAM-001", firmwareVersion: "1.0.0" }]
    ]);
    this.firmwareRecords = [];
  }

  startUpdate(deviceId, targetVersion) {
    const active = this.firmwareRecords.find(
      (r) =>
        r.deviceId === deviceId &&
        ["pending", "downloading", "installing", "verifying"].includes(r.status)
    );
    if (active) {
      throw new Error("Firmware update already in progress for this device");
    }

    const device = this.devices.get(deviceId);
    if (!device) {
      throw new Error("Device not found");
    }

    const record = {
      _id: `fw-${this.firmwareRecords.length + 1}`,
      deviceId,
      currentVersion: device.firmwareVersion,
      targetVersion,
      status: "pending",
      progress: 0
    };
    this.firmwareRecords.push(record);
    return record;
  }

  processStatusUpdate(updatePayload) {
    const { deviceId, status, progress, firmwareId } = updatePayload;
    let record = null;
    if (firmwareId) {
      record = this.firmwareRecords.find((r) => r._id === firmwareId);
    }
    if (!record) {
      record = this.firmwareRecords.find(
        (r) =>
          r.deviceId === deviceId &&
          ["pending", "downloading", "installing", "verifying"].includes(r.status)
      );
    }
    if (!record) return null;

    const VALID_TRANSITIONS = {
      pending: ["downloading", "failed"],
      downloading: ["installing", "failed", "rolled_back"],
      installing: ["verifying", "failed", "rolled_back"],
      verifying: ["success", "failed", "rolled_back"],
      success: [],
      failed: [],
      rolled_back: []
    };

    if (record.status !== status) {
      const allowed = VALID_TRANSITIONS[record.status] || [];
      if (!allowed.includes(status)) {
        throw new Error(`Invalid state transition from '${record.status}' to '${status}'`);
      }
    }

    record.status = status;
    record.progress = progress;

    if (status === "success") {
      const device = this.devices.get(deviceId);
      if (device) {
        device.firmwareVersion = record.targetVersion;
      }
    }
    return record;
  }
}

async function runFirmwareTests() {
  console.log("=== Running Firmware Management & Simulated OTA Tests ===");
  const engine = new MockFirmwareEngine();

  // Test 1: Start OTA update
  const update = engine.startUpdate("DEV-TS-001", "1.1.0");
  assert.strictEqual(update.status, "pending");
  assert.strictEqual(update.targetVersion, "1.1.0");
  console.log("✓ Firmware update initiated in pending state");

  // Test 2: Prevent multiple concurrent updates for same device
  assert.throws(() => {
    engine.startUpdate("DEV-TS-001", "1.2.0");
  }, /Firmware update already in progress/);
  console.log("✓ Duplicate update request blocked while one is in progress");

  // Test 3: Progress status transitions via firmwareId correlation
  engine.processStatusUpdate({
    deviceId: "DEV-TS-001",
    firmwareId: update._id,
    status: "downloading",
    progress: 25
  });
  assert.strictEqual(update.status, "downloading");
  assert.strictEqual(update.progress, 25);
  console.log("✓ Downloading progress state recorded (25%)");

  engine.processStatusUpdate({
    deviceId: "DEV-TS-001",
    firmwareId: update._id,
    status: "installing",
    progress: 50
  });
  assert.strictEqual(update.status, "installing");
  assert.strictEqual(update.progress, 50);
  console.log("✓ Installing progress state recorded (50%)");

  engine.processStatusUpdate({
    deviceId: "DEV-TS-001",
    firmwareId: update._id,
    status: "verifying",
    progress: 90
  });
  assert.strictEqual(update.status, "verifying");
  assert.strictEqual(update.progress, 90);
  console.log("✓ Verifying progress state recorded (90%)");

  // Test 4: Successful completion updates device firmware version
  engine.processStatusUpdate({
    deviceId: "DEV-TS-001",
    firmwareId: update._id,
    status: "success",
    progress: 100
  });
  assert.strictEqual(update.status, "success");
  const device = engine.devices.get("DEV-TS-001");
  assert.strictEqual(
    device.firmwareVersion,
    "1.1.0",
    "Device firmware version MUST be updated to 1.1.0 on success"
  );
  console.log("✓ Device firmware version successfully updated to 1.1.0 after verified success");

  // Test 5: Failed update does NOT update device version
  const failUpdate = engine.startUpdate("DEV-CAM-001", "2.0.0-fail");
  engine.processStatusUpdate({
    deviceId: "DEV-CAM-001",
    firmwareId: failUpdate._id,
    status: "failed",
    progress: 0
  });
  const camDevice = engine.devices.get("DEV-CAM-001");
  assert.strictEqual(
    camDevice.firmwareVersion,
    "1.0.0",
    "Device firmware version MUST NOT be changed on failed OTA"
  );
  console.log("✓ Failed update does not modify device firmware version");

  // Test 6: Enforce valid state transitions (reject illegal or out-of-order jumps)
  const badTransitionUpdate = engine.startUpdate("DEV-CAM-001", "2.1.0");
  assert.throws(() => {
    // Illegal jump: pending -> success directly
    engine.processStatusUpdate({
      deviceId: "DEV-CAM-001",
      firmwareId: badTransitionUpdate._id,
      status: "success",
      progress: 100
    });
  }, /Invalid state transition from 'pending' to 'success'/);
  console.log("✓ Illegal jump transition (pending -> success) blocked");

  // Legal step: pending -> downloading
  engine.processStatusUpdate({
    deviceId: "DEV-CAM-001",
    firmwareId: badTransitionUpdate._id,
    status: "downloading",
    progress: 10
  });

  // Illegal reverse step: downloading -> pending
  assert.throws(() => {
    engine.processStatusUpdate({
      deviceId: "DEV-CAM-001",
      firmwareId: badTransitionUpdate._id,
      status: "pending",
      progress: 0
    });
  }, /Invalid state transition/);
  console.log("✓ Illegal backward transition (downloading -> pending) blocked");

  console.log("All firmware management and OTA tests passed successfully!\n");
}

module.exports = { runFirmwareTests };

if (require.main === module) {
  runFirmwareTests();
}
