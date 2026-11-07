import React, { useState, useEffect, useMemo } from 'react';
import {
  Briefcase, Search, Plus, RefreshCw, LogOut, AlertTriangle,
  CheckCircle2, FileText, Calendar, ShieldCheck, ArrowLeft, Users, ExternalLink
} from 'lucide-react';
import { User, CustomerRecord } from '../../../types/banking';
import { safeApiFetch } from '../../../utils/apiClient';
import { ASSIGNABLE_PROGRAMMES } from '../../../utils/roleRouting';
import { CentralCustomerDirectory } from '../../../components/internal/CentralCustomerDirectory';
import { CustomerProfileModal } from '../../../components/internal/CustomerProfileModal';

interface LoanOfficerDashboardProps {
  currentUser: User | null;
  onLogout: () => void;
  onNavigate?: (path: string) => void;
}

export const LoanOfficerDashboard: React.FC<LoanOfficerDashboardProps> = ({
  currentUser,
  onLogout,
  onNavigate,
}) => {
  const [activeTab, setActiveTab] = useState<'applications' | 'directory' | 'new-loan' | 'schedules' | 'overdue'>('applications');
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [profileCustomer, setProfileCustomer] = useState<CustomerRecord | null>(null);
  const [loans, setLoans] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // New Loan Application Form
  const [borrowerId, setBorrowerId] = useState('');
  const [borrowerName, setBorrowerName] = useState('');
  const [borrowerPhone, setBorrowerPhone] = useState('');
  const [programme, setProgramme] = useState(
    currentUser?.assignedProgramme && currentUser.assignedProgramme !== 'All Programmes'
      ? currentUser.assignedProgramme
      : ASSIGNABLE_PROGRAMMES[0]
  );
  const [loanAmount, setLoanAmount] = useState('');
  const [durationMonths, setDurationMonths] = useState('6');
  const [interestRate, setInterestRate] = useState('5');
  const [purpose, setPurpose] = useState('');
  const [guarantorName, setGuarantorName] = useState('');
  const [guarantorPhone, setGuarantorPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadLoansData = async () => {
    setIsLoading(true);
    try {
      const [loanRes, custRes] = await Promise.all([
        safeApiFetch('/api/operations/loans'),
        safeApiFetch('/api/customers'),
      ]);
      if (loanRes.success) setLoans(loanRes.loans || loanRes.data || []);
      if (custRes.success) setCustomers(custRes.customers || custRes.data || []);
    } catch (e) {
      console.error('Failed to load loan portfolio:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLoansData();
  }, []);

  const handleSelectBorrower = (cid: string) => {
    setBorrowerId(cid);
    const found = customers.find((c) => c.id === cid);
    if (found) {
      setBorrowerName(found.fullName);
      setBorrowerPhone(found.phone || '');
    }
  };

  const handleCreateLoanApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    setBanner(null);

    const parsedAmount = Number(loanAmount);
    if (!borrowerName.trim() || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setBanner({ type: 'error', msg: 'Borrower name and a valid loan amount greater than zero are required.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await safeApiFetch('/api/operations/loans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: borrowerId || `BOR-${Date.now()}`,
          borrowerName: borrowerName.trim(),
          borrowerPhone: borrowerPhone.trim(),
          programme,
          amount: parsedAmount,
          durationMonths: Number(durationMonths) || 6,
          interestRate: Number(interestRate) || 5,
          purpose: purpose.trim(),
          guarantorName: guarantorName.trim(),
          guarantorPhone: guarantorPhone.trim(),
          status: 'PENDING_APPROVAL',
        }),
      });
      if (!res.success) {
        setBanner({ type: 'error', msg: res.error || 'Failed to submit loan application.' });
      } else {
        setBanner({
          type: 'success',
          msg: `Loan application for ${borrowerName} (₦${parsedAmount.toLocaleString()}) submitted for authorised approval.`,
        });
        setLoanAmount('');
        setPurpose('');
        setGuarantorName('');
        setGuarantorPhone('');
        setActiveTab('applications');
        await loadLoansData();
      }
    } catch (err: any) {
      setBanner({ type: 'error', msg: err.message || 'Network error submitting loan application.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredLoans = useMemo(() => {
    return loans.filter((l) => {
      const matchesSearch =
        !searchQuery ||
        (l.borrowerName || l.customerName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (l.id || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (l.purpose || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'ALL' || l.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [loans, searchQuery, statusFilter]);

  const metrics = useMemo(() => {
    const totalPrincipal = loans.reduce((s, l) => s + (Number(l.amount || l.requestedAmount) || 0), 0);
    const totalOutstanding = loans.reduce((s, l) => s + (Number(l.outstandingBalance ?? l.amount ?? l.requestedAmount) || 0), 0);
    const pendingCount = loans.filter((l) => l.status === 'PENDING_APPROVAL' || l.status === 'UNDER_REVIEW' || l.status === 'PENDING').length;
    const overdueCount = loans.filter((l) => l.status === 'OVERDUE' || Number(l.overdueAmount || 0) > 0).length;
    return { totalPrincipal, totalOutstanding, pendingCount, overdueCount, totalLoans: loans.length };
  }, [loans]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight text-white">Loan Officer Workspace</h1>
                <span className="text-[11px] font-mono uppercase px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
                  /staff/loan-officer
                </span>
              </div>
              <p className="text-xs text-slate-400">
                TEAMACRO SERVICES LTD • Assigned Portfolio: <span className="text-slate-200 font-medium">{currentUser?.assignedProgramme || 'All Programmes'}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {currentUser?.role === 'LIFETIME_SUPER_ADMIN' && onNavigate && (
              <button
                onClick={() => onNavigate('/supa-admin')}
                className="px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-semibold flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Super Admin Console
              </button>
            )}
            <button
              onClick={loadLoansData}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 border border-slate-700"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh Portfolio
            </button>
            <div className="text-right hidden sm:block">
              <div className="text-xs font-semibold text-white">{currentUser?.fullName}</div>
              <div className="text-[11px] text-indigo-400">{currentUser?.position || 'Loan Officer'}</div>
            </div>
            <button
              onClick={onLogout}
              className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-medium flex items-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 flex gap-1 overflow-x-auto border-t border-slate-800/60">
          {[
            { id: 'applications', label: 'Loan Applications & Portfolio', icon: FileText },
            { id: 'new-loan', label: 'Create Loan Application', icon: Plus },
            { id: 'schedules', label: 'Repayment Schedules & History', icon: Calendar },
            { id: 'overdue', label: 'Overdue & Outstanding Monitor', icon: AlertTriangle },
          ].map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as any)}
                className={`px-4 py-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
                  activeTab === t.id
                    ? 'border-indigo-400 text-indigo-400 bg-indigo-500/5'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>
      </header>

      <main className="max-w-7xl mx-auto w-full px-6 py-6 flex-1 space-y-6">
        <div className="p-3.5 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 text-xs text-indigo-200">
            <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0" />
            <span>
              <strong>Approval Workflow Control:</strong> Loan Officers originate applications, verify guarantors, and monitor repayment schedules. Final loan approval and capital disbursement remain subject to authorised Executive / Account Manager sign-off.
            </span>
          </div>
          <span className="text-[11px] font-mono text-indigo-300 shrink-0">MAKER-CHECKER WORKFLOW</span>
        </div>

        {banner && (
          <div
            className={`p-4 rounded-xl border flex items-center justify-between ${
              banner.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-200'
            }`}
          >
            <span className="text-xs font-medium">{banner.msg}</span>
            <button onClick={() => setBanner(null)} className="text-xs underline ml-4">
              Dismiss
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-xl bg-slate-900 border border-slate-800">
            <div className="text-xs text-slate-400">Total Originated Applications</div>
            <div className="text-2xl font-bold text-white font-mono mt-1">{metrics.totalLoans}</div>
            <div className="text-[11px] text-indigo-400 mt-1">Active & pending files</div>
          </div>
          <div className="p-5 rounded-xl bg-slate-900 border border-slate-800">
            <div className="text-xs text-slate-400">Total Principal Requested</div>
            <div className="text-2xl font-bold text-emerald-400 font-mono mt-1">
              ₦{metrics.totalPrincipal.toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">Across all borrower files</div>
          </div>
          <div className="p-5 rounded-xl bg-slate-900 border border-slate-800">
            <div className="text-xs text-slate-400">Outstanding Repayment Balance</div>
            <div className="text-2xl font-bold text-amber-400 font-mono mt-1">
              ₦{metrics.totalOutstanding.toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">Scheduled principal + interest</div>
          </div>
          <div className="p-5 rounded-xl bg-slate-900 border border-slate-800">
            <div className="text-xs text-slate-400">Awaiting Approval Sign-Off</div>
            <div className="text-2xl font-bold text-sky-400 font-mono mt-1">{metrics.pendingCount}</div>
            <div className="text-[11px] text-slate-400 mt-1">{metrics.overdueCount} flagged overdue</div>
          </div>
        </div>

        {activeTab === 'applications' && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search borrower name, loan ID, or purpose..."
                  className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white"
                />
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="PENDING_APPROVAL">Pending Approval</option>
                  <option value="APPROVED">Approved / Disbursed</option>
                  <option value="OVERDUE">Overdue</option>
                </select>
                <button
                  onClick={() => setActiveTab('new-loan')}
                  className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  New Application
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-[11px] uppercase text-slate-400 bg-slate-950/60">
                    <th className="py-3 px-4">Loan ID</th>
                    <th className="py-3 px-4">Borrower</th>
                    <th className="py-3 px-4">Programme & Purpose</th>
                    <th className="py-3 px-4">Principal</th>
                    <th className="py-3 px-4">Outstanding</th>
                    <th className="py-3 px-4">Tenor</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-xs">
                  {filteredLoans.map((l) => (
                    <tr key={l.id} className="hover:bg-slate-800/30">
                      <td className="py-3 px-4 font-mono text-indigo-400 font-semibold">{l.id}</td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-white">{l.borrowerName || l.customerName}</div>
                        <div className="text-[11px] text-slate-400">{l.borrowerPhone || l.customerPhone || 'No phone'}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-slate-200">{l.programme || 'Loan Portfolio'}</div>
                        <div className="text-[11px] text-slate-400">{l.purpose || 'Working Capital'}</div>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-white">
                        ₦{Number(l.amount || l.requestedAmount || 0).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 font-mono font-semibold text-amber-400">
                        ₦{Number(l.outstandingBalance ?? l.amount ?? l.requestedAmount ?? 0).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-slate-300">
                        {l.durationMonths || l.tenorMonths || 6} mos @ {l.interestRate || 5}%
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-mono ${
                            l.status === 'APPROVED'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : l.status === 'OVERDUE'
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          }`}
                        >
                          {l.status || 'PENDING_APPROVAL'}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {filteredLoans.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500 text-xs">
                        No loan applications found. Click "New Application" to register a borrower loan request.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'new-loan' && (
          <form
            onSubmit={handleCreateLoanApplication}
            className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5 max-w-3xl"
          >
            <div>
              <h2 className="text-sm font-bold text-white">Originate New Loan Application</h2>
              <p className="text-xs text-slate-400">
                Register borrower details, facility structure, and guarantor information.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Link Existing Customer (Optional)
                </label>
                <select
                  value={borrowerId}
                  onChange={(e) => handleSelectBorrower(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white"
                >
                  <option value="">-- Enter Borrower Manually or Select --</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.fullName} ({c.customerCode || c.id})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Borrower Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={borrowerName}
                  onChange={(e) => setBorrowerName(e.target.value)}
                  placeholder="Full legal name of applicant"
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Borrower Phone Number *
                </label>
                <input
                  type="text"
                  required
                  value={borrowerPhone}
                  onChange={(e) => setBorrowerPhone(e.target.value)}
                  placeholder="+234..."
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Loan Programme *
                </label>
                <select
                  value={programme}
                  onChange={(e) => setProgramme(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white"
                >
                  {ASSIGNABLE_PROGRAMMES.filter((p) => p !== 'All Programmes').map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Principal Amount Requested (₦) *
                </label>
                <input
                  type="number"
                  min="1000"
                  required
                  value={loanAmount}
                  onChange={(e) => setLoanAmount(e.target.value)}
                  placeholder="e.g. 250000"
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Tenor (Months) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="36"
                    value={durationMonths}
                    onChange={(e) => setDurationMonths(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Monthly Rate (%) *
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={interestRate}
                    onChange={(e) => setInterestRate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Guarantor Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={guarantorName}
                  onChange={(e) => setGuarantorName(e.target.value)}
                  placeholder="Verified guarantor name"
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Guarantor Phone Number *
                </label>
                <input
                  type="text"
                  required
                  value={guarantorPhone}
                  onChange={(e) => setGuarantorPhone(e.target.value)}
                  placeholder="+234..."
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Business Purpose & Collateral Assessment *
              </label>
              <textarea
                rows={3}
                required
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="Describe business cashflow, inventory purpose, and repayment capacity..."
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white"
              />
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                {isSubmitting ? 'Submitting Application...' : 'Submit Application for Approval'}
              </button>
            </div>
          </form>
        )}

        {(activeTab === 'schedules' || activeTab === 'overdue') && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
            <h2 className="text-sm font-bold text-white">
              {activeTab === 'schedules' ? 'Borrower Repayment Schedules & Recorded Repayments' : 'Outstanding & Overdue Repayment Watchlist'}
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-[11px] uppercase text-slate-400">
                    <th className="py-2.5 px-3">Borrower</th>
                    <th className="py-2.5 px-3">Principal</th>
                    <th className="py-2.5 px-3">Estimated Monthly Installment</th>
                    <th className="py-2.5 px-3">Outstanding Balance</th>
                    <th className="py-2.5 px-3">Guarantor</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-xs">
                  {loans.map((l) => {
                    const principal = Number(l.amount || l.requestedAmount || 0);
                    const months = Number(l.durationMonths || l.tenorMonths || 6);
                    const rate = Number(l.interestRate || 5) / 100;
                    const monthlyInstallment = months > 0 ? Math.round((principal * (1 + rate * months)) / months) : principal;
                    return (
                      <tr key={l.id}>
                        <td className="py-3 px-3 font-medium text-white">{l.borrowerName || l.customerName}</td>
                        <td className="py-3 px-3 font-mono">₦{principal.toLocaleString()}</td>
                        <td className="py-3 px-3 font-mono text-indigo-400">₦{monthlyInstallment.toLocaleString()} / mo</td>
                        <td className="py-3 px-3 font-mono font-bold text-amber-400">
                          ₦{Number(l.outstandingBalance ?? principal).toLocaleString()}
                        </td>
                        <td className="py-3 px-3 text-slate-300">
                          {l.guarantorName || 'On File'} ({l.guarantorPhone || 'N/A'})
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 font-mono text-[11px]">
                            {l.status || 'PENDING_APPROVAL'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
