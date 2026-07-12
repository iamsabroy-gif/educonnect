import { cookies } from "next/headers";
import crypto from "crypto";

/**
 * Admin auth is intentionally independent of the users/sessions tables: a
 * single static username+password from env vars, with a stateless signed
 * cookie (no DB row). Rotating ADMIN_PASSWORD immediately invalidates every
 * existing admin session, since the password is also the signing secret.
 */

const ADMIN_COOKIE = "oc_admin_session";
const ADMIN_SESSION_HOURS = 12;

function sha256(input: string): Buffer {
  return crypto.createHash("sha256").update(input).digest();
}

function timingSafeEqualStr(a: string, b: string): boolean {
  return crypto.timingSafeEqual(sha256(a), sha256(b));
}

export function verifyAdminCredentials(username: string, password: string): boolean {
  const expectedUser = process.env.ADMIN_USERNAME;
  const expectedPass = process.env.ADMIN_PASSWORD;
  if (!expectedUser || !expectedPass) return false;
  return timingSafeEqualStr(username, expectedUser) && timingSafeEqualStr(password, expectedPass);
}

function sign(expiresAtMs: number): string {
  const secret = process.env.ADMIN_PASSWORD ?? "";
  const hmac = crypto.createHmac("sha256", secret).update(String(expiresAtMs)).digest("hex");
  return `${expiresAtMs}.${hmac}`;
}

export async function createAdminSession() {
  const expiresAtMs = Date.now() + ADMIN_SESSION_HOURS * 60 * 60 * 1000;
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_COOKIE, sign(expiresAtMs), {
    httpOnly: true,
    sameSite: "lax",
    expires: new Date(expiresAtMs),
    path: "/",
  });
}

export async function destroyAdminSession() {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_COOKIE);
}

export async function isAdminSessionValid(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value;
  if (!token) return false;
  const [expiresAtStr, hmac] = token.split(".");
  const expiresAtMs = Number(expiresAtStr);
  if (!expiresAtMs || Date.now() > expiresAtMs || !hmac) return false;
  const expectedHmac = sign(expiresAtMs).split(".")[1];
  try {
    return crypto.timingSafeEqual(Buffer.from(hmac, "hex"), Buffer.from(expectedHmac, "hex"));
  } catch {
    return false;
  }
}

export async function requireAdminSession() {
  if (!(await isAdminSessionValid())) {
    const { redirect } = await import("next/navigation");
    redirect("/admin/login");
  }
}
