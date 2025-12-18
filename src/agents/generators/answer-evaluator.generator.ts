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

interface EvaluationContext {
  // Question info
  question: string;
  category: QuestionCategory;
  difficulty: Difficulty;
  
  // Answer
  answer: string;
  
  // Candidate context
  targetRole?: string;
  targetCompany?: string;
  experienceLevel?: string;
  
  // Interview context
  roundType: RoundType;
  questionsAsked: number;
  averageScore: number;
  
  // For coding answers
  codeSubmission?: string;
  codeLanguage?: string;
  testResults?: { passed: number; total: number };
}

export class AnswerEvaluatorAgent {
  /**
   * Evaluate a candidate's answer
   */
  async evaluate(context: EvaluationContext): Promise<AnswerEvaluationResponse> {
    const prompt = this.buildPrompt(context);

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
      console.error('[AnswerEvaluator] Evaluation failed:', error);
      return this.getFallbackEvaluation(context);
    }
  }

  /**
   * Quick evaluation for real-time feedback (lighter prompt)
   */
  async quickEvaluate(
    question: string,
    answer: string,
    category: QuestionCategory
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
   * Evaluate code submission specifically
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
      console.error('[AnswerEvaluator] Code evaluation failed:', error);
      
      // Fallback based on test results
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

${context.codeSubmission ? `
**CODE SUBMITTED:**
\`\`\`${context.codeLanguage || 'code'}
${context.codeSubmission}
\`\`\`
${context.testResults ? `Test Results: ${context.testResults.passed}/${context.testResults.total} passed` : ''}
` : ''}

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

  private mapMastery(
    mastery: string
  ): 'novice' | 'intermediate' | 'proficient' | 'expert' {
    const normalized = mastery?.toLowerCase();
    if (['expert', 'advanced'].includes(normalized)) return 'expert';
    if (['proficient', 'skilled'].includes(normalized)) return 'proficient';
    if (['intermediate', 'moderate'].includes(normalized)) return 'intermediate';
    return 'novice';
  }

  private getFallbackEvaluation(context: EvaluationContext): AnswerEvaluationResponse {
    // Basic heuristic evaluation
    const answerLength = context.answer?.length || 0;
    let score = 5;

    if (answerLength < 50) score = 3;
    else if (answerLength < 150) score = 5;
    else if (answerLength < 500) score = 6;
    else score = 7;

    return {
      score,
      feedback: 'Thank you for your answer. Let me note that down.',
      strengths: answerLength > 100 ? ['Detailed response'] : [],
      improvements: answerLength < 100 ? ['Could provide more detail'] : [],
      suggestFollowUp: answerLength < 100,
      topicMastery: 'intermediate',
    };
  }
}

// Export singleton instance
export const answerEvaluator = new AnswerEvaluatorAgent();
