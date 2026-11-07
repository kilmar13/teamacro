import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  Phone,
  Mail,
  MapPin,
  Calendar,
  ShieldCheck,
  Briefcase,
  FileText,
  Clock,
  Edit3,
  CheckCircle2,
  AlertCircle,
  Users,
  UserCheck,
  History,
  Lock,
  PlusCircle,
  RefreshCw,
} from 'lucide-react';
import { CustomerRecord, CustomerActivityEntry } from '../../types/banking';
import { LedgerEngine } from '../../services/ledgerEngine';
import { safeApiFetch } from '../../utils/apiClient';
import { ASSIGNABLE_PROGRAMMES } from '../../utils/roleRouting';

interface CustomerProfileModalProps {
  customer: CustomerRecord | null;
  onClose: () => void;
  onCustomerUpdated?: (updated: CustomerRecord) => void;
  canEdit?: boolean;
  canRecordActivity?: boolean;
}

export const formatFieldOrNotProvided = (value?: string | number | null): string => {
  if (value === undefined || value === null) return 'Not provided';
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : 'Not provided';
};

export const formatDateTimeDisplay = (value?: string | null): string => {
  if (!value) return 'Not provided';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString('en-NG', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const CustomerProfileModal: React.FC<CustomerProfileModalProps> = ({
  customer: initialCustomer,
  onClose,
  onCustomerUpdated,
  canEdit = true,
  canRecordActivity = true,
}) => {
  const [customer, setCustomer] = useState<CustomerRecord | null>(initialCustomer);
  const [loadingFresh, setLoadingFresh] = useState(false);
  const [activeSectionTab, setActiveSectionTab] = useState<'OVERVIEW' | 'EDIT' | 'RECORD_ACTIVITY'>('OVERVIEW');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Edit form state
  const [editForm, setEditForm] = useState({
    fullName: '',
    phone: '',
    altPhone: '',
    email: '',
    address: '',
    state: '',
    lga: '',
    occupation: '',
    idType: '',
    ninOrBvn: '',
    dateOfBirth: '',
    gender: '',
    status: 'active',
    enrolledProgrammes: [] as string[],
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

  // Activity form state
  const [activityForm, setActivityForm] = useState({
    category: 'SAVINGS_CONTRIBUTION' as CustomerActivityEntry['category'],
    action: '',
    description: '',
    amount: '',
    reference: '',
  });

  useEffect(() => {
    setCustomer(initialCustomer);
    if (initialCustomer) {
      populateEditForm(initialCustomer);
      fetchAuthoritativeProfile(initialCustomer.id);
    }
  }, [initialCustomer?.id]);

  const populateEditForm = (rec: CustomerRecord) => {
    const progs =
      Array.isArray(rec.enrolledProgrammes) && rec.enrolledProgrammes.length > 0
        ? rec.enrolledProgrammes
        : Array.isArray(rec.enrolledSchemes)
        ? rec.enrolledSchemes
        : [];
    setEditForm({
      fullName: rec.fullName || '',
      phone: rec.phone || '',
      altPhone: rec.altPhone || '',
      email: rec.email || '',
      address: rec.address || '',
      state: rec.state || '',
      lga: rec.lga || '',
      occupation: rec.occupation || '',
      idType: rec.idType || '',
      ninOrBvn: rec.ninOrBvn || '',
      dateOfBirth: rec.dateOfBirth || '',
      gender: rec.gender || '',
      status: rec.status || 'active',
      enrolledProgrammes: progs,
      nextOfKinName: rec.nextOfKinName || '',
      nextOfKinPhone: rec.nextOfKinPhone || '',
      nextOfKinRelationship: rec.nextOfKinRelationship || rec.nextOfKinRelation || '',
      nextOfKinAddress: rec.nextOfKinAddress || '',
      guarantorName: rec.guarantorName || '',
      guarantorPhone: rec.guarantorPhone || '',
      guarantorRelationship: rec.guarantorRelationship || '',
      guarantorAddress: rec.guarantorAddress || '',
      guarantorOccupation: rec.guarantorOccupation || '',
      guarantorVerificationStatus: rec.guarantorVerificationStatus || 'Not Provided',
    });
  };

  const fetchAuthoritativeProfile = async (customerId: string) => {
    setLoadingFresh(true);
    try {
      const res = await safeApiFetch(`/api/customers/${encodeURIComponent(customerId)}`);
      if (res.success && (res.customer || res.data?.customer)) {
        const fresh = res.customer || res.data?.customer;
        setCustomer(fresh);
        populateEditForm(fresh);
      }
    } catch {
      // Keep local customer record if offline
    } finally {
      setLoadingFresh(false);
    }
  };

  if (!customer) return null;

  const handleSaveCustomerChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm.fullName.trim() || !editForm.phone.trim()) {
      setFeedback({ type: 'error', message: 'Customer full name and primary phone number are required.' });
      return;
    }

    setSaving(true);
    setFeedback(null);
    try {
      const res = await safeApiFetch(`/api/customers/${encodeURIComponent(customer.id)}`, {
        method: 'PUT',
        body: JSON.stringify({
          customer: {
            ...customer,
            ...editForm,
            id: customer.id,
            customerCode: customer.customerCode,
          },
        }),
      });
      if (!res.success) {
        throw new Error(res.message || res.error || 'Failed to save customer updates.');
      }
      const updated: CustomerRecord =
        res.customer ||
        res.data?.customer ||
        LedgerEngine.updateCustomer(customer.id, editForm) || {
          ...customer,
          ...editForm,
        };
      LedgerEngine.updateCustomer(customer.id, updated);
      setCustomer(updated);
      populateEditForm(updated);
      onCustomerUpdated?.(updated);
      setFeedback({
        type: 'success',
        message: `Customer profile updated in Firestore. Original registering officer (${formatFieldOrNotProvided(updated.registeredByName)}) preserved and update logged in activity history.`,
      });
      setActiveSectionTab('OVERVIEW');
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || 'Failed to save customer updates.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRecordCustomerActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activityForm.description.trim()) {
      setFeedback({ type: 'error', message: 'Please enter a clear activity description.' });
      return;
    }

    setSaving(true);
    setFeedback(null);
    try {
      const res = await safeApiFetch(`/api/customers/${encodeURIComponent(customer.id)}/activity`, {
        method: 'POST',
        body: JSON.stringify({
          category: activityForm.category,
          action: activityForm.action.trim() || activityForm.category.replace(/_/g, ' '),
          description: activityForm.description.trim(),
          amount: activityForm.amount ? Number(activityForm.amount) : undefined,
          reference: activityForm.reference.trim() || undefined,
        }),
      });
      if (!res.success) {
        throw new Error(res.message || res.error || 'Failed to record customer activity.');
      }
      const updated = res.customer || res.data?.customer;
      if (updated) {
        LedgerEngine.updateCustomer(customer.id, updated);
        setCustomer(updated);
        onCustomerUpdated?.(updated);
      }
      setActivityForm({
        category: 'SAVINGS_CONTRIBUTION',
        action: '',
        description: '',
        amount: '',
        reference: '',
      });
      setFeedback({
        type: 'success',
        message: 'Activity recorded permanently in customer timeline. Original registration owner remains unchanged.',
      });
      setActiveSectionTab('OVERVIEW');
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || 'Failed to record activity.',
      });
    } finally {
      setSaving(false);
    }
  };

  const copyNextOfKinToGuarantor = () => {
    setEditForm((prev) => ({
      ...prev,
      guarantorName: prev.nextOfKinName,
      guarantorPhone: prev.nextOfKinPhone,
      guarantorRelationship: prev.nextOfKinRelationship,
      guarantorAddress: prev.nextOfKinAddress,
      guarantorVerificationStatus:
        prev.guarantorVerificationStatus === 'Not Provided'
          ? 'Pending Verification'
          : prev.guarantorVerificationStatus,
    }));
  };

  const toggleProgrammeInEdit = (prog: string) => {
    setEditForm((prev) => ({
      ...prev,
      enrolledProgrammes: prev.enrolledProgrammes.includes(prog)
        ? prev.enrolledProgrammes.filter((s) => s !== prog)
        : [...prev.enrolledProgrammes, prog],
    }));
  };

  // Build activity timeline (ensure initial registration entry is always shown even on legacy records)
  const activityTimeline: CustomerActivityEntry[] =
    Array.isArray(customer.activityHistory) && customer.activityHistory.length > 0
      ? customer.activityHistory
      : [
          {
            id: `ACT_INIT_${customer.id}`,
            customerId: customer.id,
            category: 'REGISTRATION',
            action: 'Customer Registered',
            description: `Customer profile created and registered in the central directory.`,
            actorId: customer.registeredByStaffId || 'SYSTEM',
            actorStaffCode: customer.registeredByStaffCode || customer.registeredByStaffId || 'Not provided',
            actorName: customer.registeredByName || 'Authorised Officer',
            actorRole: customer.registeredByRole || 'STAFF',
            actorPosition: customer.registeredByPosition || 'Customer Registration Officer',
            actorDepartment: customer.registeredByDepartment || 'Customer Onboarding & KYC Department',
            timestamp: customer.registeredAt || customer.registrationDate || new Date().toISOString(),
          },
        ];

  const getCategoryBadgeStyle = (category: CustomerActivityEntry['category']) => {
    switch (category) {
      case 'REGISTRATION':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'PROFILE_UPDATE':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'SAVINGS_CONTRIBUTION':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'PAYMENT_COLLECTION':
        return 'bg-teal-50 text-teal-700 border-teal-200';
      case 'LOAN_ACTIVITY':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'ACCOUNT_ADJUSTMENT':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'CORRECTION_REVERSAL':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getGuarantorBadge = (status?: CustomerRecord['guarantorVerificationStatus']) => {
    const upper = String(status || '').toUpperCase();
    if (upper === 'VERIFIED') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="w-3.5 h-3.5" /> Verified
        </span>
      );
    }
    if (upper === 'PENDING' || upper === 'PENDING VERIFICATION') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
          <Clock className="w-3.5 h-3.5" /> Pending Verification
        </span>
      );
    }
    if (upper === 'UNVERIFIED') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
          <AlertCircle className="w-3.5 h-3.5" /> Unverified
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
        Not provided
      </span>
    );
  };

  const enrolledList =
    Array.isArray(customer.enrolledProgrammes) && customer.enrolledProgrammes.length > 0
      ? customer.enrolledProgrammes
      : Array.isArray(customer.enrolledSchemes)
      ? customer.enrolledSchemes
      : [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-4 overflow-y-auto text-slate-900"
      role="dialog"
      aria-modal="true"
      aria-labelledby="customer-profile-modal-title"
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden my-auto">
        {/* Top Header */}
        <div className="bg-slate-900 text-white px-6 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 shrink-0">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300 font-bold text-lg shrink-0">
              {customer.fullName
                ? customer.fullName
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase()
                : 'CU'}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 id="customer-profile-modal-title" className="text-xl font-bold tracking-tight text-white">
                  {customer.fullName}
                </h2>
                <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded bg-slate-800 text-emerald-300 border border-slate-700">
                  {customer.customerCode || customer.id}
                </span>
                <span
                  className={`text-xs font-bold px-2.5 py-0.5 rounded uppercase ${
                    String(customer.status).toUpperCase() === 'ACTIVE'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                      : String(customer.status).toUpperCase() === 'INACTIVE' ||
                        String(customer.status).toUpperCase() === 'DORMANT'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-400/30'
                      : 'bg-rose-500/20 text-rose-300 border border-rose-400/30'
                  }`}
                >
                  {customer.status || 'ACTIVE'}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
                <span>
                  Account No: <strong className="font-mono text-white">{formatFieldOrNotProvided(customer.accountNumber)}</strong>
                </span>
                <span>•</span>
                <span>
                  Registered: <strong className="text-white">{formatDateTimeDisplay(customer.registeredAt || customer.registrationDate)}</strong>
                </span>
                <span>•</span>
                <span>
                  Registered By: <strong className="text-emerald-300">{formatFieldOrNotProvided(customer.registeredByName)}</strong>
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            <button
              type="button"
              onClick={() => fetchAuthoritativeProfile(customer.id)}
              disabled={loadingFresh}
              title="Refresh from Firestore"
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loadingFresh ? 'animate-spin text-emerald-400' : ''}`} />
            </button>
            {canEdit && (
              <button
                type="button"
                onClick={() => {
                  setFeedback(null);
                  setActiveSectionTab(activeSectionTab === 'EDIT' ? 'OVERVIEW' : 'EDIT');
                }}
                className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors ${
                  activeSectionTab === 'EDIT'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                }`}
              >
                <Edit3 className="w-3.5 h-3.5" />
                {activeSectionTab === 'EDIT' ? 'Viewing Edit Form' : 'Update Customer'}
              </button>
            )}
            {canRecordActivity && (
              <button
                type="button"
                onClick={() => {
                  setFeedback(null);
                  setActiveSectionTab(activeSectionTab === 'RECORD_ACTIVITY' ? 'OVERVIEW' : 'RECORD_ACTIVITY');
                }}
                className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors ${
                  activeSectionTab === 'RECORD_ACTIVITY'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                }`}
              >
                <PlusCircle className="w-3.5 h-3.5" />
                Log Activity
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white transition-colors"
              aria-label="Close customer profile"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Feedback Banner */}
        {feedback && (
          <div
            className={`px-6 py-3 text-xs font-semibold flex items-center justify-between border-b shrink-0 ${
              feedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{feedback.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="text-slate-500 hover:text-slate-800 font-bold ml-4"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50/60">
          {activeSectionTab === 'EDIT' && canEdit ? (
            <form onSubmit={handleSaveCustomerChanges} className="space-y-6 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Update Customer Record</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Updating customer details preserves the original registering staff member ({formatFieldOrNotProvided(customer.registeredByName)}) and records your update in the activity timeline.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveSectionTab('OVERVIEW')}
                  className="text-xs font-semibold text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
              </div>

              {/* Personal & Contact Details */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                  1. Customer Identification & Contact Information
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name *</label>
                    <input
                      type="text"
                      required
                      value={editForm.fullName}
                      onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Primary Phone Number *</label>
                    <input
                      type="text"
                      required
                      value={editForm.phone}
                      onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Alternative Phone Number</label>
                    <input
                      type="text"
                      value={editForm.altPhone}
                      onChange={(e) => setEditForm({ ...editForm, altPhone: e.target.value })}
                      placeholder="Optional"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
                    <input
                      type="email"
                      value={editForm.email}
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                      placeholder="Optional"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Residential Address</label>
                    <input
                      type="text"
                      value={editForm.address}
                      onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">State</label>
                    <input
                      type="text"
                      value={editForm.state}
                      onChange={(e) => setEditForm({ ...editForm, state: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">LGA</label>
                    <input
                      type="text"
                      value={editForm.lga}
                      onChange={(e) => setEditForm({ ...editForm, lga: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Occupation / Business</label>
                    <input
                      type="text"
                      value={editForm.occupation}
                      onChange={(e) => setEditForm({ ...editForm, occupation: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Identification Type</label>
                    <select
                      value={editForm.idType}
                      onChange={(e) => setEditForm({ ...editForm, idType: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-900"
                    >
                      <option value="">Not provided</option>
                      <option value="NIN">National Identification Number (NIN)</option>
                      <option value="BVN">Bank Verification Number (BVN)</option>
                      <option value="VOTERS_CARD">Voter&apos;s Card</option>
                      <option value="DRIVERS_LICENSE">Driver&apos;s License</option>
                      <option value="INTERNATIONAL_PASSPORT">International Passport</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">ID / NIN / BVN Number</label>
                    <input
                      type="text"
                      value={editForm.ninOrBvn}
                      onChange={(e) => setEditForm({ ...editForm, ninOrBvn: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Customer Status</label>
                    <select
                      value={editForm.status}
                      onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-900"
                    >
                      <option value="active">ACTIVE</option>
                      <option value="dormant">INACTIVE / DORMANT</option>
                      <option value="suspended">SUSPENDED</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Next of Kin Section */}
              <div className="pt-4 border-t border-slate-200">
                <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-700 mb-3">
                  2. Separate Section A — Next of Kin Details
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Next of Kin Full Name</label>
                    <input
                      type="text"
                      value={editForm.nextOfKinName}
                      onChange={(e) => setEditForm({ ...editForm, nextOfKinName: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Next of Kin Phone Number</label>
                    <input
                      type="text"
                      value={editForm.nextOfKinPhone}
                      onChange={(e) => setEditForm({ ...editForm, nextOfKinPhone: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Relationship with Customer</label>
                    <input
                      type="text"
                      value={editForm.nextOfKinRelationship}
                      onChange={(e) => setEditForm({ ...editForm, nextOfKinRelationship: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Next of Kin Residential Address</label>
                    <input
                      type="text"
                      value={editForm.nextOfKinAddress}
                      onChange={(e) => setEditForm({ ...editForm, nextOfKinAddress: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900"
                    />
                  </div>
                </div>
              </div>

              {/* Guarantor Section */}
              <div className="pt-4 border-t border-slate-200">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                    3. Separate Section B — Guarantor Details
                  </h4>
                  <button
                    type="button"
                    onClick={copyNextOfKinToGuarantor}
                    className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-3 py-1 rounded border border-emerald-200"
                  >
                    Use Same Person as Next of Kin
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Guarantor Full Name</label>
                    <input
                      type="text"
                      value={editForm.guarantorName}
                      onChange={(e) => setEditForm({ ...editForm, guarantorName: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Guarantor Phone Number</label>
                    <input
                      type="text"
                      value={editForm.guarantorPhone}
                      onChange={(e) => setEditForm({ ...editForm, guarantorPhone: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Relationship with Customer</label>
                    <input
                      type="text"
                      value={editForm.guarantorRelationship}
                      onChange={(e) => setEditForm({ ...editForm, guarantorRelationship: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Guarantor Residential Address</label>
                    <input
                      type="text"
                      value={editForm.guarantorAddress}
                      onChange={(e) => setEditForm({ ...editForm, guarantorAddress: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Guarantor Verification Status</label>
                    <select
                      value={editForm.guarantorVerificationStatus}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          guarantorVerificationStatus: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-900"
                    >
                      <option value="Verified">Verified</option>
                      <option value="Pending Verification">Pending Verification</option>
                      <option value="Unverified">Unverified</option>
                      <option value="Not Provided">Not provided</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Savings & Programme Associations */}
              <div className="pt-4 border-t border-slate-200">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                  4. Enrolled Savings & Contribution Programmes
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                  {ASSIGNABLE_PROGRAMMES.filter((p) => p !== 'All Programmes').map((prog) => {
                    const checked = editForm.enrolledProgrammes.includes(prog);
                    return (
                      <label
                        key={prog}
                        className={`flex items-center gap-2.5 p-2.5 rounded-lg border text-xs font-semibold cursor-pointer transition-colors ${
                          checked
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                            : 'bg-slate-50 border-slate-200 text-slate-700'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleProgrammeInEdit(prog)}
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
                  onClick={() => setActiveSectionTab('OVERVIEW')}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold disabled:opacity-50"
                >
                  {saving ? 'Saving to Firestore...' : 'Save Customer Profile Updates'}
                </button>
              </div>
            </form>
          ) : activeSectionTab === 'RECORD_ACTIVITY' && canRecordActivity ? (
            <form onSubmit={handleRecordCustomerActivity} className="space-y-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Record Customer Activity</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    This action will be logged under your authenticated employee identity while keeping{' '}
                    <strong>{formatFieldOrNotProvided(customer.registeredByName)}</strong> as the original registering officer.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveSectionTab('OVERVIEW')}
                  className="text-xs font-semibold text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Activity Category *</label>
                  <select
                    value={activityForm.category}
                    onChange={(e) =>
                      setActivityForm({
                        ...activityForm,
                        category: e.target.value as CustomerActivityEntry['category'],
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-900"
                  >
                    <option value="SAVINGS_CONTRIBUTION">Savings & Contribution Activity</option>
                    <option value="PAYMENT_COLLECTION">Payment Collection Activity</option>
                    <option value="LOAN_ACTIVITY">Loan Activity</option>
                    <option value="ACCOUNT_ADJUSTMENT">Account Adjustment</option>
                    <option value="CORRECTION_REVERSAL">Authorised Correction / Reversal</option>
                    <option value="PROFILE_UPDATE">Customer Information Update</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Activity Title / Action</label>
                  <input
                    type="text"
                    value={activityForm.action}
                    onChange={(e) => setActivityForm({ ...activityForm, action: e.target.value })}
                    placeholder="e.g. Weekly Contribution Recorded"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Amount (₦ Optional)</label>
                  <input
                    type="number"
                    value={activityForm.amount}
                    onChange={(e) => setActivityForm({ ...activityForm, amount: e.target.value })}
                    placeholder="Optional amount"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Detailed Activity Description *</label>
                <textarea
                  rows={3}
                  required
                  value={activityForm.description}
                  onChange={(e) => setActivityForm({ ...activityForm, description: e.target.value })}
                  placeholder="Describe the transaction, savings contribution, loan review, or adjustment performed..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveSectionTab('OVERVIEW')}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold disabled:opacity-50"
                >
                  {saving ? 'Recording Activity...' : 'Append to Customer Activity History'}
                </button>
              </div>
            </form>
          ) : (
            <>
              {/* SECTION 1: CUSTOMER IDENTIFICATION, CONTACT & PROGRAMME DETAILS */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="bg-slate-900/5 px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-slate-700" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                      Customer Identification & Registration Details
                    </h3>
                  </div>
                  <span className="text-xs font-mono text-slate-500">Record ID: {customer.id}</span>
                </div>

                <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Customer ID</p>
                    <p className="text-sm font-bold font-mono text-slate-900 mt-0.5">
                      {formatFieldOrNotProvided(customer.customerCode || customer.id)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Full Name</p>
                    <p className="text-sm font-bold text-slate-900 mt-0.5">
                      {formatFieldOrNotProvided(customer.fullName)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Primary Phone Number</p>
                    <p className="text-sm font-semibold text-slate-800 mt-0.5 flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      {formatFieldOrNotProvided(customer.phone)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Alternative Phone Number</p>
                    <p className="text-sm font-medium text-slate-700 mt-0.5">
                      {formatFieldOrNotProvided(customer.altPhone)}
                    </p>
                  </div>

                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Email Address</p>
                    <p className="text-sm font-medium text-slate-700 mt-0.5 flex items-center gap-1.5 break-all">
                      <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      {formatFieldOrNotProvided(customer.email)}
                    </p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Residential Address</p>
                    <p className="text-sm font-medium text-slate-800 mt-0.5 flex items-start gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                      <span>
                        {formatFieldOrNotProvided(customer.address)}
                        {(customer.lga || customer.state) && (
                          <span className="text-slate-500">
                            {' '}
                            ({[customer.lga, customer.state].filter(Boolean).join(', ')})
                          </span>
                        )}
                      </span>
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Occupation / Business</p>
                    <p className="text-sm font-medium text-slate-700 mt-0.5 flex items-center gap-1.5">
                      <Briefcase className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      {formatFieldOrNotProvided(customer.occupation)}
                    </p>
                  </div>

                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Identification (NIN / BVN / ID)</p>
                    <p className="text-sm font-mono font-medium text-slate-800 mt-0.5 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      {customer.idType ? `${customer.idType}: ` : ''}
                      {formatFieldOrNotProvided(customer.ninOrBvn)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Registration Date</p>
                    <p className="text-sm font-medium text-slate-800 mt-0.5 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      {formatDateTimeDisplay(customer.registeredAt || customer.registrationDate)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Customer Status</p>
                    <div className="mt-1">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-bold uppercase ${
                          String(customer.status).toUpperCase() === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : String(customer.status).toUpperCase() === 'INACTIVE' ||
                              String(customer.status).toUpperCase() === 'DORMANT'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {formatFieldOrNotProvided(customer.status)}
                      </span>
                    </div>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Account Number</p>
                    <p className="text-sm font-mono font-semibold text-slate-800 mt-0.5">
                      {formatFieldOrNotProvided(customer.accountNumber)}
                    </p>
                  </div>
                </div>

                {/* Programme Associations */}
                <div className="px-5 py-4 bg-slate-50 border-t border-slate-200">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                    Savings, Contribution & Loan Programme Associations
                  </p>
                  {enrolledList.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {enrolledList.map((scheme) => (
                        <span
                          key={scheme}
                          className="px-3 py-1 rounded-md text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200"
                        >
                          {String(scheme).replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 italic">Not provided</p>
                  )}
                </div>
              </div>

              {/* SECTION 2: SEPARATE NEXT OF KIN AND GUARANTOR SECTIONS */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* A. NEXT OF KIN DETAILS */}
                <div
                  data-testid="customer-next-of-kin-section"
                  className="bg-white rounded-xl border border-indigo-200 shadow-sm overflow-hidden"
                >
                  <div className="bg-indigo-50/70 px-5 py-3.5 border-b border-indigo-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-indigo-700" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-950">
                        A. Next of Kin Details
                      </h3>
                    </div>
                    <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-100/80 px-2 py-0.5 rounded">
                      Emergency & Family Contact
                    </span>
                  </div>
                  <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Full Name</p>
                      <p className="text-sm font-bold text-slate-900 mt-0.5">
                        {formatFieldOrNotProvided(customer.nextOfKinName)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Phone Number</p>
                      <p className="text-sm font-semibold text-slate-800 mt-0.5">
                        {formatFieldOrNotProvided(customer.nextOfKinPhone)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        Relationship with Customer
                      </p>
                      <p className="text-sm font-medium text-slate-800 mt-0.5">
                        {formatFieldOrNotProvided(customer.nextOfKinRelationship || customer.nextOfKinRelation)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Residential Address</p>
                      <p className="text-sm font-medium text-slate-800 mt-0.5">
                        {formatFieldOrNotProvided(customer.nextOfKinAddress)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* B. GUARANTOR DETAILS */}
                <div
                  data-testid="customer-guarantor-section"
                  className="bg-white rounded-xl border border-emerald-200 shadow-sm overflow-hidden"
                >
                  <div className="bg-emerald-50/70 px-5 py-3.5 border-b border-emerald-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <UserCheck className="w-4 h-4 text-emerald-700" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-950">
                        B. Guarantor Details
                      </h3>
                    </div>
                    {getGuarantorBadge(customer.guarantorVerificationStatus)}
                  </div>
                  <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Full Name</p>
                      <p className="text-sm font-bold text-slate-900 mt-0.5">
                        {formatFieldOrNotProvided(customer.guarantorName)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Phone Number</p>
                      <p className="text-sm font-semibold text-slate-800 mt-0.5">
                        {formatFieldOrNotProvided(customer.guarantorPhone)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        Relationship with Customer
                      </p>
                      <p className="text-sm font-medium text-slate-800 mt-0.5">
                        {formatFieldOrNotProvided(customer.guarantorRelationship)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Residential Address</p>
                      <p className="text-sm font-medium text-slate-800 mt-0.5">
                        {formatFieldOrNotProvided(customer.guarantorAddress)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 3: REGISTRATION INFORMATION (IMMUTABLE ORIGINAL REGISTERING STAFF) */}
              <div
                data-testid="customer-registration-info-section"
                className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"
              >
                <div className="bg-slate-900 text-white px-5 py-3.5 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-xs font-bold uppercase tracking-wider">
                      Registration Information (Original Registering Staff Member)
                    </h3>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-slate-800 text-emerald-300 px-2.5 py-0.5 rounded border border-slate-700">
                    <Lock className="w-3 h-3" /> Permanent Ownership Record
                  </span>
                </div>
                <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 bg-slate-50/40">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Registered By</p>
                    <p className="text-sm font-bold text-slate-900 mt-0.5">
                      {formatFieldOrNotProvided(customer.registeredByName)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Staff ID</p>
                    <p className="text-sm font-mono font-bold text-emerald-700 mt-0.5">
                      {formatFieldOrNotProvided(customer.registeredByStaffCode || customer.registeredByStaffId)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Staff Position</p>
                    <p className="text-sm font-semibold text-slate-800 mt-0.5">
                      {formatFieldOrNotProvided(customer.registeredByPosition)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Department / Branch</p>
                    <p className="text-sm font-medium text-slate-700 mt-0.5">
                      {formatFieldOrNotProvided(customer.registeredByDepartment)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Registration Date & Time
                    </p>
                    <p className="text-sm font-medium text-slate-800 mt-0.5">
                      {formatDateTimeDisplay(customer.registeredAt || customer.registrationDate)}
                    </p>
                  </div>
                </div>
                {customer.lastModifiedByName && (
                  <div className="px-5 py-2.5 bg-slate-100 border-t border-slate-200 text-xs text-slate-600 flex flex-wrap items-center justify-between gap-2">
                    <span>
                      Last updated by: <strong>{customer.lastModifiedByName}</strong> (
                      {customer.lastModifiedByPosition || customer.lastModifiedByRole || 'Staff'})
                    </span>
                    <span>Updated at: {formatDateTimeDisplay(customer.updatedAt || customer.lastModifiedAt)}</span>
                  </div>
                )}
              </div>

              {/* SECTION 4: CUSTOMER ACTIVITY HISTORY TIMELINE */}
              <div
                data-testid="customer-activity-history-section"
                className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"
              >
                <div className="bg-slate-900/5 px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <History className="w-4 h-4 text-slate-700" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                      Customer Activity History ({activityTimeline.length})
                    </h3>
                  </div>
                  <span className="text-[11px] text-slate-500 font-medium">
                    Immutable Audit & Operational Timeline
                  </span>
                </div>

                <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
                  {activityTimeline.map((entry) => {
                    const officerName = entry.actorName || entry.performedByName || 'Authorised Officer';
                    const officerPos =
                      entry.actorPosition ||
                      entry.performedByPosition ||
                      entry.actorRole ||
                      entry.performedByRole ||
                      'Staff';
                    const officerCode = entry.actorStaffCode || entry.performedByStaffCode || '';
                    return (
                      <div key={entry.id} className="p-4 hover:bg-slate-50/80 transition-colors">
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${getCategoryBadgeStyle(
                                entry.category
                              )}`}
                            >
                              {entry.category.replace(/_/g, ' ')}
                            </span>
                            <span className="text-xs font-bold text-slate-900">{entry.action}</span>
                          </div>
                          <span className="text-xs font-mono text-slate-500 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDateTimeDisplay(entry.timestamp)}
                          </span>
                        </div>
                        <p className="text-xs text-slate-700 leading-relaxed mb-2">{entry.description}</p>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
                          <span>
                            Responsible Officer: <strong className="text-slate-800">{officerName}</strong>
                          </span>
                          <span>
                            Position: <strong className="text-slate-700">{officerPos}</strong>
                          </span>
                          {officerCode && (
                            <span>
                              Staff ID: <strong className="font-mono text-slate-700">{officerCode}</strong>
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
