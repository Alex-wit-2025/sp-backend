import { FastifyInstance, FastifyRequest } from "fastify";
import { db } from "../utils/firebase";
import { DocumentData } from "../utils/types";
import admin from "firebase-admin"; // Make sure to initialize admin elsewhere

const COLLECTION_NAME = 'documents';

interface GetDocRequest extends FastifyRequest {
  params: { id: string; uid: string };
  headers: { authorization?: string };
}


export async function docRoutes(fastify: FastifyInstance) {
  fastify.get<{ Params: { id: string; uid: string }; Reply: DocumentData | { error: string } }>(
    "/api/documents/:id/:uid",
    async (request: GetDocRequest, reply): Promise<DocumentData | { error: string }> => {
      console.log("Received request for document:", request.params.id, "by user:", request.params.uid);
      const { id, uid } = request.params;
      const authHeader = request.headers.authorization;
      //console.log("Authorization header:", authHeader);
      
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        console.error("Missing or invalid Authorization header");
        return reply.status(401).send({ error: "Missing or invalid Authorization header" });
      }
      
      const idToken = authHeader.split(" ")[1];
      try {
        const decoded = await admin.auth().verifyIdToken(idToken);
        console.log("Decoded token:", decoded);
        if (decoded.uid !== uid) {
          console.error("UID mismatch: expected", uid, "but got", decoded.uid);
          return reply.status(403).send({ error: "UID mismatch" });
        }

        console.log("Token verified successfully for UID:", uid);
        const docRef = db.collection(COLLECTION_NAME).doc(id);
        
        //test connection to Firestore
        // List all collections in Firestore for debugging
        try {
          const collections = await admin.firestore().listCollections();
          console.log("Available Firestore collections:");
          collections.forEach(col => console.log(" -", col.id));
        } catch (err) {
          console.error("Error listing collections:", err);
        }
        console.log("Fetching document from Firestore:", docRef.path);
        const docSnap = await docRef.get();
        if (!docSnap.exists) {
          return reply.status(404).send({ error: "Document not found" });
        }
        console.log("Document found:", docSnap.id);
        const data = docSnap.data() as DocumentData;
        console.log("Fetched document data:");
        if (!data.collaborators.includes(uid)) {
          return reply.status(403).send({ error: "Unauthorized access" });
        }

        const { id: _id, ...restData } = data;
        return { id: docSnap.id, ...restData } as DocumentData;
      } catch (err) {
        console.log("Error verifying token or fetching document:", err);
        //get stack trace
        console.error("Stack trace:", err instanceof Error ? err.stack : "No stack trace available");

        return reply.status(401).send({ error: "Invalid or expired token" });
      }
    }
  );
  fastify.post<{ Params: { id: string; uid: string }; Reply: boolean | { error: string }; Body: { content?: string } }>(
  "/api/documents/update/:id/:uid",
  async (request, reply) => {
    console.log("Received update request for document:", request.params.id, "by user:", request.params.uid);
    console.log("Request body:", request.body);
    console.log("Request headers:", request.headers);
    const { id, uid } = request.params;
    let content: string | undefined = undefined;
    try {
      const parsed = JSON.parse(request.body as string);
      content = parsed.content;
    } catch (e) {
      console.error("Failed to parse request.body as JSON:", e);
      return reply.status(400).send({ error: "Invalid JSON in request body" });
    }
    console.log("Content to update:", content);
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

      const docRef = db.collection(COLLECTION_NAME).doc(id);
      const docSnap = await docRef.get();

      if (!docSnap.exists) {
        return reply.status(404).send({ error: "Document not found" });
      }

      const data = docSnap.data() as DocumentData;
      if (!data.collaborators.includes(uid)) {
        return reply.status(403).send({ error: "Unauthorized access" });
      }

      // Only update if content is provided
      if (typeof content === "string") {
        await docRef.update({ content });
        return true;
      } else {
        return reply.status(400).send({ error: "No content provided" });
      }
    } catch (err) {
      console.error("Error updating document:", err);
      return reply.status(500).send({ error: "Internal server error" });
    }
  }
);
}