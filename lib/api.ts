// All HTTP calls go through the Next.js rewrite proxy at /api/proxy/*.
// This avoids CORS preflight failures when the frontend and backend are on
// different domains (e.g. Amplify frontend + separate backend host).
// The rewrite in next.config.ts forwards these server-side to NEXT_PUBLIC_API_URL.
const API_BASE = "/api/proxy";
const API_SECRET = process.env.NEXT_PUBLIC_API_SECRET || "";

function getIdentityToken(): string {
  if (typeof document === "undefined") return "";

  const match = document.cookie.match(
    /(?:^|;\s*)recruitdesk_identity=([^;]+)/,
  );
  return match ? decodeURIComponent(match[1]) : "";
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string>),
  };

  if (API_SECRET) {
    headers["Authorization"] = `Bearer ${API_SECRET}`;
  }

  const identity = getIdentityToken();
  if (identity) {
    headers["x-recruitdesk-identity"] = identity;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(error.error || `API error: ${res.status}`);
  }

  return res.json();
}

export const api = {
  // Templates
  generateTemplate: (prompt: string) =>
    apiFetch<TemplateGenerated>("/api/template/generate", {
      method: "POST",
      body: JSON.stringify({ prompt }),
    }),

  saveTemplate: (data: SaveTemplatePayload) =>
    apiFetch<JobTemplate>("/api/template", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getTemplates: () => apiFetch<JobTemplate[]>("/api/template"),

  getTemplate: (id: string) => apiFetch<JobTemplate>(`/api/template/${id}`),

  deleteTemplate: (id: string) =>
    apiFetch<{ message: string }>(`/api/template/${id}`, { method: "DELETE" }),

  setTemplateAvailability: (id: string, publicTemplate: boolean) =>
    apiFetch<JobTemplate>(`/api/template/${id}/visibility`, {
      method: "PATCH",
      body: JSON.stringify({ publicTemplate }),
    }),

  getTemplateAuthorizations: (id: string) =>
    apiFetch<TemplateAuthorization[]>(
      `/api/template/${id}/authorizations`,
    ),

  authorizeTemplateRecruiter: (
    id: string,
    email: string,
    grantAll = false,
  ) =>
    apiFetch<TemplateAuthorization[]>(`/api/template/${id}/authorizations`, {
      method: "POST",
      body: JSON.stringify({ email, grantAll }),
    }),

  revokeTemplateRecruiterAccess: (
    id: string,
    email: string,
    revokeAll = false,
  ) =>
    apiFetch<TemplateAuthorization[]>(`/api/template/${id}/authorizations`, {
      method: "DELETE",
      body: JSON.stringify({ email, revokeAll }),
    }),

  // Recruiters
  getRecruiters: () => apiFetch<Recruiter[]>("/api/recruiter"),

  createRecruiter: (data: SaveRecruiterPayload) =>
    apiFetch<Recruiter>("/api/recruiter", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateRecruiter: (id: string, data: UpdateRecruiterPayload) =>
    apiFetch<Recruiter>(`/api/recruiter/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  deleteRecruiter: (id: string) =>
    apiFetch<{ message: string }>(`/api/recruiter/${id}`, {
      method: "DELETE",
    }),

  getCurrentRecruiter: () => apiFetch<CurrentRecruiter>("/api/recruiter/me"),

  // Resume
  parseResume: (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const headers: Record<string, string> = {};
    if (API_SECRET) headers["Authorization"] = `Bearer ${API_SECRET}`;
    const identity = getIdentityToken();
    if (identity) headers["x-recruitdesk-identity"] = identity;
    return fetch(`${API_BASE}/api/resume/parse`, {
      method: "POST",
      headers,
      body: formData,
    }).then(async (res) => {
      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: "Request failed" }));
        throw new Error(error.error || `API error: ${res.status}`);
      }
      return res.json() as Promise<{ resumeText: string }>;
    });
  },

  // Interviews
  startInterview: (templateId: string, candidateName: string, mode: 'text' | 'voice' | 'phone' = 'text', phoneNumber?: string, resumeText?: string) =>
    apiFetch<StartInterviewResponse>("/api/interview/start", {
      method: "POST",
      body: JSON.stringify({ templateId, candidateName, mode, ...(phoneNumber ? { phoneNumber } : {}), ...(resumeText ? { resumeText } : {}) }),
    }),

  sendMessage: (interviewId: string, content: string) =>
    apiFetch<SendMessageResponse>("/api/interview/message", {
      method: "POST",
      body: JSON.stringify({ interviewId, content }),
    }),

  completeInterview: (interviewId: string) =>
    apiFetch<CompleteInterviewResponse>("/api/interview/complete", {
      method: "POST",
      body: JSON.stringify({ interviewId }),
    }),

  getInterviews: () => apiFetch<Interview[]>("/api/interview"),

  getInterview: (id: string) => apiFetch<InterviewDetail>(`/api/interview/${id}`),

  // Assessments
  getAssessment: (interviewId: string) => apiFetch<Assessment>(`/api/assessment/${interviewId}`),

  // Stats
  getStats: () => apiFetch<DashboardStats>("/api/stats"),

  // Phone
  initiatePhoneCall: (interviewId: string) =>
    apiFetch<{ message: string; callSid: string; interviewId: string }>("/api/phone/call", {
      method: "POST",
      body: JSON.stringify({ interviewId }),
    }),

  getPhoneCallStatus: (interviewId: string) =>
    apiFetch<PhoneCallStatus>(`/api/phone/status/${interviewId}`),

  getPhoneRoutes: (templateId?: string) =>
    apiFetch<PhoneRoute[]>(`/api/phone/routes${templateId ? `?templateId=${templateId}` : ""}`),

  deletePhoneRoute: (phoneNumber: string) =>
    apiFetch<{ message: string; phoneNumber: string }>("/api/phone/route", {
      method: "DELETE",
      body: JSON.stringify({ phoneNumber }),
    }),
};

// Types
export interface TemplateConfig {
  interviewerPersona: string;
  difficulty: string;
  evaluationCriteria: string[];
  interviewFlow: { phase: string; duration: string; description: string }[];
}

export interface TemplateGenerated {
  title: string;
  description: string;
  promptUsed: string;
  config: TemplateConfig;
}

export type LLMProvider = "mistral" | "gemini";
export type STTProvider = "deepgram" | "openai" | "elevenlabs" | "elevenlabs-realtime" | "cartesia" | "sarvam" | "voxtral-realtime" | "voxtral-batch";
export type TTSProvider = "deepgram" | "openai" | "elevenlabs" | "cartesia" | "sarvam" | "voxtral";

export interface SaveTemplatePayload {
  title: string;
  description: string;
  promptUsed: string;
  config: TemplateConfig;
  llmProvider?: LLMProvider;
  sttProvider?: STTProvider;
  ttsProvider?: TTSProvider;
  duration?: number;
  publicTemplate?: boolean;
}

export interface JobTemplate {
  _id: string;
  title: string;
  description: string;
  promptUsed: string;
  config: TemplateConfig;
  llmProvider: LLMProvider;
  sttProvider: STTProvider;
  ttsProvider: TTSProvider;
  duration?: number;
  publicTemplate?: boolean;
  createdAt: string;
  interviewsCount?: number;
}

export interface TemplateAuthorization {
  email: string;
  hasFullTemplateAccess: boolean;
  directTemplateAccess: boolean;
}

export interface Recruiter {
  _id: string;
  name: string;
  email: string;
  isActive: boolean;
  hasFullTemplateAccess: boolean;
  authorizedTemplateCount: number;
  minutesAllocated: number;
  minutesUsed: number;
  minutesRemaining: number;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface SaveRecruiterPayload {
  name?: string;
  email: string;
  password: string;
  isActive?: boolean;
  hasFullTemplateAccess?: boolean;
  minutesAllocated?: number;
}

export interface UpdateRecruiterPayload {
  name?: string;
  password?: string;
  isActive?: boolean;
  hasFullTemplateAccess?: boolean;
  minutesIncrement?: number;
}

export type CurrentRecruiter = Recruiter;

export interface TranscriptEntry {
  _id: string;
  interviewId: string;
  speaker: "ai" | "user";
  content: string;
  timestamp: string;
}

export interface Interview {
  _id: string;
  templateId: { _id: string; title: string } | string;
  mode: "text" | "voice" | "phone";
  status: "created" | "active" | "completed" | "analyzed";
  startedAt: string | null;
  endedAt: string | null;
  candidateName: string;
  assessmentId: string | null;
  billedMinutes?: number;
  createdAt: string;
}

export interface InterviewDetail {
  interview: Interview & { templateId: JobTemplate };
  transcript: TranscriptEntry[];
}

export interface StartInterviewResponse {
  interview: Interview;
  initialMessage: TranscriptEntry;
}

export interface SendMessageResponse {
  userMessage: TranscriptEntry;
  aiMessage: TranscriptEntry;
}

export interface CompleteInterviewResponse {
  interview: Interview;
  assessment: Assessment;
}

export interface Assessment {
  _id: string;
  interviewId: string;
  summary: string;
  scores: {
    overall: number;
    communication: number;
    domainKnowledge: number;
    problemSolving: number;
    professionalBehaviour: number;
  };
  scoreExplanations?: {
    communication: string;
    domainKnowledge: string;
    problemSolving: string;
    professionalBehaviour: string;
  };
  strengths: string[];
  improvements: string[];
  createdAt: string;
}

export interface DashboardStats {
  totalTemplates: number;
  totalInterviews: number;
  completedInterviews: number;
  completionRate: number;
  recentInterviews: Interview[];
}

/**
 * Get the WebSocket URL for a stream interview session
 */
export function getStreamWSUrl(interviewId: string): string {
  const httpBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3100";
  const wsBase = httpBase.replace(/^http/, "ws");
  const secret = process.env.NEXT_PUBLIC_API_SECRET || "";
  const identity = getIdentityToken();
  const params = new URLSearchParams();
  if (secret) {
    params.set("token", secret);
  }
  if (identity) {
    params.set("identity", identity);
  }
  const query = params.toString();
  return `${wsBase}/api/stream/${interviewId}${query ? `?${query}` : ""}`;
}

export interface PhoneCallStatus {
  interviewId: string;
  status: string;
  callSid: string | null;
  callActive: boolean;
  assessmentId: string | null;
}

export interface PhoneRoute {
  _id: string;
  phoneNumber: string;
  templateId: string | { _id: string; title: string };
  lastInterviewId: string | null;
  createdAt: string;
  updatedAt: string;
}
