"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api, type InviteInfo, getInviteStreamWSUrl } from "@/lib/api";
import { StreamInterview } from "@/components/stream-interview";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BriefcaseBusiness,
  AudioLines,
  CheckCircle,
  Loader2,
  Clock,
  AlertCircle,
} from "lucide-react";

type PageState = "loading" | "ready" | "starting" | "interview" | "completed" | "error";

export default function InvitePage() {
  const params = useParams();
  const token = params.token as string;

  const [pageState, setPageState] = useState<PageState>("loading");
  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [interviewId, setInterviewId] = useState<string | null>(null);
  const [inviteToken, setInviteToken] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    api
      .getInvite(token)
      .then((data) => {
        setInvite(data);
        setPageState("ready");
      })
      .catch((err) => {
        setErrorMsg(err.message || "This invite link is invalid or has expired.");
        setPageState("error");
      });
  }, [token]);

  const handleStart = async () => {
    setPageState("starting");
    try {
      const result = await api.activateInvite(token);
      setInterviewId(result.interviewId);
      setInviteToken(result.inviteToken);
      setPageState("interview");
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Failed to start interview.",
      );
      setPageState("error");
    }
  };

  const handleVoiceEnd = () => {
    setPageState("completed");
  };

  // Loading skeleton
  if (pageState === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md shadow-sm">
          <CardContent className="space-y-4 py-10">
            <Skeleton className="mx-auto h-10 w-10 rounded-full" />
            <Skeleton className="mx-auto h-5 w-48" />
            <Skeleton className="mx-auto h-4 w-64" />
            <Skeleton className="mx-auto h-9 w-40 rounded-md" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error / expired / already used
  if (pageState === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md shadow-sm">
          <CardContent className="flex flex-col items-center py-12">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <h2 className="mb-2 text-sm font-semibold text-foreground">
              Link Unavailable
            </h2>
            <p className="text-center text-xs text-muted-foreground">{errorMsg}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Completed
  if (pageState === "completed") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md shadow-sm">
          <CardContent className="flex flex-col items-center py-12">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <h2 className="mb-2 text-sm font-semibold text-foreground">
              Interview Complete
            </h2>
            <p className="text-center text-xs text-muted-foreground">
              Thank you{invite?.candidateName ? `, ${invite.candidateName}` : ""}. Your responses have been recorded and an assessment is being generated.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Active voice interview
  if (pageState === "interview" && interviewId && inviteToken && invite) {
    return (
      <StreamInterview
        interviewId={interviewId}
        template={{
          _id: "",
          title: invite.template.title,
          description: invite.template.description,
          promptUsed: "",
          config: {
            interviewerPersona: "",
            difficulty: invite.template.difficulty,
            evaluationCriteria: [],
            interviewFlow: [],
          },
          llmProvider: "gemini",
          sttProvider: "sarvam",
          ttsProvider: "deepgram",
          duration: invite.template.duration ?? undefined,
          createdAt: "",
        }}
        candidateName={invite.candidateName}
        onEnd={handleVoiceEnd}
        wsUrlOverride={getInviteStreamWSUrl(interviewId, inviteToken)}
      />
    );
  }

  // Ready / starting — candidate landing page
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <BriefcaseBusiness className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-base">{invite?.template.title}</CardTitle>
          {invite?.template.description && (
            <p className="text-xs text-muted-foreground">
              {invite.template.description}
            </p>
          )}
        </CardHeader>

        <CardContent className="space-y-5">
          {/* Candidate info */}
          <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 space-y-1.5">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Candidate
            </p>
            <p className="text-sm font-medium text-foreground">
              {invite?.candidateName}
            </p>
            {invite?.candidateEmail && (
              <p className="text-xs text-muted-foreground">
                {invite.candidateEmail}
              </p>
            )}
          </div>

          {/* Badges */}
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="outline" className="text-[10px] gap-1">
              <AudioLines className="h-3 w-3" />
              Voice Interview
            </Badge>
            <Badge variant="secondary" className="text-[10px] capitalize">
              {invite?.template.difficulty}
            </Badge>
            {invite?.template.duration && (
              <Badge variant="outline" className="text-[10px] gap-1">
                <Clock className="h-3 w-3" />
                {invite.template.duration} min
              </Badge>
            )}
          </div>

          {/* Instructions */}
          <div className="space-y-1.5">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
              Before you begin
            </p>
            <ul className="space-y-1 text-xs text-muted-foreground list-disc list-inside">
              <li>Find a quiet environment</li>
              <li>Allow microphone access when prompted</li>
              <li>Speak clearly and at a natural pace</li>
              {invite?.template.duration && (
                <li>The interview will auto-end after {invite.template.duration} minutes</li>
              )}
            </ul>
          </div>

          {/* Expiry notice */}
          {invite?.expiresAt && (
            <p className="text-[10px] text-muted-foreground/70 text-center">
              Link expires {new Date(invite.expiresAt).toLocaleDateString()}
            </p>
          )}

          <Button
            onClick={handleStart}
            disabled={pageState === "starting"}
            className="w-full gap-2"
            size="sm"
          >
            {pageState === "starting" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <AudioLines className="h-3.5 w-3.5" />
            )}
            {pageState === "starting" ? "Starting..." : "Begin Interview"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
