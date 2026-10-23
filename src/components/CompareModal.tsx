import React, { useState } from 'react';
import { X, GitCompare, ArrowRight, AlertTriangle, CheckCircle, Calendar, DollarSign, Users, ShieldAlert, FileText, Sparkles } from 'lucide-react';
import { ClarioDocument, DocumentComparisonResult, DocumentComparisonDifference } from '../types';
import { apiUrl } from '../lib/api';

interface CompareModalProps {
  documents: ClarioDocument[];
  onClose: () => void;
  onOpenViewer?: (doc: ClarioDocument, page: number, passage: string) => void;
}

export const CompareModal: React.FC<CompareModalProps> = ({
  documents,
  onClose,
  onOpenViewer,
}) => {
  const [docAId, setDocAId] = useState<string>(documents[2]?.id || documents[0]?.id || '');
  const [docBId, setDocBId] = useState<string>(documents[3]?.id || documents[1]?.id || '');
  const [isComparing, setIsComparing] = useState(false);
  const [result, setResult] = useState<DocumentComparisonResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const docA = documents.find((d) => d.id === docAId);
  const docB = documents.find((d) => d.id === docBId);

  const handleRunComparison = async () => {
    if (!docA || !docB) {
      setError('Please select both Document A and Document B.');
      return;
    }

    if (docA.id === docB.id) {
      setError('Please select two distinct documents to compare.');
      return;
    }

    setIsComparing(true);
    setError(null);

    try {
      const response = await fetch(apiUrl('/api/documents/compare'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          docA: { id: docA.id, title: docA.title, pages: docA.pages },
          docB: { id: docB.id, title: docB.title, pages: docB.pages },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to run document comparison.');
      }

      const data = await response.json();
      setResult(data);
    } catch (err: any) {
      console.error('Comparison error:', err);
      setError(err.message || 'Error occurred while comparing documents.');
    } finally {
      setIsComparing(false);
    }
  };

  const getCategoryIcon = (category: DocumentComparisonDifference['category']) => {
    switch (category) {
      case 'deadline':
        return <Calendar className="w-4 h-4 text-[#D97706]" />;
      case 'amount':
        return <DollarSign className="w-4 h-4 text-[#15803D]" />;
      case 'eligibility':
        return <Users className="w-4 h-4 text-[#6D28D9]" />;
      case 'percentage':
        return <AlertTriangle className="w-4 h-4 text-[#2563EB]" />;
      case 'rules':
        return <ShieldAlert className="w-4 h-4 text-[#DC2626]" />;
      default:
        return <FileText className="w-4 h-4 text-[#64748B]" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#172554]/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-xl w-full max-w-5xl h-[88vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#E2E8F0] flex items-center justify-between bg-[#F8FAFC]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-[#F5F3FF] text-[#6D28D9] flex items-center justify-center">
              <GitCompare className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#172554]">
                Document Change & Conflict Radar
              </h2>
              <p className="text-xs text-[#64748B]">
                Compare circular versions, amendments, and notifications to isolate critical changes.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#64748B] hover:text-[#172554] hover:bg-[#E2E8F0] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Document Selection Strip */}
        <div className="p-6 border-b border-[#E2E8F0] bg-white grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
          <div className="md:col-span-5">
            <label className="block text-xs font-semibold text-[#172554] mb-1.5">
              Document A (Base Version)
            </label>
            <select
              value={docAId}
              onChange={(e) => setDocAId(e.target.value)}
              className="w-full p-2.5 rounded-lg border border-[#E2E8F0] text-xs focus:outline-none focus:border-[#6D28D9] text-[#172554] bg-[#F8FAFC]"
            >
              {documents.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.title} ({doc.language})
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2 flex items-center justify-center pt-4">
            <div className="w-8 h-8 rounded-full bg-[#F5F3FF] border border-[#E2E8F0] flex items-center justify-center text-[#6D28D9]">
              <ArrowRight className="w-4 h-4" />
            </div>
          </div>

          <div className="md:col-span-5">
            <label className="block text-xs font-semibold text-[#172554] mb-1.5">
              Document B (Revised / Compared Version)
            </label>
            <select
              value={docBId}
              onChange={(e) => setDocBId(e.target.value)}
              className="w-full p-2.5 rounded-lg border border-[#E2E8F0] text-xs focus:outline-none focus:border-[#6D28D9] text-[#172554] bg-[#F8FAFC]"
            >
              {documents.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.title} ({doc.language})
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-12 flex justify-end gap-2 pt-2">
            <button
              onClick={handleRunComparison}
              disabled={isComparing}
              className="px-5 py-2.5 rounded-lg bg-[#6D28D9] hover:bg-[#5B21B6] disabled:opacity-60 text-white font-medium text-xs transition-colors shadow-xs cursor-pointer flex items-center gap-2"
            >
              {isComparing ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Analyzing Discrepancies...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Run Radar Analysis</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-[#F8FAFC]">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-[#FEF2F2] border border-[#FEE2E2] text-xs text-[#DC2626]">
              {error}
            </div>
          )}

          {!result && !isComparing && (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 text-[#64748B]">
              <GitCompare className="w-12 h-12 stroke-[1.5] text-[#CBD5E1] mb-3" />
              <p className="text-sm font-medium text-[#172554] mb-1">
                Select two documents above and click Run Radar Analysis
              </p>
              <p className="text-xs max-w-md">
                Try comparing <strong>PM Kisan Samman Nidhi Version A</strong> against <strong>Version B (Revised 2026)</strong> to detect changes in payout, deadlines, and mandatory e-KYC.
              </p>
            </div>
          )}

          {result && (
            <div className="space-y-4">
              {/* Executive Summary */}
              <div className="p-4 rounded-xl border border-[#E2E8F0] bg-white">
                <h4 className="text-xs font-semibold text-[#172554] uppercase tracking-wider mb-1">
                  Radar Executive Summary
                </h4>
                <p className="text-xs text-[#64748B] leading-relaxed">
                  {result.summary}
                </p>
                <div className="mt-3 flex items-center gap-4 text-xs text-[#64748B] border-t border-[#E2E8F0] pt-2.5">
                  <span>Detected Changes: <strong className="text-[#172554]">{result.differences.length}</strong></span>
                  <span aria-hidden="true">·</span>
                  <span className="text-[#DC2626]">
                    Critical Impact: {result.differences.filter((d) => d.impactLevel === 'critical').length}
                  </span>
                </div>
              </div>

              {/* Differences List */}
              <div className="space-y-3">
                {result.differences.map((diff, index) => (
                  <div
                    key={`comp-diff-${diff.id || index}`}
                    className="p-5 rounded-xl border border-[#E2E8F0] bg-white shadow-xs"
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2">
                        {getCategoryIcon(diff.category)}
                        <span className="text-xs font-semibold uppercase tracking-wider text-[#172554]">
                          {diff.category.replace('_', ' ')}
                        </span>
                        <span aria-hidden="true" className="text-[#CBD5E1]">·</span>
                        <span className={`text-[11px] font-medium ${
                          diff.impactLevel === 'critical' ? 'text-[#DC2626]' : 'text-[#D97706]'
                        }`}>
                          {diff.impactLevel.toUpperCase()} IMPACT
                        </span>
                      </div>
                    </div>

                    <p className="text-sm font-medium text-[#172554] mb-3">
                      {diff.description}
                    </p>

                    {/* Side-by-side Evidence Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      {/* Document A Passage */}
                      <div className="p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
                        <div className="flex items-center justify-between text-[11px] text-[#64748B] mb-1.5">
                          <span className="font-semibold text-[#172554]">Document A (Page {diff.pageA})</span>
                          {onOpenViewer && docA && (
                            <button
                              onClick={() => onOpenViewer(docA, diff.pageA, diff.passageA)}
                              className="text-[#6D28D9] hover:underline cursor-pointer"
                            >
                              View Source
                            </button>
                          )}
                        </div>
                        <p className="text-[#172554] font-serif italic text-xs leading-relaxed">
                          "{diff.passageA}"
                        </p>
                      </div>

                      {/* Document B Passage */}
                      <div className="p-3 rounded-lg bg-[#F5F3FF]/40 border border-[#E2E8F0]">
                        <div className="flex items-center justify-between text-[11px] text-[#64748B] mb-1.5">
                          <span className="font-semibold text-[#6D28D9]">Document B (Page {diff.pageB})</span>
                          {onOpenViewer && docB && (
                            <button
                              onClick={() => onOpenViewer(docB, diff.pageB, diff.passageB)}
                              className="text-[#6D28D9] hover:underline cursor-pointer"
                            >
                              View Source
                            </button>
                          )}
                        </div>
                        <p className="text-[#172554] font-serif italic text-xs leading-relaxed">
                          "{diff.passageB}"
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
