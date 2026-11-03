import React, { useState, useEffect } from 'react';
import {
  ArrowRightLeft,
  FileText,
  Building2,
  Users,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Printer,
  X,
  Trash2,
  Eye,
  EyeOff,
  Copy,
  Check,
  LogOut,
  RefreshCw,
} from 'lucide-react';
import {
  BankConfig,
  CustomerAccount,
  Transaction,
  User,
  Beneficiary,
} from '../../types/banking';
import { ledgerEngine } from '../../services/ledgerEngine';
import { nipAdapter, SUPPORTED_BANKS } from '../../services/providerAdapters';
import { BrandLogo } from '../../components/common/BrandLogo';
import {
  formatNaira,
  formatLagosDate,
  nairaToKobo,
} from '../../utils/formatters';

interface CustomerPortalProps {
  config: BankConfig;
  currentUser: User | null;
  onLogin: (user: User) => void;
  onLogout: () => void;
  onNavigate: (route: string) => void;
}

export const CustomerPortal: React.FC<CustomerPortalProps> = ({
  config,
  currentUser,
  onLogin,
  onLogout,
  onNavigate,
}) => {
  // Navigation tabs inside Internet Banking
  const [activeTab, setActiveTab] = useState<'overview' | 'internal_transfer' | 'external_transfer' | 'statements' | 'beneficiaries'>('overview');

  // Login Form State (when not logged in)
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [mfaStep, setMfaStep] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  const [pendingUser, setPendingUser] = useState<User | null>(null);

  // Authoritative State
  const [accounts, setAccounts] = useState<CustomerAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [copiedAccount, setCopiedAccount] = useState<string | null>(null);

  // Active Receipt Modal
  const [receiptTx, setReceiptTx] = useState<Transaction | null>(null);

  // Internal Transfer Form State
  const [internalDestAcc, setInternalDestAcc] = useState('');
  const [internalAmountStr, setInternalAmountStr] = useState('');
  const [internalNarration, setInternalNarration] = useState('');
  const [resolvedRecipientName, setResolvedRecipientName] = useState<string | null>(null);
  const [internalError, setInternalError] = useState('');
  const [isSubmittingInternal, setIsSubmittingInternal] = useState(false);
  const [internalConfirmOpen, setInternalConfirmOpen] = useState(false);

  // External NIP Transfer Form State
  const [nipBankCode, setNipBankCode] = useState('057'); // Zenith Bank default
  const [nipAccNumber, setNipAccNumber] = useState('');
  const [nipResolvedName, setNipResolvedName] = useState<string | null>(null);
  const [nipAmountStr, setNipAmountStr] = useState('');
  const [nipNarration, setNipNarration] = useState('');
  const [isResolvingNip, setIsResolvingNip] = useState(false);
  const [nipError, setNipError] = useState('');
  const [isSubmittingNip, setIsSubmittingNip] = useState(false);
  const [saveAsBeneficiary, setSaveAsBeneficiary] = useState(false);

  // Statement Generator State
  const [statementStartDate, setStatementStartDate] = useState('2026-01-01');
  const [statementEndDate, setStatementEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [statementModalOpen, setStatementModalOpen] = useState(false);

  // Load customer authoritative data
  const refreshCustomerData = () => {
    if (!currentUser) return;
    const userAccounts = ledgerEngine.getCustomerAccounts(currentUser.id);
    setAccounts(userAccounts);
    if (userAccounts.length > 0 && !selectedAccountId) {
      setSelectedAccountId(userAccounts[0].id);
    }

    const allTx = ledgerEngine.getTransactions();
    // Filter transactions involving customer accounts
    const userAccNumbers = new Set(userAccounts.map((a) => a.accountNumber));
    const userTx = allTx.filter(
      (t) =>
        (t.sourceAccountNumber && userAccNumbers.has(t.sourceAccountNumber)) ||
        (t.destinationAccountNumber && userAccNumbers.has(t.destinationAccountNumber)) ||
        t.initiatedById === currentUser.id
    );
    setTransactions(userTx);

    setBeneficiaries(ledgerEngine.getBeneficiaries(currentUser.id));
  };

  useEffect(() => {
    refreshCustomerData();
    const unsub = ledgerEngine.subscribe((event) => {
      if (['TRANSACTION_POSTED', 'TRANSACTION_REVERSED', 'APPLICATION_REVIEWED'].includes(event.type)) {
        refreshCustomerData();
      }
    });
    return unsub;
  }, [currentUser]);

  // Handle Internal Name Resolution (Account Number Lookup)
  useEffect(() => {
    if (internalDestAcc.length === 10) {
      const recipient = ledgerEngine.getAccountByNumber(internalDestAcc);
      if (recipient) {
        setResolvedRecipientName(recipient.name || recipient.accountName || null);
        setInternalError('');
      } else {
        setResolvedRecipientName(null);
        setInternalError('No account found with this 10-digit NUBAN.');
      }
    } else {
      setResolvedRecipientName(null);
      setInternalError('');
    }
  }, [internalDestAcc]);

  // Handle External NIP Name Resolution via Adapter
  const handleResolveNip = async () => {
    if (nipAccNumber.length !== 10) {
      setNipError('Please enter a 10-digit NUBAN number.');
      return;
    }
    setNipError('');
    setIsResolvingNip(true);
    try {
      const result = await nipAdapter.nameEnquiry({ bankCode: nipBankCode, accountNumber: nipAccNumber });
      if (result.success && result.accountName) {
        setNipResolvedName(result.accountName);
      } else {
        setNipError(result.message || 'Name inquiry failed.');
      }
    } catch {
      setNipError('Switch timeout. Please recheck the account number.');
    } finally {
      setIsResolvingNip(false);
    }
  };

  // Execute Internal Transfer
  const handleExecuteInternal = async () => {
    if (!currentUser || !resolvedRecipientName) return;
    setInternalError('');
    setIsSubmittingInternal(true);

    try {
      const amountKobo = nairaToKobo(internalAmountStr);
      const idempotencyKey = `IDEM-INT-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

      const { transaction } = await ledgerEngine.executeInternalTransfer({
        actor: currentUser,
        sourceAccountId: selectedAccountId,
        destinationAccountNumber: internalDestAcc,
        amountKobo,
        narration: internalNarration || `TEAMACRO Transfer to ${resolvedRecipientName}`,
        idempotencyKey,
      });

      setReceiptTx(transaction);
      setInternalConfirmOpen(false);
      setInternalAmountStr('');
      setInternalDestAcc('');
      setInternalNarration('');
      refreshCustomerData();
    } catch (err: any) {
      setInternalError(err.message || 'Transfer failed.');
    } finally {
      setIsSubmittingInternal(false);
    }
  };

  // Execute External NIP Transfer
  const handleExecuteNip = async () => {
    if (!currentUser || !nipResolvedName) return;
    setNipError('');
    setIsSubmittingNip(true);

    try {
      const amountKobo = nairaToKobo(nipAmountStr);
      const bank = SUPPORTED_BANKS.find((b) => b.code === nipBankCode);
      const idempotencyKey = `IDEM-NIP-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

      const { transaction } = await ledgerEngine.executeExternalTransfer({
        actor: currentUser,
        sourceAccountId: selectedAccountId,
        destinationBankCode: nipBankCode,
        destinationBankName: bank?.name || 'Commercial Bank',
        destinationAccountNumber: nipAccNumber,
        destinationAccountName: nipResolvedName,
        amountKobo,
        narration: nipNarration,
        idempotencyKey,
      });

      if (saveAsBeneficiary) {
        ledgerEngine.addBeneficiary({
          userId: currentUser.id,
          accountNumber: nipAccNumber,
          accountName: nipResolvedName,
          bankName: bank?.name || 'Commercial Bank',
          bankCode: nipBankCode,
        });
      }

      setReceiptTx(transaction);
      setNipAmountStr('');
      setNipAccNumber('');
      setNipNarration('');
      setNipResolvedName(null);
      refreshCustomerData();
    } catch (err: any) {
      setNipError(err.message || 'External transfer failed.');
    } finally {
      setIsSubmittingNip(false);
    }
  };


  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    const user = ledgerEngine.getUserByEmail(loginEmail);
    if (!user) {
      setLoginError('Account not found. Please check your email or sign up.');
      return;
    }
    // Simulate 2FA step
    setPendingUser(user);
    setMfaStep(true);
  };

  const handleVerifyMfa = (e: React.FormEvent) => {
    e.preventDefault();
    if (mfaCode.length < 4) {
      setLoginError('Enter the 6-digit verification code.');
      return;
    }
    if (pendingUser) {
      onLogin(pendingUser);
      setMfaStep(false);
      setPendingUser(null);
      setMfaCode('');
    }
  };

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId) || accounts[0];

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedAccount(text);
    setTimeout(() => setCopiedAccount(null), 2000);
  };

  // If customer is NOT signed in, render the secure authentication interface
  if (!currentUser) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center py-12 px-4 bg-[#F0F2F8]">
        <div className="w-full max-w-md bg-white border border-[#E0E4EE] rounded-2xl shadow-xl p-8 space-y-6">
          <div className="text-center space-y-3">
            <BrandLogo variant="card" size="md" className="mx-auto" />
            <div className="space-y-1">
              <h1 className="text-2xl font-extrabold text-[#091747]">Customer Internet Banking</h1>
              <p className="text-xs text-[#667085]">
                Sign in to manage your {config.bankName} accounts securely.
              </p>
            </div>
          </div>

          {loginError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-xs flex items-center gap-2">
              <AlertTriangle size={15} className="shrink-0" />
              <span>{loginError}</span>
            </div>
          )}

          {mfaStep ? (
            /* 2FA Step-Up Verification */
            <form onSubmit={handleVerifyMfa} className="space-y-4">
              <div className="p-3 rounded bg-[#F9C928]/15 border border-[#F9C928]/40 text-[#091747] text-xs space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <ShieldCheck size={16} className="text-[#263F91]" /> Two-Factor Authentication (2FA)
                </div>
                <div>A 6-digit authorization code was dispatched to your registered phone number.</div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#172033] mb-1">Enter 6-Digit OTP Code</label>
                <input
                  type="text"
                  maxLength={6}
                  autoFocus
                  required
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value)}
                  placeholder="e.g. 849201 (Enter any 6 digits)"
                  className="w-full text-center tracking-widest font-mono text-base px-3 py-2.5 border border-[#E0E4EE] rounded focus:border-[#263F91] focus:ring-1 focus:ring-[#263F91] focus:outline-hidden"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 text-xs font-bold uppercase tracking-wider text-white bg-[#263F91] hover:bg-[#1e3375] rounded shadow-md transition-colors cursor-pointer"
              >
                Verify & Access Account →
              </button>

              <button
                type="button"
                onClick={() => setMfaStep(false)}
                className="w-full text-center text-xs text-[#667085] hover:text-[#172033] cursor-pointer"
              >
                Back to credentials
              </button>
            </form>
          ) : (
            /* Email & Password Form */
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#172033] mb-1">Email or NUBAN Account</label>
                <input
                  type="text"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="customer@email.com"
                  className="w-full text-xs px-3 py-2.5 border border-[#E0E4EE] dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded focus:border-[#263F91] focus:ring-1 focus:ring-[#263F91] focus:outline-hidden"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-bold text-[#172033] dark:text-slate-200">Internet Banking Password</label>
                  <button
                    type="button"
                    onClick={() => setLoginError('Password reset instructions dispatched to your registered phone & email.')}
                    className="text-[11px] text-[#263F91] dark:text-blue-400 hover:underline cursor-pointer"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full text-xs px-3 py-2.5 border border-[#E0E4EE] dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded focus:border-[#263F91] focus:ring-1 focus:ring-[#263F91] focus:outline-hidden pr-9"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-2.5 text-[#667085] hover:text-[#172033] dark:hover:text-white cursor-pointer"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 text-xs font-bold uppercase tracking-wider text-white bg-[#263F91] hover:bg-[#1e3375] rounded shadow-md transition-colors cursor-pointer"
              >
                Proceed to 2FA Verification →
              </button>
            </form>
          )}

          <div className="text-center text-xs text-[#667085] pt-2 border-t border-[#E0E4EE]">
            Don't have an account yet?{' '}
            <button
              onClick={() => onNavigate('/open-account')}
              className="text-[#263F91] font-bold underline cursor-pointer"
            >
              Open an Account Online
            </button>
          </div>
        </div>
      </div>
    );
  }

  // AUTHENTICATED CUSTOMER DASHBOARD
  return (
    <div className="min-h-screen bg-[#F0F2F8] dark:bg-[#070F2C] text-[#172033] dark:text-slate-100 pb-20">
      {/* Top Banking App Header */}
      <div className="bg-[#091747] text-white border-b border-[#263F91]/40">
        <div className="max-w-7xl mx-auto px-4 py-3.5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div
              onClick={() => onNavigate('/')}
              className="cursor-pointer hover:opacity-95 transition-opacity"
              title="Return to TEAMACRO SERVICES LTD Homepage"
            >
              <BrandLogo variant="badge" theme="dark" size="sm" />
            </div>
            <div className="h-8 w-px bg-[#263F91]" />
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#0b1c54] border-2 border-[#F9C928] text-[#F9C928] font-bold flex items-center justify-center text-sm shadow-xs">
                {currentUser.fullName.split(' ').map((n) => n[0]).join('').slice(0, 2)}
              </div>
              <div>
                <div className="text-[11px] text-slate-300">Authenticated Customer Portal</div>
                <div className="text-sm font-bold text-white flex items-center gap-2">
                  <span>{currentUser.fullName}</span>
                  <span className="text-[9px] font-semibold text-emerald-300 bg-emerald-950/60 border border-emerald-700 px-1.5 py-0.5 rounded">
                    Active
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <button
              onClick={refreshCustomerData}
              className="px-3 py-1.5 rounded bg-[#263F91]/50 hover:bg-[#263F91] text-slate-200 flex items-center gap-1.5 transition-colors border border-[#263F91]/60 cursor-pointer"
            >
              <RefreshCw size={13} />
              <span>Sync Balance</span>
            </button>
            <button
              onClick={onLogout}
              className="px-3 py-1.5 rounded bg-[#9F291E]/30 border border-[#9F291E] hover:bg-[#9F291E] text-rose-200 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <LogOut size={13} />
              <span>Sign Out</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="max-w-7xl mx-auto px-4 flex overflow-x-auto gap-2 pt-2 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2.5 rounded-t-lg transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'overview'
                ? 'bg-[#F0F2F8] dark:bg-[#070F2C] text-[#091747] dark:text-[#F9C928] font-bold border-t-2 border-[#F9C928]'
                : 'text-slate-300 hover:text-white hover:bg-[#263F91]/40'
            }`}
          >
            Accounts Overview
          </button>
          <button
            onClick={() => setActiveTab('internal_transfer')}
            className={`px-4 py-2.5 rounded-t-lg transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'internal_transfer'
                ? 'bg-[#F0F2F8] dark:bg-[#070F2C] text-[#091747] dark:text-[#F9C928] font-bold border-t-2 border-[#F9C928]'
                : 'text-slate-300 hover:text-white hover:bg-[#263F91]/40'
            }`}
          >
            <ArrowRightLeft size={14} />
            <span>TEAMACRO Internal Transfer</span>
          </button>
          <button
            onClick={() => setActiveTab('external_transfer')}
            className={`px-4 py-2.5 rounded-t-lg transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'external_transfer'
                ? 'bg-[#F0F2F8] dark:bg-[#070F2C] text-[#091747] dark:text-[#F9C928] font-bold border-t-2 border-[#F9C928]'
                : 'text-slate-300 hover:text-white hover:bg-[#263F91]/40'
            }`}
          >
            <Building2 size={14} />
            <span>NIP Interbank Transfer</span>
          </button>
          <button
            onClick={() => setActiveTab('statements')}
            className={`px-4 py-2.5 rounded-t-lg transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'statements'
                ? 'bg-[#F0F2F8] text-[#091747] font-bold border-t-2 border-[#F9C928]'
                : 'text-slate-300 hover:text-white hover:bg-[#263F91]/40'
            }`}
          >
            <FileText size={14} />
            <span>Certified Statements</span>
          </button>
          <button
            onClick={() => setActiveTab('beneficiaries')}
            className={`px-4 py-2.5 rounded-t-lg transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'beneficiaries'
                ? 'bg-[#F0F2F8] text-[#091747] font-bold border-t-2 border-[#F9C928]'
                : 'text-slate-300 hover:text-white hover:bg-[#263F91]/40'
            }`}
          >
            <Users size={14} />
            <span>Beneficiaries</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {/* ============================================================== */}
        {/* 1. OVERVIEW TAB: ACCOUNTS & TRANSACTIONS */}
        {/* ============================================================== */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Account Selector Cards */}
            <div>
              <div className="text-xs font-bold text-[#667085] uppercase tracking-wider mb-3">
                Your Operating Accounts
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {accounts.map((acc) => (
                  <div
                    key={acc.id}
                    onClick={() => setSelectedAccountId(acc.id)}
                    className={`p-6 rounded-2xl border cursor-pointer transition-all ${
                      selectedAccountId === acc.id
                        ? 'bg-white border-[#263F91] shadow-lg ring-2 ring-[#263F91]/20'
                        : 'bg-white border-[#E0E4EE] hover:border-[#263F91]/50 shadow-xs'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#9F291E] bg-[#9F291E]/10 px-2 py-0.5 rounded">
                          {(acc.type || acc.accountType || 'SAVINGS').replace('_', ' ')} · Tier {acc.tier}
                        </span>
                        <h3 className="text-sm font-bold text-[#172033] mt-2 truncate">{acc.name}</h3>
                      </div>
                      <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                        {acc.status}
                      </span>
                    </div>

                    <div className="mt-4 pt-4 border-t border-[#E0E4EE] space-y-1">
                      <div className="text-xs text-[#667085]">Available Balance:</div>
                      <div className="text-2xl font-extrabold text-[#091747]">
                        {formatNaira(acc.availableBalanceKobo)}
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-[#E0E4EE] flex items-center justify-between text-xs text-[#667085]">
                      <div className="flex items-center gap-1.5 font-mono">
                        <span>NUBAN:</span>
                        <strong className="text-[#172033]">{acc.accountNumber}</strong>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopy(acc.accountNumber);
                        }}
                        className="text-[#667085] hover:text-[#091747] p-1 cursor-pointer"
                        title="Copy Account Number"
                      >
                        {copiedAccount === acc.accountNumber ? (
                          <Check size={14} className="text-emerald-600" />
                        ) : (
                          <Copy size={14} />
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Actions Bar */}
            <div className="bg-white p-4 rounded-xl border border-[#E0E4EE] shadow-xs flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#172033]">Quick Operations:</span>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => setActiveTab('internal_transfer')}
                  className="px-4 py-2 text-xs font-bold uppercase text-white bg-[#263F91] hover:bg-[#1e3375] rounded shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <ArrowRightLeft size={14} />
                  <span>TEAMACRO Internal Transfer</span>
                </button>
                <button
                  onClick={() => setActiveTab('external_transfer')}
                  className="px-4 py-2 text-xs font-bold uppercase text-[#091747] bg-[#F9C928] hover:bg-[#eab920] rounded shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Building2 size={14} />
                  <span>NIP Interbank Transfer</span>
                </button>
                <button
                  onClick={() => setStatementModalOpen(true)}
                  className="px-4 py-2 text-xs font-bold uppercase text-[#172033] bg-[#F0F2F8] hover:bg-[#e4e7f0] border border-[#E0E4EE] rounded transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <FileText size={14} />
                  <span>Official Statement</span>
                </button>
              </div>
            </div>

            {/* Authoritative Transaction History */}
            <div className="bg-white rounded-xl border border-[#E0E4EE] shadow-xs overflow-hidden">
              <div className="p-4 bg-[#F0F2F8] border-b border-[#E0E4EE] flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-[#091747]">Authoritative Transaction Ledger</h3>
                  <div className="text-[11px] text-[#667085]">
                    Showing historical entries linked to account {selectedAccount?.accountNumber}
                  </div>
                </div>
                <span className="text-xs font-mono text-[#667085]">
                  {transactions.length} Records Found
                </span>
              </div>

              {transactions.length === 0 ? (
                <div className="p-12 text-center text-[#667085] text-xs">
                  No transaction history recorded yet for this account.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#F0F2F8]/70 border-b border-[#E0E4EE] text-[#172033] font-semibold uppercase">
                      <tr>
                        <th className="p-3">Date (WAT)</th>
                        <th className="p-3">Reference</th>
                        <th className="p-3">Description</th>
                        <th className="p-3">Channel</th>
                        <th className="p-3 text-right">Amount</th>
                        <th className="p-3 text-center">Status</th>
                        <th className="p-3 text-center">Receipt</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E0E4EE] text-[#172033]">
                      {transactions.map((tx) => {
                        const isDebit = tx.sourceAccountNumber === selectedAccount?.accountNumber;
                        return (
                          <tr key={tx.id} className="hover:bg-[#F0F2F8]/50 transition-colors">
                            <td className="p-3 whitespace-nowrap text-[#667085] font-mono">
                              {formatLagosDate(tx.createdAt, true)}
                            </td>
                            <td className="p-3 font-mono font-semibold text-[#091747]">
                              {tx.reference}
                            </td>
                            <td className="p-3">
                              <div className="font-semibold text-[#172033] truncate max-w-xs">{tx.narration}</div>
                              <div className="text-[10px] text-[#667085]">
                                {isDebit
                                  ? `To: ${tx.destinationAccountName || tx.destinationAccountNumber || tx.destinationBankName}`
                                  : `From: ${tx.sourceAccountName || tx.sourceAccountNumber || 'Cash Deposit'}`}
                              </div>
                            </td>
                            <td className="p-3 text-[11px] text-[#667085]">
                              {(tx.channel || 'SYSTEM').replace('_', ' ')}
                            </td>
                            <td className={`p-3 text-right font-bold whitespace-nowrap ${isDebit ? 'text-[#9F291E]' : 'text-emerald-700'}`}>
                              {isDebit ? '-' : '+'}{formatNaira(tx.amountKobo)}
                            </td>
                            <td className="p-3 text-center">
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                                tx.status === 'SUCCESSFUL'
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : tx.status === 'REVERSED'
                                  ? 'bg-purple-50 text-purple-700'
                                  : tx.status === 'FAILED'
                                  ? 'bg-red-50 text-red-700'
                                  : 'bg-amber-50 text-amber-700'
                              }`}>
                                {tx.status}
                              </span>
                            </td>
                            <td className="p-3 text-center">
                              <button
                                onClick={() => setReceiptTx(tx)}
                                className="px-2 py-1 text-[11px] font-semibold text-[#263F91] hover:bg-[#263F91]/10 rounded transition-colors cursor-pointer"
                              >
                                View
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* 2. INTERNAL TRANSFER TAB (TEAMACRO TO TEAMACRO) */}
        {/* ============================================================== */}
        {activeTab === 'internal_transfer' && (
          <div className="max-w-2xl mx-auto bg-white dark:bg-[#0B1536] border border-[#E0E4EE] dark:border-[#1E2E64] rounded-2xl shadow-md p-6 sm:p-8 space-y-6">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#263F91]/10 text-[#263F91] dark:bg-blue-900/40 dark:text-blue-300 text-[10px] font-bold uppercase mb-2">
                TEAMACRO Internal Transfer
              </div>
              <h2 className="text-xl font-bold text-[#091747] dark:text-white">Transfer to a TEAMACRO Account</h2>
              <p className="text-xs text-[#667085] dark:text-slate-400">
                Instant clearing with zero transfer fees across all accounts within this system.
              </p>
            </div>

            {internalError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-xs flex items-center gap-2">
                <AlertTriangle size={15} className="shrink-0" />
                <span>{internalError}</span>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#172033] mb-1">Source Account</label>
                <select
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  className="w-full text-xs px-3 py-2.5 border border-[#E0E4EE] rounded focus:border-[#263F91] focus:ring-1 focus:ring-[#263F91] focus:outline-hidden"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.accountNumber}) — Bal: {formatNaira(a.availableBalanceKobo)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#172033] mb-1">Recipient 10-Digit Account Number</label>
                <input
                  type="text"
                  maxLength={10}
                  value={internalDestAcc}
                  onChange={(e) => setInternalDestAcc(e.target.value.replace(/\D/g, ''))}
                  placeholder="e.g. 2038192044"
                  className="w-full text-xs font-mono px-3 py-2.5 border border-[#E0E4EE] rounded focus:border-[#263F91] focus:ring-1 focus:ring-[#263F91] focus:outline-hidden"
                />
                {resolvedRecipientName && (
                  <div className="mt-1.5 p-2 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-1.5">
                    <CheckCircle2 size={14} />
                    <span>Verified Recipient: {resolvedRecipientName}</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-[#172033] mb-1">Amount to Transfer (NGN)</label>
                <input
                  type="number"
                  min="100"
                  step="50"
                  value={internalAmountStr}
                  onChange={(e) => setInternalAmountStr(e.target.value)}
                  placeholder="50000"
                  className="w-full text-xs px-3 py-2.5 font-bold border border-[#E0E4EE] rounded focus:border-[#263F91] focus:ring-1 focus:ring-[#263F91] focus:outline-hidden"
                />
                <div className="text-[11px] text-[#667085] mt-1">
                  Amount: {internalAmountStr ? formatNaira(nairaToKobo(internalAmountStr)) : '₦0.00'} · Fee: <strong className="text-emerald-700">₦0.00 (FREE)</strong>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#172033] mb-1">Transfer Description / Narration</label>
                <input
                  type="text"
                  maxLength={100}
                  value={internalNarration}
                  onChange={(e) => setInternalNarration(e.target.value)}
                  placeholder="e.g. Payment for business supplies"
                  className="w-full text-xs px-3 py-2.5 border border-[#E0E4EE] rounded focus:border-[#263F91] focus:ring-1 focus:ring-[#263F91] focus:outline-hidden"
                />
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  disabled={!resolvedRecipientName || !internalAmountStr || isSubmittingInternal}
                  onClick={() => setInternalConfirmOpen(true)}
                  className="w-full py-3 text-xs font-bold uppercase tracking-wider text-white bg-[#263F91] hover:bg-[#1e3375] disabled:bg-[#667085] rounded shadow-md transition-colors cursor-pointer"
                >
                  Review & Authorize Transfer →
                </button>
              </div>
            </div>

            {/* Confirmation Modal */}
            {internalConfirmOpen && (
              <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
                <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 space-y-4 border border-[#E0E4EE]">
                  <div className="flex items-center justify-between pb-2 border-b border-[#E0E4EE]">
                    <h3 className="text-base font-bold text-[#091747]">Confirm Internal Transfer</h3>
                    <button onClick={() => setInternalConfirmOpen(false)} className="text-[#667085] hover:text-[#172033] cursor-pointer">
                      <X size={18} />
                    </button>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-[#E0E4EE]">
                      <span className="text-[#667085]">Source Account:</span>
                      <strong className="text-[#172033]">{selectedAccount?.name} ({selectedAccount?.accountNumber})</strong>
                    </div>
                    <div className="flex justify-between py-1 border-b border-[#E0E4EE]">
                      <span className="text-[#667085]">Recipient Name:</span>
                      <strong className="text-[#263F91]">{resolvedRecipientName}</strong>
                    </div>
                    <div className="flex justify-between py-1 border-b border-[#E0E4EE]">
                      <span className="text-[#667085]">Recipient Account:</span>
                      <span className="font-mono text-[#172033]">{internalDestAcc}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-[#E0E4EE]">
                      <span className="text-[#667085]">Amount:</span>
                      <strong className="text-[#091747] text-sm">{formatNaira(nairaToKobo(internalAmountStr))}</strong>
                    </div>
                    <div className="flex justify-between py-1 border-b border-[#E0E4EE]">
                      <span className="text-[#667085]">Tariff / Fee:</span>
                      <strong className="text-emerald-700">₦0.00 (Free)</strong>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-[#667085]">Narration:</span>
                      <span className="text-[#172033] dark:text-white">{internalNarration || 'TEAMACRO Internal Transfer'}</span>
                    </div>
                  </div>

                  <div className="pt-2 flex gap-3">
                    <button
                      type="button"
                      onClick={() => setInternalConfirmOpen(false)}
                      className="flex-1 py-2.5 text-xs font-bold text-[#172033] bg-[#F0F2F8] border border-[#E0E4EE] hover:bg-[#e4e7f0] rounded cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={isSubmittingInternal}
                      onClick={handleExecuteInternal}
                      className="flex-1 py-2.5 text-xs font-bold uppercase tracking-wider text-white bg-[#263F91] hover:bg-[#1e3375] rounded shadow-md cursor-pointer"
                    >
                      {isSubmittingInternal ? 'Posting Ledger...' : 'Commit Transfer'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* 3. EXTERNAL NIP TRANSFER TAB */}
        {/* ============================================================== */}
        {activeTab === 'external_transfer' && (
          <div className="max-w-2xl mx-auto bg-white border border-[#E0E4EE] rounded-2xl shadow-md p-6 sm:p-8 space-y-6">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#263F91]/10 text-[#263F91] text-[10px] font-bold uppercase mb-2">
                NIBSS Instant Payment (NIP)
              </div>
              <h2 className="text-xl font-bold text-[#091747]">Transfer to Other Commercial Banks</h2>
              <p className="text-xs text-[#667085]">
                Send funds to Zenith, Access, GTBank, FirstBank, UBA, Kuda, and 15+ Nigerian financial institutions.
              </p>
            </div>

            {nipError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-xs flex items-center gap-2">
                <AlertTriangle size={15} className="shrink-0" />
                <span>{nipError}</span>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#172033] mb-1">Source Account</label>
                <select
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  className="w-full text-xs px-3 py-2.5 border border-[#E0E4EE] rounded focus:border-[#263F91] focus:ring-1 focus:ring-[#263F91] focus:outline-hidden"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.accountNumber}) — Bal: {formatNaira(a.availableBalanceKobo)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#172033] mb-1">Destination Bank</label>
                <select
                  value={nipBankCode}
                  onChange={(e) => {
                    setNipBankCode(e.target.value);
                    setNipResolvedName(null);
                  }}
                  className="w-full text-xs px-3 py-2.5 border border-[#E0E4EE] rounded focus:border-[#263F91] focus:ring-1 focus:ring-[#263F91] focus:outline-hidden"
                >
                  {SUPPORTED_BANKS.map((b) => (
                    <option key={b.code} value={b.code}>
                      {b.name} ({b.category.replace('_', ' ')})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#172033] mb-1">Recipient 10-Digit NUBAN</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    maxLength={10}
                    value={nipAccNumber}
                    onChange={(e) => {
                      setNipAccNumber(e.target.value.replace(/\D/g, ''));
                      setNipResolvedName(null);
                    }}
                    placeholder="e.g. 1004819205"
                    className="flex-1 text-xs font-mono px-3 py-2.5 border border-[#E0E4EE] rounded focus:border-[#263F91] focus:ring-1 focus:ring-[#263F91] focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={handleResolveNip}
                    disabled={isResolvingNip || nipAccNumber.length !== 10}
                    className="px-4 py-2.5 text-xs font-bold text-white bg-[#263F91] hover:bg-[#1e3375] disabled:bg-[#667085] rounded transition-colors cursor-pointer"
                  >
                    {isResolvingNip ? 'Inquiring...' : 'Enquire Name'}
                  </button>
                </div>

                {nipResolvedName && (
                  <div className="mt-2 p-2.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 size={15} />
                      <span>Verified: {nipResolvedName}</span>
                    </span>
                    <span className="text-[10px] text-emerald-600 font-mono">NIP Code: 00</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-[#172033] mb-1">Amount to Transfer (NGN)</label>
                <input
                  type="number"
                  min="100"
                  step="100"
                  value={nipAmountStr}
                  onChange={(e) => setNipAmountStr(e.target.value)}
                  placeholder="25000"
                  className="w-full text-xs px-3 py-2.5 font-bold border border-[#E0E4EE] rounded focus:border-[#263F91] focus:ring-1 focus:ring-[#263F91] focus:outline-hidden"
                />
                <div className="text-[11px] text-[#667085] mt-1">
                  Statutory Tariff: Below ₦5k: ₦10.75 · ₦5k–₦50k: ₦26.88 · Above ₦50k: ₦53.75
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#172033] mb-1">Narration / Payment Reference</label>
                <input
                  type="text"
                  maxLength={100}
                  value={nipNarration}
                  onChange={(e) => setNipNarration(e.target.value)}
                  placeholder="e.g. Invoice payment for goods"
                  className="w-full text-xs px-3 py-2.5 border border-[#E0E4EE] rounded focus:border-[#263F91] focus:ring-1 focus:ring-[#263F91] focus:outline-hidden"
                />
              </div>

              <label className="flex items-center gap-2 text-xs text-[#172033] cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={saveAsBeneficiary}
                  onChange={(e) => setSaveAsBeneficiary(e.target.checked)}
                  className="accent-[#263F91]"
                />
                <span>Save this recipient to my beneficiaries list</span>
              </label>

              <div className="pt-2">
                <button
                  type="button"
                  disabled={!nipResolvedName || !nipAmountStr || isSubmittingNip}
                  onClick={handleExecuteNip}
                  className="w-full py-3 text-xs font-bold uppercase tracking-wider text-white bg-[#263F91] hover:bg-[#1e3375] disabled:bg-[#667085] rounded shadow-md transition-colors cursor-pointer"
                >
                  {isSubmittingNip ? 'Routing via NIBSS...' : 'Transmit NIP Transfer →'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* 4. OFFICIAL CERTIFIED STATEMENTS */}
        {/* ============================================================== */}
        {(activeTab === 'statements' || statementModalOpen) && (
          <div className="max-w-4xl mx-auto bg-white border border-[#E0E4EE] rounded-2xl shadow-md p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#263F91]/10 text-[#263F91] text-[10px] font-bold uppercase mb-2">
                  Official Statement Generator
                </div>
                <h2 className="text-xl font-bold text-[#091747]">Certified Account Statement</h2>
                <p className="text-xs text-[#667085]">
                  Generate official statement with bank stamp for embassy, visa, or audit purposes.
                </p>
              </div>
              <div className="flex items-center gap-2 no-print">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 text-xs font-bold text-white bg-[#263F91] hover:bg-[#1e3375] rounded shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer size={14} />
                  <span>Print Official Statement</span>
                </button>
              </div>
            </div>

            {/* Date Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 no-print bg-[#F0F2F8] p-4 rounded-xl border border-[#E0E4EE]">
              <div>
                <label className="block text-xs font-bold text-[#172033] mb-1">Select Account</label>
                <select
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-[#E0E4EE] rounded bg-white text-[#172033]"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.name} ({a.accountNumber})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-[#172033] mb-1">Start Date</label>
                <input
                  type="date"
                  value={statementStartDate}
                  onChange={(e) => setStatementStartDate(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-[#E0E4EE] rounded bg-white text-[#172033]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#172033] mb-1">End Date</label>
                <input
                  type="date"
                  value={statementEndDate}
                  onChange={(e) => setStatementEndDate(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-[#E0E4EE] rounded bg-white text-[#172033]"
                />
              </div>
            </div>

            {/* Print-ready Certified Statement Template */}
            <div className="p-8 border border-[#E0E4EE] rounded-xl space-y-6 print-page bg-white">
              {/* Bank Header */}
              <div className="flex items-start justify-between pb-6 border-b-2 border-[#091747]">
                <div>
                  <div className="text-xl font-black text-[#091747] tracking-tight">{config.bankName}</div>
                  <div className="text-[11px] text-[#667085]">{config.headOffice}</div>
                  <div className="text-[10px] text-[#667085] font-mono mt-0.5">
                    RC: {config.rcNumber || '1589421'} · TEAMACRO SERVICES LTD
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold uppercase tracking-wider text-[#9F291E]">Official Statement</div>
                  <div className="text-xs font-mono text-[#172033] font-bold mt-1">
                    Generated: {formatLagosDate(new Date().toISOString(), true)}
                  </div>
                </div>
              </div>

              {/* Account & Customer Summary */}
              <div className="grid grid-cols-2 gap-4 text-xs bg-[#F0F2F8] p-4 rounded-lg border border-[#E0E4EE]">
                <div className="space-y-1">
                  <div>Account Name: <strong className="text-[#172033]">{selectedAccount?.name}</strong></div>
                  <div>Account Number: <strong className="font-mono text-[#091747]">{selectedAccount?.accountNumber}</strong></div>
                  <div>Account Type: <span className="text-[#667085]">{selectedAccount?.type} (Tier {selectedAccount?.tier})</span></div>
                  <div>Currency: <strong>Nigerian Naira (NGN)</strong></div>
                </div>
                <div className="space-y-1 text-right">
                  <div>Statement Period: <strong>{statementStartDate} to {statementEndDate}</strong></div>
                  <div>Current Balance: <strong className="text-base text-[#091747]">{formatNaira(selectedAccount?.balanceKobo)}</strong></div>
                  <div>Branch: <span className="text-[#667085]">Victoria Island Head Office</span></div>
                </div>
              </div>

              {/* Transaction Lines */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border border-[#E0E4EE]">
                  <thead className="bg-[#F0F2F8] border-b border-[#E0E4EE] font-bold text-[#172033]">
                    <tr>
                      <th className="p-2 border-r border-[#E0E4EE]">Date</th>
                      <th className="p-2 border-r border-[#E0E4EE]">Reference</th>
                      <th className="p-2 border-r border-[#E0E4EE]">Narration</th>
                      <th className="p-2 text-right border-r border-[#E0E4EE]">Debit (₦)</th>
                      <th className="p-2 text-right border-r border-[#E0E4EE]">Credit (₦)</th>
                      <th className="p-2 text-right">Balance (₦)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E0E4EE] text-[#172033]">
                    {transactions.map((tx) => {
                      const isDebit = tx.sourceAccountNumber === selectedAccount?.accountNumber;
                      return (
                        <tr key={tx.id}>
                          <td className="p-2 font-mono whitespace-nowrap border-r border-[#E0E4EE]">{formatLagosDate(tx.createdAt, false)}</td>
                          <td className="p-2 font-mono border-r border-[#E0E4EE]">{tx.reference}</td>
                          <td className="p-2 border-r border-[#E0E4EE]">{tx.narration}</td>
                          <td className="p-2 text-right font-mono border-r border-[#E0E4EE] text-[#9F291E]">
                            {isDebit ? formatNaira(tx.amountKobo, false) : '—'}
                          </td>
                          <td className="p-2 text-right font-mono border-r border-[#E0E4EE] text-emerald-700">
                            {!isDebit ? formatNaira(tx.amountKobo, false) : '—'}
                          </td>
                          <td className="p-2 text-right font-mono font-bold text-[#091747]">
                            {formatNaira(selectedAccount?.balanceKobo, false)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Certified Official Bank Stamp Stamp & QR */}
              <div className="pt-6 border-t border-[#E0E4EE] flex items-center justify-between text-xs text-[#667085]">
                <div>
                  <div className="font-bold text-[#172033] uppercase">Certified System Statement</div>
                  <div className="text-[10px]">Authoritative record from double-entry ledger. No physical signature required.</div>
                </div>
                <div className="border-2 border-dashed border-[#091747] p-3 rounded text-center bg-[#F0F2F8]">
                  <div className="text-[10px] font-bold text-[#091747] uppercase">{config.bankName}</div>
                  <div className="text-[9px] text-[#667085]">OFFICIAL DIGITAL SEAL</div>
                  <div className="text-[9px] font-mono text-[#263F91] font-bold">VERIFIED AUTHENTIC</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* 5. BENEFICIARIES TAB */}
        {/* ============================================================== */}
        {activeTab === 'beneficiaries' && (
          <div className="max-w-4xl mx-auto bg-white border border-[#E0E4EE] rounded-2xl shadow-md p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-[#091747]">Saved Beneficiaries</h2>
                <p className="text-xs text-[#667085]">Quickly send money to regular business partners and family.</p>
              </div>
            </div>

            {beneficiaries.length === 0 ? (
              <div className="p-12 text-center text-[#667085] text-xs">
                No beneficiaries saved yet. You can tick "Save beneficiary" during an external transfer.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {beneficiaries.map((b) => (
                  <div key={b.id} className="p-4 rounded-xl border border-[#E0E4EE] bg-[#F0F2F8] flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-[#172033]">{b.accountName}</div>
                      <div className="text-[11px] font-mono text-[#667085]">{b.accountNumber} · {b.bankName}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setNipBankCode(b.bankCode);
                          setNipAccNumber(b.accountNumber);
                          setNipResolvedName(b.accountName);
                          setActiveTab('external_transfer');
                        }}
                        className="px-3 py-1 text-xs font-bold text-[#091747] bg-[#F9C928] hover:bg-[#eab920] rounded cursor-pointer"
                      >
                        Send
                      </button>
                      <button
                        onClick={() => {
                          ledgerEngine.deleteBeneficiary(b.id);
                          refreshCustomerData();
                        }}
                        className="p-1 text-[#667085] hover:text-[#9F291E] rounded cursor-pointer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* 6. OFFICIAL TRANSACTION RECEIPT MODAL */}
      {/* ============================================================== */}
      {receiptTx && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 sm:p-8 space-y-6 border border-[#E0E4EE]">
            <div className="flex items-center justify-between pb-3 border-b border-[#E0E4EE]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <CheckCircle2 size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#091747]">Transaction Receipt</h3>
                  <div className="text-[10px] text-[#667085]">{config.bankName}</div>
                </div>
              </div>
              <button onClick={() => setReceiptTx(null)} className="text-[#667085] hover:text-[#172033] cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <div className="text-center py-2 space-y-1">
              <div className="text-xs text-[#667085] uppercase tracking-wider font-semibold">Total Amount</div>
              <div className="text-3xl font-black text-[#091747]">{formatNaira(receiptTx.amountKobo)}</div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                receiptTx.status === 'SUCCESSFUL' ? 'text-emerald-700 bg-emerald-50' : 'text-amber-700 bg-amber-50'
              }`}>
                {receiptTx.status}
              </span>
            </div>

            <div className="p-4 bg-[#F0F2F8] rounded-xl border border-[#E0E4EE] space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-[#E0E4EE]">
                <span className="text-[#667085]">Transaction Reference:</span>
                <strong className="font-mono text-[#091747]">{receiptTx.reference}</strong>
              </div>
              <div className="flex justify-between py-1 border-b border-[#E0E4EE]">
                <span className="text-[#667085]">Transaction Date:</span>
                <span className="font-mono text-[#172033]">{formatLagosDate(receiptTx.createdAt, true)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#E0E4EE]">
                <span className="text-[#667085]">Sender:</span>
                <strong className="text-[#172033]">{receiptTx.sourceAccountName || 'Customer Cash'}</strong>
              </div>
              <div className="flex justify-between py-1 border-b border-[#E0E4EE]">
                <span className="text-[#667085]">Recipient:</span>
                <strong className="text-[#172033]">{receiptTx.destinationAccountName || receiptTx.destinationAccountNumber}</strong>
              </div>
              <div className="flex justify-between py-1 border-b border-[#E0E4EE]">
                <span className="text-[#667085]">Destination Bank:</span>
                <span className="text-[#172033]">{receiptTx.destinationBankName || config.bankName}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#E0E4EE]">
                <span className="text-[#667085]">Fee / Tariff:</span>
                <span className="text-[#172033]">{formatNaira(receiptTx.feeKobo)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-[#667085]">Description:</span>
                <span className="text-[#172033]">{receiptTx.narration}</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => window.print()}
                className="flex-1 py-2.5 text-xs font-bold text-[#172033] bg-[#F0F2F8] border border-[#E0E4EE] hover:bg-[#e4e7f0] rounded flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Printer size={14} />
                <span>Print Receipt</span>
              </button>
              <button
                onClick={() => setReceiptTx(null)}
                className="flex-1 py-2.5 text-xs font-bold text-white bg-[#263F91] hover:bg-[#1e3375] rounded transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
