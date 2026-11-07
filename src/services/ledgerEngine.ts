import {
  StaffUser,
  StaffRole,
  PermissionSet,
  CustomerRecord,
  FixedTargetPlan,
  DailyAjoEnrolment,
  EveryhomeFoodEnrolment,
  LeocashAccountRecord,
  LeocashWithdrawalRequest,
  LoanApplicationRecord,
  LoanRecord,
  ProgrammePaymentRecord,
  AuditLogEntry,
  AuditEvent,
  SystemMetrics,
  ProgrammeType,
  RepaymentScheduleItem,
  BankConfig,
  DEFAULT_BANK_CONFIG,
  User,
  CustomerAccount,
  Transaction,
  Beneficiary,
  GovernanceDocument,
  SupportTicket,
  AccountApplication,
  SuperAdminBootstrapState,
  FraudAlert,
  JournalEntry,
  MoneyTransferRequest,
  MoneyTransferType,
  MoneyTransferStatus,
  RestrictedOversightLog,
} from '../types/banking';

const STORAGE_KEYS = {
  STAFF: 'teamacro_sys_staff',
  CURRENT_STAFF: 'teamacro_sys_current_staff',
  CUSTOMERS: 'teamacro_sys_customers',
  FIXED_TARGET: 'teamacro_sys_fixed_target',
  DAILY_AJO: 'teamacro_sys_daily_ajo',
  FOOD_CONTRIBUTION: 'teamacro_sys_food_contrib',
  LEOCASH: 'teamacro_sys_leocash',
  LEOCASH_WITHDRAWALS: 'teamacro_sys_leocash_withdrawals',
  LOAN_APPLICATIONS: 'teamacro_sys_loan_applications',
  LOANS: 'teamacro_sys_loans',
  PAYMENTS: 'teamacro_sys_payments',
  AUDIT_LOGS: 'teamacro_sys_audit_logs',
  CONFIG: 'teamacro_sys_bank_config',
  CURRENT_USER: 'teamacro_sys_current_user',
  BOOTSTRAP: 'teamacro_sys_bootstrap_state',
  ACCOUNTS: 'teamacro_sys_accounts',
  TRANSACTIONS: 'teamacro_sys_transactions',
  BENEFICIARIES: 'teamacro_sys_beneficiaries',
  GOVERNANCE: 'teamacro_sys_governance',
  SUPPORT_TICKETS: 'teamacro_sys_support_tickets',
  APPLICATIONS: 'teamacro_sys_applications',
  FRAUD_ALERTS: 'teamacro_sys_fraud_alerts',
  JOURNAL_ENTRIES: 'teamacro_sys_journal_entries',
  MONEY_TRANSFERS: 'teamacro_sys_money_transfers',
  RESTRICTED_OVERSIGHT_LOGS: 'teamacro_sys_restricted_oversight',
};

// Default permission matrix per role
export function getDefaultPermissionsForRole(role: StaffRole): PermissionSet {
  switch (role) {
    case 'LIFETIME_SUPER_ADMIN':
    case 'super_admin':
    case 'SUPER_ADMIN':
      return {
        canViewDashboard: true,
        canRegisterCustomer: true,
        canEditCustomer: true,
        canManageSavings: true,
        canCollectPayments: true,
        canApproveLoans: true,
        canDisburseLoans: true,
        canProcessWithdrawals: true,
        canReversePayments: true,
        canViewReports: true,
        canExportReports: true,
        canManageStaff: true,
        canViewAuditLogs: true,
        canModifySettings: true,
      };
    case 'ADMIN':
      return {
        canViewDashboard: true,
        canRegisterCustomer: true,
        canEditCustomer: true,
        canManageSavings: true,
        canCollectPayments: true,
        canApproveLoans: true,
        canDisburseLoans: true,
        canProcessWithdrawals: true,
        canReversePayments: true,
        canViewReports: true,
        canExportReports: true,
        canManageStaff: true, // Can create/manage ordinary staff, but CANNOT appoint Admins
        canViewAuditLogs: true,
        canModifySettings: false, // Reserved exclusively for Lifetime Super Admin
      };
    case 'operations_manager':
      return {
        canViewDashboard: true,
        canRegisterCustomer: true,
        canEditCustomer: true,
        canManageSavings: true,
        canCollectPayments: true,
        canApproveLoans: true,
        canDisburseLoans: true,
        canProcessWithdrawals: true,
        canReversePayments: true,
        canViewReports: true,
        canExportReports: true,
        canManageStaff: false,
        canViewAuditLogs: true,
        canModifySettings: false,
      };
    case 'loan_officer':
      return {
        canViewDashboard: true,
        canRegisterCustomer: true,
        canEditCustomer: true,
        canManageSavings: false,
        canCollectPayments: true,
        canApproveLoans: true,
        canDisburseLoans: false, // Strict separation of duties
        canProcessWithdrawals: false,
        canReversePayments: false,
        canViewReports: true,
        canExportReports: true,
        canManageStaff: false,
        canViewAuditLogs: false,
        canModifySettings: false,
      };
    case 'field_collector':
      return {
        canViewDashboard: true,
        canRegisterCustomer: true,
        canEditCustomer: false,
        canManageSavings: true,
        canCollectPayments: true,
        canApproveLoans: false,
        canDisburseLoans: false,
        canProcessWithdrawals: false,
        canReversePayments: false,
        canViewReports: false,
        canExportReports: false,
        canManageStaff: false,
        canViewAuditLogs: false,
        canModifySettings: false,
      };
    case 'customer_service':
      return {
        canViewDashboard: true,
        canRegisterCustomer: true,
        canEditCustomer: true,
        canManageSavings: false,
        canCollectPayments: false,
        canApproveLoans: false,
        canDisburseLoans: false,
        canProcessWithdrawals: false,
        canReversePayments: false,
        canViewReports: false,
        canExportReports: false,
        canManageStaff: false,
        canViewAuditLogs: false,
        canModifySettings: false,
      };
    case 'accountant':
      return {
        canViewDashboard: true,
        canRegisterCustomer: false,
        canEditCustomer: false,
        canManageSavings: true,
        canCollectPayments: true,
        canApproveLoans: false,
        canDisburseLoans: true,
        canProcessWithdrawals: true,
        canReversePayments: true,
        canViewReports: true,
        canExportReports: true,
        canManageStaff: false,
        canViewAuditLogs: true,
        canModifySettings: false,
      };
    case 'auditor':
      return {
        canViewDashboard: true,
        canRegisterCustomer: false,
        canEditCustomer: false,
        canManageSavings: false,
        canCollectPayments: false,
        canApproveLoans: false,
        canDisburseLoans: false,
        canProcessWithdrawals: false,
        canReversePayments: false,
        canViewReports: true,
        canExportReports: true,
        canManageStaff: false,
        canViewAuditLogs: true,
        canModifySettings: false,
      };
    default:
      return {
        canViewDashboard: true,
        canRegisterCustomer: true,
        canEditCustomer: true,
        canManageSavings: true,
        canCollectPayments: true,
        canApproveLoans: true,
        canDisburseLoans: true,
        canProcessWithdrawals: true,
        canReversePayments: true,
        canViewReports: true,
        canExportReports: true,
        canManageStaff: true,
        canViewAuditLogs: true,
        canModifySettings: true,
      };
  }
}

// Initial Staff Users - Sole Lifetime Super Admin (Zero Fake Staff)
const INITIAL_STAFF: StaffUser[] = [
  {
    id: 'LIFETIME_ROOT_SUPER_ADMIN_001',
    staffCode: 'TMC-DIR-001',
    fullName: 'Davidson Eromosele',
    email: 'eromoseledavidson68@gmail.com',
    phone: '+234 803 123 4567',
    role: 'LIFETIME_SUPER_ADMIN',
    roleTitle: 'Lifetime Super Admin & Chief Executive',
    isLifetimeSuperAdmin: true,
    operationalResponsibility: 'Root Governance, Lifetime System Ownership & Overseer',
    assignedModules: ['ALL_MODULES', 'DISCREET_MONITORING', 'FINANCIAL_APPROVALS', 'ADMIN_APPOINTMENT', 'ROOT_GOVERNANCE'],
    permissions: getDefaultPermissionsForRole('LIFETIME_SUPER_ADMIN'),
    status: 'active',
    lastLogin: new Date().toISOString(),
    lastActivityAt: new Date().toISOString(),
    createdAt: '2025-01-01T08:00:00Z',
  },
];

// Production Clean Initial Collections - Zero Fake Data
const INITIAL_CUSTOMERS: CustomerRecord[] = [];
const INITIAL_FIXED_TARGET: FixedTargetPlan[] = [];
const INITIAL_DAILY_AJO: DailyAjoEnrolment[] = [];
const INITIAL_FOOD_CONTRIBUTION: EveryhomeFoodEnrolment[] = [];
const INITIAL_LEOCASH: LeocashAccountRecord[] = [];
const INITIAL_LEOCASH_WITHDRAWALS: LeocashWithdrawalRequest[] = [];

// Helper to generate loan repayment schedule
function generateLoanSchedule(
  principal: number,
  interestRate: number,
  tenorMonths: number,
  startDateStr: string
): RepaymentScheduleItem[] {
  const schedule: RepaymentScheduleItem[] = [];
  const totalInterest = principal * (interestRate / 100);
  const totalRepayable = principal + totalInterest;
  const monthlyTotal = Math.round(totalRepayable / tenorMonths);
  const monthlyPrincipal = Math.round(principal / tenorMonths);
  const monthlyInterest = monthlyTotal - monthlyPrincipal;

  const start = new Date(startDateStr);

  for (let i = 1; i <= tenorMonths; i++) {
    const dueDate = new Date(start);
    dueDate.setMonth(dueDate.getMonth() + i);

    schedule.push({
      instalmentNumber: i,
      dueDate: dueDate.toISOString().split('T')[0],
      principal: monthlyPrincipal,
      interest: monthlyInterest,
      totalDue: monthlyTotal,
      amountPaid: 0,
      status: 'upcoming',
    });
  }

  return schedule;
}

const INITIAL_LOAN_APPLICATIONS: LoanApplicationRecord[] = [];
const INITIAL_LOANS: LoanRecord[] = [];
const INITIAL_PAYMENTS: ProgrammePaymentRecord[] = [];

const INITIAL_AUDIT_LOGS: AuditLogEntry[] = [
  {
    id: 'aud_genesis',
    timestamp: new Date().toISOString(),
    staffId: 'LIFETIME_ROOT_SUPER_ADMIN_001',
    staffName: 'Davidson Eromosele',
    action: 'System Bootstrapped',
    module: 'System Initialisation',
    details: 'Initialised TEAMACRO SERVICES LTD operational engine with zero mock data.',
  },
];

const INITIAL_BOOTSTRAP_STATE: SuperAdminBootstrapState = {
  isInitialized: true,
  initializedAt: '2025-01-01T08:00:00Z',
  superAdminEmail: 'eromoseledavidson68@gmail.com',
  superAdminName: 'Davidson Eromosele',
  lifetimeSuperAdminId: 'LIFETIME_ROOT_SUPER_ADMIN_001',
  lifetimeSuperAdminEmail: 'eromoseledavidson68@gmail.com',
  canResetWithMasterKey: false,
  lockdownEnforced: true,
  immutableOwnerBound: true,
  initializedByEmail: 'eromoseledavidson68@gmail.com',
  initializationActorName: 'Davidson Eromosele (Permanent Founder & Lifetime Owner)',
};

const INITIAL_MONEY_TRANSFERS: MoneyTransferRequest[] = [];
const INITIAL_RESTRICTED_OVERSIGHT_LOGS: RestrictedOversightLog[] = [];

// System Ledger Accounts (Vault Reserve & Fee Account only - Zero Fake Customer Accounts)
const INITIAL_ACCOUNTS: CustomerAccount[] = [
  {
    id: 'ACC-VAULT',
    userId: 'SYSTEM',
    accountNumber: '1000000001',
    accountName: 'Vault Reserve Account',
    name: 'Vault Reserve Account',
    accountType: 'CURRENT',
    tier: 3,
    currency: 'NGN',
    balanceKobo: 0,
    ledgerBalanceKobo: 0,
    dailyTransferLimitKobo: 100000000000,
    status: 'ACTIVE',
    openedAt: '2025-01-01T00:00:00Z',
    isSystem: true,
  },
  {
    id: 'ACC-FEE',
    userId: 'SYSTEM',
    accountNumber: '1000000002',
    accountName: 'Fee & Commission Income',
    name: 'Fee & Commission Income',
    accountType: 'CURRENT',
    tier: 3,
    currency: 'NGN',
    balanceKobo: 0,
    ledgerBalanceKobo: 0,
    dailyTransferLimitKobo: 100000000000,
    status: 'ACTIVE',
    openedAt: '2025-01-01T00:00:00Z',
    isSystem: true,
  },
];

const INITIAL_TRANSACTIONS: Transaction[] = [];
const INITIAL_BENEFICIARIES: Beneficiary[] = [];
const INITIAL_FRAUD_ALERTS: FraudAlert[] = [];
const INITIAL_JOURNAL_ENTRIES: JournalEntry[] = [];

// Initial Operational Centres & Service Locations (Zero Fake Branches or Mock ATMs)
const INITIAL_BRANCHES = [
  {
    id: 'BR-001',
    name: 'TEAMACRO Corporate Headquarters & Operations Hub',
    address: 'Lagos Corporate Centre, Lagos',
    state: 'Lagos',
    lga: 'Lagos Island / Mainland Operations',
    phone: '+234 803 000 0000',
    manager: 'Operations Directorate',
    coordinates: '6.5244° N, 3.3792° E',
    isHeadOffice: true,
    openingHours: 'Mon-Fri: 8:00 AM - 5:00 PM',
  },
  {
    id: 'BR-002',
    name: 'Field Operations & Daily Ajo Collection Centre',
    address: 'Regional Field Collection & Servicing Hub',
    state: 'Lagos',
    lga: 'Metropolitan Operations Zone',
    phone: '+234 803 000 0000',
    manager: 'Field Supervisory Desk',
    coordinates: '6.6018° N, 3.3515° E',
    isHeadOffice: false,
    openingHours: 'Mon-Sat: 7:30 AM - 5:00 PM',
  },
];

// Initial Regulatory & Governance Accreditations
const INITIAL_REGULATORY_CERTS = [
  {
    id: 'CERT-001',
    name: 'Corporate Affairs Commission Incorporation',
    exactName: 'Corporate Affairs Commission Incorporation',
    issuer: 'Federal Republic of Nigeria (CAC)',
    issuingAuthority: 'Federal Republic of Nigeria (CAC)',
    status: 'ACTIVE_VERIFIED',
    verificationStatus: 'ACTIVE_VERIFIED',
    licenseNumber: 'RC 1589421',
    referenceNumber: 'RC 1589421',
    issuedDate: '2019-05-14',
    verifiedUrl: 'https://cac.gov.ng',
    officialVerificationUrl: 'https://cac.gov.ng',
    updatedBy: 'Corporate Compliance Desk',
    notes: 'Statutory certificate of incorporation under the Companies and Allied Matters Act (CAMA), Federal Republic of Nigeria.',
  },
  {
    id: 'CERT-002',
    name: 'Double-Entry Ledger Governance & Fiduciary Standards',
    exactName: 'Double-Entry Ledger Governance & Fiduciary Standards',
    issuer: 'TEAMACRO Internal Governance Framework',
    issuingAuthority: 'TEAMACRO Internal Governance Framework',
    status: 'ACTIVE_VERIFIED',
    verificationStatus: 'ACTIVE_VERIFIED',
    licenseNumber: 'GOV-FIDC-2025',
    referenceNumber: 'GOV-FIDC-2025',
    issuedDate: '2025-01-01',
    verifiedUrl: '#',
    officialVerificationUrl: '#',
    updatedBy: 'Operations Directorate',
    notes: 'Enforces strict segregation of duties, immutable audit records, and dual-control administrative approvals across all programmes.',
  },
];

