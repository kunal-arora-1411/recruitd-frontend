"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, type JobTemplate } from "@/lib/api";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Plus,
  Trash2,
  Eye,
  FileText,
  ExternalLink,
  Loader2,
} from "lucide-react";

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function isTemplatePublic(template: JobTemplate) {
  return template.publicTemplate !== false;
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<JobTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [updatingVisibilityId, setUpdatingVisibilityId] = useState<
    string | null
  >(null);

  const fetchTemplates = () => {
    setLoading(true);
    api
      .getTemplates()
      .then(setTemplates)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await api.deleteTemplate(deleteId);
      setTemplates((prev) => prev.filter((t) => t._id !== deleteId));
      setDeleteId(null);
    } catch (error) {
      console.error(error);
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleVisibility = async (template: JobTemplate) => {
    const isPublic = isTemplatePublic(template);
    setUpdatingVisibilityId(template._id);
    try {
      const updated = await api.setTemplateAvailability(
        template._id,
        !isPublic,
      );
      setTemplates((prev) =>
        prev.map((item) =>
          item._id === updated._id ? { ...item, ...updated } : item,
        ),
      );
    } catch (error) {
      console.error(error);
    } finally {
      setUpdatingVisibilityId(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-9 w-32" />
        </div>
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
            Templates
          </h1>
          <p className="text-xs text-muted-foreground">
            Manage your job interview templates
          </p>
        </div>
        <Link href="/admin/templates/new">
          <Button size="sm" className="gap-2">
            <Plus className="h-3.5 w-3.5" />
            New Template
          </Button>
        </Link>
      </div>

      {/* Table */}
      {templates.length > 0 ? (
        <Card className="shadow-sm overflow-hidden">
          <Table className="w-full">
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Title</TableHead>
                <TableHead className="text-xs">Difficulty</TableHead>
                <TableHead className="text-xs">Access</TableHead>
                <TableHead className="text-xs">Interviews</TableHead>
                <TableHead className="text-xs">Created</TableHead>
                <TableHead className="text-xs text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((template) => {
                const isPublic = isTemplatePublic(template);
                return (
                  <TableRow key={template._id}>
                    <TableCell className="max-w-0">
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-medium truncate">
                          {template.title}
                        </span>
                        <span className="text-[10px] text-muted-foreground truncate">
                          {template.description}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">
                        {template.config?.difficulty || "medium"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <button
                        type="button"
                        onClick={() => handleToggleVisibility(template)}
                        disabled={updatingVisibilityId === template._id}
                        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-medium transition-colors ${
                          isPublic
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-background text-muted-foreground"
                        } disabled:opacity-60`}
                      >
                        {updatingVisibilityId === template._id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : null}
                        {isPublic ? "Public" : "Restricted"}
                      </button>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {template.interviewsCount ?? 0}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(template.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Link
                          href={`/interview/${template._id}`}
                          target="_blank"
                        >
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            title="Test Interview"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
                        <Link href={`/admin/templates/${template._id}`}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-destructive"
                          onClick={() => setDeleteId(template._id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <Card className="shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FileText className="mb-3 h-8 w-8 text-muted-foreground/50" />
            <p className="mb-4 text-xs text-muted-foreground">
              No templates created yet
            </p>
            <Link href="/admin/templates/new">
              <Button size="sm" className="gap-2">
                <Plus className="h-3.5 w-3.5" />
                Create First Template
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Delete Dialog */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-sm">Delete Template</DialogTitle>
            <DialogDescription className="text-xs">
              Are you sure you want to delete this template? This action cannot
              be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDeleteId(null)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={deleting}
              className="text-xs"
            >
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
