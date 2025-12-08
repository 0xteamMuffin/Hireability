import { BaseAgent, AgentResult } from '../base/base.agent';
import openai from '../../utils/openai.util';
import { ProcessingStatus } from '../../types/resume.types';

const AGENT_VERSION = '1.0.0';

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

      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a resume parser. Return valid JSON only.' },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
      });

      const content = response.choices[0]?.message?.content || '{}';
      const tokenUsage = response.usage?.total_tokens || 0;

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
