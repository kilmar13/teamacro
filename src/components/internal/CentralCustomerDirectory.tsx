import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Search,
  UserPlus,
  Filter,
  RefreshCw,
  Phone,
  Users,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  UserCheck,
  ExternalLink,
  X,
} from 'lucide-react';
import { CustomerRecord } from '../../types/banking';
import { LedgerEngine } from '../../services/ledgerEngine';
import { safeApiFetch } from '../../utils/apiClient';
import { ASSIGNABLE_PROGRAMMES } from '../../utils/roleRouting';
import { CustomerProfileModal, formatDateTimeDisplay, formatFieldOrNotProvided } from './CustomerProfileModal';

interface CentralCustomerDirectoryProps {
  title?: string;
  subtitle?: string;
  canCreateCustomer?: boolean;
  canEditCustomer?: boolean;
  canRecordActivity?: boolean;
  defaultOpenRegisterModal?: boolean;
  onCustomersChanged?: (customers: CustomerRecord[]) => void;
}

export const CentralCustomerDirectory: React.FC<CentralCustomerDirectoryProps> = ({
  title = 'Central Customer Directory',
  subtitle = 'Authoritative, permanent Firestore customer registry shared across all authorised internal departments. All customer records remain visible indefinitely.',
  canCreateCustomer = true,
  canEditCustomer = true,
  canRecordActivity = true,
  defaultOpenRegisterModal = false,
  onCustomersChanged,
}) => {
  const currentUser = LedgerEngine.getCurrentStaff() || LedgerEngine.getCurrentUser();
  const [customers, setCustomers] = useState<CustomerRecord[]>(() => LedgerEngine.getCustomers());
  const [syncing, setSyncing] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [staffFilter, setStaffFilter] = useState<string>('ALL');

  // Selected Customer Profile Modal
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRecord | null>(null);

  // New Customer Registration Modal
  const [showRegisterModal, setShowRegisterModal] = useState(defaultOpenRegisterModal);
  const [submitting, setSubmitting] = useState(false);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [sameAsNextOfKin, setSameAsNextOfKin] = useState(false);

  const [newCustomerForm, setNewCustomerForm] = useState({
    fullName: '',
    phone: '',
    altPhone: '',
    email: '',
    address: '',
    state: 'Lagos',
    lga: '',
    occupation: '',
    idType: 'NIN',
    ninOrBvn: '',
    dateOfBirth: '',
    gender: '',
    enrolledProgrammes: [ASSIGNABLE_PROGRAMMES[0]],
    nextOfKinName: '',
    nextOfKinPhone: '',
    nextOfKinRelationship: '',
    nextOfKinAddress: '',
    guarantorName: '',
    guarantorPhone: '',
    guarantorRelationship: '',
    guarantorAddress: '',
    guarantorOccupation: '',
    guarantorVerificationStatus: 'Pending Verification',
  });

  const requestIdRef = useRef(0);
  const onCustomersChangedRef = useRef(onCustomersChanged);
  onCustomersChangedRef.current = onCustomersChanged;

  const refreshDirectory = useCallback(async (arg?: AbortSignal | React.MouseEvent) => {
    const signal = typeof AbortSignal !== 'undefined' && arg instanceof AbortSignal ? arg : undefined;
    const reqId = ++requestIdRef.current;
    setSyncing(true);
    try {
      const res = await safeApiFetch('/api/customers', signal ? { signal } : undefined);
      if (signal?.aborted || reqId !== requestIdRef.current) return;
      if (res.success && Array.isArray(res.customers || res.data?.customers)) {
        const list = res.customers || res.data?.customers;
        setCustomers(list);
        onCustomersChangedRef.current?.(list);
      } else {
        const synced = await LedgerEngine.syncCustomersFromServer();
        if (signal?.aborted || reqId !== requestIdRef.current) return;
        setCustomers(synced);
        onCustomersChangedRef.current?.(synced);
      }
    } catch {
      if (signal?.aborted || reqId !== requestIdRef.current) return;
      const local = LedgerEngine.getCustomers();
      setCustomers(local);
    } finally {
      if (!signal?.aborted && reqId === requestIdRef.current) {
        setSyncing(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void refreshDirectory(controller.signal);
    return () => {
      controller.abort();
    };
  }, [refreshDirectory]);

  // Keep Guarantor synced if "sameAsNextOfKin" is checked
  useEffect(() => {
    if (sameAsNextOfKin) {
      setNewCustomerForm((prev) => ({
        ...prev,
        guarantorName: prev.nextOfKinName,
        guarantorPhone: prev.nextOfKinPhone,
        guarantorRelationship: prev.nextOfKinRelationship,
        guarantorAddress: prev.nextOfKinAddress,
      }));
    }
  }, [
    sameAsNextOfKin,
    newCustomerForm.nextOfKinName,
    newCustomerForm.nextOfKinPhone,
    newCustomerForm.nextOfKinRelationship,
    newCustomerForm.nextOfKinAddress,
  ]);

  // Distinct registering staff options for filter dropdown
  const registeringStaffOptions = useMemo(() => {
    const map = new Map<string, string>();
    customers.forEach((c) => {
      const key = c.registeredByName || c.registeredByStaffCode || c.registeredByStaffId;
      if (key) {
        const label = c.registeredByName
          ? `${c.registeredByName}${c.registeredByStaffCode ? ` (${c.registeredByStaffCode})` : ''}`
          : key;
        map.set(key, label);
      }
    });
    return Array.from(map.entries());
  }, [customers]);

  const filteredCustomers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return customers.filter((c) => {
      if (statusFilter !== 'ALL' && String(c.status || 'active').toUpperCase() !== statusFilter.toUpperCase()) {
        return false;
      }
      if (staffFilter !== 'ALL') {
        const staffKey = c.registeredByName || c.registeredByStaffCode || c.registeredByStaffId || '';
        if (staffKey !== staffFilter) return false;
      }
      if (!q) return true;
      const matchesName = (c.fullName || '').toLowerCase().includes(q);
      const matchesCode = (c.customerCode || '').toLowerCase().includes(q) || (c.id || '').toLowerCase().includes(q);
      const matchesPhone = (c.phone || '').toLowerCase().includes(q) || (c.altPhone || '').toLowerCase().includes(q);
      const matchesAccount = (c.accountNumber || '').toLowerCase().includes(q);
      const matchesStaff =
        (c.registeredByName || '').toLowerCase().includes(q) ||
        (c.registeredByStaffCode || '').toLowerCase().includes(q) ||
        (c.registeredByPosition || '').toLowerCase().includes(q);
      return matchesName || matchesCode || matchesPhone || matchesAccount || matchesStaff;
    });
  }, [customers, searchQuery, statusFilter, staffFilter]);

  const handleToggleProgramme = (prog: string) => {
    setNewCustomerForm((prev) => ({
      ...prev,
      enrolledProgrammes: prev.enrolledProgrammes.includes(prog)
        ? prev.enrolledProgrammes.filter((s) => s !== prog)
        : [...prev.enrolledProgrammes, prog],
    }));
  };

  const handleRegisterCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomerForm.fullName.trim() || !newCustomerForm.phone.trim()) {
      setBanner({ type: 'error', message: 'Customer full name and primary phone number are required.' });
      return;
    }

    setSubmitting(true);
    setBanner(null);
    try {
      const payload = {
        fullName: newCustomerForm.fullName.trim(),
        phone: newCustomerForm.phone.trim(),
        altPhone: newCustomerForm.altPhone.trim(),
        email: newCustomerForm.email.trim(),
        address: newCustomerForm.address.trim(),
        state: newCustomerForm.state.trim(),
        lga: newCustomerForm.lga.trim(),
        occupation: newCustomerForm.occupation.trim(),
        idType: newCustomerForm.idType,
        ninOrBvn: newCustomerForm.ninOrBvn.trim(),
        dateOfBirth: newCustomerForm.dateOfBirth,
        gender: newCustomerForm.gender,
        enrolledProgrammes: newCustomerForm.enrolledProgrammes,
        nextOfKinName: newCustomerForm.nextOfKinName.trim(),
        nextOfKinPhone: newCustomerForm.nextOfKinPhone.trim(),
        nextOfKinRelationship: newCustomerForm.nextOfKinRelationship.trim(),
        nextOfKinAddress: newCustomerForm.nextOfKinAddress.trim(),
        guarantorName: newCustomerForm.guarantorName.trim(),
        guarantorPhone: newCustomerForm.guarantorPhone.trim(),
        guarantorRelationship: newCustomerForm.guarantorRelationship.trim(),
        guarantorAddress: newCustomerForm.guarantorAddress.trim(),
        guarantorOccupation: newCustomerForm.guarantorOccupation.trim(),
        guarantorVerificationStatus: newCustomerForm.guarantorName.trim()
          ? newCustomerForm.guarantorVerificationStatus
          : 'Not Provided',
        registeredByStaffId: currentUser?.id || 'STAFF',
        status: 'active',
      };

      const res = await safeApiFetch('/api/customers', {
        method: 'POST',
        body: JSON.stringify({ customer: payload }),
      });

      const created: CustomerRecord | undefined = res.customer || res.data?.customer;
      if (!res.success || res.savedToFirestore === false || !created) {
        throw new Error(
          res.message ||
            res.error ||
            'Failed to save customer record to Firestore database. Please check the details and try again.'
        );
      }

      LedgerEngine.saveCustomer({ ...created, __fromServer: true }, currentUser);
      await refreshDirectory();
      setShowRegisterModal(false);
      setSameAsNextOfKin(false);
      setNewCustomerForm({
        fullName: '',
        phone: '',
        altPhone: '',
        email: '',
        address: '',
        state: 'Lagos',
        lga: '',
        occupation: '',
        idType: 'NIN',
        ninOrBvn: '',
        dateOfBirth: '',
        gender: '',
        enrolledProgrammes: [ASSIGNABLE_PROGRAMMES[0]],
        nextOfKinName: '',
        nextOfKinPhone: '',
        nextOfKinRelationship: '',
        nextOfKinAddress: '',
        guarantorName: '',
        guarantorPhone: '',
        guarantorRelationship: '',
        guarantorAddress: '',
        guarantorOccupation: '',
        guarantorVerificationStatus: 'Pending Verification',
      });
      setBanner({
        type: 'success',
        message: `Customer successfully registered — ${created.fullName} (${created.customerCode}) saved permanently in Firestore under ${created.registeredByName || currentUser?.fullName || 'your account'}.`,
      });
    } catch (err: any) {
      setBanner({
        type: 'error',
        message: err?.message || 'Failed to register customer.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5 text-slate-900">
      {/* Header Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <Users className="w-5 h-5 text-emerald-600" />
              <h2 className="text-lg font-bold text-slate-900">{title}</h2>
              <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                {customers.length} Total Records
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">{subtitle}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={refreshDirectory}
              disabled={syncing}
              className="px-3.5 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin text-emerald-600' : ''}`} />
              {syncing ? 'Syncing Firestore...' : 'Refresh Directory'}
            </button>

            {canCreateCustomer && (
              <button
                type="button"
                onClick={() => {
                  setBanner(null);
                  setShowRegisterModal(true);
                }}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors"
              >
                <UserPlus className="w-4 h-4" />
                Register New Customer
              </button>
            )}
          </div>
        </div>

        {/* Search & Filter Controls */}
        <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-6 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by customer name, Customer ID, phone number, or registering staff..."
              className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none"
            />
          </div>

          <div className="md:col-span-3 flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              value={staffFilter}
              onChange={(e) => setStaffFilter(e.target.value)}
              aria-label="Filter by registering staff member"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white text-slate-700 font-medium"
            >
              <option value="ALL">All Registering Staff</option>
              {registeringStaffOptions.map(([key, label]) => (
                <option key={key} value={key}>
                  Registered by: {label}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter by customer status"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white text-slate-700 font-medium"
            >
              <option value="ALL">All Customer Statuses</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="DORMANT">INACTIVE / DORMANT</option>
              <option value="SUSPENDED">SUSPENDED</option>
            </select>
          </div>
        </div>
      </div>

      {/* Feedback Banner */}
      {banner && (
        <div
          className={`p-4 rounded-xl border text-xs font-semibold flex items-center justify-between ${
            banner.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {banner.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{banner.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setBanner(null)}
            className="text-slate-500 hover:text-slate-900 font-bold ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Customer Directory Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden min-h-[180px] [contain:layout]">
        <div className="overflow-x-auto">
          <table className="w-full table-fixed min-w-[880px] text-left border-collapse">
            <colgroup>
              <col className="w-[14%]" />
              <col className="w-[22%]" />
              <col className="w-[16%]" />
              <col className="w-[20%]" />
              <col className="w-[12%]" />
              <col className="w-[8%]" />
              <col className="w-[8%]" />
            </colgroup>
            <thead>
              <tr className="bg-slate-900 text-white text-[11px] font-bold uppercase tracking-wider">
                <th className="py-3.5 px-4">Customer ID</th>
                <th className="py-3.5 px-4">Customer Name (Click for Profile)</th>
                <th className="py-3.5 px-4">Phone Number</th>
                <th className="py-3.5 px-4">Registered By</th>
                <th className="py-3.5 px-4">Registration Date</th>
                <th className="py-3.5 px-4">Customer Status</th>
                <th className="py-3.5 px-4 text-right">Profile</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-500">
                    No customer records match your current search or filter criteria.
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((cust) => (
                  <tr key={cust.id} className="hover:bg-emerald-50/40 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-700 whitespace-nowrap">
                      {cust.customerCode || cust.id}
                    </td>
                    <td className="py-3.5 px-4">
                      <button
                        type="button"
                        onClick={() => setSelectedCustomer(cust)}
                        className="text-left font-bold text-emerald-700 hover:text-emerald-900 hover:underline flex items-center gap-1.5 group"
                      >
                        <span>{cust.fullName}</span>
                        <ExternalLink className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100 transition-opacity shrink-0" />
                      </button>
                      <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                        Acct: {formatFieldOrNotProvided(cust.accountNumber)}
                      </p>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="font-semibold text-slate-800 flex items-center gap-1">
                        <Phone className="w-3 h-3 text-slate-400" />
                        {formatFieldOrNotProvided(cust.phone)}
                      </div>
                      {cust.altPhone && (
                        <div className="text-[11px] text-slate-500 mt-0.5">Alt: {cust.altPhone}</div>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">
                        {formatFieldOrNotProvided(cust.registeredByName || cust.registeredByStaffId)}
                      </div>
                      <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-1 mt-0.5">
                        {cust.registeredByStaffCode && (
                          <span className="font-mono text-emerald-700 font-semibold">
                            {cust.registeredByStaffCode}
                          </span>
                        )}
                        {cust.registeredByPosition && <span>• {cust.registeredByPosition}</span>}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap text-slate-700 font-medium">
                      {formatDateTimeDisplay(cust.registeredAt || cust.registrationDate)}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded text-[11px] font-bold uppercase ${
                          String(cust.status).toUpperCase() === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : String(cust.status).toUpperCase() === 'INACTIVE' ||
                              String(cust.status).toUpperCase() === 'DORMANT'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {cust.status || 'ACTIVE'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setSelectedCustomer(cust)}
                        className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-emerald-700 text-white text-[11px] font-bold transition-colors"
                      >
                        Open Profile
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Customer Profile Modal */}
      {selectedCustomer && (
        <CustomerProfileModal
          customer={selectedCustomer}
          onClose={() => setSelectedCustomer(null)}
          canEdit={canEditCustomer}
          canRecordActivity={canRecordActivity}
          onCustomerUpdated={(updated) => {
            setSelectedCustomer(updated);
            setCustomers((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
          }}
        />
      )}

      {/* New Customer Registration Modal */}
      {showRegisterModal && canCreateCustomer && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden my-auto">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800 shrink-0">
              <div>
                <h3 className="text-lg font-bold">Register New Customer in Central Directory</h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  Customer record is saved permanently to Firestore and shared across all authorised internal departments.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowRegisterModal(false)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRegisterCustomer} className="p-6 overflow-y-auto space-y-6 flex-1">
              {/* Automatic Staff Registration Ownership Banner */}
              <div className="bg-emerald-50/90 border border-emerald-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-emerald-950">
                      Automatic Registration Attribution (Server-Enforced)
                    </p>
                    <p className="text-xs text-emerald-800 mt-0.5">
                      Registering Officer: <strong>{currentUser?.fullName || 'Authenticated Officer'}</strong> • Position:{' '}
                      <strong>{currentUser?.position || currentUser?.roleTitle || currentUser?.role || 'Staff'}</strong> • Staff ID:{' '}
                      <strong className="font-mono">{currentUser?.staffCode || currentUser?.id || 'AUTO'}</strong>
                    </p>
                  </div>
                </div>
                <span className="text-[11px] font-bold px-2.5 py-1 rounded bg-white text-emerald-800 border border-emerald-300 shrink-0 self-start sm:self-center">
                  Locked to Session
                </span>
              </div>

              {/* 1. Customer Identification & Contact */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">
                  1. Customer Identification & Contact Information
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name *</label>
                    <input
                      type="text"
                      required
                      value={newCustomerForm.fullName}
                      onChange={(e) => setNewCustomerForm({ ...newCustomerForm, fullName: e.target.value })}
                      placeholder="e.g. Mrs. Folake Adeyemi"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Primary Phone Number *</label>
                    <input
                      type="text"
                      required
                      value={newCustomerForm.phone}
                      onChange={(e) => setNewCustomerForm({ ...newCustomerForm, phone: e.target.value })}
                      placeholder="e.g. 08031234567"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Alternative Phone Number</label>
                    <input
                      type="text"
                      value={newCustomerForm.altPhone}
                      onChange={(e) => setNewCustomerForm({ ...newCustomerForm, altPhone: e.target.value })}
                      placeholder="Optional"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
                    <input
                      type="email"
                      value={newCustomerForm.email}
                      onChange={(e) => setNewCustomerForm({ ...newCustomerForm, email: e.target.value })}
                      placeholder="Optional"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Residential Address *</label>
                    <input
                      type="text"
                      required
                      value={newCustomerForm.address}
                      onChange={(e) => setNewCustomerForm({ ...newCustomerForm, address: e.target.value })}
                      placeholder="Street address, area, town"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">State</label>
                    <input
                      type="text"
                      value={newCustomerForm.state}
                      onChange={(e) => setNewCustomerForm({ ...newCustomerForm, state: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">LGA</label>
                    <input
                      type="text"
                      value={newCustomerForm.lga}
                      onChange={(e) => setNewCustomerForm({ ...newCustomerForm, lga: e.target.value })}
                      placeholder="Local Government Area"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Occupation / Trade</label>
                    <input
                      type="text"
                      value={newCustomerForm.occupation}
                      onChange={(e) => setNewCustomerForm({ ...newCustomerForm, occupation: e.target.value })}
                      placeholder="e.g. Merchant, Civil Servant"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Identification Type</label>
                    <select
                      value={newCustomerForm.idType}
                      onChange={(e) => setNewCustomerForm({ ...newCustomerForm, idType: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-900"
                    >
                      <option value="NIN">NIN</option>
                      <option value="BVN">BVN</option>
                      <option value="VOTERS_CARD">Voter&apos;s Card</option>
                      <option value="DRIVERS_LICENSE">Driver&apos;s License</option>
                      <option value="INTERNATIONAL_PASSPORT">International Passport</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">NIN / BVN / ID Number</label>
                    <input
                      type="text"
                      value={newCustomerForm.ninOrBvn}
                      onChange={(e) => setNewCustomerForm({ ...newCustomerForm, ninOrBvn: e.target.value })}
                      placeholder="Enter identification number if provided"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900"
                    />
                  </div>
                </div>
              </div>

              {/* 2. Separate Section A: Next of Kin Details */}
              <div className="pt-4 border-t border-slate-200">
                <div className="flex items-center gap-2 mb-3">
                  <Users className="w-4 h-4 text-indigo-700" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-900">
                    2. Section A — Next of Kin Details
                  </h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-indigo-50/40 p-4 rounded-xl border border-indigo-100">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Next of Kin Full Name *</label>
                    <input
                      type="text"
                      required
                      value={newCustomerForm.nextOfKinName}
                      onChange={(e) => setNewCustomerForm({ ...newCustomerForm, nextOfKinName: e.target.value })}
                      placeholder="Full name of Next of Kin"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Next of Kin Phone Number *</label>
                    <input
                      type="text"
                      required
                      value={newCustomerForm.nextOfKinPhone}
                      onChange={(e) => setNewCustomerForm({ ...newCustomerForm, nextOfKinPhone: e.target.value })}
                      placeholder="Phone number"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Relationship with Customer *</label>
                    <input
                      type="text"
                      required
                      value={newCustomerForm.nextOfKinRelationship}
                      onChange={(e) => setNewCustomerForm({ ...newCustomerForm, nextOfKinRelationship: e.target.value })}
                      placeholder="e.g. Spouse, Sibling, Parent, Child"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Next of Kin Address</label>
                    <input
                      type="text"
                      value={newCustomerForm.nextOfKinAddress}
                      onChange={(e) => setNewCustomerForm({ ...newCustomerForm, nextOfKinAddress: e.target.value })}
                      placeholder="Residential address of Next of Kin"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-900"
                    />
                  </div>
                </div>
              </div>

              {/* 3. Separate Section B: Guarantor Details */}
              <div className="pt-4 border-t border-slate-200">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-emerald-700" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-900">
                      3. Section B — Guarantor Details (Separate from Next of Kin)
                    </h4>
                  </div>
                  <label className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-800 bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={sameAsNextOfKin}
                      onChange={(e) => setSameAsNextOfKin(e.target.checked)}
                      className="rounded text-emerald-600"
                    />
                    <span>Same person serves as Next of Kin & Guarantor</span>
                  </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-emerald-50/40 p-4 rounded-xl border border-emerald-100">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Guarantor Full Name</label>
                    <input
                      type="text"
                      value={newCustomerForm.guarantorName}
                      onChange={(e) => setNewCustomerForm({ ...newCustomerForm, guarantorName: e.target.value })}
                      placeholder="Full name of Guarantor"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Guarantor Phone Number</label>
                    <input
                      type="text"
                      value={newCustomerForm.guarantorPhone}
                      onChange={(e) => setNewCustomerForm({ ...newCustomerForm, guarantorPhone: e.target.value })}
                      placeholder="Phone number"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Relationship with Customer</label>
                    <input
                      type="text"
                      value={newCustomerForm.guarantorRelationship}
                      onChange={(e) => setNewCustomerForm({ ...newCustomerForm, guarantorRelationship: e.target.value })}
                      placeholder="e.g. Business Partner, Employer, Relative"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-900"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Guarantor Address</label>
                    <input
                      type="text"
                      value={newCustomerForm.guarantorAddress}
                      onChange={(e) => setNewCustomerForm({ ...newCustomerForm, guarantorAddress: e.target.value })}
                      placeholder="Residential or business address of Guarantor"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Guarantor Verification Status</label>
                    <select
                      value={newCustomerForm.guarantorVerificationStatus}
                      onChange={(e) =>
                        setNewCustomerForm({
                          ...newCustomerForm,
                          guarantorVerificationStatus: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-900"
                    >
                      <option value="Pending Verification">Pending Verification</option>
                      <option value="Verified">Verified</option>
                      <option value="Unverified">Unverified</option>
                      <option value="Not Provided">Not provided</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* 4. Savings & Contribution Programmes */}
              <div className="pt-4 border-t border-slate-200">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">
                  4. Savings & Contribution Programme Enrolment
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                  {ASSIGNABLE_PROGRAMMES.filter((p) => p !== 'All Programmes').map((prog) => {
                    const checked = newCustomerForm.enrolledProgrammes.includes(prog);
                    return (
                      <label
                        key={prog}
                        className={`flex items-center gap-2.5 p-2.5 rounded-lg border text-xs font-semibold cursor-pointer ${
                          checked
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                            : 'bg-slate-50 border-slate-200 text-slate-700'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => handleToggleProgramme(prog)}
                          className="rounded text-emerald-600"
                        />
                        <span>{prog}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowRegisterModal(false)}
                  className="px-4 py-2.5 rounded-lg border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm disabled:opacity-50"
                >
                  {submitting ? 'Saving Customer to Firestore...' : 'Complete Customer Registration'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
