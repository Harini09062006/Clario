import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Retrieve Supabase environment variables from client environment
const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
console.log('[Supabase Config] URL:', supabaseUrl);
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

export const isSupabaseConfigured = (): boolean => {
  return Boolean(supabaseUrl && supabaseAnonKey);
};

// Initialize client only if valid configuration exists, otherwise null
export const supabase: SupabaseClient | null = isSupabaseConfigured()
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export interface AuthUser {
  id: string;
  email: string;
  isGuest: boolean;
  role?: string;
}

// Local mock session storage key for guest/demo mode
const GUEST_STORAGE_KEY = 'clario_guest_session';
const DEMO_USER_KEY = 'clario_demo_user';

export const getStoredGuestSession = (): AuthUser | null => {
  try {
    const raw = localStorage.getItem(GUEST_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const createGuestSession = (): AuthUser => {
  const guest: AuthUser = {
    id: `guest_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    email: 'guest@clario.local',
    isGuest: true,
  };
  localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(guest));
  return guest;
};

export const clearGuestSession = (): void => {
  const currentGuest = getStoredGuestSession();
  if (currentGuest) {
    try {
      sessionStorage.removeItem(`clario_guest_docs_${currentGuest.id}`);
    } catch {}
  }
  localStorage.removeItem(GUEST_STORAGE_KEY);
};

export const getStoredDemoUser = (): AuthUser | null => {
  try {
    const raw = localStorage.getItem(DEMO_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const setStoredDemoUser = (user: AuthUser | null): void => {
  if (user) {
    localStorage.setItem(DEMO_USER_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(DEMO_USER_KEY);
  }
};

// Storage bucket for Clario PDF documents
export const CLARIO_STORAGE_BUCKET = 'Clario';

import { ClarioDocument, DocumentPage } from '../types';

/**
 * Parses formatted extracted text into DocumentPage objects.
 * Supports '--- [Page X] ---' markers and falls back to clean single-page chunking.
 */
export const parsePagesFromExtractedText = (
  rawText: string,
  docId: string
): DocumentPage[] => {
  if (!rawText || !rawText.trim()) {
    return [
      {
        id: `p-1-${docId}`,
        pageNumber: 1,
        extractedText: 'Document loaded. Embedded text could not be verified automatically.',
        ocrConfidence: 0.9,
      },
    ];
  }

  const pageHeaderRegex = /---\s*\[Page\s+(\d+)\]\s*---\n?/gi;
  const matches = [...rawText.matchAll(pageHeaderRegex)];

  if (matches.length > 0) {
    const pages: DocumentPage[] = [];
    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      const pageNumber = parseInt(match[1], 10) || i + 1;
      const startIndex = match.index! + match[0].length;
      const endIndex =
        i + 1 < matches.length ? matches[i + 1].index! : rawText.length;
      const pageText = rawText.slice(startIndex, endIndex).trim();

      pages.push({
        id: `p-${pageNumber}-${docId}`,
        pageNumber,
        extractedText: pageText,
        ocrConfidence: 0.95,
      });
    }
    if (pages.length > 0) return pages;
  }

  // Fallback: check form feeds or return as page 1
  const formFeedParts = rawText.split('\f').filter((t) => t.trim().length > 0);
  if (formFeedParts.length > 1) {
    return formFeedParts.map((part, idx) => ({
      id: `p-${idx + 1}-${docId}`,
      pageNumber: idx + 1,
      extractedText: part.trim(),
      ocrConfidence: 0.94,
    }));
  }

  return [
    {
      id: `p-1-${docId}`,
      pageNumber: 1,
      extractedText: rawText.trim(),
      ocrConfidence: 0.95,
    },
  ];
};

/**
 * Formats document pages into a structured text string with page headers
 * for storage in public.documents.extracted_text.
 */
export const formatPagesToExtractedText = (pages: DocumentPage[]): string => {
  if (!pages || pages.length === 0) return '';
  return pages
    .map((p) => `--- [Page ${p.pageNumber}] ---\n${(p.extractedText || '').trim()}`)
    .join('\n\n');
};

/**
 * Uploads a PDF file directly to the Supabase Storage bucket 'Clario'
 * using the authenticated user's session.
 */
export const uploadPdfToStorage = async (
  userId: string,
  file: File
): Promise<{ storagePath: string | null; error: string | null }> => {
  if (!supabase) {
    return { storagePath: null, error: 'Supabase client is not configured.' };
  }

  const cleanFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `${userId}/${Date.now()}_${cleanFileName}`;

  try {
    const { error } = await supabase.storage
      .from(CLARIO_STORAGE_BUCKET)
      .upload(storagePath, file, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (error) {
      return { storagePath: null, error: error.message };
    }

    return { storagePath, error: null };
  } catch (err: any) {
    return { storagePath: null, error: err?.message || 'Storage upload failed.' };
  }
};

/**
 * Inserts document metadata and full extracted text into public.documents,
 * and additionally saves individual pages to public.document_pages if present.
 */
export const insertDocumentRecord = async (params: {
  userId: string;
  fileName: string;
  storagePath: string;
  pages: DocumentPage[];
  summary?: string;
}): Promise<{ document: ClarioDocument | null; error: string | null }> => {
  if (!supabase) {
    return { document: null, error: 'Supabase client is not configured.' };
  }

  const formattedText = formatPagesToExtractedText(params.pages);

  try {
    // 1. Insert into public.documents matching actual database columns:
    // id, user_id, file_name, storage_path, status, extracted_text, created_at
    const { data: docRow, error: docError } = await supabase
      .from('documents')
      .insert({
        user_id: params.userId,
        file_name: params.fileName,
        storage_path: params.storagePath,
        status: 'completed',
        extracted_text: formattedText,
      })
      .select('*')
      .single();

    if (docError || !docRow) {
      // Safely cleanup the orphaned Storage file if the database insert fails
      if (params.storagePath) {
        try {
          await supabase.storage
            .from(CLARIO_STORAGE_BUCKET)
            .remove([params.storagePath]);
        } catch (cleanupErr) {
          console.warn('[Clario] Could not delete orphaned storage file:', cleanupErr);
        }
      }

      return {
        document: null,
        error: docError?.message || 'Failed to insert document record.',
      };
    }

    // 2. Insert into public.document_pages if table exists
    if (params.pages.length > 0) {
      const pageRows = params.pages.map((p) => ({
        document_id: docRow.id,
        page_number: p.pageNumber,
        extracted_text: p.extractedText,
        ocr_confidence: p.ocrConfidence || 0.95,
      }));

      const { error: pagesErr } = await supabase
        .from('document_pages')
        .insert(pageRows);

      if (pagesErr) {
        console.warn(
          '[Clario] document_pages insert notice (table optional or awaiting migration):',
          pagesErr.message
        );
      }
    }

    const title = (params.fileName || 'Document')
      .replace(/\.pdf$/i, '')
      .replace(/_/g, ' ');

    const newDoc: ClarioDocument = {
      id: docRow.id,
      userId: docRow.user_id,
      filename: docRow.file_name,
      title,
      storagePath: docRow.storage_path,
      language: 'Indian Script / English',
      pageCount: params.pages.length || 1,
      processingStatus: 'completed',
      summary:
        params.summary ||
        `Document processed and securely archived to Clario storage (${params.pages.length} pages).`,
      pages: params.pages,
      createdAt: docRow.created_at || new Date().toISOString(),
      isGuest: false,
    };

    return { document: newDoc, error: null };
  } catch (err: any) {
    if (params.storagePath) {
      try {
        await supabase.storage
          .from(CLARIO_STORAGE_BUCKET)
          .remove([params.storagePath]);
      } catch (cleanupErr) {
        console.warn('[Clario] Could not delete orphaned storage file on catch:', cleanupErr);
      }
    }

    return {
      document: null,
      error: err?.message || 'Database transaction error.',
    };
  }
};

/**
 * Loads the current signed-in user's documents from public.documents
 * and joins pages from public.document_pages or falls back to extracted_text.
 */
export const fetchUserDocuments = async (
  userId: string
): Promise<{ documents: ClarioDocument[]; error: string | null }> => {
  if (!supabase) {
    return { documents: [], error: 'Supabase client is not configured.' };
  }

  try {
    const { data: rows, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (docError) {
      return { documents: [], error: docError.message };
    }

    if (!rows || rows.length === 0) {
      return { documents: [], error: null };
    }

    // Attempt to load pages from public.document_pages
    const docIds = rows.map((r: any) => r.id);
    const pagesMap = new Map<string, DocumentPage[]>();

    try {
      const { data: pagesRows, error: pagesErr } = await supabase
        .from('document_pages')
        .select('*')
        .in('document_id', docIds)
        .order('page_number', { ascending: true });

      if (!pagesErr && pagesRows) {
        for (const p of pagesRows) {
          const list = pagesMap.get(p.document_id) || [];
          list.push({
            id: p.id || `p-${p.page_number}-${p.document_id}`,
            pageNumber: p.page_number,
            extractedText: p.extracted_text || '',
            ocrConfidence: Number(p.ocr_confidence) || 0.95,
          });
          pagesMap.set(p.document_id, list);
        }
      }
    } catch {
      // document_pages table might not exist in database yet
    }

    const docs: ClarioDocument[] = rows.map((row: any) => {
      let pages = pagesMap.get(row.id);
      if (!pages || pages.length === 0) {
        pages = parsePagesFromExtractedText(row.extracted_text || '', row.id);
      }

      const title = (row.file_name || 'Document')
        .replace(/\.pdf$/i, '')
        .replace(/_/g, ' ');

      return {
        id: row.id,
        userId: row.user_id,
        filename: row.file_name || 'Document.pdf',
        title,
        storagePath: row.storage_path,
        language: 'Indian Script / English',
        pageCount: pages.length || 1,
        processingStatus: (row.status as any) || 'completed',
        summary: `Document indexed from cloud storage (${pages.length} pages).`,
        pages,
        createdAt: row.created_at || new Date().toISOString(),
        isGuest: false,
      };
    });

    return { documents: docs, error: null };
  } catch (err: any) {
    return { documents: [], error: err?.message || 'Failed to fetch documents.' };
  }
};

/**
 * Deletes a document record from public.documents and its associated PDF
 * from the 'Clario' storage bucket.
 */
export const deleteDocumentRecord = async (
  docId: string,
  storagePath?: string
): Promise<{ error: string | null }> => {
  if (!supabase) {
    return { error: 'Supabase client is not configured.' };
  }

  try {
    // 1. Delete from public.documents (cascades to document_pages if present)
    const { error: dbErr } = await supabase
      .from('documents')
      .delete()
      .eq('id', docId);

    if (dbErr) {
      return { error: dbErr.message };
    }

    // 2. Delete file from Clario storage bucket
    if (storagePath) {
      try {
        const { error: storageErr } = await supabase.storage
          .from(CLARIO_STORAGE_BUCKET)
          .remove([storagePath]);

        if (storageErr) {
          console.warn('[Clario] Storage remove warning:', storageErr.message);
        }
      } catch (storageException: any) {
        console.warn('[Clario] Storage delete notice:', storageException);
      }
    }

    return { error: null };
  } catch (err: any) {
    return { error: err?.message || 'Failed to delete document.' };
  }
};

/**
 * Renames a document in public.documents (updating file_name).
 */
export const renameDocumentRecord = async (
  docId: string,
  newTitle: string
): Promise<{ newFileName: string; error: string | null }> => {
  if (!supabase) {
    return { newFileName: newTitle, error: 'Supabase client is not configured.' };
  }

  const cleanName = newTitle.trim();
  const newFileName = cleanName.toLowerCase().endsWith('.pdf')
    ? cleanName
    : `${cleanName}.pdf`;

  try {
    const { error } = await supabase
      .from('documents')
      .update({ file_name: newFileName })
      .eq('id', docId);

    if (error) {
      return { newFileName, error: error.message };
    }

    return { newFileName, error: null };
  } catch (err: any) {
    return { newFileName, error: err?.message || 'Failed to rename document.' };
  }
};

// Supabase SQL migration script
export const SUPABASE_SQL_MIGRATION = `-- ==========================================
-- CLARIO: Indian-Language Document Intelligence
-- PostgreSQL Schema & Row Level Security (RLS)
-- ==========================================

-- 1. Create Documents Table (Actual Production Schema)
CREATE TABLE IF NOT EXISTS public.documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    storage_path TEXT,
    status TEXT NOT NULL DEFAULT 'completed',
    extracted_text TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Create Document Pages Table (Normalized Page Storage)
CREATE TABLE IF NOT EXISTS public.document_pages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    page_number INTEGER NOT NULL,
    extracted_text TEXT NOT NULL,
    ocr_confidence NUMERIC DEFAULT 0.95,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(document_id, page_number)
);

-- 3. Create Questions Table
CREATE TABLE IF NOT EXISTS public.questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    answer_text TEXT NOT NULL,
    answer_language TEXT NOT NULL DEFAULT 'English',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. Create Citations Table
CREATE TABLE IF NOT EXISTS public.citations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
    document_page_id UUID REFERENCES public.document_pages(id) ON DELETE CASCADE,
    supporting_passage TEXT NOT NULL,
    source_location TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indexes for fast retrieval
CREATE INDEX IF NOT EXISTS idx_documents_user ON public.documents(user_id);
CREATE INDEX IF NOT EXISTS idx_doc_pages_doc ON public.document_pages(document_id);
CREATE INDEX IF NOT EXISTS idx_questions_doc ON public.questions(document_id);
CREATE INDEX IF NOT EXISTS idx_citations_q ON public.citations(question_id);

-- Enable Row Level Security (RLS)
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.citations ENABLE ROW LEVEL SECURITY;

-- Documents RLS Policies
DROP POLICY IF EXISTS "Users can view their own documents" ON public.documents;
CREATE POLICY "Users can view their own documents"
    ON public.documents FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own documents" ON public.documents;
CREATE POLICY "Users can insert their own documents"
    ON public.documents FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own documents" ON public.documents;
CREATE POLICY "Users can update their own documents"
    ON public.documents FOR UPDATE
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own documents" ON public.documents;
CREATE POLICY "Users can delete their own documents"
    ON public.documents FOR DELETE
    USING (auth.uid() = user_id);

-- Document Pages RLS Policies
DROP POLICY IF EXISTS "Users can view pages of their documents" ON public.document_pages;
CREATE POLICY "Users can view pages of their documents"
    ON public.document_pages FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.documents d
        WHERE d.id = document_pages.document_id AND d.user_id = auth.uid()
    ));

DROP POLICY IF EXISTS "Users can insert pages for their documents" ON public.document_pages;
CREATE POLICY "Users can insert pages for their documents"
    ON public.document_pages FOR INSERT
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.documents d
        WHERE d.id = document_pages.document_id AND d.user_id = auth.uid()
    ));

-- Storage Bucket Setup Instructions:
-- 1. Ensure private bucket named 'Clario' exists in Supabase Storage.
-- 2. Restrict access using policies:
--    - INSERT: bucket_id = 'Clario' AND (storage.foldername(name))[1] = auth.uid()::text
--    - SELECT: bucket_id = 'Clario' AND (storage.foldername(name))[1] = auth.uid()::text
--    - DELETE: bucket_id = 'Clario' AND (storage.foldername(name))[1] = auth.uid()::text
`;
