"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api, type TranscriptEntry, type Assessment } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { AssessmentView } from "@/components/assessment-view";

export default function AdminAssessmentPage() {
  const params = useParams();
  const router = useRouter();
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!params.id) return;

    Promise.all([
      api.getAssessment(params.id as string),
      api.getInterview(params.id as string),
    ])
      .then(([assessmentData, interviewData]) => {
        setAssessment(assessmentData);
        setTranscript(interviewData.transcript);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-64 rounded-lg" />
        <Skeleton className="h-48 rounded-lg" />
      </div>
    );
  }

  if (!assessment) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <p className="text-xs text-muted-foreground">Assessment not found</p>
      </div>
    );
  }

  return (
    <AssessmentView
      assessment={assessment}
      transcript={transcript}
      onBack={() => router.back()}
    />
  );
}
