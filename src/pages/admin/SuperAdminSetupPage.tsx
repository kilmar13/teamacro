import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Lock,
  KeyRound,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  Eye,
  EyeOff,
  Shield,
  UserCheck,
} from 'lucide-react';
import { BankConfig, User } from '../../types/banking';
import { authService, SetupStatusResponse } from '../../services/authService';
import { BrandLogo } from '../../components/common/BrandLogo';
import { ThemeSelector } from '../../components/common/ThemeSelector';

interface SuperAdminSetupPageProps {
  config: BankConfig;
  onNavigate: (route: string) => void;
  onLoginSuccess?: (user: User) => void;
}

export const SuperAdminSetupPage: React.FC<SuperAdminSetupPageProps> = ({
  config,
  onNavigate,
  onLoginSuccess,
}) => {
  // Authoritative setup state from Firestore
  const [checkingStatus, setCheckingStatus] = useState<boolean>(true);
  const [setupStatus, setSetupStatus] = useState<SetupStatusResponse | null>(null);

  // Form Fields
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreeSecurity, setAgreeSecurity] = useState(false);

  // Form Submission & Success State
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [setupSuccessUser, setSetupSuccessUser] = useState<User | null>(null);

  useEffect(() => {
    checkSetupStatus();
  }, []);

  const checkSetupStatus = async () => {
    setCheckingStatus(true);
    setErrorMsg(null);
    try {
      const res = await authService.getSetupStatus();
      setSetupStatus(res);
    } catch (err: any) {
      console.warn('[SETUP] Status check warning:', err);
      setSetupStatus({
        status: 'NOT_INITIALIZED',
        isInitialized: false,
        lockdownEnforced: false,
        message: 'Ready for initial setup.',
      });
    } finally {
      setCheckingStatus(false);
    }
  };

  // Password Strength Calculation
  const getPasswordStrength = (pwd: string) => {
    let score = 0;
    if (pwd.length >= 10) score += 1;
    if (pwd.length >= 14) score += 1;
    if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) score += 1;
    if (/[0-9]/.test(pwd)) score += 1;
    if (/[^a-zA-Z0-9]/.test(pwd)) score += 1;

    if (score <= 2) return { label: 'Weak', color: 'bg-rose-500', width: '30%' };
    if (score <= 3) return { label: 'Fair', color: 'bg-amber-500', width: '60%' };
    if (score === 4) return { label: 'Strong', color: 'bg-blue-600', width: '85%' };
    return { label: 'Very Strong', color: 'bg-emerald-600', width: '100%' };
  };

  const strength = getPasswordStrength(password);

  // Handle Initial Lifetime Super Admin Creation
  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    // Form Validations
    if (!fullName.trim() || !email.trim() || !password.trim() || !confirmPassword.trim()) {
      setErrorMsg('Please complete all required fields.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setErrorMsg('Please enter a valid corporate email address.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('Password confirmation does not match.');
      return;
    }

    if (password.length < 10) {
      setErrorMsg('Password must be at least 10 characters in length.');
      return;
    }

    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[^a-zA-Z0-9]/.test(password);
    if (!hasLetter || !hasNumber || !hasSpecial) {
      setErrorMsg('Password must contain letters, numbers, and special symbols.');
      return;
    }

    if (!agreeSecurity) {
      setErrorMsg('You must agree to the administrative security requirements to proceed.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await authService.setupLifetimeSuperAdmin({
        fullName: fullName.trim(),
        email: email.trim(),
        phone: phone.trim() || '+234 800 000 0001',
        password,
      });

      if (!res.success || !res.user) {
        setErrorMsg(res.error || 'Failed to establish root account.');
        setSubmitting(false);
        return;
      }

      setSetupSuccessUser(res.user);
      setSetupStatus({
        status: 'INITIALIZED',
        isInitialized: true,
        lockdownEnforced: true,
        ownerEmail: res.user.email,
        ownerFullName: res.user.fullName,
        establishedAt: res.user.createdAt,
      });

      if (onLoginSuccess) {
        onLoginSuccess(res.user);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Network error initializing Lifetime Super Admin account.');
    } finally {
      setSubmitting(false);
    }
  };

  const isAlreadyInitialized =
    setupStatus?.status === 'INITIALIZED' ||
    (setupStatus?.isInitialized && setupStatus?.lockdownEnforced);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#F4F7FB] via-white to-[#F4F7FB] dark:from-[#071126] dark:via-[#060D1F] dark:to-[#071126] flex flex-col justify-between font-sans selection:bg-[#1E5BD8]/20">
      {/* Top Ajo.money-Style Clean Fintech Bar */}
      <nav className="w-full bg-white/95 dark:bg-[#071126]/95 backdrop-blur-md text-[#0B2A5B] dark:text-white border-b border-slate-200/80 dark:border-slate-800 px-6 py-4 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div
            onClick={() => onNavigate('/home')}
            className="cursor-pointer flex items-center gap-4"
            title="TEAMACRO SERVICES LTD"
          >
            <BrandLogo variant="horizontal" size="sm" />
            <div className="hidden sm:block h-6 w-px bg-slate-200 dark:bg-slate-800" />
            <div className="hidden sm:block">
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#1E5BD8] dark:text-blue-400">
                PORTAL 04 · ROOT OWNERSHIP SETUP
              </div>
              <div className="font-display text-xs font-extrabold text-[#0B2A5B] dark:text-white tracking-tight">
                Lifetime Super Admin Initialization
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ThemeSelector />
            <span className="hidden md:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[11px] font-extrabold bg-[#F4F7FB] dark:bg-slate-900 text-[#0B2A5B] dark:text-slate-200 border border-slate-200/80 dark:border-slate-800">
              <Shield size={13} className="text-[#1E5BD8]" />
              Enterprise Governance Gateway
            </span>
            <button
              onClick={() => onNavigate('/supa-admin')}
              className="px-5 py-2 rounded-full bg-[#1E5BD8] hover:bg-[#0B2A5B] text-white text-xs font-extrabold transition-all shadow-xs cursor-pointer"
            >
              Sign In to Super Admin →
            </button>
          </div>
        </div>
      </nav>

      {/* Main Two-Column Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-12 flex items-center justify-center">
        {checkingStatus ? (
          <div className="text-center py-24 space-y-4">
            <RefreshCw size={36} className="animate-spin text-[#1E5BD8] mx-auto" />
            <h3 className="font-display text-sm font-bold text-[#0B2A5B] dark:text-white">Verifying Authoritative System Status...</h3>
            <p className="text-xs text-slate-500">Checking Firestore singleton Lifetime Super Admin registry.</p>
          </div>
        ) : (
          <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
            {/* Left Column: Welcome and Branding with Ajo.money Curved Underline */}
            <div className="lg:col-span-5 space-y-8">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#1E5BD8]/10 text-[#1E5BD8] dark:text-blue-400 text-[11px] font-extrabold uppercase tracking-wider">
                  <KeyRound size={14} className="text-[#1E5BD8]" />
                  <span>ROOT ADMINISTRATIVE AUTHORITY</span>
                </div>

                <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#0B2A5B] dark:text-white tracking-tight leading-[1.14]">
                  Your Administrative Access{' '}
                  <span className="relative inline-block text-[#1E5BD8] dark:text-[#60A5FA]">
                    Starts Here.
                    <svg
                      className="absolute -bottom-2 left-0 w-full h-3 text-[#2563EB]"
                      viewBox="0 0 210 16"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M3 12.5C52.5 3.5 142.5 -1.5 207 10.5"
                        stroke="currentColor"
                        strokeWidth="4.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  </span>
                </h1>

                <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed pt-1">
                  Establish your secure administrator account to govern TEAMACRO's Daily Ajo rotating
                  thrift, Fixed Target savings, Everyhome Food contributions, Leocash reserves, and
                  loan-management operations.
                </p>
              </div>

              {/* Three Concise Value Points (Ajo.money Rounded-2xl Cards) */}
              <div className="space-y-3.5 pt-2">
                <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-white dark:bg-[#0B162C] border border-slate-200/90 dark:border-slate-800 shadow-xs">
                  <div className="w-10 h-10 rounded-xl bg-[#2563EB]/10 text-[#2563EB] flex items-center justify-center shrink-0 mt-0.5">
                    <ShieldCheck size={20} />
                  </div>
                  <div>
                    <h3 className="font-display text-sm font-extrabold text-[#0B2A5B] dark:text-white">01 · Secure account setup.</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Direct Firebase Authentication integration and immutable owner identity binding in Firestore.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-white dark:bg-[#0B162C] border border-slate-200/90 dark:border-slate-800 shadow-xs">
                  <div className="w-10 h-10 rounded-xl bg-[#16A34A]/10 text-[#16A34A] flex items-center justify-center shrink-0 mt-0.5">
                    <Lock size={19} />
                  </div>
                  <div>
                    <h3 className="font-display text-sm font-extrabold text-[#0B2A5B] dark:text-white">02 · Protected administrative access.</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Segregated owner-level governance over microfinance ledgers and dual-control approvals.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-white dark:bg-[#0B162C] border border-slate-200/90 dark:border-slate-800 shadow-xs">
                  <div className="w-10 h-10 rounded-xl bg-[#7C3AED]/10 text-[#7C3AED] flex items-center justify-center shrink-0 mt-0.5">
                    <UserCheck size={20} />
                  </div>
                  <div>
                    <h3 className="font-display text-sm font-extrabold text-[#0B2A5B] dark:text-white">03 · Verified identity & 5-programme control.</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Direct credential validation matching the singleton root administrator record.
                    </p>
                  </div>
                </div>
              </div>

              {/* Programme Colour Pills */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {[
                  { label: 'Daily Ajo', color: '#16A34A' },
                  { label: 'Fixed Target', color: '#2563EB' },
                  { label: 'Everyhome Food', color: '#F97316' },
                  { label: 'Leocash', color: '#7C3AED' },
                  { label: 'Loans', color: '#0D9488' },
                ].map((item) => (
                  <span
                    key={item.label}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white dark:bg-[#0B162C] border border-slate-200/80 dark:border-slate-800 text-[11px] font-bold text-[#0B2A5B] dark:text-slate-200"
                  >
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                    {item.label}
                  </span>
                ))}
              </div>

              {/* Regulatory Reference */}
              <div className="text-[11px] text-slate-400 border-t border-slate-200 dark:border-slate-800 pt-4 flex items-center gap-2">
                <span>TEAMACRO SERVICES LTD</span>
                <span>•</span>
                <span>RC Number: {config.rcNumber || 'RC-1589421'}</span>
              </div>
            </div>

            {/* Right Column: Authentication Card */}
            <div className="lg:col-span-7 flex justify-center">
              <div className="w-full max-w-lg bg-white dark:bg-[#0B162C] rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-2xl p-6 sm:p-10 relative">
                {/* 1. STATE B: ALREADY INITIALIZED (PERMANENTLY SEALED) */}
                {isAlreadyInitialized && !setupSuccessUser ? (
                  <div className="text-center py-6 space-y-6">
                    <div className="w-16 h-16 rounded-2xl bg-emerald-50 border-2 border-emerald-500/30 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
                      <ShieldCheck size={36} />
                    </div>

                    <div className="space-y-2">
                      <div className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-widest bg-emerald-100 text-emerald-800">
                        Initial Setup Completed
                      </div>
                      <h2 className="text-2xl font-black text-[#0B2A5B]">
                        Lifetime Super Admin registration is permanently locked.
                      </h2>
                      <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed pt-1">
                        The primary administrator has already been established in Firestore. New Super Admin
                        accounts cannot be registered through this page.
                      </p>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-left space-y-2 text-xs">
                      <div className="flex justify-between items-center text-slate-500">
                        <span>Corporate Authority:</span>
                        <span className="font-semibold text-slate-800">Established & Verified</span>
                      </div>
                      <div className="flex justify-between items-center text-slate-500">
                        <span>Database Registry:</span>
                        <span className="font-mono text-slate-700">systemSettings/lifetimeSuperAdmin</span>
                      </div>
                      <div className="flex justify-between items-center text-slate-500">
                        <span>Root Lockdown:</span>
                        <span className="font-mono text-emerald-600 font-bold">PERMANENTLY SEALED</span>
                      </div>
                      <div className="flex justify-between items-center text-slate-500">
                        <span>Governance Policy:</span>
                        <span className="text-slate-700">Single Immutable Root Principle</span>
                      </div>
                    </div>

                    <div className="pt-2">
                      <button
                        onClick={() => onNavigate('/supa-admin')}
                        className="w-full py-3.5 px-4 rounded-xl bg-[#0B2A5B] hover:bg-[#1E5BD8] text-white font-bold text-sm tracking-wide flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer"
                      >
                        <span>Go to Super Admin Login</span>
                        <ArrowRight size={16} />
                      </button>
                    </div>
                  </div>
                ) : setupSuccessUser ? (
                  /* 2. SUCCESS SCREEN IMMEDIATELY AFTER INITIAL SETUP */
                  <div className="text-center py-6 space-y-6 animate-in fade-in duration-300">
                    <div className="w-16 h-16 rounded-2xl bg-emerald-50 border-2 border-emerald-500/30 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
                      <CheckCircle2 size={36} />
                    </div>

                    <div className="space-y-2">
                      <div className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-widest bg-emerald-100 text-emerald-800">
                        Success · Permanent Lock Enforced
                      </div>
                      <h2 className="text-2xl font-black text-[#0B2A5B]">
                        Lifetime Super Admin Setup Completed
                      </h2>
                      <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed pt-1">
                        Your administrator account has been established in Firebase Authentication and Firestore. Initial setup is now permanently locked. You can sign in using your email and master password.
                      </p>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-left space-y-2 text-xs">
                      <div className="flex justify-between items-center text-slate-500">
                        <span>Account Holder:</span>
                        <span className="font-semibold text-slate-800">{setupSuccessUser.fullName}</span>
                      </div>
                      <div className="flex justify-between items-center text-slate-500">
                        <span>Email Address:</span>
                        <span className="font-mono text-slate-800">{setupSuccessUser.email}</span>
                      </div>
                      <div className="flex justify-between items-center text-slate-500">
                        <span>Role Clearance:</span>
                        <span className="font-semibold text-[#1E5BD8]">LIFETIME_SUPER_ADMIN</span>
                      </div>
                      <div className="flex justify-between items-center text-slate-500">
                        <span>Status:</span>
                        <span className="text-emerald-600 font-bold">PERMANENTLY SEALED</span>
                      </div>
                    </div>

                    <div className="pt-2">
                      <button
                        onClick={() => onNavigate('/supa-admin')}
                        className="w-full py-3.5 px-4 rounded-xl bg-[#0B2A5B] hover:bg-[#1E5BD8] text-white font-bold text-sm tracking-wide flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer"
                      >
                        <span>Continue to Super Admin Login</span>
                        <ArrowRight size={16} />
                      </button>
                    </div>
                  </div>
                ) : (
                  /* 3. STATE A: UNINITIALIZED -> INITIAL SETUP FORM */
                  <form onSubmit={handleCreateAccount} className="space-y-5">
                    <div>
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#1E5BD8]/10 text-[#1E5BD8]">
                        One-Time System Initialization
                      </div>
                      <h2 className="text-2xl font-extrabold text-[#0B2A5B] mt-1.5">
                        Create Lifetime Super Admin Account.
                      </h2>
                      <p className="text-xs text-slate-500 mt-1">
                        This is the one-time creation of the system's primary administrator. Once established, this page will be permanently locked.
                      </p>
                    </div>

                    {errorMsg && (
                      <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5">
                        <AlertTriangle size={16} className="shrink-0 mt-0.5 text-rose-600" />
                        <span>{errorMsg}</span>
                      </div>
                    )}

                    <div className="space-y-4">
                      {/* Full Name */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Full Name <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder="e.g. Davidson Eromosele"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E5BD8] focus:border-transparent transition-all"
                          required
                          disabled={submitting}
                        />
                      </div>

                      {/* Email Address */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Corporate Email Address <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="executive@teamacro.ng"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E5BD8] focus:border-transparent transition-all"
                          required
                          disabled={submitting}
                        />
                      </div>

                      {/* Phone Number */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Official Contact Phone
                        </label>
                        <input
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="+234 800 000 0000"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E5BD8] focus:border-transparent transition-all"
                          disabled={submitting}
                        />
                      </div>

                      {/* Password */}
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <label className="text-xs font-bold text-slate-700">
                            Master Password <span className="text-rose-500">*</span>
                          </label>
                          <span className="text-[10px] font-semibold text-slate-400">Min. 10 chars</span>
                        </div>
                        <div className="relative">
                          <input
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••••••"
                            className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E5BD8] focus:border-transparent transition-all"
                            required
                            disabled={submitting}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                          >
                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>

                        {/* Password Strength Indicator */}
                        {password && (
                          <div className="mt-2 space-y-1">
                            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full ${strength.color} transition-all duration-300`}
                                style={{ width: strength.width }}
                              />
                            </div>
                            <div className="flex justify-between text-[10px] text-slate-500">
                              <span>Password Strength: <strong className="text-slate-700">{strength.label}</strong></span>
                              <span>Letters, numbers & symbols</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Confirm Password */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Confirm Master Password <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                          <input
                            type={showConfirmPassword ? 'text' : 'password'}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="••••••••••••"
                            className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E5BD8] focus:border-transparent transition-all"
                            required
                            disabled={submitting}
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                          >
                            {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                      </div>

                      {/* Agreement Checkbox */}
                      <div className="pt-1">
                        <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-600 select-none">
                          <input
                            type="checkbox"
                            checked={agreeSecurity}
                            onChange={(e) => setAgreeSecurity(e.target.checked)}
                            className="mt-0.5 rounded text-[#1E5BD8] focus:ring-[#1E5BD8]"
                            required
                            disabled={submitting}
                          />
                          <span>
                            I confirm that I am the designated Lifetime Super Admin and acknowledge that initial root registration is permanently locked upon completion.
                          </span>
                        </label>
                      </div>
                    </div>

                    <div className="pt-2">
                      <button
                        type="submit"
                        disabled={submitting}
                        className="w-full py-3.5 px-4 rounded-xl bg-[#0B2A5B] hover:bg-[#1E5BD8] text-white font-bold text-sm tracking-wide flex items-center justify-center gap-2 transition-all shadow-md disabled:opacity-50 cursor-pointer"
                      >
                        {submitting ? (
                          <>
                            <RefreshCw size={16} className="animate-spin" />
                            <span>Establishing Root Super Admin in Firestore...</span>
                          </>
                        ) : (
                          <>
                            <span>Establish Lifetime Super Admin</span>
                            <ArrowRight size={16} />
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="w-full bg-white border-t border-slate-200/80 py-4 px-6 text-center text-xs text-slate-400">
        TEAMACRO SERVICES LTD • Centralised Operational Management System • Where Big Dreams Meet Smart Savings
      </footer>
    </div>
  );
};
