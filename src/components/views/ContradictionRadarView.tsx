import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  ExternalLink,
  Search,
  RotateCw,
  GitCompare,
  Check,
  FileText,
  Clock,
  Coins,
  Percent,
  UserCheck,
  FileCheck2,
  BookOpen,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import {
  ClarioDocument,
  ContradictionRadarResult,
  ContradictionItem,
  ContradictionCategory,
} from '../../types';
import { AuthUser } from '../../lib/supabase';
import { apiUrl } from '../../lib/api';

interface ContradictionRadarViewProps {
  documents: ClarioDocument[];
  currentUser: AuthUser;
  initialDocId?: string;
  onOpenViewer: (doc: ClarioDocument, page: number, passage: string) => void;
  onGoToAuth: () => void;
  onNavigateToMyDocs: () => void;
  onTriggerUpload?: () => void;
  isUploading?: boolean;
}

export const ContradictionRadarView: React.FC<ContradictionRadarViewProps> = ({
  documents,
  currentUser: _currentUser,
  initialDocId,
  onOpenViewer,
  onGoToAuth: _onGoToAuth,
  onNavigateToMyDocs: _onNavigateToMyDocs,
  onTriggerUpload: _onTriggerUpload,
  isUploading: _isUploading = false,
}) => {
  // Document selection
  const [selectedDocId, setSelectedDocId] = useState<string>(
    initialDocId || documents[0]?.id || ''
  );
  const [compareDocId, setCompareDocId] = useState<string>(
    documents[1]?.id || documents[0]?.id || ''
  );

  // Radar analysis modes: 'single' (same doc) or 'version_compare' (across two docs/versions)
  const [radarMode, setRadarMode] = useState<'single' | 'version_compare'>('single');

  // Loading, results, error, scan status
  const [loading, setLoading] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);
  const [result, setResult] = useState<ContradictionRadarResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Filters & search
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all'); // 'all', 'high_priority', 'needs_review', 'reviewed'
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Local review state tracking for items: { [itemId]: 'reviewed' | 'needs_review' }
  const [reviewedStatus, setReviewedStatus] = useState<Record<string, boolean>>({});

  // Sync selected doc when documents list changes
  useEffect(() => {
    if (documents.length > 0) {
      if (!selectedDocId || !documents.some((d) => d.id === selectedDocId)) {
        setSelectedDocId(documents[0].id);
      }
      if (!compareDocId || !documents.some((d) => d.id === compareDocId)) {
        setCompareDocId(documents[1]?.id || documents[0].id);
      }
    }
  }, [documents, selectedDocId, compareDocId]);

  const selectedDocument = useMemo(() => {
    return documents.find((d) => d.id === selectedDocId) || documents[0] || null;
  }, [documents, selectedDocId]);

  const compareDocument = useMemo(() => {
    return documents.find((d) => d.id === compareDocId) || documents[1] || null;
  }, [documents, compareDocId]);

  // Run scan when user switches doc if not yet scanned
  useEffect(() => {
    if (selectedDocument) {
      // Clear previous results when document changes
      setResult(null);
      setHasScanned(false);
      setError(null);
    }
  }, [selectedDocId, radarMode]);

  // Auto-run scan on initial load if document is present
  useEffect(() => {
    if (selectedDocument && !hasScanned && !loading) {
      runRadarScan();
    }
  }, [selectedDocument?.id]);

  const runRadarScan = async () => {
    if (!selectedDocument) return;

    setLoading(true);
    setError(null);
    setHasScanned(true);

    const normalizedPages = (selectedDocument.pages || []).map((p, idx) => ({
      id: p.id || `p-${idx + 1}`,
      pageNumber: p.pageNumber || idx + 1,
      extractedText: p.extractedText || (p as any).text || '',
      ocrConfidence: p.ocrConfidence !== undefined ? p.ocrConfidence : 0.95,
    }));

    let comparePages = null;
    if (radarMode === 'version_compare' && compareDocument) {
      comparePages = (compareDocument.pages || []).map((p, idx) => ({
        id: p.id || `p-comp-${idx + 1}`,
        pageNumber: p.pageNumber || idx + 1,
        extractedText: p.extractedText || (p as any).text || '',
        ocrConfidence: p.ocrConfidence !== undefined ? p.ocrConfidence : 0.95,
      }));
    }

    try {
      const response = await fetch(apiUrl('/api/documents/contradictions'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: selectedDocument.id,
          title: selectedDocument.title,
          filename: selectedDocument.filename,
          pages: normalizedPages,
          mode: radarMode,
          compareDocId: compareDocument?.id,
          compareDocTitle: compareDocument?.title,
          compareDocPages: comparePages,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }

      const data: ContradictionRadarResult = await response.json();
      setResult(data);
    } catch (err: any) {
      console.error('Contradiction Radar error:', err);
      setError(`Contradiction analysis failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleReviewed = (itemId: string) => {
    setReviewedStatus((prev) => ({
      ...prev,
      [itemId]: !prev[itemId],
    }));
  };

  // Check for scanned image-only PDF error
  const isScannedOcrError = Boolean(
    result?.ocrRequired || result?.code === 'ocr_unavailable' || result?.isScanned
  );

  // Active items list merged with local review status
  const currentItems: ContradictionItem[] = useMemo(() => {
    if (!result?.items) return [];
    return result.items.map((item) => ({
      ...item,
      status: reviewedStatus[item.id] ? 'reviewed' : 'needs_review',
    }));
  }, [result?.items, reviewedStatus]);

  // Filtered and searched items
  const filteredItems = useMemo(() => {
    return currentItems.filter((item) => {
      // Category filter
      const matchesCategory =
        filterCategory === 'all' || item.category === filterCategory;

      // Status / Priority filter
      let matchesStatus = true;
      if (filterStatus === 'high_priority') {
        matchesStatus = item.severity === 'high';
      } else if (filterStatus === 'needs_review') {
        matchesStatus = item.status === 'needs_review';
      } else if (filterStatus === 'reviewed') {
        matchesStatus = item.status === 'reviewed';
      }

      // Keyword Search
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        item.title.toLowerCase().includes(q) ||
        item.explanation.toLowerCase().includes(q) ||
        item.statementA.toLowerCase().includes(q) ||
        item.statementB.toLowerCase().includes(q) ||
        item.conflictReason.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q);

      return matchesCategory && matchesStatus && matchesSearch;
    });
  }, [currentItems, filterCategory, filterStatus, searchQuery]);

  // Counts from actual data
  const totalConflicts = currentItems.length;
  const highPriorityCount = currentItems.filter((i) => i.severity === 'high').length;
  const manualReviewCount = currentItems.filter(
    (i) => i.severity === 'manual_review' || i.severity === 'medium'
  ).length;
  const reviewedCount = currentItems.filter((i) => i.status === 'reviewed').length;

  // Category Icon & Label mapping
  const getCategoryDetails = (cat: ContradictionCategory) => {
    switch (cat) {
      case 'dates_and_deadlines':
        return {
          label: 'Dates & Deadlines',
          icon: Clock,
          color: 'bg-[#EFF6FF] text-[#1D4ED8] border-[#DBEAFE]',
        };
      case 'financial_amounts':
        return {
          label: 'Financial Limits & Amounts',
          icon: Coins,
          color: 'bg-[#ECFDF5] text-[#047857] border-[#D1FAE5]',
        };
      case 'percentages_and_thresholds':
        return {
          label: 'Percentages & Thresholds',
          icon: Percent,
          color: 'bg-[#FDF4FF] text-[#A21CAF] border-[#F5D0FE]',
        };
      case 'eligibility_criteria':
        return {
          label: 'Eligibility Criteria',
          icon: UserCheck,
          color: 'bg-[#FFF7ED] text-[#C2410C] border-[#FFEDD5]',
        };
      case 'required_documents':
        return {
          label: 'Required Documents',
          icon: FileCheck2,
          color: 'bg-[#F5F3FF] text-[#6D28D9] border-[#EDE9FE]',
        };
      case 'policy_requirements':
        return {
          label: 'Policy Requirements',
          icon: BookOpen,
          color: 'bg-[#F8FAFC] text-[#334155] border-[#E2E8F0]',
        };
      default:
        return {
          label: 'Factual Contradiction',
          icon: AlertTriangle,
          color: 'bg-[#FEF2F2] text-[#B91C1C] border-[#FEE2E2]',
        };
    }
  };

  // Severity Pill styling
  const getSeverityBadge = (severity: string) => {
    if (severity === 'high') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#FEF2F2] text-[#DC2626] border border-[#FEE2E2]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#DC2626] animate-pulse" />
          High Priority
        </span>
      );
    }
    if (severity === 'manual_review') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#F5F3FF] text-[#6D28D9] border border-[#EDE9FE]">
          <HelpCircle className="w-3 h-3 text-[#6D28D9]" />
          Manual Review Required
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#FFFBEB] text-[#D97706] border border-[#FDE68A]">
        Moderate Impact
      </span>
    );
  };

  // 1. EMPTY STATE: NO DOCUMENTS IN LIBRARY
  if (documents.length === 0) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-[#172554] tracking-tight mb-1">
              Document Contradiction & Change Radar
            </h2>
            <p className="text-xs text-[#64748B]">
              Find conflicting facts, dates, amounts, and requirements across your documents.
            </p>
          </div>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-12 sm:p-16 shadow-xs text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#F5F3FF] text-[#6D28D9] border border-[#EDE9FE] flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-7 h-7 stroke-[2]" />
          </div>
          <h3 className="text-base font-bold text-[#172554] mb-1">
            No Documents Available to Scan
          </h3>
          <p className="text-xs text-[#64748B] max-w-md mx-auto mb-6 leading-relaxed">
            Upload an Indian-language or English document to automatically scan for internal contradictions, conflicting deadlines, and inconsistent amounts.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* A. Header with Document Selector & Controls */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-[#F5F3FF] text-[#6D28D9] flex items-center justify-center">
              <ShieldAlert className="w-4 h-4 stroke-[2.2]" />
            </div>
            <h2 className="text-base font-bold text-[#172554] tracking-tight">
              Document Contradiction & Change Radar
            </h2>
          </div>
          <p className="text-xs text-[#64748B]">
            Find conflicting facts, dates, amounts, and requirements across your documents.
          </p>
        </div>

        {/* Mode Selector & Document Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Radar Mode Toggle */}
          <div className="flex items-center bg-[#F1F5F9] p-0.5 rounded-lg border border-[#E2E8F0] text-xs font-semibold">
            <button
              onClick={() => setRadarMode('single')}
              className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${
                radarMode === 'single'
                  ? 'bg-white text-[#172554] shadow-xs'
                  : 'text-[#64748B] hover:text-[#172554]'
              }`}
            >
              Single Document
            </button>
            <button
              onClick={() => setRadarMode('version_compare')}
              className={`px-3 py-1.5 rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                radarMode === 'version_compare'
                  ? 'bg-white text-[#172554] shadow-xs'
                  : 'text-[#64748B] hover:text-[#172554]'
              }`}
            >
              <GitCompare className="w-3.5 h-3.5" />
              Version Change Radar
            </button>
          </div>

          {/* Document A Selector */}
          <div className="flex items-center gap-1.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-2.5 py-1.5 text-xs">
            <span className="text-[#64748B] font-medium hidden sm:inline">
              {radarMode === 'version_compare' ? 'Doc A (Base):' : 'Document:'}
            </span>
            <select
              value={selectedDocId}
              onChange={(e) => setSelectedDocId(e.target.value)}
              className="bg-transparent text-xs font-semibold text-[#172554] focus:outline-none max-w-[180px] sm:max-w-[220px] truncate cursor-pointer"
            >
              {documents.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.title} ({doc.language || 'English'})
                </option>
              ))}
            </select>
          </div>

          {/* Document B Selector for Version Comparison */}
          {radarMode === 'version_compare' && (
            <div className="flex items-center gap-1.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-2.5 py-1.5 text-xs">
              <span className="text-[#64748B] font-medium hidden sm:inline">Doc B (Newer):</span>
              <select
                value={compareDocId}
                onChange={(e) => setCompareDocId(e.target.value)}
                className="bg-transparent text-xs font-semibold text-[#172554] focus:outline-none max-w-[180px] sm:max-w-[220px] truncate cursor-pointer"
              >
                {documents.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    {doc.title} ({doc.language || 'English'})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* B. Scan Document Button */}
          <button
            onClick={runRadarScan}
            disabled={loading}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#6D28D9] hover:bg-[#5B21B6] disabled:opacity-50 text-white text-xs font-semibold transition-colors cursor-pointer shadow-xs"
          >
            <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Scanning...' : 'Scan for Contradictions'}</span>
          </button>
        </div>
      </div>

      {/* Selected Document Info Bar */}
      {selectedDocument && (
        <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between text-xs text-[#64748B] gap-2">
          <div className="flex items-center gap-2">
            <FileText className="w-3.5 h-3.5 text-[#6D28D9]" />
            <span className="font-semibold text-[#172554]">
              {selectedDocument.filename || selectedDocument.title}
            </span>
            <span>•</span>
            <span>{selectedDocument.pageCount || selectedDocument.pages?.length || 1} pages</span>
            <span>•</span>
            <span className="capitalize">{selectedDocument.language || 'English'}</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] uppercase tracking-wider font-semibold text-[#64748B]">Status:</span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#F0FDF4] text-[#15803D] border border-[#DCFCE7]">
              <Check className="w-2.5 h-2.5" />
              Extracted & Ready
            </span>
          </div>
        </div>
      )}

      {/* Scanned Document Without OCR Alert Banner */}
      {isScannedOcrError && (
        <div className="p-5 rounded-xl bg-[#FFFBEB] border border-[#FDE68A] flex flex-col sm:flex-row sm:items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-[#D97706] shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-[#92400E]">
              Scanned Document Requires Active OCR
            </h4>
            <p className="text-xs text-[#B45309] leading-relaxed">
              {result?.error ||
                'This document appears to be a scanned image-only PDF and requires active OCR to detect contradictions. Configure a valid VERBX_API_KEY or GEMINI_API_KEY to process scanned pages.'}
            </p>
          </div>
        </div>
      )}

      {/* Backend / Scan Error State */}
      {error && !isScannedOcrError && (
        <div className="p-4 rounded-xl bg-[#FEF2F2] border border-[#FEE2E2] flex items-center justify-between gap-3 text-xs text-[#B91C1C]">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={runRadarScan}
            className="px-3 py-1 bg-white border border-[#FCA5A5] rounded-md font-semibold text-[#B91C1C] hover:bg-[#FEF2F2] cursor-pointer"
          >
            Retry Scan
          </button>
        </div>
      )}

      {/* Partial Analysis Banner */}
      {result?.partialAnalysis && (
        <div className="p-4 rounded-xl bg-[#FFFBEB] border border-[#FDE68A] flex items-center gap-3 text-xs text-[#92400E]">
          <AlertTriangle className="w-4 h-4 text-[#D97706] shrink-0" />
          <span>
            Notice: Partial analysis completed. Only {result.pagesAnalyzed} of {result.totalPages} pages could be extracted. Pages {result.pagesFailed?.join(', ')} were skipped.
          </span>
        </div>
      )}

      {/* C. Summary Metrics Strip */}
      {result && !isScannedOcrError && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">
              Total Potential Conflicts
            </span>
            <div className="text-2xl font-bold text-[#172554] mt-1">
              {totalConflicts}
            </div>
            <span className="text-[11px] text-[#64748B]">Flagged across pages</span>
          </div>

          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#DC2626]">
              High Priority
            </span>
            <div className="text-2xl font-bold text-[#DC2626] mt-1">
              {highPriorityCount}
            </div>
            <span className="text-[11px] text-[#64748B]">Direct incompatibilities</span>
          </div>

          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6D28D9]">
              Manual Review
            </span>
            <div className="text-2xl font-bold text-[#6D28D9] mt-1">
              {manualReviewCount}
            </div>
            <span className="text-[11px] text-[#64748B]">Revisions or extensions</span>
          </div>

          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#15803D]">
              Pages Analyzed
            </span>
            <div className="text-2xl font-bold text-[#15803D] mt-1">
              {result.pagesAnalyzed} / {result.totalPages || result.pagesAnalyzed}
            </div>
            <span className="text-[11px] text-[#64748B]">{reviewedCount} marked reviewed</span>
          </div>
        </div>
      )}

      {/* E. Filter Controls & Search */}
      {result && !isScannedOcrError && (
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Category & Status Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <button
              onClick={() => {
                setFilterCategory('all');
                setFilterStatus('all');
              }}
              className={`px-3 py-1.5 rounded-lg border font-semibold transition-colors cursor-pointer ${
                filterCategory === 'all' && filterStatus === 'all'
                  ? 'bg-[#172554] text-white border-[#172554]'
                  : 'bg-white text-[#64748B] border-[#E2E8F0] hover:text-[#172554]'
              }`}
            >
              All ({totalConflicts})
            </button>

            <button
              onClick={() => {
                setFilterCategory('all');
                setFilterStatus('high_priority');
              }}
              className={`px-3 py-1.5 rounded-lg border font-semibold transition-colors cursor-pointer ${
                filterStatus === 'high_priority'
                  ? 'bg-[#DC2626] text-white border-[#DC2626]'
                  : 'bg-white text-[#64748B] border-[#E2E8F0] hover:text-[#DC2626]'
              }`}
            >
              High Priority ({highPriorityCount})
            </button>

            <button
              onClick={() => {
                setFilterCategory('dates_and_deadlines');
                setFilterStatus('all');
              }}
              className={`px-3 py-1.5 rounded-lg border font-semibold transition-colors cursor-pointer ${
                filterCategory === 'dates_and_deadlines'
                  ? 'bg-[#6D28D9] text-white border-[#6D28D9]'
                  : 'bg-white text-[#64748B] border-[#E2E8F0] hover:text-[#6D28D9]'
              }`}
            >
              Deadlines
            </button>

            <button
              onClick={() => {
                setFilterCategory('financial_amounts');
                setFilterStatus('all');
              }}
              className={`px-3 py-1.5 rounded-lg border font-semibold transition-colors cursor-pointer ${
                filterCategory === 'financial_amounts'
                  ? 'bg-[#047857] text-white border-[#047857]'
                  : 'bg-white text-[#64748B] border-[#E2E8F0] hover:text-[#047857]'
              }`}
            >
              Financial Amounts
            </button>

            <button
              onClick={() => {
                setFilterCategory('eligibility_criteria');
                setFilterStatus('all');
              }}
              className={`px-3 py-1.5 rounded-lg border font-semibold transition-colors cursor-pointer ${
                filterCategory === 'eligibility_criteria'
                  ? 'bg-[#C2410C] text-white border-[#C2410C]'
                  : 'bg-white text-[#64748B] border-[#E2E8F0] hover:text-[#C2410C]'
              }`}
            >
              Eligibility
            </button>

            <button
              onClick={() => {
                setFilterCategory('all');
                setFilterStatus('needs_review');
              }}
              className={`px-3 py-1.5 rounded-lg border font-semibold transition-colors cursor-pointer ${
                filterStatus === 'needs_review'
                  ? 'bg-[#F59E0B] text-white border-[#F59E0B]'
                  : 'bg-white text-[#64748B] border-[#E2E8F0] hover:text-[#F59E0B]'
              }`}
            >
              Needs Review
            </button>

            <button
              onClick={() => {
                setFilterCategory('all');
                setFilterStatus('reviewed');
              }}
              className={`px-3 py-1.5 rounded-lg border font-semibold transition-colors cursor-pointer ${
                filterStatus === 'reviewed'
                  ? 'bg-[#15803D] text-white border-[#15803D]'
                  : 'bg-white text-[#64748B] border-[#E2E8F0] hover:text-[#15803D]'
              }`}
            >
              Reviewed ({reviewedCount})
            </button>
          </div>

          {/* Search Box */}
          <div className="relative min-w-[220px]">
            <Search className="w-4 h-4 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search conflicts or passages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-[#172554] placeholder-[#94A3B8] focus:outline-none focus:border-[#6D28D9] focus:bg-white"
            />
          </div>
        </div>
      )}

      {/* D. Conflict Results Cards */}
      {result && !isScannedOcrError && (
        <div className="space-y-4">
          {filteredItems.length === 0 ? (
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-12 text-center">
              <div className="w-12 h-12 rounded-xl bg-[#F0FDF4] text-[#15803D] border border-[#DCFCE7] flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-6 h-6 stroke-[2]" />
              </div>
              <h3 className="text-sm font-bold text-[#172554] mb-1">
                {totalConflicts === 0
                  ? 'No Contradictions Detected in the Analyzed Content'
                  : 'No Conflicts Match the Selected Filter'}
              </h3>
              <p className="text-xs text-[#64748B] max-w-lg mx-auto leading-relaxed">
                {totalConflicts === 0
                  ? `All ${result.pagesAnalyzed} page(s) analyzed were verified. Dates, amounts, percentages, and eligibility requirements appear mutually consistent with no unresolved contradictions.`
                  : 'Try selecting "All" or clearing the search query to view all detected potential contradictions.'}
              </p>
            </div>
          ) : (
            filteredItems.map((item) => {
              const catDetails = getCategoryDetails(item.category);
              const CatIcon = catDetails.icon;
              const isReviewed = item.status === 'reviewed';

              return (
                <div
                  key={item.id}
                  className={`bg-white border rounded-xl p-5 shadow-xs transition-all ${
                    isReviewed
                      ? 'border-[#E2E8F0] opacity-75'
                      : item.severity === 'high'
                      ? 'border-[#FECACA] hover:border-[#F87171]'
                      : 'border-[#E2E8F0] hover:border-[#CBD5E1]'
                  }`}
                >
                  {/* Card Header: Category, Severity, and Title */}
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${catDetails.color}`}
                      >
                        <CatIcon className="w-3.5 h-3.5" />
                        {catDetails.label}
                      </span>
                      {getSeverityBadge(item.severity)}
                      {isReviewed && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#F0FDF4] text-[#15803D] border border-[#DCFCE7]">
                          <Check className="w-2.5 h-2.5" />
                          Reviewed
                        </span>
                      )}
                    </div>

                    {/* Actions: View Source Pages and Mark Reviewed */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleReviewed(item.id)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                          isReviewed
                            ? 'bg-[#F0FDF4] text-[#15803D] border-[#DCFCE7] hover:bg-[#DCFCE7]'
                            : 'bg-white text-[#64748B] border-[#E2E8F0] hover:text-[#172554] hover:bg-[#F8FAFC]'
                        }`}
                      >
                        <Check className="w-3 h-3" />
                        {isReviewed ? 'Marked Reviewed' : 'Mark as Reviewed'}
                      </button>
                    </div>
                  </div>

                  {/* Title & Short Explanation */}
                  <h3 className="text-sm font-bold text-[#172554] mb-1.5">
                    {item.title}
                  </h3>
                  <p className="text-xs text-[#64748B] leading-relaxed mb-4">
                    {item.explanation}
                  </p>

                  {/* Evidence Passages: Statement A & Statement B Comparison */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                    {/* Statement A */}
                    <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3.5 flex flex-col justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                            {item.isVersionComparison ? 'Document A (Base)' : 'Statement A'}
                          </span>
                          <button
                            onClick={() => {
                              const doc = item.isVersionComparison && item.docAId
                                ? documents.find((d) => d.id === item.docAId) || selectedDocument
                                : selectedDocument;
                              if (doc) onOpenViewer(doc, item.pageA, item.statementA);
                            }}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#6D28D9] hover:underline cursor-pointer"
                          >
                            <span>Page {item.pageA}</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        </div>
                        <blockquote className="text-xs text-[#1E293B] italic border-l-2 border-[#94A3B8] pl-2.5 leading-relaxed font-serif">
                          "{item.statementA}"
                        </blockquote>
                      </div>
                    </div>

                    {/* Statement B */}
                    <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3.5 flex flex-col justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                            {item.isVersionComparison ? 'Document B (Newer)' : 'Statement B'}
                          </span>
                          <button
                            onClick={() => {
                              const doc = item.isVersionComparison && item.docBId
                                ? documents.find((d) => d.id === item.docBId) || compareDocument || selectedDocument
                                : selectedDocument;
                              if (doc) onOpenViewer(doc, item.pageB, item.statementB);
                            }}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#6D28D9] hover:underline cursor-pointer"
                          >
                            <span>Page {item.pageB}</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        </div>
                        <blockquote className="text-xs text-[#1E293B] italic border-l-2 border-[#94A3B8] pl-2.5 leading-relaxed font-serif">
                          "{item.statementB}"
                        </blockquote>
                      </div>
                    </div>
                  </div>

                  {/* Why they may conflict callout */}
                  <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-xl p-3 text-xs text-[#92400E] mb-3 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-[#D97706] shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">Why this may conflict: </span>
                      <span>{item.conflictReason}</span>
                    </div>
                  </div>

                  {/* Footer: Evidence Strength & Page Navigation */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#F1F5F9] text-[11px] text-[#64748B]">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-[#6D28D9]" />
                      <span className="font-semibold text-[#172554]">Evidence Strength:</span>
                      <span className="capitalize">{item.confidence}</span>
                      <span>— {item.confidenceExplanation}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          if (selectedDocument) {
                            onOpenViewer(selectedDocument, item.pageA, item.statementA);
                          }
                        }}
                        className="font-semibold text-[#6D28D9] hover:text-[#5B21B6] hover:underline inline-flex items-center gap-1 cursor-pointer"
                      >
                        Inspect Page {item.pageA} & {item.pageB}
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
