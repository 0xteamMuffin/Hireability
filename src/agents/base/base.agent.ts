import { ProcessingStatus, ParsedDocument } from '../../types/resume.types';

export interface AgentResult {
  output: ParsedDocument;
  confidence: number;
  tokenUsage: number;
  status: ProcessingStatus;
  error?: string;
}

export abstract class BaseAgent {
  protected agentVersion: string;

  constructor(version: string) {
    this.agentVersion = version;
  }

  abstract parse(rawText: string): Promise<AgentResult>;

  getVersion(): string {
    return this.agentVersion;
  }
}
