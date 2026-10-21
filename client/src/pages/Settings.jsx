import { useState } from "react";
import {
  Building2,
  Activity,
  ShieldCheck,
  Server,
  Lock,
  Save,
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
} from "lucide-react";
import { useRole } from "../context/RoleContext";

function Settings() {
  const { isAdmin } = useRole();

  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem("sentricore_custom_settings");
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // Fallback
    }
    return {
      orgName: "SentriCore",
      environment: "Development",
      heartbeatTimeout: "60",
      highTempThreshold: "50",
      highCpuThreshold: "90",
      lowBatteryThreshold: "15",
    };
  });

  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleInputChange = (field, value) => {
    if (!isAdmin) return;
    setSettings((prev) => ({
      ...prev,
      [field]: value,
    }));
    setSavedSuccess(false);
  };

  const handleSave = (e) => {
    e.preventDefault();
    if (!isAdmin) return;

    try {
      localStorage.setItem("sentricore_custom_settings", JSON.stringify(settings));
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 4000);
    } catch {
      // Ignore storage errors
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
          System Settings & Policies
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Manage SentriCore control room configuration, anomaly rules, and telemetry thresholds.
        </p>
      </div>

      {/* Role-Based Mode Banner */}
      {isAdmin ? (
        <div className="flex items-center justify-between rounded-xl border border-blue-500/30 bg-blue-500/10 p-4 text-blue-700 dark:border-blue-400/20 dark:bg-blue-500/10 dark:text-blue-300">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-600 p-2 text-white shadow-sm">
              <ShieldCheck size={20} />
            </div>
            <div>
              <p className="text-sm font-bold">Administrator Mode Active</p>
              <p className="text-xs text-blue-600 dark:text-blue-400">
                You have full authorization to modify telemetry thresholds, timeouts, and save platform policies.
              </p>
            </div>
          </div>
          <span className="hidden sm:inline-flex rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white shadow-sm">
            👑 Full Admin Access
          </span>
        </div>
      ) : (
        <div className="flex items-center justify-between rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-700 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-300">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-amber-600 p-2 text-white shadow-sm">
              <Lock size={20} />
            </div>
            <div>
              <p className="text-sm font-bold">Operator Read-Only Audit View</p>
              <p className="text-xs text-amber-700 dark:text-amber-400">
                Security rules and thresholds are in audit mode. Policy modifications require Administrator privileges.
              </p>
            </div>
          </div>
          <span className="hidden sm:inline-flex rounded-full bg-amber-600 px-3 py-1 text-xs font-semibold text-white shadow-sm">
            🛡️ Read-Only Audit
          </span>
        </div>
      )}

      {/* Save Success Toast */}
      {savedSuccess && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-300 animate-in fade-in duration-200">
          <CheckCircle2 size={18} className="text-emerald-500" />
          <p className="text-xs font-semibold">
            Configuration saved successfully! Real-time policies updated across SentriCore.
          </p>
        </div>
      )}

      <form onSubmit={handleSave} className="grid gap-6 xl:grid-cols-2">
        {/* Organization */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
          <div className="flex items-center gap-3 border-b border-slate-200 px-6 py-5 dark:border-slate-800">
            <div className="rounded-lg bg-blue-500/10 p-2">
              <Building2 size={20} className="text-blue-500 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-900 dark:text-white">Organization</h2>
              <p className="mt-1 text-xs text-slate-500">Basic control room information.</p>
            </div>
          </div>

          <div className="space-y-5 p-6">
            <div>
              <label className="mb-2 block text-xs font-medium text-slate-600 dark:text-slate-400">
                Organization Name
              </label>
              <input
                type="text"
                value={settings.orgName}
                onChange={(e) => handleInputChange("orgName", e.target.value)}
                readOnly={!isAdmin}
                className={`w-full rounded-lg border px-4 py-3 text-sm text-slate-900 outline-none transition-colors dark:text-white ${
                  isAdmin
                    ? "border-slate-300 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950"
                    : "border-slate-200 bg-slate-50 cursor-not-allowed dark:border-slate-800 dark:bg-slate-950/60"
                }`}
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium text-slate-600 dark:text-slate-400">
                Environment
              </label>
              <input
                type="text"
                value={settings.environment}
                onChange={(e) => handleInputChange("environment", e.target.value)}
                readOnly={!isAdmin}
                className={`w-full rounded-lg border px-4 py-3 text-sm text-slate-900 outline-none transition-colors dark:text-white ${
                  isAdmin
                    ? "border-slate-300 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950"
                    : "border-slate-200 bg-slate-50 cursor-not-allowed dark:border-slate-800 dark:bg-slate-950/60"
                }`}
              />
            </div>
          </div>
        </div>

        {/* Monitoring */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
          <div className="flex items-center gap-3 border-b border-slate-200 px-6 py-5 dark:border-slate-800">
            <div className="rounded-lg bg-emerald-500/10 p-2">
              <Activity size={20} className="text-emerald-500 dark:text-emerald-400" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-900 dark:text-white">Monitoring Policies</h2>
              <p className="mt-1 text-xs text-slate-500">Device health monitoring configuration.</p>
            </div>
          </div>

          <div className="space-y-5 p-6">
            <div>
              <label className="mb-2 block text-xs font-medium text-slate-600 dark:text-slate-400">
                Heartbeat Timeout
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  value={settings.heartbeatTimeout}
                  onChange={(e) => handleInputChange("heartbeatTimeout", e.target.value)}
                  readOnly={!isAdmin}
                  className={`w-full rounded-lg border px-4 py-3 text-sm text-slate-900 outline-none transition-colors dark:text-white ${
                    isAdmin
                      ? "border-slate-300 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950"
                      : "border-slate-200 bg-slate-50 cursor-not-allowed dark:border-slate-800 dark:bg-slate-950/60"
                  }`}
                />
                <span className="text-sm font-medium text-slate-500">seconds</span>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Devices without a heartbeat pulse within this duration are marked offline.
              </p>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-white">
                  Automated Health Probe
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Periodic telemetry verification running on port 1883.
                </p>
              </div>
              <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Active
              </span>
            </div>
          </div>
        </div>

        {/* Security Rules */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
          <div className="flex items-center gap-3 border-b border-slate-200 px-6 py-5 dark:border-slate-800">
            <div className="rounded-lg bg-rose-500/10 p-2">
              <ShieldAlert size={20} className="text-rose-500 dark:text-rose-400" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-900 dark:text-white">
                Rule-Based Anomaly Thresholds
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Triggers automatic Security Events & Incidents.
              </p>
            </div>
          </div>

          <div className="space-y-5 p-6">
            <div>
              <label className="mb-2 block text-xs font-medium text-slate-600 dark:text-slate-400">
                High Temperature Threshold
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  value={settings.highTempThreshold}
                  onChange={(e) => handleInputChange("highTempThreshold", e.target.value)}
                  readOnly={!isAdmin}
                  className={`w-full rounded-lg border px-4 py-3 text-sm text-slate-900 outline-none transition-colors dark:text-white ${
                    isAdmin
                      ? "border-slate-300 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950"
                      : "border-slate-200 bg-slate-50 cursor-not-allowed dark:border-slate-800 dark:bg-slate-950/60"
                  }`}
                />
                <span className="text-sm font-medium text-slate-500">°C</span>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium text-slate-600 dark:text-slate-400">
                High CPU Load Threshold
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  value={settings.highCpuThreshold}
                  onChange={(e) => handleInputChange("highCpuThreshold", e.target.value)}
                  readOnly={!isAdmin}
                  className={`w-full rounded-lg border px-4 py-3 text-sm text-slate-900 outline-none transition-colors dark:text-white ${
                    isAdmin
                      ? "border-slate-300 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950"
                      : "border-slate-200 bg-slate-50 cursor-not-allowed dark:border-slate-800 dark:bg-slate-950/60"
                  }`}
                />
                <span className="text-sm font-medium text-slate-500">%</span>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium text-slate-600 dark:text-slate-400">
                Low Battery Warning Threshold
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  value={settings.lowBatteryThreshold}
                  onChange={(e) => handleInputChange("lowBatteryThreshold", e.target.value)}
                  readOnly={!isAdmin}
                  className={`w-full rounded-lg border px-4 py-3 text-sm text-slate-900 outline-none transition-colors dark:text-white ${
                    isAdmin
                      ? "border-slate-300 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950"
                      : "border-slate-200 bg-slate-50 cursor-not-allowed dark:border-slate-800 dark:bg-slate-950/60"
                  }`}
                />
                <span className="text-sm font-medium text-slate-500">%</span>
              </div>
            </div>
          </div>
        </div>

        {/* System Services Status */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
          <div className="flex items-center gap-3 border-b border-slate-200 px-6 py-5 dark:border-slate-800">
            <div className="rounded-lg bg-purple-500/10 p-2">
              <Server size={20} className="text-purple-500 dark:text-purple-400" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-900 dark:text-white">Core System Services</h2>
              <p className="mt-1 text-xs text-slate-500">Connected infrastructure microservices.</p>
            </div>
          </div>

          <div className="space-y-3.5 p-6">
            <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-white">REST API Backend</p>
                <p className="mt-0.5 text-xs text-slate-500">Express server on port 5000</p>
              </div>
              <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Operational
              </span>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-white">MQTT Broker</p>
                <p className="mt-0.5 text-xs text-slate-500">Aedes broker on port 1883</p>
              </div>
              <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Operational
              </span>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-white">Database Store</p>
                <p className="mt-0.5 text-xs text-slate-500">MongoDB database persistence</p>
              </div>
              <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Connected
              </span>
            </div>
          </div>
        </div>

        {/* Bottom Action Bar for Admin */}
        {isAdmin && (
          <div className="xl:col-span-2 flex items-center justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <AlertCircle size={15} className="text-blue-500" />
              <span>Saving updates telemetry anomaly rules and timeouts dynamically.</span>
            </div>
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 transition-all"
            >
              <Save size={15} />
              <span>Save Policy Configuration</span>
            </button>
          </div>
        )}
      </form>
    </div>
  );
}

export default Settings;