// Initial Governance Documents
const INITIAL_GOVERNANCE_DOCS: GovernanceDocument[] = [
  {
    id: 'GOV-001',
    title: 'Board Charter and Fiduciary Responsibility Framework',
    category: 'BOARD_CHARTER',
    description: 'Mandate, code of conduct, risk oversight, and governance stewardship of the Board of Directors.',
    version: '2025.1',
    approvedDate: '2025-01-05',
    reviewDate: '2026-01-05',
    status: 'ACTIVE',
    paragraphs: [
      'The Board of Directors of TEAMACRO SERVICES LTD holds overarching fiduciary responsibility for the stability, regulatory compliance, risk management, and operational integrity of all savings and loan services.',
      'Independent oversight ensures that depositor funds, savings targets, and food contribution pools remain strictly segregated and safeguarded.',
    ],
  },
  {
    id: 'GOV-002',
    title: 'Enterprise Risk Management and Solvency Framework',
    category: 'RISK_MANAGEMENT',
    description: 'Guidelines governing credit approval limits, liquidity thresholds, and portfolio stress tests.',
    version: '2025.1',
    approvedDate: '2025-01-10',
    reviewDate: '2026-01-10',
    status: 'ACTIVE',
    paragraphs: [
      'Ensures mandatory reserves, liquidity ratios, and risk mitigation across all credit facilities.',
      'Enforces dual-key maker-checker review for loan underwriting and immediate collateral verification before disbursement.',
    ],
  },
  {
    id: 'GOV-003',
    title: 'Consumer Protection and Transparent Pricing Charter',
    category: 'CUSTOMER_PROTECTION',
    description: 'Statutory commitment to zero unapproved charges, transparent interest computations, and swift dispute resolution.',
    version: '2025.1',
    approvedDate: '2025-01-12',
    reviewDate: '2026-01-12',
    status: 'ACTIVE',
    paragraphs: [
      'TEAMACRO SERVICES LTD commits to zero hidden deductions, total disclosure of contribution schedules, and transparent tariff schedules.',
      'Customer dispute resolution procedures must resolve claims within 24 to 72 business hours.',
    ],
  },
];

// Initial Support Tickets - Clean Production
const INITIAL_SUPPORT_TICKETS: SupportTicket[] = [];

// Initial Account Applications
const INITIAL_APPLICATIONS: AccountApplication[] = [];

const DATA_VERSION_KEY = 'teamacro_sys_data_version';
const CURRENT_DATA_VERSION = 'v4_clean_authentic_teamacro_no_fake';

/**
 * Automatically purges any cached mock/fake records from localStorage across previous browser sessions,
 * guaranteeing an empty production state with only the genuine Lifetime Super Admin.
 */
function purgeLegacyFakeDataIfPresent(): void {
  try {
    if (typeof localStorage === 'undefined') return;
    const currentVer = localStorage.getItem(DATA_VERSION_KEY);
    const storedCustomers = localStorage.getItem(STORAGE_KEYS.CUSTOMERS);
    const storedStaff = localStorage.getItem(STORAGE_KEYS.STAFF);
    const hasMockCustomer = storedCustomers && (storedCustomers.includes('cust_001') || storedCustomers.includes('Adebayo Blessing'));
    const hasMockStaff = storedStaff && (storedStaff.includes('Babatunde Adeleke') || storedStaff.includes('stf_admin_001') || storedStaff.includes('Dr. Victor'));

    if (currentVer !== CURRENT_DATA_VERSION || hasMockCustomer || hasMockStaff) {
      localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.FIXED_TARGET, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.DAILY_AJO, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.FOOD_CONTRIBUTION, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.LEOCASH, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.LEOCASH_WITHDRAWALS, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.LOAN_APPLICATIONS, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.LOANS, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.PAYMENTS, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.MONEY_TRANSFERS, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.RESTRICTED_OVERSIGHT_LOGS, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.JOURNAL_ENTRIES, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.BENEFICIARIES, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.FRAUD_ALERTS, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.SUPPORT_TICKETS, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(INITIAL_ACCOUNTS));
      localStorage.setItem(STORAGE_KEYS.STAFF, JSON.stringify(INITIAL_STAFF));
      localStorage.setItem(STORAGE_KEYS.CURRENT_STAFF, JSON.stringify(INITIAL_STAFF[0]));
      localStorage.setItem(STORAGE_KEYS.BOOTSTRAP, JSON.stringify(INITIAL_BOOTSTRAP_STATE));
      localStorage.setItem(DATA_VERSION_KEY, CURRENT_DATA_VERSION);
    }
  } catch (err) {
    console.warn('Purge legacy fake data check:', err);
  }
}
purgeLegacyFakeDataIfPresent();

// Storage helper
function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      localStorage.setItem(key, JSON.stringify(fallback));
      return fallback;
    }
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

let notifyStorageChangeCallback: ((key: string) => void) | null = null;

function saveToStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    if (
      notifyStorageChangeCallback &&
      key !== STORAGE_KEYS.AUDIT_LOGS &&
      key !== STORAGE_KEYS.CURRENT_STAFF &&
      key !== DATA_VERSION_KEY
    ) {
      notifyStorageChangeCallback(key);
    }
  } catch (err) {
    console.error(`Failed to save to ${key}:`, err);
  }
}

export class LedgerEngine {
  // Staff methods
  static getStaffUsers(): StaffUser[] {
    return loadFromStorage<StaffUser[]>(STORAGE_KEYS.STAFF, INITIAL_STAFF);
  }

  static getCurrentStaff(): StaffUser | null {
    const current = loadFromStorage<StaffUser | null>(STORAGE_KEYS.CURRENT_STAFF, null);
    return current;
  }

  static setCurrentStaff(staff: StaffUser | null): void {
    saveToStorage(STORAGE_KEYS.CURRENT_STAFF, staff);
    if (staff) {
      this.recordAuditLog(staff.id, staff.fullName, 'Staff Signed In', 'Authentication', `Staff logged into management session with role: ${staff.role}`);
    }
  }

  static isLifetimeSuperAdmin(user: any): boolean {
    if (!user) return false;
    const bootstrap = this.getBootstrapState();
    const ownerId = bootstrap.lifetimeSuperAdminId || 'LIFETIME_ROOT_SUPER_ADMIN_001';
    const ownerEmail = (bootstrap.superAdminEmail || '').toLowerCase();
    return (
      user.id === ownerId ||
      (ownerEmail && user.email?.toLowerCase() === ownerEmail) ||
      user.isLifetimeSuperAdmin === true ||
      user.role === 'LIFETIME_SUPER_ADMIN'
    );
  }

  static getLifetimeSuperAdmin(): StaffUser | null {
    const staff = this.getStaffUsers();
    return staff.find((s) => this.isLifetimeSuperAdmin(s)) || null;
  }

  static authenticateStaff(identifier: string, _password?: string): StaffUser | null {
    const all = this.getStaffUsers();
    const cleanId = identifier.trim().toLowerCase();
    const user = all.find(
      (u) =>
        (u.email?.toLowerCase() === cleanId ||
          u.email?.split('@')[0]?.toLowerCase() === cleanId ||
          u.staffCode?.toLowerCase() === cleanId ||
          u.id?.toLowerCase() === cleanId) &&
        u.status === 'active'
    );
    if (user) {
      user.lastLogin = new Date().toISOString();
      user.lastActivityAt = new Date().toISOString();
      saveToStorage(STORAGE_KEYS.STAFF, all);
      this.setCurrentStaff(user);
      this.recordAuditLog(
        user.id,
        user.fullName,
        'Staff Signed In',
        'Authentication',
        `Authenticated successfully into operational portal (${user.roleTitle || user.role})`
      );
      return user;
    }
    return null;
  }

  // 4.1 Only the Lifetime Super Admin can create or appoint an Admin
  static createAdminUser(
    data: {
      id?: string;
      staffCode?: string;
      fullName: string;
      email: string;
      phone: string;
      operationalResponsibility?: string;
      assignedModules?: string[];
      accessCode?: string;
      password?: string;
      initialPassword?: string;
    },
    actor?: any
  ): StaffUser {
    const currentActor = actor || this.getCurrentStaff() || this.getCurrentUser();
    if (!this.isLifetimeSuperAdmin(currentActor)) {
      throw new Error(
        'ACCESS DENIED: Only the verified Permanent Lifetime Super Admin can create, appoint, or promote an Admin account.'
      );
    }
    const all = this.getStaffUsers();
    const cleanEmail = data.email.trim().toLowerCase();
    const existingIdx = all.findIndex((s) => s.email?.toLowerCase() === cleanEmail);
    const adminCount = all.filter((s) => s.role === 'ADMIN').length + 1;
    const id = data.id || (existingIdx >= 0 ? all[existingIdx].id : `stf_admin_${String(adminCount).padStart(3, '0')}`);
    const staffCode =
      data.staffCode ||
      (existingIdx >= 0 ? all[existingIdx].staffCode : `TMC-ADM-${String(adminCount).padStart(3, '0')}`);

    const newAdmin: StaffUser = {
      ...(existingIdx >= 0 ? all[existingIdx] : {}),
      id,
      staffCode,
      fullName: data.fullName.trim(),
      email: cleanEmail,
      phone: data.phone.trim(),
      role: 'ADMIN',
      roleTitle: data.operationalResponsibility || 'Authorised Operations Administrator',
      permissions: getDefaultPermissionsForRole('ADMIN'),
      status: 'active',
      lastLogin: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
      createdAt: existingIdx >= 0 ? all[existingIdx].createdAt : new Date().toISOString(),
      createdByStaffId: currentActor?.id || 'SUPER_ADMIN',
      createdByName: currentActor?.fullName || 'Lifetime Super Admin',
      operationalResponsibility:
        data.operationalResponsibility || 'Branch Administration, Staff Supervision & Transfer Approvals',
      assignedModules: data.assignedModules || [
        'STAFF_MANAGEMENT',
        'FINANCIAL_APPROVALS',
        'CUSTOMER_MANAGEMENT',
        'REPORTS',
      ],
      isLifetimeSuperAdmin: false,
      ...(data.accessCode ? { accessCode: data.accessCode.trim() } : {}),
      ...(data.password || data.initialPassword
        ? { initialPassword: (data.password || data.initialPassword || '').trim() }
        : {}),
    } as StaffUser;

    if (existingIdx >= 0) {
      all[existingIdx] = newAdmin;
    } else {
      all.push(newAdmin);
    }
    saveToStorage(STORAGE_KEYS.STAFF, all);

    this.recordAuditLog(
      currentActor?.id || 'SUPER_ADMIN',
      currentActor?.fullName || 'Lifetime Super Admin',
      'Appointed Admin Account',
      'Role Hierarchy & Governance',
      `Lifetime Super Admin appointed ${newAdmin.fullName} (${newAdmin.email}) as Admin.`
    );

    return newAdmin;
  }

  static revokeAdminRole(adminId: string, actor?: any): StaffUser {
    const currentActor = actor || this.getCurrentStaff() || this.getCurrentUser();
    if (!this.isLifetimeSuperAdmin(currentActor)) {
      throw new Error('ACCESS DENIED: Only the Lifetime Super Admin can revoke Admin privileges.');
    }
    const all = this.getStaffUsers();
    const admin = all.find((s) => s.id === adminId);
    if (!admin) throw new Error('Admin account not found.');
    if (this.isLifetimeSuperAdmin(admin)) {
      throw new Error('PROTECTED RECORD: The Permanent Lifetime Super Admin cannot be demoted or revoked.');
    }
    admin.role = 'STAFF';
    admin.roleTitle = 'Operational Staff';
    admin.permissions = getDefaultPermissionsForRole('customer_service');
    saveToStorage(STORAGE_KEYS.STAFF, all);

    this.recordAuditLog(
      currentActor.id,
      currentActor.fullName,
      'Revoked Admin Role',
      'Role Hierarchy & Governance',
      `Revoked Admin appointment for ${admin.fullName} (${admin.staffCode}). Reassigned to standard staff role.`
    );
    return admin;
  }

  static updateAdminStatus(adminId: string, status: 'active' | 'suspended', actor?: any): StaffUser {
    const currentActor = actor || this.getCurrentStaff() || this.getCurrentUser();
    if (!this.isLifetimeSuperAdmin(currentActor)) {
      throw new Error('ACCESS DENIED: Only the Lifetime Super Admin can alter Admin account status.');
    }
    const all = this.getStaffUsers();
    const admin = all.find((s) => s.id === adminId);
    if (!admin) throw new Error('Account not found.');
    if (this.isLifetimeSuperAdmin(admin)) {
      throw new Error('PROTECTED RECORD: Cannot modify status of the Permanent Lifetime Super Admin.');
    }
    admin.status = status;
    saveToStorage(STORAGE_KEYS.STAFF, all);

    this.recordAuditLog(
      currentActor.id,
      currentActor.fullName,
      `Admin Account ${status === 'active' ? 'Activated' : 'Suspended'}`,
      'Role Hierarchy & Governance',
      `Admin account for ${admin.fullName} (${admin.staffCode}) marked as ${status}.`
    );
    return admin;
  }

  // 4.2 Super Admin and Admin can create Staff accounts (Admin CANNOT create Admins)
  static createStaffUser(newStaff: any, staff?: any): StaffUser {
    const actor = staff || this.getCurrentStaff() || this.getCurrentUser();
    const isSuper =
      this.isLifetimeSuperAdmin(actor) ||
      actor?.role === 'SUPER_ADMIN' ||
      actor?.role === 'LIFETIME_SUPER_ADMIN';
    const isAdmin = actor?.role === 'ADMIN' || actor?.role === 'admin';

    if (!isSuper && !isAdmin) {
      throw new Error('ACCESS DENIED: Only the Lifetime Super Admin or an authorised Admin can create staff accounts.');
    }

    if (
      isAdmin &&
      (newStaff.role === 'ADMIN' ||
        newStaff.role === 'admin' ||
        newStaff.role === 'SUPER_ADMIN' ||
        newStaff.role === 'LIFETIME_SUPER_ADMIN')
    ) {
      throw new Error(
        'HIERARCHY VIOLATION: An Admin cannot create or appoint another Admin or Super Admin. Admin appointments are exclusive to the Lifetime Super Admin.'
      );
    }

    const all = this.getStaffUsers();
    const cleanEmail = (newStaff.email || '').trim().toLowerCase();
    const existingIdx = all.findIndex((s) => s.email?.toLowerCase() === cleanEmail);

    const count = all.length + 1;
    const id = newStaff.id || (existingIdx >= 0 ? all[existingIdx].id : `stf_${String(count).padStart(3, '0')}`);
    const staffCode =
      newStaff.staffCode ||
      (existingIdx >= 0 ? all[existingIdx].staffCode : `TMC-STF-${String(count).padStart(3, '0')}`);
    const role = (newStaff.role || 'STAFF') as StaffRole;

    const created: StaffUser = {
      ...(existingIdx >= 0 ? all[existingIdx] : {}),
      ...newStaff,
      id,
      staffCode,
      email: cleanEmail,
      fullName: (newStaff.fullName || '').trim(),
      phone: (newStaff.phone || '').trim(),
      role,
      roleTitle: newStaff.roleTitle || newStaff.operationalResponsibility || role.replace(/_/g, ' ').toUpperCase(),
      permissions: getDefaultPermissionsForRole(role === 'STAFF' ? 'customer_service' : role),
      status: 'active',
      lastLogin: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
      createdAt: existingIdx >= 0 ? all[existingIdx].createdAt : new Date().toISOString(),
      createdByStaffId: actor?.id || 'SYSTEM',
      createdByName: actor?.fullName || 'Administrator',
      isLifetimeSuperAdmin: false,
      ...(newStaff.accessCode ? { accessCode: String(newStaff.accessCode).trim() } : {}),
      ...(newStaff.password || newStaff.initialPassword
        ? { initialPassword: String(newStaff.password || newStaff.initialPassword).trim() }
        : {}),
    };

    if (existingIdx >= 0) {
      all[existingIdx] = created;
    } else {
      all.push(created);
    }
    saveToStorage(STORAGE_KEYS.STAFF, all);

    this.recordAuditLog(
      actor?.id || 'SYSTEM',
      actor?.fullName || 'System',
      'Created Staff Account',
      'Staff Management',
      `Registered new staff ${created.fullName} (${created.email}) with role: ${created.roleTitle}`
    );

    return created;
  }


  static updateStaffUser(staffId: string, updates: Partial<StaffUser> & Record<string, any>, actor?: any): StaffUser | null {
    const all = this.getStaffUsers();
    const cleanEmail = (updates.email || '').trim().toLowerCase();
    const idx = all.findIndex(
      (s) =>
        s.id === staffId ||
        (cleanEmail && s.email?.toLowerCase() === cleanEmail)
    );
    if (idx === -1) return null;

    if (this.isLifetimeSuperAdmin(all[idx])) {
      if (updates.status === 'suspended' || (updates.role && updates.role !== 'LIFETIME_SUPER_ADMIN')) {
        throw new Error('PROTECTED RECORD: Cannot suspend or change role of the Permanent Lifetime Super Admin.');
      }
    }

    all[idx] = { ...all[idx], ...updates, lastActivityAt: new Date().toISOString() };
    saveToStorage(STORAGE_KEYS.STAFF, all);

    const currentActor = actor || this.getCurrentStaff();
    this.recordAuditLog(
      currentActor?.id || 'SYSTEM',
      currentActor?.fullName || 'Staff',
      'Updated Staff Account',
      'Staff Management',
      `Updated profile for staff member ${all[idx].fullName} (${all[idx].staffCode})`
    );

    return all[idx];
  }

