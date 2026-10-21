import { useEffect, useState } from "react";
import {
  Bell,
  LogOut,
  ShieldAlert,
  Siren,
  RefreshCw,
  X,
  Sun,
  Moon,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import { useTheme } from "../context/ThemeContext";
import { useRole } from "../context/RoleContext";
import { BACKEND_URL } from "../services/api";

function Topbar() {
  const navigate = useNavigate();
  const { isDark, toggleTheme } = useTheme();
  const { isAdmin } = useRole();

  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] =
    useState(false);

  useEffect(() => {
    const socket = io(BACKEND_URL, {
      transports: ["polling", "websocket"],
    });

    const addNotification = (notification) => {
      setNotifications((current) => [
        notification,
        ...current,
      ]);
    };

    socket.on("security-event:created", (event) => {
      addNotification({
        id: `security-${Date.now()}`,
        type: "security",
        title: "Security Event Detected",
        message:
          event?.message ||
          "A new security event has been detected.",
        time: new Date(),
      });
    });

    socket.on("incident:created", (incident) => {
      addNotification({
        id: `incident-${Date.now()}`,
        type: "incident",
        title: "Security Incident Created",
        message:
          incident?.title ||
          "A new security incident has been created.",
        time: new Date(),
      });
    });

    socket.on("firmware:updated", (update) => {
      addNotification({
        id: `firmware-${Date.now()}`,
        type: "firmware",
        title: "Firmware Update",
        message: `Device ${update?.deviceId || "device"}: ${
          update?.status || "status updated"
        }`,
        time: new Date(),
      });
    });

    return () => {
      socket.off("security-event:created");
      socket.off("incident:created");
      socket.off("firmware:updated");
      socket.disconnect();
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("sentricore_token");
    localStorage.removeItem("sentricore_user");

    navigate("/login", { replace: true });
  };

  const clearNotifications = () => {
    setNotifications([]);
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case "security":
        return (
          <ShieldAlert
            size={16}
            className="text-red-400"
          />
        );

      case "incident":
        return (
          <Siren
            size={16}
            className="text-orange-400"
          />
        );

      case "firmware":
        return (
          <RefreshCw
            size={16}
            className="text-blue-400"
          />
        );

      default:
        return (
          <Bell
            size={16}
            className="text-slate-400"
          />
        );
    }
  };

  return (
    <header className="fixed left-64 right-0 top-0 z-30 h-20 border-b border-slate-200 bg-white/95 backdrop-blur transition-colors duration-200 dark:border-slate-800 dark:bg-slate-950/95">
      <div className="flex h-full items-center justify-between px-8">

        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Control Room
          </h2>

          <p className="text-xs text-slate-500">
            Real-time IoT security monitoring
          </p>
        </div>

        <div className="flex items-center gap-4">

          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
            aria-label="Toggle theme"
            className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-slate-100 text-slate-600 transition hover:bg-slate-200 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-amber-400 dark:hover:bg-slate-800 dark:hover:text-amber-300"
          >
            {isDark ? (
              <Sun size={18} className="transition-transform duration-300 hover:rotate-45" />
            ) : (
              <Moon size={18} className="text-slate-700 transition-transform duration-300 hover:-rotate-12" />
            )}
          </button>

          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() =>
                setShowNotifications(
                  (current) => !current
                )
              }
              className="relative rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-white"
            >
              <Bell size={20} />

              {notifications.length > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                  {notifications.length > 9
                    ? "9+"
                    : notifications.length}
                </span>
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 top-12 w-96 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">

                <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                      Notifications
                    </h3>

                    <p className="mt-1 text-xs text-slate-500">
                      Real-time control room alerts
                    </p>
                  </div>

                  {notifications.length > 0 && (
                    <button
                      onClick={clearNotifications}
                      className="text-xs text-slate-500 transition hover:text-slate-900 dark:hover:text-white"
                    >
                      Clear all
                    </button>
                  )}
                </div>

                <div className="max-h-96 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="px-4 py-10 text-center">
                      <Bell
                        size={24}
                        className="mx-auto text-slate-400 dark:text-slate-700"
                      />

                      <p className="mt-3 text-sm text-slate-500">
                        No new notifications
                      </p>
                    </div>
                  ) : (
                    notifications.map(
                      (notification) => (
                        <div
                          key={notification.id}
                          className="border-b border-slate-100 px-4 py-3 last:border-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-950"
                        >
                          <div className="flex gap-3">

                            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
                              {getNotificationIcon(
                                notification.type
                              )}
                            </div>

                            <div className="min-w-0">
                              <p className="text-sm font-medium text-slate-900 dark:text-white">
                                {notification.title}
                              </p>

                              <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-400">
                                {notification.message}
                              </p>

                              <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-600">
                                {notification.time.toLocaleTimeString()}
                              </p>
                            </div>

                          </div>
                        </div>
                      )
                    )
                  )}
                </div>

                {notifications.length > 0 && (
                  <div className="border-t border-slate-200 px-4 py-2 dark:border-slate-800">
                    <button
                      onClick={() =>
                        setShowNotifications(false)
                      }
                      className="flex w-full items-center justify-center gap-2 py-1 text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white"
                    >
                      <X size={13} />
                      Close
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 border-l border-slate-200 pl-4 dark:border-slate-800">

            <div
              className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold shadow-sm transition-colors ${
                isAdmin
                  ? "bg-blue-600 text-white dark:bg-blue-500"
                  : "bg-emerald-600 text-white dark:bg-emerald-500"
              }`}
            >
              {isAdmin ? "A" : "O"}
            </div>

            <div className="hidden sm:block">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                {isAdmin ? "Administrator" : "SOC Operator"}
              </p>

              <p className="text-xs text-slate-500">
                {isAdmin ? "Control Room Admin" : "Security Analyst"}
              </p>
            </div>

          </div>

          <button
            onClick={handleLogout}
            title="Logout"
            className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400"
          >
            <LogOut size={19} />
          </button>

        </div>
      </div>
    </header>
  );
}

export default Topbar;