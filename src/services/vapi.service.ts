import { prisma } from '../utils/prisma.util';
import * as profileService from './profile.service';
import * as documentService from './document.service';
import * as targetService from './target.service';
import {
  GetQuestionsArgs,
  GeneratedQuestion,
  QuestionCategory,
  SaveCallMetadataRequest,
  PauseMetrics,
  UserContextResponse,
  VapiResumeDataResponse,
  VapiUserDataResponse,
} from '../types/vapi.types';
import { questionGeneratorAgent } from '../agents';

const CONTEXT_CHAR_LIMIT = 3000;

const trimContext = (value: string): string => {
  if (value.length <= CONTEXT_CHAR_LIMIT) return value;
  return `${value.slice(0, CONTEXT_CHAR_LIMIT)}... [truncated]`;
};

const buildSystemPrompt = (
  profile: NonNullable<VapiUserDataResponse['data']>,
  resume: VapiResumeDataResponse['data'] | null
): string => {
  const company = profile.targetCompany || 'a top tech company';
  const role = profile.targetRole || 'Software Engineer';

  const profileSection = [
    'Candidate Profile:',
    `- Target Role: ${role}`,
    `- Target Company: ${company}`,
    `- Seniority Level: ${profile.level || 'Not provided'}`,
  ].join('\n');

  const resumeSummary = resume?.parsedData
    ? trimContext(JSON.stringify(resume.parsedData, null, 2))
    : 'Resume data unavailable. Ask the user for recent experience and projects.';

  const resumeSection = [
    'Resume Snapshot:',
    resume?.fileName ? `- File: ${resume.fileName}` : '- File: Not uploaded yet',
    resume?.confidence !== null && resume?.confidence !== undefined
      ? `- Parsing confidence: ${resume.confidence}`
      : '- Parsing confidence: Unknown',
    `- Parsed details (JSON): ${resumeSummary}`,
  ].join('\n');

  const instructions = [
    `You are an expert technical interviewer at ${company}.`,
    `Your goal is to conduct a realistic, rigorous, yet encouraging interview for the ${role} position.`,
    '',
    'INTERVIEW GUIDELINES:',
    '1.  **Persona**: Act exactly like a real interviewer. Be professional, attentive, and structured. Do not break character.',
    '2.  **Flow**:',
    '    -   **Introduction**: Briefly welcome the candidate and ask them to introduce themselves.',
    '    -   **Experience Deep Dive**: Ask 1-2 questions about their recent work or specific projects from their resume.',
    '    -   **Technical Assessment**: Ask 2-3 technical questions relevant to the role and their stack.',
    '    -   **Behavioral**: Ask 1 behavioral question (e.g., conflict resolution, leadership).',
    '    -   **Closing**: Ask if they have any questions for you.',
    '3.  **Interaction Style**:',
    '    -   Listen actively. If an answer is vague, ask a follow-up question.',
    '    -   If the candidate struggles, provide a small hint but do not give the answer immediately.',
    '    -   Keep responses concise (under 3 sentences usually) to let the candidate speak more.',
    '4.  **Context Usage**:',
    '    -   Reference their specific projects (e.g., "I saw you worked on Project X...") to show you\'ve read their resume.',
    '    -   Tailor questions to the seniority level mentioned.',
  ].join('\n');

  return [instructions, '---', 'CONTEXT DATA:', profileSection, resumeSection].join('\n\n');
};

const buildFirstMessage = (
  profile: NonNullable<VapiUserDataResponse['data']>
): string => {
  const company = profile.targetCompany || 'our company';
  const role = profile.targetRole || 'the role';
  return `Hello! I'm your interviewer from ${company}. I've reviewed your application for the ${role} position. To get us started, could you please introduce yourself and tell me a bit about your background?`;
};

export const getUserData = async (userId: string): Promise<VapiUserDataResponse> => {
  const profile = await profileService.getProfile(userId);
  
  if (!profile) {
    return { error: 'Profile not found', data: null };
  }

  return {
    error: null,
    data: {
      targetRole: profile.targetRole,
      targetCompany: profile.targetCompany,
      level: profile.level,
    },
  };
};

export const getResumeData = async (userId: string): Promise<VapiResumeDataResponse> => {
  const document = await documentService.getResumeData(userId);

  if (!document) {
    return { error: 'Resume not found', data: null };
  }

  return {
    error: null,
    data: {
      fileName: document.fileName,
      status: document.status,
      parsedData: document.parsedData,
      confidence: document.confidence,
    },
  };
};

