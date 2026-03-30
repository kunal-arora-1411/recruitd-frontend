import { NextRequest, NextResponse } from "next/server";
import {
  timingSafeCompare,
  signCookieValue,
  isRateLimited,
  recordFailedAttempt,
  resetRateLimit,
} from "@/lib/auth-utils";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";

  if (isRateLimited(ip)) {
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }

  let body: { password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { password } = body;
  const adminPassword = process.env.ADMIN_PASSWORD ?? "";

  if (!password || !adminPassword || !timingSafeCompare(password, adminPassword)) {
    recordFailedAttempt(ip);
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }

  resetRateLimit(ip);

  const signedValue = signCookieValue("admin");

  const res = NextResponse.json({ ok: true });

  // Role cookie — httpOnly, read only by middleware on the server
  res.cookies.set("recruitdesk_role", signedValue, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });

  // Identity cookie — readable by JS (used as X-Recruitdesk-Identity header for backend calls)
  res.cookies.set("recruitdesk_identity", signedValue, {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });

  return res;
}
