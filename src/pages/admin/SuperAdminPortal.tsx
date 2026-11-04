import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Search,
  Sliders,
  Layers,
  ArrowRightLeft,
  X,
  FileText,
  DollarSign,
  Users,
  Eye,
  EyeOff,
  Lock,
  UserPlus,
  ShieldAlert,
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
  Briefcase,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  Check,
  Plus,
  LogOut,
  Key,
  Copy,
  SlidersHorizontal,
  BadgeCheck,
} from 'lucide-react';
import {
  AuditEvent,
  AuditLogEntry,
  BankConfig,
  CustomerAccount,
  CustomerRecord,
  FraudAlert,
  JournalEntry,
  Transaction,
  User,
  MoneyTransferRequest,
  MoneyTransferType,
  MoneyTransferStatus,
  StaffUser,
  RestrictedOversightLog,
} from '../../types/banking';
import { ledgerEngine, SYSTEM_ACCOUNT_VAULT_RESERVE, SYSTEM_ACCOUNT_FEE_INCOME, getDefaultPermissionsForRole } from '../../services/ledgerEngine';
import { authService } from '../../services/authService';
import { formatNaira, formatLagosDate } from '../../utils/formatters';
import { BrandLogo } from '../../components/common/BrandLogo';
import { ThemeSelector } from '../../components/common/ThemeSelector';

interface SuperAdminPortalProps {
  config: BankConfig;
  onUpdateConfig: (newConfig: BankConfig) => void;
  onNavigate: (route: string) => void;
  onLogout?: () => void;
}

