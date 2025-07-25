import Fastify from "fastify";
import { docRoutes } from "./routes/documents";
import { userRoutes } from "./routes/user";

const fastify = Fastify();

async function main() {
  await fastify.register(docRoutes);
  await fastify.register(userRoutes);

  console.log("About to start Fastify server..."); // Add this line

  try {
    await fastify.listen({ port: 3000 , host: "0.0.0.0"});
    console.log("🚀 Server listening on http://localhost:3000");
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

main();
