# SentriCore — IoT Device Health, Firmware Management & Security Control Room

[![Node.js](https://img.shields.io/badge/Node.js-v18%2B-green.svg?style=for-the-badge&logo=node.js)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18-blue.svg?style=for-the-badge&logo=react)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-5-646CFF.svg?style=for-the-badge&logo=vite)](https://vitejs.dev/)
[![MQTT](https://img.shields.io/badge/MQTT-Aedes%20Broker-red.svg?style=for-the-badge&logo=eclipse-mosquitto)](https://mqtt.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-brightgreen.svg?style=for-the-badge&logo=mongodb)](https://www.mongodb.com/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind-CSS-38B2AC.svg?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-Realtime-black.svg?style=for-the-badge&logo=socket.io)](https://socket.io/)

> **Problem Statement:**  
> *"Organizations deploying IoT devices often lack centralized visibility into device health, firmware status, and security vulnerabilities. This platform continuously monitors connected devices, detects anomalies, manages firmware updates, and reports security incidents."*

---

## 🌟 Executive Overview

**SentriCore** is a production-grade, centralized IoT Security Control Room designed for enterprise and critical infrastructure deployments. It bridges the gap between hardware telemetry and SOC (Security Operations Center) analysts by providing real-time device health monitoring, rule-based anomaly detection, over-the-air (OTA) firmware campaign rollouts, and incident response tracking.

---

## 📐 System Architecture

SentriCore operates on an event-driven, decoupled IoT architecture:

```
┌────────────────────────────────────────────────────────┐
│         14 Simulated Industrial IoT Devices            │
│   (Temperature, Cameras, Smart Locks, Gateways, Med)   │
└───────────────────────────┬────────────────────────────┘
                            │ MQTT Telemetry Broadcast
                            │ Topic: sentricore/devices/+/telemetry
                            ▼
┌────────────────────────────────────────────────────────┐
│             Aedes MQTT Broker (Port 1883)              │
└───────────────────────────┬────────────────────────────┘
                            │ Ingestion Stream
                            ▼
┌────────────────────────────────────────────────────────┐
│            Node.js / Express Backend (5000)            │
│  ├── Anomaly Detection Rules Engine (15+ Rules)        │
│  ├── Incident Escalation & Security Event Auditor      │
│  ├── MongoDB Atlas Telemetry & Entity Persistence      │
│  └── Socket.IO Real-Time Dispatcher                    │
└───────────────────────────┬────────────────────────────┘
                            │ WebSocket Events & REST APIs
                            ▼
┌────────────────────────────────────────────────────────┐
│        React + Vite Control Room UI (Port 5173)        │
│  ├── Fleet Health Dashboard & Live Security Radar      │
│  ├── Categorized Device Fleet & Telemetry Badges       │
│  ├── Role-Based Access Control (Admin vs Operator)     │
│  ├── OTA Firmware Deployment Manager                   │
│  └── Dark / Light Theme Engine                         │
└────────────────────────────────────────────────────────┘
```

---

## 🚀 Key Functional Capabilities

### 1. Centralized Device Health Visibility
* **Executive Dashboard:** Live KPI cards for Total Fleet Size, Online/Offline status, Global Fleet Health percentage, and Battery/Signal health metrics.
* **Category Filtering:** Dedicated tabs for **Temperature Sensors**, **Surveillance Cameras**, **Smart Locks**, **Industrial Gateways**, and **Medical Infusion Devices**.
* **Live Telemetry Badges:** Real-time visual monitoring for battery levels, signal strength (RSSI), CPU load, memory usage, network latency, and uptime.
* **Device Inspect Modal:** Deep-dive modal inspecting MAC address, IP address, firmware version, hardware serial, and raw telemetry values.

### 2. Continuous Monitoring via MQTT & WebSockets
* High-frequency telemetry ingestion over standard MQTT (`sentricore/devices/+/telemetry`).
* Zero-refresh UI updates powered by Socket.IO (`device_updated`, `new_incident`, `incident_resolved`).

### 3. Rule-Based Anomaly Detection Engine
Automated analysis across 15+ operational and cybersecurity detection rules:
* 🌡️ **High Temperature:** Temperature threshold breach (> 50°C).
* ⚡ **CPU Saturation:** Core utilization spike (> 90%).
* 🔋 **Critical Battery:** Power depletion warning (< 15%).
* 🕵️ **Rogue IP / Unknown Address:** Potential unauthorized network pivoting.
* 📶 **Network Disconnections & Latency Spikes:** High network latency (> 500 ms) or degraded signals.
* 🔐 **Physical Tamper & Smart Lock Jam:** Immediate critical alert.
* 🛡️ **Brute-Force Attacks:** Multiple consecutive failed authentication attempts (> 3).
* 🏥 **Medical Pump Malfunction:** Dosage and delivery anomaly alerts.
* ⚠️ **Firmware CVE Vulnerability:** Devices running outdated or vulnerable firmware revisions.

### 4. Over-The-Air (OTA) Firmware Management
* **Fleet Rollout Progress:** Real-time tracking of updated vs outdated devices against target versions (e.g., v1.1.0).
* **Release History & Integrity:** SHA-256 binary checksum auditing and changelog history.
* **Role-Guarded Deployment:** Administrators can initiate campaigns; Operators have view-only access.

### 5. Security Incident Management & Threat Radar
* **Live Threat Radar:** Category-wise radar distribution of security anomalies.
* **Incident Lifecycle Triage:** Severity classification (`Critical`, `High`, `Medium`, `Low`) with status workflows (`Open` ➔ `Investigating` ➔ `Resolved`).
* **Security Events Audit Log:** Immutable event log tracking raw anomaly payloads and device timestamps.

### 6. Role-Based Access Control (RBAC)
* Authenticated using industry-standard **bcrypt password hashing** and signed **JWT (JSON Web Tokens)**.
* **Strict Separation of Duties:**
  * 👑 **Administrator:** Full privileges to edit security thresholds, resolve incidents, and trigger firmware updates.
  * 👷 **SOC Operator:** Read-only audit mode for monitoring telemetry and incidents, with configuration controls securely disabled.

---

## 👥 Default Evaluation Credentials

| Role | Email Address | Password | Privileges |
| :--- | :--- | :--- | :--- |
| **Administrator** | `admin@sentricore.com` | `Admin@123` | Full access (Policy config, Firmware deploy, Incident resolution) |
| **SOC Operator** | `operator@sentricore.com` | `Operator@123` | Audit & Monitoring (Read-only policy, Locked firmware actions) |

> *Tip: The login screen includes 1-click **Quick Evaluation Credential** buttons for convenience.*

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 18, Vite 5, Tailwind CSS, Lucide React Icons, React Router DOM, Axios |
| **Backend** | Node.js, Express 5, Socket.IO, Aedes MQTT Broker, JSONWebToken, Bcrypt.js |
| **Database** | MongoDB (Atlas Cloud Cluster), Mongoose ODM |
| **IoT Simulation** | Node.js MQTT client publishing multi-category telemetry payloads |

---

## 💻 Local Setup & Execution Guide

### Prerequisites
* [Node.js](https://nodejs.org/) (v18.0.0 or higher)
* [Git](https://git-scm.com/)

### 1. Clone the Repository
```bash
git clone https://github.com/<your-username>/SentriCore.git
cd SentriCore
```

### 2. Configure Environment Variables
Inside the `server/` directory, create a `.env` file (or copy from `.env.example`):
```bash
cp server/.env.example server/.env
```
Ensure the MongoDB connection string and JWT secret are configured:
```env
PORT=5000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret_key
```

### 3. Install Dependencies
Run npm install in each folder:
```bash
# Backend dependencies
cd server
npm install

# Frontend dependencies
cd ../client
npm install

# Simulator dependencies
cd ../simulator
npm install
```

### 4. Start the Application (4 Terminals)

Open 4 separate terminal windows:

* **Terminal 1: Start MQTT Broker**
  ```bash
  cd server
  node src/mqtt/broker.js
  ```
  *(Runs on `mqtt://localhost:1883`)*

* **Terminal 2: Start Express Backend API**
  ```bash
  cd server
  npm run dev
  ```
  *(Runs on `http://localhost:5000`)*

* **Terminal 3: Start IoT Device Simulator**
  ```bash
  cd simulator
  node simulator.js
  ```
  *(Broadcasts live telemetry across all 14 devices)*

* **Terminal 4: Start Frontend Client**
  ```bash
  cd client
  npm run dev
  ```
  *(Opens on `http://localhost:5173`)*

---

## 📡 REST API & MQTT Reference

### Key API Endpoints
* `POST /api/auth/login` — Authenticate and receive JWT token.
* `GET  /api/devices` — Retrieve all registered IoT devices and latest telemetry.
* `GET  /api/devices/:id` — Retrieve specific device telemetry and specs.
* `GET  /api/security-events` — Retrieve historical security anomaly logs.
* `GET  /api/incidents` — Retrieve escalated security incidents.
* `PATCH /api/incidents/:id` — Update incident status (`Investigating`, `Resolved`).
* `GET  /api/firmware` — Retrieve fleet firmware rollout metrics and releases.

### MQTT Topics
* `sentricore/devices/+/telemetry` — Real-time sensor, network, and health telemetry.
* `sentricore/devices/+/firmware/status` — Device OTA upgrade progress and acknowledgements.

---

## 📄 License
This project is developed for educational and enterprise IoT security demonstration purposes.
