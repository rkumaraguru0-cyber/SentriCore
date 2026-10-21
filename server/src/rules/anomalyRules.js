const checkAnomalies = (telemetry) => {
  const anomalies = [];

  // Rule 1: High Temperature
  if (
    telemetry.temperature !== undefined &&
    telemetry.temperature !== null &&
    telemetry.temperature > 50
  ) {
    anomalies.push({
      eventType: "high_temperature",
      severity: "high",
      message: `High temperature detected: ${telemetry.temperature}°C`,
      value: telemetry.temperature
    });
  }

  // Rule 2: High CPU Usage
  if (
    telemetry.cpuUsage !== undefined &&
    telemetry.cpuUsage !== null &&
    telemetry.cpuUsage > 90
  ) {
    anomalies.push({
      eventType: "high_cpu",
      severity: "high",
      message: `High CPU usage detected: ${telemetry.cpuUsage}%`,
      value: telemetry.cpuUsage
    });
  }

  // Rule 3: Low Battery
  if (
    telemetry.battery !== undefined &&
    telemetry.battery !== null &&
    telemetry.battery < 15
  ) {
    anomalies.push({
      eventType: "low_battery",
      severity: "medium",
      message: `Low battery detected: ${telemetry.battery}%`,
      value: telemetry.battery
    });
  }

  // Rule 4: Unknown IP
  if (
    telemetry.ipAddress &&
    telemetry.expectedIpAddress &&
    telemetry.ipAddress !== telemetry.expectedIpAddress
  ) {
    anomalies.push({
      eventType: "unknown_ip",
      severity: "critical",
      message: `Unknown IP detected: ${telemetry.ipAddress}`,
      value: null
    });
  }

    // Rule 5: Network Disconnected
  if (telemetry.networkStatus === "disconnected") {
    anomalies.push({
      eventType: "network_disconnected",
      severity: "high",
      message: "Device network connection lost",
      value: null
    });
  }

  // Rule 6: Network Degraded
  if (telemetry.networkStatus === "degraded") {
    anomalies.push({
      eventType: "network_degraded",
      severity: "medium",
      message: "Device network connection is degraded",
      value: null
    });
  }

  // Rule 7: High Network Latency
  if (
    telemetry.networkLatency !== undefined &&
    telemetry.networkLatency !== null &&
    telemetry.networkLatency > 500
  ) {
    anomalies.push({
      eventType: "high_network_latency",
      severity: "high",
      message: `High network latency detected: ${telemetry.networkLatency} ms`,
      value: telemetry.networkLatency
    });
  }

  // Rule 8: High Storage Usage
  if (
    telemetry.storageUsage !== undefined &&
    telemetry.storageUsage !== null &&
    telemetry.storageUsage > 90
  ) {
    anomalies.push({
      eventType: "high_storage_usage",
      severity: "high",
      message: `High storage usage detected: ${telemetry.storageUsage}%`,
      value: telemetry.storageUsage
    });
  }

  // Rule 9: Smart Lock Jammed
  if (telemetry.lockState === "jammed") {
    anomalies.push({
      eventType: "smart_lock_jammed",
      severity: "critical",
      message: "Smart lock jammed state detected",
      value: null
    });
  }

  // Rule 10: Repeated Failed Login Attempts (Brute Force Attack)
  if (
    telemetry.failedLoginAttempts !== undefined &&
    telemetry.failedLoginAttempts !== null &&
    telemetry.failedLoginAttempts >= 5
  ) {
    anomalies.push({
      eventType: "brute_force_attack",
      severity: "critical",
      message: `Brute force attack detected: ${telemetry.failedLoginAttempts} consecutive failed login attempts`,
      value: telemetry.failedLoginAttempts
    });
  }

  return anomalies;
};

/**
 * Checks whether an active anomaly has genuinely recovered based on valid, sufficient telemetry.
 * Returns false if required telemetry is missing, null, NaN, or still anomalous.
 */
const checkAnomalyRecovery = (eventType, telemetry) => {
  if (!telemetry || typeof telemetry !== "object") {
    return false;
  }

  switch (eventType) {
    case "high_temperature":
      return (
        typeof telemetry.temperature === "number" &&
        !isNaN(telemetry.temperature) &&
        telemetry.temperature <= 50
      );

    case "high_cpu":
      return (
        typeof telemetry.cpuUsage === "number" &&
        !isNaN(telemetry.cpuUsage) &&
        telemetry.cpuUsage <= 90
      );

    case "low_battery":
      return (
        typeof telemetry.battery === "number" &&
        !isNaN(telemetry.battery) &&
        telemetry.battery >= 15
      );

    case "unknown_ip":
      return (
        typeof telemetry.ipAddress === "string" &&
        telemetry.ipAddress.length > 0 &&
        typeof telemetry.expectedIpAddress === "string" &&
        telemetry.ipAddress === telemetry.expectedIpAddress
      );

    case "network_disconnected":
      return (
        typeof telemetry.networkStatus === "string" &&
        (telemetry.networkStatus === "connected" ||
          telemetry.networkStatus === "degraded")
      );

    case "network_degraded":
      return (
        typeof telemetry.networkStatus === "string" &&
        telemetry.networkStatus === "connected"
      );

    case "high_network_latency":
      return (
        typeof telemetry.networkLatency === "number" &&
        !isNaN(telemetry.networkLatency) &&
        telemetry.networkLatency <= 500
      );

    case "high_storage_usage":
      return (
        typeof telemetry.storageUsage === "number" &&
        !isNaN(telemetry.storageUsage) &&
        telemetry.storageUsage <= 90
      );

    case "smart_lock_jammed":
      return (
        typeof telemetry.lockState === "string" &&
        (telemetry.lockState === "locked" ||
          telemetry.lockState === "unlocked")
      );

    case "brute_force_attack":
      return (
        typeof telemetry.failedLoginAttempts === "number" &&
        !isNaN(telemetry.failedLoginAttempts) &&
        telemetry.failedLoginAttempts < 5
      );

    default:
      return false;
  }
};

module.exports = {
  checkAnomalies,
  checkAnomalyRecovery
};