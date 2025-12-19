/**
 * Answer Evaluator Agent
 * Real-time evaluation of candidate answers with scoring and feedback
 */

import genai, { geminiConfig } from '../../utils/gemini.util';
import {
  AnswerEvaluationResponse,
  QuestionCategory,
  Difficulty,
  RoundType,
} from '../../types/interview-state.types';
import dotenv from 'dotenv';
dotenv.config();

const MODEL = process.env.MODEL_NAME || 'gemini-2.0-flash';
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 2000;

interface EvaluationContext {
  question: string;
  category: QuestionCategory;
  difficulty: Difficulty;

  answer: string;

  targetRole?: string;
  targetCompany?: string;
  experienceLevel?: string;

  roundType: RoundType;
  questionsAsked: number;
  averageScore: number;

  codeSubmission?: string;
  codeLanguage?: string;
  testResults?: { passed: number; total: number };
}

export class AnswerEvaluatorAgent {
  /**
   * Sleep helper for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Check if error is a rate limit error
   */
  private isRateLimitError(error: unknown): boolean {
    if (error && typeof error === 'object') {
      const err = error as { status?: number; message?: string };
      return (
        err.status === 429 ||
        (err.message?.includes('429') ?? false) ||
        (err.message?.includes('quota') ?? false)
      );
    }
    return false;
  }

  /**
   * Evaluate a candidate's answer with retry logic
   */
  async evaluate(context: EvaluationContext): Promise<AnswerEvaluationResponse> {
    const prompt = this.buildPrompt(context);
    let lastError: unknown;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
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
        const parsed = JSON.parse(content);

        return {
          score: this.normalizeScore(parsed.score),
          feedback: parsed.feedback || 'Good answer.',
          strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
          improvements: Array.isArray(parsed.improvements) ? parsed.improvements : [],
          suggestFollowUp: parsed.suggestFollowUp ?? false,
          followUpQuestion: parsed.followUpQuestion || undefined,
          topicMastery: this.mapMastery(parsed.topicMastery),
        };
      } catch (error) {
        lastError = error;

        if (this.isRateLimitError(error) && attempt < MAX_RETRIES - 1) {
          const delay = BASE_DELAY_MS * Math.pow(2, attempt);
          console.log(
            `[AnswerEvaluator] Rate limited, retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`,
          );
          await this.sleep(delay);
          continue;
        }

        break;
      }
    }

    console.error('[AnswerEvaluator] Evaluation failed after retries:', lastError);
    return this.getFallbackEvaluation(context);
  }

  /**
   * Quick evaluation for real-time feedback (lighter prompt)
   */
  async quickEvaluate(
    question: string,
    answer: string,
    category: QuestionCategory,
  ): Promise<{ score: number; brief: string; needsFollowUp: boolean }> {
    const prompt = `Quickly evaluate this interview answer.

Question: ${question}
Answer: ${answer}
Category: ${category}

Respond with JSON:
{
  "score": <1-10>,
  "brief": "<one sentence feedback>",
  "needsFollowUp": <true if answer is vague or incomplete>
}`;

    try {
      const response = await genai.models.generateContent({
        model: MODEL,
        config: {
          ...geminiConfig,
          responseMimeType: 'application/json',
          maxOutputTokens: 200,
        },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      });

      const parsed = JSON.parse(response.text || '{}');
      return {
        score: this.normalizeScore(parsed.score),
        brief: parsed.brief || 'Noted.',
        needsFollowUp: parsed.needsFollowUp ?? false,
      };
    } catch {
      return { score: 5, brief: 'Answer received.', needsFollowUp: false };
    }
  }

  /**
   * Evaluate code submission specifically with retry logic
   */
  async evaluateCode(context: {
    problemDescription: string;
    code: string;
    language: string;
    testResults: { passed: number; total: number };
    executionOutput?: string;
    targetRole?: string;
    experienceLevel?: string;
  }): Promise<AnswerEvaluationResponse> {
    const prompt = this.buildCodeEvaluationPrompt(context);
    let lastError: unknown;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const response = await genai.models.generateContent({
          model: MODEL,
          config: {
            ...geminiConfig,
            responseMimeType: 'application/json',
          },
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
        });

        const parsed = JSON.parse(response.text || '{}');

        return {
          score: this.normalizeScore(parsed.score),
          feedback: parsed.feedback || 'Code reviewed.',
          strengths: parsed.strengths || [],
          improvements: parsed.improvements || [],
          suggestFollowUp: parsed.suggestFollowUp ?? false,
          followUpQuestion: parsed.followUpQuestion,
          topicMastery: this.mapMastery(parsed.topicMastery),
        };
      } catch (error) {
        lastError = error;

        if (this.isRateLimitError(error) && attempt < MAX_RETRIES - 1) {
          const delay = BASE_DELAY_MS * Math.pow(2, attempt);
          console.log(
            `[AnswerEvaluator] Code eval rate limited, retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`,
          );
          await this.sleep(delay);
          continue;
        }

        break;
      }
    }

    console.error('[AnswerEvaluator] Code evaluation failed after retries:', lastError);

    const passRate = context.testResults.passed / context.testResults.total;
    return {
      score: Math.round(passRate * 10),
      feedback: `Passed ${context.testResults.passed}/${context.testResults.total} test cases.`,
      strengths: passRate >= 0.5 ? ['Working solution'] : [],
      improvements: passRate < 1 ? ['Some test cases failing'] : [],
      suggestFollowUp: passRate >= 0.5 && passRate < 1,
      topicMastery: passRate >= 0.8 ? 'proficient' : passRate >= 0.5 ? 'intermediate' : 'novice',
    };
  }

  private buildPrompt(context: EvaluationContext): string {
    const categoryGuidelines = this.getCategoryGuidelines(context.category);
    const difficultyExpectations = this.getDifficultyExpectations(context.difficulty);

    return `You are an expert interviewer evaluating a candidate's answer.

**INTERVIEW CONTEXT:**
- Round Type: ${context.roundType}
- Target Role: ${context.targetRole || 'Software Engineer'}
- Target Company: ${context.targetCompany || 'Tech Company'}
- Experience Level: ${context.experienceLevel || 'Mid-level'}
- Questions Asked So Far: ${context.questionsAsked}
- Current Average Score: ${context.averageScore.toFixed(1)}/10

**QUESTION:**
${context.question}

**CATEGORY:** ${context.category}
${categoryGuidelines}

**DIFFICULTY:** ${context.difficulty}
${difficultyExpectations}

**CANDIDATE'S ANSWER:**
${context.answer}

${
  context.codeSubmission
    ? `
**CODE SUBMITTED:**
\`\`\`${context.codeLanguage || 'code'}
${context.codeSubmission}
\`\`\`
${context.testResults ? `Test Results: ${context.testResults.passed}/${context.testResults.total} passed` : ''}
`
    : ''
}

