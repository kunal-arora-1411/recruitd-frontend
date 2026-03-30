"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  api,
  type TemplateGenerated,
  type LLMProvider,
  type STTProvider,
  type TTSProvider,
} from "@/lib/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sparkles,
  Save,
  ArrowLeft,
  Pencil,
  BrainCircuit,
  Mic,
  Volume2,
  DollarSign,
  Info,
} from "lucide-react";

export default function NewTemplatePage() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generated, setGenerated] = useState<TemplateGenerated | null>(null);
  const [editableTitle, setEditableTitle] = useState("");
  const [editableDescription, setEditableDescription] = useState("");
  const [llmProvider, setLlmProvider] = useState<LLMProvider>("gemini");
  const [sttProvider, setSttProvider] = useState<STTProvider>("deepgram");
  const [ttsProvider, setTtsProvider] = useState<TTSProvider>("deepgram");
  const [publicTemplate, setPublicTemplate] = useState(true);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setGenerating(true);
    try {
      const result = await api.generateTemplate(prompt);
      setGenerated(result);
      setEditableTitle(result.title);
      setEditableDescription(result.description);
    } catch (error) {
      console.error(error);
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!generated) return;
    setSaving(true);
    try {
      await api.saveTemplate({
        title: editableTitle,
        description: editableDescription,
        promptUsed: generated.promptUsed,
        config: generated.config,
        llmProvider,
        sttProvider,
        ttsProvider,
        publicTemplate,
      });
      router.push("/admin/templates");
    } catch (error) {
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
          className="h-7 w-7 p-0"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-foreground">
            New Template
          </h1>
          <p className="text-xs text-muted-foreground">
            Describe the job role and let AI generate the interview template
          </p>
        </div>
      </div>

      {/* Prompt Input */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-sm">Template Prompt</CardTitle>
          <CardDescription className="text-xs">
            Write anything — specific questions, a job role, interviewer style, or
            a full interview description. The AI interviewer will follow your
            instructions exactly.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder={`You can write anything here. Examples:

• Specific questions: "Ask these questions: 1) What is the virtual DOM? 2) Explain React hooks. 3) How does context API work?"

• A job role: "Interview for a Senior Backend Engineer role, focus on REST APIs and database design"

• A persona + role: "Be a strict senior architect interviewing for a system design role. Ask about scalability, caching, and microservices."

• A full scenario: "Friendly 15-minute junior React engineer screen. Start with basics, then ask about props vs state, and finish with a simple component design question."`}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="min-h-[120px] resize-none text-xs"
          />
          <Button
            onClick={handleGenerate}
            disabled={!prompt.trim() || generating}
            size="sm"
            className="gap-2"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {generating ? "Generating..." : "Generate Template"}
          </Button>
        </CardContent>
      </Card>

      {/* Loading State */}
      {generating && (
        <Card className="shadow-sm">
          <CardContent className="space-y-4 py-6">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
      )}

      {/* Generated Preview */}
      {generated && !generating && (
        <Card className="shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Generated Configuration</CardTitle>
              <Badge variant="outline" className="text-[10px]">
                <Pencil className="mr-1 h-2.5 w-2.5" />
                Editable
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Editable Title */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Title
              </label>
              <Input
                value={editableTitle}
                onChange={(e) => setEditableTitle(e.target.value)}
                className="text-xs"
              />
            </div>

            {/* Editable Description */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Description
              </label>
              <Textarea
                value={editableDescription}
                onChange={(e) => setEditableDescription(e.target.value)}
                className="min-h-[60px] text-xs"
              />
            </div>

            <div className="space-y-2 rounded-md border border-border bg-muted/30 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-foreground">
                    Available To All Recruiters
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Public templates appear for every recruiter without manual
                    authorization.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPublicTemplate((current) => !current)}
                  className={`rounded-full border px-3 py-1 text-[10px] font-medium transition-colors ${
                    publicTemplate
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background text-muted-foreground"
                  }`}
                >
                  {publicTemplate ? "Enabled" : "Disabled"}
                </button>
              </div>
            </div>

            <Separator />

            {/* Config Preview */}
            <div className="space-y-3">
              <h3 className="text-xs font-medium text-muted-foreground">
                Configuration
              </h3>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <span className="text-[10px] text-muted-foreground">
                    Interviewer Persona
                  </span>
                  <p className="text-xs">
                    {generated.config.interviewerPersona}
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-muted-foreground">
                    Difficulty
                  </span>
                  <div>
                    <Badge variant="outline" className="text-[10px]">
                      {generated.config.difficulty}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Evaluation Criteria */}
              <div className="space-y-1.5">
                <span className="text-[10px] text-muted-foreground">
                  Evaluation Criteria
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {generated.config.evaluationCriteria.map((c, i) => (
                    <Badge key={i} variant="secondary" className="text-[10px]">
                      {c}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Interview Flow */}
              <div className="space-y-1.5">
                <span className="text-[10px] text-muted-foreground">
                  Interview Flow
                </span>
                <div className="space-y-2">
                  {generated.config.interviewFlow.map((step, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 rounded-md border border-border bg-muted/30 p-3"
                    >
                      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-medium text-primary">
                        {i + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium capitalize">
                            {step.phase}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {step.duration}
                          </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                          {step.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              {/* LLM Provider */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <BrainCircuit className="h-3.5 w-3.5" />
                  Voice Interview LLM
                </label>
                <p className="text-[10px] text-muted-foreground">
                  Choose the LLM used during voice interviews for this template
                </p>
                <div className="flex gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => setLlmProvider("gemini")}
                    className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                      llmProvider === "gemini"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    Gemini 2.5 Flash Lite
                  </button>
                  <button
                    type="button"
                    onClick={() => setLlmProvider("mistral")}
                    className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                      llmProvider === "mistral"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    Mistral Small
                  </button>
                </div>
              </div>

              {/* STT Provider */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Mic className="h-3.5 w-3.5" />
                  Speech-to-Text Engine
                </label>
                <p className="text-[10px] text-muted-foreground">
                  Choose the STT engine for transcribing candidate speech
                </p>
                <div className="flex flex-wrap gap-2 mt-1">
                  {(["deepgram", "openai", "elevenlabs", "elevenlabs-realtime", "cartesia", "sarvam", "voxtral-realtime", "voxtral-batch"] as STTProvider[]).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setSttProvider(p)}
                      className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                        sttProvider === p
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-background text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {p === "deepgram" ? "Deepgram Nova-2" :
                       p === "openai" ? "OpenAI Whisper" :
                       p === "elevenlabs" ? "ElevenLabs Standard" :
                       p === "elevenlabs-realtime" ? "ElevenLabs Realtime" :
                       p === "cartesia" ? "Cartesia Ink-Whisper" :
                       p === "sarvam" ? "Sarvam Saarika" :
                       p === "voxtral-realtime" ? "Voxtral Realtime" :
                       "Voxtral Batch"}
                    </button>
                  ))}
                </div>
              </div>

              {/* TTS Provider */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Volume2 className="h-3.5 w-3.5" />
                  Text-to-Speech Engine
                </label>
                <p className="text-[10px] text-muted-foreground">
                  Choose the TTS engine for AI voice synthesis
                </p>
                <div className="flex flex-wrap gap-2 mt-1">
                  {(["deepgram", "openai", "elevenlabs", "cartesia", "sarvam", "voxtral"] as TTSProvider[]).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setTtsProvider(p)}
                      className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                        ttsProvider === p
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-background text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {p === "deepgram" ? "Deepgram Aura-2" :
                       p === "openai" ? "OpenAI TTS" :
                       p === "elevenlabs" ? "ElevenLabs TTS" :
                       p === "cartesia" ? "Cartesia Sonic-3" :
                       p === "sarvam" ? "Sarvam Bulbul" :
                       "Voxtral TTS"}
                    </button>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Estimated Cost Per Minute */}
              {(() => {
                const sttPricing: Record<STTProvider, { label: string; perMin: number }> = {
                  deepgram: { label: "Deepgram Nova-2", perMin: 0.0059 },
                  openai: { label: "OpenAI Whisper", perMin: 0.006 },
                  elevenlabs: { label: "ElevenLabs Scribe", perMin: 0.012 },
                  "elevenlabs-realtime": { label: "ElevenLabs Scribe RT", perMin: 0.015 },
                  cartesia: { label: "Cartesia Ink-Whisper", perMin: 0.002 },
                  sarvam: { label: "Sarvam Saarika", perMin: 0.0077 },
                  "voxtral-realtime": { label: "Voxtral Realtime", perMin: 0.006 },
                  "voxtral-batch": { label: "Voxtral Batch", perMin: 0.003 },
                };
                const ttsPricing: Record<TTSProvider, { label: string; perMin: number }> = {
                  deepgram: { label: "Deepgram Aura-2", perMin: 0.0225 },
                  openai: { label: "OpenAI TTS", perMin: 0.0113 },
                  elevenlabs: { label: "ElevenLabs TTS", perMin: 0.12 },
                  cartesia: { label: "Cartesia Sonic-3", perMin: 0.022 },
                  sarvam: { label: "Sarvam Bulbul", perMin: 0.009 },
                  voxtral: { label: "Voxtral TTS", perMin: 0.012 },
                };
                const llmPricing: Record<LLMProvider, { label: string; perMin: number }> = {
                  gemini: { label: "Gemini 2.5 Flash-Lite", perMin: 0.00028 },
                  mistral: { label: "Mistral Small", perMin: 0.00026 },
                };

                const stt = sttPricing[sttProvider];
                const tts = ttsPricing[ttsProvider];
                const llm = llmPricing[llmProvider];
                const total = stt.perMin + tts.perMin + llm.perMin;
                const fmt = (n: number) =>
                  n < 0.001 ? `$${n.toFixed(5)}` : n < 0.01 ? `$${n.toFixed(4)}` : `$${n.toFixed(4)}`;

                return (
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                      <DollarSign className="h-3.5 w-3.5" />
                      Estimated Cost Per Minute
                    </label>
                    <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
                      <div className="grid gap-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">STT — {stt.label}</span>
                          <span className="font-mono font-medium">{fmt(stt.perMin)}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">LLM — {llm.label}</span>
                          <span className="font-mono font-medium">{fmt(llm.perMin)}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">TTS — {tts.label}</span>
                          <span className="font-mono font-medium">{fmt(tts.perMin)}</span>
                        </div>
                        <Separator />
                        <div className="flex items-center justify-between text-xs font-semibold">
                          <span>Total per minute</span>
                          <span className="font-mono text-primary">{fmt(total)}</span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                          <span>20-min interview estimate</span>
                          <span className="font-mono">${(total * 20).toFixed(2)}</span>
                        </div>
                      </div>
                      <details className="group">
                        <summary className="flex cursor-pointer items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors">
                          <Info className="h-3 w-3" />
                          Assumptions &amp; Sources
                        </summary>
                        <div className="mt-2 space-y-1.5 text-[10px] text-muted-foreground pl-4">
                          <p>• <strong>STT:</strong> 1 minute of continuous audio streamed per interview minute.</p>
                          <p>• <strong>LLM:</strong> ~2,000 input tokens + ~200 output tokens per minute.</p>
                          <p>• <strong>TTS:</strong> ~750 characters of AI speech per minute.</p>
                          <p className="italic">Sources: deepgram.com/pricing, developers.openai.com, ai.google.dev, elevenlabs.io/pricing, docs.mistral.ai. Prices as of Mar 2026.</p>
                        </div>
                      </details>
                    </div>
                  </div>
                );
              })()}

              <Separator />
              <div className="space-y-1.5">
                <span className="text-[10px] text-muted-foreground">
                  Raw JSON
                </span>
                <pre className="max-h-48 overflow-auto rounded-md border border-border bg-muted/50 p-3 font-mono text-[10px] text-muted-foreground">
                  {JSON.stringify(generated.config, null, 2)}
                </pre>
              </div>
            </div>

            <Separator />

            {/* Actions */}
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setGenerated(null)}
                className="text-xs"
              >
                Discard
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving || !editableTitle.trim()}
                size="sm"
                className="gap-2 text-xs"
              >
                <Save className="h-3.5 w-3.5" />
                {saving ? "Saving..." : "Save Template"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
