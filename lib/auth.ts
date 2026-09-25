import { cookies } from "next/headers";

const encoder = new TextEncoder();
const ADMIN_COOKIE = "rifagg_admin";
const MEMBER_COOKIE = "rifagg_member";

export type AccountRole = "owner" | "admin" | "sponsor" | "member";
export type AccountSession = { id: string; username: string; role: AccountRole; playerId?: string | null; sessionVersion: number };

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) throw new Error("SESSION_SECRET precisa ter pelo menos 32 caracteres.");
  return value;
}

async function signature(value: string) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const bytes = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return Buffer.from(bytes).toString("base64url");
}

async function createToken(account: AccountSession) {
  const payload = Buffer.from(JSON.stringify({ ...account, expires: Date.now() + 1000 * 60 * 60 * 12 })).toString("base64url");
  return `${payload}.${await signature(payload)}`;
}

async function readSession(cookieName: string, roles: AccountSession["role"] | AccountSession["role"][]): Promise<AccountSession | null> {
  try {
    const token = (await cookies()).get(cookieName)?.value;
    if (!token) return null;
    const [payload, provided] = token.split(".");
    if (!payload || !provided || !safeEqual(provided, await signature(payload))) return null;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as AccountSession & { expires?: number };
    const acceptedRoles = Array.isArray(roles) ? roles : [roles];
    if (!acceptedRoles.includes(data.role) || Number(data.expires) <= Date.now() || !data.id || !data.username || !Number.isSafeInteger(data.sessionVersion) || data.sessionVersion < 1) return null;
    return { id: data.id, username: data.username, role: data.role, playerId: data.playerId, sessionVersion: data.sessionVersion };
  } catch { return null; }
}

async function setSession(cookieName: string, account: AccountSession) {
  (await cookies()).set(cookieName, await createToken(account), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 60 * 60 * 12 });
}

async function clearSession(cookieName: string) {
  (await cookies()).set(cookieName, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 0 });
}

export async function getAdminSession() { return readSession(ADMIN_COOKIE, ["owner", "admin", "sponsor"]); }
export async function isAdminSession() { return Boolean(await getAdminSession()); }
export async function setAdminSession(account: Omit<AccountSession, "role"> & { role?: "owner" | "admin" | "sponsor" }) {
  await clearSession(MEMBER_COOKIE);
  return setSession(ADMIN_COOKIE, { ...account, role: account.role ?? "admin" });
}
export async function clearAdminSession() { return clearSession(ADMIN_COOKIE); }
export async function getMemberSession() { return readSession(MEMBER_COOKIE, "member"); }
export async function setMemberSession(account: Omit<AccountSession, "role">) {
  await clearSession(ADMIN_COOKIE);
  return setSession(MEMBER_COOKIE, { ...account, role: "member" });
}
export async function clearMemberSession() { return clearSession(MEMBER_COOKIE); }

export function validBootstrapAdmin(username: string, password: string) {
  const expectedUser = process.env.ADMIN_USERNAME || "admin";
  const expectedPassword = process.env.ADMIN_PASSWORD;
  if (!expectedPassword) throw new Error("Configure ADMIN_PASSWORD na Vercel.");
  return safeEqual(username.toLowerCase(), expectedUser.toLowerCase()) && safeEqual(password, expectedPassword);
}

function safeEqual(left: string, right: string) {
  const a = encoder.encode(left); const b = encoder.encode(right);
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) difference |= a[index] ^ b[index];
  return difference === 0;
}
