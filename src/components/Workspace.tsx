import React, { useState, useRef, useEffect } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  X,
  Trash2,
  Loader2,
  FileText,
  Sparkles,
} from 'lucide-react';
import { ClarioDocument, Language } from '../types';
import {
  AuthUser,
  supabase,
  isSupabaseConfigured,
  uploadPdfToStorage,
  insertDocumentRecord,
  fetchUserDocuments,
  deleteDocumentRecord,
  renameDocumentRecord,
} from '../lib/supabase';
import { apiUrl } from '../lib/api';
import { Sidebar, WorkspaceTab } from './Sidebar';
import { TopHeader } from './TopHeader';
import { AskDocumentsView } from './views/AskDocumentsView';
import { MyDocumentsView } from './views/MyDocumentsView';

const CompareDocumentsView = React.lazy(() =>
  import('./views/CompareDocumentsView').then((m) => ({ default: m.CompareDocumentsView }))
);
const VerifyNumbersView = React.lazy(() =>
  import('./views/VerifyNumbersView').then((m) => ({ default: m.VerifyNumbersView }))
);
const ContradictionRadarView = React.lazy(() =>
  import('./views/ContradictionRadarView').then((m) => ({ default: m.ContradictionRadarView }))
);
const EvidenceGraphView = React.lazy(() =>
  import('./views/EvidenceGraphView').then((m) => ({ default: m.EvidenceGraphView }))
);
const DecisionSimulatorView = React.lazy(() =>
  import('./views/DecisionSimulatorView').then((m) => ({ default: m.DecisionSimulatorView }))
);
const TestLabView = React.lazy(() =>
  import('./views/TestLabView').then((m) => ({ default: m.TestLabView }))
);
const DocumentViewerModal = React.lazy(() =>
  import('./DocumentViewerModal').then((m) => ({ default: m.DocumentViewerModal }))
);
const ConfigGuideModal = React.lazy(() =>
  import('./ConfigGuideModal').then((m) => ({ default: m.ConfigGuideModal }))
);

const ViewFallback: React.FC = () => (
  <div className="flex-1 flex items-center justify-center p-16">
    <div className="flex flex-col items-center gap-3">
      <Loader2 className="w-6 h-6 text-[#6D28D9] animate-spin" />
      <span className="text-xs font-semibold text-[#64748B]">Loading view...</span>
    </div>
  </div>
);

interface WorkspaceProps {
  currentUser: AuthUser;
  onSignOut: () => void;
  onGoToAuth: () => void;
}

interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

export type ProcessingStage = 'idle' | 'uploading' | 'extracting' | 'indexing' | 'completed' | 'failed';

