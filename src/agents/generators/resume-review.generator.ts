import genai, { geminiConfig } from '../../utils/gemini.util';
import dotenv from 'dotenv';
dotenv.config();

const MODEL = process.env.MODEL_NAME || 'gemini-1.5-flash';

export class ResumeReviewGenerator {
  async generate(resumeData: any): Promise<string> {
    try {
      const prompt = `
      You are an expert technical recruiter. 
      Analyze the following resume details and return a strictly formatted review.
      
      Resume Data: ${JSON.stringify(resumeData)}
      
      Requirements:
      1. Use proper Markdown formatting.
      2. Include these sections: "Strengths", "Areas for Improvement", and "Actionable Feedback".
      3. Do NOT include conversational filler (e.g., "Here is your review"). Just return the markdown.
      `;

      const response = await genai.models.generateContent({
        model: MODEL,
        config: {
          ...geminiConfig,
          responseMimeType: 'text/plain',
        },
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }],
          },
        ],
      });

      return response.text || '';
    } catch (error) {
      console.error('Resume review generation failed:', error);
      throw new Error('Failed to generate resume review');
    }
  }
}