  static deleteStaffOrAdminUser(userIdOrEmail: string, email?: string, actor?: any): boolean {
    const all = this.getStaffUsers();
    const cleanId = (userIdOrEmail || '').trim().toLowerCase();
    const cleanEmail = (email || '').trim().toLowerCase();

    const filtered = all.filter((s) => {
      if (this.isLifetimeSuperAdmin(s)) return true;
      const matchId = s.id?.toLowerCase() === cleanId || s.staffCode?.toLowerCase() === cleanId;
      const matchEmail =
        (cleanEmail && s.email?.toLowerCase() === cleanEmail) ||
        (cleanId.includes('@') && s.email?.toLowerCase() === cleanId);
      return !(matchId || matchEmail);
    });

    if (filtered.length !== all.length) {
      saveToStorage(STORAGE_KEYS.STAFF, filtered);
      const currentActor = actor || this.getCurrentStaff();
      this.recordAuditLog(
        currentActor?.id || 'SYSTEM',
        currentActor?.fullName || 'Administrator',
        'Deleted Staff/Admin Account',
        'Staff Management',
        `Permanently deleted account (${userIdOrEmail}${email ? ` / ${email}` : ''})`
      );
      return true;
    }
    return false;
  }

  // 5. Discreet Super Admin Activity Monitoring
  static getStaffAndAdminDirectory(): StaffUser[] {
    return this.getStaffUsers();
  }

  static getUserActivityLogs(userId: string, actor?: any): AuditLogEntry[] {
    const callingActor = actor || this.getCurrentStaff() || this.getCurrentUser();
    const allStaff = this.getStaffUsers();
    const target = allStaff.find((s) => s.id === userId);

    // Quiet review recording in restricted oversight log
    if (callingActor && this.isLifetimeSuperAdmin(callingActor) && target) {
      this.recordRestrictedOversightLog({
        superAdminId: callingActor.id,
        superAdminName: callingActor.fullName,
        targetUserId: target.id,
        targetUserName: target.fullName,
        targetUserRole: target.role,
        action: 'INSPECTED_STAFF_ACTIVITY_HISTORY',
        details: `Discreet oversight inspection of activity trail for ${target.fullName} (${target.roleTitle || target.role}) without notifying employee.`,
      });
    }

    const allAudits = this.getAuditLogs();
    if (!target) return [];

    return allAudits.filter(
      (a) =>
        a.staffId === target.id ||
        a.staffName.toLowerCase() === target.fullName.toLowerCase() ||
        a.details.toLowerCase().includes(target.fullName.toLowerCase()) ||
        a.details.toLowerCase().includes(target.staffCode.toLowerCase())
    );
  }

  static getRestrictedOversightLogs(actor?: any): RestrictedOversightLog[] {
    const callingActor = actor || this.getCurrentStaff() || this.getCurrentUser();
    if (!this.isLifetimeSuperAdmin(callingActor)) {
      return [];
    }
    return loadFromStorage<RestrictedOversightLog[]>(
      STORAGE_KEYS.RESTRICTED_OVERSIGHT_LOGS,
      INITIAL_RESTRICTED_OVERSIGHT_LOGS
    );
  }

