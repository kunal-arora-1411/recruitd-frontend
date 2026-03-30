"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowRight, BriefcaseBusiness } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

export default function HomePage() {
  const router = useRouter();
  const [activePortal, setActivePortal] = useState<"admin" | "recruiter" | null>(
    null,
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const endpoint =
      activePortal === "admin" ? "/api/admin/verify" : "/api/recruiter/verify";
    const redirectPath = activePortal === "admin" ? "/admin" : "/user";

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password,
          ...(activePortal === "recruiter" ? { email } : {}),
        }),
      });

      if (res.ok) {
        router.push(redirectPath);
      } else {
        const data = await res.json();
        setError(data.error || "Incorrect password");
      }
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function openPortal(portal: "admin" | "recruiter") {
    setActivePortal(portal);
    setEmail("");
    setPassword("");
    setError("");
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="flex max-w-lg flex-col items-center text-center">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <BriefcaseBusiness className="h-5 w-5" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            RecruitDesk
          </h1>
        </div>

        <p className="mb-8 text-sm leading-relaxed text-muted-foreground">
          AI-powered recruitment interview platform. Create job templates, conduct
          structured interviews, and generate detailed candidate assessments —
          all automated.
        </p>

        <div className="flex flex-col items-center gap-3">
          {!activePortal ? (
            <div className="flex gap-3">
              <Button
                size="sm"
                className="gap-2"
                onClick={() => openPortal("admin")}
              >
                Admin Portal
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-2"
                onClick={() => openPortal("recruiter")}
              >
                Recruiter Portal
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="flex flex-col items-center gap-3"
            >
              {activePortal === "recruiter" && (
                <>
                  <Input
                    type="email"
                    placeholder="Enter your work email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoFocus
                    className="w-64"
                  />
                  <p className="max-w-64 text-center text-[11px] text-muted-foreground">
                    No signup here. Ask your admin to create your recruiter
                    account first.
                  </p>
                </>
              )}
              <Input
                type="password"
                placeholder={
                  activePortal === "admin"
                    ? "Enter admin password"
                    : "Enter your password"
                }
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus={activePortal === "admin"}
                className="w-64"
              />
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button
                size="sm"
                type="submit"
                disabled={loading || (activePortal === "recruiter" && !email.trim())}
                className="gap-2"
              >
                {loading ? "Verifying..." : "Enter"}
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
