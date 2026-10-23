import http from 'http';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import handler from '../api/index.js';

interface TestReportItem {
  testId: string;
  category: string;
  document: string;
  question: string;
  expected: string;
  actual: string;
  evidence: string;
  pageNumber: number | string;
  status: 'PASS' | 'FAIL';
  reason?: string;
}

const testReports: TestReportItem[] = [];

async function main() {
  console.log('================================================================');
  console.log(' CLARIO DYNAMIC TEST EVALUATION BASED ON UPLOADED PDF CONTENT  ');
  console.log('================================================================\n');

  // Start in-process server using the Vercel handler
  const server = http.createServer((req, res) => {
    handler(req, res);
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}`;
  console.log(`[Test Server] Running handler on ${baseUrl}\n`);

  try {
    // -------------------------------------------------------------
    // STEP 1: CREATE & UPLOAD REAL PDF 1 (Solar & Energy Scheme)
    // -------------------------------------------------------------
    console.log('----------------------------------------------------------------');
    console.log('STEP 1: Uploading Real PDF #1 (Clean Energy Initiative 2026)');
    console.log('----------------------------------------------------------------');

    const pdf1 = await PDFDocument.create();
    const font = await pdf1.embedFont(StandardFonts.Helvetica);

    // Page 1: Subsidies & Eligibility
    const p1 = pdf1.addPage([550, 750]);
    p1.drawText('TAMIL NADU CLEAN ENERGY AND ROOFTOP SOLAR INITIATIVE 2026', {
      x: 40,
      y: 700,
      size: 14,
      font,
      color: rgb(0.1, 0.1, 0.5),
    });
    p1.drawText('Clause 1.1: Capital Subsidy Provision for Domestic Consumers', {
      x: 40,
      y: 670,
      size: 12,
      font,
    });
    p1.drawText('The state government provides a direct capital subsidy of Rs. 65,000 per rooftop solar unit.', {
      x: 40,
      y: 640,
      size: 11,
      font,
    });
    p1.drawText('Clause 1.2: Annual Household Income Ceiling for Applicants', {
      x: 40,
      y: 610,
      size: 12,
      font,
    });
    p1.drawText('To qualify under this priority scheme, the applicant family annual income must not exceed Rs. 3,50,000.', {
      x: 40,
      y: 580,
      size: 11,
      font,
    });

    // Page 2: Deadlines & Nodal Contact
    const p2 = pdf1.addPage([550, 750]);
    p2.drawText('Section 2: Application Timeline and Grievance Redressal', {
      x: 40,
      y: 700,
      size: 12,
      font,
    });
    p2.drawText('The final deadline for submitting solar subsidy applications online is strictly 31 December 2026.', {
      x: 40,
      y: 660,
      size: 11,
      font,
    });
    p2.drawText('Consumers may contact the district energy nodal officer at telephone 044-2852-1100.', {
      x: 40,
      y: 630,
      size: 11,
      font,
    });

    const pdf1Bytes = await pdf1.save();
    const pdf1Base64 = Buffer.from(pdf1Bytes).toString('base64');
    const pdf1Filename = 'TamilNadu_Clean_Energy_Initiative_2026.pdf';

    console.log(`Uploading ${pdf1Filename} (${pdf1Bytes.length} bytes, 2 pages)...`);
    const upload1Res = await fetch(`${baseUrl}/api/documents/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: pdf1Filename,
        fileData: pdf1Base64,
        language: 'English',
      }),
    });

    if (!upload1Res.ok) {
      throw new Error(`Upload failed with HTTP ${upload1Res.status}`);
    }

    const upload1Data = await upload1Res.json();
    console.log(`✓ Processed successfully! Indexed Pages: ${upload1Data.pageCount}`);
    console.log(`✓ Native Extraction Provider: ${upload1Data.provider}`);
    console.log(`✓ Content SHA-256 Hash: ${upload1Data.contentHash?.slice(0, 16)}...`);
    console.log(`✓ Summary: "${upload1Data.summary}"\n`);

    // -------------------------------------------------------------
    // STEP 2: DYNAMIC TEST GENERATION FROM UPLOADED PDF 1 CONTENT
    // -------------------------------------------------------------
    console.log('----------------------------------------------------------------');
    console.log('STEP 2: Generating Test Cases Dynamically from Uploaded PDF #1');
    console.log('----------------------------------------------------------------');

    const genRes1 = await fetch(`${baseUrl}/api/documents/generate-tests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        documentId: 'doc-pdf-1',
        filename: pdf1Filename,
        pages: upload1Data.pages,
        language: 'English',
      }),
    });

    if (!genRes1.ok) {
      throw new Error(`generate-tests failed with HTTP ${genRes1.status}`);
    }

    const genData1 = await genRes1.json();
    console.log(`✓ Dynamically generated ${genData1.testCount} tests based on ${pdf1Filename}:`);
    genData1.tests.forEach((t: any) => {
      console.log(`  [${t.id}] ${t.title}`);
      console.log(`       Question: "${t.question}"`);
      console.log(`       Expected: ${t.expectedBehavior}\n`);
    });

    // -------------------------------------------------------------
    // STEP 3: EXECUTE TESTS ON UPLOADED PDF 1
    // -------------------------------------------------------------
    console.log('----------------------------------------------------------------');
    console.log('STEP 3: Executing Dynamic Tests on Uploaded PDF #1');
    console.log('----------------------------------------------------------------');

    for (const test of genData1.tests) {
      console.log(`\n>>> Executing ${test.id} (${test.testCategory}): "${test.question}"`);
      const askRes = await fetch(`${baseUrl}/api/documents/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: 'doc-pdf-1',
          pages: upload1Data.pages,
          questionText: test.question,
          answerLanguage: test.targetLanguage || 'English',
        }),
      });

      const askData = await askRes.json();
      const actualAnswer = (askData.answerText || '').trim();
      const citations = askData.citations || [];
      const firstCit = citations[0] || {};

      console.log(`Actual Answer: "${actualAnswer}"`);
      console.log(`Citations Count: ${citations.length}`);
      if (firstCit.pageNumber) {
        console.log(`Cited: Page ${firstCit.pageNumber} | Quote: "${firstCit.supportingPassage?.slice(0, 80)}..."`);
      }

      // Assertions based on test category
      let pass = false;
      let failureReason: string | undefined;

      if (test.testCategory === 'grounded_fact') {
        const citesPage1 = citations.some((c: any) => c.pageNumber === 1);
        const hasQuote = citations.some((c: any) => c.supportingPassage && c.supportingPassage.length > 10);
        const answerValid = actualAnswer.length > 10 && actualAnswer !== 'Not in the document';
        pass = citesPage1 && hasQuote && answerValid;
        if (!pass) failureReason = 'Answer missing Page 1 citation or verbatim quote';
      } else if (test.testCategory === 'numerical_extraction') {
        const hasNumber = actualAnswer.includes('65,000') || actualAnswer.includes('3,50,000') || actualAnswer.includes('350000') || actualAnswer.includes('65000');
        const hasCitation = citations.length > 0;
        pass = hasNumber && hasCitation;
        if (!pass) failureReason = 'Numerical figure not extracted in answer';
      } else if (test.testCategory === 'missing_information') {
        const isStrict = actualAnswer === 'Not in the document';
        const zeroCitations = citations.length === 0;
        pass = isStrict && zeroCitations;
        if (!pass) failureReason = `Did not return strict "Not in the document" (got "${actualAnswer}") or attached ${citations.length} citation(s)`;
      } else if (test.testCategory === 'citation_accuracy') {
        const citesCorrectPage = citations.some((c: any) => c.pageNumber === test.expectedPage);
        const hasEvidence = citations.some((c: any) => c.supportingPassage && c.supportingPassage.length > 5);
        pass = citesCorrectPage && hasEvidence;
        if (!pass) failureReason = `Failed to cite expected Page ${test.expectedPage}`;
      } else if (test.testCategory === 'multilingual') {
        const hasCitation = citations.length > 0;
        const answerNotEmpty = actualAnswer.length > 5;
        pass = hasCitation && answerNotEmpty;
        if (!pass) failureReason = 'Multilingual response empty or ungrounded';
      }

      console.log(`Result: ${pass ? '>>> [PASS]' : '>>> [FAIL]'}`);

      testReports.push({
        testId: `${pdf1Filename} - ${test.id}`,
        category: test.testCategory,
        document: pdf1Filename,
        question: test.question,
        expected: test.expectedBehavior,
        actual: actualAnswer,
        evidence: firstCit.supportingPassage || 'None',
        pageNumber: firstCit.pageNumber || 'N/A',
        status: pass ? 'PASS' : 'FAIL',
        reason: failureReason,
      });
    }

    // -------------------------------------------------------------
    // STEP 4: TEST SCANNED PDF & GENUINE OCR EXECUTION
    // -------------------------------------------------------------
    console.log('\n----------------------------------------------------------------');
    console.log('STEP 4: Testing Scanned Image-Only PDF (OCR Pipeline Integrity)');
    console.log('----------------------------------------------------------------');

    const scannedPdf = await PDFDocument.create();
    scannedPdf.addPage([500, 700]); // Blank page simulating a scanned document with no digital text
    const scannedBytes = await scannedPdf.save();
    const scannedBase64 = Buffer.from(scannedBytes).toString('base64');
    const scannedFilename = 'Scanned_Govt_Order_Image_Only.pdf';

    console.log(`Uploading scanned image-only PDF: ${scannedFilename}...`);
    const scannedRes = await fetch(`${baseUrl}/api/documents/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: scannedFilename,
        fileData: scannedBase64,
        language: 'Hindi',
      }),
    });

    console.log(`HTTP Status Code: ${scannedRes.status}`);
    const scannedData = await scannedRes.json();
    console.log(`Response Code: ${scannedData.code}`);
    console.log(`Response Error: "${scannedData.error}"`);

    // Verify: Did it genuinely report ocr_unavailable instead of faking success?
    const genuineOcrHandling = scannedRes.status === 503 && scannedData.code === 'ocr_unavailable';
    console.log(`Genuine OCR Diagnostic Verification: ${genuineOcrHandling ? '>>> [PASS] Genuine HTTP 503 ocr_unavailable returned (No fake pass)' : '>>> [FAIL]'}`);

    testReports.push({
      testId: 'Scanned_PDF_OCR_Integrity',
      category: 'ocr_integrity',
      document: scannedFilename,
      question: 'Process scanned image-only PDF with unavailable OCR provider',
      expected: 'HTTP 503 ocr_unavailable with genuine provider diagnostics (no fake pass)',
      actual: `HTTP ${scannedRes.status} (${scannedData.code || 'unknown'})`,
      evidence: scannedData.error || 'N/A',
      pageNumber: 'N/A',
      status: genuineOcrHandling ? 'PASS' : 'FAIL',
      reason: genuineOcrHandling ? undefined : 'Did not return 503 ocr_unavailable for scanned doc',
    });

    // -------------------------------------------------------------
    // STEP 5: UPLOAD A DIFFERENT PDF & TEST DYNAMIC ISOLATION
    // -------------------------------------------------------------
    console.log('\n----------------------------------------------------------------');
    console.log('STEP 5: Uploading PDF #2 (Proving Document-Specific Test Isolation)');
    console.log('----------------------------------------------------------------');

    const pdf2 = await PDFDocument.create();
    const font2 = await pdf2.embedFont(StandardFonts.Helvetica);

    const p2_1 = pdf2.addPage([550, 750]);
    p2_1.drawText('KARNATAKA URBAN WATER CONSERVATION DIRECTIVE 2026', {
      x: 40,
      y: 700,
      size: 14,
      font: font2,
      color: rgb(0.1, 0.4, 0.1),
    });
    p2_1.drawText('Clause 4: Rainwater Harvesting Mandatory Rebate Structure', {
      x: 40,
      y: 670,
      size: 12,
      font: font2,
    });
    p2_1.drawText('Commercial complexes receive a mandatory rebate of Rs. 18,500.', {
      x: 40,
      y: 640,
      size: 11,
      font: font2,
    });
    p2_1.drawText('The municipal audit deadline is scheduled for 15 October 2026.', {
      x: 40,
      y: 610,
      size: 11,
      font: font2,
    });

    const pdf2Bytes = await pdf2.save();
    const pdf2Base64 = Buffer.from(pdf2Bytes).toString('base64');
    const pdf2Filename = 'Karnataka_Water_Conservation_Directive_2026.pdf';

    console.log(`Uploading ${pdf2Filename} (${pdf2Bytes.length} bytes)...`);
    const upload2Res = await fetch(`${baseUrl}/api/documents/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: pdf2Filename,
        fileData: pdf2Base64,
        language: 'English',
      }),
    });

    const upload2Data = await upload2Res.json();
    console.log(`✓ Processed ${pdf2Filename}: ${upload2Data.pageCount} pages indexed.`);

    // Generate tests specifically for PDF 2
    const genRes2 = await fetch(`${baseUrl}/api/documents/generate-tests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        documentId: 'doc-pdf-2',
        filename: pdf2Filename,
        pages: upload2Data.pages,
        language: 'English',
      }),
    });

    const genData2 = await genRes2.json();
    console.log(`✓ Generated ${genData2.testCount} tests for PDF #2:`);

    // Verify test set isolation: PDF 2 questions must NOT reference PDF 1 amounts (65,000, 3,50,000)
    const mentionsPdf1 = JSON.stringify(genData2.tests).includes('65,000') || JSON.stringify(genData2.tests).includes('Clean Energy');
    console.log(`Document Isolation Check: Contains zero references to PDF #1: ${!mentionsPdf1 ? '>>> [PASS]' : '>>> [FAIL]'}`);

    // Ask numerical question on PDF 2
    const numQ2 = genData2.tests.find((t: any) => t.testCategory === 'numerical_extraction') || genData2.tests[0];
    console.log(`\nAsking PDF #2 Question: "${numQ2.question}"`);
    const ask2Res = await fetch(`${baseUrl}/api/documents/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        documentId: 'doc-pdf-2',
        pages: upload2Data.pages,
        questionText: numQ2.question,
        answerLanguage: 'English',
      }),
    });
    const ask2Data = await ask2Res.json();
    console.log(`PDF #2 Answer: "${ask2Data.answerText}"`);
    console.log(`PDF #2 Citations: Page ${ask2Data.citations?.[0]?.pageNumber} - "${ask2Data.citations?.[0]?.supportingPassage}"`);

    const hasRebate = (ask2Data.answerText || '').includes('18,500') || (ask2Data.answerText || '').includes('18500') || (ask2Data.citations?.[0]?.supportingPassage || '').includes('18,500');
    console.log(`PDF #2 Numerical Extraction: ${hasRebate ? '>>> [PASS] Accurately extracted Rs. 18,500 from PDF #2' : '>>> [FAIL]'}`);

    testReports.push({
      testId: `${pdf2Filename} - Numerical_Isolation`,
      category: 'document_isolation',
      document: pdf2Filename,
      question: numQ2.question,
      expected: 'Extracts Rs. 18,500 specific to Karnataka Water Conservation (zero PDF 1 leakage)',
      actual: ask2Data.answerText,
      evidence: ask2Data.citations?.[0]?.supportingPassage || 'N/A',
      pageNumber: ask2Data.citations?.[0]?.pageNumber || 'N/A',
      status: hasRebate && !mentionsPdf1 ? 'PASS' : 'FAIL',
      reason: hasRebate ? undefined : 'Failed to extract Rs. 18,500 or leaked PDF 1 content',
    });

    // -------------------------------------------------------------
    // STEP 6: VERIFY UNIT TEST SEPARATION (BENCHMARK FIXTURES)
    // -------------------------------------------------------------
    console.log('\n----------------------------------------------------------------');
    console.log('STEP 6: Verifying Separation of Benchmark Unit Test Fixtures');
    console.log('----------------------------------------------------------------');

    const benchAskRes = await fetch(`${baseUrl}/api/documents/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        documentId: 'bench-cmchis-2026',
        questionText: 'What is the maximum annual family income limit to be eligible for CMCHIS?',
        answerLanguage: 'English',
      }),
    });
    const benchData = await benchAskRes.json();
    console.log(`Benchmark CMCHIS TC1 Answer: "${benchData.answerText}"`);
    console.log(`Benchmark Citation: Page ${benchData.citations?.[0]?.pageNumber} | "${benchData.citations?.[0]?.supportingPassage?.slice(0, 50)}..."`);
    const benchPass = benchData.answerText.includes('1,20,000') && benchData.citations?.[0]?.pageNumber === 1;
    console.log(`Benchmark Separation: ${benchPass ? '>>> [PASS] Benchmark unit fixtures remain intact and distinct from uploaded PDF tests' : '>>> [FAIL]'}`);

    testReports.push({
      testId: 'Unit_Benchmark_Separation_TC1',
      category: 'unit_fixture',
      document: 'bench-cmchis-2026 (Sample Fixture)',
      question: 'What is the maximum annual family income limit to be eligible for CMCHIS?',
      expected: 'Identifies ₹1,20,000 with citation to Page 1 and authentic Tamil passage',
      actual: benchData.answerText,
      evidence: benchData.citations?.[0]?.supportingPassage || 'N/A',
      pageNumber: benchData.citations?.[0]?.pageNumber || 1,
      status: benchPass ? 'PASS' : 'FAIL',
    });

  } finally {
    server.close();
  }

  // -------------------------------------------------------------
  // TRANSPARENT RESULTS SUMMARY TABLE
  // -------------------------------------------------------------
  console.log('\n================================================================');
  console.log('                 TRANSPARENT TEST RESULTS REPORT                ');
  console.log('================================================================');

  let totalPass = 0;
  let totalFail = 0;

  console.log(
    '---------------------------------------------------------------------------------------------------------'
  );
  console.log(
    `| ${'Test ID'.padEnd(35)} | ${'Category'.padEnd(20)} | ${'Page'.padEnd(5)} | ${'Status'.padEnd(6)} |`
  );
  console.log(
    '---------------------------------------------------------------------------------------------------------'
  );

  testReports.forEach((r) => {
    if (r.status === 'PASS') totalPass++;
    else totalFail++;

    console.log(
      `| ${r.testId.slice(0, 35).padEnd(35)} | ${r.category.slice(0, 20).padEnd(20)} | ${String(r.pageNumber).padEnd(5)} | ${r.status.padEnd(6)} |`
    );
    console.log(`  Question:  "${r.question}"`);
    console.log(`  Expected:  ${r.expected}`);
    console.log(`  Actual:    "${r.actual.slice(0, 100)}${r.actual.length > 100 ? '...' : ''}"`);
    console.log(`  Evidence:  "${r.evidence.slice(0, 100)}${r.evidence.length > 100 ? '...' : ''}"`);
    if (r.reason) {
      console.log(`  FAIL REASON: ${r.reason}`);
    }
    console.log(
      '---------------------------------------------------------------------------------------------------------'
    );
  });

  console.log(`\nSUMMARY: Total Tests: ${testReports.length} | PASSED: ${totalPass} | FAILED: ${totalFail}`);
  console.log(`SUCCESS RATE: ${Math.round((totalPass / testReports.length) * 100)}%`);
  console.log('================================================================\n');

  if (totalFail > 0) {
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error('[Test Execution Failed]:', err);
  process.exit(1);
});