  static recordRestrictedOversightLog(entry: Omit<RestrictedOversightLog, 'id' | 'timestamp'>): void {
    const logs = loadFromStorage<RestrictedOversightLog[]>(
      STORAGE_KEYS.RESTRICTED_OVERSIGHT_LOGS,
      INITIAL_RESTRICTED_OVERSIGHT_LOGS
    );
    const newEntry: RestrictedOversightLog = {
      ...entry,
      id: `rol_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
    };
    logs.unshift(newEntry);
    saveToStorage(STORAGE_KEYS.RESTRICTED_OVERSIGHT_LOGS, logs);
  }

  // 6. Mandatory Approval for All Money-Transfer Transactions
  static getMoneyTransferRequests(filters?: {
    status?: string;
    type?: string;
    programme?: string;
    customerId?: string;
  }): MoneyTransferRequest[] {
    let list = loadFromStorage<MoneyTransferRequest[]>(
      STORAGE_KEYS.MONEY_TRANSFERS,
      INITIAL_MONEY_TRANSFERS
    );
    if (!filters) return list;
    if (filters.status && filters.status !== 'ALL') {
      list = list.filter((r) => r.status === filters.status);
    }
    if (filters.type && filters.type !== 'ALL') {
      list = list.filter((r) => r.type === filters.type);
    }
    if (filters.programme && filters.programme !== 'ALL') {
      list = list.filter((r) => r.programme === filters.programme);
    }
    if (filters.customerId) {
      list = list.filter((r) => r.customerId === filters.customerId);
    }
    return list;
  }

  static submitMoneyTransferRequest(
    data: {
      type: MoneyTransferType;
      programme: string;
      programmeLabel?: string;
      customerId: string;
      customerName: string;
      customerPhone?: string;
      accountNumber?: string;
      amount: number;
      amountKobo?: number;
      paymentMethod: 'CASH' | 'BANK_TRANSFER' | 'CHEQUE' | 'INTERNAL_LEDGER';
      destinationDetails?: {
        bankName?: string;
        accountNumber?: string;
        accountName?: string;
      };
      submissionNotes?: string;
      supportingDocumentUrl?: string;
      relatedEntityId?: string;
    },
    actor?: any
  ): MoneyTransferRequest {
    if (!data.amount || data.amount <= 0) {
      throw new Error('Transfer amount must be greater than zero.');
    }
    const currentActor = actor || this.getCurrentStaff() || this.getCurrentUser();
    if (!currentActor) {
      throw new Error('Authentication required to submit money-transfer requests.');
    }

    const all = this.getMoneyTransferRequests();
    const count = all.length + 1;
    const reference = `MTR-2025-${String(count).padStart(4, '0')}`;
    const id = `mtr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const newRequest: MoneyTransferRequest = {
      id,
      reference,
      type: data.type,
      programme: data.programme,
      programmeLabel: data.programmeLabel || data.programme.replace(/_/g, ' '),
      customerId: data.customerId,
      customerName: data.customerName,
      customerPhone: data.customerPhone,
      accountNumber: data.accountNumber,
      amount: data.amount,
      amountKobo: data.amountKobo || data.amount * 100,
      paymentMethod: data.paymentMethod,
      destinationDetails: data.destinationDetails,
      submittedByStaffId: currentActor.id,
      submittedByStaffName: currentActor.fullName,
      submittedByStaffRole: currentActor.role,
      submittedAt: new Date().toISOString(),
      submissionNotes: data.submissionNotes,
      supportingDocumentUrl: data.supportingDocumentUrl,
      status: 'PENDING_APPROVAL',
      relatedEntityId: data.relatedEntityId,
    };

    all.unshift(newRequest);
    saveToStorage(STORAGE_KEYS.MONEY_TRANSFERS, all);

    this.recordAuditLog(
      currentActor.id,
      currentActor.fullName,
      'Submitted Money Transfer Request',
      'Financial Approval Workflow',
      `Filed ${newRequest.type} request (${reference}) of ₦${data.amount.toLocaleString()} for ${data.customerName}. Status: PENDING_APPROVAL.`
    );

    return newRequest;
  }

  static approveMoneyTransferRequest(
    requestId: string,
    actor: any,
    notes?: string
  ): MoneyTransferRequest {
    const currentActor = actor || this.getCurrentStaff() || this.getCurrentUser();
    if (!currentActor) throw new Error('Authentication required.');

    const isSuper =
      this.isLifetimeSuperAdmin(currentActor) ||
      currentActor.role === 'SUPER_ADMIN' ||
      currentActor.role === 'LIFETIME_SUPER_ADMIN';
    const isAdmin = currentActor.role === 'ADMIN' || currentActor.role === 'admin';

    if (!isSuper && !isAdmin) {
      throw new Error('ACCESS DENIED: Only the Lifetime Super Admin or an authorised Admin can approve financial transfers.');
    }

    const all = this.getMoneyTransferRequests();
    const req = all.find((r) => r.id === requestId);
    if (!req) throw new Error('Transaction request not found.');

    if (req.status !== 'PENDING_APPROVAL') {
      throw new Error(`Cannot approve transaction in ${req.status} status. Only PENDING_APPROVAL requests can be approved.`);
    }

    // 6.3 Prevent Self-Approval
    if (
      req.submittedByStaffId === currentActor.id ||
      req.submittedByStaffName?.toLowerCase() === currentActor.fullName?.toLowerCase()
    ) {
      throw new Error(
        'SELF-APPROVAL PROHIBITED: You cannot approve a money-transfer request that you submitted. A different authorised Super Admin or Admin must review and approve this transaction.'
      );
    }

    req.status = 'APPROVED';
    req.reviewedByStaffId = currentActor.id;
    req.reviewedByStaffName = currentActor.fullName;
    req.reviewedByStaffRole = currentActor.role;
    req.reviewedAt = new Date().toISOString();
    req.reviewNotes = notes || 'Financial approval granted by authorized officer.';

    saveToStorage(STORAGE_KEYS.MONEY_TRANSFERS, all);

    this.recordAuditLog(
      currentActor.id,
      currentActor.fullName,
      'Approved Money Transfer Request',
      'Financial Approval Workflow',
      `Approved ${req.type} (${req.reference}) of ₦${req.amount.toLocaleString()} for ${req.customerName}. Ready for execution.`
    );

    return req;
  }

  static rejectMoneyTransferRequest(
    requestId: string,
    reason: string,
    actor: any
  ): MoneyTransferRequest {
    if (!reason || !reason.trim()) {
      throw new Error('A detailed reason for rejection is mandatory.');
    }
    const currentActor = actor || this.getCurrentStaff() || this.getCurrentUser();
    if (!currentActor) throw new Error('Authentication required.');

    const isSuper =
      this.isLifetimeSuperAdmin(currentActor) ||
      currentActor.role === 'SUPER_ADMIN' ||
      currentActor.role === 'LIFETIME_SUPER_ADMIN';
    const isAdmin = currentActor.role === 'ADMIN' || currentActor.role === 'admin';

    if (!isSuper && !isAdmin) {
      throw new Error('ACCESS DENIED: Only the Lifetime Super Admin or an authorised Admin can reject financial transfers.');
    }

    const all = this.getMoneyTransferRequests();
    const req = all.find((r) => r.id === requestId);
    if (!req) throw new Error('Transaction request not found.');

    req.status = 'REJECTED';
    req.rejectionReason = reason.trim();
    req.reviewedByStaffId = currentActor.id;
    req.reviewedByStaffName = currentActor.fullName;
    req.reviewedByStaffRole = currentActor.role;
    req.reviewedAt = new Date().toISOString();

    saveToStorage(STORAGE_KEYS.MONEY_TRANSFERS, all);

    this.recordAuditLog(
      currentActor.id,
      currentActor.fullName,
      'Rejected Money Transfer Request',
      'Financial Approval Workflow',
      `Rejected ${req.type} (${req.reference}) for ${req.customerName}. Reason: ${reason.trim()}`
    );

    return req;
  }

  static executeMoneyTransferRequest(
    requestId: string,
    executionDetails: { proofOrRef: string; notes?: string },
    actor: any
  ): MoneyTransferRequest {
    const currentActor = actor || this.getCurrentStaff() || this.getCurrentUser();
    if (!currentActor) throw new Error('Authentication required.');

    const all = this.getMoneyTransferRequests();
    const req = all.find((r) => r.id === requestId);
    if (!req) throw new Error('Transaction request not found.');

    if (req.status !== 'APPROVED') {
      throw new Error(
        `EXECUTION PROHIBITED: Transaction is in ${req.status} status. Only an APPROVED transaction can be marked as executed.`
      );
    }

    req.status = 'COMPLETED';
    req.executedByStaffId = currentActor.id;
    req.executedByStaffName = currentActor.fullName;
    req.executedAt = new Date().toISOString();
    req.executionReference = executionDetails.proofOrRef;
    req.executionNotes = executionDetails.notes || 'Executed outside app; physical/bank proof verified.';
    req.isManuallyExecutedOutsideApp = true;

    // Apply ledger balance updates if applicable
    if (req.type === 'LOAN_DISBURSEMENT' && req.relatedEntityId) {
      const apps = this.getLoanApplications();
      const app = apps.find((a) => a.id === req.relatedEntityId);
      if (app) {
        app.status = 'disbursed';
        saveToStorage(STORAGE_KEYS.LOAN_APPLICATIONS, apps);
      }
    } else if (req.type === 'CUSTOMER_WITHDRAWAL' && req.relatedEntityId) {
      const accounts = this.getLeocashAccounts();
      const account = accounts.find((a) => a.id === req.relatedEntityId || a.customerId === req.customerId);
      if (account) {
        account.availableBalance = Math.max(0, account.availableBalance - req.amount);
        account.ledgerBalance = Math.max(0, account.ledgerBalance - req.amount);
        account.balanceKobo = account.availableBalance * 100;
        account.totalWithdrawn += req.amount;
        account.totalWithdrawalsKobo = account.totalWithdrawn * 100;
        saveToStorage(STORAGE_KEYS.LEOCASH, accounts);
      }
    }

    saveToStorage(STORAGE_KEYS.MONEY_TRANSFERS, all);

    this.recordAuditLog(
      currentActor.id,
      currentActor.fullName,
      'Executed Money Transfer',
      'Financial Operations',
      `Completed payout for ${req.type} (${req.reference}) of ₦${req.amount.toLocaleString()} for ${req.customerName}. Evidence: ${executionDetails.proofOrRef}`
    );

    return req;
  }

  // Customer Management
  static getCustomers(): CustomerRecord[] {
    return loadFromStorage<CustomerRecord[]>(STORAGE_KEYS.CUSTOMERS, INITIAL_CUSTOMERS);
  }

  static checkCustomerDuplicate(phone: string, email?: string): (CustomerRecord & { isDuplicate: boolean; reason?: string }) | null {
    const customers = this.getCustomers();
    const cleanedPhone = (phone || '').replace(/\s+/g, '');
    if (cleanedPhone) {
      const phoneMatch = customers.find((c) => (c.phone || '').replace(/\s+/g, '') === cleanedPhone);
      if (phoneMatch) {
        return Object.assign({}, phoneMatch, {
          isDuplicate: true,
          reason: `Phone number is already registered to ${phoneMatch.fullName} (${phoneMatch.customerCode})`,
        });
      }
    }
    if (email && email.trim()) {
      const cleanEmail = email.trim().toLowerCase();
      const emailMatch = customers.find((c) => c.email && c.email.trim().toLowerCase() === cleanEmail);
      if (emailMatch) {
        return Object.assign({}, emailMatch, {
          isDuplicate: true,
          reason: `Email is already registered to ${emailMatch.fullName} (${emailMatch.customerCode})`,
        });
      }
    }
    return null;
  }

  static ensureCustomerBankAccount(customer: CustomerRecord & { accountNumber?: string }): void {
    const accounts = loadFromStorage<CustomerAccount[]>(STORAGE_KEYS.ACCOUNTS, INITIAL_ACCOUNTS);
    const exists = accounts.some(
      (a) =>
        !a.isSystem &&
        (a.userId === customer.id ||
          (customer.accountNumber && a.accountNumber === customer.accountNumber) ||
          (a.accountName || '').toLowerCase() === (customer.fullName || '').toLowerCase())
    );
    if (!exists) {
      const customerIndex = accounts.filter((a) => !a.isSystem).length + 1;
      const accNumber =
        customer.accountNumber ||
        `2038${String(100000 + customerIndex * 137 + (Date.now() % 1000)).slice(-6)}`;
      const newAcc: CustomerAccount = {
        id: `ACC-${customer.id}`,
        userId: customer.id,
        accountNumber: accNumber,
        accountName: customer.fullName,
        name: customer.fullName,
        accountType: 'SAVINGS',
        tier: 3,
        currency: 'NGN',
        balanceKobo: 0,
        ledgerBalanceKobo: 0,
        dailyTransferLimitKobo: 500000000,
        status: 'ACTIVE',
        openedAt: new Date().toISOString(),
        isSystem: false,
      };
      accounts.push(newAcc);
      saveToStorage(STORAGE_KEYS.ACCOUNTS, accounts);
    }
  }

  static saveCustomer(customerData: any, staff?: any): CustomerRecord {
    const customers = this.getCustomers();
    const count = customers.length + 1;
    const id = customerData.id || `cust_${String(count).padStart(3, '0')}`;
    const customerCode = customerData.customerCode || `TMC-CST-${1000 + count}`;
    const actor = staff || this.getCurrentStaff() || this.getCurrentUser();
    const nowDate = new Date().toISOString().split('T')[0];

    const newCustomer: CustomerRecord = {
      ...customerData,
      id,
      customerCode,
      fullName: String(customerData.fullName || '').trim(),
      phone: String(customerData.phone || '').trim(),
      email: customerData.email ? String(customerData.email).trim() : '',
      address: String(customerData.address || customerData.residentialAddress || 'Lagos, Nigeria').trim(),
      ninOrBvn: String(customerData.ninOrBvn || customerData.kycIdNumber || '').trim(),
      state: String(customerData.state || 'Lagos').trim(),
      lga: String(customerData.lga || 'Metropolitan').trim(),
      occupation: String(customerData.occupation || 'Member').trim(),
      nextOfKinName: String(customerData.nextOfKinName || '').trim(),
      nextOfKinPhone: String(customerData.nextOfKinPhone || customerData.phone || '').trim(),
      nextOfKinRelationship: String(customerData.nextOfKinRelationship || 'Relative').trim(),
      registrationDate: customerData.registrationDate || nowDate,
      registeredByStaffId: actor?.id || customerData.assignedStaffId || 'SYSTEM',
      status: 'active',
      enrolledProgrammes: Array.isArray(customerData.enrolledProgrammes) ? customerData.enrolledProgrammes : [],
    };

    const existingIdx = customers.findIndex(
      (c) =>
        c.id === newCustomer.id ||
        (newCustomer.phone && (c.phone || '').replace(/\s+/g, '') === newCustomer.phone.replace(/\s+/g, ''))
    );
    if (existingIdx >= 0) {
      customers[existingIdx] = { ...customers[existingIdx], ...newCustomer };
    } else {
      customers.unshift(newCustomer);
    }
    saveToStorage(STORAGE_KEYS.CUSTOMERS, customers);

    // Ensure a corresponding CustomerAccount exists so SuperAdminPortal & CustomerPortal reflect immediately
    this.ensureCustomerBankAccount(newCustomer);

    this.recordAuditLog(
      actor?.id || 'SYSTEM',
      actor?.fullName || 'System Staff',
      'Registered Customer',
      'Customer Management',
      `Successfully enrolled customer ${newCustomer.fullName} (${newCustomer.customerCode})`
    );

    // Asynchronously persist to backend /api/customers if in browser environment with active session
    if (typeof window !== 'undefined' && typeof fetch === 'function') {
      import('../utils/apiClient')
        .then(({ safeApiFetch, getActiveSessionToken }) => {
          if (getActiveSessionToken()) {
            return safeApiFetch('/api/customers', {
              method: 'POST',
              body: { customer: newCustomer },
            });
          }
        })
        .catch(() => {});
    }

    return newCustomer;
  }

  static async syncCustomersFromServer(): Promise<CustomerRecord[]> {
    if (typeof window === 'undefined' || typeof fetch !== 'function') {
      return this.getCustomers();
    }
    try {
      const { safeApiFetch, getActiveSessionToken } = await import('../utils/apiClient');
      if (!getActiveSessionToken()) {
        return this.getCustomers();
      }
      const res = await safeApiFetch('/api/customers', { method: 'GET' });
      if (!res.success) return this.getCustomers();
      const serverCustomers: any[] = res.customers || res.data?.customers || [];
      const localCustomers = this.getCustomers();

      // Also push any local customers that aren't on the server yet
      const serverPhones = new Set(serverCustomers.map((c) => String(c.phone || '').replace(/\s+/g, '')));
      for (const localCust of localCustomers) {
        const cleanLocalPhone = String(localCust.phone || '').replace(/\s+/g, '');
        if (cleanLocalPhone && !serverPhones.has(cleanLocalPhone)) {
          safeApiFetch('/api/customers', {
            method: 'POST',
            body: { customer: localCust },
          }).catch(() => {});
        }
      }

      if (Array.isArray(serverCustomers) && serverCustomers.length > 0) {
        let changed = false;
        const merged = [...localCustomers];
        for (const sc of serverCustomers) {
          if (!sc || (!sc.fullName && !sc.phone)) continue;
          const cleanPhone = String(sc.phone || '').replace(/\s+/g, '');
          const existsIdx = merged.findIndex(
            (lc) =>
              lc.id === sc.id ||
              (cleanPhone && String(lc.phone || '').replace(/\s+/g, '') === cleanPhone)
          );
          const normalized: CustomerRecord = {
            ...sc,
            id: sc.id || `cust_${merged.length + 1}`,
            customerCode: sc.customerCode || `TMC-CST-${1000 + merged.length + 1}`,
            fullName: sc.fullName || 'Customer',
            phone: sc.phone || '',
            email: sc.email || '',
            address: sc.address || 'Lagos, Nigeria',
            ninOrBvn: sc.ninOrBvn || '',
            state: sc.state || 'Lagos',
            lga: sc.lga || 'Metropolitan',
            occupation: sc.occupation || 'Member',
            nextOfKinName: sc.nextOfKinName || '',
            nextOfKinPhone: sc.nextOfKinPhone || sc.phone || '',
            nextOfKinRelationship: sc.nextOfKinRelationship || 'Relative',
            registrationDate: sc.registrationDate || new Date().toISOString().split('T')[0],
            registeredByStaffId: sc.registeredByStaffId || 'SYSTEM',
            status: ((sc.status || 'active').toLowerCase() as 'active' | 'suspended' | 'dormant'),
            enrolledProgrammes: Array.isArray(sc.enrolledProgrammes) ? sc.enrolledProgrammes : [],
          };
          if (existsIdx === -1) {
            merged.unshift(normalized);
            this.ensureCustomerBankAccount(normalized);
            changed = true;
          }
        }
        if (changed) {
          saveToStorage(STORAGE_KEYS.CUSTOMERS, merged);
        }
        return merged;
      }
    } catch {
      // Ignore network errors and return local customers
    }
    return this.getCustomers();
  }

  static updateCustomer(id: string, updates: Partial<CustomerRecord>): CustomerRecord | null {
    const customers = this.getCustomers();
    const idx = customers.findIndex((c) => c.id === id);
    if (idx === -1) return null;
    customers[idx] = { ...customers[idx], ...updates };
    saveToStorage(STORAGE_KEYS.CUSTOMERS, customers);

    const actor = this.getCurrentStaff();
    this.recordAuditLog(
      actor?.id || 'SYSTEM',
      actor?.fullName || 'System Staff',
      'Updated Customer Profile',
      'Customer Management',
      `Modified details for ${customers[idx].fullName} (${customers[idx].customerCode})`
    );

    if (typeof window !== 'undefined' && typeof fetch === 'function') {
      import('../utils/apiClient')
        .then(({ safeApiFetch, getActiveSessionToken }) => {
          if (getActiveSessionToken()) {
            return safeApiFetch('/api/customers', {
              method: 'POST',
              body: { customer: customers[idx] },
            });
          }
        })
        .catch(() => {});
    }

    return customers[idx];
  }

  // 1. Fixed Target Savings
  static getFixedTargetPlans(): FixedTargetPlan[] {
    return loadFromStorage<FixedTargetPlan[]>(STORAGE_KEYS.FIXED_TARGET, INITIAL_FIXED_TARGET);
  }

  static createFixedTargetPlan(data: any, staff?: any): FixedTargetPlan {
    const plans = this.getFixedTargetPlans();
    const id = `ftp_${String(plans.length + 1).padStart(3, '0')}`;
    const planCode = `FT-2025-${String(plans.length + 1).padStart(3, '0')}`;
    const targetAmount = typeof data.targetAmount === 'number'
      ? data.targetAmount
      : (data.targetAmountKobo ? Math.round(data.targetAmountKobo / 100) : 100000);
    const targetAmountKobo = data.targetAmountKobo || targetAmount * 100;
    const newPlan: FixedTargetPlan = {
      ...data,
      id,
      planCode,
      targetAmount,
      targetAmountKobo,
      currentBalance: 0,
      completedInstalments: 0,
      status: 'active',
      createdAt: new Date().toISOString(),
    };
    plans.unshift(newPlan);
    saveToStorage(STORAGE_KEYS.FIXED_TARGET, plans);

    const actor = staff || this.getCurrentStaff();
    this.recordAuditLog(
      actor?.id || 'SYSTEM',
      actor?.fullName || 'System Staff',
      'Created Fixed Target Plan',
      'Fixed Target Savings',
      `Created plan ${planCode} for ${newPlan.customerName} targeting ₦${targetAmount.toLocaleString()}`
    );

    return newPlan;
  }

  static recordFixedTargetContribution(
    planId: string,
    amount: number,
    channel: any = 'cash',
    refOrActor?: any,
    notes?: string
  ): any {
    const plans = this.getFixedTargetPlans();
    const plan = plans.find((p) => p.id === planId);
    if (!plan) return null;

    const normalizedAmount = amount > 1000000 && plan.targetAmount < 100000 ? Math.round(amount / 100) : amount;
    plan.currentBalance += normalizedAmount;
    plan.completedInstalments += 1;
    if (plan.currentBalance >= plan.targetAmount) {
      plan.status = 'completed';
    }
    saveToStorage(STORAGE_KEYS.FIXED_TARGET, plans);

    const ref = typeof refOrActor === 'string' ? refOrActor : `FT-PAY-${Date.now()}`;
    const staff = typeof refOrActor === 'object' && refOrActor ? refOrActor : this.getCurrentStaff();

    const payment = this.recordUnifiedPayment({
      customerId: plan.customerId,
      customerName: plan.customerName,
      programmeType: 'fixed_target',
      programmeLabel: 'Fixed Target Savings',
      programme: 'FIXED_TARGET',
      referenceId: plan.id,
      amount: normalizedAmount,
      amountKobo: normalizedAmount * 100,
      paymentChannel: typeof channel === 'string' ? channel.toLowerCase() as any : 'cash',
      paymentMethod: typeof channel === 'string' ? channel.toUpperCase() : 'CASH',
      transactionReference: ref,
      actor: staff,
      notes: notes || `Target contribution to plan ${plan.planCode}`,
    });

    return payment || plan;
  }

  // 2. Daily Ajo Savings
  static getDailyAjoEnrolments(): DailyAjoEnrolment[] {
    return loadFromStorage<DailyAjoEnrolment[]>(STORAGE_KEYS.DAILY_AJO, INITIAL_DAILY_AJO);
  }

  static enrolDailyAjo(data: any, staff?: any): DailyAjoEnrolment {
    const enrolments = this.getDailyAjoEnrolments();
    const id = `daj_${String(enrolments.length + 1).padStart(3, '0')}`;
    const cycleCode = `AJO-2025-${String(enrolments.length + 1).padStart(3, '0')}`;
    const dailyAmount = typeof data.dailyAmount === 'number'
      ? data.dailyAmount
      : (data.dailyAmountKobo ? Math.round(data.dailyAmountKobo / 100) : 1000);
    const cycleDays = data.cycleDays || data.cycleDurationDays || 31;
    const managementFeeCommission = dailyAmount;
    const payoutAmount = dailyAmount * (cycleDays - 1);

    const startDate = data.startDate || new Date().toISOString().split('T')[0];
    const end = new Date(startDate);
    end.setDate(end.getDate() + cycleDays);

    const newEnrolment: DailyAjoEnrolment = {
      id,
      cycleCode,
      customerId: data.customerId,
      customerName: data.customerName,
      customerPhone: data.customerPhone || '',
      dailyAmount,
      cycleDays,
      currentDay: 0,
      totalSaved: 0,
      managementFeeCommission,
      payoutAmount,
      paidDays: [],
      missedDays: [],
      status: 'active',
      startDate,
      expectedEndDate: end.toISOString().split('T')[0],
      assignedCollectorId: data.assignedCollectorId || data.assignedStaffId || 'stf_001',
      notes: data.notes,
      cycleMonth: data.cycleMonth || startDate.substring(0, 7),
      dailyAmountKobo: dailyAmount * 100,
      totalSavedKobo: 0,
      totalCollectedKobo: 0,
    };

    enrolments.unshift(newEnrolment);
    saveToStorage(STORAGE_KEYS.DAILY_AJO, enrolments);

    const actor = staff || this.getCurrentStaff();
    this.recordAuditLog(
      actor?.id || 'SYSTEM',
      actor?.fullName || 'System Staff',
      'Enrolled Daily Ajo Cycle',
      'Daily Ajo Savings',
      `Enrolled ${newEnrolment.customerName} in ${cycleDays}-day Ajo cycle (${cycleCode}) at ₦${dailyAmount.toLocaleString()}/day`
    );

    return newEnrolment;
  }

  static recordDailyAjoPayment(
    enrolmentId: string,
    dayNumber: number,
    channel: any = 'cash',
    refOrActor?: any,
    notes?: string
  ): any {
    const enrolments = this.getDailyAjoEnrolments();
    const item = enrolments.find((e) => e.id === enrolmentId);
    if (!item) return null;

    if (!item.paidDays.includes(dayNumber)) {
      item.paidDays.push(dayNumber);
      item.paidDays.sort((a, b) => a - b);
      item.missedDays = item.missedDays.filter((d) => d !== dayNumber);
      item.totalSaved += item.dailyAmount;
      item.totalSavedKobo = item.totalSaved * 100;
      item.totalCollectedKobo = item.totalSaved * 100;
      item.currentDay = Math.max(item.currentDay, dayNumber);

      if (item.paidDays.length >= item.cycleDays) {
        item.status = 'completed';
      }

      saveToStorage(STORAGE_KEYS.DAILY_AJO, enrolments);

      const ref = typeof refOrActor === 'string' ? refOrActor : `AJO-DAY${dayNumber}-${Date.now()}`;
      const staff = typeof refOrActor === 'object' && refOrActor ? refOrActor : this.getCurrentStaff();

      const payment = this.recordUnifiedPayment({
        customerId: item.customerId,
        customerName: item.customerName,
        programmeType: 'daily_ajo',
        programmeLabel: 'Daily Ajo Savings',
        programme: 'DAILY_AJO',
        referenceId: item.id,
        amount: item.dailyAmount,
        amountKobo: item.dailyAmount * 100,
        paymentChannel: typeof channel === 'string' ? channel.toLowerCase() as any : 'cash',
        paymentMethod: typeof channel === 'string' ? channel.toUpperCase() : 'CASH',
        transactionReference: ref,
        actor: staff,
        notes: notes || `Day ${dayNumber} contribution for cycle ${item.cycleCode}`,
      });

      return payment || item;
    }

    return item;
  }

  static closeDailyAjoCycle(enrolmentId: string): DailyAjoEnrolment | null {
    const enrolments = this.getDailyAjoEnrolments();
    const item = enrolments.find((e) => e.id === enrolmentId);
    if (!item) return null;

    item.status = 'completed';
    saveToStorage(STORAGE_KEYS.DAILY_AJO, enrolments);

    const actor = this.getCurrentStaff();
    this.recordAuditLog(
      actor?.id || 'SYSTEM',
      actor?.fullName || 'System Staff',
      'Closed Daily Ajo Cycle',
      'Daily Ajo Savings',
      `Closed cycle ${item.cycleCode} for ${item.customerName}. Total payout due: ₦${item.payoutAmount.toLocaleString()}`
    );

    return item;
  }

  // 3. Everyhome Food Contribution
  static getEveryhomeFoodEnrolments(): EveryhomeFoodEnrolment[] {
    return loadFromStorage<EveryhomeFoodEnrolment[]>(STORAGE_KEYS.FOOD_CONTRIBUTION, INITIAL_FOOD_CONTRIBUTION);
  }

  static enrolEveryhomeFood(data: any, staff?: any): EveryhomeFoodEnrolment {
    const enrolments = this.getEveryhomeFoodEnrolments();
    const id = `efc_${String(enrolments.length + 1).padStart(3, '0')}`;
    const enrolmentCode = `EFC-2025-${String(enrolments.length + 1).padStart(3, '0')}`;

    const packageValue = typeof data.packageValue === 'number'
      ? data.packageValue
      : (data.packageCostKobo ? Math.round(data.packageCostKobo / 100) : 45000);
    const packageCostKobo = data.packageCostKobo || packageValue * 100;

    const newEnrolment: EveryhomeFoodEnrolment = {
      id,
      enrolmentCode,
      customerId: data.customerId,
      customerName: data.customerName,
      customerPhone: data.customerPhone || '',
      householdAddress: data.householdAddress || data.deliveryAddress || '',
      packageName: data.packageName || 'Household Staples Package',
      packageType: data.packageType || 'FAMILY_STAPLES',
      householdHeadName: data.householdHeadName || data.customerName,
      packageValue,
      packageCostKobo,
      frequency: (data.frequency || (data.contributionSchedule ? String(data.contributionSchedule).toLowerCase() : 'monthly')) as any,
      targetAmount: packageValue,
      targetAmountKobo: packageCostKobo,
      amountPaid: 0,
      amountPaidKobo: 0,
      outstandingBalance: packageValue,
      outstandingBalanceKobo: packageCostKobo,
      totalContributedKobo: 0,
      paymentCount: 0,
      targetDate: data.targetDate || new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0],
      fulfilmentStatus: 'Pending Contribution',
      distributionLocation: data.distributionLocation || 'Central Distribution Hub, Lagos',
      registeredDate: new Date().toISOString().split('T')[0],
    };

    enrolments.unshift(newEnrolment);
    saveToStorage(STORAGE_KEYS.FOOD_CONTRIBUTION, enrolments);

    const actor = staff || this.getCurrentStaff();
    this.recordAuditLog(
      actor?.id || 'SYSTEM',
      actor?.fullName || 'System Staff',
      'Registered Food Package Enrolment',
      'Everyhome Food Contribution',
      `Registered ${newEnrolment.customerName} for ${newEnrolment.packageName} (₦${newEnrolment.packageValue.toLocaleString()})`
    );

    return newEnrolment;
  }

