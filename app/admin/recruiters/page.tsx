"use client";

import { useEffect, useState } from "react";
import { api, type Recruiter } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Plus, ShieldCheck, Trash2, Users, Info } from "lucide-react";

type RecruiterFormState = {
  name: string;
  email: string;
  password: string;
  isActive: boolean;
  hasFullTemplateAccess: boolean;
  minutesAllocated: string;
  minutesIncrement: string;
};

const emptyForm: RecruiterFormState = {
  name: "",
  email: "",
  password: "",
  isActive: true,
  hasFullTemplateAccess: false,
  minutesAllocated: "0",
  minutesIncrement: "",
};

function formatDate(dateStr: string | null) {
  if (!dateStr) return "Never";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMinutes(minutes: number) {
  return `${Math.max(0, minutes || 0)} min`;
}

export default function AdminRecruitersPage() {
  const [recruiters, setRecruiters] = useState<Recruiter[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRecruiter, setEditingRecruiter] = useState<Recruiter | null>(null);
  const [form, setForm] = useState<RecruiterFormState>(emptyForm);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteRecruiter, setDeleteRecruiter] = useState<Recruiter | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [actionRecruiterId, setActionRecruiterId] = useState<string | null>(null);

  const fetchRecruiters = async () => {
    setLoading(true);
    setPageError("");
    try {
      const result = await api.getRecruiters();
      setRecruiters(result);
    } catch (error) {
      setPageError(
        error instanceof Error ? error.message : "Failed to load recruiters",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecruiters();
  }, []);

  const openCreateDialog = () => {
    setEditingRecruiter(null);
    setForm(emptyForm);
    setFormError("");
    setDialogOpen(true);
  };

  const openEditDialog = (recruiter: Recruiter) => {
    setEditingRecruiter(recruiter);
    setForm({
      name: recruiter.name || "",
      email: recruiter.email,
      password: "",
      isActive: recruiter.isActive,
      hasFullTemplateAccess: recruiter.hasFullTemplateAccess,
      minutesAllocated: String(recruiter.minutesAllocated ?? 0),
      minutesIncrement: "",
    });
    setFormError("");
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setFormError("");

    try {
      if (editingRecruiter) {
        const updated = await api.updateRecruiter(editingRecruiter._id, {
          name: form.name.trim(),
          ...(form.password.trim() ? { password: form.password } : {}),
          isActive: form.isActive,
          hasFullTemplateAccess: form.hasFullTemplateAccess,
          ...(form.minutesIncrement.trim()
            ? { minutesIncrement: Number(form.minutesIncrement) }
            : {}),
        });
        setRecruiters((prev) =>
          prev.map((r) => (r._id === updated._id ? updated : r)),
        );
      } else {
        const created = await api.createRecruiter({
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
          isActive: form.isActive,
          hasFullTemplateAccess: form.hasFullTemplateAccess,
          minutesAllocated: Number(form.minutesAllocated || 0),
        });
        setRecruiters((prev) => [created, ...prev]);
      }

      setDialogOpen(false);
      setEditingRecruiter(null);
      setForm(emptyForm);
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Failed to save recruiter",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (recruiter: Recruiter) => {
    setActionRecruiterId(recruiter._id);
    setPageError("");

    try {
      const updated = await api.updateRecruiter(recruiter._id, {
        isActive: !recruiter.isActive,
      });
      setRecruiters((prev) =>
        prev.map((item) => (item._id === updated._id ? updated : item)),
      );
    } catch (error) {
      setPageError(
        error instanceof Error ? error.message : "Failed to update recruiter status",
      );
    } finally {
      setActionRecruiterId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteRecruiter) return;

    setDeleting(true);
    setPageError("");

    try {
      await api.deleteRecruiter(deleteRecruiter._id);
      setRecruiters((prev) => prev.filter((r) => r._id !== deleteRecruiter._id));
      setDeleteRecruiter(null);
    } catch (error) {
      setPageError(
        error instanceof Error ? error.message : "Failed to delete recruiter",
      );
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-9 w-32" />
        </div>
        <Skeleton className="h-32 rounded-lg" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-foreground">
            Recruiters
          </h1>
          <p className="text-xs text-muted-foreground">
            Create recruiter accounts here. No public signup is enabled.
          </p>
        </div>
        <Button size="sm" className="gap-2" onClick={openCreateDialog}>
          <Plus className="h-3.5 w-3.5" />
          New Recruiter
        </Button>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm">Portal Access</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 text-xs text-muted-foreground">
          <p>Only admin-created recruiters can log in to the recruiter portal.</p>
          <p>
            Template-specific permissions are managed from each template page.
          </p>
        </CardContent>
      </Card>

      {pageError && <p className="text-sm text-destructive">{pageError}</p>}

      <TooltipProvider delayDuration={200}>
        {recruiters.length > 0 ? (
          <Card className="overflow-hidden shadow-sm">
            <Table className="w-full">
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Name</TableHead>
                  <TableHead className="text-xs">Email</TableHead>
                  <TableHead className="text-xs">Access</TableHead>
                  <TableHead className="text-xs">Minutes</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-right text-xs">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recruiters.map((recruiter) => (
                  <TableRow key={recruiter._id}>
                    <TableCell className="text-xs font-medium">
                      {recruiter.name || "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {recruiter.email}
                    </TableCell>
                    <TableCell>
                      {recruiter.hasFullTemplateAccess ? (
                        <Badge variant="default" className="text-[10px]">
                          All Templates
                        </Badge>
                      ) : recruiter.authorizedTemplateCount > 0 ? (
                        <Badge variant="outline" className="text-[10px]">
                          {recruiter.authorizedTemplateCount} templates
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px]">
                          No access yet
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-0.5">
                        <p className="text-xs font-medium">
                          {formatMinutes(recruiter.minutesRemaining)}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          Used {formatMinutes(recruiter.minutesUsed)} of{" "}
                          {formatMinutes(recruiter.minutesAllocated)}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={recruiter.isActive ? "default" : "outline"}
                        className="text-[10px]"
                      >
                        {recruiter.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-2">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground"
                            >
                              <Info className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent className="text-xs">
                            <div className="flex flex-col gap-1">
                              <div>
                                <span className="font-medium">Created:</span>{" "}
                                {formatDate(recruiter.createdAt)}
                              </div>
                              <div>
                                <span className="font-medium">Last Login:</span>{" "}
                                {formatDate(recruiter.lastLoginAt)}
                              </div>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs"
                          onClick={() => openEditDialog(recruiter)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs"
                          disabled={actionRecruiterId === recruiter._id}
                          onClick={() => handleToggleActive(recruiter)}
                        >
                          {actionRecruiterId === recruiter._id
                            ? "Saving..."
                            : recruiter.isActive
                              ? "Deactivate"
                              : "Activate"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1 text-xs text-destructive"
                          onClick={() => setDeleteRecruiter(recruiter)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        ) : (
          <Card className="shadow-sm">
            <CardContent className="flex flex-col items-center justify-center gap-3 py-16">
              <Users className="h-8 w-8 text-muted-foreground/50" />
              <p className="text-xs text-muted-foreground">
                No recruiter accounts created yet.
              </p>
              <Button size="sm" className="gap-2" onClick={openCreateDialog}>
                <Plus className="h-3.5 w-3.5" />
                Create First Recruiter
              </Button>
            </CardContent>
          </Card>
        )}
      </TooltipProvider>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setEditingRecruiter(null);
            setFormError("");
            setForm(emptyForm);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-sm">
              {editingRecruiter ? "Edit Recruiter" : "Create Recruiter"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {editingRecruiter
                ? "Update portal access, recruiter status, or reset the password."
                : "Create a recruiter who can log in to the recruiter portal."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <p className="text-[10px] font-medium text-muted-foreground">
                Name
              </p>
              <Input
                value={form.name}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="Optional display name"
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <p className="text-[10px] font-medium text-muted-foreground">
                Email
              </p>
              <Input
                type="email"
                value={form.email}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, email: e.target.value }))
                }
                placeholder="recruiter@company.com"
                className="text-xs"
                disabled={!!editingRecruiter}
              />
            </div>

            <div className="space-y-1.5">
              <p className="text-[10px] font-medium text-muted-foreground">
                Password
              </p>
              <Input
                type="password"
                value={form.password}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, password: e.target.value }))
                }
                placeholder={
                  editingRecruiter
                    ? "Leave blank to keep current password"
                    : "Minimum 8 characters"
                }
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <p className="text-[10px] font-medium text-muted-foreground">
                {editingRecruiter ? "Add Minutes" : "Initial Minutes"}
              </p>
              <Input
                type="number"
                min="0"
                step="1"
                value={
                  editingRecruiter
                    ? form.minutesIncrement
                    : form.minutesAllocated
                }
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    [editingRecruiter ? "minutesIncrement" : "minutesAllocated"]:
                      e.target.value,
                  }))
                }
                placeholder={editingRecruiter ? "Add more minutes" : "0"}
                className="text-xs"
              />
              <p className="text-[10px] text-muted-foreground">
                {editingRecruiter
                  ? `Current remaining balance: ${formatMinutes(editingRecruiter.minutesRemaining)}`
                  : "1 minute = 1 minute of interview time."}
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() =>
                  setForm((prev) => ({ ...prev, isActive: !prev.isActive }))
                }
                className={`rounded-md border px-3 py-2 text-left text-[10px] transition-colors ${
                  form.isActive
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-background text-muted-foreground"
                }`}
              >
                <p className="font-medium">Portal Status</p>
                <p>
                  {form.isActive
                    ? "Recruiter can log in"
                    : "Recruiter login blocked"}
                </p>
              </button>

              <button
                type="button"
                onClick={() =>
                  setForm((prev) => ({
                    ...prev,
                    hasFullTemplateAccess: !prev.hasFullTemplateAccess,
                  }))
                }
                className={`rounded-md border px-3 py-2 text-left text-[10px] transition-colors ${
                  form.hasFullTemplateAccess
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-background text-muted-foreground"
                }`}
              >
                <p className="font-medium">Template Access</p>
                <p>
                  {form.hasFullTemplateAccess
                    ? "Can access all templates"
                    : "Use template-specific authorization"}
                </p>
              </button>
            </div>

            {formError && (
              <p className="text-sm text-destructive">{formError}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() => setDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="text-xs"
              disabled={
                saving ||
                !form.email.trim() ||
                (!editingRecruiter && form.password.length < 8) ||
                Number.isNaN(
                  Number(
                    editingRecruiter
                      ? form.minutesIncrement || 0
                      : form.minutesAllocated || 0,
                  ),
                )
              }
              onClick={handleSave}
            >
              {saving
                ? "Saving..."
                : editingRecruiter
                  ? "Save Changes"
                  : "Create Recruiter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!deleteRecruiter}
        onOpenChange={(open) => {
          if (!open) setDeleteRecruiter(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-sm">Delete Recruiter</DialogTitle>
            <DialogDescription className="text-xs">
              This will remove the portal login for {deleteRecruiter?.email}.
              Existing interviews will stay in place.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() => setDeleteRecruiter(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="text-xs"
              disabled={deleting}
              onClick={handleDelete}
            >
              {deleting ? "Deleting..." : "Delete Recruiter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