**EVALUATION CRITERIA:**
1. **Relevance** - Does the answer address the question?
2. **Depth** - Is there sufficient detail and examples?
3. **Clarity** - Is the communication clear and structured?
4. **Technical Accuracy** - Are technical details correct?
5. **Critical Thinking** - Does the answer show good judgment?

**OUTPUT FORMAT (JSON):**
{
  "score": <1-10 integer>,
  "feedback": "<2-3 sentence constructive feedback for the candidate>",
  "strengths": ["<strength 1>", "<strength 2>"],
  "improvements": ["<area to improve 1>", "<area to improve 2>"],
  "suggestFollowUp": <true if answer needs clarification or deeper probing>,
  "followUpQuestion": "<optional follow-up question if suggestFollowUp is true>",
  "topicMastery": "novice|intermediate|proficient|expert"
}

**SCORING GUIDE:**
- 1-3: Poor - Missing key points, incorrect, or irrelevant
- 4-5: Below Average - Partially addresses question, lacks depth
- 6-7: Good - Solid answer with room for improvement
- 8-9: Excellent - Comprehensive, clear, demonstrates expertise
- 10: Outstanding - Exceptional insight, exceeds expectations`;
  }

  private buildCodeEvaluationPrompt(context: {
    problemDescription: string;
    code: string;
    language: string;
    testResults: { passed: number; total: number };
    executionOutput?: string;
    targetRole?: string;
    experienceLevel?: string;
  }): string {
    return `You are evaluating a coding interview submission.

**PROBLEM:**
${context.problemDescription}

