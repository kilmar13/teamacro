export type StaffRole =
  | 'LIFETIME_SUPER_ADMIN'
  | 'ADMIN'
  | 'STAFF'
  | 'super_admin'
  | 'operations_manager'
  | 'loan_officer'
  | 'field_collector'
  | 'customer_service'
  | 'accountant'
  | 'auditor'
  | 'SUPER_ADMIN'
  | 'ACCOUNT_MANAGER'
  | 'OPERATIONS_MANAGER'
  | 'AUDITOR'
  | 'CUSTOMER_REGISTRATION_OFFICER'
  | 'PAYMENT_COLLECTION_OFFICER'
  | 'LOAN_OFFICER'
  | 'ACCOUNTS_OFFICER'
  | 'FIELD_COLLECTOR'
  | 'CUSTOMER_SERVICE'
  | 'ACCOUNTANT';

export type UserRole =
  | 'LIFETIME_SUPER_ADMIN'
  | 'ADMIN'
  | 'CUSTOMER'
  | 'STAFF'
  | 'SUPER_ADMIN'
  | 'ACCOUNT_MANAGER'
  | 'OPERATIONS_MANAGER'
  | 'AUDITOR'
  | 'CUSTOMER_REGISTRATION_OFFICER'
  | 'PAYMENT_COLLECTION_OFFICER'
  | 'LOAN_OFFICER'
  | 'ACCOUNTS_OFFICER'
  | 'FIELD_COLLECTOR'
  | 'CUSTOMER_SERVICE'
  | 'ACCOUNTANT'
  | StaffRole;

export interface PermissionSet {
  canViewDashboard: boolean;
  canRegisterCustomer: boolean;
  canEditCustomer: boolean;
  canManageSavings: boolean;
  canCollectPayments: boolean;
  canApproveLoans: boolean;
  canDisburseLoans: boolean;
  canProcessWithdrawals: boolean;
  canReversePayments: boolean;
  canViewReports: boolean;
  canExportReports: boolean;
  canManageStaff: boolean;
  canViewAuditLogs: boolean;
  canModifySettings: boolean;
  [key: string]: boolean | undefined;
}

export interface User {
  id: string;
  email: string;
  username?: string;
  fullName: string;
  phone: string;
  role: UserRole;
  position?: string;
  duty?: string;
  dashboardRoute?: string;
  assignedProgramme?: string;
  permissions?: PermissionSet | Record<string, boolean>;
  status?: 'active' | 'suspended' | 'inactive' | 'dormant' | string;
  active?: boolean;
  branchId?: string;
  staffCode?: string;
  roleTitle?: string;
  lastLogin?: string;
  lastLoginAt?: string;
  twoFactorEnabled?: boolean;
  kycTier?: number;
  createdAt?: string;
  avatarUrl?: string;
  isLifetimeSuperAdmin?: boolean;
}

export interface StaffUser {
  id: string;
  staffCode: string;
  fullName: string;
  email: string;
  phone: string;
  role: StaffRole;
  roleTitle: string;
  position?: string;
  duty?: string;
  dashboardRoute?: string;
  assignedProgramme?: string;
  permissions: PermissionSet;
  status: 'active' | 'suspended';
  lastLogin: string;
  avatarUrl?: string;
  isLifetimeSuperAdmin?: boolean;
  createdByStaffId?: string;
  createdByName?: string;
  assignedModules?: string[];
  operationalResponsibility?: string;
  createdAt?: string;
  lastActivityAt?: string;
}

export interface CustomerRecord {
  id: string;
  customerCode: string;
  fullName: string;
  email: string;
  phone: string;
  altPhone?: string;
  address: string;
  ninOrBvn: string;
  state: string;
  lga: string;
  occupation: string;
  nextOfKinName: string;
  nextOfKinPhone: string;
  nextOfKinRelationship: string;
  registrationDate: string;
  createdAt?: string;
  joinedDate?: string;
  registeredByStaffId: string;
  status: 'active' | 'suspended' | 'dormant' | 'ACTIVE' | 'INACTIVE' | string;
  avatarUrl?: string;
  notes?: string;
  enrolledProgrammes?: string[];
}