export const Workspace: React.FC<WorkspaceProps> = ({
  currentUser,
  onSignOut,
  onGoToAuth,
}) => {
  // Navigation & Shell state
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('ask');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);

  // Documents state: initialized empty - no sample documents fallback
  const [documents, setDocuments] = useState<ClarioDocument[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string>('');
  const [isLoadingDocs, setIsLoadingDocs] = useState<boolean>(!currentUser.isGuest);
  const [answerLanguage, setAnswerLanguage] = useState<Language>('English');
  const [isUploading, setIsUploading] = useState(false);
  const [processingStage, setProcessingStage] = useState<ProcessingStage>('idle');
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [processingFileName, setProcessingFileName] = useState<string>('');
  const [processingMessage, setProcessingMessage] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // In-app notifications & confirmation modal (Zero window.alert / window.confirm)
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [docToDelete, setDocToDelete] = useState<ClarioDocument | null>(null);

  // Viewer modal state
  const [viewerState, setViewerState] = useState<{
    isOpen: boolean;
    doc: ClarioDocument;
    page: number;
    passage?: string;
  } | null>(null);

  const selectedDocument =
    documents.find((d) => d.id === selectedDocId) || documents[0] || null;

  const showToast = (type: 'success' | 'error' | 'info', message: string) => {
    const id = `toast-${Date.now()}`;
    setToast({ id, type, message });
    setTimeout(() => {
      setToast((curr) => (curr?.id === id ? null : curr));
    }, 4500);
  };

  // Load authenticated user's documents from Supabase on mount
  useEffect(() => {
    let isMounted = true;

    if (currentUser.isGuest) {
      // In guest mode: load from sessionStorage if available for this isolated guest session
      try {
        const stored = sessionStorage.getItem(`clario_guest_docs_${currentUser.id}`);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setDocuments(parsed);
            setSelectedDocId(parsed[0].id);
            setIsLoadingDocs(false);
            return;
          }
        }
      } catch (err) {
        console.warn('Error reading guest docs from sessionStorage:', err);
      }
      setDocuments([]);
      setSelectedDocId('');
      setIsLoadingDocs(false);
      return;
    }

    const loadSavedDocuments = async () => {
      setIsLoadingDocs(true);
      if (supabase && isSupabaseConfigured()) {
        try {
          const { documents: userDocs, error } = await fetchUserDocuments(currentUser.id);
          if (!isMounted) return;

          if (error) {
            console.error('[Clario] Error loading documents from Supabase:', error);
            showToast('error', `Could not load cloud library: ${error}`);
            setDocuments([]);
            setSelectedDocId('');
          } else {
            // Only user's documents - Never inject sample or demo documents
            setDocuments(userDocs);
            if (userDocs.length > 0) {
              setSelectedDocId(userDocs[0].id);
            } else {
              setSelectedDocId('');
            }
          }
        } catch (loadErr: any) {
          if (isMounted) {
            console.error('[Clario] Unexpected error fetching documents:', loadErr);
            showToast('error', `Failed to retrieve cloud documents: ${loadErr?.message || 'Network error'}`);
            setDocuments([]);
            setSelectedDocId('');
          }
        } finally {
          if (isMounted) {
            setIsLoadingDocs(false);
          }
        }
      } else {
        // Authenticated without remote backend: empty documents
        if (isMounted) {
          setDocuments([]);
          setSelectedDocId('');
          setIsLoadingDocs(false);
        }
      }
    };

    loadSavedDocuments();

    return () => {
      isMounted = false;
    };
  }, [currentUser.id, currentUser.isGuest]);

  // Enhanced Upload PDF Handler with Deduplication & Multi-Stage Progress
  const processUploadedFile = (file: File) => {
    if (file.type !== 'application/pdf' && !file.name.endsWith('.pdf')) {
      showToast('error', 'Please upload a PDF document (.pdf)');
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      showToast('error', 'PDF exceeds 20MB limit. Please upload a smaller document.');
      return;
    }

    // 1. DEDUPLICATION CHECK: Check if exact document is already present in library
    const existingDoc = documents.find(
      (d) => d.filename.toLowerCase() === file.name.toLowerCase()
    );
    if (existingDoc) {
      setSelectedDocId(existingDoc.id);
      showToast(
        'info',
        `Reusing existing indexed document "${existingDoc.title}" (${existingDoc.pageCount} pages).`
      );
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setIsUploading(true);
    setProcessingFileName(file.name);
    setProcessingStage('uploading');
    setUploadProgress(25);
    setProcessingMessage('Uploading PDF document...');

    const reader = new FileReader();
    reader.onload = async () => {
      const abortController = new AbortController();
      const timeoutId = setTimeout(() => abortController.abort(), 60000); // 60s timeout

      try {
        const base64Data = reader.result as string;

        // Stage 2: Extracting text & running OCR
        setProcessingStage('extracting');
        setUploadProgress(55);
        setProcessingMessage('Extracting text and running OCR on pages...');

        const response = await fetch(apiUrl('/api/documents/process'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: abortController.signal,
          body: JSON.stringify({
            filename: file.name,
            fileData: base64Data,
            language: 'Tamil',
          }),
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errBody = await response.json().catch(() => null);
          const detail =
            errBody?.error ||
            errBody?.message ||
            `HTTP ${response.status} (${response.statusText || 'Endpoint unavailable'})`;
          throw new Error(detail);
        }

        const data = await response.json();
        const extractedPages = data.pages || [];

        // Stage 3: Indexing pages & syncing
        setProcessingStage('indexing');
        setUploadProgress(85);
        setProcessingMessage(`Indexing ${extractedPages.length} pages & syncing to private storage...`);

        // Save to Supabase Storage bucket 'Clario' and public.documents
        if (supabase && isSupabaseConfigured() && !currentUser.isGuest) {
          // 1. Upload PDF binary to Supabase Storage
          const { storagePath, error: storageErr } = await uploadPdfToStorage(
            currentUser.id,
            file
          );

          if (storageErr || !storagePath) {
            console.error('[Clario] Supabase Storage upload error:', storageErr);
            showToast('error', `Storage upload failed: ${storageErr || 'Access denied'}`);
            setProcessingStage('failed');
            return;
          }

          // 2. Insert record into public.documents & public.document_pages
          const { document: savedDoc, error: dbErr } = await insertDocumentRecord({
            userId: currentUser.id,
            fileName: file.name,
            storagePath,
            pages: extractedPages,
            summary: data.summary,
          });
          if (dbErr) {
            console.error('[Clario] Insert record error (post-insert check):', dbErr);
          } else {
            console.log('[Clario] Document inserted, refreshing list from server...');
            try {
              const { documents: refreshedDocs, error: fetchErr } = await fetchUserDocuments(currentUser.id);
              if (fetchErr) {
                console.error('[Clario] Error refreshing documents after insert:', fetchErr);
              } else {
                setDocuments(refreshedDocs);
                if (refreshedDocs.length > 0) setSelectedDocId(refreshedDocs[0].id);
              }
            } catch (refreshErr) {
              console.error('[Clario] Exception during documents refresh:', refreshErr);
            }
          }

          if (dbErr || !savedDoc) {
            console.error('[Clario] Supabase Database insert error:', dbErr);
            showToast('error', `Database insert into public.documents failed: ${dbErr || 'Failed to save'}`);
            setProcessingStage('failed');
            return;
          }

          setDocuments((prev) => [savedDoc, ...prev]);
          setSelectedDocId(savedDoc.id);

          // Stage 4: Completed
          setProcessingStage('completed');
          setUploadProgress(100);
          setProcessingMessage(`Completed! "${savedDoc.title}" ready.`);

          if (activeTab !== 'compare' && activeTab !== 'verify') {
            setActiveTab('ask');
          }
          showToast(
            'success',
            `"${savedDoc.title}" indexed & archived to Clario storage (${savedDoc.pageCount} pages).`
          );
        } else {
          // Authenticated/Demo session without remote backend
          const newDoc: ClarioDocument = {
            id: `doc-${Date.now()}`,
            userId: currentUser.id,
            filename: file.name,
            title: file.name.replace(/\.pdf$/i, '').replace(/_/g, ' '),
            language: 'Indian Script / English',
            pageCount: extractedPages.length || 1,
            processingStatus: 'completed',
            summary:
              data.summary ||
              'User-uploaded PDF indexed and ready for grounded query analysis.',
            pages: extractedPages,
            createdAt: new Date().toISOString(),
            isGuest: currentUser.isGuest,
          };

          setDocuments((prev) => {
            const updated = [newDoc, ...prev];
            if (currentUser.isGuest) {
              try {
                sessionStorage.setItem(`clario_guest_docs_${currentUser.id}`, JSON.stringify(updated));
              } catch (e) {
                console.warn('Failed to save guest document in session storage:', e);
              }
            }
            return updated;
          });
          setSelectedDocId(newDoc.id);

          // Stage 4: Completed
          setProcessingStage('completed');
          setUploadProgress(100);
          setProcessingMessage(`Completed! "${newDoc.title}" ready.`);

          if (activeTab !== 'compare' && activeTab !== 'verify') {
            setActiveTab('ask');
          }
          showToast(
            'success',
            `"${newDoc.title}" indexed successfully (${newDoc.pageCount} pages).`
          );
        }
      } catch (uploadErr: any) {
        clearTimeout(timeoutId);
        console.error('Upload error:', uploadErr);
        setProcessingStage('failed');
        showToast(
          'error',
          uploadErr.name === 'AbortError'
            ? 'Processing timed out after 60 seconds. Please try again with a smaller file.'
            : `Failed to process uploaded PDF: ${uploadErr?.message || 'Processing error'}`
        );
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
        setTimeout(() => {
          setProcessingStage('idle');
          setUploadProgress(0);
        }, 3000);
      }
    };

    reader.onerror = () => {
      setIsUploading(false);
      setProcessingStage('failed');
      showToast('error', 'Failed to read PDF file.');
      setTimeout(() => setProcessingStage('idle'), 2500);
    };

    reader.readAsDataURL(file);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processUploadedFile(files[0]);
    }
  };

  const handleTriggerUpload = () => {
    fileInputRef.current?.click();
  };

  const handleRenameDocument = async (docId: string, newTitle: string) => {
    const doc = documents.find((d) => d.id === docId);
    if (!doc) return;

    if (!doc.isGuest && supabase && isSupabaseConfigured()) {
      const { newFileName, error } = await renameDocumentRecord(docId, newTitle);
      if (error) {
        console.error('[Clario] Rename error in Supabase:', error);
        showToast('error', `Failed to rename document in cloud database: ${error}`);
        return;
      }
      setDocuments((prev) =>
        prev.map((d) =>
          d.id === docId ? { ...d, title: newTitle, filename: newFileName } : d
        )
      );
      showToast('success', 'Document renamed in cloud library.');
    } else {
      setDocuments((prev) => {
        const updated = prev.map((d) => (d.id === docId ? { ...d, title: newTitle } : d));
        if (currentUser.isGuest) {
          try {
            sessionStorage.setItem(`clario_guest_docs_${currentUser.id}`, JSON.stringify(updated));
          } catch {}
        }
        return updated;
      });
      showToast('success', 'Document renamed.');
    }
  };

  const confirmDeleteDocument = async () => {
    if (!docToDelete) return;
    const docId = docToDelete.id;

    if (!docToDelete.isGuest && supabase && isSupabaseConfigured()) {
      const { error } = await deleteDocumentRecord(docId, docToDelete.storagePath);
      if (error) {
        console.error('[Clario] Delete error in Supabase:', error);
        showToast('error', `Failed to delete document from database: ${error}`);
        return;
      }
    }

    setDocuments((prev) => {
      const updated = prev.filter((d) => d.id !== docId);
      if (currentUser.isGuest) {
        try {
          sessionStorage.setItem(`clario_guest_docs_${currentUser.id}`, JSON.stringify(updated));
        } catch {}
      }
      return updated;
    });
    if (selectedDocId === docId) {
      const remaining = documents.filter((d) => d.id !== docId);
      if (remaining.length > 0) {
        setSelectedDocId(remaining[0].id);
      } else {
        setSelectedDocId('');
      }
    }
    showToast('info', `"${docToDelete.title}" removed from library.`);
    setDocToDelete(null);
  };

  const openViewer = (doc: ClarioDocument, page: number, passage?: string) => {
    setViewerState({
      isOpen: true,
      doc,
      page,
      passage,
    });
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex text-[#172554] selection:bg-[#F5F3FF] selection:text-[#6D28D9]">
      {/* Hidden File Input for PDF Uploads */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept="application/pdf"
        className="hidden"
      />

      {/* Floating In-App Toast */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 animate-in slide-in-from-bottom-3 duration-200">
          <div
            className={`px-4 py-3 rounded-xl shadow-lg border flex items-center gap-2.5 text-xs font-medium max-w-md ${
              toast.type === 'success'
                ? 'bg-white border-[#DCFCE7] text-[#15803D]'
                : toast.type === 'error'
                ? 'bg-white border-[#FEE2E2] text-[#DC2626]'
                : 'bg-white border-[#E2E8F0] text-[#172554]'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-[#15803D] shrink-0" />
            ) : toast.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-[#DC2626] shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-[#6D28D9] shrink-0" />
            )}
            <span className="flex-1">{toast.message}</span>
            <button
              onClick={() => setToast(null)}
              className="p-1 rounded-md text-[#64748B] hover:text-[#172554] cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* In-App Delete Confirmation Modal (Zero window.confirm) */}
      {docToDelete && (
        <div className="fixed inset-0 z-50 bg-[#172554]/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-xl w-full max-w-md p-6 animate-in zoom-in-95 duration-150">
            <div className="w-10 h-10 rounded-xl bg-[#FEF2F2] text-[#DC2626] flex items-center justify-center mb-4">
              <Trash2 className="w-5 h-5 stroke-[2]" />
            </div>
            <h3 className="text-base font-bold text-[#172554] mb-1">
              Delete Document?
            </h3>
            <p className="text-xs text-[#64748B] mb-5 leading-relaxed">
              Are you sure you want to remove <strong>"{docToDelete.title}"</strong> from your library? This will delete the file from your Supabase Storage bucket and database.
            </p>
            <div className="flex items-center justify-end gap-2.5">
              <button
                onClick={() => setDocToDelete(null)}
                className="px-4 py-2 rounded-lg border border-[#E2E8F0] text-xs font-semibold text-[#64748B] hover:text-[#172554] hover:bg-[#F8FAFC] cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteDocument}
                className="px-4 py-2 rounded-lg bg-[#DC2626] hover:bg-[#B91C1C] text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                Delete Document
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 1. Left Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        currentUser={currentUser}
        onSignOut={onSignOut}
        onGoToAuth={onGoToAuth}
        onOpenSettings={() => setShowConfigModal(true)}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* 2. Main Application Shell */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Compact Top Header */}
        <TopHeader
          activeTab={activeTab}
          onOpenMobileMenu={() => setIsMobileSidebarOpen(true)}
          selectedDocument={selectedDocument}
          documents={documents}
          onSelectDocument={setSelectedDocId}
          answerLanguage={answerLanguage}
          onSelectLanguage={setAnswerLanguage}
          onTriggerUpload={handleTriggerUpload}
          isUploading={isUploading}
          currentUser={currentUser}
          onSignOut={onSignOut}
          onGoToAuth={onGoToAuth}
        />

        {/* 3. Main Content Area */}
        <main className="flex-1 p-4 sm:p-6 md:p-8 overflow-y-auto">
          {activeTab === 'ask' && (
            <AskDocumentsView
              document={selectedDocument}
              currentUser={currentUser}
              answerLanguage={answerLanguage}
              onOpenViewer={openViewer}
              onNavigateToMyDocs={() => setActiveTab('documents')}
              onGoToAuth={onGoToAuth}
              onTriggerUpload={handleTriggerUpload}
              isUploading={isUploading}
            />
          )}

          {activeTab === 'documents' && (
            <MyDocumentsView
              documents={documents}
              currentUser={currentUser}
              selectedDocId={selectedDocId}
              isLoading={isLoadingDocs}
              onSelectDocument={(id) => {
                setSelectedDocId(id);
                setActiveTab('ask');
              }}
              onOpenViewer={(doc, page) => openViewer(doc, page)}
              onNavigateToAsk={(id) => {
                setSelectedDocId(id);
                setActiveTab('ask');
              }}
              onNavigateToVerify={(id) => {
                setSelectedDocId(id);
                setActiveTab('verify');
              }}
              onDeleteDocument={(id) => {
                const target = documents.find((d) => d.id === id);
                if (target) setDocToDelete(target);
              }}
              onRenameDocument={handleRenameDocument}
              onTriggerUpload={handleTriggerUpload}
              onGoToAuth={onGoToAuth}
            />
          )}

          <React.Suspense fallback={<ViewFallback />}>
            {activeTab === 'compare' && (
              <CompareDocumentsView
                documents={documents}
                currentUser={currentUser}
                onOpenViewer={openViewer}
                onGoToAuth={onGoToAuth}
                onNavigateToMyDocs={() => setActiveTab('documents')}
                onTriggerUpload={handleTriggerUpload}
                isUploading={isUploading}
              />
            )}

            {activeTab === 'verify' && (
              <VerifyNumbersView
                documents={documents}
                currentUser={currentUser}
                initialDocId={selectedDocId}
                onOpenViewer={openViewer}
                onGoToAuth={onGoToAuth}
                onNavigateToMyDocs={() => setActiveTab('documents')}
                onTriggerUpload={handleTriggerUpload}
                isUploading={isUploading}
              />
            )}

            {activeTab === 'contradictions' && (
              <ContradictionRadarView
                documents={documents}
                currentUser={currentUser}
                initialDocId={selectedDocId}
                onOpenViewer={openViewer}
                onGoToAuth={onGoToAuth}
                onNavigateToMyDocs={() => setActiveTab('documents')}
                onTriggerUpload={handleTriggerUpload}
                isUploading={isUploading}
              />
            )}

            {activeTab === 'evidence_graph' && (
              <EvidenceGraphView
                documents={documents}
                currentUser={currentUser}
                initialDocId={selectedDocId}
                onOpenViewer={openViewer}
                onGoToAuth={onGoToAuth}
                onNavigateToMyDocs={() => setActiveTab('documents')}
                onTriggerUpload={handleTriggerUpload}
                isUploading={isUploading}
              />
            )}

            {activeTab === 'decision_simulator' && (
              <DecisionSimulatorView
                documents={documents}
                currentUser={currentUser}
                initialDocId={selectedDocId}
                onOpenViewer={openViewer}
                onGoToAuth={onGoToAuth}
                onNavigateToMyDocs={() => setActiveTab('documents')}
                onTriggerUpload={handleTriggerUpload}
                isUploading={isUploading}
              />
            )}

            {activeTab === 'testlab' && (
              <TestLabView
                documents={documents}
                currentUser={currentUser}
                onOpenViewer={openViewer}
                onGoToAuth={onGoToAuth}
              />
            )}
          </React.Suspense>
        </main>
      </div>

      {/* Document Viewer Modal for inspecting pages & highlighted citations */}
      {viewerState?.isOpen && (
        <React.Suspense fallback={null}>
          <DocumentViewerModal
            document={viewerState.doc}
            initialPage={viewerState.page}
            highlightPassage={viewerState.passage}
            onClose={() => setViewerState(null)}
          />
        </React.Suspense>
      )}

      {/* Settings / Supabase & VerbX Blueprint Modal */}
      {showConfigModal && (
        <React.Suspense fallback={null}>
          <ConfigGuideModal onClose={() => setShowConfigModal(false)} />
        </React.Suspense>
      )}

      {/* Floating Real-Time Processing Status Card */}
      {processingStage !== 'idle' && (
        <aside
          aria-label="Document Processing Pipeline"
          className="fixed bottom-5 right-5 z-50 w-80 sm:w-96 bg-white border border-[#E2E8F0] rounded-xl shadow-lg p-4 animate-in slide-in-from-bottom-5 duration-200"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {processingStage === 'completed' ? (
                <CheckCircle2 className="w-4 h-4 text-[#15803D]" />
              ) : processingStage === 'failed' ? (
                <AlertCircle className="w-4 h-4 text-[#DC2626]" />
              ) : (
                <Loader2 className="w-4 h-4 text-[#6D28D9] animate-spin" />
              )}
              <h3 className="text-xs font-bold text-[#172554] tracking-tight">
                Document Processing Pipeline
              </h3>
            </div>
            <span
              className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                processingStage === 'completed'
                  ? 'bg-[#F0FDF4] text-[#15803D] border-[#DCFCE7]'
                  : processingStage === 'failed'
                  ? 'bg-[#FEF2F2] text-[#DC2626] border-[#FEE2E2]'
                  : 'bg-[#F5F3FF] text-[#6D28D9] border-[#EDE9FE]'
              }`}
            >
              {processingStage === 'uploading' && 'Uploading'}
              {processingStage === 'extracting' && 'Extracting text'}
              {processingStage === 'indexing' && 'Indexing pages'}
              {processingStage === 'completed' && 'Completed'}
              {processingStage === 'failed' && 'Error'}
            </span>
          </div>

          <div className="flex items-center gap-2 mb-2 text-xs text-[#64748B]">
            <FileText className="w-3.5 h-3.5 text-[#6D28D9] shrink-0" />
            <span className="font-mono text-[11px] text-[#172554] truncate">{processingFileName}</span>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-[#F1F5F9] rounded-full h-1.5 mb-2 overflow-hidden">
            <div
              className={`h-full transition-all duration-300 rounded-full ${
                processingStage === 'completed'
                  ? 'bg-[#15803D]'
                  : processingStage === 'failed'
                  ? 'bg-[#DC2626]'
                  : 'bg-[#6D28D9]'
              }`}
              style={{ width: `${uploadProgress}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-[#64748B]">
            <span className="truncate pr-2">{processingMessage}</span>
            <span className="font-mono font-semibold text-[#172554]">{uploadProgress}%</span>
          </div>
        </aside>
      )}

      {/* Settings / Supabase & VerbX Blueprint Modal */}
      {showConfigModal && (
        <ConfigGuideModal onClose={() => setShowConfigModal(false)} />
      )}
    </div>
  );
};
