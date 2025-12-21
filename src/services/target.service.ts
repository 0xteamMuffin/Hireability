import { prisma } from '../utils/prisma.util';
import { CreateTargetInput, UpdateTargetInput, TargetResponse } from '../types/target.types';
import { scrapeWebsite } from './scraper.service';

export const getTargets = async (userId: string): Promise<TargetResponse[]> => {
  const targets = await prisma.targetCompany.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });

  return targets.map((target) => ({
    id: target.id,
    userId: target.userId,
    companyName: target.companyName,
    role: target.role,
    companyEmail: target.companyEmail,
    websiteLink: target.websiteLink,
    scrapedContent: target.scrapedContent,
    scrapedAt: target.scrapedAt,
    createdAt: target.createdAt,
    updatedAt: target.updatedAt,
  }));
};

export const getTargetById = async (id: string, userId: string): Promise<TargetResponse | null> => {
  const target = await prisma.targetCompany.findFirst({
    where: { id, userId },
  });

  if (!target) return null;

  return {
    id: target.id,
    userId: target.userId,
    companyName: target.companyName,
    role: target.role,
    companyEmail: target.companyEmail,
    websiteLink: target.websiteLink,
    scrapedContent: target.scrapedContent,
    scrapedAt: target.scrapedAt,
    createdAt: target.createdAt,
    updatedAt: target.updatedAt,
  };
};

export const createTarget = async (
  userId: string,
  data: CreateTargetInput,
): Promise<TargetResponse> => {
  const target = await prisma.targetCompany.create({
    data: {
      userId,
      companyName: data.companyName,
      role: data.role,
      companyEmail: data.companyEmail,
      websiteLink: data.websiteLink,
    },
  });

  return {
    id: target.id,
    userId: target.userId,
    companyName: target.companyName,
    role: target.role,
    companyEmail: target.companyEmail,
    websiteLink: target.websiteLink,
    scrapedContent: target.scrapedContent,
    scrapedAt: target.scrapedAt,
    createdAt: target.createdAt,
    updatedAt: target.updatedAt,
  };
};

export const updateTarget = async (
  id: string,
  userId: string,
  data: UpdateTargetInput,
): Promise<TargetResponse | null> => {
  const existing = await prisma.targetCompany.findFirst({
    where: { id, userId },
  });

  if (!existing) return null;

  const target = await prisma.targetCompany.update({
    where: { id },
    data: {
      companyName: data.companyName,
      role: data.role,
      companyEmail: data.companyEmail,
      websiteLink: data.websiteLink,
      scrapedContent: data.scrapedContent,
      scrapedAt: data.scrapedAt,
    },
  });

  return {
    id: target.id,
    userId: target.userId,
    companyName: target.companyName,
    role: target.role,
    companyEmail: target.companyEmail,
    websiteLink: target.websiteLink,
    scrapedContent: target.scrapedContent,
    scrapedAt: target.scrapedAt,
    createdAt: target.createdAt,
    updatedAt: target.updatedAt,
  };
};

/**
 * Scrape and cache company website content
 * Returns cached content if available and recent (less than 7 days old)
 * Otherwise scrapes the website and caches the result
 */
export const scrapeAndCacheCompanyContent = async (
  id: string,
  userId: string,
): Promise<{ success: boolean; content?: string; error?: string }> => {
  const target = await prisma.targetCompany.findFirst({
    where: { id, userId },
  });

  if (!target) {
    return { success: false, error: 'Target company not found' };
  }

  if (!target.websiteLink) {
    return { success: false, error: 'No website URL provided' };
  }

  // Check if we have recent cached content (e.g., less than 7 days old)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  if (target.scrapedContent && target.scrapedAt && target.scrapedAt > sevenDaysAgo) {
    console.log('[target.service] Using cached scraped content');
    return {
      success: true,
      content: target.scrapedContent,
    };
  }

  // Scrape the website
  console.log('[target.service] Scraping website:', target.websiteLink);
  const scrapeResult = await scrapeWebsite(target.websiteLink);

  if (scrapeResult.success && scrapeResult.content) {
    // Cache the scraped content
    await prisma.targetCompany.update({
      where: { id },
      data: {
        scrapedContent: scrapeResult.content,
        scrapedAt: new Date(),
      },
    });

    return {
      success: true,
      content: scrapeResult.content,
    };
  }

  return {
    success: false,
    error: scrapeResult.error || 'Failed to scrape website',
  };
};

export const deleteTarget = async (id: string, userId: string): Promise<boolean> => {
  const existing = await prisma.targetCompany.findFirst({
    where: { id, userId },
  });

  if (!existing) return false;

  await prisma.targetCompany.delete({
    where: { id },
  });

  return true;
};
