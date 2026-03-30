"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, type JobTemplate } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight } from "lucide-react";

export default function RecruiterPortalPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<JobTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .getTemplates()
      .then(setTemplates)
      .catch((fetchError) =>
        setError(
          fetchError instanceof Error
            ? fetchError.message
            : "Failed to load templates",
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-foreground">
          Available Interviews
        </h1>
        <p className="text-xs text-muted-foreground">
          Start an interview from one of the templates assigned to you.
        </p>
      </div>

      {loading && (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-40 rounded-lg" />
          ))}
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      {!loading && !error && templates.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No interview templates available yet.
        </p>
      )}

      {!loading && templates.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {templates.map((template) => (
            <Card
              key={template._id}
              className="cursor-pointer transition-colors hover:border-primary"
              onClick={() =>
                router.push(`/interview/${template._id}?source=user`)
              }
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{template.title}</CardTitle>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="mb-3 text-sm text-muted-foreground line-clamp-2">
                  {template.description}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {template.config.difficulty}
                  </Badge>
                  {template.config.interviewFlow?.length > 0 && (
                    <Badge variant="outline" className="text-xs">
                      {template.config.interviewFlow.length} phases
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
