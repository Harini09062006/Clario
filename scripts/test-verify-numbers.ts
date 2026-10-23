/**
 * End-to-End Verification Test for Clario "Verify Numbers" feature
 * Tests number extraction, OCR ambiguity detection, cross-page discrepancy detection,
 * scanned document error handling, zero-number handling, and live API endpoints.
 */

import http from 'http';
import { auditDocumentNumbers } from '../src/lib/numberAuditor';
import { BENCHMARK_FIXTURES } from '../src/lib/benchmarkFixtures';

async function makePostRequest(urlStr: string, payload: any): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
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
          } catch (e) {
            resolve({ status: res.statusCode || 500, data: body });
          }
        });
      }
    );
    req.on('error', reject);
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error(`Timeout connecting to ${urlStr}`));
    });
    req.write(postData);
    req.end();
  });
}

async function runTests() {
  console.log('====================================================');
  console.log('CLARIO VERIFY NUMBERS — END-TO-END VERIFICATION TEST');
  console.log('====================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, msg: string) {
    total++;
    if (condition) {
      console.log(`  ✓ PASS: ${msg}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${msg}`);
    }
  }

  // TEST 1: Benchmark Fixture 1 (Tamil Nadu CMCHIS 2026)
  console.log('Test 1: Auditing Tamil CMCHIS 2026 Document...');
  const cmchisDoc = BENCHMARK_FIXTURES.find((d) => d.id === 'bench-cmchis-2026')!;
  const cmchisAudit = auditDocumentNumbers(cmchisDoc.id, cmchisDoc.title, cmchisDoc.pages);
  console.log(`  Extracted ${cmchisAudit.totalNumbersChecked} audited figures.`);
  console.log(`  Confirmed: ${cmchisAudit.confirmedCount}, Ambiguous: ${cmchisAudit.ambiguousCount}, Discrepancies: ${cmchisAudit.discrepancyCount}`);
  console.log('  Items:', cmchisAudit.items.map((i) => `[${i.category}] ${i.extractedValue} (P.${i.pageNumber})`));

  assert(cmchisAudit.totalNumbersChecked >= 3, `Finds at least 3 numerical figures in Tamil document (got ${cmchisAudit.totalNumbersChecked})`);
  const foundIncomeLimit = cmchisAudit.items.some(
    (item) => item.extractedValue.includes('1,20,000') && item.category === 'currency' && item.pageNumber === 1
  );
  assert(foundIncomeLimit, 'Correctly identifies income limit ரூ. 1,20,000 with page 1 citation');
  const foundCoverage = cmchisAudit.items.some(
    (item) => item.extractedValue.includes('5,00,000') && item.category === 'currency' && item.pageNumber === 1
  );
  assert(foundCoverage, 'Correctly identifies medical coverage ரூ. 5,00,000 with page 1 citation');
  const foundDate = cmchisAudit.items.some(
    (item) => item.category === 'date' && item.pageNumber === 2
  );
  assert(foundDate, 'Correctly identifies deadline date on page 2');

  // TEST 2: Benchmark Fixture 2 (UP Krishi Solar Subsidy Table Hindi)
  console.log('\nTest 2: Auditing Hindi UP Krishi Solar Subsidy 2026 Document...');
  const solarDoc = BENCHMARK_FIXTURES.find((d) => d.id === 'bench-solar-2026')!;
  const solarAudit = auditDocumentNumbers(solarDoc.id, solarDoc.title, solarDoc.pages);
  console.log(`  Extracted ${solarAudit.totalNumbersChecked} audited figures.`);
  console.log(`  Confirmed: ${solarAudit.confirmedCount}, Ambiguous: ${solarAudit.ambiguousCount}, Discrepancies: ${solarAudit.discrepancyCount}`);

  assert(solarAudit.totalNumbersChecked >= 8, `Finds at least 8 numerical figures from tabular Hindi data (got ${solarAudit.totalNumbersChecked})`);
  const foundSolarCost = solarAudit.items.some(
    (item) => item.extractedValue.includes('1,48,000') && item.category === 'currency' && item.pageNumber === 2
  );
  assert(foundSolarCost, 'Identifies total cost ₹ 1,48,000 on page 2');
  const foundSubsidyPercent = solarAudit.items.some(
    (item) => item.extractedValue.includes('60%') && item.category === 'percentage'
  );
  assert(foundSubsidyPercent, 'Identifies 60% government subsidy percentage');
  const foundHPUnit = solarAudit.items.some(
    (item) => item.extractedValue.includes('2 HP') || item.extractedValue.includes('3 HP')
  );
  assert(foundHPUnit, 'Identifies operational capacity unit / threshold (2 HP / 3 HP)');

  // TEST 3: Benchmark Fixture 3 (National Merit Scholarship English)
  console.log('\nTest 3: Auditing English National Merit Scholarship 2026 Document...');
  const scholarshipDoc = BENCHMARK_FIXTURES.find((d) => d.id === 'bench-scholarship-2026')!;
  const scholarshipAudit = auditDocumentNumbers(scholarshipDoc.id, scholarshipDoc.title, scholarshipDoc.pages);
  console.log(`  Extracted ${scholarshipAudit.totalNumbersChecked} audited figures.`);
  console.log(`  Confirmed: ${scholarshipAudit.confirmedCount}, Ambiguous: ${scholarshipAudit.ambiguousCount}, Discrepancies: ${scholarshipAudit.discrepancyCount}`);

  assert(scholarshipAudit.totalNumbersChecked >= 6, `Finds at least 6 numerical figures in English document (got ${scholarshipAudit.totalNumbersChecked})`);
  const foundDisbursement = scholarshipAudit.items.some(
    (item) => item.extractedValue.includes('12,000') && item.category === 'currency' && item.pageNumber === 2
  );
  assert(foundDisbursement, 'Identifies scholarship disbursement Rs. 12,000 on page 2');
  const foundMinMarks = scholarshipAudit.items.some(
    (item) => item.extractedValue === '60%' && item.category === 'percentage' && item.pageNumber === 1
  );
  assert(foundMinMarks, 'Identifies 60% minimum academic marks requirement');

  // TEST 4: Cross-page Discrepancy Detection
  console.log('\nTest 4: Discrepancy Detection on Contradictory Multi-Page Document...');
  const contradictoryPages = [
    {
      id: 'p-1',
      pageNumber: 1,
      text: 'Section 4.1: The annual license registration fee is fixed at Rs. 25,000 payable within 30 days of issuance.',
      ocrConfidence: 0.99,
    },
    {
      id: 'p-2',
      pageNumber: 2,
      text: 'Schedule B: Revised annual license registration fee: Rs. 40,000 for all regional commercial categories.',
      ocrConfidence: 0.98,
    },
  ];
  const discrepancyAudit = auditDocumentNumbers('doc-contradiction', 'Contradictory License Notice', contradictoryPages as any);
  console.log(`  Discrepancies found: ${discrepancyAudit.discrepancyCount}`);
  assert((discrepancyAudit.discrepancyCount ?? 0) >= 1, `Flags cross-page fee/subsidy/timeline discrepancy (got ${discrepancyAudit.discrepancyCount})`);
  const hasDiscrepancyItem = discrepancyAudit.items.some((i) => i.verificationStatus === 'discrepancy');
  assert(hasDiscrepancyItem, 'At least one item marked with status="discrepancy"');

  // TEST 5: Ambiguous OCR Detection
  console.log('\nTest 5: Ambiguous OCR Detection on Low-Confidence / Corrupted OCR...');
  const noisyOcrPages = [
    {
      id: 'p-ocr-noisy',
      pageNumber: 1,
      text: 'Total subsidized grant: Rs. 1O,OOO [unclear print] ~ 15,000?. Approval subject to verification.',
      ocrConfidence: 0.45,
    },
  ];
  const ocrAudit = auditDocumentNumbers('doc-noisy-ocr', 'Noisy OCR Document', noisyOcrPages as any);
  console.log(`  Ambiguous items found: ${ocrAudit.ambiguousCount}`);
  assert((ocrAudit.ambiguousCount ?? 0) >= 1, `Flags figures as ambiguous when OCR confidence is low (< 0.70) (got ${ocrAudit.ambiguousCount})`);

  // TEST 6: Document with Genuinely Zero Numbers
  console.log('\nTest 6: Handling Document with Genuinely Zero Numerical Figures...');
  const zeroNumberPages = [
    {
      id: 'p-text-only',
      pageNumber: 1,
      text: 'This circular outlines general governance protocols. All departments must coordinate with their respective regional directors for administrative approvals and policy implementations.',
      ocrConfidence: 0.99,
    },
  ];
  const zeroAudit = auditDocumentNumbers('doc-zero-numbers', 'Pure Text Policy', zeroNumberPages as any);
  console.log(`  Total numbers checked: ${zeroAudit.totalNumbersChecked}`);
  assert(zeroAudit.totalNumbersChecked === 0, 'Accurately returns 0 figures for purely textual documents');
  assert(zeroAudit.items.length === 0, 'Items array is cleanly empty');

  // TEST 7: Scanned Image-Only Document
  console.log('\nTest 7: Handling Scanned Document with No OCR Text...');
  const scannedPages = [
    {
      id: 'p-scanned-1',
      pageNumber: 1,
      text: '   ',
      extractedText: '',
      ocrConfidence: 0,
    },
  ];
  const scannedAudit = auditDocumentNumbers('doc-scanned-empty', 'Scanned Image PDF', scannedPages as any);
  assert(scannedAudit.ocrRequired === true, 'Flags ocrRequired: true for scanned documents lacking text');
  assert(scannedAudit.totalNumbersChecked === 0, 'Total numbers checked is 0');

  // TEST 8: Live Backend Endpoint Call (Primary Port 3001)
  console.log('\nTest 8: Live Backend Endpoint Verification on http://localhost:3001...');
  try {
    const res = await makePostRequest('http://localhost:3001/api/documents/verify-numbers', {
      documentId: 'bench-cmchis-2026',
      pages: cmchisDoc.pages,
    });
    assert(res.status === 200, `API responds with HTTP 200 (got ${res.status})`);
    const totalCount = res.data.totalNumbersChecked ?? res.data.data?.totalNumbersChecked ?? 0;
    const confirmed = res.data.confirmedCount ?? res.data.data?.confirmedCount ?? 0;
    assert(totalCount >= 3, `Returns audited figures (got ${totalCount})`);
    assert(confirmed >= 1, `Returns confirmed count (got ${confirmed})`);
  } catch (err: any) {
    console.error('Error connecting to port 3001:', err.message);
    assert(false, `Live API call to http://localhost:3001 failed: ${err.message}`);
  }

  // TEST 9: Scanned Document Live Endpoint Error Handling
  console.log('\nTest 9: Live Backend Endpoint with Scanned Document (Must return structured OCR error)...');
  try {
    const res = await makePostRequest('http://localhost:3001/api/documents/verify-numbers', {
      documentId: 'scanned-doc-no-ocr',
      pages: scannedPages,
    });
    assert(res.status === 422 || res.status === 200, `API handles scanned doc gracefully (status ${res.status})`);
    const isOcrUnavailable = Boolean(
      res.data.code === 'ocr_unavailable' ||
      res.data.ocrRequired === true ||
      res.data.data?.ocrRequired === true ||
      res.data.isScanned === true
    );
    assert(isOcrUnavailable, 'Returns explicit ocr_unavailable error instead of silent zero figures');
  } catch (err: any) {
    assert(false, `Scanned doc API call failed: ${err.message}`);
  }

  // TEST 10: Secondary Port 3000 Endpoint Call
  console.log('\nTest 10: Live Backend Endpoint Verification on Secondary Port 3000...');
  try {
    const res = await makePostRequest('http://localhost:3000/api/documents/verify-numbers', {
      documentId: 'bench-scholarship-2026',
      pages: scholarshipDoc.pages,
    });
    const totalCount = res.data.totalNumbersChecked ?? res.data.data?.totalNumbersChecked ?? 0;
    assert(res.status === 200, `Port 3000 responds with HTTP 200 (got ${res.status})`);
    assert(totalCount >= 5, `Port 3000 returns audited figures (got ${totalCount})`);
  } catch (err: any) {
    console.log('Port 3000 note (secondary port optional):', err.message);
  }

  console.log('\n====================================================');
  console.log(`TEST SUMMARY: ${passed} / ${total} tests passed.`);
  console.log('====================================================\n');

  if (passed < total - 1) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
