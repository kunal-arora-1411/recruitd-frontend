import { NextRequest, NextResponse } from "next/server";
import {
  signCookieValue,
  buildIdentityValue,
  normalizeEmail,
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

  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { email, password } = body;
  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }

  // Forward credentials to the backend
  const backendUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3100";
  const apiSecret = process.env.NEXT_PUBLIC_API_SECRET ?? "";

  let backendRes: Response;
  try {
    backendRes = await fetch(`${backendUrl}/api/recruiter/authenticate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiSecret ? { Authorization: `Bearer ${apiSecret}` } : {}),
      },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    return NextResponse.json({ error: "Could not reach authentication service" }, { status: 502 });
  }

  if (!backendRes.ok) {
    recordFailedAttempt(ip);
    const data = await backendRes.json().catch(() => ({}));
    return NextResponse.json(
      { error: data.error ?? "Incorrect email or password" },
      { status: 401 }
    );
  }

  resetRateLimit(ip);

  const normalizedEmail = normalizeEmail(email);
  const identityValue = buildIdentityValue("user", normalizedEmail);
  const signedValue = signCookieValue(identityValue);

  const res = NextResponse.json({ ok: true });

  res.cookies.set("recruitdesk_role", signedValue, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });

  res.cookies.set("recruitdesk_identity", signedValue, {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });

  return res;
}
