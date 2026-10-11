import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

export const AUTH_COOKIE = "xenon_auth";
export const AUTH_COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET environment variable is not set");
  }
  return secret;
}

export interface AuthSession {
  id: string;
  email: string;
  name: string;
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function createToken(session: AuthSession): string {
  return jwt.sign(
    { sub: session.id, email: session.email, name: session.name },
    getJwtSecret(),
    { expiresIn: "7d" }
  );
}

export function readToken(token: string | undefined): AuthSession | null {
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as jwt.JwtPayload;
    const id = decoded.sub;
    const email = decoded.email;
    const name = decoded.name;
    if (
      typeof id !== "string" ||
      typeof email !== "string" ||
      typeof name !== "string"
    ) {
      return null;
    }
    return { id, email, name };
  } catch {
    return null;
  }
}
