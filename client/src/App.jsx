import { BrowserRouter, Routes, Route } from "react-router-dom";

import { ThemeProvider } from "./context/ThemeContext";
import { RoleProvider } from "./context/RoleContext";
import ProtectedRoute from "./components/ProtectedRoute";
import ControlRoomLayout from "./layouts/ControlRoomLayout";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Devices from "./pages/Devices";
import SecurityEvents from "./pages/SecurityEvents";
import Incidents from "./pages/Incidents";
import Firmware from "./pages/Firmware";
import Settings from "./pages/Settings";

function App() {
  return (
    <ThemeProvider>
      <RoleProvider>
        <BrowserRouter>
        <Routes>

        {/* Public Route */}
        <Route path="/login" element={<Login />} />

        {/* Protected Routes */}
        <Route element={<ProtectedRoute />}>
          <Route element={<ControlRoomLayout />}>

            <Route index element={<Dashboard />} />

            <Route
              path="devices"
              element={<Devices />}
            />

            <Route
              path="security-events"
              element={<SecurityEvents />}
            />

            <Route
              path="incidents"
              element={<Incidents />}
            />

            <Route
              path="firmware"
              element={<Firmware />}
            />

            <Route
              path="settings"
              element={<Settings />}
            />

          </Route>
        </Route>

      </Routes>
    </BrowserRouter>
  </RoleProvider>
</ThemeProvider>
  );
}

export default App;