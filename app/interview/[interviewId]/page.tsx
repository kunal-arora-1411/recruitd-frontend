"use client";

import { startTransition, useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { api, type TranscriptEntry, type JobTemplate } from "@/lib/api";
import { StreamInterview } from "@/components/stream-interview";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Bot,
  User,
  Send,
  CheckCircle,
  Loader2,
  AudioLines,
  Phone,
  BriefcaseBusiness,
} from "lucide-react";

type ViewState = "setup" | "chat" | "voice" | "phone" | "completed";
type InterviewMode = "text" | "voice" | "phone";

export default function InterviewPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const templateId = params.interviewId as string;
  const launchedFromUser = searchParams.get("source") === "user";

  const [viewState, setViewState] = useState<ViewState>("setup");
  const [template, setTemplate] = useState<JobTemplate | null>(null);
  const [candidateName, setCandidateName] = useState("");
  const [interviewId, setInterviewId] = useState<string | null>(null);
  const [messages, setMessages] = useState<TranscriptEntry[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [showEndDialog, setShowEndDialog] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [interviewMode, setInterviewMode] = useState<InterviewMode>("voice");
  const [voiceAssessmentId, setVoiceAssessmentId] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [phoneCallActive, setPhoneCallActive] = useState(false);
  const [phoneStatus, setPhoneStatus] = useState<string | null>(null);
  const [startError, setStartError] = useState("");

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (templateId) {
      api
        .getTemplate(templateId)
        .then(setTemplate)
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [templateId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleStart = async () => {
    if (!candidateName.trim()) return;
    if (interviewMode === "phone" && !phoneNumber.trim()) return;
    setStartError("");
    setStarting(true);
    try {
      const result = await api.startInterview(
        templateId,
        candidateName.trim(),
        interviewMode,
        interviewMode === "phone" ? phoneNumber.trim() : undefined,
      );
      setInterviewId(result.interview._id);
      if (interviewMode === "voice") {
        setViewState("voice");
      } else if (interviewMode === "phone") {
        setViewState("phone");
        setPhoneStatus("Initiating call...");
        try {
          await api.initiatePhoneCall(result.interview._id);
          setPhoneCallActive(true);
          setPhoneStatus("Calling...");
          pollPhoneStatus(result.interview._id);
        } catch (err) {
          setPhoneStatus("Failed to initiate call");
          console.error(err);
        }
      } else {
        setMessages([result.initialMessage]);
        setViewState("chat");
      }
    } catch (error) {
      console.error(error);
      setStartError(
        error instanceof Error ? error.message : "Failed to start interview",
      );
    } finally {
      setStarting(false);
    }
  };

  const pollPhoneStatus = (iid: string) => {
    const interval = setInterval(async () => {
      try {
        const status = await api.getPhoneCallStatus(iid);
        if (status.status === "analyzed" || status.status === "completed") {
          setPhoneCallActive(false);
          setPhoneStatus("Call ended");
          clearInterval(interval);
          setTimeout(() => {
            if (status.assessmentId) setVoiceAssessmentId(status.assessmentId);
            if (launchedFromUser) {
              startTransition(() => {
                router.replace(
                  status.assessmentId
                    ? `/user/interviews/${iid}/assessment`
                    : "/user/interviews",
                );
              });
              return;
            }
            setViewState("completed");
          }, 1500);
        } else if (status.callActive) {
          setPhoneStatus("Call in progress...");
        }
      } catch {
        clearInterval(interval);
      }
    }, 3000);
    setTimeout(() => clearInterval(interval), 30 * 60 * 1000);
  };

  const handleVoiceEnd = (assessmentId?: string) => {
    if (assessmentId) setVoiceAssessmentId(assessmentId);
    if (launchedFromUser && interviewId) {
      startTransition(() => {
        router.replace(
          assessmentId
            ? `/user/interviews/${interviewId}/assessment`
            : "/user/interviews",
        );
      });
      return;
    }
    window.close();
    // Fallback if browser blocks window.close()
    setViewState("completed");
  };

  const handleSend = async () => {
    if (!inputValue.trim() || !interviewId || sending) return;

    const content = inputValue.trim();
    setInputValue("");
    setSending(true);

    // Optimistic user message
    const tempUserMsg: TranscriptEntry = {
      _id: `temp-${Date.now()}`,
      interviewId,
      speaker: "user",
      content,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      const result = await api.sendMessage(interviewId, content);
      // Replace temp message and add AI response
      setMessages((prev) => [
        ...prev.filter((m) => m._id !== tempUserMsg._id),
        result.userMessage,
        result.aiMessage,
      ]);
    } catch (error) {
      console.error(error);
      // Remove optimistic message on error
      setMessages((prev) => prev.filter((m) => m._id !== tempUserMsg._id));
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleComplete = async () => {
    if (!interviewId) return;
    setCompleting(true);
    try {
      const result = await api.completeInterview(interviewId);
      if (launchedFromUser) {
        startTransition(() => {
          router.replace(
            result.assessment
              ? `/user/interviews/${interviewId}/assessment`
              : "/user/interviews",
          );
        });
        return;
      }
    } catch (error) {
      console.error("Failed to generate assessment:", error);
      if (launchedFromUser) {
        startTransition(() => {
          router.replace("/user/interviews");
        });
        return;
      }
      // Still transition — the interview existed, even if assessment generation failed
    } finally {
      setCompleting(false);
    }
    setShowEndDialog(false);
    window.close();
    // Fallback if browser blocks window.close()
    setViewState("completed");
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-2xl shadow-sm">
          <CardContent className="space-y-4 py-8">
            <Skeleton className="mx-auto h-6 w-48" />
            <Skeleton className="mx-auto h-4 w-64" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!template) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md shadow-sm">
          <CardContent className="flex flex-col items-center py-12">
            <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary opacity-50">
              <BriefcaseBusiness className="h-5 w-5" />
            </div>
            <p className="text-xs text-muted-foreground">
              Interview template not found
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Setup screen
  if (viewState === "setup") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md shadow-sm">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <BriefcaseBusiness className="h-5 w-5 text-primary" />
            </div>
            <CardTitle className="text-sm">{template.title}</CardTitle>
            <p className="text-xs text-muted-foreground">
              {template.description}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Your Name
              </label>
              <Input
                placeholder="Enter your full name"
                value={candidateName}
                onChange={(e) => {
                  setCandidateName(e.target.value);
                  setStartError("");
                }}
                className="text-xs"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleStart();
                }}
              />
            </div>

            <div className="flex flex-wrap gap-1.5">
              <Badge variant="outline" className="text-[10px]">
                {template.config.difficulty}
              </Badge>
              {template.config.evaluationCriteria?.slice(0, 3).map((c, i) => (
                <Badge key={i} variant="secondary" className="text-[10px]">
                  {c}
                </Badge>
              ))}
            </div>

            {/* Interview Mode Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Interview Mode
              </label>
              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setInterviewMode("voice");
                    setStartError("");
                  }}
                  className={`flex flex-col items-center gap-1.5 rounded-lg border px-3 py-3 text-xs transition-all ${
                    interviewMode === "voice"
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/30"
                  }`}
                >
                  <AudioLines className="h-4 w-4" />
                  <span className="text-[10px] font-medium">Voice</span>
                </button>
              </div>
            </div>

            {interviewMode === "phone" && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Phone Number (with country code)
                </label>
                <Input
                  placeholder="+1234567890"
                  value={phoneNumber}
                  onChange={(e) => {
                    setPhoneNumber(e.target.value);
                    setStartError("");
                  }}
                  className="text-xs"
                />
              </div>
            )}

            {startError && (
              <p className="text-xs text-destructive">{startError}</p>
            )}

            <Button
              onClick={handleStart}
              disabled={
                !candidateName.trim() ||
                starting ||
                (interviewMode === "phone" && !phoneNumber.trim())
              }
              className="w-full gap-2"
              size="sm"
            >
              {starting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : null}
              {starting
                ? "Starting..."
                : interviewMode === "voice"
                  ? "Begin Voice Interview"
                  : interviewMode === "phone"
                    ? "Begin Phone Interview"
                    : "Begin Interview"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Completed screen — shown only if window.close() was blocked by the browser
  if (viewState === "completed") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md shadow-sm">
          <CardContent className="flex flex-col items-center py-12">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-secondary/10">
              <CheckCircle className="h-6 w-6 text-secondary" />
            </div>
            <h2 className="mb-2 text-sm font-semibold text-foreground">
              Interview Complete
            </h2>
            <p className="mb-4 text-center text-xs text-muted-foreground">
              Thank you, {candidateName}. Your responses have been recorded and
              an assessment is being generated.
            </p>
            {voiceAssessmentId && (
              <p className="mb-4 text-center text-[10px] text-muted-foreground/70">
                Assessment ID: {voiceAssessmentId}
              </p>
            )}
            <Button
              size="sm"
              variant="outline"
              className="text-xs"
              onClick={() => {
                if (launchedFromUser) {
                  router.replace("/user/interviews");
                  return;
                }
                window.close();
              }}
            >
              {launchedFromUser ? "Back to Interviews" : "Close Tab"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Phone call interface
  if (viewState === "phone") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md shadow-sm">
          <CardContent className="flex flex-col items-center py-12">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Phone className="h-6 w-6 text-primary animate-pulse" />
            </div>
            <h2 className="mb-2 text-sm font-semibold text-foreground">
              {phoneStatus || "Phone Interview"}
            </h2>
            <p className="mb-4 text-center text-xs text-muted-foreground">
              {phoneCallActive
                ? "Your interview is in progress on the phone call. Please continue speaking on your phone."
                : "Connecting to your phone number..."}
            </p>
            {phoneCallActive && (
              <Badge variant="outline" className="text-[10px] animate-pulse">
                Live Call
              </Badge>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Voice interface
  if (viewState === "voice" && interviewId && template) {
    return (
      <StreamInterview
        interviewId={interviewId}
        template={template}
        candidateName={candidateName}
        onEnd={handleVoiceEnd}
      />
    );
  }

  // Chat interface
  return (
    <div className="flex h-screen flex-col bg-background overflow-hidden">
      {/* Header */}
      <header className="shrink-0 border-b border-border bg-card/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-5 w-5 items-center justify-center rounded bg-primary text-primary-foreground">
              <BriefcaseBusiness className="h-3 w-3" />
            </div>
            <span className="text-xs font-medium text-foreground">
              {template.title}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px]">
              Active
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowEndDialog(true)}
              className="text-[10px] text-destructive"
            >
              End Interview
            </Button>
          </div>
        </div>
      </header>

      {/* Messages */}
      <div className="mx-auto w-full max-w-2xl flex-1 min-h-0 px-4">
        <div ref={scrollRef} className="h-full overflow-y-auto">
          <div className="space-y-4 py-6">
            {messages.map((msg) => (
              <div
                key={msg._id}
                className={`flex gap-2.5 ${
                  msg.speaker === "user" ? "flex-row-reverse" : ""
                }`}
              >
                <Avatar className="h-6 w-6 shrink-0">
                  <AvatarFallback className="text-[9px]">
                    {msg.speaker === "ai" ? (
                      <Bot className="h-3 w-3" />
                    ) : (
                      <User className="h-3 w-3" />
                    )}
                  </AvatarFallback>
                </Avatar>
                <div
                  className={`max-w-[80%] rounded-lg px-3 py-2 ${
                    msg.speaker === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  }`}
                >
                  <p className="text-xs leading-relaxed">{msg.content}</p>
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex gap-2.5">
                <Avatar className="h-6 w-6 shrink-0">
                  <AvatarFallback className="text-[9px]">
                    <Bot className="h-3 w-3" />
                  </AvatarFallback>
                </Avatar>
                <div className="rounded-lg bg-muted px-3 py-2">
                  <div className="flex gap-1">
                    <span
                      className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/50"
                      style={{ animationDelay: "0ms" }}
                    />
                    <span
                      className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/50"
                      style={{ animationDelay: "150ms" }}
                    />
                    <span
                      className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/50"
                      style={{ animationDelay: "300ms" }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-border bg-card/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-2xl items-end gap-2 px-4 py-3">
          <Textarea
            placeholder="Type your response..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className="min-h-10 max-h-30 resize-none text-xs"
            rows={1}
          />
          <Button
            onClick={handleSend}
            disabled={!inputValue.trim() || sending}
            size="sm"
            className="shrink-0"
          >
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* End Dialog */}
      <Dialog open={showEndDialog} onOpenChange={setShowEndDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-sm">End Interview</DialogTitle>
            <DialogDescription className="text-xs">
              Are you sure you want to end this interview? An assessment will be
              generated based on your responses.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowEndDialog(false)}
              className="text-xs"
            >
              Continue Interview
            </Button>
            <Button
              size="sm"
              onClick={handleComplete}
              disabled={completing}
              className="text-xs"
            >
              {completing ? "Finishing..." : "End & Generate Assessment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
