import React, { useState, useEffect, useMemo } from 'react';
import {
  Briefcase,
  Users,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Search,
  Download,
  RefreshCw,
  LogOut,
  UserPlus,
  Layers,
  Clock,
  FileText,
  X,
  KeyRound,
  ShieldCheck,
  Edit3,
  Trash2,
  ExternalLink,
} from 'lucide-react';
import { User, CustomerRecord } from '../../../types/banking';
import { safeApiFetch } from '../../../utils/apiClient';
import { authService } from '../../../services/authService';
import {
  ADMIN_POSITIONS,
  STAFF_POSITIONS,
  ASSIGNABLE_PROGRAMMES,
  POSITION_METADATA,
  getDefaultPositionPermissions,
  StaffPosition,
} from '../../../utils/roleRouting';
import { CentralCustomerDirectory } from '../../../components/internal/CentralCustomerDirectory';
import { CustomerProfileModal } from '../../../components/internal/CustomerProfileModal';

interface OperationsManagerDashboardProps {
  currentUser: User | null;
  onLogout: () => void;
  onNavigate?: (path: string) => void;
}

export const OperationsManagerDashboard: React.FC<OperationsManagerDashboardProps> = ({
  currentUser,
  onLogout,
  onNavigate,
}) => {
  const [activeTab, setActiveTab] = useState<
    'overview' | 'programmes' | 'staff' | 'registrations' | 'loans'
  >('overview');
  const [staffAccounts, setStaffAccounts] = useState<any[]>([]);
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [profileCustomer, setProfileCustomer] = useState<CustomerRecord | null>(null);
  const [collections, setCollections] = useState<any[]>([]);
  const [loans, setLoans] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Create Staff Modal State
  const [showCreateStaffModal, setShowCreateStaffModal] = useState(false);
  const [isCreatingStaff, setIsCreatingStaff] = useState(false);
  const [staffForm, setStaffForm] = useState<{
    fullName: string;
    email: string;
    phone: string;
    position: StaffPosition;
    assignedProgramme: string;
    status: 'active' | 'suspended';
    accessCode: string;
    initialPassword: string;
    permissions: Record<string, boolean>;
  }>({
    fullName: '',
    email: '',
    phone: '',
    position: 'Customer Registration Officer',
    assignedProgramme: ASSIGNABLE_PROGRAMMES[0],
    status: 'active',
    accessCode: '',
    initialPassword: '',
    permissions: getDefaultPositionPermissions('Customer Registration Officer'),
  });

  // Edit & Delete Account State
  const [editingAccount, setEditingAccount] = useState<any | null>(null);
  const [editForm, setEditForm] = useState<{
    fullName: string;
    email: string;
    phone: string;
    role: 'ADMIN' | 'STAFF';
    position: string;
    assignedProgramme: string;
    status: 'active' | 'suspended';
    password: string;
  }>({
    fullName: '',
    email: '',
    phone: '',
    role: 'STAFF',
    position: 'Customer Registration Officer',
    assignedProgramme: ASSIGNABLE_PROGRAMMES[0],
    status: 'active',
    password: '',
  });
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState<any | null>(null);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  const loadOperationalData = async () => {
    setIsLoading(true);
    try {
      const [accList, custRes, colRes, loanRes] = await Promise.all([
        authService.getAccountsList(),
        safeApiFetch('/api/customers'),
        safeApiFetch('/api/operations/collections'),
        safeApiFetch('/api/operations/loans'),
      ]);
      setStaffAccounts(
        (accList || []).filter(
          (a) =>
            String(a.role || '').toUpperCase() !== 'LIFETIME_SUPER_ADMIN' &&
            !a.isLifetimeSuperAdmin
        )
      );
      if (custRes.success) setCustomers(custRes.customers || custRes.data?.customers || []);
      if (colRes.success) setCollections(colRes.collections || colRes.data?.collections || []);
      if (loanRes.success) setLoans(loanRes.loans || loanRes.data?.loans || []);
    } catch (err) {
      console.warn('[OperationsManagerDashboard] Failed loading data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadOperationalData();
  }, []);

  const supervisedStaff = useMemo(
    () =>
      staffAccounts.filter(
        (a) =>
          String(a.role || '').toUpperCase() !== 'LIFETIME_SUPER_ADMIN' &&
          !a.isLifetimeSuperAdmin
      ),
    [staffAccounts]
  );

  const handleOpenEditAccount = (acc: any) => {
    const roleTier: 'ADMIN' | 'STAFF' =
      String(acc.role || '').toUpperCase() === 'ADMIN' ? 'ADMIN' : 'STAFF';
    const currentPos =
      acc.position ||
      acc.duty ||
      acc.roleTitle ||
      (roleTier === 'ADMIN' ? 'Operations Manager' : 'Customer Registration Officer');
    setEditingAccount(acc);
    setEditForm({
      fullName: acc.fullName || '',
      email: acc.email || '',
      phone: acc.phone || '',
      role: roleTier,
      position: currentPos,
      assignedProgramme: acc.assignedProgramme || ASSIGNABLE_PROGRAMMES[0],
      status: acc.status === 'suspended' ? 'suspended' : 'active',
      password: '',
    });
  };

  const handleSaveEditAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAccount || isSavingEdit) return;
    setIsSavingEdit(true);
    setFeedback(null);
    try {
      const route =
        POSITION_METADATA[editForm.position as keyof typeof POSITION_METADATA]?.route ||
        (editForm.role === 'ADMIN' ? '/admin/operationsmanager' : '/staff/customer-registration');
      const res = await authService.updateAccount(editingAccount.id || editingAccount.email, {
        fullName: editForm.fullName.trim(),
        email: editForm.email.trim().toLowerCase(),
        phone: editForm.phone.trim(),
        role: editForm.role,
        position: editForm.position,
        duty: editForm.position,
        roleTitle: editForm.position,
        operationalResponsibility: editForm.position,
        dashboardRoute: route,
        assignedProgramme: editForm.assignedProgramme,
        status: editForm.status,
        permissions: getDefaultPositionPermissions(editForm.position),
        ...(editForm.password.trim() ? { password: editForm.password.trim() } : {}),
      });
      if (!res.success) {
        setFeedback({ type: 'error', message: res.message || 'Failed to update account.' });
      } else {
        setFeedback({
          type: 'success',
          message: `Account "${editForm.fullName}" updated successfully.`,
        });
        setEditingAccount(null);
        await loadOperationalData();
      }
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleConfirmDeleteAccount = async () => {
    if (!deletingAccount || isDeletingAccount) return;
    setIsDeletingAccount(true);
    setFeedback(null);
    try {
      const res = await authService.deleteAccount(
        deletingAccount.id || deletingAccount.email,
        deletingAccount.email
      );
      if (!res.success) {
        setFeedback({ type: 'error', message: res.message || 'Failed to delete account.' });
      } else {
        setStaffAccounts((prev) =>
          prev.filter(
            (a) =>
              a.id !== deletingAccount.id &&
              String(a.email || '').toLowerCase() !==
                String(deletingAccount.email || '').toLowerCase()
          )
        );
        setFeedback({
          type: 'success',
          message: `Account "${deletingAccount.fullName}" (${deletingAccount.email}) permanently deleted.`,
        });
        setDeletingAccount(null);
      }
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const incompleteTasks = useMemo(() => {
    const incompleteRegs = customers.filter(
      (c) => !c.ninOrBvn || !c.nextOfKinName
    ).length;
    const pendingLoans = loans.filter(
      (l) => l.stage === 'PENDING_FINAL_APPROVAL' || l.stage === 'UNDER_CREDIT_REVIEW'
    ).length;
    const unreconciledCollections = collections.filter((c) => !c.reconciled).length;
    return {
      incompleteRegs,
      pendingLoans,
      unreconciledCollections,
      total: incompleteRegs + pendingLoans + unreconciledCollections,
    };
  }, [customers, loans, collections]);

  const handleStaffPositionChange = (pos: StaffPosition) => {
    setStaffForm((prev) => ({
      ...prev,
      position: pos,
      permissions: getDefaultPositionPermissions(pos),
    }));
  };

  const handleGenerateStaffCode = async () => {
    const res = await authService.generateAccessCode({
      email: staffForm.email || undefined,
      accessType: 'Staff',
      duty: staffForm.position,
      permissions: staffForm.permissions,
    });
    if (res.success && res.code) {
      setStaffForm((prev) => ({
        ...prev,
        accessCode: res.code || '',
        initialPassword: prev.initialPassword || res.code || '',
      }));
    }
  };

  const handleCreateStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingStaff(true);
    setFeedback(null);
    try {
      const res = await authService.createStaffAccount({
        fullName: staffForm.fullName,
        email: staffForm.email,
        phone: staffForm.phone,
        position: staffForm.position,
        duty: staffForm.position,
        roleTitle: staffForm.position,
        operationalResponsibility: staffForm.position,
        assignedProgramme: staffForm.assignedProgramme,
        permissions: staffForm.permissions,
        status: staffForm.status,
        accessCode: staffForm.accessCode,
        initialPassword: staffForm.initialPassword || staffForm.accessCode,
      });

      if (!res.success) {
        setFeedback({
          type: 'error',
          message: res.message || res.error || 'Failed to provision staff account.',
        });
      } else {
        setFeedback({
          type: 'success',
          message: `Staff account for ${staffForm.fullName} (${staffForm.position}) created and routed to ${POSITION_METADATA[staffForm.position].route}.`,
        });
        setShowCreateStaffModal(false);
        setStaffForm({
          fullName: '',
          email: '',
          phone: '',
          position: 'Customer Registration Officer',
          assignedProgramme: ASSIGNABLE_PROGRAMMES[0],
          status: 'active',
          accessCode: '',
          initialPassword: '',
          permissions: getDefaultPositionPermissions('Customer Registration Officer'),
        });
        await loadOperationalData();
      }
    } finally {
      setIsCreatingStaff(false);
    }
  };

  const handleExportOperationalReport = () => {
    const report = {
      title: 'TEAMACRO OPERATIONS MANAGEMENT REPORT',
      generatedBy: currentUser?.fullName || 'Operations Manager',
      position: 'Operations Manager',
      route: '/admin/operationsmanager',
      generatedAt: new Date().toISOString(),
      operationalSummary: {
        activeProgrammes: ASSIGNABLE_PROGRAMMES.length,
        supervisedStaffCount: supervisedStaff.length,
        registeredCustomersCount: customers.length,
        pendingOperationalTasks: incompleteTasks,
      },
      staffDirectory: supervisedStaff,
      loans,
      collections,
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `teamacro-operations-report-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[#07112B] text-white flex flex-col">
      {/* Header */}
      <header className="bg-[#0B1942] border-b border-white/10 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-sky-500/15 border border-sky-400/30 flex items-center justify-center">
            <Briefcase className="w-6 h-6 text-sky-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-400/30">
                ADMINISTRATION · OPERATIONS MANAGER
              </span>
              <span className="text-xs font-mono text-slate-400">/admin/operationsmanager</span>
            </div>
            <h1 className="text-lg font-bold text-white mt-0.5">
              Savings Programmes, Staff Supervision & Operational Command
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
            onClick={() => setShowCreateStaffModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs transition"
          >
            <UserPlus className="w-4 h-4" />
            Create Staff
          </button>
          <button
            onClick={loadOperationalData}
            className="p-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 transition"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-sky-400' : ''}`} />
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

      {/* Navigation */}
      <div className="bg-[#091538] border-b border-white/10 px-6 flex items-center gap-2 overflow-x-auto">
        {[
          { id: 'overview', label: 'Operations Overview & Alerts', icon: Activity },
          { id: 'programmes', label: 'Savings & Loan Programmes', icon: Layers },
          { id: 'staff', label: 'Supervised Staff & Roles', icon: Users },
          { id: 'registrations', label: 'Customer Registrations', icon: CheckCircle2 },
          { id: 'loans', label: 'Loan & Collection Operations', icon: Clock },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-3.5 text-xs font-semibold border-b-2 transition whitespace-nowrap ${
                active
                  ? 'border-sky-400 text-sky-300 bg-sky-500/10'
                  : 'border-transparent text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-[#0D1E4C] border border-white/10 rounded-xl p-5">
            <div className="text-xs text-slate-300">ASSIGNED PROGRAMMES</div>
            <div className="text-2xl font-bold font-mono text-white mt-2">
              {ASSIGNABLE_PROGRAMMES.length}
            </div>
            <div className="text-xs text-sky-300 mt-1">Active savings & loan schemes</div>
          </div>

          <div className="bg-[#0D1E4C] border border-white/10 rounded-xl p-5">
            <div className="text-xs text-slate-300">SUPERVISED STAFF</div>
            <div className="text-2xl font-bold font-mono text-white mt-2">
              {supervisedStaff.length}
            </div>
            <div className="text-xs text-emerald-300 mt-1">4 specialized staff positions</div>
          </div>

          <div className="bg-[#0D1E4C] border border-white/10 rounded-xl p-5">
            <div className="text-xs text-slate-300">CUSTOMER REGISTRATIONS</div>
            <div className="text-2xl font-bold font-mono text-white mt-2">
              {customers.length}
            </div>
            <div className="text-xs text-slate-300 mt-1">Enrolled cooperative & thrift members</div>
          </div>

          <div className="bg-[#0D1E4C] border border-white/10 rounded-xl p-5">
            <div className="text-xs text-slate-300">PENDING OPERATIONAL TASKS</div>
            <div className="text-2xl font-bold font-mono text-amber-300 mt-2">
              {incompleteTasks.total}
            </div>
            <div className="text-xs text-amber-200 mt-1">
              {incompleteTasks.pendingLoans} loan reviews · {incompleteTasks.unreconciledCollections}{' '}
              unreconciled
            </div>
          </div>
        </div>

        {/* Filter & Export Bar */}
        <div className="bg-[#0D1E4C] border border-white/10 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search staff, customer registrations, savings programmes, or loan applications..."
              className="w-full pl-10 pr-4 py-2 rounded-lg bg-[#07112B] border border-white/15 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-sky-400"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportOperationalReport}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 text-white font-semibold text-xs transition"
            >
              <Download className="w-4 h-4" />
              Download Operational Report
            </button>
          </div>
        </div>

        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-[#0D1E4C] border border-white/10 rounded-xl p-5 space-y-4">
              <h2 className="text-base font-bold text-white">
                Operational Bottlenecks & Incomplete Task Monitor
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-4 rounded-xl bg-[#07112B] border border-white/10">
                  <div className="text-xs text-slate-400">Incomplete KYC / Next-of-Kin</div>
                  <div className="text-xl font-bold text-amber-300 mt-1">
                    {incompleteTasks.incompleteRegs} Customers
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Assigned to Customer Registration Officers for completion.
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-[#07112B] border border-white/10">
                  <div className="text-xs text-slate-400">Loans Awaiting Review</div>
                  <div className="text-xl font-bold text-sky-300 mt-1">
                    {incompleteTasks.pendingLoans} Applications
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Originated by Loan Officers awaiting operational sign-off.
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-[#07112B] border border-white/10">
                  <div className="text-xs text-slate-400">Pending Reconciliations</div>
                  <div className="text-xl font-bold text-emerald-300 mt-1">
                    {incompleteTasks.unreconciledCollections} Collections
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Field collections queued for Accounts Officer verification.
                  </p>
                </div>
              </div>

              <h3 className="text-sm font-bold text-white pt-2">
                Supervised Staff Directory ({supervisedStaff.length})
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 text-[11px] uppercase text-slate-400">
                      <th className="py-2.5 px-3">Account Name</th>
                      <th className="py-2.5 px-3">Role & Position</th>
                      <th className="py-2.5 px-3">Dedicated Route</th>
                      <th className="py-2.5 px-3">Programme / Dept</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-xs">
                    {supervisedStaff.map((stf) => {
                      const isSelf =
                        stf.id === currentUser?.id ||
                        String(stf.email || '').toLowerCase() ===
                          String(currentUser?.email || '').toLowerCase();
                      return (
                        <tr key={stf.id || stf.email} className="hover:bg-white/5">
                          <td className="py-3 px-3">
                            <div className="font-semibold text-white">{stf.fullName}</div>
                            <div className="text-[11px] text-slate-400">{stf.email}</div>
                          </td>
                          <td className="py-3 px-3">
                            <span className="px-2.5 py-0.5 rounded bg-sky-500/20 text-sky-300 font-semibold text-[11px]">
                              {stf.position || stf.duty || stf.roleTitle || stf.role}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-mono text-slate-300">
                            {stf.dashboardRoute || '/staff'}
                          </td>
                          <td className="py-3 px-3 text-slate-300">
                            {stf.assignedProgramme || 'General Operations'}
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                stf.status === 'suspended'
                                  ? 'bg-rose-500/20 text-rose-300'
                                  : 'bg-emerald-500/20 text-emerald-300'
                              }`}
                            >
                              {stf.status || 'active'}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleOpenEditAccount(stf)}
                                className="px-2 py-1 rounded bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/30 text-sky-300 text-[11px] font-semibold inline-flex items-center gap-1"
                              >
                                <Edit3 className="w-3 h-3" />
                                Edit
                              </button>
                              {!isSelf && (
                                <button
                                  onClick={() => setDeletingAccount(stf)}
                                  className="px-2 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/30 text-rose-300 text-[11px] font-semibold inline-flex items-center gap-1"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  Delete
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-[#0D1E4C] border border-white/10 rounded-xl p-5 space-y-4">
              <h2 className="text-base font-bold text-white">Savings Programmes Oversight</h2>
              <div className="space-y-2.5">
                {ASSIGNABLE_PROGRAMMES.map((prog) => {
                  const progCols = collections.filter((c) => c.programme === prog);
                  const progSum = progCols.reduce((s, c) => s + Number(c.amount || 0), 0);
                  return (
                    <div
                      key={prog}
                      className="p-3 rounded-xl bg-[#07112B] border border-white/10 flex items-center justify-between"
                    >
                      <div>
                        <div className="text-xs font-semibold text-white">{prog}</div>
                        <div className="text-[11px] text-slate-400">
                          {progCols.length} recorded transactions
                        </div>
                      </div>
                      <div className="text-xs font-mono font-bold text-emerald-300">
                        ₦{progSum.toLocaleString()}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* PROGRAMMES TAB */}
        {activeTab === 'programmes' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {ASSIGNABLE_PROGRAMMES.map((prog) => {
              const progCols = collections.filter((c) => c.programme === prog);
              const progLoans = loans.filter((l) => l.programme === prog);
              return (
                <div
                  key={prog}
                  className="bg-[#0D1E4C] border border-white/10 rounded-xl p-5 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded bg-sky-500/20 text-sky-300 text-[10px] font-bold uppercase">
                      ACTIVE PROGRAMME
                    </span>
                    <Layers className="w-4 h-4 text-sky-400" />
                  </div>
                  <h3 className="text-sm font-bold text-white">{prog}</h3>
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/10 text-xs">
                    <div>
                      <div className="text-slate-400">Collections</div>
                      <div className="font-mono font-bold text-emerald-300">
                        {progCols.length} entries
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-400">Loan Facilities</div>
                      <div className="font-mono font-bold text-sky-300">
                        {progLoans.length} active
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* STAFF TAB */}
        {activeTab === 'staff' && (
          <div className="bg-[#0D1E4C] border border-white/10 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white">
                Supervised Staff & Assigned Positions ({supervisedStaff.length})
              </h2>
              <button
                onClick={() => setShowCreateStaffModal(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-sky-500 text-slate-950 font-bold text-xs"
              >
                <UserPlus className="w-4 h-4" />
                Provision New Staff
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-[11px] uppercase text-slate-400">
                    <th className="py-2.5 px-3">Staff Code</th>
                    <th className="py-2.5 px-3">Full Name & Email</th>
                    <th className="py-2.5 px-3">Phone</th>
                    <th className="py-2.5 px-3">Position & Tier</th>
                    <th className="py-2.5 px-3">Dedicated Route</th>
                    <th className="py-2.5 px-3">Assigned Programme</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-xs">
                  {supervisedStaff.map((stf) => {
                    const isSelf =
                      stf.id === currentUser?.id ||
                      String(stf.email || '').toLowerCase() ===
                        String(currentUser?.email || '').toLowerCase();
                    return (
                      <tr key={stf.id || stf.email} className="hover:bg-white/5">
                        <td className="py-3 px-3 font-mono text-sky-300">{stf.staffCode}</td>
                        <td className="py-3 px-3">
                          <div className="font-semibold text-white">{stf.fullName}</div>
                          <div className="text-[11px] text-slate-400">{stf.email}</div>
                        </td>
                        <td className="py-3 px-3 text-slate-300">{stf.phone}</td>
                        <td className="py-3 px-3">
                          <span className="px-2.5 py-0.5 rounded bg-sky-500/20 text-sky-300 font-semibold text-[11px]">
                            {stf.position || stf.duty || stf.roleTitle || stf.role}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-300">
                          {stf.dashboardRoute || '/staff'}
                        </td>
                        <td className="py-3 px-3 text-slate-300">
                          {stf.assignedProgramme || 'General Operations'}
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              stf.status === 'suspended'
                                ? 'bg-rose-500/20 text-rose-300'
                                : 'bg-emerald-500/20 text-emerald-300'
                            }`}
                          >
                            {stf.status || 'active'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenEditAccount(stf)}
                              className="px-2.5 py-1 rounded bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/30 text-sky-300 text-[11px] font-semibold inline-flex items-center gap-1"
                            >
                              <Edit3 className="w-3 h-3" />
                              Edit
                            </button>
                            {!isSelf && (
                              <button
                                onClick={() => setDeletingAccount(stf)}
                                className="px-2.5 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/30 text-rose-300 text-[11px] font-semibold inline-flex items-center gap-1"
                              >
                                <Trash2 className="w-3 h-3" />
                                Delete
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* REGISTRATIONS TAB */}
        {activeTab === 'registrations' && (
          <div className="text-slate-900">
            <CentralCustomerDirectory
              title="Central Customer Directory & Staff Registration Monitor (Operations Manager)"
              subtitle="Click any customer name to inspect their full profile, separate Next of Kin & Guarantor sections, original registering staff member, and operational activity timeline."
              canCreateCustomer={true}
              canEditCustomer={true}
              canRecordActivity={true}
              onCustomersChanged={(list) => setCustomers(list)}
            />
          </div>
        )}

        {/* LOANS TAB */}
        {activeTab === 'loans' && (
          <div className="bg-[#0D1E4C] border border-white/10 rounded-xl p-5 space-y-4">
            <h2 className="text-base font-bold text-white">
              Loan Operations & Repayment Schedule Oversight ({loans.length})
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-[11px] uppercase text-slate-400">
                    <th className="py-2.5 px-3">Loan Code</th>
                    <th className="py-2.5 px-3">Borrower (Click for Profile)</th>
                    <th className="py-2.5 px-3">Programme</th>
                    <th className="py-2.5 px-3">Principal</th>
                    <th className="py-2.5 px-3">Outstanding</th>
                    <th className="py-2.5 px-3">Stage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-xs">
                  {loans.map((l) => {
                    const bName = l.customerName || l.borrowerName;
                    const matchedCust = customers.find(
                      (c) =>
                        c.id === l.customerId ||
                        c.customerCode === l.customerId ||
                        c.fullName?.toLowerCase() === bName?.toLowerCase()
                    );
                    return (
                      <tr key={l.id} className="hover:bg-white/5">
                        <td className="py-3 px-3 font-mono text-sky-300">{l.loanCode || l.id}</td>
                        <td className="py-3 px-3 font-semibold text-white">
                          {matchedCust ? (
                            <button
                              type="button"
                              onClick={() => setProfileCustomer(matchedCust)}
                              className="font-bold text-sky-300 hover:text-white hover:underline flex items-center gap-1 text-left"
                            >
                              <span>{bName}</span>
                              <ExternalLink className="w-3 h-3" />
                            </button>
                          ) : (
                            bName
                          )}
                        </td>
                        <td className="py-3 px-3 text-slate-300">{l.programme}</td>
                        <td className="py-3 px-3 font-mono text-white">
                          ₦{Number(l.principalAmount || l.amount || 0).toLocaleString()}
                        </td>
                        <td className="py-3 px-3 font-mono text-amber-300">
                          ₦{Number(l.outstandingBalance || 0).toLocaleString()}
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 text-[10px] font-bold">
                            {l.stage || l.status}
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

      {/* CREATE STAFF MODAL */}
      {showCreateStaffModal && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#0D1E4C] border border-white/15 rounded-2xl max-w-xl w-full p-6 space-y-4 my-8">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white">Create Staff Account</h3>
                <p className="text-xs text-slate-300">
                  Assign one of the four official TEAMACRO Staff positions and dedicated dashboard route.
                </p>
              </div>
              <button
                onClick={() => setShowCreateStaffModal(false)}
                className="p-1 rounded-lg hover:bg-white/10"
              >
                <X className="w-4 h-4 text-slate-300" />
              </button>
            </div>

            <form onSubmit={handleCreateStaffSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={staffForm.fullName}
                    onChange={(e) => setStaffForm({ ...staffForm, fullName: e.target.value })}
                    placeholder="e.g. Chidinma Okeke"
                    className="w-full px-3 py-2 rounded-lg bg-[#07112B] border border-white/15 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">Official Email Address *</label>
                  <input
                    type="email"
                    required
                    value={staffForm.email}
                    onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })}
                    placeholder="staff@teamacro.com"
                    className="w-full px-3 py-2 rounded-lg bg-[#07112B] border border-white/15 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1">Phone Number *</label>
                  <input
                    type="tel"
                    required
                    value={staffForm.phone}
                    onChange={(e) => setStaffForm({ ...staffForm, phone: e.target.value })}
                    placeholder="+234 803 000 0000"
                    className="w-full px-3 py-2 rounded-lg bg-[#07112B] border border-white/15 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">Staff Position *</label>
                  <select
                    required
                    value={staffForm.position}
                    onChange={(e) => handleStaffPositionChange(e.target.value as StaffPosition)}
                    className="w-full px-3 py-2 rounded-lg bg-[#07112B] border border-sky-400/40 text-white font-semibold"
                  >
                    {STAFF_POSITIONS.map((pos) => (
                      <option key={pos} value={pos} className="bg-[#0B1942]">
                        {pos}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-400/30 text-[11px] space-y-1">
                <div className="flex items-center justify-between font-bold text-sky-300">
                  <span>{staffForm.position}</span>
                  <span className="font-mono">{POSITION_METADATA[staffForm.position].route}</span>
                </div>
                <p className="text-slate-300">{POSITION_METADATA[staffForm.position].summary}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1">
                    Assigned Programme / Department *
                  </label>
                  <select
                    value={staffForm.assignedProgramme}
                    onChange={(e) =>
                      setStaffForm({ ...staffForm, assignedProgramme: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg bg-[#07112B] border border-white/15 text-white"
                  >
                    {ASSIGNABLE_PROGRAMMES.map((prog) => (
                      <option key={prog} value={prog} className="bg-[#0B1942]">
                        {prog}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">Account Status *</label>
                  <select
                    value={staffForm.status}
                    onChange={(e) =>
                      setStaffForm({
                        ...staffForm,
                        status: e.target.value as 'active' | 'suspended',
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg bg-[#07112B] border border-white/15 text-white"
                  >
                    <option value="active" className="bg-[#0B1942]">
                      Active
                    </option>
                    <option value="suspended" className="bg-[#0B1942]">
                      Suspended
                    </option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Assigned Permissions</label>
                <div className="grid grid-cols-2 gap-2 p-3 rounded-lg bg-[#07112B] border border-white/10">
                  {[
                    { key: 'canViewCustomers', label: 'View Customers' },
                    { key: 'canRegisterCustomers', label: 'Register Customers' },
                    { key: 'canRecordCollections', label: 'Record Collections' },
                    { key: 'canReviewLoans', label: 'Review / Originate Loans' },
                    { key: 'canUpdateLoanStages', label: 'Update Loan Stages' },
                    { key: 'canViewFinancialRecords', label: 'View Financial Records' },
                    { key: 'canPrepareReconciliations', label: 'Prepare Reconciliations' },
                    { key: 'canExportReports', label: 'Export Reports' },
                  ].map((perm) => (
                    <label key={perm.key} className="flex items-center gap-2 text-[11px] text-slate-200">
                      <input
                        type="checkbox"
                        checked={Boolean(staffForm.permissions[perm.key])}
                        onChange={(e) =>
                          setStaffForm({
                            ...staffForm,
                            permissions: {
                              ...staffForm.permissions,
                              [perm.key]: e.target.checked,
                            },
                          })
                        }
                        className="rounded border-white/20"
                      />
                      {perm.label}
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1">Access Authorization Code *</label>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      required
                      value={staffForm.accessCode}
                      onChange={(e) => setStaffForm({ ...staffForm, accessCode: e.target.value })}
                      placeholder="TM-STF-XXXXXX"
                      className="w-full px-3 py-2 rounded-lg bg-[#07112B] border border-white/15 text-white font-mono"
                    />
                    <button
                      type="button"
                      onClick={handleGenerateStaffCode}
                      className="px-2.5 py-2 rounded-lg bg-sky-500/20 border border-sky-400/40 text-sky-300 hover:bg-sky-500/30 shrink-0"
                      title="Generate Code"
                    >
                      <KeyRound className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">Initial Login Password *</label>
                  <input
                    type="text"
                    required
                    value={staffForm.initialPassword}
                    onChange={(e) =>
                      setStaffForm({ ...staffForm, initialPassword: e.target.value })
                    }
                    placeholder="Min. 6 characters"
                    className="w-full px-3 py-2 rounded-lg bg-[#07112B] border border-white/15 text-white font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCreateStaffModal(false)}
                  className="px-4 py-2 rounded-lg bg-white/10 text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingStaff}
                  className="px-4 py-2 rounded-lg bg-sky-500 text-slate-950 font-bold"
                >
                  {isCreatingStaff ? 'Provisioning...' : 'Create Staff Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT ACCOUNT MODAL */}
      {editingAccount && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#0D1E4C] border border-white/15 rounded-2xl max-w-lg w-full p-6 space-y-4 my-8">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">
                Edit Account: {editingAccount.fullName}
              </h3>
              <button
                onClick={() => setEditingAccount(null)}
                className="p-1 rounded-lg hover:bg-white/10"
              >
                <X className="w-4 h-4 text-slate-300" />
              </button>
            </div>

            <form onSubmit={handleSaveEditAccount} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={editForm.fullName}
                  onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-[#07112B] border border-white/15 text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1">Email *</label>
                  <input
                    type="email"
                    required
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[#07112B] border border-white/15 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">Phone *</label>
                  <input
                    type="tel"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[#07112B] border border-white/15 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1">Position *</label>
                  <select
                    value={editForm.position}
                    onChange={(e) => setEditForm({ ...editForm, position: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[#07112B] border border-white/15 text-white"
                  >
                    {(editForm.role === 'ADMIN' ? ADMIN_POSITIONS : STAFF_POSITIONS).map((pos) => (
                      <option key={pos} value={pos} className="bg-[#0B1942]">
                        {pos}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">Status *</label>
                  <select
                    value={editForm.status}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        status: e.target.value as 'active' | 'suspended',
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg bg-[#07112B] border border-white/15 text-white"
                  >
                    <option value="active" className="bg-[#0B1942]">
                      Active
                    </option>
                    <option value="suspended" className="bg-[#0B1942]">
                      Suspended
                    </option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1">Assigned Programme</label>
                  <select
                    value={editForm.assignedProgramme}
                    onChange={(e) =>
                      setEditForm({ ...editForm, assignedProgramme: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg bg-[#07112B] border border-white/15 text-white"
                  >
                    {ASSIGNABLE_PROGRAMMES.map((prog) => (
                      <option key={prog} value={prog} className="bg-[#0B1942]">
                        {prog}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">Reset Password (Optional)</label>
                  <input
                    type="text"
                    value={editForm.password}
                    onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                    placeholder="Leave blank to keep current"
                    className="w-full px-3 py-2 rounded-lg bg-[#07112B] border border-white/15 text-white font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingAccount(null)}
                  className="px-4 py-2 rounded-lg bg-white/10 text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="px-4 py-2 rounded-lg bg-sky-500 text-slate-950 font-bold"
                >
                  {isSavingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE ACCOUNT CONFIRMATION MODAL */}
      {deletingAccount && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-[#0D1E4C] border border-rose-500/40 rounded-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-rose-400 font-bold">
                <Trash2 className="w-5 h-5" />
                <span>Delete Account</span>
              </div>
              <button
                onClick={() => setDeletingAccount(null)}
                className="p-1 rounded-lg hover:bg-white/10"
              >
                <X className="w-4 h-4 text-slate-300" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-400/30 text-xs space-y-1">
              <div className="font-bold text-white">
                {deletingAccount.fullName} ({deletingAccount.email})
              </div>
              <div className="text-rose-200">
                Position: {deletingAccount.position || deletingAccount.duty || deletingAccount.role}
              </div>
              <p className="text-slate-300 pt-1">
                This permanently deletes this account from TEAMACRO Authentication and Cloud Firestore.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingAccount(null)}
                disabled={isDeletingAccount}
                className="px-4 py-2 rounded-lg bg-white/10 text-white text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteAccount}
                disabled={isDeletingAccount}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeletingAccount ? 'Deleting...' : 'Permanently Delete'}</span>
              </button>
            </div>
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
