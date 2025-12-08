import { BaseAgent, AgentResult } from '../base/base.agent';
import genai, { geminiConfig } from '../../utils/gemini.util';
import { ProcessingStatus } from '../../types/resume.types';

const AGENT_VERSION = '1.0.0';
const MODEL = 'gemini-flash-latest';

export class ResumeParserAgent extends BaseAgent {
  constructor() {
    super(AGENT_VERSION);
  }

  async parse(rawText: string): Promise<AgentResult> {
    try {
      const prompt = `Parse this resume and extract key information. Return a JSON object with:
- summary: brief professional summary
- skills: array of skills
- experience: array of {company, role, duration, highlights}
- education: array of {institution, degree, field, year}
- projects: array of {name, description, technologies} (if any)

Resume:
${rawText}

Return ONLY valid JSON, no extra text.`;

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

      const content = response.text || '{}';
      const tokenUsage = response.usageMetadata?.totalTokenCount || 0;

      return {
        output: JSON.parse(content),
        confidence: 0.85,
        tokenUsage,
        status: ProcessingStatus.COMPLETED,
      };
    } catch (error) {
      return {
        output: {},
        confidence: 0,
        tokenUsage: 0,
        status: ProcessingStatus.FAILED,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

export const resumeParserAgent = new ResumeParserAgent();
