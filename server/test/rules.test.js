const assert = require("assert");
const { checkAnomalies, checkAnomalyRecovery } = require("../src/rules/anomalyRules");

function runRulesTests() {
  console.log("=== Running Rule-Based Anomaly Detection Tests ===");

  // Test 1: Normal telemetry produces no anomalies
  const normalTelemetry = {
    deviceId: "DEV-TS-001",
    temperature: 24.5,
    cpuUsage: 35,
    battery: 88,
    ipAddress: "192.168.1.101",
    expectedIpAddress: "192.168.1.101",
    networkStatus: "connected",
    networkLatency: 45,
    storageUsage: 55,
    lockState: "locked",
    failedLoginAttempts: 0
  };

  const normalAnomalies = checkAnomalies(normalTelemetry);
  assert.strictEqual(
    normalAnomalies.length,
    0,
    "Normal telemetry should produce zero anomalies"
  );
  console.log("✓ Normal telemetry: 0 false alerts");

  // Test 2: High Temperature (> 50)
  const highTemp = checkAnomalies({ temperature: 55 });
  assert.strictEqual(highTemp.length, 1);
  assert.strictEqual(highTemp[0].eventType, "high_temperature");
  assert.strictEqual(highTemp[0].severity, "high");
  console.log("✓ High temperature anomaly correctly flagged (>50°C)");

  // Boundary check: 50°C should NOT trigger
  assert.strictEqual(checkAnomalies({ temperature: 50 }).length, 0);
  console.log("✓ High temperature boundary (50°C) not flagged");

  // Test 3: High CPU (> 90)
  const highCpu = checkAnomalies({ cpuUsage: 94 });
  assert.strictEqual(highCpu.length, 1);
  assert.strictEqual(highCpu[0].eventType, "high_cpu");
  assert.strictEqual(highCpu[0].severity, "high");
  console.log("✓ High CPU anomaly correctly flagged (>90%)");

  // Boundary check: 90% should NOT trigger
  assert.strictEqual(checkAnomalies({ cpuUsage: 90 }).length, 0);
  console.log("✓ High CPU boundary (90%) not flagged");

  // Test 4: Low Battery (< 15)
  const lowBattery = checkAnomalies({ battery: 12 });
  assert.strictEqual(lowBattery.length, 1);
  assert.strictEqual(lowBattery[0].eventType, "low_battery");
  assert.strictEqual(lowBattery[0].severity, "medium");
  console.log("✓ Low battery anomaly correctly flagged (<15%)");

  // Boundary check: 15% should NOT trigger
  assert.strictEqual(checkAnomalies({ battery: 15 }).length, 0);
  console.log("✓ Low battery boundary (15%) not flagged");

  // Test 5: Unknown IP
  const unknownIp = checkAnomalies({
    ipAddress: "10.0.0.99",
    expectedIpAddress: "192.168.1.101"
  });
  assert.strictEqual(unknownIp.length, 1);
  assert.strictEqual(unknownIp[0].eventType, "unknown_ip");
  assert.strictEqual(unknownIp[0].severity, "critical");
  console.log("✓ Unknown IP anomaly correctly flagged (critical)");

  // Test 6: Network Disconnected
  const netDisconnected = checkAnomalies({ networkStatus: "disconnected" });
  assert.strictEqual(netDisconnected.length, 1);
  assert.strictEqual(netDisconnected[0].eventType, "network_disconnected");
  assert.strictEqual(netDisconnected[0].severity, "high");
  console.log("✓ Network disconnected anomaly correctly flagged");

  // Test 7: Network Degraded
  const netDegraded = checkAnomalies({ networkStatus: "degraded" });
  assert.strictEqual(netDegraded.length, 1);
  assert.strictEqual(netDegraded[0].eventType, "network_degraded");
  assert.strictEqual(netDegraded[0].severity, "medium");
  console.log("✓ Network degraded anomaly correctly flagged");

  // Test 8: High Network Latency (> 500)
  const highLatency = checkAnomalies({ networkLatency: 650 });
  assert.strictEqual(highLatency.length, 1);
  assert.strictEqual(highLatency[0].eventType, "high_network_latency");
  console.log("✓ High network latency correctly flagged (>500ms)");

  // Test 9: High Storage Usage (> 90)
  const highStorage = checkAnomalies({ storageUsage: 95 });
  assert.strictEqual(highStorage.length, 1);
  assert.strictEqual(highStorage[0].eventType, "high_storage_usage");
  console.log("✓ High storage usage correctly flagged (>90%)");

  // Test 10: Smart Lock Jammed
  const lockJammed = checkAnomalies({ lockState: "jammed" });
  assert.strictEqual(lockJammed.length, 1);
  assert.strictEqual(lockJammed[0].eventType, "smart_lock_jammed");
  assert.strictEqual(lockJammed[0].severity, "critical");
  console.log("✓ Smart lock jammed correctly flagged (critical)");

  // Test 11: Brute Force Attack (>= 5 failed logins)
  const bruteForce = checkAnomalies({ failedLoginAttempts: 5 });
  assert.strictEqual(bruteForce.length, 1);
  assert.strictEqual(bruteForce[0].eventType, "brute_force_attack");
  assert.strictEqual(bruteForce[0].severity, "critical");
  console.log("✓ Brute force attack correctly flagged (>=5 failed attempts, critical)");

  // Boundary check: 4 failed attempts should NOT trigger brute force
  assert.strictEqual(checkAnomalies({ failedLoginAttempts: 4 }).length, 0);
  console.log("✓ Failed logins boundary (4 attempts) not flagged");

  // Test 12: Missing or undefined fields do NOT throw or produce false anomalies
  const emptyTelemetry = {};
  assert.doesNotThrow(() => {
    const res = checkAnomalies(emptyTelemetry);
    assert.strictEqual(res.length, 0);
  });
  console.log("✓ Undefined / null fields handled gracefully without errors");

  console.log("All 12 rule-based anomaly detection tests passed successfully!");

  console.log("\n=== Running Anomaly Recovery Verification Tests ===");
  // Test 13: Missing/null telemetry NEVER recovers anomalies
  assert.strictEqual(checkAnomalyRecovery("high_temperature", {}), false, "Empty telemetry cannot recover high_temperature");
  assert.strictEqual(checkAnomalyRecovery("high_temperature", null), false, "Null telemetry cannot recover high_temperature");
  assert.strictEqual(checkAnomalyRecovery("high_temperature", { temperature: null }), false, "Null field cannot recover high_temperature");
  assert.strictEqual(checkAnomalyRecovery("high_temperature", { temperature: NaN }), false, "NaN field cannot recover high_temperature");
  assert.strictEqual(checkAnomalyRecovery("high_temperature", { temperature: "invalid" }), false, "String field cannot recover high_temperature");
  console.log("✓ Missing, null, NaN, and invalid telemetry safely rejected from recovery");

  // Test 14: High Temperature recovery
  assert.strictEqual(checkAnomalyRecovery("high_temperature", { temperature: 25.0 }), true, "Healthy temp recovers");
  assert.strictEqual(checkAnomalyRecovery("high_temperature", { temperature: 50.0 }), true, "50°C boundary recovers");
  assert.strictEqual(checkAnomalyRecovery("high_temperature", { temperature: 50.1 }), false, "50.1°C does not recover");
  assert.strictEqual(checkAnomalyRecovery("high_temperature", { temperature: 65.0 }), false, "Still hot does not recover");
  console.log("✓ High temperature recovery verified (healthy <= 50°C)");

  // Test 15: High CPU recovery
  assert.strictEqual(checkAnomalyRecovery("high_cpu", { cpuUsage: 45 }), true, "Normal CPU recovers");
  assert.strictEqual(checkAnomalyRecovery("high_cpu", { cpuUsage: 90 }), true, "90% boundary recovers");
  assert.strictEqual(checkAnomalyRecovery("high_cpu", { cpuUsage: 91 }), false, "91% does not recover");
  console.log("✓ High CPU recovery verified (healthy <= 90%)");

  // Test 16: Low Battery recovery
  assert.strictEqual(checkAnomalyRecovery("low_battery", { battery: 80 }), true, "Normal battery recovers");
  assert.strictEqual(checkAnomalyRecovery("low_battery", { battery: 15 }), true, "15% boundary recovers");
  assert.strictEqual(checkAnomalyRecovery("low_battery", { battery: 14 }), false, "14% does not recover");
  console.log("✓ Low battery recovery verified (healthy >= 15%)");

  // Test 17: Unknown IP recovery
  assert.strictEqual(
    checkAnomalyRecovery("unknown_ip", {
      ipAddress: "192.168.1.101",
      expectedIpAddress: "192.168.1.101"
    }),
    true,
    "Matching IP recovers"
  );
  assert.strictEqual(
    checkAnomalyRecovery("unknown_ip", {
      ipAddress: "10.0.0.99",
      expectedIpAddress: "192.168.1.101"
    }),
    false,
    "Mismatched IP does not recover"
  );
  console.log("✓ Unknown IP recovery verified (ip matches expected)");

  // Test 18: Network Disconnected & Degraded recovery
  assert.strictEqual(checkAnomalyRecovery("network_disconnected", { networkStatus: "connected" }), true);
  assert.strictEqual(checkAnomalyRecovery("network_disconnected", { networkStatus: "disconnected" }), false);
  assert.strictEqual(checkAnomalyRecovery("network_degraded", { networkStatus: "connected" }), true);
  assert.strictEqual(checkAnomalyRecovery("network_degraded", { networkStatus: "degraded" }), false);
  console.log("✓ Network disconnected and degraded recovery verified");

  // Test 19: High Network Latency recovery
  assert.strictEqual(checkAnomalyRecovery("high_network_latency", { networkLatency: 120 }), true);
  assert.strictEqual(checkAnomalyRecovery("high_network_latency", { networkLatency: 500 }), true);
  assert.strictEqual(checkAnomalyRecovery("high_network_latency", { networkLatency: 550 }), false);
  console.log("✓ High network latency recovery verified (healthy <= 500ms)");

  // Test 20: High Storage Usage recovery
  assert.strictEqual(checkAnomalyRecovery("high_storage_usage", { storageUsage: 70 }), true);
  assert.strictEqual(checkAnomalyRecovery("high_storage_usage", { storageUsage: 90 }), true);
  assert.strictEqual(checkAnomalyRecovery("high_storage_usage", { storageUsage: 92 }), false);
  console.log("✓ High storage usage recovery verified (healthy <= 90%)");

  // Test 21: Smart Lock Jammed recovery
  assert.strictEqual(checkAnomalyRecovery("smart_lock_jammed", { lockState: "locked" }), true);
  assert.strictEqual(checkAnomalyRecovery("smart_lock_jammed", { lockState: "unlocked" }), true);
  assert.strictEqual(checkAnomalyRecovery("smart_lock_jammed", { lockState: "jammed" }), false);
  console.log("✓ Smart lock jammed recovery verified (locked or unlocked)");

  // Test 22: Brute Force Attack recovery
  assert.strictEqual(checkAnomalyRecovery("brute_force_attack", { failedLoginAttempts: 0 }), true);
  assert.strictEqual(checkAnomalyRecovery("brute_force_attack", { failedLoginAttempts: 4 }), true);
  assert.strictEqual(checkAnomalyRecovery("brute_force_attack", { failedLoginAttempts: 5 }), false);
  console.log("✓ Brute force attack recovery verified (< 5 failed attempts)");

  console.log("All anomaly detection & recovery tests passed successfully!\n");
}

module.exports = { runRulesTests };

if (require.main === module) {
  runRulesTests();
}
