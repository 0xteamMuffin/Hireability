/**
 * Adaptive Question Generator Agent
 * Generates contextual, adaptive interview questions based on real-time interview state
 */

import genai, { geminiConfig } from '../../utils/gemini.util';
import {
  InterviewState,
  QuestionCategory,
  Difficulty,
  NextQuestionResponse,
  QuestionState,
  RoundType,
} from '../../types/interview-state.types';
import dotenv from 'dotenv';
dotenv.config();

const MODEL = process.env.MODEL_NAME || 'gemini-2.0-flash';
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 2000;

interface AdaptiveQuestionContext {
  roundType: RoundType;
  phase: string;
  questionsAsked: number;
  averageScore: number;

  topicsCovered: QuestionCategory[];
  topicsRemaining: QuestionCategory[];
  weakAreas: QuestionCategory[];
  strongAreas: QuestionCategory[];

  suggestedDifficulty: Difficulty;
  scoreTrend: 'improving' | 'stable' | 'declining';
  confidenceLevel: 'low' | 'medium' | 'high';

  targetRole?: string;
  targetCompany?: string;
  experienceLevel?: string;
  resumeContext?: string;

  previousQuestion?: QuestionState;
  recentQuestions?: QuestionState[];

  shouldWrapUp: boolean;
  isFollowUp?: boolean;
}

