"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, type Interview } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  FileText,
  RefreshCw,
  MessageSquare,
  AudioLines,
  Phone,
  Clock3,
} from "lucide-react";

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getDuration(start: string | null, end: string | null) {
  if (!start) return "—";
  const startTime = new Date(start).getTime();
  const endTime = end ? new Date(end).getTime() : Date.now();
  const diffMin = Math.round((endTime - startTime) / 60000);
  if (diffMin < 1) return "<1 min";
  return `${diffMin} min`;
}

function getStatusVariant(
  status: string,
): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "active":
      return "default";
    case "completed":
    case "analyzed":
      return "secondary";
    default:
      return "outline";
  }
}

export default function RecruiterInterviewsPage() {
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pageError, setPageError] = useState("");

  const fetchInterviews = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    setPageError("");
    try {
      const data = await api.getInterviews();
      setInterviews(data);
    } catch (error) {
      setPageError(
        error instanceof Error ? error.message : "Failed to load interviews",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const handleComplete = async (iid: string) => {
    try {
      await fetch("/api/proxy/api/interview/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interviewId: iid }),
      });
      fetchInterviews(true);
    } catch (err) {
      console.error("Failed to complete interview:", err);
    }
  };

  useEffect(() => {
    fetchInterviews();
  }, [fetchInterviews]);

  useEffect(() => {
    const onFocus = () => fetchInterviews();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [fetchInterviews]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-foreground">
            Interview History
          </h1>
          <p className="text-xs text-muted-foreground">
            Your past interviews and generated assessments
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchInterviews(true)}
          disabled={refreshing}
          className="gap-2 text-xs"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>

      {pageError && <p className="text-sm text-destructive">{pageError}</p>}

      {interviews.length > 0 ? (
        <Card className="shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Template</TableHead>
                <TableHead className="text-xs">Mode</TableHead>
                <TableHead className="text-xs">Duration</TableHead>
                <TableHead className="text-xs">Billed</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs">Started</TableHead>
                <TableHead className="text-right text-xs">Assessment</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {interviews.map((interview) => (
                <TableRow key={interview._id}>
                  <TableCell className="text-xs font-medium">
                    {typeof interview.templateId === "object"
                      ? interview.templateId.title
                      : "Interview"}
                  </TableCell>
                  <TableCell>
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
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {getDuration(interview.startedAt, interview.endedAt)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {interview.billedMinutes != null
                      ? `${interview.billedMinutes} min`
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={getStatusVariant(interview.status)}
                      className="text-[10px]"
                    >
                      {interview.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDate(interview.startedAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    {interview.assessmentId ? (
                      <Link
                        href={`/user/interviews/${interview._id}/assessment`}
                      >
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1.5 text-xs text-primary"
                        >
                          <FileText className="h-3.5 w-3.5" />
                          View Report
                        </Button>
                      </Link>
                    ) : (interview.status === "completed" || interview.status === "active") ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleComplete(interview._id)}
                        className="h-7 px-2 text-[10px] gap-1.5"
                      >
                        <FileText className="h-3 w-3" />
                        Generate Report
                      </Button>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">
                        {interview.status}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <Card className="shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Clock3 className="mb-3 h-8 w-8 text-muted-foreground/50" />
            <p className="text-xs text-muted-foreground">
              No interview sessions yet.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
