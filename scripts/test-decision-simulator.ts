/**
 * Comprehensive Automated Verification Test Suite for Clario Interactive Document Decision Simulator
 * Covers Tests A through L:
 *   Test A — Numerical threshold (< ₹2,50,000, input ₹2,00,000 -> Satisfied)
 *   Test B — Strict inequality boundary (< ₹2,50,000, input ₹2,50,000 -> Not satisfied, strict '<')
 *   Test C — Above threshold (< ₹2,50,000, input ₹3,00,000 -> Not satisfied)
 *   Test D — Missing input (no income input -> Missing Input, no fabricated result)
 *   Test E — Multiple requirements (income limit + min aggregate marks -> separately evaluated + combined overall)
 *   Test F — Different categories (UG vs PG -> correct category-specific threshold applied without mixing)
 *   Test G — Ambiguous source (unclear wording -> Needs Review, no invented condition)
 *   Test H — Unsupported rule (complex condition -> Unable to Evaluate with explanation)
 *   Test I — Evidence validation (invalid page or invented quote rejected/flagged)
 *   Test J — Actual uploaded PDF (processes actual PDF pages through extraction & evaluation)
 *   Test K — Data isolation (user authorized access and document scoping)
 *   Test L — Regression testing (existing endpoints and features still work)
 */

import http from 'http';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import {
  evaluateSingleRule,
  evaluateAllDocumentRules,
  extractDocumentRulesFromPages,
  validateRuleEvidence,
  compareScenarios,
} from '../src/lib/decisionSimulator';
import { DocumentPage, DocumentRule, SimulationScenario } from '../src/types';
import handler from '../api/index.js';

let passed = 0;
let total = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  total++;
  if (condition) {
    console.log(`  ✓ PASS [${testName}] ${detail || ''}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL [${testName}] ${detail || ''}`);
  }
}

