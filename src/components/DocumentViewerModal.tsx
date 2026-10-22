import React, { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, CheckCircle2, FileText, Search, ExternalLink } from 'lucide-react';
import { ClarioDocument } from '../types';

interface DocumentViewerModalProps {
  document: ClarioDocument;
  initialPage?: number;
  highlightPassage?: string;
  onClose: () => void;
}

export const DocumentViewerModal: React.FC<DocumentViewerModalProps> = ({
  document,
  initialPage = 1,
  highlightPassage,
  onClose,
}) => {
  const [currentPage, setCurrentPage] = useState<number>(initialPage);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const activePageData = document.pages.find((p) => p.pageNumber === currentPage) || document.pages[0];

  // Keyboard navigation: ESC to close, left/right arrows for flipping pages
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft') {
        setCurrentPage((p) => Math.max(1, p - 1));
      } else if (e.key === 'ArrowRight') {
        setCurrentPage((p) => Math.min(document.pages.length, p + 1));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [document.pages.length, onClose]);

  // Highlight snippet in page text
  const renderHighlightedText = (text: string) => {
    if (!highlightPassage && !searchQuery) {
      return text;
    }

    const termToHighlight = searchQuery.trim() || highlightPassage?.trim() || '';
    if (!termToHighlight || termToHighlight.length < 3) {
      return text;
    }

    try {
      const parts = text.split(new RegExp(`(${termToHighlight.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi'));
      return parts.map((part, i) =>
        part.toLowerCase() === termToHighlight.toLowerCase() ? (
          <mark key={i} className="bg-[#FEF08A] text-[#172554] px-1 py-0.5 rounded-sm font-medium border-b-2 border-[#EAB308]">
            {part}
          </mark>
        ) : (
          part
        )
      );
    } catch {
      return text;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#172554]/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-[#E2E8F0] flex items-center justify-between bg-[#F8FAFC]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#F5F3FF] text-[#6D28D9] flex items-center justify-center shrink-0 shadow-xs">
              <FileText className="w-5 h-5 stroke-[2]" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-[#172554] truncate">
                {document.title}
              </h3>
              <div className="flex items-center gap-2 text-[11px] text-[#64748B]">
                <span className="font-medium text-[#172554]">{document.language}</span>
                <span aria-hidden="true" className="text-[#CBD5E1]">·</span>
                <span>{document.pageCount} Pages</span>
                {activePageData?.ocrConfidence && (
                  <>
                    <span aria-hidden="true" className="text-[#CBD5E1]">·</span>
                    <span className="text-[#15803D] font-medium">
                      OCR Confidence: {(activePageData.ocrConfidence * 100).toFixed(0)}%
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[#94A3B8] hidden sm:inline font-mono">ESC to close</span>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#64748B] hover:text-[#172554] hover:bg-[#E2E8F0] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="px-6 py-2.5 border-b border-[#E2E8F0] flex flex-wrap items-center justify-between gap-3 bg-white text-xs">
          {/* Page navigation */}
          <div className="flex items-center gap-2">
            <button
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="p-1.5 rounded-lg border border-[#E2E8F0] hover:bg-[#F8FAFC] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              title="Previous Page (Left Arrow)"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Quick page pills */}
            <div className="flex items-center gap-1">
              {document.pages.map((p) => (
                <button
                  key={p.pageNumber}
                  onClick={() => setCurrentPage(p.pageNumber)}
                  className={`w-7 h-7 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                    currentPage === p.pageNumber
                      ? 'bg-[#6D28D9] text-white shadow-xs'
                      : 'text-[#64748B] hover:bg-[#F8FAFC]'
                  }`}
                >
                  {p.pageNumber}
                </button>
              ))}
            </div>

            <button
              disabled={currentPage >= document.pages.length}
              onClick={() => setCurrentPage((p) => Math.min(document.pages.length, p + 1))}
              className="p-1.5 rounded-lg border border-[#E2E8F0] hover:bg-[#F8FAFC] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              title="Next Page (Right Arrow)"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Search within page */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-[#64748B]" />
            <input
              type="text"
              placeholder="Find in page..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 rounded-lg border border-[#E2E8F0] text-xs focus:outline-none focus:border-[#6D28D9] text-[#172554] w-48 bg-[#F8FAFC]"
            />
          </div>

          {highlightPassage && (
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#6D28D9] bg-[#F5F3FF] px-2.5 py-1 rounded-md border border-[#EDE9FE]">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#15803D]" />
              <span>Cited Page {initialPage} Excerpt Highlighted</span>
            </div>
          )}
        </div>

        {/* Document Page Content Viewer */}
        <div className="flex-1 overflow-y-auto p-6 bg-[#F8FAFC]">
          <div className="max-w-2xl mx-auto bg-white border border-[#E2E8F0] rounded-xl shadow-xs p-8 min-h-full font-serif leading-relaxed text-sm text-[#172554] whitespace-pre-wrap">
            <div className="border-b border-[#E2E8F0] pb-3 mb-6 flex justify-between items-center text-[11px] text-[#64748B] font-sans">
              <span className="font-mono text-[#172554]">{document.filename}</span>
              <span className="font-semibold text-[#6D28D9]">PAGE {currentPage}</span>
            </div>

            <div className="prose prose-slate max-w-none text-[#172554] font-serif leading-relaxed">
              {activePageData ? renderHighlightedText(activePageData.extractedText) : 'No content on this page.'}
            </div>

            <div className="border-t border-[#E2E8F0] pt-4 mt-8 flex justify-between items-center text-[10px] text-[#94A3B8] font-sans">
              <span>Clario Document Grounding Engine</span>
              <span>AUTHENTIC SOURCE CITATION</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