export interface FixedTargetPlan {
  id: string;
  planCode: string;
  customerId: string;
  customerName: string;
  title: string;
  planName?: string;
  targetAmount: number;
  currentBalance: number;
  frequency: 'daily' | 'weekly' | 'monthly';
  contributionFrequency?: string;
  instalmentAmount: number;
  startDate: string;
  targetDate: string;
  totalExpectedInstalments: number;
  completedInstalments: number;
  status: 'active' | 'completed' | 'broken' | 'liquidated' | 'ACTIVE' | 'COMPLETED' | string;
  autoLock: boolean;
  createdAt: string;
  targetAmountKobo?: number;
  currentBalanceKobo?: number;
  savedAmountKobo?: number;
  durationMonths?: number;
}

export interface DailyAjoEnrolment {
  id: string;
  cycleCode: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  dailyAmount: number;
  cycleDays: number;
  currentDay: number;
  totalSaved: number;
  managementFeeCommission: number;
  payoutAmount: number;
  paidDays: number[];
  missedDays: number[];
  status: 'active' | 'completed' | 'defaulted' | 'ACTIVE' | 'COMPLETED' | string;
  startDate: string;
  expectedEndDate: string;
  assignedCollectorId: string;
  notes?: string;
  cycleMonth?: string;
  dailyAmountKobo?: number;
  totalSavedKobo?: number;
  totalCollectedKobo?: number;
  cycleDurationDays?: number;
}

export type FoodPackageType =
  | 'FAMILY_STAPLES'
  | 'PROTEIN_PLUS'
  | 'FESTIVE_FEAST'
  | 'MINI_BASKET'
  | 'Family Staples Package'
  | 'Protein Plus Package'
  | 'Festive Feast Package'
  | 'Mini Household Basket'
  | string;

export interface EveryhomeFoodEnrolment {
  id: string;
  enrolmentCode: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  householdAddress: string;
  packageName: string;
  packageType?: FoodPackageType;
  householdHeadName?: string;
  packageValue: number;
  frequency: 'daily' | 'weekly' | 'monthly';
  targetAmount: number;
  amountPaid: number;
  outstandingBalance: number;
  paymentCount: number;
  targetDate: string;
  fulfilmentStatus:
    | 'Pending Contribution'
    | 'Eligible for Pick-up'
    | 'Fulfilled & Delivered'
    | 'PENDING'
    | 'READY'
    | 'DISTRIBUTED'
    | string;
  distributionLocation: string;
  registeredDate: string;
  distributionDate?: string;
  targetAmountKobo?: number;
  amountPaidKobo?: number;
  outstandingBalanceKobo?: number;
  totalContributedKobo?: number;
  packageCostKobo?: number;
}

export interface LeocashAccountRecord {
  id: string;
  accountNumber: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  availableBalance: number;
  ledgerBalance: number;
  interestRateAnnual: number;
  totalDeposited: number;
  totalWithdrawn: number;
  status: 'active' | 'frozen' | 'closed';
  openedDate: string;
  lastActivityDate: string;
  balanceKobo?: number;
  totalDepositsKobo?: number;
  totalWithdrawalsKobo?: number;
}

export interface LeocashWithdrawalRequest {
  id: string;
  requestId: string;
  accountId: string;
  customerId: string;
  customerName: string;
  amount: number;
  amountKobo?: number;
  reason: string;
  requestedDate: string;
  requestDate?: string;
  requestedByStaffId: string;
  status:
    | 'pending_review'
    | 'approved'
    | 'rejected'
    | 'disbursed'
    | 'PENDING_APPROVAL'
    | 'APPROVED'
    | 'REJECTED'
    | 'DISBURSED';
  reviewedByStaffId?: string;
  reviewDate?: string;
  reviewNotes?: string;
  payoutMethod?: string;
}

export interface RepaymentScheduleItem {
  instalmentNumber: number;
  dueDate: string;
  principal: number;
  interest: number;
  totalDue: number;
  amountPaid: number;
  outstandingKobo?: number;
  status: 'upcoming' | 'paid' | 'overdue' | 'partial';
  paidDate?: string;
}

