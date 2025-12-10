import genai, { geminiConfig } from '../../utils/gemini.util';
import dotenv from 'dotenv';
dotenv.config();

// const AGENT_VERSION = '1.0.0';
const MODEL = process.env.MODEL_NAME || 'gemini-flash-latest';

interface FeedbackContext {
  transcript: string;
  targetRole?: string | null;
  targetCompany?: string | null;
  level?: string | null;
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
    return `
You are an expert technical interviewer and career coach. Analyze the following interview transcript and provide detailed, constructive feedback.

**Context:**
- Target Role: ${context.targetRole || 'Not specified'}
- Target Company: ${context.targetCompany || 'Not specified'}
- Level: ${context.level || 'Not specified'}

**Transcript:**
${context.transcript}

**Instructions:**
Analyze the candidate's performance in the following areas:
1. Technical Skills (Hard skills, coding, system design if applicable)
2. Problem Solving (Approach, logic, adaptability)
3. Communication (Clarity, conciseness, listening)
4. Role Knowledge (Understanding of the specific role and responsibilities)
5. Experience (Relevance and depth of past experience)
6. Professionalism (Attitude, demeanor, cultural fit)
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
