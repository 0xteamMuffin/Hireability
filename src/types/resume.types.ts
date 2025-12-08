export enum DocumentType {
  RESUME = 'RESUME',
  JOB_DESCRIPTION = 'JOB_DESCRIPTION',
  OTHER = 'OTHER',
}

export enum ProcessingStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export interface ParsedDocument {
  [key: string]: unknown;
}

export interface DocumentResponse {
  id: string;
  type: DocumentType;
  fileName: string;
  status: ProcessingStatus;
  parsedData: ParsedDocument | null;
  confidence: number | null;
  processedAt: Date | null;
  createdAt: Date;
}
