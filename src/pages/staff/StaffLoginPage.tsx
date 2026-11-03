import React, { useState } from 'react';
import {
  Lock,
  Mail,
  Eye,
  EyeOff,
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  AlertCircle,
  Building2,
  Users,
  CheckCircle2,
  KeyRound,
  RefreshCw,
  HelpCircle,
  X,
  Smartphone,
} from 'lucide-react';
import { BankConfig, User } from '../../types/banking';
import { authService, LoginResult } from '../../services/authService';
import { normalizeError } from '../../utils/errorNormalizer';
import { BrandLogo } from '../../components/common/BrandLogo';
import { ThemeSelector } from '../../components/common/ThemeSelector';

interface StaffLoginPageProps {
  config: BankConfig;
  onNavigate: (route: string) => void;
  onLoginSuccess: (user: User) => void;
}

export const StaffLoginPage: React.FC<StaffLoginPageProps> = ({
  config,
  onNavigate,
  onLoginSuccess,
}) => {
  // Login credentials state (strictly empty by default - zero demo auto-fill)
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [lockoutTimer, setLockoutTimer] = useState<number | null>(null);

  // MFA Challenge State
  const [mfaChallenge, setMfaChallenge] = useState<{
    tempToken: string;
    maskedDestination: string;
    user?: any;
  } | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaLoading, setMfaLoading] = useState(false);
  const [mfaError, setMfaError] = useState<string | null>(null);

  // Forgot Password Workflow State
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotStep, setForgotStep] = useState<'request' | 'reset'>('request');
  const [forgotIdentifier, setForgotIdentifier] = useState('');
  const [forgotToken, setForgotToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [forgotMsg, setForgotMsg] = useState<string | null>(null);
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [forgotLoading, setForgotLoading] = useState(false);

  // Submit Primary Credentials
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return; // Prevent duplicate submission
    setErrorMsg(null);
    setLoading(true);

    try {
      const res: LoginResult = await authService.login(identifier, password);

      if (!res.success) {
        setErrorMsg(normalizeError(res.error, 'Invalid credentials or access unauthorised.'));
        if (res.lockoutSeconds) {
          setLockoutTimer(res.lockoutSeconds);
        }
        return;
      }

      // Check if MFA is required (Mandatory for Lifetime Super Admin)
      if (res.requireMfa && res.tempToken) {
        setMfaChallenge({
          tempToken: res.tempToken,
          maskedDestination: res.maskedDestination || 'registered secure authenticator app',
          user: res.user,
        });
        setMfaCode('');
        setMfaError(null);
        return;
      }

      // Login Successful directly without MFA
      if (res.user) {
        onLoginSuccess(res.user);
        onNavigate(res.redirectRoute || '/staff');
      }
    } catch (err: any) {
      setErrorMsg(normalizeError(err, 'Authentication gateway connection failed.'));
    } finally {
      setLoading(false);
    }
  };

  // Submit MFA Verification Code
  const handleVerifyMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mfaLoading || !mfaChallenge?.tempToken) return;

    setMfaError(null);
    setMfaLoading(true);

    try {
      const res = await authService.verifyMfa(mfaChallenge.tempToken, mfaCode);

      if (!res.success || !res.user) {
        setMfaError(normalizeError(res.error, 'Invalid verification code. Please verify.'));
        return;
      }

      onLoginSuccess(res.user);
      onNavigate(res.redirectRoute || '/supa-admin');
    } catch (err: any) {
      setMfaError(normalizeError(err, 'MFA validation failed.'));
    } finally {
      setMfaLoading(false);
    }
  };

  // Request Password Reset
  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (forgotLoading) return;
    setForgotError(null);
    setForgotMsg(null);
    setForgotLoading(true);

    try {
      const res = await authService.requestPasswordReset(forgotIdentifier);
      setForgotMsg(normalizeError(res.message, 'If an account matches, instructions have been sent.'));
      setForgotStep('reset');
    } catch (err: any) {
      setForgotError(normalizeError(err, 'Failed to submit reset request.'));
    } finally {
      setForgotLoading(false);
    }
  };

  // Complete Password Reset
  const handleCompleteReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (forgotLoading) return;
    setForgotError(null);

    if (newPassword !== confirmPassword) {
      setForgotError('New passwords do not match.');
      return;
    }

    if (newPassword.length < 8) {
      setForgotError('Password must be at least 8 characters long.');
      return;
    }

    setForgotLoading(true);

    try {
      const res = await authService.completePasswordReset(forgotToken, newPassword);

      if (!res.success) {
        setForgotError(normalizeError(res.error, 'Password reset failed.'));
        return;
      }

      setForgotMsg('Password updated successfully. Please sign in with your new credentials.');
      setTimeout(() => {
        setShowForgotModal(false);
        setForgotStep('request');
        setPassword(newPassword);
      }, 1500);
    } catch (err: any) {
      setForgotError(normalizeError(err, 'Error completing reset.'));
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F7FB] dark:bg-[#070F2C] flex flex-col justify-between text-[#172033] dark:text-slate-100 transition-colors">
      {/* Top Bar */}
      <div className="border-b border-slate-200 dark:border-[#1E2E64] bg-white dark:bg-[#0B1536] px-4 py-3 sm:px-8 flex items-center justify-between">
        <button
          onClick={() => onNavigate('/')}
          className="flex items-center gap-3 cursor-pointer hover:opacity-90 transition-opacity"
          title="Return to Public Website"
        >
          <BrandLogo variant="horizontal" size="sm" />
        </button>

        <div className="flex items-center gap-4">
          <ThemeSelector />
          <button
            onClick={() => onNavigate('/')}
            className="text-xs font-semibold text-[#0B2A5B] dark:text-[#F9C928] hover:underline cursor-pointer"
          >
            ← Back to Public Website
          </button>
        </div>
      </div>

      {/* Main Container */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 lg:p-10">
        <div className="max-w-5xl w-full grid grid-cols-1 lg:grid-cols-12 bg-white dark:bg-[#0B1536] rounded-md shadow-xl border border-slate-200 dark:border-[#1E2E64] overflow-hidden">
          {/* Left Architectural Panel */}
          <div className="lg:col-span-5 bg-[#0B2A5B] p-8 sm:p-10 text-white flex flex-col justify-between relative border-b lg:border-b-0 lg:border-r border-white/15">
            <div className="relative space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-xs bg-white/10 border border-white/20 text-xs font-mono uppercase tracking-wider text-blue-200">
                <ShieldCheck size={14} />
                <span>RESTRICTED ACCESS · AUTHORISED WORKERS ONLY</span>
              </div>

              <div>
                <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                  TEAMACRO Management Gateway
                </h2>
                <p className="text-xs sm:text-sm text-blue-100 mt-2 leading-relaxed">
                  Enterprise-grade server-enforced authentication gateway. Segregation of duties strictly enforced across staff, admin, and lifetime root consoles.
                </p>
              </div>

              {/* Security Invariants */}
              <div className="space-y-2.5 pt-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-blue-200">
                  Security Invariants
                </div>
                <div className="grid grid-cols-1 gap-2 text-xs">
                  <div className="flex items-center gap-2.5 p-2 rounded-lg bg-white/10 backdrop-blur-xs">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#2563EB]" />
                    <span className="font-semibold text-white">Salted PBKDF2 Password Hashing</span>
                  </div>
                  <div className="flex items-center gap-2.5 p-2 rounded-lg bg-white/10 backdrop-blur-xs">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#16A34A]" />
                    <span className="font-semibold text-white">Mandatory Multi-Factor Auth (MFA)</span>
                  </div>
                  <div className="flex items-center gap-2.5 p-2 rounded-lg bg-white/10 backdrop-blur-xs">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#F97316]" />
                    <span className="font-semibold text-white">Session Fixation & Expiration Defense</span>
                  </div>
                  <div className="flex items-center gap-2.5 p-2 rounded-lg bg-white/10 backdrop-blur-xs">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#7C3AED]" />
                    <span className="font-semibold text-white">Anti-Brute-Force Rate Limiting</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="relative pt-6 border-t border-white/15 text-[11px] text-blue-200 space-y-1">
              <div>Corporate Registration: RC-1589421 · CAMA 2020 Compliant</div>
              <div>Direct URL bypass attempts are server-intercepted and blocked.</div>
            </div>
          </div>

          {/* Right Form Panel */}
          <div className="lg:col-span-7 p-6 sm:p-10 flex flex-col justify-between space-y-6">
            {!mfaChallenge ? (
              // -----------------------------------------------------------------
              // Primary Credentials Step
              // -----------------------------------------------------------------
              <div>
                <div className="space-y-1">
                  <h1 className="text-2xl font-black text-[#0B2A5B] dark:text-white">
                    Corporate Sign In
                  </h1>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Enter your authorized company email or username and password.
                  </p>
                </div>

                {errorMsg && (
                  <div className="mt-4 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-700 dark:text-red-300 flex items-start gap-2.5">
                    <AlertCircle size={16} className="shrink-0 mt-0.5 text-red-600 dark:text-red-400" />
                    <div>
                      <div className="font-bold">Authentication Rejected</div>
                      <div>{normalizeError(errorMsg)}</div>
                      {lockoutTimer && (
                        <div className="mt-1 font-semibold text-amber-600 dark:text-amber-400">
                          Lockout remaining: {lockoutTimer}s
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <form onSubmit={handleLogin} className="mt-6 space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-[#172033] dark:text-slate-300 mb-1.5">
                      Email or Username
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
                        placeholder="e.g. eromoseledavidson68@gmail.com"
                        className="w-full text-xs px-3.5 py-2.5 pl-10 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] focus:outline-hidden transition-colors"
                      />
                      <Mail size={16} className="absolute left-3.5 top-3 text-slate-400" />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="text-xs font-bold text-[#172033] dark:text-slate-300">
                        Password
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setForgotIdentifier(identifier);
                          setShowForgotModal(true);
                        }}
                        className="text-[11px] text-[#2563EB] hover:underline cursor-pointer"
                      >
                        Forgot Password?
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full text-xs px-3.5 py-2.5 pl-10 pr-10 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] focus:outline-hidden transition-colors"
                      />
                      <Lock size={16} className="absolute left-3.5 top-3 text-slate-400" />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                        title={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 px-4 rounded-xl bg-[#0B2A5B] hover:bg-[#1E5BD8] text-white font-bold text-xs uppercase tracking-wider transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" />
                        <span>Verifying Credentials on Server...</span>
                      </>
                    ) : (
                      <>
                        <span>Sign In to Protected Workspace</span>
                        <ArrowRight size={15} />
                      </>
                    )}
                  </button>
                </form>
              </div>
            ) : (
              // -----------------------------------------------------------------
              // Multi-Factor Authentication (MFA) Verification Step
              // -----------------------------------------------------------------
              <div className="space-y-6">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-700 text-xs font-bold text-amber-800 dark:text-amber-300 mb-2">
                    <Smartphone size={14} />
                    <span>MULTI-FACTOR AUTHENTICATION REQUIRED</span>
                  </div>
                  <h2 className="text-2xl font-black text-[#0B2A5B] dark:text-white">
                    Two-Factor Identity Verification
                  </h2>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                    A secure 6-digit verification code has been dispatched to{' '}
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {mfaChallenge.maskedDestination}
                    </span>.
                  </p>
                </div>

                {mfaError && (
                  <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-700 dark:text-red-300 flex items-start gap-2">
                    <AlertCircle size={15} className="shrink-0 mt-0.5" />
                    <span>{normalizeError(mfaError)}</span>
                  </div>
                )}

                <form onSubmit={handleVerifyMfa} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-[#172033] dark:text-slate-300 mb-1.5">
                      Enter 6-Digit MFA Security Code
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      autoFocus
                      required
                      value={mfaCode}
                      onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="123456"
                      className="w-full text-center text-2xl font-mono tracking-widest px-4 py-3 border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] focus:outline-hidden"
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setMfaChallenge(null)}
                      className="px-4 py-2.5 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={mfaLoading || mfaCode.length < 6}
                      className="flex-1 py-2.5 px-4 rounded-xl bg-[#0B2A5B] hover:bg-[#1E5BD8] text-white font-bold text-xs uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {mfaLoading ? <RefreshCw size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                      <span>Verify & Open Root Dashboard</span>
                    </button>
                  </div>
                </form>
              </div>
            )}

            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 text-center">
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Authorised enterprise personnel only. All access events are cryptographically recorded and audited.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0B1536] border border-slate-200 dark:border-[#1E2E64] rounded-2xl max-w-md w-full p-6 shadow-2xl relative space-y-5">
            <button
              onClick={() => {
                setShowForgotModal(false);
                setForgotStep('request');
                setForgotError(null);
                setForgotMsg(null);
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
            >
              <X size={18} />
            </button>

            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#2563EB] mb-1">
                <Lock size={13} />
                <span>SECURE CREDENTIAL RECOVERY</span>
              </div>
              <h3 className="text-lg font-bold text-[#0B2A5B] dark:text-white">
                {forgotStep === 'request' ? 'Request Password Reset' : 'Enter Reset Token & New Password'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {forgotStep === 'request'
                  ? 'Enter your corporate staff email or username. Single-use reset tokens expire in 15 minutes.'
                  : 'Enter the single-use reset token and choose a new secure password (min 8 characters).'}
              </p>
            </div>

            {forgotMsg && (
              <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl text-xs text-blue-700 dark:text-blue-300">
                {forgotMsg}
              </div>
            )}

            {forgotError && (
              <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-700 dark:text-red-300">
                {normalizeError(forgotError)}
              </div>
            )}

            {forgotStep === 'request' ? (
              <form onSubmit={handleRequestReset} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Staff Email or Username
                  </label>
                  <input
                    type="text"
                    required
                    value={forgotIdentifier}
                    onChange={(e) => setForgotIdentifier(e.target.value)}
                    placeholder="e.g. admin@teamacro.ng"
                    className="w-full text-xs px-3.5 py-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl focus:border-[#2563EB] focus:outline-hidden"
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(false)}
                    className="px-4 py-2 border border-slate-300 dark:border-slate-700 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-400"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="px-4 py-2 bg-[#0B2A5B] hover:bg-[#1E5BD8] text-white text-xs font-bold rounded-xl flex items-center gap-1.5"
                  >
                    {forgotLoading ? <RefreshCw size={13} className="animate-spin" /> : null}
                    <span>Send Reset Instructions</span>
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleCompleteReset} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Single-Use Reset Token
                  </label>
                  <input
                    type="text"
                    required
                    value={forgotToken}
                    onChange={(e) => setForgotToken(e.target.value)}
                    placeholder="24-character security token"
                    className="w-full font-mono text-xs px-3.5 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl focus:border-[#2563EB] focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    New Password (Min 8 Characters)
                  </label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full text-xs px-3.5 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl focus:border-[#2563EB] focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full text-xs px-3.5 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl focus:border-[#2563EB] focus:outline-hidden"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setForgotStep('request')}
                    className="px-4 py-2 border border-slate-300 dark:border-slate-700 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-400"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="px-4 py-2 bg-[#0B2A5B] hover:bg-[#1E5BD8] text-white text-xs font-bold rounded-xl flex items-center gap-1.5"
                  >
                    {forgotLoading ? <RefreshCw size={13} className="animate-spin" /> : null}
                    <span>Update Password</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Footer Notice */}
      <div className="border-t border-slate-200 dark:border-[#1E2E64] py-3 text-center text-xs text-slate-500 dark:text-slate-400">
        TEAMACRO SERVICES LTD · Complete In-House Management System · Operational Confidentiality Strictly Enforced
      </div>
    </div>
  );
};
