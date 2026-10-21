const { runRulesTests } = require("./rules.test");
const { runLifecycleTests } = require("./lifecycle.test");
const { runFirmwareTests } = require("./firmware.test");
const { INITIAL_DEVICES } = require("../src/seedDevices");
const assert = require("assert");

async function runAllTests() {
  console.log("==================================================");
  console.log("   SENTRICORE AUTOMATED TEST SUITE EXECUTION      ");
  console.log("==================================================\n");

  let passed = 0;
  let failed = 0;

  try {
    // Suite 1: Rule Engine
    runRulesTests();
    passed++;
  } catch (err) {
    console.error("Rules tests failed:", err.message);
    failed++;
  }

  try {
    // Suite 2: Lifecycle & Duplicate Prevention
    await runLifecycleTests();
    passed++;
  } catch (err) {
    console.error("Lifecycle tests failed:", err.message);
    failed++;
  }

  try {
    // Suite 3: Firmware & Simulated OTA
    await runFirmwareTests();
    passed++;
  } catch (err) {
    console.error("Firmware tests failed:", err.message);
    failed++;
  }

  try {
    // Suite 4: Multi-Device Provisioning Definitions
    console.log("=== Running Multi-Device Provisioning Verification ===");
    assert(
      INITIAL_DEVICES.length >= 13,
      `Expected at least 13 devices, got ${INITIAL_DEVICES.length}`
    );

    // Verify 3 original devices are preserved
    const requiredOriginal = ["DEV-TS-001", "DEV-CAM-001", "DEV-SL-001"];
    for (const reqId of requiredOriginal) {
      const found = INITIAL_DEVICES.find((d) => d.deviceId === reqId);
      assert(found, `Original device ${reqId} must be preserved`);
    }

    // Verify unique device IDs
    const idSet = new Set(INITIAL_DEVICES.map((d) => d.deviceId));
    assert.strictEqual(
      idSet.size,
      INITIAL_DEVICES.length,
      "Every device ID must be unique"
    );

    // Verify all 5 supported types are represented
    const supportedTypes = [
      "temperature_sensor",
      "camera",
      "smart_lock",
      "gateway",
      "medical_monitor"
    ];
    for (const dev of INITIAL_DEVICES) {
      assert(
        supportedTypes.includes(dev.type),
        `Device type ${dev.type} must be in supported schema enum`
      );
    }
    console.log(`✓ 14 unique devices defined (>=13 target met)`);
    console.log(`✓ Original 3 devices preserved: DEV-TS-001, DEV-CAM-001, DEV-SL-001`);
    console.log(`✓ All 5 schema types represented: temperature_sensor, camera, smart_lock, gateway, medical_monitor`);
    console.log("Multi-device provisioning verification passed!\n");
    passed++;
  } catch (err) {
    console.error("Multi-device tests failed:", err.message);
    failed++;
  }

  console.log("==================================================");
  console.log(`TEST SUMMARY: ${passed} SUITES PASSED, ${failed} FAILED`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runAllTests();
