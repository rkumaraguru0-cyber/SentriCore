import { useEffect, useState } from "react";
import {
  RefreshCw,
  CheckCircle,
  Clock,
  Download,
  LoaderCircle,
  AlertTriangle,
  RotateCcw,
  ArrowUpCircle,
  Lock,
} from "lucide-react";
import { io } from "socket.io-client";

import {
  getFirmwareUpdates,
  getDevices,
  checkFirmwareUpdate,
  BACKEND_URL,
} from "../services/api";

import api from "../services/api";
import { useRole } from "../context/RoleContext";

function Firmware() {
  const { isAdmin } = useRole();
  const [firmwareUpdates, setFirmwareUpdates] = useState([]);
  const [devices, setDevices] = useState([]);
  const [firmwareAvailability, setFirmwareAvailability] =
    useState({});
  const [loading, setLoading] = useState(true);
  const [updatingDevice, setUpdatingDevice] = useState(null);

  useEffect(() => {
    const loadFirmwareData = async () => {
      try {
        const [firmwareResponse, deviceResponse] =
          await Promise.all([
            getFirmwareUpdates(),
            getDevices(),
          ]);

        const loadedDevices =
          deviceResponse.data || [];

        setFirmwareUpdates(
          firmwareResponse.data || []
        );

        setDevices(loadedDevices);

        // Check latest firmware availability
        // for every registered device.
        const availabilityResults =
          await Promise.all(
            loadedDevices.map(async (device) => {
              try {
                const result =
                  await checkFirmwareUpdate(
                    device.deviceId
                  );

                return {
                  deviceId: device.deviceId,
                  data: result.data,
                };
              } catch (error) {
                console.error(
                  `Firmware availability check failed for ${device.deviceId}:`,
                  error
                );

                return {
                  deviceId: device.deviceId,
                  data: null,
                };
              }
            })
          );

        const availabilityMap = {};

        availabilityResults.forEach(
          ({ deviceId, data }) => {
            availabilityMap[deviceId] = data;
          }
        );

        setFirmwareAvailability(
          availabilityMap
        );
      } catch (error) {
        console.error(
          "Firmware data loading failed:",
          error
        );
      } finally {
        setLoading(false);
      }
    };

    loadFirmwareData();
  }, []);

  useEffect(() => {
    const socket = io(BACKEND_URL, {
      transports: ["polling", "websocket"],
    });

    socket.on("connect", () => {
      console.log(
        "Firmware Socket.IO connected:",
        socket.id
      );
    });

    socket.on("connect_error", (error) => {
      console.error(
        "Firmware Socket.IO connection failed:",
        error.message
      );
    });

    socket.on("firmware:updated", (update) => {
      console.log(
        "FIRMWARE UPDATE RECEIVED:",
        update
      );

      setFirmwareUpdates((currentUpdates) =>
        currentUpdates.map((firmware) =>
          firmware.deviceId === update.deviceId &&
          [
            "pending",
            "downloading",
            "installing",
            "verifying",
          ].includes(firmware.status)
            ? {
                ...firmware,
                status: update.status,
                progress: update.progress,
                errorMessage:
                  update.errorMessage,
              }
            : firmware
        )
      );
    });

    socket.on("device:updated", (updatedDevice) => {
      setDevices((currentDevices) =>
        currentDevices.map((device) =>
          device.deviceId ===
          updatedDevice.deviceId
            ? updatedDevice
            : device
        )
      );

      // Refresh firmware availability after
      // device firmware version changes.
      checkFirmwareUpdate(
        updatedDevice.deviceId
      )
        .then((result) => {
          setFirmwareAvailability(
            (current) => ({
              ...current,
              [updatedDevice.deviceId]:
                result.data,
            })
          );
        })
        .catch((error) => {
          console.error(
            "Firmware availability refresh failed:",
            error
          );
        });
    });

    return () => {
      socket.off("connect");
      socket.off("connect_error");
      socket.off("firmware:updated");
      socket.off("device:updated");
      socket.disconnect();

      console.log(
        "Firmware Socket.IO disconnected"
      );
    };
  }, []);

  const startFirmwareUpdate = async (
    deviceId,
    targetVersion
  ) => {
    try {
      setUpdatingDevice(deviceId);

      const device = devices.find(
        (item) => item.deviceId === deviceId
      );

      if (!device) {
        throw new Error(
          "Device not found"
        );
      }

      if (!targetVersion) {
        throw new Error(
          "No firmware update is available"
        );
      }

      const response = await api.post(
        "/firmware",
        {
          deviceId,
          currentVersion:
            device.firmwareVersion,
          targetVersion,
        }
      );

      const result = response.data;

      setFirmwareUpdates((currentUpdates) => [
        result.data,
        ...currentUpdates,
      ]);

      console.log(
        "Firmware update started:",
        result.data
      );
    } catch (error) {
      console.error(
        "Firmware update failed:",
        error
      );

      alert(
        error.response?.data?.message ||
          error.message ||
          "Firmware update failed"
      );
    } finally {
      setUpdatingDevice(null);
    }
  };

  const getStatusClass = (status) => {
    switch (status) {
      case "success":
        return "bg-emerald-500/10 text-emerald-400";

      case "failed":
        return "bg-red-500/10 text-red-400";

      case "rolled_back":
        return "bg-purple-500/10 text-purple-400";

      case "downloading":
        return "bg-blue-500/10 text-blue-400";

      case "installing":
        return "bg-yellow-500/10 text-yellow-400";

      case "verifying":
        return "bg-cyan-500/10 text-cyan-400";

      case "pending":
        return "bg-slate-800 text-slate-400";

      default:
        return "bg-slate-800 text-slate-400";
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "success":
        return <CheckCircle size={15} />;

      case "failed":
        return <AlertTriangle size={15} />;

      case "rolled_back":
        return <RotateCcw size={15} />;

      case "downloading":
        return <Download size={15} />;

      case "installing":
      case "verifying":
        return (
          <LoaderCircle
            size={15}
            className="animate-spin"
          />
        );

      default:
        return <Clock size={15} />;
    }
  };

  const formatStatus = (status) => {
    return status
      ?.split("_")
      .map(
        (word) =>
          word.charAt(0).toUpperCase() +
          word.slice(1)
      )
      .join(" ");
  };

  const activeUpdates =
    firmwareUpdates.filter((update) =>
      [
        "pending",
        "downloading",
        "installing",
        "verifying",
      ].includes(update.status)
    ).length;

  const successfulUpdates =
    firmwareUpdates.filter(
      (update) => update.status === "success"
    ).length;

  const failedUpdates =
    firmwareUpdates.filter(
      (update) =>
        update.status === "failed" ||
        update.status === "rolled_back"
    ).length;

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <p className="text-sm text-slate-500">
          Loading firmware data...
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
          Firmware & OTA
        </h1>

        <p className="mt-2 text-sm text-slate-500">
          Monitor firmware versions and over-the-air
          update operations.
        </p>
      </div>

      {!isAdmin && (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-700 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-300">
          <Lock size={18} className="text-amber-600 dark:text-amber-400 shrink-0" />
          <p className="text-xs font-medium">
            Operator Access Mode: Monitoring OTA firmware deployments. Deployment authorization is restricted to Administrators.
          </p>
        </div>
      )}

      {/* Summary */}
      <div className="mb-6 grid gap-5 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-500/10 p-2">
              <RefreshCw
                size={20}
                className="text-blue-500 dark:text-blue-400"
              />
            </div>

            <div>
              <p className="text-xs text-slate-500">
                Active Updates
              </p>

              <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
                {activeUpdates}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-emerald-500/10 p-2">
              <CheckCircle
                size={20}
                className="text-emerald-500 dark:text-emerald-400"
              />
            </div>

            <div>
              <p className="text-xs text-slate-500">
                Successful
              </p>

              <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
                {successfulUpdates}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-red-500/10 p-2">
              <AlertTriangle
                size={20}
                className="text-red-500 dark:text-red-400"
              />
            </div>

            <div>
              <p className="text-xs text-slate-500">
                Failed
              </p>

              <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
                {failedUpdates}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Device Firmware Inventory */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
        <div className="border-b border-slate-200 px-6 py-5 dark:border-slate-800">
          <h2 className="font-semibold text-slate-900 dark:text-white">
            Device Firmware
          </h2>

          <p className="mt-1 text-xs text-slate-500">
            Monitor installed firmware and start OTA
            updates for registered devices.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500 dark:border-slate-800">
                <th className="px-6 py-4">
                  Device
                </th>

                <th className="px-6 py-4">
                  Type
                </th>

                <th className="px-6 py-4">
                  Current Version
                </th>

                <th className="px-6 py-4">
                  Latest Version
                </th>

                <th className="px-6 py-4">
                  Status
                </th>

                <th className="px-6 py-4">
                  Action
                </th>
              </tr>
            </thead>

            <tbody>
              {devices.map((device) => {
                const activeUpdate =
                  firmwareUpdates.find(
                    (update) =>
                      update.deviceId ===
                        device.deviceId &&
                      [
                        "pending",
                        "downloading",
                        "installing",
                        "verifying",
                      ].includes(
                        update.status
                      )
                  );

                const availability =
                  firmwareAvailability[
                    device.deviceId
                  ];

                const updateAvailable =
                  availability?.updateAvailable;

                const latestVersion =
                  availability?.latestVersion;

                return (
                  <tr
                    key={device.deviceId}
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 dark:border-slate-800 dark:hover:bg-slate-950/50"
                  >
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium text-slate-900 dark:text-white">
                        {device.name}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        {device.deviceId}
                      </p>
                    </td>

                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                      {device.type}
                    </td>

                    <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-300">
                      v{device.firmwareVersion}
                    </td>

                    <td className="px-6 py-4">
                      {latestVersion ? (
                        <div>
                          <p
                            className={`text-sm font-medium ${
                              updateAvailable
                                ? "text-blue-500 dark:text-blue-400"
                                : "text-slate-700 dark:text-slate-300"
                            }`}
                          >
                            v{latestVersion}
                          </p>

                          {updateAvailable && (
                            <p className="mt-1 text-xs text-blue-500 dark:text-blue-400">
                              Update Available
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500">
                          No release
                        </span>
                      )}
                    </td>

                    <td className="px-6 py-4">
                      {activeUpdate ? (
                        <div className="min-w-[180px]">
                          <div className="mb-2 flex items-center justify-between">
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${getStatusClass(
                                activeUpdate.status
                              )}`}
                            >
                              {getStatusIcon(
                                activeUpdate.status
                              )}

                              {formatStatus(
                                activeUpdate.status
                              )}
                            </span>

                            <span className="text-xs text-slate-500">
                              {activeUpdate.progress ?? 0}%
                            </span>
                          </div>

                          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                            <div
                              className="h-full rounded-full bg-blue-500 transition-all duration-500"
                              style={{
                                width: `${activeUpdate.progress ?? 0}%`,
                              }}
                            />
                          </div>
                        </div>
                      ) : updateAvailable ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-2.5 py-1 text-xs font-medium text-blue-500 dark:text-blue-400">
                          <ArrowUpCircle size={14} />
                          Update Available
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 px-2.5 py-1 text-xs font-medium">
                          <CheckCircle size={14} />
                          Up to Date
                        </span>
                      )}
                    </td>

                    <td className="px-6 py-4">
                      {activeUpdate ? (
                        <span className="text-xs text-slate-500">
                          Update in progress
                        </span>
                      ) : updateAvailable ? (
                        isAdmin ? (
                          <button
                            onClick={() =>
                              startFirmwareUpdate(
                                device.deviceId,
                                latestVersion
                              )
                            }
                            disabled={
                              updatingDevice ===
                              device.deviceId
                            }
                            className="inline-flex items-center gap-2 rounded-lg bg-blue-500/10 px-3 py-2 text-xs font-medium text-blue-500 dark:text-blue-400 transition hover:bg-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <RefreshCw
                              size={14}
                              className={
                                updatingDevice ===
                                device.deviceId
                                  ? "animate-spin"
                                  : ""
                              }
                            />

                            {updatingDevice ===
                            device.deviceId
                              ? "Starting..."
                              : `Update to v${latestVersion}`}
                          </button>
                        ) : (
                          <span
                            title="Administrator authorization required to flash firmware"
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 cursor-not-allowed"
                          >
                            <Lock size={12} />
                            <span>Admin Only</span>
                          </span>
                        )
                      ) : (
                        <span className="text-xs text-slate-500">
                          No update
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}

              {devices.length === 0 && (
                <tr>
                  <td
                    colSpan="6"
                    className="px-6 py-10 text-center text-sm text-slate-500"
                  >
                    No devices registered.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Update History */}
      <div className="mt-6 rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
        <div className="border-b border-slate-200 px-6 py-5 dark:border-slate-800">
          <h2 className="font-semibold text-slate-900 dark:text-white">
            OTA Update History
          </h2>

          <p className="mt-1 text-xs text-slate-500">
            Firmware update operations recorded by
            SentriCore.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500 dark:border-slate-800">
                <th className="px-6 py-4">
                  Device
                </th>

                <th className="px-6 py-4">
                  Version
                </th>

                <th className="px-6 py-4">
                  Status
                </th>

                <th className="px-6 py-4">
                  Progress
                </th>

                <th className="px-6 py-4">
                  Started
                </th>
              </tr>
            </thead>

            <tbody>
              {firmwareUpdates.map((update) => (
                <tr
                  key={update._id}
                  className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 dark:border-slate-800 dark:hover:bg-slate-950/50"
                >
                  <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-300">
                    {update.deviceId}
                  </td>

                  <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-300">
                    v{update.currentVersion} → v
                    {update.targetVersion}
                  </td>

                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${getStatusClass(
                        update.status
                      )}`}
                    >
                      {getStatusIcon(
                        update.status
                      )}

                      {formatStatus(
                        update.status
                      )}
                    </span>
                  </td>

                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                        <div
                          className="h-full rounded-full bg-blue-500 transition-all duration-500"
                          style={{
                            width: `${update.progress ?? 0}%`,
                          }}
                        />
                      </div>

                      <span className="text-xs text-slate-500">
                        {update.progress ?? 0}%
                      </span>
                    </div>
                  </td>

                  <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                    {update.startedAt
                      ? new Date(
                          update.startedAt
                        ).toLocaleString()
                      : update.createdAt
                      ? new Date(
                          update.createdAt
                        ).toLocaleString()
                      : "--"}
                  </td>
                </tr>
              ))}

              {firmwareUpdates.length === 0 && (
                <tr>
                  <td
                    colSpan="5"
                    className="px-6 py-10 text-center text-sm text-slate-500"
                  >
                    No firmware update operations found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default Firmware;