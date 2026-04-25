"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { getStreamWSUrl, type JobTemplate } from "@/lib/api";
import type { VoiceStatus } from "@/lib/types";
import { InterviewAvatar } from "@/components/interview-avatar-dynamic";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3100";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
  Loader2,
  AudioLines,
  BriefcaseBusiness,
  Sparkles,
  User,
  MessageSquare,
  NotebookPen,
  Send,
  X,
  Check,
} from "lucide-react";

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
  wsUrlOverride?: string;
}

export function StreamInterview({
  interviewId,
  template,
  candidateName,
  onEnd,
  wsUrlOverride,
}: StreamInterviewProps) {
  const [status, setStatus] = useState<VoiceStatus>("connecting");
  const [isMuted, setIsMuted] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [messages, setMessages] = useState<VoiceMessage[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [audioLevel, setAudioLevel] = useState(0);
  const [showEndConfirmDialog, setShowEndConfirmDialog] = useState(false);
  const [micMutedWarning, setMicMutedWarning] = useState(false);
  const [notepadOpen, setNotepadOpen] = useState(false);
  const [notepadContent, setNotepadContent] = useState("");
  const [notepadStatus, setNotepadStatus] =
    useState<"idle" | "sharing" | "shared">("idle");

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
  const analyserNodeRef = useRef<AnalyserNode | null>(null);
  const aiVolumeRafRef = useRef<number | null>(null);
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

    const wsUrl = wsUrlOverride ?? getStreamWSUrl(interviewId);
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
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;

      gain.connect(analyser);
      analyser.connect(ctx.destination);

      gainNodeRef.current = gain;
      analyserNodeRef.current = analyser;
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
      if (analyserNodeRef.current) {
        newGain.connect(analyserNodeRef.current);
      } else {
        newGain.connect(ctx.destination);
      }
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

  const updateAiPlaybackVolume = useCallback(() => {
    if (statusRef.current === "ai_speaking" && analyserNodeRef.current) {
      const dataArray = new Float32Array(analyserNodeRef.current.fftSize);
      analyserNodeRef.current.getFloatTimeDomainData(dataArray);
      let sumSquares = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sumSquares += dataArray[i] * dataArray[i];
      }
      if (dataArray.length > 0) {
        const rms = Math.sqrt(sumSquares / dataArray.length);
        setAudioLevel(Math.min(1, rms * 5));
      }
    }
    aiVolumeRafRef.current = requestAnimationFrame(updateAiPlaybackVolume);
  }, []);

  useEffect(() => {
    aiVolumeRafRef.current = requestAnimationFrame(updateAiPlaybackVolume);
    return () => {
      if (aiVolumeRafRef.current) cancelAnimationFrame(aiVolumeRafRef.current);
    };
  }, [updateAiPlaybackVolume]);

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
          if (statusRef.current !== "ai_speaking") {
            setAudioLevel(isMutedRef.current ? 0 : Math.min(1, rms * 5));
          }
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
            if (analyserNodeRef.current) {
              newGain.connect(analyserNodeRef.current);
            } else {
              newGain.connect(playbackCtxRef.current.destination);
            }
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

  const handleShareNotepad = () => {
    const trimmed = notepadContent.trim();
    if (!trimmed) return;
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    if (notepadStatus === "sharing") return;

    setNotepadStatus("sharing");
    wsRef.current.send(
      JSON.stringify({ type: "share_notepad", content: trimmed }),
    );
    setNotepadStatus("shared");
    setTimeout(() => setNotepadStatus("idle"), 2500);
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
    if (aiVolumeRafRef.current) {
      cancelAnimationFrame(aiVolumeRafRef.current);
      aiVolumeRafRef.current = null;
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

  // Split the message stream into the active question, the user's answer so
  // far, and the prior history.  The "current question" is the most recent AI
  // utterance; anything the user has said after it counts as the in-progress
  // response; everything before it is archived history.
  const lastAiIdx = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].speaker === "ai") return i;
    }
    return -1;
  })();
  const currentQuestion = lastAiIdx >= 0 ? messages[lastAiIdx].text : null;
  const answerSoFar =
    lastAiIdx >= 0
      ? messages
          .slice(lastAiIdx + 1)
          .filter((m) => m.speaker === "user")
          .map((m) => m.text)
          .join(" ")
      : "";
  const pastMessages = lastAiIdx > 0 ? messages.slice(0, lastAiIdx) : [];

  const statusDotColor =
    status === "ai_speaking"
      ? "bg-blue-400 animate-pulse"
      : status === "listening"
        ? "bg-green-400 animate-pulse"
        : status === "ai_thinking"
          ? "bg-amber-400 animate-pulse"
          : status === "ready"
            ? "bg-emerald-400"
            : "bg-white/30";

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-[#050f24]">
      {/* Layered bluish atmosphere — replaces the old black "video call" frame */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#0a1c3e] via-[#0b2150] to-[#112c66]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_55%_55%_at_32%_28%,_rgba(59,130,246,0.28),_transparent_70%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_45%_45%_at_78%_82%,_rgba(99,102,241,0.18),_transparent_70%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_115%,_rgba(14,165,233,0.18),_transparent_75%)]"
      />

      {/* Full-viewport 3D avatar — lives freely in the scene, not in a box.
          pointer events kept active so the canvas can receive pinch / wheel zoom. */}
      <div className="absolute inset-0 z-0">
        <InterviewAvatar
          voiceStatus={status}
          analyserNode={analyserNodeRef.current}
          className="h-full w-full"
        />
      </div>

      {/* Hardware mic mute warning */}
      {micMutedWarning && (
        <div className="relative z-20 shrink-0 bg-amber-500/90 px-4 py-2 text-center text-xs font-medium text-white">
          Your microphone is muted at the system level. Please unmute it (check
          for a mic mute key on your keyboard, often F4) so the interviewer can
          hear you.
        </div>
      )}

      {/* Header — transparent, floats over the scene */}
      <header className="relative z-10 shrink-0">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-5 w-5 items-center justify-center rounded bg-primary text-primary-foreground">
              <BriefcaseBusiness className="h-3 w-3" />
            </div>
            <span className="text-xs font-medium text-white">
              {template.title}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="gap-1 border-white/20 bg-white/5 text-[10px] text-white/80 backdrop-blur-md"
            >
              <AudioLines className="h-2.5 w-2.5" />
              Voice
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={requestEndInterview}
              disabled={status === "ending"}
              className="text-[10px] text-red-300 hover:bg-white/10 hover:text-red-200"
            >
              {status === "ending" ? "Ending..." : "End Interview"}
            </Button>
          </div>
        </div>
      </header>

      {/* Floating status + name pills — anchored near the avatar, no container */}
      <div className="pointer-events-none absolute bottom-32 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-1.5 lg:left-[33%]">
        <span className="flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.08] px-3 py-1.5 text-[11px] font-medium text-white/90 backdrop-blur-md">
          <span className={`h-2 w-2 rounded-full ${statusDotColor}`} />
          {getStatusText()}
        </span>
        <span className="flex items-center gap-1.5 rounded-full bg-white/[0.06] px-2.5 py-1 text-[10px] text-white/60 backdrop-blur-sm">
          <User className="h-3 w-3" />
          {candidateName}
        </span>
      </div>

      {/* Dialogue — floating glass column on the right, no surrounding frame.
          The wrapper + section are pointer-events-none so pinch/wheel zoom
          passes through their empty gaps to the avatar canvas beneath; each
          panel re-enables pointer events on itself. */}
      <div className="pointer-events-none relative z-10 flex min-h-0 flex-1 justify-end">
        <section className="pointer-events-none flex min-h-0 w-full flex-col gap-3 overflow-hidden p-4 lg:w-[440px] lg:p-5">
          {/* Current Question */}
          <div className="pointer-events-auto shrink-0 rounded-2xl border border-white/15 bg-white/[0.06] p-5 shadow-2xl shadow-black/30 backdrop-blur-xl">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-sky-400/20 text-sky-300">
                <Sparkles className="h-3.5 w-3.5" />
              </div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-sky-200">
                Interviewer
              </span>
              {status === "ai_speaking" && (
                <span className="ml-1 flex items-center gap-1 text-[10px] text-white/60">
                  <AudioLines className="h-3 w-3 animate-pulse" />
                  speaking…
                </span>
              )}
            </div>
            <p className="text-base font-medium leading-relaxed text-white sm:text-lg">
              {currentQuestion ??
                (status === "connecting"
                  ? "Connecting to your interviewer…"
                  : "Getting ready to start the interview…")}
            </p>
          </div>

          {/* Your Response */}
          <div
            className={`pointer-events-auto shrink-0 rounded-2xl border p-5 backdrop-blur-xl transition-colors ${
              liveTranscript
                ? "border-green-400/40 bg-green-500/10"
                : "border-white/10 bg-white/[0.04]"
            }`}
          >
            <div className="mb-3 flex items-center gap-2">
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-full ${
                  liveTranscript
                    ? "bg-green-400/20 text-green-300"
                    : "bg-white/10 text-white/60"
                }`}
              >
                <Mic className="h-3.5 w-3.5" />
              </div>
              <span
                className={`text-[11px] font-semibold uppercase tracking-wider ${
                  liveTranscript ? "text-green-300" : "text-white/60"
                }`}
              >
                {liveTranscript ? "You're speaking…" : "Your response"}
              </span>
            </div>
            <p
              className={`text-sm leading-relaxed ${
                liveTranscript || answerSoFar
                  ? "text-white/95"
                  : "italic text-white/45"
              }`}
            >
              {liveTranscript ||
                answerSoFar ||
                (currentQuestion
                  ? "Start speaking to answer the question above."
                  : "Your response will appear here as you speak.")}
            </p>
          </div>

          {/* Past conversation history */}
          <div className="pointer-events-auto flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl">
            <div className="flex shrink-0 items-center gap-2 border-b border-white/10 px-5 py-3">
              <MessageSquare className="h-3.5 w-3.5 text-white/50" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-white/60">
                Past conversation
              </span>
              {pastMessages.length > 0 && (
                <Badge
                  variant="outline"
                  className="ml-auto border-white/20 bg-white/5 text-[10px] text-white/70"
                >
                  {pastMessages.length}
                </Badge>
              )}
            </div>
            <div
              ref={messagesScrollRef}
              className="min-h-0 flex-1 overflow-y-auto"
            >
              {pastMessages.length === 0 ? (
                <p className="px-5 py-8 text-center text-xs text-white/40">
                  Earlier questions and answers will appear here as the
                  interview progresses.
                </p>
              ) : (
                <div className="space-y-3 p-5">
                  {pastMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex items-start gap-2 ${
                        msg.speaker === "user" ? "flex-row-reverse" : ""
                      }`}
                    >
                      <div
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                          msg.speaker === "user"
                            ? "bg-primary/20 text-primary"
                            : "bg-white/10 text-white/70"
                        }`}
                      >
                        {msg.speaker === "user" ? (
                          <User className="h-3.5 w-3.5" />
                        ) : (
                          <Sparkles className="h-3.5 w-3.5" />
                        )}
                      </div>
                      <div
                        className={`max-w-[80%] rounded-lg px-3.5 py-2.5 ${
                          msg.speaker === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-white/10 text-white/90"
                        }`}
                      >
                        <p className="text-xs leading-relaxed">{msg.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* Notepad — floating glass panel on the left.  Candidates type code /
          equations / notes and click Share to send the contents to the AI
          interviewer as a conversation turn. */}
      {notepadOpen && (
        <div className="pointer-events-auto absolute bottom-28 left-4 top-16 z-20 flex w-[calc(100%-2rem)] max-w-[420px] flex-col overflow-hidden rounded-2xl border border-white/15 bg-white/[0.08] shadow-2xl shadow-black/40 backdrop-blur-2xl lg:left-5 lg:top-14 lg:bottom-24">
          <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
            <div className="flex items-center gap-2">
              <NotebookPen className="h-4 w-4 text-sky-300" />
              <span className="text-xs font-semibold text-white">
                Your notepad
              </span>
            </div>
            <button
              type="button"
              onClick={() => setNotepadOpen(false)}
              className="text-white/60 transition-colors hover:text-white"
              aria-label="Close notepad"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="shrink-0 px-4 pt-3 text-[10px] leading-relaxed text-white/55">
            Use this space to draft code, equations, or rough work while you
            think. Click{" "}
            <span className="font-medium text-white/85">
              Share with interviewer
            </span>{" "}
            to send what you've written to the AI for review.
          </p>
          <div className="flex-1 min-h-0 p-4">
            <Textarea
              value={notepadContent}
              onChange={(e) => {
                setNotepadContent(e.target.value);
                if (notepadStatus === "shared") setNotepadStatus("idle");
              }}
              placeholder={
                "Jot down your working here…\n\nExample:\n  def solve(n):\n      total = 0\n      for i in range(n):\n          total += i\n      return total"
              }
              spellCheck={false}
              className="h-full w-full resize-none border-white/10 bg-black/30 font-mono text-xs leading-relaxed text-white/95 placeholder:text-white/30 focus-visible:border-sky-400/40 focus-visible:ring-sky-400/20"
            />
          </div>
          <div className="flex shrink-0 items-center justify-between gap-2 border-t border-white/10 px-4 py-3">
            <span className="text-[10px] text-white/45">
              {notepadContent.length} chars
            </span>
            <Button
              size="sm"
              onClick={handleShareNotepad}
              disabled={
                !notepadContent.trim() ||
                notepadStatus === "sharing" ||
                status === "connecting" ||
                status === "ending" ||
                status === "ended"
              }
              className="h-8 gap-1.5 text-[11px]"
            >
              {notepadStatus === "shared" ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  Shared with interviewer
                </>
              ) : notepadStatus === "sharing" ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Sharing…
                </>
              ) : (
                <>
                  <Send className="h-3.5 w-3.5" />
                  Share with interviewer
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Bottom Controls — transparent, floating */}
      <div className="relative z-10 shrink-0">
        <div className="mx-auto flex max-w-7xl items-center justify-center gap-4 px-6 py-4">
          {/* Mute Toggle with Audio Level Ring */}
          <div className="relative flex items-center justify-center">
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
              className={`relative z-10 h-14 w-14 rounded-full p-0 backdrop-blur-md ${
                isMuted
                  ? ""
                  : "border-white/25 bg-white/[0.08] text-white hover:bg-white/15"
              }`}
              disabled={status === "connecting" || status === "ending"}
            >
              {isMuted ? (
                <MicOff className="h-5 w-5" />
              ) : (
                <Mic className="h-5 w-5" />
              )}
            </Button>
          </div>

          {/* Notepad toggle — opens the scratchpad overlay */}
          <Button
            variant="outline"
            size="lg"
            onClick={() => setNotepadOpen((v) => !v)}
            className={`relative h-14 w-14 rounded-full border-white/25 bg-white/[0.08] p-0 text-white backdrop-blur-md hover:bg-white/15 ${
              notepadOpen ? "ring-2 ring-sky-300/60" : ""
            }`}
            aria-label="Notepad"
          >
            <NotebookPen className="h-5 w-5" />
            {notepadContent.trim().length > 0 && !notepadOpen && (
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-sky-300 shadow-[0_0_6px_rgba(125,211,252,0.9)]" />
            )}
          </Button>

          <Button
            variant="destructive"
            size="lg"
            onClick={requestEndInterview}
            className="h-14 w-14 rounded-full p-0 shadow-lg shadow-red-900/30"
            disabled={status === "ending"}
          >
            {status === "ending" ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <PhoneOff className="h-5 w-5" />
            )}
          </Button>
        </div>

        <p className="pb-3 text-center text-[10px] text-white/40">
          {isMuted
            ? "Microphone muted — click to unmute"
            : "Speak naturally — the AI will respond when you pause"}
        </p>
      </div>{/* end Bottom Controls */}

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
