import { DocumentPage, ContradictionItem, ContradictionRadarResult, ContradictionCategory, ContradictionSeverity } from '../types';

/**
 * Normalizes text for lenient substring verification (ignoring whitespace differences)
 */
export function normalizeForSearch(str: string): string {
  return str
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Verifies that a statement exists verbatim or near-verbatim in the page's extracted text.
 * Returns true if evidence is genuine, false if fabricated or missing.
 */
export function verifyPassageInPage(statement: string, pageText: string): boolean {
  if (!statement || !pageText) return false;
  const cleanStmt = normalizeForSearch(statement);
  const cleanPage = normalizeForSearch(pageText);

  if (cleanPage.includes(cleanStmt)) return true;

  // Check if significant core of the statement exists (at least 30 chars or 85% of words)
  const words = cleanStmt.split(' ').filter((w) => w.length > 2);
  if (words.length >= 4) {
    const matchedWords = words.filter((w) => cleanPage.includes(w));
    if (matchedWords.length / words.length >= 0.85) {
      return true;
    }
  }

  return false;
}

/**
 * Splits page text into coherent sentences or clause units preserving original text
 */
function extractSentences(text: string): string[] {
  if (!text) return [];
  // Protect abbreviations like Rs., No., Dr., etc. from being prematurely split
  const protectedText = text.replace(
    /(?<!\w)(Rs|ரூ|No|Vol|Dr|Mr|Mrs|vs|i\.e|e\.g|Sec|Cl)\.\s+/gi,
    '$1.__SPACE__'
  );

  // Split by full stops, semicolons, or newlines while keeping readable segments
  const rawSegments = protectedText.split(/(?<=[.!?\n])\s+/);
  const results: string[] = [];

  for (const seg of rawSegments) {
    const unescaped = seg.replace(/__SPACE__/g, ' ');
    const trimmed = unescaped.replace(/[\r\n]+/g, ' ').trim();
    if (trimmed.length > 15) {
      results.push(trimmed);
    }
  }
  return results;
}

interface DeadlineStatement {
  pageNumber: number;
  fullSentence: string;
  dateStr: string;
  normalizedDate: string;
  subject: string;
  isExplicitRevision: boolean;
  revisionTerms: string[];
}

interface AmountStatement {
  pageNumber: number;
  fullSentence: string;
  amountStr: string;
  numericVal: number;
  categoryOrEntity: string;
  periodOrUnit: string;
}

interface PercentageThresholdStatement {
  pageNumber: number;
  fullSentence: string;
  valueStr: string;
  numericVal: number;
  subject: string;
}

interface EligibilityStatement {
  pageNumber: number;
  fullSentence: string;
  entity: string;
  isEligible: boolean;
  condition: string;
}

interface PolicyDocumentStatement {
  pageNumber: number;
  fullSentence: string;
  documentName: string;
  isMandatory: boolean;
}

const REVISION_INDICATORS = [
  'revised',
  'extended',
  'corrigendum',
  'amended',
  'amendment',
  'updated',
  'postponed',
  'superseded',
  'supersedes',
  'replaces',
  'in partial modification',
  'extension of last date',
  'fresh deadline',
  'மாற்றப்பட்ட',
  'நீட்டிக்கப்பட்ட',
  'संशोधित',
  'बढ़ा दी गई',
];

const DEADLINE_CUES = [
  'deadline',
  'last date',
  'due date',
  'closing date',
  'submitted by',
  'submit by',
  'must be submitted by',
  'must be submitted on',
  'applications by',
  'apply by',
  'apply on or before',
  'on or before',
  'submission date',
  'submission by',
  'registration closes',
  'token generation',
  'valid up to',
  'validity period',
  'expiry date',
  'application deadline',
  'closing on',
  'close on',
  'open until',
  'last day',
  'final date',
  'cutoff date',
  'cut-off date',
  'no later than',
  'before or on',
  'by the date',
  'கடைசி தேதி',
  'இறுதி தேதி',
  'அனுப்பப்பட வேண்டும்',
  'अंतिम तिथि',
  'अंतिम तारीख',
  'समाप्ति तिथि',
  'जमा करने की तिथि',
];

/**
 * Extracts a normalized subject phrase from sentence context for deadline grouping.
 * Uses broader context extraction to handle diverse document types.
 */
function extractDeadlineSubject(sentence: string, lower: string): string {
  // Specific distinct processes first
  if (lower.includes('token') || lower.includes('booking')) {
    return 'Token Generation & Booking';
  }
  if (lower.includes('renewal') || lower.includes('continuation')) {
    return 'Scholarship / Scheme Renewal';
  }
  if (lower.includes('grievance') || lower.includes('complaint') || lower.includes('appeal')) {
    return 'Grievance / Appeal Submission';
  }
  if (lower.includes('compliance report') || lower.includes('annual audit')) {
    return 'Compliance & Audit Reporting';
  }
  if (lower.includes('payment') || lower.includes('fee') || lower.includes('instalment') || lower.includes('installment')) {
    return 'Payment / Fee Due Date';
  }
  if (lower.includes('tender') || lower.includes('bid') || lower.includes('quotation') || lower.includes('rfp') || lower.includes('rfq')) {
    return 'Tender / Procurement Deadline';
  }
  if (lower.includes('exam') || lower.includes('examination') || lower.includes('test') || lower.includes('assessment')) {
    return 'Examination / Test Deadline';
  }
  if (lower.includes('joining') || lower.includes('reporting') || lower.includes('commencement')) {
    return 'Joining / Commencement Date';
  }
  if (lower.includes('project') || lower.includes('proposal')) {
    return 'Project / Proposal Deadline';
  }

  // All applications, document submissions, registrations, and form deadlines
  return 'Application / Registration Submission';
}

function areDeadlineSubjectsCompatible(a: DeadlineStatement, b: DeadlineStatement): boolean {
  if (a.subject === b.subject) return true;
  const isAppA = a.subject.includes('Application') || a.subject.includes('Submission') || a.subject.includes('Registration');
  const isAppB = b.subject.includes('Application') || b.subject.includes('Submission') || b.subject.includes('Registration');
  const isSpecialA = a.subject.includes('Grievance') || a.subject.includes('Audit') || a.subject.includes('Renewal') || a.subject.includes('Token');
  const isSpecialB = b.subject.includes('Grievance') || b.subject.includes('Audit') || b.subject.includes('Renewal') || b.subject.includes('Token');
  return isAppA && isAppB && !isSpecialA && !isSpecialB;
}

/**
 * Parses and extracts deadlines with date details and revision cues
 */
function findDeadlineStatements(pages: DocumentPage[]): DeadlineStatement[] {
  const statements: DeadlineStatement[] = [];

  const dateRegex = /(?:(\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December|ஜனவரி|பிப்ரவரி|மார்ச்|ஏப்ரல்|மே|ஜூன்|ஜூலை|ஆகஸ்ட்|செப்டம்பர்|அக்டோபர்|நவம்பர்|டிசம்பர்|जनवरी|फरवरी|मार्च|अप्रैल|मई|जून|जुलाई|अगस्त|सितंबर|अक्टूबर|नवंबर|दिसंबर)\s+\d{4})|((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4})|(\d{1,2}[/-]\d{1,2}[/-]\d{4}))/gi;

  for (const page of pages) {
    const sentences = extractSentences(page.extractedText);
    for (const sentence of sentences) {
      const lower = sentence.toLowerCase();
      const hasDeadlineCue = DEADLINE_CUES.some((cue) => lower.includes(cue));
      if (!hasDeadlineCue) continue;

      const dateMatches = [...sentence.matchAll(dateRegex)];
      if (dateMatches.length === 0) continue;

      for (const match of dateMatches) {
        const rawDate = match[0];
        const lowerSent = sentence.toLowerCase();

        // Check for revision terms
        const matchedRevisionTerms = REVISION_INDICATORS.filter((term) =>
          lowerSent.includes(term)
        );

        // Extract subject using improved classifier
        const subject = extractDeadlineSubject(sentence, lowerSent);

        statements.push({
          pageNumber: page.pageNumber,
          fullSentence: sentence,
          dateStr: rawDate,
          normalizedDate: rawDate.replace(/\s+/g, ' ').toLowerCase(),
          subject,
          isExplicitRevision: matchedRevisionTerms.length > 0,
          revisionTerms: matchedRevisionTerms,
        });
      }
    }
  }

  return statements;
}