export const getUserContext = async (userId: string, targetId?: string): Promise<UserContextResponse> => {
  const [profileResult, resumeResult] = await Promise.all([
    getUserData(userId),
    getResumeData(userId),
  ]);

  if (profileResult.error || !profileResult.data) {
    return {
      error: 'User profile required to build context',
      systemPrompt: '',
      firstMessage: '',
      data: null,
    };
  }

  // Override with specific target if provided
  if (targetId) {
    const target = await targetService.getTargetById(targetId, userId);
    if (target) {
      profileResult.data.targetCompany = target.companyName;
      profileResult.data.targetRole = target.role;
    }
  }

  const systemPrompt = buildSystemPrompt(profileResult.data, resumeResult.data);
  const firstMessage = buildFirstMessage(profileResult.data);

  return {
    error: null,
    systemPrompt,
    firstMessage,
    data: {
      profile: profileResult.data,
      resume: resumeResult.data,
    },
  };
};

export const getQuestions = async (
  userId: string,
  args: GetQuestionsArgs
): Promise<{ error: string | null; data: GeneratedQuestion[] | null }> => {
  const category: QuestionCategory = args.category || 'mixed';
  const limit = args.limit || 5;

  const [profileResult, resumeResult] = await Promise.all([
    getUserData(userId),
    getResumeData(userId),
  ]);

  if (profileResult.error || !profileResult.data) {
    return { error: 'User profile required to generate questions', data: null };
  }

  const context = {
    targetRole: profileResult.data.targetRole,
    targetCompany: profileResult.data.targetCompany,
    level: profileResult.data.level,
    resumeData: resumeResult.data?.parsedData || null,
  };

  const result = await questionGeneratorAgent.generate(context, category, limit);

  if (result.error) {
    return { error: result.error, data: null };
  }

  return { error: null, data: result.questions };
};

export const evaluateAnswer = async (question: string, answer: string) => {
  console.log('Evaluating:', question, answer);
  // TODO: Integrate with LLM for real evaluation
  return {
    score: 7,
    feedback: "That's a reasonable approach. Can you elaborate on the trade-offs?",
    isCorrect: true
  };
};

export const provideHint = async (question: string) => {
  console.log('Providing hint for:', question);
  // TODO: Integrate with LLM for real hint generation
  return {
    hint: "Consider using a hash map to optimize the lookup time."
  };
};

export const endRound = async (interviewId: string, roundType: string) => {
  console.log('Ending round:', roundType, 'for interview:', interviewId);
  // TODO: Update interview state in DB
  return {
    message: `Round ${roundType} completed.`,
    nextRound: "technical"
  };
};

export const generateReport = async (interviewId: string) => {
  console.log('Generating report for:', interviewId);
  // TODO: Aggregate real scores from DB
  return {
    totalScore: 85,
    summary: "Strong technical skills, good communication.",
    improvementPlan: ["Practice system design", "Review dynamic programming"]
  };
};

type Utterance = {
  role: string;
  start: number;
  end: number;
  text?: string;
};

const computePauseMetrics = (utterances: Utterance[]): PauseMetrics => {
  if (!utterances.length) {
    return {
      pauses: [],
      bucketCounts: { micro: 0, short: 0, long: 0, very_long: 0 },
      longest: 0,
      average: 0,
      totalSilence: 0,
      utteranceCount: 0,
    };
  }

  const sorted = [...utterances].sort((a, b) => a.start - b.start);
  const pauses: PauseMetrics['pauses'] = [];
  const bucketCounts = { micro: 0, short: 0, long: 0, very_long: 0 };

  for (let i = 0; i < sorted.length - 1; i += 1) {
    const gap = sorted[i + 1].start - sorted[i].end;
    if (gap < 0) continue;
    let bucket: PauseMetrics['pauses'][number]['bucket'] = 'very_long';
    if (gap < 1.5) bucket = 'micro';
    else if (gap < 3) bucket = 'short';
    else if (gap < 6) bucket = 'long';
    bucketCounts[bucket] += 1;
    pauses.push({
      fromRole: sorted[i].role,
      toRole: sorted[i + 1].role,
      gapSeconds: parseFloat(gap.toFixed(2)),
      bucket,
    });
  }

  const longest = pauses.reduce((acc, p) => Math.max(acc, p.gapSeconds), 0);
  const totalSilence = pauses.reduce((acc, p) => acc + p.gapSeconds, 0);
  const average = pauses.length ? parseFloat((totalSilence / pauses.length).toFixed(2)) : 0;

  return {
    pauses,
    bucketCounts,
    longest,
    average,
    totalSilence: parseFloat(totalSilence.toFixed(2)),
    utteranceCount: utterances.length,
  };
};

