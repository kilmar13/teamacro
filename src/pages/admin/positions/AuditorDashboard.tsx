import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldAlert,
  Search,
  Download,
  RefreshCw,
  LogOut,
  Lock,
  FileSearch,
  Users,
  Wallet,
  Scale,
  History,
  AlertTriangle,
  Eye,
  X,
} from 'lucide-react';
import { User } from '../../../types/banking';
import { safeApiFetch } from '../../../utils/apiClient';

interface AuditorDashboardProps {
  currentUser: User | null;
  onLogout: () => void;
  onNavigate?: (path: string) => void;
}

export const AuditorDashboard: React.FC<AuditorDashboardProps> = ({
  currentUser,
  onLogout,
  onNavigate,
}) => {
  const [activeTab, setActiveTab] = useState<
    'audit_trail' | 'collections' | 'loans' | 'reconciliations' | 'customers' | 'discrepancies'
  >('audit_trail');
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [collections, setCollections] = useState<any[]>([]);
  const [loans, setLoans] = useState<any[]>([]);
  const [reconciliations, setReconciliations] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);

  const loadAuditData = async () => {
    setIsLoading(true);
    try {
      const [audRes, colRes, loanRes, recRes, custRes] = await Promise.all([
        safeApiFetch('/api/audit/logs'),
        safeApiFetch('/api/operations/collections'),
        safeApiFetch('/api/operations/loans'),
        safeApiFetch('/api/operations/reconciliations'),
        safeApiFetch('/api/customers'),
      ]);
      if (audRes.success) setAuditLogs(audRes.logs || audRes.data?.logs || []);
      if (colRes.success) setCollections(colRes.collections || colRes.data?.collections || []);
      if (loanRes.success) setLoans(loanRes.loans || loanRes.data?.loans || []);
      if (recRes.success) {
        setReconciliations(recRes.reconciliations || recRes.data?.reconciliations || []);
      }
      if (custRes.success) setCustomers(custRes.customers || custRes.data?.customers || []);
    } catch (err) {
      console.warn('[AuditorDashboard] Failed loading audit records:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAuditData();
  }, []);

  const discrepancies = useMemo(
    () => reconciliations.filter((r) => Number(r.discrepancyAmount || 0) !== 0),
    [reconciliations]
  );

  const deniedSecurityEvents = useMemo(
    () => auditLogs.filter((l) => l.status === 'DENIED' || l.status === 'FAILURE'),
    [auditLogs]
  );

  const handleExportAuditPackage = () => {
    const pkg = {
      auditPackage: 'TEAMACRO INDEPENDENT AUDIT & COMPLIANCE DOSSIER',
      auditorName: currentUser?.fullName || 'Internal Auditor',
      position: 'Auditor (Strict Read-Only Clearance)',
      route: '/admin/auditor',
      exportedAt: new Date().toISOString(),
      summary: {
        auditTrailEvents: auditLogs.length,
        deniedEventsCount: deniedSecurityEvents.length,
        collectionsReviewed: collections.length,
        loansReviewed: loans.length,
        reconciliationsReviewed: reconciliations.length,
        discrepanciesFlagged: discrepancies.length,
        customersReviewed: customers.length,
      },
      discrepancies,
      auditLogs,
      collections,
      loans,
      reconciliations,
      customers,
    };
    const blob = new Blob([JSON.stringify(pkg, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `teamacro-auditor-dossier-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[#07112B] text-white flex flex-col">
      {/* Strict Read-Only Top Banner */}
      <div className="bg-amber-500/20 border-b border-amber-400/40 px-6 py-2 flex items-center justify-between text-xs text-amber-200">
        <div className="flex items-center gap-2 font-semibold">
          <Lock className="w-3.5 h-3.5 text-amber-300" />
          <span>
            STRICT READ-ONLY AUDITOR CLEARANCE ENFORCED — Creation, modification, approval, reversal, or deletion of records is disabled on both UI and server.
          </span>
        </div>
        <span className="font-mono text-[11px] text-amber-300 hidden md:inline">
          COMPLIANCE MODE: READ_ONLY
        </span>
      </div>

      {/* Header */}
      <header className="bg-[#0B1942] border-b border-white/10 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-amber-500/15 border border-amber-400/30 flex items-center justify-center">
            <ShieldAlert className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-400/30">
                ADMINISTRATION · AUDITOR (READ-ONLY)
              </span>
              <span className="text-xs font-mono text-slate-400">/admin/auditor</span>
            </div>
            <h1 className="text-lg font-bold text-white mt-0.5">
              Internal Audit, Ledger Inspection & Compliance Verification
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
          <button
            onClick={handleExportAuditPackage}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition"
          >
            <Download className="w-4 h-4" />
            Download Audit Dossier
          </button>
          <button
            onClick={loadAuditData}
            className="p-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 transition"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-amber-400' : ''}`} />
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
          { id: 'audit_trail', label: 'System Audit Trail & Staff Logs', icon: History },
          { id: 'collections', label: 'Savings & Collection Ledger', icon: Wallet },
          { id: 'loans', label: 'Loan Disbursements & Repayments', icon: FileSearch },
          { id: 'reconciliations', label: 'Reconciliation Reports', icon: Scale },
          { id: 'discrepancies', label: 'Discrepancy Findings', icon: AlertTriangle },
          { id: 'customers', label: 'Customer Registry Inspection', icon: Users },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-3.5 text-xs font-semibold border-b-2 transition whitespace-nowrap ${
                active
                  ? 'border-amber-400 text-amber-300 bg-amber-500/10'
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
        {/* KPI Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-[#0D1E4C] border border-white/10 rounded-xl p-5">
            <div className="text-xs text-slate-300">SYSTEM AUDIT LOGS</div>
            <div className="text-2xl font-bold font-mono text-white mt-2">{auditLogs.length}</div>
            <div className="text-xs text-amber-300 mt-1">
              {deniedSecurityEvents.length} security denials logged
            </div>
          </div>

          <div className="bg-[#0D1E4C] border border-white/10 rounded-xl p-5">
            <div className="text-xs text-slate-300">COLLECTIONS INSPECTED</div>
            <div className="text-2xl font-bold font-mono text-white mt-2">{collections.length}</div>
            <div className="text-xs text-emerald-300 mt-1">Immutable transaction history</div>
          </div>

          <div className="bg-[#0D1E4C] border border-white/10 rounded-xl p-5">
            <div className="text-xs text-slate-300">LOAN PORTFOLIO RECORDS</div>
            <div className="text-2xl font-bold font-mono text-white mt-2">{loans.length}</div>
            <div className="text-xs text-sky-300 mt-1">Disbursement & repayment schedules</div>
          </div>

          <div className="bg-[#0D1E4C] border border-white/10 rounded-xl p-5">
            <div className="text-xs text-slate-300">DISCREPANCY FINDINGS</div>
            <div className="text-2xl font-bold font-mono text-white mt-2">
              {discrepancies.length}
            </div>
            <div className="text-xs text-slate-300 mt-1">
              From {reconciliations.length} reconciliation statements
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="bg-[#0D1E4C] border border-white/10 rounded-xl p-4 flex items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search audit events, actor names, transaction references, customer codes..."
              className="w-full pl-10 pr-4 py-2 rounded-lg bg-[#07112B] border border-white/15 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-amber-400"
            />
          </div>
          <span className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-amber-300 font-mono">
            READ-ONLY INSPECTION
          </span>
        </div>

        {/* AUDIT TRAIL TAB */}
        {activeTab === 'audit_trail' && (
          <div className="bg-[#0D1E4C] border border-white/10 rounded-xl p-5 space-y-4">
            <h2 className="text-base font-bold text-white">
              Immutable System Audit Trail & Staff Activity Logs ({auditLogs.length})
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-[11px] uppercase text-slate-400">
                    <th className="py-2.5 px-3">Timestamp</th>
                    <th className="py-2.5 px-3">Actor</th>
                    <th className="py-2.5 px-3">Role</th>
                    <th className="py-2.5 px-3">Action</th>
                    <th className="py-2.5 px-3">Details</th>
                    <th className="py-2.5 px-3">Outcome</th>
                    <th className="py-2.5 px-3 text-right">Inspect</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-xs">
                  {auditLogs
                    .filter(
                      (l) =>
                        !searchQuery.trim() ||
                        JSON.stringify(l).toLowerCase().includes(searchQuery.toLowerCase())
                    )
                    .slice(0, 50)
                    .map((log) => (
                      <tr key={log.id} className="hover:bg-white/5">
                        <td className="py-3 px-3 font-mono text-[11px] text-slate-300">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td className="py-3 px-3 font-semibold text-white">{log.actorName}</td>
                        <td className="py-3 px-3 text-amber-300 font-mono text-[11px]">
                          {log.actorRole}
                        </td>
                        <td className="py-3 px-3 font-mono text-sky-300">{log.action}</td>
                        <td className="py-3 px-3 text-slate-300 max-w-md truncate">
                          {log.details}
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              log.status === 'SUCCESS'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'bg-rose-500/20 text-rose-300'
                            }`}
                          >
                            {log.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            onClick={() => setSelectedRecord(log)}
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
        )}

        {/* COLLECTIONS TAB */}
        {activeTab === 'collections' && (
          <div className="bg-[#0D1E4C] border border-white/10 rounded-xl p-5 space-y-4">
            <h2 className="text-base font-bold text-white">
              Savings Contribution & Repayment Transaction History (Read-Only)
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-[11px] uppercase text-slate-400">
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Reference</th>
                    <th className="py-2.5 px-3">Customer</th>
                    <th className="py-2.5 px-3">Programme</th>
                    <th className="py-2.5 px-3">Amount</th>
                    <th className="py-2.5 px-3">Recorded By</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-xs">
                  {collections.map((c) => (
                    <tr key={c.id} className="hover:bg-white/5">
                      <td className="py-3 px-3 text-slate-300">{c.paymentDate}</td>
                      <td className="py-3 px-3 font-mono text-amber-300">{c.reference}</td>
                      <td className="py-3 px-3 font-semibold text-white">{c.customerName}</td>
                      <td className="py-3 px-3 text-slate-300">{c.programme}</td>
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
              Loan Disbursement & Repayment Audit Register (Read-Only)
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-[11px] uppercase text-slate-400">
                    <th className="py-2.5 px-3">Loan Code</th>
                    <th className="py-2.5 px-3">Borrower</th>
                    <th className="py-2.5 px-3">Programme</th>
                    <th className="py-2.5 px-3">Principal</th>
                    <th className="py-2.5 px-3">Repaid</th>
                    <th className="py-2.5 px-3">Outstanding</th>
                    <th className="py-2.5 px-3">Stage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-xs">
                  {loans.map((l) => (
                    <tr key={l.id} className="hover:bg-white/5">
                      <td className="py-3 px-3 font-mono text-amber-300">{l.loanCode}</td>
                      <td className="py-3 px-3 font-semibold text-white">{l.customerName}</td>
                      <td className="py-3 px-3 text-slate-300">{l.programme}</td>
                      <td className="py-3 px-3 font-mono text-white">
                        ₦{Number(l.principalAmount || 0).toLocaleString()}
                      </td>
                      <td className="py-3 px-3 font-mono text-emerald-300">
                        ₦{Number(l.amountRepaid || 0).toLocaleString()}
                      </td>
                      <td className="py-3 px-3 font-mono text-amber-300">
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

        {/* RECONCILIATIONS TAB */}
        {activeTab === 'reconciliations' && (
          <div className="bg-[#0D1E4C] border border-white/10 rounded-xl p-5 space-y-4">
            <h2 className="text-base font-bold text-white">
              Account Balances & Reconciliation Reports (Read-Only)
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-[11px] uppercase text-slate-400">
                    <th className="py-2.5 px-3">Code</th>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Programme</th>
                    <th className="py-2.5 px-3">Recorded Total</th>
                    <th className="py-2.5 px-3">Bank Ledger Total</th>
                    <th className="py-2.5 px-3">Discrepancy</th>
                    <th className="py-2.5 px-3">Prepared By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-xs">
                  {reconciliations.map((r) => (
                    <tr key={r.id} className="hover:bg-white/5">
                      <td className="py-3 px-3 font-mono text-amber-300">
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
                      <td className="py-3 px-3 font-mono font-bold text-amber-300">
                        ₦{Number(r.discrepancyAmount || 0).toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-slate-300">{r.preparedByName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* DISCREPANCIES TAB */}
        {activeTab === 'discrepancies' && (
          <div className="bg-[#0D1E4C] border border-white/10 rounded-xl p-5 space-y-4">
            <h2 className="text-base font-bold text-white">
              Audit Discrepancy Findings & Security Denials
            </h2>
            {discrepancies.length === 0 ? (
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-400/30 text-xs text-emerald-200">
                No financial reconciliation discrepancies currently flagged.
              </div>
            ) : (
              <div className="space-y-3">
                {discrepancies.map((d) => (
                  <div
                    key={d.id}
                    className="p-4 rounded-xl bg-rose-500/15 border border-rose-400/30 text-xs space-y-1"
                  >
                    <div className="font-bold text-rose-200">
                      {d.reconciliationCode} — {d.programme}
                    </div>
                    <div className="text-white">
                      Variance: ₦{Number(d.discrepancyAmount).toLocaleString()}
                    </div>
                    <div className="text-slate-300">{d.notes}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* CUSTOMERS TAB */}
        {activeTab === 'customers' && (
          <div className="bg-[#0D1E4C] border border-white/10 rounded-xl p-5 space-y-4">
            <h2 className="text-base font-bold text-white">
              Customer Registry Inspection ({customers.length} Records — Read-Only)
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-[11px] uppercase text-slate-400">
                    <th className="py-2.5 px-3">Customer Code</th>
                    <th className="py-2.5 px-3">Full Name</th>
                    <th className="py-2.5 px-3">Account Number</th>
                    <th className="py-2.5 px-3">Phone</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-xs">
                  {customers.map((c) => (
                    <tr key={c.id} className="hover:bg-white/5">
                      <td className="py-3 px-3 font-mono text-amber-300">{c.customerCode}</td>
                      <td className="py-3 px-3 font-semibold text-white">{c.fullName}</td>
                      <td className="py-3 px-3 font-mono text-white">{c.accountNumber}</td>
                      <td className="py-3 px-3 text-slate-300">{c.phone}</td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold uppercase">
                          {c.status || 'active'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Record Inspection Modal */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-[#0D1E4C] border border-white/15 rounded-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">Read-Only Audit Record Inspection</h3>
              <button
                onClick={() => setSelectedRecord(null)}
                className="p-1 rounded-lg hover:bg-white/10"
              >
                <X className="w-4 h-4 text-slate-300" />
              </button>
            </div>
            <pre className="p-4 rounded-xl bg-[#07112B] border border-white/10 text-[11px] font-mono text-slate-200 overflow-x-auto">
              {JSON.stringify(selectedRecord, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};