/**
 * Extracts financial figures and checks category alignment (to avoid false positives)
 */
function findAmountStatements(pages: DocumentPage[]): AmountStatement[] {
  const statements: AmountStatement[] = [];

  // Matches: ₹5,000 | Rs. 5,000 | Rs.5000 | Rs 5000 | INR 5000 | $5000 | £5000 | EUR 5000
  const amountRegex = /(?:ரூ\.?|௹|₹|Rs\.?\s*|INR\s*|\$|USD\s*|EUR\s*|£|GBP\s*)([\d,]+(?:\.\d{1,2})?)/gui;

  for (const page of pages) {
    const sentences = extractSentences(page.extractedText);
    for (const sentence of sentences) {
      const matches = [...sentence.matchAll(amountRegex)];
      if (matches.length === 0) continue;

      for (const m of matches) {
        const rawAmount = m[0];
        const digits = m[1].replace(/,/g, '');
        const val = parseFloat(digits);
        if (isNaN(val) || val <= 0) continue;

        const lower = sentence.toLowerCase();

        // Extract category or entity — ordered by specificity
        let categoryOrEntity = 'General / Unspecified';

        // === SCHOLARSHIP / STUDENT CATEGORIES ===
        if (lower.includes('day scholar') || lower.includes('day-scholar')) {
          categoryOrEntity = 'Day Scholars';
        } else if (lower.includes('hostel') || lower.includes('hosteller')) {
          categoryOrEntity = 'Hostellers';
        } else if (lower.includes('undergraduate') || lower.includes('ug degree') || lower.includes('ug courses')) {
          categoryOrEntity = 'Undergraduate (UG)';
        } else if (lower.includes('postgraduate') || lower.includes('pg degree') || lower.includes('pg courses')) {
          categoryOrEntity = 'Postgraduate (PG)';
        } else if (lower.includes('research scholar') || lower.includes('phd') || lower.includes('doctorate')) {
          categoryOrEntity = 'Research Scholars / PhD';
        } else if (lower.includes('merit scholarship') || lower.includes('merit grant')) {
          categoryOrEntity = 'Merit Scholarship';
        } else if ((lower.includes('sc ') || lower.includes('sc/')) && (lower.includes('scheduled caste') || lower.includes('sc/st'))) {
          categoryOrEntity = 'SC / Scheduled Caste';
        } else if (lower.includes('scheduled tribe') || lower.includes('st/')) {
          categoryOrEntity = 'ST / Scheduled Tribe';
        } else if (lower.includes('obc') || lower.includes('other backward')) {
          categoryOrEntity = 'OBC';
        } else if (lower.includes('ews') || lower.includes('economically weaker')) {
          categoryOrEntity = 'EWS';
        // === FINANCIAL / INCOME LIMITS ===
        } else if (
          lower.includes('income ceiling') || lower.includes('income limit') ||
          lower.includes('income threshold') || lower.includes('family income') ||
          (lower.includes('income') && lower.includes('ceiling')) ||
          lower.includes('வருமான')
        ) {
          categoryOrEntity = 'Family Income Ceiling';
        } else if (lower.includes('salary') || lower.includes('wage') || lower.includes('remuneration')) {
          categoryOrEntity = 'Salary / Wage Limit';
        // === HEALTH / INSURANCE ===
        } else if (lower.includes('coverage') || lower.includes('insurance') || lower.includes('காப்பீடு') || lower.includes('health cover')) {
          categoryOrEntity = 'Medical / Health Coverage';
        // === SOLAR / EQUIPMENT CATEGORIES ===
        } else if (lower.includes('2 hp') || lower.includes('2hp')) {
          categoryOrEntity = '2 HP Solar Pump';
        } else if (lower.includes('3 hp') || lower.includes('3hp')) {
          categoryOrEntity = '3 HP Solar Pump';
        } else if (lower.includes('5 hp') || lower.includes('5hp')) {
          categoryOrEntity = '5 HP Solar Pump';
        } else if (lower.includes('10 hp') || lower.includes('10hp')) {
          categoryOrEntity = '10 HP Solar Pump';
        // === PAYMENTS / INSTALMENTS ===
        } else if (lower.includes('instalment') || lower.includes('installment')) {
          categoryOrEntity = 'Instalment Benefit';
        } else if (lower.includes('security deposit') || lower.includes('earnest money') || lower.includes('emd')) {
          categoryOrEntity = 'Security Deposit';
        } else if (lower.includes('penalty') || lower.includes('liquidated damage')) {
          categoryOrEntity = 'Penalty / Fine';
        } else if (lower.includes('registration fee') || lower.includes('application fee') || lower.includes('processing fee')) {
          categoryOrEntity = 'Application / Registration Fee';
        } else if (lower.includes('tuition fee') || lower.includes('course fee') || lower.includes('examination fee')) {
          categoryOrEntity = 'Tuition / Course Fee';
        // === GRANTS / SUBSIDIES ===
        } else if (lower.includes('grant') || lower.includes('subsidy') || lower.includes('assistance') || lower.includes('aid') || lower.includes('benefit amount')) {
          categoryOrEntity = 'Grant / Subsidy Amount';
        // === TENDER / PROCUREMENT ===
        } else if (lower.includes('tender value') || lower.includes('contract value') || lower.includes('project cost') || lower.includes('estimated cost')) {
          categoryOrEntity = 'Tender / Contract Value';
        }

        let periodOrUnit = 'one-time';
        if (
          lower.includes('annum') || lower.includes('annual') || lower.includes('per year') ||
          lower.includes('yearly') || lower.includes('ஆண்டு') || lower.includes('ஆண்டிற்கு') ||
          lower.includes('वार्षिक')
        ) {
          periodOrUnit = 'per annum';
        } else if (
          lower.includes('month') || lower.includes('monthly') || lower.includes('per month') ||
          lower.includes('மாதம்') || lower.includes('मासिक')
        ) {
          periodOrUnit = 'per month';
        } else if (lower.includes('week') || lower.includes('weekly') || lower.includes('per week')) {
          periodOrUnit = 'per week';
        } else if (lower.includes('daily') || lower.includes('per day')) {
          periodOrUnit = 'per day';
        }

        statements.push({
          pageNumber: page.pageNumber,
          fullSentence: sentence,
          amountStr: rawAmount,
          numericVal: val,
          categoryOrEntity,
          periodOrUnit,
        });
      }
    }
  }

  return statements;
}

