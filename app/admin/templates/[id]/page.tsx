"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  api,
  type JobTemplate,
  type PhoneRoute,
  type TemplateAuthorization,
} from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Copy,
  Check,
  ExternalLink,
  Phone,
  Loader2,
  Trash2,
  Route,
  Globe,
  Lock,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";

export default function TemplateDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [template, setTemplate] = useState<JobTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [phoneDialogOpen, setPhoneDialogOpen] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [phoneCallStatus, setPhoneCallStatus] = useState<string | null>(null);
  const [phoneCallStarting, setPhoneCallStarting] = useState(false);
  const [phoneRoutes, setPhoneRoutes] = useState<PhoneRoute[]>([]);
  const [deletingRoute, setDeletingRoute] = useState<string | null>(null);
  const [authorizations, setAuthorizations] = useState<TemplateAuthorization[]>(
    [],
  );
  const [authorizationsLoading, setAuthorizationsLoading] = useState(true);
  const [authorizationEmail, setAuthorizationEmail] = useState("");
  const [authorizationMode, setAuthorizationMode] = useState<
    "template" | "all"
  >("template");
  const [authorizationSaving, setAuthorizationSaving] = useState(false);
  const [authorizationError, setAuthorizationError] = useState("");
  const [visibilitySaving, setVisibilitySaving] = useState(false);

  useEffect(() => {
    if (params.id) {
      setAuthorizationsLoading(true);
      api
        .getTemplate(params.id as string)
        .then(setTemplate)
        .catch(console.error)
        .finally(() => setLoading(false));
      api
        .getPhoneRoutes(params.id as string)
        .then(setPhoneRoutes)
        .catch(() => {});
      api
        .getTemplateAuthorizations(params.id as string)
        .then(setAuthorizations)
        .catch(() => {})
        .finally(() => setAuthorizationsLoading(false));
    }
  }, [params.id]);

  const refreshRoutes = () => {
    if (params.id) {
      api
        .getPhoneRoutes(params.id as string)
        .then(setPhoneRoutes)
        .catch(() => {});
    }
  };

  const embedCode = `<iframe src="${typeof window !== "undefined" ? window.location.origin : "https://yourdomain.com"}/interview/${params.id}" width="100%" height="700" frameborder="0" allow="microphone"></iframe>`;

  const handleCopy = () => {
    navigator.clipboard.writeText(embedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePhoneCall = async () => {
    if (!phoneNumber.trim() || !template) return;
    setPhoneCallStarting(true);
    setPhoneCallStatus("Creating interview session...");
    try {
      const result = await api.startInterview(
        template._id,
        "Phone Test",
        "phone",
        phoneNumber.trim(),
      );
      setPhoneCallStatus("Initiating call...");
      await api.initiatePhoneCall(result.interview._id);
      setPhoneCallStatus("Call initiated! Waiting for answer...");
      const interval = setInterval(async () => {
        try {
          const status = await api.getPhoneCallStatus(result.interview._id);
          if (status.status === "analyzed" || status.status === "completed") {
            setPhoneCallStatus("Call ended. Assessment generated.");
            clearInterval(interval);
          } else if (status.callActive) {
            setPhoneCallStatus("Call in progress...");
          }
        } catch {
          clearInterval(interval);
        }
      }, 3000);
      setTimeout(() => clearInterval(interval), 30 * 60 * 1000);
      setTimeout(refreshRoutes, 500);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setPhoneCallStatus(`Failed: ${message}`);
    } finally {
      setPhoneCallStarting(false);
    }
  };

  const handleToggleVisibility = async () => {
    if (!template) return;
    const isPublic = template.publicTemplate !== false;
    setVisibilitySaving(true);
    try {
      const updated = await api.setTemplateAvailability(
        template._id,
        !isPublic,
      );
      setTemplate((current) => (current ? { ...current, ...updated } : updated));
    } catch (error) {
      console.error(error);
    } finally {
      setVisibilitySaving(false);
    }
  };

  const handleAuthorizeRecruiter = async () => {
    if (!template || !authorizationEmail.trim()) return;
    setAuthorizationSaving(true);
    setAuthorizationError("");
    try {
      const updated = await api.authorizeTemplateRecruiter(
        template._id,
        authorizationEmail.trim(),
        authorizationMode === "all",
      );
      setAuthorizations(updated);
      setAuthorizationEmail("");
      setAuthorizationMode("template");
    } catch (error) {
      setAuthorizationError(
        error instanceof Error ? error.message : "Failed to authorize recruiter",
      );
    } finally {
      setAuthorizationSaving(false);
    }
  };

  const handleRevokeAccess = async (email: string, revokeAll: boolean) => {
    if (!template) return;
    setAuthorizationSaving(true);
    setAuthorizationError("");
    try {
      const updated = await api.revokeTemplateRecruiterAccess(
        template._id,
        email,
        revokeAll,
      );
      setAuthorizations(updated);
    } catch (error) {
      setAuthorizationError(
        error instanceof Error ? error.message : "Failed to revoke access",
      );
    } finally {
      setAuthorizationSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }

  if (!template) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <p className="text-xs text-muted-foreground">Template not found</p>
      </div>
    );
  }

  const templateIsPublic = template.publicTemplate !== false;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="h-7 w-7 p-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-foreground">
              {template.title}
            </h1>
            <p className="text-xs text-muted-foreground">
              {template.description}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="gap-2"
            onClick={() => {
              setPhoneDialogOpen(true);
              setPhoneCallStatus(null);
              setPhoneNumber("");
            }}
          >
            <Phone className="h-3.5 w-3.5" />
            Phone Call
          </Button>
          <Link href={`/interview/${template._id}`} target="_blank">
            <Button size="sm" className="gap-2">
              <ExternalLink className="h-3.5 w-3.5" />
              Test Interview
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Config */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm">Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <span className="text-[10px] text-muted-foreground">
                  Persona
                </span>
                <p className="text-xs">{template.config.interviewerPersona}</p>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] text-muted-foreground">
                  Difficulty
                </span>
                <div>
                  <Badge variant="outline" className="text-[10px]">
                    {template.config.difficulty}
                  </Badge>
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] text-muted-foreground">
                  Voice LLM
                </span>
                <div>
                  <Badge variant="outline" className="text-[10px]">
                    {template.llmProvider === "mistral"
                      ? "Mistral Small"
                      : "Gemini 2.5 Flash Lite"}
                  </Badge>
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] text-muted-foreground">
                  STT Engine
                </span>
                <div>
                  <Badge variant="outline" className="text-[10px]">
                    {template.sttProvider === "openai"
                      ? "OpenAI Whisper"
                      : template.sttProvider === "elevenlabs"
                        ? "ElevenLabs Standard"
                        : template.sttProvider === "elevenlabs-realtime"
                          ? "ElevenLabs Realtime"
                          : template.sttProvider === "cartesia"
                            ? "Cartesia Ink-Whisper"
                            : template.sttProvider === "sarvam"
                              ? "Sarvam Saarika"
                              : "Deepgram Nova-2"}
                  </Badge>
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] text-muted-foreground">
                  TTS Engine
                </span>
                <div>
                  <Badge variant="outline" className="text-[10px]">
                    {template.ttsProvider === "openai"
                      ? "OpenAI TTS"
                      : template.ttsProvider === "elevenlabs"
                        ? "ElevenLabs TTS"
                        : template.ttsProvider === "cartesia"
                          ? "Cartesia Sonic-3"
                          : template.ttsProvider === "sarvam"
                            ? "Sarvam Bulbul"
                            : "Deepgram Aura-2"}
                  </Badge>
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-1.5">
              <span className="text-[10px] text-muted-foreground">
                Evaluation Criteria
              </span>
              <div className="flex flex-wrap gap-1.5">
                {template.config.evaluationCriteria?.map((c, i) => (
                  <Badge key={i} variant="secondary" className="text-[10px]">
                    {c}
                  </Badge>
                ))}
              </div>
            </div>

            <Separator />

            <div className="space-y-1.5">
              <span className="text-[10px] text-muted-foreground">
                Interview Flow
              </span>
              <div className="space-y-2">
                {template.config.interviewFlow?.map((step, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 rounded-md border border-border bg-muted/30 p-3"
                  >
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-medium text-primary">
                      {i + 1}
                    </div>
                    <div>
                      <span className="text-xs font-medium capitalize">
                        {step.phase}
                      </span>
                      <span className="ml-2 text-[10px] text-muted-foreground">
                        {step.duration}
                      </span>
                      <p className="text-[10px] text-muted-foreground">
                        {step.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Details & Auth */}
        <div className="space-y-6">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <span className="text-[10px] text-muted-foreground">
                  Interviews
                </span>
                <p className="text-xs font-medium">
                  {template.interviewsCount ?? 0}
                </p>
              </div>
              <div className="space-y-2">
                <span className="text-[10px] text-muted-foreground">
                  Recruiter Access
                </span>
                <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/30 px-3 py-2">
                  <div className="flex items-center gap-2">
                    {templateIsPublic ? (
                      <Globe className="h-3.5 w-3.5 text-primary" />
                    ) : (
                      <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                    <div>
                      <p className="text-xs font-medium">
                        {templateIsPublic
                          ? "Available to all recruiters"
                          : "Restricted access"}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {templateIsPublic
                          ? "Recruiters can see this template without manual authorization."
                          : "Only explicitly authorized recruiters can see this template."}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleToggleVisibility}
                    disabled={visibilitySaving}
                    className={`rounded-full border px-3 py-1 text-[10px] font-medium transition-colors ${
                      templateIsPublic
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background text-muted-foreground"
                    } disabled:opacity-60`}
                  >
                    {visibilitySaving
                      ? "Saving..."
                      : templateIsPublic
                        ? "Enabled"
                        : "Disabled"}
                  </button>
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] text-muted-foreground">
                  Created
                </span>
                <p className="text-xs">
                  {new Date(template.createdAt).toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] text-muted-foreground">
                  Original Prompt
                </span>
                <p className="text-xs text-muted-foreground">
                  {template.promptUsed}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
                <CardTitle className="text-sm">Recruiter Authorizations</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="text-[10px] text-muted-foreground">
                  Create the recruiter account in Admin &gt; Recruiters first,
                  then grant template access here.
                </p>
                <Input
                  placeholder="recruiter@company.com"
                  value={authorizationEmail}
                  onChange={(e) => setAuthorizationEmail(e.target.value)}
                  className="text-xs"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setAuthorizationMode("template")}
                    className={`rounded-md border px-3 py-1.5 text-[10px] font-medium transition-colors ${
                      authorizationMode === "template"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background text-muted-foreground"
                    }`}
                  >
                    This Template
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuthorizationMode("all")}
                    className={`rounded-md border px-3 py-1.5 text-[10px] font-medium transition-colors ${
                      authorizationMode === "all"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background text-muted-foreground"
                    }`}
                  >
                    All Templates
                  </button>
                </div>
                <Button
                  size="sm"
                  onClick={handleAuthorizeRecruiter}
                  disabled={!authorizationEmail.trim() || authorizationSaving}
                  className="w-full text-xs"
                >
                  {authorizationSaving ? "Saving..." : "Authorize Recruiter"}
                </Button>
                {authorizationError && (
                  <p className="text-xs text-destructive">
                    {authorizationError}
                  </p>
                )}
              </div>

              <Separator />

              {authorizationsLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full rounded-md" />
                  <Skeleton className="h-10 w-full rounded-md" />
                </div>
              ) : authorizations.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No recruiters have been authorized for this template yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {authorizations.map((entry) => (
                    <div
                      key={`${entry.email}-${entry.hasFullTemplateAccess}-${entry.directTemplateAccess}`}
                      className="rounded-md border border-border bg-muted/30 px-3 py-2"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium">
                            {entry.email}
                          </p>
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {entry.hasFullTemplateAccess && (
                              <Badge variant="default" className="text-[10px]">
                                All Templates
                              </Badge>
                            )}
                            {entry.directTemplateAccess && (
                              <Badge variant="outline" className="text-[10px]">
                                This Template
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          {entry.directTemplateAccess && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-[10px]"
                              disabled={authorizationSaving}
                              onClick={() =>
                                handleRevokeAccess(entry.email, false)
                              }
                            >
                              Remove Template
                            </Button>
                          )}
                          {entry.hasFullTemplateAccess && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-[10px] text-destructive"
                              disabled={authorizationSaving}
                              onClick={() =>
                                handleRevokeAccess(entry.email, true)
                              }
                            >
                              Remove All
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Phone Routing Card */}
          <Card className="shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Route className="h-3.5 w-3.5 text-muted-foreground" />
                <CardTitle className="text-sm">Phone Routing</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-[10px] text-muted-foreground">
                Numbers below will be interviewed with this template when they
                call in. Routes are registered automatically when you initiate an
                outbound call.
              </p>
              {phoneRoutes.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">
                  No routes yet. Initiate a phone call to register one.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {phoneRoutes.map((r) => (
                    <div
                      key={r._id}
                      className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2"
                    >
                      <span className="font-mono text-xs">{r.phoneNumber}</span>
                      <button
                        disabled={deletingRoute === r.phoneNumber}
                        onClick={async () => {
                          setDeletingRoute(r.phoneNumber);
                          try {
                            await api.deletePhoneRoute(r.phoneNumber);
                            setPhoneRoutes((prev) =>
                              prev.filter(
                                (x) => x.phoneNumber !== r.phoneNumber,
                              ),
                            );
                          } catch (e) {
                            console.error(e);
                          } finally {
                            setDeletingRoute(null);
                          }
                        }}
                        className="rounded p-1 text-muted-foreground hover:text-destructive disabled:opacity-40"
                        title="Remove route"
                      >
                        {deletingRoute === r.phoneNumber ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="rounded-md border border-border bg-muted/30 p-2">
                <p className="text-[10px] text-muted-foreground">
                  Twilio webhook URL (set once in Twilio Console):
                </p>
                <p className="mt-1 font-mono text-[10px] text-foreground break-all">
                  {`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3100"}/api/phone/incoming`}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Embed Code</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopy}
                  className="h-7 gap-1.5 text-[10px]"
                >
                  {copied ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <pre className="overflow-auto rounded-md border border-border bg-muted/50 p-3 font-mono text-[10px] text-muted-foreground">
                {embedCode}
              </pre>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Phone Call Dialog */}
      <Dialog open={phoneDialogOpen} onOpenChange={setPhoneDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">Initiate Phone Interview</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Candidate Phone Number (with country code)
              </label>
              <Input
                placeholder="+1234567890"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="text-xs"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handlePhoneCall();
                }}
              />
            </div>
            {phoneCallStatus && (
              <p className="text-xs text-muted-foreground">{phoneCallStatus}</p>
            )}
          </div>
          <DialogFooter>
            <Button
              size="sm"
              onClick={handlePhoneCall}
              disabled={!phoneNumber.trim() || phoneCallStarting}
              className="gap-2"
            >
              {phoneCallStarting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Phone className="h-3.5 w-3.5" />
              )}
              {phoneCallStarting ? "Calling..." : "Call Now"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
