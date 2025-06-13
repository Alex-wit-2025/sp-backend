import { FastifyInstance } from "fastify";

export async function authRoutes(fastify: FastifyInstance) {
  fastify.get("/pfp/:uid", async (request, reply) => {
    return {};
  });
  fastify.get("/name/:uid", async (request, reply) => {
    return {};
  });
  // TODO: this will require firebase auth integration
  fastify.get("/projects/:uid", async (request, reply) => {
    return {};
  });
}
