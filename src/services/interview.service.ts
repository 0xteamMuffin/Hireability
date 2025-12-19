import { prisma } from '../utils/prisma.util';
import {
  StartInterviewRequest,
  SaveAnalysisRequest,
  AnalysisResult,
} from '../types/interview.types';
import genai, { geminiConfig } from '../utils/gemini.util';
import { SaveTranscriptRequest } from '../types/transcript.types';
import { FeedbackGeneratorAgent } from '../agents/generators/feedback.generator';
import { PauseMetrics } from '../types/vapi.types';
import { RoundType, ROUND_ANALYSIS_WEIGHTS } from '../types/round.types';

export const getInterviews = async (userId: string) => {
  const db = prisma as any;

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
  const db = prisma as any;

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

  const db = prisma as any;

  return db.interview.create({
    data: {
      userId,
      assistantId: payload.assistantId || null,
      callId: payload.callId || null,
      startedAt,
      contextPrompt: payload.contextPrompt || null,
      sessionId: payload.sessionId || null,
      roundType: payload.roundType || null,
    },
  });
};

export const saveAnalysis = async (userId: string, payload: SaveAnalysisRequest) => {
  const db = prisma as any;

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

const ANALYSIS_MODEL =
  process.env.ANALYSIS_MODEL_NAME || process.env.MODEL_NAME || 'gemini-1.5-pro';

const DEFAULT_RUBRIC_WEIGHTS: Record<string, number> = {
  problemSolving: 0.2,
  technical: 0.2,
  roleKnowledge: 0.2,
  experience: 0.15,
  communication: 0.15,
  professional: 0.1,
};

/**
 * Get analysis weights based on round type
 */
const getWeightsForRound = (roundType?: RoundType | string | null): Record<string, number> => {
  if (roundType && roundType in ROUND_ANALYSIS_WEIGHTS) {
    return ROUND_ANALYSIS_WEIGHTS[roundType as RoundType];
  }
  return DEFAULT_RUBRIC_WEIGHTS;
};

type TranscriptEntry = SaveTranscriptRequest['transcript'][number];

const buildAnalysisPrompt = (params: {
  transcript: TranscriptEntry[];
  contextPrompt?: string | null;
  averageExpressions?: Record<string, number> | null;
  pauseMetrics?: PauseMetrics | null;
}) => {
  let speechAnalysisSection = '';

  if (params.pauseMetrics) {
    const pm = params.pauseMetrics;
    speechAnalysisSection = `
**Speech Analysis - Pause Metrics:**
- Average pause duration: ${pm.average.toFixed(2)} seconds
- Longest pause: ${pm.longest.toFixed(2)} seconds
- Total silence time: ${pm.totalSilence.toFixed(2)} seconds
- Utterance count: ${pm.utteranceCount}
- Pause distribution:
  * Micro pauses (<1.5s): ${pm.bucketCounts.micro}
  * Short pauses (1.5-3s): ${pm.bucketCounts.short}
  * Long pauses (3-6s): ${pm.bucketCounts.long}
  * Very long pauses (>6s): ${pm.bucketCounts.very_long}

Use pause metrics to evaluate communication flow, confidence, and response time. Frequent very long pauses may indicate hesitation or difficulty formulating answers. Consider this when evaluating Communication and Professional dimensions.`;
  }

  let expressionSection = '';
  if (params.averageExpressions) {
    const exp = params.averageExpressions;
    expressionSection = `
**Facial Expression Analysis:**
- Happy: ${(exp.happy || 0).toFixed(2)}
- Neutral: ${(exp.neutral || 0).toFixed(2)}
- Sad: ${(exp.sad || 0).toFixed(2)}
- Angry: ${(exp.angry || 0).toFixed(2)}
- Fearful: ${(exp.fearful || 0).toFixed(2)}
- Surprised: ${(exp.surprised || 0).toFixed(2)}
- Disgusted: ${(exp.disgusted || 0).toFixed(2)}

Use average expressions to assess professional demeanor and emotional state. Higher happy/neutral scores indicate positive engagement and confidence. Lower scores in negative emotions (sad, angry, fearful) are positive indicators. Consider these when evaluating the Professional dimension and overall communication effectiveness.`;
  }

  return `
You are an interview evaluator. Given the transcript and (optional) context, produce JSON with scores (0-10) and short notes for each rubric, plus an overall summary. Use the following weights to compute overall_score:
- Problem-solving: 20%
- Technical Competency: 20%
- Role-specific Knowledge: 20%
- Experience: 15%
- Communication: 15%
- Professional Demeanor: 10%

${speechAnalysisSection}

${expressionSection}

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

const toDimension = (
  val: any,
): { score?: number | null; notes?: string | null; source?: string } => {
  if (!val) return {};
  return {
    score: typeof val.score === 'number' ? val.score : null,
    notes: typeof val.notes === 'string' ? val.notes : null,
  };
};

const computeWeightedOverall = (
  scores: Record<string, number | null | undefined>,
  weights: Record<string, number> = DEFAULT_RUBRIC_WEIGHTS,
): number | null => {
  let total = 0;
  let weightSum = 0;
  Object.keys(weights).forEach((key) => {
    const score = scores[key];
    if (typeof score === 'number') {
      const w = weights[key];
      total += score * w;
      weightSum += w;
    }
  });
  if (weightSum === 0) return null;

  return parseFloat((total / weightSum).toFixed(2));
};

export const analyzeInterview = async (userId: string, interviewId: string) => {
  const db = prisma as any;

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

  const transcriptData = interview.transcripts?.[0]?.transcript as any;
  if (!transcriptData) {
    throw new Error('Transcript not found for interview');
  }

  let transcript: TranscriptEntry[] = [];
  if (Array.isArray(transcriptData)) {
    transcript = transcriptData;
  } else if (transcriptData.messages && Array.isArray(transcriptData.messages)) {
    transcript = transcriptData.messages;
  } else if (typeof transcriptData === 'object') {
    const entries = Object.keys(transcriptData)
      .filter(
        (key) =>
          key !== 'status' &&
          key !== 'utterances' &&
          key !== 'pauseMetrics' &&
          key !== 'averageExpressions',
      )
      .map((key) => transcriptData[key])
      .filter((entry: any) => entry && typeof entry === 'object' && entry.role && entry.text);
    transcript = entries;
  }

  if (!transcript || !transcript.length) {
    throw new Error('Transcript not found for interview');
  }

  const averageExpressions = transcriptData.averageExpressions || null;
  const pauseMetrics = transcriptData.pauseMetrics || null;

  const prompt = buildAnalysisPrompt({
    transcript,
    contextPrompt: interview.contextPrompt || undefined,
    averageExpressions,
    pauseMetrics,
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

  if (!result.overall?.score) {
    const roundWeights = getWeightsForRound(interview.roundType);
    const overallScore = computeWeightedOverall(
      {
        problemSolving: result.problemSolving?.score,
        technical: result.technical?.score,
        roleKnowledge: result.roleKnowledge?.score,
        experience: result.experience?.score,
        communication: result.communication?.score,
        professional: result.professional?.score,
      },
      roundWeights,
    );
    result.overall = {
      ...(result.overall || {}),
      score: overallScore,
      notes:
        result.overall?.notes || `Weighted average for ${interview.roundType || 'general'} round`,
    };
  }

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

export const getStats = async (userId: string) => {
  const db = prisma as any;

  const interviews = await db.interview.findMany({
    where: { userId },
    include: {
      analysis: true,
    },
  });

  const totalInterviews = interviews.length;

  const totalDurationSeconds = interviews.reduce((acc: number, curr: any) => {
    return acc + (curr.durationSeconds || 0);
  }, 0);
  const hoursPracticed = (totalDurationSeconds / 3600).toFixed(1);

  let totalScore = 0;
  let scoredInterviews = 0;

  interviews.forEach((interview: any) => {
    const score = interview.analysis?.overall?.score;
    if (typeof score === 'number') {
      totalScore += score;
      scoredInterviews++;
    }
  });

  const avgScore = scoredInterviews > 0 ? Math.round(totalScore / scoredInterviews) : 0;

  return {
    totalInterviews,
    avgScore: `${avgScore}%`,
    hoursPracticed: `${hoursPracticed}h`,
  };
};

export const generateAnalysis = async (userId: string, interviewId: string) => {
  const db = prisma as any;

  const interview = await db.interview.findFirst({
    where: { id: interviewId, userId },
    include: {
      transcripts: true,
    },
  });

  if (!interview) {
    throw new Error('Interview not found');
  }

  const userProfile = await db.userProfile.findUnique({
    where: { userId },
  });

  let fullTranscriptText = '';
  let averageExpressions: Record<string, number> | null = null;
  let pauseMetrics: PauseMetrics | null = null;

  if (interview.transcripts && interview.transcripts.length > 0) {
    const sorted = interview.transcripts.sort(
      (a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );

    for (const t of sorted) {
      const transcriptData = t.transcript as any;

      if (!averageExpressions && transcriptData?.averageExpressions) {
        averageExpressions = transcriptData.averageExpressions;
      }
      if (!pauseMetrics && transcriptData?.pauseMetrics) {
        pauseMetrics = transcriptData.pauseMetrics;
      }

      if (typeof transcriptData === 'string') {
        fullTranscriptText += transcriptData + '\n';
      } else if (Array.isArray(transcriptData)) {
        fullTranscriptText +=
          transcriptData
            .map((m: any) => {
              const role = m.role || 'Unknown';
              const content = m.message || m.content || m.text || JSON.stringify(m);
              return `${role}: ${content}`;
            })
            .join('\n') + '\n';
      } else if (typeof transcriptData === 'object' && transcriptData !== null) {
        if (transcriptData.messages && Array.isArray(transcriptData.messages)) {
          fullTranscriptText +=
            transcriptData.messages
              .map((m: any) => {
                const role = m.role || 'Unknown';
                const content = m.message || m.content || m.text || JSON.stringify(m);
                return `${role}: ${content}`;
              })
              .join('\n') + '\n';
        } else {
          const entries = Object.keys(transcriptData)
            .filter(
              (key) =>
                key !== 'status' &&
                key !== 'utterances' &&
                key !== 'pauseMetrics' &&
                key !== 'averageExpressions',
            )
            .map((key) => transcriptData[key])
            .filter((entry: any) => entry && typeof entry === 'object' && entry.role && entry.text)
            .map((m: any) => {
              const role = m.role || 'Unknown';
              const content = m.text || m.message || m.content || JSON.stringify(m);
              return `${role}: ${content}`;
            });
          fullTranscriptText += entries.join('\n') + '\n';
        }
      }
    }
  }

  if (!fullTranscriptText.trim()) {
    throw new Error('No transcript available for analysis');
  }

  const agent = new FeedbackGeneratorAgent();
  const result = await agent.generate({
    transcript: fullTranscriptText,
    targetRole: userProfile?.targetRole,
    targetCompany: userProfile?.targetCompany,
    level: userProfile?.level,
    averageExpressions,
    pauseMetrics,
  });

  return db.interviewAnalysis.upsert({
    where: { interviewId },
    update: {
      technical: result.technical,
      problemSolving: result.problemSolving,
      communication: result.communication,
      roleKnowledge: result.roleKnowledge,
      experience: result.experience,
      professional: result.professional,
      overall: result.overall,
      modelVersion: process.env.MODEL_NAME || 'gemini-flash-latest',
    },
    create: {
      interviewId,
      technical: result.technical,
      problemSolving: result.problemSolving,
      communication: result.communication,
      roleKnowledge: result.roleKnowledge,
      experience: result.experience,
      professional: result.professional,
      overall: result.overall,
      modelVersion: process.env.MODEL_NAME || 'gemini-flash-latest',
    },
  });
};

export const deleteInterview = async (userId: string, interviewId: string): Promise<void> => {
  const db = prisma as any;

  const interview = await db.interview.findFirst({
    where: { id: interviewId, userId },
  });

  if (!interview) {
    throw new Error('Interview not found or does not belong to user');
  }

  await db.interview.delete({
    where: { id: interviewId },
  });
};
