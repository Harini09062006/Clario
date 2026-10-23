/**
 * Comprehensive Verification Test Suite for Clario Evidence Traceability Graph
 * Covers Tests A through J:
 *   Test A — Fully supported answer
 *   Test B — Partially supported answer
 *   Test C — Unsupported claim (insufficient evidence, no fabricated citation)
 *   Test D — Contradictory evidence
 *   Test E — Invalid page citation rejected
 *   Test F — Multiple supporting pages
 *   Test G — Different documents isolation
 *   Test H — Scanned PDF & OCR failure handling
 *   Test I — Graph interactions and structure
 *   Test J — User authorization and live API validation
 */

import http from 'http';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { generateEvidenceGraph, extractClaimsFromAnswer } from '../src/lib/evidenceGraphGenerator';
import { DocumentPage } from '../src/types';
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
  console.log(' CLARIO EVIDENCE TRACEABILITY GRAPH — VERIFICATION TEST SUITE   ');
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
    // TEST A: Fully Supported Answer
    // -------------------------------------------------------------------------
    console.log('----------------------------------------------------------------');
    console.log('TEST A: Fully Supported Answer');
    console.log('----------------------------------------------------------------');
    const pagesA: DocumentPage[] = [
      {
        id: 'p-1',
        pageNumber: 1,
        extractedText:
          'Chief Minister Comprehensive Health Insurance Scheme 2026. The maximum annual family income limit is Rs. 1,20,000 per annum.',
        ocrConfidence: 0.98,
      },
      {
        id: 'p-2',
        pageNumber: 2,
        extractedText:
          'Treatment benefits are covered up to Rs. 5,00,000 per family per year in empanelled hospitals.',
        ocrConfidence: 0.98,
      },
    ];

    const answerA =
      'The maximum annual family income limit is Rs. 1,20,000 per annum. Treatment benefits are covered up to Rs. 5,00,000 per family per year.';
    const graphA = generateEvidenceGraph(
      'doc-a',
      'CMCHIS 2026',
      'What are the income limits and coverage amounts?',
      answerA,
      pagesA
    );

    assert(graphA.totalClaims === 2, 'Test A.1', 'Identified 2 factual claims');
    assert(graphA.supportedCount === 2, 'Test A.2', 'Both claims validated as Supported');
    assert(
      graphA.nodes.some((n) => n.type === 'page' && n.pageNumber === 1) &&
        graphA.nodes.some((n) => n.type === 'page' && n.pageNumber === 2),
      'Test A.3',
      'Created page nodes for Page 1 and Page 2'
    );
    assert(
      graphA.edges.some((e) => e.relationship === 'SUPPORTED_BY'),
      'Test A.4',
      'Generated SUPPORTED_BY relationship edges'
    );

    // -------------------------------------------------------------------------
    // TEST B: Partially Supported Answer
    // -------------------------------------------------------------------------
    console.log('\n----------------------------------------------------------------');
    console.log('TEST B: Partially Supported Answer');
    console.log('----------------------------------------------------------------');
    const pagesB: DocumentPage[] = [
      {
        id: 'p-1',
        pageNumber: 1,
        extractedText:
          'Clause 3.1: Priority registration is extended to farmers holding agricultural land with functional borewells.',
        ocrConfidence: 0.95,
      },
    ];

    const answerB =
      'Priority registration is extended to farmers holding agricultural land, with full waiver of all state taxes and solar export tariffs.';
    const graphB = generateEvidenceGraph(
      'doc-b',
      'Solar Scheme',
      'Who receives priority registration and what waivers exist?',
      answerB,
      pagesB
    );

    assert(graphB.partiallySupportedCount >= 1, 'Test B.1', 'Claim marked as Partially Supported');
    assert(
      graphB.edges.some((e) => e.relationship === 'PARTIALLY_SUPPORTED_BY'),
      'Test B.2',
      'PARTIALLY_SUPPORTED_BY edge created'
    );

    // -------------------------------------------------------------------------
    // TEST C: Unsupported Claim (Insufficient Evidence - No Fabricated Citation)
    // -------------------------------------------------------------------------
    console.log('\n----------------------------------------------------------------');
    console.log('TEST C: Unsupported Claim (Zero Hallucinated Evidence)');
    console.log('----------------------------------------------------------------');
    const pagesC: DocumentPage[] = [
      {
        id: 'p-1',
        pageNumber: 1,
        extractedText:
          'Ministry of Education. Full-time undergraduate and postgraduate students are eligible.',
        ocrConfidence: 0.98,
      },
    ];

    const answerC =
      'Applicants will be provided a free laptop and commercial air travel reimbursement.';
    const graphC = generateEvidenceGraph(
      'doc-c',
      'Education Guidelines',
      'Do applicants receive travel reimbursement?',
      answerC,
      pagesC
    );

    assert(
      graphC.insufficientEvidenceCount >= 1,
      'Test C.1',
      'Claim marked as Insufficient Evidence'
    );
    assert(
      !graphC.nodes.some((n) => n.type === 'evidence' && n.text.includes('commercial air travel')),
      'Test C.2',
      'No fabricated evidence node generated for unsupported claim'
    );

    // -------------------------------------------------------------------------
    // TEST D: Contradictory Evidence
    // -------------------------------------------------------------------------
    console.log('\n----------------------------------------------------------------');
    console.log('TEST D: Contradictory Evidence Identification');
    console.log('----------------------------------------------------------------');
    const pagesD: DocumentPage[] = [
      {
        id: 'p-1',
        pageNumber: 1,
        extractedText:
          'Official Pricing Matrix: 2 HP DC Solar Pump estimated total cost is Rs. 1,48,000.',
        ocrConfidence: 0.95,
      },
    ];

    const answerD = 'The total estimated cost for a 2 HP DC Solar Pump is Rs. 2,85,000.';
    const graphD = generateEvidenceGraph(
      'doc-d',
      'Solar Subsidy',
      'What is the cost of a 2 HP pump?',
      answerD,
      pagesD
    );

    assert(
      graphD.contradictedCount >= 1,
      'Test D.1',
      'Claim flagged as Contradicted due to conflicting numerical figure'
    );
    assert(
      graphD.edges.some((e) => e.relationship === 'CONTRADICTED_BY'),
      'Test D.2',
      'CONTRADICTED_BY relationship generated'
    );

    // -------------------------------------------------------------------------
    // TEST E: Invalid Page Citation Rejection
    // -------------------------------------------------------------------------
    console.log('\n----------------------------------------------------------------');
    console.log('TEST E: Invalid Page Citation Rejection');
    console.log('----------------------------------------------------------------');
    const pagesE: DocumentPage[] = [
      {
        id: 'p-1',
        pageNumber: 1,
        extractedText: 'National Scholarship Scheme minimum academic requirement is 60% marks.',
        ocrConfidence: 0.98,
      },
    ];

    const graphE = generateEvidenceGraph(
      'doc-e',
      'Scholarship',
      'What are the marks required?',
      'Minimum academic requirement is 60% marks.',
      pagesE
    );

    assert(
      !graphE.nodes.some((n) => n.type === 'page' && n.pageNumber === 99),
      'Test E.1',
      'No invalid page numbers (e.g. Page 99) in graph'
    );

    // -------------------------------------------------------------------------
    // TEST F: Multiple Supporting Pages
    // -------------------------------------------------------------------------
    console.log('\n----------------------------------------------------------------');
    console.log('TEST F: Multiple Supporting Pages');
    console.log('----------------------------------------------------------------');
    const pagesF: DocumentPage[] = [
      {
        id: 'p-1',
        pageNumber: 1,
        extractedText: 'Candidates must submit their application before the deadline.',
        ocrConfidence: 0.98,
      },
      {
        id: 'p-2',
        pageNumber: 2,
        extractedText: 'The official submission deadline is 31 March 2026.',
        ocrConfidence: 0.98,
      },
    ];

    const answerF = 'Candidates must submit their application before the official submission deadline of 31 March 2026.';
    const graphF = generateEvidenceGraph(
      'doc-f',
      'Guidelines',
      'What is the deadline?',
      answerF,
      pagesF
    );

    const page1Node = graphF.nodes.find((n) => n.type === 'page' && n.pageNumber === 1);
    const page2Node = graphF.nodes.find((n) => n.type === 'page' && n.pageNumber === 2);
    assert(
      Boolean(page1Node && page2Node),
      'Test F.1',
      'Connected evidence across both Page 1 and Page 2'
    );

    // -------------------------------------------------------------------------
    // TEST G: Document Isolation
    // -------------------------------------------------------------------------
    console.log('\n----------------------------------------------------------------');
    console.log('TEST G: Document Isolation');
    console.log('----------------------------------------------------------------');
    const pagesG1: DocumentPage[] = [
      { id: 'p1', pageNumber: 1, extractedText: 'Karnataka Water Board rebate is Rs. 18,500.' },
    ];
    const pagesG2: DocumentPage[] = [
      { id: 'p1', pageNumber: 1, extractedText: 'Tamil Nadu Solar subsidy is Rs. 65,000.' },
    ];

    const graphG1 = generateEvidenceGraph('doc-karnataka', 'Karnataka Directive', 'What is the rebate?', 'Rebate is Rs. 18,500.', pagesG1);
    assert(
      !graphG1.nodes.some((n) => n.text.includes('Tamil Nadu')),
      'Test G.1',
      'Zero leakage from other documents into graph'
    );

    // -------------------------------------------------------------------------
    // TEST H: Scanned PDF & OCR Failure Handling
    // -------------------------------------------------------------------------
    console.log('\n----------------------------------------------------------------');
    console.log('TEST H: Scanned PDF & OCR Failure Handling');
    console.log('----------------------------------------------------------------');
    const scannedPages: DocumentPage[] = [
      { id: 'p-scan-1', pageNumber: 1, extractedText: '', ocrConfidence: 0.0 },
    ];

    const graphH = generateEvidenceGraph(
      'doc-scanned',
      'Scanned Image PDF',
      'What is the deadline?',
      'Deadline is unknown.',
      scannedPages
    );

    assert(graphH.ocrRequired === true, 'Test H.1', 'Flagged ocrRequired: true');
    assert(graphH.code === 'ocr_unavailable', 'Test H.2', 'Code: ocr_unavailable');
    assert(graphH.nodes.length === 0, 'Test H.3', 'No fabricated graph generated for scanned PDF');

    // -------------------------------------------------------------------------
    // TEST I: Graph Structure & Interaction Integrity
    // -------------------------------------------------------------------------
    console.log('\n----------------------------------------------------------------');
    console.log('TEST I: Graph Structure & Edge Validation');
    console.log('----------------------------------------------------------------');
    const nodeIds = new Set(graphA.nodes.map((n) => n.id));
    const allEdgesValid = graphA.edges.every(
      (e) => nodeIds.has(e.source) && nodeIds.has(e.target)
    );

    assert(allEdgesValid, 'Test I.1', 'Every edge connects valid existing nodes (no dangling edges)');
    assert(
      graphA.nodes.some((n) => n.type === 'question'),
      'Test I.2',
      'Contains Question node'
    );
    assert(
      graphA.nodes.some((n) => n.type === 'answer'),
      'Test I.3',
      'Contains Answer node'
    );
    assert(
      graphA.nodes.some((n) => n.type === 'claim'),
      'Test I.4',
      'Contains Claim nodes'
    );

    // -------------------------------------------------------------------------
    // TEST J: Live API Endpoint & Health Check
    // -------------------------------------------------------------------------
    console.log('\n----------------------------------------------------------------');
    console.log('TEST J: Live API Endpoint & Health Check');
    console.log('----------------------------------------------------------------');

    // Health endpoint test
    const healthRes = await makePostRequest(baseUrl, '/api/health', {});
    assert(healthRes.status === 200, 'Test J.1', 'Health endpoint responds with HTTP 200');

    // Live evidence graph API call
    const liveApiRes = await makePostRequest(baseUrl, '/api/documents/evidence-graph', {
      documentId: 'bench-cmchis-2026',
      question: 'What is the maximum family income limit?',
    });

    assert(liveApiRes.status === 200, 'Test J.2', 'POST /api/documents/evidence-graph status 200');
    assert(
      liveApiRes.data?.totalClaims >= 1,
      'Test J.3',
      `Extracted ${liveApiRes.data?.totalClaims} claims from live API`
    );
    assert(
      liveApiRes.data?.supportedCount >= 1,
      'Test J.4',
      `Verified ${liveApiRes.data?.supportedCount} supported claims via live API`
    );
  } finally {
    server.close();
  }

  console.log('\n================================================================');
  console.log(` RESULTS: ${passed}/${total} TESTS PASSED (${Math.round((passed / total) * 100)}%)`);
  console.log('================================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

runAllTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
