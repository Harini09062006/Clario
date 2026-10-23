import React from 'react';
import {
  FileCheck,
  MessageSquareQuote,
  Files,
  GitCompare,
  Hash,
  FlaskConical,
  Settings,
  LogOut,
  User,
  PanelLeftClose,
  PanelLeftOpen,
  X,
  LogIn,
  ShieldAlert,
  Network,
  Sliders,
} from 'lucide-react';
import { AuthUser } from '../lib/supabase';

export type WorkspaceTab =
  | 'ask'
  | 'documents'
  | 'compare'
  | 'verify'
  | 'contradictions'
  | 'evidence_graph'
  | 'decision_simulator'
  | 'testlab';

interface SidebarProps {
  activeTab: WorkspaceTab;
  onSelectTab: (tab: WorkspaceTab) => void;
  currentUser: AuthUser;
  onSignOut: () => void;
  onGoToAuth: () => void;
  onOpenSettings: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  currentUser,
  onSignOut,
  onGoToAuth,
  onOpenSettings,
  isCollapsed,
  onToggleCollapse,
  isMobileOpen,
  onCloseMobile,
}) => {
  const navItems = [
    {
      id: 'ask' as WorkspaceTab,
      label: 'Ask Documents',
      icon: MessageSquareQuote,
    },
    {
      id: 'documents' as WorkspaceTab,
      label: 'My Documents',
      icon: Files,
    },
    {
      id: 'compare' as WorkspaceTab,
      label: 'Compare Documents',
      icon: GitCompare,
    },
    {
      id: 'verify' as WorkspaceTab,
      label: 'Verify Numbers',
      icon: Hash,
    },
    {
      id: 'contradictions' as WorkspaceTab,
      label: 'Contradiction Radar',
      icon: ShieldAlert,
    },
    {
      id: 'evidence_graph' as WorkspaceTab,
      label: 'Evidence Graph',
      icon: Network,
    },
    {
      id: 'decision_simulator' as WorkspaceTab,
      label: 'Decision Simulator',
      icon: Sliders,
    },
    {
      id: 'testlab' as WorkspaceTab,
      label: 'Test Lab',
      icon: FlaskConical,
    },
  ];

  const handleNavClick = (tab: WorkspaceTab) => {
    onSelectTab(tab);
    onCloseMobile();
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-[#172554]/40 backdrop-blur-xs md:hidden"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed md:sticky top-0 left-0 z-50 h-screen bg-white border-r border-[#E2E8F0] flex flex-col justify-between transition-all duration-200 select-none ${
          isMobileOpen ? 'translate-x-0 w-64' : '-translate-x-full md:translate-x-0'
        } ${isCollapsed ? 'md:w-16' : 'md:w-64'}`}
      >
        {/* Top Header */}
        <div className="h-16 px-4 border-b border-[#E2E8F0] flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-[#6D28D9] text-white flex items-center justify-center shrink-0 shadow-xs">
              <FileCheck className="w-4 h-4 stroke-[2.2]" />
            </div>

            {!isCollapsed && (
              <div className="min-w-0 flex flex-col">
                <span className="font-bold text-base text-[#172554] tracking-tight leading-tight">
                  Clario
                </span>
                <span className="text-[10px] text-[#64748B] truncate">
                  Complex Documents. Clear Answers.
                </span>
              </div>
            )}
          </div>

          {/* Desktop collapse toggle / Mobile close */}
          <div className="flex items-center">
            <button
              onClick={onToggleCollapse}
              className="hidden md:flex p-1.5 rounded-lg text-[#64748B] hover:text-[#172554] hover:bg-[#F8FAFC] transition-colors cursor-pointer"
              title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            >
              {isCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
            </button>

            <button
              onClick={onCloseMobile}
              className="md:hidden p-1.5 rounded-lg text-[#64748B] hover:text-[#172554] hover:bg-[#F8FAFC] cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Primary Navigation */}
        <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-[#F5F3FF] text-[#6D28D9]'
                    : 'text-[#64748B] hover:text-[#172554] hover:bg-[#F8FAFC]'
                }`}
                title={isCollapsed ? item.label : undefined}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    isActive ? 'text-[#6D28D9]' : 'text-[#64748B]'
                  }`}
                />
                {!isCollapsed && (
                  <span className="truncate">{item.label}</span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-[#E2E8F0] space-y-2 bg-[#F8FAFC]/50">
          {/* Settings & Blueprint link */}
          <button
            onClick={onOpenSettings}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-[#64748B] hover:text-[#172554] hover:bg-white transition-colors cursor-pointer ${
              isCollapsed ? 'justify-center' : ''
            }`}
            title="Settings & System Blueprint"
          >
            <Settings className="w-4 h-4 shrink-0 text-[#64748B]" />
            {!isCollapsed && <span>Settings & Blueprint</span>}
          </button>

          {/* User profile or Guest indicator */}
          <div className="pt-2 border-t border-[#E2E8F0]">
            {currentUser.isGuest ? (
              <div className={`${isCollapsed ? 'flex justify-center' : 'space-y-2'}`}>
                {!isCollapsed && (
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-[#D97706] bg-[#FFFBEB] px-2 py-0.5 rounded border border-[#FEF3C7]">
                      Guest Mode
                    </span>
                    <button
                      onClick={onGoToAuth}
                      className="text-[11px] text-[#6D28D9] font-medium hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <LogIn className="w-3 h-3" />
                      <span>Sign In</span>
                    </button>
                  </div>
                )}
                {isCollapsed && (
                  <button
                    onClick={onGoToAuth}
                    title="Guest Mode — Click to Sign In"
                    className="p-2 rounded-lg bg-[#FFFBEB] text-[#D97706] hover:bg-[#FEF3C7] transition-colors cursor-pointer"
                  >
                    <User className="w-4 h-4" />
                  </button>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <div className={`flex items-center gap-2 min-w-0 ${isCollapsed ? 'justify-center w-full' : ''}`}>
                  <div className="w-7 h-7 rounded-full bg-[#6D28D9] text-white flex items-center justify-center font-bold text-xs shrink-0">
                    {currentUser.email.charAt(0).toUpperCase()}
                  </div>

                  {!isCollapsed && (
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-[#172554] truncate">
                        {currentUser.email}
                      </p>
                      <p className="text-[10px] text-[#15803D]">
                        Account Active
                      </p>
                    </div>
                  )}
                </div>

                {!isCollapsed && (
                  <button
                    onClick={onSignOut}
                    className="p-1.5 text-[#64748B] hover:text-[#DC2626] hover:bg-[#FEF2F2] rounded-md transition-colors cursor-pointer shrink-0"
                    title="Log Out"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
};