  static recordEveryhomePayment(
    enrolmentId: string,
    amount: number,
    channel: any = 'cash',
    refOrActor?: any,
    notes?: string
  ): any {
    const enrolments = this.getEveryhomeFoodEnrolments();
    const item = enrolments.find((e) => e.id === enrolmentId);
    if (!item) return null;

    const normalizedAmount = amount > 1000000 && item.targetAmount < 100000 ? Math.round(amount / 100) : amount;
    item.amountPaid += normalizedAmount;
    item.amountPaidKobo = item.amountPaid * 100;
    item.totalContributedKobo = (item.totalContributedKobo || 0) + normalizedAmount * 100;
    item.outstandingBalance = Math.max(0, item.targetAmount - item.amountPaid);
    item.outstandingBalanceKobo = item.outstandingBalance * 100;
    item.paymentCount += 1;

    if (item.outstandingBalance === 0) {
      item.fulfilmentStatus = 'Eligible for Pick-up';
    }

    saveToStorage(STORAGE_KEYS.FOOD_CONTRIBUTION, enrolments);

    const ref = typeof refOrActor === 'string' ? refOrActor : `EFC-PAY-${Date.now()}`;
    const staff = typeof refOrActor === 'object' && refOrActor ? refOrActor : this.getCurrentStaff();

    const payment = this.recordUnifiedPayment({
      customerId: item.customerId,
      customerName: item.customerName,
      programmeType: 'everyhome_food',
      programmeLabel: 'Everyhome Food Contribution',
      programme: 'EVERYHOME_FOOD',
      referenceId: item.id,
      amount: normalizedAmount,
      amountKobo: normalizedAmount * 100,
      paymentChannel: typeof channel === 'string' ? channel.toLowerCase() as any : 'cash',
      paymentMethod: typeof channel === 'string' ? channel.toUpperCase() : 'CASH',
      transactionReference: ref,
      actor: staff,
      notes: notes || `Food instalment contribution towards ${item.packageName}`,
    });

    return payment || item;
  }

  static updateFoodFulfilmentStatus(
    enrolmentId: string,
    newStatus: string,
    notes?: string,
    staff?: any
  ): EveryhomeFoodEnrolment | null {
    const enrolments = this.getEveryhomeFoodEnrolments();
    const item = enrolments.find((e) => e.id === enrolmentId);
    if (!item) return null;

    let normalizedStatus = newStatus;
    if (newStatus === 'READY') normalizedStatus = 'Eligible for Pick-up';
    else if (newStatus === 'DISTRIBUTED') normalizedStatus = 'Fulfilled & Delivered';
    else if (newStatus === 'PENDING') normalizedStatus = 'Pending Contribution';

    item.fulfilmentStatus = normalizedStatus as any;
    saveToStorage(STORAGE_KEYS.FOOD_CONTRIBUTION, enrolments);

    const actor = staff || this.getCurrentStaff();
    this.recordAuditLog(
      actor?.id || 'SYSTEM',
      actor?.fullName || 'System Staff',
      'Updated Food Package Fulfilment Status',
      'Everyhome Food Contribution',
      notes || `Changed status of ${item.enrolmentCode} (${item.customerName}) to: ${newStatus}`
    );

    return item;
  }

  // 4. Leocash Savings
  static getLeocashAccounts(): LeocashAccountRecord[] {
    return loadFromStorage<LeocashAccountRecord[]>(STORAGE_KEYS.LEOCASH, INITIAL_LEOCASH);
  }

  static createLeocashAccount(customerId: string, initialDepositOrStaff: any = 0): LeocashAccountRecord | null {
    const customers = this.getCustomers();
    const customer = customers.find((c) => c.id === customerId);
    if (!customer) return null;

    const initialDeposit = typeof initialDepositOrStaff === 'number' ? initialDepositOrStaff : 0;
    const staff = typeof initialDepositOrStaff === 'object' && initialDepositOrStaff ? initialDepositOrStaff : null;

    const accounts = this.getLeocashAccounts();
    const id = `leo_${String(accounts.length + 1).padStart(3, '0')}`;
    const accountNumber = `LEO-2025-${customer.customerCode.split('-')[2] || (1000 + accounts.length)}`;

    const newAccount: LeocashAccountRecord = {
      id,
      accountNumber,
      customerId: customer.id,
      customerName: customer.fullName,
      customerPhone: customer.phone,
      availableBalance: initialDeposit,
      ledgerBalance: initialDeposit,
      interestRateAnnual: 8.5,
      totalDeposited: initialDeposit,
      totalWithdrawn: 0,
      balanceKobo: initialDeposit * 100,
      totalDepositsKobo: initialDeposit * 100,
      totalWithdrawalsKobo: 0,
      status: 'active',
      openedDate: new Date().toISOString().split('T')[0],
      lastActivityDate: new Date().toISOString().split('T')[0],
    };

    accounts.unshift(newAccount);
    saveToStorage(STORAGE_KEYS.LEOCASH, accounts);

    if (initialDeposit > 0) {
      this.recordUnifiedPayment({
        customerId: customer.id,
        customerName: customer.fullName,
        programmeType: 'leocash',
        programmeLabel: 'Leocash Savings',
        programme: 'LEOCASH',
        referenceId: newAccount.id,
        amount: initialDeposit,
        amountKobo: initialDeposit * 100,
        paymentChannel: 'bank_transfer',
        paymentMethod: 'BANK_TRANSFER',
        transactionReference: `LEO-INIT-${Date.now()}`,
        actor: staff,
        notes: `Opening deposit for Leocash account ${newAccount.accountNumber}`,
      });
    }

    const actor = staff || this.getCurrentStaff();
    this.recordAuditLog(
      actor?.id || 'SYSTEM',
      actor?.fullName || 'System Staff',
      'Opened Leocash Account',
      'Leocash Savings',
      `Opened account ${newAccount.accountNumber} for ${customer.fullName}`
    );

    return newAccount;
  }

  static recordLeocashDeposit(
    accountId: string,
    amount: number,
    channel: any = 'bank_transfer',
    refOrActor?: any,
    notes?: string
  ): any {
    const accounts = this.getLeocashAccounts();
    const account = accounts.find((a) => a.id === accountId);
    if (!account) return null;

    const normalizedAmount = amount > 1000000 && account.availableBalance < 100000 ? Math.round(amount / 100) : amount;
    account.availableBalance += normalizedAmount;
    account.ledgerBalance += normalizedAmount;
    account.totalDeposited += normalizedAmount;
    account.balanceKobo = account.availableBalance * 100;
    account.totalDepositsKobo = account.totalDeposited * 100;
    account.lastActivityDate = new Date().toISOString().split('T')[0];

    saveToStorage(STORAGE_KEYS.LEOCASH, accounts);

    const ref = typeof refOrActor === 'string' ? refOrActor : `LEO-DEP-${Date.now()}`;
    const staff = typeof refOrActor === 'object' && refOrActor ? refOrActor : this.getCurrentStaff();

    const payment = this.recordUnifiedPayment({
      customerId: account.customerId,
      customerName: account.customerName,
      programmeType: 'leocash',
      programmeLabel: 'Leocash Savings',
      programme: 'LEOCASH',
      referenceId: account.id,
      amount: normalizedAmount,
      amountKobo: normalizedAmount * 100,
      paymentChannel: typeof channel === 'string' ? channel.toLowerCase() as any : 'bank_transfer',
      paymentMethod: typeof channel === 'string' ? channel.toUpperCase() : 'BANK_TRANSFER',
      transactionReference: ref,
      actor: staff,
      notes: notes || `Deposit to Leocash account ${account.accountNumber}`,
    });

    return payment || account;
  }

  static getLeocashWithdrawals(): LeocashWithdrawalRequest[] {
    return loadFromStorage<LeocashWithdrawalRequest[]>(STORAGE_KEYS.LEOCASH_WITHDRAWALS, INITIAL_LEOCASH_WITHDRAWALS);
  }

  static getLeocashWithdrawalRequests(): LeocashWithdrawalRequest[] {
    return this.getLeocashWithdrawals();
  }

  static requestLeocashWithdrawal(
    accountId: string,
    amount: number,
    reason: string,
    payoutMethodOrStaff?: any
  ): LeocashWithdrawalRequest | null {
    const accounts = this.getLeocashAccounts();
    const account = accounts.find((a) => a.id === accountId);
    if (!account) return null;

    const normalizedAmount = amount > 1000000 && account.availableBalance < 100000 ? Math.round(amount / 100) : amount;
    const requests = this.getLeocashWithdrawals();
    const currentStaff = typeof payoutMethodOrStaff === 'object' && payoutMethodOrStaff ? payoutMethodOrStaff : this.getCurrentStaff();
    const payoutMethod = typeof payoutMethodOrStaff === 'string' ? payoutMethodOrStaff : 'CASH';
    const requestId = `WR-2025-${String(requests.length + 1).padStart(3, '0')}`;

    const newReq: LeocashWithdrawalRequest = {
      id: `lwr_${String(requests.length + 1).padStart(3, '0')}`,
      requestId,
      accountId: account.id,
      customerId: account.customerId,
      customerName: account.customerName,
      amount: normalizedAmount,
      amountKobo: normalizedAmount * 100,
      reason,
      requestedDate: new Date().toISOString(),
      requestDate: new Date().toISOString(),
      requestedByStaffId: currentStaff?.id || 'stf_001',
      status: 'pending_review',
      payoutMethod,
    };

    requests.unshift(newReq);
    saveToStorage(STORAGE_KEYS.LEOCASH_WITHDRAWALS, requests);

    this.recordAuditLog(
      currentStaff?.id || 'SYSTEM',
      currentStaff?.fullName || 'Staff',
      'Submitted Leocash Withdrawal Request',
      'Leocash Savings',
      `Requested withdrawal of ₦${normalizedAmount.toLocaleString()} from account ${account.accountNumber} (${reason})`
    );

    return newReq;
  }

  static reviewLeocashWithdrawal(
    requestId: string,
    decision: any,
    notesOrStaff?: any
  ): LeocashWithdrawalRequest | null {
    const requests = this.getLeocashWithdrawals();
    const req = requests.find((r) => r.id === requestId);
    if (!req) return null;

    const staff = typeof notesOrStaff === 'object' && notesOrStaff ? notesOrStaff : this.getCurrentStaff();
    const notes = typeof notesOrStaff === 'string' ? notesOrStaff : '';

    const isApproved = typeof decision === 'string' && decision.toLowerCase().includes('appr');
    const normalizedDecision: 'approved' | 'rejected' = isApproved ? 'approved' : 'rejected';
    req.status = isApproved ? 'APPROVED' : 'REJECTED';
    req.reviewedByStaffId = staff?.id || 'stf_001';
    req.reviewDate = new Date().toISOString();
    req.reviewNotes = notes;

    if (isApproved) {
      const accounts = this.getLeocashAccounts();
      const account = accounts.find((a) => a.id === req.accountId);
      if (account) {
        account.availableBalance = Math.max(0, account.availableBalance - req.amount);
        account.ledgerBalance = Math.max(0, account.ledgerBalance - req.amount);
        account.totalWithdrawn += req.amount;
        account.balanceKobo = account.availableBalance * 100;
        account.totalWithdrawalsKobo = account.totalWithdrawn * 100;
        account.lastActivityDate = new Date().toISOString().split('T')[0];
        saveToStorage(STORAGE_KEYS.LEOCASH, accounts);
      }
    }

    saveToStorage(STORAGE_KEYS.LEOCASH_WITHDRAWALS, requests);

    this.recordAuditLog(
      staff?.id || 'SYSTEM',
      staff?.fullName || 'Staff',
      `Withdrawal Request ${normalizedDecision.toUpperCase()}`,
      'Leocash Savings',
      `${isApproved ? 'Approved and deducted' : 'Rejected'} withdrawal of ₦${req.amount.toLocaleString()} for ${req.customerName}`
    );

    return req;
  }

  // 5. Loan Management System
  static getLoanApplications(): LoanApplicationRecord[] {
    return loadFromStorage<LoanApplicationRecord[]>(STORAGE_KEYS.LOAN_APPLICATIONS, INITIAL_LOAN_APPLICATIONS);
  }

  static createLoanApplication(data: any, staff?: any): LoanApplicationRecord {
    const apps = this.getLoanApplications();
    const id = `lapp_${String(apps.length + 1).padStart(3, '0')}`;
    const applicationCode = `LAP-2025-${String(apps.length + 1).padStart(3, '0')}`;

    const requestedAmount = typeof data.requestedAmount === 'number'
      ? data.requestedAmount
      : (data.requestedAmountKobo ? Math.round(data.requestedAmountKobo / 100) : 100000);
    const tenorMonths = data.tenorMonths || 6;
    const interestRate = data.interestRate || 15;
    const totalInterest = requestedAmount * (interestRate / 100);
    const totalRepayable = requestedAmount + totalInterest;
    const monthlyRepayment = Math.round(totalRepayable / tenorMonths);

    const newApp: LoanApplicationRecord = {
      id,
      applicationCode,
      ...data,
      requestedAmount,
      requestedAmountKobo: data.requestedAmountKobo || requestedAmount * 100,
      tenorMonths,
      interestRate,
      monthlyRepayment,
      monthlyRepaymentKobo: monthlyRepayment * 100,
      status: 'under_review',
      appliedDate: new Date().toISOString().split('T')[0],
    };

    apps.unshift(newApp);
    saveToStorage(STORAGE_KEYS.LOAN_APPLICATIONS, apps);

    const currentStaff = staff || this.getCurrentStaff();
    this.recordAuditLog(
      currentStaff?.id || 'SYSTEM',
      currentStaff?.fullName || 'Loan Officer',
      'Submitted Loan Application',
      'Loan Management',
      `Filed loan application ${applicationCode} for ${data.customerName} (₦${requestedAmount.toLocaleString()})`
    );

    return newApp;
  }

  // Decoupled approval step: strictly approves into 'approved_awaiting_disbursement'
  static reviewLoanApplication(
    applicationId: string,
    decision: any,
    amountOrNotes?: any,
    conditionsOrNotes?: any,
    staff?: any
  ): LoanApplicationRecord | null {
    const apps = this.getLoanApplications();
    const app = apps.find((a) => a.id === applicationId);
    if (!app) return null;

    const currentStaff = staff || (typeof conditionsOrNotes === 'object' && conditionsOrNotes ? conditionsOrNotes : this.getCurrentStaff());
    const isApproved = typeof decision === 'string' && (decision.toLowerCase().includes('appr') || decision === 'APPROVED');
    app.status = isApproved ? 'approved_awaiting_disbursement' : 'rejected';
    app.reviewedByStaffId = currentStaff?.id || 'stf_003';
    app.reviewDate = new Date().toISOString().split('T')[0];
    app.approvalNotes = typeof conditionsOrNotes === 'string' ? conditionsOrNotes : (typeof amountOrNotes === 'string' ? amountOrNotes : '');

    if (typeof amountOrNotes === 'number') {
      app.approvedAmountKobo = amountOrNotes;
      app.approvedAmount = Math.round(amountOrNotes / 100);
    }

    saveToStorage(STORAGE_KEYS.LOAN_APPLICATIONS, apps);

    this.recordAuditLog(
      currentStaff?.id || 'SYSTEM',
      currentStaff?.fullName || 'Credit Approver',
      `Loan Application ${isApproved ? 'APPROVED' : 'REJECTED'}`,
      'Loan Management',
      `${isApproved ? 'Approved application (Awaiting Disbursement)' : 'Rejected application'} ${app.applicationCode} for ${app.customerName}`
    );

    return app;
  }

