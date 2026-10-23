import React, { useState, useEffect } from 'react';
import {
  FlaskConical,
  Play,
  CheckCircle2,
  XCircle,
  Check,
  AlertCircle,
  ExternalLink,
  RotateCw,
  FileText,
  Layers,
  Sparkles,
} from 'lucide-react';
import { ClarioDocument, TestCaseResult } from '../../types';
import { AuthUser } from '../../lib/supabase';
import { BENCHMARK_FIXTURES } from '../../lib/benchmarkFixtures';
import { generateDocumentTests, evaluateTestResult } from '../../lib/dynamicTestGenerator';
import { apiUrl } from '../../lib/api';

interface TestLabViewProps {
  documents: ClarioDocument[];
  currentUser: AuthUser;
  onOpenViewer: (doc: ClarioDocument, page: number, passage: string) => void;
  onGoToAuth: () => void;
}

export const TestLabView: React.FC<TestLabViewProps> = ({
  documents,
  currentUser: _currentUser,
  onOpenViewer,
  onGoToAuth: _onGoToAuth,
}) => {
  const [testMode, setTestMode] = useState<'uploaded' | 'benchmark'>(
    documents.length > 0 ? 'uploaded' : 'benchmark'
  );

  const [selectedDocId, setSelectedDocId] = useState<string>(
    documents.length > 0 ? documents[0].id : ''
  );

  const [runningAll, setRunningAll] = useState(false);
  const [currentRunningId, setCurrentRunningId] = useState<string | null>(null);

  // Update selected doc when documents prop updates
  useEffect(() => {
    if (documents.length > 0) {
      if (!selectedDocId || !documents.some((d) => d.id === selectedDocId)) {
        setSelectedDocId(documents[0].id);
      }
    } else {
      setTestMode('benchmark');
    }
  }, [documents, selectedDocId]);

  const selectedDoc =
    documents.find((d) => d.id === selectedDocId) || documents[0] || null;

  // -------------------------------------------------------------
  // Static Benchmark Suite (Separated Unit Test Fixtures)
  // -------------------------------------------------------------
  const benchmarkTests: TestCaseResult[] = [
    {
      id: 'TC1',
      title: 'TC1 — Grounded Answer with Citation',
      description:
        'Verifies that a known fact from an Indian-language document is answered accurately with an exact page number and verbatim supporting passage.',
      status: 'idle',
      documentName: 'TamilNadu_CM_Health_Insurance_Scheme_2026.pdf',
      question:
        'What is the maximum annual family income limit to be eligible for CMCHIS?',
      targetLanguage: 'English',
      expectedBehavior:
        'Identifies ₹1,20,000 (ரூ. 1,20,000) with citation to Page 1 and verbatim Tamil passage.',
      expectedAnswer: '₹1,20,000 per annum',
      expectedPage: 1,
      testCategory: 'grounded_fact',
    },
    {
      id: 'TC2',
      title: 'TC2 — Scanned Table & Numerical Extraction',
      description:
        'Tests extraction of tabular numerical rates from a Hindi agricultural solar scheme notification.',
      status: 'idle',
      documentName: 'UP_Krishi_Solar_Subsidy_Scanned_Table_2026.pdf',
      question:
        'What is the estimated total cost and 60% subsidy amount for a 2 HP DC solar pump in Table 1.1?',
      targetLanguage: 'English',
      expectedBehavior:
        'Correctly extracts ₹1,48,000 total cost and ₹88,800 subsidy amount from Table 1.1 on Page 2.',
      expectedAnswer: '₹1,48,000 total cost and ₹88,800 subsidy',
      expectedPage: 2,
      testCategory: 'numerical_extraction',
    },
    {
      id: 'TC3',
      title: 'TC3 — Strict Missing Information Fallback',
      description:
        'Strict test for unsupported questions. The answer MUST BE EXACTLY "Not in the document" with zero extra commentary.',
      status: 'idle',
      documentName: 'National_Merit_Scholarship_Notification_2026.pdf',
      question:
        'What is the maximum age limit for PhD applicants applying for this scholarship?',
      targetLanguage: 'English',
      expectedBehavior:
        'Returns STRICTLY "Not in the document" because PhD criteria is completely absent.',
      expectedAnswer: 'Not in the document',
      testCategory: 'missing_information',
    },
    {
      id: 'TC4',
      title: 'TC4 — Bilingual Answering with Source Integrity',
      description:
        'Answers in Hindi while preserving the verbatim Tamil source passage and exact page citation.',
      status: 'idle',
      documentName: 'TamilNadu_CM_Health_Insurance_Scheme_2026.pdf',
      question:
        'விண்ணப்பங்களை சமர்ப்பிக்க கடைசி தேதி என்ன? (What is the deadline?)',
      targetLanguage: 'Hindi',
      expectedBehavior:
        'Answers in Hindi (31 मार्च 2026) while citing Page 2 with the verbatim Tamil passage.',
      expectedAnswer: '31 मार्च 2026',
      expectedPage: 2,
      testCategory: 'multilingual',
    },
  ];

  // Test cases state
  const [testCases, setTestCases] = useState<TestCaseResult[]>([]);

  // Regenerate dynamic test cases whenever selected uploaded document changes or mode switches
  useEffect(() => {
    if (testMode === 'uploaded') {
      if (selectedDoc) {
        const generated = generateDocumentTests(selectedDoc);
        setTestCases(generated);
      } else {
        setTestCases([]);
      }
    } else {
      setTestCases(benchmarkTests);
    }
  }, [testMode, selectedDocId, selectedDoc]);

  // Execute a single test case
  const runSingleTest = async (testId: string) => {
    setCurrentRunningId(testId);
    setTestCases((prev) =>
      prev.map((t) =>
        t.id === testId
          ? {
              ...t,
              status: 'running',
              actualOutput: undefined,
              failureReason: undefined,
              passedAsserts: undefined,
              failedAsserts: undefined,
            }
          : t
      )
    );

    const test = testCases.find((t) => t.id === testId);
    if (!test) return;

    // Resolve target document
    const doc =
      testMode === 'uploaded' && selectedDoc
        ? selectedDoc
        : BENCHMARK_FIXTURES.find((b) =>
            b.filename.includes(test.documentName.replace('.pdf', ''))
          ) ||
          documents.find((d) =>
            d.filename.includes(test.documentName.replace('.pdf', ''))
          ) ||
          BENCHMARK_FIXTURES[0];

    try {
      const response = await fetch(apiUrl('/api/documents/ask'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: doc.id,
          pages: doc.pages,
          questionText: test.question,
          answerLanguage: test.targetLanguage,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }

      const resData = await response.json();
      const answer = (resData.answerText || '').trim();
      const citations = resData.citations || [];

      // Evaluate against the document ground truth
      const evalResult = evaluateTestResult(test, answer, citations);

      setTestCases((prev) =>
        prev.map((t) =>
          t.id === testId
            ? {
                ...t,
                status: evalResult.passed ? 'passed' : 'failed',
                actualOutput: answer,
                citations,
                passedAsserts: evalResult.passedAsserts,
                failedAsserts: evalResult.failedAsserts,
                failureReason: evalResult.failureReason,
              }
            : t
        )
      );
    } catch (err: any) {
      setTestCases((prev) =>
        prev.map((t) =>
          t.id === testId
            ? {
                ...t,
                status: 'failed',
                actualOutput: 'Execution Error',
                failureReason: err?.message || 'Request failed',
                failedAsserts: [err?.message || 'API call failed'],
              }
            : t
        )
      );
    } finally {
      setCurrentRunningId(null);
    }
  };

  const runAllTests = async () => {
    setRunningAll(true);
    for (const test of testCases) {
      await runSingleTest(test.id);
    }
    setRunningAll(false);
  };

  const passedCount = testCases.filter((t) => t.status === 'passed').length;
  const failedCount = testCases.filter((t) => t.status === 'failed').length;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Top Navigation & Test Mode Selector */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#F5F3FF] text-[#6D28D9] flex items-center justify-center shrink-0">
              <FlaskConical className="w-5 h-5 stroke-[2]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#172554] tracking-tight">
                Clario Automated Document Test Laboratory
              </h2>
              <p className="text-xs text-[#64748B]">
                Rigorous question-answering evaluation grounded directly in the
                content of your uploaded PDF.
              </p>
            </div>
          </div>

          {/* Mode Switcher: Uploaded vs Benchmark */}
          <div className="flex items-center p-1 bg-[#F1F5F9] rounded-lg border border-[#E2E8F0]">
            <button
              onClick={() => setTestMode('uploaded')}
              disabled={documents.length === 0}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                testMode === 'uploaded'
                  ? 'bg-white text-[#6D28D9] shadow-xs font-semibold'
                  : 'text-[#64748B] hover:text-[#172554] disabled:opacity-40 disabled:cursor-not-allowed'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Uploaded PDF Tests</span>
              {documents.length > 0 && (
                <span className="w-4 h-4 rounded-full bg-[#6D28D9]/10 text-[#6D28D9] text-[10px] flex items-center justify-center font-bold">
                  {documents.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setTestMode('benchmark')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                testMode === 'benchmark'
                  ? 'bg-white text-[#6D28D9] shadow-xs font-semibold'
                  : 'text-[#64748B] hover:text-[#172554]'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Benchmark Unit Fixtures</span>
            </button>
          </div>
        </div>

        {/* Uploaded Document Selector Banner (When in Uploaded Mode) */}
        {testMode === 'uploaded' && (
          <div className="pt-3 border-t border-[#F1F5F9] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <span className="text-xs font-semibold text-[#172554] shrink-0">
                Source Document:
              </span>
              {documents.length > 0 ? (
                <select
                  value={selectedDocId}
                  onChange={(e) => setSelectedDocId(e.target.value)}
                  className="px-2.5 py-1.5 bg-[#F8FAFC] border border-[#CBD5E1] rounded-md text-xs font-medium text-[#172554] focus:outline-none focus:ring-1 focus:ring-[#6D28D9]"
                >
                  {documents.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.filename} ({d.pageCount} {d.pageCount === 1 ? 'page' : 'pages'})
                    </option>
                  ))}
                </select>
              ) : (
                <span className="text-xs text-[#DC2626]">
                  No PDF uploaded yet. Upload a PDF to evaluate real document tests.
                </span>
              )}
            </div>

            {selectedDoc && (
              <div className="flex items-center gap-2 text-[11px] text-[#64748B]">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#ECFDF5] text-[#047857] font-medium border border-[#A7F3D0]">
                  <Sparkles className="w-3 h-3" />
                  Dynamic Ground Truth Active
                </span>
                <span>
                  {selectedDoc.pages?.length || 0} pages indexed & verified
                </span>
              </div>
            )}
          </div>
        )}

        {/* Benchmark Mode Notice */}
        {testMode === 'benchmark' && (
          <div className="pt-2 border-t border-[#F1F5F9] flex items-center justify-between text-xs text-[#64748B]">
            <span>
              Evaluating against official static sample fixtures (CMCHIS, UP Krishi, Scholarship).
            </span>
            <span className="text-[11px] font-mono text-[#6D28D9]">
              4 Standard Benchmarks
            </span>
          </div>
        )}
      </div>

      {/* Control Bar: Run All & Counters */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs flex items-center justify-between gap-4">
        <div className="text-xs text-[#64748B] flex items-center gap-2">
          <span className="text-[#15803D] font-medium">
            Passed: <strong>{passedCount}</strong>
          </span>
          <span aria-hidden="true">·</span>
          <span className="text-[#DC2626] font-medium">
            Failed: <strong>{failedCount}</strong>
          </span>
          <span aria-hidden="true">·</span>
          <span>
            Total: <strong>{testCases.length}</strong>
          </span>
        </div>

        <button
          onClick={runAllTests}
          disabled={runningAll || currentRunningId !== null || testCases.length === 0}
          className="px-4 py-2 rounded-lg bg-[#6D28D9] hover:bg-[#5B21B6] disabled:opacity-60 text-white font-medium text-xs transition-colors shadow-xs cursor-pointer flex items-center gap-1.5 shrink-0"
        >
          {runningAll ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Executing Test Suite...</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Run All {testCases.length} Tests</span>
            </>
          )}
        </button>
      </div>

      {/* Test Case Cards */}
      <div className="space-y-4">
        {testCases.length === 0 ? (
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-8 text-center space-y-3">
            <FlaskConical className="w-8 h-8 text-[#94A3B8] mx-auto" />
            <h3 className="text-sm font-bold text-[#172554]">
              No Test Cases Available
            </h3>
            <p className="text-xs text-[#64748B] max-w-md mx-auto">
              Upload a PDF document to dynamically generate and execute grounded
              tests, or switch to the Benchmark Unit Fixtures above.
            </p>
          </div>
        ) : (
          testCases.map((test) => {
            const isCurrent = currentRunningId === test.id;
            const docForView =
              testMode === 'uploaded' && selectedDoc ? selectedDoc : null;

            return (
              <div
                key={test.id}
                className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-xs space-y-3"
              >
                {/* Header Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-lg bg-[#F5F3FF] text-[#6D28D9] font-bold text-xs flex items-center justify-center shrink-0">
                      {test.id}
                    </span>
                    <div>
                      <h3 className="text-sm font-bold text-[#172554]">
                        {test.title}
                      </h3>
                      <p className="text-xs text-[#64748B]">
                        {test.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    {test.status === 'idle' && (
                      <span className="text-xs text-[#64748B]">Ready</span>
                    )}
                    {test.status === 'running' && (
                      <span className="flex items-center gap-1 text-xs text-[#6D28D9] font-medium">
                        <div className="w-3 h-3 border-2 border-[#6D28D9]/20 border-t-[#6D28D9] rounded-full animate-spin" />
                        Evaluating...
                      </span>
                    )}
                    {test.status === 'passed' && (
                      <span className="flex items-center gap-1 text-xs text-[#15803D] font-semibold bg-[#F0FDF4] px-2.5 py-1 rounded-md border border-[#DCFCE7]">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        PASSED
                      </span>
                    )}
                    {test.status === 'failed' && (
                      <span className="flex items-center gap-1 text-xs text-[#DC2626] font-semibold bg-[#FEF2F2] px-2.5 py-1 rounded-md border border-[#FEE2E2]">
                        <XCircle className="w-3.5 h-3.5" />
                        FAILED
                      </span>
                    )}

                    <button
                      onClick={() => runSingleTest(test.id)}
                      disabled={isCurrent || runningAll}
                      className="px-3 py-1.5 rounded-lg border border-[#E2E8F0] hover:bg-[#F8FAFC] disabled:opacity-50 text-xs text-[#172554] font-medium transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <RotateCw className={`w-3 h-3 ${isCurrent ? 'animate-spin' : ''}`} />
                      <span>{test.status === 'idle' ? 'Run Test' : 'Rerun'}</span>
                    </button>
                  </div>
                </div>

                {/* Ground Truth Input & Expectation */}
                <div className="p-3.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] space-y-2 text-xs">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div>
                      <span className="text-[11px] font-semibold text-[#64748B] uppercase">
                        Source Document:
                      </span>
                      <p className="text-[#172554] font-mono text-[11px] truncate">
                        {test.documentName}
                      </p>
                    </div>
                    <div>
                      <span className="text-[11px] font-semibold text-[#64748B] uppercase">
                        Expected Behavior:
                      </span>
                      <p className="text-[#172554]">{test.expectedBehavior}</p>
                    </div>
                  </div>

                  {test.expectedPassage && (
                    <div>
                      <span className="text-[11px] font-semibold text-[#64748B] uppercase">
                        Expected Supporting Passage (Page {test.expectedPage || 1}):
                      </span>
                      <p className="text-[#1E293B] italic bg-white p-2 rounded border border-[#E2E8F0] mt-0.5 font-sans">
                        "{test.expectedPassage}"
                      </p>
                    </div>
                  )}

                  <div>
                    <span className="text-[11px] font-semibold text-[#64748B] uppercase">
                      Query ({test.targetLanguage}):
                    </span>
                    <p className="text-[#172554] font-medium mt-0.5">
                      "{test.question}"
                    </p>
                  </div>
                </div>

                {/* Execution Output (Transparent Results) */}
                {test.actualOutput && (
                  <div className="border-t border-[#E2E8F0] pt-3 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#64748B] font-semibold uppercase text-[11px]">
                        Clario Actual Answer:
                      </span>
                      {test.citations && test.citations.length > 0 && (
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-[#6D28D9] font-medium">
                            Citations:{' '}
                            {test.citations
                              .map((c) => `Page ${c.pageNumber}`)
                              .join(', ')}
                          </span>
                          {docForView && test.citations[0] && (
                            <button
                              onClick={() =>
                                onOpenViewer(
                                  docForView,
                                  test.citations![0].pageNumber,
                                  test.citations![0].supportingPassage
                                )
                              }
                              className="text-[11px] text-[#6D28D9] hover:underline flex items-center gap-1 cursor-pointer font-medium"
                            >
                              <ExternalLink className="w-3 h-3" />
                              <span>View Source</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    <div
                      className={`p-3 rounded-lg text-xs leading-relaxed font-sans ${
                        test.actualOutput === 'Not in the document'
                          ? 'bg-[#F1F5F9] border border-[#CBD5E1] font-mono font-bold text-[#1E293B]'
                          : 'bg-white border border-[#E2E8F0] text-[#172554]'
                      }`}
                    >
                      {test.actualOutput}
                    </div>

                    {/* Cited Passages Display */}
                    {test.citations && test.citations.length > 0 && (
                      <div className="bg-[#FAF5FF] border border-[#F3E8FF] rounded-lg p-2.5 text-xs space-y-1">
                        <span className="text-[11px] font-bold text-[#6D28D9] uppercase tracking-wide">
                          Evidence Citation from Uploaded PDF:
                        </span>
                        {test.citations.map((c, idx) => (
                          <div
                            key={idx}
                            className="text-[#172554] text-[11px] pl-2 border-l-2 border-[#8B5CF6]"
                          >
                            <span className="font-semibold text-[#6D28D9]">
                              Page {c.pageNumber}:
                            </span>{' '}
                            "{c.supportingPassage}"
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Assertion Checklist */}
                    {test.passedAsserts && test.passedAsserts.length > 0 && (
                      <div className="space-y-1 pt-1">
                        {test.passedAsserts.map((asrt, i) => (
                          <div
                            key={`pass-${test.id}-${i}`}
                            className="flex items-center gap-1.5 text-[11px] text-[#15803D]"
                          >
                            <Check className="w-3.5 h-3.5 shrink-0" />
                            <span>{asrt}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {test.failedAsserts && test.failedAsserts.length > 0 && (
                      <div className="space-y-1 pt-1">
                        {test.failedAsserts.map((asrt, i) => (
                          <div
                            key={`fail-${test.id}-${i}`}
                            className="flex items-center gap-1.5 text-[11px] text-[#DC2626]"
                          >
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                            <span>{asrt}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {test.failureReason && (
                      <div className="p-2.5 bg-[#FEF2F2] border border-[#FEE2E2] rounded-md text-[11px] text-[#DC2626]">
                        <strong>Failure Reason:</strong> {test.failureReason}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
