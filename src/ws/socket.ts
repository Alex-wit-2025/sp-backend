import { FastifyInstance } from "fastify";

export async function socketRoutes(fastify: FastifyInstance) {
  fastify.get("/ws", { websocket: true }, (connection, req) => {
    connection.socket.on("message", (message) => {
      console.log("Received:", message.toString());
      connection.socket.send(`Echo: ${message}`);
    });
  });
}
