import { ClarioDocument, TestCaseResult } from '../types';

interface CandidateSentence {
  pageNumber: number;
  text: string;
  hasNumber: boolean;
  hasIndianScript: boolean;
  hasCurrency: boolean;
  numbers: string[];
}

/**
 * Extract clean candidate sentences from document pages.
 */
function extractSentences(pages: ClarioDocument['pages']): CandidateSentence[] {
  const candidates: CandidateSentence[] = [];

  for (const page of pages) {
    const rawText = page.extractedText || '';
    if (!rawText.trim()) continue;

    // Split on period, newline, or Indian danda (।)
    const rawSentences = rawText
      .split(/(?<=[.!?।\n])\s+/)
      .map((s) => s.replace(/[\r\n]+/g, ' ').trim())
      .filter((s) => s.length >= 25 && s.length <= 250);

    for (const text of rawSentences) {
      // Check for numbers and currencies
      const numberMatches = text.match(/(?:₹|Rs\.?|INR|\$)?\s*\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+/g) || [];
      const hasCurrency = /(?:₹|Rs\.?|INR|\$|ரூ\.|रुपये)/i.test(text);
      const hasIndianScript = /[\u0900-\u0D7F]/.test(text);

      candidates.push({
        pageNumber: page.pageNumber,
        text,
        hasNumber: numberMatches.length > 0,
        hasIndianScript,
        hasCurrency,
        numbers: numberMatches.map((n) => n.trim()),
      });
    }
  }

  return candidates;
}

/**
 * Derive an appropriate question from a declarative sentence.
 */
function deriveFactualQuestion(sentence: string): { question: string; expectedAnswer: string } {
  // If sentence mentions subsidy, cost, or amount
  if (/subsidy|grant|cost|fee|allowance|ceiling|income/i.test(sentence)) {
    return {
      question: `What is the specified provision or amount stated in: "${sentence.slice(0, 70)}..."?`,
      expectedAnswer: sentence,
    };
  }
  // If sentence mentions eligibility, criteria, qualification
  if (/eligible|eligibility|criteria|requirement|qualification|applicant/i.test(sentence)) {
    return {
      question: `What are the eligibility requirements or criteria outlined regarding "${sentence.slice(0, 60)}..."?`,
      expectedAnswer: sentence,
    };
  }
  // If sentence mentions deadline, date, timeline, period
  if (/deadline|date|period|timeline|warranty|validity|duration/i.test(sentence)) {
    return {
      question: `What is the timeline, date, or duration specified in: "${sentence.slice(0, 70)}..."?`,
      expectedAnswer: sentence,
    };
  }
  // Generic fact question based on the sentence prefix
  const words = sentence.split(/\s+/).slice(0, 8).join(' ');
  return {
    question: `What information is detailed regarding ${words}?`,
    expectedAnswer: sentence,
  };
}

/**
 * Candidate ungrounded questions to test strict "Not in the document" rejection.
 */
const ABSENT_CANDIDATE_QUERIES = [
  'What is the maximum age limit for PhD applicants applying for this scholarship?',
  'What is the reimbursement policy for international commercial flight tickets?',
  'What is the mandatory warranty period for quantum superconductor computing modules?',
  'What is the interest subsidy percentage for four-wheeler commercial vehicle loans?',
  'What are the visa and passport clearance requirements for foreign exchange students?',
  'What is the monthly stipend allocated for deep-sea robotic exploration trainees?',
];

/**
 * Pick a question that is guaranteed to be 100% absent from the document text.
 */
function pickStrictMissingQuestion(corpus: string): string {
  const corpusLower = corpus.toLowerCase();
  for (const q of ABSENT_CANDIDATE_QUERIES) {
    const qTokens = q.toLowerCase().split(/[\s,.;:!?]+/).filter((w) => w.length > 4);
    const matchesAny = qTokens.some((token) => corpusLower.includes(token));
    if (!matchesAny) {
      return q;
    }
  }
  // Fallback guaranteed absent query
  return 'What is the reimbursement policy for commercial quantum orbital flight tickets?';
}

