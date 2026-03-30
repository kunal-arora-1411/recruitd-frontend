"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, type DashboardStats, type Interview } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  FileText,
  ClipboardList,
  CheckCircle,
  TrendingUp,
  ArrowRight,
  Plus,
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

function getStatusColor(status: string) {
  switch (status) {
    case "active":
      return "default";
    case "completed":
      return "secondary";
    case "analyzed":
      return "default";
    default:
      return "outline";
  }
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getStats()
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-8">
        <div>
          <Skeleton className="mb-2 h-7 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-foreground">
            Dashboard
          </h1>
          <p className="text-xs text-muted-foreground">
            Overview of your recruitment platform
          </p>
        </div>
        <Link href="/admin/templates/new">
          <Button size="sm" className="gap-2">
            <Plus className="h-3.5 w-3.5" />
            New Template
          </Button>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Total Templates
            </CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              {stats?.totalTemplates ?? 0}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Total Interviews
            </CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              {stats?.totalInterviews ?? 0}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Completed
            </CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              {stats?.completedInterviews ?? 0}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Completion Rate
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              {stats?.completionRate ?? 0}%
            </div>
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* Recent Interviews */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              Recent Interviews
            </h2>
            <p className="text-xs text-muted-foreground">
              Latest interview sessions
            </p>
          </div>
          <Link href="/admin/interviews">
            <Button variant="ghost" size="sm" className="gap-1 text-xs">
              View all
              <ArrowRight className="h-3 w-3" />
            </Button>
          </Link>
        </div>

        {stats?.recentInterviews && stats.recentInterviews.length > 0 ? (
          <Card className="shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Candidate</TableHead>
                  <TableHead className="text-xs">Template</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.recentInterviews.map((interview: Interview) => (
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
                      <Badge
                        variant={getStatusColor(interview.status)}
                        className="text-[10px]"
                      >
                        {interview.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(interview.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        ) : (
          <Card className="shadow-sm">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <ClipboardList className="mb-3 h-8 w-8 text-muted-foreground/50" />
              <p className="text-xs text-muted-foreground">
                No interviews yet. Create a template to get started.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
