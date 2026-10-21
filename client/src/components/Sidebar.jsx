import {
  LayoutDashboard,
  Cpu,
  ShieldAlert,
  Siren,
  RefreshCw,
  Settings,
} from "lucide-react";

import { NavLink } from "react-router-dom";

const menuItems = [
  {
    label: "Dashboard",
    icon: LayoutDashboard,
    path: "/",
  },
  {
    label: "Devices",
    icon: Cpu,
    path: "/devices",
  },
  {
    label: "Security Events",
    icon: ShieldAlert,
    path: "/security-events",
  },
  {
    label: "Incidents & SLA",
    icon: Siren,
    path: "/incidents",
  },
  {
    label: "Firmware & OTA",
    icon: RefreshCw,
    path: "/firmware",
  },
  {
    label: "Settings",
    icon: Settings,
    path: "/settings",
  },
];

function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-slate-200 bg-white transition-colors duration-200 dark:border-slate-800 dark:bg-slate-950">
      <div className="flex h-full flex-col">

        {/* Logo */}
        <div className="flex h-20 items-center border-b border-slate-200 px-6 dark:border-slate-800">
          <div>
            <h1 className="text-xl font-bold tracking-wide text-slate-900 dark:text-white">
              SentriCore
            </h1>

            <p className="mt-1 text-xs text-slate-500">
              IoT Security Control Room
            </p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-3 py-5">
          {menuItems.map((item) => {
            const Icon = item.icon;

            return (
              <NavLink
                key={item.label}
                to={item.path}
                end={item.path === "/"}
                className={({ isActive }) =>
                  `flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition ${
                    isActive
                      ? "bg-slate-900 text-white shadow-sm dark:bg-slate-800 dark:text-white"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-white"
                  }`
                }
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* System Status */}
        <div className="border-t border-slate-200 p-4 dark:border-slate-800">
          <div className="rounded-lg bg-slate-100 p-3 dark:bg-slate-900">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />

              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                System Operational
              </span>
            </div>
          </div>
        </div>

      </div>
    </aside>
  );
}

export default Sidebar;