# SentriCore — IoT Security Control Room: Startup & Operations Guide

## 1. Environment & Architecture Overview

SentriCore operates across 4 core processes:
```
┌─────────────────────────────────┐
│  Node.js IoT Simulator (14 Dev) │
└──────────────┬──────────────────┘
               │ (MQTT Telemetry: sentricore/devices/+/telemetry)
               ▼
┌─────────────────────────────────┐
│     Aedes MQTT Broker (1883)    │
└──────────────┬──────────────────┘
               │ (Internal MQTT Subscriber)
               ▼
┌─────────────────────────────────┐
│   Node.js + Express Backend     │ ──▶ MongoDB (Port 27017)
│        (Port 5000)              │ ──▶ Socket.IO (Real-time events)
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│   React + Vite Frontend (5173)  │
└─────────────────────────────────┘
```

---

## 2. Prerequisites & Environment Configuration

### Required Environment Variables
Inside `server/.env` (keys required, do not commit or overwrite existing secret values):
```env
PORT=5000
MONGODB_URI=<your-mongodb-connection-string>
JWT_SECRET=<your-jwt-secret-key>
```

### Dependency Installation (if needed)
```powershell
# In server directory
cd server
npm install

# In client directory
cd ..\client
npm install

# In simulator directory
cd ..\simulator
npm install
```

---

## 3. Recommended Startup Sequence (4 Windows PowerShell Terminals)

### Terminal 1: MQTT Broker
```powershell
cd d:\Antigravity\SentriCore\SentriCore\server
node src/mqtt/broker.js
```
*Expected output:* `MQTT broker running on mqtt://localhost:1883`

### Terminal 2: SentriCore Backend
```powershell
cd d:\Antigravity\SentriCore\SentriCore\server
npm start
```
*Expected output:*
- `Backend connected to MQTT broker`
- `Subscribed to device telemetry`
- `Subscribed to firmware status`
- `MongoDB connected successfully`
- `Device health monitor started`
- `SentriCore API running on http://localhost:5000`

### Terminal 3: Multi-Device Simulator (14 Devices)
```powershell
cd d:\Antigravity\SentriCore\SentriCore\simulator
node simulator.js
```
*Expected output:* 14 devices connecting to MQTT (`DEV-TS-001` through `DEV-TS-003`, `DEV-CAM-001` through `DEV-CAM-004`, `DEV-SL-001` through `DEV-SL-003`, `DEV-GW-001` & `DEV-GW-002`, `DEV-MED-001` & `DEV-MED-002`), subscribing to their firmware update commands and publishing telemetry every 10 seconds.

### Terminal 4: Control Room Dashboard (Frontend)
```powershell
cd d:\Antigravity\SentriCore\SentriCore\client
npm run dev
```
*Expected output:* `Local: http://localhost:5173/`

---

## 4. Default Credentials & Access
- Dashboard URL: `http://localhost:5173/`
- Default Administrator Email: `admin@sentricore.com`
- Default Administrator Password: `Admin@123`
- Backend Health Endpoint: `http://localhost:5000/api/health`

---

## 5. Operations & Verification Procedures

### Verifying 13+ Devices Online
1. Log in to `http://localhost:5173/`
2. Navigate to **Devices** (`/devices`) or **Security Overview** (`/`).
3. Verify the "Total Devices" metric displays **14** and "Online" displays **14**.
4. All 5 device types appear in the table: Temperature Sensor, Camera, Smart Lock, Gateway, Medical Monitor.

### Testing Anomaly Detection & Security Events
To demonstrate any anomaly without permanently breaking random devices, publish a transient test anomaly via MQTT:
```powershell
# High Temperature Anomaly (e.g. 75°C on DEV-TS-001)
# Using Node MQTT command:
node -e "const mqtt=require('mqtt');const c=mqtt.connect('mqtt://localhost:1883');c.on('connect',()=>{c.publish('sentricore/devices/DEV-TS-001/test-anomaly', JSON.stringify({temperature:75}));setTimeout(()=>c.end(),500);})"
```
- Observe the **Security Events** page: `high_temperature` appears with severity `high`.
- Observe **Incidents**: An incident is generated.
- Observe **Duplicate Prevention**: Wait 20 seconds. Despite multiple telemetry ticks, no duplicate event or incident is created.
- Acknowledge the event. Notice the anomaly is still active, but still no duplicate is created.
- Once the device returns to normal telemetry (<=50°C), the event automatically marks `isRecovered: true` and `resolved: true`.

### Testing Brute Force Scenario (PDF Requirement)
```powershell
node -e "const mqtt=require('mqtt');const c=mqtt.connect('mqtt://localhost:1883');c.on('connect',()=>{c.publish('sentricore/devices/DEV-CAM-001/test-anomaly', JSON.stringify({failedLoginAttempts:5}));setTimeout(()=>c.end(),500);})"
```
- A critical security event `brute_force_attack` is triggered.
- A critical security incident is created.

### Testing Firmware OTA Update
1. Navigate to **Firmware & OTA** (`/firmware`).
2. Click **Update to v1.1.0** next to any device (e.g. `DEV-TS-001`).
3. Watch the real-time progress bar transition:
   - `Pending` (0%)
   - `Downloading` (25%)
   - `Installing` (50%)
   - `Verifying` (90%)
   - `Success` (100%)
4. Confirm device version updates from `v1.0.0` to `v1.1.0` and status changes to "Up to Date".

---

## 6. How to Safely Stop the Processes
In each PowerShell terminal:
- Press `Ctrl + C`
- For the simulator, the graceful shutdown hook terminates all 14 MQTT clients cleanly.

---

## 7. Troubleshooting Common Errors
| Issue | Cause | Resolution |
|---|---|---|
| `ECONNREFUSED 1883` | MQTT Broker process not started | Start `node src/mqtt/broker.js` in Terminal 1 first. |
| `MongooseServerSelectionError` | MongoDB service not running | Run `Start-Service MongoDB` in PowerShell. |
| `Socket.IO connection failed` | Backend API not running on port 5000 | Verify Terminal 2 is running and check `http://localhost:5000/api/health`. |
| Device status stuck offline | Heartbeat timeout exceeded (>60s) | Ensure `simulator.js` is running and publishing telemetry every 10s. |
