import React, { useState } from 'react';
import {
  FileCheck,
  ArrowLeft,
  Eye,
  EyeOff,
  Lock,
  Mail,
  UserCheck,
  AlertCircle,
  CheckCircle2,
  Shield,
  ArrowRight,
} from 'lucide-react';
import { supabase, isSupabaseConfigured, AuthUser, createGuestSession, setStoredDemoUser } from '../lib/supabase';

interface AuthScreenProps {
  onBack: () => void;
  onAuthenticated: (user: AuthUser) => void;
  onContinueAsGuest: () => void;
  onOpenConfigGuide?: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  onBack,
  onAuthenticated,
  onContinueAsGuest,
  onOpenConfigGuide,
}) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [forgotPasswordMode, setForgotPasswordMode] = useState(false);

  const supabaseReady = isSupabaseConfigured();
  console.log('[AuthScreen] Supabase ready:', supabaseReady);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!email || !email.includes('@')) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    if (!forgotPasswordMode && (!password || password.length < 6)) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);

    try {
      if (forgotPasswordMode) {
        if (supabaseReady && supabase) {
          const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin,
          });
          if (error) throw error;
          setSuccessMsg('Password reset instructions have been sent to your email.');
        } else {
          setSuccessMsg('Password reset link sent (Simulated demo mode).');
        }
        setLoading(false);
      }





      if (isSignUp) {
        if (supabaseReady && supabase) {
          const { data, error } = await supabase.auth.signUp({
            email,
            password,
          });

          if (error) {
            const errorMsgLower = (error.message || '').toLowerCase();
            // If the user is already registered in Supabase
            if (
              errorMsgLower.includes('already registered') ||
              errorMsgLower.includes('already exists') ||
              error.status === 422 ||
              (error as any).code === 'user_already_exists'
            ) {
              // Attempt to sign in directly with the provided credentials
              const signInRes = await supabase.auth.signInWithPassword({
                email,
                password,
              });

              if (!signInRes.error && signInRes.data.user) {
                onAuthenticated({
                  id: signInRes.data.user.id,
                  email: signInRes.data.user.email || email,
                  isGuest: false,
                });
                return;
              }

              // If password was incorrect or requires explicit sign in
              setIsSignUp(false);
              setErrorMsg('An account with this email is already registered. Please sign in with your password.');
              return;
            }
            throw error;
          }

          if (data.session && data.user?.id) {
            onAuthenticated({
              id: data.user.id,
              email: data.user.email || email,
              isGuest: false,
            });
          } else if (data.session && !data.user?.id) {
            setErrorMsg('Authentication succeeded but user ID missing. Please try signing in again.');
          } else {
            setSuccessMsg('Account created! Please check your email to confirm registration or sign in.');
          }
        
        } else {
          const simulatedUser: AuthUser = {
            id: `usr_demo_${Date.now()}`,
            email,
            isGuest: false,
          };
          setStoredDemoUser(simulatedUser);
          setSuccessMsg('Registered account created successfully (Demo Mode). Redirecting...');
          setTimeout(() => onAuthenticated(simulatedUser), 500);
        }
      } else {
        // Sign In
        if (supabaseReady && supabase) {
          const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
          });
          if (error) throw error;

          if (data.user) {
            onAuthenticated({
              id: data.user.id,
              email: data.user.email || email,
              isGuest: false,
            });
          }
        } else {
          const simulatedUser: AuthUser = {
            id: `usr_${btoa(email).substring(0, 8)}`,
            email,
            isGuest: false,
          };
          setStoredDemoUser(simulatedUser);
          onAuthenticated(simulatedUser);
        }
      }
    } catch (err: any) {
      const msg = err?.message || 'Authentication failed. Please check your credentials.';
      const msgLower = msg.toLowerCase();

      if (msgLower.includes('already registered') || msgLower.includes('already exists')) {
        setIsSignUp(false);
        setErrorMsg('An account with this email is already registered. Please sign in with your password.');
      } else if (msgLower.includes('invalid login credentials') || msgLower.includes('invalid credentials')) {
        setErrorMsg('Invalid email or password. Please verify your details or use Forgot Password.');
      } else if (msgLower.includes('email not confirmed')) {
        setErrorMsg('Please check your email and click the confirmation link before signing in.');
      } else {
        setErrorMsg(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  // Google OAuth sign‑in handler
  const handleGoogleSignIn = async () => {
    if (!supabaseReady || !supabase) {
      setErrorMsg('Supabase not configured.');
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      });
      if (error) throw error;
      if (data?.url) {
        console.log('[AuthScreen] Redirecting to Google OAuth URL');
        window.location.href = data.url;
      }
    } catch (err: any) {
      console.error('[AuthScreen] Google sign‑in error:', err);
      setErrorMsg(err?.message || 'Google sign‑in failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemoLogin = () => {
    const demoUser: AuthUser = {
      id: 'demo-registered-judge-2026',
      email: 'judge@hackathon.clario',
      isGuest: false,
    };
    setStoredDemoUser(demoUser);
    onAuthenticated(demoUser);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#172554] flex flex-col justify-between selection:bg-[#F5F3FF] selection:text-[#6D28D9]">
      {/* Top minimal bar */}
      <header className="w-full max-w-4xl mx-auto px-6 py-6 flex items-center justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs text-[#64748B] hover:text-[#172554] transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Home</span>
        </button>

        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#6D28D9] flex items-center justify-center text-white shadow-xs">
            <FileCheck className="w-4 h-4 stroke-[2.2]" />
          </div>
          <span className="font-bold text-base text-[#172554]">Clario</span>
        </div>
      </header>

      {/* Main card */}
      <main className="w-full max-w-md mx-auto px-6 py-8 my-auto">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold tracking-tight text-[#172554] mb-1">
            Welcome to Clario
          </h2>
          <p className="text-xs text-[#64748B]">
            Choose how you'd like to continue.
          </p>
        </div>

        {/* Primary Auth Card */}
        <div className="p-6 rounded-2xl border border-[#E2E8F0] bg-white shadow-xs mb-4">
          {/* Segmented Auth Selector */}
          {!forgotPasswordMode && (
            <div className="flex items-center p-1 bg-[#F1F5F9] rounded-lg mb-5">
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(false);
                  setErrorMsg(null);
                }}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  !isSignUp
                    ? 'bg-white text-[#172554] shadow-xs'
                    : 'text-[#64748B] hover:text-[#172554]'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(true);
                  setErrorMsg(null);
                }}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  isSignUp
                    ? 'bg-white text-[#172554] shadow-xs'
                    : 'text-[#64748B] hover:text-[#172554]'
                }`}
              >
                Create Account
              </button>
            </div>
          )}

          {forgotPasswordMode && (
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-[#E2E8F0]">
              <span className="text-xs font-semibold text-[#6D28D9]">Reset Password</span>
              <button
                type="button"
                onClick={() => setForgotPasswordMode(false)}
                className="text-xs text-[#64748B] hover:text-[#172554] cursor-pointer"
              >
                Cancel
              </button>
            </div>
          )}

          {errorMsg && (
            <div className="mb-4 p-3 rounded-lg bg-[#FEF2F2] border border-[#FEE2E2] flex items-start gap-2.5 text-xs text-[#DC2626]">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-4 p-3 rounded-lg bg-[#F0FDF4] border border-[#DCFCE7] flex items-start gap-2.5 text-xs text-[#15803D]">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleAuthSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-medium text-[#172554] mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-2.5 text-[#94A3B8]" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@domain.com"
                  required
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-[#E2E8F0] focus:outline-none focus:border-[#6D28D9] focus:ring-1 focus:ring-[#6D28D9] text-[#172554] bg-[#FFFFFF]"
                />
              </div>
            </div>

            {!forgotPasswordMode && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-[#172554]">
                    Password
                  </label>
                  {!isSignUp && (
                    <button
                      type="button"
                      onClick={() => setForgotPasswordMode(true)}
                      className="text-[11px] text-[#6D28D9] hover:underline cursor-pointer"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-2.5 text-[#94A3B8]" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full pl-9 pr-9 py-2 text-xs rounded-lg border border-[#E2E8F0] focus:outline-none focus:border-[#6D28D9] focus:ring-1 focus:ring-[#6D28D9] text-[#172554] bg-[#FFFFFF]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-[#94A3B8] hover:text-[#172554] cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-lg bg-[#6D28D9] hover:bg-[#5B21B6] disabled:opacity-60 text-white font-medium text-xs transition-colors shadow-xs cursor-pointer flex items-center justify-center gap-1.5 mt-2"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <span>
                  {forgotPasswordMode ? 'Send Reset Link' : isSignUp ? 'Create Account' : 'Sign In'}
                </span>
              )}
            </button>
          </form>
            {/* Google Sign‑In Divider */}
            <div className="flex items-center my-4">
              <div className="flex-grow border-t border-[#E2E8F0]"></div>
              <span className="px-2 text-xs text-[#64748B]">or</span>
              <div className="flex-grow border-t border-[#E2E8F0]"></div>
            </div>
            {/* Google Sign‑In Button */}
            <button
              type="button"
              disabled={loading}
              onClick={handleGoogleSignIn}
              className="w-full py-2.5 px-4 rounded-lg border border-[#6D28D9] hover:bg-[#6D28D9]/10 disabled:opacity-60 text-[#6D28D9] font-medium text-xs transition-colors shadow-xs cursor-pointer flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-[#6D28D9]/30 border-t-[#6D28D9] rounded-full animate-spin" />
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path fill="#EA4335" d="M24 9.5c3.4 0 6.5 1.2 8.9 3.2l6.6-6.6C36.7 2.9 30.7 0 24 0 14.6 0 6.5 5.5 2.9 13.5l7.9 6.1C12.9 12.5 18.1 9.5 24 9.5z"/>
                    <path fill="#4285F4" d="M46.5 24c0-1.5-.1-3-.3-4.5H24v9h12.7c-.5 3-2.4 5.6-5.2 7.3l7.9 6.1c4.6-4.2 7.1-10.5 7.1-17.9z"/>
                    <path fill="#FBBC05" d="M12.8 28.6c-.5-1.5-.8-3-.8-4.6s.3-3.1.8-4.6L4.9 13.5C2.6 18.1 1.5 22.9 1.5 24c0 1.1 1.1 5.9 3.4 10.5l7.9-6.1z"/>
                    <path fill="#34A853" d="M24 48c6.7 0 12.7-2.2 16.9-5.9l-7.9-6.1c-2.2 1.5-5 2.4-9 2.4-5.9 0-11-4-12.8-9.5l-7.9 6.1C6.5 42.5 14.6 48 24 48z"/>
                    <path fill="none" d="M0 0h48v48H0z"/>
                  </svg>
                  Continue with Google
                </>
              )}
            </button>

          {/* Quick Demo Login Shortcut for judges */}
          <div className="mt-4 pt-3 border-t border-dashed border-[#E2E8F0] flex items-center justify-between">
            <span className="text-[11px] text-[#64748B]">Evaluation Shortcut:</span>
            <button
              onClick={handleQuickDemoLogin}
              className="text-[11px] text-[#6D28D9] hover:text-[#5B21B6] font-medium flex items-center gap-1 cursor-pointer"
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Instant Test Account</span>
            </button>
          </div>
        </div>

        {/* Option B: Continue as Guest */}
        <div className="p-4 rounded-xl border border-[#E2E8F0] bg-white text-center shadow-xs">
          <p className="text-xs text-[#64748B] mb-2.5">
            Try Clario instantly. Guest documents are temporary.
          </p>
          <button
            onClick={onContinueAsGuest}
            className="w-full py-2.5 px-4 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] hover:border-[#6D28D9] text-[#172554] font-medium text-xs transition-colors cursor-pointer"
          >
            Continue as Guest
          </button>
        </div>

        {onOpenConfigGuide && (
          <div className="mt-4 text-center">
            <button
              onClick={onOpenConfigGuide}
              className="text-[11px] text-[#64748B] hover:text-[#6D28D9] underline cursor-pointer"
            >
              View Supabase SQL schema migrations & VerbX config
            </button>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="w-full max-w-4xl mx-auto px-6 py-6 text-center text-xs text-[#64748B]">
        <span>Isolated sessions · End-to-end data encryption · Row-Level Security</span>
      </footer>
    </div>
  );
};
