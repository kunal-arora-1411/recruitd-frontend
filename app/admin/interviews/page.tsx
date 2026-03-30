"use client";

import { useEffect, useState, useCallback } from "react";
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
  Eye,
  ClipboardList,
  FileText,
  MessageSquare,
  AudioLines,
  RefreshCw,
  Phone,
} from "lucide-react";

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getDuration(start: string | null, end: string | null) {
  if (!start) return "—";
  const s = new Date(start).getTime();
  const e = end ? new Date(end).getTime() : Date.now();
  const diffMin = Math.round((e - s) / 60000);
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
      return "secondary";
    case "analyzed":
      return "secondary";
    default:
      return "outline";
  }
}

export default function InterviewsPage() {
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchInterviews = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const data = await api.getInterviews();
      setInterviews(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchInterviews();
  }, [fetchInterviews]);

  // Re-fetch when the tab regains focus — catches interviews completed in another tab
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-foreground">
            Interviews
          </h1>
          <p className="text-xs text-muted-foreground">
            All interview sessions across templates
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

      {interviews.length > 0 ? (
        <Card className="shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Candidate</TableHead>
                <TableHead className="text-xs">Template</TableHead>
                <TableHead className="text-xs">Mode</TableHead>
                <TableHead className="text-xs">Duration</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs">Started</TableHead>
                <TableHead className="text-xs text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {interviews.map((interview) => (
                <TableRow key={interview._id}>
                  <TableCell className="text-xs font-medium">
                    {interview.candidateName || "Anonymous"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {typeof interview.templateId === "object"
                      ? interview.templateId.title
                      : "—"}
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
                    <div className="flex justify-end gap-1">
                      <Link href={`/admin/interviews/${interview._id}`}>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                      {interview.assessmentId && (
                        <Link href={`/admin/interviews/${interview._id}/assessment`}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                          >
                            <FileText className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <Card className="shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <ClipboardList className="mb-3 h-8 w-8 text-muted-foreground/50" />
            <p className="text-xs text-muted-foreground">
              No interview sessions yet
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
