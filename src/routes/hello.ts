import { FastifyInstance } from "fastify";

export async function helloRoutes(fastify: FastifyInstance) {
  fastify.get("/api/hello", async (request, reply) => {
    return { msg: "Hello from Fastify!" };
  });
}
