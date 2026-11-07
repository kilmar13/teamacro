import React, { useState, useEffect, useMemo } from 'react';
import {
  Wallet, Search, Plus, CheckCircle2, RefreshCw, Download, ShieldAlert,
  LogOut, Receipt, FileText, Sparkles, ArrowLeft
} from 'lucide-react';
import { User, CustomerRecord } from '../../../types/banking';
import { safeApiFetch } from '../../../utils/apiClient';
import { ASSIGNABLE_PROGRAMMES } from '../../../utils/roleRouting';

interface PaymentCollectionDashboardProps {
  currentUser: User | null;
  onLogout: () => void;
  onNavigate?: (path: string) => void;
}

export const PaymentCollectionDashboard: React.FC<PaymentCollectionDashboardProps> = ({
  currentUser,
  onLogout,
  onNavigate,
}) => {
  const [activeTab, setActiveTab] = useState<'record' | 'history' | 'receipts' | 'performance'>('record');
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [collections, setCollections] = useState<any[]>([]);
  const [loans, setLoans] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [programmeFilter, setProgrammeFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'SAVINGS_CONTRIBUTION' | 'LOAN_REPAYMENT'>('ALL');
  const [dateFilter, setDateFilter] = useState('');

  // Record collection form
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [collectionType, setCollectionType] = useState<'SAVINGS_CONTRIBUTION' | 'LOAN_REPAYMENT'>('SAVINGS_CONTRIBUTION');
  const [selectedProgramme, setSelectedProgramme] = useState(
    currentUser?.assignedProgramme && currentUser.assignedProgramme !== 'All Programmes'
      ? currentUser.assignedProgramme
      : ASSIGNABLE_PROGRAMMES[0]
  );
  const [selectedLoanId, setSelectedLoanId] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [paymentReference, setPaymentReference] = useState(() => `REF-${Date.now().toString().slice(-6)}`);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Active receipt preview modal
  const [selectedReceipt, setSelectedReceipt] = useState<any | null>(null);

  const loadOperationalData = async () => {
    setIsLoading(true);
    try {
      const [colRes, loanRes, custRes] = await Promise.all([
        safeApiFetch('/api/operations/collections'),
        safeApiFetch('/api/operations/loans'),
        safeApiFetch('/api/customers'),
      ]);
      if (colRes.success) setCollections(colRes.collections || colRes.data || []);
      if (loanRes.success) setLoans(loanRes.loans || loanRes.data || []);
      if (custRes.success) setCustomers(custRes.customers || custRes.data || []);
    } catch (e) {
      console.error('Failed to load collection workspace data:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadOperationalData();
  }, []);

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === selectedCustomerId) || null,
    [customers, selectedCustomerId]
  );

  const handleSelectCustomer = (cid: string) => {
    setSelectedCustomerId(cid);
    const found = customers.find((c) => c.id === cid);
    if (found?.enrolledProgrammes && found.enrolledProgrammes.length > 0) {
      setSelectedProgramme(found.enrolledProgrammes[0]);
    }
  };

  const handleRecordCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    setBanner(null);

    if (!selectedCustomer) {
      setBanner({ type: 'error', msg: 'Please select a valid customer account.' });
      return;
    }
    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setBanner({ type: 'error', msg: 'Payment amount must be greater than zero.' });
      return;
    }
    if (!paymentReference.trim()) {
      setBanner({ type: 'error', msg: 'A unique payment reference is required to prevent duplicate submissions.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await safeApiFetch('/api/operations/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: selectedCustomer.id,
          customerName: selectedCustomer.fullName,
          accountNumber: selectedCustomer.customerCode || selectedCustomer.id,
          programme: selectedProgramme,
          type: collectionType,
          loanId: collectionType === 'LOAN_REPAYMENT' ? selectedLoanId : undefined,
          amount: parsedAmount,
          paymentDate,
          paymentReference: paymentReference.trim().toUpperCase(),
          notes: notes.trim(),
        }),
      });
      if (!res.success) {
        setBanner({ type: 'error', msg: res.error || 'Failed to record collection transaction.' });
      } else {
        const created = res.collection || res.data;
        setBanner({
          type: 'success',
          msg: `Recorded ₦${parsedAmount.toLocaleString()} (${collectionType === 'SAVINGS_CONTRIBUTION' ? 'Savings Contribution' : 'Loan Repayment'}) — Receipt ${created?.receiptNumber || created?.id}`,
        });
        setSelectedReceipt(created);
        setAmount('');
        setNotes('');
        setPaymentReference(`REF-${Date.now().toString().slice(-6)}`);
        await loadOperationalData();
      }
    } catch (err: any) {
      setBanner({ type: 'error', msg: err.message || 'Network error while recording collection.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredCollections = useMemo(() => {
    return collections.filter((c) => {
      const matchesSearch =
        !searchQuery ||
        (c.customerName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.paymentReference || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.receiptNumber || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.accountNumber || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesProg = programmeFilter === 'ALL' || c.programme === programmeFilter;
      const matchesType = typeFilter === 'ALL' || c.type === typeFilter;
      const matchesDate = !dateFilter || (c.paymentDate || c.createdAt || '').startsWith(dateFilter);
      return matchesSearch && matchesProg && matchesType && matchesDate;
    });
  }, [collections, searchQuery, programmeFilter, typeFilter, dateFilter]);

  const metrics = useMemo(() => {
    const myCollections = collections.filter(
      (c) => c.recordedByUid === currentUser?.id || c.recordedByEmail === currentUser?.email
    );
    const totalAmount = collections.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
    const savingsTotal = collections
      .filter((c) => c.type === 'SAVINGS_CONTRIBUTION')
      .reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
    const loanRepaymentTotal = collections
      .filter((c) => c.type === 'LOAN_REPAYMENT')
      .reduce((sum, c) => sum + (Number(c.amount) || 0), 0);

    return {
      totalCount: collections.length,
      myCount: myCollections.length,
      totalAmount,
      savingsTotal,
      loanRepaymentTotal,
    };
  }, [collections, currentUser?.id, currentUser?.email]);

  const downloadReceiptTxt = (item: any) => {
    const content = [
      '====================================================',
      '              TEAMACRO SERVICES LTD                 ',
      '           OFFICIAL COLLECTION RECEIPT              ',
      '====================================================',
      `Receipt Number    : ${item.receiptNumber || item.id}`,
      `Payment Reference : ${item.paymentReference}`,
      `Payment Date      : ${item.paymentDate || new Date(item.createdAt).toLocaleDateString()}`,
      `Customer Name     : ${item.customerName}`,
      `Customer Code     : ${item.accountNumber || item.customerId || 'N/A'}`,
      `Programme         : ${item.programme}`,
      `Transaction Type  : ${item.type === 'LOAN_REPAYMENT' ? 'Loan Repayment' : 'Savings Contribution'}`,
      `Amount Paid       : NGN ${Number(item.amount || 0).toLocaleString()}`,
      `Status            : ${item.status || 'CONFIRMED'}`,
      `Recorded By       : ${item.recordedByName} (${item.recordedByEmail})`,
      '====================================================',
      'CONFIRMED LEDGER ENTRY - NON-REVERSIBLE BY OFFICER',
    ].join('\n');

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `teamacro-receipt-${item.receiptNumber || item.id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight text-white">Payment Collection Officer Workspace</h1>
                <span className="text-[11px] font-mono uppercase px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  /staff/payment-collection
                </span>
              </div>
              <p className="text-xs text-slate-400">
                TEAMACRO SERVICES LTD • Assigned Programme: <span className="text-slate-200 font-medium">{currentUser?.assignedProgramme || 'All Programmes'}</span>
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
              onClick={loadOperationalData}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 border border-slate-700"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Sync Ledger
            </button>
            <div className="text-right hidden sm:block">
              <div className="text-xs font-semibold text-white">{currentUser?.fullName}</div>
              <div className="text-[11px] text-emerald-400">{currentUser?.position || 'Payment Collection Officer'}</div>
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
            { id: 'record', label: 'Record Savings / Repayment', icon: Plus },
            { id: 'history', label: 'Collection History & Search', icon: FileText },
            { id: 'receipts', label: 'Transaction Receipts', icon: Receipt },
            { id: 'performance', label: 'Collection Performance', icon: Sparkles },
          ].map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as any)}
                className={`px-4 py-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
                  activeTab === t.id
                    ? 'border-emerald-400 text-emerald-400 bg-emerald-500/5'
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
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 text-xs text-amber-200">
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong>Confirmed Transaction Protection:</strong> Payment Collection Officers can record savings contributions and loan repayments with duplicate-reference protection, but <strong>cannot reverse, delete, or alter confirmed transactions</strong>.
            </span>
          </div>
          <span className="text-[11px] font-mono text-amber-300 shrink-0">APPEND-ONLY COLLECTION LEDGER</span>
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
            <div className="text-xs text-slate-400">Total Recorded Collections</div>
            <div className="text-2xl font-bold text-white font-mono mt-1">
              ₦{metrics.totalAmount.toLocaleString()}
            </div>
            <div className="text-[11px] text-emerald-400 mt-1">{metrics.totalCount} confirmed entries</div>
          </div>
          <div className="p-5 rounded-xl bg-slate-900 border border-slate-800">
            <div className="text-xs text-slate-400">Savings Contributions</div>
            <div className="text-2xl font-bold text-emerald-400 font-mono mt-1">
              ₦{metrics.savingsTotal.toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">Esusu & target programmes</div>
          </div>
          <div className="p-5 rounded-xl bg-slate-900 border border-slate-800">
            <div className="text-xs text-slate-400">Loan Repayments Collected</div>
            <div className="text-2xl font-bold text-sky-400 font-mono mt-1">
              ₦{metrics.loanRepaymentTotal.toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">Verified borrower repayments</div>
          </div>
          <div className="p-5 rounded-xl bg-slate-900 border border-slate-800">
            <div className="text-xs text-slate-400">Entries Recorded By You</div>
            <div className="text-2xl font-bold text-amber-400 font-mono mt-1">{metrics.myCount}</div>
            <div className="text-[11px] text-slate-400 mt-1">Duplicate-checked references</div>
          </div>
        </div>

        {activeTab === 'record' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <form
              onSubmit={handleRecordCollection}
              className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <h2 className="text-sm font-bold text-white">Record Customer Payment Collection</h2>
                  <p className="text-xs text-slate-400">
                    Capture savings contributions or loan repayments with automatic duplicate reference detection.
                  </p>
                </div>
                <span className="text-[11px] font-mono px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  INSTANT RECEIPT
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Select Customer Account *
                  </label>
                  <select
                    required
                    value={selectedCustomerId}
                    onChange={(e) => handleSelectCustomer(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white"
                  >
                    <option value="">-- Choose Customer --</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.fullName} ({c.customerCode || c.id})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Collection Type *
                  </label>
                  <select
                    value={collectionType}
                    onChange={(e) => setCollectionType(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white"
                  >
                    <option value="SAVINGS_CONTRIBUTION">Savings Contribution</option>
                    <option value="LOAN_REPAYMENT">Loan Repayment</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Savings Programme / Loan Portfolio *
                  </label>
                  <select
                    value={selectedProgramme}
                    onChange={(e) => setSelectedProgramme(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white"
                  >
                    {ASSIGNABLE_PROGRAMMES.filter((p) => p !== 'All Programmes').map((prog) => (
                      <option key={prog} value={prog}>
                        {prog}
                      </option>
                    ))}
                  </select>
                </div>

                {collectionType === 'LOAN_REPAYMENT' ? (
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Select Active Loan Reference (Optional)
                    </label>
                    <select
                      value={selectedLoanId}
                      onChange={(e) => setSelectedLoanId(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white"
                    >
                      <option value="">-- General Loan Repayment --</option>
                      {loans.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.borrowerName || l.customerName} — ₦{Number(l.outstandingBalance || l.amount || 0).toLocaleString()} ({l.id})
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Payment Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Payment Amount (₦) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="e.g. 25000"
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Unique Payment Reference *
                  </label>
                  <input
                    type="text"
                    required
                    value={paymentReference}
                    onChange={(e) => setPaymentReference(e.target.value)}
                    placeholder="REF-XXXXXX"
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white font-mono uppercase"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Collection Notes / Teller Narration
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Field cash collection / POS slip number / bank transfer narration"
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setPaymentReference(`REF-${Date.now().toString().slice(-6)}`)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300"
                >
                  Generate New Reference
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {isSubmitting ? 'Recording Collection...' : 'Confirm & Generate Receipt'}
                </button>
              </div>
            </form>

            <div className="space-y-4">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                  Selected Customer Account
                </h3>
                {selectedCustomer ? (
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Customer Name:</span>
                      <span className="font-semibold text-white">{selectedCustomer.fullName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Customer Code:</span>
                      <span className="font-mono text-emerald-400">{selectedCustomer.customerCode || selectedCustomer.id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Phone:</span>
                      <span className="font-mono text-white">{selectedCustomer.phone}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Account Status:</span>
                      <span className="text-emerald-400 uppercase">{selectedCustomer.status}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">
                    Select a customer account on the left to inspect their profile and assigned programme before recording payment.
                  </p>
                )}
              </div>

              {selectedReceipt && (
                <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                      <Receipt className="w-4 h-4" />
                      Official Receipt Generated
                    </span>
                    <span className="text-[11px] font-mono text-emerald-400">
                      {selectedReceipt.receiptNumber}
                    </span>
                  </div>
                  <div className="text-xs space-y-1 text-slate-300">
                    <div>Customer: <strong className="text-white">{selectedReceipt.customerName}</strong></div>
                    <div>Amount: <strong className="text-emerald-400 font-mono">₦{Number(selectedReceipt.amount || 0).toLocaleString()}</strong></div>
                    <div>Ref: <span className="font-mono">{selectedReceipt.paymentReference}</span></div>
                  </div>
                  <button
                    onClick={() => downloadReceiptTxt(selectedReceipt)}
                    className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download Printable Receipt
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {(activeTab === 'history' || activeTab === 'receipts') && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by customer, receipt number, reference, or account..."
                  className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={programmeFilter}
                  onChange={(e) => setProgrammeFilter(e.target.value)}
                  className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white"
                >
                  <option value="ALL">All Programmes</option>
                  {ASSIGNABLE_PROGRAMMES.filter((p) => p !== 'All Programmes').map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value as any)}
                  className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white"
                >
                  <option value="ALL">All Types</option>
                  <option value="SAVINGS_CONTRIBUTION">Savings Contributions</option>
                  <option value="LOAN_REPAYMENT">Loan Repayments</option>
                </select>
                <input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-[11px] uppercase text-slate-400 bg-slate-950/60">
                    <th className="py-3 px-4">Receipt & Ref</th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Programme & Type</th>
                    <th className="py-3 px-4">Amount</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Receipt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-xs">
                  {filteredCollections.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-800/30">
                      <td className="py-3 px-4 font-mono">
                        <div className="text-white font-semibold">{c.receiptNumber || c.id}</div>
                        <div className="text-[11px] text-slate-400">{c.paymentReference}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-white">{c.customerName}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{c.accountNumber}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-slate-200">{c.programme}</div>
                        <div className="text-[11px] text-emerald-400">
                          {c.type === 'LOAN_REPAYMENT' ? 'Loan Repayment' : 'Savings Contribution'}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-emerald-400">
                        ₦{Number(c.amount || 0).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-slate-400">
                        {c.paymentDate || new Date(c.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px] font-mono">
                          {c.status || 'CONFIRMED'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => downloadReceiptTxt(c)}
                          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] inline-flex items-center gap-1"
                        >
                          <Download className="w-3 h-3" />
                          Receipt
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredCollections.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500 text-xs">
                        No collection records match the selected filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'performance' && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
            <h2 className="text-sm font-bold text-white">Programme Collection Performance Breakdown</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {ASSIGNABLE_PROGRAMMES.filter((p) => p !== 'All Programmes').map((prog) => {
                const progItems = collections.filter((c) => c.programme === prog);
                const progSum = progItems.reduce((s, c) => s + (Number(c.amount) || 0), 0);
                return (
                  <div key={prog} className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                    <div className="text-xs font-semibold text-white">{prog}</div>
                    <div className="text-xl font-bold text-emerald-400 font-mono mt-1">
                      ₦{progSum.toLocaleString()}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">
                      {progItems.length} confirmed collection entries
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
