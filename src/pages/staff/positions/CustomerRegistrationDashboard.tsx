import React, { useState, useEffect, useMemo } from 'react';
import {
  UserPlus,
  Users,
  Search,
  AlertCircle,
  RefreshCw,
  LogOut,
  Eye,
  Edit3,
  ShieldCheck,
  UserCheck,
  ExternalLink,
} from 'lucide-react';
import { User, CustomerRecord } from '../../../types/banking';
import { safeApiFetch } from '../../../utils/apiClient';
import { LedgerEngine } from '../../../services/ledgerEngine';
import { ASSIGNABLE_PROGRAMMES } from '../../../utils/roleRouting';
import { CustomerProfileModal, formatDateTimeDisplay, formatFieldOrNotProvided } from '../../../components/internal/CustomerProfileModal';

interface CustomerRegistrationDashboardProps {
  currentUser: User | null;
  onLogout: () => void;
  onNavigate?: (path: string) => void;
}

export const CustomerRegistrationDashboard: React.FC<CustomerRegistrationDashboardProps> = ({
  currentUser,
  onLogout,
  onNavigate,
}) => {
  const [activeTab, setActiveTab] = useState<'register' | 'directory' | 'incomplete'>('register');
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [programmeFilter, setProgrammeFilter] = useState('ALL');
  const [staffFilter, setStaffFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRecord | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sameAsNextOfKin, setSameAsNextOfKin] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const [form, setForm] = useState({
    id: '',
    fullName: '',
    phone: '',
    altPhone: '',
    email: '',
    address: '',
    state: 'Lagos',
    lga: 'Ikeja',
    idType: 'NIN',
    ninOrBvn: '',
    occupation: '',
    nextOfKinName: '',
    nextOfKinPhone: '',
    nextOfKinRelationship: 'Spouse',
    nextOfKinAddress: '',
    guarantorName: '',
    guarantorPhone: '',
    guarantorRelationship: '',
    guarantorAddress: '',
    guarantorVerificationStatus: 'PENDING' as NonNullable<CustomerRecord['guarantorVerificationStatus']>,
    enrolledProgrammes: [ASSIGNABLE_PROGRAMMES[0]],
  });

  const loadCustomers = async () => {
    setIsLoading(true);
    try {
      const res = await safeApiFetch('/api/customers');
      if (res.success) {
        setCustomers(res.customers || res.data?.customers || []);
      }
    } catch (err) {
      console.warn('[CustomerRegistrationDashboard] Load failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  useEffect(() => {
    if (sameAsNextOfKin) {
      setForm((prev) => ({
        ...prev,
        guarantorName: prev.nextOfKinName,
        guarantorPhone: prev.nextOfKinPhone,
        guarantorRelationship: prev.nextOfKinRelationship,
        guarantorAddress: prev.nextOfKinAddress,
      }));
    }
  }, [
    sameAsNextOfKin,
    form.nextOfKinName,
    form.nextOfKinPhone,
    form.nextOfKinRelationship,
    form.nextOfKinAddress,
  ]);

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

  const incompleteCustomers = useMemo(
    () => customers.filter((c) => !c.ninOrBvn || !c.nextOfKinName || !c.guarantorName),
    [customers]
  );

  const filteredCustomers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return customers.filter((c) => {
      if (statusFilter !== 'ALL' && (c.status || 'ACTIVE') !== statusFilter) return false;
      if (staffFilter !== 'ALL') {
        const staffKey = c.registeredByName || c.registeredByStaffCode || c.registeredByStaffId || '';
        if (staffKey !== staffFilter) return false;
      }
      const matchesSearch =
        !q ||
        String(c.fullName || '').toLowerCase().includes(q) ||
        String(c.phone || '').toLowerCase().includes(q) ||
        String(c.altPhone || '').toLowerCase().includes(q) ||
        String(c.customerCode || '').toLowerCase().includes(q) ||
        String(c.accountNumber || '').toLowerCase().includes(q) ||
        String(c.registeredByName || '').toLowerCase().includes(q) ||
        String(c.registeredByStaffCode || '').toLowerCase().includes(q);
      const matchesProg =
        programmeFilter === 'ALL' ||
        (Array.isArray((c as any).enrolledProgrammes) &&
          (c as any).enrolledProgrammes.some(
            (p: string) => p.toLowerCase() === programmeFilter.toLowerCase()
          )) ||
        (Array.isArray(c.enrolledSchemes) &&
          c.enrolledSchemes.some(
            (p: string) => p.toLowerCase().replace(/_/g, ' ') === programmeFilter.toLowerCase()
          ));
      return matchesSearch && matchesProg;
    });
  }, [customers, searchQuery, programmeFilter, statusFilter, staffFilter]);

  const handleToggleProgramme = (prog: string) => {
    setForm((prev) => {
      const exists = prev.enrolledProgrammes.includes(prog);
      const next = exists
        ? prev.enrolledProgrammes.filter((p) => p !== prog)
        : [...prev.enrolledProgrammes, prog];
      return {
        ...prev,
        enrolledProgrammes: next.length > 0 ? next : [prog],
      };
    });
  };

  const resetForm = () => {
    setSameAsNextOfKin(false);
    setForm({
      id: '',
      fullName: '',
      phone: '',
      altPhone: '',
      email: '',
      address: '',
      state: 'Lagos',
      lga: 'Ikeja',
      idType: 'NIN',
      ninOrBvn: '',
      occupation: '',
      nextOfKinName: '',
      nextOfKinPhone: '',
      nextOfKinRelationship: 'Spouse',
      nextOfKinAddress: '',
      guarantorName: '',
      guarantorPhone: '',
      guarantorRelationship: '',
      guarantorAddress: '',
      guarantorVerificationStatus: 'PENDING',
      enrolledProgrammes: [ASSIGNABLE_PROGRAMMES[0]],
    });
  };

  const handleEditCustomer = (cust: any) => {
    setSameAsNextOfKin(false);
    setForm({
      id: cust.id || '',
      fullName: cust.fullName || '',
      phone: cust.phone || '',
      altPhone: cust.altPhone || '',
      email: cust.email || '',
      address: cust.address || '',
      state: cust.state || 'Lagos',
      lga: cust.lga || 'Ikeja',
      idType: cust.idType || 'NIN',
      ninOrBvn: cust.ninOrBvn || '',
      occupation: cust.occupation || '',
      nextOfKinName: cust.nextOfKinName || '',
      nextOfKinPhone: cust.nextOfKinPhone || '',
      nextOfKinRelationship: cust.nextOfKinRelation || cust.nextOfKinRelationship || 'Relative',
      nextOfKinAddress: cust.nextOfKinAddress || '',
      guarantorName: cust.guarantorName || '',
      guarantorPhone: cust.guarantorPhone || '',
      guarantorRelationship: cust.guarantorRelationship || '',
      guarantorAddress: cust.guarantorAddress || '',
      guarantorVerificationStatus: cust.guarantorVerificationStatus || 'PENDING',
      enrolledProgrammes:
        Array.isArray(cust.enrolledProgrammes) && cust.enrolledProgrammes.length > 0
          ? cust.enrolledProgrammes
          : [ASSIGNABLE_PROGRAMMES[0]],
    });
    setActiveTab('register');
  };

  const handleSubmitCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fullName.trim() || !form.phone.trim()) {
      setFeedback({
        type: 'error',
        message: 'Customer full legal name and primary phone number are required.',
      });
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);
    const isEditing = Boolean(form.id && form.id.trim());
    const endpoint = isEditing
      ? `/api/customers/${encodeURIComponent(form.id.trim())}`
      : '/api/customers';
    const method = isEditing ? 'PUT' : 'POST';

    try {
      const res = await safeApiFetch(endpoint, {
        method,
        body: JSON.stringify({
          isUpdate: isEditing,
          customer: {
            ...form,
            id: isEditing ? form.id.trim() : undefined,
            nextOfKinRelation: form.nextOfKinRelationship,
            guarantorVerificationStatus: form.guarantorName.trim()
              ? form.guarantorVerificationStatus
              : 'NOT_PROVIDED',
            registeredByStaffId: currentUser?.id || 'STAFF_REG',
          },
        }),
      });

      const savedCustomer = res.customer || res.data?.customer;
      const confirmedFirestore = res.savedToFirestore !== false && Boolean(savedCustomer);

      if (!res.success || !confirmedFirestore) {
        setFeedback({
          type: 'error',
          message:
            res.message ||
            res.error ||
            'Failed to save customer record to Firestore database. Please verify details and try again.',
        });
        return;
      }

      LedgerEngine.saveCustomer({ ...savedCustomer, __fromServer: true }, currentUser);
      setFeedback({
        type: 'success',
        message: isEditing
          ? `Customer profile for ${savedCustomer.fullName} (${savedCustomer.customerCode}) updated in Firestore. Original registering officer (${savedCustomer.registeredByName || 'preserved'}) kept intact.`
          : `Customer successfully registered — ${savedCustomer.fullName} (Customer ID: ${savedCustomer.customerCode}) saved permanently in Firestore under ${savedCustomer.registeredByName || currentUser?.fullName || 'your account'}.`,
      });
      resetForm();
      await loadCustomers();
      setActiveTab('directory');
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || 'Unable to save customer registration due to a network or server error.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#07112B] text-white flex flex-col">
      {/* Header */}
      <header className="bg-[#0B1942] border-b border-white/10 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-teal-500/15 border border-teal-400/30 flex items-center justify-center">
            <UserPlus className="w-6 h-6 text-teal-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded bg-teal-500/20 text-teal-300 border border-teal-400/30">
                STAFF · CUSTOMER REGISTRATION OFFICER
              </span>
              <span className="text-xs font-mono text-slate-400">/staff/customer-registration</span>
            </div>
            <h1 className="text-lg font-bold text-white mt-0.5">
              Customer Onboarding, KYC Verification & Central Directory Workspace
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
            onClick={() => {
              resetForm();
              setActiveTab('register');
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs transition"
          >
            <UserPlus className="w-4 h-4" />
            Register New Customer
          </button>
          <button
            onClick={loadCustomers}
            className="p-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 transition"
            title="Sync with Firestore"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-teal-400' : ''}`} />
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

      {/* Tabs */}
      <div className="bg-[#091538] border-b border-white/10 px-6 flex items-center gap-2 overflow-x-auto">
        {[
          { id: 'directory', label: 'Central Customer Directory', icon: Users },
          { id: 'register', label: 'New / Update Customer Registration Form', icon: UserPlus },
          {
            id: 'incomplete',
            label: `Incomplete KYC / Guarantor (${incompleteCustomers.length})`,
            icon: AlertCircle,
          },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-3.5 text-xs font-semibold border-b-2 transition whitespace-nowrap ${
                active
                  ? 'border-teal-400 text-teal-300 bg-teal-500/10'
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
        {feedback && (
          <div
            className={`p-4 rounded-xl border flex items-center justify-between ${
              feedback.type === 'success'
                ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-200'
                : 'bg-rose-500/15 border-rose-400/40 text-rose-200'
            }`}
          >
            <span className="text-sm font-medium">{feedback.message}</span>
            <button onClick={() => setFeedback(null)} className="text-xs underline">
              Dismiss
            </button>
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-[#0D1E4C] border border-white/10 rounded-xl p-5">
            <div className="text-xs text-slate-300">TOTAL REGISTERED CUSTOMERS</div>
            <div className="text-2xl font-bold font-mono text-white mt-2">{customers.length}</div>
            <div className="text-xs text-teal-300 mt-1">Permanent Firestore directory records</div>
          </div>

          <div className="bg-[#0D1E4C] border border-white/10 rounded-xl p-5">
            <div className="text-xs text-slate-300">COMPLETE KYC & GUARANTOR PROFILES</div>
            <div className="text-2xl font-bold font-mono text-emerald-300 mt-2">
              {customers.length - incompleteCustomers.length}
            </div>
            <div className="text-xs text-slate-300 mt-1">NIN/BVN, Next of Kin & Guarantor on file</div>
          </div>

          <div className="bg-[#0D1E4C] border border-white/10 rounded-xl p-5">
            <div className="text-xs text-slate-300">INCOMPLETE REGISTRATIONS</div>
            <div className="text-2xl font-bold font-mono text-amber-300 mt-2">
              {incompleteCustomers.length}
            </div>
            <div className="text-xs text-amber-200 mt-1">Pending KYC, Next of Kin, or Guarantor update</div>
          </div>
        </div>

        {/* DIRECTORY & INCOMPLETE TABS */}
        {(activeTab === 'directory' || activeTab === 'incomplete') && (
          <div className="bg-[#0D1E4C] border border-white/10 rounded-xl p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              <div className="md:col-span-5 relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by customer name, ID, phone, or registering staff..."
                  className="w-full pl-10 pr-4 py-2 rounded-lg bg-[#07112B] border border-white/15 text-xs text-white placeholder-slate-400"
                />
              </div>
              <div className="md:col-span-3">
                <select
                  value={staffFilter}
                  onChange={(e) => setStaffFilter(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#07112B] border border-white/15 text-xs text-white"
                >
                  <option value="ALL">All Registering Staff</option>
                  {registeringStaffOptions.map(([key, label]) => (
                    <option key={key} value={key}>
                      Registered by: {label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <select
                  value={programmeFilter}
                  onChange={(e) => setProgrammeFilter(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#07112B] border border-white/15 text-xs text-white"
                >
                  <option value="ALL">All Programmes</option>
                  {ASSIGNABLE_PROGRAMMES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#07112B] border border-white/15 text-xs text-white"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                  <option value="SUSPENDED">SUSPENDED</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-[11px] uppercase text-slate-400">
                    <th className="py-2.5 px-3">Customer ID</th>
                    <th className="py-2.5 px-3">Customer Name (Click for Profile)</th>
                    <th className="py-2.5 px-3">Phone Number</th>
                    <th className="py-2.5 px-3">Registered By</th>
                    <th className="py-2.5 px-3">Registration Date</th>
                    <th className="py-2.5 px-3">Customer Status</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-xs">
                  {(activeTab === 'incomplete' ? incompleteCustomers : filteredCustomers).map(
                    (c) => (
                      <tr key={c.id} className="hover:bg-white/5">
                        <td className="py-3 px-3 font-mono text-teal-300 font-bold">
                          {c.customerCode || c.id}
                        </td>
                        <td className="py-3 px-3">
                          <button
                            type="button"
                            onClick={() => setSelectedCustomer(c)}
                            className="text-left font-bold text-teal-300 hover:text-white hover:underline flex items-center gap-1.5"
                          >
                            <span>{c.fullName}</span>
                            <ExternalLink className="w-3.5 h-3.5 opacity-70" />
                          </button>
                          <div className="text-[11px] text-slate-400 font-mono">
                            Acct: {formatFieldOrNotProvided(c.accountNumber)}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="text-white font-semibold">{formatFieldOrNotProvided(c.phone)}</div>
                          {c.altPhone && (
                            <div className="text-[11px] text-slate-400">Alt: {c.altPhone}</div>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-semibold text-white">
                            {formatFieldOrNotProvided(c.registeredByName || c.registeredByStaffId)}
                          </div>
                          <div className="text-[11px] text-teal-300/90 font-mono">
                            {c.registeredByStaffCode || ''}
                            {c.registeredByPosition ? ` • ${c.registeredByPosition}` : ''}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-slate-300">
                          {formatDateTimeDisplay(c.registeredAt || c.registrationDate)}
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              c.status === 'ACTIVE'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : c.status === 'INACTIVE'
                                ? 'bg-amber-500/20 text-amber-300'
                                : 'bg-rose-500/20 text-rose-300'
                            }`}
                          >
                            {c.status || 'ACTIVE'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setSelectedCustomer(c)}
                              className="px-2.5 py-1.5 rounded bg-white/10 hover:bg-white/20 text-white text-[11px] font-semibold flex items-center gap-1"
                              title="View Full Customer Profile"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              Profile
                            </button>
                            <button
                              onClick={() => handleEditCustomer(c)}
                              className="p-1.5 rounded bg-teal-500/20 hover:bg-teal-500/30 text-teal-300"
                              title="Update Customer Information"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* REGISTER / UPDATE FORM TAB */}
        {activeTab === 'register' && (
          <div className="bg-[#0D1E4C] border border-white/10 rounded-xl p-6 max-w-4xl mx-auto">
            <h2 className="text-base font-bold text-white mb-1">
              {form.id ? 'Update Customer Profile, Next of Kin & Guarantor' : 'New Customer Registration Form'}
            </h2>
            <p className="text-xs text-slate-300 mb-4">
              Complete personal details, NIN/BVN identification, separate Next of Kin & Guarantor sections, and savings programme enrollment.
            </p>

            {/* Automatic Registration Attribution Banner */}
            <div className="mb-5 p-3.5 rounded-xl bg-teal-500/10 border border-teal-400/30 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 text-teal-200">
                <ShieldCheck className="w-4 h-4 text-teal-400 shrink-0" />
                <span>
                  {form.id ? (
                    <>
                      <strong>Original Registration Protected:</strong> Updating this customer will preserve the original registering staff member and append your update to the customer&apos;s activity history.
                    </>
                  ) : (
                    <>
                      <strong>Registering Staff Attribution:</strong> {currentUser?.fullName || 'Authenticated Officer'} (
                      {currentUser?.position || 'Customer Registration Officer'}) —{' '}
                      <span className="font-mono">{currentUser?.staffCode || currentUser?.id}</span>
                    </>
                  )}
                </span>
              </div>
              <span className="font-mono text-[10px] uppercase px-2 py-0.5 rounded bg-teal-500/20 text-teal-300">
                Server Session Verified
              </span>
            </div>

            {feedback && feedback.type === 'error' && (
              <div className="mb-5 p-3.5 rounded-xl bg-rose-500/15 border border-rose-400/40 text-rose-200 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-rose-300 mb-0.5">Registration Cannot Proceed</div>
                  <div>{feedback.message}</div>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmitCustomer} className="space-y-6 text-xs">
              {/* Section 1: Customer Identification */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-teal-300 border-b border-white/10 pb-2">
                  1. Customer Identification & Contact Information
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-slate-300 mb-1">Customer Full Legal Name *</label>
                    <input
                      type="text"
                      required
                      value={form.fullName}
                      onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                      placeholder="e.g. Mrs. Folake Adeyemi"
                      className="w-full px-3 py-2.5 rounded-lg bg-[#07112B] border border-white/15 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1">Primary Phone Number *</label>
                    <input
                      type="tel"
                      required
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      placeholder="+234 803 000 0000"
                      className="w-full px-3 py-2.5 rounded-lg bg-[#07112B] border border-white/15 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1">Alternative Phone Number</label>
                    <input
                      type="tel"
                      value={form.altPhone}
                      onChange={(e) => setForm({ ...form, altPhone: e.target.value })}
                      placeholder="Optional"
                      className="w-full px-3 py-2.5 rounded-lg bg-[#07112B] border border-white/15 text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-slate-300 mb-1">Email Address</label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      placeholder="customer@example.com"
                      className="w-full px-3 py-2.5 rounded-lg bg-[#07112B] border border-white/15 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1">ID Type</label>
                    <select
                      value={form.idType}
                      onChange={(e) => setForm({ ...form, idType: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-lg bg-[#07112B] border border-white/15 text-white"
                    >
                      <option value="NIN">NIN</option>
                      <option value="BVN">BVN</option>
                      <option value="VOTERS_CARD">Voter&apos;s Card</option>
                      <option value="DRIVERS_LICENSE">Driver&apos;s License</option>
                      <option value="INTERNATIONAL_PASSPORT">International Passport</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1">NIN or BVN Number</label>
                    <input
                      type="text"
                      value={form.ninOrBvn}
                      onChange={(e) => setForm({ ...form, ninOrBvn: e.target.value })}
                      placeholder="11-digit NIN or BVN (if available)"
                      className="w-full px-3 py-2.5 rounded-lg bg-[#07112B] border border-white/15 text-white font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-300 mb-1">Residential / Business Address *</label>
                    <input
                      type="text"
                      required
                      value={form.address}
                      onChange={(e) => setForm({ ...form, address: e.target.value })}
                      placeholder="Street address, area, city"
                      className="w-full px-3 py-2.5 rounded-lg bg-[#07112B] border border-white/15 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1">Occupation / Trade</label>
                    <input
                      type="text"
                      value={form.occupation}
                      onChange={(e) => setForm({ ...form, occupation: e.target.value })}
                      placeholder="e.g. Merchant, Civil Servant, Artisan"
                      className="w-full px-3 py-2.5 rounded-lg bg-[#07112B] border border-white/15 text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: A. NEXT OF KIN DETAILS */}
              <div className="space-y-3 pt-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-300 border-b border-white/10 pb-2 flex items-center gap-2">
                  <Users className="w-4 h-4 text-indigo-400" />
                  2. Section A — Next of Kin Details
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-300 mb-1">Next of Kin Full Name *</label>
                    <input
                      type="text"
                      required
                      value={form.nextOfKinName}
                      onChange={(e) => setForm({ ...form, nextOfKinName: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-lg bg-[#07112B] border border-white/15 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1">Next of Kin Phone *</label>
                    <input
                      type="tel"
                      required
                      value={form.nextOfKinPhone}
                      onChange={(e) => setForm({ ...form, nextOfKinPhone: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-lg bg-[#07112B] border border-white/15 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1">Relationship with Customer *</label>
                    <input
                      type="text"
                      required
                      value={form.nextOfKinRelationship}
                      onChange={(e) => setForm({ ...form, nextOfKinRelationship: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-lg bg-[#07112B] border border-white/15 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1">Next of Kin Residential Address</label>
                    <input
                      type="text"
                      value={form.nextOfKinAddress}
                      onChange={(e) => setForm({ ...form, nextOfKinAddress: e.target.value })}
                      placeholder="Address of Next of Kin"
                      className="w-full px-3 py-2.5 rounded-lg bg-[#07112B] border border-white/15 text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Section 3: B. GUARANTOR DETAILS */}
              <div className="space-y-3 pt-2">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-300 flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-emerald-400" />
                    3. Section B — Guarantor Details (Separate Section)
                  </h3>
                  <label className="inline-flex items-center gap-2 text-xs text-teal-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={sameAsNextOfKin}
                      onChange={(e) => setSameAsNextOfKin(e.target.checked)}
                    />
                    <span>Same person serves as Next of Kin & Guarantor</span>
                  </label>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-slate-300 mb-1">Guarantor Full Name</label>
                    <input
                      type="text"
                      value={form.guarantorName}
                      onChange={(e) => setForm({ ...form, guarantorName: e.target.value })}
                      placeholder="Full name of Guarantor"
                      className="w-full px-3 py-2.5 rounded-lg bg-[#07112B] border border-white/15 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1">Guarantor Phone Number</label>
                    <input
                      type="tel"
                      value={form.guarantorPhone}
                      onChange={(e) => setForm({ ...form, guarantorPhone: e.target.value })}
                      placeholder="Phone number"
                      className="w-full px-3 py-2.5 rounded-lg bg-[#07112B] border border-white/15 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1">Relationship with Customer</label>
                    <input
                      type="text"
                      value={form.guarantorRelationship}
                      onChange={(e) => setForm({ ...form, guarantorRelationship: e.target.value })}
                      placeholder="e.g. Employer, Partner, Relative"
                      className="w-full px-3 py-2.5 rounded-lg bg-[#07112B] border border-white/15 text-white"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-slate-300 mb-1">Guarantor Residential / Business Address</label>
                    <input
                      type="text"
                      value={form.guarantorAddress}
                      onChange={(e) => setForm({ ...form, guarantorAddress: e.target.value })}
                      placeholder="Address of Guarantor"
                      className="w-full px-3 py-2.5 rounded-lg bg-[#07112B] border border-white/15 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1">Guarantor Verification Status</label>
                    <select
                      value={form.guarantorVerificationStatus}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          guarantorVerificationStatus: e.target.value as NonNullable<
                            CustomerRecord['guarantorVerificationStatus']
                          >,
                        })
                      }
                      className="w-full px-3 py-2.5 rounded-lg bg-[#07112B] border border-white/15 text-white"
                    >
                      <option value="PENDING">Pending Verification</option>
                      <option value="VERIFIED">Verified</option>
                      <option value="UNVERIFIED">Unverified</option>
                      <option value="NOT_PROVIDED">Not provided</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Section 4: Savings Programmes */}
              <div>
                <label className="block text-slate-300 mb-1.5 font-bold uppercase tracking-wider">
                  4. Savings Programme Enrollment *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 rounded-xl bg-[#07112B] border border-white/10">
                  {ASSIGNABLE_PROGRAMMES.map((prog) => (
                    <label
                      key={prog}
                      className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={form.enrolledProgrammes.includes(prog)}
                        onChange={() => handleToggleProgramme(prog)}
                      />
                      <span>{prog}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('directory')}
                  className="px-4 py-2.5 rounded-lg bg-white/10 text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold"
                >
                  {isSubmitting
                    ? 'Saving Customer...'
                    : form.id
                    ? 'Save Profile Updates'
                    : 'Complete Customer Registration'}
                </button>
              </div>
            </form>
          </div>
        )}
      </main>

      {/* Authoritative Customer Profile Modal */}
      {selectedCustomer && (
        <CustomerProfileModal
          customer={selectedCustomer}
          onClose={() => setSelectedCustomer(null)}
          canEdit={true}
          canRecordActivity={true}
          onCustomerUpdated={(updated) => {
            setSelectedCustomer(updated);
            setCustomers((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
          }}
        />
      )}
    </div>
  );
};
