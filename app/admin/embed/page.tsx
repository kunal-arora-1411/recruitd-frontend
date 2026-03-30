"use client";

import { useEffect, useState } from "react";
import { api, type JobTemplate } from "@/lib/api";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Copy, Check, Code } from "lucide-react";

export default function EmbedPage() {
  const [templates, setTemplates] = useState<JobTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    api
      .getTemplates()
      .then(setTemplates)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const getEmbedCode = (templateId: string) => {
    const origin =
      typeof window !== "undefined"
        ? window.location.origin
        : "https://yourdomain.com";
    return `<iframe\n  src="${origin}/interview/${templateId}"\n  width="100%"\n  height="700"\n  frameborder="0"\n  allow="microphone"\n></iframe>`;
  };

  const handleCopy = (templateId: string) => {
    navigator.clipboard.writeText(getEmbedCode(templateId));
    setCopiedId(templateId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-48 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-foreground">
          Embed Manager
        </h1>
        <p className="text-xs text-muted-foreground">
          Generate embeddable iframe snippets for your interview templates
        </p>
      </div>

      {templates.length > 0 ? (
        <div className="space-y-4">
          {templates.map((template) => (
            <Card key={template._id} className="shadow-sm">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm">{template.title}</CardTitle>
                    <CardDescription className="text-[10px]">
                      {template.description}
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopy(template._id)}
                    className="gap-1.5 text-[10px]"
                  >
                    {copiedId === template._id ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                    {copiedId === template._id ? "Copied!" : "Copy Code"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <pre className="overflow-auto rounded-md border border-border bg-muted/50 p-3 font-mono text-[10px] text-muted-foreground">
                  {getEmbedCode(template._id)}
                </pre>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Code className="mb-3 h-8 w-8 text-muted-foreground/50" />
            <p className="text-xs text-muted-foreground">
              Create a template first to generate embed codes
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
