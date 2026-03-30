import { NextRequest, NextResponse } from "next/server";

const COOKIE_SECRET =
  process.env.COOKIE_SECRET || "default-cookie-secret-change-me";

/**
 * Verify HMAC-SHA256 signature on a signed cookie value ("role.hex_signature").
 * Uses Web Crypto API so it works in Edge runtime.
 */
async function verifyCookieSignature(raw: string): Promise<string | null> {
  const dotIndex = raw.lastIndexOf(".");
  if (dotIndex === -1) return null;

  const value = raw.slice(0, dotIndex);
  const providedSig = raw.slice(dotIndex + 1);

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(COOKIE_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(value),
  );
  const expectedSig = Array.from(new Uint8Array(sigBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  if (providedSig.length !== expectedSig.length) return null;
  if (providedSig !== expectedSig) return null;

  return value;
}

export async function proxy(req: NextRequest) {
  const rawCookie = req.cookies.get("recruitdesk_role")?.value;
  const path = req.nextUrl.pathname;

  let role: string | null = null;
  if (rawCookie) {
    role = await verifyCookieSignature(rawCookie);
  }

  // Admin routes require "admin" role
  if (path.startsWith("/admin")) {
    if (role !== "admin") {
      return NextResponse.redirect(new URL("/", req.url));
    }
  }

  // User routes require "user" or "admin" role
  if (path.startsWith("/user")) {
    if (role !== "user" && role !== "admin") {
      return NextResponse.redirect(new URL("/", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/user/:path*"],
};
