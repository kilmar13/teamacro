export type CanonicalAdminPosition =
  | 'Account Manager'
  | 'Operations Manager'
  | 'Auditor';

export type CanonicalStaffPosition =
  | 'Customer Registration Officer'
  | 'Payment Collection Officer'
  | 'Loan Officer'
  | 'Accounts Officer';

export type AdminPosition = CanonicalAdminPosition;
export type StaffPosition = CanonicalStaffPosition;
export type CanonicalPosition = CanonicalAdminPosition | CanonicalStaffPosition;

export const ADMIN_POSITIONS: readonly CanonicalAdminPosition[] = [
  'Account Manager',
  'Operations Manager',
  'Auditor',
] as const;

export const STAFF_POSITIONS: readonly CanonicalStaffPosition[] = [
  'Customer Registration Officer',
  'Payment Collection Officer',
  'Loan Officer',
  'Accounts Officer',
] as const;

export const ASSIGNABLE_PROGRAMMES: string[] = [
  'All Programmes & General Operations',
  'Fixed Target Savings',
  'Daily Ajo Savings',
  'Everyhome Food Contribution',
  'Leocash Flexible Savings',
  'Loan & Credit Operations',
  'Central Accounts & Treasury',
];

export const POSITION_ROUTE_MAP: Record<CanonicalPosition, string> = {
  'Account Manager': '/admin/accountmanager',
  'Operations Manager': '/admin/operationsmanager',
  'Auditor': '/admin/auditor',
  'Customer Registration Officer': '/staff/customer-registration',
  'Payment Collection Officer': '/staff/payment-collection',
  'Loan Officer': '/staff/loan-officer',
  'Accounts Officer': '/staff/accounts-officer',
};

export interface PositionMetadata {
  position: CanonicalPosition;
  tier: 'ADMIN' | 'STAFF';
  category: 'ADMIN' | 'STAFF';
  route: string;
  roleCode: string;
  summary: string;
  responsibilities: string[];
  readOnly?: boolean;
}

export const POSITION_METADATA: Record<CanonicalPosition, PositionMetadata> = {
  'Account Manager': {
    position: 'Account Manager',
    tier: 'ADMIN',
    category: 'ADMIN',
    route: '/admin/accountmanager',
    roleCode: 'ACCOUNT_MANAGER',
    summary: 'Financial management, savings collection review, loan disbursement monitoring, and account reconciliation.',
    responsibilities: [
      'Review savings collections across all programmes',
      'Monitor loan disbursements and outstanding balances',
      'Review customer account balances and financial statements',
      'Reconcile collections against recorded ledger transactions',
      'Identify financial discrepancies and generate financial summaries',
    ],
  },
  'Operations Manager': {
    position: 'Operations Manager',
    tier: 'ADMIN',
    category: 'ADMIN',
    route: '/admin/operationsmanager',
    roleCode: 'OPERATIONS_MANAGER',
    summary: 'Programme oversight, operational activity monitoring, staff supervision, and operational reporting.',
    responsibilities: [
      'Oversee assigned savings programmes and operational workflows',
      'Supervise assigned operational staff and monitor daily tasks',
      'Monitor customer registration, savings, and loan operations',
      'Identify operational delays, incomplete tasks, or bottlenecks',
      'Generate operational performance reports',
    ],
  },
  'Auditor': {
    position: 'Auditor',
    tier: 'ADMIN',
    category: 'ADMIN',
    route: '/admin/auditor',
    roleCode: 'AUDITOR',
    readOnly: true,
    summary: 'Strictly read-only internal compliance inspection, transaction verification, and audit trail review.',
    responsibilities: [
      'Review customer records and financial transaction histories (Read-Only)',
      'Inspect savings contribution and loan repayment/disbursement histories',
      'Review account balances and reconciliation reports',
      'Inspect staff activity logs and system audit trails',
      'Identify discrepancies and export downloadable audit reports',
    ],
  },
  'Customer Registration Officer': {
    position: 'Customer Registration Officer',
    tier: 'STAFF',
    category: 'STAFF',
    route: '/staff/customer-registration',
    roleCode: 'CUSTOMER_REGISTRATION_OFFICER',
    summary: 'Customer onboarding, KYC verification, programme enrolment, and customer profile maintenance.',
    responsibilities: [
      'Register new customers and capture KYC / Next-of-Kin details',
      'Enrol customers into appropriate savings programmes',
      'Update customer contact and profile records when authorised',
      'Search and locate existing customer accounts',
      'Track registration history and incomplete customer profiles',
    ],
  },
  'Payment Collection Officer': {
    position: 'Payment Collection Officer',
    tier: 'STAFF',
    category: 'STAFF',
    route: '/staff/payment-collection',
    roleCode: 'PAYMENT_COLLECTION_OFFICER',
    summary: 'Savings contribution and loan repayment collection, receipt issuance, and daily collection logging.',
    responsibilities: [
      'Record customer savings contributions across programmes',
      'Record loan instalment repayments with unique payment references',
      'Prevent duplicate transaction submissions and issue receipts',
      'View and filter daily/monthly collection histories',
      'Track collection performance against assigned targets',
    ],
  },
  'Loan Officer': {
    position: 'Loan Officer',
    tier: 'STAFF',
    category: 'STAFF',
    route: '/staff/loan-officer',
    roleCode: 'LOAN_OFFICER',
    summary: 'Borrower registration, loan application origination, credit appraisal, and repayment schedule tracking.',
    responsibilities: [
      'Register borrowers and originate new loan applications',
      'Capture and review borrower credit & guarantor details',
      'Track loan application status through approval stages',
      'Monitor repayment schedules, upcoming due dates, and overdue loans',
      'View borrower loan history and update permitted application details',
    ],
  },
  'Accounts Officer': {
    position: 'Accounts Officer',
    tier: 'STAFF',
    category: 'STAFF',
    route: '/staff/accounts-officer',
    roleCode: 'ACCOUNTS_OFFICER',
    summary: 'Accounts review, collection vs. balance verification, discrepancy identification, and reconciliation support.',
    responsibilities: [
      'Review recorded savings collections and loan disbursements',
      'Review customer account balances and repayment records',
      'Compare financial records and flag balance discrepancies',
      'Assist with daily/monthly ledger reconciliation preparation',
      'Prepare financial summaries and downloadable accounts reports',
    ],
  },
};

