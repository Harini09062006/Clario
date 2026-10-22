# Clario — Complex Documents. Clear Answers.
### Indian-Language Document Intelligence Agent | Ziro Agentic AI Hackathon 2026

Clario is an AI document intelligence agent that understands Indian-language documents (Tamil, Hindi, English, and more), answers user queries with strict document grounding, cites exact page numbers and verbatim passages, and detects circular discrepancies and numerical inaccuracies.

---

## 🌟 Key Features

1. **Strict Document Grounding & Fallback**
   - Answers exclusively from retrieved page evidence.
   - **Mandatory Fallback:** If a requested fact is absent, returns strictly `Not in the document` with zero speculation or hallucination.

2. **Indian-Language Multi-Page Understanding**
   - Direct support for Tamil, Hindi, and Indian scripts.
   - Preserves page boundaries and records OCR confidence.

3. **Verbatim Passage & Exact Page Citations**
   - Every answer cites the exact page number and reproduces the verbatim source passage.
   - Built-in original page viewer to inspect source evidence.

4. **Document Change & Conflict Radar (Feature One)**
   - Compares two circular versions (e.g., Version A vs Version B) across deadlines, amounts, eligibility rules, and required documents.

5. **Critical Number & Metric Verification (Feature Two)**
   - Scans and cross-checks dates, currency amounts (₹ / ரூ.), percentages, and land thresholds against page text.

6. **Official Hackathon Test Lab**
   - One-click regression runner for the 4 official benchmarks:
     - **TC1:** Grounded answer with exact citation.
     - **TC2:** Scanned table & numerical value extraction.
     - **TC3:** Strict fallback for unsupported questions (`Not in the document`).
     - **TC4:** Bilingual answering in Hindi from a Tamil circular while preserving source citations.

7. **Supabase Authentication & Row-Level Security (RLS)**
   - Supports persistent user accounts and private document history.
   - Temporary isolated sessions for guest access without mandatory registration.

---

## 🚀 3-Page User Journey

1. **Page 1 — Splash Screen**
   - Clean, minimal introduction highlighting Indian-language understanding, citations, and number verification.
   - Primary "Get Started" call-to-action.
2. **Page 2 — Login, Registration or Guest Access**
   - Choice A: Real Supabase Sign In / Create Account with password reset.
   - Choice B: Continue as Guest for instant testing.
3. **Page 3 — Main Clario Application Workspace**
   - Two-column layout: document library on the left, grounded Q&A workspace on the right.
   - Quick suggested question chips, language switcher, original page viewer, and tools menu.

---

## 🛠️ Environment Configuration (`.env`)

```env
# Gemini AI
GEMINI_API_KEY="your-gemini-api-key"

# VerbX One Document Intelligence APIs
VERBX_API_KEY="your-verbx-api-key"
VERBX_OCR_ENDPOINT="https://api.verbx.ai/v1/ocr"
VERBX_TRANSLATION_ENDPOINT="https://api.verbx.ai/v1/translate"
VERBX_ASSISTANT_ENDPOINT="https://api.verbx.ai/v1/assistant"

# Supabase Auth & PostgreSQL
VITE_SUPABASE_URL="https://your-project.supabase.co"
VITE_SUPABASE_ANON_KEY="your-supabase-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-supabase-service-role-key"
```

> **Note on Provider Fallbacks:** If VerbX API credentials are not yet provisioned, Clario automatically activates its server-side multimodal Gemini 3.8 Flash engine and page-level indexer so evaluation proceeds seamlessly without mock data or broken APIs.

---

## 🗄️ Supabase Database Schema & RLS

Execute this script in the Supabase SQL Editor:

```sql
-- 1. Documents Table
CREATE TABLE IF NOT EXISTS public.documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    title TEXT NOT NULL,
    storage_path TEXT,
    language TEXT NOT NULL DEFAULT 'English',
    page_count INTEGER NOT NULL DEFAULT 1,
    processing_status TEXT NOT NULL CHECK (processing_status IN ('uploading', 'processing', 'completed', 'failed')),
    summary TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Document Pages Table
CREATE TABLE IF NOT EXISTS public.document_pages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    page_number INTEGER NOT NULL,
    extracted_text TEXT NOT NULL,
    ocr_confidence NUMERIC,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(document_id, page_number)
);

-- 3. Questions Table
CREATE TABLE IF NOT EXISTS public.questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    answer_text TEXT NOT NULL,
    answer_language TEXT NOT NULL DEFAULT 'English',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. Citations Table
CREATE TABLE IF NOT EXISTS public.citations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
    document_page_id UUID NOT NULL REFERENCES public.document_pages(id) ON DELETE CASCADE,
    supporting_passage TEXT NOT NULL,
    source_location TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Enable RLS
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.citations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own documents" ON public.documents FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own documents" ON public.documents FOR INSERT WITH CHECK (auth.uid() = user_id);
```

---

## 🏃 Running the Application

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

Visit `http://localhost:3000` to interact with Clario.
