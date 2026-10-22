import React, { useState } from 'react';
import {
  Search,
  FileText,
  Upload,
  ExternalLink,
  MessageSquareQuote,
  Trash2,
  Edit3,
  CheckCircle2,
  Check,
  X,
  Hash,
  LayoutGrid,
  List,
  Loader2,
} from 'lucide-react';
import { ClarioDocument } from '../../types';
import { AuthUser } from '../../lib/supabase';
import { GuestSignInPrompt } from '../GuestSignInPrompt';

interface MyDocumentsViewProps {
  documents: ClarioDocument[];
  currentUser: AuthUser;
  selectedDocId: string;
  isLoading?: boolean;
  onSelectDocument: (docId: string) => void;
  onOpenViewer: (doc: ClarioDocument, page: number) => void;
  onNavigateToAsk: (docId: string) => void;
  onNavigateToVerify: (docId: string) => void;
  onDeleteDocument: (docId: string) => void;
  onRenameDocument: (docId: string, newTitle: string) => void;
  onTriggerUpload: () => void;
  onGoToAuth: () => void;
}

export const MyDocumentsView: React.FC<MyDocumentsViewProps> = ({
  documents,
  currentUser,
  selectedDocId,
  isLoading = false,
  onSelectDocument,
  onOpenViewer,
  onNavigateToAsk,
  onNavigateToVerify,
  onDeleteDocument,
  onRenameDocument,
  onTriggerUpload,
  onGoToAuth,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  // 1. GUEST MODE RULE:
  // Do not display any documents or benchmark samples.
  // Do not show document counts such as "5 Indexed".
  // Render sign-in prompt with a prominent Sign In button.
  if (currentUser.isGuest) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-xs">
          <h2 className="text-base font-bold text-[#172554] tracking-tight mb-1">
            My Documents
          </h2>
          <p className="text-xs text-[#64748B]">
            Sign in to view, upload, and manage your private cloud documents.
          </p>
        </div>

        <GuestSignInPrompt
          featureName="My Documents"
          onSignIn={onGoToAuth}
          description="My Documents is your permanent cloud library. In guest mode, your documents are temporary to your active session. Sign in to your Clario account to save documents permanently with private cloud storage and history."
        />
      </div>
    );
  }

  // 2. LOADING STATE:
  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-xs flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-[#172554] tracking-tight">
              My Documents
            </h2>
            <p className="text-xs text-[#64748B]">
              Loading your cloud document library...
            </p>
          </div>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-16 shadow-xs text-center flex flex-col items-center justify-center">
          <Loader2 className="w-8 h-8 text-[#6D28D9] animate-spin mb-3" />
          <p className="text-xs font-semibold text-[#172554]">
            Retrieving documents from Supabase...
          </p>
          <p className="text-[11px] text-[#64748B] mt-1">
            Loading private documents belonging to {currentUser.email}
          </p>
        </div>
      </div>
    );
  }

  // 3. AUTHENTICATED USER STATE:
  const filteredDocs = documents.filter((doc) => {
    // If guest, hide sample documents
    if (currentUser.isGuest && doc.isSample) return false;

    const q = searchQuery.toLowerCase();
    return (
      doc.title.toLowerCase().includes(q) ||
      doc.filename.toLowerCase().includes(q) ||
      doc.language.toLowerCase().includes(q)
    );
  });

  const handleStartRename = (doc: ClarioDocument) => {
    setEditingDocId(doc.id);
    setEditTitle(doc.title);
  };

  const handleSaveRename = (docId: string) => {
    if (editTitle.trim()) {
      onRenameDocument(docId, editTitle.trim());
    }
    setEditingDocId(null);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header Strip with Search, View Toggle, and Upload */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-base font-bold text-[#172554] tracking-tight">
              My Documents
            </h2>
            <span className="text-[11px] font-semibold text-[#6D28D9] bg-[#F5F3FF] px-2 py-0.5 rounded-full border border-[#EDE9FE]">
              {`${documents.length} ${documents.length === 1 ? 'Document' : 'Documents'}`}
            </span>
          </div>
          <p className="text-xs text-[#64748B]">
            Registered Library: Synced to private Supabase storage with Row Level Security.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search Bar - only shown if documents exist */}
          {documents.length > 0 && (
            <div className="relative flex-1 sm:w-60">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#64748B]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by title or language..."
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-[#E2E8F0] focus:outline-none focus:border-[#6D28D9] text-[#172554] bg-[#F8FAFC]"
              />
            </div>
          )}

          {/* View mode toggle */}
          {documents.length > 0 && (
            <div className="flex items-center p-0.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg">
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-md cursor-pointer transition-colors ${
                  viewMode === 'list'
                    ? 'bg-white text-[#6D28D9] shadow-xs'
                    : 'text-[#64748B] hover:text-[#172554]'
                }`}
                title="List View"
              >
                <List className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-md cursor-pointer transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-white text-[#6D28D9] shadow-xs'
                    : 'text-[#64748B] hover:text-[#172554]'
                }`}
                title="Grid View"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

        </div>
      </div>

      {/* EMPTY STATE for authenticated user with no documents */}
      {documents.length === 0 && (
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-12 sm:p-16 shadow-xs text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#F5F3FF] text-[#6D28D9] border border-[#EDE9FE] flex items-center justify-center mx-auto mb-4">
            <FileText className="w-7 h-7 stroke-[2]" />
          </div>
          <h3 className="text-base font-bold text-[#172554] mb-1">
            No Documents in Your Library
          </h3>
          <p className="text-xs text-[#64748B] max-w-md mx-auto mb-6 leading-relaxed">
            You haven't uploaded any documents yet. Upload an Indian-language PDF (Tamil, Hindi, Marathi, etc.) or English document to begin grounded question answering, tabular extraction, and number verification.
          </p>
          <button
            onClick={onTriggerUpload}
            className="px-4 py-2 rounded-lg bg-[#6D28D9] hover:bg-[#5B21B6] text-white font-medium text-xs transition-colors shadow-xs cursor-pointer inline-flex items-center gap-2"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload First Document</span>
          </button>
        </div>
      )}

      {/* List View */}
      {documents.length > 0 && viewMode === 'list' && (
        <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-xs overflow-hidden">
          <div className="px-5 py-3 border-b border-[#E2E8F0] bg-[#F8FAFC] flex items-center justify-between text-xs text-[#64748B] font-medium">
            <span>Documents ({filteredDocs.length})</span>
            <span>Actions & Verification</span>
          </div>

          <div className="divide-y divide-[#E2E8F0]">
            {filteredDocs.map((doc) => {
              const isSelected = doc.id === selectedDocId;
              const isEditing = editingDocId === doc.id;

              return (
                <div
                  key={doc.id}
                  className={`p-4 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                    isSelected ? 'bg-[#F5F3FF]/40 border-l-4 border-l-[#6D28D9]' : 'hover:bg-[#F8FAFC]'
                  }`}
                >
                  {/* Left: Document details */}
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                        isSelected ? 'bg-[#F5F3FF] text-[#6D28D9]' : 'bg-[#F1F5F9] text-[#64748B]'
                      }`}
                    >
                      <FileText className="w-4 h-4 stroke-[2]" />
                    </div>

                    <div className="min-w-0 flex-1">
                      {isEditing ? (
                        <div className="flex items-center gap-2 mb-1">
                          <input
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            className="px-2 py-1 text-xs border border-[#6D28D9] rounded-md focus:outline-none text-[#172554] w-full max-w-sm"
                            autoFocus
                          />
                          <button
                            onClick={() => handleSaveRename(doc.id)}
                            className="p-1 text-[#15803D] hover:bg-[#F0FDF4] rounded cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setEditingDocId(null)}
                            className="p-1 text-[#DC2626] hover:bg-[#FEF2F2] rounded cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 mb-0.5">
                          <h4
                            onClick={() => onSelectDocument(doc.id)}
                            className={`text-sm font-semibold truncate cursor-pointer hover:text-[#6D28D9] ${
                              isSelected ? 'text-[#6D28D9]' : 'text-[#172554]'
                            }`}
                          >
                            {doc.title}
                          </h4>
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-2 text-xs text-[#64748B]">
                        <span className="font-mono text-[11px] text-[#172554]">{doc.filename}</span>
                        <span aria-hidden="true" className="text-[#CBD5E1]">·</span>
                        <span className="font-medium text-[#172554]">{doc.language}</span>
                        <span aria-hidden="true" className="text-[#CBD5E1]">·</span>
                        <span>{doc.pageCount} Pages</span>
                        <span aria-hidden="true" className="text-[#CBD5E1]">·</span>
                        <span className="text-[#15803D] flex items-center gap-0.5 font-medium">
                          <CheckCircle2 className="w-3 h-3" />
                          Indexed
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                    <button
                      onClick={() => onNavigateToAsk(doc.id)}
                      className="px-2.5 py-1.5 rounded-lg bg-[#6D28D9] hover:bg-[#5B21B6] text-white font-medium text-xs transition-colors shadow-xs cursor-pointer flex items-center gap-1"
                    >
                      <MessageSquareQuote className="w-3.5 h-3.5" />
                      <span>Ask</span>
                    </button>

                    <button
                      onClick={() => onOpenViewer(doc, 1)}
                      className="px-2.5 py-1.5 rounded-lg border border-[#E2E8F0] hover:bg-white text-xs font-medium text-[#172554] flex items-center gap-1 transition-colors cursor-pointer"
                      title="Inspect original pages"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-[#64748B]" />
                      <span>Pages</span>
                    </button>

                    <button
                      onClick={() => onNavigateToVerify(doc.id)}
                      className="p-1.5 rounded-lg border border-[#E2E8F0] hover:bg-white text-[#64748B] hover:text-[#15803D] transition-colors cursor-pointer"
                      title="Audit Numbers in this document"
                    >
                      <Hash className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => handleStartRename(doc)}
                      className="p-1.5 rounded-lg border border-[#E2E8F0] hover:bg-white text-[#64748B] hover:text-[#172554] transition-colors cursor-pointer"
                      title="Rename Document"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => onDeleteDocument(doc.id)}
                      className="p-1.5 rounded-lg border border-[#E2E8F0] hover:bg-[#FEF2F2] text-[#64748B] hover:text-[#DC2626] transition-colors cursor-pointer"
                      title="Delete Document"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}

            {filteredDocs.length === 0 && (
              <div className="p-8 text-center text-xs text-[#64748B]">
                No documents matched "{searchQuery}".
              </div>
            )}
          </div>
        </div>
      )}

      {/* Grid View */}
      {documents.length > 0 && viewMode === 'grid' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDocs.map((doc) => {
            const isSelected = doc.id === selectedDocId;

            return (
              <div
                key={doc.id}
                className={`bg-white border rounded-xl p-5 shadow-xs flex flex-col justify-between transition-all ${
                  isSelected ? 'border-[#6D28D9] ring-2 ring-[#6D28D9]/10' : 'border-[#E2E8F0] hover:border-[#6D28D9]/40'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="w-9 h-9 rounded-lg bg-[#F5F3FF] text-[#6D28D9] flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4 stroke-[2]" />
                    </div>
                    <span className="text-[11px] font-medium text-[#15803D] bg-[#F0FDF4] px-2 py-0.5 rounded-full border border-[#DCFCE7] flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      {doc.pageCount} Pages
                    </span>
                  </div>

                  <h3
                    onClick={() => onSelectDocument(doc.id)}
                    className="text-sm font-semibold text-[#172554] hover:text-[#6D28D9] cursor-pointer line-clamp-2 mb-1.5"
                  >
                    {doc.title}
                  </h3>

                  <p className="text-xs text-[#64748B] line-clamp-2 mb-3 leading-relaxed">
                    {doc.summary || 'Indexed Indian-language document ready for grounded answering.'}
                  </p>

                  <div className="flex items-center gap-1.5 text-[11px] text-[#64748B]">
                    <span className="px-2 py-0.5 rounded bg-[#F8FAFC] border border-[#E2E8F0] font-medium text-[#172554]">
                      {doc.language}
                    </span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-[#E2E8F0] flex items-center justify-between">
                  <button
                    onClick={() => onNavigateToAsk(doc.id)}
                    className="text-xs font-semibold text-[#6D28D9] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <MessageSquareQuote className="w-3.5 h-3.5" />
                    <span>Ask Clario</span>
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onOpenViewer(doc, 1)}
                      className="p-1.5 text-[#64748B] hover:text-[#172554] rounded hover:bg-[#F8FAFC] cursor-pointer"
                      title="Inspect Pages"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onNavigateToVerify(doc.id)}
                      className="p-1.5 text-[#64748B] hover:text-[#15803D] rounded hover:bg-[#F8FAFC] cursor-pointer"
                      title="Verify Numbers"
                    >
                      <Hash className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onDeleteDocument(doc.id)}
                      className="p-1.5 text-[#64748B] hover:text-[#DC2626] rounded hover:bg-[#FEF2F2] cursor-pointer"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
