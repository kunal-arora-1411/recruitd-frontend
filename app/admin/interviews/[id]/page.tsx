"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api, type InterviewDetail } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  Bot,
  User,
  FileText,
  AudioLines,
  MessageSquare,
  Phone,
} from "lucide-react";
import Link from "next/link";

export default function InterviewDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [data, setData] = useState<InterviewDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (params.id) {
      api
        .getInterview(params.id as string)
        .then(setData)
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [params.id]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-96 rounded-lg" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <p className="text-xs text-muted-foreground">Interview not found</p>
      </div>
    );
  }

  const { interview, transcript } = data;

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
              Interview Transcript
            </h1>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {interview.candidateName || "Anonymous"}
              </span>
              <Badge variant="outline" className="text-[10px]">
                {interview.status}
              </Badge>
              <Badge variant="outline" className="gap-1 text-[10px]">
                {interview.mode === "voice" ? (
                  <AudioLines className="h-2.5 w-2.5" />
                ) : interview.mode === "phone" ? (
                  <Phone className="h-2.5 w-2.5" />
                ) : (
                  <MessageSquare className="h-2.5 w-2.5" />
                )}
                {interview.mode === "voice"
                  ? "Voice"
                  : interview.mode === "phone"
                    ? "Phone"
                    : "Text"}
              </Badge>
            </div>
          </div>
        </div>
        {interview.assessmentId && (
          <Link href={`/admin/interviews/${interview._id}/assessment`}>
            <Button size="sm" variant="outline" className="gap-2 text-xs">
              <FileText className="h-3.5 w-3.5" />
              View Assessment
            </Button>
          </Link>
        )}
      </div>

      {/* Transcript */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-sm">
            Conversation ({transcript.length} entries)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px] pr-4">
            <div className="space-y-4">
              {transcript.map((entry) => (
                <div
                  key={entry._id}
                  className={`flex gap-3 ${
                    entry.speaker === "user" ? "flex-row-reverse" : ""
                  }`}
                >
                  <Avatar className="h-7 w-7 shrink-0">
                    <AvatarFallback className="text-[10px]">
                      {entry.speaker === "ai" ? (
                        <Bot className="h-3.5 w-3.5" />
                      ) : (
                        <User className="h-3.5 w-3.5" />
                      )}
                    </AvatarFallback>
                  </Avatar>
                  <div
                    className={`max-w-[75%] rounded-lg px-3 py-2 ${
                      entry.speaker === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    <p className="text-xs leading-relaxed">{entry.content}</p>
                    <span className="mt-1 block text-[9px] opacity-60">
                      {new Date(entry.timestamp).toLocaleTimeString("en-US", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