/**
 * Normalizes any duty, roleTitle, or role string into one of the 7 canonical positions if applicable.
 */
export function normalizeCanonicalPosition(
  rawPosition?: string | null,
  rawRole?: string | null
): CanonicalPosition | null {
  const text = `${rawPosition || ''} ${rawRole || ''}`.trim().toLowerCase();
  if (!text) return null;

  if (text.includes('account manager') || text.includes('treasury & ledger administrator')) {
    return 'Account Manager';
  }
  if (text.includes('auditor') || text.includes('compliance & audit')) {
    return 'Auditor';
  }
  if (text.includes('operations manager') || text.includes('branch operations administrator')) {
    return 'Operations Manager';
  }
  if (text.includes('customer registration') || text.includes('customer service') || text.includes('customer_service')) {
    return 'Customer Registration Officer';
  }
  if (text.includes('payment collection') || text.includes('field collector') || text.includes('field_collector')) {
    return 'Payment Collection Officer';
  }
  if (text.includes('loan officer') || text.includes('loan_officer') || text.includes('credit & risk')) {
    return 'Loan Officer';
  }
  if (text.includes('accounts officer') || text.includes('accountant')) {
    return 'Accounts Officer';
  }

  // Fallback by high-level role if a legacy generic title was used
  const roleUpper = (rawRole || '').trim().toUpperCase();
  if (roleUpper === 'ADMIN') {
    return 'Operations Manager';
  }
  if (roleUpper === 'STAFF') {
    return 'Customer Registration Officer';
  }

  return null;
}

/**
 * Returns the dedicated dashboard route for any user/session object.
 */
