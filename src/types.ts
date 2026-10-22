export type Language = 
  | 'English'
  | 'Tamil'
  | 'Hindi'
  | 'Telugu'
  | 'Kannada'
  | 'Bengali'
  | 'Marathi'
  | 'Gujarati'
  | 'Malayalam';

export interface DocumentPage {
  id: string;
  pageNumber: number;
  extractedText: string;
  ocrConfidence?: number;
  tableData?: Array<Record<string, string>>;
}

export interface ClarioDocument {
  id: string;
  userId?: string | null;
  filename: string;
  title: string;
  storagePath?: string;
  language: Language | string;
  pageCount: number;
  processingStatus: 'uploading' | 'processing' | 'completed' | 'failed';
  summary?: string;
  pages: DocumentPage[];
  createdAt: string;
  updatedAt?: string;
  isGuest?: boolean;
  isSample?: boolean;
}

export interface Citation {
  id: string;
  pageNumber: number;
  supportingPassage: string;
  translatedPassage?: string;
  sourceLocation?: string;
  confidence?: number;
  isVerified: boolean;
}

export interface AgentStep {
  stepNumber: number;
  tool: string;
  input: any;
  output: string;
  timestamp: string;
}

export interface QuestionAnswer {
  id: string;
  userId?: string | null;
  documentId: string;
  questionText: string;
  answerText: string;
  answerLanguage: Language | string;
  citations: Citation[];
  isFallback: boolean; // True if answer is strictly "Not in the document"
  agentSteps?: AgentStep[];
  executionEngine?: 'live_gemini_agent' | 'deterministic_grounding_fallback';
  createdAt: string;
  latencyMs?: number;
}

export interface DocumentComparisonDifference {
  id: string;
  category: 'deadline' | 'amount' | 'eligibility' | 'percentage' | 'rules' | 'text_change';
  description: string;
  passageA: string;
  pageA: number;
  passageB: string;
  pageB: number;
  impactLevel: 'critical' | 'moderate' | 'minor';
}

export interface DocumentComparisonResult {
  docAId: string;
  docBId: string;
  docATitle: string;
  docBTitle: string;
  differences: DocumentComparisonDifference[];
  summary: string;
}

export interface NumberVerificationItem {
  id: string;
  extractedValue: string;
  category: 'date' | 'currency' | 'percentage' | 'threshold' | 'page_limit' | 'range';
  passage: string;
  pageNumber: number;
  verificationStatus: 'confirmed' | 'ambiguous' | 'discrepancy';
  notes?: string;
}

export interface NumberVerificationResult {
  documentId: string;
  documentTitle: string;
  totalNumbersChecked: number;
  confirmedCount: number;
  flaggedCount: number;
  items: NumberVerificationItem[];
}

export interface TestCaseResult {
  id: 'TC1' | 'TC2' | 'TC3' | 'TC4';
  title: string;
  description: string;
  status: 'idle' | 'running' | 'passed' | 'failed';
  documentName: string;
  question: string;
  targetLanguage: Language | string;
  expectedBehavior: string;
  actualOutput?: string;
  citations?: Citation[];
  passedAsserts?: string[];
  failedAsserts?: string[];
  rawEvidence?: string;
}