export interface LoanApplicationRecord {
  id: string;
  applicationCode: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  borrowerName?: string;
  borrowerPhone?: string;
  requestedAmount: number;
  requestedAmountKobo?: number;
  approvedAmount?: number;
  approvedAmountKobo?: number;
  purpose: string;
  tenorMonths: number;
  proposedDurationMonths?: number;
  interestRate: number;
  interestRateMonthlyPercent?: number;
  monthlyRepayment: number;
  collateralDescription: string;
  guarantorName: string;
  guarantorPhone: string;
  guarantorAddress: string;
  guarantorRelationship: string;
  status:
    | 'draft'
    | 'under_review'
    | 'approved_awaiting_disbursement'
    | 'rejected'
    | 'disbursed'
    | 'PENDING'
    | 'APPROVED'
    | 'REJECTED'
    | 'DISBURSED';
  isDisbursed?: boolean;
  appliedDate: string;
  reviewedByStaffId?: string;
  reviewDate?: string;
  approvalNotes?: string;
}

export interface LoanRecord {
  id: string;
  loanCode: string;
  loanReference?: string;
  applicationId: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  borrowerName?: string;
  borrowerPhone?: string;
  principalAmount: number;
  principalKobo?: number;
  interestRate: number;
  totalRepayable: number;
  totalPayableKobo?: number;
  tenorMonths: number;
  disbursementDate: string;
  disbursedByStaffId: string;
  disbursementMethod: string;
  disbursementReference: string;
  monthlyInstalment: number;
  totalPaid: number;
  totalRepaidKobo?: number;
  outstandingBalance: number;
  outstandingBalanceKobo?: number;
  nextDueDate: string;
  status: 'active' | 'repaid' | 'overdue' | 'defaulted';
  repaymentSchedule: RepaymentScheduleItem[];
}

export type ProgrammeType =
  | 'fixed_target'
  | 'daily_ajo'
  | 'everyhome_food'
  | 'leocash'
  | 'loan_management';

export interface ProgrammePaymentRecord {
  id: string;
  receiptNumber: string;
  customerId: string;
  customerName: string;
  programmeType: ProgrammeType;
  programmeLabel: string;
  programme?: string;
  type?: string;
  referenceId: string;
  reference?: string;
  amount: number;
  amountKobo?: number;
  paymentChannel: 'cash' | 'bank_transfer' | 'pos_terminal' | 'cheque';
  paymentMethod?: string;
  transactionReference: string;
  collectedByStaffId: string;
  collectedByStaffName: string;
  recordedByStaffName?: string;
  timestamp: string;
  dateTime?: string;
  status: 'completed' | 'reversed' | 'CONFIRMED_RECORDED' | 'REVERSED' | string;
  notes?: string;
  verificationNote?: string;
  reversalReason?: string;
  reversedByStaffId?: string;
  reversedAt?: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  staffId: string;
  staffName: string;
  action: string;
  module: string;
  details: string;
  ipAddress?: string;
  severity?: 'INFO' | 'WARNING' | 'CRITICAL';
  actorName?: string;
  actorRole?: string;
  entityType?: string;
  entityId?: string;
}

export type AuditEvent = AuditLogEntry;

export interface SystemMetrics {
  totalCustomers: number;
  activeCustomers: number;
  totalFixedTargetBalance: number;
  totalDailyAjoCollected: number;
  totalFoodContributionValue: number;
  totalLeocashDeposits: number;
  totalDisbursedLoans: number;
  totalOutstandingLoanBalance: number;
  totalOverdueInstalments: number;
  todayCollections: number;
  monthCollections: number;
  totalDisbursedKobo?: number;
  totalOutstandingLoansKobo?: number;
  totalFixedTargetSavedKobo?: number;
  totalDailyAjoCollectedKobo?: number;
  totalFoodContributedKobo?: number;
  totalLeocashBalanceKobo?: number;
  totalSavingsCollectedKobo?: number;
  totalLoanApplications?: number;
  approvedLoans?: number;
}

export interface BankRates {
  savingsAnnualRatePercent: number;
  fixedDepositRatePercent: number;
  smeLoanMonthlyRatePercent: number;
  personalLoanMonthlyRatePercent: number;
}

export interface BankTariffs {
  internalTransferFeeKobo: number;
  nipTransferFeeBelow5kKobo: number;
  nipTransferFeeAbove5kKobo: number;
  nipTransferFeeAbove50kKobo: number;
  smsAlertFeeKobo: number;
  debitCardIssuanceKobo: number;
}

