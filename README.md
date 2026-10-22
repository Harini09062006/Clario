# ✨ CLARIO
### Complex Documents. Clear Answers.

**Turning complex PDFs into accessible, evidence-backed knowledge.**

Built with purpose by **Team Innovatrix — Harini R & Vaishnavi S**

<p align="center">
  <strong>Understand less text. Discover more meaning. Verify every answer.</strong>
</p>

<p align="center">
  <a href="https://clario-navy.vercel.app">🚀 Live Demo</a> ·
  <a href="https://github.com/Harini09062006/Clario">💻 Source Code</a>
</p>

---

## 💡 The Big Idea

What if asking questions about a 100-page document were as simple as having a conversation?

Important information is often buried inside lengthy PDFs, government documents, research papers, policy reports, and multilingual resources. Finding one specific answer can mean hours of searching, reading, translating, and cross-checking.

Traditional document viewers show pages. General-purpose chatbots can produce answers without clearly proving where those answers came from.

**Clario aims to bridge that gap by transforming static documents into interactive, evidence-oriented knowledge sources.**

Upload a document. Ask a question. Discover the supporting information. Verify the answer against the source.

## 🎯 The Problem We Solve

Users need more than a summary. They need trustworthy answers to specific questions about the documents they already have.

- **Information overload:** Important facts are hidden in lengthy documents.
- **Language barriers:** Documents may contain unfamiliar terminology or Indian languages.
- **Unverifiable answers:** AI-generated responses can sound convincing without sufficient evidence.
- **Time-consuming research:** Manually finding and comparing information slows decision-making.
- **Missing information:** Users need to know when a document does not contain the answer.

## 🚀 Our Solution: Clario

Clario is an AI-powered PDF document intelligence platform designed to make document exploration conversational, accessible, and verifiable.

Instead of forcing users to search page by page, Clario aims to help them ask natural-language questions and discover answers grounded in the uploaded document.

### What makes Clario different?

**Evidence before confidence.**

Clario is designed to prioritize source-supported answers, provide page or passage references where available, and acknowledge when evidence is missing instead of inventing facts.

The objective is not simply to generate more text. It is to help users understand what a document actually says.

## ⭐ Key Features

### 📄 Conversational PDF Intelligence
Interact with document contents through natural-language questions rather than manually scanning every page.

### 🔎 Evidence-Oriented Answers
Connect answers to relevant document passages and page references where supported by the processing pipeline.

### 🛡️ Responsible AI
Design the answering workflow to distinguish supported information from missing evidence and reduce unsupported assumptions.

### 🌐 Multilingual Accessibility
Build toward document workflows involving Indian languages, with language and translation capabilities dependent on supported services.

### 🎙️ Voice-Enabled Interaction
Integrate speech and audio services where configured and verified, helping make document interaction more accessible.

### 🔐 Secure Document Management
Use Supabase authentication, PostgreSQL metadata, private Storage, and access controls to support user-specific document workflows.

### 👤 Flexible Access
Provide account-based workflows and a guest experience for exploring the application, with guest documents potentially temporary.

*These capabilities describe the intended product functionality. Individual production features must be validated against the live deployment and configured services.*

## 🧠 How Clario Works

```text
         USER UPLOADS A PDF
                  |
                  v
       DOCUMENT PROCESSING
                  |
                  v
       TEXT AND EVIDENCE
           EXTRACTION
                  |
                  v
        USER ASKS A QUESTION
                  |
                  v
       RETRIEVE RELEVANT
        DOCUMENT EVIDENCE
                  |
                  v
       AI-ASSISTED ANSWERING
                  |
                  v
       ANSWER + SOURCE
       REFERENCES, WHEN
          AVAILABLE
                  |
                  v
        USER VERIFIES THE
             EVIDENCE
```

The system combines a web interface, document-processing workflow, AI services, and persistence infrastructure. Actual behavior depends on the configured backend and successful execution of each processing stage.

## 🏗️ Technical Architecture

Clario brings together modern web development, AI-assisted reasoning, document processing, and cloud infrastructure.

