import React, { useState, useEffect, useMemo } from 'react';
import {
  Wallet,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Search,
  Download,
  Filter,
  FileText,
  RefreshCw,
  LogOut,
  ShieldCheck,
  Building2,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Eye,
  PlusCircle,
  Scale,
  Users,
  X,
  ExternalLink,
} from 'lucide-react';
import { User, CustomerRecord } from '../../../types/banking';
import { safeApiFetch } from '../../../utils/apiClient';
import { ASSIGNABLE_PROGRAMMES } from '../../../utils/roleRouting';
import { CentralCustomerDirectory } from '../../../components/internal/CentralCustomerDirectory';
import { CustomerProfileModal } from '../../../components/internal/CustomerProfileModal';

interface AccountManagerDashboardProps {
  currentUser: User | null;
  onLogout: () => void;
  onNavigate?: (path: string) => void;
}

export const AccountManagerDashboard: React.FC<AccountManagerDashboardProps> = ({
  currentUser,
  onLogout,
  onNavigate,
}) => {
  const [activeTab, setActiveTab] = useState<
    'overview' | 'collections' | 'loans' | 'balances' | 'reconciliation' | 'reports'
  >('overview');
  const [collections, setCollections] = useState<any[]>([]);
  const [loans, setLoans] = useState<any[]>([]);
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [profileCustomer, setProfileCustomer] = useState<CustomerRecord | null>(null);
  const [reconciliations, setReconciliations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [programmeFilter, setProgrammeFilter] = useState('ALL');
  const [dateFilter, setDateFilter] = useState('');
  const [selectedTransaction, setSelectedTransaction] = useState<any | null>(null);
  const [feedbackBanner, setFeedbackBanner] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Reconciliation Modal State
  const [showReconcileModal, setShowReconcileModal] = useState(false);
  const [recForm, setRecForm] = useState({
    periodDate: new Date().toISOString().split('T')[0],
    programme: ASSIGNABLE_PROGRAMMES[0],
    recordedCollectionsTotal: '',
    verifiedBankLedgerTotal: '',
    notes: '',
  });
  const [isSubmittingRec, setIsSubmittingRec] = useState(false);

  const loadFinancialData = async () => {
    setIsLoading(true);
    try {
      const [colRes, loanRes, custRes, recRes] = await Promise.all([
        safeApiFetch('/api/operations/collections'),
        safeApiFetch('/api/operations/loans'),
        safeApiFetch('/api/customers'),
        safeApiFetch('/api/operations/reconciliations'),
      ]);
      if (colRes.success) setCollections(colRes.collections || colRes.data?.collections || []);
      if (loanRes.success) setLoans(loanRes.loans || loanRes.data?.loans || []);
      if (custRes.success) setCustomers(custRes.customers || custRes.data?.customers || []);
      if (recRes.success) {
        setReconciliations(recRes.reconciliations || recRes.data?.reconciliations || []);
      }
    } catch (err) {
      console.warn('[AccountManagerDashboard] Failed loading data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadFinancialData();
  }, []);

  const totalCollections = useMemo(
    () =>
      collections
        .filter((c) => c.status !== 'REVERSED')
        .reduce((sum, c) => sum + Number(c.amount || 0), 0),
    [collections]
  );

  const totalLoanDisbursements = useMemo(
    () =>
      loans
        .filter((l) => l.stage === 'ACTIVE_DISBURSED' || l.stage === 'COMPLETED')
        .reduce((sum, l) => sum + Number(l.principalAmount || 0), 0),
    [loans]
  );

  const outstandingLoanBalances = useMemo(
    () =>
      loans
        .filter((l) => l.stage === 'ACTIVE_DISBURSED')
        .reduce((sum, l) => sum + Number(l.outstandingBalance || 0), 0),
    [loans]
  );

  const discrepancyAlerts = useMemo(
    () => reconciliations.filter((r) => Number(r.discrepancyAmount || 0) !== 0),
    [reconciliations]
  );

  const filteredCollections = useMemo(() => {
    return collections.filter((c) => {
      const matchesSearch =
        !searchQuery.trim() ||
        String(c.customerName || '')
          .toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        String(c.reference || '')
          .toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        String(c.accountNumber || '')
          .toLowerCase()
          .includes(searchQuery.toLowerCase());
      const matchesProg =
        programmeFilter === 'ALL' ||
        String(c.programme || '').toLowerCase() === programmeFilter.toLowerCase();
      const matchesDate = !dateFilter || String(c.paymentDate || '') === dateFilter;
      return matchesSearch && matchesProg && matchesDate;
    });
  }, [collections, searchQuery, programmeFilter, dateFilter]);

  const filteredLoans = useMemo(() => {
    return loans.filter((l) => {
      const matchesSearch =
        !searchQuery.trim() ||
        String(l.customerName || '')
          .toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        String(l.loanCode || '')
          .toLowerCase()
          .includes(searchQuery.toLowerCase());
      const matchesProg =
        programmeFilter === 'ALL' ||
        String(l.programme || '').toLowerCase() === programmeFilter.toLowerCase();
      return matchesSearch && matchesProg;
    });
  }, [loans, searchQuery, programmeFilter]);

  const handleCreateReconciliation = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingRec(true);
    setFeedbackBanner(null);
    try {
      const res = await safeApiFetch('/api/operations/reconciliations', {
        method: 'POST',
        body: JSON.stringify({
          periodDate: recForm.periodDate,
          programme: recForm.programme,
          recordedCollectionsTotal: Number(recForm.recordedCollectionsTotal || 0),
          verifiedBankLedgerTotal: Number(recForm.verifiedBankLedgerTotal || 0),
          notes: recForm.notes,
        }),
      });
      if (!res.success) {
        setFeedbackBanner({
          type: 'error',
          message: res.message || res.error || 'Failed to submit reconciliation.',
        });
      } else {
        setFeedbackBanner({
          type: 'success',
          message: 'Reconciliation report recorded and verified against ledger.',
        });
        setShowReconcileModal(false);
        setRecForm({
          periodDate: new Date().toISOString().split('T')[0],
          programme: ASSIGNABLE_PROGRAMMES[0],
          recordedCollectionsTotal: '',
          verifiedBankLedgerTotal: '',
          notes: '',
        });
        await loadFinancialData();
      }
    } finally {
      setIsSubmittingRec(false);
    }
  };

  const handleDownloadReport = (reportType: string) => {
    const payload = {
      reportTitle: `TEAMACRO FINANCIAL REPORT — ${reportType.toUpperCase()}`,
      generatedBy: currentUser?.fullName || 'Account Manager',
      position: 'Account Manager',
      route: '/admin/accountmanager',
      generatedAt: new Date().toISOString(),
      summary: {
        totalCollections,
        totalLoanDisbursements,
        outstandingLoanBalances,
        discrepancyCount: discrepancyAlerts.length,
      },
      collections: filteredCollections,
      loans: filteredLoans,
      reconciliations,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `teamacro-account-manager-${reportType.toLowerCase()}-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[#07112B] text-white flex flex-col">
      {/* Top Executive Bar */}
      <header className="bg-[#0B1942] border-b border-white/10 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center">
            <Wallet className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                ADMINISTRATION · ACCOUNT MANAGER
              </span>
              <span className="text-xs font-mono text-slate-400">/admin/accountmanager</span>
            </div>
            <h1 className="text-lg font-bold text-white mt-0.5">
              Financial Management & Reconciliation Command
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {currentUser?.isLifetimeSuperAdmin && onNavigate && (
            <button
              onClick={() => onNavigate('/supa-admin')}
              className="px-3 py-2 rounded-lg bg-amber-500/20 border border-amber-400/40 text-amber-300 text-xs font-semibold hover:bg-amber-500/30 transition"
            >
              Return to Super Admin
            </button>
          )}
          <div className="text-right hidden sm:block">
            <div className="text-sm font-semibold text-white">
              {currentUser?.fullName || 'Account Manager'}
            </div>
            <div className="text-xs text-emerald-300">
              {currentUser?.position || 'Account Manager'} · {currentUser?.email}
            </div>
          </div>
          <button
            onClick={loadFinancialData}
            className="p-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 transition"
            title="Refresh Financial Records"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-emerald-400' : ''}`} />
          </button>
          <button
            onClick={onLogout}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-400/30 text-rose-200 text-xs font-semibold transition"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="bg-[#091538] border-b border-white/10 px-6 flex items-center gap-2 overflow-x-auto">
        {[
          { id: 'overview', label: 'Financial Overview', icon: TrendingUp },
          { id: 'collections', label: 'Collections & Repayments', icon: ArrowDownRight },
          { id: 'loans', label: 'Loan Disbursements & Balances', icon: ArrowUpRight },
          { id: 'balances', label: 'Customer Account Statements', icon: Users },
          { id: 'reconciliation', label: 'Reconciliation & Discrepancies', icon: Scale },
          { id: 'reports', label: 'Financial Reports', icon: FileText },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-3.5 text-xs font-semibold border-b-2 transition whitespace-nowrap ${
                active
                  ? 'border-emerald-400 text-emerald-300 bg-emerald-500/10'
                  : 'border-transparent text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Main Content */}
      <main className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6">
        {feedbackBanner && (
          <div
            className={`p-4 rounded-xl border flex items-center justify-between ${
              feedbackBanner.type === 'success'
                ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-200'
                : 'bg-rose-500/15 border-rose-400/40 text-rose-200'
            }`}
          >
            <span className="text-sm font-medium">{feedbackBanner.message}</span>
            <button onClick={() => setFeedbackBanner(null)} className="text-xs underline">
              Dismiss
            </button>
          </div>
        )}

        {/* KPI Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-[#0D1E4C] border border-white/10 rounded-xl p-5">
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span>TOTAL RECORDED COLLECTIONS</span>
              <ArrowDownRight className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-white mt-2">
              ₦{totalCollections.toLocaleString()}
            </div>
            <div className="text-xs text-emerald-300 mt-1">
              {collections.length} verified collection entries
            </div>
          </div>

          <div className="bg-[#0D1E4C] border border-white/10 rounded-xl p-5">
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span>TOTAL LOAN DISBURSEMENTS</span>
              <ArrowUpRight className="w-4 h-4 text-sky-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-white mt-2">
              ₦{totalLoanDisbursements.toLocaleString()}
            </div>
            <div className="text-xs text-sky-300 mt-1">
              {loans.length} active & pipeline loan facilities
            </div>
          </div>

          <div className="bg-[#0D1E4C] border border-white/10 rounded-xl p-5">
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span>OUTSTANDING LOAN BALANCES</span>
              <Building2 className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-white mt-2">
              ₦{outstandingLoanBalances.toLocaleString()}
            </div>
            <div className="text-xs text-amber-300 mt-1">Monitored repayment exposure</div>
          </div>

          <div className="bg-[#0D1E4C] border border-white/10 rounded-xl p-5">
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span>RECONCILIATION STATUS</span>
              {discrepancyAlerts.length === 0 ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-400" />
              )}
            </div>
            <div className="text-2xl font-bold font-mono text-white mt-2">
              {discrepancyAlerts.length === 0
                ? 'BALANCED'
                : `${discrepancyAlerts.length} ALERTS`}
            </div>
            <div className="text-xs text-slate-300 mt-1">
              {reconciliations.length} reconciliation reports filed
            </div>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="bg-[#0D1E4C] border border-white/10 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by customer name, payment reference, loan code, or account number..."
              className="w-full pl-10 pr-4 py-2 rounded-lg bg-[#07112B] border border-white/15 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-emerald-400"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 bg-[#07112B] border border-white/15 rounded-lg px-3 py-2">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={programmeFilter}
                onChange={(e) => setProgrammeFilter(e.target.value)}
                className="bg-transparent text-xs text-white focus:outline-none"
              >
                <option value="ALL" className="bg-[#0B1942]">
                  All Savings & Loan Programmes
                </option>
                {ASSIGNABLE_PROGRAMMES.map((prog) => (
                  <option key={prog} value={prog} className="bg-[#0B1942]">
                    {prog}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5 bg-[#07112B] border border-white/15 rounded-lg px-3 py-2">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="bg-transparent text-xs text-white focus:outline-none"
              />
            </div>

            <button
              onClick={() => setShowReconcileModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs transition"
            >
              <PlusCircle className="w-4 h-4" />
              New Reconciliation
            </button>

            <button
              onClick={() => handleDownloadReport(activeTab)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 text-white font-semibold text-xs transition"
            >
              <Download className="w-4 h-4" />
              Export Report
            </button>
          </div>
        </div>

        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-[#0D1E4C] border border-white/10 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-white">
                  Recent Financial Collections & Repayments
                </h2>
                <button
                  onClick={() => setActiveTab('collections')}
                  className="text-xs text-emerald-300 hover:underline"
                >
                  View Full Ledger →
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 text-[11px] uppercase text-slate-400">
                      <th className="py-2.5 px-3">Reference</th>
                      <th className="py-2.5 px-3">Customer</th>
                      <th className="py-2.5 px-3">Programme</th>
                      <th className="py-2.5 px-3">Amount</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3 text-right">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-xs">
                    {filteredCollections.slice(0, 6).map((item) => (
                      <tr key={item.id} className="hover:bg-white/5">
                        <td className="py-3 px-3 font-mono text-emerald-300">{item.reference}</td>
                        <td className="py-3 px-3 font-medium text-white">{item.customerName}</td>
                        <td className="py-3 px-3 text-slate-300">{item.programme}</td>
                        <td className="py-3 px-3 font-mono font-bold text-white">
                          ₦{Number(item.amount || 0).toLocaleString()}
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                            {item.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            onClick={() => setSelectedTransaction(item)}
                            className="p-1.5 rounded bg-white/5 hover:bg-white/10 text-slate-200"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Discrepancy & Reconciliation Summary Panel */}
            <div className="bg-[#0D1E4C] border border-white/10 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-white">
                  Financial Discrepancy & Reconciliation Alerts
                </h2>
                <Scale className="w-4 h-4 text-emerald-400" />
              </div>

              {discrepancyAlerts.length === 0 ? (
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-400/30 text-xs text-emerald-200 space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    Zero Unresolved Discrepancies
                  </div>
                  <p className="text-slate-300">
                    All recorded field collections and bank settlement totals are currently balanced.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {discrepancyAlerts.map((alert) => (
                    <div
                      key={alert.id}
                      className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-400/30 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between font-bold text-rose-200">
                        <span>{alert.reconciliationCode}</span>
                        <span>Variance: ₦{Number(alert.discrepancyAmount).toLocaleString()}</span>
                      </div>
                      <div className="text-slate-300">{alert.programme}</div>
                      <div className="text-[11px] text-slate-400">{alert.notes}</div>
                    </div>
                  ))}
                </div>
              )}

              <div className="pt-3 border-t border-white/10 space-y-2">
                <div className="text-xs font-semibold text-slate-300">
                  Position Governance Boundary
                </div>
                <div className="p-3 rounded-lg bg-white/5 text-[11px] text-slate-300 flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>
                    Authorized for Account Manager financial review, collection reconciliation, and statement reporting. Root system settings and transaction reversals remain restricted to the Lifetime Super Admin.
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* COLLECTIONS TAB */}
        {activeTab === 'collections' && (
          <div className="bg-[#0D1E4C] border border-white/10 rounded-xl p-5 space-y-4">
            <h2 className="text-base font-bold text-white">
              Savings Contributions & Repayment Collection Records ({filteredCollections.length})
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-[11px] uppercase text-slate-400">
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Reference</th>
                    <th className="py-2.5 px-3">Customer & Account</th>
                    <th className="py-2.5 px-3">Type / Programme</th>
                    <th className="py-2.5 px-3">Method</th>
                    <th className="py-2.5 px-3">Amount</th>
                    <th className="py-2.5 px-3">Recorded By</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-xs">
                  {filteredCollections.map((c) => (
                    <tr key={c.id} className="hover:bg-white/5">
                      <td className="py-3 px-3 text-slate-300">{c.paymentDate}</td>
                      <td className="py-3 px-3 font-mono text-emerald-300">{c.reference}</td>
                      <td className="py-3 px-3">
                        <div className="font-semibold text-white">{c.customerName}</div>
                        <div className="text-[11px] font-mono text-slate-400">{c.accountNumber}</div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="text-white">{c.programme}</div>
                        <div className="text-[10px] text-slate-400">{c.collectionType}</div>
                      </td>
                      <td className="py-3 px-3 text-slate-300">{c.paymentMethod}</td>
                      <td className="py-3 px-3 font-mono font-bold text-white">
                        ₦{Number(c.amount || 0).toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-slate-300">{c.recordedByName}</td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                          {c.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* LOANS TAB */}
        {activeTab === 'loans' && (
          <div className="bg-[#0D1E4C] border border-white/10 rounded-xl p-5 space-y-4">
            <h2 className="text-base font-bold text-white">
              Loan Disbursement & Repayment Portfolio ({filteredLoans.length})
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-[11px] uppercase text-slate-400">
                    <th className="py-2.5 px-3">Loan Code</th>
                    <th className="py-2.5 px-3">Borrower</th>
                    <th className="py-2.5 px-3">Programme</th>
                    <th className="py-2.5 px-3">Principal</th>
                    <th className="py-2.5 px-3">Total Repayable</th>
                    <th className="py-2.5 px-3">Repaid</th>
                    <th className="py-2.5 px-3">Outstanding</th>
                    <th className="py-2.5 px-3">Stage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-xs">
                  {filteredLoans.map((l) => (
                    <tr key={l.id} className="hover:bg-white/5">
                      <td className="py-3 px-3 font-mono text-sky-300">{l.loanCode}</td>
                      <td className="py-3 px-3">
                        <div className="font-semibold text-white">{l.customerName}</div>
                        <div className="text-[11px] font-mono text-slate-400">{l.accountNumber}</div>
                      </td>
                      <td className="py-3 px-3 text-slate-300">{l.programme}</td>
                      <td className="py-3 px-3 font-mono text-white">
                        ₦{Number(l.principalAmount || 0).toLocaleString()}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-200">
                        ₦{Number(l.totalRepayable || 0).toLocaleString()}
                      </td>
                      <td className="py-3 px-3 font-mono text-emerald-300">
                        ₦{Number(l.amountRepaid || 0).toLocaleString()}
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-amber-300">
                        ₦{Number(l.outstandingBalance || 0).toLocaleString()}
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 text-[10px] font-bold">
                          {l.stage}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* CUSTOMER BALANCES & CENTRAL DIRECTORY TAB */}
        {activeTab === 'balances' && (
          <div className="text-slate-900">
            <CentralCustomerDirectory
              title="Central Customer Directory & Account Statements (Account Manager)"
              subtitle="Click any customer name to inspect their full profile, separate Next of Kin & Guarantor sections, original registering staff member, and financial activity history."
              canCreateCustomer={true}
              canEditCustomer={true}
              canRecordActivity={true}
              onCustomersChanged={(list) => setCustomers(list)}
            />
          </div>
        )}

        {/* RECONCILIATION TAB */}
        {activeTab === 'reconciliation' && (
          <div className="bg-[#0D1E4C] border border-white/10 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white">
                Collection vs. Ledger Reconciliation Register ({reconciliations.length})
              </h2>
              <button
                onClick={() => setShowReconcileModal(true)}
                className="px-3.5 py-2 rounded-lg bg-emerald-500 text-slate-950 font-bold text-xs"
              >
                + Record Reconciliation
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-[11px] uppercase text-slate-400">
                    <th className="py-2.5 px-3">Code</th>
                    <th className="py-2.5 px-3">Period Date</th>
                    <th className="py-2.5 px-3">Programme</th>
                    <th className="py-2.5 px-3">Recorded Collections</th>
                    <th className="py-2.5 px-3">Verified Bank Total</th>
                    <th className="py-2.5 px-3">Discrepancy</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Prepared By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-xs">
                  {reconciliations.map((r) => (
                    <tr key={r.id} className="hover:bg-white/5">
                      <td className="py-3 px-3 font-mono text-emerald-300">
                        {r.reconciliationCode}
                      </td>
                      <td className="py-3 px-3 text-slate-300">{r.periodDate}</td>
                      <td className="py-3 px-3 text-white">{r.programme}</td>
                      <td className="py-3 px-3 font-mono text-white">
                        ₦{Number(r.recordedCollectionsTotal || 0).toLocaleString()}
                      </td>
                      <td className="py-3 px-3 font-mono text-white">
                        ₦{Number(r.verifiedBankLedgerTotal || 0).toLocaleString()}
                      </td>
                      <td
                        className={`py-3 px-3 font-mono font-bold ${
                          Number(r.discrepancyAmount || 0) === 0
                            ? 'text-emerald-300'
                            : 'text-rose-400'
                        }`}
                      >
                        ₦{Number(r.discrepancyAmount || 0).toLocaleString()}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            r.status === 'BALANCED'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-rose-500/20 text-rose-300'
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-300">{r.preparedByName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* REPORTS TAB */}
        {activeTab === 'reports' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              {
                id: 'collections-summary',
                title: 'Savings & Repayment Collections Report',
                desc: 'Complete breakdown of recorded field and transfer collections by programme.',
              },
              {
                id: 'loan-disbursement-summary',
                title: 'Loan Disbursements & Outstanding Exposure',
                desc: 'Active loan facilities, repayment schedules, and outstanding principal balances.',
              },
              {
                id: 'reconciliation-statement',
                title: 'Reconciliation & Discrepancy Statement',
                desc: 'Comparison of recorded collections against verified settlement ledger balances.',
              },
              {
                id: 'customer-balances',
                title: 'Customer Account Statement Directory',
                desc: 'Enrolled customer accounts and programme participation summary.',
              },
            ].map((rep) => (
              <div
                key={rep.id}
                className="bg-[#0D1E4C] border border-white/10 rounded-xl p-5 flex items-center justify-between gap-4"
              >
                <div>
                  <h3 className="text-sm font-bold text-white">{rep.title}</h3>
                  <p className="text-xs text-slate-300 mt-1">{rep.desc}</p>
                </div>
                <button
                  onClick={() => handleDownloadReport(rep.id)}
                  className="px-3.5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs shrink-0 flex items-center gap-1.5"
                >
                  <Download className="w-4 h-4" />
                  Download
                </button>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Transaction Details Modal */}
      {selectedTransaction && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-[#0D1E4C] border border-white/15 rounded-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">Transaction Supporting Record</h3>
              <button
                onClick={() => setSelectedTransaction(null)}
                className="p-1 rounded-lg hover:bg-white/10"
              >
                <X className="w-4 h-4 text-slate-300" />
              </button>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1.5 border-b border-white/10">
                <span className="text-slate-400">Payment Reference</span>
                <span className="font-mono text-emerald-300">{selectedTransaction.reference}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-white/10">
                <span className="text-slate-400">Customer Name</span>
                <span className="font-semibold text-white">{selectedTransaction.customerName}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-white/10">
                <span className="text-slate-400">Account Number</span>
                <span className="font-mono text-white">{selectedTransaction.accountNumber}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-white/10">
                <span className="text-slate-400">Programme</span>
                <span className="text-white">{selectedTransaction.programme}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-white/10">
                <span className="text-slate-400">Amount</span>
                <span className="font-mono font-bold text-emerald-300">
                  ₦{Number(selectedTransaction.amount || 0).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-white/10">
                <span className="text-slate-400">Recorded By</span>
                <span className="text-white">{selectedTransaction.recordedByName}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-400">Payment Date</span>
                <span className="text-white">{selectedTransaction.paymentDate}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Reconciliation Modal */}
      {showReconcileModal && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-[#0D1E4C] border border-white/15 rounded-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">
                Reconcile Collections Against Bank Ledger
              </h3>
              <button
                onClick={() => setShowReconcileModal(false)}
                className="p-1 rounded-lg hover:bg-white/10"
              >
                <X className="w-4 h-4 text-slate-300" />
              </button>
            </div>
            <form onSubmit={handleCreateReconciliation} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 mb-1">Programme</label>
                <select
                  value={recForm.programme}
                  onChange={(e) => setRecForm({ ...recForm, programme: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-[#07112B] border border-white/15 text-white"
                >
                  {ASSIGNABLE_PROGRAMMES.map((p) => (
                    <option key={p} value={p} className="bg-[#0B1942]">
                      {p}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1">Recorded Collections (₦)</label>
                  <input
                    type="number"
                    required
                    value={recForm.recordedCollectionsTotal}
                    onChange={(e) =>
                      setRecForm({ ...recForm, recordedCollectionsTotal: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg bg-[#07112B] border border-white/15 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">Verified Bank Ledger (₦)</label>
                  <input
                    type="number"
                    required
                    value={recForm.verifiedBankLedgerTotal}
                    onChange={(e) =>
                      setRecForm({ ...recForm, verifiedBankLedgerTotal: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg bg-[#07112B] border border-white/15 text-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-slate-300 mb-1">Reconciliation Notes</label>
                <textarea
                  rows={3}
                  value={recForm.notes}
                  onChange={(e) => setRecForm({ ...recForm, notes: e.target.value })}
                  placeholder="Enter settlement reference or discrepancy explanation..."
                  className="w-full px-3 py-2 rounded-lg bg-[#07112B] border border-white/15 text-white"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowReconcileModal(false)}
                  className="px-4 py-2 rounded-lg bg-white/10 text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingRec}
                  className="px-4 py-2 rounded-lg bg-emerald-500 text-slate-950 font-bold"
                >
                  {isSubmittingRec ? 'Saving...' : 'Submit Reconciliation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {profileCustomer && (
        <CustomerProfileModal
          customer={profileCustomer}
          onClose={() => setProfileCustomer(null)}
          canEdit={true}
          canRecordActivity={true}
          onCustomerUpdated={(updated) => {
            setProfileCustomer(updated);
            setCustomers((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
          }}
        />
      )}
    </div>
  );
};
