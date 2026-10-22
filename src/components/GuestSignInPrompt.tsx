import React from 'react';
import { Lock, LogIn, CheckCircle2, Shield } from 'lucide-react';

interface GuestSignInPromptProps {
  title?: string;
  description?: string;
  featureName?: string;
  onSignIn: () => void;
}

export const GuestSignInPrompt: React.FC<GuestSignInPromptProps> = ({
  title,
  description,
  featureName = 'this feature',
  onSignIn,
}) => {
  return (
    <div className="max-w-2xl mx-auto my-8 animate-in fade-in-50 duration-200">
      <div className="bg-white border border-[#E2E8F0] rounded-2xl p-8 sm:p-10 shadow-xs text-center">
        {/* Violet Lock Icon */}
        <div className="w-16 h-16 rounded-2xl bg-[#F5F3FF] text-[#6D28D9] border border-[#EDE9FE] flex items-center justify-center mx-auto mb-6 shadow-xs">
          <Lock className="w-8 h-8 stroke-[2]" />
        </div>

        {/* Heading */}
        <h2 className="text-xl font-bold text-[#172554] tracking-tight mb-2">
          {title || `Sign In to Access ${featureName}`}
        </h2>

        {/* Description */}
        <p className="text-xs sm:text-sm text-[#64748B] max-w-lg mx-auto mb-8 leading-relaxed">
          {description ||
            `Document uploads, stored document libraries, grounded question answering, comparison, and number verification are reserved for authenticated accounts. Sign in to your Clario account to get started.`}
        </p>

        {/* Primary Sign In Button */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-8">
          <button
            onClick={onSignIn}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#6D28D9] hover:bg-[#5B21B6] text-white text-xs sm:text-sm font-semibold transition-colors shadow-xs cursor-pointer flex items-center justify-center gap-2"
          >
            <LogIn className="w-4 h-4" />
            <span>Sign In to Clario</span>
          </button>
        </div>

        {/* Three Value Props */}
        <div className="pt-6 border-t border-[#F1F5F9] grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-[#15803D] shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-[#172554]">Private Storage</p>
              <p className="text-[11px] text-[#64748B]">Saved to your secure Supabase Storage bucket</p>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <Shield className="w-4 h-4 text-[#15803D] shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-[#172554]">Row-Level Security</p>
              <p className="text-[11px] text-[#64748B]">Enforced document ownership and user privacy</p>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-[#15803D] shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-[#172554]">Grounded Q&A</p>
              <p className="text-[11px] text-[#64748B]">Exact page citations and number verification</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
