import crypto from "crypto";

const COOKIE_SECRET =
  process.env.COOKIE_SECRET || "default-cookie-secret-change-me";

/**
 * Timing-safe string comparison to prevent timing attacks on password checks.
 */
export function timingSafeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) {
    // Compare bufA against itself so the timing is constant regardless of
    // length mismatch — avoids leaking the expected length.
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Sign a cookie value with HMAC-SHA256.
 * Returns "value.hex_signature".
 */
export function signCookieValue(value: string): string {
  const signature = crypto
    .createHmac("sha256", COOKIE_SECRET)
    .update(value)
    .digest("hex");
  return `${value}.${signature}`;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function buildIdentityValue(
  role: "admin" | "user",
  email?: string,
): string {
  if (role === "admin") {
    return "admin";
  }

  return `user:${encodeURIComponent(normalizeEmail(email || ""))}`;
}

// ── Simple in-memory rate limiter ────────────────────────────────────

const attempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

export function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || now > entry.resetAt) return false;
  return entry.count >= MAX_ATTEMPTS;
}

export function recordFailedAttempt(ip: string): void {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || now > entry.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
  } else {
    entry.count++;
  }
}

export function resetRateLimit(ip: string): void {
  attempts.delete(ip);
}
