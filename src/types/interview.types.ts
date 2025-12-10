export interface StartInterviewRequest {
  assistantId?: string | null;
  callId?: string | null;
  startedAt?: string | null;
  contextPrompt?: string | null;
}

export interface AnalysisDimension {
  score?: number | null;
  notes?: string | null;
  source?: string | null; // e.g., gemini, speech, frontend
}

export interface SaveAnalysisRequest {
  interviewId: string;
  technical?: AnalysisDimension;
  problemSolving?: AnalysisDimension;
  communication?: AnalysisDimension;
  roleKnowledge?: AnalysisDimension;
  experience?: AnalysisDimension;
  professional?: AnalysisDimension;
  overall?: AnalysisDimension;
  modelVersion?: string | null;
}

