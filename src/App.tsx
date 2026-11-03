/**
 * TEAMACRO SERVICES LTD
 * Where Big Dreams Meet Smart Savings...
 * A Smarter Way to Manage Savings, Contributions and Loans
 */

import React, { useState, useEffect } from 'react';
import { Header } from './components/layout/Header';
import { Footer } from './components/layout/Footer';
import { AnnouncementBanner } from './components/layout/AnnouncementBanner';

// Public Pages
import { HomePage } from './pages/public/HomePage';
import { PersonalBankingPage } from './pages/public/PersonalBankingPage';
import { BusinessBankingPage } from './pages/public/BusinessBankingPage';
import { CorporateBankingPage } from './pages/public/CorporateBankingPage';
import { DigitalBankingPage } from './pages/public/DigitalBankingPage';
import { OpenAccountPage } from './pages/public/OpenAccountPage';
import { AboutPage } from './pages/public/AboutPage';
import { BranchesPage } from './pages/public/BranchesPage';
import { TariffsPage } from './pages/public/TariffsPage';
import { SecurityPage } from './pages/public/SecurityPage';
import { ContactPage } from './pages/public/ContactPage';
import { GovernancePage } from './pages/public/GovernancePage';
import { HelpCenterPage } from './pages/public/HelpCenterPage';
import { PrivacyPage, TermsPage } from './pages/public/PrivacyPage';

// Portal Applications
import { CustomerPortal } from './pages/customer/CustomerPortal';
import { StaffPortal } from './pages/staff/StaffPortal';
import { StaffLoginPage } from './pages/staff/StaffLoginPage';
import { SuperAdminPortal } from './pages/admin/SuperAdminPortal';
import { SuperAdminLoginPage } from './pages/admin/SuperAdminLoginPage';
import { SuperAdminSetupPage } from './pages/admin/SuperAdminSetupPage';
import { AdminPortal } from './pages/admin/AdminPortal';
import { AdminLoginPage } from './pages/admin/AdminLoginPage';
import { ProtectedRoute } from './components/auth/ProtectedRoute';

import { ThemeProvider } from './context/ThemeContext';
import { BankConfig, User } from './types/banking';
import { ledgerEngine } from './services/ledgerEngine';
import { authService } from './services/authService';
import { testFirestoreConnection } from './services/firebase';

