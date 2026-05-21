import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { config } from "./config.js";
import { query } from "./db.js";

const scrypt = promisify(scryptCallback);
const sessionCookie = "edge_note_session";
const sessionTtlMs = 1000 * 60 * 60 * 24 * 14;

function parseCookies(req) {
  return Object.fromEntries((req.headers.cookie || "").split(";").map((part) => {
    const [key, ...value] = part.trim().split("=");
    return [key, decodeURIComponent(value.join("=") || "")];
  }).filter(([key]) => key));
}

function sign(value) {
  return createHmac("sha256", config.auth.sessionSecret).update(value).digest("base64url");
}

function sessionValue({ userId, expiresAt }) {
  const body = Buffer.from(JSON.stringify({ userId, expiresAt })).toString("base64url");
  return `${body}.${sign(body)}`;
}

function verifySession(value) {
  const [body, signature] = String(value || "").split(".");
  if (!body || !signature || sign(body) !== signature) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!payload.expiresAt || Date.parse(payload.expiresAt) < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

function cookieOptions({ clear = false } = {}) {
  return [
    `${sessionCookie}=${clear ? "" : "%VALUE%"}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    config.env === "production" ? "Secure" : "",
    clear ? "Max-Age=0" : `Max-Age=${Math.floor(sessionTtlMs / 1000)}`
  ].filter(Boolean).join("; ");
}

export function setSessionCookie(res, userId) {
  const expiresAt = new Date(Date.now() + sessionTtlMs).toISOString();
  const value = sessionValue({ userId, expiresAt });
  res.setHeader("set-cookie", cookieOptions().replace("%VALUE%", encodeURIComponent(value)));
}

export function clearSessionCookie(res) {
  res.setHeader("set-cookie", cookieOptions({ clear: true }));
}

async function getOwner() {
  const rows = await query(
    `SELECT id, email, display_name AS displayName, password_hash AS passwordHash
     FROM users
     WHERE id = :userId
     LIMIT 1`,
    { userId: config.ownerUserId }
  );
  return rows[0] || null;
}

async function hashPassword(password) {
  const salt = randomBytes(16).toString("base64url");
  const key = await scrypt(password, salt, 64);
  return `scrypt:${salt}:${key.toString("base64url")}`;
}

async function verifyPassword(password, passwordHash) {
  const [scheme, salt, stored] = String(passwordHash || "").split(":");
  if (scheme !== "scrypt" || !salt || !stored) return false;

  const key = await scrypt(password, salt, 64);
  const storedBuffer = Buffer.from(stored, "base64url");
  return storedBuffer.length === key.length && timingSafeEqual(storedBuffer, key);
}

export async function authStatus(req) {
  const owner = await getOwner();
  const session = verifySession(parseCookies(req)[sessionCookie]);
  const setupRequired = !owner?.passwordHash;
  const authenticated = Boolean(owner && session?.userId === owner.id && !setupRequired);

  return {
    authenticated,
    setupRequired,
    user: authenticated ? {
      id: owner.id,
      email: owner.email,
      displayName: owner.displayName
    } : null
  };
}

export async function setupOwnerPassword({ password }) {
  const owner = await getOwner();
  if (!owner) {
    const error = new Error("Seed the owner account before setting a password.");
    error.status = 409;
    throw error;
  }
  if (owner.passwordHash) {
    const error = new Error("Owner password is already set.");
    error.status = 409;
    throw error;
  }
  if (String(password || "").length < 10) {
    const error = new Error("Password must be at least 10 characters.");
    error.status = 400;
    throw error;
  }

  const passwordHash = await hashPassword(password);
  await query(
    `UPDATE users
     SET password_hash = :passwordHash
     WHERE id = :userId`,
    { userId: owner.id, passwordHash }
  );

  return owner.id;
}

export async function loginOwner({ password }) {
  const owner = await getOwner();
  if (!owner?.passwordHash || !(await verifyPassword(password, owner.passwordHash))) {
    const error = new Error("Invalid password.");
    error.status = 401;
    throw error;
  }

  return owner.id;
}

export async function requireAuth(req) {
  const status = await authStatus(req);
  if (!status.authenticated) {
    const error = new Error(status.setupRequired ? "Owner password setup required." : "Login required.");
    error.status = 401;
    error.auth = status;
    throw error;
  }
  return status.user;
}
