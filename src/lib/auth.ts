import "server-only";
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

export const SESSION_COOKIE = "raddad_session";
const MAX_AGE = 60 * 60 * 24 * 14; // 14 days

export type Session =
  | { role: "admin"; exp: number }
  | { role: "business"; businessId: string; exp: number };

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET must be set (32+ chars)");
  return s;
}

function sign(data: string) {
  return createHmac("sha256", secret()).update(data).digest("base64url");
}

export function encodeSession(s: Session) {
  const data = Buffer.from(JSON.stringify(s)).toString("base64url");
  return `${data}.${sign(data)}`;
}

export function decodeSession(token: string | undefined): Session | null {
  if (!token) return null;
  const [data, sig] = token.split(".");
  if (!data || !sig) return null;
  const expected = Buffer.from(sign(data));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const s = JSON.parse(Buffer.from(data, "base64url").toString()) as Session;
    if (s.exp < Date.now()) return null;
    return s;
  } catch {
    return null;
  }
}

type NewSession = { role: "admin" } | { role: "business"; businessId: string };

export async function createSession(s: NewSession) {
  const session: Session = { ...s, exp: Date.now() + MAX_AGE * 1000 };
  (await cookies()).set(SESSION_COOKIE, encodeSession(session), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function destroySession() {
  (await cookies()).delete(SESSION_COOKIE);
}

export const getSession = cache(async (): Promise<Session | null> => {
  return decodeSession((await cookies()).get(SESSION_COOKIE)?.value);
});

export async function requireSession(): Promise<Session> {
  const s = await getSession();
  if (!s) redirect("/login");
  return s;
}

export async function requireAdmin() {
  const s = await requireSession();
  if (s.role !== "admin") redirect("/dashboard");
  return s;
}

/** Ensures the current user may access the given business. */
export async function requireBusinessAccess(businessId: string) {
  const s = await requireSession();
  if (s.role === "business" && s.businessId !== businessId) redirect("/dashboard");
  return s;
}

export function hashPassword(pw: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(pw, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(pw: string, stored: string | null | undefined) {
  if (!stored) return false;
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const a = Buffer.from(hash, "hex");
  const b = scryptSync(pw, salt, 64);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
