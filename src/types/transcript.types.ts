import { AnalysisDimension } from './interview.types';

export interface SaveTranscriptRequest {
  interviewId: string;
  assistantId?: string | null;
  callId?: string | null;
  startedAt?: string | null;
  endedAt?: string | null;
  durationSeconds?: number | null;
  transcript: Array<{
    role: string;
    text: string;
    timestamp: string;
    isFinal?: boolean;
  }>;
  professional?: AnalysisDimension;
}

