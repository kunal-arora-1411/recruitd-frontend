"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, ArrowRight, BriefcaseBusiness, ShieldCheck, Zap, Sparkles } from "lucide-react";
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
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-6">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 -z-10 h-full w-full opacity-20 dark:opacity-40">
        <div className="absolute top-[-10%] left-[-10%] h-[50%] w-[50%] rounded-full bg-primary/30 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] h-[40%] w-[40%] rounded-full bg-blue-500/20 blur-[100px]" />
      </div>

      <div className="absolute right-6 top-6">
        <ThemeToggle />
      </div>

      <div className="flex w-full max-w-5xl flex-col items-center gap-16 lg:flex-row lg:items-start lg:justify-between">
        {/* Hero Section */}
        <div className={`flex flex-col gap-8 transition-all duration-700 lg:w-1/2 ${activePortal ? "lg:opacity-40 lg:blur-sm" : ""}`}>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl primary-gradient text-primary-foreground shadow-lg shadow-primary/20">
              <BriefcaseBusiness className="h-5.5 w-5.5" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              RecruitDesk
            </h1>
          </div>

          <div className="space-y-4">
            <h2 className="text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
              Next-Gen <span className="text-primary italic">AI Interviews</span> for Global Teams.
            </h2>
            <p className="max-w-md text-lg text-muted-foreground leading-relaxed">
              Automate your screening process with intelligent voice agents. Conduct structured, unbiased interviews at scale.
            </p>
          </div>

          <div className="flex flex-wrap gap-4 text-sm font-medium text-muted-foreground">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-green-500" />
              Verified Results
            </div>
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-500" />
              Instant Analysis
            </div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-purple-500" />
              AI Transcription
            </div>
          </div>
        </div>

        {/* Portal Selection / Login Card */}
        <div className="relative w-full max-w-sm lg:w-1/2">
          <div className="glass-card flex flex-col rounded-3xl p-8 lg:p-10">
            {!activePortal ? (
              <div className="space-y-6">
                <div className="space-y-2">
                  <h3 className="text-xl font-semibold">Welcome back</h3>
                  <p className="text-sm text-muted-foreground">Select a portal to continue your session.</p>
                </div>
                <div className="flex flex-col gap-3">
                  <Button
                    size="lg"
                    className="h-14 w-full justify-between rounded-2xl text-base font-semibold group primary-gradient"
                    onClick={() => openPortal("admin")}
                  >
                    <span>Admin  Portal</span>
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 transition-transform group-hover:translate-x-1">
                      <ArrowRight className="h-4 w-4" />
                    </div>
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    className="h-14 w-full justify-between rounded-2xl text-base font-semibold border-2 hover:bg-accent transition-all group"
                    onClick={() => openPortal("recruiter")}
                  >
                    <span>Recruiter Portal</span>
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent transition-transform group-hover:translate-x-1">
                      <ArrowRight className="h-4 w-4" />
                    </div>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
                <button 
                  onClick={() => setActivePortal(null)}
                  className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="h-3 w-3" />
                  Back to selection
                </button>

                <div className="space-y-2">
                  <h3 className="text-xl font-semibold">
                    {activePortal === "admin" ? "Admin Access" : "Recruiter Login"}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {activePortal === "admin" 
                      ? "Enter your secure admin password" 
                      : "Access your recruiter dashboard"}
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {activePortal === "recruiter" && (
                    <div className="space-y-2">
                      <Input
                        type="email"
                        placeholder="Work email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        autoFocus
                        className="h-12 rounded-xl bg-background/50 border-white/20 focus:ring-primary"
                      />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Input
                      type="password"
                      placeholder="Security password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoFocus={activePortal === "admin"}
                      className="h-12 rounded-xl bg-background/50 border-white/20 focus:ring-primary"
                    />
                  </div>
                  
                  {error && (
                    <p className="text-xs font-medium text-destructive px-1">{error}</p>
                  )}

                  <Button
                    size="lg"
                    type="submit"
                    disabled={loading || (activePortal === "recruiter" && !email.trim())}
                    className="h-12 w-full rounded-xl font-semibold primary-gradient shadow-lg shadow-primary/20"
                  >
                    {loading ? "Verifying access..." : "Enter Portal"}
                  </Button>
                </form>

                {activePortal === "recruiter" && (
                  <p className="text-center text-[11px] leading-relaxed text-muted-foreground/60 px-4">
                    Account access is managed by your organization. Contact your administrator to reset credentials.
                  </p>
                )}
              </div>
            )}
          </div>
          
          {/* Subtle accent line below portal picker */}
          {!activePortal && (
            <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 flex items-center gap-2 opacity-30">
              <div className="h-px w-8 bg-muted-foreground" />
              <span className="text-[10px] whitespace-nowrap font-medium tracking-widest uppercase">Trusted by 200+ companies</span>
              <div className="h-px w-8 bg-muted-foreground" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
