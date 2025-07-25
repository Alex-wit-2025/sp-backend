import { FastifyInstance, FastifyRequest } from "fastify";
import { db } from "../utils/firebase";
import { DocumentData } from "../utils/types";
import admin, { firestore } from "firebase-admin";
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
  console.log("Registering document routes...");
  // Update document title (name)
  fastify.post<{ Params: { id: string; uid: string }; Body: { title?: string }; Reply: boolean | { error: string } }>(
    "/api/documents/update-title/:id/:uid",
    async (request, reply) => {
      const { id, uid } = request.params;
      let title: string | undefined = undefined;
      try {
        const parsed = typeof request.body === "string" ? JSON.parse(request.body) : request.body;
        title = parsed.title;
      } catch (e) {
        console.error("Failed to parse request.body as JSON:", e);
        return reply.status(400).send({ error: "Invalid JSON in request body" });
      }
      if (!title || title.trim() === "") {
        return reply.status(400).send({ error: "Title is required" });
      }
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
        await docRef.update({ title });
        return true;
      } catch (err) {
        console.error("Error updating document title:", err);
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );
  fastify.delete<{ Params: { id: string; uid: string }; Reply: boolean | { error: string } }>(
    "/api/documents/delete/:id/:uid",
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

        if (data.createdBy === uid) {
          // Remove doc from all collaborators' docs arrays and subcollections
          for (const collaborator of data.collaborators) {
            const userDocRef = db.collection('users').doc(collaborator);
            const userDocSnap = await userDocRef.get();
            if (userDocSnap.exists) {
              const userData = userDocSnap.data() || {};
              const docsArr: string[] = Array.isArray(userData.docs) ? userData.docs : [];
              const updatedDocs = docsArr.filter(docId => docId !== id);
              await userDocRef.update({ docs: updatedDocs });
            }
            // Remove from docs subcollection
            await userDocRef.collection('docs').doc(id).delete();
          }
          // Delete the document itself
          await docRef.delete();
          return true;
        } else {
          // Remove current uid from collaborators
          const updatedCollaborators = data.collaborators.filter((c: string) => c !== uid);
          await docRef.update({ collaborators: updatedCollaborators });

          // Remove doc from user's docs array
          const userDocRef = db.collection('users').doc(uid);
          const userDocSnap = await userDocRef.get();
          if (userDocSnap.exists) {
            const userData = userDocSnap.data() || {};
            const docsArr: string[] = Array.isArray(userData.docs) ? userData.docs : [];
            const updatedDocs = docsArr.filter(docId => docId !== id);
            await userDocRef.update({ docs: updatedDocs });
          }
          // Remove from docs subcollection
          await userDocRef.collection('docs').doc(id).delete();
          return true;
        }
      } catch (err) {
        console.error("Error deleting document:", err);
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );
  // Create a new document
  fastify.post<{ Params: { uid: string }; Body: { title: string; content: string }; Reply: DocumentData | { error: string } }>(
    "/api/documents/create/:uid",
    async (request, reply) => {
      const { uid } = request.params;
      const { title, content } = typeof request.body === "string" ? JSON.parse(request.body) : request.body;
      const authResult = await verifyAuth(request.headers.authorization, uid);
      if ("error" in authResult) {
        return reply.status(authResult.status).send({ error: authResult.error });
      }
      if (!title) {
        return reply.status(400).send({ error: "Title is required" });
      }
      try {
        const docRef = db.collection(COLLECTION_NAME).doc();
        const now = admin.firestore.Timestamp.now();
        const docData: DocumentData = {
          id: docRef.id,
          title,
          content,
          createdBy: uid,
          collaborators: [uid],
          createdAt: now,
          updatedAt: now
        };
        await docRef.set(docData);
        // Add doc to user's docs array
        const userDocRef = db.collection('users').doc(uid);
        const userDocSnap = await userDocRef.get();
        if (!userDocSnap.exists) {
          await userDocRef.set({ docs: [docRef.id] });
        } else {
          const userData = userDocSnap.data() || {};
          const docsArr: string[] = Array.isArray(userData.docs) ? userData.docs : [];
          if (!docsArr.includes(docRef.id)) {
            docsArr.push(docRef.id);
            await userDocRef.update({ docs: docsArr });
          }
        }
        // Add doc to user's docs subcollection
        await userDocRef.collection('docs').doc(docRef.id).set(docData, { merge: true });
        return docData;
      } catch (err) {
        console.error("Error creating document:", err);
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );
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

        // Ensure user document exists for the collaborator and update docs array
        const userDocRef = db.collection('users').doc(collaborator);
        const userDocSnap = await userDocRef.get();
        if (!userDocSnap.exists) {
          await userDocRef.set({ docs: [id] });
          console.log("Created new user document for collaborator:", collaborator);
        } else {
          const userData = userDocSnap.data() || {};
          const docsArr: string[] = Array.isArray(userData.docs) ? userData.docs : [];
          if (!docsArr.includes(id)) {
            docsArr.push(id);
            await userDocRef.update({ docs: docsArr });
            console.log("Added doc to collaborator's docs array:", id);
          }
        }

        // Add the document to the collaborator's docs subcollection
        const userDocSubRef = userDocRef.collection('docs').doc(id);
        await userDocSubRef.set(
          { id, title: data.title, content: data.content, creator: uid, collaborators: data.collaborators },
          { merge: true }
        );
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

  fastify.post<{ Params: { id: string; uid: string }; Reply: boolean | { error: string }; Body: { collaborator: string } }>(
    "/api/documents/remove-collaborator/:id/:uid",
    async (request, reply) => {
      console.log("Received request to remove collaborator for document:", request.params.id, "by user:", request.params.uid);
      console.log("Request body:", request.body);
      const { id, uid } = request.params;
      let collaborator: string | undefined = undefined;
      try {
        const parsed = typeof request.body === "string" ? JSON.parse(request.body) : request.body;
        collaborator = parsed.collaborator;
      } catch (e) {
        console.error("Failed to parse request.body as JSON:", e);
        return reply.status(400).send({ error: "Invalid JSON in request body" });
      }
      if (!collaborator || collaborator.trim() === "") {
        return reply.status(400).send({ error: "Collaborator cannot be empty" });
      }
      if (collaborator === uid) {
        return reply.status(400).send({ error: "You cannot remove yourself as a collaborator" });
      }

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
          return reply.status(400).send({ error: "Collaborator does not exist" });
        }
        // Remove collaborator
        const updatedCollaborators = data.collaborators.filter((c: string) => c !== collaborator);
        await docRef.update({ collaborators: updatedCollaborators });
        console.log("Collaborator removed successfully:", collaborator);

        // Remove the document from the user's docs array
        const userDocRef = db.collection('users').doc(collaborator);
        const userDocSnap = await userDocRef.get();
        if (userDocSnap.exists) {
          const userData = userDocSnap.data() || {};
          const docsArr: string[] = Array.isArray(userData.docs) ? userData.docs : [];
          const updatedDocs = docsArr.filter(docId => docId !== id);
          await userDocRef.update({ docs: updatedDocs });
          console.log("Removed doc from collaborator's docs array:", id);
        }

        // Optionally, remove the document from the user's docs subcollection
        const userDocSubRef = db.collection('users').doc(collaborator).collection('docs').doc(id);
        await userDocSubRef.delete();

        return true;
      } catch (err) {
        console.error("Error removing collaborator:", err);
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );
}