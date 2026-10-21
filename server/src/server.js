const express = require("express");
const cors = require("cors");
const http = require("http");
require("dotenv").config();

const connectDB = require("./config/db");
const deviceRoutes = require("./routes/deviceRoutes");
const securityEventRoutes = require("./routes/securityEventRoutes");
const incidentRoutes = require("./routes/incidentRoutes");
const firmwareRoutes = require("./routes/firmwareRoutes");
const firmwareReleaseRoutes = require("./routes/firmwareReleaseRoutes");
const authRoutes = require("./routes/authRoutes");

const { startHealthMonitor } = require("./services/healthMonitor");
const { startSubscriber } = require("./mqtt/subscriber");
const { startBroker } = require("./mqtt/broker");

const app = express();

const server = http.createServer(app);

const PORT = process.env.PORT || 5000;

// Socket.IO
const { Server } = require("socket.io");

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "*",
    methods: ["GET", "POST", "PATCH"],
  },
});

io.on("connection", (socket) => {
  console.log(`Socket.IO client connected: ${socket.id}`);

  socket.on("disconnect", () => {
    console.log(`Socket.IO client disconnected: ${socket.id}`);
  });
});

// Make io available to other backend modules
app.set("io", io);

// Start Embedded MQTT Broker & Telemetry Subscriber
startBroker().then(() => {
  startSubscriber(io);
});

// Connect MongoDB
connectDB();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/api/devices", deviceRoutes);
app.use("/api/security-events", securityEventRoutes);
app.use("/api/incidents", incidentRoutes);
app.use("/api/firmware", firmwareRoutes);
app.use(
  "/api/firmware-releases",
  firmwareReleaseRoutes
);
app.use("/api/auth", authRoutes);

// Root & Health Checks
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "SentriCore IoT Security Control Room API is live",
    status: "healthy",
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "SentriCore backend is running",
    service: "SentriCore API",
  });
});

startHealthMonitor(io);

// Start Server
server.listen(PORT, () => {
  console.log(
    `SentriCore API running on http://localhost:${PORT}`
  );
});