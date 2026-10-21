import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle,
  ShieldAlert,
} from "lucide-react";
import { io } from "socket.io-client";

import {
  getSecurityEvents,
  acknowledgeSecurityEvent,
  resolveSecurityEvent,
} from "../services/api";

function SecurityEvents() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [acknowledgingId, setAcknowledgingId] = useState(null);
  const [resolvingId, setResolvingId] = useState(null);

  useEffect(() => {
    const loadSecurityEvents = async () => {
      try {
        const response = await getSecurityEvents();

        setEvents(response.data || []);
      } catch (error) {
        console.error(
          "Security events loading failed:",
          error
        );
      } finally {
        setLoading(false);
      }
    };

    loadSecurityEvents();
  }, []);

  useEffect(() => {
    const socket = io("http://localhost:5000", {
      transports: ["polling", "websocket"],
    });

    socket.on("connect", () => {
      console.log(
        "Security Events Socket.IO connected:",
        socket.id
      );
    });

    socket.on("connect_error", (error) => {
      console.error(
        "Security Events Socket.IO connection failed:",
        error.message
      );
    });

    socket.on("security-event:created", (newEvent) => {
      console.log(
        "NEW SECURITY EVENT RECEIVED:",
        newEvent
      );

      setEvents((currentEvents) => [
        newEvent,
        ...currentEvents,
      ]);
    });

    socket.on("security-event:updated", (updatedEvent) => {
      console.log(
        "SECURITY EVENT UPDATED:",
        updatedEvent
      );

      setEvents((currentEvents) =>
        currentEvents.map((event) =>
          event._id === updatedEvent._id
            ? updatedEvent
            : event
        )
      );
    });

    return () => {
      socket.off("connect");
      socket.off("connect_error");
      socket.off("security-event:created");
      socket.off("security-event:updated");
      socket.disconnect();

      console.log(
        "Security Events Socket.IO disconnected"
      );
    };
  }, []);

  const handleAcknowledge = async (eventId) => {
    try {
      setAcknowledgingId(eventId);

      await acknowledgeSecurityEvent(eventId);

      setEvents((currentEvents) =>
        currentEvents.map((event) =>
          event._id === eventId
            ? {
                ...event,
                acknowledged: true,
              }
            : event
        )
      );
    } catch (error) {
      console.error(
        "Security event acknowledgement failed:",
        error
      );
    } finally {
      setAcknowledgingId(null);
    }
  };

  const handleResolve = async (eventId) => {
    try {
      setResolvingId(eventId);

      await resolveSecurityEvent(eventId);

      setEvents((currentEvents) =>
        currentEvents.map((event) =>
          event._id === eventId
            ? {
                ...event,
                resolved: true,
                resolvedAt: new Date().toISOString(),
              }
            : event
        )
      );
    } catch (error) {
      console.error(
        "Security event resolution failed:",
        error
      );
    } finally {
      setResolvingId(null);
    }
  };

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

  const formatEventType = (eventType) => {
    return eventType
      ?.split("_")
      .map(
        (word) =>
          word.charAt(0).toUpperCase() +
          word.slice(1)
      )
      .join(" ");
  };

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <p className="text-sm text-slate-500">
          Loading security events...
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
          Security Events
        </h1>

        <p className="mt-2 text-sm text-slate-500">
          Monitor detected security anomalies across your
          IoT infrastructure.
        </p>
      </div>

      {/* Summary */}
      <div className="mb-6 grid gap-5 md:grid-cols-3">
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
                Total Events
              </p>

              <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
                {events.length}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-orange-500/10 p-2">
              <AlertTriangle
                size={20}
                className="text-orange-500 dark:text-orange-400"
              />
            </div>

            <div>
              <p className="text-xs text-slate-500">
                Active Events
              </p>

              <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
                {
                  events.filter(
                    (event) =>
                      !event.resolved
                  ).length
                }
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
                Resolved
              </p>

              <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
                {
                  events.filter(
                    (event) =>
                      event.resolved
                  ).length
                }
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Events Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
        <div className="border-b border-slate-200 px-6 py-5 dark:border-slate-800">
          <h2 className="font-semibold text-slate-900 dark:text-white">
            Detected Security Events
          </h2>

          <p className="mt-1 text-xs text-slate-500">
            Security anomalies detected by the SentriCore
            rule engine.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500 dark:border-slate-800">
                <th className="px-6 py-4">
                  Event
                </th>

                <th className="px-6 py-4">
                  Device
                </th>

                <th className="px-6 py-4">
                  Severity
                </th>

                <th className="px-6 py-4">
                  Value
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
              {events.map((event) => (
                <tr
                  key={event._id}
                  className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 dark:border-slate-800 dark:hover:bg-slate-950/50"
                >
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium text-slate-900 dark:text-white">
                      {formatEventType(
                        event.eventType
                      )}
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      {event.message}
                    </p>
                  </td>

                  <td className="px-6 py-4">
                    <span className="text-sm text-slate-700 dark:text-slate-300">
                      {event.deviceId}
                    </span>
                  </td>

                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${severityClass(
                        event.severity
                      )}`}
                    >
                      {event.severity}
                    </span>
                  </td>

                  <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-300">
                    {event.value ?? "--"}
                  </td>

                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1 items-start">
                      {event.resolved ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                          <CheckCircle size={13} />
                          Resolved
                        </span>
                      ) : event.acknowledged ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-yellow-500/10 px-2.5 py-1 text-xs font-medium text-yellow-600 dark:text-yellow-400">
                          <CheckCircle size={13} />
                          Acknowledged
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-600 dark:text-red-400">
                          <AlertTriangle size={13} />
                          Active
                        </span>
                      )}

                      {event.isRecovered && !event.resolved && (
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium px-1">
                          Recovered
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                    {event.detectedAt
                      ? new Date(
                          event.detectedAt
                        ).toLocaleString()
                      : "--"}
                  </td>

                  <td className="px-6 py-4">
                    {event.resolved ? (
                      <span className="text-xs text-slate-400 dark:text-slate-600">
                        —
                      </span>
                    ) : event.acknowledged ? (
                      <button
                        onClick={() =>
                          handleResolve(
                            event._id
                          )
                        }
                        disabled={
                          resolvingId ===
                          event._id
                        }
                        className="rounded-lg bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-600 dark:text-emerald-400 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {resolvingId ===
                        event._id
                          ? "Resolving..."
                          : "Resolve"}
                      </button>
                    ) : (
                      <button
                        onClick={() =>
                          handleAcknowledge(
                            event._id
                          )
                        }
                        disabled={
                          acknowledgingId ===
                          event._id
                        }
                        className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-200 hover:text-slate-900 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {acknowledgingId ===
                        event._id
                          ? "Acknowledging..."
                          : "Acknowledge"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}

              {events.length === 0 && (
                <tr>
                  <td
                    colSpan="7"
                    className="px-6 py-10 text-center text-sm text-slate-500"
                  >
                    No security events detected.
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

export default SecurityEvents;