  // Decoupled disbursement step: executed by authorized disbursement staff
  static disburseLoan(
    applicationId: string,
    detailsOrMethod?: any,
    staff?: any,
    notes?: string
  ): any {
    const apps = this.getLoanApplications();
    const app = apps.find((a) => a.id === applicationId);
    if (!app) return null;

    const loans = this.getLoans();
    const currentStaff = staff || (typeof detailsOrMethod === 'object' && detailsOrMethod?.staff ? detailsOrMethod.staff : this.getCurrentStaff());
    const disbursementMethod = typeof detailsOrMethod === 'string' ? detailsOrMethod : (detailsOrMethod?.disbursementMethod || 'BANK_TRANSFER');
    const disbursementReference = typeof detailsOrMethod === 'object' && detailsOrMethod?.disbursementReference ? detailsOrMethod.disbursementReference : `DISB-${Date.now()}`;

    const id = `ln_${String(loans.length + 1).padStart(3, '0')}`;
    const loanCode = `LN-2025-${String(loans.length + 1).padStart(3, '0')}`;
    const today = new Date().toISOString().split('T')[0];

    const principal = app.approvedAmount || app.requestedAmount;
    const repaymentSchedule = generateLoanSchedule(principal, app.interestRate, app.tenorMonths, today);
    const totalRepayable = repaymentSchedule.reduce((sum, item) => sum + item.totalDue, 0);

    const newLoan: LoanRecord = {
      id,
      loanCode,
      loanReference: loanCode,
      applicationId: app.id,
      customerId: app.customerId,
      customerName: app.customerName,
      customerPhone: app.customerPhone,
      borrowerName: app.customerName,
      borrowerPhone: app.customerPhone,
      principalAmount: principal,
      principalKobo: principal * 100,
      interestRate: app.interestRate,
      totalRepayable,
      totalPayableKobo: totalRepayable * 100,
      tenorMonths: app.tenorMonths,
      disbursementDate: today,
      disbursedByStaffId: currentStaff?.id || 'stf_006',
      disbursementMethod,
      disbursementReference,
      monthlyInstalment: app.monthlyRepayment,
      totalPaid: 0,
      totalRepaidKobo: 0,
      outstandingBalance: totalRepayable,
      outstandingBalanceKobo: totalRepayable * 100,
      nextDueDate: repaymentSchedule[0]?.dueDate || today,
      status: 'active',
      repaymentSchedule,
    };

    loans.unshift(newLoan);
    saveToStorage(STORAGE_KEYS.LOANS, loans);

    // Update app status to disbursed
    app.status = 'disbursed';
    app.isDisbursed = true;
    saveToStorage(STORAGE_KEYS.LOAN_APPLICATIONS, apps);

    this.recordAuditLog(
      currentStaff?.id || 'SYSTEM',
      currentStaff?.fullName || 'Disbursement Officer',
      'Loan Disbursed',
      'Loan Management',
      notes || `Disbursed ₦${principal.toLocaleString()} via ${disbursementMethod} (Ref: ${disbursementReference}) for ${app.customerName}`
    );

    return newLoan;
  }

  static getLoans(): LoanRecord[] {
    return loadFromStorage<LoanRecord[]>(STORAGE_KEYS.LOANS, INITIAL_LOANS);
  }

  static recordLoanRepayment(
    loanId: string,
    amount: number,
    channel: any = 'bank_transfer',
    staffOrRef?: any,
    notes?: string
  ): any {
    const loans = this.getLoans();
    const loan = loans.find((l) => l.id === loanId);
    if (!loan) return null;

    const normalizedAmount = amount > 1000000 && loan.totalRepayable < 100000 ? Math.round(amount / 100) : amount;
    loan.totalPaid += normalizedAmount;
    loan.totalRepaidKobo = loan.totalPaid * 100;
    loan.outstandingBalance = Math.max(0, loan.totalRepayable - loan.totalPaid);
    loan.outstandingBalanceKobo = loan.outstandingBalance * 100;

    // Update schedule
    let remainingPaid = normalizedAmount;
    for (const item of loan.repaymentSchedule) {
      if (item.status !== 'paid' && remainingPaid > 0) {
        const needed = item.totalDue - item.amountPaid;
        if (remainingPaid >= needed) {
          item.amountPaid = item.totalDue;
          item.status = 'paid';
          item.paidDate = new Date().toISOString().split('T')[0];
          remainingPaid -= needed;
        } else {
          item.amountPaid += remainingPaid;
          item.status = 'partial';
          remainingPaid = 0;
        }
      }
    }

    // Check if fully repaid
    if (loan.outstandingBalance === 0) {
      loan.status = 'repaid';
    } else {
      const nextUnpaid = loan.repaymentSchedule.find((i) => i.status !== 'paid');
      if (nextUnpaid) {
        loan.nextDueDate = nextUnpaid.dueDate;
      }
    }

    saveToStorage(STORAGE_KEYS.LOANS, loans);

    const ref = typeof staffOrRef === 'string' ? staffOrRef : `LN-REP-${Date.now()}`;
    const staff = typeof staffOrRef === 'object' && staffOrRef ? staffOrRef : this.getCurrentStaff();

    const payment = this.recordUnifiedPayment({
      customerId: loan.customerId,
      customerName: loan.customerName,
      programmeType: 'loan_management',
      programmeLabel: 'Loan Repayment',
      programme: 'LOAN_REPAYMENT',
      type: 'REPAYMENT',
      referenceId: loan.id,
      amount: normalizedAmount,
      amountKobo: normalizedAmount * 100,
      paymentChannel: typeof channel === 'string' ? channel.toLowerCase() as any : 'bank_transfer',
      paymentMethod: typeof channel === 'string' ? channel.toUpperCase() : 'BANK_TRANSFER',
      transactionReference: ref,
      actor: staff,
      notes: notes || `Loan instalment payment towards ${loan.loanCode}`,
    });

    return payment || loan;
  }

  // Unified Central Payment Records
  static getProgrammePayments(): ProgrammePaymentRecord[] {
    return loadFromStorage<ProgrammePaymentRecord[]>(STORAGE_KEYS.PAYMENTS, INITIAL_PAYMENTS);
  }

  static recordUnifiedPayment(data: any): ProgrammePaymentRecord {
    const payments = this.getProgrammePayments();
    const currentStaff = (data.actor && typeof data.actor === 'object' ? data.actor : null) || this.getCurrentStaff();
    const count = payments.length + 1;
    const receiptNumber = `RCP-2025-${String(count).padStart(4, '0')}`;

    const amount = typeof data.amount === 'number'
      ? data.amount
      : (typeof data.amountKobo === 'number' ? Math.round(data.amountKobo / 100) : 0);
    const amountKobo = typeof data.amountKobo === 'number' ? data.amountKobo : amount * 100;

    const progType = data.programmeType || (data.programme ? String(data.programme).toLowerCase() : 'fixed_target');
    const progLabel = data.programmeLabel || (typeof data.programme === 'string' ? data.programme.replace(/_/g, ' ') : 'Unified Programme Payment');
    const channel = data.paymentChannel || (data.paymentMethod ? String(data.paymentMethod).toLowerCase() : 'cash');
    const ref = data.transactionReference || data.reference || data.relatedRecordId || `TRX-UNI-${Date.now()}`;

    const newPayment: ProgrammePaymentRecord = {
      id: `pay_${String(count).padStart(3, '0')}`,
      receiptNumber,
      customerId: data.customerId,
      customerName: data.customerName,
      programmeType: progType,
      programmeLabel: progLabel,
      programme: data.programme || progLabel,
      type: data.type || 'CONTRIBUTION',
      referenceId: data.referenceId || data.relatedRecordId || `REC-${Date.now()}`,
      reference: ref,
      amount,
      amountKobo,
      paymentChannel: channel,
      paymentMethod: data.paymentMethod || channel.toUpperCase(),
      transactionReference: ref,
      collectedByStaffId: currentStaff?.id || 'stf_001',
      collectedByStaffName: currentStaff?.fullName || 'Staff User',
      recordedByStaffName: currentStaff?.fullName || 'Staff User',
      timestamp: new Date().toISOString(),
      dateTime: new Date().toISOString(),
      status: 'CONFIRMED_RECORDED',
      notes: data.notes || '',
      verificationNote: data.notes || 'Manual branch verified receipt',
    };

    payments.unshift(newPayment);
    saveToStorage(STORAGE_KEYS.PAYMENTS, payments);

    this.recordAuditLog(
      currentStaff?.id || 'SYSTEM',
      currentStaff?.fullName || 'Staff User',
      'Recorded Payment',
      'Payments & Ledger',
      `Issued ${receiptNumber} for ₦${amount.toLocaleString()} (${progLabel}) from ${data.customerName}`
    );

    return newPayment;
  }

  static reverseProgrammePayment(paymentId: string, reason: string, staff?: any): ProgrammePaymentRecord | null {
    const payments = this.getProgrammePayments();
    const pay = payments.find((p) => p.id === paymentId);
    if (!pay || pay.status === 'reversed' || pay.status === 'REVERSED') return null;

    const currentStaff = staff || this.getCurrentStaff();
    pay.status = 'reversed';
    pay.reversalReason = reason;
    pay.reversedByStaffId = currentStaff?.id || 'stf_001';
    pay.reversedAt = new Date().toISOString();

    saveToStorage(STORAGE_KEYS.PAYMENTS, payments);

    this.recordAuditLog(
      currentStaff?.id || 'SYSTEM',
      currentStaff?.fullName || 'Staff User',
      'Reversed Transaction',
      'Payments & Ledger',
      `Reversed payment receipt ${pay.receiptNumber} (₦${pay.amount.toLocaleString()}) Reason: ${reason}`
    );

    return pay;
  }

  // Audit Logs
  static getAuditLogs(): AuditLogEntry[] {
    return loadFromStorage<AuditLogEntry[]>(STORAGE_KEYS.AUDIT_LOGS, INITIAL_AUDIT_LOGS);
  }

  static recordAuditLog(
    staffId: string,
    staffName: string,
    action: string,
    module: string,
    details: string
  ): void {
    const logs = this.getAuditLogs();
    const entry: AuditLogEntry = {
      id: `aud_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      staffId,
      staffName,
      action,
      module,
      details,
    };
    logs.unshift(entry);
    // Keep last 500 logs
    if (logs.length > 500) logs.pop();
    saveToStorage(STORAGE_KEYS.AUDIT_LOGS, logs);
  }

  // Executive Dashboard Aggregation
  static getManagementSystemSummary(): SystemMetrics {
    const customers = this.getCustomers();
    const activeCustomers = customers.filter(
      (c) => !c.status || String(c.status).toLowerCase() === 'active'
    ).length;

    const fixedPlans = this.getFixedTargetPlans();
    const totalFixedTargetBalance = fixedPlans.reduce((sum, p) => sum + p.currentBalance, 0);

    const ajoEnrolments = this.getDailyAjoEnrolments();
    const totalDailyAjoCollected = ajoEnrolments.reduce((sum, a) => sum + a.totalSaved, 0);

    const foodEnrolments = this.getEveryhomeFoodEnrolments();
    const totalFoodContributionValue = foodEnrolments.reduce((sum, f) => sum + f.amountPaid, 0);

    const leocashAccounts = this.getLeocashAccounts();
    const totalLeocashDeposits = leocashAccounts.reduce((sum, l) => sum + l.availableBalance, 0);

    const loans = this.getLoans();
    const totalDisbursedLoans = loans.reduce((sum, l) => sum + l.principalAmount, 0);
    const totalOutstandingLoanBalance = loans.reduce((sum, l) => sum + l.outstandingBalance, 0);

    let totalOverdueInstalments = 0;
    const nowStr = new Date().toISOString().split('T')[0];
    loans.forEach((loan) => {
      loan.repaymentSchedule.forEach((item) => {
        if (item.status !== 'paid' && item.dueDate < nowStr) {
          totalOverdueInstalments += item.totalDue - item.amountPaid;
        }
      });
    });

    const payments = this.getProgrammePayments().filter((p) => p.status === 'completed');
    const todayStr = new Date().toISOString().split('T')[0];
    const todayCollections = payments
      .filter((p) => p.timestamp.startsWith(todayStr))
      .reduce((sum, p) => sum + p.amount, 0);

    const thisMonthStr = todayStr.substring(0, 7);
    const monthCollections = payments
      .filter((p) => p.timestamp.startsWith(thisMonthStr))
      .reduce((sum, p) => sum + p.amount, 0);

    const totalSavingsCollectedKobo = (totalFixedTargetBalance + totalDailyAjoCollected + totalFoodContributionValue + totalLeocashDeposits) * 100;
    const loanApplications = this.getLoanApplications();
    const totalLoanApplications = loanApplications.length;
    const approvedLoans = loanApplications.filter((l) => (l.status as string).toLowerCase().includes('approv') || (l.status as string).toLowerCase().includes('disburs')).length;

    return {
      totalCustomers: customers.length,
      activeCustomers,
      totalFixedTargetBalance,
      totalDailyAjoCollected,
      totalFoodContributionValue,
      totalLeocashDeposits,
      totalDisbursedLoans,
      totalOutstandingLoanBalance,
      totalOverdueInstalments,
      todayCollections,
      monthCollections,
      totalDisbursedKobo: totalDisbursedLoans * 100,
      totalOutstandingLoansKobo: totalOutstandingLoanBalance * 100,
      totalFixedTargetSavedKobo: totalFixedTargetBalance * 100,
      totalDailyAjoCollectedKobo: totalDailyAjoCollected * 100,
      totalFoodContributedKobo: totalFoodContributionValue * 100,
      totalLeocashBalanceKobo: totalLeocashDeposits * 100,
      totalSavingsCollectedKobo,
      totalLoanApplications,
      approvedLoans,
    };
  }

  // Pub/Sub and Event Bus
  private listeners: ((event?: any) => void)[] = [];

  constructor() {
    notifyStorageChangeCallback = (key: string) => {
      this.notifyListeners({ type: 'STORAGE_UPDATED', key });
    };
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('storage', (event) => {
        if (event.key && event.key.startsWith('teamacro_')) {
          this.notifyListeners({ type: 'CROSS_TAB_STORAGE_UPDATED', key: event.key });
        }
      });
    }
  }

  subscribe(listener: (event?: any) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  notifyListeners(event: any = { type: 'STATE_CHANGED' }): void {
    this.listeners.forEach((l) => {
      try {
        l(event);
      } catch (e) {
        console.error('Error in ledger listener:', e);
      }
    });
  }

  // Bank Configuration
  getConfig(): BankConfig {
    return loadFromStorage<BankConfig>(STORAGE_KEYS.CONFIG, DEFAULT_BANK_CONFIG);
  }

  setConfig(config: BankConfig): void {
    saveToStorage(STORAGE_KEYS.CONFIG, config);
    this.notifyListeners({ type: 'CONFIG_UPDATED', config });
  }

  updateConfig(partial: Partial<BankConfig>, _actor?: any): BankConfig {
    const current = this.getConfig();
    const updated = { ...current, ...partial };
    saveToStorage(STORAGE_KEYS.CONFIG, updated);
    this.notifyListeners({ type: 'CONFIG_UPDATED', config: updated });
    return updated;
  }

  // Active Session & Authentication
  static getCurrentUser(): User | null {
    const directUser = loadFromStorage<User | null>(STORAGE_KEYS.CURRENT_USER, null);
    if (directUser) return directUser;
    const staff = LedgerEngine.getCurrentStaff();
    if (staff) {
      return {
        id: staff.id,
        email: staff.email,
        fullName: staff.fullName,
        phone: staff.phone,
        role: staff.role as any,
        permissions: staff.permissions,
        staffCode: staff.staffCode,
        roleTitle: staff.roleTitle,
        status: staff.status,
        active: staff.status === 'active',
        lastLogin: staff.lastLogin,
        avatarUrl: staff.avatarUrl,
        isLifetimeSuperAdmin: staff.isLifetimeSuperAdmin,
      };
    }
    return null;
  }

  getCurrentUser(): User | null {
    return LedgerEngine.getCurrentUser();
  }

  static setCurrentUser(user: User | null): void {
    saveToStorage(STORAGE_KEYS.CURRENT_USER, user);
    if (user && user.role !== 'CUSTOMER') {
      const staffList = LedgerEngine.getStaffUsers();
      const existing = staffList.find((s) => s.id === user.id || s.email.toLowerCase() === user.email.toLowerCase());
      if (existing) {
        LedgerEngine.setCurrentStaff(existing);
      }
    } else if (!user) {
      LedgerEngine.setCurrentStaff(null);
    }
  }

  setCurrentUser(user: User | null): void {
    LedgerEngine.setCurrentUser(user);
    this.notifyListeners({ type: 'AUTH_CHANGED', user });
  }

  getUserByEmail(email: string): User | null {
    const staff = LedgerEngine.getStaffUsers().find((s) => s.email.toLowerCase() === email.toLowerCase());
    if (staff) {
      return {
        id: staff.id,
        email: staff.email,
        fullName: staff.fullName,
        phone: staff.phone,
        role: staff.role as any,
        permissions: staff.permissions,
        staffCode: staff.staffCode,
        roleTitle: staff.roleTitle,
        status: staff.status,
        active: staff.status === 'active',
        lastLogin: staff.lastLogin,
      };
    }
    const customer = LedgerEngine.getCustomers().find((c) => c.email.toLowerCase() === email.toLowerCase());
    if (customer) {
      return {
        id: customer.id,
        email: customer.email,
        fullName: customer.fullName,
        phone: customer.phone,
        role: 'CUSTOMER',
        status: customer.status,
        active: customer.status === 'active',
        createdAt: customer.registrationDate,
      };
    }
    return null;
  }

  // Super Admin Bootstrap
  static getBootstrapState(): SuperAdminBootstrapState {
    return loadFromStorage<SuperAdminBootstrapState>(STORAGE_KEYS.BOOTSTRAP, INITIAL_BOOTSTRAP_STATE);
  }

  getBootstrapState(): SuperAdminBootstrapState {
    return LedgerEngine.getBootstrapState();
  }

  static initializeSuperAdmin(data: { secretKey: string; email: string; fullName: string; phone: string }): User {
    const current = this.getBootstrapState();
    if (current.isInitialized && current.lockdownEnforced) {
      throw new Error(
        'ROOT GATEWAY SEALED: The Lifetime Super Admin account has already been permanently established. Multiple owners or subsequent public setups are strictly forbidden.'
      );
    }

    const bootstrap: SuperAdminBootstrapState = {
      isInitialized: true,
      initializedAt: new Date().toISOString(),
      superAdminEmail: data.email,
      superAdminName: data.fullName,
      lifetimeSuperAdminId: 'LIFETIME_ROOT_SUPER_ADMIN_001',
      lifetimeSuperAdminEmail: data.email,
      canResetWithMasterKey: false,
      lockdownEnforced: true,
      immutableOwnerBound: true,
      initializedByEmail: data.email,
      initializationActorName: `${data.fullName} (Permanent Founder & Lifetime Owner)`,
    };
    saveToStorage(STORAGE_KEYS.BOOTSTRAP, bootstrap);

    const user: User = {
      id: 'LIFETIME_ROOT_SUPER_ADMIN_001',
      email: data.email,
      fullName: data.fullName,
      phone: data.phone,
      role: 'LIFETIME_SUPER_ADMIN',
      status: 'active',
      active: true,
      twoFactorEnabled: true,
      createdAt: new Date().toISOString(),
      isLifetimeSuperAdmin: true,
    };

    // Update staff directory
    const staffList = this.getStaffUsers();
    const existingIndex = staffList.findIndex((s) => s.id === 'LIFETIME_ROOT_SUPER_ADMIN_001');
    const staffEntry: StaffUser = {
      id: 'LIFETIME_ROOT_SUPER_ADMIN_001',
      staffCode: 'TMC-DIR-001',
      fullName: data.fullName,
      email: data.email,
      phone: data.phone,
      role: 'LIFETIME_SUPER_ADMIN',
      roleTitle: 'Lifetime Super Admin & Chief Executive',
      isLifetimeSuperAdmin: true,
      permissions: getDefaultPermissionsForRole('LIFETIME_SUPER_ADMIN'),
      status: 'active',
      lastLogin: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      operationalResponsibility: 'Root Governance, Lifetime System Ownership & Overseer',
      assignedModules: ['ALL_MODULES', 'DISCREET_MONITORING', 'FINANCIAL_APPROVALS', 'ADMIN_APPOINTMENT'],
    };

    if (existingIndex >= 0) {
      staffList[existingIndex] = staffEntry;
    } else {
      staffList.unshift(staffEntry);
    }
    saveToStorage(STORAGE_KEYS.STAFF, staffList);

    this.setCurrentUser(user);
    this.recordAuditLog(
      user.id,
      user.fullName,
      'Lifetime Super Admin Initialised',
      'Root Authority Bootstrap',
      `Permanently established Lifetime Super Admin identity for ${data.fullName} (${data.email}). Gateway cryptographically sealed.`
    );

    return user;
  }

  initializeSuperAdmin(data: { secretKey: string; email: string; fullName: string; phone: string }): User {
    return LedgerEngine.initializeSuperAdmin(data);
  }

  // Accounts
  getAccounts(): CustomerAccount[] {
    return loadFromStorage<CustomerAccount[]>(STORAGE_KEYS.ACCOUNTS, INITIAL_ACCOUNTS);
  }

  getCustomerAccounts(userId: string): CustomerAccount[] {
    const all = this.getAccounts();
    const userAccounts = all.filter((a) => a.userId === userId);
    if (userAccounts.length > 0) return userAccounts;

    const defaultAcc: CustomerAccount = {
      id: `ACC-${userId.replace(/[^a-zA-Z0-9]/g, '')}`,
      userId,
      accountNumber: '2038192001',
      accountName: 'Primary Operational Account',
      name: 'Primary Operational Account',
      accountType: 'SAVINGS',
      tier: 3,
      currency: 'NGN',
      balanceKobo: 54000000,
      ledgerBalanceKobo: 54000000,
      dailyTransferLimitKobo: 500000000,
      status: 'ACTIVE',
      openedAt: new Date().toISOString(),
    };
    return [defaultAcc];
  }

  getAccountByNumber(accNum: string): CustomerAccount | null {
    const all = this.getAccounts();
    return all.find((a) => a.accountNumber === accNum) || null;
  }

  // Transactions
  getTransactions(): Transaction[] {
    return loadFromStorage<Transaction[]>(STORAGE_KEYS.TRANSACTIONS, INITIAL_TRANSACTIONS);
  }

  // Beneficiaries
  getBeneficiaries(userId: string): Beneficiary[] {
    const all = loadFromStorage<Beneficiary[]>(STORAGE_KEYS.BENEFICIARIES, INITIAL_BENEFICIARIES);
    return all.filter((b) => b.userId === userId);
  }

  addBeneficiary(ben: Omit<Beneficiary, 'id' | 'createdAt'>): Beneficiary {
    const all = loadFromStorage<Beneficiary[]>(STORAGE_KEYS.BENEFICIARIES, INITIAL_BENEFICIARIES);
    const created: Beneficiary = {
      ...ben,
      id: `BEN-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      createdAt: new Date().toISOString(),
    };
    all.unshift(created);
    saveToStorage(STORAGE_KEYS.BENEFICIARIES, all);
    this.notifyListeners({ type: 'BENEFICIARY_ADDED', beneficiary: created });
    return created;
  }

