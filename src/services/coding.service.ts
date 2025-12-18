/**
 * Coding Service
 * Manages coding problems and real-time code evaluation
 */

import { prisma } from '../utils/prisma.util';
import genai, { geminiConfig } from '../utils/gemini.util';
import {
  Difficulty,
  CodingProblemResponse,
  CodeEvaluationResult,
  SubmitCodeRequest,
} from '../types/round.types';

const db = prisma as any;

/**
 * Get a random coding problem by difficulty and category
 */
export const getProblem = async (
  difficulty?: Difficulty,
  category?: string
): Promise<CodingProblemResponse | null> => {
  const where: any = {};
  
  if (difficulty) {
    where.difficulty = difficulty;
  }
  if (category) {
    where.category = category;
  }
  
  // Get random problem matching criteria
  const problems = await db.codingProblem.findMany({
    where,
    take: 10,
  });
  
  if (!problems.length) {
    return null;
  }
  
  const randomIndex = Math.floor(Math.random() * problems.length);
  const problem = problems[randomIndex];
  
  return formatProblemResponse(problem);
};

/**
 * Get problem by ID
 */
export const getProblemById = async (
  problemId: string
): Promise<CodingProblemResponse | null> => {
  const problem = await db.codingProblem.findUnique({
    where: { id: problemId },
  });
  
  return problem ? formatProblemResponse(problem) : null;
};

/**
 * Get all problems (for admin/listing)
 */
export const getAllProblems = async (
  difficulty?: Difficulty,
  category?: string
): Promise<CodingProblemResponse[]> => {
  const where: any = {};
  
  if (difficulty) where.difficulty = difficulty;
  if (category) where.category = category;
  
  const problems = await db.codingProblem.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });
  
  return problems.map(formatProblemResponse);
};

/**
 * Assign a problem to a round
 */
export const assignProblemToRound = async (
  roundId: string,
  problemId?: string,
  difficulty?: Difficulty
): Promise<CodingProblemResponse> => {
  let problem;
  
  if (problemId) {
    problem = await getProblemById(problemId);
  } else {
    // Get random problem based on difficulty
    problem = await getProblem(difficulty || Difficulty.MEDIUM);
  }
  
  if (!problem) {
    throw new Error('No suitable coding problem found');
  }
  
  // Update round with problem
  await db.interviewRound.update({
    where: { id: roundId },
    data: { problemId: problem.id },
  });
  
  return problem;
};

/**
 * Submit code for a round
 */
export const submitCode = async (
  userId: string,
  payload: SubmitCodeRequest
): Promise<CodeEvaluationResult> => {
  // Get the round and verify ownership through session
  const round = await db.interviewRound.findUnique({
    where: { id: payload.roundId },
    include: {
      session: true,
    },
  });
  
  if (!round || round.session.userId !== userId) {
    throw new Error('Round not found or access denied');
  }
  
  // Save the submission
  await db.interviewRound.update({
    where: { id: payload.roundId },
    data: {
      codeSubmission: payload.code,
      codeLanguage: payload.language,
    },
  });
  
  // Get the problem for evaluation
  const problem = round.problemId
    ? await db.codingProblem.findUnique({ where: { id: round.problemId } })
    : null;
  
  // Evaluate with AI
  const evaluation = await evaluateCode(
    payload.code,
    payload.language,
    problem?.description || 'General coding assessment',
    problem?.testCases
  );
  
  return evaluation;
};

/**
 * Evaluate code using Gemini AI
 */
export const evaluateCode = async (
  code: string,
  language: string,
  problemDescription: string,
  testCases?: any[]
): Promise<CodeEvaluationResult> => {
  const prompt = `
You are a code reviewer evaluating a candidate's solution.

**Problem:**
${problemDescription}

**Language:** ${language}

**Submitted Code:**
\`\`\`${language}
${code}
\`\`\`

${testCases ? `**Test Cases:**\n${JSON.stringify(testCases, null, 2)}` : ''}

Evaluate the code and respond with a JSON object:
{
  "passed": boolean,          // Overall pass/fail
  "score": number,            // 0-100
  "testResults": [            // If test cases provided
    {
      "name": string,
      "passed": boolean,
      "expected": string,
      "actual": string,
      "error": string | null
    }
  ],
  "feedback": string          // Detailed feedback on code quality, efficiency, and correctness
}

Consider:
1. Correctness - Does the code solve the problem?
2. Efficiency - Time/space complexity
3. Code quality - Readability, naming, structure
4. Edge cases - Are they handled?

Respond ONLY with the JSON object, no markdown.
`;

  try {
    const result = await genai.models.generateContent({
      model: process.env.MODEL_NAME || "gemini-flash-latest",
      contents: prompt,
      config: geminiConfig,
    });
    const text = (result.text || '').trim();
    
    // Parse JSON response
    const cleanText = text.replace(/```json\n?|\n?```/g, '').trim();
    const evaluation = JSON.parse(cleanText);
    
    return {
      passed: evaluation.passed ?? false,
      score: evaluation.score ?? 0,
      testResults: evaluation.testResults ?? [],
      feedback: evaluation.feedback ?? 'Unable to evaluate code',
    };
  } catch (error) {
    console.error('Code evaluation error:', error);
    return {
      passed: false,
      score: 0,
      testResults: [],
      feedback: 'An error occurred during evaluation. Please try again.',
    };
  }
};

