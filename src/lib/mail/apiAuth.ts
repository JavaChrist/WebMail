import { adminAuth } from "@/config/firebase-admin";

export interface AuthResult {
  uid: string;
}

export async function verifyRequest(request: Request): Promise<AuthResult> {
  const header = request.headers.get("Authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    throw new AuthError("Authentification requise", 401);
  }
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    return { uid: decoded.uid };
  } catch {
    throw new AuthError("Token invalide ou expiré", 401);
  }
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}