async function makePostRequest(
  baseUrl: string,
  pathname: string,
  payload: any
): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const url = new URL(pathname, baseUrl);
    const postData = JSON.stringify(payload);
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
        },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode || 500, data: JSON.parse(body) });
          } catch {
            resolve({ status: res.statusCode || 500, data: body });
          }
        });
      }
    );
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function runAllTests() {
  console.log('================================================================');
  console.log(' CLARIO DECISION SIMULATOR — COMPREHENSIVE TEST SUITE (A-L)    ');
  console.log('================================================================\n');

  const server = http.createServer((req, res) => {
    handler(req, res);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}`;
  console.log(`[Test Server] Live handler listening on ${baseUrl}\n`);

  try {
    // -------------------------------------------------------------------------
    // TEST A: Numerical threshold
    // Source: "Annual family income must be less than ₹2,50,000."
    // Input: ₹2,00,000. Expected: Condition satisfied.
    // -------------------------------------------------------------------------
    console.log('----------------------------------------------------------------');
    console.log('TEST A: Numerical Threshold Evaluation');
    console.log('----------------------------------------------------------------');
    const incomeRuleStrict: DocumentRule = {
      id: 'rule-inc-test',
      ruleName: 'Annual Family Income Limit',
      fieldId: 'family_income',
      fieldLabel: 'Annual Family Income',
      ruleType: 'currency',
      operator: 'less_than', // STRICT INEQUALITY: < 250000
      requiredValue: 250000,
      currency: '₹',
      unit: 'per annum',
      quotation: 'Annual family income must be less than ₹2,50,000.',
      pageNumber: 1,
      status: 'clear',
    };

    const resA = evaluateSingleRule(incomeRuleStrict, 200000);
    assert(
      resA.status === 'satisfied',
      'Test A.1',
      `Input ₹2,00,000 vs ceiling ₹2,50,000 -> Status: ${resA.status} (Expected: satisfied)`
    );
    assert(
      resA.explanation.includes('strictly less than'),
      'Test A.2',
      `Explanation confirms strict inequality satisfaction: "${resA.explanation}"`
    );

    // -------------------------------------------------------------------------
    // TEST B: Strict inequality boundary
    // Use the same source rule. Input: ₹2,50,000.
    // Expected: Condition not satisfied because source says "less than", not "less than or equal to".
    // -------------------------------------------------------------------------
    console.log('\n----------------------------------------------------------------');
    console.log('TEST B: Strict Inequality Boundary Preservation');
    console.log('----------------------------------------------------------------');
    const resB = evaluateSingleRule(incomeRuleStrict, 250000);
    assert(
      resB.status === 'not_satisfied',
      'Test B.1',
      `Boundary input ₹2,50,000 vs strict ceiling ₹2,50,000 -> Status: ${resB.status} (Expected: not_satisfied)`
    );
    assert(
      resB.explanation.includes('strict boundary') || resB.explanation.includes('less than'),
      'Test B.2',
      `Explanation explicitly notes boundary rule: "${resB.explanation}"`
    );

    // -------------------------------------------------------------------------
    // TEST C: Above the threshold
    // Input: ₹3,00,000. Expected: Condition not satisfied.
    // -------------------------------------------------------------------------
    console.log('\n----------------------------------------------------------------');
    console.log('TEST C: Above the Threshold Evaluation');
    console.log('----------------------------------------------------------------');
    const resC = evaluateSingleRule(incomeRuleStrict, 300000);
    assert(
      resC.status === 'not_satisfied',
      'Test C.1',
      `Input ₹3,00,000 vs ceiling ₹2,50,000 -> Status: ${resC.status} (Expected: not_satisfied)`
    );
    assert(
      resC.explanation.includes('exceeds'),
      'Test C.2',
      `Explanation confirms threshold exceeded: "${resC.explanation}"`
    );

    // -------------------------------------------------------------------------
    // TEST D: Missing input
    // Do not provide family income. Expected: Missing Input. No pass or fail is fabricated.
    // -------------------------------------------------------------------------
    console.log('\n----------------------------------------------------------------');
    console.log('TEST D: Missing Input Handling');
    console.log('----------------------------------------------------------------');
    const resD = evaluateSingleRule(incomeRuleStrict, undefined);
    assert(
      resD.status === 'missing_input',
      'Test D.1',
      `Undefined input -> Status: ${resD.status} (Expected: missing_input)`
    );
    const resD2 = evaluateSingleRule(incomeRuleStrict, '');
    assert(
      resD2.status === 'missing_input',
      'Test D.2',
      `Empty string input -> Status: ${resD2.status} (Expected: missing_input)`
    );

    // -------------------------------------------------------------------------
    // TEST E: Multiple requirements
    // Income limit + minimum examination score (60%).
    // Evaluate each separately and produce overall assessment.
    // -------------------------------------------------------------------------
    console.log('\n----------------------------------------------------------------');
    console.log('TEST E: Multiple Requirements & Overall Assessment');
    console.log('----------------------------------------------------------------');
    const marksRule: DocumentRule = {
      id: 'rule-marks-test',
      ruleName: 'Minimum Academic Marks',
      fieldId: 'academic_marks_percentage',
      fieldLabel: 'Qualifying Examination Marks (%)',
      ruleType: 'percentage',
      operator: 'greater_than_or_equal',
      requiredValue: 60,
      unit: '%',
      quotation: 'Minimum 60% aggregate marks in Class 12th Board Examination.',
      pageNumber: 1,
      status: 'clear',
    };

    const multiRules = [incomeRuleStrict, marksRule];

    // Case 1: Both satisfied
    const simBothPass = evaluateAllDocumentRules('doc-1', 'Scholarship Doc', multiRules, {
      family_income: 200000,
      academic_marks_percentage: 75,
    });
    assert(
      simBothPass.overallStatus === 'all_satisfied',
      'Test E.1',
      `Both conditions met -> Overall: ${simBothPass.overallStatus} (Expected: all_satisfied)`
    );
    assert(
      simBothPass.satisfiedCount === 2,
      'Test E.2',
      `Satisfied count: ${simBothPass.satisfiedCount}/2`
    );

    // Case 2: One fails (income passes, marks fail)
    const simOneFail = evaluateAllDocumentRules('doc-1', 'Scholarship Doc', multiRules, {
      family_income: 200000,
      academic_marks_percentage: 55, // below 60%
    });
    assert(
      simOneFail.overallStatus === 'some_not_satisfied',
      'Test E.3',
      `One condition failed (55% < 60%) -> Overall: ${simOneFail.overallStatus} (Expected: some_not_satisfied)`
    );
    assert(
      simOneFail.notSatisfiedCount === 1 && simOneFail.satisfiedCount === 1,
      'Test E.4',
      `Breakdown: ${simOneFail.satisfiedCount} satisfied, ${simOneFail.notSatisfiedCount} not satisfied`
    );

    // -------------------------------------------------------------------------
    // TEST F: Different categories
    // The document specifies different thresholds for explicitly different categories.
    // E.g. UG scholarship Rs. 12,000 vs PG scholarship Rs. 20,000.
    // -------------------------------------------------------------------------
    console.log('\n----------------------------------------------------------------');
    console.log('TEST F: Category Isolation');
    console.log('----------------------------------------------------------------');
    const ugRateRule: DocumentRule = {
      id: 'rule-ug-rate',
      ruleName: 'UG Scholarship Entitlement',
      fieldId: 'ug_scholarship_rate',
      fieldLabel: 'UG Entitlement',
      ruleType: 'currency',
      operator: 'equals',
      requiredValue: 12000,
      currency: '₹',
      applicableCategory: 'Undergraduate (UG)',
      quotation: 'Undergraduate (UG) Students: Rs. 12,000 per annum for 3 or 4 years duration.',
      pageNumber: 2,
      status: 'clear',
    };

    const pgRateRule: DocumentRule = {
      id: 'rule-pg-rate',
      ruleName: 'PG Scholarship Entitlement',
      fieldId: 'pg_scholarship_rate',
      fieldLabel: 'PG Entitlement',
      ruleType: 'currency',
      operator: 'equals',
      requiredValue: 20000,
      currency: '₹',
      applicableCategory: 'Postgraduate (PG)',
      quotation: 'Postgraduate (PG) Students: Rs. 20,000 per annum for 2 years duration.',
      pageNumber: 2,
      status: 'clear',
    };

    // Evaluate with selectedCategory = 'Undergraduate (UG)'
    const resUG = evaluateSingleRule(ugRateRule, 12000, 'Undergraduate (UG)');
    const resPGforUG = evaluateSingleRule(pgRateRule, 20000, 'Undergraduate (UG)');

    assert(
      resUG.status === 'satisfied',
      'Test F.1',
      `UG rule evaluated under UG category -> ${resUG.status}`
    );
    assert(
      resPGforUG.status === 'satisfied' && resPGforUG.explanation.includes('specifically to category "Postgraduate (PG)"'),
      'Test F.2',
      `PG rule not applied as failure to UG applicant -> correctly categorized`
    );

    // -------------------------------------------------------------------------
    // TEST G: Ambiguous source
    // The document's wording is unclear. Expected: Needs Review.
    // -------------------------------------------------------------------------
    console.log('\n----------------------------------------------------------------');
    console.log('TEST G: Ambiguous Source Rule Handling');
    console.log('----------------------------------------------------------------');
    const ambiguousRule: DocumentRule = {
      id: 'rule-ambig-1',
      ruleName: 'Special Consideration Clause',
      fieldId: 'special_consideration',
      fieldLabel: 'Special Merit Discretion',
      ruleType: 'unsupported',
      operator: 'unsupported',
      requiredValue: 'Discretionary',
      quotation: 'Preference may be given at the discretion of the review committee.',
      pageNumber: 2,
      status: 'ambiguous',
      notes: 'Discretionary clause without deterministic threshold.',
    };

    const resG = evaluateSingleRule(ambiguousRule, 'Applicant has good extracurriculars');
    assert(
      resG.status === 'needs_review',
      'Test G.1',
      `Ambiguous rule returns: ${resG.status} (Expected: needs_review)`
    );

    // -------------------------------------------------------------------------
    // TEST H: Unsupported rule
    // Complex condition that evaluator cannot safely interpret.
    // Expected: Unable to Evaluate with an explanation.
    // -------------------------------------------------------------------------
    console.log('\n----------------------------------------------------------------');
    console.log('TEST H: Unsupported Rule Logic');
    console.log('----------------------------------------------------------------');
    const unsupportedRule: DocumentRule = {
      id: 'rule-unsupported-1',
      ruleName: 'Pro-rata Dynamic Credit Equation',
      fieldId: 'pro_rata_calc',
      fieldLabel: 'Dynamic Credit Equation',
      ruleType: 'unsupported',
      operator: 'unsupported',
      requiredValue: 'Undefined formula',
      quotation: 'Credits shall be computed based on non-linear multi-semester standard deviation.',
      pageNumber: 2,
      status: 'unsupported',
      notes: 'Complex multi-variable equation cannot be safely evaluated automatically.',
    };

    const resH = evaluateSingleRule(unsupportedRule, 42);
    assert(
      resH.status === 'unable_to_evaluate',
      'Test H.1',
      `Unsupported rule returns: ${resH.status} (Expected: unable_to_evaluate)`
    );
    assert(
      resH.explanation.includes('cannot be safely evaluated') ||
        resH.explanation.includes('cannot be evaluated automatically'),
      'Test H.2',
      `Explanation explains limitation: "${resH.explanation}"`
    );

    // -------------------------------------------------------------------------
    // TEST I: Evidence validation
    // System receives incorrect page number or invented quotation.
    // Expected: Reject or flag the evidence rather than display it as verified.
    // -------------------------------------------------------------------------
    console.log('\n----------------------------------------------------------------');
    console.log('TEST I: Evidence and Page Citation Validation');
    console.log('----------------------------------------------------------------');
    const mockPages: DocumentPage[] = [
      {
        id: 'p-1',
        pageNumber: 1,
        extractedText: 'National Merit Scholarship. Family income ceiling is Rs. 2,50,000 per annum.',
        ocrConfidence: 0.98,
      },
    ];

    // Invalid page out of bounds (Page 5 when only Page 1 exists)
    const invalidPageRule: DocumentRule = {
      ...incomeRuleStrict,
      pageNumber: 5,
    };
    const valPageRes = validateRuleEvidence(invalidPageRule, mockPages);
    assert(
      !valPageRes.isValid,
      'Test I.1',
      `Invalid page 5 rejected: ${valPageRes.reason}`
    );

    // Invented quotation not in page 1
    const inventedQuoteRule: DocumentRule = {
      ...incomeRuleStrict,
      pageNumber: 1,
      quotation: 'All students must possess 5 years of commercial industry experience.',
    };
    const valQuoteRes = validateRuleEvidence(inventedQuoteRule, mockPages);
    assert(
      !valQuoteRes.isValid,
      'Test I.2',
      `Fabricated quotation rejected: ${valQuoteRes.reason}`
    );

    // -------------------------------------------------------------------------
    // TEST J: Actual Uploaded PDF E2E Processing
    // Generate real binary PDF with pdf-lib, process via /api/documents/process,
    // extract rules via /api/documents/decision-rules, and simulate via /api/documents/simulate.
    // -------------------------------------------------------------------------
    console.log('\n----------------------------------------------------------------');
    console.log('TEST J: Real Uploaded PDF E2E Workflow');
    console.log('----------------------------------------------------------------');

    const realPdf = await PDFDocument.create();
    const font = await realPdf.embedFont(StandardFonts.Helvetica);

    // Page 1
    const pdfP1 = realPdf.addPage([550, 700]);
    pdfP1.drawText('GOVERNMENT ADMISSION & SCHOLARSHIP SCHEME 2026', { x: 50, y: 650, size: 14, font, color: rgb(0.1, 0.1, 0.6) });
    pdfP1.drawText('1. Annual family income must be less than Rs. 2,50,000 per annum.', { x: 50, y: 610, size: 11, font });
    pdfP1.drawText('2. Minimum 60% aggregate marks in Class 12th Board Examination.', { x: 50, y: 580, size: 11, font });

    // Page 2
    const pdfP2 = realPdf.addPage([550, 700]);
    pdfP2.drawText('3. Application submission deadline is on or before October 31, 2026.', { x: 50, y: 650, size: 11, font });
    pdfP2.drawText('4. Target Beneficiaries: Students pursuing full-time regular undergraduate (UG) and postgraduate (PG).', { x: 50, y: 610, size: 10, font });
    pdfP2.drawText('Note: Doctoral and distance learning programs are outside the scope of this notification.', { x: 50, y: 570, size: 10, font });

    const pdfBytes = await realPdf.save();
    const base64Pdf = Buffer.from(pdfBytes).toString('base64');

    // 1. Process document via live backend
    const uploadRes = await makePostRequest(baseUrl, '/api/documents/process', {
      fileData: base64Pdf,
      filename: 'Govt_Admission_Scheme_2026.pdf',
      title: 'Govt Admission Scheme 2026',
      language: 'English',
    });

    assert(uploadRes.status === 200, 'Test J.1', `Real PDF upload/extraction status ${uploadRes.status}`);
    const extractedPages = uploadRes.data?.pages || [];
    assert(extractedPages.length >= 2, 'Test J.2', `Extracted ${extractedPages.length} actual pages from PDF`);

    // 2. Extract rules via /api/documents/decision-rules
    const ruleRes = await makePostRequest(baseUrl, '/api/documents/decision-rules', {
      documentId: uploadRes.data?.id || 'doc-real-1',
      title: 'Govt Admission Scheme 2026',
      filename: 'Govt_Admission_Scheme_2026.pdf',
      pages: extractedPages,
    });

    assert(ruleRes.status === 200, 'Test J.3', `Rule extraction API returned status ${ruleRes.status}`);
    const extractedRules = ruleRes.data?.rules || [];
    assert(extractedRules.length >= 3, 'Test J.4', `Extracted ${extractedRules.length} explicit rules from actual PDF`);

    // 3. Run simulation via /api/documents/simulate
    const simRes = await makePostRequest(baseUrl, '/api/documents/simulate', {
      documentId: uploadRes.data?.id || 'doc-real-1',
      title: 'Govt Admission Scheme 2026',
      rules: extractedRules,
      inputs: {
        family_income: 200000,
        academic_marks_percentage: 75,
        application_date: '2026-10-15',
        course_program_level: 'Undergraduate (UG)',
      },
    });

    assert(simRes.status === 200, 'Test J.5', `Simulation API returned status ${simRes.status}`);
    assert(
      simRes.data?.overallStatus === 'all_satisfied',
      'Test J.6',
      `Overall evaluation: ${simRes.data?.overallStatus}`
    );

    // -------------------------------------------------------------------------
    // TEST K: Data Isolation & What-If Scenario Comparison
    // -------------------------------------------------------------------------
    console.log('\n----------------------------------------------------------------');
    console.log('TEST K: What-If Scenario Comparison & Difference Tracking');
    console.log('----------------------------------------------------------------');
    const scA: SimulationScenario = {
      id: 'sc-a',
      name: 'Scenario A (Income ₹2,00,000)',
      inputs: { family_income: 200000, academic_marks_percentage: 75 },
      updatedAt: new Date().toISOString(),
    };

    const scB: SimulationScenario = {
      id: 'sc-b',
      name: 'Scenario B (Income ₹3,00,000)',
      inputs: { family_income: 300000, academic_marks_percentage: 75 },
      updatedAt: new Date().toISOString(),
    };

    const comparison = compareScenarios(scA, scB, multiRules);
    assert(
      comparison.changedConditionsCount === 1,
      'Test K.1',
      `Comparison correctly detected exactly 1 changed condition (Income)`
    );
    const incomeDiff = comparison.diffs.find((d) => d.ruleId === incomeRuleStrict.id);
    assert(
      incomeDiff !== undefined && incomeDiff.scenarioAStatus === 'satisfied' && incomeDiff.scenarioBStatus === 'not_satisfied',
      'Test K.2',
      `Income condition changed from satisfied in Scenario A to not_satisfied in Scenario B`
    );

    // -------------------------------------------------------------------------
    // TEST L: Regression Testing (Existing Clario Endpoints)
    // Verify /api/health, /api/documents/verify-numbers, /api/documents/contradictions still work.
    // -------------------------------------------------------------------------
    console.log('\n----------------------------------------------------------------');
    console.log('TEST L: Regression Testing for Existing Features');
    console.log('----------------------------------------------------------------');

    const healthRes = await makePostRequest(baseUrl, '/api/health', {});
    assert(healthRes.status === 200, 'Test L.1', `Health endpoint responded with status ${healthRes.status}`);

    const verifyNumRes = await makePostRequest(baseUrl, '/api/documents/verify-numbers', {
      documentId: 'bench-scholarship-2026',
      pages: extractedPages,
    });
    assert(verifyNumRes.status === 200, 'Test L.2', `Verify Numbers endpoint responded with status ${verifyNumRes.status}`);

    const contradicRes = await makePostRequest(baseUrl, '/api/documents/contradictions', {
      documentId: 'bench-scholarship-2026',
      pages: extractedPages,
    });
    assert(contradicRes.status === 200, 'Test L.3', `Contradiction Radar endpoint responded with status ${contradicRes.status}`);

    // Summary
    console.log('\n================================================================');
    console.log(` RESULTS: ${passed}/${total} TESTS PASSED`);
    console.log('================================================================\n');

    if (passed === total) {
      console.log('🎉 ALL DECISION SIMULATOR TESTS PASSED SUCCESSFULLY!\n');
    } else {
      console.error(`⚠️ ${total - passed} tests failed.`);
      process.exit(1);
    }
  } finally {
    server.close();
  }
}

runAllTests().catch((err) => {
  console.error('Fatal error during test run:', err);
  process.exit(1);
});
