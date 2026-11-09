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
  Edit3,
  Trash2,
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
import {
  ADMIN_POSITIONS,
  STAFF_POSITIONS,
  ASSIGNABLE_PROGRAMMES,
  POSITION_METADATA,
  getDefaultPositionPermissions,
  getDedicatedRouteForUser,
  isReadOnlyAuditor,
} from '../../utils/roleRouting';
import { CentralCustomerDirectory } from '../../components/internal/CentralCustomerDirectory';
import { CustomerProfileModal } from '../../components/internal/CustomerProfileModal';
import { safeApiFetch } from '../../utils/apiClient';

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
  const [selectedCustomerProfile, setSelectedCustomerProfile] = useState<CustomerRecord | null>(null);
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
  const [newStaffPosition, setNewStaffPosition] = useState<string>('Customer Registration Officer');
  const [newStaffProgramme, setNewStaffProgramme] = useState<string>(ASSIGNABLE_PROGRAMMES[0]);
  const [newStaffStatus, setNewStaffStatus] = useState<'active' | 'suspended'>('active');
  const [newStaffPermissions, setNewStaffPermissions] = useState<Record<string, boolean>>(
    getDefaultPositionPermissions('Customer Registration Officer')
  );
  const [newStaffResponsibility, setNewStaffResponsibility] = useState('');
  const [newStaffAccessCode, setNewStaffAccessCode] = useState('');
  const [newStaffPassword, setNewStaffPassword] = useState('');
  const [isCreatingStaff, setIsCreatingStaff] = useState(false);

  // Edit & Delete Staff/Admin Modals
  const [editingStaffTarget, setEditingStaffTarget] = useState<StaffUser | null>(null);
  const [editStaffForm, setEditStaffForm] = useState<{
    fullName: string;
    email: string;
    phone: string;
    role: 'ADMIN' | 'STAFF';
    position: string;
    assignedProgramme: string;
    status: 'active' | 'suspended';
    password: string;
    accessCode: string;
  }>({
    fullName: '',
    email: '',
    phone: '',
    role: 'STAFF',
    position: 'Customer Registration Officer',
    assignedProgramme: ASSIGNABLE_PROGRAMMES[0],
    status: 'active',
    password: '',
    accessCode: '',
  });
  const [isSavingStaffEdit, setIsSavingStaffEdit] = useState(false);
  const [deletingStaffTarget, setDeletingStaffTarget] = useState<StaffUser | null>(null);
  const [isDeletingStaff, setIsDeletingStaff] = useState(false);

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
            for (const acc of accs) {
              if (acc.email && acc.role !== 'CUSTOMER') {
                const emailKey = acc.email.toLowerCase();
                const existing = prev.find((p) => p.email?.toLowerCase() === emailKey);
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
                  role: (acc.isLifetimeSuperAdmin ? 'LIFETIME_SUPER_ADMIN' : acc.role || existing?.role || 'STAFF') as any,
                  roleTitle: acc.position || acc.roleTitle || acc.duty || existing?.roleTitle || 'Operational Staff',
                  operationalResponsibility:
                    acc.position || acc.duty || acc.roleTitle || existing?.operationalResponsibility || 'Field operations & customer servicing',
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

  const handleRegisterCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setActionError(null);
    try {
      if (!newCustName.trim() || !newCustPhone.trim()) {
        throw new Error('Customer full name and phone number are required.');
      }
      const res = await safeApiFetch('/api/customers', {
        method: 'POST',
        body: JSON.stringify({
          customer: {
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
        }),
      });
      const created = res.customer || res.data?.customer;
      if (!res.success || res.savedToFirestore === false || !created) {
        throw new Error(
          res.message ||
            res.error ||
            'Failed to save customer record to Firestore database.'
        );
      }
      ledgerEngine.saveCustomer({ ...created, __fromServer: true }, currentUser);
      setCustomers((prev) => [created, ...prev.filter((c) => c.id !== created.id)]);
      loadData();
      setActionSuccess(
        `Customer successfully registered — "${created.fullName}" (${created.customerCode}) saved to Firestore.`
      );
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
    const duty = newStaffPosition || 'Customer Registration Officer';
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
        position: duty,
        roleTitle: duty,
        operationalResponsibility: newStaffResponsibility.trim() || duty,
        assignedProgramme: newStaffProgramme,
        status: newStaffStatus,
        permissions: newStaffPermissions,
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
            role: 'STAFF',
            roleTitle: duty,
            operationalResponsibility: newStaffResponsibility.trim() || duty,
          },
          currentUser
        );
      } catch {
        // Ignored if already recorded
      }

      const routeAssigned =
        POSITION_METADATA[duty as keyof typeof POSITION_METADATA]?.route || '/staff/customer-registration';
      setActionSuccess(
        `Operational staff member "${fullName}" (${duty}) created and bound to ${routeAssigned}.`
      );
      setShowAddStaffModal(false);
      setNewStaffName('');
      setNewStaffEmail('');
      setNewStaffPhone('');
      setNewStaffPosition('Customer Registration Officer');
      setNewStaffProgramme(ASSIGNABLE_PROGRAMMES[0]);
      setNewStaffStatus('active');
      setNewStaffPermissions(getDefaultPositionPermissions('Customer Registration Officer'));
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

  // Toggle staff/admin status
  const handleToggleStaffStatus = async (staff: StaffUser) => {
    if (!currentUser) return;
    if (staff.isLifetimeSuperAdmin || staff.role === 'LIFETIME_SUPER_ADMIN') {
      setActionError('The Permanent Lifetime Super Admin account cannot be modified or suspended.');
      return;
    }
    const newStatus = staff.status === 'active' ? 'suspended' : 'active';
    try {
      await authService.updateAccount(staff.id, { status: newStatus });
      try {
        ledgerEngine.updateStaffUser(staff.id, { status: newStatus }, currentUser);
      } catch {
        // Ignore if only in server store
      }
      setStaffList((prev) =>
        prev.map((s) => (s.id === staff.id || s.email === staff.email ? { ...s, status: newStatus } : s))
      );
      setActionSuccess(`Account ${staff.fullName} marked as ${newStatus}.`);
      loadData();
    } catch (err: any) {
      setActionError(err.message || 'Failed to update account status.');
    }
  };

  // Open Edit Staff/Admin Modal
  const handleOpenEditStaff = (staff: StaffUser) => {
    if (staff.isLifetimeSuperAdmin || staff.role === 'LIFETIME_SUPER_ADMIN') {
      setActionError('The Permanent Lifetime Super Admin account is protected.');
      return;
    }
    const roleTier: 'ADMIN' | 'STAFF' = staff.role === 'ADMIN' ? 'ADMIN' : 'STAFF';
    const currentPos =
      staff.roleTitle ||
      staff.operationalResponsibility ||
      (roleTier === 'ADMIN' ? 'Operations Manager' : 'Customer Registration Officer');
    setEditingStaffTarget(staff);
    setEditStaffForm({
      fullName: staff.fullName || '',
      email: staff.email || '',
      phone: staff.phone || '',
      role: roleTier,
      position: currentPos,
      assignedProgramme: ASSIGNABLE_PROGRAMMES[0],
      status: staff.status === 'suspended' ? 'suspended' : 'active',
      password: '',
      accessCode: '',
    });
  };

  // Submit Edit Staff/Admin Modal
  const handleSaveStaffEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaffTarget || !currentUser || isSavingStaffEdit) return;
    setActionError(null);
    setIsSavingStaffEdit(true);
    try {
      const route =
        POSITION_METADATA[editStaffForm.position as keyof typeof POSITION_METADATA]?.route ||
        (editStaffForm.role === 'ADMIN' ? '/admin/operationsmanager' : '/staff/customer-registration');
      const res = await authService.updateAccount(editingStaffTarget.id, {
        fullName: editStaffForm.fullName.trim(),
        email: editStaffForm.email.trim().toLowerCase(),
        phone: editStaffForm.phone.trim(),
        role: editStaffForm.role,
        position: editStaffForm.position,
        duty: editStaffForm.position,
        roleTitle: editStaffForm.position,
        operationalResponsibility: editStaffForm.position,
        dashboardRoute: route,
        assignedProgramme: editStaffForm.assignedProgramme,
        status: editStaffForm.status,
        permissions: getDefaultPositionPermissions(editStaffForm.position),
        ...(editStaffForm.password.trim() ? { password: editStaffForm.password.trim() } : {}),
        ...(editStaffForm.accessCode.trim() ? { accessCode: editStaffForm.accessCode.trim() } : {}),
      });
      if (!res.success) {
        setActionError(res.message || 'Failed to update account.');
        return;
      }
      setStaffList((prev) =>
        prev.map((s) =>
          s.id === editingStaffTarget.id || s.email.toLowerCase() === editingStaffTarget.email.toLowerCase()
            ? {
                ...s,
                fullName: editStaffForm.fullName.trim(),
                email: editStaffForm.email.trim().toLowerCase(),
                phone: editStaffForm.phone.trim(),
                role: editStaffForm.role as any,
                roleTitle: editStaffForm.position,
                operationalResponsibility: editStaffForm.position,
                status: editStaffForm.status,
              }
            : s
        )
      );
      setActionSuccess(`Account "${editStaffForm.fullName}" updated successfully.`);
      setEditingStaffTarget(null);
      loadData();
    } catch (err: any) {
      setActionError(err.message || 'Failed to update account.');
    } finally {
      setIsSavingStaffEdit(false);
    }
  };

  // Confirm Delete Staff/Admin Account
  const handleConfirmDeleteStaff = async () => {
    if (!deletingStaffTarget || !currentUser || isDeletingStaff) return;
    setActionError(null);
    setIsDeletingStaff(true);
    try {
      const res = await authService.deleteAccount(deletingStaffTarget.id, deletingStaffTarget.email);
      if (!res.success) {
        setActionError(res.message || 'Failed to delete account.');
        return;
      }
      setStaffList((prev) =>
        prev.filter(
          (s) =>
            s.id !== deletingStaffTarget.id &&
            s.email.toLowerCase() !== deletingStaffTarget.email.toLowerCase()
        )
      );
      setActionSuccess(
        `${deletingStaffTarget.role === 'ADMIN' ? 'Admin' : 'Staff'} account "${deletingStaffTarget.fullName}" (${deletingStaffTarget.email}) has been permanently deleted.`
      );
      setDeletingStaffTarget(null);
    } catch (err: any) {
      setActionError(err.message || 'Failed to delete account.');
    } finally {
      setIsDeletingStaff(false);
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
                              {(() => {
                                const matchedCust = customers.find(
                                  (c) =>
                                    c.id === req.customerId ||
                                    c.fullName.toLowerCase() === req.customerName.toLowerCase()
                                );
                                return matchedCust ? (
                                  <button
                                    type="button"
                                    onClick={() => setSelectedCustomerProfile(matchedCust)}
                                    className="font-bold text-[#2563EB] hover:underline text-left block cursor-pointer"
                                  >
                                    {req.customerName}
                                  </button>
                                ) : (
                                  <span className="font-bold text-[#0B2A5B] dark:text-white block">
                                    {req.customerName}
                                  </span>
                                );
                              })()}
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
                              Permanent Owner (Protected)
                            </span>
                          ) : (
                            <div className="flex items-center justify-center gap-1.5 flex-wrap">
                              <button
                                onClick={() => handleOpenEditStaff(s)}
                                className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/50 dark:text-blue-300 transition inline-flex items-center gap-1 cursor-pointer"
                                title="Edit Account Details & Position"
                              >
                                <Edit3 size={11} />
                                <span>Edit</span>
                              </button>
                              <button
                                onClick={() => handleToggleStaffStatus(s)}
                                className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition cursor-pointer ${
                                  s.status === 'active'
                                    ? 'bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300'
                                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300'
                                }`}
                              >
                                {s.status === 'active' ? 'Suspend' : 'Activate'}
                              </button>
                              {s.id !== currentUser?.id &&
                                s.email?.toLowerCase() !== currentUser?.email?.toLowerCase() && (
                                  <button
                                    onClick={() => setDeletingStaffTarget(s)}
                                    className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-rose-600 text-white hover:bg-rose-700 transition inline-flex items-center gap-1 cursor-pointer"
                                    title="Permanently Delete Account"
                                  >
                                    <Trash2 size={11} />
                                    <span>Delete</span>
                                  </button>
                                )}
                            </div>
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
            TAB 4: CENTRAL CUSTOMER DIRECTORY
           ===================================================================== */}
        {activeTab === 'customers' && (
          <CentralCustomerDirectory
            title="Central Customer Directory — Administrative Oversight"
            subtitle="Permanent, shared Firestore customer registry with clickable customer profiles, separate Next of Kin & Guarantor sections, original registering staff attribution, and complete activity history."
            canCreateCustomer={!isReadOnlyAuditor(currentUser)}
            canEditCustomer={!isReadOnlyAuditor(currentUser)}
            canRecordActivity={!isReadOnlyAuditor(currentUser)}
            onCustomersChanged={(updated) => setCustomers(updated)}
          />
        )}
      </div>

      {selectedCustomerProfile && (
        <CustomerProfileModal
          customer={selectedCustomerProfile}
          onClose={() => setSelectedCustomerProfile(null)}
          canEdit={!isReadOnlyAuditor(currentUser)}
          canRecordActivity={!isReadOnlyAuditor(currentUser)}
          onCustomerUpdated={(updated) => {
            setSelectedCustomerProfile(updated);
            loadData();
          }}
        />
      )}

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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Staff Position <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={newStaffPosition}
                    onChange={(e) => {
                      const pos = e.target.value;
                      setNewStaffPosition(pos);
                      setNewStaffPermissions(getDefaultPositionPermissions(pos));
                    }}
                    className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none"
                  >
                    {STAFF_POSITIONS.map((pos) => (
                      <option key={pos} value={pos}>
                        {pos} ({POSITION_METADATA[pos].route})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Assigned Programme / Department <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={newStaffProgramme}
                    onChange={(e) => setNewStaffProgramme(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none"
                  >
                    {ASSIGNABLE_PROGRAMMES.map((prog) => (
                      <option key={prog} value={prog}>
                        {prog}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Account Status <span className="text-rose-500">*</span>
                </label>
                <select
                  value={newStaffStatus}
                  onChange={(e) => setNewStaffStatus(e.target.value as 'active' | 'suspended')}
                  className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none"
                >
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-1.5">
                <div className="font-semibold text-slate-700 dark:text-slate-300 text-[11px]">
                  Assigned Staff Permissions
                </div>
                <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                  {[
                    { key: 'canViewDashboard', label: 'View Workspace' },
                    { key: 'canRegisterCustomer', label: 'Register Customers' },
                    { key: 'canEditCustomer', label: 'Update Customer Info' },
                    { key: 'canCollectPayments', label: 'Record Collections' },
                    { key: 'canManageSavings', label: 'Manage Savings' },
                    { key: 'canViewReports', label: 'View / Prepare Reports' },
                  ].map((p) => (
                    <label key={p.key} className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                      <input
                        type="checkbox"
                        checked={!!newStaffPermissions[p.key]}
                        onChange={(e) =>
                          setNewStaffPermissions({
                            ...newStaffPermissions,
                            [p.key]: e.target.checked,
                          })
                        }
                      />
                      <span>{p.label}</span>
                    </label>
                  ))}
                </div>
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

      {/* 7. EDIT ADMIN / STAFF ACCOUNT MODAL */}
      {editingStaffTarget && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Edit3 size={18} className="text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Edit Account: {editingStaffTarget.fullName}
                </h3>
              </div>
              <button onClick={() => setEditingStaffTarget(null)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveStaffEdit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={editStaffForm.fullName}
                  onChange={(e) => setEditStaffForm({ ...editStaffForm, fullName: e.target.value })}
                  className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Official Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={editStaffForm.email}
                    onChange={(e) => setEditStaffForm({ ...editStaffForm, email: e.target.value })}
                    className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={editStaffForm.phone}
                    onChange={(e) => setEditStaffForm({ ...editStaffForm, phone: e.target.value })}
                    className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Position *
                  </label>
                  <select
                    value={editStaffForm.position}
                    onChange={(e) => setEditStaffForm({ ...editStaffForm, position: e.target.value })}
                    className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    {(editStaffForm.role === 'ADMIN' ? ADMIN_POSITIONS : STAFF_POSITIONS).map((pos) => (
                      <option key={pos} value={pos}>
                        {pos}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Account Status *
                  </label>
                  <select
                    value={editStaffForm.status}
                    onChange={(e) =>
                      setEditStaffForm({
                        ...editStaffForm,
                        status: e.target.value as 'active' | 'suspended',
                      })
                    }
                    className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Reset Password (Optional)
                  </label>
                  <input
                    type="text"
                    value={editStaffForm.password}
                    onChange={(e) => setEditStaffForm({ ...editStaffForm, password: e.target.value })}
                    placeholder="Leave blank to keep current"
                    className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Reset Access Code (Optional)
                  </label>
                  <input
                    type="text"
                    value={editStaffForm.accessCode}
                    onChange={(e) => setEditStaffForm({ ...editStaffForm, accessCode: e.target.value })}
                    placeholder="Leave blank to keep current"
                    className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingStaffTarget(null)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingStaffEdit}
                  className="px-5 py-2 rounded-lg text-xs font-bold bg-[#1E5BD8] hover:bg-[#0B2A5B] text-white shadow transition disabled:opacity-50"
                >
                  {isSavingStaffEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 8. DELETE ADMIN / STAFF CONFIRMATION MODAL */}
      {deletingStaffTarget && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2 text-rose-600">
                <Trash2 size={18} />
                <h3 className="text-sm font-bold">
                  Delete {deletingStaffTarget.role === 'ADMIN' ? 'Admin' : 'Staff'} Account
                </h3>
              </div>
              <button onClick={() => setDeletingStaffTarget(null)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-xs space-y-1.5">
              <div className="font-bold text-rose-900 dark:text-rose-200">
                {deletingStaffTarget.fullName} ({deletingStaffTarget.email})
              </div>
              <div className="text-rose-700 dark:text-rose-300">
                Role: {deletingStaffTarget.roleTitle || deletingStaffTarget.role} · Code: {deletingStaffTarget.staffCode}
              </div>
              <p className="text-slate-600 dark:text-slate-300 pt-1">
                This will permanently remove this account from TEAMACRO Authentication, Cloud Firestore, and revoke all active sessions.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingStaffTarget(null)}
                disabled={isDeletingStaff}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteStaff}
                disabled={isDeletingStaff}
                className="px-5 py-2 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow transition disabled:opacity-50 flex items-center gap-1.5"
              >
                <Trash2 size={13} />
                <span>{isDeletingStaff ? 'Deleting...' : 'Permanently Delete'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