export interface BankConfig {
  bankName: string;
  slogan: string;
  rcNumber: string;
  headOffice: string;
  hotline: string;
  supportEmail: string;
  rates: BankRates;
  tariffs: BankTariffs;
}

export const DEFAULT_BANK_CONFIG: BankConfig = {
  bankName: 'TEAMACRO SERVICES LTD',
  slogan: 'Bringing Savings, Contributions and Loan Management Together',
  rcNumber: '1589421',
  headOffice: 'TEAMACRO Corporate Headquarters, Lagos, Nigeria',
  hotline: '+234 803 000 0000 / contact@teamacro.ng',
  supportEmail: 'contact@teamacro.ng',
  rates: {
    savingsAnnualRatePercent: 8.5,
    fixedDepositRatePercent: 12.0,
    smeLoanMonthlyRatePercent: 3.5,
    personalLoanMonthlyRatePercent: 4.0,
  },
  tariffs: {
    internalTransferFeeKobo: 0,
    nipTransferFeeBelow5kKobo: 0,
    nipTransferFeeAbove5kKobo: 0,
    nipTransferFeeAbove50kKobo: 0,
    smsAlertFeeKobo: 0,
    debitCardIssuanceKobo: 0,
  },
};

export interface CustomerAccount {
  id: string;
  userId: string;
  accountNumber: string;
  accountName: string;
  accountType: 'SAVINGS' | 'CURRENT' | 'FIXED_DEPOSIT' | 'SME_ENTERPRISE';
  tier: 1 | 2 | 3;
  currency: 'NGN';
  balanceKobo: number;
  ledgerBalanceKobo: number;
  dailyTransferLimitKobo: number;
  status: 'ACTIVE' | 'FROZEN' | 'DORMANT' | 'CLOSED';
  openedAt: string;
  overdraftLimitKobo?: number;
  name?: string;
  isSystem?: boolean;
  type?: string;
  availableBalanceKobo?: number;
}

export interface Transaction {
  id: string;
  reference: string;
  accountId?: string;
  sourceAccountId?: string;
  sourceAccountNumber?: string;
  sourceAccountName?: string;
  accountNumber?: string;
  accountName?: string;
  initiatedById?: string;
  initiatedByName?: string;
  type: 'TRANSFER_IN' | 'TRANSFER_OUT' | 'DEPOSIT' | 'WITHDRAWAL' | 'FEE' | 'INTEREST' | 'REVERSAL' | 'LOAN_DISBURSEMENT' | 'LOAN_REPAYMENT' | string;
  direction?: 'CREDIT' | 'DEBIT';
  amountKobo: number;
  feeKobo?: number;
  balanceAfterKobo?: number;
  narration: string;
  status: 'PENDING' | 'SUCCESSFUL' | 'FAILED' | 'REVERSED' | string;
  timestamp: string;
  createdAt?: string;
  channel?: 'INTERNAL' | 'NIP' | 'CARD' | 'BRANCH' | 'SYSTEM' | string;
  destinationBankName?: string;
  destinationBankCode?: string;
  destinationAccountNumber?: string;
  destinationAccountName?: string;
  idempotencyKey?: string;
}

export interface Beneficiary {
  id: string;
  userId: string;
  bankCode: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  nickname?: string;
  createdAt: string;
}

export interface GovernanceDocument {
  id: string;
  title: string;
  category: 'BOARD_CHARTER' | 'RISK_MANAGEMENT' | 'CUSTOMER_PROTECTION' | 'WHISTLEBLOWING' | 'AML_CFT';
  description: string;
  version: string;
  approvedDate: string;
  reviewDate: string;
  status: 'ACTIVE' | 'UNDER_REVIEW' | 'ARCHIVED';
  paragraphs: string[];
  revisionNumber?: string;
  summary?: string;
  effectiveDate?: string;
  approvedBy?: string;
  contentMarkdown?: string;
}

export interface SupportTicket {
  id: string;
  ticketNumber: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  category: 'TRANSFER_DISPUTE' | 'CARD_ISSUE' | 'ACCOUNT_UPDATE' | 'FRAUD_REPORT' | 'GENERAL_ENQUIRY';
  subject: string;
  message: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  createdAt: string;
  responses?: { author: string; message: string; timestamp: string }[];
  assignedStaff?: string;
  response?: string;
}

