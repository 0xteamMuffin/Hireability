/**
 * Piston Code Execution Service
 * Sandboxed code execution via Piston public API
 * https://github.com/engineer-man/piston
 */

import {
  CodeExecutionResult,
  TestCaseResult,
} from '../types/interview-state.types';

const PISTON_API_URL = process.env.PISTON_API_URL || 'https://emkc.org/api/v2/piston';

// Language mappings for Piston API
const LANGUAGE_MAP: Record<string, { language: string; version: string }> = {
  javascript: { language: 'javascript', version: '18.15.0' },
  typescript: { language: 'typescript', version: '5.0.3' },
  python: { language: 'python', version: '3.10.0' },
  java: { language: 'java', version: '15.0.2' },
  cpp: { language: 'c++', version: '10.2.0' },
  c: { language: 'c', version: '10.2.0' },
  go: { language: 'go', version: '1.16.2' },
  rust: { language: 'rust', version: '1.68.2' },
  ruby: { language: 'ruby', version: '3.0.1' },
  php: { language: 'php', version: '8.2.3' },
  csharp: { language: 'csharp', version: '6.12.0' },
};

// Test case format stored in DB
export interface TestCase {
  input: string;
  expectedOutput: string;
  isHidden?: boolean;
  description?: string;
}

// Piston API response
interface PistonResponse {
  run: {
    stdout: string;
    stderr: string;
    code: number;
    signal: string | null;
    output: string;
  };
  compile?: {
    stdout: string;
    stderr: string;
    code: number;
  };
}

/**
 * Get available runtimes from Piston
 */
export const getRuntimes = async (): Promise<any[]> => {
  try {
    const response = await fetch(`${PISTON_API_URL}/runtimes`);
    if (!response.ok) {
      throw new Error(`Failed to fetch runtimes: ${response.status}`);
    }
    return await response.json() as any[];
  } catch (error) {
    console.error('[Piston] Failed to fetch runtimes:', error);
    return [];
  }
};

/**
 * Execute code without test cases (simple run)
 */
export const executeCode = async (
  code: string,
  language: string,
  stdin?: string
): Promise<CodeExecutionResult> => {
  const langConfig = LANGUAGE_MAP[language.toLowerCase()];
  
  if (!langConfig) {
    return {
      success: false,
      error: `Unsupported language: ${language}. Supported: ${Object.keys(LANGUAGE_MAP).join(', ')}`,
    };
  }

  try {
    const startTime = Date.now();

    const response = await fetch(`${PISTON_API_URL}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        language: langConfig.language,
        version: langConfig.version,
        files: [{ content: code }],
        stdin: stdin || '',
        args: [],
        compile_timeout: 10000,
        run_timeout: 5000,
        compile_memory_limit: -1,
        run_memory_limit: -1,
      }),
    });

    const executionTimeMs = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `Piston API error: ${response.status} - ${errorText}`,
        executionTimeMs,
      };
    }

    const result = await response.json() as PistonResponse;

    // Check for compilation errors
    if (result.compile && result.compile.code !== 0) {
      return {
        success: false,
        error: result.compile.stderr || 'Compilation failed',
        output: result.compile.stdout,
        executionTimeMs,
      };
    }

    // Check for runtime errors
    if (result.run.code !== 0 || result.run.stderr) {
      return {
        success: false,
        error: result.run.stderr || `Exit code: ${result.run.code}`,
        output: result.run.stdout,
        executionTimeMs,
      };
    }

    return {
      success: true,
      output: result.run.stdout.trim(),
      executionTimeMs,
    };
  } catch (error) {
    console.error('[Piston] Execution error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown execution error',
    };
  }
};

/**
 * Execute code with test cases
 */
export const executeWithTestCases = async (
  code: string,
  language: string,
  testCases: TestCase[]
): Promise<CodeExecutionResult> => {
  const langConfig = LANGUAGE_MAP[language.toLowerCase()];
  
  if (!langConfig) {
    return {
      success: false,
      error: `Unsupported language: ${language}`,
      testResults: [],
    };
  }

  const testResults: TestCaseResult[] = [];
  let totalExecutionTime = 0;
  let allPassed = true;

  // Run each test case
  for (const testCase of testCases) {
    const result = await runSingleTestCase(code, langConfig, testCase);
    testResults.push(result);
    totalExecutionTime += result.executionTimeMs || 0;
    
    if (!result.passed) {
      allPassed = false;
    }
  }

  return {
    success: allPassed,
    output: allPassed ? 'All test cases passed!' : 'Some test cases failed',
    testResults,
    executionTimeMs: totalExecutionTime,
  };
};

/**
 * Run a single test case
 */
const runSingleTestCase = async (
  code: string,
  langConfig: { language: string; version: string },
  testCase: TestCase
): Promise<TestCaseResult> => {
  const startTime = Date.now();

  try {
    const response = await fetch(`${PISTON_API_URL}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        language: langConfig.language,
        version: langConfig.version,
        files: [{ content: code }],
        stdin: testCase.input,
        args: [],
        compile_timeout: 10000,
        run_timeout: 5000,
      }),
    });

    const executionTimeMs = Date.now() - startTime;

    if (!response.ok) {
      return {
        input: testCase.input,
        expectedOutput: testCase.expectedOutput,
        actualOutput: `API Error: ${response.status}`,
        passed: false,
        executionTimeMs,
      };
    }

    const result = await response.json() as PistonResponse;

    // Compilation error
    if (result.compile && result.compile.code !== 0) {
      return {
        input: testCase.input,
        expectedOutput: testCase.expectedOutput,
        actualOutput: `Compile Error: ${result.compile.stderr}`,
        passed: false,
        executionTimeMs,
      };
    }

    // Runtime error
    if (result.run.code !== 0) {
      return {
        input: testCase.input,
        expectedOutput: testCase.expectedOutput,
        actualOutput: result.run.stderr || `Exit code: ${result.run.code}`,
        passed: false,
        executionTimeMs,
      };
    }

    const actualOutput = result.run.stdout.trim();
    const expectedOutput = testCase.expectedOutput.trim();
    const passed = normalizeOutput(actualOutput) === normalizeOutput(expectedOutput);

    return {
      input: testCase.input,
      expectedOutput,
      actualOutput,
      passed,
      executionTimeMs,
    };
  } catch (error) {
    return {
      input: testCase.input,
      expectedOutput: testCase.expectedOutput,
      actualOutput: error instanceof Error ? error.message : 'Execution failed',
      passed: false,
      executionTimeMs: Date.now() - startTime,
    };
  }
};

