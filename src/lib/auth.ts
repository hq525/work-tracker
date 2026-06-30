import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "wt_session";

function secret(): Uint8Array {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET not set");
  return new TextEncoder().encode(s);
}

export function verifyPassword(input: string): boolean {
  const pw = process.env.APP_PASSWORD;
  if (!pw) throw new Error("APP_PASSWORD not set");
  return input === pw;
}

export async function createSessionToken(): Promise<string> {
  return new SignJWT({ ok: true })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("30d")
    .sign(secret());
}

export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    await jwtVerify(token, secret());
    return true;
  } catch {
    return false;
  }
}
