import Fastify from "fastify";
import websocket from "@fastify/websocket";
import { helloRoutes } from "./routes/hello";
import { socketRoutes } from "./ws/socket";

const fastify = Fastify();

async function main() {
  await fastify.register(websocket);
  await fastify.register(helloRoutes);
  await fastify.register(socketRoutes);

  try {
    await fastify.listen({ port: 3000 });
    console.log("🚀 Server listening on http://localhost:3000");
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

main();
