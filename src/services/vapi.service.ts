import * as profileService from './profile.service';
import * as documentService from './document.service';
import { GetQuestionsArgs, GeneratedQuestion, QuestionCategory } from '../types/vapi.types';
import { questionGeneratorAgent } from '../agents';

export const getUserData = async (userId: string) => {
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

export const getResumeData = async (userId: string) => {
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
