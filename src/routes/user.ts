import { FastifyInstance, FastifyRequest } from "fastify";
import admin from "firebase-admin";
import { db } from "../utils/firebase";
import { verifyAuth } from "../utils/fbauth";

interface DocumentsListRequest extends FastifyRequest {
  params: { uid: string };
  headers: { authorization?: string };
}

interface ListOfDocuments {
  documents: string[];
}

export async function userRoutes(fastify: FastifyInstance) {
  console.log("Registering user routes...");
  fastify.get("/pfp/:uid", async (request, reply) => {
    return {};
  });
  fastify.get("/name/:uid", async (request, reply) => {
    return {};
  });
  fastify.get<{ Params: { uid: string }; Reply: ListOfDocuments | { error: string } }>(
    "/api/user/documents/:uid",
    async (request: DocumentsListRequest, reply) => {
      console.log("Received request for user documents:", request.params.uid);
      const { uid } = request.params;
      const authResult = await verifyAuth(request.headers.authorization, uid);
      if ("error" in authResult) {
        console.error(authResult.error);
        return reply.status(authResult.status).send({ error: authResult.error });
      }

      try {
        console.log("Token verified successfully for UID:", uid);
        const userDocRef = db.collection('users').doc(uid);
        const userDoc = await userDocRef.get();
        if (!userDoc.exists) {
          return { documents: [] };
        }
        const documents = userDoc.data()?.docs ?? [];
        console.log("Fetched documents for user:", uid, "Documents:", documents);

        return { documents };
      } catch (err) {
        console.error("Error verifying token or fetching user documents:", err);
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );

  fastify.get<{ Params: { uid: string }; Reply: { email?: string } | { error: string } }>("/api/email/:uid", async (request, reply) => {
    const { uid } = request.params;
    try {
      const userRecord = await admin.auth().getUser(uid);
      return { email: userRecord.email ?? "" };
    } catch (err) {
      console.error("Error fetching user email:", err);
      return reply.status(404).send({ error: "User not found" });
    }
  });
  fastify.post<{ Body: { uids: string[] }; Reply: { results: { uid: string, email: string }[] } }>("/api/emails/bulk", async (request, reply) => {
    console.log("Received bulk email request:", request.body);
    let uids: string[] = [];
    try {
      if (typeof request.body === "string") {
        uids = JSON.parse(request.body).uids;
      } else {
        uids = request.body.uids;
      }
    } catch (err) {
      return reply.status(400).send({ results: [] });
    }
    if (!Array.isArray(uids)) {
      return reply.status(400).send({ results: [] });
    }
    const results: { uid: string, email: string }[] = [];
    for (const uid of uids) {
      try {
        const userRecord = await admin.auth().getUser(uid);
        results.push({ uid, email: userRecord.email ?? "unknown" });
      } catch {
        results.push({ uid, email: "unknown" });
      }
    }
    return { results };
  });
  fastify.get<{ Params: { email: string }; Reply: { uid?: string } | { error: string } }>("/api/uid/:email", async (request, reply) => {
    const { email } = request.params;
    try {
      const userRecord = await admin.auth().getUserByEmail(email);
      return { uid: userRecord.uid };
    } catch (err) {
      console.error("Error fetching user UID by email:", err);
      return reply.status(404).send({ error: "User not found" });
    }
  });
}
