import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Search,
  Filter,
  DollarSign,
  Users,
  Layers,
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  Check,
  X,
  FileText,
  Lock,
  Building2,
  Eye,
  AlertCircle,
  LogOut,
  ChevronRight,
  UserPlus,
  Briefcase,
  ExternalLink,
} from 'lucide-react';
import {
  BankConfig,
  MoneyTransferRequest,
  MoneyTransferType,
  MoneyTransferStatus,
  StaffUser,
  CustomerRecord,
  SystemMetrics,
  User,
} from '../../types/banking';
import { ledgerEngine } from '../../services/ledgerEngine';
import { authService } from '../../services/authService';
import { formatNaira, formatLagosDate } from '../../utils/formatters';
import { BrandLogo } from '../../components/common/BrandLogo';
import { ThemeSelector } from '../../components/common/ThemeSelector';

interface AdminPortalProps {
  config: BankConfig;
  onNavigate: (route: string) => void;
  currentUser?: User | null;
  onLogout?: () => void;
}

export const AdminPortal: React.FC<AdminPortalProps> = ({
  config,
  onNavigate,
  currentUser: initialUser,
  onLogout,
}) => {
  const [currentUser, setCurrentUser] = useState<User | null>(
    () => initialUser || ledgerEngine.getCurrentUser()
  );

  // Quick switch or auth check
  const [activeTab, setActiveTab] = useState<'approvals' | 'staff' | 'operations' | 'customers'>('approvals');
  const [requests, setRequests] = useState<MoneyTransferRequest[]>([]);
  const [staffList, setStaffList] = useState<StaffUser[]>([]);
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals & Actions
  const [selectedRequest, setSelectedRequest] = useState<MoneyTransferRequest | null>(null);
  const [actionModal, setActionModal] = useState<'approve' | 'reject' | 'execute' | 'inspect' | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [approvalNotes, setApprovalNotes] = useState('');
  const [executionProof, setExecutionProof] = useState('');
  const [executionNotes, setExecutionNotes] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Add Staff Modal
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newStaffPhone, setNewStaffPhone] = useState('');
  const [newStaffRole, setNewStaffRole] = useState<'operations_manager' | 'loan_officer' | 'field_collector' | 'customer_service' | 'accountant' | 'auditor'>('loan_officer');
  const [newStaffResponsibility, setNewStaffResponsibility] = useState('');
  const [newStaffAccessCode, setNewStaffAccessCode] = useState('');
  const [newStaffPassword, setNewStaffPassword] = useState('');
  const [isCreatingStaff, setIsCreatingStaff] = useState(false);

  // Add Customer Modal
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustEmail, setNewCustEmail] = useState('');
  const [newCustAddress, setNewCustAddress] = useState('');
  const [newCustNIN, setNewCustNIN] = useState('');
  const [newCustNextOfKin, setNewCustNextOfKin] = useState('');

  const loadData = () => {
    setRequests(ledgerEngine.getMoneyTransferRequests());
    setStaffList(ledgerEngine.getStaffUsers());
    setCustomers(ledgerEngine.getCustomers());
    setMetrics(ledgerEngine.getManagementSystemSummary());

    ledgerEngine
      .syncCustomersFromServer()
      .then((synced) => {
        setCustomers(synced);
        setMetrics(ledgerEngine.getManagementSystemSummary());
      })
      .catch(() => {});

    authService
      .getAccountsList()
      .then((accs) => {
        if (Array.isArray(accs) && accs.length > 0) {
          setStaffList((prev) => {
            const byEmail = new Map<string, StaffUser>();
            for (const s of prev) {
              if (s.email) byEmail.set(s.email.toLowerCase(), s);
            }
            for (const acc of accs) {
              if (acc.email && acc.role !== 'CUSTOMER') {
                const emailKey = acc.email.toLowerCase();
                const existing = byEmail.get(emailKey);
                byEmail.set(emailKey, {
                  ...(existing || {}),
                  id: acc.id || existing?.id || `STAFF_${Date.now()}`,
                  staffCode:
                    acc.staffCode ||
                    existing?.staffCode ||
                    (acc.role === 'ADMIN' ? `TMC-ADM-${(acc.id || '0001').slice(-4)}` : `TMC-STF-${(acc.id || '0001').slice(-4)}`),
                  fullName: acc.fullName || existing?.fullName || emailKey,
                  email: acc.email,
                  phone: acc.phone || existing?.phone || '',
                  role: (existing?.role || acc.role || 'STAFF') as any,
                  roleTitle: acc.roleTitle || acc.duty || existing?.roleTitle || 'Operational Staff',
                  operationalResponsibility:
                    acc.duty || acc.roleTitle || existing?.operationalResponsibility || 'Field operations & customer servicing',
                  permissions: (acc.permissions || existing?.permissions || {}) as any,
                  status: acc.status || existing?.status || 'active',
                  lastLogin: acc.lastLogin || existing?.lastLogin || new Date().toISOString(),
                  lastActivityAt: existing?.lastActivityAt || new Date().toISOString(),
                  createdAt: acc.createdAt || existing?.createdAt || new Date().toISOString(),
                  isLifetimeSuperAdmin: !!(acc.isLifetimeSuperAdmin || existing?.isLifetimeSuperAdmin),
                });
              }
            }
            return Array.from(byEmail.values());
          });
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    loadData();
    const unsub = ledgerEngine.subscribe(() => {
      setRequests(ledgerEngine.getMoneyTransferRequests());
      setStaffList(ledgerEngine.getStaffUsers());
      setCustomers(ledgerEngine.getCustomers());
      setMetrics(ledgerEngine.getManagementSystemSummary());
    });
    const interval = setInterval(loadData, 5000);
    return () => {
      unsub();
      clearInterval(interval);
    };
  }, []);

  const handleRegisterCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setActionError(null);
    try {
      if (!newCustName.trim() || !newCustPhone.trim()) {
        throw new Error('Customer full name and phone number are required.');
      }
      const existing = ledgerEngine.checkCustomerDuplicate(newCustPhone.trim(), newCustEmail.trim() || undefined);
      if (existing) {
        throw new Error(existing.reason || `Customer with phone ${newCustPhone} already exists (${existing.fullName})`);
      }
      const created = ledgerEngine.saveCustomer(
        {
          fullName: newCustName.trim(),
          phone: newCustPhone.trim(),
          email: newCustEmail.trim() || undefined,
          address: newCustAddress.trim() || 'Lagos, Nigeria',
          assignedStaffId: currentUser.id,
          assignedStaffName: currentUser.fullName,
          enrolledProgrammes: [],
          status: 'active',
          ninOrBvn: newCustNIN.trim(),
          nextOfKinName: newCustNextOfKin.trim(),
        },
        currentUser
      );
      setCustomers((prev) => [created, ...prev.filter((c) => c.id !== created.id)]);
      loadData();
      setActionSuccess(`Customer "${created.fullName}" (${created.customerCode}) registered successfully.`);
      setShowAddCustomerModal(false);
      setNewCustName('');
      setNewCustPhone('');
      setNewCustEmail('');
      setNewCustAddress('');
      setNewCustNIN('');
      setNewCustNextOfKin('');
    } catch (err: any) {
      setActionError(err.message || 'Failed to register customer.');
    }
  };

  // Check if current user is authorized as Admin or Super Admin
  const isAuthorized =
    currentUser &&
    (currentUser.role === 'ADMIN' ||
      (currentUser.role as string) === 'admin' ||
      currentUser.role === 'SUPER_ADMIN' ||
      currentUser.role === 'LIFETIME_SUPER_ADMIN' ||
      currentUser.isLifetimeSuperAdmin);



  // Approval decision
  const handleApprove = () => {
    if (!selectedRequest || !currentUser) return;
    setActionError(null);
    try {
      ledgerEngine.approveMoneyTransferRequest(selectedRequest.id, currentUser, approvalNotes);
      setActionSuccess(`Transaction ${selectedRequest.reference} approved successfully.`);
      setActionModal(null);
      setSelectedRequest(null);
      setApprovalNotes('');
      loadData();
    } catch (err: any) {
      setActionError(err.message || 'Failed to approve transaction.');
    }
  };

  // Rejection decision
  const handleReject = () => {
    if (!selectedRequest || !currentUser) return;
    if (!rejectReason.trim()) {
      setActionError('A detailed reason for rejection is mandatory.');
      return;
    }
    setActionError(null);
    try {
      ledgerEngine.rejectMoneyTransferRequest(selectedRequest.id, rejectReason.trim(), currentUser);
      setActionSuccess(`Transaction ${selectedRequest.reference} has been rejected.`);
      setActionModal(null);
      setSelectedRequest(null);
      setRejectReason('');
      loadData();
    } catch (err: any) {
      setActionError(err.message || 'Failed to reject transaction.');
    }
  };

  // Execution recording (Phase One manual evidence)
  const handleExecute = () => {
    if (!selectedRequest || !currentUser) return;
    if (!executionProof.trim()) {
      setActionError('Please provide the physical teller number, bank NIP session ID, or cash receipt reference.');
      return;
    }
    setActionError(null);
    try {
      ledgerEngine.executeMoneyTransferRequest(
        selectedRequest.id,
        {
          proofOrRef: executionProof.trim(),
          notes: executionNotes.trim() || 'Manual transfer evidence verified by Admin.',
        },
        currentUser
      );
      setActionSuccess(`Transaction ${selectedRequest.reference} marked as completed and executed.`);
      setActionModal(null);
      setSelectedRequest(null);
      setExecutionProof('');
      setExecutionNotes('');
      loadData();
    } catch (err: any) {
      setActionError(err.message || 'Failed to execute transaction.');
    }
  };

  // Create ordinary staff with authoritative backend provisioning
  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || isCreatingStaff) return;
    setActionError(null);

    const fullName = newStaffName.trim();
    const email = newStaffEmail.trim().toLowerCase();
    const phone = newStaffPhone.trim() || '+234 800 000 0000';
    const duty = newStaffResponsibility.trim() || 'Field operations & customer servicing';
    const accessCode = newStaffAccessCode.trim() || `TM-STF-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const password = newStaffPassword.trim() || accessCode;

    if (!fullName || !email) {
      setActionError('Full Name and Official Email Address are mandatory.');
      return;
    }

    setIsCreatingStaff(true);
    try {
      // 1. Authoritative backend provisioning with PBKDF2 hashing
      const authRes = await authService.createStaffAccount({
        fullName,
        email,
        phone,
        roleTitle: duty,
        operationalResponsibility: duty,
        accessCode,
        password,
      });

      if (!authRes.success) {
        setActionError(authRes.error || authRes.message || 'Failed to create staff account on authentication gateway.');
        setIsCreatingStaff(false);
        return;
      }

      // 2. Synchronize into client ledger engine
      try {
        ledgerEngine.createStaffUser(
          {
            fullName,
            email,
            phone,
            role: newStaffRole,
            operationalResponsibility: duty,
          },
          currentUser
        );
      } catch {
        // Ignored if already recorded
      }

      setActionSuccess(`Operational staff member "${fullName}" successfully created and activated.`);
      setShowAddStaffModal(false);
      setNewStaffName('');
      setNewStaffEmail('');
      setNewStaffPhone('');
      setNewStaffResponsibility('');
      setNewStaffAccessCode('');
      setNewStaffPassword('');
      loadData();
    } catch (err: any) {
      setActionError(err.message || 'Failed to create staff account.');
    } finally {
      setIsCreatingStaff(false);
    }
  };

  // Toggle staff status
  const handleToggleStaffStatus = (staff: StaffUser) => {
    if (!currentUser) return;
    if (staff.isLifetimeSuperAdmin || staff.role === 'LIFETIME_SUPER_ADMIN') {
      alert('The Permanent Lifetime Super Admin account cannot be modified or suspended.');
      return;
    }
    const newStatus = staff.status === 'active' ? 'suspended' : 'active';
    try {
      ledgerEngine.updateStaffUser(staff.id, { status: newStatus }, currentUser);
      setActionSuccess(`Staff member ${staff.fullName} marked as ${newStatus}.`);
      loadData();
    } catch (err: any) {
      setActionError(err.message || 'Failed to update staff status.');
    }
  };

  // Filter requests
  const filteredRequests = requests.filter((r) => {
    const matchesStatus = statusFilter === 'ALL' || r.status === statusFilter;
    const matchesType = typeFilter === 'ALL' || r.type === typeFilter;
    const matchesSearch =
      r.reference.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.submittedByStaffName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.programme.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesType && matchesSearch;
  });

  const pendingCount = requests.filter((r) => r.status === 'PENDING_APPROVAL').length;
  const approvedCount = requests.filter((r) => r.status === 'APPROVED').length;
  const completedCount = requests.filter((r) => r.status === 'COMPLETED').length;
  const rejectedCount = requests.filter((r) => r.status === 'REJECTED').length;

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-[#0B2A5B] text-slate-100 flex flex-col justify-center items-center p-6 font-sans">
        <div className="max-w-md w-full bg-white dark:bg-[#0B162C] border border-slate-200 dark:border-slate-800 p-8 text-center space-y-6 shadow-2xl relative overflow-hidden">
          <div className="h-1.5 bg-[#1E5BD8] absolute top-0 left-0 right-0" />
          <div className="w-14 h-14 bg-[#0B2A5B] text-white flex items-center justify-center mx-auto">
            <Lock size={26} />
          </div>
          <div>
            <div className="inline-block px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] bg-[#1E5BD8]/10 text-[#1E5BD8] border border-[#1E5BD8]/20 mb-2">
              PORTAL // 02 · AUTHORISED ADMIN ONLY
            </div>
            <h1 className="font-display text-xl font-extrabold text-[#0B2A5B] dark:text-white">
              Administrator Portal (`/admin`)
            </h1>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
              This workspace is restricted to authorised Admins and the Lifetime Super Admin for dual-control financial approvals and staff operations.
            </p>
          </div>

          <div className="pt-2 space-y-3">
            <button
              onClick={() => onNavigate('/staff/login')}
              className="w-full py-3.5 px-4 font-bold text-xs uppercase tracking-wider bg-[#1E5BD8] hover:bg-[#0B2A5B] text-white transition shadow cursor-pointer flex items-center justify-center gap-2"
            >
              <Lock size={14} />
              <span>Sign In via Authentication Gateway</span>
            </button>
            <button
              onClick={() => onNavigate('/home')}
              className="text-xs text-slate-500 hover:text-[#0B2A5B] dark:hover:text-white font-semibold"
            >
              ← Return to Public Website
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F7FB] dark:bg-[#060D1F] text-slate-800 dark:text-slate-100 flex flex-col font-sans">
      {/* =========================================================================
          ADMIN AJO.MONEY-STYLE FINTECH COMMAND HEADER
         ========================================================================= */}
      <header className="bg-[#0B2A5B] text-white border-b border-white/10 sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <BrandLogo variant="horizontal" theme="dark" size="sm" onClick={() => onNavigate('/home')} />
            <div className="hidden sm:block h-6 w-px bg-white/15" />
            <div className="hidden sm:flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#93C5FD]">
                  PORTAL 02 · ADMINISTRATOR CONSOLE
                </span>
                <span className="text-[10px] rounded-full bg-white/15 text-white px-2.5 py-0.5 font-mono font-bold">
                  /admin
                </span>
              </div>
              <span className="font-display text-xs font-extrabold tracking-tight text-white">
                Financial Approvals & Operational Oversight
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="hidden md:flex flex-col text-right pr-2 border-r border-white/15">
              <span className="text-xs font-bold text-white">{currentUser?.fullName}</span>
              <span className="text-[10px] text-[#93C5FD] uppercase tracking-wider font-semibold">
                {currentUser?.roleTitle || currentUser?.role}
              </span>
            </div>

            <ThemeSelector />

            <button
              onClick={() => onNavigate('/home')}
              className="px-4 py-1.5 rounded-full bg-white/10 hover:bg-white/15 border border-white/15 text-slate-200 hover:text-white text-xs font-bold transition cursor-pointer"
              title="View Public Website"
            >
              Public Site
            </button>

            {currentUser?.role === 'LIFETIME_SUPER_ADMIN' && (
              <button
                onClick={() => onNavigate('/supa-admin')}
                className="px-4 py-1.5 rounded-full bg-[#1E5BD8] hover:bg-[#2563EB] text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                title="Open Super Admin Portal"
              >
                <ShieldCheck size={14} />
                <span>Super Admin</span>
              </button>
            )}

            <button
              onClick={() => {
                if (onLogout) onLogout();
                else {
                  ledgerEngine.setCurrentUser(null);
                  setCurrentUser(null);
                }
              }}
              className="px-4 py-1.5 rounded-full bg-rose-600/90 hover:bg-rose-600 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              title="Sign Out"
            >
              <LogOut size={14} />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>

        {/* ROLE HIERARCHY SCOPE NOTICE BANNER */}
        <div className="bg-[#081F44] px-4 sm:px-6 lg:px-8 py-2 border-t border-white/10 text-[11px] text-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck size={14} className="text-[#93C5FD] shrink-0" />
            <span>
              <strong>Administrative Dual-Control Scope:</strong> Authorised to review and approve money-transfer transactions, supervise customer programmes, and create operational staff.
            </span>
          </div>
          <div className="text-[10px] text-[#93C5FD] font-bold uppercase tracking-wider">
            Strict Hierarchy: Admin appointments and root oversight are reserved exclusively for the Lifetime Super Admin.
          </div>
        </div>
      </header>

      {/* FEEDBACK BANNERS */}
      {actionSuccess && (
        <div className="bg-[#16A34A] text-white px-4 py-2.5 text-xs font-bold text-center flex items-center justify-center gap-2 shadow">
          <CheckCircle2 size={16} />
          <span>{actionSuccess}</span>
          <button onClick={() => setActionSuccess(null)} className="ml-4 underline cursor-pointer text-white/80 hover:text-white">
            Dismiss
          </button>
        </div>
      )}
      {actionError && (
        <div className="bg-rose-600 text-white px-4 py-2.5 text-xs font-bold text-center flex items-center justify-center gap-2 shadow">
          <AlertTriangle size={16} />
          <span>{actionError}</span>
          <button onClick={() => setActionError(null)} className="ml-4 underline cursor-pointer text-white/80 hover:text-white">
            Dismiss
          </button>
        </div>
      )}

      {/* =========================================================================
          MAIN BODY WITH AJO.MONEY-INSPIRED FINTECH CARDS & TABS
         ========================================================================= */}
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6 flex-1">
        {/* AJO.MONEY-STYLE HERO BANNER FOR ADMIN CONSOLE */}
        <div className="bg-white dark:bg-[#0B162C] rounded-3xl border border-slate-200/90 dark:border-slate-800 p-6 sm:p-7 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#1E5BD8]/10 text-[#1E5BD8] dark:text-blue-400 text-[10px] font-extrabold uppercase tracking-wider">
              <span>SUPERVISORY GOVERNANCE · 5 ACTIVE PROGRAMMES</span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[#0B2A5B] dark:text-white tracking-tight">
              Administrative{' '}
              <span className="relative inline-block text-[#1E5BD8] dark:text-[#60A5FA]">
                Approvals
                <svg
                  className="absolute -bottom-1.5 left-0 w-full h-2.5 text-[#2563EB]"
                  viewBox="0 0 210 16"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M3 12.5C52.5 3.5 142.5 -1.5 207 10.5"
                    stroke="currentColor"
                    strokeWidth="4.5"
                    strokeLinecap="round"
                  />
                </svg>
              </span>{' '}
              & Staff Console
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {[
              { name: 'Daily Ajo', color: '#16A34A' },
              { name: 'Fixed Target', color: '#2563EB' },
              { name: 'Everyhome Food', color: '#F97316' },
              { name: 'Leocash', color: '#7C3AED' },
              { name: 'Loans', color: '#0D9488' },
            ].map((p) => (
              <span
                key={p.name}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F4F7FB] dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-[11px] font-bold text-[#0B2A5B] dark:text-slate-200"
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                {p.name}
              </span>
            ))}
          </div>
        </div>

        {/* PILL TAB NAVIGATION STRIP */}
        <div className="bg-white dark:bg-[#0B162C] rounded-2xl border border-slate-200/90 dark:border-slate-800 p-2.5 flex flex-wrap items-center justify-between gap-3 shadow-xs">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setActiveTab('approvals')}
              className={`px-4 py-2.5 rounded-full text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                activeTab === 'approvals'
                  ? 'bg-[#0B2A5B] text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-[#F4F7FB] dark:hover:bg-slate-800'
              }`}
            >
              <DollarSign size={14} className={activeTab === 'approvals' ? 'text-[#93C5FD]' : 'text-[#2563EB]'} />
              <span>Money-Transfer Approvals</span>
              {pendingCount > 0 && (
                <span className="bg-[#F97316] text-white text-[10px] px-2 py-0.5 rounded-full font-mono font-bold">
                  {pendingCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('staff')}
              className={`px-4 py-2.5 rounded-full text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                activeTab === 'staff'
                  ? 'bg-[#0B2A5B] text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-[#F4F7FB] dark:hover:bg-slate-800'
              }`}
            >
              <Users size={14} className={activeTab === 'staff' ? 'text-[#93C5FD]' : 'text-[#2563EB]'} />
              <span>Staff Management</span>
            </button>

            <button
              onClick={() => setActiveTab('operations')}
              className={`px-4 py-2.5 rounded-full text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                activeTab === 'operations'
                  ? 'bg-[#0B2A5B] text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-[#F4F7FB] dark:hover:bg-slate-800'
              }`}
            >
              <Layers size={14} className={activeTab === 'operations' ? 'text-[#93C5FD]' : 'text-[#2563EB]'} />
              <span>Operational Metrics</span>
            </button>

            <button
              onClick={() => setActiveTab('customers')}
              className={`px-4 py-2.5 rounded-full text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                activeTab === 'customers'
                  ? 'bg-[#0B2A5B] text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-[#F4F7FB] dark:hover:bg-slate-800'
              }`}
            >
              <Briefcase size={14} className={activeTab === 'customers' ? 'text-[#93C5FD]' : 'text-[#2563EB]'} />
              <span>Customer Records</span>
              <span className="bg-[#2563EB] text-white text-[10px] px-2 py-0.5 rounded-full font-mono font-bold">
                {customers.length}
              </span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              className="px-4 py-2 rounded-full bg-[#F4F7FB] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[#0B2A5B] dark:text-slate-200 hover:border-[#2563EB] text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
              title="Refresh Data"
            >
              <RefreshCw size={13} />
              <span className="hidden sm:inline">Refresh Ledger</span>
            </button>
          </div>
        </div>

        {/* =====================================================================
            TAB 1: FINANCIAL TRANSFER APPROVALS
           ===================================================================== */}
        {activeTab === 'approvals' && (
          <div className="space-y-6">
            {/* AJO.MONEY-STYLE ROUNDED-2XL METRICS CARDS */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-[#0B162C] p-5 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs relative overflow-hidden">
                <div className="h-1.5 bg-[#F97316] absolute top-0 left-0 right-0" />
                <div className="flex items-center justify-between text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                  <span>01 · Pending Review</span>
                  <Clock size={15} className="text-[#F97316]" />
                </div>
                <div className="font-display text-3xl font-extrabold text-[#F97316] mt-2 tabular-nums">
                  {pendingCount}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">Requires dual-officer signoff</div>
              </div>

              <div className="bg-white dark:bg-[#0B162C] p-5 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs relative overflow-hidden">
                <div className="h-1.5 bg-[#2563EB] absolute top-0 left-0 right-0" />
                <div className="flex items-center justify-between text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                  <span>02 · Approved</span>
                  <CheckCircle2 size={15} className="text-[#2563EB]" />
                </div>
                <div className="font-display text-3xl font-extrabold text-[#2563EB] mt-2 tabular-nums">
                  {approvedCount}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">Ready for manual execution</div>
              </div>

              <div className="bg-white dark:bg-[#0B162C] p-5 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs relative overflow-hidden">
                <div className="h-1.5 bg-[#16A34A] absolute top-0 left-0 right-0" />
                <div className="flex items-center justify-between text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                  <span>03 · Executed / Disbursed</span>
                  <Check size={15} className="text-[#16A34A]" />
                </div>
                <div className="font-display text-3xl font-extrabold text-[#16A34A] mt-2 tabular-nums">
                  {completedCount}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">Physical / bank proof filed</div>
              </div>

              <div className="bg-white dark:bg-[#0B162C] p-5 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs relative overflow-hidden">
                <div className="h-1.5 bg-rose-600 absolute top-0 left-0 right-0" />
                <div className="flex items-center justify-between text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                  <span>04 · Rejected</span>
                  <X size={15} className="text-rose-600" />
                </div>
                <div className="font-display text-3xl font-extrabold text-rose-600 mt-2 tabular-nums">
                  {rejectedCount}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">Declined with recorded reason</div>
              </div>
            </div>

            {/* MANDATORY APPROVAL WORKFLOW POLICY CALLOUT */}
            <div className="bg-white dark:bg-[#0B162C] rounded-2xl border-l-4 border-[#1E5BD8] border-y border-r border-slate-200/90 dark:border-slate-800 p-5 text-xs space-y-1.5 shadow-xs">
              <div className="font-display font-bold text-[#0B2A5B] dark:text-white flex items-center gap-2 uppercase tracking-wider text-xs">
                <ShieldCheck size={16} className="text-[#1E5BD8]" />
                Mandatory Dual Financial Governance Policy
              </div>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                No money movement is treated as authorised or completed until reviewed and approved by an Admin or the Lifetime Super Admin.
                <strong> Self-approval is strictly prohibited:</strong> the officer who filed the transfer request cannot approve it.
                In Phase One, all approved transfers are executed via verified branch cash or manual NIP bank transfer with audit receipt attachment.
              </p>
            </div>

            {/* FILTERS & SEARCH */}
            <div className="bg-white dark:bg-[#0B162C] p-4 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3 flex-1">
                <div className="relative min-w-[240px] flex-1 max-w-md">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by reference, customer, or officer..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 dark:border-slate-700 bg-[#F4F7FB] dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:border-[#2563EB]"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Status:</span>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="text-xs border border-slate-200 dark:border-slate-700 bg-[#F4F7FB] dark:bg-slate-900 text-slate-900 dark:text-white px-2.5 py-2 focus:outline-none"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="PENDING_APPROVAL">Pending Approval</option>
                    <option value="APPROVED">Approved (Awaiting Execution)</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="REJECTED">Rejected</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Type:</span>
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="text-xs border border-slate-200 dark:border-slate-700 bg-[#F4F7FB] dark:bg-slate-900 text-slate-900 dark:text-white px-2.5 py-2 focus:outline-none"
                  >
                    <option value="ALL">All Programmes & Types</option>
                    <option value="LOAN_DISBURSEMENT">Loan Disbursement</option>
                    <option value="CUSTOMER_WITHDRAWAL">Customer Withdrawal</option>
                    <option value="SAVINGS_WITHDRAWAL">Savings Payout</option>
                    <option value="REFUND">Refund</option>
                    <option value="REVERSAL">Reversal</option>
                  </select>
                </div>
              </div>
            </div>

            {/* REQUESTS TABLE */}
            <div className="bg-white dark:bg-[#0B162C] border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#0B2A5B] text-white font-bold uppercase tracking-wider text-[11px]">
                      <th className="p-3.5">Reference</th>
                      <th className="p-3.5">Type & Programme</th>
                      <th className="p-3.5">Beneficiary</th>
                      <th className="p-3.5 text-right">Amount (NGN)</th>
                      <th className="p-3.5">Method</th>
                      <th className="p-3.5">Submitted By</th>
                      <th className="p-3.5">Status</th>
                      <th className="p-3.5 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                    {filteredRequests.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-8 text-center text-slate-400">
                          No financial transfer requests matching current filters.
                        </td>
                      </tr>
                    ) : (
                      filteredRequests.map((req) => {
                        const isSubmitter =
                          req.submittedByStaffId === currentUser?.id ||
                          req.submittedByStaffName.toLowerCase() === currentUser?.fullName.toLowerCase();

                        return (
                          <tr key={req.id} className="hover:bg-[#F4F7FB] dark:hover:bg-slate-900/40 transition-colors">
                            <td className="p-3.5 font-mono font-bold text-[#2563EB]">
                              {req.reference}
                            </td>
                            <td className="p-3.5">
                              <span className="font-bold text-[#0B2A5B] dark:text-white block">
                                {req.type.replace(/_/g, ' ')}
                              </span>
                              <span className="text-[10px] text-slate-500">{req.programmeLabel}</span>
                            </td>
                            <td className="p-3.5">
                              <span className="font-bold text-[#0B2A5B] dark:text-white block">
                                {req.customerName}
                              </span>
                              <span className="text-[10px] text-slate-500">{req.customerPhone || 'Counter'}</span>
                            </td>
                            <td className="p-3.5 text-right font-display font-extrabold text-[#0B2A5B] dark:text-white tabular-nums">
                              {formatNaira(req.amountKobo)}
                            </td>
                            <td className="p-3.5">
                              <span className="px-2 py-0.5 text-[10px] font-bold uppercase bg-[#F4F7FB] dark:bg-slate-800 text-[#0B2A5B] dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                                {req.paymentMethod.replace(/_/g, ' ')}
                              </span>
                            </td>
                            <td className="p-3.5">
                              <span className="font-medium block">{req.submittedByStaffName}</span>
                              <span className="text-[10px] text-slate-400">
                                {new Date(req.submittedAt).toLocaleDateString()}
                              </span>
                            </td>
                            <td className="p-3.5">
                              <span
                                className={`px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider inline-flex items-center gap-1 ${
                                  req.status === 'PENDING_APPROVAL'
                                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                                    : req.status === 'APPROVED'
                                    ? 'bg-[#2563EB]/10 text-[#2563EB]'
                                    : req.status === 'COMPLETED'
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                    : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                                }`}
                              >
                                {req.status === 'PENDING_APPROVAL' && <Clock size={10} />}
                                {req.status === 'APPROVED' && <Check size={10} />}
                                {req.status === 'COMPLETED' && <CheckCircle2 size={10} />}
                                {req.status === 'REJECTED' && <X size={10} />}
                                <span>{req.status.replace(/_/g, ' ')}</span>
                              </span>
                            </td>
                            <td className="p-3.5 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={() => {
                                    setSelectedRequest(req);
                                    setActionModal('inspect');
                                  }}
                                  className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-[#0B2A5B] dark:hover:text-white"
                                  title="Inspect Details"
                                >
                                  <Eye size={15} />
                                </button>

                                {req.status === 'PENDING_APPROVAL' && (
                                  <>
                                    <button
                                      disabled={isSubmitter}
                                      onClick={() => {
                                        setSelectedRequest(req);
                                        setActionModal('approve');
                                      }}
                                      className={`px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider transition ${
                                        isSubmitter
                                          ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                          : 'bg-[#16A34A] hover:bg-emerald-700 text-white shadow-xs'
                                      }`}
                                      title={isSubmitter ? 'Self-approval prohibited' : 'Approve Transfer'}
                                    >
                                      Approve
                                    </button>

                                    <button
                                      onClick={() => {
                                        setSelectedRequest(req);
                                        setActionModal('reject');
                                      }}
                                      className="px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition"
                                      title="Reject Transfer"
                                    >
                                      Reject
                                    </button>
                                  </>
                                )}

                                {req.status === 'APPROVED' && (
                                  <button
                                    onClick={() => {
                                      setSelectedRequest(req);
                                      setActionModal('execute');
                                    }}
                                    className="px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider bg-[#7C3AED] hover:bg-purple-700 text-white shadow-xs transition"
                                    title="Record Execution Evidence"
                                  >
                                    Execute
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* =====================================================================
            TAB 2: STAFF MANAGEMENT (ADMIN LEVEL)
           ===================================================================== */}
        {activeTab === 'staff' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-[#0B162C] p-6 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#2563EB] mb-1">
                  MODULE 02 // OPERATIONAL STAFF SUPERVISION
                </div>
                <h2 className="font-display text-xl font-extrabold text-[#0B2A5B] dark:text-white">
                  Operational Staff Roster & Supervisory Controls
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Authorised to create operational staff, assign collection duties, and manage active status.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowAddStaffModal(true)}
                  className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider bg-[#1E5BD8] hover:bg-[#0B2A5B] text-white flex items-center gap-2 shadow-sm transition-colors"
                >
                  <UserPlus size={15} />
                  <span>Add Operational Staff</span>
                </button>
              </div>
            </div>

            {/* RESTRICTION NOTICE */}
            <div className="bg-white dark:bg-[#0B162C] border-l-4 border-[#F97316] border-y border-r border-slate-200 dark:border-slate-800 p-4 text-xs flex items-start gap-2.5">
              <AlertCircle size={16} className="text-[#F97316] shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-[#0B2A5B] dark:text-white uppercase tracking-wider">Hierarchy Restriction:</span>{' '}
                <span className="text-slate-600 dark:text-slate-300">
                  Admins can create operational roles (Loan Officers, Collectors, Accountants, Customer Service), but <strong>cannot</strong> create or appoint other Admins or Super Admins. Only the Lifetime Super Admin can appoint Admins.
                </span>
              </div>
            </div>

            {/* STAFF TABLE */}
            <div className="bg-white dark:bg-[#0B162C] border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#0B2A5B] text-white font-bold uppercase tracking-wider text-[11px]">
                      <th className="p-3.5">Staff Code</th>
                      <th className="p-3.5">Full Name & Email</th>
                      <th className="p-3.5">Role</th>
                      <th className="p-3.5">Responsibility</th>
                      <th className="p-3.5">Status</th>
                      <th className="p-3.5">Created By</th>
                      <th className="p-3.5 text-center">Status Control</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                    {staffList.map((s) => (
                      <tr key={s.id} className="hover:bg-[#F4F7FB] dark:hover:bg-slate-900/40 transition-colors">
                        <td className="p-3.5 font-mono font-bold text-[#2563EB]">
                          {s.staffCode}
                        </td>
                        <td className="p-3.5">
                          <span className="font-bold text-[#0B2A5B] dark:text-white block">{s.fullName}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{s.email}</span>
                        </td>
                        <td className="p-3.5">
                          <span
                            className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                              s.role === 'LIFETIME_SUPER_ADMIN'
                                ? 'bg-[#7C3AED]/10 text-[#7C3AED]'
                                : s.role === 'ADMIN'
                                ? 'bg-[#2563EB]/10 text-[#2563EB]'
                                : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200'
                            }`}
                          >
                            {s.roleTitle || s.role.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="p-3.5 text-[11px] text-slate-600 dark:text-slate-300">
                          {s.operationalResponsibility || 'Operational module duties'}
                        </td>
                        <td className="p-3.5">
                          <span
                            className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                              s.status === 'active'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                            }`}
                          >
                            {s.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="p-3.5 text-[10px] text-slate-400">
                          {s.createdByName || 'Root System'}
                        </td>
                        <td className="p-3.5 text-center">
                          {s.isLifetimeSuperAdmin || s.role === 'LIFETIME_SUPER_ADMIN' ? (
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[#7C3AED]">
                              Permanent Owner
                            </span>
                          ) : s.role === 'ADMIN' ? (
                            <span className="text-[10px] text-slate-400 uppercase tracking-wider">Super Admin Managed</span>
                          ) : (
                            <button
                              onClick={() => handleToggleStaffStatus(s)}
                              className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition ${
                                s.status === 'active'
                                  ? 'bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-950/40'
                                  : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-950/40'
                              }`}
                            >
                              {s.status === 'active' ? 'Suspend' : 'Activate'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* =====================================================================
            TAB 3: OPERATIONAL METRICS
           ===================================================================== */}
        {activeTab === 'operations' && metrics && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-[#0B162C] p-5 border border-slate-200 dark:border-slate-800 shadow-xs relative overflow-hidden">
                <div className="h-1 bg-[#0B2A5B] absolute top-0 left-0 right-0" />
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Customers</span>
                <div className="font-display text-3xl font-extrabold text-[#0B2A5B] dark:text-white mt-2 tabular-nums">
                  {metrics.totalCustomers}
                </div>
                <div className="text-[11px] text-[#16A34A] font-semibold mt-1">{metrics.activeCustomers} active accounts</div>
              </div>

              <div className="bg-white dark:bg-[#0B162C] p-5 border border-slate-200 dark:border-slate-800 shadow-xs relative overflow-hidden">
                <div className="h-1 bg-[#2563EB] absolute top-0 left-0 right-0" />
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Fixed Target Saved</span>
                <div className="font-display text-2xl font-extrabold text-[#2563EB] mt-2 tabular-nums">
                  {formatNaira(metrics.totalFixedTargetSavedKobo || metrics.totalFixedTargetBalance * 100)}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">Automated savings lockbox</div>
              </div>

              <div className="bg-white dark:bg-[#0B162C] p-5 border border-slate-200 dark:border-slate-800 shadow-xs relative overflow-hidden">
                <div className="h-1 bg-[#16A34A] absolute top-0 left-0 right-0" />
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Daily Ajo Collections</span>
                <div className="font-display text-2xl font-extrabold text-[#16A34A] mt-2 tabular-nums">
                  {formatNaira(metrics.totalDailyAjoCollectedKobo || metrics.totalDailyAjoCollected * 100)}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">Rotational cycle contributions</div>
              </div>

              <div className="bg-white dark:bg-[#0B162C] p-5 border border-slate-200 dark:border-slate-800 shadow-xs relative overflow-hidden">
                <div className="h-1 bg-[#0D9488] absolute top-0 left-0 right-0" />
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Active Loan Portfolio</span>
                <div className="font-display text-2xl font-extrabold text-[#0D9488] mt-2 tabular-nums">
                  {formatNaira(metrics.totalOutstandingLoansKobo || metrics.totalOutstandingLoanBalance * 100)}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">Disbursed credit balances</div>
              </div>
            </div>

            {/* Programme Overview Card */}
            <div className="bg-white dark:bg-[#0B162C] p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
              <h3 className="font-display text-base font-extrabold text-[#0B2A5B] dark:text-white">
                Programme Health & Settlement Balances
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-[#F4F7FB] dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 relative overflow-hidden">
                  <div className="h-1 bg-[#F97316] absolute top-0 left-0 right-0" />
                  <div className="text-xs font-bold text-[#F97316] uppercase tracking-wider">Everyhome Food Contribution</div>
                  <div className="font-display text-xl font-extrabold text-[#0B2A5B] dark:text-white mt-1.5 tabular-nums">
                    {formatNaira(metrics.totalFoodContributedKobo || metrics.totalFoodContributionValue * 100)}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">Total staple contribution pool</div>
                </div>

                <div className="p-4 bg-[#F4F7FB] dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 relative overflow-hidden">
                  <div className="h-1 bg-[#7C3AED] absolute top-0 left-0 right-0" />
                  <div className="text-xs font-bold text-[#7C3AED] uppercase tracking-wider">Leocash Flexible Savings</div>
                  <div className="font-display text-xl font-extrabold text-[#0B2A5B] dark:text-white mt-1.5 tabular-nums">
                    {formatNaira(metrics.totalLeocashBalanceKobo || metrics.totalLeocashDeposits * 100)}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">On-demand withdrawable deposits</div>
                </div>

                <div className="p-4 bg-[#F4F7FB] dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 relative overflow-hidden">
                  <div className="h-1 bg-[#16A34A] absolute top-0 left-0 right-0" />
                  <div className="text-xs font-bold text-[#16A34A] uppercase tracking-wider">Today&apos;s Collections</div>
                  <div className="font-display text-xl font-extrabold text-[#0B2A5B] dark:text-white mt-1.5 tabular-nums">
                    {formatNaira(metrics.todayCollections * 100)}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">Reconciled field receipts</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =====================================================================
            TAB 4: CUSTOMER RECORDS
           ===================================================================== */}
        {activeTab === 'customers' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-[#0B162C] p-6 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#2563EB] mb-1">
                  MODULE 04 // CENTRAL CUSTOMER REGISTRY
                </div>
                <h2 className="font-display text-xl font-extrabold text-[#0B2A5B] dark:text-white">
                  Registered Customer Profiles
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  KYC verification, enrolled programmes, and transaction activity.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-[#2563EB] bg-[#2563EB]/10 px-3 py-1.5 uppercase tracking-wider tabular-nums">
                  {customers.length} Enrolled
                </span>
                <button
                  onClick={() => setShowAddCustomerModal(true)}
                  className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider bg-[#1E5BD8] hover:bg-[#0B2A5B] text-white flex items-center gap-2 shadow-sm cursor-pointer transition-colors"
                >
                  <UserPlus size={15} />
                  <span>Register New Customer</span>
                </button>
              </div>
            </div>

            <div className="bg-white dark:bg-[#0B162C] border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#0B2A5B] text-white font-bold uppercase tracking-wider text-[11px]">
                      <th className="p-3.5">Customer Code</th>
                      <th className="p-3.5">Full Name</th>
                      <th className="p-3.5">Phone & Email</th>
                      <th className="p-3.5">Address / State</th>
                      <th className="p-3.5">Programmes</th>
                      <th className="p-3.5">Registered</th>
                      <th className="p-3.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                    {customers.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-slate-400">
                          No customer profiles registered yet. Click &ldquo;Register New Customer&rdquo; to enrol a customer.
                        </td>
                      </tr>
                    ) : (
                      customers.map((c) => (
                        <tr key={c.id} className="hover:bg-[#F4F7FB] dark:hover:bg-slate-900/40 transition-colors">
                          <td className="p-3.5 font-mono font-bold text-[#2563EB]">
                            <div>{c.customerCode || c.id}</div>
                            <div className="text-[10px] text-slate-400 font-normal">{c.id}</div>
                          </td>
                          <td className="p-3.5 font-bold text-[#0B2A5B] dark:text-white">{c.fullName}</td>
                          <td className="p-3.5">
                            <span className="block font-medium">{c.phone}</span>
                            <span className="text-[10px] text-slate-400">{c.email || 'No email'}</span>
                          </td>
                          <td className="p-3.5 text-[11px] text-slate-500">
                            <span className="block truncate max-w-xs">{c.address || 'Lagos'}</span>
                            <span className="text-[10px] text-slate-400">{c.state || 'Lagos'}, {c.lga || 'Metropolitan'}</span>
                          </td>
                          <td className="p-3.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider bg-[#F4F7FB] dark:bg-slate-800 px-2 py-0.5 text-[#0B2A5B] dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                              {c.enrolledProgrammes && c.enrolledProgrammes.length > 0
                                ? c.enrolledProgrammes.join(', ')
                                : 'General Member'}
                            </span>
                          </td>
                          <td className="p-3.5 text-[11px] text-slate-500">
                            {c.registrationDate ? new Date(c.registrationDate).toLocaleDateString() : 'Today'}
                          </td>
                          <td className="p-3.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2 py-0.5">
                              {(c.status || 'active').toUpperCase()}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* =========================================================================
          MODALS
         ========================================================================= */}

      {/* 1. APPROVAL CONFIRMATION MODAL */}
      {actionModal === 'approve' && selectedRequest && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center">
                  <Check size={18} />
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Approve Financial Transfer</h3>
              </div>
              <button onClick={() => setActionModal(null)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">Reference:</span>
                <span className="font-mono font-bold text-blue-600">{selectedRequest.reference}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Beneficiary:</span>
                <span className="font-semibold text-slate-900 dark:text-white">{selectedRequest.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Amount:</span>
                <span className="font-black text-slate-900 dark:text-white">{formatNaira(selectedRequest.amountKobo)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Payment Method:</span>
                <span className="font-semibold">{selectedRequest.paymentMethod}</span>
              </div>
              {selectedRequest.destinationDetails?.bankName && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Destination:</span>
                  <span>{selectedRequest.destinationDetails.bankName} · {selectedRequest.destinationDetails.accountNumber}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-slate-200 dark:border-slate-700 pt-2">
                <span className="text-slate-500">Submitted By:</span>
                <span>{selectedRequest.submittedByStaffName} ({selectedRequest.submittedByStaffRole})</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Approval Review Notes (Optional)
              </label>
              <textarea
                rows={2}
                value={approvalNotes}
                onChange={(e) => setApprovalNotes(e.target.value)}
                placeholder="e.g. Identity verified, collateral lien confirmed, approved for disbursement."
                className="w-full text-xs p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setActionModal(null)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleApprove}
                className="px-5 py-2 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow transition"
              >
                Confirm Authorisation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. REJECTION MODAL */}
      {actionModal === 'reject' && selectedRequest && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-600 flex items-center justify-center">
                  <X size={18} />
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Reject Financial Transfer</h3>
              </div>
              <button onClick={() => setActionModal(null)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Please state the specific compliance, underwriting, or documentation defect that prevents authorising transfer <strong>{selectedRequest.reference}</strong>.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Mandatory Rejection Reason <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. Beneficiary account name does not match KYC passport; insufficient collateral pledge."
                className="w-full text-xs p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setActionModal(null)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                className="px-5 py-2 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow transition"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. EXECUTION CONFIRMATION MODAL */}
      {actionModal === 'execute' && selectedRequest && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-600 flex items-center justify-center">
                  <CheckCircle2 size={18} />
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Record Transfer Execution Evidence</h3>
              </div>
              <button onClick={() => setActionModal(null)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <div className="bg-purple-50 dark:bg-purple-950/30 p-3.5 rounded-xl text-xs space-y-1">
              <div className="font-bold text-purple-900 dark:text-purple-300">Phase One Execution Standard</div>
              <p className="text-slate-600 dark:text-slate-300">
                This transaction has been approved by management. Record the external bank NIP reference or branch cash payment voucher confirming that funds have been disbursed to the beneficiary.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Execution Reference / NIP Session ID / Cash Voucher <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={executionProof}
                onChange={(e) => setExecutionProof(e.target.value)}
                placeholder="e.g. NIP-DISB-ZENITH-20250325-01 or VCH-CSH-4410"
                className="w-full text-xs p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Execution Notes (Optional)
              </label>
              <textarea
                rows={2}
                value={executionNotes}
                onChange={(e) => setExecutionNotes(e.target.value)}
                placeholder="e.g. Paid in cash at Sabo Yaba branch counter; thumbprinted disbursement schedule filed."
                className="w-full text-xs p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setActionModal(null)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleExecute}
                className="px-5 py-2 rounded-lg text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white shadow transition"
              >
                Record As Completed
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. INSPECT TRANSACTION MODAL */}
      {actionModal === 'inspect' && selectedRequest && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Transaction Dossier: {selectedRequest.reference}
              </h3>
              <button onClick={() => setActionModal(null)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg">
                <div>
                  <span className="text-slate-400 block">Status:</span>
                  <span className="font-bold text-slate-900 dark:text-white">{selectedRequest.status}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Type:</span>
                  <span className="font-bold text-slate-900 dark:text-white">{selectedRequest.type}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Beneficiary:</span>
                  <span className="font-bold text-slate-900 dark:text-white">{selectedRequest.customerName}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Amount:</span>
                  <span className="font-bold text-blue-600">{formatNaira(selectedRequest.amountKobo)}</span>
                </div>
              </div>

              <div>
                <span className="text-slate-400 font-semibold block">Submission Notes:</span>
                <p className="p-2.5 rounded bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 mt-1">
                  {selectedRequest.submissionNotes || 'No notes provided at filing.'}
                </p>
              </div>

              {selectedRequest.reviewNotes && (
                <div>
                  <span className="text-slate-400 font-semibold block">Review Decision Notes:</span>
                  <p className="p-2.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 mt-1">
                    {selectedRequest.reviewNotes} (by {selectedRequest.reviewedByStaffName} on {new Date(selectedRequest.reviewedAt || '').toLocaleString()})
                  </p>
                </div>
              )}

              {selectedRequest.rejectionReason && (
                <div>
                  <span className="text-rose-500 font-semibold block">Rejection Reason:</span>
                  <p className="p-2.5 rounded bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 mt-1">
                    {selectedRequest.rejectionReason} (by {selectedRequest.reviewedByStaffName})
                  </p>
                </div>
              )}

              {selectedRequest.executionReference && (
                <div>
                  <span className="text-purple-600 font-semibold block">Execution Evidence:</span>
                  <p className="p-2.5 rounded bg-purple-50 dark:bg-purple-950/40 text-purple-800 dark:text-purple-300 mt-1 font-mono">
                    Ref: {selectedRequest.executionReference} · Executed by {selectedRequest.executedByStaffName}
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setActionModal(null)}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-slate-800 text-white hover:bg-slate-700"
              >
                Close Dossier
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. ADD OPERATIONAL STAFF MODAL */}
      {showAddStaffModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <UserPlus size={18} className="text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Register Operational Staff Member</h3>
              </div>
              <button onClick={() => setShowAddStaffModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateStaff} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newStaffName}
                  onChange={(e) => setNewStaffName(e.target.value)}
                  placeholder="e.g. Zainab Ibrahim"
                  className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Official Email Address <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={newStaffEmail}
                  onChange={(e) => setNewStaffEmail(e.target.value)}
                  placeholder="e.g. z.ibrahim@teamacro.ng"
                  className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={newStaffPhone}
                  onChange={(e) => setNewStaffPhone(e.target.value)}
                  placeholder="e.g. +234 803 000 1234"
                  className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Assigned Operational Role <span className="text-rose-500">*</span>
                </label>
                <select
                  value={newStaffRole}
                  onChange={(e) => setNewStaffRole(e.target.value as any)}
                  className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none"
                >
                  <option value="loan_officer">Loan Officer (Credit Appraisal & Guarantor Verification)</option>
                  <option value="field_collector">Field Collector (Daily Ajo Collections)</option>
                  <option value="customer_service">Customer Service (Account Opening & Support)</option>
                  <option value="accountant">Accountant (Treasury & Cashier Operations)</option>
                  <option value="operations_manager">Operations Manager (Programme Coordinator)</option>
                  <option value="auditor">Auditor (Internal Compliance Inspections)</option>
                </select>
                <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1">
                  Admin role creation is restricted. Only the Lifetime Super Admin can appoint Admins.
                </p>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Operational Responsibility / Station
                </label>
                <input
                  type="text"
                  value={newStaffResponsibility}
                  onChange={(e) => setNewStaffResponsibility(e.target.value)}
                  placeholder="e.g. Yaba Market Field Collections · Lagos Mainland Zone"
                  className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Access Authorization Code (Optional)
                </label>
                <input
                  type="text"
                  value={newStaffAccessCode}
                  onChange={(e) => setNewStaffAccessCode(e.target.value)}
                  placeholder="Auto-generated if left blank (e.g. TM-STF-8A9F1B)"
                  className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-xs focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Initial Password <span className="text-rose-500">*</span>
                </label>
                <input
                  type="password"
                  required
                  value={newStaffPassword}
                  onChange={(e) => setNewStaffPassword(e.target.value)}
                  placeholder="Set initial login password for staff member (min 6 characters)"
                  className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddStaffModal(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingStaff}
                  className="px-5 py-2 rounded-lg text-xs font-bold bg-[#091747] hover:bg-[#263F91] text-white shadow transition disabled:opacity-50"
                >
                  {isCreatingStaff ? 'Provisioning...' : 'Create Staff Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. REGISTER NEW CUSTOMER MODAL */}
      {showAddCustomerModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <UserPlus size={18} className="text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Register New Customer</h3>
              </div>
              <button onClick={() => setShowAddCustomerModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleRegisterCustomer} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Full Customer Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newCustName}
                  onChange={(e) => setNewCustName(e.target.value)}
                  placeholder="e.g. Alaba Johnson Chukwu"
                  className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Phone Number <span className="text-rose-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  value={newCustPhone}
                  onChange={(e) => setNewCustPhone(e.target.value)}
                  placeholder="e.g. +234 803 123 4567"
                  className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Email Address (Optional)
                </label>
                <input
                  type="email"
                  value={newCustEmail}
                  onChange={(e) => setNewCustEmail(e.target.value)}
                  placeholder="customer@example.com"
                  className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Residential / Business Address <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newCustAddress}
                  onChange={(e) => setNewCustAddress(e.target.value)}
                  placeholder="Plot 12, Idumota Market, Lagos Island"
                  className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    NIN / BVN (Optional)
                  </label>
                  <input
                    type="text"
                    value={newCustNIN}
                    onChange={(e) => setNewCustNIN(e.target.value)}
                    placeholder="22345678901"
                    className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Next of Kin
                  </label>
                  <input
                    type="text"
                    value={newCustNextOfKin}
                    onChange={(e) => setNewCustNextOfKin(e.target.value)}
                    placeholder="Ngozi Chukwu"
                    className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddCustomerModal(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg text-xs font-bold bg-[#091747] hover:bg-[#263F91] text-white shadow transition"
                >
                  Confirm & Save Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