const parseUtterances = (call: any): Utterance[] => {
  const messages = Array.isArray(call?.messages) ? call.messages : [];
  const startedAtMs = call?.startedAt ? new Date(call.startedAt).getTime() : null;

  return messages
    .map((m: any) => {
      const role = m.role || m.speaker || 'unknown';
      const start =
        typeof m.secondsFromStart === 'number'
          ? m.secondsFromStart
          : typeof m.time === 'number' && startedAtMs
          ? (m.time - startedAtMs) / 1000
          : null;
      const durationSeconds =
        typeof m.duration === 'number'
          ? m.duration > 120 ? m.duration / 1000 : m.duration // heuristic: Vapi duration appears in ms
          : typeof m.endTime === 'number' && typeof m.time === 'number'
          ? (m.endTime - m.time) / 1000
          : 0;
      const end = start != null ? start + (durationSeconds || 0) : null;
      if (start == null || end == null) return null;
      return {
        role,
        start,
        end,
        text: m.message || m.content || m.text,
      } as Utterance;
    })
    .filter(Boolean) as Utterance[];
};

export const saveCallMetadata = async (userId: string, payload: SaveCallMetadataRequest) => {
  const db = prisma as any;

  const interview = await db.interview.findFirst({
    where: { id: payload.interviewId, userId },
  });

  if (!interview) {
    throw new Error('Interview not found or does not belong to user');
  }

  const apiKey = process.env.VAPI_API_KEY;
  if (!apiKey) {
    throw new Error('Missing VAPI_API_KEY environment variable');
  }

  const resp = await fetch(`https://api.vapi.ai/call/${payload.callId}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!resp.ok) {
    throw new Error(`Failed to fetch call details (status ${resp.status})`);
  }

  const callData = await resp.json() as {
    id?: string;
    assistantId?: string;
    status?: string;
    endedReason?: string;
    transcript?: string;
    recordingUrl?: string;
    stereoRecordingUrl?: string;
    logUrl?: string;
    messages?: any[];
    startedAt?: string;
    endedAt?: string;
  };

  const callStartedAt = callData?.startedAt ? new Date(callData.startedAt) : interview.startedAt ?? null;
  const callEndedAt = callData?.endedAt ? new Date(callData.endedAt) : null;
  const durationSeconds =
    callStartedAt && callEndedAt ? Math.max(0, Math.floor((callEndedAt.getTime() - callStartedAt.getTime()) / 1000)) : null;

  const utterances = parseUtterances(callData);
  const pauseMetrics = computePauseMetrics(utterances);

  // Update interview with call linkage and timing
  await db.interview.update({
    where: { id: payload.interviewId },
    data: {
      callId: payload.callId,
      startedAt: callStartedAt ?? undefined,
      endedAt: callEndedAt ?? undefined,
      durationSeconds: durationSeconds ?? undefined,
    },
  });

  // Avoid duplicating the same call transcript record
  const existing = await db.interviewTranscript.findFirst({
    where: { interviewId: payload.interviewId, callId: payload.callId },
  });

  if (!existing) {
    await db.interviewTranscript.create({
      data: {
        userId,
        interviewId: payload.interviewId,
        assistantId: callData?.assistantId || interview.assistantId || null,
        callId: payload.callId,
        startedAt: callStartedAt,
        endedAt: callEndedAt,
        durationSeconds: durationSeconds ?? null,
        transcript: {
          type: 'vapi_call',
          callId: callData?.id || payload.callId,
          status: callData?.status,
          endedReason: callData?.endedReason,
          transcriptText: callData?.transcript,
          recordingUrl: callData?.recordingUrl,
          stereoRecordingUrl: callData?.stereoRecordingUrl,
          logUrl: callData?.logUrl,
          messages: callData?.messages || [],
          pauseMetrics,
          utterances,
        },
      },
    });
  } else {
    await db.interviewTranscript.update({
      where: { id: existing.id },
      data: {
        assistantId: callData?.assistantId || interview.assistantId || null,
        startedAt: callStartedAt,
        endedAt: callEndedAt,
        durationSeconds: durationSeconds ?? null,
        transcript: {
          ...(existing.transcript as any),
          recordingUrl: callData?.recordingUrl,
          stereoRecordingUrl: callData?.stereoRecordingUrl,
          logUrl: callData?.logUrl,
          pauseMetrics,
          utterances,
          status: callData?.status,
          endedReason: callData?.endedReason,
          transcriptText: callData?.transcript,
        },
      },
    });
  }

  return {
    pauseMetrics,
    callId: callData?.id || payload.callId,
    startedAt: callStartedAt?.toISOString() || null,
    endedAt: callEndedAt?.toISOString() || null,
    recordingUrl: callData?.recordingUrl || null,
    stereoRecordingUrl: callData?.stereoRecordingUrl || null,
    transcriptText: callData?.transcript || null,
  };
};


