import { useEffect, useMemo, useState } from "react";
import {
  Search,
  Cpu,
  Wifi,
  WifiOff,
  AlertTriangle,
  Thermometer,
  Camera,
  Lock,
  Unlock,
  Radio,
  Activity,
  HardDrive,
  Eye,
  X,
  Clock,
  Layers,
} from "lucide-react";
import { io } from "socket.io-client";

import { getDevices } from "../services/api";

function Devices() {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [inspectDevice, setInspectDevice] = useState(null);

  // --------------------------------------------------
  // INITIAL DEVICE FETCH
  // --------------------------------------------------
  useEffect(() => {
    const loadDevices = async () => {
      try {
        const response = await getDevices();
        setDevices(response.data || []);
      } catch (error) {
        console.error("Device loading failed:", error);
      } finally {
        setLoading(false);
      }
    };

    loadDevices();
  }, []);

  // --------------------------------------------------
  // REAL-TIME SOCKET.IO DEVICE UPDATES
  // --------------------------------------------------
  useEffect(() => {
    const socket = io("http://localhost:5000", {
      transports: ["polling", "websocket"],
    });

    socket.on("connect", () => {
      console.log("Devices page Socket.IO connected:", socket.id);
    });

    socket.on("connect_error", (error) => {
      console.error("Devices page Socket.IO connection failed:", error.message);
    });

    socket.on("device:updated", (updatedDevice) => {
      console.log("DEVICE UPDATE RECEIVED:", updatedDevice);

      // Keep inspected modal device in sync live
      setInspectDevice((current) =>
        current && current.deviceId === updatedDevice.deviceId
          ? updatedDevice
          : current
      );

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

    return () => {
      socket.off("connect");
      socket.off("connect_error");
      socket.off("device:updated");
      socket.disconnect();

      console.log("Devices page Socket.IO disconnected");
    };
  }, []);

  // --------------------------------------------------
  // ESCAPE KEY TO CLOSE INSPECT MODAL
  // --------------------------------------------------
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setInspectDevice(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // --------------------------------------------------
  // CATEGORY DEFINITIONS
  // --------------------------------------------------
  const CATEGORIES = [
    { id: "all", label: "All Assets", icon: Layers },
    { id: "temperature_sensor", label: "Temperature", icon: Thermometer },
    { id: "camera", label: "Cameras", icon: Camera },
    { id: "smart_lock", label: "Smart Locks", icon: Lock },
    { id: "gateway", label: "Gateways", icon: Radio },
    { id: "medical_monitor", label: "Medical", icon: Activity },
  ];

  // --------------------------------------------------
  // CATEGORY COUNTS
  // --------------------------------------------------
  const categoryCounts = useMemo(() => {
    const counts = {
      all: devices.length,
      temperature_sensor: 0,
      camera: 0,
      smart_lock: 0,
      gateway: 0,
      medical_monitor: 0,
    };

    devices.forEach((device) => {
      if (counts[device.type] !== undefined) {
        counts[device.type] += 1;
      }
    });

    return counts;
  }, [devices]);

  // --------------------------------------------------
  // FILTERED DEVICES
  // --------------------------------------------------
  const filteredDevices = useMemo(() => {
    return devices.filter((device) => {
      const searchValue = searchTerm.toLowerCase();

      const matchesSearch =
        device.deviceId?.toLowerCase().includes(searchValue) ||
        device.name?.toLowerCase().includes(searchValue) ||
        device.type?.toLowerCase().includes(searchValue) ||
        device.ipAddress?.toLowerCase().includes(searchValue);

      const matchesStatus =
        statusFilter === "all" || device.status === statusFilter;

      const matchesCategory =
        selectedCategory === "all" || device.type === selectedCategory;

      return matchesSearch && matchesStatus && matchesCategory;
    });
  }, [devices, searchTerm, statusFilter, selectedCategory]);

  // --------------------------------------------------
  // SUMMARY METRICS
  // --------------------------------------------------
  const onlineCount = devices.filter((device) => device.status === "online").length;
  const offlineCount = devices.filter((device) => device.status === "offline").length;
  const alertCount = devices.filter(
    (device) => device.status === "warning" || device.status === "critical"
  ).length;

  // --------------------------------------------------
  // HELPER FORMATTERS
  // --------------------------------------------------
  const getStatusClass = (status) => {
    if (status === "online") {
      return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20";
    }
    if (status === "offline") {
      return "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700";
    }
    if (status === "warning") {
      return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20";
    }
    return "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20";
  };

  const getDeviceIcon = (type) => {
    switch (type) {
      case "temperature_sensor":
        return Thermometer;
      case "camera":
        return Camera;
      case "smart_lock":
        return Lock;
      case "gateway":
        return Radio;
      case "medical_monitor":
        return Activity;
      default:
        return Cpu;
    }
  };

  const formatDeviceType = (type) => {
    if (!type) return "--";
    return type
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const formatHeartbeat = (heartbeat) => {
    if (!heartbeat) return "No heartbeat recorded";
    return new Date(heartbeat).toLocaleString();
  };

  // --------------------------------------------------
  // DEVICE-SPECIFIC TELEMETRY BADGE RENDERER
  // --------------------------------------------------
  const renderDeviceTelemetry = (device) => {
    switch (device.type) {
      case "smart_lock":
        return (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              {device.lockState === "jammed" ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-xs font-semibold text-rose-600 dark:text-rose-400">
                  <AlertTriangle size={12} className="animate-pulse" /> Jammed
                </span>
              ) : device.lockState === "unlocked" ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-600 dark:text-blue-400">
                  <Unlock size={12} /> Unlocked
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  <Lock size={12} /> Locked
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Battery:{" "}
              <span className="font-medium text-slate-800 dark:text-slate-200">
                {device.battery != null ? `${device.battery}%` : "--"}
              </span>
            </p>
          </div>
        );

      case "camera":
        return (
          <div className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
            <p className="flex items-center gap-1.5">
              <HardDrive size={12} className="text-slate-400" />
              Storage:{" "}
              <span className="font-medium text-slate-800 dark:text-slate-200">
                {device.storageUsage != null ? `${device.storageUsage}%` : "--"}
              </span>
            </p>
            <p className="flex items-center gap-1.5">
              <Wifi size={12} className="text-slate-400" />
              Latency:{" "}
              <span className="font-medium text-slate-800 dark:text-slate-200">
                {device.networkLatency != null ? `${device.networkLatency} ms` : "--"}
              </span>
            </p>
          </div>
        );

      case "gateway":
        return (
          <div className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
            <p className="flex items-center gap-1.5">
              <Cpu size={12} className="text-slate-400" />
              CPU Load:{" "}
              <span className="font-medium text-slate-800 dark:text-slate-200">
                {device.cpuUsage != null ? `${device.cpuUsage}%` : "--"}
              </span>
            </p>
            <p className="flex items-center gap-1.5">
              <Radio size={12} className="text-slate-400" />
              Network:{" "}
              <span className="font-medium capitalize text-slate-800 dark:text-slate-200">
                {device.networkStatus || "Connected"}
              </span>
            </p>
          </div>
        );

      case "medical_monitor":
        return (
          <div className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
            <p className="flex items-center gap-1.5">
              <Activity size={12} className="text-emerald-500" />
              Telemetry:{" "}
              <span className="font-medium text-emerald-600 dark:text-emerald-400">
                Monitoring
              </span>
            </p>
            <p>
              Battery:{" "}
              <span className="font-medium text-slate-800 dark:text-slate-200">
                {device.battery != null ? `${device.battery}%` : "--"}
              </span>
            </p>
          </div>
        );

      case "temperature_sensor":
      default:
        return (
          <div className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
            <p className="flex items-center gap-1.5">
              <Thermometer size={12} className="text-cyan-500" />
              Temp:{" "}
              <span className="font-medium text-slate-800 dark:text-slate-200">
                {device.temperature != null ? `${device.temperature}°C` : "--"}
              </span>
            </p>
            <p>
              Battery:{" "}
              <span className="font-medium text-slate-800 dark:text-slate-200">
                {device.battery != null ? `${device.battery}%` : "--"}
              </span>
            </p>
          </div>
        );
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
          Device Fleet Manager
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Hardware inventory, category management, and deep telemetry diagnostics.
        </p>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {/* Total Devices */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Total Assets</p>
              <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">
                {devices.length}
              </p>
            </div>
            <div className="rounded-lg bg-slate-100 p-3 dark:bg-slate-800">
              <Cpu size={20} className="text-slate-600 dark:text-slate-300" />
            </div>
          </div>
        </div>

        {/* Online */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Online Fleet</p>
              <p className="mt-2 text-3xl font-bold text-emerald-500 dark:text-emerald-400">
                {onlineCount}
              </p>
            </div>
            <div className="rounded-lg bg-emerald-500/10 p-3">
              <Wifi size={20} className="text-emerald-500 dark:text-emerald-400" />
            </div>
          </div>
        </div>

        {/* Offline */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Offline</p>
              <p className="mt-2 text-3xl font-bold text-slate-600 dark:text-slate-300">
                {offlineCount}
              </p>
            </div>
            <div className="rounded-lg bg-slate-100 p-3 dark:bg-slate-800">
              <WifiOff size={20} className="text-slate-500 dark:text-slate-400" />
            </div>
          </div>
        </div>

        {/* Active Alerts */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Attention Required</p>
              <p className="mt-2 text-3xl font-bold text-amber-500 dark:text-amber-400">
                {alertCount}
              </p>
            </div>
            <div className="rounded-lg bg-amber-500/10 p-3">
              <AlertTriangle size={20} className="text-amber-500 dark:text-amber-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Category Filter Tabs */}
      <div className="mt-8 flex flex-wrap items-center gap-2">
        {CATEGORIES.map((category) => {
          const Icon = category.icon;
          const isActive = selectedCategory === category.id;
          const count = categoryCounts[category.id] ?? 0;

          return (
            <button
              key={category.id}
              type="button"
              onClick={() => setSelectedCategory(category.id)}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition-all ${
                isActive
                  ? "bg-blue-600 text-white shadow-md shadow-blue-500/20 dark:bg-blue-600 dark:text-white"
                  : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
              }`}
            >
              <Icon size={14} className={isActive ? "text-white" : "text-slate-400"} />
              <span>{category.label}</span>
              <span
                className={`ml-1 rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                  isActive
                    ? "bg-white/20 text-white"
                    : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Device Table Section */}
      <div className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
        {/* Table Toolbar */}
        <div className="flex flex-col gap-4 border-b border-slate-200 px-6 py-5 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-semibold text-slate-900 dark:text-white">
              {CATEGORIES.find((c) => c.id === selectedCategory)?.label || "All"} Hardware Fleet
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Showing {filteredDevices.length} of {devices.length} registered assets.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            {/* Search */}
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-950">
              <Search size={16} className="text-slate-400 dark:text-slate-500" />
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search by ID, name, IP..."
                className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-white dark:placeholder:text-slate-600 sm:w-56"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
            >
              <option value="all">All Status</option>
              <option value="online">Online</option>
              <option value="offline">Offline</option>
              <option value="warning">Warning</option>
              <option value="critical">Critical</option>
            </select>
          </div>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="flex min-h-[300px] items-center justify-center">
            <p className="text-sm text-slate-500">Loading devices...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500 dark:border-slate-800">
                  <th className="px-6 py-4">Device</th>
                  <th className="px-6 py-4">Type</th>
                  <th className="px-6 py-4">Network / IP</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Telemetry</th>
                  <th className="px-6 py-4">Firmware</th>
                  <th className="px-6 py-4">Last Heartbeat</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredDevices.map((device) => {
                  const DeviceIcon = getDeviceIcon(device.type);

                  return (
                    <tr
                      key={device.deviceId}
                      className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60 dark:border-slate-800 dark:hover:bg-slate-950/60 transition-colors"
                    >
                      {/* Device Identification */}
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                            <DeviceIcon size={18} />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-900 dark:text-white">
                              {device.name}
                            </p>
                            <p className="mt-0.5 font-mono text-xs text-slate-500">
                              {device.deviceId}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Type */}
                      <td className="px-6 py-5">
                        <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                          {formatDeviceType(device.type)}
                        </span>
                      </td>

                      {/* Network */}
                      <td className="px-6 py-5">
                        <span className="font-mono text-xs text-slate-600 dark:text-slate-400">
                          {device.ipAddress || "--"}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-6 py-5">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${getStatusClass(
                            device.status
                          )}`}
                        >
                          {device.status}
                        </span>
                      </td>

                      {/* Device-Specific Telemetry */}
                      <td className="px-6 py-5">
                        {renderDeviceTelemetry(device)}
                      </td>

                      {/* Firmware */}
                      <td className="px-6 py-5">
                        <span className="font-mono text-xs text-slate-700 dark:text-slate-300">
                          v{device.firmwareVersion || "1.0.0"}
                        </span>
                      </td>

                      {/* Last Heartbeat */}
                      <td className="px-6 py-5">
                        <span className="text-xs text-slate-500">
                          {formatHeartbeat(device.lastHeartbeat)}
                        </span>
                      </td>

                      {/* Actions: Quick Inspect */}
                      <td className="px-6 py-5 text-right">
                        <button
                          type="button"
                          onClick={() => setInspectDevice(device)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 transition-colors"
                        >
                          <Eye size={13} />
                          <span>Inspect</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {/* Empty State */}
                {filteredDevices.length === 0 && (
                  <tr>
                    <td colSpan="8" className="px-6 py-16 text-center">
                      <Cpu size={32} className="mx-auto text-slate-400 dark:text-slate-700" />
                      <p className="mt-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
                        No devices match current filters
                      </p>
                      <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                        Try selecting "All Assets" or clearing your search term.
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ================================================== */}
      {/* DEVICE INSPECT MODAL DIALOG */}
      {/* ================================================== */}
      {inspectDevice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  {(() => {
                    const ModalIcon = getDeviceIcon(inspectDevice.type);
                    return <ModalIcon size={22} />;
                  })()}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    {inspectDevice.name}
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="font-mono text-xs text-slate-500">
                      {inspectDevice.deviceId}
                    </span>
                    <span className="text-slate-300 dark:text-slate-700">•</span>
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                      {formatDeviceType(inspectDevice.type)}
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setInspectDevice(null)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="max-h-[75vh] overflow-y-auto p-6 space-y-6">
              {/* Status Banner */}
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/70">
                <div className="flex items-center gap-3">
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold capitalize ${getStatusClass(
                      inspectDevice.status
                    )}`}
                  >
                    {inspectDevice.status}
                  </span>
                  <span className="text-xs text-slate-500">
                    Firmware: <span className="font-mono font-medium text-slate-800 dark:text-slate-200">v{inspectDevice.firmwareVersion || "1.0.0"}</span>
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Clock size={13} />
                  <span>{formatHeartbeat(inspectDevice.lastHeartbeat)}</span>
                </div>
              </div>

              {/* Hardware Diagnostics Grid */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
                  Telemetry Diagnostics
                </h4>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {/* Temperature */}
                  <div className="rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900/60">
                    <p className="text-xs text-slate-500">Temperature</p>
                    <p className="mt-1.5 text-lg font-bold text-slate-900 dark:text-white">
                      {inspectDevice.temperature != null ? `${inspectDevice.temperature}°C` : "--"}
                    </p>
                  </div>

                  {/* Battery */}
                  <div className="rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900/60">
                    <p className="text-xs text-slate-500">Battery Level</p>
                    <p className="mt-1.5 text-lg font-bold text-slate-900 dark:text-white">
                      {inspectDevice.battery != null ? `${inspectDevice.battery}%` : "--"}
                    </p>
                  </div>

                  {/* CPU Usage */}
                  <div className="rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900/60">
                    <p className="text-xs text-slate-500">CPU Usage</p>
                    <p className="mt-1.5 text-lg font-bold text-slate-900 dark:text-white">
                      {inspectDevice.cpuUsage != null ? `${inspectDevice.cpuUsage}%` : "--"}
                    </p>
                  </div>

                  {/* Lock State (if smart_lock) */}
                  {inspectDevice.type === "smart_lock" && (
                    <div className="rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900/60">
                      <p className="text-xs text-slate-500">Lock Mechanism</p>
                      <p className="mt-1.5 text-lg font-bold capitalize text-slate-900 dark:text-white">
                        {inspectDevice.lockState || "Locked"}
                      </p>
                    </div>
                  )}

                  {/* Storage Usage (if camera or gateway) */}
                  {(inspectDevice.type === "camera" || inspectDevice.storageUsage != null) && (
                    <div className="rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900/60">
                      <p className="text-xs text-slate-500">Storage Usage</p>
                      <p className="mt-1.5 text-lg font-bold text-slate-900 dark:text-white">
                        {inspectDevice.storageUsage != null ? `${inspectDevice.storageUsage}%` : "--"}
                      </p>
                    </div>
                  )}

                  {/* Network Latency */}
                  <div className="rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900/60">
                    <p className="text-xs text-slate-500">Network Latency</p>
                    <p className="mt-1.5 text-lg font-bold text-slate-900 dark:text-white">
                      {inspectDevice.networkLatency != null ? `${inspectDevice.networkLatency} ms` : "--"}
                    </p>
                  </div>

                  {/* Network Status */}
                  <div className="rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900/60">
                    <p className="text-xs text-slate-500">Connection State</p>
                    <p className="mt-1.5 text-lg font-bold capitalize text-slate-900 dark:text-white">
                      {inspectDevice.networkStatus || "Connected"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Network & Infrastructure Details */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
                  Infrastructure Information
                </h4>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-xs">
                  <div>
                    <dt className="text-slate-400">Assigned IP Address:</dt>
                    <dd className="font-mono font-medium text-slate-800 dark:text-slate-200 mt-0.5">
                      {inspectDevice.ipAddress || "Dynamic / Not Assigned"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">MQTT Client Topic:</dt>
                    <dd className="font-mono font-medium text-slate-800 dark:text-slate-200 mt-0.5">
                      sentricore/devices/{inspectDevice.deviceId}/telemetry
                    </dd>
                  </div>
                </dl>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="border-t border-slate-200 bg-slate-50 px-6 py-4 dark:border-slate-800 dark:bg-slate-950/50 flex justify-end">
              <button
                type="button"
                onClick={() => setInspectDevice(null)}
                className="rounded-lg bg-slate-800 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 transition-colors"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Devices;