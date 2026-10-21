import { useEffect, useState } from "react";
import {
  CheckCircle,
  Clock,
  ShieldAlert,
} from "lucide-react";
import { io } from "socket.io-client";

import { getIncidents, acknowledgeIncident, resolveIncident, BACKEND_URL } from "../services/api";

function Incidents() {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);

  // Load incidents
  useEffect(() => {
    const loadIncidents = async () => {
      try {
        const response = await getIncidents();

        setIncidents(response.data || []);
      } catch (error) {
        console.error(
          "Incidents loading failed:",
          error
        );
      } finally {
        setLoading(false);
      }
    };

    loadIncidents();
  }, []);

  // Realtime incident updates
  useEffect(() => {
    const socket = io(BACKEND_URL, {
      transports: ["polling", "websocket"],
    });

    socket.on("connect", () => {
      console.log(
        "Incidents Socket.IO connected:",
        socket.id
      );
    });

    socket.on("connect_error", (error) => {
      console.error(
        "Incidents Socket.IO connection failed:",
        error.message
      );
    });

    socket.on("incident:created", (newIncident) => {
      console.log(
        "NEW INCIDENT RECEIVED:",
        newIncident
      );

      setIncidents((currentIncidents) => [
        newIncident,
        ...currentIncidents,
      ]);
    });

    socket.on("incident:updated", (updatedIncident) => {
      console.log(
        "INCIDENT UPDATED:",
        updatedIncident
      );

      setIncidents((currentIncidents) =>
        currentIncidents.map((inc) =>
          inc._id === updatedIncident._id ? updatedIncident : inc
        )
      );
    });

    return () => {
      socket.off("connect");
      socket.off("connect_error");
      socket.off("incident:created");
      socket.off("incident:updated");
      socket.disconnect();

      console.log(
        "Incidents Socket.IO disconnected"
      );
    };
  }, []);

  // Acknowledge / Resolve incident
  const updateIncident = async (
    incidentId,
    action
  ) => {
    try {
      setUpdatingId(incidentId);

      if (action === "acknowledge") {
        await acknowledgeIncident(incidentId);
      } else {
        await resolveIncident(incidentId);
      }

      // Reload latest data from backend
      const refreshResponse =
        await getIncidents();

      setIncidents(
        refreshResponse.data || []
      );
    } catch (error) {
      console.error(
        "Incident update failed:",
        error
      );
    } finally {
      setUpdatingId(null);
    }
  };

  // Severity badge
  const severityClass = (severity) => {
    switch (severity) {
      case "critical":
        return "bg-red-500/10 text-red-400";

      case "high":
        return "bg-orange-500/10 text-orange-400";

      case "medium":
        return "bg-yellow-500/10 text-yellow-400";

      case "low":
        return "bg-blue-500/10 text-blue-400";

      default:
        return "bg-slate-800 text-slate-400";
    }
  };

  // Status badge
  const statusClass = (status) => {
    switch (status) {
      case "open":
        return "bg-red-500/10 text-red-400";

      case "acknowledged":
        return "bg-yellow-500/10 text-yellow-400";

      case "resolved":
        return "bg-emerald-500/10 text-emerald-400";

      default:
        return "bg-slate-800 text-slate-400";
    }
  };

  // Incident counts
  const openIncidents = incidents.filter(
    (incident) =>
      incident.status === "open"
  ).length;

  const acknowledgedIncidents =
    incidents.filter(
      (incident) =>
        incident.status === "acknowledged"
    ).length;

  const resolvedIncidents =
    incidents.filter(
      (incident) =>
        incident.status === "resolved"
    ).length;

  // Loading state
  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <p className="text-sm text-slate-500">
          Loading incidents...
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
          Incidents & SLA
        </h1>

        <p className="mt-2 text-sm text-slate-500">
          Track and manage security incidents and
          response status.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="mb-6 grid gap-5 md:grid-cols-3">
        {/* Open */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-red-500/10 p-2">
              <ShieldAlert
                size={20}
                className="text-red-500 dark:text-red-400"
              />
            </div>

            <div>
              <p className="text-xs text-slate-500">
                Open
              </p>

              <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
                {openIncidents}
              </p>
            </div>
          </div>
        </div>

        {/* Acknowledged */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-yellow-500/10 p-2">
              <Clock
                size={20}
                className="text-yellow-600 dark:text-yellow-400"
              />
            </div>

            <div>
              <p className="text-xs text-slate-500">
                Acknowledged
              </p>

              <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
                {acknowledgedIncidents}
              </p>
            </div>
          </div>
        </div>

        {/* Resolved */}
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
                Resolved
              </p>

              <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
                {resolvedIncidents}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Incidents Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
        <div className="border-b border-slate-200 px-6 py-5 dark:border-slate-800">
          <h2 className="font-semibold text-slate-900 dark:text-white">
            Security Incidents
          </h2>

          <p className="mt-1 text-xs text-slate-500">
            Incidents generated from detected security
            events.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500 dark:border-slate-800">
                <th className="px-6 py-4">
                  Incident
                </th>

                <th className="px-6 py-4">
                  Device
                </th>

                <th className="px-6 py-4">
                  Severity
                </th>

                <th className="px-6 py-4">
                  Status
                </th>

                <th className="px-6 py-4">
                  Detected
                </th>

                <th className="px-6 py-4">
                  Action
                </th>
              </tr>
            </thead>

            <tbody>
              {incidents.map((incident) => (
                <tr
                  key={incident._id}
                  className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 dark:border-slate-800 dark:hover:bg-slate-950/50"
                >
                  {/* Incident */}
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium text-slate-900 dark:text-white">
                      {incident.incidentId}
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      {incident.title}
                    </p>
                  </td>

                  {/* Device */}
                  <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-300">
                    {incident.deviceId}
                  </td>

                  {/* Severity */}
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${severityClass(
                        incident.severity
                      )}`}
                    >
                      {incident.severity}
                    </span>
                  </td>

                  {/* Status */}
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusClass(
                        incident.status
                      )}`}
                    >
                      {incident.status}
                    </span>
                  </td>

                  {/* Detected */}
                  <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                    {incident.detectedAt
                      ? new Date(
                          incident.detectedAt
                        ).toLocaleString()
                      : "--"}
                  </td>

                  {/* Action */}
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {incident.status ===
                        "open" && (
                        <button
                          onClick={() =>
                            updateIncident(
                              incident._id,
                              "acknowledge"
                            )
                          }
                          disabled={
                            updatingId ===
                            incident._id
                          }
                          className="rounded-lg bg-yellow-500/10 px-3 py-2 text-xs font-medium text-yellow-600 dark:text-yellow-400 transition hover:bg-yellow-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Acknowledge
                        </button>
                      )}

                      {incident.status ===
                        "acknowledged" && (
                        <button
                          onClick={() =>
                            updateIncident(
                              incident._id,
                              "resolve"
                            )
                          }
                          disabled={
                            updatingId ===
                            incident._id
                          }
                          className="rounded-lg bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-600 dark:text-emerald-400 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Resolve
                        </button>
                      )}

                      {incident.status ===
                        "resolved" && (
                        <span className="text-xs text-slate-500">
                          Completed
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}

              {incidents.length === 0 && (
                <tr>
                  <td
                    colSpan="6"
                    className="px-6 py-10 text-center text-sm text-slate-500"
                  >
                    No security incidents found.
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

export default Incidents;