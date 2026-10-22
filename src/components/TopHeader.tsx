import {
  Menu,
  Upload,
  Globe,
  FileText,
  User,
  LogOut,
  ChevronDown,
  LogIn,
} from 'lucide-react';
import { ClarioDocument, Language } from '../types';
import { AuthUser } from '../lib/supabase';
import { WorkspaceTab } from './Sidebar';

interface TopHeaderProps {
  activeTab: WorkspaceTab;
  onOpenMobileMenu: () => void;
  selectedDocument: ClarioDocument | null;
  documents: ClarioDocument[];
  onSelectDocument: (docId: string) => void;
  answerLanguage: Language;
  onSelectLanguage: (lang: Language) => void;
  onTriggerUpload: () => void;
  isUploading: boolean;
  currentUser: AuthUser;
  onSignOut: () => void;
  onGoToAuth: () => void;
}

const SUPPORTED_LANGUAGES: Language[] = [
  'English',
  'Tamil',
  'Hindi',
  'Telugu',
  'Kannada',
  'Bengali',
  'Marathi',
  'Gujarati',
  'Malayalam',
];

export const TopHeader: React.FC<TopHeaderProps> = ({
  activeTab,
  onOpenMobileMenu,
  selectedDocument,
  documents,
  onSelectDocument,
  answerLanguage,
  onSelectLanguage,
  onTriggerUpload,
  isUploading,
  currentUser,
  onSignOut,
  onGoToAuth,
}) => {
  const getTabTitle = () => {
    switch (activeTab) {
      case 'ask':
        return 'Ask Documents';
      case 'documents':
        return 'My Documents';
      case 'compare':
        return 'Compare Documents';
      case 'verify':
        return 'Verify Numbers';
      case 'testlab':
        return 'Test Laboratory';
      default:
        return 'Workspace';
    }
  };

  return (
    <header className="h-16 border-b border-[#E2E8F0] bg-white sticky top-0 z-30 px-4 sm:px-6 flex items-center justify-between gap-4">
      {/* Left: Mobile menu button & Page Title */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onOpenMobileMenu}
          className="md:hidden p-2 rounded-lg text-[#64748B] hover:text-[#172554] hover:bg-[#F8FAFC] cursor-pointer"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="min-w-0">
          <h1 className="text-base font-bold text-[#172554] tracking-tight leading-tight truncate">
            {getTabTitle()}
          </h1>
          <p className="text-[11px] text-[#64748B] hidden sm:block">
            {activeTab === 'ask' && 'Source-grounded questions with exact page citations'}
            {activeTab === 'documents' && 'Library of indexed and processed Indian-language documents'}
            {activeTab === 'compare' && 'Radar analysis isolating changes between two circular versions'}
            {activeTab === 'verify' && 'Inspection and audit of dates, amounts, and thresholds'}
            {activeTab === 'testlab' && 'Official hackathon regression suite (TC1–TC4)'}
          </p>
        </div>
      </div>

      {/* Right: Contextual Controls */}
      <div className="flex items-center gap-2.5 sm:gap-3 text-xs shrink-0">
        {/* Active Document Selector — shown on 'ask' and 'verify' whenever documents exist */}
        {documents.length > 0 && selectedDocument && (activeTab === 'ask' || activeTab === 'verify') && (
          <div className="hidden sm:flex items-center gap-1.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-2.5 py-1.5">
            <FileText className="w-3.5 h-3.5 text-[#6D28D9] shrink-0" />
            <select
              value={selectedDocument.id}
              onChange={(e) => onSelectDocument(e.target.value)}
              className="bg-transparent text-xs font-semibold text-[#172554] focus:outline-none cursor-pointer max-w-[160px] lg:max-w-[220px] truncate"
            >
              {documents.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.title} ({doc.language})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Answer Language dropdown — shown on 'ask' */}
        {activeTab === 'ask' && (
          <div className="flex items-center gap-1.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-2.5 py-1.5">
            <Globe className="w-3.5 h-3.5 text-[#64748B] shrink-0" />
            <span className="text-[11px] text-[#64748B] hidden md:inline">Language:</span>
            <select
              value={answerLanguage}
              onChange={(e) => onSelectLanguage(e.target.value as Language)}
              className="bg-transparent text-xs font-semibold text-[#6D28D9] focus:outline-none cursor-pointer"
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang} value={lang}>
                  {lang}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Upload PDF */}
        {(activeTab === 'ask' || activeTab === 'documents' || activeTab === 'compare' || activeTab === 'verify') && (
          <button
            onClick={onTriggerUpload}
            disabled={isUploading}
            className="px-3 py-1.5 rounded-lg bg-[#6D28D9] hover:bg-[#5B21B6] disabled:opacity-60 text-white font-medium text-xs transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
          >
            {isUploading ? (
              <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Upload className="w-3.5 h-3.5" />
            )}
            <span className="hidden sm:inline">Upload PDF</span>
          </button>
        )}

        {/* Sign In button for guests */}
        {currentUser.isGuest && (
          <button
            onClick={onGoToAuth}
            className="px-3 py-1.5 rounded-lg bg-white hover:bg-[#F8FAFC] text-[#6D28D9] border border-[#6D28D9] font-medium text-xs transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
            title="Sign In to Save Documents"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Sign In</span>
          </button>
        )}

        {/* User Avatar circle */}
        <div className="flex items-center gap-1.5 pl-2 border-l border-[#E2E8F0]">
          {currentUser.isGuest ? (
            <button
              onClick={onGoToAuth}
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold bg-[#FFFBEB] text-[#D97706] border border-[#FEF3C7] hover:bg-[#FEF3C7] transition-colors cursor-pointer"
              title="Guest Mode — Click to Sign In"
            >
              G
            </button>
          ) : (
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold bg-[#6D28D9] text-white"
              title={currentUser.email}
            >
              {currentUser.email.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
