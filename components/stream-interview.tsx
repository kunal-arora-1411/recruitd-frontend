"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { getStreamWSUrl, type JobTemplate } from "@/lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3100";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Mic,
  MicOff,
  PhoneOff,
  Volume2,
  Loader2,
  AudioLines,
  BriefcaseBusiness,
} from "lucide-react";

type VoiceStatus =
  | "connecting"
  | "ready"
  | "listening"
  | "ai_speaking"
  | "ai_thinking"
  | "ending"
  | "ended"
  | "error";

interface VoiceMessage {
  id: string;
  speaker: "ai" | "user";
  text: string;
}

interface StreamInterviewProps {
  interviewId: string;
  template: JobTemplate;
  candidateName: string;
  onEnd: (assessmentId?: string) => void;
}

export function StreamInterview({
  interviewId,
  template,
  candidateName,
  onEnd,
}: StreamInterviewProps) {
  const [status, setStatus] = useState<VoiceStatus>("connecting");
  const [isMuted, setIsMuted] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [messages, setMessages] = useState<VoiceMessage[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [audioLevel, setAudioLevel] = useState(0);
  const [showEndConfirmDialog, setShowEndConfirmDialog] = useState(false);
  const [micMutedWarning, setMicMutedWarning] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | ScriptProcessorNode | null>(
    null,
  );
  const playbackCtxRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const nextPlaybackTimeRef = useRef(0);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const isMutedRef = useRef(false);
  const statusRef = useRef<VoiceStatus>("connecting");
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const endTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioLevelFrameRef = useRef<number>(0);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const suppressPlaybackRef = useRef(false);
  const micChunkCountRef = useRef(0);
  // Holds server-sent error message so onclose can show it even before React re-renders
  const serverErrorRef = useRef<string | null>(null);

  // Keep refs in sync
  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  // Auto-scroll messages
  useEffect(() => {
    if (messagesScrollRef.current) {
      messagesScrollRef.current.scrollTop =
        messagesScrollRef.current.scrollHeight;
    }
  }, [messages]);

  // ─── WebSocket Connection ──────────────────────────────────────────

  useEffect(() => {
    // `active` guards against React Strict Mode double-invoking effects in dev:
    // React mounts → cleanup (sets active=false, closes WS) → mounts again.
    // Without this flag, closing a CONNECTING socket fires onerror spuriously.
    let active = true;

    const wsUrl = getStreamWSUrl(interviewId);
    const ws = new WebSocket(wsUrl);
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;

    ws.onopen = () => {
      if (!active) return;
      console.log("[Stream] WebSocket connected");
      // Send periodic pings to keep the WebSocket connection alive
      pingIntervalRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "ping" }));
        }
      }, 15000);
    };

    ws.onmessage = (event) => {
      if (!active) return;
      if (event.data instanceof ArrayBuffer) {
        handleBinaryMessage(event.data);
      } else {
        try {
          const msg = JSON.parse(event.data);
          handleControlMessage(msg);
        } catch {
          // ignore parse errors
        }
      }
    };

    ws.onerror = () => {
      if (!active) return;
      console.error("[Stream] WebSocket error");
      // Don't set error here — let onclose handle it with better diagnostics.
      // The browser's onerror event doesn't expose the actual reason (security).
    };

    ws.onclose = async () => {
      if (!active) return;
      if (endTimeoutRef.current) clearTimeout(endTimeoutRef.current);

      // If the server already sent us an error message, don't override it
      if (serverErrorRef.current) return;

      if (statusRef.current !== "ended" && statusRef.current !== "error") {
        const wasEnding = statusRef.current === "ending";

        // Connection closed while still "connecting" — diagnose why
        if (!wasEnding && statusRef.current === "connecting") {
          cleanup();
          let diagMsg = "Could not connect to the interview server.";
          try {
            const healthRes = await fetch(`${API_BASE}/`, {
              signal: AbortSignal.timeout(5000),
            });
            if (healthRes.ok) {
              diagMsg =
                "Voice interview failed to start. Ensure the backend has DEEPGRAM_API_KEY and MISTRAL_API_KEY set correctly and that the interview is active.";
            }
          } catch {
            diagMsg =
              "Cannot reach the backend server. Make sure it is running on " +
              API_BASE +
              ".";
          }
          setStatus("error");
          setErrorMsg(diagMsg);
          return;
        }

        cleanup();
        setStatus("ended");
        if (wasEnding) onEnd();
      }
    };

    return () => {
      // Disable all handlers before closing so Strict Mode teardown
      // doesn't trigger spurious onerror/onclose callbacks.
      active = false;
      ws.onopen = null;
      ws.onmessage = null;
      ws.onerror = null;
      ws.onclose = null;
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interviewId]);

  // ─── Gapless Audio Playback (Web Audio Scheduling) ─────────────────

  const ensurePlaybackContext = useCallback(() => {
    if (!playbackCtxRef.current || playbackCtxRef.current.state === "closed") {
      const ctx = new AudioContext({ sampleRate: 16000 });
      playbackCtxRef.current = ctx;
      const gain = ctx.createGain();
      gain.connect(ctx.destination);
      gainNodeRef.current = gain;
      nextPlaybackTimeRef.current = 0;
    }
    // Resume if suspended by browser autoplay policy
    if (playbackCtxRef.current.state === "suspended") {
      playbackCtxRef.current.resume();
    }
    return playbackCtxRef.current;
  }, []);

  const stopPlayback = useCallback((reason: "local" | "server") => {
    const ctx = playbackCtxRef.current;
    suppressPlaybackRef.current = true;

    if (ctx && ctx.state !== "closed" && gainNodeRef.current) {
      gainNodeRef.current.gain.cancelScheduledValues(ctx.currentTime);
      gainNodeRef.current.gain.setValueAtTime(0, ctx.currentTime);
    }

    activeSourcesRef.current.forEach((source) => {
      try {
        source.stop();
      } catch {
        /* already stopped */
      }
    });
    activeSourcesRef.current.clear();
    nextPlaybackTimeRef.current = 0;

    if (ctx && ctx.state !== "closed") {
      if (gainNodeRef.current) {
        try {
          gainNodeRef.current.disconnect();
        } catch {
          /* already disconnected */
        }
      }

      const newGain = ctx.createGain();
      newGain.connect(ctx.destination);
      gainNodeRef.current = newGain;
    }

    console.log(
      reason === "local"
        ? "[Stream] Local barge-in detected — muting playback"
        : "[Stream] Server interruption — stopping playback",
    );
  }, []);

  const handleBinaryMessage = useCallback(
    (data: ArrayBuffer) => {
      const view = new Uint8Array(data);
      if (view.length < 2 || view[0] !== 0x01) return;
      if (suppressPlaybackRef.current) return;

      let pcmData = data.slice(1);
      const ctx = ensurePlaybackContext();

      // Ensure even byte length — Int16Array requires 2 bytes per sample
      if (pcmData.byteLength % 2 !== 0) {
        pcmData = pcmData.slice(0, pcmData.byteLength - 1);
      }
      if (pcmData.byteLength === 0) return;

      // Convert Int16 PCM to Float32 for Web Audio API
      const int16 = new Int16Array(pcmData);
      const float32 = new Float32Array(int16.length);
      for (let i = 0; i < int16.length; i++) {
        float32[i] = int16[i] / 0x7fff;
      }

      const buffer = ctx.createBuffer(1, float32.length, 16000);
      buffer.getChannelData(0).set(float32);

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(gainNodeRef.current!);

      // Schedule for gapless playback — each buffer starts exactly when the
      // previous one ends, eliminating gaps between audio chunks.
      const now = ctx.currentTime;
      const startTime = Math.max(now + 0.005, nextPlaybackTimeRef.current);
      source.start(startTime);
      nextPlaybackTimeRef.current = startTime + buffer.duration;

      console.log(
        `[Stream] Scheduled audio: start=${startTime.toFixed(3)}s, duration=${buffer.duration.toFixed(3)}s, nextSlot=${nextPlaybackTimeRef.current.toFixed(3)}s, now=${now.toFixed(3)}s`,
      );

      // Track active sources for interruption cleanup
      activeSourcesRef.current.add(source);
      source.onended = () => {
        activeSourcesRef.current.delete(source);
      };
    },
    [ensurePlaybackContext],
  );

  // ─── Microphone Capture ────────────────────────────────────────────

  const startMicrophone = useCallback(async () => {
    try {
      const preferScriptProcessor = template.sttProvider === "sarvam";
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      mediaStreamRef.current = stream;

      // ── Microphone track health check ─────────────────────────────
      const track = stream.getAudioTracks()[0];
      console.log(
        `[Stream] Mic track: label="${track?.label}" muted=${track?.muted} enabled=${track?.enabled} readyState=${track?.readyState}`,
      );

      // track.muted is a read-only hardware/OS-level mute (e.g. laptop mic
      // mute key).  When true, getUserMedia succeeds but the track outputs
      // silence.  Warn the user immediately and clear when unmuted.
      if (track?.muted) {
        console.warn(
          "[Stream] Microphone track is hardware-muted — audio will be silent",
        );
        setMicMutedWarning(true);
      }
      track?.addEventListener("unmute", () => {
        console.log("[Stream] Microphone track unmuted");
        setMicMutedWarning(false);
      });
      track?.addEventListener("mute", () => {
        console.warn("[Stream] Microphone track muted");
        setMicMutedWarning(true);
      });

      // Use the device's native sample rate — forcing 16 kHz can produce
      // silence on some Windows/Chrome combinations because the browser
      // can't resample from the hardware input properly.  The AudioWorklet
      // (and ScriptProcessor fallback) downsample to 16 kHz before sending.
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      micChunkCountRef.current = 0;

      console.log(
        `[Stream] Microphone audio context created | state=${audioContext.state} sampleRate=${audioContext.sampleRate}`,
      );

      if (audioContext.state === "suspended") {
        await audioContext.resume();
        console.log(
          `[Stream] Microphone audio context resumed | state=${audioContext.state}`,
        );
      }

      const source = audioContext.createMediaStreamSource(stream);
      const silentMonitor = audioContext.createGain();
      silentMonitor.gain.value = 0;
      silentMonitor.connect(audioContext.destination);

      // Shared handler for incoming PCM + RMS data (used by both AudioWorklet and ScriptProcessor)
      const handleAudioData = (pcmBuffer: ArrayBuffer, rms: number) => {
        micChunkCountRef.current += 1;
        if (micChunkCountRef.current === 1) {
          console.log(
            `[Stream] First microphone chunk captured | bytes=${pcmBuffer.byteLength} rms=${rms.toFixed(4)} state=${audioContext.state}`,
          );
        }

        // Throttle UI updates to ~15fps
        audioLevelFrameRef.current++;
        if (audioLevelFrameRef.current % 3 === 0) {
          setAudioLevel(isMutedRef.current ? 0 : Math.min(1, rms * 5));
        }

        if (isMutedRef.current) return;
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN)
          return;

        // Always send audio — even during AI speech — so the server can
        // detect interruptions and maintain turn-taking awareness.
        //
        // Do NOT locally mute playback based on microphone RMS here.
        // In practice that heuristic was too sensitive and could suppress
        // perfectly valid AI audio because of room noise / echo / laptop mic
        // bleed. The backend already has the authoritative interruption logic.
        wsRef.current.send(new Uint8Array(pcmBuffer.slice(0)));
      };

      // Try AudioWorkletNode first (off-main-thread, non-deprecated)
      let useWorklet = false;
      if (
        !preferScriptProcessor &&
        typeof audioContext.audioWorklet !== "undefined"
      ) {
        try {
          await audioContext.audioWorklet.addModule(
            "/audio-capture-processor.js",
          );
          const workletNode = new AudioWorkletNode(
            audioContext,
            "audio-capture-processor",
          );
          workletNode.port.onmessage = (e: MessageEvent) => {
            const { pcm, rms } = e.data as { pcm: Int16Array; rms: number };
            handleAudioData(pcm.buffer as ArrayBuffer, rms);
          };
          source.connect(workletNode);
          workletNode.connect(silentMonitor);
          workletNodeRef.current = workletNode;
          useWorklet = true;
          console.log("[Stream] Microphone started (AudioWorkletNode)");
        } catch (workletErr) {
          console.warn(
            "[Stream] AudioWorklet failed, falling back to ScriptProcessorNode:",
            workletErr,
          );
        }
      } else if (preferScriptProcessor) {
        console.log(
          "[Stream] Using ScriptProcessorNode for Sarvam STT compatibility",
        );
      }

      // Fallback: ScriptProcessorNode for browsers without AudioWorklet support
      if (!useWorklet) {
        const processor = audioContext.createScriptProcessor(2048, 1, 1);
        const srcRate = audioContext.sampleRate;
        const tgtRate = 16000;
        const ratio = srcRate / tgtRate;

        processor.onaudioprocess = (e) => {
          const inputData = e.inputBuffer.getChannelData(0);

          // Downsample from device rate to 16 kHz via linear interpolation
          const outLen = Math.floor(inputData.length / ratio);
          const resampled = new Float32Array(outLen);
          for (let i = 0; i < outLen; i++) {
            const srcPos = i * ratio;
            const idx = Math.floor(srcPos);
            const frac = srcPos - idx;
            resampled[i] =
              inputData[idx] * (1 - frac) +
              (inputData[idx + 1] || 0) * frac;
          }

          let sumSquares = 0;
          for (let i = 0; i < resampled.length; i++) {
            sumSquares += resampled[i] * resampled[i];
          }
          const rms = Math.sqrt(sumSquares / resampled.length);

          const pcm16 = new Int16Array(resampled.length);
          for (let i = 0; i < resampled.length; i++) {
            const s = Math.max(-1, Math.min(1, resampled[i]));
            pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
          }

          handleAudioData(pcm16.buffer, rms);
        };

        source.connect(processor);
        processor.connect(silentMonitor);
        workletNodeRef.current = processor;
        console.log(
          "[Stream] Microphone started (ScriptProcessorNode fallback)",
        );
      }
    } catch (err) {
      console.error("[Stream] Microphone access denied:", err);
      setStatus("error");
      setErrorMsg(
        "Microphone access is required for voice interviews. Please allow microphone access and try again.",
      );
    }
  }, [template.sttProvider, stopPlayback]);

  // ─── Handle JSON Control Messages from Server ─────────────────────

  const handleControlMessage = useCallback(
    (msg: {
      type: string;
      text?: string;
      isFinal?: boolean;
      assessmentId?: string;
      message?: string;
    }) => {
      switch (msg.type) {
        case "ready":
          console.log("[Stream] Server: ready");
          suppressPlaybackRef.current = false;
          statusRef.current = "ready";
          setStatus("ready");
          startMicrophone();
          break;

        case "transcript":
          console.log(
            `[Stream] Server: transcript (final=${msg.isFinal}): "${msg.text}"`,
          );

          // Always show final transcripts — the user already spoke these
          // words, so they should appear even if the user muted during the
          // Whisper processing delay.  Only suppress interim (partial)
          // transcripts when muted to avoid showing stale STT fragments.
          if (msg.isFinal && msg.text) {
            setLiveTranscript("");
            setMessages((prev) => [
              ...prev,
              {
                id: `user-${Date.now()}`,
                speaker: "user",
                text: msg.text!,
              },
            ]);
          } else if (msg.text && !isMutedRef.current) {
            setLiveTranscript(msg.text);
          }
          if (
            statusRef.current !== "ai_speaking" &&
            statusRef.current !== "ai_thinking"
          ) {
            setStatus("listening");
          }
          break;

        case "ai_thinking":
          console.log("[Stream] Server: ai_thinking");
          statusRef.current = "ai_thinking";
          setStatus("ai_thinking");
          break;

        case "ai_speaking":
          console.log("[Stream] Server: ai_speaking");
          suppressPlaybackRef.current = false;
          statusRef.current = "ai_speaking";
          setStatus("ai_speaking");
          setLiveTranscript("");
          setAudioLevel(0); // Reset mic indicator while AI speaks
          break;

        case "ai_response_text":
          console.log(
            `[Stream] Server: ai_response_text: "${msg.text?.substring(0, 80)}..."`,
          );
          if (msg.text) {
            setMessages((prev) => [
              ...prev,
              {
                id: `ai-${Date.now()}`,
                speaker: "ai",
                text: msg.text!,
              },
            ]);
          }
          break;

        case "ai_done": {
          if (
            statusRef.current !== "ai_speaking" &&
            statusRef.current !== "ai_thinking"
          ) {
            break;
          }

          // Delay status transition until all scheduled audio finishes playing
          const ctx = playbackCtxRef.current;
          if (ctx && ctx.state !== "closed") {
            const remaining = nextPlaybackTimeRef.current - ctx.currentTime;
            console.log(
              `[Stream] Server: ai_done | remaining playback: ${remaining.toFixed(3)}s`,
            );
            if (remaining > 0.1) {
              setTimeout(
                () => {
                  if (
                    statusRef.current === "ai_speaking" ||
                    statusRef.current === "ai_thinking"
                  ) {
                    console.log(
                      "[Stream] Playback complete, transitioning to ready",
                    );
                    suppressPlaybackRef.current = false;
                    statusRef.current = "ready";
                    setStatus("ready");
                  }
                },
                remaining * 1000 + 150,
              );
              break;
            }
          } else {
            console.log(
              "[Stream] Server: ai_done | no playback context, going ready",
            );
          }
          suppressPlaybackRef.current = false;
          statusRef.current = "ready";
          setStatus("ready");
          break;
        }

        case "interruption":
          stopPlayback("server");
          statusRef.current = "listening";
          setStatus("listening");
          console.log("[Stream] Server: interruption — stopping all audio");
          // Stop all scheduled audio instantly
          if (
            playbackCtxRef.current &&
            playbackCtxRef.current.state !== "closed"
          ) {
            // Mute immediately
            if (gainNodeRef.current) {
              gainNodeRef.current.gain.setValueAtTime(
                0,
                playbackCtxRef.current.currentTime,
              );
            }
            // Stop all scheduled sources
            activeSourcesRef.current.forEach((s) => {
              try {
                s.stop();
              } catch {
                /* already stopped */
              }
            });
            activeSourcesRef.current.clear();
            // Recreate gain node for next response
            const newGain = playbackCtxRef.current.createGain();
            newGain.connect(playbackCtxRef.current.destination);
            gainNodeRef.current = newGain;
          }
          nextPlaybackTimeRef.current = 0;
          break;

        case "interview_ended":
          console.log(
            `[Stream] Server: interview_ended (assessmentId=${msg.assessmentId})`,
          );
          if (endTimeoutRef.current) clearTimeout(endTimeoutRef.current);
          cleanup();
          setStatus("ended");
          onEnd(msg.assessmentId);
          break;

        case "error": {
          const errMsg = msg.message || "An error occurred";
          console.error(`[Stream] Server: error: ${errMsg}`);
          serverErrorRef.current = errMsg; // Set synchronously before React re-renders
          statusRef.current = "error"; // Also update ref synchronously
          setStatus("error");
          setErrorMsg(errMsg);
          break;
        }
      }
    },
    [onEnd, startMicrophone, stopPlayback],
  );

  // ─── Actions ───────────────────────────────────────────────────────

  const toggleMute = () => {
    setIsMuted((prev) => {
      const newMuted = !prev;
      if (newMuted) {
        // Switching to muted: reset to ready, clear live transcript
        setLiveTranscript("");
        setAudioLevel(0);
        if (
          statusRef.current === "listening" ||
          statusRef.current === "ready"
        ) {
          setStatus("ready");
        }
      } else if (
        audioContextRef.current &&
        audioContextRef.current.state === "suspended"
      ) {
        audioContextRef.current.resume().catch((error) => {
          console.warn(
            "[Stream] Failed to resume microphone audio context:",
            error,
          );
        });
      }
      return newMuted;
    });
  };

  const requestEndInterview = () => {
    if (statusRef.current === "ending" || statusRef.current === "ended") return;
    setShowEndConfirmDialog(true);
  };

  const endInterview = () => {
    setShowEndConfirmDialog(false);
    if (statusRef.current === "ending" || statusRef.current === "ended") return;

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      setStatus("ending");
      wsRef.current.send(JSON.stringify({ type: "end_interview" }));

      // Fallback: if server doesn't respond within 10s, end locally
      endTimeoutRef.current = setTimeout(() => {
        cleanup();
        setStatus("ended");
        onEnd();
      }, 10000);
    } else {
      // WS not connected — end locally without an assessment
      cleanup();
      setStatus("ended");
      onEnd();
    }
  };

  // ─── Cleanup ───────────────────────────────────────────────────────

  const cleanup = () => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (workletNodeRef.current) {
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    // Stop all active audio sources and close playback context
    activeSourcesRef.current.forEach((s) => {
      try {
        s.stop();
      } catch {
        /* already stopped */
      }
    });
    activeSourcesRef.current.clear();
    nextPlaybackTimeRef.current = 0;
    gainNodeRef.current = null;
    if (playbackCtxRef.current && playbackCtxRef.current.state !== "closed") {
      playbackCtxRef.current.close();
      playbackCtxRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  };

  // ─── Status Display Helpers ────────────────────────────────────────

  const getStatusText = () => {
    switch (status) {
      case "connecting":
        return "Connecting to interview...";
      case "ready":
        return "Ready — start speaking";
      case "listening":
        return "Listening...";
      case "ai_speaking":
        return "Interviewer is speaking...";
      case "ai_thinking":
        return "Thinking...";
      case "ending":
        return "Ending interview & generating assessment...";
      case "ended":
        return "Interview ended";
      case "error":
        return "Error";
      default:
        return "";
    }
  };

  const getOrbClasses = () => {
    const base =
      "relative flex h-28 w-28 items-center justify-center rounded-full transition-all duration-500";
    switch (status) {
      case "ai_speaking":
        return `${base} bg-primary/15 shadow-[0_0_40px_rgba(29,78,216,0.3)] scale-110`;
      case "listening":
        return `${base} bg-green-500/10 shadow-[0_0_30px_rgba(34,197,94,0.2)] scale-105`;
      case "ai_thinking":
        return `${base} bg-yellow-500/10 shadow-[0_0_20px_rgba(234,179,8,0.15)]`;
      case "ending":
        return `${base} bg-destructive/10`;
      case "connecting":
        return `${base} bg-muted`;
      case "error":
        return `${base} bg-destructive/10`;
      default:
        return `${base} bg-muted/50`;
    }
  };

  // ─── Error State ───────────────────────────────────────────────────

  if (status === "error") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
          <MicOff className="h-8 w-8 text-destructive" />
        </div>
        <div className="max-w-sm text-center">
          <p className="text-sm font-medium text-foreground">
            Voice Interview Error
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{errorMsg}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.location.reload()}
          className="text-xs"
        >
          Try Again
        </Button>
      </div>
    );
  }

  // ─── Ended State ───────────────────────────────────────────────────

  if (status === "ended") {
    return null; // Parent handles the completed view
  }

  // ─── Main Voice UI ─────────────────────────────────────────────────

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      {/* Hardware mic mute warning */}
      {micMutedWarning && (
        <div className="shrink-0 bg-amber-500/90 px-4 py-2 text-center text-xs font-medium text-white">
          Your microphone is muted at the system level. Please unmute it (check
          for a mic mute key on your keyboard, often F4) so the interviewer can
          hear you.
        </div>
      )}
      {/* Header */}
      <header className="shrink-0 border-b border-border bg-card/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-5 w-5 items-center justify-center rounded bg-primary text-primary-foreground">
              <BriefcaseBusiness className="h-3 w-3" />
            </div>
            <span className="text-xs font-medium text-foreground">
              {template.title}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1 text-[10px]">
              <AudioLines className="h-2.5 w-2.5" />
              Voice
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={requestEndInterview}
              disabled={status === "ending"}
              className="text-[10px] text-destructive hover:text-destructive"
            >
              {status === "ending" ? "Ending..." : "End Interview"}
            </Button>
          </div>
        </div>
      </header>

      {/* Central Voice Interface — scrollable so messages never overflow */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-6 px-4 py-8">
          {/* Animated Orb */}
          <div className="flex flex-col items-center gap-4">
            <div className={getOrbClasses()}>
              {/* Pulse rings for speaking states */}
              {(status === "ai_speaking" || status === "listening") && (
                <>
                  <div
                    className={`absolute inset-0 rounded-full ${
                      status === "ai_speaking"
                        ? "bg-primary/5"
                        : "bg-green-500/5"
                    } animate-ping`}
                    style={{ animationDuration: "2s" }}
                  />
                  <div
                    className={`absolute inset-2 rounded-full ${
                      status === "ai_speaking"
                        ? "bg-primary/5"
                        : "bg-green-500/5"
                    } animate-ping`}
                    style={{
                      animationDuration: "2.5s",
                      animationDelay: "0.5s",
                    }}
                  />
                </>
              )}

              {/* Center Icon */}
              {status === "connecting" && (
                <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
              )}
              {status === "ai_speaking" && (
                <Volume2 className="h-10 w-10 text-primary" />
              )}
              {status === "listening" && (
                <Mic className="h-10 w-10 text-green-500" />
              )}
              {status === "ai_thinking" && (
                <Loader2 className="h-10 w-10 animate-spin text-yellow-500" />
              )}
              {status === "ending" && (
                <Loader2 className="h-10 w-10 animate-spin text-destructive" />
              )}
              {status === "ready" && (
                <Mic className="h-10 w-10 text-muted-foreground/50" />
              )}
            </div>

            {/* Status Text */}
            <p className="text-xs text-muted-foreground">{getStatusText()}</p>

            {/* Candidate Name */}
            <p className="text-[10px] text-muted-foreground/60">
              {candidateName}
            </p>
          </div>

          {/* Live Transcript (shown while user is speaking) */}
          {liveTranscript && (
            <Card className="w-full max-w-md border-dashed border-green-500/40 bg-green-500/5 px-4 py-3 shadow-none">
              <p className="text-center text-xs font-medium text-foreground/80">
                {liveTranscript}
              </p>
              <p className="mt-1 text-center text-[10px] text-muted-foreground">
                Listening...
              </p>
            </Card>
          )}

          {/* Message History */}
          {messages.length > 0 && (
            <Card className="w-full max-w-md shadow-sm">
              <div ref={messagesScrollRef} className="max-h-64 overflow-y-auto">
                <div className="space-y-3 p-4">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex gap-2 ${
                        msg.speaker === "user" ? "flex-row-reverse" : ""
                      }`}
                    >
                      <div
                        className={`max-w-[85%] rounded-lg px-3 py-2 ${
                          msg.speaker === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        }`}
                      >
                        <p className="text-[11px] leading-relaxed">
                          {msg.text}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="shrink-0 border-t border-border bg-card/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-2xl items-center justify-center gap-4 px-4 py-4">
          {/* Mute Toggle with Audio Level Ring */}
          <div className="relative flex items-center justify-center">
            {/* Audio level ring — only visible when unmuted and picking up sound */}
            {!isMuted && audioLevel > 0.01 && (
              <div
                className="absolute inset-0 rounded-full border-2 border-green-500/60"
                style={{
                  transform: `scale(${1 + audioLevel * 0.6})`,
                  opacity: Math.min(1, audioLevel * 3),
                  transition: "transform 80ms ease-out, opacity 80ms ease-out",
                }}
              />
            )}
            {!isMuted && audioLevel > 0.05 && (
              <div
                className="absolute inset-0 rounded-full border border-green-500/30"
                style={{
                  transform: `scale(${1 + audioLevel * 1.0})`,
                  opacity: Math.min(0.6, audioLevel * 2),
                  transition: "transform 80ms ease-out, opacity 80ms ease-out",
                }}
              />
            )}
            <Button
              variant={isMuted ? "destructive" : "outline"}
              size="lg"
              onClick={toggleMute}
              className="relative z-10 h-14 w-14 rounded-full p-0"
              disabled={status === "connecting" || status === "ending"}
            >
              {isMuted ? (
                <MicOff className="h-5 w-5" />
              ) : (
                <Mic className="h-5 w-5" />
              )}
            </Button>
          </div>

          {/* End Interview */}
          <Button
            variant="destructive"
            size="lg"
            onClick={requestEndInterview}
            className="h-14 w-14 rounded-full p-0"
            disabled={status === "ending"}
          >
            {status === "ending" ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <PhoneOff className="h-5 w-5" />
            )}
          </Button>
        </div>

        <p className="pb-3 text-center text-[10px] text-muted-foreground/60">
          {isMuted
            ? "Microphone muted — click to unmute"
            : "Speak naturally — the AI will respond when you pause"}
        </p>
      </div>

      {/* End Interview Confirmation Dialog */}
      <Dialog
        open={showEndConfirmDialog}
        onOpenChange={setShowEndConfirmDialog}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-sm">End Interview</DialogTitle>
            <DialogDescription className="text-xs">
              Are you sure you want to end this interview? The call will be
              disconnected and an AI assessment will be generated from your
              responses.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowEndConfirmDialog(false)}
              className="text-xs"
            >
              Keep Going
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={endInterview}
              className="text-xs"
            >
              End &amp; Generate Assessment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
