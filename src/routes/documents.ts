import { FastifyInstance, FastifyRequest } from "fastify";
import { db } from "../utils/firebase";
import { DocumentData } from "../utils/types";
import admin from "firebase-admin";
import { assert } from "console";
import { verifyAuth } from "../utils/fbauth";

const COLLECTION_NAME = 'documents';

interface GetDocRequest extends FastifyRequest {
  params: { id: string; uid: string };
  headers: { authorization?: string };
}

interface ListCollaborators {
  collaborators: string[];
  canEdit: boolean;
}


export async function docRoutes(fastify: FastifyInstance) {
  fastify.get<{ Params: { id: string; uid: string }; Reply: DocumentData | { error: string } }>(
    "/api/documents/:id/:uid",
    async (request: GetDocRequest, reply): Promise<DocumentData | { error: string }> => {
      console.log("Received request for document:", request.params.id, "by user:", request.params.uid);
      const { id, uid } = request.params;
      const authResult = await verifyAuth(request.headers.authorization, uid);
      if ("error" in authResult) {
        return reply.status(authResult.status).send({ error: authResult.error });
      }
      try {
        const docRef = db.collection(COLLECTION_NAME).doc(id);
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
        console.error("Stack trace:", err instanceof Error ? err.stack : "No stack trace available");
        return reply.status(401).send({ error: "Invalid or expired token" });
      }
    }
  );

  fastify.post<{ Params: { id: string; uid: string }; Reply: boolean | { error: string }; Body: { collaborator: string } }>(
    "/api/documents/add-collaborator/:id/:uid",
    async (request, reply) => {
      console.log("Received request to add collaborator for document:", request.params.id, "by user:", request.params.uid);
      console.log("Request body:", request.body);
      console.log("Request headers:", request.headers);
      const { id, uid } = request.params;
      let collaborator: string | undefined = undefined;
      try {
        const parsed = JSON.parse(request.body as unknown as string);
        collaborator = parsed.collaborator;
      } catch (e) {
        console.error("Failed to parse request.body as JSON:", e);
        return reply.status(400).send({ error: "Invalid JSON in request body" });
      }
      if (!collaborator || collaborator.trim() === "") {
        return reply.status(400).send({ error: "Collaborator cannot be empty" });
      }
      assert(typeof collaborator === "string", "Collaborator must be a string");
      console.log("Collaborator to add:", collaborator);

      const authResult = await verifyAuth(request.headers.authorization, uid);
      if ("error" in authResult) {
        return reply.status(authResult.status).send({ error: authResult.error });
      }

      try {
        const docRef = db.collection(COLLECTION_NAME).doc(id);
        const docSnap = await docRef.get();
        if (!docSnap.exists) {
          return reply.status(404).send({ error: "Document not found" });
        }
        const data = docSnap.data() as DocumentData;
        if (!data.createdBy || data.createdBy !== uid) {
          return reply.status(403).send({ error: "Unauthorized access" });
        }
        if (!data.collaborators.includes(collaborator)) {
          data.collaborators.push(collaborator);
          await docRef.update({ collaborators: data.collaborators });
          console.log("Collaborator added successfully:", collaborator);
        } else {
          console.log("Collaborator already exists:", collaborator);
          return reply.status(400).send({ error: "Collaborator already exists" });
        }
        const userDocRef = db.collection('users').doc(collaborator).collection('docs').doc(id);
        await userDocRef.set({ id, title: data.title, content: data.content, creator: uid, collaborators: data.collaborators }, { merge: true });
        return true;
      } catch (err) {
        console.error("Error adding collaborator:", err);
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );

  fastify.get<{ Params: { id: string; uid: string }; Reply: ListCollaborators | { error: string } }>(
    "/api/documents/collaborators/:id/:uid",
    async (request, reply) => {
      const { id, uid } = request.params;
      const authResult = await verifyAuth(request.headers.authorization, uid);
      if ("error" in authResult) {
        return reply.status(authResult.status).send({ error: authResult.error });
      }
      try {
        const docRef = db.collection(COLLECTION_NAME).doc(id);
        const docSnap = await docRef.get();
        if (!docSnap.exists) {
          return reply.status(404).send({ error: "Document not found" });
        }
        const data = docSnap.data() as DocumentData;
        if (!data.collaborators.includes(uid)) {
          return reply.status(403).send({ error: "Unauthorized access" });
        }
        return {
          collaborators: data.collaborators,
          canEdit: data.createdBy === uid
        } as ListCollaborators;
      } catch (err) {
        console.error("Error listing collaborators:", err);
        return reply.status(500).send({ error: "Internal server error" });
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
      const authResult = await verifyAuth(request.headers.authorization, uid);
      if ("error" in authResult) {
        return reply.status(authResult.status).send({ error: authResult.error });
      }
      try {
        const docRef = db.collection(COLLECTION_NAME).doc(id);
        const docSnap = await docRef.get();
        if (!docSnap.exists) {
          return reply.status(404).send({ error: "Document not found" });
        }
        const data = docSnap.data() as DocumentData;
        if (!data.collaborators.includes(uid)) {
          return reply.status(403).send({ error: "Unauthorized access" });
        }
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