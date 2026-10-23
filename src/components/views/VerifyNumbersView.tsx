import React, { useState, useEffect, useMemo } from 'react';
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
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { ClarioDocument, NumberVerificationResult, NumberVerificationItem } from '../../types';
import { AuthUser } from '../../lib/supabase';
import { apiUrl } from '../../lib/api';

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
  currentUser: _currentUser,
  initialDocId,
  onOpenViewer,
  onGoToAuth: _onGoToAuth,
  onNavigateToMyDocs: _onNavigateToMyDocs,
  onTriggerUpload: _onTriggerUpload,
  isUploading: _isUploading = false,
}) => {
  const [selectedDocId, setSelectedDocId] = useState<string>(
    initialDocId || documents[0]?.id || ''
  );
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

  // Resolve active document
  const selectedDocument = useMemo(() => {
    return documents.find((d) => d.id === selectedDocId) || documents[0] || null;
  }, [documents, selectedDocId]);

  // 1. EMPTY STATE: NO DOCUMENTS IN LIBRARY
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

  // Trigger verification whenever selectedDocument changes or pages update
  useEffect(() => {
    if (selectedDocument) {
      runVerification();
    }
  }, [selectedDocument?.id, selectedDocument?.pages?.length]);

  const runVerification = async () => {
    if (!selectedDocument) return;

    setLoading(true);
    setError(null);

    // Normalize document pages to ensure extractedText is present
    const normalizedPages = (selectedDocument.pages || []).map((p, idx) => ({
      id: p.id || `p-${idx + 1}`,
      pageNumber: p.pageNumber || idx + 1,
      extractedText: p.extractedText || (p as any).text || '',
      ocrConfidence: p.ocrConfidence !== undefined ? p.ocrConfidence : 0.95,
    }));

    try {
      const response = await fetch(apiUrl('/api/documents/verify-numbers'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: selectedDocument.id,
          title: selectedDocument.title,
          filename: selectedDocument.filename,
          pages: normalizedPages,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`);
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

  const isScannedOcrError =
    Boolean((result as any)?.ocrRequired || (result as any)?.code === 'ocr_unavailable');

  const filteredItems = (result?.items || []).filter((item) => {
    const matchesCategory = filterCategory === 'all' || item.category === filterCategory;
    const matchesSearch =
      !searchQuery.trim() ||
      item.extractedValue.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.passage.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.notes || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const ambiguousCount = (result?.items || []).filter(
    (i) => i.verificationStatus === 'ambiguous'
  ).length;

  const discrepancyCount = (result?.items || []).filter(
    (i) => i.verificationStatus === 'discrepancy'
  ).length;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header with Document Selector & Controls */}
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
            Audit currency amounts, dates, percentages, and thresholds directly against verified source passages.
          </p>
        </div>

        {/* Document Switcher & Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-2.5 py-1.5 text-xs">
            <span className="text-[#64748B] font-medium hidden sm:inline">Document:</span>
            <select
              value={selectedDocId}
              onChange={(e) => setSelectedDocId(e.target.value)}
              className="bg-transparent text-xs font-semibold text-[#172554] focus:outline-none max-w-[220px] truncate cursor-pointer"
            >
              {documents.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.title} ({doc.language || 'English'})
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

      {/* Scanned Document Without OCR Alert Banner */}
      {isScannedOcrError && (
        <div className="p-5 rounded-xl bg-[#FFFBEB] border border-[#FDE68A] flex flex-col sm:flex-row sm:items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-[#D97706] shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-[#92400E]">
              Scanned Document Requires Active OCR
            </h4>
            <p className="text-xs text-[#B45309] leading-relaxed">
              {(result as any)?.error ||
                'This document appears to be a scanned image-only PDF and requires active OCR to extract numerical figures. Configure a valid VERBX_API_KEY or GEMINI_API_KEY to audit numbers from scanned pages.'}
            </p>
          </div>
        </div>
      )}

      {/* Metrics Summary Strip (Populated from Real Results) */}
      {result && !isScannedOcrError && (
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
              {ambiguousCount}
            </div>
            <span className="text-[11px] text-[#64748B]">Scanned table / low contrast</span>
          </div>

          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#DC2626]">
              Discrepancies
            </span>
            <div className="text-2xl font-bold text-[#DC2626] mt-1">
              {discrepancyCount}
            </div>
            <span className="text-[11px] text-[#64748B]">Conflicting numbers flagged</span>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      {result && !isScannedOcrError && result.totalNumbersChecked > 0 && (
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs">
          {/* Category Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'all', label: 'All Figures' },
              { id: 'currency', label: 'Currencies' },
              { id: 'date', label: 'Dates' },
              { id: 'percentage', label: 'Percentages' },
              { id: 'threshold', label: 'Thresholds & Units' },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setFilterCategory(cat.id)}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  filterCategory === cat.id
                    ? 'bg-[#6D28D9] text-white shadow-xs'
                    : 'bg-[#F8FAFC] text-[#64748B] hover:text-[#172554] border border-[#E2E8F0]'
                }`}
              >
                {cat.label}
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

      {/* Loading Indicator */}
      {loading && (
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-12 text-center text-[#64748B]">
          <div className="w-8 h-8 border-3 border-[#6D28D9]/20 border-t-[#6D28D9] rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm font-semibold text-[#172554]">
            Auditing numerical figures and cross-referencing source passages...
          </p>
          <p className="text-xs text-[#64748B] mt-1">
            Validating dates, currency amounts, percentages, and operational thresholds.
          </p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="p-4 rounded-xl bg-[#FEF2F2] border border-[#FEE2E2] text-xs text-[#DC2626]">
          {error}
        </div>
      )}

      {/* Result Cards Grid */}
      {!loading && result && !isScannedOcrError && (
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

          {/* Genuine No Numbers State */}
          {result.totalNumbersChecked === 0 && (
            <div className="col-span-full bg-white border border-[#E2E8F0] rounded-xl p-10 text-center space-y-2">
              <ShieldCheck className="w-8 h-8 text-[#15803D] mx-auto" />
              <h4 className="text-sm font-bold text-[#172554]">
                No Critical Numerical Figures Detected
              </h4>
              <p className="text-xs text-[#64748B] max-w-md mx-auto">
                This document contains zero numerical figures, currency amounts, dates, or thresholds. The extracted document text was verified as purely qualitative.
              </p>
            </div>
          )}

          {/* Filter Mismatch State */}
          {result.totalNumbersChecked > 0 && filteredItems.length === 0 && (
            <div className="col-span-full bg-white border border-[#E2E8F0] rounded-xl p-8 text-center text-xs text-[#64748B]">
              No numerical figures found matching the current filter: "<strong>{filterCategory}</strong>"
            </div>
          )}
        </div>
      )}
    </div>
  );
};
