import React from 'react';
import { FileCheck, ArrowRight, Globe, ShieldCheck, GitCompare, LogOut } from 'lucide-react';
import { AuthUser } from '../lib/supabase';

interface SplashScreenProps {
  onGetStarted: () => void;
  currentUser: AuthUser | null;
  onContinueToApp: () => void;
  onSignOut: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({
  onGetStarted,
  currentUser,
  onContinueToApp,
  onSignOut,
}) => {
  return (
    <div className="min-h-screen bg-white text-[#172554] flex flex-col justify-between selection:bg-[#F5F3FF] selection:text-[#6D28D9]">
      {/* Top Header */}
      <header className="w-full max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#6D28D9] flex items-center justify-center text-white shadow-xs">
            <FileCheck className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-xl tracking-tight text-[#172554]">Clario</span>
            <span className="text-[11px] text-[#64748B] hidden sm:inline">Complex Documents. Clear Answers.</span>
          </div>
        </div>

        {currentUser && (
          <div className="flex items-center gap-3 text-xs text-[#64748B] bg-[#F8FAFC] border border-[#E2E8F0] px-3.5 py-1.5 rounded-lg">
            <span>Signed in as <strong className="text-[#172554]">{currentUser.email}</strong></span>
            <span aria-hidden="true" className="text-[#CBD5E1]">·</span>
            <button
              onClick={onContinueToApp}
              className="text-[#6D28D9] font-semibold hover:underline cursor-pointer"
            >
              Open Workspace
            </button>
            <span aria-hidden="true" className="text-[#CBD5E1]">·</span>
            <button
              onClick={onSignOut}
              className="hover:text-[#DC2626] transition-colors cursor-pointer flex items-center gap-1"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
        )}
      </header>

      {/* Hero Section */}
      <main className="w-full max-w-4xl mx-auto px-6 py-12 flex flex-col items-center text-center my-auto">
        {/* Brand Icon */}
        <div className="w-16 h-16 rounded-2xl bg-[#F5F3FF] border border-[#E2E8F0] flex items-center justify-center text-[#6D28D9] mb-6 shadow-xs">
          <FileCheck className="w-9 h-9 stroke-[2.2]" />
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-[#172554] mb-3">
          Clario
        </h1>

        <p className="text-xl sm:text-2xl font-semibold text-[#6D28D9] tracking-tight mb-4">
          Complex Documents. Clear Answers.
        </p>

        <p className="text-base sm:text-lg text-[#64748B] max-w-2xl leading-relaxed mb-10">
          Understand Indian-language documents, find precise answers, and verify every answer against its original source.
        </p>

        {/* Three Capability Highlights */}
        <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-4 mb-10 text-left">
          <div className="p-5 rounded-xl border border-[#E2E8F0] bg-white hover:border-[#6D28D9]/40 hover:shadow-xs transition-all">
            <div className="w-9 h-9 rounded-lg bg-[#F5F3FF] text-[#6D28D9] flex items-center justify-center mb-3">
              <Globe className="w-5 h-5 stroke-[2]" />
            </div>
            <h3 className="font-semibold text-sm text-[#172554] mb-1.5">
              Indian-Language Understanding
            </h3>
            <p className="text-xs text-[#64748B] leading-relaxed">
              Native comprehension of Tamil, Hindi, and Indian scripts with multi-page OCR and scanned table parsing.
            </p>
          </div>

          <div className="p-5 rounded-xl border border-[#E2E8F0] bg-white hover:border-[#6D28D9]/40 hover:shadow-xs transition-all">
            <div className="w-9 h-9 rounded-lg bg-[#F5F3FF] text-[#6D28D9] flex items-center justify-center mb-3">
              <ShieldCheck className="w-5 h-5 stroke-[2]" />
            </div>
            <h3 className="font-semibold text-sm text-[#172554] mb-1.5">
              Answers With Exact Citations
            </h3>
            <p className="text-xs text-[#64748B] leading-relaxed">
              Every fact cites exact page numbers and reproduces verbatim source passages. Zero speculation.
            </p>
          </div>

          <div className="p-5 rounded-xl border border-[#E2E8F0] bg-white hover:border-[#6D28D9]/40 hover:shadow-xs transition-all">
            <div className="w-9 h-9 rounded-lg bg-[#F5F3FF] text-[#6D28D9] flex items-center justify-center mb-3">
              <GitCompare className="w-5 h-5 stroke-[2]" />
            </div>
            <h3 className="font-semibold text-sm text-[#172554] mb-1.5">
              Document Change & Number Verification
            </h3>
            <p className="text-xs text-[#64748B] leading-relaxed">
              Compare circular versions side-by-side and audit critical dates, amounts, and eligibility thresholds.
            </p>
          </div>
        </div>

        {/* Primary CTA */}
        {currentUser ? (
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <button
              onClick={onContinueToApp}
              className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl bg-[#6D28D9] hover:bg-[#5B21B6] text-white font-medium text-sm transition-all shadow-xs cursor-pointer group"
            >
              <span>Continue to Workspace</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </button>
            <button
              onClick={onGetStarted}
              className="px-5 py-3.5 rounded-xl border border-[#E2E8F0] hover:bg-[#F8FAFC] text-[#64748B] hover:text-[#172554] font-medium text-sm transition-colors cursor-pointer"
            >
              Switch Account
            </button>
          </div>
        ) : (
          <button
            onClick={onGetStarted}
            className="inline-flex items-center justify-center gap-2 px-9 py-3.5 rounded-xl bg-[#6D28D9] hover:bg-[#5B21B6] text-white font-medium text-sm transition-all shadow-xs cursor-pointer group"
          >
            <span>Get Started</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </button>
        )}
      </main>

      {/* Footer */}
      <footer className="w-full max-w-6xl mx-auto px-6 py-6 border-t border-[#E2E8F0] flex flex-col sm:flex-row items-center justify-between text-xs text-[#64748B] gap-2">
        <p>AI-powered document understanding with source-grounded answers.</p>
        <div className="flex items-center gap-4">
          <span>Ziro Agentic AI Hackathon 2026</span>
          <span aria-hidden="true" className="text-[#CBD5E1]">·</span>
          <span>VerbX Document Intelligence</span>
        </div>
      </footer>
    </div>
  );
};
