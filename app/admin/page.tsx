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
  Activity,
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
      <div className="space-y-8 animate-in fade-in duration-500">
        <div className="flex flex-col gap-1">
          <Skeleton className="h-8 w-48 rounded-lg" />
          <Skeleton className="h-4 w-72 rounded-lg" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
        <div className="space-y-4">
          <Skeleton className="h-6 w-32 rounded-lg" />
          <Skeleton className="h-80 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
            Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time insights into your recruitment pipeline.
          </p>
        </div>
        <Link href="/admin/templates/new">
          <Button size="lg" className="gap-2 rounded-xl primary-gradient shadow-lg shadow-primary/20">
            <Plus className="h-4 w-4" />
            New Job Template
          </Button>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total Templates", value: stats?.totalTemplates ?? 0, icon: FileText, color: "text-blue-500" },
          { label: "Total Interviews", value: stats?.totalInterviews ?? 0, icon: ClipboardList, color: "text-indigo-500" },
          { label: "Completed Sessions", value: stats?.completedInterviews ?? 0, icon: CheckCircle, color: "text-emerald-500" },
          { label: "Success Rate", value: `${stats?.completionRate ?? 0}%`, icon: TrendingUp, color: "text-amber-500" },
        ].map((item, i) => (
          <Card key={i} className="glass-card glass-card-hover border-none rounded-2xl overflow-hidden group">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                {item.label}
              </CardTitle>
              <div className={`rounded-lg bg-background/50 p-2 shadow-sm group-hover:scale-110 transition-transform duration-300`}>
                <item.icon className={`h-4 w-4 ${item.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold tracking-tight">
                {item.value}
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-[10px] font-medium text-emerald-500">
                <Activity className="h-3 w-3" />
                <span>Active project</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Separator className="opacity-50" />

      {/* Recent Interviews */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-foreground">
              Recent Sessions
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Live updates from active candidate assessments.
            </p>
          </div>
          <Link href="/admin/interviews">
            <Button variant="ghost" size="sm" className="gap-2 rounded-lg text-xs font-semibold hover:bg-muted/50 transition-colors">
              View all history
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>

        {stats?.recentInterviews && stats.recentInterviews.length > 0 ? (
          <Card className="glass-card border-none rounded-3xl overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow className="border-border/50">
                    <TableHead className="text-xs font-bold uppercase tracking-wider h-12">Candidate</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider h-12">Template</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider h-12">Status</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider h-12">Date & Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.recentInterviews.map((interview: Interview) => (
                    <TableRow key={interview._id} className="border-border/30 hover:bg-muted/20 transition-colors group">
                      <TableCell className="py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-[10px]">
                            {interview.candidateName?.[0] || "A"}
                          </div>
                          <span className="text-sm font-semibold">
                            {interview.candidateName || "Anonymous Candidate"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground py-4">
                        {typeof interview.templateId === "object"
                          ? interview.templateId.title
                          : "Legacy Template"}
                      </TableCell>
                      <TableCell className="py-4">
                        <Badge
                          variant={getStatusColor(interview.status)}
                          className="rounded-lg px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-tight"
                        >
                          {interview.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground py-4 font-medium">
                        {formatDate(interview.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        ) : (
          <Card className="glass-card border-none rounded-3xl p-16 flex flex-col items-center justify-center text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/50 mb-4">
              <ClipboardList className="h-8 w-8 text-muted-foreground/40" />
            </div>
            <h3 className="text-lg font-bold mb-1">Queue is empty</h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              No interview sessions have been recorded yet. Launch a template to start assessment.
            </p>
            <Link href="/admin/templates/new" className="mt-6">
              <Button variant="outline" className="rounded-xl font-semibold">
                Get Started
              </Button>
            </Link>
          </Card>
        )}
      </div>
    </div>
  );
}
