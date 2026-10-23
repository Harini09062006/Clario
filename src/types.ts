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
  id: string;
  title: string;
  description: string;
  status: 'idle' | 'running' | 'passed' | 'failed';
  documentName: string;
  question: string;
  targetLanguage: Language | string;
  expectedBehavior: string;
  expectedAnswer?: string;
  expectedPassage?: string;
  expectedPage?: number;
  actualOutput?: string;
  citations?: Citation[];
  passedAsserts?: string[];
  failedAsserts?: string[];
  rawEvidence?: string;
  failureReason?: string;
  testCategory?:
    | 'grounded_fact'
    | 'numerical_extraction'
    | 'missing_information'
    | 'citation_accuracy'
    | 'multilingual'
    | 'ocr_integrity';
}

export type ContradictionCategory =
  | 'dates_and_deadlines'
  | 'financial_amounts'
  | 'percentages_and_thresholds'
  | 'eligibility_criteria'
  | 'required_documents'
  | 'policy_requirements'
  | 'factual_contradictions';

export type ContradictionSeverity = 'high' | 'medium' | 'low' | 'manual_review';

export interface ContradictionItem {
  id: string;
  category: ContradictionCategory;
  severity: ContradictionSeverity;
  title: string;
  explanation: string;
  statementA: string;
  pageA: number;
  statementB: string;
  pageB: number;
  conflictReason: string;
  confidence: 'high' | 'medium' | 'low';
  confidenceExplanation: string;
  status: 'needs_review' | 'reviewed';
  isVersionComparison?: boolean;
  docAId?: string;
  docBId?: string;
  docATitle?: string;
  docBTitle?: string;
  isOcrDerived?: boolean;
}

export interface ContradictionRadarResult {
  documentId: string;
  documentTitle: string;
  totalConflicts: number;
  highPriorityCount: number;
  manualReviewCount: number;
  pagesAnalyzed: number;
  totalPages: number;
  items: ContradictionItem[];
  isScanned?: boolean;
  ocrRequired?: boolean;
  error?: string;
  code?: string;
  partialAnalysis?: boolean;
  pagesFailed?: number[];
  isVersionComparison?: boolean;
  docBId?: string;
  docBTitle?: string;
  analyzedAt: string;
}

export type EvidenceStatus =
  | 'supported'
  | 'partially_supported'
  | 'contradicted'
  | 'insufficient_evidence'
  | 'not_verified';

export type EvidenceGraphNodeType = 'question' | 'answer' | 'claim' | 'evidence' | 'page';

export type EvidenceRelationshipType =
  | 'ASKS'
  | 'GENERATES_ANSWER'
  | 'CONTAINS_CLAIM'
  | 'SUPPORTED_BY'
  | 'PARTIALLY_SUPPORTED_BY'
  | 'CONTRADICTED_BY'
  | 'INSUFFICIENT_EVIDENCE'
  | 'LOCATED_ON_PAGE';

export interface EvidenceGraphNode {
  id: string;
  type: EvidenceGraphNodeType;
  label: string;
  text: string;
  status?: EvidenceStatus;
  pageNumber?: number;
  docId?: string;
  docTitle?: string;
  metadata?: {
    confidence?: number;
    language?: string;
    explanation?: string;
    isOcrDerived?: boolean;
    extractedValue?: string;
  };
}

export interface EvidenceGraphEdge {
  id: string;
  source: string;
  target: string;
  relationship: EvidenceRelationshipType;
  label?: string;
  explanation?: string;
}

export interface EvidenceGraphData {
  documentId: string;
  documentTitle: string;
  question: string;
  answer: string;
  totalClaims: number;
  supportedCount: number;
  partiallySupportedCount: number;
  contradictedCount: number;
  insufficientEvidenceCount: number;
  notVerifiedCount: number;
  nodes: EvidenceGraphNode[];
  edges: EvidenceGraphEdge[];
  generatedAt: string;
  isScanned?: boolean;
  ocrRequired?: boolean;
  error?: string;
  code?: string;
}

// -------------------------------------------------------------
// Interactive Document Decision Simulator Types
// -------------------------------------------------------------

export type RuleType =
  | 'number'
  | 'currency'
  | 'percentage'
  | 'date'
  | 'category'
  | 'boolean'
  | 'document_checklist'
  | 'unsupported';

export type RuleOperator =
  | 'equals'
  | 'not_equals'
  | 'greater_than'
  | 'greater_than_or_equal'
  | 'less_than'
  | 'less_than_or_equal'
  | 'between'
  | 'required'
  | 'date_before_or_on'
  | 'date_after_or_on'
  | 'date_between'
  | 'in_set'
  | 'not_in_set'
  | 'contains_all'
  | 'unsupported';

export type RuleReviewStatus = 'clear' | 'needs_review' | 'ambiguous' | 'unsupported';

export type ConditionEvaluationStatus =
  | 'satisfied'
  | 'not_satisfied'
  | 'needs_review'
  | 'missing_input'
  | 'unable_to_evaluate';

export type OverallAssessmentStatus =
  | 'all_satisfied'
  | 'some_not_satisfied'
  | 'review_required'
  | 'insufficient_information';

export interface DocumentRule {
  id: string;
  ruleName: string;
  fieldId: string;
  fieldLabel: string;
  ruleType: RuleType;
  operator: RuleOperator;
  requiredValue: any;
  unit?: string;
  currency?: string;
  applicableCategory?: string;
  allowedCategories?: string[];
  requiredDocuments?: string[];
  quotation: string;
  pageNumber: number;
  exceptions?: string;
  status: RuleReviewStatus;
  notes?: string;
  isVerifiedEvidence?: boolean;
  confidence?: 'high' | 'medium' | 'low';
}

export interface EvaluatedCondition {
  ruleId: string;
  ruleName: string;
  fieldId: string;
  status: ConditionEvaluationStatus;
  userValue: any;
  requiredValueDisplay: string;
  explanation: string;
  quotation: string;
  pageNumber: number;
  isVerifiedEvidence: boolean;
  exceptions?: string;
  applicableCategory?: string;
  rule: DocumentRule;
}

export interface SimulationResult {
  documentId: string;
  documentTitle: string;
  overallStatus: OverallAssessmentStatus;
  overallExplanation: string;
  satisfiedCount: number;
  notSatisfiedCount: number;
  needsReviewCount: number;
  missingInputCount: number;
  unableToEvaluateCount: number;
  evaluatedConditions: EvaluatedCondition[];
  timestamp: string;
  isScanned?: boolean;
  ocrRequired?: boolean;
  disclaimer: string;
}

export interface SimulationScenario {
  id: string;
  name: string;
  inputs: Record<string, any>;
  selectedCategory?: string;
  result?: SimulationResult;
  updatedAt: string;
}

export interface ScenarioConditionDiff {
  ruleId: string;
  ruleName: string;
  pageNumber: number;
  quotation: string;
  hasChanged: boolean;
  scenarioAStatus: ConditionEvaluationStatus;
  scenarioBStatus: ConditionEvaluationStatus;
  scenarioAValue: any;
  scenarioBValue: any;
  differenceExplanation: string;
  responsibleRule: DocumentRule;
}

export interface ScenarioComparisonResult {
  scenarioAId: string;
  scenarioAName: string;
  scenarioBId: string;
  scenarioBName: string;
  changedConditionsCount: number;
  unchangedConditionsCount: number;
  diffs: ScenarioConditionDiff[];
  summary: string;
}