export function getDedicatedRouteForUser(user?: {
  role?: string | null;
  roleTitle?: string | null;
  duty?: string | null;
  position?: string | null;
  operationalResponsibility?: string | null;
  dashboardRoute?: string | null;
  isLifetimeSuperAdmin?: boolean;
} | null): string {
  if (!user) return '/staff/login';

  if (user.isLifetimeSuperAdmin || user.role === 'LIFETIME_SUPER_ADMIN' || user.role === 'SUPER_ADMIN') {
    return '/supa-admin';
  }

  if (user.dashboardRoute && Object.values(POSITION_ROUTE_MAP).includes(user.dashboardRoute)) {
    return user.dashboardRoute;
  }

  const pos = normalizeCanonicalPosition(
    user.position || user.duty || user.roleTitle || user.operationalResponsibility,
    user.role
  );

  if (pos && POSITION_ROUTE_MAP[pos]) {
    return POSITION_ROUTE_MAP[pos];
  }

  if (user.role === 'ADMIN') {
    return '/admin/operationsmanager';
  }

  return '/staff/customer-registration';
}

/**
 * Checks whether a user is strictly read-only (Auditor position).
 */
export function isReadOnlyAuditor(user?: {
  role?: string | null;
  roleTitle?: string | null;
  duty?: string | null;
  position?: string | null;
  operationalResponsibility?: string | null;
  isLifetimeSuperAdmin?: boolean;
} | null): boolean {
  if (!user) return false;
  if (user.isLifetimeSuperAdmin || user.role === 'LIFETIME_SUPER_ADMIN') return false;
  const pos = normalizeCanonicalPosition(
    user.position || user.duty || user.roleTitle || user.operationalResponsibility,
    user.role
  );
  return pos === 'Auditor' || String(user.role || '').toUpperCase() === 'AUDITOR';
}

/**
 * Returns the default granular permissions for each of the 7 positions.
 */
export function getDefaultPositionPermissions(
  rawPosition?: CanonicalPosition | string | null
): Record<string, boolean> {
  const position =
    normalizeCanonicalPosition(rawPosition) || 'Customer Registration Officer';
  switch (position) {
    case 'Account Manager':
      return {
        canViewDashboard: true,
        canViewCustomers: true,
        canRegisterCustomers: false,
        canRegisterCustomer: false,
        canEditCustomer: false,
        canRecordCollections: false,
        canCollectPayments: false,
        canManageSavings: true,
        canReviewLoans: true,
        canApproveLoans: true,
        canDisburseLoans: true,
        canUpdateLoanStages: false,
        canViewFinancialRecords: true,
        canViewReports: true,
        canPrepareReconciliations: true,
        canApproveTransactions: true,
        canViewAuditLogs: true,
        canManageStaff: false,
        canExportReports: true,
        canReversePayments: false,
        canModifySettings: false,
      };
    case 'Operations Manager':
      return {
        canViewDashboard: true,
        canViewCustomers: true,
        canRegisterCustomers: true,
        canRegisterCustomer: true,
        canEditCustomer: true,
        canRecordCollections: true,
        canCollectPayments: true,
        canManageSavings: true,
        canReviewLoans: true,
        canApproveLoans: true,
        canDisburseLoans: false,
        canUpdateLoanStages: true,
        canViewFinancialRecords: true,
        canViewReports: true,
        canPrepareReconciliations: true,
        canApproveTransactions: true,
        canViewAuditLogs: true,
        canManageStaff: true,
        canExportReports: true,
        canReversePayments: false,
        canModifySettings: false,
      };
    case 'Auditor':
      // Strictly Read-Only — all write/approve/create/modify flags are false
      return {
        canViewDashboard: true,
        canViewCustomers: true,
        canRegisterCustomers: false,
        canRegisterCustomer: false,
        canEditCustomer: false,
        canRecordCollections: false,
        canCollectPayments: false,
        canManageSavings: false,
        canReviewLoans: true,
        canApproveLoans: false,
        canDisburseLoans: false,
        canUpdateLoanStages: false,
        canViewFinancialRecords: true,
        canViewReports: true,
        canPrepareReconciliations: false,
        canApproveTransactions: false,
        canViewAuditLogs: true,
        canManageStaff: false,
        canExportReports: true,
        canReversePayments: false,
        canModifySettings: false,
      };
    case 'Customer Registration Officer':
      return {
        canViewDashboard: true,
        canViewCustomers: true,
        canRegisterCustomers: true,
        canRegisterCustomer: true,
        canEditCustomer: true,
        canRecordCollections: false,
        canCollectPayments: false,
        canManageSavings: true,
        canReviewLoans: false,
        canApproveLoans: false,
        canDisburseLoans: false,
        canUpdateLoanStages: false,
        canViewFinancialRecords: false,
        canViewReports: true,
        canPrepareReconciliations: false,
        canApproveTransactions: false,
        canViewAuditLogs: false,
        canManageStaff: false,
        canExportReports: false,
        canReversePayments: false,
        canModifySettings: false,
      };
    case 'Payment Collection Officer':
      return {
        canViewDashboard: true,
        canViewCustomers: true,
        canRegisterCustomers: false,
        canRegisterCustomer: false,
        canEditCustomer: false,
        canRecordCollections: true,
        canCollectPayments: true,
        canManageSavings: true,
        canReviewLoans: false,
        canApproveLoans: false,
        canDisburseLoans: false,
        canUpdateLoanStages: false,
        canViewFinancialRecords: true,
        canViewReports: true,
        canPrepareReconciliations: false,
        canApproveTransactions: false,
        canViewAuditLogs: false,
        canManageStaff: false,
        canExportReports: true,
        canReversePayments: false,
        canModifySettings: false,
      };
    case 'Loan Officer':
      return {
        canViewDashboard: true,
        canViewCustomers: true,
        canRegisterCustomers: false,
        canRegisterCustomer: false,
        canEditCustomer: false,
        canRecordCollections: false,
        canCollectPayments: false,
        canManageSavings: false,
        canReviewLoans: true,
        canApproveLoans: false,
        canDisburseLoans: false,
        canUpdateLoanStages: true,
        canViewFinancialRecords: false,
        canViewReports: true,
        canPrepareReconciliations: false,
        canApproveTransactions: false,
        canViewAuditLogs: false,
        canManageStaff: false,
        canExportReports: true,
        canReversePayments: false,
        canModifySettings: false,
      };
    case 'Accounts Officer':
      return {
        canViewDashboard: true,
        canViewCustomers: true,
        canRegisterCustomers: false,
        canRegisterCustomer: false,
        canEditCustomer: false,
        canRecordCollections: false,
        canCollectPayments: false,
        canManageSavings: false,
        canReviewLoans: false,
        canApproveLoans: false,
        canDisburseLoans: false,
        canUpdateLoanStages: false,
        canViewFinancialRecords: true,
        canViewReports: true,
        canPrepareReconciliations: true,
        canApproveTransactions: false,
        canViewAuditLogs: true,
        canManageStaff: false,
        canExportReports: true,
        canReversePayments: false,
        canModifySettings: false,
      };
  }
}

