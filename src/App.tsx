import React, { useState, useEffect } from 'react';
import { SplashScreen } from './components/SplashScreen';
import { AuthScreen } from './components/AuthScreen';
import { Workspace } from './components/Workspace';

const ConfigGuideModal = React.lazy(() =>
  import('./components/ConfigGuideModal').then((m) => ({ default: m.ConfigGuideModal }))
);
import {
  AuthUser,
  getStoredGuestSession,
  getStoredDemoUser,
  createGuestSession,
  clearGuestSession,
  setStoredDemoUser,
  supabase,
  isSupabaseConfigured,
} from './lib/supabase';

type Page = 'splash' | 'auth' | 'workspace';

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('splash');
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [showConfigGuide, setShowConfigGuide] = useState(false);

  // Check for existing session on initial mount
  useEffect(() => {
    // 1. Check live Supabase session if configured
    if (isSupabaseConfigured() && supabase) {
      supabase.auth.getSession().then(({ data }) => {
        if (data.session?.user) {
          setCurrentUser({
            id: data.session.user.id,
            email: data.session.user.email || '',
            isGuest: false,
          });
          setCurrentPage('workspace');
        }
      });

      const { data: authListener } = supabase.auth.onAuthStateChange(
        (_event, session) => {
          if (session?.user) {
            setCurrentUser({
              id: session.user.id,
              email: session.user.email || '',
              isGuest: false,
            });
          } else if (_event === 'SIGNED_OUT') {
            setCurrentUser(null);
            setCurrentPage('auth');
          }
        }
      );

      return () => {
        authListener.subscription.unsubscribe();
      };
    } else {
      // 2. Check demo registered user or guest session
      const storedDemo = getStoredDemoUser();
      if (storedDemo) {
        setCurrentUser(storedDemo);
        setCurrentPage('workspace');
      } else {
        const storedGuest = getStoredGuestSession();
        if (storedGuest) {
          setCurrentUser(storedGuest);
        }
      }
    }
  }, []);

  const handleGetStarted = () => {
    setCurrentPage('auth');
  };

  const handleContinueToApp = () => {
    if (currentUser) {
      setCurrentPage('workspace');
    } else {
      setCurrentPage('auth');
    }
  };

  const handleAuthenticated = (user: AuthUser) => {
    setCurrentUser(user);
    setCurrentPage('workspace');
  };

  const handleContinueAsGuest = () => {
    const guest = createGuestSession();
    setCurrentUser(guest);
    setCurrentPage('workspace');
  };

  const handleSignOut = async () => {
    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.warn('Supabase sign out error:', err);
      }
    }
    clearGuestSession();
    setStoredDemoUser(null);
    setCurrentUser(null);
    setCurrentPage('auth');
  };

  return (
    <div className="min-h-screen bg-white">
      {currentPage === 'splash' && (
        <SplashScreen
          onGetStarted={handleGetStarted}
          currentUser={currentUser}
          onContinueToApp={handleContinueToApp}
          onSignOut={handleSignOut}
        />
      )}

      {currentPage === 'auth' && (
        <AuthScreen
          onBack={() => setCurrentPage('splash')}
          onAuthenticated={handleAuthenticated}
          onContinueAsGuest={handleContinueAsGuest}
          onOpenConfigGuide={() => setShowConfigGuide(true)}
        />
      )}

      {currentPage === 'workspace' && currentUser && (
        <Workspace
          currentUser={currentUser}
          onSignOut={handleSignOut}
          onGoToAuth={() => setCurrentPage('auth')}
        />
      )}

      {showConfigGuide && (
        <React.Suspense fallback={null}>
          <ConfigGuideModal onClose={() => setShowConfigGuide(false)} />
        </React.Suspense>
      )}
    </div>
  );
}