| Layer | Technology | Responsibility |
|---|---|---|
| Frontend | React + TypeScript | Interactive document experience |
| Build tooling | Vite | Development and production builds |
| Styling | Tailwind CSS | Responsive interface styling |
| AI reasoning | Google Gemini | AI-assisted question answering |
| Authentication | Supabase Auth | Account and session management |
| Database | Supabase PostgreSQL | Document metadata and application data |
| File storage | Supabase Storage | PDF storage |
| Language services | VerbX APIs | Supported document and language operations |
| Version control | Git + GitHub | Source management |
| Deployment | Vercel | Web application hosting |

The production backend must run on a compatible hosting environment and expose working API routes for document processing. Frontend deployment alone does not guarantee that backend integrations are operational.

## 🔬 Our Responsible AI Approach

We believe an answer is more useful when users can understand why it was produced.

Clario is designed around four principles:

1. **Grounding:** Use evidence from the uploaded document to support answers.
2. **Traceability:** Provide page or passage references where available.
3. **Honesty:** Clearly communicate when the available document does not support an answer.
4. **Privacy:** Protect documents and credentials through appropriate access controls and server-side secret management.

These are design goals, not a claim of perfect accuracy. The implementation must be tested against real documents and difficult questions.

## 🧪 Evaluation: Proving What Works

A strong document intelligence system must be evaluated on more than whether it produces a fluent answer.

Our validation plan includes:

| Test area | What we evaluate |
|---|---|
| Answer grounding | Is the answer supported by the document? |
| Citation quality | Does the cited page or passage support the claim? |
| Missing information | Does the system avoid inventing absent facts? |
| Numerical accuracy | Are figures and calculations consistent with the source? |
| Multilingual behavior | Does the selected language match the requested output? |
| PDF processing | Can supported PDFs be uploaded and processed reliably? |
| Persistence | Do saved documents remain associated with the correct user? |
| Security | Are private files and credentials appropriately protected? |
| Failure handling | Are unavailable services reported safely and clearly? |

**We report actual test outcomes rather than presenting proposed targets as achieved results.** Tests that cannot run because an external service is unavailable should be marked as blocked until they can be completed.

## 🛠️ Technology and Setup

### Prerequisites
- Node.js and npm
- A Supabase project
- Google Gemini API credentials for Gemini-powered features
- VerbX credentials for integrations that require them

### Run locally

```bash
git clone https://github.com/Harini09062006/Clario.git
cd Clario
npm install
```

Create a local `.env` file based on `.env.example` and configure the environment variables required by the implementation.

For the Vite frontend, the Supabase configuration may include:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLIC_CLIENT_KEY
```

Use the exact variable names expected by the code. The public client key may use the modern `sb_publishable_` format or a supported legacy anon key.

Start the development server using the repository's configured scripts:

```bash
npm run dev
```

Validate the code:

```bash
npm run lint
npm run build
```

Some backend or external-service functionality may require additional configuration and a separate process. Consult the project files for the actual runtime requirements.

### Security essentials

- Never commit `.env` or private credentials.
- Never expose Supabase Secret or service-role keys through frontend variables.
- Keep backend secrets on the server.
- Maintain appropriate Row Level Security policies.
- Keep private document storage private.

## 🗺️ Roadmap

Our next priorities are focused on trust, reliability, and accessibility:

- Improve PDF extraction and document retrieval.
- Strengthen page-level citations and evidence verification.
- Improve handling of tables, scanned PDFs, and Indian-language content.
- Validate speech and translation behavior across supported languages.
- Improve production API reliability and processing error reporting.
- Expand automated tests for privacy and document persistence.
- Optimize performance for larger documents.

## 👥 Meet Team Innovatrix

**Harini R** · **Vaishnavi S**

We are building Clario around a simple belief: information becomes more valuable when people can access it, understand it, and verify it.

Our focus is on making complex document workflows more approachable through thoughtful engineering and responsible AI.

## 🌟 Our Vision

We envision a future where understanding a complex document does not require hours of manual searching or specialized expertise.

From research and policies to educational resources and public information, Clario aims to help people move from **reading everything** to **finding what matters—with evidence**.

---

<p align="center">
  <strong>CLARIO</strong><br>
  Complex Documents. Clear Answers.<br><br>
  <em>Built with purpose by Team Innovatrix</em><br>
  Harini R · Vaishnavi S
</p>
