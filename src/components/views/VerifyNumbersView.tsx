import React, { useState, useEffect } from 'react';
import {
  Hash,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  ExternalLink,
  Filter,
  FileText,
  RotateCw,
  Search,
  ShieldCheck,
  Upload,
  Loader2,
} from 'lucide-react';
import { ClarioDocument, NumberVerificationResult, NumberVerificationItem } from '../../types';
import { AuthUser } from '../../lib/supabase';
import { GuestSignInPrompt } from '../GuestSignInPrompt';

interface VerifyNumbersViewProps {
  documents: ClarioDocument[];
  currentUser: AuthUser;
  initialDocId?: string;
  onOpenViewer: (doc: ClarioDocument, page: number, passage: string) => void;
  onGoToAuth: () => void;
  onNavigateToMyDocs: () => void;
  onTriggerUpload?: () => void;
  isUploading?: boolean;
}

export const VerifyNumbersView: React.FC<VerifyNumbersViewProps> = ({
  documents,
  currentUser,
  initialDocId,
  onOpenViewer,
  onGoToAuth,
  onNavigateToMyDocs,
  onTriggerUpload,
  isUploading = false,
}) => {
  const [selectedDocId, setSelectedDocId] = useState<string>(initialDocId || documents[0]?.id || '');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<NumberVerificationResult | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // Keep selectedDocId in sync if documents list updates
  useEffect(() => {
    if (documents.length > 0) {
      if (!selectedDocId || !documents.some((d) => d.id === selectedDocId)) {
        setSelectedDocId(documents[0].id);
      }
    }
  }, [documents, selectedDocId]);



  // 2. EMPTY STATE: NO DOCUMENTS
  if (documents.length === 0) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-[#172554] tracking-tight mb-1">
              Verify Numbers
            </h2>
            <p className="text-xs text-[#64748B]">
              Automated verification of critical dates, percentages, amounts, and thresholds.
            </p>
          </div>

        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-12 sm:p-16 shadow-xs text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#F5F3FF] text-[#6D28D9] border border-[#EDE9FE] flex items-center justify-center mx-auto mb-4">
            <Hash className="w-7 h-7 stroke-[2]" />
          </div>
          <h3 className="text-base font-bold text-[#172554] mb-1">
            No Documents Available to Audit
          </h3>
          <p className="text-xs text-[#64748B] max-w-md mx-auto mb-6 leading-relaxed">
            You do not have any documents in your library yet. Upload an Indian-language or English document to automatically audit numbers, percentages, and deadlines.
          </p>
        </div>
      </div>
    );
  }

  const selectedDocument = documents.find((d) => d.id === selectedDocId) || documents[0];

  useEffect(() => {
    if (selectedDocument) {
      runVerification();
    }
  }, [selectedDocId]);

  const runVerification = async () => {
    if (!selectedDocument) return;

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${window.location.origin}/api/documents/verify-numbers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: selectedDocument.id,
          title: selectedDocument.title,
          pages: selectedDocument.pages,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to run critical number verification.');
      }

      const data = await response.json();
      setResult(data);
    } catch (err: any) {
      console.error('Number verification error details:', err);
      setError(`Number verification failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = (result?.items || []).filter((item) => {
    const matchesCategory = filterCategory === 'all' || item.category === filterCategory;
    const matchesSearch =
      !searchQuery.trim() ||
      item.extractedValue.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.passage.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.notes || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header with Document Selector & Filter Strip */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-[#F5F3FF] text-[#6D28D9] flex items-center justify-center">
              <Hash className="w-4 h-4 stroke-[2.2]" />
            </div>
            <h2 className="text-base font-bold text-[#172554] tracking-tight">
              Critical Number Verification
            </h2>
          </div>
          <p className="text-xs text-[#64748B]">
            Audit currency amounts, dates, percentages, and thresholds directly against indexed source passages.
          </p>
        </div>

        {/* Document Switcher & Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-2.5 py-1.5 text-xs">
            <span className="text-[#64748B] font-medium hidden sm:inline">Document:</span>
            <select
              value={selectedDocId}
              onChange={(e) => setSelectedDocId(e.target.value)}
              className="bg-transparent text-xs font-semibold text-[#172554] focus:outline-none max-w-[200px] truncate cursor-pointer"
            >
              {documents.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.title} ({doc.language})
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={runVerification}
            disabled={loading}
            className="p-2 rounded-lg border border-[#E2E8F0] hover:bg-[#F8FAFC] text-[#64748B] hover:text-[#172554] transition-colors cursor-pointer"
            title="Re-run Numerical Verification Audit"
          >
            <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

        </div>
      </div>

      {/* Metrics Summary Strip */}
      {result && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">
              Audited Figures
            </span>
            <div className="text-2xl font-bold text-[#172554] mt-1">
              {result.totalNumbersChecked}
            </div>
            <span className="text-[11px] text-[#64748B]">Extracted from pages</span>
          </div>

          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#15803D]">
              Confirmed
            </span>
            <div className="text-2xl font-bold text-[#15803D] mt-1">
              {result.confirmedCount}
            </div>
            <span className="text-[11px] text-[#64748B]">Verbatim passage match</span>
          </div>

          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#D97706]">
              Ambiguous OCR
            </span>
            <div className="text-2xl font-bold text-[#D97706] mt-1">
              {result.items.filter((i) => i.verificationStatus === 'ambiguous').length}
            </div>
            <span className="text-[11px] text-[#64748B]">Scanned table / low contrast</span>
          </div>

          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#DC2626]">
              Discrepancies
            </span>
            <div className="text-2xl font-bold text-[#DC2626] mt-1">
              {result.items.filter((i) => i.verificationStatus === 'discrepancy').length}
            </div>
            <span className="text-[11px] text-[#64748B]">Conflicting numbers flagged</span>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      {result && (
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs">
          {/* Category Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            {['all', 'currency', 'date', 'percentage', 'threshold'].map((cat) => (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer capitalize ${
                  filterCategory === cat
                    ? 'bg-[#6D28D9] text-white shadow-xs'
                    : 'bg-[#F8FAFC] text-[#64748B] hover:text-[#172554] border border-[#E2E8F0]'
                }`}
              >
                {cat === 'all' ? 'All Numbers' : cat}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative sm:w-60">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#64748B]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search figure or passage..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-[#E2E8F0] focus:outline-none focus:border-[#6D28D9] text-[#172554] bg-[#F8FAFC]"
            />
          </div>
        </div>
      )}

      {loading && (
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-12 text-center text-[#64748B]">
          <div className="w-8 h-8 border-3 border-[#6D28D9]/20 border-t-[#6D28D9] rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm font-semibold text-[#172554]">
            Auditing numerical figures and cross-referencing passages...
          </p>
          <p className="text-xs text-[#64748B] mt-1">
            Validating dates, currency symbols, percentages, and thresholds.
          </p>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-[#FEF2F2] border border-[#FEE2E2] text-xs text-[#DC2626]">
          {error}
        </div>
      )}

      {!loading && result && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map((item) => (
            <div
              key={`num-${item.id}`}
              className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs flex flex-col justify-between hover:border-[#6D28D9]/40 transition-colors"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-lg font-bold text-[#172554] tracking-tight">
                    {item.extractedValue}
                  </span>
                  <div className="flex items-center gap-1 text-[11px] font-semibold">
                    {item.verificationStatus === 'confirmed' ? (
                      <span className="flex items-center gap-1 text-[#15803D] bg-[#F0FDF4] px-2 py-0.5 rounded border border-[#DCFCE7]">
                        <CheckCircle2 className="w-3 h-3" />
                        Confirmed
                      </span>
                    ) : item.verificationStatus === 'ambiguous' ? (
                      <span className="flex items-center gap-1 text-[#D97706] bg-[#FFFBEB] px-2 py-0.5 rounded border border-[#FEF3C7]">
                        <AlertTriangle className="w-3 h-3" />
                        Ambiguous OCR
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[#DC2626] bg-[#FEF2F2] px-2 py-0.5 rounded border border-[#FEE2E2]">
                        <HelpCircle className="w-3 h-3" />
                        Discrepancy
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-[11px] text-[#64748B] uppercase tracking-wider font-semibold mb-2">
                  {item.category} · Page {item.pageNumber}
                </div>

                <div className="p-2.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] mb-2 font-serif text-xs text-[#172554] italic leading-relaxed">
                  "{item.passage}"
                </div>

                {item.notes && (
                  <p className="text-[11px] text-[#64748B] font-sans">
                    {item.notes}
                  </p>
                )}
              </div>

              <div className="mt-3 pt-2.5 border-t border-[#E2E8F0] flex items-center justify-between text-xs">
                <span className="text-[11px] text-[#94A3B8] font-mono">Grounded Source</span>
                {selectedDocument && (
                  <button
                    onClick={() => onOpenViewer(selectedDocument, item.pageNumber, item.passage)}
                    className="text-[#6D28D9] hover:underline text-xs font-semibold cursor-pointer flex items-center gap-1"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>Inspect Page {item.pageNumber}</span>
                  </button>
                )}
              </div>
            </div>
          ))}

          {filteredItems.length === 0 && (
            <div className="col-span-full bg-white border border-[#E2E8F0] rounded-xl p-8 text-center text-xs text-[#64748B]">
              No numerical figures found matching the current filters.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