/**
 * Enforces read-only constraints on Auditor permissions even if someone attempts to pass write flags.
 */
export function sanitizePermissionsForPosition(
  rawPosition?: CanonicalPosition | string | null,
  customPermissions?: Record<string, boolean>
): Record<string, boolean> {
  const position = normalizeCanonicalPosition(rawPosition);
  const base = position ? getDefaultPositionPermissions(position) : getDefaultPositionPermissions('Customer Registration Officer');
  if (position === 'Auditor') {
    // Auditor is strictly read-only under all circumstances
    return {
      ...base,
      canRegisterCustomers: false,
      canRegisterCustomer: false,
      canEditCustomer: false,
      canRecordCollections: false,
      canCollectPayments: false,
      canManageSavings: false,
      canApproveLoans: false,
      canDisburseLoans: false,
      canUpdateLoanStages: false,
      canPrepareReconciliations: false,
      canApproveTransactions: false,
      canManageStaff: false,
      canReversePayments: false,
      canModifySettings: false,
    };
  }
  if (!customPermissions || typeof customPermissions !== 'object') {
    return base;
  }
  const merged: Record<string, boolean> = {
    ...base,
    ...customPermissions,
    canModifySettings: false, // Reserved exclusively for Lifetime Super Admin
  };
  if (typeof customPermissions.canRegisterCustomers === 'boolean') {
    merged.canRegisterCustomer = customPermissions.canRegisterCustomers;
  } else if (typeof customPermissions.canRegisterCustomer === 'boolean') {
    merged.canRegisterCustomers = customPermissions.canRegisterCustomer;
  }
  return merged;
}