export const SuperAdminPortal: React.FC<SuperAdminPortalProps> = ({
  config,
  onUpdateConfig,
  onNavigate,
  onLogout,
}) => {
  type TabType =
    | 'overview'
    | 'approvals'
    | 'staff_admin_mgmt'
    | 'discreet_monitoring'
    | 'oversight_logs'
    | 'transactions'
    | 'ledger_reconciliation'
    | 'fraud_risk'
    | 'audit_trail'
    | 'cms_settings';

  const [activeTab, setActiveTab] = useState<TabType>('overview');

  // Authoritative Lifetime Super Admin Session
  const sessionUser = ledgerEngine.getCurrentUser();
  const lifetimeSuperAdmin = ledgerEngine.getLifetimeSuperAdmin();
  const currentActor: User = sessionUser || {
    id: lifetimeSuperAdmin?.id || 'ROOT_SUPER_ADMIN',
    email: lifetimeSuperAdmin?.email || '',
    fullName: lifetimeSuperAdmin?.fullName || 'Lifetime Super Admin',
    phone: lifetimeSuperAdmin?.phone || '',
    role: 'LIFETIME_SUPER_ADMIN',
    active: true,
    twoFactorEnabled: true,
    createdAt: new Date().toISOString(),
    isLifetimeSuperAdmin: true,
  };

  // Authoritative State
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<CustomerAccount[]>([]);
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [showRegisterCustomerModal, setShowRegisterCustomerModal] = useState(false);
  const [newCustomerForm, setNewCustomerForm] = useState({
    fullName: '',
    phone: '',
    email: '',
    address: '',
    ninOrBvn: '',
    nextOfKinName: '',
    nextOfKinPhone: '',
  });
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [audits, setAudits] = useState<AuditEvent[]>([]);
  const [alerts, setAlerts] = useState<FraudAlert[]>([]);
  const [reconciliation, setReconciliation] = useState<any>(null);

  // Master State: Approvals, Staff/Admin Management, Discreet Oversight
  const [transfers, setTransfers] = useState<MoneyTransferRequest[]>([]);
  const [staffDirectory, setStaffDirectory] = useState<StaffUser[]>([]);
  const [oversightLogs, setOversightLogs] = useState<RestrictedOversightLog[]>([]);

  // Live Auto-Refresh State
  const [liveMonitoring, setLiveMonitoring] = useState(true);

  // Transaction Filters
  const [txSearch, setTxSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');

  // Deep Transaction Inspection Modal
  const [inspectTx, setInspectTx] = useState<Transaction | null>(null);
  const [linkedJournal, setLinkedJournal] = useState<JournalEntry | null>(null);

  // Reversal Action State
  const [reversalReason, setReversalReason] = useState('');
  const [reversalMsg, setReversalMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // CMS Brand Settings Form
  const [bankNameInput, setBankNameInput] = useState(config.bankName);
  const [sloganInput, setSloganInput] = useState(config.slogan);
  const [hotlineInput, setHotlineInput] = useState(config.hotline);
  const [headOfficeInput, setHeadOfficeInput] = useState(config.headOffice);
  const [savingsRateInput, setSavingsRateInput] = useState(config.rates.savingsAnnualRatePercent);
  const [smeRateInput, setSmeRateInput] = useState(config.rates.smeLoanMonthlyRatePercent);
  const [cmsSaved, setCmsSaved] = useState(false);

  // Money Transfer Approval States
  const [transferFilter, setTransferFilter] = useState<'ALL' | MoneyTransferStatus>('ALL');
  const [transferTypeFilter, setTransferTypeFilter] = useState<'ALL' | MoneyTransferType>('ALL');
  const [transferSearch, setTransferSearch] = useState('');
  const [selectedTransfer, setSelectedTransfer] = useState<MoneyTransferRequest | null>(null);
  const [approvalModal, setApprovalModal] = useState<'approve' | 'reject' | 'execute' | null>(null);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [executionProof, setExecutionProof] = useState('');
  const [executionNotes, setExecutionNotes] = useState('');
  const [approvalSuccess, setApprovalSuccess] = useState<string | null>(null);
  const [approvalError, setApprovalError] = useState<string | null>(null);

  // Staff & Admin Management Form States
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [newAdminForm, setNewAdminForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    operationalResponsibility: '',
    accessCode: '',
    confirmAccessCode: '',
    assignedModules: ['daily_ajo', 'fixed_target', 'everyhome_food', 'leocash', 'loans'],
  });
  const [showAdminCode, setShowAdminCode] = useState(false);
  const [showAdminConfirmCode, setShowAdminConfirmCode] = useState(false);
  const [adminModalLoading, setAdminModalLoading] = useState(false);
  const [adminModalError, setAdminModalError] = useState<string | null>(null);
  const [adminAppointedSuccess, setAdminAppointedSuccess] = useState<any | null>(null);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [generatingAdminCode, setGeneratingAdminCode] = useState(false);
  const [newStaffForm, setNewStaffForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    roleTitle: 'Customer Registration Officer',
    accessCode: '',
    password: '',
    assignedModules: ['daily_ajo', 'payments'],
  });
  const [showStaffCode, setShowStaffCode] = useState(false);
  const [staffModalLoading, setStaffModalLoading] = useState(false);
  const [staffModalError, setStaffModalError] = useState<string | null>(null);
  const [generatingStaffCode, setGeneratingStaffCode] = useState(false);
  const [staffActionMsg, setStaffActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Established Duties with their canonical role category and functional capabilities
  const ESTABLISHED_DUTIES = [
    {
      title: 'Customer Registration Officer',
      type: 'Staff' as const,
      role: 'CUSTOMER_REGISTRATION_OFFICER',
      description: 'Customer onboarding, identity collection, BVN/NIN recording, and biometric KYC enrollment.',
    },
    {
      title: 'Payment Collection Officer',
      type: 'Staff' as const,
      role: 'PAYMENT_COLLECTION_OFFICER',
      description: 'Field cash collection, daily ajo savings deposits, and instant ledger credit receipts.',
    },
    {
      title: 'Loan Officer',
      type: 'Staff' as const,
      role: 'LOAN_OFFICER',
      description: 'Credit assessment, micro-loan underwriting, guarantor verification, and repayment tracking.',
    },
    {
      title: 'Accounts Officer',
      type: 'Staff' as const,
      role: 'ACCOUNTS_OFFICER',
      description: 'General ledger reconciliation, double-entry journal balance auditing, and liquidity tracking.',
    },
    {
      title: 'Operations Manager',
      type: 'Staff' as const,
      role: 'OPERATIONS_MANAGER',
      description: 'Field officer supervisory coordination, daily branch closing, and operational audits.',
    },
    {
      title: 'Auditor / Read-Only User',
      type: 'Staff' as const,
      role: 'AUDITOR',
      description: 'Comprehensive read-only regulatory inspection, security log auditing, and compliance reporting.',
    },
    {
      title: 'Admin / General Branch Administrator',
      type: 'Admin' as const,
      role: 'ADMIN',
      description: 'Branch-level operational supervisory administration and staff management clearance.',
    },
    {
      title: 'Admin / Operations & Compliance Supervisor',
      type: 'Admin' as const,
      role: 'ADMIN',
      description: 'High-clearance supervisory dual-control transfer approvals and staff oversight.',
    },
  ];

  // Access & Duty Assignment States
  const [backendInvitations, setBackendInvitations] = useState<any[]>([]);
  const [serverAccounts, setServerAccounts] = useState<any[]>([]);



  // Granular Permissions Modal State
  const [showPermissionsModal, setShowPermissionsModal] = useState<boolean>(false);
  const [selectedUserForPerms, setSelectedUserForPerms] = useState<any | null>(null);
  const [editingPermissions, setEditingPermissions] = useState<Record<string, boolean>>({});
  const [permLoading, setPermLoading] = useState<boolean>(false);
  const [permMsg, setPermMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Discreet Monitoring State
  const [monitoredStaffSearch, setMonitoredStaffSearch] = useState('');
  const [inspectedStaff, setInspectedStaff] = useState<StaffUser | null>(null);
  const [inspectedStaffLogs, setInspectedStaffLogs] = useState<AuditLogEntry[]>([]);

  const loadData = () => {
    setTransactions(ledgerEngine.getTransactions());
    setAccounts(ledgerEngine.getAccounts());
    setCustomers(ledgerEngine.getCustomers());
    setJournalEntries(ledgerEngine.getJournalEntries());
    setAudits(ledgerEngine.getAuditEvents());
    setAlerts(ledgerEngine.getFraudAlerts());
    setReconciliation(ledgerEngine.performGeneralLedgerReconciliation());
    setTransfers(ledgerEngine.getMoneyTransferRequests());
    const localStaff = ledgerEngine.getStaffAndAdminDirectory();
    setStaffDirectory(localStaff);
    setOversightLogs(ledgerEngine.getRestrictedOversightLogs());

    // Sync authoritative customer records from backend & Firestore
    ledgerEngine.syncCustomersFromServer().then((synced) => {
      setCustomers(synced);
      setAccounts(ledgerEngine.getAccounts());
    }).catch(() => {});

    // Sync authoritative invitations and server accounts
    authService.getAccessInvitations().then((invs) => setBackendInvitations(invs || [])).catch(() => {});
    authService.getAccountsList().then((accs) => {
      setServerAccounts(accs || []);
      if (Array.isArray(accs) && accs.length > 0) {
        setStaffDirectory((prev) => {
          const existingIds = new Set(prev.map((s) => s.id));
          const existingEmails = new Set(prev.map((s) => s.email.toLowerCase()));
          const extra: StaffUser[] = [];
          for (const acc of accs) {
            if (!existingIds.has(acc.id) && !existingEmails.has(acc.email.toLowerCase()) && acc.role !== 'CUSTOMER') {
              extra.push({
                id: acc.id,
                staffCode:
                  acc.staffCode ||
                  (acc.role === 'ADMIN' || acc.id.startsWith('STAFF_ADM_')
                    ? `TMC-ADM-${acc.id.slice(-4).toUpperCase()}`
                    : `TMC-STF-${acc.id.slice(-4).toUpperCase()}`),
                fullName: acc.fullName,
                email: acc.email,
                phone: acc.phone || '',
                role: acc.role as any,
                roleTitle: acc.roleTitle || acc.duty || (acc.role === 'ADMIN' ? 'Branch Administrator' : 'Operational Staff'),
                permissions: (acc.permissions as any) || getDefaultPermissionsForRole(acc.role === 'ADMIN' ? 'ADMIN' : 'customer_service'),
                status: acc.status || 'active',
                lastLogin: acc.lastLogin || new Date().toISOString(),
                lastActivityAt: new Date().toISOString(),
                createdAt: acc.createdAt || new Date().toISOString(),
                isLifetimeSuperAdmin: !!acc.isLifetimeSuperAdmin,
              });
            }
          }
          return extra.length > 0 ? [...prev, ...extra] : prev;
        });
      }
    }).catch(() => {});
  };

  const handleRegisterCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomerForm.fullName.trim() || !newCustomerForm.phone.trim()) {
      setApprovalError('Customer Full Name and Phone Number are required.');
      return;
    }
    try {
      const created = ledgerEngine.saveCustomer({
        fullName: newCustomerForm.fullName.trim(),
        phone: newCustomerForm.phone.trim(),
        email: newCustomerForm.email.trim(),
        address: newCustomerForm.address.trim(),
        ninOrBvn: newCustomerForm.ninOrBvn.trim(),
        nextOfKinName: newCustomerForm.nextOfKinName.trim(),
        nextOfKinPhone: newCustomerForm.nextOfKinPhone.trim(),
        status: 'ACTIVE',
      });
      setCustomers((prev) => [created, ...prev.filter((c) => c.id !== created.id)]);
      setAccounts(ledgerEngine.getAccounts());
      setShowRegisterCustomerModal(false);
      setNewCustomerForm({
        fullName: '',
        phone: '',
        email: '',
        address: '',
        ninOrBvn: '',
        nextOfKinName: '',
        nextOfKinPhone: '',
      });
      setApprovalSuccess(`Customer ${created.fullName} (${created.customerCode || created.id}) registered and synchronized.`);
      loadData();
    } catch (err: any) {
      setApprovalError(err.message || 'Failed to register customer.');
    }
  };



  // Generate unique access code for Admin Appointment Modal
  const handleGenerateAdminCode = async () => {
    setGeneratingAdminCode(true);
    setAdminModalError(null);
    try {
      const res = await authService.generateAccessCode({
        accessType: 'Admin',
        email: newAdminForm.email.trim() || undefined,
        duty: newAdminForm.operationalResponsibility.trim() || 'Admin / General Branch Administrator',
      });
      const code = res.code || `TM-ADM-${Math.floor(100000 + Math.random() * 900000)}`;
      setNewAdminForm((prev) => ({
        ...prev,
        accessCode: code,
        confirmAccessCode: code,
      }));
    } catch {
      const code = `TM-ADM-${Math.floor(100000 + Math.random() * 900000)}`;
      setNewAdminForm((prev) => ({
        ...prev,
        accessCode: code,
        confirmAccessCode: code,
      }));
    } finally {
      setGeneratingAdminCode(false);
    }
  };

  // Generate unique access code for Staff Creation Modal
  const handleGenerateStaffCode = async () => {
    setGeneratingStaffCode(true);
    setStaffModalError(null);
    try {
      const res = await authService.generateAccessCode({
        accessType: 'Staff',
        email: newStaffForm.email.trim() || undefined,
        duty: newStaffForm.roleTitle.trim() || 'Customer Registration Officer',
      });
      const code = res.code || `TM-STF-${Math.floor(100000 + Math.random() * 900000)}`;
      setNewStaffForm((prev) => ({ ...prev, accessCode: code }));
    } catch {
      const code = `TM-STF-${Math.floor(100000 + Math.random() * 900000)}`;
      setNewStaffForm((prev) => ({ ...prev, accessCode: code }));
    } finally {
      setGeneratingStaffCode(false);
    }
  };


  // Revoke an issued authorization invitation
  const handleRevokeInvitation = async (invitationId: string, email: string) => {
    if (!window.confirm(`Are you certain you wish to revoke the access code for ${email}? It will immediately become unusable.`)) {
      return;
    }
    try {
      const res = await authService.revokeAccessCode(invitationId);
      if (!res.success) {
        alert(res.error || 'Failed to revoke access code.');
      } else {
        alert(`Access authorization for ${email} has been permanently revoked.`);
        loadData();
      }
    } catch (err: any) {
      alert(err.message || 'Network error revoking access code.');
    }
  };

  // Open Permissions Configuration
  const handleOpenPermissionsModal = (target: any) => {
    setSelectedUserForPerms(target);
    setPermMsg(null);
    setEditingPermissions(target.permissions || {
      manage_customers: true,
      collect_payments: true,
      manage_loans: false,
      ledger_posting: false,
      approve_transfers: false,
      audit_inspection: false,
      cms_rates: false,
    });
    setShowPermissionsModal(true);
  };

  // Save Granular Permissions
  const handleSavePermissions = async () => {
    if (!selectedUserForPerms) return;
    setPermLoading(true);
    setPermMsg(null);
    try {
      const res = await authService.updatePermissions(selectedUserForPerms.id, editingPermissions);
      if (!res.success) {
        setPermMsg({ type: 'error', text: res.error || 'Failed to update permissions.' });
      } else {
        setPermMsg({ type: 'success', text: 'Granular permissions updated and enforced in real time.' });
        loadData();
        setTimeout(() => {
          setShowPermissionsModal(false);
        }, 1200);
      }
    } catch (err: any) {
      setPermMsg({ type: 'error', text: err.message || 'Network error updating permissions.' });
    } finally {
      setPermLoading(false);
    }
  };

  useEffect(() => {
    authService.ensureSuperAdminSession().then(() => {
      loadData();
    }).catch(() => {
      loadData();
    });
    const unsub = ledgerEngine.subscribe(() => {
      if (liveMonitoring) loadData();
    });
    return unsub;
  }, [liveMonitoring]);

  // When inspecting a transaction, load its immutable journal entry
  useEffect(() => {
    if (inspectTx) {
      const je = ledgerEngine.getJournalEntryByTxId(inspectTx.id);
      setLinkedJournal(je || null);
      setReversalReason('');
      setReversalMsg(null);
    } else {
      setLinkedJournal(null);
    }
  }, [inspectTx]);

  // Execute Reversal
  const handleExecuteReversal = () => {
    if (!inspectTx || !reversalReason) return;
    setReversalMsg(null);
    try {
      const res = ledgerEngine.executeTransactionReversal({
        transactionId: inspectTx.id,
        reason: reversalReason,
        approver: currentActor,
      });
      setReversalMsg({
        type: 'success',
        text: `Transaction reversed. Compensating journal entry ${res.journalEntry.id} posted.`,
      });
      loadData();
    } catch (err: any) {
      setReversalMsg({
        type: 'error',
        text: err.message || 'Reversal failed.',
      });
    }
  };

  // Handle Money-Transfer Approval
  const handleApproveTransfer = () => {
    if (!selectedTransfer) return;
    setApprovalError(null);
    try {
      ledgerEngine.approveMoneyTransferRequest(selectedTransfer.id, currentActor, approvalNotes);
      setApprovalSuccess(`Transfer request ${selectedTransfer.reference} approved successfully.`);
      setApprovalModal(null);
      setSelectedTransfer(null);
      setApprovalNotes('');
      loadData();
    } catch (err: any) {
      setApprovalError(err.message || 'Failed to approve transfer.');
    }
  };

  // Handle Money-Transfer Rejection
  const handleRejectTransfer = () => {
    if (!selectedTransfer) return;
    if (!rejectReason.trim()) {
      setApprovalError('A regulatory reason for rejection is mandatory.');
      return;
    }
    setApprovalError(null);
    try {
      ledgerEngine.rejectMoneyTransferRequest(selectedTransfer.id, rejectReason.trim(), currentActor);
      setApprovalSuccess(`Transfer request ${selectedTransfer.reference} has been rejected.`);
      setApprovalModal(null);
      setSelectedTransfer(null);
      setRejectReason('');
      loadData();
    } catch (err: any) {
      setApprovalError(err.message || 'Failed to reject transfer.');
    }
  };

  // Handle Money-Transfer Execution (Manual/Offline Proof)
  const handleExecuteTransfer = () => {
    if (!selectedTransfer) return;
    if (!executionProof.trim()) {
      setApprovalError('Please provide the physical teller number, bank NIP session ID, or cash receipt reference.');
      return;
    }
    setApprovalError(null);
    try {
      ledgerEngine.executeMoneyTransferRequest(
        selectedTransfer.id,
        {
          proofOrRef: executionProof.trim(),
          notes: executionNotes.trim() || 'Manual transfer evidence verified by Lifetime Super Admin.',
        },
        currentActor
      );
      setApprovalSuccess(`Transfer request ${selectedTransfer.reference} marked as completed and executed.`);
      setApprovalModal(null);
      setSelectedTransfer(null);
      setExecutionProof('');
      setExecutionNotes('');
      loadData();
    } catch (err: any) {
      setApprovalError(err.message || 'Failed to execute transfer.');
    }
  };

  // Handle Create / Appoint Admin (Exclusive to Lifetime Super Admin)
  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (adminModalLoading) return;
    setStaffActionMsg(null);
    setAdminModalError(null);

    const fullName = newAdminForm.fullName.trim();
    const email = newAdminForm.email.trim().toLowerCase();
    const phone = newAdminForm.phone.trim();
    const duty = newAdminForm.operationalResponsibility.trim() || 'Admin / General Branch Administrator';
    const accessCode = newAdminForm.accessCode.trim();
    const confirmAccessCode = newAdminForm.confirmAccessCode.trim();

    if (!fullName || !email || !phone) {
      setAdminModalError('Please fill in all administrator identity and contact fields.');
      return;
    }

    if (!email.includes('@') || !email.includes('.')) {
      setAdminModalError('A valid official email address is required.');
      return;
    }

    if (!accessCode) {
      setAdminModalError('Set Access Code is required. Please enter an access code for the intended administrator.');
      return;
    }

    if (accessCode.length < 6) {
      setAdminModalError('Access Code must be at least 6 characters in length to meet security requirements.');
      return;
    }

    if (!confirmAccessCode) {
      setAdminModalError('Confirm Access Code is required. Please re-enter the code to confirm.');
      return;
    }

    if (accessCode !== confirmAccessCode) {
      setAdminModalError('Set Access Code and Confirm Access Code do not match. Please ensure both fields match exactly.');
      return;
    }

    setAdminModalLoading(true);
    try {
      // 1. Authoritative Backend Provisioning with Salted Cryptographic Hashing
      const backendRes = await authService.appointAdministrator({
        fullName,
        email,
        phone,
        operationalResponsibility: duty,
        accessCode,
        assignedModules: newAdminForm.assignedModules,
      });

      if (!backendRes.success) {
        setAdminModalError(backendRes.error || 'Failed to appoint administrator on backend.');
        setAdminModalLoading(false);
        return;
      }

      // 2. Synchronize into ledgerEngine directory for client-side banking views
      try {
        ledgerEngine.createAdminUser(
          {
            fullName,
            email,
            phone,
            operationalResponsibility: duty,
            assignedModules: newAdminForm.assignedModules,
          },
          currentActor
        );
      } catch {
        // Ignored if already recorded in ledgerEngine
      }

      // Update local state directly so directory reflects immediately
      setStaffDirectory((prev) => {
        const newId = backendRes.account?.id || `STAFF_ADM_${Date.now()}`;
        const updatedRecord: StaffUser = {
          id: newId,
          staffCode: backendRes.account?.staffCode || `TMC-ADM-${newId.slice(-4)}`,
          fullName,
          email,
          phone,
          role: 'ADMIN',
          roleTitle: duty,
          permissions: getDefaultPermissionsForRole('ADMIN'),
          status: 'active',
          lastLogin: new Date().toISOString(),
          lastActivityAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          isLifetimeSuperAdmin: false,
        };
        const existingIdx = prev.findIndex((s) => s.email?.toLowerCase() === email.toLowerCase());
        if (existingIdx >= 0) {
          const copy = [...prev];
          copy[existingIdx] = { ...copy[existingIdx], ...updatedRecord };
          return copy;
        }
        return [...prev, updatedRecord];
      });

      setAdminAppointedSuccess({
        fullName,
        email,
        phone,
        duty,
        accessCode,
        portalRoute: '/admin',
      });

      setStaffActionMsg({
        type: 'success',
        text: 'Admin account created successfully',
      });

      setNewAdminForm({
        fullName: '',
        email: '',
        phone: '',
        operationalResponsibility: '',
        accessCode: '',
        confirmAccessCode: '',
        assignedModules: ['daily_ajo', 'fixed_target', 'everyhome_food', 'leocash', 'loans'],
      });

      loadData();
    } catch (err: any) {
      setAdminModalError(err.message || 'Network error encountered during administrator appointment.');
    } finally {
      setAdminModalLoading(false);
    }
  };

  // Handle Create Ordinary Staff with Backend Access Code Verification
  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (staffModalLoading) return;
    setStaffModalError(null);
    setStaffActionMsg(null);

    const fullName = newStaffForm.fullName.trim();
    const email = newStaffForm.email.trim().toLowerCase();
    const phone = newStaffForm.phone.trim();
    const roleTitle = newStaffForm.roleTitle.trim() || 'Customer Registration Officer';
    const accessCode = newStaffForm.accessCode.trim();

    if (!fullName || !email || !phone || !accessCode) {
      setStaffModalError('Full Legal Name, Official Email Address, Phone Number, and Access Code are mandatory.');
      return;
    }

    if (!email.includes('@') || !email.includes('.')) {
      setStaffModalError('Please enter a valid official email address.');
      return;
    }

    if (accessCode.length < 6) {
      setStaffModalError('Invalid access code: Access Code must be at least 6 characters in length to meet security requirements.');
      return;
    }

    setStaffModalLoading(true);
    try {
      // 1. Authoritative backend verification and staff creation
      const res = await authService.createStaffAccount({
        fullName,
        email,
        phone,
        roleTitle,
        operationalResponsibility: roleTitle,
        accessCode,
        password: newStaffForm.password?.trim() || accessCode,
        assignedModules: newStaffForm.assignedModules,
      });

      if (!res.success) {
        setStaffModalError(res.error || 'Failed to create staff account with access code.');
        setStaffModalLoading(false);
        return;
      }

      // 2. Synchronize into client ledger engine directory
      try {
        ledgerEngine.createStaffUser(
          {
            id: res.account?.id,
            staffCode: res.account?.staffCode,
            fullName,
            email,
            phone,
            roleTitle,
            role: 'STAFF',
            accessCode,
            initialPassword: newStaffForm.password?.trim() || accessCode,
            assignedModules: newStaffForm.assignedModules,
          },
          currentActor
        );
      } catch {
        // Ignored if already recorded
      }

      // Update local state directly so directory reflects immediately
      setStaffDirectory((prev) => {
        const newId = res.account?.id || `STAFF_${Date.now()}`;
        const updatedRecord: StaffUser = {
          id: newId,
          staffCode: res.account?.staffCode || `TMC-STF-${newId.slice(-4)}`,
          fullName,
          email,
          phone,
          role: 'STAFF',
          roleTitle,
          permissions: (res.account?.permissions as any) || getDefaultPermissionsForRole('customer_service'),
          status: 'active',
          lastLogin: new Date().toISOString(),
          lastActivityAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          isLifetimeSuperAdmin: false,
        };
        const existingIdx = prev.findIndex((s) => s.email?.toLowerCase() === email.toLowerCase());
        if (existingIdx >= 0) {
          const copy = [...prev];
          copy[existingIdx] = { ...copy[existingIdx], ...updatedRecord };
          return copy;
        }
        return [...prev, updatedRecord];
      });


      setStaffActionMsg({
        type: 'success',
        text: 'Staff account created successfully',
      });
      setShowStaffModal(false);
      setNewStaffForm({
        fullName: '',
        email: '',
        phone: '',
        roleTitle: 'Customer Registration Officer',
        accessCode: '',
        password: '',
        assignedModules: ['daily_ajo', 'payments'],
      });
      loadData();
    } catch (err: any) {
      setStaffModalError(err.message || 'Network error encountered during staff creation.');
    } finally {
      setStaffModalLoading(false);
    }
  };

  // Handle Revoke Admin Role
  const handleRevokeAdmin = async (adminId: string, adminName: string) => {
    setStaffActionMsg(null);
    try {
      await authService.revokeAdminRole(adminId);
      try {
        ledgerEngine.revokeAdminRole(adminId, currentActor);
      } catch {
        // Non-fatal if only on server
      }
      setStaffActionMsg({
        type: 'success',
        text: `Admin privileges for ${adminName} have been revoked. Role demoted to ordinary Staff.`,
      });
      loadData();
    } catch (err: any) {
      setStaffActionMsg({
        type: 'error',
        text: err.message || 'Failed to revoke Admin role.',
      });
    }
  };

  // Handle Toggle Status (Active / Suspended)
  const handleToggleStaffStatus = async (staff: StaffUser) => {
    if (staff.isLifetimeSuperAdmin) {
      setStaffActionMsg({
        type: 'error',
        text: 'The Lifetime Super Admin cannot be suspended or demoted.',
      });
      return;
    }
    const newStatus = staff.status === 'active' ? 'suspended' : 'active';

    try {
      await authService.toggleAccountStatus(staff.id, newStatus, staff.role);
      try {
        if (staff.role === 'ADMIN') {
          ledgerEngine.updateAdminStatus(staff.id, newStatus, currentActor);
        } else {
          ledgerEngine.updateStaffUser(staff.id, { status: newStatus }, currentActor);
        }
      } catch {
        // Non-fatal if account exists on server/Firestore
      }
      setStaffDirectory((prev) =>
        prev.map((s) => (s.id === staff.id ? { ...s, status: newStatus } : s))
      );
      setStaffActionMsg({
        type: 'success',
        text: `Account for ${staff.fullName} has been set to ${newStatus.toUpperCase()}.`,
      });
      loadData();
    } catch (err: any) {
      setStaffActionMsg({
        type: 'error',
        text: err.message || `Failed to update status.`,
      });
    }
  };

  // Discreetly inspect staff activity
  const handleInspectStaffActivity = (staff: StaffUser) => {
    setInspectedStaff(staff);
    // getUserActivityLogs quietly logs to RestrictedOversightLogs without alerting employee
    const logs = ledgerEngine.getUserActivityLogs(staff.id, currentActor);
    setInspectedStaffLogs(logs);
    setOversightLogs(ledgerEngine.getRestrictedOversightLogs());
  };

  // Save CMS Settings
  const handleSaveCMS = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: BankConfig = {
      ...config,
      bankName: bankNameInput,
      slogan: sloganInput,
      hotline: hotlineInput,
      headOffice: headOfficeInput,
      rates: {
        ...config.rates,
        savingsAnnualRatePercent: Number(savingsRateInput),
        smeLoanMonthlyRatePercent: Number(smeRateInput),
      },
    };
    onUpdateConfig(updated);
    ledgerEngine.updateConfig(updated);
    setCmsSaved(true);
    setTimeout(() => setCmsSaved(false), 3000);
  };

  // Filter Transactions
  const filteredTransactions = transactions.filter((t) => {
    const matchesSearch =
      t.reference.toLowerCase().includes(txSearch.toLowerCase()) ||
      (t.sourceAccountNumber || '').includes(txSearch) ||
      (t.destinationAccountNumber || '').includes(txSearch) ||
      t.narration.toLowerCase().includes(txSearch.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || t.status === statusFilter;
    const matchesType = typeFilter === 'ALL' || t.type === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  // Filter Transfers
  const pendingTransfersCount = transfers.filter((t) => t.status === 'PENDING_APPROVAL').length;
  const filteredTransfers = transfers.filter((t) => {
    const matchesStatus = transferFilter === 'ALL' || t.status === transferFilter;
    const matchesType = transferTypeFilter === 'ALL' || t.type === transferTypeFilter;
    const matchesSearch =
      t.reference.toLowerCase().includes(transferSearch.toLowerCase()) ||
      t.customerName.toLowerCase().includes(transferSearch.toLowerCase()) ||
      (t.destinationDetails?.accountNumber || t.accountNumber || '').includes(transferSearch) ||
      t.submittedByStaffName.toLowerCase().includes(transferSearch.toLowerCase()) ||
      (t.submissionNotes || '').toLowerCase().includes(transferSearch.toLowerCase());
    return matchesStatus && matchesType && matchesSearch;
  });

  // Calculate Real Double-Entry Financial Metrics
  const customerAccounts = accounts.filter((a) => !a.isSystem);
  const totalCustomerDepositsKobo = customerAccounts.reduce((sum, a) => sum + a.balanceKobo, 0);

  const vaultAccount = accounts.find((a) => a.accountNumber === SYSTEM_ACCOUNT_VAULT_RESERVE);
  const feeAccount = accounts.find((a) => a.accountNumber === SYSTEM_ACCOUNT_FEE_INCOME);

  const totalVaultReservesKobo = vaultAccount ? vaultAccount.balanceKobo : 0;
  const totalAccumulatedFeeIncomeKobo = feeAccount ? feeAccount.balanceKobo : 0;

  const totalSuccessfulVolumeKobo = transactions
    .filter((t) => t.status === 'SUCCESSFUL')
    .reduce((sum, t) => sum + t.amountKobo, 0);

  return (
    <div className="min-h-screen bg-[#F4F7FB] dark:bg-[#060D1F] text-[#172033] dark:text-slate-100 pb-20 font-sans">
      {/* Super Admin Ajo.money-Style Fintech Command Header */}
      <div className="bg-[#0B2A5B] text-white border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div
              onClick={() => onNavigate('/home')}
              className="cursor-pointer hover:opacity-95 transition-opacity"
              title="Return to TEAMACRO SERVICES LTD Homepage"
            >
              <BrandLogo variant="horizontal" theme="dark" size="sm" />
            </div>
            <div className="hidden sm:block h-8 w-px bg-white/15" />
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#1E5BD8] border border-white/20 text-white font-bold flex items-center justify-center text-lg shadow-xs">
                <ShieldCheck size={20} />
              </div>
              <div>
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#93C5FD]">
                  PORTAL 03 · LIFETIME SUPER ADMIN ROOT CONSOLE
                </div>
                <div className="font-display text-base font-extrabold text-white flex items-center gap-2 tracking-tight">
                  <span>{config.bankName}</span>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-white bg-[#1E5BD8] rounded-full px-2.5 py-0.5">
                    Dual-Control Root Authority
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 text-xs">
            <ThemeSelector />
            <button
              onClick={() => setLiveMonitoring(!liveMonitoring)}
              className={`px-3.5 py-1.5 rounded-full font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                liveMonitoring
                  ? 'bg-[#16A34A]/20 text-emerald-300 border border-[#16A34A]/50'
                  : 'bg-white/10 text-slate-300 border border-white/15'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${liveMonitoring ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'}`} />
              <span>{liveMonitoring ? 'Live Monitor Active' : 'Live Monitor Paused'}</span>
            </button>
            <button
              onClick={loadData}
              className="px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/15 text-slate-100 font-bold flex items-center gap-1.5 border border-white/15 cursor-pointer transition-colors"
            >
              <RefreshCw size={13} />
              <span>Refresh Ledger</span>
            </button>
            <button
              onClick={() => onNavigate('/admin')}
              className="px-4 py-1.5 rounded-full bg-[#1E5BD8] hover:bg-[#2563EB] text-white font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <span>Switch to /admin</span>
            </button>
            <button
              onClick={onLogout}
              className="px-4 py-1.5 rounded-full bg-rose-600/90 hover:bg-rose-600 text-white font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
              title="Sign Out of Root Authority"
            >
              <LogOut size={13} />
              <span>Sign Out</span>
            </button>
          </div>
        </div>

        {/* Permanent Lifetime Super Admin Root Ownership Banner */}
        <div className="bg-[#081F44] border-y border-white/10 px-4 sm:px-6 lg:px-8 py-2.5">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <span className="px-3 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-[#1E5BD8] text-white">
                Permanent Lifetime Owner
              </span>
              <span className="font-display font-bold text-white">
                {lifetimeSuperAdmin?.fullName || 'Davidson Eromosele'}
              </span>
              <span className="text-slate-300 font-mono text-[11px]">({lifetimeSuperAdmin?.email || 'eromoseledavidson68@gmail.com'})</span>
              <span className="hidden md:inline text-[#93C5FD] font-mono text-[11px]">
                ID: {lifetimeSuperAdmin?.id || 'LIFETIME_ROOT_SUPER_ADMIN_001'}
              </span>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-slate-300">
              <span className="flex items-center gap-1 text-emerald-400 font-bold uppercase tracking-wider">
                <Lock size={12} /> Root Bound & Immutable
              </span>
              <span className="text-white/20">|</span>
              <span className="text-[#93C5FD] font-mono uppercase tracking-wider">Exclusive Admin Appointment Authority</span>
            </div>
          </div>
        </div>

        {/* Ajo.money-Style Navigation Tabs (01 - 10) */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex overflow-x-auto gap-1.5 pt-2.5 text-xs font-bold">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2.5 rounded-t-xl transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'overview'
                ? 'bg-[#F4F7FB] dark:bg-[#060D1F] text-[#0B2A5B] dark:text-white border-t-2 border-[#2563EB]'
                : 'text-slate-300 hover:text-white hover:bg-white/10'
            }`}
          >
            <Layers size={14} />
            <span>Balance Sheet & Metrics</span>
          </button>

          <button
            onClick={() => setActiveTab('approvals')}
            className={`px-4 py-2.5 rounded-t-xl transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'approvals'
                ? 'bg-[#F4F7FB] dark:bg-[#060D1F] text-[#0B2A5B] dark:text-white border-t-2 border-[#2563EB]'
                : 'text-slate-300 hover:text-white hover:bg-white/10'
            }`}
          >
            <DollarSign size={14} />
            <span>Money-Transfer Approvals</span>
            {pendingTransfersCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#F97316] text-white">
                {pendingTransfersCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('staff_admin_mgmt')}
            className={`px-4 py-2.5 rounded-t-xl transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'staff_admin_mgmt'
                ? 'bg-[#F4F7FB] dark:bg-[#060D1F] text-[#0B2A5B] dark:text-white border-t-2 border-[#2563EB]'
                : 'text-slate-300 hover:text-white hover:bg-white/10'
            }`}
          >
            <Users size={14} />
            <span>Access & Duty Assignment</span>
          </button>

          <button
            onClick={() => setActiveTab('discreet_monitoring')}
            className={`px-4 py-2.5 rounded-t-xl transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'discreet_monitoring'
                ? 'bg-[#F4F7FB] dark:bg-[#060D1F] text-[#0B2A5B] dark:text-white border-t-2 border-[#2563EB]'
                : 'text-slate-300 hover:text-white hover:bg-white/10'
            }`}
          >
            <Eye size={14} />
            <span>Discreet Monitoring</span>
          </button>

          <button
            onClick={() => setActiveTab('oversight_logs')}
            className={`px-4 py-2.5 rounded-t-xl transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'oversight_logs'
                ? 'bg-[#F4F7FB] dark:bg-[#060D1F] text-[#0B2A5B] dark:text-white border-t-2 border-[#2563EB]'
                : 'text-slate-300 hover:text-white hover:bg-white/10'
            }`}
          >
            <ShieldAlert size={14} />
            <span>Oversight Logs ({oversightLogs.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('transactions')}
            className={`px-4 py-2.5 rounded-t-xl transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'transactions'
                ? 'bg-[#F4F7FB] dark:bg-[#060D1F] text-[#0B2A5B] dark:text-white border-t-2 border-[#2563EB]'
                : 'text-slate-300 hover:text-white hover:bg-white/10'
            }`}
          >
            <ArrowRightLeft size={14} />
            <span>Live Transactions ({transactions.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('ledger_reconciliation')}
            className={`px-4 py-2.5 rounded-t-xl transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'ledger_reconciliation'
                ? 'bg-[#F4F7FB] dark:bg-[#060D1F] text-[#0B2A5B] dark:text-white border-t-2 border-[#2563EB]'
                : 'text-slate-300 hover:text-white hover:bg-white/10'
            }`}
          >
            <CheckCircle2 size={14} />
            <span>Trial Balance</span>
          </button>

          <button
            onClick={() => setActiveTab('fraud_risk')}
            className={`px-4 py-2.5 rounded-t-xl transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'fraud_risk'
                ? 'bg-[#F4F7FB] dark:bg-[#060D1F] text-[#0B2A5B] dark:text-white border-t-2 border-[#2563EB]'
                : 'text-slate-300 hover:text-white hover:bg-white/10'
            }`}
          >
            <AlertTriangle size={14} />
            <span>Fraud & Risk ({alerts.filter((a) => a.status === 'OPEN').length})</span>
          </button>

          <button
            onClick={() => setActiveTab('audit_trail')}
            className={`px-4 py-2.5 rounded-t-xl transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'audit_trail'
                ? 'bg-[#F4F7FB] dark:bg-[#060D1F] text-[#0B2A5B] dark:text-white border-t-2 border-[#2563EB]'
                : 'text-slate-300 hover:text-white hover:bg-white/10'
            }`}
          >
            <FileText size={14} />
            <span>Audit Trail</span>
          </button>

          <button
            onClick={() => setActiveTab('cms_settings')}
            className={`px-4 py-2.5 rounded-t-xl transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'cms_settings'
                ? 'bg-[#F4F7FB] dark:bg-[#060D1F] text-[#0B2A5B] dark:text-white border-t-2 border-[#2563EB]'
                : 'text-slate-300 hover:text-white hover:bg-white/10'
            }`}
          >
            <Sliders size={14} />
            <span>CMS Brand Settings</span>
          </button>
        </div>
      </div>

      {/* Main Super Admin Command Area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Alerts & Action Feedback */}
        {approvalSuccess && (
          <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border-l-4 border-[#16A34A] border-y border-r border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-sm flex items-center justify-between">
            <div className="flex items-center gap-2 font-medium">
              <CheckCircle2 size={18} className="text-[#16A34A]" />
              <span>{approvalSuccess}</span>
            </div>
            <button onClick={() => setApprovalSuccess(null)} className="text-emerald-700 hover:text-emerald-900">
              <X size={16} />
            </button>
          </div>
        )}

        {approvalError && (
          <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/60 border-l-4 border-rose-600 border-y border-r border-red-200 dark:border-red-800 text-red-900 dark:text-red-200 text-sm flex items-center justify-between">
            <div className="flex items-center gap-2 font-medium">
              <AlertTriangle size={18} className="text-rose-600" />
              <span>{approvalError}</span>
            </div>
            <button onClick={() => setApprovalError(null)} className="text-red-700 hover:text-red-900">
              <X size={16} />
            </button>
          </div>
        )}

        {staffActionMsg && (
          <div
            className={`p-4 rounded-2xl text-sm flex items-center justify-between border-l-4 border-y border-r ${
              staffActionMsg.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/60 border-l-[#16A34A] border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                : 'bg-red-50 dark:bg-red-950/60 border-l-rose-600 border-red-200 dark:border-red-800 text-red-900 dark:text-red-200'
            }`}
          >
            <div className="flex items-center gap-2 font-medium">
              {staffActionMsg.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
              <span>{staffActionMsg.text}</span>
            </div>
            <button onClick={() => setStaffActionMsg(null)} className="hover:opacity-75">
              <X size={16} />
            </button>
          </div>
        )}

        {/* ============================================================== */}
        {/* 1. OVERVIEW: REAL FINANCIAL LEDGER METRICS */}
        {/* ============================================================== */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            <div className="bg-white dark:bg-[#0B162C] rounded-3xl border border-slate-200/90 dark:border-slate-800 p-6 sm:p-7 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#2563EB]/10 text-[#2563EB] dark:text-blue-400 text-[10px] font-extrabold uppercase tracking-wider mb-1.5">
                  <span>MODULE 01 · EXECUTIVE DOUBLE-ENTRY BALANCE SHEET</span>
                </div>
                <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-[#0B2A5B] dark:text-white tracking-tight">
                  Root{' '}
                  <span className="relative inline-block text-[#1E5BD8] dark:text-[#60A5FA]">
                    Financial
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
                  & Governance Metrics
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1.5">
                  Authoritative double-entry balance sheet across Daily Ajo, Fixed Target, Everyhome Food, Leocash & Loans.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowRegisterCustomerModal(true)}
                  className="px-5 py-2.5 rounded-full bg-[#1E5BD8] hover:bg-[#0B2A5B] text-white font-bold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer transition-colors"
                >
                  <UserPlus size={14} /> + Register New Customer
                </button>
              </div>
            </div>

            {/* Ajo.money-Style Rounded-2xl Metric Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <div className="bg-white dark:bg-[#0B162C] p-6 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-2 relative overflow-hidden">
                <div className="h-1.5 bg-[#0B2A5B] absolute top-0 left-0 right-0" />
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  01 · Total Customer Deposits (Liability)
                </div>
                <div className="font-display text-2xl sm:text-3xl font-extrabold text-[#0B2A5B] dark:text-white tabular-nums">
                  {formatNaira(totalCustomerDepositsKobo)}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  Across {Math.max(customerAccounts.length, customers.length)} verified customer accounts
                </div>
              </div>

              <div className="bg-white dark:bg-[#0B162C] p-6 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-2 relative overflow-hidden">
                <div className="h-1.5 bg-[#1E5BD8] absolute top-0 left-0 right-0" />
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  02 · Vault Cash & Central Reserves (Asset)
                </div>
                <div className="font-display text-2xl sm:text-3xl font-extrabold text-[#1E5BD8] dark:text-blue-400 tabular-nums">
                  {formatNaira(totalVaultReservesKobo)}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  Liquid cash reserves covering deposit liabilities
                </div>
              </div>

              <div className="bg-white dark:bg-[#0B162C] p-6 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-2 relative overflow-hidden">
                <div className="h-1.5 bg-[#0D9488] absolute top-0 left-0 right-0" />
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  03 · Accumulated Fee Income (Revenue)
                </div>
                <div className="font-display text-2xl sm:text-3xl font-extrabold text-[#0D9488] tabular-nums">
                  {formatNaira(totalAccumulatedFeeIncomeKobo)}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  Transfer commissions & electronic service levies
                </div>
              </div>

              <div className="bg-white dark:bg-[#0B162C] p-6 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-2 relative overflow-hidden">
                <div className="h-1.5 bg-[#16A34A] absolute top-0 left-0 right-0" />
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  04 · Total Cumulative Settled Volume
                </div>
                <div className="font-display text-2xl sm:text-3xl font-extrabold text-[#16A34A] tabular-nums">
                  {formatNaira(totalSuccessfulVolumeKobo)}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  {transactions.length} immutable transaction records
                </div>
              </div>
            </div>

            {/* Quick Status / Institutional Governance */}
            <div className="bg-white dark:bg-[#0B162C] p-6 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-4">
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#2563EB]">
                GOVERNANCE ARCHITECTURE // DUAL-CONTROL MATRIX
              </div>
              <h3 className="font-display text-base font-extrabold text-[#0B2A5B] dark:text-white">
                Institutional Security & Governance Overview
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="p-4 rounded-2xl bg-[#F4F7FB] dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1 relative overflow-hidden">
                  <div className="h-1 bg-[#2563EB] absolute top-0 left-0 right-0" />
                  <div className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">Dual-Control Enforcement</div>
                  <div className="font-display text-[#0B2A5B] dark:text-slate-100 font-extrabold text-sm">Mandatory Maker-Checker Active</div>
                  <p className="text-[11px] text-slate-500">
                    Staff initiate; Super Admin or Admin approves; manual disbursement proof recorded.
                  </p>
                </div>
                <div className="p-4 bg-[#F4F7FB] dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1 relative overflow-hidden">
                  <div className="h-1 bg-[#16A34A] absolute top-0 left-0 right-0" />
                  <div className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">Hierarchy Integrity</div>
                  <div className="font-display text-[#0B2A5B] dark:text-slate-100 font-extrabold text-sm tabular-nums">
                    1 Root Owner · {staffDirectory.filter(s => s.role === 'ADMIN').length} Admins · {staffDirectory.filter(s => !s.isLifetimeSuperAdmin && s.role !== 'LIFETIME_SUPER_ADMIN' && s.role !== 'ADMIN').length} Staff
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Only Lifetime Super Admin can appoint or revoke Admins.
                  </p>
                </div>
                <div className="p-4 bg-[#F4F7FB] dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1 relative overflow-hidden">
                  <div className="h-1 bg-[#7C3AED] absolute top-0 left-0 right-0" />
                  <div className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">Discreet Monitoring</div>
                  <div className="font-display text-[#0B2A5B] dark:text-slate-100 font-extrabold text-sm tabular-nums">
                    {oversightLogs.length} Oversight Events Logged
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Quiet inspection enabled. Zero notifications dispatched to monitored personnel.
                  </p>
                </div>
              </div>
            </div>

            {/* Registered Customer Directory */}
            <div className="bg-white dark:bg-[#0B162C] border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
              <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#2563EB]">
                    REGISTRY // SYNCHRONISED CUSTOMER LEDGER
                  </div>
                  <h3 className="font-display text-base font-extrabold text-[#0B2A5B] dark:text-white flex items-center gap-2 mt-0.5">
                    <Users size={18} className="text-[#2563EB]" />
                    Registered Customer Directory ({customers.length} Enrolled)
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Real-time registry of all customers created across Staff, Admin, Super Admin, and Account Application portals.
                  </p>
                </div>
                <button
                  onClick={() => setShowRegisterCustomerModal(true)}
                  className="px-4 py-2 bg-[#1E5BD8] hover:bg-[#0B2A5B] text-white font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
                >
                  <UserPlus size={14} /> + Register New Customer
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#0B2A5B] text-white font-bold uppercase tracking-wider text-[11px]">
                      <th className="p-3.5">Customer Name</th>
                      <th className="p-3.5">Customer Code</th>
                      <th className="p-3.5">Phone</th>
                      <th className="p-3.5">Email / NIN</th>
                      <th className="p-3.5">Address</th>
                      <th className="p-3.5">Status</th>
                      <th className="p-3.5">Registered Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {customers.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-slate-400">
                          No customer profiles registered yet. Click &ldquo;+ Register New Customer&rdquo; to enroll a customer.
                        </td>
                      </tr>
                    ) : (
                      customers.map((c) => (
                        <tr key={c.id} className="hover:bg-[#F4F7FB] dark:hover:bg-slate-800/60 transition-colors">
                          <td className="p-3.5 font-bold text-[#0B2A5B] dark:text-white">{c.fullName}</td>
                          <td className="p-3.5 font-mono text-[11px] font-bold text-[#2563EB]">
                            {c.customerCode || c.id}
                          </td>
                          <td className="p-3.5 text-slate-700 dark:text-slate-300">{c.phone}</td>
                          <td className="p-3.5 text-slate-500">
                            <div>{c.email || '—'}</div>
                            {c.ninOrBvn && <div className="font-mono text-[10px] text-slate-400">NIN/BVN: {c.ninOrBvn}</div>}
                          </td>
                          <td className="p-3.5 text-slate-600 dark:text-slate-400">{c.address || '—'}</td>
                          <td className="p-3.5">
                            <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                              {String(c.status || 'ACTIVE').toUpperCase()}
                            </span>
                          </td>
                          <td className="p-3.5 text-slate-500">{formatLagosDate(c.registrationDate || c.createdAt || c.joinedDate || new Date().toISOString())}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {showRegisterCustomerModal && (
              <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
                <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-lg w-full border border-[#E0E4EE] dark:border-slate-700 shadow-2xl overflow-hidden">
                  <div className="p-5 bg-[#091747] text-white flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-base">Register New Customer</h3>
                      <p className="text-xs text-slate-300">Create a verified customer profile synchronized across all portals</p>
                    </div>
                    <button onClick={() => setShowRegisterCustomerModal(false)} className="text-slate-300 hover:text-white cursor-pointer">
                      <X size={18} />
                    </button>
                  </div>
                  <form onSubmit={handleRegisterCustomer} className="p-6 space-y-4 text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Full Legal Name *</label>
                        <input
                          type="text"
                          required
                          value={newCustomerForm.fullName}
                          onChange={(e) => setNewCustomerForm({ ...newCustomerForm, fullName: e.target.value })}
                          placeholder="e.g. Adebayo Ogunlesi"
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Phone Number *</label>
                        <input
                          type="tel"
                          required
                          value={newCustomerForm.phone}
                          onChange={(e) => setNewCustomerForm({ ...newCustomerForm, phone: e.target.value })}
                          placeholder="0803 000 0000"
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Email Address</label>
                        <input
                          type="email"
                          value={newCustomerForm.email}
                          onChange={(e) => setNewCustomerForm({ ...newCustomerForm, email: e.target.value })}
                          placeholder="customer@email.com"
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">NIN or BVN</label>
                        <input
                          type="text"
                          value={newCustomerForm.ninOrBvn}
                          onChange={(e) => setNewCustomerForm({ ...newCustomerForm, ninOrBvn: e.target.value })}
                          placeholder="11-digit NIN or BVN"
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Residential / Business Address</label>
                      <input
                        type="text"
                        value={newCustomerForm.address}
                        onChange={(e) => setNewCustomerForm({ ...newCustomerForm, address: e.target.value })}
                        placeholder="Street, Area, State"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Next of Kin Name</label>
                        <input
                          type="text"
                          value={newCustomerForm.nextOfKinName}
                          onChange={(e) => setNewCustomerForm({ ...newCustomerForm, nextOfKinName: e.target.value })}
                          placeholder="Next of Kin Full Name"
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Next of Kin Phone</label>
                        <input
                          type="tel"
                          value={newCustomerForm.nextOfKinPhone}
                          onChange={(e) => setNewCustomerForm({ ...newCustomerForm, nextOfKinPhone: e.target.value })}
                          placeholder="0803 000 0000"
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-700">
                      <button
                        type="button"
                        onClick={() => setShowRegisterCustomerModal(false)}
                        className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 font-semibold cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 rounded-lg bg-[#263F91] hover:bg-[#1a2c6b] text-white font-bold cursor-pointer"
                      >
                        Complete Registration
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* 2. MONEY-TRANSFER APPROVALS TAB */}
        {/* ============================================================== */}
        {activeTab === 'approvals' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-[#091747] dark:text-white flex items-center gap-2">
                  <DollarSign className="text-amber-500" />
                  Central Money-Transfer Approval Queue
                </h2>
                <p className="text-xs text-[#667085] dark:text-slate-400">
                  Mandatory maker-checker approval for all loan disbursements, withdrawals, savings payouts, and refunds.
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <span className="px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-semibold border border-amber-300 dark:border-amber-700">
                  Self-Approval Strictly Prohibited
                </span>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-[#E0E4EE] dark:border-slate-700 flex flex-wrap gap-3 items-center justify-between">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-slate-500 font-medium">Status:</span>
                {(['ALL', 'PENDING_APPROVAL', 'APPROVED', 'PROCESSING', 'COMPLETED', 'REJECTED'] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => setTransferFilter(st)}
                    className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                      transferFilter === st
                        ? 'bg-[#263F91] text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                    }`}
                  >
                    {st === 'ALL' ? 'All' : st.replace('_', ' ')}
                  </button>
                ))}
              </div>

              <div className="w-full sm:w-64">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={transferSearch}
                    onChange={(e) => setTransferSearch(e.target.value)}
                    placeholder="Search ref, customer, submitter..."
                    className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-hidden focus:border-[#263F91]"
                  />
                </div>
              </div>
            </div>

            {/* Transfers Table */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-[#E0E4EE] dark:border-slate-700 overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#0B2A5B] text-white font-bold uppercase tracking-wider text-[11px] border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="p-3">Reference / Date</th>
                      <th className="p-3">Type</th>
                      <th className="p-3">Customer / Beneficiary</th>
                      <th className="p-3">Amount</th>
                      <th className="p-3">Submitted By</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E0E4EE] dark:divide-slate-700">
                    {filteredTransfers.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-slate-400">
                          No money transfer requests matching current filter.
                        </td>
                      </tr>
                    ) : (
                      filteredTransfers.map((req) => {
                        const isSubmitter = req.submittedByStaffId === currentActor.id;
                        return (
                          <tr key={req.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                            <td className="p-3 font-mono">
                              <span className="font-bold text-[#091747] dark:text-white block">{req.reference}</span>
                              <span className="text-[10px] text-slate-500">{formatLagosDate(req.submittedAt)}</span>
                            </td>
                            <td className="p-3">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                {req.type.replace('_', ' ')}
                              </span>
                            </td>
                            <td className="p-3">
                              <span className="font-semibold text-slate-900 dark:text-slate-100 block">
                                {req.customerName}
                              </span>
                              <span className="text-[11px] text-slate-500 font-mono">
                                {req.destinationDetails?.bankName || 'Direct Account'} · {req.destinationDetails?.accountNumber || req.accountNumber || 'N/A'}
                              </span>
                            </td>
                            <td className="p-3 font-bold font-mono text-sm text-[#091747] dark:text-white">
                              {formatNaira(req.amountKobo)}
                            </td>
                            <td className="p-3">
                              <span className="text-slate-800 dark:text-slate-200 block font-medium">
                                {req.submittedByStaffName}
                              </span>
                              <span className="text-[10px] text-slate-400">Role: {req.submittedByStaffRole}</span>
                            </td>
                            <td className="p-3">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  req.status === 'PENDING_APPROVAL'
                                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                    : req.status === 'APPROVED'
                                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                                    : req.status === 'COMPLETED'
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                    : 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                                }`}
                              >
                                {req.status.replace('_', ' ')}
                              </span>
                            </td>
                            <td className="p-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {req.status === 'PENDING_APPROVAL' && (
                                  <>
                                    <button
                                      disabled={isSubmitter}
                                      onClick={() => {
                                        setSelectedTransfer(req);
                                        setApprovalModal('approve');
                                      }}
                                      title={isSubmitter ? 'Self-approval prohibited' : 'Approve transfer'}
                                      className="px-2.5 py-1 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white rounded cursor-pointer disabled:cursor-not-allowed transition-colors"
                                    >
                                      Approve
                                    </button>
                                    <button
                                      disabled={isSubmitter}
                                      onClick={() => {
                                        setSelectedTransfer(req);
                                        setApprovalModal('reject');
                                      }}
                                      className="px-2.5 py-1 text-[11px] font-bold bg-red-600 hover:bg-red-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white rounded cursor-pointer disabled:cursor-not-allowed transition-colors"
                                    >
                                      Reject
                                    </button>
                                  </>
                                )}

                                {req.status === 'APPROVED' && (
                                  <button
                                    onClick={() => {
                                      setSelectedTransfer(req);
                                      setApprovalModal('execute');
                                    }}
                                    className="px-2.5 py-1 text-[11px] font-bold bg-blue-600 hover:bg-blue-700 text-white rounded cursor-pointer transition-colors"
                                  >
                                    Record Execution Proof
                                  </button>
                                )}

                                {req.status === 'COMPLETED' && (
                                  <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                                    <CheckCircle2 size={12} /> Settled
                                  </span>
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

        {/* ============================================================== */}
        {/* 3. STAFF & ADMIN HIERARCHY MANAGEMENT TAB */}
        {/* ============================================================== */}
        {activeTab === 'staff_admin_mgmt' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-800 p-6 rounded-2xl border border-[#E0E4EE] dark:border-slate-700 shadow-xs">
              <div>
                <h2 className="text-xl font-bold text-[#091747] dark:text-white flex items-center gap-2">
                  <Key className="text-[#2563EB]" />
                  Access & Duty Assignment
                </h2>
                <p className="text-xs text-[#667085] dark:text-slate-400 mt-1">
                  Manage personnel security clearance, assign duties across the 6 established positions and administration roles, and configure granular permissions.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  onClick={() => setShowAdminModal(true)}
                  className="px-3.5 py-2.5 text-xs font-bold bg-[#0B2A5B] hover:bg-[#112469] text-white rounded-xl flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
                >
                  <UserPlus size={14} className="text-amber-400" />
                  <span>Appoint Admin (Exclusive)</span>
                </button>
                <button
                  onClick={() => {
                    setStaffModalError(null);
                    setShowStaffModal(true);
                  }}
                  className="px-4 py-2.5 text-xs font-bold bg-[#2563EB] hover:bg-[#1E5BD8] text-white rounded-xl flex items-center gap-1.5 cursor-pointer shadow-sm transition-all hover:shadow-md"
                >
                  <Plus size={14} />
                  <span>Create Staff</span>
                </button>
              </div>
            </div>

            {/* Staff Directory Table */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-[#E0E4EE] dark:border-slate-700 overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#0B2A5B] text-white font-bold uppercase tracking-wider text-[11px] border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="p-3">Staff Details</th>
                      <th className="p-3">Role & Hierarchy Level</th>
                      <th className="p-3">Created / Appointed By</th>
                      <th className="p-3">Operational Responsibility</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Administrative Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E0E4EE] dark:divide-slate-700">
                    {staffDirectory.map((staff) => (
                      <tr key={staff.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                        <td className="p-3">
                          <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <span>{staff.fullName}</span>
                            {staff.isLifetimeSuperAdmin && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-amber-400 text-slate-950">
                                ROOT
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono">
                            {staff.email} · {staff.phone}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            Code: {staff.staffCode}
                          </div>
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              staff.role === 'LIFETIME_SUPER_ADMIN'
                                ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200 border border-amber-300'
                                : staff.role === 'ADMIN'
                                ? 'bg-purple-100 text-purple-900 dark:bg-purple-950 dark:text-purple-200 border border-purple-300'
                                : 'bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-200 border border-blue-300'
                            }`}
                          >
                            {staff.roleTitle || staff.role}
                          </span>
                        </td>
                        <td className="p-3 text-slate-600 dark:text-slate-400">
                          {staff.isLifetimeSuperAdmin ? (
                            <span className="text-amber-600 font-semibold">Self / Root Genesis</span>
                          ) : (
                            <div>
                              <span className="font-medium text-slate-800 dark:text-slate-200 block">
                                {staff.createdByName || 'Super Admin'}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                {staff.createdByStaffId || 'System'}
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="p-3 text-slate-700 dark:text-slate-300">
                          <span className="block font-medium">
                            {staff.operationalResponsibility || 'Standard Duties'}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            Modules: {(staff.assignedModules || []).join(', ') || 'all'}
                          </span>
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              staff.status === 'active'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                : 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                            }`}
                          >
                            {staff.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {staff.isLifetimeSuperAdmin ? (
                              <span className="text-[10px] text-slate-400 italic">Immutable Root</span>
                            ) : (
                              <>
                                <button
                                  onClick={() => handleOpenPermissionsModal(staff)}
                                  className="px-2.5 py-1 text-[10px] font-bold bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700 rounded-lg cursor-pointer transition-colors flex items-center gap-1"
                                  title="Configure Granular Operational Permissions"
                                >
                                  <SlidersHorizontal size={11} />
                                  <span>Permissions</span>
                                </button>
                                {staff.role === 'ADMIN' && (
                                  <button
                                    onClick={() => handleRevokeAdmin(staff.id, staff.fullName)}
                                    className="px-2 py-1 text-[10px] font-bold bg-amber-600 hover:bg-amber-700 text-white rounded cursor-pointer"
                                    title="Revoke Admin privileges to ordinary staff"
                                  >
                                    Revoke Admin
                                  </button>
                                )}
                                <button
                                  onClick={() => handleToggleStaffStatus(staff)}
                                  className={`px-2 py-1 text-[10px] font-bold rounded cursor-pointer text-white ${
                                    staff.status === 'active'
                                      ? 'bg-rose-600 hover:bg-rose-700'
                                      : 'bg-emerald-600 hover:bg-emerald-700'
                                  }`}
                                >
                                  {staff.status === 'active' ? 'Suspend' : 'Activate'}
                                </button>
                                <button
                                  onClick={() => {
                                    setActiveTab('discreet_monitoring');
                                    handleInspectStaffActivity(staff);
                                  }}
                                  className="px-2 py-1 text-[10px] font-bold bg-slate-700 hover:bg-slate-800 text-white rounded cursor-pointer"
                                  title="Inspect audit logs quietly without alerting employee"
                                >
                                  Inspect
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Sub-Section 2: Active Access Authorizations & Codes */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-[#E0E4EE] dark:border-slate-700 overflow-hidden shadow-xs p-4 sm:p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                    <Key size={16} className="text-amber-500" />
                    <span>Issued Backend Access Authorizations & Codes ({backendInvitations.length})</span>
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Authorized invitations and access codes issued by administrators. Grants entry clearance to /admin or /staff.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setStaffModalError(null);
                    setShowStaffModal(true);
                  }}
                  className="px-3 py-1.5 text-xs font-bold text-[#2563EB] hover:bg-blue-50 dark:hover:bg-blue-950/50 rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <Plus size={13} />
                  <span>Onboard Staff with Code</span>
                </button>
              </div>

              {backendInvitations.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400 bg-slate-50 dark:bg-slate-900/50 rounded-xl space-y-2">
                  <Key className="mx-auto text-slate-300 dark:text-slate-600" size={28} />
                  <p>No backend access authorizations currently active.</p>
                  <p className="text-[11px] text-slate-500">
                    Use &quot;Appoint Admin&quot; or &quot;Create Staff&quot; above to issue verified access credentials.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {backendInvitations.map((inv, idx) => {
                    const isActive = inv.status === 'ACTIVE' || (!inv.used && !inv.revoked && inv.expiresAt > Date.now());
                    const isRevoked = inv.status === 'REVOKED' || inv.revoked;
                    const isRedeemed = inv.status === 'REDEEMED' || inv.status === 'ACCEPTED' || inv.used;
                    const isExpired = inv.status === 'EXPIRED' || (inv.expiresAt && Date.now() > inv.expiresAt && !inv.used);

                    return (
                      <div
                        key={inv.id || inv.code || idx}
                        className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 space-y-2.5"
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              inv.accessType === 'Admin'
                                ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border border-purple-200'
                                : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-200'
                            }`}
                          >
                            {inv.accessType} Clearance
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                              isRedeemed
                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-200'
                                : isRevoked
                                ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 border border-red-200'
                                : isExpired
                                ? 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-400'
                                : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300'
                            }`}
                          >
                            {isRevoked ? 'REVOKED' : isRedeemed ? 'REDEEMED' : isExpired ? 'EXPIRED' : 'ACTIVE'}
                          </span>
                        </div>

                        <div>
                          <div className="font-bold text-slate-900 dark:text-white text-xs">{inv.duty}</div>
                          <div className="text-[11px] text-slate-500 font-mono truncate">{inv.email}</div>
                          {inv.fullName && (
                            <div className="text-[10px] text-slate-400 mt-0.5">{inv.fullName}</div>
                          )}
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800">
                          <div>
                            <span className="text-[9px] text-slate-400 uppercase block font-semibold">Code / Mask</span>
                            <span className="font-mono text-xs font-black text-slate-800 dark:text-slate-100 tracking-wider">
                              {inv.codeMasked || inv.code || '******'}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            {isActive && inv.id && (
                              <button
                                type="button"
                                onClick={() => handleRevokeInvitation(inv.id, inv.email)}
                                className="text-[10px] font-bold text-rose-600 hover:text-rose-700 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 px-2 py-1 rounded cursor-pointer transition-colors border border-rose-200 dark:border-rose-800"
                                title="Revoke this authorization code before redemption"
                              >
                                Revoke
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="text-[10px] text-slate-400 flex items-center justify-between pt-1">
                          <span>Target: <code className="text-slate-600 dark:text-slate-300 font-mono">{inv.accessType === 'Admin' ? '/admin' : '/staff'}</code></span>
                          <span>{inv.createdAt ? formatLagosDate(inv.createdAt) : 'Active'}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* 4. DISCREET ACTIVITY MONITORING TAB */}
        {/* ============================================================== */}
        {activeTab === 'discreet_monitoring' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-[#091747] dark:text-white flex items-center gap-2">
                <Eye className="text-amber-500" />
                Discreet Staff & Admin Activity Monitoring
              </h2>
              <p className="text-xs text-[#667085] dark:text-slate-400">
                Authoritative oversight portal. Employee is NOT alerted when their audit history is reviewed. Every inspection is silently recorded in the Restricted Oversight Log.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Personnel Selection Column */}
              <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-[#E0E4EE] dark:border-slate-700 space-y-3">
                <div className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Select Staff / Admin
                </div>

                <div className="relative">
                  <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={monitoredStaffSearch}
                    onChange={(e) => setMonitoredStaffSearch(e.target.value)}
                    placeholder="Search personnel..."
                    className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-hidden"
                  />
                </div>

                <div className="divide-y divide-slate-100 dark:divide-slate-700 max-h-96 overflow-y-auto">
                  {staffDirectory
                    .filter((s) =>
                      s.fullName.toLowerCase().includes(monitoredStaffSearch.toLowerCase()) ||
                      s.email.toLowerCase().includes(monitoredStaffSearch.toLowerCase()) ||
                      s.staffCode.toLowerCase().includes(monitoredStaffSearch.toLowerCase())
                    )
                    .map((staff) => (
                      <div
                        key={staff.id}
                        onClick={() => handleInspectStaffActivity(staff)}
                        className={`p-2.5 rounded-lg cursor-pointer transition-colors text-xs flex items-center justify-between ${
                          inspectedStaff?.id === staff.id
                            ? 'bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'
                        }`}
                      >
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                            <span>{staff.fullName}</span>
                            {staff.isLifetimeSuperAdmin && (
                              <span className="text-[9px] bg-amber-400 text-slate-950 px-1 rounded font-bold">
                                ROOT
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-500">{staff.roleTitle || staff.role}</div>
                        </div>
                        <ChevronRight size={14} className="text-slate-400" />
                      </div>
                    ))}
                </div>
              </div>

              {/* Inspected Activity Stream Column */}
              <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-6 rounded-xl border border-[#E0E4EE] dark:border-slate-700 space-y-4">
                {inspectedStaff ? (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-700">
                      <div>
                        <div className="text-xs text-slate-500 uppercase font-semibold">Active Monitoring Target</div>
                        <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                          <span>{inspectedStaff.fullName}</span>
                          <span className="text-xs font-mono font-normal text-slate-500">({inspectedStaff.staffCode})</span>
                        </h3>
                        <p className="text-xs text-slate-500">{inspectedStaff.email} · {inspectedStaff.phone}</p>
                      </div>

                      <div className="text-right text-xs">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                          Discreet Mode: Quiet Audit Active
                        </span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        Historical Operational Activity Events ({inspectedStaffLogs.length})
                      </div>

                      {inspectedStaffLogs.length === 0 ? (
                        <div className="p-8 text-center text-slate-400 text-xs bg-slate-50 dark:bg-slate-900 rounded-lg">
                          No audit activity records found for this employee yet.
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-96 overflow-y-auto">
                          {inspectedStaffLogs.map((log) => (
                            <div
                              key={log.id}
                              className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs space-y-1"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-[#091747] dark:text-blue-400">{log.action}</span>
                                <span className="text-[10px] text-slate-400 font-mono">
                                  {formatLagosDate(log.timestamp)}
                                </span>
                              </div>
                              <div className="text-slate-600 dark:text-slate-300 text-[11px]">
                                Module: {log.module}
                              </div>
                              <div className="text-slate-500 text-[11px]">
                                {log.details}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="p-12 text-center text-slate-400 text-xs">
                    Select an employee or administrator from the list on the left to review their operational activity history discreetly.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* 5. RESTRICTED OVERSIGHT LOGS TAB */}
        {/* ============================================================== */}
        {activeTab === 'oversight_logs' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-[#091747] dark:text-white flex items-center gap-2">
                <ShieldAlert className="text-purple-500" />
                Restricted Oversight Audit Logs
              </h2>
              <p className="text-xs text-[#667085] dark:text-slate-400">
                Confidential audit record of all supervisory oversight queries and inspections conducted by the Super Admin.
              </p>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl border border-[#E0E4EE] dark:border-slate-700 overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#0B2A5B] text-white font-bold uppercase tracking-wider text-[11px] border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="p-3">Log ID / Timestamp</th>
                      <th className="p-3">Auditor (Super Admin)</th>
                      <th className="p-3">Target Personnel</th>
                      <th className="p-3">Oversight Action</th>
                      <th className="p-3">Audit Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E0E4EE] dark:divide-slate-700">
                    {oversightLogs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-slate-400">
                          No restricted oversight inspections on record.
                        </td>
                      </tr>
                    ) : (
                      oversightLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                          <td className="p-3 font-mono">
                            <span className="font-bold text-slate-900 dark:text-white block">{log.id}</span>
                            <span className="text-[10px] text-slate-500">{formatLagosDate(log.timestamp)}</span>
                          </td>
                          <td className="p-3">
                            <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                              {log.superAdminName}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">{log.superAdminId}</span>
                          </td>
                          <td className="p-3">
                            <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                              {log.targetUserName}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">{log.targetUserId}</span>
                          </td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                              {log.action}
                            </span>
                          </td>
                          <td className="p-3 text-slate-600 dark:text-slate-300 text-[11px]">
                            {log.details}
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

        {/* ============================================================== */}
        {/* 6. TRANSACTIONS TAB */}
        {/* ============================================================== */}
        {activeTab === 'transactions' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-[#091747] dark:text-white">Live Transaction Journal</h2>
              <p className="text-xs text-[#667085] dark:text-slate-400">
                Authoritative transaction monitor. Click any entry to inspect double-entry balancing lines.
              </p>
            </div>

            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-[#E0E4EE] dark:border-slate-700 flex flex-wrap gap-3 items-center justify-between">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-slate-500 font-medium">Status:</span>
                {['ALL', 'SUCCESSFUL', 'PENDING', 'FAILED', 'REVERSED'].map((st) => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                      statusFilter === st
                        ? 'bg-[#263F91] text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>

              <div className="w-full sm:w-64">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={txSearch}
                    onChange={(e) => setTxSearch(e.target.value)}
                    placeholder="Search reference or account..."
                    className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-hidden focus:border-[#263F91]"
                  />
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl border border-[#E0E4EE] dark:border-slate-700 overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#0B2A5B] text-white font-bold uppercase tracking-wider text-[11px] border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="p-3">Reference / Date</th>
                      <th className="p-3">Type</th>
                      <th className="p-3">Source & Destination</th>
                      <th className="p-3">Amount</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Inspect</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E0E4EE] dark:divide-slate-700">
                    {filteredTransactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                        <td className="p-3 font-mono">
                          <span className="font-bold text-[#091747] dark:text-white block">{tx.reference}</span>
                          <span className="text-[10px] text-slate-500">{formatLagosDate(tx.timestamp)}</span>
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                            {tx.type}
                          </span>
                        </td>
                        <td className="p-3 font-mono text-[11px]">
                          <div>From: {tx.sourceAccountNumber || 'N/A'}</div>
                          <div>To: {tx.destinationAccountNumber || 'N/A'}</div>
                        </td>
                        <td className="p-3 font-bold font-mono text-sm text-[#091747] dark:text-white">
                          {formatNaira(tx.amountKobo)}
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              tx.status === 'SUCCESSFUL'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                : tx.status === 'REVERSED'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                : 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                            }`}
                          >
                            {tx.status}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => setInspectTx(tx)}
                            className="px-2.5 py-1 text-[11px] font-semibold bg-[#263F91] hover:bg-[#1d3175] text-white rounded cursor-pointer"
                          >
                            Inspect Ledger
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* 7. LEDGER TRIAL BALANCE TAB */}
        {/* ============================================================== */}
        {activeTab === 'ledger_reconciliation' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-[#091747] dark:text-white">General Ledger Trial Balance</h2>
              <p className="text-xs text-[#667085] dark:text-slate-400">
                Mathematical proof that cumulative Debits equal cumulative Credits across all journals.
              </p>
            </div>

            {reconciliation && (
              <div className="p-6 bg-white dark:bg-slate-800 rounded-xl border border-[#E0E4EE] dark:border-slate-700 space-y-4">
                <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={24} className="text-emerald-500" />
                    <div>
                      <div className="text-sm font-bold text-slate-900 dark:text-white">
                        Ledger Verification Status: BALANCED
                      </div>
                      <div className="text-xs text-slate-500">
                        {reconciliation.totalEntries} Posted Journal Entries Verified
                      </div>
                    </div>
                  </div>
                  <div className="text-right font-mono text-xs">
                    <div>Total Debits: {formatNaira(reconciliation.totalDebitsKobo)}</div>
                    <div>Total Credits: {formatNaira(reconciliation.totalCreditsKobo)}</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                  <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-lg space-y-1">
                    <div className="text-slate-500 font-bold uppercase">Net Imbalance</div>
                    <div className="text-lg font-black text-emerald-600 dark:text-emerald-400">₦0.00 (Zero Drift)</div>
                  </div>
                  <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-lg space-y-1">
                    <div className="text-slate-500 font-bold uppercase">Trial Balance Integrity</div>
                    <div className="text-lg font-black text-blue-600 dark:text-blue-400">100.00% Verified</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* 8. FRAUD RISK MONITORING TAB */}
        {/* ============================================================== */}
        {activeTab === 'fraud_risk' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-[#091747] dark:text-white">Fraud & Risk Monitoring</h2>
              <p className="text-xs text-[#667085] dark:text-slate-400">
                Rule-based AML flags, velocity monitoring, and suspicious activity alerts.
              </p>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl border border-[#E0E4EE] dark:border-slate-700 overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#0B2A5B] text-white font-bold uppercase tracking-wider text-[11px] border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="p-3">Alert ID / Timestamp</th>
                      <th className="p-3">Severity</th>
                      <th className="p-3">Account Number</th>
                      <th className="p-3">Trigger Description</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E0E4EE] dark:divide-slate-700">
                    {alerts.map((al) => (
                      <tr key={al.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                        <td className="p-3 font-mono">
                          <span className="font-bold text-slate-900 dark:text-white block">{al.id}</span>
                          <span className="text-[10px] text-slate-500">{formatLagosDate(al.timestamp)}</span>
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              al.severity === 'CRITICAL'
                                ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                                : al.severity === 'HIGH'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                            }`}
                          >
                            {al.severity}
                          </span>
                        </td>
                        <td className="p-3 font-mono font-bold text-slate-900 dark:text-white">
                          {al.accountNumber}
                        </td>
                        <td className="p-3 text-slate-700 dark:text-slate-300">{al.description || al.reason}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                            {al.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* 9. AUDIT TRAIL TAB */}
        {/* ============================================================== */}
        {activeTab === 'audit_trail' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-[#091747] dark:text-white">Institutional Audit Trail</h2>
              <p className="text-xs text-[#667085] dark:text-slate-400">
                Immutable, append-only chronological log of all banking operations and actor events.
              </p>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl border border-[#E0E4EE] dark:border-slate-700 overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#0B2A5B] text-white font-bold uppercase tracking-wider text-[11px] border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="p-3">Timestamp</th>
                      <th className="p-3">Actor / Role</th>
                      <th className="p-3">Action</th>
                      <th className="p-3">Target Entity</th>
                      <th className="p-3">IP Address</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E0E4EE] dark:divide-slate-700">
                    {audits.map((au) => (
                      <tr key={au.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                        <td className="p-3 font-mono text-[11px] text-slate-500">
                          {formatLagosDate(au.timestamp)}
                        </td>
                        <td className="p-3">
                          <span className="font-semibold text-slate-900 dark:text-white block">{au.actorName}</span>
                          <span className="text-[10px] text-slate-400">{au.actorRole}</span>
                        </td>
                        <td className="p-3 font-mono font-bold text-slate-800 dark:text-slate-200">{au.action}</td>
                        <td className="p-3 font-mono text-slate-600 dark:text-slate-400">
                          {au.entityType} ({au.entityId})
                        </td>
                        <td className="p-3 font-mono text-[11px] text-slate-500">{au.ipAddress}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* 10. CMS BRAND SETTINGS TAB */}
        {/* ============================================================== */}
        {activeTab === 'cms_settings' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-[#091747] dark:text-white">Institution Brand & Tariff Configuration</h2>
              <p className="text-xs text-[#667085] dark:text-slate-400">
                Institutional metadata, contact touchpoints, and dynamic programme interest tariffs.
              </p>
            </div>

            <form onSubmit={handleSaveCMS} className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-[#E0E4EE] dark:border-slate-700 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Institution Registered Name
                  </label>
                  <input
                    type="text"
                    value={bankNameInput}
                    onChange={(e) => setBankNameInput(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg dark:bg-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Official Slogan / Motto
                  </label>
                  <input
                    type="text"
                    value={sloganInput}
                    onChange={(e) => setSloganInput(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg dark:bg-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Institutional Hotline / Phone
                  </label>
                  <input
                    type="text"
                    value={hotlineInput}
                    onChange={(e) => setHotlineInput(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg dark:bg-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Corporate Head Office Address
                  </label>
                  <input
                    type="text"
                    value={headOfficeInput}
                    onChange={(e) => setHeadOfficeInput(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg dark:bg-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Savings Annual Interest Yield (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={savingsRateInput}
                    onChange={(e) => setSavingsRateInput(parseFloat(e.target.value))}
                    className="w-full text-xs px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg dark:bg-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    SME Loan Monthly Interest Rate (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={smeRateInput}
                    onChange={(e) => setSmeRateInput(parseFloat(e.target.value))}
                    className="w-full text-xs px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg dark:bg-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-700">
                {cmsSaved && <span className="text-xs text-emerald-600 font-bold">Settings saved successfully.</span>}
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-[#263F91] hover:bg-[#1d3175] text-white font-bold text-xs rounded-lg shadow-xs cursor-pointer ml-auto"
                >
                  Save CMS Configuration
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* MODAL 1: INSPECT TRANSACTION & DOUBLE-ENTRY LEDGER */}
      {/* ============================================================== */}
      {inspectTx && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Immutable Ledger Inspection: {inspectTx.reference}
              </h3>
              <button onClick={() => setInspectTx(null)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <div className="text-xs space-y-2 font-mono">
              <div>Amount: {formatNaira(inspectTx.amountKobo)}</div>
              <div>From: {inspectTx.sourceAccountNumber || 'N/A'} · To: {inspectTx.destinationAccountNumber || 'N/A'}</div>
              <div>Narration: {inspectTx.narration}</div>
              <div>Timestamp: {formatLagosDate(inspectTx.timestamp)}</div>
            </div>

            {linkedJournal ? (
              <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Journal Entry #{linkedJournal.id} Lines
                </div>
                <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-lg">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-900 font-bold">
                      <tr>
                        <th className="p-2">Account</th>
                        <th className="p-2">Direction</th>
                        <th className="p-2 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                      {linkedJournal.lines.map((l, idx) => (
                        <tr key={l.id || idx}>
                          <td className="p-2 font-mono">{l.accountNumber} ({l.accountName || 'Account'})</td>
                          <td className="p-2 font-bold">{l.direction}</td>
                          <td className="p-2 text-right font-mono font-bold">{formatNaira(l.amountKobo)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-400 italic">No attached journal entry.</div>
            )}

            {/* Reversal Workflow */}
            {inspectTx.status === 'SUCCESSFUL' && (
              <div className="pt-4 border-t border-slate-200 dark:border-slate-700 space-y-3">
                <div className="text-xs font-bold text-[#9F291E] uppercase flex items-center gap-1.5">
                  <AlertTriangle size={14} />
                  <span>Authorized Compensating Reversal Action</span>
                </div>
                <input
                  type="text"
                  value={reversalReason}
                  onChange={(e) => setReversalReason(e.target.value)}
                  placeholder="Regulatory reason for reversal..."
                  className="w-full text-xs px-3 py-2 border border-slate-300 dark:border-slate-700 rounded dark:bg-slate-900 dark:text-white"
                />
                {reversalMsg && (
                  <div className={`text-xs ${reversalMsg.type === 'success' ? 'text-emerald-600' : 'text-red-600'}`}>
                    {reversalMsg.text}
                  </div>
                )}
                <div className="flex justify-end gap-2">
                  <button
                    disabled={!reversalReason}
                    onClick={handleExecuteReversal}
                    className="px-4 py-2 text-xs font-bold uppercase text-white bg-red-700 hover:bg-red-800 disabled:bg-slate-400 rounded cursor-pointer"
                  >
                    Authorize Compensating Reversal
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 2: MONEY TRANSFER APPROVAL ACTIONS */}
      {/* ============================================================== */}
      {approvalModal && selectedTransfer && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {approvalModal === 'approve' && 'Authorize Money Transfer'}
                {approvalModal === 'reject' && 'Reject Money Transfer Request'}
                {approvalModal === 'execute' && 'Record Manual Execution Proof'}
              </h3>
              <button onClick={() => setApprovalModal(null)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl space-y-1 text-xs font-mono">
              <div>Ref: {selectedTransfer.reference}</div>
              <div>Customer: {selectedTransfer.customerName}</div>
              <div>Bank: {selectedTransfer.destinationDetails?.bankName || 'Direct Account'} · Acct: {selectedTransfer.destinationDetails?.accountNumber || selectedTransfer.accountNumber || 'N/A'}</div>
              <div className="text-sm font-bold text-[#091747] dark:text-white">
                Amount: {formatNaira(selectedTransfer.amountKobo)}
              </div>
            </div>

            {approvalModal === 'approve' && (
              <div className="space-y-3">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Approval Notes (Optional):
                </label>
                <textarea
                  rows={2}
                  value={approvalNotes}
                  onChange={(e) => setApprovalNotes(e.target.value)}
                  placeholder="e.g., Verified customer instruction via callback"
                  className="w-full text-xs p-2 border border-slate-300 dark:border-slate-700 rounded-lg dark:bg-slate-900 dark:text-white"
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setApprovalModal(null)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleApproveTransfer}
                    className="px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg cursor-pointer"
                  >
                    Confirm Approval
                  </button>
                </div>
              </div>
            )}

            {approvalModal === 'reject' && (
              <div className="space-y-3">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Mandatory Regulatory Reason for Rejection:
                </label>
                <textarea
                  rows={3}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Enter detailed reason (e.g. Mismatched account name, KYC tier limit exceeded)"
                  className="w-full text-xs p-2 border border-slate-300 dark:border-slate-700 rounded-lg dark:bg-slate-900 dark:text-white"
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setApprovalModal(null)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleRejectTransfer}
                    className="px-4 py-2 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-lg cursor-pointer"
                  >
                    Confirm Rejection
                  </button>
                </div>
              </div>
            )}

            {approvalModal === 'execute' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Physical Teller Number, NIP Session ID, or Cash Receipt Ref:
                  </label>
                  <input
                    type="text"
                    value={executionProof}
                    onChange={(e) => setExecutionProof(e.target.value)}
                    placeholder="e.g. NIP-9990142384918239 / TELLER-8831"
                    className="w-full text-xs p-2 border border-slate-300 dark:border-slate-700 rounded-lg dark:bg-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Execution Notes:
                  </label>
                  <textarea
                    rows={2}
                    value={executionNotes}
                    onChange={(e) => setExecutionNotes(e.target.value)}
                    placeholder="e.g. Paid out at Marina branch vault"
                    className="w-full text-xs p-2 border border-slate-300 dark:border-slate-700 rounded-lg dark:bg-slate-900 dark:text-white"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setApprovalModal(null)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleExecuteTransfer}
                    className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg cursor-pointer"
                  >
                    Mark Executed & Complete
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 3: APPOINT ADMIN MODAL (EXCLUSIVE TO SUPER ADMIN) */}
      {/* ============================================================== */}
      {showAdminModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ShieldCheck className="text-amber-500" />
                Appoint Administrator (Exclusive Privilege)
              </h3>
              <button onClick={() => setShowAdminModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            {adminAppointedSuccess ? (
              <div className="space-y-4 text-xs text-center py-2">
                <div className="w-14 h-14 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-600 flex items-center justify-center mx-auto">
                  <CheckCircle2 size={32} />
                </div>

                <div className="space-y-1">
                  <h4 className="text-base font-extrabold text-slate-900 dark:text-white">
                    Administrator Appointed & Code Issued
                  </h4>
                  <p className="text-slate-500 text-[11px]">
                    The Administrator invitation and single-use access code have been securely registered in the backend.
                  </p>
                </div>

                <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 text-left space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500">Appointed Administrator:</span>
                    <span className="font-bold text-slate-900 dark:text-white">{adminAppointedSuccess.fullName}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500">Official Email:</span>
                    <span className="font-mono text-slate-800 dark:text-slate-200">{adminAppointedSuccess.email}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500">Operational Responsibility:</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">{adminAppointedSuccess.duty}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500">Target Portal:</span>
                    <span className="font-mono text-purple-600 font-bold">{adminAppointedSuccess.portalRoute}</span>
                  </div>

                  <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <div>
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">Access Authorization Code</div>
                      <div className="text-sm font-black font-mono tracking-wider text-slate-900 dark:text-white">
                        {adminAppointedSuccess.accessCode}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(adminAppointedSuccess.accessCode);
                        setCopiedCode(true);
                        setTimeout(() => setCopiedCode(false), 2000);
                      }}
                      className="px-3 py-1.5 text-xs font-bold bg-[#2563EB] hover:bg-[#1E5BD8] text-white rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      {copiedCode ? <Check size={13} /> : <Copy size={13} />}
                      <span>{copiedCode ? 'Copied' : 'Copy Code'}</span>
                    </button>
                  </div>
                </div>

                <div className="p-2.5 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-lg text-blue-800 dark:text-blue-300 text-[10px] text-left">
                  Share this temporary authorization code with {adminAppointedSuccess.fullName}. It is valid for single-use access setup. Plaintext codes are never stored in the database.
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAdminAppointedSuccess(null);
                      setShowAdminModal(false);
                      loadData();
                    }}
                    className="w-full py-2.5 font-bold bg-[#091747] hover:bg-[#112469] text-white rounded-xl cursor-pointer transition-colors shadow-xs"
                  >
                    Done & Return to Directory
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreateAdmin} className="space-y-3 text-xs">
                {adminModalError && (
                  <div className="p-3 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
                    <AlertTriangle size={15} className="shrink-0" />
                    <span>{adminModalError}</span>
                  </div>
                )}

                <div>
                  <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Full Legal Name <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={newAdminForm.fullName}
                    onChange={(e) => setNewAdminForm({ ...newAdminForm, fullName: e.target.value })}
                    placeholder="e.g. Adebayo Ogunlesi"
                    className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-lg dark:bg-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-[#0B2A5B]"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Official Email Address <span className="text-red-500">*</span></label>
                  <input
                    type="email"
                    required
                    value={newAdminForm.email}
                    onChange={(e) => setNewAdminForm({ ...newAdminForm, email: e.target.value })}
                    placeholder="e.g. adebayo@teamacro.ng"
                    className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-lg dark:bg-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-[#0B2A5B]"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Phone Number <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={newAdminForm.phone}
                    onChange={(e) => setNewAdminForm({ ...newAdminForm, phone: e.target.value })}
                    placeholder="e.g. +234 802 000 1122"
                    className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-lg dark:bg-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-[#0B2A5B]"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Operational Responsibility</label>
                  <select
                    value={newAdminForm.operationalResponsibility || 'Admin / General Branch Administrator'}
                    onChange={(e) => setNewAdminForm({ ...newAdminForm, operationalResponsibility: e.target.value })}
                    className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded-lg dark:bg-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-[#0B2A5B] font-medium"
                  >
                    <option value="Admin / General Branch Administrator">Admin / General Branch Administrator</option>
                    <option value="Executive Administrator">Executive Administrator</option>
                    <option value="Credit & Risk Portfolio Oversight">Credit & Risk Portfolio Oversight</option>
                    <option value="Branch Operations Administrator">Branch Operations Administrator</option>
                    <option value="Compliance & Audit Administrator">Compliance & Audit Administrator</option>
                    <option value="Treasury & Ledger Administrator">Treasury & Ledger Administrator</option>
                    <option value="Operations Manager">Operations Manager</option>
                  </select>
                </div>

                {/* Set Access Code Field */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-semibold text-slate-700 dark:text-slate-300">
                      Set Access Code <span className="text-red-500">*</span>
                    </label>
                    <button
                      type="button"
                      disabled={generatingAdminCode}
                      onClick={handleGenerateAdminCode}
                      className="text-[11px] font-bold text-[#2563EB] hover:text-[#1E5BD8] flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw size={11} className={generatingAdminCode ? 'animate-spin' : ''} />
                      <span>Generate Code</span>
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showAdminCode ? 'text' : 'password'}
                      required
                      value={newAdminForm.accessCode}
                      onChange={(e) => setNewAdminForm({ ...newAdminForm, accessCode: e.target.value })}
                      placeholder="Enter a unique authorization code (min 6 characters)"
                      className="w-full p-2 pr-10 border border-slate-300 dark:border-slate-700 rounded-lg dark:bg-slate-900 dark:text-white font-mono text-xs focus:outline-hidden focus:ring-2 focus:ring-[#0B2A5B]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowAdminCode(!showAdminCode)}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                      title={showAdminCode ? 'Hide code' : 'Show code'}
                    >
                      {showAdminCode ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                {/* Confirm Access Code Field */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-semibold text-slate-700 dark:text-slate-300">
                      Confirm Access Code <span className="text-red-500">*</span>
                    </label>
                    {newAdminForm.confirmAccessCode && (
                      <span className={`text-[10px] font-bold flex items-center gap-0.5 ${
                        newAdminForm.accessCode === newAdminForm.confirmAccessCode ? 'text-emerald-600' : 'text-amber-600'
                      }`}>
                        {newAdminForm.accessCode === newAdminForm.confirmAccessCode ? (
                          <>
                            <Check size={11} />
                            <span>Codes Match</span>
                          </>
                        ) : (
                          <span>Codes do not match yet</span>
                        )}
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type={showAdminConfirmCode ? 'text' : 'password'}
                      required
                      value={newAdminForm.confirmAccessCode}
                      onChange={(e) => setNewAdminForm({ ...newAdminForm, confirmAccessCode: e.target.value })}
                      placeholder="Confirm access authorization code"
                      className={`w-full p-2 pr-10 border rounded-lg dark:bg-slate-900 dark:text-white font-mono text-xs focus:outline-hidden focus:ring-2 ${
                        newAdminForm.confirmAccessCode && newAdminForm.accessCode !== newAdminForm.confirmAccessCode
                          ? 'border-amber-400 focus:ring-amber-400'
                          : 'border-slate-300 dark:border-slate-700 focus:ring-[#0B2A5B]'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowAdminConfirmCode(!showAdminConfirmCode)}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                      title={showAdminConfirmCode ? 'Hide code' : 'Show code'}
                    >
                      {showAdminConfirmCode ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                {/* Mandatory Helper Text */}
                <p className="text-[11px] text-slate-500 dark:text-slate-400 italic">
                  Create a unique, temporary authorization code for this invitation. The invited person will use it to complete their access setup.
                </p>

                <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg text-amber-800 dark:text-amber-300 text-[11px]">
                  Admins hold supervisory authority to create ordinary staff and approve money transfers, but cannot appoint or revoke other Admins.
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAdminModal(false);
                      setAdminModalError(null);
                    }}
                    className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={adminModalLoading}
                    className="px-5 py-2 font-bold bg-[#091747] hover:bg-[#112469] text-white rounded-lg cursor-pointer flex items-center gap-2 shadow-xs transition-colors disabled:opacity-50"
                  >
                    {adminModalLoading && <RefreshCw size={13} className="animate-spin" />}
                    <span>Confirm Appointment & Issue Code</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 4: CREATE ORDINARY STAFF MODAL WITH ACCESS CODE */}
      {/* ============================================================== */}
      {showStaffModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#0B1536] rounded-2xl max-w-lg w-full p-6 sm:p-8 space-y-5 border border-slate-200 dark:border-[#1E2E64] shadow-2xl my-8">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-[#2563EB] flex items-center justify-center">
                  <UserPlus size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Onboard Staff Member
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Create operational staff account and assign verified backend access code
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowStaffModal(false);
                  setStaffModalError(null);
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-1"
              >
                <X size={18} />
              </button>
            </div>

            {staffModalError && (
              <div className="p-3 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
                <AlertTriangle size={15} className="shrink-0" />
                <span>{staffModalError}</span>
              </div>
            )}

            <form onSubmit={handleCreateStaff} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                  Full Legal Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newStaffForm.fullName}
                  onChange={(e) => setNewStaffForm({ ...newStaffForm, fullName: e.target.value })}
                  placeholder="e.g. Mary Okon"
                  className="w-full p-2.5 border border-slate-300 dark:border-slate-700 rounded-xl dark:bg-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-[#2563EB]"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                  Official Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={newStaffForm.email}
                  onChange={(e) => setNewStaffForm({ ...newStaffForm, email: e.target.value })}
                  placeholder="e.g. mary.okon@teamacro.ng"
                  className="w-full p-2.5 border border-slate-300 dark:border-slate-700 rounded-xl dark:bg-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-[#2563EB]"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                  Phone Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newStaffForm.phone}
                  onChange={(e) => setNewStaffForm({ ...newStaffForm, phone: e.target.value })}
                  placeholder="e.g. +234 803 777 8899"
                  className="w-full p-2.5 border border-slate-300 dark:border-slate-700 rounded-xl dark:bg-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-[#2563EB]"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                  Operational Responsibility / Duty <span className="text-red-500">*</span>
                </label>
                <select
                  value={newStaffForm.roleTitle}
                  onChange={(e) => setNewStaffForm({ ...newStaffForm, roleTitle: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 dark:border-slate-700 rounded-xl dark:bg-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-[#2563EB] font-medium"
                >
                  <option value="Customer Registration Officer">Customer Registration Officer</option>
                  <option value="Payment Collection Officer">Payment Collection Officer</option>
                  <option value="Loan Officer">Loan Officer</option>
                  <option value="Accounts Officer">Accounts Officer</option>
                  <option value="Operations Manager">Operations Manager</option>
                  <option value="Auditor / Read-Only User">Auditor / Read-Only User</option>
                </select>
                <p className="text-[10px] text-slate-400 mt-1">
                  Established duty determines functional permissions, transaction thresholds, and ledger authority.
                </p>
              </div>

              {/* Clearly Labelled Access Code Field */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-semibold text-slate-700 dark:text-slate-300">
                    Access Code <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    disabled={generatingStaffCode}
                    onClick={handleGenerateStaffCode}
                    className="text-[11px] font-bold text-[#2563EB] hover:text-[#1E5BD8] flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw size={11} className={generatingStaffCode ? 'animate-spin' : ''} />
                    <span>Generate Code</span>
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showStaffCode ? 'text' : 'password'}
                    required
                    value={newStaffForm.accessCode}
                    onChange={(e) => setNewStaffForm({ ...newStaffForm, accessCode: e.target.value })}
                    placeholder="Enter or assign access code (min 6 characters)"
                    className="w-full p-2.5 pr-10 border border-slate-300 dark:border-slate-700 rounded-xl dark:bg-slate-900 dark:text-white font-mono text-xs focus:outline-hidden focus:ring-2 focus:ring-[#2563EB]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowStaffCode(!showStaffCode)}
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    title={showStaffCode ? 'Hide code' : 'Show code'}
                  >
                    {showStaffCode ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 italic mt-1.5">
                  Create a unique, temporary authorization code for this invitation. The invited person will use it to complete their access setup.
                </p>
              </div>

              {/* Initial Password Field */}
              <div>
                <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                  Initial Password <span className="text-slate-400 font-normal">(Optional - defaults to access code if blank)</span>
                </label>
                <input
                  type="password"
                  value={newStaffForm.password}
                  onChange={(e) => setNewStaffForm({ ...newStaffForm, password: e.target.value })}
                  placeholder="Set initial password or leave blank to use access code"
                  className="w-full p-2.5 border border-slate-300 dark:border-slate-700 rounded-xl dark:bg-slate-900 dark:text-white text-xs focus:outline-hidden focus:ring-2 focus:ring-[#2563EB]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setShowStaffModal(false);
                    setStaffModalError(null);
                  }}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={staffModalLoading}
                  className="px-5 py-2.5 font-bold bg-[#091747] hover:bg-[#112469] text-white rounded-xl cursor-pointer flex items-center gap-2 shadow-xs transition-colors disabled:opacity-50"
                >
                  {staffModalLoading && <RefreshCw size={13} className="animate-spin" />}
                  <span>Create Staff Account</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ============================================================== */}
      {/* MODAL 6: GRANULAR OPERATIONAL PERMISSIONS CONFIGURATION */}
      {/* ============================================================== */}
      {showPermissionsModal && selectedUserForPerms && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#0B1536] rounded-2xl max-w-lg w-full p-6 sm:p-8 space-y-6 border border-slate-200 dark:border-[#1E2E64] shadow-2xl my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <SlidersHorizontal size={18} className="text-[#2563EB]" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Configure Granular Permissions
                </h3>
              </div>
              <button
                onClick={() => setShowPermissionsModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X size={18} />
              </button>
            </div>

            {/* Target Officer Summary */}
            <div className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-1 text-xs">
              <div className="font-bold text-slate-900 dark:text-white text-sm">
                {selectedUserForPerms.fullName}
              </div>
              <div className="text-slate-500 font-mono text-[11px]">
                {selectedUserForPerms.email} · Staff Code: {selectedUserForPerms.staffCode}
              </div>
              <div className="text-[11px] text-[#2563EB] font-semibold">
                Role: {selectedUserForPerms.roleTitle || selectedUserForPerms.role}
              </div>
            </div>

            {permMsg && (
              <div
                className={`p-3 rounded-xl text-xs flex items-center gap-2 border ${
                  permMsg.type === 'success'
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 text-emerald-800 dark:text-emerald-300'
                    : 'bg-red-50 dark:bg-red-950/60 border-red-300 text-red-800 dark:text-red-300'
                }`}
              >
                {permMsg.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                <span>{permMsg.text}</span>
              </div>
            )}

            {/* Permissions Checklist */}
            <div className="space-y-3 text-xs">
              <div className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[11px]">
                Authorized Action Matrix:
              </div>

              <div className="space-y-2">
                {[
                  {
                    key: 'manage_customers',
                    title: 'Customer Onboarding & KYC',
                    desc: 'Enroll new members, update contact details, and record identification documents.',
                  },
                  {
                    key: 'collect_payments',
                    title: 'Cash & Daily Ajo Collections',
                    desc: 'Receive member deposits, collect Daily Ajo contributions, and issue verified receipts.',
                  },
                  {
                    key: 'manage_loans',
                    title: 'Loan Processing & Evaluation',
                    desc: 'Submit loan applications, evaluate borrower eligibility, and record repayments.',
                  },
                  {
                    key: 'ledger_posting',
                    title: 'Ledger Posting & Accounts Reconciliation',
                    desc: 'Perform general ledger reconciliations and view double-entry journal balance lines.',
                  },
                  {
                    key: 'approve_transfers',
                    title: 'Money Transfer Approval & Disbursement',
                    desc: 'Approve and record proof for withdrawals, refunds, and loan disbursements (Admin required).',
                  },
                  {
                    key: 'audit_inspection',
                    title: 'Audit Trail Inspection & Monitoring',
                    desc: 'Inspect discreet oversight records and operational audit event history.',
                  },
                  {
                    key: 'cms_rates',
                    title: 'Interest Rates & CMS Brand Controls',
                    desc: 'Modify published interest rates and update institutional brand configuration.',
                  },
                ].map((perm) => (
                  <label
                    key={perm.key}
                    className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={!!editingPermissions[perm.key]}
                      onChange={(e) =>
                        setEditingPermissions({
                          ...editingPermissions,
                          [perm.key]: e.target.checked,
                        })
                      }
                      className="mt-0.5 rounded border-slate-300 text-[#2563EB] focus:ring-[#2563EB]"
                    />
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white">{perm.title}</div>
                      <div className="text-[11px] text-slate-500">{perm.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowPermissionsModal(false)}
                className="px-4 py-2 font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={permLoading}
                onClick={handleSavePermissions}
                className="px-5 py-2.5 font-bold bg-[#2563EB] hover:bg-[#1E5BD8] text-white rounded-xl cursor-pointer transition-colors flex items-center gap-1.5 shadow-sm"
              >
                {permLoading && <RefreshCw size={14} className="animate-spin" />}
                <span>Save Permissions</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