export interface AccountApplication {
  id: string;
  applicationNumber: string;
  accountType: 'SAVINGS' | 'CURRENT' | 'SME_ENTERPRISE';
  tierRequested: 1 | 2 | 3;
  fullName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  bvn: string;
  nin: string;
  residentialAddress: string;
  state: string;
  lga: string;
  occupation: string;
  employerName: string;
  pepDeclaration: boolean;
  idDocumentName: string;
  utilityBillName: string;
  passportPhotoName: string;
  status: 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED';
  submittedAt: string;
  assignedAccountNumber?: string;
  reference?: string;
}

export interface SuperAdminBootstrapState {
  isInitialized: boolean;
  initializedAt?: string;
  superAdminEmail?: string;
  superAdminName?: string;
  lifetimeSuperAdminId?: string;
  lifetimeSuperAdminEmail?: string;
  canResetWithMasterKey: boolean;
  lockdownEnforced?: boolean;
  immutableOwnerBound?: boolean;
  initializedByEmail?: string;
  initializationActorName?: string;
}

export type MoneyTransferType =
  | 'LOAN_DISBURSEMENT'
  | 'CUSTOMER_WITHDRAWAL'
  | 'SAVINGS_WITHDRAWAL'
  | 'OUTGOING_PAYOUT'
  | 'REFUND'
  | 'REVERSAL'
  | 'LEDGER_TRANSFER';

export type MoneyTransferStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'FAILED';

export interface MoneyTransferRequest {
  id: string;
  reference: string;
  type: MoneyTransferType;
  programme: 'FIXED_TARGET' | 'DAILY_AJO' | 'EVERYHOME_FOOD' | 'LEOCASH' | 'LOAN_MANAGEMENT' | 'CORE_BANKING' | string;
  programmeLabel: string;
  customerId: string;
  customerName: string;
  customerPhone?: string;
  accountNumber?: string;
  amount: number;
  amountKobo: number;
  paymentMethod: 'CASH' | 'BANK_TRANSFER' | 'CHEQUE' | 'INTERNAL_LEDGER';
  destinationDetails?: {
    bankName?: string;
    accountNumber?: string;
    accountName?: string;
  };
  submittedByStaffId: string;
  submittedByStaffName: string;
  submittedByStaffRole: string;
  submittedAt: string;
  submissionNotes?: string;
  supportingDocumentUrl?: string;
  status: MoneyTransferStatus;
  reviewedByStaffId?: string;
  reviewedByStaffName?: string;
  reviewedByStaffRole?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  rejectionReason?: string;
  executedByStaffId?: string;
  executedByStaffName?: string;
  executedAt?: string;
  executionReference?: string;
  executionNotes?: string;
  isManuallyExecutedOutsideApp?: boolean;
  relatedEntityId?: string;
}

export interface RestrictedOversightLog {
  id: string;
  timestamp: string;
  superAdminId: string;
  superAdminName: string;
  targetUserId: string;
  targetUserName: string;
  targetUserRole: string;
  action: string;
  details: string;
  ipAddress?: string;
}

export interface FraudAlert {
  id: string;
  transactionId?: string;
  accountId?: string;
  accountNumber?: string;
  customerName: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  ruleTriggered: string;
  reason: string;
  description?: string;
  status: 'OPEN' | 'INVESTIGATING' | 'DISMISSED' | 'ESCALATED_SAR';
  timestamp: string;
  createdAt?: string;
  resolutionNotes?: string;
}

export interface JournalLine {
  id?: string;
  accountId: string;
  accountNumber: string;
  accountName?: string;
  direction: 'DEBIT' | 'CREDIT';
  amountKobo: number;
  narration?: string;
}

export interface JournalEntry {
  id: string;
  transactionId: string;
  timestamp: string;
  description: string;
  lines: JournalLine[];
}

export interface MakerCheckerRequest {
  id: string;
  requestType: 'TRANSACTION_REVERSAL' | 'LOAN_APPROVAL' | 'FEE_WAIVER' | 'ACCOUNT_FREEZE';
  entityId: string;
  initiatorId: string;
  initiatorName: string;
  initiatorRole: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  details: string;
  createdAt: string;
  approverId?: string;
  approverName?: string;
  decidedAt?: string;
}
