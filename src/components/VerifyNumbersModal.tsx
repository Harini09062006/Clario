import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, AlertTriangle, HelpCircle, Hash, Search, FileText, Sparkles, Filter } from 'lucide-react';
import { ClarioDocument, NumberVerificationResult, NumberVerificationItem } from '../types';

interface VerifyNumbersModalProps {
  document: ClarioDocument;
  onClose: () => void;
  onOpenViewer?: (doc: ClarioDocument, page: number, passage: string) => void;
}

export const VerifyNumbersModal: React.FC<VerifyNumbersModalProps> = ({
  document,
  onClose,
  onOpenViewer,
}) => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<NumberVerificationResult | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    runVerification();
  }, [document.id]);

  const runVerification = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/documents/verify-numbers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: document.id,
          title: document.title,
          pages: document.pages,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to run critical number verification.');
      }

      const data = await response.json();
      setResult(data);
    } catch (err: any) {
      console.error('Number verification error:', err);
      setError(err.message || 'Error occurred while verifying numbers.');
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = result?.items.filter((item) => {
    if (filterCategory === 'all') return true;
    return item.category === filterCategory;
  }) || [];

  return (
    <div className="fixed inset-0 z-50 bg-[#172554]/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-xl w-full max-w-5xl h-[88vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#E2E8F0] flex items-center justify-between bg-[#F8FAFC]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-[#F5F3FF] text-[#6D28D9] flex items-center justify-center">
              <Hash className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#172554]">
                Critical Number & Metric Verification
              </h2>
              <p className="text-xs text-[#64748B]">
                Audit currency amounts, dates, thresholds, and subsidies extracted from {document.title}
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

        {/* Metric Summary Strip */}
        {result && (
          <div className="px-6 py-3 border-b border-[#E2E8F0] bg-white flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-4">
              <span>Audited Figures: <strong className="text-[#172554]">{result.totalNumbersChecked}</strong></span>
              <span aria-hidden="true" className="text-[#CBD5E1]">·</span>
              <span className="text-[#15803D]">
                Confirmed: <strong>{result.confirmedCount}</strong>
              </span>
              <span aria-hidden="true" className="text-[#CBD5E1]">·</span>
              <span className="text-[#D97706]">
                Flagged / Ambiguous: <strong>{result.flaggedCount}</strong>
              </span>
            </div>

            {/* Filter controls */}
            <div className="flex items-center gap-1.5 p-1 bg-[#F8FAFC] rounded-lg border border-[#E2E8F0]">
              {['all', 'currency', 'date', 'percentage', 'threshold'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setFilterCategory(cat)}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors cursor-pointer capitalize ${
                    filterCategory === cat
                      ? 'bg-white text-[#6D28D9] shadow-xs border border-[#E2E8F0]'
                      : 'text-[#64748B] hover:text-[#172554]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 bg-[#F8FAFC]">
          {loading && (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 text-[#64748B]">
              <div className="w-8 h-8 border-3 border-[#6D28D9]/20 border-t-[#6D28D9] rounded-full animate-spin mb-3" />
              <p className="text-sm font-medium text-[#172554]">
                Extracting and cross-referencing numerical values...
              </p>
              <p className="text-xs text-[#64748B] mt-1">
                Scanning pages for currency, deadlines, percentages, and eligibility limits.
              </p>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-lg bg-[#FEF2F2] border border-[#FEE2E2] text-xs text-[#DC2626]">
              {error}
            </div>
          )}

          {!loading && result && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  className="p-4 rounded-xl border border-[#E2E8F0] bg-white shadow-xs flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-base font-bold text-[#172554] tracking-tight">
                        {item.extractedValue}
                      </span>
                      <div className="flex items-center gap-1 text-[11px] font-medium">
                        {item.verificationStatus === 'confirmed' ? (
                          <span className="flex items-center gap-1 text-[#15803D] bg-[#F0FDF4] px-2 py-0.5 rounded-md border border-[#DCFCE7]">
                            <CheckCircle2 className="w-3 h-3" />
                            Confirmed
                          </span>
                        ) : item.verificationStatus === 'ambiguous' ? (
                          <span className="flex items-center gap-1 text-[#D97706] bg-[#FFFBEB] px-2 py-0.5 rounded-md border border-[#FEF3C7]">
                            <AlertTriangle className="w-3 h-3" />
                            Ambiguous OCR
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[#DC2626] bg-[#FEF2F2] px-2 py-0.5 rounded-md border border-[#FEE2E2]">
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
                      <p className="text-[11px] text-[#64748B]">
                        {item.notes}
                      </p>
                    )}
                  </div>

                  <div className="mt-3 pt-2 border-t border-[#E2E8F0] flex items-center justify-between text-xs">
                    <span className="text-[11px] text-[#94A3B8]">Grounded in Source</span>
                    {onOpenViewer && (
                      <button
                        onClick={() => onOpenViewer(document, item.pageNumber, item.passage)}
                        className="text-[#6D28D9] hover:underline text-xs font-medium cursor-pointer"
                      >
                        Inspect Page {item.pageNumber}
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {filteredItems.length === 0 && (
                <div className="col-span-2 text-center py-12 text-[#64748B] text-xs">
                  No numerical items found matching category "{filterCategory}".
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
