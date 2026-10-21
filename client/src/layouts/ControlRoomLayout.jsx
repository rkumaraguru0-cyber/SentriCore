import { Outlet } from "react-router-dom";

import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";

function ControlRoomLayout() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 transition-colors duration-200 dark:bg-slate-950 dark:text-white">
      <Sidebar />
      <Topbar />

      <main className="ml-64 pt-20">
        <div className="p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export default ControlRoomLayout;