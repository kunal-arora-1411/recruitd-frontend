"use client";

import Link from "next/link";
import type { ElementType } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { TranscriptEntry, Assessment } from "@/lib/api";
import {
  ArrowLeft,
  MessageSquare,
  Briefcase,
  Lightbulb,
  CheckCircle,
  AlertCircle,
  User,
  Bot,
  UserCheck,
} from "lucide-react";

function ScoreBar({
  label,
  score,
  summary,
  icon: Icon,
}: {
  label: string;
  score: number;
  summary?: string;
  icon: ElementType;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Icon className="h-3 w-3 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
        <span className="text-xs font-semibold">{score}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${score}%` }}
        />
      </div>
      {summary && (
        <p className="text-[10px] text-muted-foreground/80 mt-1 leading-relaxed">
          {summary}
        </p>
      )}
    </div>
  );
}

interface AssessmentViewProps {
  assessment: Assessment;
  transcript?: TranscriptEntry[];
  title?: string;
  subtitle?: string;
  backHref?: string;
  onBack?: () => void;
}

export function AssessmentView({
  assessment,
  transcript = [],
  title = "Candidate Assessment",
  subtitle = "AI-generated performance analysis",
  backHref,
  onBack,
}: AssessmentViewProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        {backHref ? (
          <Link href={backHref}>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="h-7 w-7 p-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-foreground">
            {title}
          </h1>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="shadow-sm lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-sm">Overall Score</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center py-4">
            <div className="relative mb-4 flex h-24 w-24 items-center justify-center rounded-full border-4 border-primary/20">
              <span className="text-3xl font-bold text-primary">
                {assessment.scores.overall}
              </span>
            </div>
            <Badge
              variant={
                assessment.scores.overall >= 80
                  ? "default"
                  : assessment.scores.overall >= 65
                    ? "secondary"
                    : "outline"
              }
              className="text-[10px]"
            >
              {assessment.scores.overall >= 80
                ? "Strong"
                : assessment.scores.overall >= 65
                  ? "Moderate"
                  : "Developing"}
            </Badge>
          </CardContent>
        </Card>

        <Card className="shadow-sm lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm">Score Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ScoreBar
              label="Communication"
              score={assessment.scores.communication ?? 0}
              summary={assessment.scoreExplanations?.communication}
              icon={MessageSquare}
            />
            <ScoreBar
              label="Domain Knowledge"
              score={assessment.scores.domainKnowledge ?? 0}
              summary={assessment.scoreExplanations?.domainKnowledge}
              icon={Briefcase}
            />
            <ScoreBar
              label="Problem Solving"
              score={assessment.scores.problemSolving ?? 0}
              summary={assessment.scoreExplanations?.problemSolving}
              icon={Lightbulb}
            />
            <ScoreBar
              label="Professional Behaviour"
              score={assessment.scores.professionalBehaviour ?? 0}
              summary={assessment.scoreExplanations?.professionalBehaviour}
              icon={UserCheck}
            />
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-sm">Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {assessment.summary}
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-6 sm:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <CheckCircle className="h-4 w-4 text-secondary" />
              Strengths
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {assessment.strengths.map((strength, index) => (
                <li
                  key={index}
                  className="flex items-start gap-2 text-xs text-muted-foreground"
                >
                  <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-secondary" />
                  {strength}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <AlertCircle className="h-4 w-4 text-chart-2" />
              Areas for Improvement
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {assessment.improvements.map((improvement, index) => (
                <li
                  key={index}
                  className="flex items-start gap-2 text-xs text-muted-foreground"
                >
                  <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-chart-2" />
                  {improvement}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {transcript && transcript.length > 0 && (
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <MessageSquare className="h-4 w-4 text-primary" />
              Interview Transcript
              <Badge variant="outline" className="ml-auto text-[10px]">
                {transcript.length} entries
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-[500px]">
              <div className="space-y-3">
                {transcript.map((entry, index) => (
                  <div
                    key={entry._id || index}
                    className={`flex gap-3 ${
                      entry.speaker === "ai" ? "" : "flex-row-reverse"
                    }`}
                  >
                    <div
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                        entry.speaker === "ai"
                          ? "bg-primary/10 text-primary"
                          : "bg-secondary/10 text-secondary"
                      }`}
                    >
                      {entry.speaker === "ai" ? (
                        <Bot className="h-3 w-3" />
                      ) : (
                        <User className="h-3 w-3" />
                      )}
                    </div>
                    <div
                      className={`max-w-[80%] rounded-lg px-3 py-2 ${
                        entry.speaker === "ai" ? "bg-muted" : "bg-primary/10"
                      }`}
                    >
                      <p className="text-xs leading-relaxed whitespace-pre-wrap">
                        {entry.content}
                      </p>
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        {new Date(entry.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
