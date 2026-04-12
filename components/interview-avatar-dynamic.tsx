/**
 * SSR-safe re-export of InterviewAvatar.
 *
 * next/dynamic with ssr:false ensures THREE is never imported during server-side
 * rendering. This wrapper file (rather than inlining dynamic() inside
 * stream-interview.tsx) prevents Next.js static analysis from pulling Three.js
 * into the server bundle during build.
 */

import dynamic from "next/dynamic";
import type { VoiceStatus } from "@/lib/types";
import { Loader2 } from "lucide-react";

const InterviewAvatarInner = dynamic(
  () => import("./interview-avatar").then((m) => m.InterviewAvatar),
  {
    ssr: false,
    loading: () => (
      <div className="flex w-full h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    ),
  },
);

interface InterviewAvatarProps {
  voiceStatus:  VoiceStatus;
  analyserNode: AnalyserNode | null;
  className?:   string;
}

export function InterviewAvatar(props: InterviewAvatarProps) {
  return <InterviewAvatarInner {...props} />;
}
