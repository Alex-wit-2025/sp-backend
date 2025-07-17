import { FastifyInstance } from "fastify";

export async function authRoutes(fastify: FastifyInstance) {
  fastify.get("/login", async (request, reply) => {
    return {};
  });
  fastify.get("/logout", async (request, reply) => {
    return {};
  });
  fastify.get("/login", async (request, reply) => {
    return {};
  });
  fastify.get("/logout", async (request, reply) => {
    return {};
  });
}