/**
 * Get real-time code hint using AI
 */
export const getCodeHint = async (
  code: string,
  language: string,
  problemDescription: string
): Promise<string> => {
  const prompt = `
You are a helpful interviewer giving a hint to a candidate who is stuck.

**Problem:** ${problemDescription}

**Their current code (${language}):**
\`\`\`${language}
${code}
\`\`\`

Provide a SHORT hint (1-2 sentences) that guides them without giving the answer.
Focus on:
- A concept they might be missing
- A data structure suggestion
- An edge case to consider

Be encouraging and constructive. Do NOT provide the solution.
`;

  try {
    const result = await genai.models.generateContent({
      model: process.env.MODEL_NAME || "gemini-flash-latest",
      contents: prompt,
      config: geminiConfig,
    });
    return (result.text || '').trim();
  } catch (error) {
    console.error('Hint generation error:', error);
    return 'Think about the data structure that would best fit this problem.';
  }
};

/**
 * Seed some default coding problems
 */
export const seedProblems = async (): Promise<void> => {
  const problems = [
    {
      title: 'Two Sum',
      description: `Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.

You may assume that each input would have exactly one solution, and you may not use the same element twice.

Example:
Input: nums = [2,7,11,15], target = 9
Output: [0,1]
Explanation: Because nums[0] + nums[1] == 9, we return [0, 1].`,
      difficulty: Difficulty.EASY,
      category: 'arrays',
      starterCode: {
        javascript: `function twoSum(nums, target) {\n  // Your code here\n}`,
        python: `def two_sum(nums, target):\n    # Your code here\n    pass`,
        typescript: `function twoSum(nums: number[], target: number): number[] {\n  // Your code here\n}`,
      },
      hints: [
        'Consider using a hash map to store values you\'ve seen',
        'For each number, check if target - number exists in your map',
      ],
      testCases: [
        { input: { nums: [2, 7, 11, 15], target: 9 }, expected: [0, 1] },
        { input: { nums: [3, 2, 4], target: 6 }, expected: [1, 2] },
      ],
    },
    {
      title: 'Valid Parentheses',
      description: `Given a string s containing just the characters '(', ')', '{', '}', '[' and ']', determine if the input string is valid.

An input string is valid if:
1. Open brackets must be closed by the same type of brackets.
2. Open brackets must be closed in the correct order.

Example:
Input: s = "()[]{}"
Output: true

Input: s = "(]"
Output: false`,
      difficulty: Difficulty.EASY,
      category: 'stacks',
      starterCode: {
        javascript: `function isValid(s) {\n  // Your code here\n}`,
        python: `def is_valid(s):\n    # Your code here\n    pass`,
        typescript: `function isValid(s: string): boolean {\n  // Your code here\n}`,
      },
      hints: [
        'Use a stack data structure',
        'Push opening brackets, pop and compare for closing brackets',
      ],
      testCases: [
        { input: { s: '()[]{}' }, expected: true },
        { input: { s: '(]' }, expected: false },
        { input: { s: '([)]' }, expected: false },
      ],
    },
    {
      title: 'Reverse Linked List',
      description: `Given the head of a singly linked list, reverse the list, and return the reversed list.

Example:
Input: head = [1,2,3,4,5]
Output: [5,4,3,2,1]`,
      difficulty: Difficulty.MEDIUM,
      category: 'linked-lists',
      starterCode: {
        javascript: `function reverseList(head) {\n  // Your code here\n}`,
        python: `def reverse_list(head):\n    # Your code here\n    pass`,
        typescript: `function reverseList(head: ListNode | null): ListNode | null {\n  // Your code here\n}`,
      },
      hints: [
        'Keep track of three pointers: prev, current, next',
        'Iteratively reverse the pointers',
      ],
      testCases: [
        { input: { head: [1, 2, 3, 4, 5] }, expected: [5, 4, 3, 2, 1] },
        { input: { head: [1, 2] }, expected: [2, 1] },
      ],
    },
  ];
  
  for (const problem of problems) {
    await db.codingProblem.upsert({
      where: { title: problem.title },
      update: problem,
      create: problem,
    });
  }
  
  console.log('Seeded coding problems');
};

function formatProblemResponse(problem: any): CodingProblemResponse {
  return {
    id: problem.id,
    title: problem.title,
    description: problem.description,
    difficulty: problem.difficulty as Difficulty,
    category: problem.category,
    starterCode: problem.starterCode as Record<string, string> | null,
    hints: problem.hints || [],
  };
}