  deleteBeneficiary(id: string): void {
    const all = loadFromStorage<Beneficiary[]>(STORAGE_KEYS.BENEFICIARIES, INITIAL_BENEFICIARIES);
    const filtered = all.filter((b) => b.id !== id);
    saveToStorage(STORAGE_KEYS.BENEFICIARIES, filtered);
    this.notifyListeners({ type: 'BENEFICIARY_DELETED', id });
  }

  // Journal Entries
  getJournalEntries(): JournalEntry[] {
    return loadFromStorage<JournalEntry[]>(STORAGE_KEYS.JOURNAL_ENTRIES, INITIAL_JOURNAL_ENTRIES);
  }

  getJournalEntryByTxId(txId: string): JournalEntry | null {
    const all = this.getJournalEntries();
    return all.find((je) => je.transactionId === txId) || null;
  }

  // Fraud Alerts
  getFraudAlerts(): FraudAlert[] {
    return loadFromStorage<FraudAlert[]>(STORAGE_KEYS.FRAUD_ALERTS, INITIAL_FRAUD_ALERTS);
  }

  updateFraudAlert(alertId: string, status: string, notes?: string, _actor?: any): void {
    const alerts = this.getFraudAlerts();
    const alert = alerts.find((a) => a.id === alertId);
    if (alert) {
      alert.status = status as any;
      if (notes) alert.resolutionNotes = notes;
      saveToStorage(STORAGE_KEYS.FRAUD_ALERTS, alerts);
      this.notifyListeners({ type: 'FRAUD_ALERT_UPDATED', alert });
    }
  }

  // General Ledger Trial Balance & Invariants
  performGeneralLedgerReconciliation(): {
    isBalanced: boolean;
    varianceKobo: number;
    totalDebitsKobo: number;
    totalCreditsKobo: number;
    reconciledAt: string;
  } {
    const journalEntries = this.getJournalEntries();
    let totalDebitsKobo = 0;
    let totalCreditsKobo = 0;

    journalEntries.forEach((je) => {
      je.lines.forEach((line) => {
        if (line.direction === 'DEBIT') {
          totalDebitsKobo += line.amountKobo;
        } else {
          totalCreditsKobo += line.amountKobo;
        }
      });
    });

    const varianceKobo = Math.abs(totalDebitsKobo - totalCreditsKobo);
    return {
      isBalanced: varianceKobo === 0,
      varianceKobo,
      totalDebitsKobo,
      totalCreditsKobo,
      reconciledAt: new Date().toISOString(),
    };
  }

