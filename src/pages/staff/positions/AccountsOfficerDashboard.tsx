import React, { useState, useEffect, useMemo } from 'react';
import {
  FileSpreadsheet, Search, RefreshCw, LogOut, CheckCircle2, AlertTriangle,
  Download, ShieldAlert, Scale, Layers, FileText, ArrowLeft
} from 'lucide-react';
import { User, CustomerRecord } from '../../../types/banking';
import { safeApiFetch } from '../../../utils/apiClient';
import { ASSIGNABLE_PROGRAMMES } from '../../../utils/roleRouting';

interface AccountsOfficerDashboardProps {
  currentUser: User | null;
  onLogout: () => void;
  onNavigate?: (path: string) => void;
}

export const AccountsOfficerDashboard: React.FC<AccountsOfficerDashboardProps> = ({
  currentUser,
  onLogout,
  onNavigate,
}) => {
  const [activeTab, setActiveTab] = useState<'review' | 'reconcile' | 'discrepancies' | 'reports'>('review');
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [collections, setCollections] = useState<any[]>([]);
  const [loans, setLoans] = useState<any[]>([]);
  const [reconciliations, setReconciliations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Reconciliation Worksheet Form
  const [programme, setProgramme] = useState(ASSIGNABLE_PROGRAMMES[0]);
  const [expectedAmount, setExpectedAmount] = useState('');
  const [recordedAmount, setRecordedAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadAccountsData = async () => {
    setIsLoading(true);
    try {
      const [colRes, loanRes, recRes, custRes] = await Promise.all([
        safeApiFetch('/api/operations/collections'),
        safeApiFetch('/api/operations/loans'),
        safeApiFetch('/api/operations/reconciliations'),
        safeApiFetch('/api/customers'),
      ]);
      if (colRes.success) setCollections(colRes.collections || colRes.data || []);
      if (loanRes.success) setLoans(loanRes.loans || loanRes.data || []);
      if (recRes.success) setReconciliations(recRes.reconciliations || recRes.data || []);
      if (custRes.success) setCustomers(custRes.customers || custRes.data || []);
    } catch (e) {
      console.error('Failed to load accounts officer data:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAccountsData();
  }, []);

  const summary = useMemo(() => {
    const totalCollections = collections.reduce((s, c) => s + (Number(c.amount) || 0), 0);
    const totalDisbursements = loans.reduce((s, l) => s + (Number(l.amount || l.requestedAmount) || 0), 0);
    const discrepancyCount = reconciliations.filter((r) => Number(r.discrepancyAmount || 0) !== 0).length;
    return { totalCollections, totalDisbursements, totalCustomers: customers.length, discrepancyCount };
  }, [collections, loans, customers.length, reconciliations]);

  const handleSubmitReconciliation = async (e: React.FormEvent) => {
    e.preventDefault();
    setBanner(null);

    const exp = Number(expectedAmount);
    const rec = Number(recordedAmount);
    if (!Number.isFinite(exp) || !Number.isFinite(rec)) {
      setBanner({ type: 'error', msg: 'Enter valid numeric amounts for expected and recorded totals.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await safeApiFetch('/api/operations/reconciliations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          programme,
          expectedAmount: exp,
          recordedAmount: rec,
          notes: notes.trim() || 'Prepared by Staff Accounts Officer for Admin Account Manager review',
        }),
      });
      if (!res.success) {
        setBanner({ type: 'error', msg: res.error || 'Failed to save reconciliation worksheet.' });
      } else {
        const saved = res.reconciliation || res.data;
        setBanner({
          type: 'success',
          msg: `Reconciliation worksheet recorded (${saved?.status || 'RECORDED'}). Forwarded to Admin Account Manager ledger.`,
        });
        setExpectedAmount('');
        setRecordedAmount('');
        setNotes('');
        await loadAccountsData();
      }
    } catch (err: any) {
      setBanner({ type: 'error', msg: err.message || 'Network error saving reconciliation.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const exportAccountsSummaryCsv = () => {
    const rows = [
      ['Record Type', 'Reference', 'Party Name', 'Programme', 'Amount (NGN)', 'Status', 'Date'],
      ...collections.map((c) => [
        c.type || 'COLLECTION',
        c.paymentReference || c.id,
        c.customerName,
        c.programme,
        String(c.amount || 0),
        c.status || 'CONFIRMED',
        c.paymentDate || c.createdAt,
      ]),
      ...loans.map((l) => [
        'LOAN_FACILITY',
        l.id,
        l.borrowerName || l.customerName,
        l.programme,
        String(l.amount || l.requestedAmount || 0),
        l.status || 'PENDING',
        l.createdAt,
      ]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `teamacro-accounts-officer-summary-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight text-white">Staff Accounts Officer Workspace</h1>
                <span className="text-[11px] font-mono uppercase px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                  /staff/accounts-officer
                </span>
              </div>
              <p className="text-xs text-slate-400">
                TEAMACRO SERVICES LTD • Accounts Review & Reconciliation Support (Distinct from Admin Account Manager)
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
              onClick={exportAccountsSummaryCsv}
              className="px-3 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-medium flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              Export Accounts CSV
            </button>
            <button
              onClick={loadAccountsData}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 border border-slate-700"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Sync Books
            </button>
            <div className="text-right hidden sm:block">
              <div className="text-xs font-semibold text-white">{currentUser?.fullName}</div>
              <div className="text-[11px] text-cyan-400">{currentUser?.position || 'Accounts Officer'}</div>
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
            { id: 'review', label: 'Collections, Disbursements & Balances', icon: Layers },
            { id: 'reconcile', label: 'Assist With Reconciliation', icon: Scale },
            { id: 'discrepancies', label: 'Discrepancy Identification', icon: AlertTriangle },
            { id: 'reports', label: 'Financial Summaries & Reports', icon: FileText },
          ].map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as any)}
                className={`px-4 py-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
                  activeTab === t.id
                    ? 'border-cyan-400 text-cyan-400 bg-cyan-500/5'
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
        <div className="p-3.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 text-xs text-cyan-200">
            <ShieldAlert className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>
              <strong>Role Boundary Enforcement:</strong> The Staff Accounts Officer prepares reconciliation worksheets, compares ledger records, and identifies discrepancies, but does not hold unrestricted Admin Account Manager approval or transaction reversal authority.
            </span>
          </div>
          <span className="text-[11px] font-mono text-cyan-300 shrink-0">STAFF ACCOUNTS TIER</span>
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
            <div className="text-xs text-slate-400">Reviewed Savings & Repayments</div>
            <div className="text-2xl font-bold text-emerald-400 font-mono mt-1">
              ₦{summary.totalCollections.toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">{collections.length} recorded receipts</div>
          </div>
          <div className="p-5 rounded-xl bg-slate-900 border border-slate-800">
            <div className="text-xs text-slate-400">Reviewed Loan Disbursements</div>
            <div className="text-2xl font-bold text-sky-400 font-mono mt-1">
              ₦{summary.totalDisbursements.toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">{loans.length} loan facilities</div>
          </div>
          <div className="p-5 rounded-xl bg-slate-900 border border-slate-800">
            <div className="text-xs text-slate-400">Customer Accounts Reviewed</div>
            <div className="text-2xl font-bold text-white font-mono mt-1">
              {summary.totalCustomers}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">Active customer profiles</div>
          </div>
          <div className="p-5 rounded-xl bg-slate-900 border border-slate-800">
            <div className="text-xs text-slate-400">Flagged Discrepancies</div>
            <div className="text-2xl font-bold text-amber-400 font-mono mt-1">
              {summary.discrepancyCount}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">In reconciliation worksheets</div>
          </div>
        </div>

        {activeTab === 'review' && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between gap-3">
              <h2 className="text-sm font-bold text-white">Customer Accounts & Recorded Collections Comparison</h2>
              <div className="relative w-72">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter customer or code..."
                  className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white"
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-[11px] uppercase text-slate-400 bg-slate-950/60">
                    <th className="py-3 px-4">Customer Code</th>
                    <th className="py-3 px-4">Customer Name</th>
                    <th className="py-3 px-4">Phone</th>
                    <th className="py-3 px-4">Recorded Collections</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-xs">
                  {customers
                    .filter(
                      (c) =>
                        !searchQuery ||
                        (c.fullName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                        (c.customerCode || c.id || '').toLowerCase().includes(searchQuery.toLowerCase())
                    )
                    .map((c) => {
                      const custCols = collections
                        .filter((col) => col.customerId === c.id || col.accountNumber === c.customerCode)
                        .reduce((s, col) => s + (Number(col.amount) || 0), 0);
                      return (
                        <tr key={c.id} className="hover:bg-slate-800/30">
                          <td className="py-3 px-4 font-mono text-cyan-400">{c.customerCode || c.id}</td>
                          <td className="py-3 px-4 font-medium text-white">{c.fullName}</td>
                          <td className="py-3 px-4 font-mono text-slate-300">{c.phone}</td>
                          <td className="py-3 px-4 font-mono text-emerald-400 font-bold">
                            ₦{custCols.toLocaleString()}
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[11px] uppercase">
                              {c.status || 'active'}
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

        {activeTab === 'reconcile' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <form
              onSubmit={handleSubmitReconciliation}
              className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4"
            >
              <h2 className="text-sm font-bold text-white">Prepare Reconciliation Worksheet</h2>
              <p className="text-xs text-slate-400">
                Compare expected teller totals against recorded collections and flag any discrepancy for the Admin Account Manager.
              </p>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Programme</label>
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Expected Total (₦) *
                  </label>
                  <input
                    type="number"
                    required
                    value={expectedAmount}
                    onChange={(e) => setExpectedAmount(e.target.value)}
                    placeholder="e.g. 500000"
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Recorded Ledger Total (₦) *
                  </label>
                  <input
                    type="number"
                    required
                    value={recordedAmount}
                    onChange={(e) => setRecordedAmount(e.target.value)}
                    placeholder="e.g. 500000"
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Reconciliation Notes / Variance Explanation
                </label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Document bank teller slip numbers or variance root cause..."
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                {isSubmitting ? 'Submitting Worksheet...' : 'Submit Reconciliation Worksheet'}
              </button>
            </form>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-3">
              <h3 className="text-sm font-bold text-white">Recent Reconciliation Submissions</h3>
              <div className="space-y-2.5 max-h-96 overflow-y-auto">
                {reconciliations.map((r) => (
                  <div key={r.id} className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-white">{r.programme}</span>
                      <span
                        className={`px-2 py-0.5 rounded font-mono text-[11px] ${
                          r.status === 'BALANCED'
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : 'bg-amber-500/10 text-amber-400'
                        }`}
                      >
                        {r.status}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-400 font-mono">
                      <span>Expected: ₦{Number(r.expectedAmount || 0).toLocaleString()}</span>
                      <span>Recorded: ₦{Number(r.recordedAmount || 0).toLocaleString()}</span>
                      <span className="text-amber-300">
                        Diff: ₦{Number(r.discrepancyAmount || 0).toLocaleString()}
                      </span>
                    </div>
                    {r.notes && <div className="text-slate-400 text-[11px]">{r.notes}</div>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {(activeTab === 'discrepancies' || activeTab === 'reports') && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white">
                {activeTab === 'discrepancies' ? 'Identified Financial Discrepancies' : 'Prepared Accounts Summary Report'}
              </h2>
              <button
                onClick={exportAccountsSummaryCsv}
                className="px-3.5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                Download Accounts CSV Report
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {ASSIGNABLE_PROGRAMMES.filter((p) => p !== 'All Programmes').map((prog) => {
                const progCols = collections
                  .filter((c) => c.programme === prog)
                  .reduce((s, c) => s + (Number(c.amount) || 0), 0);
                const progLoans = loans
                  .filter((l) => l.programme === prog)
                  .reduce((s, l) => s + (Number(l.amount || l.requestedAmount) || 0), 0);
                return (
                  <div key={prog} className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                    <div className="text-xs font-bold text-white">{prog}</div>
                    <div className="text-xs text-slate-400">
                      Collections: <span className="text-emerald-400 font-mono">₦{progCols.toLocaleString()}</span>
                    </div>
                    <div className="text-xs text-slate-400">
                      Loan Facilities: <span className="text-sky-400 font-mono">₦{progLoans.toLocaleString()}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
