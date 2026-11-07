import React, { useState, useEffect, useMemo } from 'react';
import {
  UserPlus,
  Users,
  Search,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  LogOut,
  Eye,
  Edit3,
  X,
  ShieldCheck,
} from 'lucide-react';
import { User } from '../../../types/banking';
import { safeApiFetch } from '../../../utils/apiClient';
import { ASSIGNABLE_PROGRAMMES } from '../../../utils/roleRouting';

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
  const [activeTab, setActiveTab] = useState<'register' | 'directory' | 'incomplete'>('directory');
  const [customers, setCustomers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [programmeFilter, setProgrammeFilter] = useState('ALL');
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const [form, setForm] = useState({
    id: '',
    fullName: '',
    phone: '',
    email: '',
    address: '',
    state: 'Lagos',
    lga: 'Ikeja',
    ninOrBvn: '',
    occupation: '',
    nextOfKinName: '',
    nextOfKinPhone: '',
    nextOfKinRelationship: 'Spouse',
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

  const incompleteCustomers = useMemo(
    () => customers.filter((c) => !c.ninOrBvn || !c.nextOfKinName),
    [customers]
  );

  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      const matchesSearch =
        !searchQuery.trim() ||
        String(c.fullName || '')
          .toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        String(c.phone || '')
          .toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        String(c.customerCode || '')
          .toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        String(c.accountNumber || '')
          .toLowerCase()
          .includes(searchQuery.toLowerCase());
      const matchesProg =
        programmeFilter === 'ALL' ||
        (Array.isArray(c.enrolledProgrammes) &&
          c.enrolledProgrammes.some(
            (p: string) => p.toLowerCase() === programmeFilter.toLowerCase()
          ));
      return matchesSearch && matchesProg;
    });
  }, [customers, searchQuery, programmeFilter]);

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

  const handleEditCustomer = (cust: any) => {
    setForm({
      id: cust.id || '',
      fullName: cust.fullName || '',
      phone: cust.phone || '',
      email: cust.email || '',
      address: cust.address || '',
      state: cust.state || 'Lagos',
      lga: cust.lga || 'Ikeja',
      ninOrBvn: cust.ninOrBvn || '',
      occupation: cust.occupation || '',
      nextOfKinName: cust.nextOfKinName || '',
      nextOfKinPhone: cust.nextOfKinPhone || '',
      nextOfKinRelationship: cust.nextOfKinRelationship || 'Relative',
      enrolledProgrammes:
        Array.isArray(cust.enrolledProgrammes) && cust.enrolledProgrammes.length > 0
          ? cust.enrolledProgrammes
          : [ASSIGNABLE_PROGRAMMES[0]],
    });
    setActiveTab('register');
  };

  const handleSubmitCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFeedback(null);
    try {
      const res = await safeApiFetch('/api/customers', {
        method: 'POST',
        body: JSON.stringify({
          customer: {
            ...form,
            registeredByStaffId: currentUser?.id || 'STAFF_REG',
          },
        }),
      });
      if (!res.success) {
        setFeedback({
          type: 'error',
          message: res.message || res.error || 'Failed to save customer registration.',
        });
      } else {
        setFeedback({
          type: 'success',
          message: `Customer profile for ${form.fullName} saved and enrolled in selected savings programmes.`,
        });
        setForm({
          id: '',
          fullName: '',
          phone: '',
          email: '',
          address: '',
          state: 'Lagos',
          lga: 'Ikeja',
          ninOrBvn: '',
          occupation: '',
          nextOfKinName: '',
          nextOfKinPhone: '',
          nextOfKinRelationship: 'Spouse',
          enrolledProgrammes: [ASSIGNABLE_PROGRAMMES[0]],
        });
        await loadCustomers();
        setActiveTab('directory');
      }
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
              Customer Onboarding, KYC Verification & Programme Enrollment Workspace
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
              setForm({
                id: '',
                fullName: '',
                phone: '',
                email: '',
                address: '',
                state: 'Lagos',
                lga: 'Ikeja',
                ninOrBvn: '',
                occupation: '',
                nextOfKinName: '',
                nextOfKinPhone: '',
                nextOfKinRelationship: 'Spouse',
                enrolledProgrammes: [ASSIGNABLE_PROGRAMMES[0]],
              });
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
          { id: 'directory', label: 'Registered Customer Directory', icon: Users },
          { id: 'register', label: 'New / Update Customer Registration Form', icon: UserPlus },
          {
            id: 'incomplete',
            label: `Incomplete Registrations (${incompleteCustomers.length})`,
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
            <div className="text-xs text-teal-300 mt-1">Verified savings & thrift members</div>
          </div>

          <div className="bg-[#0D1E4C] border border-white/10 rounded-xl p-5">
            <div className="text-xs text-slate-300">COMPLETE KYC PROFILES</div>
            <div className="text-2xl font-bold font-mono text-emerald-300 mt-2">
              {customers.length - incompleteCustomers.length}
            </div>
            <div className="text-xs text-slate-300 mt-1">NIN/BVN and Next of Kin verified</div>
          </div>

          <div className="bg-[#0D1E4C] border border-white/10 rounded-xl p-5">
            <div className="text-xs text-slate-300">INCOMPLETE REGISTRATIONS</div>
            <div className="text-2xl font-bold font-mono text-amber-300 mt-2">
              {incompleteCustomers.length}
            </div>
            <div className="text-xs text-amber-200 mt-1">Pending KYC or Next-of-Kin update</div>
          </div>
        </div>

        {/* DIRECTORY & INCOMPLETE TABS */}
        {(activeTab === 'directory' || activeTab === 'incomplete') && (
          <div className="bg-[#0D1E4C] border border-white/10 rounded-xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="relative flex-1 min-w-[240px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search customer by name, phone number, customer code, or account number..."
                  className="w-full pl-10 pr-4 py-2 rounded-lg bg-[#07112B] border border-white/15 text-sm text-white placeholder-slate-400"
                />
              </div>
              <select
                value={programmeFilter}
                onChange={(e) => setProgrammeFilter(e.target.value)}
                className="px-3 py-2 rounded-lg bg-[#07112B] border border-white/15 text-xs text-white"
              >
                <option value="ALL">All Savings Programmes</option>
                {ASSIGNABLE_PROGRAMMES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-[11px] uppercase text-slate-400">
                    <th className="py-2.5 px-3">Customer Code</th>
                    <th className="py-2.5 px-3">Full Name & Occupation</th>
                    <th className="py-2.5 px-3">Phone & Email</th>
                    <th className="py-2.5 px-3">Account Number</th>
                    <th className="py-2.5 px-3">Enrolled Programmes</th>
                    <th className="py-2.5 px-3">KYC Status</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-xs">
                  {(activeTab === 'incomplete' ? incompleteCustomers : filteredCustomers).map(
                    (c) => {
                      const isComplete = Boolean(c.ninOrBvn && c.nextOfKinName);
                      return (
                        <tr key={c.id} className="hover:bg-white/5">
                          <td className="py-3 px-3 font-mono text-teal-300">{c.customerCode}</td>
                          <td className="py-3 px-3">
                            <div className="font-semibold text-white">{c.fullName}</div>
                            <div className="text-[11px] text-slate-400">
                              {c.occupation || 'Member'}
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <div className="text-white">{c.phone}</div>
                            <div className="text-[11px] text-slate-400">{c.email}</div>
                          </td>
                          <td className="py-3 px-3 font-mono text-white">{c.accountNumber}</td>
                          <td className="py-3 px-3 text-slate-300">
                            {Array.isArray(c.enrolledProgrammes) && c.enrolledProgrammes.length > 0
                              ? c.enrolledProgrammes.join(', ')
                              : 'Daily Contribution (Ajo)'}
                          </td>
                          <td className="py-3 px-3">
                            {isComplete ? (
                              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                                VERIFIED
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold">
                                INCOMPLETE
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => setSelectedCustomer(c)}
                                className="p-1.5 rounded bg-white/5 hover:bg-white/10 text-slate-200"
                                title="View Customer Profile"
                              >
                                <Eye className="w-3.5 h-3.5" />
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
                      );
                    }
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* REGISTER / UPDATE FORM TAB */}
        {activeTab === 'register' && (
          <div className="bg-[#0D1E4C] border border-white/10 rounded-xl p-6 max-w-3xl mx-auto">
            <h2 className="text-base font-bold text-white mb-1">
              {form.id ? 'Update Customer Profile & KYC' : 'New Customer Registration Form'}
            </h2>
            <p className="text-xs text-slate-300 mb-5">
              Complete personal details, NIN/BVN identification, Next of Kin, and savings programme enrollment.
            </p>

            <form onSubmit={handleSubmitCustomer} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                  <label className="block text-slate-300 mb-1">Phone Number *</label>
                  <input
                    type="tel"
                    required
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="+234 803 000 0000"
                    className="w-full px-3 py-2.5 rounded-lg bg-[#07112B] border border-white/15 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                  <label className="block text-slate-300 mb-1">NIN or BVN Number *</label>
                  <input
                    type="text"
                    required
                    value={form.ninOrBvn}
                    onChange={(e) => setForm({ ...form, ninOrBvn: e.target.value })}
                    placeholder="11-digit NIN or BVN"
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
                  <label className="block text-slate-300 mb-1">Occupation / Trade *</label>
                  <input
                    type="text"
                    required
                    value={form.occupation}
                    onChange={(e) => setForm({ ...form, occupation: e.target.value })}
                    placeholder="e.g. Merchant, Civil Servant, Artisan"
                    className="w-full px-3 py-2.5 rounded-lg bg-[#07112B] border border-white/15 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                  <label className="block text-slate-300 mb-1">Relationship *</label>
                  <input
                    type="text"
                    required
                    value={form.nextOfKinRelationship}
                    onChange={(e) => setForm({ ...form, nextOfKinRelationship: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg bg-[#07112B] border border-white/15 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1.5">
                  Savings Programme Enrollment *
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

      {/* Customer Profile Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-[#0D1E4C] border border-white/15 rounded-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">Customer Profile Dossier</h3>
              <button
                onClick={() => setSelectedCustomer(null)}
                className="p-1 rounded-lg hover:bg-white/10"
              >
                <X className="w-4 h-4 text-slate-300" />
              </button>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1.5 border-b border-white/10">
                <span className="text-slate-400">Customer Code</span>
                <span className="font-mono text-teal-300">{selectedCustomer.customerCode}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-white/10">
                <span className="text-slate-400">Full Name</span>
                <span className="font-semibold text-white">{selectedCustomer.fullName}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-white/10">
                <span className="text-slate-400">Account Number</span>
                <span className="font-mono text-white">{selectedCustomer.accountNumber}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-white/10">
                <span className="text-slate-400">Phone</span>
                <span className="text-white">{selectedCustomer.phone}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-white/10">
                <span className="text-slate-400">Address</span>
                <span className="text-white">{selectedCustomer.address}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-white/10">
                <span className="text-slate-400">Next of Kin</span>
                <span className="text-white">
                  {selectedCustomer.nextOfKinName} ({selectedCustomer.nextOfKinRelationship})
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-400">Registration Date</span>
                <span className="text-white">{selectedCustomer.registrationDate}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
