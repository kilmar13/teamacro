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

// Dedicated Admin Position Dashboards (3 Positions)
import { AccountManagerDashboard } from './pages/admin/positions/AccountManagerDashboard';
import { OperationsManagerDashboard } from './pages/admin/positions/OperationsManagerDashboard';
import { AuditorDashboard } from './pages/admin/positions/AuditorDashboard';

// Dedicated Staff Position Dashboards (4 Positions)
import { CustomerRegistrationDashboard } from './pages/staff/positions/CustomerRegistrationDashboard';
import { PaymentCollectionDashboard } from './pages/staff/positions/PaymentCollectionDashboard';
import { LoanOfficerDashboard } from './pages/staff/positions/LoanOfficerDashboard';
import { AccountsOfficerDashboard } from './pages/staff/positions/AccountsOfficerDashboard';

import { ThemeProvider } from './context/ThemeContext';
import { BankConfig, User } from './types/banking';
import { ledgerEngine } from './services/ledgerEngine';
import { authService } from './services/authService';
import { testFirestoreConnection } from './services/firebase';
import { getDedicatedRouteForUser, normalizeCanonicalPosition } from './utils/roleRouting';
import { ShieldAlert, ArrowRight, Lock } from 'lucide-react';

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

  // Helper to verify whether currentUser can access a specific dedicated position route
  const renderPositionRoute = (
    requiredRoute: string,
    portalTier: 'ADMIN' | 'STAFF',
    renderDashboard: () => React.ReactNode
  ) => {
    if (!currentUser) {
      return portalTier === 'ADMIN' ? (
        <AdminLoginPage
          config={config}
          onNavigate={handleNavigate}
          onLoginSuccess={(user, targetRoute) => {
            handleLogin(user);
            handleNavigate(targetRoute || getDedicatedRouteForUser(user));
          }}
        />
      ) : (
        <StaffLoginPage
          config={config}
          onNavigate={handleNavigate}
          onLoginSuccess={(user, targetRoute) => {
            handleLogin(user);
            handleNavigate(targetRoute || getDedicatedRouteForUser(user));
          }}
        />
      );
    }

    const isSuperAdmin =
      currentUser.role === 'LIFETIME_SUPER_ADMIN' ||
      currentUser.role === 'SUPER_ADMIN' ||
      Boolean(currentUser.isLifetimeSuperAdmin);

    const assignedRoute = getDedicatedRouteForUser(currentUser);

    if (!isSuperAdmin && assignedRoute !== requiredRoute) {
      const userPos =
        normalizeCanonicalPosition(currentUser.position || currentUser.roleTitle || currentUser.duty) ||
        currentUser.roleTitle ||
        currentUser.role;
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-slate-900 border border-rose-500/40 rounded-2xl p-8 text-center space-y-5 shadow-2xl">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <div className="space-y-2">
              <div className="text-[11px] font-mono uppercase tracking-widest text-rose-400">
                ROLE-BASED URL ACCESS CONTROL
              </div>
              <h1 className="text-xl font-extrabold text-white">
                Unauthorised Position Workspace
              </h1>
              <p className="text-xs text-slate-400 leading-relaxed">
                Your account (<strong className="text-slate-200">{currentUser.fullName}</strong>) is assigned to{' '}
                <strong className="text-emerald-400">{userPos}</strong> and is strictly bound to{' '}
                <code className="text-emerald-300 font-mono">{assignedRoute}</code>. Manual navigation to{' '}
                <code className="text-rose-300 font-mono">{requiredRoute}</code> is blocked.
              </p>
            </div>
            <div className="pt-2 flex flex-col gap-2.5">
              <button
                onClick={() => handleNavigate(assignedRoute)}
                className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Go to My Assigned Dashboard ({assignedRoute})</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={handleLogout}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Sign Out & Switch Account</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return renderDashboard();
  };

  // Render the corresponding route view with strictly separated portals
  const renderView = () => {
    switch (currentRoute) {
      // Canonical Route 1: Public Landing Page
      case '/':
      case '/home':
        return <HomePage config={config} onNavigate={handleNavigate} />;

      // =======================================================================
      // DEDICATED ADMIN POSITION ROUTES (3 POSITIONS)
      // =======================================================================
      case '/admin/accountmanager':
        return renderPositionRoute('/admin/accountmanager', 'ADMIN', () => (
          <AccountManagerDashboard
            currentUser={currentUser}
            onLogout={handleLogout}
            onNavigate={handleNavigate}
          />
        ));

      case '/admin/operationsmanager':
        return renderPositionRoute('/admin/operationsmanager', 'ADMIN', () => (
          <OperationsManagerDashboard
            currentUser={currentUser}
            onLogout={handleLogout}
            onNavigate={handleNavigate}
          />
        ));

      case '/admin/auditor':
        return renderPositionRoute('/admin/auditor', 'ADMIN', () => (
          <AuditorDashboard
            currentUser={currentUser}
            onLogout={handleLogout}
            onNavigate={handleNavigate}
          />
        ));

      // =======================================================================
      // DEDICATED STAFF POSITION ROUTES (4 POSITIONS)
      // =======================================================================
      case '/staff/customer-registration':
        return renderPositionRoute('/staff/customer-registration', 'STAFF', () => (
          <CustomerRegistrationDashboard
            currentUser={currentUser}
            onLogout={handleLogout}
            onNavigate={handleNavigate}
          />
        ));

      case '/staff/payment-collection':
        return renderPositionRoute('/staff/payment-collection', 'STAFF', () => (
          <PaymentCollectionDashboard
            currentUser={currentUser}
            onLogout={handleLogout}
            onNavigate={handleNavigate}
          />
        ));

      case '/staff/loan-officer':
        return renderPositionRoute('/staff/loan-officer', 'STAFF', () => (
          <LoanOfficerDashboard
            currentUser={currentUser}
            onLogout={handleLogout}
            onNavigate={handleNavigate}
          />
        ));

      case '/staff/accounts-officer':
        return renderPositionRoute('/staff/accounts-officer', 'STAFF', () => (
          <AccountsOfficerDashboard
            currentUser={currentUser}
            onLogout={handleLogout}
            onNavigate={handleNavigate}
          />
        ));

      // Canonical Route 2: Staff Backend & Workspaces
      case '/staff':
      case '/staff/login':
      case '/login':
        if (currentUser) {
          const dedicated = getDedicatedRouteForUser(currentUser);
          if (dedicated && dedicated !== '/staff' && currentUser.role !== 'LIFETIME_SUPER_ADMIN') {
            if (dedicated === '/staff/customer-registration') {
              return (
                <CustomerRegistrationDashboard
                  currentUser={currentUser}
                  onLogout={handleLogout}
                  onNavigate={handleNavigate}
                />
              );
            }
            if (dedicated === '/staff/payment-collection') {
              return (
                <PaymentCollectionDashboard
                  currentUser={currentUser}
                  onLogout={handleLogout}
                  onNavigate={handleNavigate}
                />
              );
            }
            if (dedicated === '/staff/loan-officer') {
              return (
                <LoanOfficerDashboard
                  currentUser={currentUser}
                  onLogout={handleLogout}
                  onNavigate={handleNavigate}
                />
              );
            }
            if (dedicated === '/staff/accounts-officer') {
              return (
                <AccountsOfficerDashboard
                  currentUser={currentUser}
                  onLogout={handleLogout}
                  onNavigate={handleNavigate}
                />
              );
            }
          }
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
            onLoginSuccess={(user, targetRoute) => {
              handleLogin(user);
              handleNavigate(targetRoute || getDedicatedRouteForUser(user));
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
        if (currentUser) {
          const dedicated = getDedicatedRouteForUser(currentUser);
          if (dedicated && dedicated !== '/admin' && currentUser.role !== 'LIFETIME_SUPER_ADMIN') {
            if (dedicated === '/admin/accountmanager') {
              return (
                <AccountManagerDashboard
                  currentUser={currentUser}
                  onLogout={handleLogout}
                  onNavigate={handleNavigate}
                />
              );
            }
            if (dedicated === '/admin/operationsmanager') {
              return (
                <OperationsManagerDashboard
                  currentUser={currentUser}
                  onLogout={handleLogout}
                  onNavigate={handleNavigate}
                />
              );
            }
            if (dedicated === '/admin/auditor') {
              return (
                <AuditorDashboard
                  currentUser={currentUser}
                  onLogout={handleLogout}
                  onNavigate={handleNavigate}
                />
              );
            }
          }
          if (
            currentUser.role === 'ADMIN' ||
            currentUser.role === 'ACCOUNT_MANAGER' ||
            currentUser.role === 'OPERATIONS_MANAGER' ||
            currentUser.role === 'AUDITOR' ||
            currentUser.role === 'LIFETIME_SUPER_ADMIN'
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
        }
        return (
          <AdminLoginPage
            config={config}
            onNavigate={handleNavigate}
            onLoginSuccess={(user, targetRoute) => {
              handleLogin(user);
              handleNavigate(targetRoute || getDedicatedRouteForUser(user));
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
    currentRoute.startsWith('/admin/') ||
    currentRoute === '/staff' ||
    currentRoute.startsWith('/staff/') ||
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
