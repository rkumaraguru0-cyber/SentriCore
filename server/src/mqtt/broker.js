const { Aedes } = require("aedes");
const net = require("net");

const MQTT_PORT = process.env.MQTT_PORT || 1883;

async function startBroker() {
  return new Promise(async (resolve) => {
    try {
      const aedes = await Aedes.createBroker();
      const server = net.createServer(aedes.handle);

      server.once("error", (err) => {
        if (err.code === "EADDRINUSE") {
          console.log(`MQTT port ${MQTT_PORT} already in use; attaching to existing broker.`);
          resolve(null);
        } else {
          console.error("MQTT broker error:", err.message);
          resolve(null);
        }
      });

      server.listen(MQTT_PORT, () => {
        console.log(`MQTT broker running on mqtt://localhost:${MQTT_PORT}`);
        resolve({ aedes, server });
      });

      aedes.on("client", (client) => {
        console.log(`MQTT client connected: ${client?.id}`);
      });

      aedes.on("clientDisconnect", (client) => {
        console.log(`MQTT client disconnected: ${client?.id}`);
      });
    } catch (err) {
      console.error("Failed to start MQTT broker:", err.message);
      resolve(null);
    }
  });
}

if (require.main === module) {
  startBroker();
}

module.exports = { startBroker };