**CANDIDATE'S CODE (${context.language}):**
\`\`\`${context.language}
${context.code}
\`\`\`

**TEST RESULTS:**
- Passed: ${context.testResults.passed}/${context.testResults.total}
${context.executionOutput ? `- Output: ${context.executionOutput}` : ''}

**CONTEXT:**
- Target Role: ${context.targetRole || 'Software Engineer'}
- Experience Level: ${context.experienceLevel || 'Mid-level'}

**EVALUATION CRITERIA:**
1. **Correctness** - Does it pass test cases?
2. **Code Quality** - Readability, structure, naming
3. **Efficiency** - Time and space complexity
4. **Edge Cases** - Are edge cases handled?
5. **Best Practices** - Follows language conventions

**OUTPUT FORMAT (JSON):**
{
  "score": <1-10>,
  "feedback": "<constructive feedback about the solution>",
  "strengths": ["<what was done well>"],
  "improvements": ["<what could be better>"],
  "suggestFollowUp": <true to discuss the solution further>,
  "followUpQuestion": "<question about their approach, optimization, etc>",
  "topicMastery": "novice|intermediate|proficient|expert",
  "complexityAnalysis": {
    "time": "<O notation>",
    "space": "<O notation>"
  }
}`;
  }

  private getCategoryGuidelines(category: QuestionCategory): string {
    const guidelines: Record<QuestionCategory, string> = {
      [QuestionCategory.INTRODUCTION]: `
Evaluate: Self-presentation, communication clarity, relevance to role`,

      [QuestionCategory.EXPERIENCE]: `
Evaluate: Specific examples, impact described, relevant skills highlighted`,

      [QuestionCategory.BEHAVIORAL]: `
Evaluate: STAR method usage (Situation, Task, Action, Result), self-awareness, learning`,

      [QuestionCategory.TECHNICAL_CONCEPT]: `
Evaluate: Technical accuracy, depth of understanding, ability to explain clearly`,

      [QuestionCategory.PROBLEM_SOLVING]: `
Evaluate: Structured approach, consideration of alternatives, trade-off analysis`,

      [QuestionCategory.SYSTEM_DESIGN]: `
Evaluate: Requirements clarification, scalability considerations, component design`,

      [QuestionCategory.CODING]: `
Evaluate: Algorithm choice, code quality, complexity analysis, edge cases`,

      [QuestionCategory.CULTURE_FIT]: `
Evaluate: Values alignment, team collaboration, growth mindset`,

      [QuestionCategory.CLOSING]: `
Evaluate: Thoughtful questions, genuine interest, professionalism`,
    };

    return guidelines[category] || '';
  }

  private getDifficultyExpectations(difficulty: Difficulty): string {
    const expectations: Record<Difficulty, string> = {
      [Difficulty.EASY]: `
Expected: Basic understanding, straightforward answer, fundamental knowledge`,

      [Difficulty.MEDIUM]: `
Expected: Solid understanding, some depth, consideration of trade-offs`,

      [Difficulty.HARD]: `
Expected: Expert-level insight, nuanced analysis, creative problem-solving`,
    };

    return expectations[difficulty] || '';
  }

  private normalizeScore(score: unknown): number {
    const num = typeof score === 'number' ? score : parseInt(String(score), 10);
    if (isNaN(num)) return 5;
    return Math.max(1, Math.min(10, Math.round(num)));
  }

  private mapMastery(mastery: string): 'novice' | 'intermediate' | 'proficient' | 'expert' {
    const normalized = mastery?.toLowerCase();
    if (['expert', 'advanced'].includes(normalized)) return 'expert';
    if (['proficient', 'skilled'].includes(normalized)) return 'proficient';
    if (['intermediate', 'moderate'].includes(normalized)) return 'intermediate';
    return 'novice';
  }

  private getFallbackEvaluation(context: EvaluationContext): AnswerEvaluationResponse {
    const answerLength = context.answer?.length || 0;
    let score = 5;
    let feedback = 'Thank you for your answer.';
    const strengths: string[] = [];
    const improvements: string[] = [];

    if (answerLength < 50) {
      score = 4;
      feedback = 'I appreciate your response. Could you elaborate a bit more on that?';
      improvements.push('Consider providing more detail in your responses');
    } else if (answerLength < 150) {
      score = 5;
      feedback = 'Thank you for that answer. Let me note that down.';
    } else if (answerLength < 500) {
      score = 6;
      feedback = "Good answer with solid detail. I've noted that.";
      strengths.push('Provided a detailed response');
    } else {
      score = 7;
      feedback = 'Comprehensive answer. Thank you for the thorough explanation.';
      strengths.push('Thorough and detailed response');
    }

    const categoryFeedback: Record<QuestionCategory, string> = {
      [QuestionCategory.INTRODUCTION]: 'Good introduction.',
      [QuestionCategory.EXPERIENCE]: 'Thanks for sharing that experience.',
      [QuestionCategory.BEHAVIORAL]: "That's a helpful example to understand your approach.",
      [QuestionCategory.TECHNICAL_CONCEPT]: 'Thanks for explaining that concept.',
      [QuestionCategory.PROBLEM_SOLVING]: 'Interesting approach to the problem.',
      [QuestionCategory.SYSTEM_DESIGN]: 'Good thinking about the design considerations.',
      [QuestionCategory.CODING]: 'Thanks for walking through your approach.',
      [QuestionCategory.CULTURE_FIT]: 'Good to understand your values and preferences.',
      [QuestionCategory.CLOSING]: 'Thanks for your thoughtful questions.',
    };

    if (categoryFeedback[context.category]) {
      feedback = categoryFeedback[context.category] + ' ' + feedback;
    }

    return {
      score,
      feedback,
      strengths,
      improvements,
      suggestFollowUp: answerLength < 100,
      topicMastery: score >= 7 ? 'proficient' : score >= 5 ? 'intermediate' : 'novice',
    };
  }
}

export const answerEvaluator = new AnswerEvaluatorAgent();
