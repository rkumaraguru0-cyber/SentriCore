const { Aedes } = require("aedes");
const net = require("net");

const MQTT_PORT = 1883;

async function startBroker() {
  const aedes = await Aedes.createBroker();

  const server = net.createServer(aedes.handle);

  server.listen(MQTT_PORT, () => {
    console.log(`MQTT broker running on mqtt://localhost:${MQTT_PORT}`);
  });

  aedes.on("client", (client) => {
    console.log(`MQTT client connected: ${client?.id}`);
  });

  aedes.on("clientDisconnect", (client) => {
    console.log(`MQTT client disconnected: ${client?.id}`);
  });
}

startBroker();