/**
 * Extracts numerical thresholds and percentage criteria
 */
function findPercentageStatements(pages: DocumentPage[]): PercentageThresholdStatement[] {
  const statements: PercentageThresholdStatement[] = [];
  const pctRegex = /(\d+(?:\.\d+)?)\s*(?:%|percent|percentage|प्रतिशत|சதவீதம்)/gui;

  for (const page of pages) {
    const sentences = extractSentences(page.extractedText);
    for (const sentence of sentences) {
      const matches = [...sentence.matchAll(pctRegex)];
      if (matches.length === 0) continue;

      for (const m of matches) {
        const val = parseFloat(m[1]);
        if (isNaN(val)) continue;
        const lower = sentence.toLowerCase();

        let subject = 'General Percentage';
        if (lower.includes('academic') || lower.includes('marks') || lower.includes('board examination') || lower.includes('aggregate') || lower.includes('score')) {
          subject = 'Minimum Academic Qualifying Marks';
        } else if (lower.includes('attendance') || lower.includes('வருடை') || lower.includes('present')) {
          subject = 'Minimum Attendance Threshold';
        } else if (lower.includes('subsidy') || lower.includes('grant') || lower.includes('अनुदान')) {
          subject = 'Government Subsidy Percentage';
        } else if (lower.includes('beneficiary share') || lower.includes('farmer share') || lower.includes('अंशदान') || lower.includes('contribution')) {
          subject = 'Beneficiary Share Percentage';
        } else if (lower.includes('interest') || lower.includes('rate of interest')) {
          subject = 'Interest Rate';
        } else if (lower.includes('discount') || lower.includes('rebate')) {
          subject = 'Discount / Rebate Percentage';
        } else if (lower.includes('reservation') || lower.includes('quota')) {
          subject = 'Reservation / Quota Percentage';
        } else if (lower.includes('penalty') || lower.includes('fine') || lower.includes('liquidated')) {
          subject = 'Penalty Percentage';
        } else if (lower.includes('tax') || lower.includes('gst') || lower.includes('vat')) {
          subject = 'Tax / GST Rate';
        }

        statements.push({
          pageNumber: page.pageNumber,
          fullSentence: sentence,
          valueStr: m[0],
          numericVal: val,
          subject,
        });
      }
    }
  }

  return statements;
}