export default function App() {
  const [config, setConfig] = useState<BankConfig>(() => ledgerEngine.getConfig());
  const [currentUser, setCurrentUser] = useState<User | null>(() => ledgerEngine.getCurrentUser());

  // Canonical route normalizer
  const normalizeCanonicalRoute = (rawRoute: string): string => {
    const clean = rawRoute.split('?')[0].split('#')[0];
    if (clean === '/staff/login' || clean === '/login') return '/staff';
    if (clean === '/supasetup' || clean === '/supaadmin') return '/supa-setup';
    if (clean === '/superadmin') return '/supa-admin';
    return clean;
  };

  // URL hash / path router with canonical fallback support
  const getInitialRoute = (): string => {
    // 1. Check window.location.hash
    const hash = window.location.hash.replace('#', '');
    if (hash && hash.startsWith('/')) {
      return normalizeCanonicalRoute(hash);
    }
    // 2. Check window.location.pathname
    const path = window.location.pathname;
    if (path && path !== '/') {
      return normalizeCanonicalRoute(path);
    }
    return '/home';
  };

  const [currentRoute, setCurrentRoute] = useState<string>(getInitialRoute);

  // Sync hash and pathname routing & test Firestore connection on boot
  useEffect(() => {
    testFirestoreConnection();

    const handleLocationChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash && hash.startsWith('/')) {
        setCurrentRoute(normalizeCanonicalRoute(hash));
        return;
      }
      const path = window.location.pathname;
      if (path && path !== '/') {
        setCurrentRoute(normalizeCanonicalRoute(path));
      } else {
        setCurrentRoute('/home');
      }
    };

    // Sync active server session on boot
    authService.getSession().then((session) => {
      if (session.authenticated && session.user) {
        ledgerEngine.setCurrentUser(session.user);
        setCurrentUser(session.user);
      } else {
        ledgerEngine.setCurrentUser(null);
        setCurrentUser(null);
      }
    });

    window.addEventListener('hashchange', handleLocationChange);
    window.addEventListener('popstate', handleLocationChange);
    return () => {
      window.removeEventListener('hashchange', handleLocationChange);
      window.removeEventListener('popstate', handleLocationChange);
    };
  }, []);

  const handleNavigate = (route: string) => {
    const canonical = normalizeCanonicalRoute(route);
    setCurrentRoute(canonical);
    window.location.hash = canonical;
    try {
      window.history.pushState(null, '', canonical);
    } catch {
      // Safe fallback if history API is restricted in sandboxed iframe
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLogin = (user: User) => {
    ledgerEngine.setCurrentUser(user);
    setCurrentUser(user);
  };

  const handleLogout = async () => {
    await authService.logout();
    ledgerEngine.setCurrentUser(null);
    setCurrentUser(null);
    handleNavigate('/home');
  };

  // Render the corresponding route view with strictly separated portals
  const renderView = () => {
    switch (currentRoute) {
      // Canonical Route 1: Public Landing Page
      case '/':
      case '/home':
        return <HomePage config={config} onNavigate={handleNavigate} />;

      // Canonical Route 2: Staff Backend & Workspaces
      case '/staff':
      case '/staff/login':
      case '/login':
        if (currentUser) {
          return (
            <StaffPortal
              config={config}
              onNavigate={handleNavigate}
              currentUser={currentUser}
              onLogout={handleLogout}
            />
          );
        }
        return (
          <StaffLoginPage
            config={config}
            onNavigate={handleNavigate}
            onLoginSuccess={(user) => {
              handleLogin(user);
              handleNavigate('/staff');
            }}
          />
        );

      // Canonical Route 3: Super Admin Portal (Strictly Separated Authentication)
      case '/supa-admin':
      case '/superadmin':
        if (currentUser?.role === 'LIFETIME_SUPER_ADMIN') {
          return (
            <SuperAdminPortal
              config={config}
              onUpdateConfig={setConfig}
              onNavigate={handleNavigate}
              onLogout={handleLogout}
            />
          );
        }
        return (
          <SuperAdminLoginPage
            config={config}
            onNavigate={handleNavigate}
            onLoginSuccess={(user) => {
              handleLogin(user);
              handleNavigate('/supa-admin');
            }}
          />
        );

      // Canonical Route 4: Admin Backend (Strictly Separated Authentication)
      case '/admin':
        if (
          currentUser &&
          (currentUser.role === 'ADMIN' || currentUser.role === 'LIFETIME_SUPER_ADMIN')
        ) {
          return (
            <AdminPortal
              config={config}
              onNavigate={handleNavigate}
              currentUser={currentUser}
              onLogout={handleLogout}
            />
          );
        }
        return (
          <AdminLoginPage
            config={config}
            onNavigate={handleNavigate}
            onLoginSuccess={(user) => {
              handleLogin(user);
              handleNavigate('/admin');
            }}
          />
        );

      // Canonical Route 5: Initial Lifetime Super Admin Setup & Lockdown
      case '/supa-setup':
      case '/supasetup':
      case '/supaadmin':
        return (
          <SuperAdminSetupPage
            config={config}
            onNavigate={handleNavigate}
            onLoginSuccess={(user) => {
              handleLogin(user);
              handleNavigate('/supa-admin');
            }}
          />
        );

      // Public Product & Institutional Pages
      case '/personal-banking':
        return <PersonalBankingPage config={config} onNavigate={handleNavigate} />;
      case '/business-banking':
        return <BusinessBankingPage config={config} onNavigate={handleNavigate} />;
      case '/corporate-banking':
        return <CorporateBankingPage config={config} onNavigate={handleNavigate} />;
      case '/digital-banking':
        return <DigitalBankingPage config={config} onNavigate={handleNavigate} />;
      case '/open-account':
        return <OpenAccountPage config={config} onNavigate={handleNavigate} />;
      case '/about':
      case '/leadership':
        return <AboutPage config={config} onNavigate={handleNavigate} />;
      case '/branches':
        return <BranchesPage config={config} onNavigate={handleNavigate} />;
      case '/tariffs':
        return <TariffsPage config={config} onNavigate={handleNavigate} />;
      case '/security':
        return <SecurityPage config={config} onNavigate={handleNavigate} />;
      case '/contact':
        return <ContactPage config={config} onNavigate={handleNavigate} />;
      case '/help':
        return <HelpCenterPage config={config} onNavigate={handleNavigate} />;
      case '/governance':
        return <GovernancePage config={config} onNavigate={handleNavigate} />;
      case '/privacy':
        return <PrivacyPage config={config} onNavigate={handleNavigate} />;
      case '/terms':
        return <TermsPage config={config} onNavigate={handleNavigate} />;
      case '/internet-banking':
        return <HomePage config={config} onNavigate={handleNavigate} />;
      default:
        return <HomePage config={config} onNavigate={handleNavigate} />;
    }
  };

  // Dedicated backends have their own complete control bars and do not render the retail header/footer
  const isStandaloneManagement =
    currentRoute === '/supa-setup' ||
    currentRoute === '/supasetup' ||
    currentRoute === '/supaadmin' ||
    currentRoute === '/supa-admin' ||
    currentRoute === '/superadmin' ||
    currentRoute === '/admin' ||
    currentRoute === '/staff' ||
    currentRoute === '/staff/login' ||
    currentRoute === '/login';

  // Prevent search indexing of internal operational and administrative routes
  useEffect(() => {
    let robotsMeta = document.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
    if (!robotsMeta) {
      robotsMeta = document.createElement('meta');
      robotsMeta.name = 'robots';
      document.head.appendChild(robotsMeta);
    }
    robotsMeta.content = isStandaloneManagement ? 'noindex, nofollow' : 'index, follow';
  }, [isStandaloneManagement]);

  return (
    <ThemeProvider>
      <div className="min-h-screen flex flex-col bg-[#F4F7FB] dark:bg-[#060D1F] text-[#0F172A] dark:text-slate-100 font-sans selection:bg-[#1E5BD8]/20 selection:text-[#0B2A5B] transition-colors">
        {!isStandaloneManagement && (
          <>
            {/* Official Announcement Strip */}
            <AnnouncementBanner config={config} />

            {/* Corporate Header */}
            <Header
              config={config}
              currentRoute={currentRoute}
              onNavigate={handleNavigate}
              currentUser={currentUser}
              onLogout={handleLogout}
            />
          </>
        )}

        {/* Main Body */}
        <main className="flex-1">{renderView()}</main>

        {/* Footer */}
        {!isStandaloneManagement && <Footer config={config} onNavigate={handleNavigate} />}
      </div>
    </ThemeProvider>
  );
}
