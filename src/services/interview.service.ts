import { prisma } from '../utils/prisma.util';
import { StartInterviewRequest, SaveAnalysisRequest, AnalysisResult } from '../types/interview.types';
import genai, { geminiConfig } from '../utils/gemini.util';
import { SaveTranscriptRequest } from '../types/transcript.types';

export const getInterviews = async (userId: string) => {
  const db = prisma as any; // cast until Prisma types are regenerated

  return db.interview.findMany({
    where: { userId },
    include: {
      analysis: true,
      transcripts: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
    orderBy: { createdAt: 'desc' },
  });
};

export const getInterviewById = async (userId: string, interviewId: string) => {
  const db = prisma as any; // cast until Prisma types are regenerated

  const interview = await db.interview.findFirst({
    where: { id: interviewId, userId },
    include: {
      analysis: true,
      transcripts: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!interview) {
    throw new Error('Interview not found or does not belong to user');
  }

  return interview;
};

export const createInterview = async (userId: string, payload: StartInterviewRequest) => {
  const startedAt = payload.startedAt ? new Date(payload.startedAt) : new Date();

  const db = prisma as any; // cast until Prisma types are regenerated

  return db.interview.create({
    data: {
      userId,
      assistantId: payload.assistantId || null,
      callId: payload.callId || null,
      startedAt,
      contextPrompt: payload.contextPrompt || null,
    },
  });
};

export const saveAnalysis = async (userId: string, payload: SaveAnalysisRequest) => {
  const db = prisma as any; // cast until Prisma types are regenerated

  const interview = await db.interview.findFirst({
    where: { id: payload.interviewId, userId },
  });

  if (!interview) {
    throw new Error('Interview not found or does not belong to user');
  }

  return db.interviewAnalysis.upsert({
    where: { interviewId: payload.interviewId },
    update: {
      technical: payload.technical ?? undefined,
      problemSolving: payload.problemSolving ?? undefined,
      communication: payload.communication ?? undefined,
      roleKnowledge: payload.roleKnowledge ?? undefined,
      experience: payload.experience ?? undefined,
      professional: payload.professional ?? undefined,
      overall: payload.overall ?? undefined,
      modelVersion: payload.modelVersion ?? undefined,
    },
    create: {
      interviewId: payload.interviewId,
      technical: payload.technical ?? null,
      problemSolving: payload.problemSolving ?? null,
      communication: payload.communication ?? null,
      roleKnowledge: payload.roleKnowledge ?? null,
      experience: payload.experience ?? null,
      professional: payload.professional ?? null,
      overall: payload.overall ?? null,
      modelVersion: payload.modelVersion ?? null,
    },
  });
};

const ANALYSIS_MODEL = process.env.ANALYSIS_MODEL_NAME || process.env.MODEL_NAME || 'gemini-1.5-pro';

const RUBRIC_WEIGHTS: Record<string, number> = {
  problemSolving: 0.20,
  technical: 0.20,
  roleKnowledge: 0.20,
  experience: 0.15,
  communication: 0.15,
  professional: 0.10,
};

type TranscriptEntry = SaveTranscriptRequest['transcript'][number];

const buildAnalysisPrompt = (params: {
  transcript: TranscriptEntry[];
  contextPrompt?: string | null;
}) => {
  return `
You are an interview evaluator. Given the transcript and (optional) context, produce JSON with scores (0-10) and short notes for each rubric, plus an overall summary. Use the following weights to compute overall_score:
- Problem-solving: 20%
- Technical Competency: 20%
- Role-specific Knowledge: 20%
- Experience: 15%
- Communication: 15%
- Professional Demeanor: 10%

Output JSON with this shape:
{
  "problemSolving": { "score": number, "notes": string },
  "technical": { "score": number, "notes": string },
  "roleKnowledge": { "score": number, "notes": string },
  "experience": { "score": number, "notes": string },
  "communication": { "score": number, "notes": string },
  "professional": { "score": number, "notes": string },
  "overall": { "score": number, "notes": string }
}

Transcript (JSON):
${JSON.stringify(params.transcript, null, 2)}

Context (if any):
${params.contextPrompt || 'None'}
`;
};

const toDimension = (val: any): { score?: number | null; notes?: string | null; source?: string } => {
  if (!val) return {};
  return {
    score: typeof val.score === 'number' ? val.score : null,
    notes: typeof val.notes === 'string' ? val.notes : null,
  };
};

const computeWeightedOverall = (scores: Record<string, number | null | undefined>): number | null => {
  let total = 0;
  let weightSum = 0;
  (Object.keys(RUBRIC_WEIGHTS) as Array<keyof typeof RUBRIC_WEIGHTS>).forEach((key) => {
    const score = scores[key];
    if (typeof score === 'number') {
      const w = RUBRIC_WEIGHTS[key];
      total += score * w;
      weightSum += w;
    }
  });
  if (weightSum === 0) return null;
  // Scores are 0-10; weighted average stays in that range
  return parseFloat((total / weightSum).toFixed(2));
};

export const analyzeInterview = async (userId: string, interviewId: string) => {
  const db = prisma as any; // cast until Prisma types are regenerated

  const interview = await db.interview.findFirst({
    where: { id: interviewId, userId },
    include: {
      transcripts: { orderBy: { createdAt: 'asc' } },
      analysis: true,
    },
  });

  if (!interview) {
    throw new Error('Interview not found or does not belong to user');
  }

  const transcript = interview.transcripts?.[0]?.transcript as TranscriptEntry[] | undefined;
  if (!transcript || !transcript.length) {
    throw new Error('Transcript not found for interview');
  }

  const prompt = buildAnalysisPrompt({
    transcript,
    contextPrompt: interview.contextPrompt || undefined,
  });

  const response = await genai.models.generateContent({
    model: ANALYSIS_MODEL,
    config: {
      ...geminiConfig,
      responseMimeType: 'application/json',
    },
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }],
      },
    ],
  });

  const content = response.text || '{}';
  let parsed: any = {};
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error('Failed to parse analysis response');
  }

  const result: AnalysisResult = {
    problemSolving: toDimension(parsed.problemSolving),
    technical: toDimension(parsed.technical),
    roleKnowledge: toDimension(parsed.roleKnowledge),
    experience: toDimension(parsed.experience),
    communication: toDimension(parsed.communication),
    professional: toDimension(parsed.professional),
    overall: toDimension(parsed.overall),
    modelVersion: ANALYSIS_MODEL,
  };

  // If model did not provide overall score, compute weighted
  if (!result.overall?.score) {
    const overallScore = computeWeightedOverall({
      problemSolving: result.problemSolving?.score,
      technical: result.technical?.score,
      roleKnowledge: result.roleKnowledge?.score,
      experience: result.experience?.score,
      communication: result.communication?.score,
      professional: result.professional?.score,
    });
    result.overall = {
      ...(result.overall || {}),
      score: overallScore,
      notes: result.overall?.notes || 'Weighted average of rubric scores',
    };
  }

  // Merge with existing analysis (retain professional if already set)
  const merged: SaveAnalysisRequest = {
    interviewId,
    technical: result.technical,
    problemSolving: result.problemSolving,
    communication: result.communication,
    roleKnowledge: result.roleKnowledge,
    experience: result.experience,
    professional: result.professional ?? interview.analysis?.professional ?? null,
    overall: result.overall,
    modelVersion: result.modelVersion,
  };

  const saved = await saveAnalysis(userId, merged);
  return saved;
};