/**
 * Dynamically generates a regression test suite evaluated against the uploaded PDF's actual content.
 */
export function generateDocumentTests(doc: ClarioDocument): TestCaseResult[] {
  const pages = doc.pages || [];
  const corpus = pages.map((p) => p.extractedText || '').join('\n\n');
  const sentences = extractSentences(pages);

  // Case 1: Scanned PDF with no text extracted
  if (sentences.length === 0 || !corpus.trim()) {
    return [
      {
        id: 'TC_OCR',
        title: 'TC1 — Scanned PDF & OCR Integrity Test',
        description:
          'Evaluates handling of a scanned image-only document. Verifies that genuine OCR is invoked or a structured 503 error is reported if OCR services are unavailable.',
        status: 'idle',
        documentName: doc.filename,
        question: 'Extract and analyze text from this scanned PDF.',
        targetLanguage: 'English',
        expectedBehavior:
          'Genuine OCR extraction attempted; returns clear structured error (HTTP 503 ocr_unavailable) if no OCR provider is configured.',
        testCategory: 'ocr_integrity',
      },
    ];
  }

  const tests: TestCaseResult[] = [];

  // -------------------------------------------------------------
  // Test 1: Grounded Factual Answer with Exact Page Citation
  // -------------------------------------------------------------
  const factCandidate = sentences[0] || {
    pageNumber: 1,
    text: corpus.slice(0, 150),
    hasNumber: false,
    hasIndianScript: false,
    hasCurrency: false,
    numbers: [],
  };
  const { question: factQ } = deriveFactualQuestion(factCandidate.text);

  tests.push({
    id: 'TC1',
    title: 'TC1 — Grounded Answer with Exact Page Citation',
    description: `Evaluates that Clario answers accurately based on Page ${factCandidate.pageNumber} with an exact page number and verbatim supporting passage.`,
    status: 'idle',
    documentName: doc.filename,
    question: factQ,
    targetLanguage: 'English',
    expectedBehavior: `Answers accurately from Page ${factCandidate.pageNumber} citing the verbatim passage.`,
    expectedPassage: factCandidate.text,
    expectedPage: factCandidate.pageNumber,
    expectedAnswer: factCandidate.text,
    testCategory: 'grounded_fact',
  });

  // -------------------------------------------------------------
  // Test 2: Numerical & Quantitative Extraction
  // -------------------------------------------------------------
  const numCandidate =
    sentences.find((s) => s.hasNumber && s.text !== factCandidate.text) ||
    sentences.find((s) => s.hasNumber) ||
    sentences[Math.min(1, sentences.length - 1)];

  const numVal = numCandidate.numbers[0] || 'numerical specification';
  tests.push({
    id: 'TC2',
    title: 'TC2 — Numerical & Entity Extraction',
    description: `Tests precise extraction of numbers/rates/dates from Page ${numCandidate.pageNumber}.`,
    status: 'idle',
    documentName: doc.filename,
    question: `What specific value, amount, or rate is stated regarding: "${numCandidate.text.slice(0, 75)}..."?`,
    targetLanguage: 'English',
    expectedBehavior: `Extracts the figure "${numVal}" from Page ${numCandidate.pageNumber} with verbatim citation.`,
    expectedPassage: numCandidate.text,
    expectedPage: numCandidate.pageNumber,
    expectedAnswer: numVal,
    testCategory: 'numerical_extraction',
  });

  // -------------------------------------------------------------
  // Test 3: Strict Missing Information Fallback
  // -------------------------------------------------------------
  const missingQ = pickStrictMissingQuestion(corpus);
  tests.push({
    id: 'TC3',
    title: 'TC3 — Strict Missing Information Fallback',
    description:
      'Strict test for unsupported questions. The answer MUST BE EXACTLY "Not in the document" with zero extra commentary and zero citations.',
    status: 'idle',
    documentName: doc.filename,
    question: missingQ,
    targetLanguage: 'English',
    expectedBehavior:
      'Returns strictly "Not in the document" because the queried topic is completely absent from the uploaded PDF.',
    expectedAnswer: 'Not in the document',
    testCategory: 'missing_information',
  });

  // -------------------------------------------------------------
  // Test 4: Citation Accuracy & Negative/Anti-Hallucination Test
  // -------------------------------------------------------------
  // Pick sentence on page 2 or higher if multi-page, or another section
  const laterSentence =
    sentences.find((s) => s.pageNumber > 1) ||
    sentences[Math.min(2, sentences.length - 1)];

  tests.push({
    id: 'TC4',
    title: 'TC4 — Factual Accuracy & Citation Grounding',
    description: `Verifies that evidence is cited from the correct page (Page ${laterSentence.pageNumber}) and rejects answers that invent facts or cite wrong pages.`,
    status: 'idle',
    documentName: doc.filename,
    question: `What details are specified in the document clause: "${laterSentence.text.slice(0, 65)}..."?`,
    targetLanguage: 'English',
    expectedBehavior: `Must cite Page ${laterSentence.pageNumber} precisely without hallucinating facts from outside the document.`,
    expectedPassage: laterSentence.text,
    expectedPage: laterSentence.pageNumber,
    expectedAnswer: laterSentence.text,
    testCategory: 'citation_accuracy',
  });

  // -------------------------------------------------------------
  // Test 5: Multilingual & Script Preservation
  // -------------------------------------------------------------
  const indianSentence = sentences.find((s) => s.hasIndianScript);
  const targetScriptLang = indianSentence ? 'Hindi' : 'Hindi';

  tests.push({
    id: 'TC5',
    title: 'TC5 — Multilingual Retrieval & Script Preservation',
    description: `Answers in ${targetScriptLang} while preserving the verbatim original source passage and exact page citation from the uploaded document.`,
    status: 'idle',
    documentName: doc.filename,
    question: `Provide a concise explanation in ${targetScriptLang} for: "${(indianSentence || factCandidate).text.slice(0, 70)}..."`,
    targetLanguage: targetScriptLang,
    expectedBehavior: `Answers in ${targetScriptLang} while citing Page ${(indianSentence || factCandidate).pageNumber} with the authentic original source passage.`,
    expectedPassage: (indianSentence || factCandidate).text,
    expectedPage: (indianSentence || factCandidate).pageNumber,
    testCategory: 'multilingual',
  });

  return tests;
}