/**
 * Detects contradictory eligibility clauses
 */
function findEligibilityStatements(pages: DocumentPage[]): EligibilityStatement[] {
  const statements: EligibilityStatement[] = [];

  for (const page of pages) {
    const sentences = extractSentences(page.extractedText);
    for (const sentence of sentences) {
      const lower = sentence.toLowerCase();
      const isNegative = /(ineligible|not eligible|excluded|disqualified|cannot apply|shall not be|are not entitled|தகுதியற்ற|அபாத்திர|अपात्र)/i.test(lower);
      const isPositive = /(is eligible|are eligible|entitled|qualifies|all members|shall be eligible|are entitled|தகுதியுடைய|पात्र)/i.test(lower);

      if (!isNegative && !isPositive) continue;

      let entity = 'General Beneficiary';
      if (lower.includes('distance education') || lower.includes('correspondence')) {
        entity = 'Distance Education / Correspondence Students';
      } else if (lower.includes('private candidate') || lower.includes('external candidate')) {
        entity = 'Private / External Candidates';
      } else if (lower.includes('smart card') || lower.includes('ration card')) {
        entity = 'Smart Card / Family Ration Card Holders';
      } else if (lower.includes('government employee') || lower.includes('pensioner')) {
        entity = 'Government Employees / Pensioners';
      } else if (lower.includes('day scholar') || lower.includes('day-scholar')) {
        entity = 'Day Scholars';
      } else if (lower.includes('hostel') || lower.includes('hosteller')) {
        entity = 'Hostellers';
      } else if (lower.includes('contractual') || lower.includes('contract worker') || lower.includes('temporary worker')) {
        entity = 'Contractual / Temporary Workers';
      } else if (lower.includes('permanent employee') || lower.includes('regular employee')) {
        entity = 'Permanent / Regular Employees';
      } else if (lower.includes('small farmer') || lower.includes('marginal farmer')) {
        entity = 'Small / Marginal Farmers';
      } else if (lower.includes('minority') || lower.includes('minorities')) {
        entity = 'Minority Communities';
      }

      statements.push({
        pageNumber: page.pageNumber,
        fullSentence: sentence,
        entity,
        isEligible: !isNegative,
        condition: sentence,
      });
    }
  }

  return statements;
}

/**
 * Detects policy document conflicts (e.g. mandatory vs exempt)
 */
function findPolicyDocumentStatements(pages: DocumentPage[]): PolicyDocumentStatement[] {
  const statements: PolicyDocumentStatement[] = [];

  const docKeywords = [
    { name: 'Income Certificate', cues: ['income certificate', 'வருமானச் சான்றிதழ்', 'आय प्रमाण पत्र'] },
    { name: 'Ration / Family Card', cues: ['ration card', 'family card', 'குடும்ப அட்டை', 'राशन कार्ड'] },
    { name: 'Aadhaar Card', cues: ['aadhaar', 'ஆதார்', 'आधार'] },
    { name: 'Land Ownership Record', cues: ['patta', 'chitta', 'khasra', 'khatauni', 'revenue record'] },
    { name: 'Birth Certificate', cues: ['birth certificate', 'date of birth certificate', 'ஜனன சான்றிதழ்'] },
    { name: 'Caste Certificate', cues: ['caste certificate', 'community certificate', 'ஜாதி சான்றிதழ்', 'जाति प्रमाण'] },
    { name: 'Disability Certificate', cues: ['disability certificate', 'handicap certificate', 'divyangjan', 'மாற்றுத்திறனாளி'] },
    { name: 'Domicile Certificate', cues: ['domicile certificate', 'residence certificate', 'resident certificate'] },
  ];

  for (const page of pages) {
    const sentences = extractSentences(page.extractedText);
    for (const sentence of sentences) {
      const lower = sentence.toLowerCase();

      for (const kw of docKeywords) {
        const matchesCue = kw.cues.some((c) => lower.includes(c));
        if (!matchesCue) continue;

        const isMandatory = /(mandatory|compulsory|required|strictly required|essential|must be submitted|இணைக்கப்பட வேண்டும்|கட்டாயமாகும்|अनिवार्य)/i.test(lower);
        const isExempt = /(not required|exempt|optional|need not be submitted|waived|வழங்க தேவையில்லை|आवश्यक नहीं)/i.test(lower);

        if (isMandatory || isExempt) {
          statements.push({
            pageNumber: page.pageNumber,
            fullSentence: sentence,
            documentName: kw.name,
            isMandatory: isMandatory && !isExempt,
          });
        }
      }
    }
  }

  return statements;
}

