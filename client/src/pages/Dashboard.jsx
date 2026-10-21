import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Cpu,
  Wifi,
  WifiOff,
  AlertTriangle,
  ShieldAlert,
  Thermometer,
  Camera,
  Lock,
  Radio,
  Activity,
  ArrowRight,
  ShieldCheck,
  Clock,
  ChevronRight,
} from "lucide-react";
import { io } from "socket.io-client";

import MetricCard from "../components/MetricCard";
import {
  getDevices,
  getSecurityEvents,
  getIncidents,
  BACKEND_URL,
} from "../services/api";

function Dashboard() {
  const [devices, setDevices] = useState([]);
  const [securityEvents, setSecurityEvents] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);

  // ==================================================
  // INITIAL DASHBOARD DATA
  // ==================================================
  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        const [deviceData, eventData, incidentData] = await Promise.all([
          getDevices(),
          getSecurityEvents(),
          getIncidents(),
        ]);

        setDevices(deviceData.data || []);
        setSecurityEvents(eventData.data || []);
        setIncidents(incidentData.data || []);
      } catch (error) {
        console.error("Dashboard data loading failed:", error);
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, []);

  // ==================================================
  // REAL-TIME SOCKET.IO DEVICE & THREAT UPDATES
  // ==================================================
  useEffect(() => {
    const socket = io(BACKEND_URL, {
      transports: ["polling", "websocket"],
    });

    socket.on("connect", () => {
      console.log("Dashboard Socket.IO connected:", socket.id);
    });

    socket.on("connect_error", (error) => {
      console.error("Dashboard Socket.IO connection failed:", error.message);
    });

    // Receive live device updates
    socket.on("device:updated", (updatedDevice) => {
      setDevices((currentDevices) => {
        const deviceExists = currentDevices.some(
          (device) => device.deviceId === updatedDevice.deviceId
        );

        if (!deviceExists) {
          return [...currentDevices, updatedDevice];
        }

        return currentDevices.map((device) =>
          device.deviceId === updatedDevice.deviceId ? updatedDevice : device
        );
      });
    });

    // Receive live security event creation
    socket.on("security-event:created", (newEvent) => {
      setSecurityEvents((prev) => [newEvent, ...prev]);
    });

    // Receive live security event updates
    socket.on("security-event:updated", (updatedEvent) => {
      setSecurityEvents((prev) =>
        prev.map((evt) => (evt._id === updatedEvent._id ? updatedEvent : evt))
      );
    });

    // Receive live incident creation
    socket.on("incident:created", (newIncident) => {
      setIncidents((prev) => [newIncident, ...prev]);
    });

    // Receive live incident updates
    socket.on("incident:updated", (updatedIncident) => {
      setIncidents((prev) =>
        prev.map((inc) => (inc._id === updatedIncident._id ? updatedIncident : inc))
      );
    });

    return () => {
      socket.off("connect");
      socket.off("connect_error");
      socket.off("device:updated");
      socket.off("security-event:created");
      socket.off("security-event:updated");
      socket.off("incident:created");
      socket.off("incident:updated");
      socket.disconnect();

      console.log("Dashboard Socket.IO disconnected");
    };
  }, []);

  // ==================================================
  // COMPUTED DASHBOARD METRICS
  // ==================================================
  const onlineDevices = useMemo(
    () => devices.filter((device) => device.status === "online").length,
    [devices]
  );

  const offlineDevices = useMemo(
    () => devices.filter((device) => device.status === "offline").length,
    [devices]
  );

  const openIncidents = useMemo(
    () =>
      incidents.filter(
        (incident) =>
          incident.status === "open" || incident.status === "acknowledged"
      ).length,
    [incidents]
  );

  // Category breakdown metrics
  const categoryStats = useMemo(() => {
    const stats = {
      temperature_sensor: { total: 0, online: 0, alert: 0 },
      camera: { total: 0, online: 0, alert: 0 },
      smart_lock: { total: 0, online: 0, alert: 0 },
      gateway: { total: 0, online: 0, alert: 0 },
      medical_monitor: { total: 0, online: 0, alert: 0 },
    };

    devices.forEach((dev) => {
      if (stats[dev.type]) {
        stats[dev.type].total += 1;
        if (dev.status === "online") stats[dev.type].online += 1;
        if (dev.status === "warning" || dev.status === "critical") {
          stats[dev.type].alert += 1;
        }
      }
    });

    return stats;
  }, [devices]);

  // Devices requiring immediate attention
  const attentionDevices = useMemo(
    () =>
      devices.filter(
        (dev) => dev.status === "warning" || dev.status === "critical"
      ),
    [devices]
  );

  // Active / recent actionable threats
  const activeThreats = useMemo(() => {
    // Open incidents first
    const activeIncs = incidents
      .filter((inc) => inc.status === "open" || inc.status === "acknowledged")
      .map((inc) => ({
        id: inc._id,
        title: inc.title,
        deviceId: inc.deviceId,
        severity: inc.severity,
        detectedAt: inc.detectedAt,
        type: "incident",
      }));

    // If fewer than 4 incidents, pad with latest unacknowledged or recent events
    if (activeIncs.length < 4) {
      const recentEvts = securityEvents
        .slice(0, 4 - activeIncs.length)
        .map((evt) => ({
          id: evt._id,
          title: evt.message,
          deviceId: evt.deviceId,
          severity: evt.severity,
          detectedAt: evt.detectedAt,
          type: "event",
        }));

      return [...activeIncs, ...recentEvts];
    }

    return activeIncs.slice(0, 5);
  }, [incidents, securityEvents]);

  // ==================================================
  // LOADING STATE
  // ==================================================
  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <p className="text-sm text-slate-500">
          Loading SOC control room data...
        </p>
      </div>
    );
  }

  // ==================================================
  // DASHBOARD UI
  // ==================================================
  return (
    <div className="space-y-8">
      {/* Top Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
            Security Overview
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Executive SOC overview of your 14 connected IoT assets and live threat surface.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="flex h-2.5 w-2.5 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
          </span>
          <span className="font-mono text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            SOC Live Radar
          </span>
        </div>
      </div>

      {/* Top KPI Metrics Row (5 Cards) */}
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          title="Total Assets"
          value={devices.length}
          description="Registered IoT devices"
          icon={Cpu}
        />

        <MetricCard
          title="Online Fleet"
          value={onlineDevices}
          description="Currently transmitting"
          icon={Wifi}
        />

        <MetricCard
          title="Offline Assets"
          value={offlineDevices}
          description="Awaiting telemetry pulse"
          icon={WifiOff}
        />

        <MetricCard
          title="Security Events"
          value={securityEvents.length}
          description="Telemetry rule alerts"
          icon={AlertTriangle}
        />

        <MetricCard
          title="Open Incidents"
          value={openIncidents}
          description="Active triage tickets"
          icon={ShieldAlert}
        />
      </div>

      {/* Core Operational Section: Fleet Category Health vs Live Security Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ================================================== */}
        {/* LEFT COLUMN: FLEET CATEGORY HEALTH WIDGET (7 Cols) */}
        {/* ================================================== */}
        <div className="lg:col-span-7 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:shadow-none flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-5 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Fleet Category Health
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Distribution & operational status across 5 hardware families
                </p>
              </div>

              <span className="rounded-full bg-blue-500/10 px-2.5 py-1 text-xs font-semibold text-blue-600 dark:text-blue-400">
                14 Total Assets
              </span>
            </div>

            {/* Category Rows */}
            <div className="mt-5 space-y-3.5">
              {/* 1. Temperature Sensors */}
              <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/60 p-4 dark:border-slate-800/80 dark:bg-slate-950/40 hover:border-slate-200 dark:hover:border-slate-700 transition-colors">
                <div className="flex items-center gap-3.5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
                    <Thermometer size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                      Temperature Sensors
                    </h3>
                    <p className="text-xs text-slate-500">
                      Cold storage, server room, and duct sensors
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-sm font-bold text-slate-900 dark:text-white">
                    {categoryStats.temperature_sensor.total} Units
                  </p>
                  <p className="mt-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    {categoryStats.temperature_sensor.online} Online • {categoryStats.temperature_sensor.alert} Alerts
                  </p>
                </div>
              </div>

              {/* 2. Security Cameras */}
              <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/60 p-4 dark:border-slate-800/80 dark:bg-slate-950/40 hover:border-slate-200 dark:hover:border-slate-700 transition-colors">
                <div className="flex items-center gap-3.5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                    <Camera size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                      Security Cameras
                    </h3>
                    <p className="text-xs text-slate-500">
                      Entrance, perimeter, garage, loading dock feeds
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-sm font-bold text-slate-900 dark:text-white">
                    {categoryStats.camera.total} Units
                  </p>
                  <p className="mt-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    {categoryStats.camera.online} Online • {categoryStats.camera.alert} Alerts
                  </p>
                </div>
              </div>

              {/* 3. Smart Locks */}
              <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/60 p-4 dark:border-slate-800/80 dark:bg-slate-950/40 hover:border-slate-200 dark:hover:border-slate-700 transition-colors">
                <div className="flex items-center gap-3.5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <Lock size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                      Access Smart Locks
                    </h3>
                    <p className="text-xs text-slate-500">
                      Server room, data center, executive suites
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-sm font-bold text-slate-900 dark:text-white">
                    {categoryStats.smart_lock.total} Units
                  </p>
                  <p className="mt-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    {categoryStats.smart_lock.online} Online • {categoryStats.smart_lock.alert} Alerts
                  </p>
                </div>
              </div>

              {/* 4. IoT Gateways */}
              <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/60 p-4 dark:border-slate-800/80 dark:bg-slate-950/40 hover:border-slate-200 dark:hover:border-slate-700 transition-colors">
                <div className="flex items-center gap-3.5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                    <Radio size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                      Core IoT Gateways
                    </h3>
                    <p className="text-xs text-slate-500">
                      Building core & industrial automation bridges
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-sm font-bold text-slate-900 dark:text-white">
                    {categoryStats.gateway.total} Units
                  </p>
                  <p className="mt-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    {categoryStats.gateway.online} Online • {categoryStats.gateway.alert} Alerts
                  </p>
                </div>
              </div>

              {/* 5. Medical Vital Monitors */}
              <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/60 p-4 dark:border-slate-800/80 dark:bg-slate-950/40 hover:border-slate-200 dark:hover:border-slate-700 transition-colors">
                <div className="flex items-center gap-3.5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
                    <Activity size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                      Medical Vital Monitors
                    </h3>
                    <p className="text-xs text-slate-500">
                      ICU and operating room patient telemetry
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-sm font-bold text-slate-900 dark:text-white">
                    {categoryStats.medical_monitor.total} Units
                  </p>
                  <p className="mt-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    {categoryStats.medical_monitor.online} Online • {categoryStats.medical_monitor.alert} Alerts
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Action Link to Devices Fleet Page */}
          <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800">
            <Link
              to="/devices"
              className="flex items-center justify-between rounded-xl bg-slate-100 px-4 py-3 text-xs font-semibold text-slate-700 hover:bg-blue-600 hover:text-white dark:bg-slate-800/90 dark:text-slate-300 dark:hover:bg-blue-600 dark:hover:text-white transition-all group"
            >
              <span>Inspect All Hardware in Fleet Manager</span>
              <ArrowRight size={15} className="group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>

        {/* ================================================== */}
        {/* RIGHT COLUMN: LIVE THREAT & INCIDENT FEED (5 Cols) */}
        {/* ================================================== */}
        <div className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:shadow-none flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-5 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Live Security Radar
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Real-time anomalous telemetry & threat triggers
                </p>
              </div>

              <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 px-2.5 py-1 text-xs font-semibold text-rose-600 dark:text-rose-400">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
                Active Feed
              </span>
            </div>

            {/* Threat List or Zero-Threat Shield */}
            <div className="mt-5 space-y-3">
              {activeThreats.length > 0 ? (
                activeThreats.map((threat) => (
                  <div
                    key={`${threat.type}-${threat.id}`}
                    className="flex flex-col gap-2 rounded-xl border border-slate-100 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-950/50 hover:border-slate-200 dark:hover:border-slate-700 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                          threat.severity === "critical"
                            ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                            : threat.severity === "high"
                            ? "bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20"
                            : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                        }`}
                      >
                        {threat.severity}
                      </span>

                      <span className="flex items-center gap-1 text-[11px] text-slate-400">
                        <Clock size={11} />
                        {new Date(threat.detectedAt).toLocaleTimeString()}
                      </span>
                    </div>

                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-white line-clamp-1">
                        {threat.title}
                      </p>
                      <p className="mt-0.5 font-mono text-[11px] text-slate-500">
                        Target: {threat.deviceId}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                      <Link
                        to={threat.type === "incident" ? "/incidents" : "/security-events"}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        <span>Investigate {threat.type === "incident" ? "Incident" : "Event"}</span>
                        <ChevronRight size={12} />
                      </Link>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-500">
                    <ShieldCheck size={36} />
                  </div>
                  <h3 className="mt-4 text-sm font-bold text-slate-900 dark:text-white">
                    All Systems Guarded
                  </h3>
                  <p className="mt-1 text-xs text-slate-500 max-w-xs">
                    Zero anomalous security threats or open incident tickets currently active across the fleet.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Quick SLA / Incident Management Link */}
          <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800">
            <Link
              to="/incidents"
              className="flex items-center justify-between rounded-xl bg-slate-100 px-4 py-3 text-xs font-semibold text-slate-700 hover:bg-slate-200 dark:bg-slate-800/90 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors group"
            >
              <span>View Incident Response Tickets</span>
              <ChevronRight size={15} className="group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>
      </div>

      {/* ================================================== */}
      {/* ATTENTION REQUIRED DEVICES CALLOUT (Only if any)   */}
      {/* ================================================== */}
      {attentionDevices.length > 0 && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-6 dark:border-amber-500/20 dark:bg-amber-500/5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={18} className="text-amber-500" />
            <h2 className="text-sm font-bold text-amber-700 dark:text-amber-400">
              Hardware Fleet Requiring Operator Attention ({attentionDevices.length})
            </h2>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {attentionDevices.map((dev) => (
              <div
                key={dev.deviceId}
                className="flex items-center justify-between rounded-xl border border-amber-200/50 bg-white p-3.5 shadow-sm dark:border-amber-500/20 dark:bg-slate-900"
              >
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-white">
                    {dev.name}
                  </p>
                  <p className="font-mono text-[11px] text-slate-400">
                    {dev.deviceId}
                  </p>
                </div>

                <Link
                  to="/devices"
                  className="rounded-lg bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-600 hover:bg-amber-500 hover:text-white dark:text-amber-400 dark:hover:bg-amber-500 dark:hover:text-white transition-colors"
                >
                  Inspect
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;