export class AdaptiveQuestionGeneratorAgent {
  private fallbackIndex: Map<RoundType, number> = new Map();

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
   * Generate the next question based on interview state with retry logic
   */
  async generateNextQuestion(state: InterviewState): Promise<NextQuestionResponse> {
    const context = this.buildContext(state);
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
          question: parsed.question || 'Can you tell me more about your experience?',
          category: this.mapCategory(parsed.category) || this.selectNextCategory(context),
          difficulty: this.mapDifficulty(parsed.difficulty) || context.suggestedDifficulty,
          context: parsed.reasoning || undefined,
          isFollowUp: parsed.isFollowUp || false,
          topicsRemaining: context.topicsRemaining,
          estimatedQuestionsLeft: this.estimateQuestionsRemaining(context),
        };
      } catch (error) {
        lastError = error;

        if (this.isRateLimitError(error) && attempt < MAX_RETRIES - 1) {
          const delay = BASE_DELAY_MS * Math.pow(2, attempt);
          console.log(
            `[AdaptiveQuestion] Rate limited, retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`,
          );
          await this.sleep(delay);
          continue;
        }

        break;
      }
    }

    console.error('[AdaptiveQuestion] Generation failed after retries:', lastError);
    return this.getFallbackQuestion(context);
  }

  /**
   * Generate a follow-up question based on the previous answer
   */
  async generateFollowUp(
    state: InterviewState,
    previousAnswer: string,
    evaluationFeedback: string,
  ): Promise<NextQuestionResponse> {
    const context = this.buildContext(state);
    const prompt = this.buildFollowUpPrompt(context, previousAnswer, evaluationFeedback);

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
        question: parsed.question,
        category: context.previousQuestion?.category || QuestionCategory.EXPERIENCE,
        difficulty: context.suggestedDifficulty,
        context: 'Follow-up to probe deeper',
        isFollowUp: true,
        topicsRemaining: context.topicsRemaining,
        estimatedQuestionsLeft: this.estimateQuestionsRemaining(context),
      };
    } catch (error) {
      console.error('[AdaptiveQuestion] Follow-up generation failed:', error);
      return {
        question: 'Can you elaborate more on that?',
        category: context.previousQuestion?.category || QuestionCategory.EXPERIENCE,
        difficulty: context.suggestedDifficulty,
        isFollowUp: true,
        topicsRemaining: context.topicsRemaining,
        estimatedQuestionsLeft: this.estimateQuestionsRemaining(context),
      };
    }
  }

  private buildContext(state: InterviewState): AdaptiveQuestionContext {
    const topicsCovered = Object.entries(state.topicCoverage)
      .filter(([_, coverage]) => coverage.covered)
      .map(([category]) => category as QuestionCategory);

    const topicsRemaining = Object.entries(state.topicCoverage)
      .filter(([_, coverage]) => !coverage.covered)
      .map(([category]) => category as QuestionCategory);

    const recentQuestions = state.questions.slice(-3);
    const previousQuestion = state.questions[state.questions.length - 1];

    return {
      roundType: state.roundType,
      phase: state.phase,
      questionsAsked: state.performance.totalQuestions,
      averageScore: state.performance.averageScore,
      topicsCovered,
      topicsRemaining,
      weakAreas: state.performance.weakAreas,
      strongAreas: state.performance.strongAreas,
      suggestedDifficulty: state.performance.suggestedDifficulty,
      scoreTrend: state.performance.scoreTrend,
      confidenceLevel: state.performance.confidenceLevel,
      targetRole: state.targetRole,
      targetCompany: state.targetCompany,
      experienceLevel: state.experienceLevel,
      resumeContext: state.resumeContext,
      previousQuestion,
      recentQuestions,
      shouldWrapUp: state.shouldWrapUp,
    };
  }

  private buildPrompt(context: AdaptiveQuestionContext): string {
    const roundInstructions = this.getRoundInstructions(context.roundType);
    const difficultyGuide = this.getDifficultyGuide(context.suggestedDifficulty);

    return `You are an expert interviewer conducting a ${context.roundType} interview round.

**CANDIDATE CONTEXT:**
- Target Role: ${context.targetRole || 'Software Engineer'}
- Target Company: ${context.targetCompany || 'Tech Company'}
- Experience Level: ${context.experienceLevel || 'Mid-level'}
${context.resumeContext ? `- Resume Summary: ${context.resumeContext}` : ''}

**INTERVIEW STATE:**
- Questions Asked: ${context.questionsAsked}
- Average Score: ${context.averageScore.toFixed(1)}/10
- Score Trend: ${context.scoreTrend}
- Candidate Confidence: ${context.confidenceLevel}
- Topics Covered: ${context.topicsCovered.join(', ') || 'None yet'}
- Topics Remaining: ${context.topicsRemaining.join(', ')}
- Weak Areas: ${context.weakAreas.join(', ') || 'None identified'}
- Strong Areas: ${context.strongAreas.join(', ') || 'None identified'}
${context.shouldWrapUp ? '- STATUS: Time to wrap up - ask closing question' : ''}

**RECENT QUESTIONS:**
${context.recentQuestions?.map((q, i) => `${i + 1}. [${q.category}] ${q.question} (Score: ${q.score ?? 'pending'})`).join('\n') || 'None yet'}

**ROUND INSTRUCTIONS:**
${roundInstructions}

**DIFFICULTY LEVEL:** ${context.suggestedDifficulty}
${difficultyGuide}

**YOUR TASK:**
Generate the next interview question. Consider:
1. Don't repeat questions already asked
2. Cover topics that haven't been explored
3. If candidate is struggling (low score/declining trend), ask an easier question
4. If candidate is doing well, increase difficulty
5. Ask follow-up questions when answers need clarification
6. ${context.shouldWrapUp ? 'Ask a closing/wrap-up question' : 'Continue with substantive questions'}

**OUTPUT FORMAT (JSON):**
{
  "question": "Your interview question here",
  "category": "experience|behavioral|technical_concept|problem_solving|system_design|coding|culture_fit|introduction|closing",
  "difficulty": "EASY|MEDIUM|HARD",
  "reasoning": "Brief explanation of why this question was chosen",
  "isFollowUp": false
}`;
  }

  private buildFollowUpPrompt(
    context: AdaptiveQuestionContext,
    previousAnswer: string,
    evaluationFeedback: string,
  ): string {
    return `You are an expert interviewer conducting a follow-up question.

**PREVIOUS QUESTION:**
${context.previousQuestion?.question}

**CANDIDATE'S ANSWER:**
${previousAnswer}

**EVALUATION FEEDBACK:**
${evaluationFeedback}

**YOUR TASK:**
Generate a follow-up question that:
1. Probes deeper into the topic
2. Clarifies any vague parts of the answer
3. Challenges the candidate to demonstrate deeper understanding
4. Maintains professional interviewer tone

**OUTPUT FORMAT (JSON):**
{
  "question": "Your follow-up question here",
  "reasoning": "Why this follow-up is valuable"
}`;
  }

  private getRoundInstructions(roundType: RoundType): string {
    const instructions: Record<RoundType, string> = {
      [RoundType.BEHAVIORAL]: `
- Focus on past experiences using STAR method (Situation, Task, Action, Result)
- Ask about teamwork, leadership, conflict resolution, failures, and growth
- Probe for specific examples, not hypotheticals
- Evaluate cultural fit and soft skills`,

      [RoundType.TECHNICAL]: `
- Assess technical depth in relevant technologies
- Ask about system design, architecture decisions, trade-offs
- Include questions about debugging, optimization, best practices
- Gauge problem-solving approach and technical communication`,

      [RoundType.CODING]: `
- Focus on algorithmic thinking and code quality
- Ask about approach before diving into implementation
- Discuss time/space complexity
- Evaluate code organization and clarity`,

      [RoundType.SYSTEM_DESIGN]: `
- Start with requirements clarification
- Discuss high-level architecture first
- Deep dive into specific components
- Evaluate scalability, reliability, trade-offs`,

      [RoundType.HR]: `
- Discuss career goals and motivations
- Ask about salary expectations, availability
- Clarify role expectations and team dynamics
- Address any candidate questions about the company`,
    };

    return instructions[roundType] || instructions[RoundType.BEHAVIORAL];
  }

  private getDifficultyGuide(difficulty: Difficulty): string {
    const guides: Record<Difficulty, string> = {
      [Difficulty.EASY]: `
- Ask straightforward questions with clear answers
- Focus on fundamentals and basic concepts
- Allow candidate to build confidence`,

      [Difficulty.MEDIUM]: `
- Ask questions requiring some depth of thought
- Include some trade-off discussions
- Expect structured, detailed answers`,

      [Difficulty.HARD]: `
- Ask challenging questions requiring deep expertise
- Include edge cases and complex scenarios
- Expect sophisticated analysis and insights`,
    };

    return guides[difficulty] || guides[Difficulty.MEDIUM];
  }

  private selectNextCategory(context: AdaptiveQuestionContext): QuestionCategory {
    const priorityMap: Record<RoundType, QuestionCategory[]> = {
      [RoundType.BEHAVIORAL]: [
        QuestionCategory.INTRODUCTION,
        QuestionCategory.EXPERIENCE,
        QuestionCategory.BEHAVIORAL,
        QuestionCategory.CULTURE_FIT,
        QuestionCategory.CLOSING,
      ],
      [RoundType.TECHNICAL]: [
        QuestionCategory.TECHNICAL_CONCEPT,
        QuestionCategory.PROBLEM_SOLVING,
        QuestionCategory.EXPERIENCE,
        QuestionCategory.CLOSING,
      ],
      [RoundType.CODING]: [
        QuestionCategory.PROBLEM_SOLVING,
        QuestionCategory.CODING,
        QuestionCategory.TECHNICAL_CONCEPT,
      ],
      [RoundType.SYSTEM_DESIGN]: [
        QuestionCategory.SYSTEM_DESIGN,
        QuestionCategory.TECHNICAL_CONCEPT,
        QuestionCategory.PROBLEM_SOLVING,
      ],
      [RoundType.HR]: [
        QuestionCategory.INTRODUCTION,
        QuestionCategory.CULTURE_FIT,
        QuestionCategory.CLOSING,
      ],
    };

    const priorities = priorityMap[context.roundType] || priorityMap[RoundType.BEHAVIORAL];

    for (const category of priorities) {
      if (context.topicsRemaining.includes(category)) {
        return category;
      }
    }

    if (context.weakAreas.length > 0) {
      return context.weakAreas[0];
    }

    return QuestionCategory.EXPERIENCE;
  }

  private mapCategory(category: string): QuestionCategory | null {
    const mapping: Record<string, QuestionCategory> = {
      introduction: QuestionCategory.INTRODUCTION,
      experience: QuestionCategory.EXPERIENCE,
      behavioral: QuestionCategory.BEHAVIORAL,
      technical_concept: QuestionCategory.TECHNICAL_CONCEPT,
      technical: QuestionCategory.TECHNICAL_CONCEPT,
      problem_solving: QuestionCategory.PROBLEM_SOLVING,
      system_design: QuestionCategory.SYSTEM_DESIGN,
      coding: QuestionCategory.CODING,
      culture_fit: QuestionCategory.CULTURE_FIT,
      closing: QuestionCategory.CLOSING,
    };

    return mapping[category?.toLowerCase()] || null;
  }

  private mapDifficulty(difficulty: string): Difficulty | null {
    const mapping: Record<string, Difficulty> = {
      easy: Difficulty.EASY,
      medium: Difficulty.MEDIUM,
      hard: Difficulty.HARD,
    };

    return mapping[difficulty?.toLowerCase()] || null;
  }

  private estimateQuestionsRemaining(context: AdaptiveQuestionContext): number {
    const minQuestions: Record<RoundType, number> = {
      [RoundType.BEHAVIORAL]: 5,
      [RoundType.TECHNICAL]: 6,
      [RoundType.CODING]: 2,
      [RoundType.SYSTEM_DESIGN]: 3,
      [RoundType.HR]: 4,
    };

    const min = minQuestions[context.roundType] || 5;
    const asked = context.questionsAsked;
    const uncovered = context.topicsRemaining.length;

    return Math.max(min - asked, uncovered, 1);
  }

  private getFallbackQuestion(context: AdaptiveQuestionContext): NextQuestionResponse {
    const fallbackPool: Record<RoundType, string[]> = {
      [RoundType.BEHAVIORAL]: [
        'Tell me about a challenging project you worked on recently.',
        'Can you describe a time when you had to work under a tight deadline?',
        'Tell me about a situation where you had to collaborate with a difficult team member.',
        'Describe a time when you had to learn a new technology quickly.',
        'Can you share an example of when you took initiative on a project?',
        'Tell me about a time when you received constructive feedback and how you handled it.',
        'Describe a situation where you had to make a decision with incomplete information.',
        'Can you tell me about a time when you failed and what you learned from it?',
      ],
      [RoundType.TECHNICAL]: [
        'Can you explain your approach to debugging a complex issue?',
        'How do you ensure code quality in your projects?',
        'What factors do you consider when choosing between different technologies?',
        'Can you explain the difference between SQL and NoSQL databases and when to use each?',
        'How do you approach performance optimization in your applications?',
        'What is your experience with version control and branching strategies?',
        'How do you handle error handling and logging in production systems?',
        'Can you explain the concept of API design best practices?',
      ],
      [RoundType.CODING]: [
        'Walk me through how you would approach solving this problem.',
        'Can you explain your thought process when breaking down a coding problem?',
        'How do you handle edge cases when writing code?',
        'What is your approach to testing your code?',
      ],
      [RoundType.SYSTEM_DESIGN]: [
        'How would you design a system to handle this requirement?',
        'What factors do you consider when designing for scalability?',
        'How would you approach designing a caching strategy?',
        'Can you explain how you would handle data consistency in a distributed system?',
        'What trade-offs would you consider when choosing between different architectural patterns?',
      ],
      [RoundType.HR]: [
        'What are you looking for in your next role?',
        'Where do you see yourself in five years?',
        'What motivates you in your work?',
        'How do you handle work-life balance?',
        'What type of work environment do you thrive in?',
        'Why are you interested in this position?',
      ],
    };

    const pool = fallbackPool[context.roundType] || fallbackPool[RoundType.BEHAVIORAL];

    const currentIndex = this.fallbackIndex.get(context.roundType) || 0;
    const question = pool[currentIndex % pool.length];
    this.fallbackIndex.set(context.roundType, currentIndex + 1);

    console.log(
      `[AdaptiveQuestion] Using fallback question ${currentIndex + 1} for ${context.roundType}`,
    );

    return {
      question,
      category: this.selectNextCategory(context),
      difficulty: context.suggestedDifficulty,
      isFollowUp: false,
      topicsRemaining: context.topicsRemaining,
      estimatedQuestionsLeft: this.estimateQuestionsRemaining(context),
    };
  }
}

export const adaptiveQuestionGenerator = new AdaptiveQuestionGeneratorAgent();