/**
 * Computes keyword similarity between two sentences (0-1 range).
 * Used to judge if two "General / Unspecified" amount statements are about the same thing.
 */
function computeContextSimilarity(sentA: string, sentB: string): number {
  const stopWords = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'for', 'to', 'in', 'on', 'at', 'of',
    'and', 'or', 'not', 'be', 'by', 'as', 'this', 'that', 'with', 'shall', 'will', 'may',
    'must', 'its', 'their', 'from', 'all', 'any', 'which', 'such',
  ]);
  const tokensA = new Set(sentA.toLowerCase().split(/\W+/).filter((w) => w.length > 2 && !stopWords.has(w)));
  const tokensB = new Set(sentB.toLowerCase().split(/\W+/).filter((w) => w.length > 2 && !stopWords.has(w)));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;
  let intersection = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) intersection++;
  }
  return intersection / Math.min(tokensA.size, tokensB.size);
}

/**
 * Main Detection Algorithm for Document Contradiction & Change Radar
 */
export function detectDocumentContradictions(
  documentId: string,
  title: string,
  pages: DocumentPage[]
): ContradictionRadarResult {
  const now = new Date().toISOString();
  const totalPages = pages.length;

  // 1. Scanned / Empty Check
  const totalTextLength = pages.reduce((acc, p) => acc + (p.extractedText || '').length, 0);
  if (totalTextLength < 15) {
    return {
      documentId,
      documentTitle: title,
      totalConflicts: 0,
      highPriorityCount: 0,
      manualReviewCount: 0,
      pagesAnalyzed: 0,
      totalPages,
      items: [],
      isScanned: true,
      ocrRequired: true,
      code: 'ocr_unavailable',
      error: 'This document appears to be a scanned image-only PDF and requires active OCR to detect contradictions. Configure a valid OCR provider or upload a text-readable PDF.',
      analyzedAt: now,
    };
  }

  // 2. Identify and track partially extracted pages
  const validPages = pages.filter((p) => (p.extractedText || '').trim().length > 0);
  const failedPageNumbers = pages
    .filter((p) => !(p.extractedText || '').trim())
    .map((p) => p.pageNumber);
  const isPartial = failedPageNumbers.length > 0 && validPages.length > 0;

  const items: ContradictionItem[] = [];
  let itemCounter = 1;

  // -------------------------------------------------------------
  // RULE 1: DATES AND DEADLINES CONTRADICTIONS
  // -------------------------------------------------------------
  const deadlines = findDeadlineStatements(validPages);

  for (let i = 0; i < deadlines.length; i++) {
    for (let j = i + 1; j < deadlines.length; j++) {
      const a = deadlines[i];
      const b = deadlines[j];

      // Check if they refer to the same or compatible subject
      if (!areDeadlineSubjectsCompatible(a, b)) continue;

      // If dates match, no contradiction
      if (a.normalizedDate === b.normalizedDate) continue;

      // CRITICAL: Grounding verification against page text
      const pageAText = validPages.find((p) => p.pageNumber === a.pageNumber)?.extractedText || '';
      const pageBText = validPages.find((p) => p.pageNumber === b.pageNumber)?.extractedText || '';
      if (!verifyPassageInPage(a.fullSentence, pageAText) || !verifyPassageInPage(b.fullSentence, pageBText)) {
        continue;
      }

      // Check for explicit revision indicator (AVOID FALSE POSITIVE)
      if (a.isExplicitRevision || b.isExplicitRevision) {
        // One statement is an explicit extension/revision.
        // Label as potential conflict with 'manual_review' priority, explaining it is an update!
        const revisingStmt = b.isExplicitRevision ? b : a;
        const origStmt = b.isExplicitRevision ? a : b;

        items.push({
          id: `conflict-date-${itemCounter++}`,
          category: 'dates_and_deadlines',
          severity: 'manual_review',
          title: `Explicit Deadline Extension: ${revisingStmt.subject}`,
          explanation: `Page ${revisingStmt.pageNumber} indicates a revised or extended deadline (${revisingStmt.dateStr}), updating the earlier deadline (${origStmt.dateStr}) from Page ${origStmt.pageNumber}.`,
          statementA: a.fullSentence,
          pageA: a.pageNumber,
          statementB: b.fullSentence,
          pageB: b.pageNumber,
          conflictReason: `Statement on Page ${revisingStmt.pageNumber} contains revision terms (${revisingStmt.revisionTerms.join(', ')}) updating '${origStmt.dateStr}' to '${revisingStmt.dateStr}'. Manual verification recommended to confirm which date governs.`,
          confidence: 'high',
          confidenceExplanation: `Both statements verified verbatim in source pages. Explicit revision language detected.`,
          status: 'needs_review',
        });
      } else {
        // Direct unacknowledged deadline conflict!
        items.push({
          id: `conflict-date-${itemCounter++}`,
          category: 'dates_and_deadlines',
          severity: 'high',
          title: `Conflicting Deadlines for ${a.subject}`,
          explanation: `Page ${a.pageNumber} states the deadline is "${a.dateStr}", while Page ${b.pageNumber} specifies "${b.dateStr}" for the same process without mentioning a revision.`,
          statementA: a.fullSentence,
          pageA: a.pageNumber,
          statementB: b.fullSentence,
          pageB: b.pageNumber,
          conflictReason: `Both passages establish incompatible submission deadlines for ${a.subject} without referencing an amendment or superseding order.`,
          confidence: 'high',
          confidenceExplanation: `Direct date conflict verified verbatim across Page ${a.pageNumber} and Page ${b.pageNumber}.`,
          status: 'needs_review',
        });
      }
    }
  }

  // -------------------------------------------------------------
  // RULE 2: FINANCIAL AMOUNTS CONTRADICTIONS
  // -------------------------------------------------------------
  const amounts = findAmountStatements(validPages);

  for (let i = 0; i < amounts.length; i++) {
    for (let j = i + 1; j < amounts.length; j++) {
      const a = amounts[i];
      const b = amounts[j];

      // CRITICAL AVOID FALSE POSITIVE:
      // If categories differ (e.g. Day Scholars vs Hostellers, or 2 HP vs 3 HP), DO NOT FLAG!
      if (a.categoryOrEntity !== b.categoryOrEntity) continue;

      // For "General / Unspecified", only flag if context similarity is high (same topic)
      if (a.categoryOrEntity === 'General / Unspecified') {
        const similarity = computeContextSimilarity(a.fullSentence, b.fullSentence);
        if (similarity < 0.35) continue; // Too dissimilar — likely different topics
      }

      // If amounts are identical, no conflict
      if (Math.abs(a.numericVal - b.numericVal) < 1) continue;

      // If periods differ (e.g. per month vs per annum), not an automatic contradiction unless calculated
      if (a.periodOrUnit !== b.periodOrUnit) continue;

      // Grounding verification
      const pageAText = validPages.find((p) => p.pageNumber === a.pageNumber)?.extractedText || '';
      const pageBText = validPages.find((p) => p.pageNumber === b.pageNumber)?.extractedText || '';
      if (!verifyPassageInPage(a.fullSentence, pageAText) || !verifyPassageInPage(b.fullSentence, pageBText)) {
        continue;
      }

      items.push({
        id: `conflict-amount-${itemCounter++}`,
        category: 'financial_amounts',
        severity: 'high',
        title: `Conflicting Financial Amount: ${a.categoryOrEntity}`,
        explanation: `Page ${a.pageNumber} specifies ${a.amountStr} (${a.periodOrUnit}) for ${a.categoryOrEntity}, but Page ${b.pageNumber} specifies ${b.amountStr} for the same category.`,
        statementA: a.fullSentence,
        pageA: a.pageNumber,
        statementB: b.fullSentence,
        pageB: b.pageNumber,
        conflictReason: `Discrepancy in monetary limit for the identical beneficiary/scheme category (${a.categoryOrEntity}). One passage specifies ${a.amountStr} while another states ${b.amountStr}.`,
        confidence: 'high',
        confidenceExplanation: `Exact amount discrepancy identified and cross-checked against source text on Pages ${a.pageNumber} and ${b.pageNumber}.`,
        status: 'needs_review',
      });
    }
  }

  // -------------------------------------------------------------
  // RULE 3: PERCENTAGES AND NUMERICAL THRESHOLDS
  // -------------------------------------------------------------
  const pcts = findPercentageStatements(validPages);

  for (let i = 0; i < pcts.length; i++) {
    for (let j = i + 1; j < pcts.length; j++) {
      const a = pcts[i];
      const b = pcts[j];

      if (a.subject !== b.subject) continue;
      if (a.subject === 'General Percentage') continue;
      if (Math.abs(a.numericVal - b.numericVal) < 0.5) continue;

      const pageAText = validPages.find((p) => p.pageNumber === a.pageNumber)?.extractedText || '';
      const pageBText = validPages.find((p) => p.pageNumber === b.pageNumber)?.extractedText || '';
      if (!verifyPassageInPage(a.fullSentence, pageAText) || !verifyPassageInPage(b.fullSentence, pageBText)) {
        continue;
      }

      items.push({
        id: `conflict-pct-${itemCounter++}`,
        category: 'percentages_and_thresholds',
        severity: 'high',
        title: `Conflicting Threshold: ${a.subject}`,
        explanation: `Page ${a.pageNumber} specifies a threshold of ${a.valueStr} for ${a.subject}, whereas Page ${b.pageNumber} specifies ${b.valueStr}.`,
        statementA: a.fullSentence,
        pageA: a.pageNumber,
        statementB: b.fullSentence,
        pageB: b.pageNumber,
        conflictReason: `Incompatible numerical percentage or cutoff defined for the same condition across different pages.`,
        confidence: 'high',
        confidenceExplanation: `Source sentences verified verbatim in document text.`,
        status: 'needs_review',
      });
    }
  }

  // -------------------------------------------------------------
  // RULE 4: ELIGIBILITY CRITERIA CONFLICTS
  // -------------------------------------------------------------
  const eligibilities = findEligibilityStatements(validPages);

  for (let i = 0; i < eligibilities.length; i++) {
    for (let j = i + 1; j < eligibilities.length; j++) {
      const a = eligibilities[i];
      const b = eligibilities[j];

      if (a.entity !== b.entity || a.entity === 'General Beneficiary') continue;
      if (a.isEligible === b.isEligible) continue; // Both agree, no conflict

      const pageAText = validPages.find((p) => p.pageNumber === a.pageNumber)?.extractedText || '';
      const pageBText = validPages.find((p) => p.pageNumber === b.pageNumber)?.extractedText || '';
      if (!verifyPassageInPage(a.fullSentence, pageAText) || !verifyPassageInPage(b.fullSentence, pageBText)) {
        continue;
      }

      items.push({
        id: `conflict-eligibility-${itemCounter++}`,
        category: 'eligibility_criteria',
        severity: 'high',
        title: `Contradictory Eligibility Rule: ${a.entity}`,
        explanation: `Page ${a.pageNumber} indicates that ${a.entity} is eligible/included, whereas Page ${b.pageNumber} explicitly excludes or disqualifies them.`,
        statementA: a.fullSentence,
        pageA: a.pageNumber,
        statementB: b.fullSentence,
        pageB: b.pageNumber,
        conflictReason: `Mutually exclusive eligibility definitions. One section permits participation while another mandates exclusion.`,
        confidence: 'high',
        confidenceExplanation: `Both clauses verified directly from document text.`,
        status: 'needs_review',
      });
    }
  }

  // -------------------------------------------------------------
  // RULE 5: REQUIRED DOCUMENTS & POLICY
  // -------------------------------------------------------------
  const policies = findPolicyDocumentStatements(validPages);

  for (let i = 0; i < policies.length; i++) {
    for (let j = i + 1; j < policies.length; j++) {
      const a = policies[i];
      const b = policies[j];

      if (a.documentName !== b.documentName) continue;
      if (a.isMandatory === b.isMandatory) continue;

      const pageAText = validPages.find((p) => p.pageNumber === a.pageNumber)?.extractedText || '';
      const pageBText = validPages.find((p) => p.pageNumber === b.pageNumber)?.extractedText || '';
      if (!verifyPassageInPage(a.fullSentence, pageAText) || !verifyPassageInPage(b.fullSentence, pageBText)) {
        continue;
      }

      items.push({
        id: `conflict-policy-${itemCounter++}`,
        category: 'required_documents',
        severity: 'medium',
        title: `Conflicting Requirement for ${a.documentName}`,
        explanation: `Page ${a.pageNumber} states that ${a.documentName} is mandatory, while Page ${b.pageNumber} indicates it is optional or exempted.`,
        statementA: a.fullSentence,
        pageA: a.pageNumber,
        statementB: b.fullSentence,
        pageB: b.pageNumber,
        conflictReason: `One section requires ${a.documentName} as a compulsory submission, while another section states it is not required.`,
        confidence: 'medium',
        confidenceExplanation: `Passages verified in document. Further contextual clarification may be required.`,
        status: 'needs_review',
      });
    }
  }

  // 3. Deduplication of findings
  const uniqueItems: ContradictionItem[] = [];
  const seenPairs = new Set<string>();

  for (const item of items) {
    const pairKey = [item.statementA, item.statementB].sort().join('||');
    if (!seenPairs.has(pairKey)) {
      seenPairs.add(pairKey);
      uniqueItems.push(item);
    }
  }

  const highPriorityCount = uniqueItems.filter((i) => i.severity === 'high').length;
  const manualReviewCount = uniqueItems.filter(
    (i) => i.severity === 'manual_review' || i.severity === 'medium'
  ).length;

  return {
    documentId,
    documentTitle: title,
    totalConflicts: uniqueItems.length,
    highPriorityCount,
    manualReviewCount,
    pagesAnalyzed: validPages.length,
    totalPages,
    items: uniqueItems,
    partialAnalysis: isPartial,
    pagesFailed: failedPageNumbers,
    analyzedAt: now,
  };
}

