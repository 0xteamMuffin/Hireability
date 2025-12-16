/**
 * Vapi Custom Tool Types
 * These types define the request/response structure for Vapi tool calls.
 * Vapi sends tool call requests to our server URL, and we respond with results.
 */

export interface VapiToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface VapiToolCallRequest {
  message: {
    timestamp: number;
    type: 'tool-calls';
    toolCallList: VapiToolCall[];
    call?: {
      id: string;
      assistantId?: string;
      assistantOverrides?: {
        variableValues?: {
          userId?: string;
          [key: string]: unknown;
        };
        [key: string]: unknown;
      };
    };
    artifact?: {
      variableValues?: {
        userId?: string;
        [key: string]: unknown;
      };
    };
  };
}

export interface VapiToolResult {
  toolCallId: string;
  result: string;
}

export interface VapiToolCallResponse {
  results: VapiToolResult[];
}

export type QuestionCategory = 'technical' | 'behavioral' | 'mixed';

export interface VapiUserData {
  targetRole: string | null;
  targetCompany: string | null;
  level: string | null;
}

export interface VapiUserDataResponse {
  error: string | null;
  data: VapiUserData | null;
}

export interface VapiResumeData {
  fileName: string;
  status: string;
  parsedData: Record<string, unknown> | null;
  confidence: number | null;
}

export interface VapiResumeDataResponse {
  error: string | null;
  data: VapiResumeData | null;
}

export interface UserContextResponse {
  error: string | null;
  systemPrompt: string;
  firstMessage: string;
  data: {
    profile: VapiUserData;
    resume: VapiResumeData | null;
  } | null;
}

export interface GetQuestionsArgs {
  category?: QuestionCategory;
  limit?: number;
}

export interface GeneratedQuestion {
  id: string;
  question: string;
  category: QuestionCategory;
  difficulty: 'easy' | 'medium' | 'hard';
  context?: string;
}

export interface SaveCallMetadataRequest {
  interviewId: string;
  callId: string;
  averageExpressions?: Record<string, number>;
}

export interface PauseDetail {
  fromRole: string;
  toRole: string;
  gapSeconds: number;
  bucket: 'micro' | 'short' | 'long' | 'very_long';
}

export interface PauseMetrics {
  pauses: PauseDetail[];
  bucketCounts: Record<'micro' | 'short' | 'long' | 'very_long', number>;
  longest: number;
  average: number;
  totalSilence: number;
  utteranceCount: number;
}
