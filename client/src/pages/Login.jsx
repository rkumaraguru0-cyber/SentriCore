import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldCheck, Mail, Lock, Eye, EyeOff } from "lucide-react";
import axios from "axios";
import { useRole } from "../context/RoleContext";
import { API_BASE_URL } from "../services/api";

function Login() {
  const navigate = useNavigate();
  const { loginAs } = useRole();

  useEffect(() => {
  const token = localStorage.getItem("sentricore_token");

  if (token) {
    navigate("/", { replace: true });
  }
}, [navigate]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();

    setError("");

    if (!email || !password) {
      setError("Please enter your email and password.");
      return;
    }

    try {
      setLoading(true);

      const response = await axios.post(
        `${API_BASE_URL}/auth/login`,
        {
          email,
          password,
        }
      );

      const { token, user } = response.data;

      localStorage.setItem("sentricore_token", token);
      localStorage.setItem(
        "sentricore_user",
        JSON.stringify(user)
      );

      loginAs(user);
      navigate("/");
    } catch (error) {
      setError(
        error.response?.data?.message ||
          "Login failed. Please check your credentials and try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 transition-colors duration-200 dark:bg-slate-950 dark:text-white">
      <div className="flex min-h-screen">

        {/* Left Side */}
        <div className="hidden w-1/2 flex-col justify-between border-r border-slate-200 bg-slate-100/70 p-12 lg:flex dark:border-slate-800 dark:bg-slate-950">

          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white">
                <ShieldCheck size={25} />
              </div>

              <div>
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                  SentriCore
                </h1>
                <p className="text-xs text-slate-500">
                  IoT Security Control Room
                </p>
              </div>
            </div>
          </div>

          <div className="max-w-lg">
            <p className="mb-4 text-sm font-medium uppercase tracking-widest text-blue-600 dark:text-blue-400">
              Secure Infrastructure Monitoring
            </p>

            <h2 className="text-5xl font-bold leading-tight text-slate-900 dark:text-white">
              Protect every device.
              <br />
              Monitor every signal.
            </h2>

            <p className="mt-6 text-base leading-7 text-slate-600 dark:text-slate-400">
              Centralized visibility for your IoT infrastructure,
              security events, incidents and firmware operations.
            </p>

            <div className="mt-8 flex items-center gap-6 text-sm text-slate-500">
              <span>● Real-time Monitoring</span>
              <span>● Secure Control</span>
            </div>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-600">
            SentriCore Security Platform
          </p>
        </div>

        {/* Right Side */}
        <div className="flex w-full items-center justify-center px-6 py-12 lg:w-1/2">

          <div className="w-full max-w-md">

            {/* Mobile Logo */}
            <div className="mb-10 flex items-center gap-3 lg:hidden">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white">
                <ShieldCheck size={22} />
              </div>

              <div>
                <h1 className="font-bold text-slate-900 dark:text-white">
                  SentriCore
                </h1>
                <p className="text-xs text-slate-500">
                  IoT Security Control Room
                </p>
              </div>
            </div>

            <div className="mb-8">
              <h2 className="text-3xl font-bold text-slate-900 dark:text-white">
                Welcome back
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Sign in to access the SentriCore Control Room.
              </p>
            </div>

            <form
              onSubmit={handleLogin}
              className="space-y-5"
            >

              {/* Email */}
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Email address
                </label>

                <div className="relative">
                  <Mail
                    size={18}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"
                  />

                  <input
                    type="email"
                    value={email}
                    onChange={(e) =>
                      setEmail(e.target.value)
                    }
                    placeholder="admin@sentricore.com"
                    className="w-full rounded-lg border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-600"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Password
                </label>

                <div className="relative">
                  <Lock
                    size={18}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"
                  />

                  <input
                    type={
                      showPassword
                        ? "text"
                        : "password"
                    }
                    value={password}
                    onChange={(e) =>
                      setPassword(e.target.value)
                    }
                    placeholder="Enter your password"
                    className="w-full rounded-lg border border-slate-200 bg-white py-3 pl-10 pr-11 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-600"
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowPassword(!showPassword)
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-white"
                  >
                    {showPassword ? (
                      <EyeOff size={18} />
                    ) : (
                      <Eye size={18} />
                    )}
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
                  {error}
                </div>
              )}

              {/* Login */}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-blue-600 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading
                  ? "Signing in..."
                  : "Sign in to Control Room"}
              </button>
            </form>

            {/* Quick Demo Credentials */}
            <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/60">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                Quick Evaluation Credentials:
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEmail("admin@sentricore.com");
                    setPassword("Admin@123");
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:border-blue-500 hover:text-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-blue-400 dark:hover:text-blue-400 transition-colors"
                >
                  👑 Admin
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEmail("operator@sentricore.com");
                    setPassword("Operator@123");
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:border-emerald-500 hover:text-emerald-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-emerald-400 dark:hover:text-emerald-400 transition-colors"
                >
                  👷 Operator
                </button>
              </div>
            </div>

            <p className="mt-8 text-center text-xs text-slate-500 dark:text-slate-600">
              Authorized personnel only
            </p>

          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;