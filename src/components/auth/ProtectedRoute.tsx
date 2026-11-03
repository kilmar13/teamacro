import React, { useEffect, useState } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Lock,
  ArrowRight,
  LogOut,
  AlertTriangle,
  RefreshCw,
  Building2,
} from 'lucide-react';
import { authService, RouteAuthResult } from '../../services/authService';
import { normalizeError } from '../../utils/errorNormalizer';
import { User } from '../../types/banking';
import { BrandLogo } from '../common/BrandLogo';

interface ProtectedRouteProps {
  route: string;
  onNavigate: (route: string) => void;
  onLogout?: () => void;
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  route,
  onNavigate,
  onLogout,
  children,
}) => {
  const [checking, setChecking] = useState<boolean>(true);
  const [authResult, setAuthResult] = useState<RouteAuthResult | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function verify() {
      setChecking(true);

      // 1. Check session
      const session = await authService.getSession();
      if (!isMounted) return;

      if (!session.authenticated || !session.user) {
        // Not logged in -> redirect to login with returnTo
        setChecking(false);
        setAuthResult({
          allowed: false,
          statusCode: 401,
          reason: 'Active authentication session required to enter protected management workspaces.',
          redirect: `/staff/login?returnTo=${encodeURIComponent(route)}`,
        });
        onNavigate(`/staff/login`);
        return;
      }

      setCurrentUser(session.user);

      // 2. Authorize specific route with server
      const check = await authService.authorizeRoute(route);
      if (!isMounted) return;

      setAuthResult(check);
      setChecking(false);

      if (!check.allowed && check.statusCode === 401) {
        onNavigate('/staff/login');
      }
    }

    verify();

    return () => {
      isMounted = false;
    };
  }, [route]);

  // Loading barrier: Absolutely no protected dashboard data is rendered during check
  if (checking) {
    return (
      <div className="min-h-screen bg-[#070F2C] text-white flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/5 border border-white/10 text-[#F9C928] shadow-lg animate-pulse">
            <Lock size={32} />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-bold tracking-tight text-white">
              Verifying Security Clearance
            </h2>
            <p className="text-xs text-blue-200">
              Validating session token, cryptographically salted identity, and role permissions with the TEAMACRO authentication gateway...
            </p>
          </div>

          <div className="flex items-center justify-center gap-2 text-xs font-semibold text-slate-400">
            <RefreshCw size={14} className="animate-spin text-[#2563EB]" />
            <span>Server authorization check in progress</span>
          </div>
        </div>
      </div>
    );
  }

  // 403 Forbidden: Authenticated user attempting to access a higher-tier or restricted workspace
  if (authResult && !authResult.allowed && authResult.statusCode === 403) {
    const userRole = currentUser?.role || 'STAFF';
    let authorizedFallback = '/staff';
    if (userRole === 'LIFETIME_SUPER_ADMIN') {
      authorizedFallback = '/supa-admin';
    } else if (userRole === 'ADMIN') {
      authorizedFallback = '/admin';
    }

    return (
      <div className="min-h-screen bg-[#070F2C] text-white flex flex-col justify-between p-4 sm:p-8">
        {/* Top Bar */}
        <div className="max-w-6xl w-full mx-auto flex items-center justify-between border-b border-[#1E2E64] pb-4">
          <BrandLogo variant="horizontal" size="sm" />
          <button
            onClick={() => onNavigate('/')}
            className="text-xs text-blue-300 hover:text-white transition-colors cursor-pointer"
          >
            ← Public Website
          </button>
        </div>

        {/* Access Denied Card */}
        <div className="max-w-xl w-full mx-auto my-12 bg-[#0B1536] border border-red-500/40 rounded-2xl p-6 sm:p-10 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-12 -mt-12 w-48 h-48 bg-red-500/10 rounded-full blur-2xl pointer-events-none" />

          <div className="relative space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-950/80 border border-red-600/40 text-xs font-bold text-red-400">
              <ShieldAlert size={14} />
              <span>403 FORBIDDEN · ACCESS CLEARANCE DENIED</span>
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
                Restricted Operational Area
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                {normalizeError(
                  authResult.reason,
                  'Your authenticated account role does not hold the requisite clearance level to view this module. All unauthorized navigation attempts are recorded in the central compliance audit register.'
                )}
              </p>
            </div>

            {/* User & Path Details */}
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 text-xs space-y-2">
              <div className="flex justify-between items-center text-slate-400">
                <span>Authenticated User:</span>
                <span className="font-semibold text-white">{currentUser?.fullName || 'Active Session'}</span>
              </div>
              <div className="flex justify-between items-center text-slate-400">
                <span>Account Role:</span>
                <span className="font-semibold text-amber-300">{currentUser?.role || 'Staff'}</span>
              </div>
              <div className="flex justify-between items-center text-slate-400">
                <span>Target Route:</span>
                <span className="font-mono text-red-400">{route}</span>
              </div>
              <div className="flex justify-between items-center text-slate-400">
                <span>Governance Rule:</span>
                <span className="text-slate-300">Strict Segregation of Duties (NDPA 2023)</span>
              </div>
            </div>

            {/* Resolution Actions */}
            <div className="pt-2 flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => onNavigate(authorizedFallback)}
                className="flex-1 py-3 px-4 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-all shadow-md"
              >
                <span>Return to Authorised Workspace</span>
                <ArrowRight size={14} />
              </button>

              <button
                onClick={async () => {
                  await authService.logout();
                  if (onLogout) onLogout();
                  onNavigate('/staff/login');
                }}
                className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <LogOut size={14} />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-slate-500">
          TEAMACRO SERVICES LTD · Security Enforcement System · RC-1589421
        </div>
      </div>
    );
  }

  // If unauthorized for any other reason, return null (it redirects to login)
  if (!authResult?.allowed) {
    return null;
  }

  // Authorized: Render protected dashboard
  return <>{children}</>;
};
