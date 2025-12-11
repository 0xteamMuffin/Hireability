import genai, { geminiConfig } from "../../utils/gemini.util";
import dotenv from "dotenv";
dotenv.config();

const MODEL = process.env.MODEL_NAME || "gemini-1.5-flash";

export class ResumeReviewGenerator {
  async generate(resumeData: any): Promise<string> {
    try {
      const prompt = `
You are an expert technical recruiter. Analyze the following resume data.

Evaluate the resume based on these weighted metrics:
1. Impact & Content (40%)
2. ATS Compatibility (25%)
3. Keywords/Relevance (20%)
4. Formatting/UX (10%)
5. Grammar (5%)

Return a single VALID JSON object (no Markdown code blocks) with the following structure:
{
  "scores": {
    "impact": <integer_0_to_100>,
    "ats": <integer_0_to_100>,
    "keywords": <integer_0_to_100>,
    "formatting": <integer_0_to_100>,
    "grammar": <integer_0_to_100>,
    "total": <calculated_weighted_average>
  },
  "review": {
    "summary": "<A medium-length, professional paragraph summarizing the candidate's employability>",
    "strengths": ["<strength_1>", "<strength_2>"],
    "actionableFeedback": ["<specific_improvement_1>", "<specific_improvement_2>"]
  }
}

Resume Data: ${JSON.stringify(resumeData)}
`;

      const response = await genai.models.generateContent({
        model: MODEL,
        config: {
          ...geminiConfig,
          responseMimeType: "text/plain",
        },
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
      });

      return response.text || "";
    } catch (error) {
      console.error("Resume review generation failed:", error);
      throw new Error("Failed to generate resume review");
    }
  }
}
