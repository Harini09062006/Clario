import React, { useState, useEffect } from 'react';
import {
  GitCompare,
  ArrowRight,
  Calendar,
  DollarSign,
  Users,
  ShieldAlert,
  AlertTriangle,
  FileText,
  Sparkles,
  ExternalLink,
  Filter,
  Upload,
  Loader2,
} from 'lucide-react';
import { ClarioDocument, DocumentComparisonResult, DocumentComparisonDifference } from '../../types';
import { AuthUser } from '../../lib/supabase';
import { GuestSignInPrompt } from '../GuestSignInPrompt';

interface CompareDocumentsViewProps {
  documents: ClarioDocument[];
  currentUser: AuthUser;
  onOpenViewer: (doc: ClarioDocument, page: number, passage: string) => void;
  onGoToAuth: () => void;
  onNavigateToMyDocs: () => void;
  onTriggerUpload?: () => void;
  isUploading?: boolean;
}

export const CompareDocumentsView: React.FC<CompareDocumentsViewProps> = ({
  documents,
  currentUser,
  onOpenViewer,
  onGoToAuth,
  onNavigateToMyDocs,
  onTriggerUpload,
  isUploading = false,
}) => {
  const [docAId, setDocAId] = useState<string>(documents[0]?.id || '');
  const [docBId, setDocBId] = useState<string>(documents[1]?.id || '');
  const [isComparing, setIsComparing] = useState(false);
  const [result, setResult] = useState<DocumentComparisonResult | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [error, setError] = useState<string | null>(null);

  // Keep docAId and docBId in sync when documents list updates (e.g. after upload)
  useEffect(() => {
    if (documents.length > 0) {
      if (!docAId || !documents.some((d) => d.id === docAId)) {
        setDocAId(documents[0].id);
      }
      if (!docBId || !documents.some((d) => d.id === docBId)) {
        const otherDoc = documents.find((d) => d.id !== (docAId || documents[0].id));
        setDocBId(otherDoc ? otherDoc.id : documents[1]?.id || documents[0].id);
      }
    }
  }, [documents, docAId, docBId]);



  // 2. EMPTY STATE: REQUIRES AT LEAST 2 DOCUMENTS
  if (documents.length < 2) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header with Upload PDF button in top-right area */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-[#172554] tracking-tight mb-1">
              Compare Documents
            </h2>
            <p className="text-xs text-[#64748B]">
              Radar difference analysis isolating modifications between two document versions.
            </p>
          </div>

        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-12 sm:p-16 shadow-xs text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#F5F3FF] text-[#6D28D9] border border-[#EDE9FE] flex items-center justify-center mx-auto mb-4">
            <GitCompare className="w-7 h-7 stroke-[2]" />
          </div>
          <h3 className="text-base font-bold text-[#172554] mb-1">
            At Least 2 Documents Required
          </h3>
          <p className="text-xs text-[#64748B] max-w-md mx-auto mb-6 leading-relaxed">
            {documents.length === 0
              ? 'You do not have any documents in your library yet. Upload two versions of a document to compare modifications, additions, and deletions.'
              : 'You have 1 document in your library. Upload at least one more document to compare changes between versions.'}
          </p>
        </div>
      </div>
    );
  }

  const docA = documents.find((d) => d.id === docAId);
  const docB = documents.find((d) => d.id === docBId);

  const handleRunComparison = async (overrideDocAId?: string, overrideDocBId?: string) => {
    const targetAId = overrideDocAId || docAId;
    const targetBId = overrideDocBId || docBId;

    const targetDocA = documents.find((d) => d.id === targetAId);
    const targetDocB = documents.find((d) => d.id === targetBId);

    if (!targetDocA || !targetDocB) {
      setError('Please select both Document A and Document B.');
      return;
    }

    if (targetDocA.id === targetDocB.id) {
      setError('Please select two distinct documents to compare.');
      return;
    }

    if (overrideDocAId) setDocAId(overrideDocAId);
    if (overrideDocBId) setDocBId(overrideDocBId);

    setIsComparing(true);
    setError(null);

    try {
      const response = await fetch('/api/documents/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          docA: { id: targetDocA.id, title: targetDocA.title, pages: targetDocA.pages },
          docB: { id: targetDocB.id, title: targetDocB.title, pages: targetDocB.pages },
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

  const filteredDifferences = (result?.differences || []).filter((diff) => {
    if (filterCategory === 'all') return true;
    return diff.category === filterCategory;
  });

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header & Controls */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#F5F3FF] text-[#6D28D9] flex items-center justify-center">
              <GitCompare className="w-4 h-4 stroke-[2.2]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#172554] tracking-tight">
                Document Change & Conflict Radar
              </h2>
              <p className="text-xs text-[#64748B]">
                Compare circular versions, amendments, and notifications to isolate discrepancies without assumption.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto shrink-0">
            {/* Quick preset for hackathon judges */}
            {documents.length >= 4 && (
              <button
                onClick={() => handleRunComparison(documents[2].id, documents[3].id)}
                className="px-3 py-1.5 rounded-lg border border-[#EDE9FE] bg-[#F5F3FF] text-[#6D28D9] hover:bg-[#EDE9FE] text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 shrink-0"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Load 2024 vs 2026 Revision</span>
              </button>
            )}

          </div>
        </div>

        {/* Selector Grid */}
        <div className="mt-4 pt-4 border-t border-[#E2E8F0] grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
          <div className="md:col-span-5">
            <label className="block text-xs font-semibold text-[#172554] mb-1.5">
              Document A (Original / Base)
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

          <div className="md:col-span-2 flex items-center justify-center pt-2">
            <div className="w-8 h-8 rounded-full bg-[#F5F3FF] border border-[#E2E8F0] flex items-center justify-center text-[#6D28D9]">
              <ArrowRight className="w-4 h-4" />
            </div>
          </div>

          <div className="md:col-span-5">
            <label className="block text-xs font-semibold text-[#172554] mb-1.5">
              Document B (Revised / Amendment)
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
              onClick={() => handleRunComparison()}
              disabled={isComparing}
              className="px-6 py-2.5 rounded-lg bg-[#6D28D9] hover:bg-[#5B21B6] disabled:opacity-60 text-white font-semibold text-xs transition-colors shadow-xs cursor-pointer flex items-center gap-2"
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

        {error && (
          <div className="mt-4 p-3 rounded-lg bg-[#FEF2F2] border border-[#FEE2E2] text-xs text-[#DC2626]">
            {error}
          </div>
        )}
      </div>

      {/* Comparison Results */}
      {!result && !isComparing && (
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-12 text-center text-[#64748B]">
          <GitCompare className="w-12 h-12 stroke-[1.5] text-[#CBD5E1] mx-auto mb-3" />
          <p className="text-sm font-semibold text-[#172554] mb-1">
            Ready to compare documents
          </p>
          <p className="text-xs max-w-md mx-auto leading-relaxed">
            Click <strong>"Run Radar Analysis"</strong> or choose <strong>"Load 2024 vs 2026 Revision"</strong> above to detect changes in financial benefits, deadlines, and verification rules with page-level citations.
          </p>
        </div>
      )}

      {result && (
        <div className="space-y-4">
          {/* Executive Summary */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-[#172554] uppercase tracking-wider">
                Radar Executive Summary
              </span>
              <div className="flex items-center gap-3 text-xs text-[#64748B]">
                <span>Total Revisions: <strong className="text-[#172554]">{result.differences.length}</strong></span>
                <span aria-hidden="true" className="text-[#CBD5E1]">·</span>
                <span className="text-[#DC2626] font-semibold">
                  Critical Impact: <strong>{result.differences.filter((d) => d.impactLevel === 'critical').length}</strong>
                </span>
              </div>
            </div>
            <p className="text-xs text-[#64748B] leading-relaxed">
              {result.summary}
            </p>

            {/* Category Filter Pills */}
            <div className="mt-4 pt-3 border-t border-[#E2E8F0] flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-[#64748B] font-medium mr-1">Filter:</span>
              {['all', 'amount', 'deadline', 'rules', 'eligibility'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setFilterCategory(cat)}
                  className={`px-3 py-1 rounded-lg capitalize font-medium transition-colors cursor-pointer ${
                    filterCategory === cat
                      ? 'bg-[#6D28D9] text-white shadow-xs'
                      : 'bg-[#F8FAFC] text-[#64748B] hover:text-[#172554] border border-[#E2E8F0]'
                  }`}
                >
                  {cat === 'all' ? 'All Changes' : cat}
                </button>
              ))}
            </div>
          </div>

          {/* Differences List */}
          <div className="space-y-3">
            {filteredDifferences.map((diff, index) => (
              <div
                key={`diff-${diff.id || index}`}
                className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-xs hover:border-[#6D28D9]/40 transition-colors"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    {getCategoryIcon(diff.category)}
                    <span className="text-xs font-bold uppercase tracking-wider text-[#172554]">
                      {diff.category.replace('_', ' ')}
                    </span>
                    <span aria-hidden="true" className="text-[#CBD5E1]">·</span>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                      diff.impactLevel === 'critical' ? 'text-[#DC2626] bg-[#FEF2F2] border border-[#FEE2E2]' : 'text-[#D97706] bg-[#FFFBEB] border border-[#FEF3C7]'
                    }`}>
                      {diff.impactLevel.toUpperCase()} IMPACT
                    </span>
                  </div>
                </div>

                <p className="text-sm font-semibold text-[#172554] mb-3 leading-snug">
                  {diff.description}
                </p>

                {/* Side-by-side Evidence Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  {/* Document A Passage */}
                  <div className="p-3.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
                    <div className="flex items-center justify-between text-[11px] text-[#64748B] mb-1.5">
                      <span className="font-bold text-[#172554]">Document A (Page {diff.pageA})</span>
                      {docA && (
                        <button
                          onClick={() => onOpenViewer(docA, diff.pageA, diff.passageA)}
                          className="text-[#6D28D9] font-semibold hover:underline cursor-pointer flex items-center gap-1"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>Inspect Page</span>
                        </button>
                      )}
                    </div>
                    <p className="text-[#172554] font-serif italic text-xs leading-relaxed">
                      "{diff.passageA}"
                    </p>
                  </div>

                  {/* Document B Passage */}
                  <div className="p-3.5 rounded-lg bg-[#F5F3FF]/40 border border-[#E2E8F0]">
                    <div className="flex items-center justify-between text-[11px] text-[#64748B] mb-1.5">
                      <span className="font-bold text-[#6D28D9]">Document B (Page {diff.pageB})</span>
                      {docB && (
                        <button
                          onClick={() => onOpenViewer(docB, diff.pageB, diff.passageB)}
                          className="text-[#6D28D9] font-semibold hover:underline cursor-pointer flex items-center gap-1"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>Inspect Page</span>
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

            {filteredDifferences.length === 0 && (
              <div className="p-8 text-center bg-white border border-[#E2E8F0] rounded-xl text-xs text-[#64748B]">
                No differences found under category "{filterCategory}".
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
