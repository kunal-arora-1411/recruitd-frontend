"use client";

import { cn } from "@/lib/utils";
import type { VoiceStatus } from "@/lib/types";
import { useInterviewAvatar } from "@/hooks/use-interview-avatar";
import { Loader2 } from "lucide-react";

interface InterviewAvatarProps {
  voiceStatus:  VoiceStatus;
  analyserNode: AnalyserNode | null;
  className?:   string;
}

export function InterviewAvatar({
  voiceStatus,
  analyserNode,
  className,
}: InterviewAvatarProps) {
  const { canvasRef, isLoading, loadError } = useInterviewAvatar({
    voiceStatus,
    analyserNode,
  });

  return (
    <div className={cn("relative w-full h-full", className)}>
      {/*
        Canvas is always rendered — never conditionally mounted.
        The hook's useEffect depends on canvasRef.current being stable;
        if the canvas disappeared during the loading state the ref would
        go null and the Three.js scene would never initialise.
      */}
      <canvas
        ref={canvasRef as React.RefObject<HTMLCanvasElement>}
        className="w-full h-full block"
        style={{ touchAction: "none" }}
      />

      {isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-muted/10 rounded-xl">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <p className="text-[10px] text-muted-foreground">Loading avatar...</p>
        </div>
      )}

      {loadError && !isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/10 rounded-xl">
          <p className="text-[10px] text-muted-foreground text-center px-4">
            Avatar unavailable
          </p>
        </div>
      )}
    </div>
  );
}
