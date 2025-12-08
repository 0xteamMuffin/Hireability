import { prisma } from '../utils/prisma.util';
import { PDFParse } from 'pdf-parse';
import { documentParserAgent } from '../agents';
import { DocumentType, ProcessingStatus, DocumentResponse } from '../types/resume.types';
import { Prisma } from '@prisma/client';

const extractText = async (buffer: Buffer, mimeType: string): Promise<string> => {
  if (mimeType === 'application/pdf') {
    const uint8Array = new Uint8Array(buffer);
    const parser = new PDFParse(uint8Array);
    const result = await parser.getText();
    return typeof result === 'string' ? result : result.text || '';
  }
  throw new Error('Unsupported file type');
};

export const uploadAndParse = async (
  userId: string,
  file: Buffer,
  fileName: string,
  mimeType: string,
  type: DocumentType = DocumentType.RESUME
): Promise<DocumentResponse> => {
  const rawText = await extractText(file, mimeType);

  let document = await prisma.document.create({
    data: {
      userId,
      type,
      fileName,
      mimeType,
      rawText,
      status: ProcessingStatus.PROCESSING,
    },
  });

  const result = await documentParserAgent.parse(rawText);

  document = await prisma.document.update({
    where: { id: document.id },
    data: {
      status: result.status,
      parsedData: result.output as Prisma.InputJsonValue,
      agentVersion: documentParserAgent.getVersion(),
      confidence: result.confidence,
      tokenUsage: result.tokenUsage,
      processedAt: new Date(),
      error: result.error,
    },
  });

  return {
    id: document.id,
    type: document.type as DocumentType,
    fileName: document.fileName,
    status: document.status as ProcessingStatus,
    parsedData: document.parsedData as DocumentResponse['parsedData'],
    confidence: document.confidence,
    processedAt: document.processedAt,
    createdAt: document.createdAt,
  };
};

export const getResumeData = async (userId: string): Promise<DocumentResponse | null> => {
  const document = await prisma.document.findFirst({
    where: { userId, type: DocumentType.RESUME },
    orderBy: { createdAt: 'desc' },
  });

  if (!document) return null;

  return {
    id: document.id,
    type: document.type as DocumentType,
    fileName: document.fileName,
    status: document.status as ProcessingStatus,
    parsedData: document.parsedData as DocumentResponse['parsedData'],
    confidence: document.confidence,
    processedAt: document.processedAt,
    createdAt: document.createdAt,
  };
};