/**
 * Normalize output for comparison (handles whitespace differences)
 */
const normalizeOutput = (output: string): string => {
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join('\n');
};

/**
 * Wrap user code with test harness for better testing
 * This generates a complete program that reads input and produces output
 */
export const wrapCodeWithHarness = (
  userCode: string,
  language: string,
  functionName: string
): string => {
  const wrappers: Record<string, (code: string, fn: string) => string> = {
    javascript: (code, fn) => `
${code}

const readline = require('readline');
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
let lines = [];
rl.on('line', (line) => lines.push(line));
rl.on('close', () => {
  const input = lines.join('\\n');
  try {
    const parsed = JSON.parse(input);
    const args = Array.isArray(parsed) ? parsed : [parsed];
    const result = ${fn}(...args);
    console.log(JSON.stringify(result));
  } catch (e) {
    const result = ${fn}(input);
    console.log(typeof result === 'object' ? JSON.stringify(result) : result);
  }
});
`,
    python: (code, fn) => `
${code}

import sys
import json

if __name__ == "__main__":
    input_data = sys.stdin.read().strip()
    try:
        parsed = json.loads(input_data)
        args = parsed if isinstance(parsed, list) else [parsed]
        result = ${fn}(*args)
    except json.JSONDecodeError:
        result = ${fn}(input_data)
    
    if isinstance(result, (dict, list)):
        print(json.dumps(result))
    else:
        print(result)
`,
    typescript: (code, fn) => `
${code}

const readline = require('readline');
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
let lines: string[] = [];
rl.on('line', (line: string) => lines.push(line));
rl.on('close', () => {
  const input = lines.join('\\n');
  try {
    const parsed = JSON.parse(input);
    const args = Array.isArray(parsed) ? parsed : [parsed];
    const result = ${fn}(...args);
    console.log(JSON.stringify(result));
  } catch (e) {
    const result = ${fn}(input);
    console.log(typeof result === 'object' ? JSON.stringify(result) : result);
  }
});
`,
  };

  const wrapper = wrappers[language.toLowerCase()];
  return wrapper ? wrapper(userCode, functionName) : userCode;
};

/**
 * Check if code has syntax errors without running
 */
export const validateSyntax = async (
  code: string,
  language: string
): Promise<{ valid: boolean; error?: string }> => {
  const langConfig = LANGUAGE_MAP[language.toLowerCase()];
  
  if (!langConfig) {
    return { valid: false, error: `Unsupported language: ${language}` };
  }

  // For interpreted languages, we can try a dry run
  // For compiled languages, just compile without running
  const testCode = language === 'python' 
    ? `import ast\nast.parse('''${code.replace(/'''/g, "\\'\\'\\'")}''')`
    : code;

  try {
    const response = await fetch(`${PISTON_API_URL}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        language: langConfig.language,
        version: langConfig.version,
        files: [{ content: testCode }],
        stdin: '',
        compile_timeout: 5000,
        run_timeout: 1000,
      }),
    });

    if (!response.ok) {
      return { valid: false, error: 'Validation service unavailable' };
    }

    const result = await response.json() as PistonResponse;

    if (result.compile && result.compile.code !== 0) {
      return { valid: false, error: result.compile.stderr };
    }

    // For syntax check, we don't care about runtime errors
    return { valid: true };
  } catch (error) {
    return { 
      valid: false, 
      error: error instanceof Error ? error.message : 'Validation failed' 
    };
  }
};

/**
 * Get supported languages list
 */
export const getSupportedLanguages = (): string[] => {
  return Object.keys(LANGUAGE_MAP);
};
