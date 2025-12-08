import genai, { geminiConfig } from '../../utils/gemini.util';
import { GeneratedQuestion, QuestionCategory } from '../../types/vapi.types';
import { randomUUID } from 'crypto';
import dotenv from 'dotenv';
dotenv.config();

const AGENT_VERSION = '1.0.0';
const MODEL = process.env.MODEL_NAME || 'gemini-flash-latest';

interface GenerationContext {
  targetRole: string | null;
  targetCompany: string | null;
  level: string | null;
  resumeData: Record<string, unknown> | null;
}

interface GenerationResult {
  questions: GeneratedQuestion[];
  tokenUsage: number;
  error?: string;
}

export class QuestionGeneratorAgent {
  private agentVersion: string;

  constructor() {
    this.agentVersion = AGENT_VERSION;
  }

  async generate(
    context: GenerationContext,
    category: QuestionCategory,
    limit: number
  ): Promise<GenerationResult> {
    try {
      const prompt = this.buildPrompt(context, category, limit);

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

      const content = response.text || '[]';
      const tokenUsage = response.usageMetadata?.totalTokenCount || 0;
      const parsed = JSON.parse(content);

      const questions: GeneratedQuestion[] = (parsed.questions || parsed).map(
        (q: { question: string; category?: string; difficulty?: string; context?: string }) => ({
          id: randomUUID(),
          question: q.question,
          category: q.category || category,
          difficulty: q.difficulty || 'medium',
          context: q.context,
        })
      );

      return { questions, tokenUsage };
    } catch (error) {
      return {
        questions: [],
        tokenUsage: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private buildPrompt(
    context: GenerationContext,
    category: QuestionCategory,
    limit: number
  ): string {
    const { targetRole, targetCompany, level, resumeData } = context;

    let prompt = `You are an expert interview question generator. Generate ${limit} interview questions.\n\n`;

    prompt += `**Candidate Context:**\n`;
    prompt += `- Target Role: ${targetRole || 'Not specified'}\n`;
    prompt += `- Target Company: ${targetCompany || 'Not specified'}\n`;
    prompt += `- Experience Level: ${level || 'Not specified'}\n\n`;

    if (resumeData) {
      prompt += `**Resume Data:**\n${JSON.stringify(resumeData, null, 2)}\n\n`;
    }

    prompt += `**Question Category:** ${category}\n`;
    if (category === 'technical') {
      prompt += `Focus on technical skills, problem-solving, system design, and coding concepts relevant to the role.\n`;
    } else if (category === 'behavioral') {
      prompt += `Focus on past experiences, teamwork, conflict resolution, leadership, and cultural fit.\n`;
    } else {
      prompt += `Include a mix of technical and behavioral questions.\n`;
    }

    prompt += `\n**Company Style:**\n`;
    if (targetCompany) {
      prompt += `Tailor questions to ${targetCompany}'s known interview style and values.\n`;
    }

    prompt += `\nReturn a JSON object with a "questions" array. Each question should have:
- question: the interview question text
- category: "technical" or "behavioral"
- difficulty: "easy", "medium", or "hard"
- context: optional context about why this question is relevant

Return ONLY valid JSON, no extra text.`;

    return prompt;
  }

  getVersion(): string {
    return this.agentVersion;
  }
}

export const questionGeneratorAgent = new QuestionGeneratorAgent();
