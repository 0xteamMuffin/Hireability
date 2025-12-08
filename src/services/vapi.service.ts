import * as profileService from './profile.service';
import * as documentService from './document.service';
import {
  GetQuestionsArgs,
  GeneratedQuestion,
  QuestionCategory,
  UserContextResponse,
  VapiResumeDataResponse,
  VapiUserDataResponse,
} from '../types/vapi.types';
import { questionGeneratorAgent } from '../agents';

const CONTEXT_CHAR_LIMIT = 3000;

const trimContext = (value: string): string => {
  if (value.length <= CONTEXT_CHAR_LIMIT) return value;
  return `${value.slice(0, CONTEXT_CHAR_LIMIT)}... [truncated]`;
};

const buildContextPrompt = (
  profile: NonNullable<VapiUserDataResponse['data']>,
  resume: VapiResumeDataResponse['data'] | null
): string => {
  const profileSection = [
    'Candidate Profile:',
    `- Target Role: ${profile.targetRole || 'Not provided'}`,
    `- Target Company: ${profile.targetCompany || 'Not provided'}`,
    `- Seniority Level: ${profile.level || 'Not provided'}`,
  ].join('\n');

  const resumeSummary = resume?.parsedData
    ? trimContext(JSON.stringify(resume.parsedData, null, 2))
    : 'Resume data unavailable. Ask the user for recent experience and projects.';

  const resumeSection = [
    'Resume Snapshot:',
    resume?.fileName ? `- File: ${resume.fileName}` : '- File: Not uploaded yet',
    resume?.confidence !== null && resume?.confidence !== undefined
      ? `- Parsing confidence: ${resume.confidence}`
      : '- Parsing confidence: Unknown',
    `- Parsed details (JSON): ${resumeSummary}`,
  ].join('\n');

  const guidance = [
    'Guidelines:',
    '- Use the provided profile/resume context to tailor interview questions.',
    '- If resume data looks incomplete, ask concise follow-up questions to fill gaps.',
    '- Keep answers concise and structured.',
  ].join('\n');

  return [profileSection, resumeSection, guidance].join('\n\n');
};

export const getUserData = async (userId: string): Promise<VapiUserDataResponse> => {
  const profile = await profileService.getProfile(userId);
  
  if (!profile) {
    return { error: 'Profile not found', data: null };
  }

  return {
    error: null,
    data: {
      targetRole: profile.targetRole,
      targetCompany: profile.targetCompany,
      level: profile.level,
    },
  };
};

export const getResumeData = async (userId: string): Promise<VapiResumeDataResponse> => {
  const document = await documentService.getResumeData(userId);

  if (!document) {
    return { error: 'Resume not found', data: null };
  }

  return {
    error: null,
    data: {
      fileName: document.fileName,
      status: document.status,
      parsedData: document.parsedData,
      confidence: document.confidence,
    },
  };
};

export const getUserContext = async (userId: string): Promise<UserContextResponse> => {
  const [profileResult, resumeResult] = await Promise.all([
    getUserData(userId),
    getResumeData(userId),
  ]);

  if (profileResult.error || !profileResult.data) {
    return {
      error: 'User profile required to build context',
      prompt: '',
      data: null,
    };
  }

  const prompt = buildContextPrompt(profileResult.data, resumeResult.data);

  return {
    error: null,
    prompt,
    data: {
      profile: profileResult.data,
      resume: resumeResult.data,
    },
  };
};

export const getQuestions = async (
  userId: string,
  args: GetQuestionsArgs
): Promise<{ error: string | null; data: GeneratedQuestion[] | null }> => {
  const category: QuestionCategory = args.category || 'mixed';
  const limit = args.limit || 5;

  const [profileResult, resumeResult] = await Promise.all([
    getUserData(userId),
    getResumeData(userId),
  ]);

  if (profileResult.error || !profileResult.data) {
    return { error: 'User profile required to generate questions', data: null };
  }

  const context = {
    targetRole: profileResult.data.targetRole,
    targetCompany: profileResult.data.targetCompany,
    level: profileResult.data.level,
    resumeData: resumeResult.data?.parsedData || null,
  };

  const result = await questionGeneratorAgent.generate(context, category, limit);

  if (result.error) {
    return { error: result.error, data: null };
  }

  return { error: null, data: result.questions };
};