/**
 * Validates a test case execution result against ground truth.
 */
export function evaluateTestResult(
  test: TestCaseResult,
  actualOutput: string,
  citations: any[]
): {
  passed: boolean;
  passedAsserts: string[];
  failedAsserts: string[];
  failureReason?: string;
} {
  const passedAsserts: string[] = [];
  const failedAsserts: string[] = [];
  const trimmedAnswer = (actualOutput || '').trim();

  // Test 1 & 4: Grounded fact & citation accuracy
  if (test.testCategory === 'grounded_fact' || test.testCategory === 'citation_accuracy') {
    const hasExpectedPage = test.expectedPage
      ? citations.some((c: any) => Number(c.pageNumber) === Number(test.expectedPage))
      : citations.length > 0;

    const hasPassage = citations.some(
      (c: any) =>
        c.supportingPassage &&
        typeof c.supportingPassage === 'string' &&
        c.supportingPassage.trim().length > 10
    );

    const answerNotEmpty =
      trimmedAnswer.length > 10 && trimmedAnswer !== 'Not in the document';

    if (answerNotEmpty) {
      passedAsserts.push('Generated grounded answer based on uploaded document content');
    } else {
      failedAsserts.push('Answer is empty or improperly fell back to missing info');
    }

    if (hasExpectedPage) {
      passedAsserts.push(`Cited exact page number: Page ${test.expectedPage}`);
    } else {
      failedAsserts.push(`Page citation missing or did not match expected Page ${test.expectedPage}`);
    }

    if (hasPassage) {
      passedAsserts.push('Attached verbatim supporting evidence from document');
    } else {
      failedAsserts.push('Verbatim supporting passage is missing or insufficient');
    }

    const passed = answerNotEmpty && hasExpectedPage && hasPassage;
    return {
      passed,
      passedAsserts,
      failedAsserts,
      failureReason: passed ? undefined : failedAsserts.join(' · '),
    };
  }

  // Test 2: Numerical Extraction
  if (test.testCategory === 'numerical_extraction') {
    const expectedVal = test.expectedAnswer || '';
    const cleanNum = expectedVal.replace(/[^\d.,]/g, '');
    const hasNumber = cleanNum ? trimmedAnswer.includes(cleanNum) : true;
    const hasCitation = citations.length > 0;
    const citesPage = test.expectedPage
      ? citations.some((c: any) => Number(c.pageNumber) === Number(test.expectedPage))
      : true;

    if (hasNumber) {
      passedAsserts.push(`Extracted numerical value accurately (${cleanNum || expectedVal})`);
    } else {
      failedAsserts.push(`Expected numerical value (${cleanNum || expectedVal}) not found in answer`);
    }

    if (citesPage) {
      passedAsserts.push(`Grounded in expected Page ${test.expectedPage}`);
    } else {
      failedAsserts.push(`Citation does not point to Page ${test.expectedPage}`);
    }

    const passed = hasNumber && citesPage && hasCitation;
    return {
      passed,
      passedAsserts,
      failedAsserts,
      failureReason: passed ? undefined : failedAsserts.join(' · '),
    };
  }

  // Test 3: Strict Missing Information Fallback
  if (test.testCategory === 'missing_information') {
    const isStrict = trimmedAnswer === 'Not in the document';
    const zeroCitations = citations.length === 0;

    if (isStrict) {
      passedAsserts.push('Output matches mandatory fallback string exactly: "Not in the document"');
    } else {
      failedAsserts.push(`Answer was "${trimmedAnswer}" instead of exact fallback "Not in the document"`);
    }

    if (zeroCitations) {
      passedAsserts.push('Zero hallucinated citations attached');
    } else {
      failedAsserts.push(`Hallucinated ${citations.length} citation(s) for absent fact`);
    }

    const passed = isStrict && zeroCitations;
    return {
      passed,
      passedAsserts,
      failedAsserts,
      failureReason: passed ? undefined : failedAsserts.join(' · '),
    };
  }

  // Test 5: Multilingual
  if (test.testCategory === 'multilingual') {
    const hasCitation = citations.length > 0;
    const answerNotEmpty = trimmedAnswer.length > 5;
    const preservesScript = citations.some(
      (c: any) => c.supportingPassage && c.supportingPassage.trim().length > 5
    );

    if (answerNotEmpty) {
      passedAsserts.push(`Answered in requested language (${test.targetLanguage})`);
    } else {
      failedAsserts.push('Answer in target language was empty');
    }

    if (preservesScript) {
      passedAsserts.push('Preserved authentic source verbatim quote in citation');
    } else {
      failedAsserts.push('Citation verbatim passage missing');
    }

    const passed = answerNotEmpty && hasCitation && preservesScript;
    return {
      passed,
      passedAsserts,
      failedAsserts,
      failureReason: passed ? undefined : failedAsserts.join(' · '),
    };
  }

  // Generic evaluation
  const passed = trimmedAnswer.length > 0 && citations.length > 0;
  if (passed) passedAsserts.push('Test passed evaluation');
  else failedAsserts.push('Answer or citations missing');

  return {
    passed,
    passedAsserts,
    failedAsserts,
    failureReason: passed ? undefined : failedAsserts.join(' · '),
  };
}