/**
 * Version Comparison & Change Radar between Document A and Document B
 */
export function detectVersionChanges(
  docAId: string,
  docATitle: string,
  pagesA: DocumentPage[],
  docBId: string,
  docBTitle: string,
  pagesB: DocumentPage[]
): ContradictionRadarResult {
  const now = new Date().toISOString();
  const validPagesA = pagesA.filter((p) => (p.extractedText || '').trim().length > 0);
  const validPagesB = pagesB.filter((p) => (p.extractedText || '').trim().length > 0);

  const items: ContradictionItem[] = [];
  let itemCounter = 1;

  // Compare deadlines between Doc A and Doc B
  const deadlinesA = findDeadlineStatements(validPagesA);
  const deadlinesB = findDeadlineStatements(validPagesB);

  for (const a of deadlinesA) {
    for (const b of deadlinesB) {
      if (areDeadlineSubjectsCompatible(a, b) && a.normalizedDate !== b.normalizedDate) {
        items.push({
          id: `version-date-${itemCounter++}`,
          category: 'dates_and_deadlines',
          severity: b.isExplicitRevision ? 'medium' : 'high',
          title: `Deadline Revision: ${a.subject}`,
          explanation: `Document A (earlier) specifies ${a.dateStr} on Page ${a.pageNumber}, whereas Document B (newer) specifies ${b.dateStr} on Page ${b.pageNumber}.`,
          statementA: a.fullSentence,
          pageA: a.pageNumber,
          statementB: b.fullSentence,
          pageB: b.pageNumber,
          conflictReason: `Deadline updated from "${a.dateStr}" in Document A to "${b.dateStr}" in Document B.`,
          confidence: 'high',
          confidenceExplanation: `Verified across Document A and Document B pages.`,
          status: 'needs_review',
          isVersionComparison: true,
          docAId,
          docBId,
          docATitle,
          docBTitle,
        });
      }
    }
  }

  // Compare financial amounts between Doc A and Doc B
  const amountsA = findAmountStatements(validPagesA);
  const amountsB = findAmountStatements(validPagesB);

  for (const a of amountsA) {
    for (const b of amountsB) {
      const sameCategory = a.categoryOrEntity === b.categoryOrEntity;
      const notUnspecified = a.categoryOrEntity !== 'General / Unspecified';
      const differentAmounts = Math.abs(a.numericVal - b.numericVal) > 1;
      const samePeriod = a.periodOrUnit === b.periodOrUnit;

      if (!sameCategory) continue;
      if (!notUnspecified) {
        const similarity = computeContextSimilarity(a.fullSentence, b.fullSentence);
        if (similarity < 0.35) continue;
      }
      if (!differentAmounts || !samePeriod) continue;

      items.push({
        id: `version-amount-${itemCounter++}`,
        category: 'financial_amounts',
        severity: 'high',
        title: `Benefit / Amount Revision: ${a.categoryOrEntity}`,
        explanation: `Document A specifies ${a.amountStr} on Page ${a.pageNumber}, updated to ${b.amountStr} in Document B on Page ${b.pageNumber}.`,
        statementA: a.fullSentence,
        pageA: a.pageNumber,
        statementB: b.fullSentence,
        pageB: b.pageNumber,
        conflictReason: `Monetary limit for ${a.categoryOrEntity} modified between document versions.`,
        confidence: 'high',
        confidenceExplanation: `Source figures extracted and grounded in respective versions.`,
        status: 'needs_review',
        isVersionComparison: true,
        docAId,
        docBId,
        docATitle,
        docBTitle,
      });
    }
  }

  // Compare eligibility between Doc A and Doc B
  const eligA = findEligibilityStatements(validPagesA);
  const eligB = findEligibilityStatements(validPagesB);

  for (const a of eligA) {
    for (const b of eligB) {
      if (a.entity === b.entity && a.entity !== 'General Beneficiary' && a.isEligible !== b.isEligible) {
        items.push({
          id: `version-eligibility-${itemCounter++}`,
          category: 'eligibility_criteria',
          severity: 'high',
          title: `Eligibility Policy Change: ${a.entity}`,
          explanation: `Document A states ${a.entity} was ${a.isEligible ? 'eligible' : 'ineligible'}, but Document B changes this to ${b.isEligible ? 'eligible' : 'ineligible'}.`,
          statementA: a.fullSentence,
          pageA: a.pageNumber,
          statementB: b.fullSentence,
          pageB: b.pageNumber,
          conflictReason: `Policy change regarding qualification status of ${a.entity}.`,
          confidence: 'high',
          confidenceExplanation: `Verified clauses in Document A and Document B.`,
          status: 'needs_review',
          isVersionComparison: true,
          docAId,
          docBId,
          docATitle,
          docBTitle,
        });
      }
    }
  }

  const highPriorityCount = items.filter((i) => i.severity === 'high').length;
  const manualReviewCount = items.filter((i) => i.severity === 'manual_review' || i.severity === 'medium').length;

  return {
    documentId: `${docAId}_vs_${docBId}`,
    documentTitle: `${docATitle} vs ${docBTitle}`,
    totalConflicts: items.length,
    highPriorityCount,
    manualReviewCount,
    pagesAnalyzed: validPagesA.length + validPagesB.length,
    totalPages: pagesA.length + pagesB.length,
    items,
    isVersionComparison: true,
    docBId,
    docBTitle,
    analyzedAt: now,
  };
}
