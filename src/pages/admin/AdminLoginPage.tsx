import React, { useState } from 'react';
import {
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  ArrowRight,
  AlertCircle,
  RefreshCw,
  Building2,
} from 'lucide-react';
import { BankConfig, User } from '../../types/banking';
import { authService, LoginResult } from '../../services/authService';
import { normalizeError } from '../../utils/errorNormalizer';
import { BrandLogo } from '../../components/common/BrandLogo';
import { getDedicatedRouteForUser } from '../../utils/roleRouting';

interface AdminLoginPageProps {
  config: BankConfig;
  onNavigate: (route: string) => void;
  onLoginSuccess: (user: User, redirectRoute?: string) => void;
}

export const AdminLoginPage: React.FC<AdminLoginPageProps> = ({
  config,
  onNavigate,
  onLoginSuccess,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [lockoutTimer, setLockoutTimer] = useState<number | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setErrorMsg(null);
    setLoading(true);

    try {
      const res: LoginResult = await authService.login(email.trim(), password);

      if (!res.success) {
        setErrorMsg(normalizeError(res.error, 'Invalid credentials or unauthorized.'));
        if (res.lockoutSeconds) {
          setLockoutTimer(res.lockoutSeconds);
        }
        return;
      }

      // Check role authorization: Only ADMIN (including Account Manager, Operations Manager, Auditor) and LIFETIME_SUPER_ADMIN can enter /admin
      const allowedAdminRoles = [
        'ADMIN',
        'ACCOUNT_MANAGER',
        'OPERATIONS_MANAGER',
        'AUDITOR',
        'SUPER_ADMIN',
        'LIFETIME_SUPER_ADMIN',
      ];
      if (
        res.user &&
        !allowedAdminRoles.includes(String(res.user.role || '').toUpperCase())
      ) {
        setErrorMsg('Clearance Denied: This portal requires Administrator role clearance.');
        return;
      }

      if (res.user) {
        const targetRoute = res.redirectRoute || getDedicatedRouteForUser(res.user);
        onLoginSuccess(res.user, targetRoute);
        onNavigate(targetRoute);
      }
    } catch (err: any) {
      setErrorMsg(normalizeError(err, 'Authentication gateway connection failed.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070F2C] text-white flex flex-col justify-between font-sans selection:bg-[#2563EB]/30">
      {/* Top Header */}
      <header className="w-full border-b border-[#1E2E64] bg-[#070F2C]/90 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div onClick={() => onNavigate('/home')} className="cursor-pointer">
            <BrandLogo variant="horizontal" theme="dark" size="md" />
          </div>
          <div className="flex items-center gap-4 text-xs">
            <button
              onClick={() => onNavigate('/home')}
              className="text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              ← Public Website
            </button>
          </div>
        </div>
      </header>

      {/* Main Login Card */}
      <main className="flex-1 max-w-md w-full mx-auto px-4 py-12 flex flex-col justify-center">
        <div className="bg-[#0B1536] border border-[#1E2E64] rounded-md p-6 sm:p-8 shadow-2xl space-y-6 relative overflow-hidden">
          {/* Accent bar */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-[#1E5BD8]" />

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400 flex items-center justify-center mx-auto shadow-sm">
                <ShieldCheck size={24} />
              </div>
              <div className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-blue-500/20 text-blue-300 border border-blue-500/40">
                ADMINISTRATION PORTAL
              </div>
              <h1 className="text-2xl font-black text-white">Administrator Sign In</h1>
              <p className="text-xs text-slate-400">
                Operations management, loan approvals, and staff oversight.
              </p>
            </div>

            {errorMsg && (
              <div className="p-3.5 rounded-xl bg-rose-950/70 border border-rose-800 text-rose-300 text-xs flex items-start gap-2.5">
                <AlertCircle size={16} className="shrink-0 mt-0.5 text-rose-400" />
                <span>{normalizeError(errorMsg)}</span>
              </div>
            )}

            {lockoutTimer && lockoutTimer > 0 && (
              <div className="p-3.5 rounded-xl bg-amber-950/70 border border-amber-800 text-amber-300 text-xs flex items-center gap-2">
                <span>Security lockout active. Please wait {lockoutTimer} seconds.</span>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Administrator Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@teamacro.ng"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#070F2C] border border-[#1E2E64] text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
                  required
                  disabled={loading || (lockoutTimer !== null && lockoutTimer > 0)}
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-bold text-slate-300">Password</label>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full px-3.5 py-2.5 pr-10 rounded-xl bg-[#070F2C] border border-[#1E2E64] text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
                    required
                    disabled={loading || (lockoutTimer !== null && lockoutTimer > 0)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-white cursor-pointer"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading || (lockoutTimer !== null && lockoutTimer > 0)}
                className="w-full py-3 px-4 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold text-sm tracking-wide flex items-center justify-center gap-2 transition-all shadow-md disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    <span>Verifying Administrator Clearance...</span>
                  </>
                ) : (
                  <>
                    <span>Enter Administration Console</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </div>

            <div className="pt-2 text-center text-[11px] text-slate-500">
              Restricted to authorised TEAMACRO administrators.
            </div>
          </form>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-[#1E2E64] py-4 px-6 text-center text-xs text-slate-500">
        TEAMACRO SERVICES LTD • Administrator Operations Console • RC-1589421
      </footer>
    </div>
  );
};
