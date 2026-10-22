import React, { useState } from 'react';
import { X, Copy, Check, Database, Server, Key, ShieldCheck, Terminal, FileCode2 } from 'lucide-react';
import { SUPABASE_SQL_MIGRATION, isSupabaseConfigured } from '../lib/supabase';

interface ConfigGuideModalProps {
  onClose: () => void;
}

export const ConfigGuideModal: React.FC<ConfigGuideModalProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<'supabase' | 'verbx' | 'demo_script'>('supabase');
  const [copiedSql, setCopiedSql] = useState(false);
  const [copiedEnv, setCopiedEnv] = useState(false);

  const supabaseReady = isSupabaseConfigured();

  const handleCopySql = () => {
    navigator.clipboard.writeText(SUPABASE_SQL_MIGRATION);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  const sampleEnvText = `# Clario Environment Variables (.env)
GEMINI_API_KEY="your-gemini-api-key"
APP_URL="https://your-app-domain.com"

# VerbX One Document Intelligence APIs
VERBX_API_KEY="your-verbx-api-key"
VERBX_OCR_ENDPOINT="https://api.verbx.ai/v1/ocr"
VERBX_TRANSLATION_ENDPOINT="https://api.verbx.ai/v1/translate"
VERBX_ASSISTANT_ENDPOINT="https://api.verbx.ai/v1/assistant"

# Supabase Auth & PostgreSQL
VITE_SUPABASE_URL=""
VITE_SUPABASE_ANON_KEY=""
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"`;

  const handleCopyEnv = () => {
    navigator.clipboard.writeText(sampleEnvText);
    setCopiedEnv(true);
    setTimeout(() => setCopiedEnv(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#172554]/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#E2E8F0] flex items-center justify-between bg-[#F8FAFC]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#F5F3FF] text-[#6D28D9] flex items-center justify-center">
              <Database className="w-4 h-4 stroke-[2.2]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#172554]">
                Deployment & Integration Blueprint
              </h2>
              <p className="text-xs text-[#64748B]">
                Supabase SQL migrations, VerbX One endpoints, and hackathon judge demo script.
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

        {/* Tab switchers */}
        <div className="px-6 py-2 border-b border-[#E2E8F0] bg-white flex items-center gap-2 text-xs">
          <button
            onClick={() => setActiveTab('supabase')}
            className={`px-3 py-1.5 font-medium rounded-md transition-colors cursor-pointer ${
              activeTab === 'supabase'
                ? 'bg-[#F5F3FF] text-[#6D28D9] font-semibold'
                : 'text-[#64748B] hover:text-[#172554]'
            }`}
          >
            Supabase SQL & RLS
          </button>
          <button
            onClick={() => setActiveTab('verbx')}
            className={`px-3 py-1.5 font-medium rounded-md transition-colors cursor-pointer ${
              activeTab === 'verbx'
                ? 'bg-[#F5F3FF] text-[#6D28D9] font-semibold'
                : 'text-[#64748B] hover:text-[#172554]'
            }`}
          >
            VerbX One Integration
          </button>
          <button
            onClick={() => setActiveTab('demo_script')}
            className={`px-3 py-1.5 font-medium rounded-md transition-colors cursor-pointer ${
              activeTab === 'demo_script'
                ? 'bg-[#F5F3FF] text-[#6D28D9] font-semibold'
                : 'text-[#64748B] hover:text-[#172554]'
            }`}
          >
            3-Minute Judge Script
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-[#F8FAFC]">
          {activeTab === 'supabase' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-[#E2E8F0] bg-white text-xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-[#172554] text-sm">Supabase PostgreSQL Schema & Security Rules</span>
                  <div className="flex items-center gap-2">
                    <span className={`text-[11px] font-medium ${supabaseReady ? 'text-[#15803D]' : 'text-[#D97706]'}`}>
                      Status: {supabaseReady ? 'Live Supabase Connected' : 'Demo Local Mode Active'}
                    </span>
                    <button
                      onClick={handleCopySql}
                      className="px-2.5 py-1 rounded-md bg-[#6D28D9] hover:bg-[#5B21B6] text-white text-[11px] font-medium flex items-center gap-1 cursor-pointer"
                    >
                      {copiedSql ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedSql ? 'Copied' : 'Copy SQL'}</span>
                    </button>
                  </div>
                </div>
                <p className="text-[#64748B] leading-relaxed mb-3">
                  This SQL migration creates the 4 core tables (<code>documents</code>, <code>document_pages</code>, <code>questions</code>, <code>citations</code>) and configures strict Row Level Security (RLS) policies so registered users can only access their own documents.
                </p>
                <div className="relative">
                  <pre className="p-4 rounded-lg bg-[#0F172A] text-[#F8FAFC] font-mono text-[11px] overflow-x-auto max-h-96 leading-normal">
                    {SUPABASE_SQL_MIGRATION}
                  </pre>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'verbx' && (
            <div className="space-y-4 text-xs">
              <div className="p-4 rounded-xl border border-[#E2E8F0] bg-white">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-[#172554] text-sm">VerbX One Document Intelligence Configuration</h4>
                  <button
                    onClick={handleCopyEnv}
                    className="px-2.5 py-1 rounded-md bg-[#6D28D9] hover:bg-[#5B21B6] text-white text-[11px] font-medium flex items-center gap-1 cursor-pointer"
                  >
                    {copiedEnv ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedEnv ? 'Copied' : 'Copy .env'}</span>
                  </button>
                </div>

                <p className="text-[#64748B] leading-relaxed mb-4">
                  Clario routes all scanned PDFs and Indian script OCR requests through VerbX One endpoints when credentials are provided in <code>.env</code>. All secrets remain strictly on the backend server.
                </p>

                <div className="space-y-2 mb-4">
                  <div className="p-3 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] flex justify-between items-center">
                    <div>
                      <span className="font-mono font-semibold text-[#172554]">VERBX_OCR_ENDPOINT</span>
                      <p className="text-[11px] text-[#64748B]">Document OCR & Indian script page extraction</p>
                    </div>
                    <code className="text-[11px] text-[#6D28D9] bg-white px-2 py-1 rounded-md border border-[#E2E8F0]">https://api.verbx.ai/v1/ocr</code>
                  </div>

                  <div className="p-3 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] flex justify-between items-center">
                    <div>
                      <span className="font-mono font-semibold text-[#172554]">VERBX_TRANSLATION_ENDPOINT</span>
                      <p className="text-[11px] text-[#64748B]">Bilingual answer translation retaining source grounding</p>
                    </div>
                    <code className="text-[11px] text-[#6D28D9] bg-white px-2 py-1 rounded-md border border-[#E2E8F0]">https://api.verbx.ai/v1/translate</code>
                  </div>

                  <div className="p-3 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] flex justify-between items-center">
                    <div>
                      <span className="font-mono font-semibold text-[#172554]">VERBX_ASSISTANT_ENDPOINT</span>
                      <p className="text-[11px] text-[#64748B]">Indian language document analysis</p>
                    </div>
                    <code className="text-[11px] text-[#6D28D9] bg-white px-2 py-1 rounded-md border border-[#E2E8F0]">https://api.verbx.ai/v1/assistant</code>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-[#F5F3FF] border border-[#DDD6FE] text-[#6D28D9]">
                  <strong>Graceful Fallback Mode:</strong> When VerbX API credentials are not set, Clario automatically activates its integrated server-side Gemini 3.8 Flash multimodal vision and parsing fallback so judges can evaluate all 4 test cases without interruption.
                </div>
              </div>
            </div>
          )}

          {activeTab === 'demo_script' && (
            <div className="space-y-3 text-xs">
              <div className="p-4 rounded-xl border border-[#E2E8F0] bg-white">
                <h4 className="font-semibold text-[#172554] text-sm mb-2">3-Minute Video Demo Script for Hackathon Judges</h4>
                <div className="space-y-3 text-[#64748B] leading-relaxed">
                  <div className="p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
                    <span className="font-bold text-[#172554]">0:00 - 0:30: Introduction & Splash</span>
                    <p className="mt-1">
                      Show Page 1 splash screen: "Clario: Complex Documents. Clear Answers." Explain that Clario solves the critical problem of ungrounded AI hallucinations in Indian government and legal documents. Click "Get Started". Show guest access vs Supabase authenticated login.
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
                    <span className="font-bold text-[#172554]">0:30 - 1:15: Grounded Q&A with Exact Citations (Tamil Scheme)</span>
                    <p className="mt-1">
                      Select the Tamil Nadu Health Insurance circular. Ask "What is the annual income limit?". Show the answer ("₹1,20,000 / year") and click "View Source" to reveal the exact highlighted Tamil passage on Page 1.
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
                    <span className="font-bold text-[#172554]">1:15 - 1:45: Strict Unsupported Fallback & Bilingual Answering</span>
                    <p className="mt-1">
                      Ask an unsupported question: "What is the age limit for PhD applicants?". Show that Clario outputs strictly <code>Not in the document</code> without preamble. Switch language to Hindi and demonstrate bilingual output while preserving Tamil source citations.
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
                    <span className="font-bold text-[#172554]">1:45 - 2:30: Advanced Radar & Number Verification</span>
                    <p className="mt-1">
                      Open "Compare Documents": compare PM Kisan Version A vs Version B to automatically flag the payout increase from ₹6,000 to ₹9,000 and the mandatory e-KYC requirement. Open "Verify Numbers" to audit all currency and percentage figures.
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
                    <span className="font-bold text-[#172554]">2:30 - 3:00: Hackathon Test Lab & Architecture</span>
                    <p className="mt-1">
                      Open "Test Lab" and click "Execute All 4 Test Cases". Show all 4 official tests passing with genuine assertions. Conclude on Supabase RLS security and VerbX API integration.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