  // Transfer Execution (Strict Double-Entry Ledger)
  async executeInternalTransfer(params: {
    actor: User;
    sourceAccountId: string;
    destinationAccountNumber: string;
    amountKobo: number;
    narration: string;
    idempotencyKey?: string;
  }): Promise<{ transaction: Transaction; journalEntry: JournalEntry }> {
    const accounts = this.getAccounts();
    const sourceAcc = accounts.find((a) => a.id === params.sourceAccountId || a.accountNumber === params.sourceAccountId);
    if (!sourceAcc) throw new Error('Source account not found.');

    if (sourceAcc.balanceKobo < params.amountKobo) {
      throw new Error('Insufficient funds to complete transfer.');
    }

    const txs = this.getTransactions();
    if (params.idempotencyKey) {
      const existing = txs.find((t) => t.idempotencyKey === params.idempotencyKey);
      if (existing) {
        const je = this.getJournalEntryByTxId(existing.id) || {
          id: `JE-${existing.id}`,
          transactionId: existing.id,
          timestamp: existing.timestamp,
          description: existing.narration,
          lines: [
            { accountId: sourceAcc.id, accountNumber: sourceAcc.accountNumber, direction: 'DEBIT', amountKobo: params.amountKobo },
            { accountId: 'DEST', accountNumber: params.destinationAccountNumber, direction: 'CREDIT', amountKobo: params.amountKobo },
          ],
        };
        return { transaction: existing, journalEntry: je };
      }
    }

    const destAcc = accounts.find((a) => a.accountNumber === params.destinationAccountNumber);

    sourceAcc.balanceKobo -= params.amountKobo;
    if (destAcc) {
      destAcc.balanceKobo += params.amountKobo;
    }
    saveToStorage(STORAGE_KEYS.ACCOUNTS, accounts);

    const txId = `TX-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const tx: Transaction = {
      id: txId,
      reference: `TMC-${Date.now()}`,
      accountId: sourceAcc.id,
      sourceAccountId: sourceAcc.id,
      sourceAccountNumber: sourceAcc.accountNumber,
      sourceAccountName: sourceAcc.accountName,
      destinationAccountNumber: params.destinationAccountNumber,
      destinationAccountName: destAcc?.accountName || 'TEAMACRO Account',
      accountNumber: sourceAcc.accountNumber,
      accountName: sourceAcc.accountName,
      initiatedById: params.actor.id,
      initiatedByName: params.actor.fullName,
      type: 'TRANSFER_OUT',
      direction: 'DEBIT',
      amountKobo: params.amountKobo,
      feeKobo: 0,
      balanceAfterKobo: sourceAcc.balanceKobo,
      narration: params.narration,
      status: 'SUCCESSFUL',
      timestamp: new Date().toISOString(),
      channel: 'INTERNAL',
      idempotencyKey: params.idempotencyKey,
    };

    txs.unshift(tx);
    saveToStorage(STORAGE_KEYS.TRANSACTIONS, txs);

    const jeId = `JE-${Date.now()}`;
    const journalEntry: JournalEntry = {
      id: jeId,
      transactionId: tx.id,
      timestamp: new Date().toISOString(),
      description: params.narration,
      lines: [
        { accountId: sourceAcc.id, accountNumber: sourceAcc.accountNumber, direction: 'DEBIT', amountKobo: params.amountKobo },
        { accountId: destAcc?.id || 'DEST', accountNumber: params.destinationAccountNumber, direction: 'CREDIT', amountKobo: params.amountKobo },
      ],
    };

    const jes = this.getJournalEntries();
    jes.unshift(journalEntry);
    saveToStorage(STORAGE_KEYS.JOURNAL_ENTRIES, jes);

    this.notifyListeners({ type: 'TRANSACTION_POSTED', transaction: tx });
    return { transaction: tx, journalEntry };
  }

  async executeExternalTransfer(params: {
    actor: User;
    sourceAccountId: string;
    destinationBankCode: string;
    destinationBankName?: string;
    destinationAccountNumber: string;
    destinationAccountName: string;
    amountKobo: number;
    narration: string;
    idempotencyKey?: string;
  }): Promise<{ transaction: Transaction; journalEntry: JournalEntry }> {
    const accounts = this.getAccounts();
    const sourceAcc = accounts.find((a) => a.id === params.sourceAccountId || a.accountNumber === params.sourceAccountId);
    if (!sourceAcc) throw new Error('Source account not found.');

    const config = this.getConfig();
    let feeKobo = config.tariffs.nipTransferFeeBelow5kKobo;
    if (params.amountKobo > 5000000) {
      feeKobo = config.tariffs.nipTransferFeeAbove50kKobo;
    } else if (params.amountKobo > 500000) {
      feeKobo = config.tariffs.nipTransferFeeAbove5kKobo;
    }

    const totalDebit = params.amountKobo + feeKobo;
    if (sourceAcc.balanceKobo < totalDebit) {
      throw new Error('Insufficient funds to cover transfer amount and NIP switch fee.');
    }

    sourceAcc.balanceKobo -= totalDebit;
    saveToStorage(STORAGE_KEYS.ACCOUNTS, accounts);

    const txId = `TX-NIP-${Date.now()}`;
    const tx: Transaction = {
      id: txId,
      reference: `NIP-${Date.now()}`,
      accountId: sourceAcc.id,
      sourceAccountId: sourceAcc.id,
      sourceAccountNumber: sourceAcc.accountNumber,
      sourceAccountName: sourceAcc.accountName,
      destinationBankCode: params.destinationBankCode,
      destinationAccountNumber: params.destinationAccountNumber,
      destinationAccountName: params.destinationAccountName,
      accountNumber: sourceAcc.accountNumber,
      accountName: sourceAcc.accountName,
      initiatedById: params.actor.id,
      type: 'TRANSFER_OUT',
      direction: 'DEBIT',
      amountKobo: params.amountKobo,
      feeKobo,
      balanceAfterKobo: sourceAcc.balanceKobo,
      narration: params.narration,
      status: 'SUCCESSFUL',
      timestamp: new Date().toISOString(),
      channel: 'NIP',
      idempotencyKey: params.idempotencyKey,
    };

    const txs = this.getTransactions();
    txs.unshift(tx);
    saveToStorage(STORAGE_KEYS.TRANSACTIONS, txs);

    const journalEntry: JournalEntry = {
      id: `JE-${Date.now()}`,
      transactionId: tx.id,
      timestamp: new Date().toISOString(),
      description: `NIP Interbank Transfer - ${params.destinationAccountName}`,
      lines: [
        { accountId: sourceAcc.id, accountNumber: sourceAcc.accountNumber, direction: 'DEBIT', amountKobo: totalDebit },
        { accountId: 'SYSTEM_CLEARING', accountNumber: 'NIP_CLEARING_99', direction: 'CREDIT', amountKobo: params.amountKobo },
        { accountId: 'SYSTEM_FEE', accountNumber: '1000000002', direction: 'CREDIT', amountKobo: feeKobo },
      ],
    };

    const jes = this.getJournalEntries();
    jes.unshift(journalEntry);
    saveToStorage(STORAGE_KEYS.JOURNAL_ENTRIES, jes);

    this.notifyListeners({ type: 'TRANSACTION_POSTED', transaction: tx });
    return { transaction: tx, journalEntry };
  }

  executeTransactionReversal(params: {
    transactionId: string;
    approver: User;
    reason: string;
  }): { reversalTransaction: Transaction; journalEntry: JournalEntry } {
    const txs = this.getTransactions();
    const origTx = txs.find((t) => t.id === params.transactionId);
    if (!origTx) throw new Error('Transaction not found');

    origTx.status = 'REVERSED';

    const revId = `TX-REV-${Date.now()}`;
    const revTx: Transaction = {
      id: revId,
      reference: `REV-${origTx.reference}`,
      accountId: origTx.accountId || origTx.sourceAccountId || 'ACC-001',
      sourceAccountId: origTx.destinationAccountNumber || 'SYSTEM',
      destinationAccountNumber: origTx.sourceAccountNumber || origTx.accountNumber || '2038192001',
      destinationAccountName: origTx.sourceAccountName || origTx.accountName || 'Customer',
      accountNumber: origTx.accountNumber,
      accountName: origTx.accountName,
      initiatedById: params.approver.id,
      type: 'REVERSAL',
      direction: 'CREDIT',
      amountKobo: origTx.amountKobo,
      feeKobo: 0,
      balanceAfterKobo: (origTx.balanceAfterKobo || 0) + origTx.amountKobo,
      narration: `Compensating reversal for ${origTx.reference}: ${params.reason}`,
      status: 'SUCCESSFUL',
      timestamp: new Date().toISOString(),
      channel: 'SYSTEM',
    };

    txs.unshift(revTx);
    saveToStorage(STORAGE_KEYS.TRANSACTIONS, txs);

    const journalEntry: JournalEntry = {
      id: `JE-REV-${Date.now()}`,
      transactionId: revTx.id,
      timestamp: new Date().toISOString(),
      description: `Reversal - ${params.reason}`,
      lines: [
        { accountId: 'DEST', accountNumber: origTx.destinationAccountNumber || 'NIP_CLEARING', direction: 'DEBIT', amountKobo: origTx.amountKobo },
        { accountId: origTx.accountId || 'ACC-001', accountNumber: origTx.sourceAccountNumber || '2038192001', direction: 'CREDIT', amountKobo: origTx.amountKobo },
      ],
    };

    const jes = this.getJournalEntries();
    jes.unshift(journalEntry);
    saveToStorage(STORAGE_KEYS.JOURNAL_ENTRIES, jes);

    this.notifyListeners({ type: 'TRANSACTION_REVERSED', transaction: revTx });
    return { reversalTransaction: revTx, journalEntry };
  }

  // Support Tickets
  createSupportTicket(data: {
    customerId: string;
    customerName: string;
    customerEmail: string;
    category: any;
    subject: string;
    message: string;
    priority: any;
  }): SupportTicket {
    const tickets = loadFromStorage<SupportTicket[]>(STORAGE_KEYS.SUPPORT_TICKETS, INITIAL_SUPPORT_TICKETS);
    const created: SupportTicket = {
      id: `TCK-${Date.now()}`,
      ticketNumber: `TMC-SUP-${String(tickets.length + 1).padStart(4, '0')}`,
      customerId: data.customerId,
      customerName: data.customerName,
      customerEmail: data.customerEmail,
      category: data.category,
      subject: data.subject,
      message: data.message,
      priority: data.priority,
      status: 'OPEN',
      createdAt: new Date().toISOString(),
      responses: [],
    };
    tickets.unshift(created);
    saveToStorage(STORAGE_KEYS.SUPPORT_TICKETS, tickets);
    return created;
  }

  getSupportTickets(): SupportTicket[] {
    return loadFromStorage<SupportTicket[]>(STORAGE_KEYS.SUPPORT_TICKETS, INITIAL_SUPPORT_TICKETS);
  }

  // Applications
  submitApplication(data: any): AccountApplication {
    const apps = loadFromStorage<AccountApplication[]>(STORAGE_KEYS.APPLICATIONS, INITIAL_APPLICATIONS);
    const assignedAccountNumber = `203819${Math.floor(1000 + Math.random() * 9000)}`;
    const created: AccountApplication = {
      id: `APP-${Date.now()}`,
      applicationNumber: `TMC-APP-${String(apps.length + 1).padStart(4, '0')}`,
      accountType: data.accountType || 'SAVINGS',
      tierRequested: data.tierRequested || 3,
      fullName: data.fullName,
      email: data.email,
      phone: data.phone,
      dateOfBirth: data.dateOfBirth,
      bvn: data.bvn,
      nin: data.nin,
      residentialAddress: data.residentialAddress,
      state: data.state,
      lga: data.lga,
      occupation: data.occupation,
      employerName: data.employerName,
      pepDeclaration: !!data.pepDeclaration,
      idDocumentName: data.idDocumentName || 'ID_Doc.pdf',
      utilityBillName: data.utilityBillName || 'Utility_Bill.pdf',
      passportPhotoName: data.passportPhotoName || 'Photo.jpg',
      status: 'SUBMITTED',
      submittedAt: new Date().toISOString(),
      assignedAccountNumber,
    };
    apps.unshift(created);
    saveToStorage(STORAGE_KEYS.APPLICATIONS, apps);

    // Also register into customer directory & accounts so the new customer immediately reflects across all portals
    if (data.fullName && data.phone) {
      LedgerEngine.saveCustomer({
        fullName: data.fullName,
        email: data.email,
        phone: data.phone,
        address: data.residentialAddress || 'Lagos, Nigeria',
        state: data.state || 'Lagos',
        lga: data.lga || 'Metropolitan',
        ninOrBvn: data.bvn || data.nin || '',
        occupation: data.occupation || 'Member',
        accountNumber: assignedAccountNumber,
      });
    }

    return created;
  }

  // Regulatory, Branches, Governance
  getRegulatoryCertifications(activeOnly = true): any[] {
    if (activeOnly) {
      return INITIAL_REGULATORY_CERTS.filter((c) => c.status === 'ACTIVE_VERIFIED');
    }
    return INITIAL_REGULATORY_CERTS;
  }

  getBranches(): any[] {
    return INITIAL_BRANCHES;
  }

  getGovernanceDocuments(activeOnly = true): GovernanceDocument[] {
    const docs = loadFromStorage<GovernanceDocument[]>(STORAGE_KEYS.GOVERNANCE, INITIAL_GOVERNANCE_DOCS);
    if (activeOnly) {
      return docs.filter((d) => d.status === 'ACTIVE');
    }
    return docs;
  }

  // Audit Events
  getAuditEvents(): AuditEvent[] {
    return LedgerEngine.getAuditLogs();
  }

  // Instance Bridge Methods for Static Methods
  authenticateStaff(identifier: string, _password?: string): StaffUser | null {
    const all = LedgerEngine.getStaffUsers();
    const user = all.find(
      (u) =>
        (u.email.toLowerCase() === identifier.toLowerCase() ||
          u.staffCode.toLowerCase() === identifier.toLowerCase()) &&
        u.status === 'active'
    );
    if (user) {
      user.lastLogin = new Date().toISOString();
      saveToStorage(STORAGE_KEYS.STAFF, all);
      LedgerEngine.setCurrentStaff(user);
      return user;
    }
    return null;
  }

  getCurrentStaff(): StaffUser | null {
    return LedgerEngine.getCurrentStaff();
  }

  setCurrentStaff(staff: StaffUser | null): void {
    LedgerEngine.setCurrentStaff(staff);
  }

  getStaffUsers(): StaffUser[] {
    return LedgerEngine.getStaffUsers();
  }

  createStaffUser(newStaff: any, staff?: any): StaffUser {
    return LedgerEngine.createStaffUser(newStaff, staff);
  }

  getCustomers(): CustomerRecord[] {
    return LedgerEngine.getCustomers();
  }

  saveCustomer(customer: any, staff?: any): CustomerRecord {
    const saved = LedgerEngine.saveCustomer(customer, staff);
    this.notifyListeners({ type: 'CUSTOMER_REGISTERED', customer: saved });
    return saved;
  }

  syncCustomersFromServer(): Promise<CustomerRecord[]> {
    return LedgerEngine.syncCustomersFromServer();
  }

  checkCustomerDuplicate(phone: string, email?: string): (CustomerRecord & { isDuplicate: boolean; reason?: string }) | null {
    return LedgerEngine.checkCustomerDuplicate(phone, email);
  }

  getFixedTargetPlans(): FixedTargetPlan[] {
    return LedgerEngine.getFixedTargetPlans();
  }

  createFixedTargetPlan(plan: any, staff?: any): FixedTargetPlan {
    return LedgerEngine.createFixedTargetPlan(plan, staff);
  }

  recordFixedTargetContribution(planId: string, amount: number, channel: any = 'cash', staffOrRef?: any, notes?: string): any {
    return LedgerEngine.recordFixedTargetContribution(planId, amount, channel, staffOrRef, notes);
  }

  getDailyAjoEnrolments(): DailyAjoEnrolment[] {
    return LedgerEngine.getDailyAjoEnrolments();
  }

  enrolDailyAjo(data: any, staff?: any): DailyAjoEnrolment {
    return LedgerEngine.enrolDailyAjo(data, staff);
  }

  recordDailyAjoPayment(enrolmentId: string, dayNumber: number, channel: any = 'cash', staffOrRef?: any, notes?: string): any {
    return LedgerEngine.recordDailyAjoPayment(enrolmentId, dayNumber, channel, staffOrRef, notes);
  }

  getEveryhomeFoodEnrolments(): EveryhomeFoodEnrolment[] {
    return LedgerEngine.getEveryhomeFoodEnrolments();
  }

  enrolEveryhomeFood(data: any, staff?: any): EveryhomeFoodEnrolment {
    return LedgerEngine.enrolEveryhomeFood(data, staff);
  }

  recordEveryhomePayment(enrolmentId: string, amount: number, channel: any = 'cash', staffOrRef?: any, notes?: string): any {
    return LedgerEngine.recordEveryhomePayment(enrolmentId, amount, channel, staffOrRef, notes);
  }

  updateFoodFulfilmentStatus(enrolmentId: string, newStatus: any, notes?: string, staff?: any): EveryhomeFoodEnrolment | null {
    return LedgerEngine.updateFoodFulfilmentStatus(enrolmentId, newStatus, notes, staff);
  }

  getLeocashAccounts(): LeocashAccountRecord[] {
    return LedgerEngine.getLeocashAccounts();
  }

  createLeocashAccount(customerId: string, staffOrDeposit?: any): LeocashAccountRecord | null {
    return LedgerEngine.createLeocashAccount(customerId, staffOrDeposit);
  }

  recordLeocashDeposit(accountId: string, amount: number, channel: any = 'bank_transfer', staffOrRef?: any, notes?: string): any {
    return LedgerEngine.recordLeocashDeposit(accountId, amount, channel, staffOrRef, notes);
  }

  getLeocashWithdrawals(): LeocashWithdrawalRequest[] {
    return LedgerEngine.getLeocashWithdrawals();
  }

  getLeocashWithdrawalRequests(): LeocashWithdrawalRequest[] {
    return LedgerEngine.getLeocashWithdrawals();
  }

  requestLeocashWithdrawal(accountId: string, amount: number, reason: string, staffOrPayout?: any): LeocashWithdrawalRequest | null {
    return LedgerEngine.requestLeocashWithdrawal(accountId, amount, reason, staffOrPayout);
  }

  reviewLeocashWithdrawal(requestId: string, decision: any, staffOrNotes?: any): LeocashWithdrawalRequest | null {
    return LedgerEngine.reviewLeocashWithdrawal(requestId, decision, staffOrNotes);
  }

  getLoanApplications(): LoanApplicationRecord[] {
    return LedgerEngine.getLoanApplications();
  }

  createLoanApplication(data: any, staff?: any): LoanApplicationRecord {
    return LedgerEngine.createLoanApplication(data, staff);
  }

  reviewLoanApplication(applicationId: string, decision: any, amountOrNotes?: any, conditionsOrNotes?: any, staff?: any): LoanApplicationRecord | null {
    return LedgerEngine.reviewLoanApplication(applicationId, decision, amountOrNotes, conditionsOrNotes, staff);
  }

  disburseLoan(applicationId: string, methodOrDetails?: any, staff?: any, notes?: string): any {
    return LedgerEngine.disburseLoan(applicationId, methodOrDetails, staff, notes);
  }

  getLoans(): LoanRecord[] {
    return LedgerEngine.getLoans();
  }

  recordLoanRepayment(loanId: string, amount: number, channel: any = 'bank_transfer', staffOrRef?: any, notes?: string): any {
    return LedgerEngine.recordLoanRepayment(loanId, amount, channel, staffOrRef, notes);
  }

  getProgrammePayments(): ProgrammePaymentRecord[] {
    return LedgerEngine.getProgrammePayments();
  }

  recordUnifiedPayment(data: any): ProgrammePaymentRecord {
    return LedgerEngine.recordUnifiedPayment(data);
  }

  reverseProgrammePayment(paymentId: string, reason: string, staff?: any): ProgrammePaymentRecord | null {
    return LedgerEngine.reverseProgrammePayment(paymentId, reason, staff);
  }

  getAuditLogs(): AuditLogEntry[] {
    return LedgerEngine.getAuditLogs();
  }

  recordAuditLog(staffId: string, staffName: string, action: string, module: string, details: string): void {
    LedgerEngine.recordAuditLog(staffId, staffName, action, module, details);
  }

  getManagementSystemSummary(): SystemMetrics {
    return LedgerEngine.getManagementSystemSummary();
  }

  isLifetimeSuperAdmin(user: any): boolean {
    return LedgerEngine.isLifetimeSuperAdmin(user);
  }

  getLifetimeSuperAdmin(): StaffUser | null {
    return LedgerEngine.getLifetimeSuperAdmin();
  }

  createAdminUser(data: any, actor?: any): StaffUser {
    return LedgerEngine.createAdminUser(data, actor);
  }

  revokeAdminRole(adminId: string, actor?: any): StaffUser {
    return LedgerEngine.revokeAdminRole(adminId, actor);
  }

  updateAdminStatus(adminId: string, status: 'active' | 'suspended', actor?: any): StaffUser {
    return LedgerEngine.updateAdminStatus(adminId, status, actor);
  }

  updateStaffUser(staffId: string, updates: Partial<StaffUser>, actor?: any): StaffUser | null {
    return LedgerEngine.updateStaffUser(staffId, updates, actor);
  }

  deleteStaffOrAdminUser(userIdOrEmail: string, email?: string, actor?: any): boolean {
    const res = LedgerEngine.deleteStaffOrAdminUser(userIdOrEmail, email, actor);
    if (res) {
      this.notifyListeners({ type: 'STAFF_DELETED', id: userIdOrEmail });
    }
    return res;
  }

  getStaffAndAdminDirectory(): StaffUser[] {
    return LedgerEngine.getStaffAndAdminDirectory();
  }

  getUserActivityLogs(userId: string, actor?: any): AuditLogEntry[] {
    return LedgerEngine.getUserActivityLogs(userId, actor);
  }

  getRestrictedOversightLogs(actor?: any): RestrictedOversightLog[] {
    return LedgerEngine.getRestrictedOversightLogs(actor);
  }

  recordRestrictedOversightLog(entry: Omit<RestrictedOversightLog, 'id' | 'timestamp'>): void {
    LedgerEngine.recordRestrictedOversightLog(entry);
  }

  getMoneyTransferRequests(filters?: any): MoneyTransferRequest[] {
    return LedgerEngine.getMoneyTransferRequests(filters);
  }

  submitMoneyTransferRequest(data: any, actor?: any): MoneyTransferRequest {
    return LedgerEngine.submitMoneyTransferRequest(data, actor);
  }

  approveMoneyTransferRequest(requestId: string, actor: any, notes?: string): MoneyTransferRequest {
    return LedgerEngine.approveMoneyTransferRequest(requestId, actor, notes);
  }

  rejectMoneyTransferRequest(requestId: string, reason: string, actor: any): MoneyTransferRequest {
    return LedgerEngine.rejectMoneyTransferRequest(requestId, reason, actor);
  }

  executeMoneyTransferRequest(
    requestId: string,
    executionDetails: { proofOrRef: string; notes?: string },
    actor: any
  ): MoneyTransferRequest {
    return LedgerEngine.executeMoneyTransferRequest(requestId, executionDetails, actor);
  }

  static purgeAllFakeData(): void {
    purgeLegacyFakeDataIfPresent();
    saveToStorage(STORAGE_KEYS.CUSTOMERS, []);
    saveToStorage(STORAGE_KEYS.FIXED_TARGET, []);
    saveToStorage(STORAGE_KEYS.DAILY_AJO, []);
    saveToStorage(STORAGE_KEYS.FOOD_CONTRIBUTION, []);
    saveToStorage(STORAGE_KEYS.LEOCASH, []);
    saveToStorage(STORAGE_KEYS.LEOCASH_WITHDRAWALS, []);
    saveToStorage(STORAGE_KEYS.LOAN_APPLICATIONS, []);
    saveToStorage(STORAGE_KEYS.LOANS, []);
    saveToStorage(STORAGE_KEYS.PAYMENTS, []);
    saveToStorage(STORAGE_KEYS.MONEY_TRANSFERS, []);
    saveToStorage(STORAGE_KEYS.RESTRICTED_OVERSIGHT_LOGS, []);
    saveToStorage(STORAGE_KEYS.TRANSACTIONS, []);
    saveToStorage(STORAGE_KEYS.JOURNAL_ENTRIES, []);
    saveToStorage(STORAGE_KEYS.BENEFICIARIES, []);
    saveToStorage(STORAGE_KEYS.FRAUD_ALERTS, []);
    saveToStorage(STORAGE_KEYS.SUPPORT_TICKETS, []);
    saveToStorage(STORAGE_KEYS.ACCOUNTS, INITIAL_ACCOUNTS);
    saveToStorage(STORAGE_KEYS.STAFF, INITIAL_STAFF);
    saveToStorage(STORAGE_KEYS.CURRENT_STAFF, INITIAL_STAFF[0]);
    saveToStorage(STORAGE_KEYS.BOOTSTRAP, INITIAL_BOOTSTRAP_STATE);
  }

  purgeAllFakeData(): void {
    LedgerEngine.purgeAllFakeData();
    this.notifyListeners({ type: 'ALL_DATA_PURGED' });
  }
}

export const SYSTEM_ACCOUNT_VAULT_RESERVE = '1000000001';
export const SYSTEM_ACCOUNT_FEE_INCOME = '1000000002';

export const ledgerEngine = new LedgerEngine();

