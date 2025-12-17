import genai, { geminiConfig } from '../../utils/gemini.util';
import { PauseMetrics } from '../../types/vapi.types';
import dotenv from 'dotenv';
dotenv.config();

// const AGENT_VERSION = '1.0.0';
const MODEL = process.env.MODEL_NAME || 'gemini-flash-latest';

interface FeedbackContext {
  transcript: string;
  targetRole?: string | null;
  targetCompany?: string | null;
  level?: string | null;
  averageExpressions?: Record<string, number> | null;
  pauseMetrics?: PauseMetrics | null;
}

export interface FeedbackSection {
  score: number;
  strengths: string[];
  weaknesses: string[];
  improvements: string[];
  summary: string;
}

export interface FeedbackResult {
  technical: FeedbackSection;
  problemSolving: FeedbackSection;
  communication: FeedbackSection;
  roleKnowledge: FeedbackSection;
  experience: FeedbackSection;
  professional: FeedbackSection;
  overall: FeedbackSection;
  tokenUsage: number;
  error?: string;
}

export class FeedbackGeneratorAgent {
  // private agentVersion: string;

  constructor() {
    // this.agentVersion = AGENT_VERSION;
  }

  async generate(context: FeedbackContext): Promise<FeedbackResult> {
    try {
      const prompt = this.buildPrompt(context);

      const response = await genai.models.generateContent({
        model: MODEL,
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

      const result = response.text || '{}';
      const parsed = JSON.parse(result);

      return {
        ...parsed,
        tokenUsage: response.usageMetadata?.totalTokenCount || 0,
      };
    } catch (error) {
      console.error('Feedback generation failed:', error);
      throw new Error('Failed to generate feedback');
    }
  }

  private buildPrompt(context: FeedbackContext): string {
    let speechAnalysisSection = '';
    
    if (context.pauseMetrics) {
      const pm = context.pauseMetrics;
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
    if (context.averageExpressions) {
      const exp = context.averageExpressions;
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
You are an expert technical interviewer and career coach. Analyze the following interview transcript and provide detailed, constructive feedback.

**Context:**
- Target Role: ${context.targetRole || 'Not specified'}
- Target Company: ${context.targetCompany || 'Not specified'}
- Level: ${context.level || 'Not specified'}

${speechAnalysisSection}

${expressionSection}

**Transcript:**
${context.transcript}

**Instructions:**
Analyze the candidate's performance in the following areas:
1. Technical Skills (Hard skills, coding, system design if applicable)
2. Problem Solving (Approach, logic, adaptability)
3. Communication (Clarity, conciseness, listening, speech flow based on pause metrics)
4. Role Knowledge (Understanding of the specific role and responsibilities)
5. Experience (Relevance and depth of past experience)
6. Professionalism (Attitude, demeanor, cultural fit, facial expressions)
7. Overall Assessment

For EACH area, provide:
- A score from 0 to 100.
- A list of strengths (what they did well).
- A list of weaknesses (where they struggled).
- A list of specific improvements (actionable advice).
- A brief summary paragraph.

**Output Format:**
Return ONLY a valid JSON object with the following structure:
{
  "technical": { "score": number, "strengths": [], "weaknesses": [], "improvements": [], "summary": "" },
  "problemSolving": { "score": number, "strengths": [], "weaknesses": [], "improvements": [], "summary": "" },
  "communication": { "score": number, "strengths": [], "weaknesses": [], "improvements": [], "summary": "" },
  "roleKnowledge": { "score": number, "strengths": [], "weaknesses": [], "improvements": [], "summary": "" },
  "experience": { "score": number, "strengths": [], "weaknesses": [], "improvements": [], "summary": "" },
  "professional": { "score": number, "strengths": [], "weaknesses": [], "improvements": [], "summary": "" },
  "overall": { "score": number, "strengths": [], "weaknesses": [], "improvements": [], "summary": "" }
}
`;
  }
}
