import { FastifyInstance, FastifyRequest } from "fastify";
import { db } from "../utils/firebase";
import { DocumentData } from "../utils/types";
import { doc, getDoc } from "firebase/firestore";
import admin from "firebase-admin"; // Make sure to initialize admin elsewhere

const COLLECTION_NAME = 'documents';

interface GetDocRequest extends FastifyRequest {
  params: { id: string; uid: string };
  headers: { authorization?: string };
}

export async function authRoutes(fastify: FastifyInstance) {
  fastify.get<{ Params: { id: string; uid: string }; Reply: DocumentData | { error: string } }>(
    "/documents/:id/:uid",
    async (request: GetDocRequest, reply): Promise<DocumentData | { error: string }> => {
      const { id, uid } = request.params;
      const authHeader = request.headers.authorization;

      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return reply.status(401).send({ error: "Missing or invalid Authorization header" });
      }

      const idToken = authHeader.split(" ")[1];
      try {
        const decoded = await admin.auth().verifyIdToken(idToken);
        if (decoded.uid !== uid) {
          return reply.status(403).send({ error: "UID mismatch" });
        }

        const docRef = doc(db, COLLECTION_NAME, id);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
          return reply.status(404).send({ error: "Document not found" });
        }

        const data = docSnap.data() as DocumentData;
        if (!data.collaborators.includes(uid)) {
          return reply.status(403).send({ error: "Unauthorized access" });
        }

        const { id: _id, ...restData } = data;
        return { id: docSnap.id, ...restData } as DocumentData;
      } catch (err) {
        return reply.status(401).send({ error: "Invalid or expired token" });
      }
    }
  );
}