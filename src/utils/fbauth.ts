import { admin } from "./firebase";

export async function verifyAuth(token: string | undefined, uid: string): Promise<{ decoded: admin.auth.DecodedIdToken } | { error: string, status: number }> {
  if (!token || !token.startsWith("Bearer ")) {
    return { error: "Missing or invalid Authorization header", status: 401 };
  }
  const idToken = token.split(" ")[1];
  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    if (decoded.uid !== uid) {
      return { error: "UID mismatch", status: 403 };
    }
    return { decoded };
  } catch (err) {
    return { error: "Invalid or expired token", status: 401 };
  }
}
