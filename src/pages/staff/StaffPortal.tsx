import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Target,
  Calendar,
  ShoppingBag,
  Coins,
  FileSpreadsheet,
  BarChart3,
  UserCheck,
  Settings,
  Plus,
  Search,
  Filter,
  Download,
  Printer,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
  RefreshCw,
  LogOut,
  Eye,
  ShieldAlert,
  ChevronRight,
  X,
  FileText,
  AlertCircle,
  TrendingUp,
  Percent,
  Check,
  Building2,
  ExternalLink,
} from 'lucide-react';
import {
  BankConfig,
  User,
  StaffRole,
  CustomerRecord,
  FixedTargetPlan,
  DailyAjoEnrolment,
  EveryhomeFoodEnrolment,
  FoodPackageType,
  LeocashAccountRecord,
  LeocashWithdrawalRequest,
  LoanApplicationRecord,
  LoanRecord,
  ProgrammePaymentRecord,
  AuditEvent,
} from '../../types/banking';
import { ledgerEngine } from '../../services/ledgerEngine';
import { formatNaira, formatLagosDate, nairaToKobo, koboToNaira } from '../../utils/formatters';
import { BrandLogo } from '../../components/common/BrandLogo';
import { ThemeSelector } from '../../components/common/ThemeSelector';
import { normalizeError } from '../../utils/errorNormalizer';

interface StaffPortalProps {
  config: BankConfig;
  onNavigate: (route: string) => void;
  currentUser?: User | null;
  onLogout?: () => void;
}

export const StaffPortal: React.FC<StaffPortalProps> = ({ config, onNavigate, currentUser: initialUser, onLogout }) => {
  // Current active authenticated staff user
  const [currentUser, setCurrentUser] = useState<User>(() => {
    if (initialUser) {
      return initialUser;
    }
    const sessionUser = ledgerEngine.getCurrentUser();
    if (sessionUser) {
      return sessionUser;
    }
    return {
      id: 'UNAUTHENTICATED',
      email: '',
      fullName: 'Authorised Staff',
      phone: '',
      role: 'STAFF',
      active: true,
      createdAt: new Date().toISOString(),
    };
  });

  useEffect(() => {
    if (initialUser) {
      setCurrentUser(initialUser);
      ledgerEngine.setCurrentUser(initialUser);
    }
  }, [initialUser]);

  // Active navigation tab
  const [activeTab, setActiveTab] = useState<
    | 'dashboard'
    | 'customers'
    | 'payments'
    | 'fixed_target'
    | 'daily_ajo'
    | 'everyhome_food'
    | 'leocash'
    | 'loans'
    | 'reports'
    | 'staff_mgmt'
    | 'settings'
  >('dashboard');

  // Authoritative State from Ledger Engine
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [payments, setPayments] = useState<ProgrammePaymentRecord[]>([]);
  const [fixedTargetPlans, setFixedTargetPlans] = useState<FixedTargetPlan[]>([]);
  const [dailyAjoEnrolments, setDailyAjoEnrolments] = useState<DailyAjoEnrolment[]>([]);
  const [foodEnrolments, setFoodEnrolments] = useState<EveryhomeFoodEnrolment[]>([]);
  const [leocashAccounts, setLeocashAccounts] = useState<LeocashAccountRecord[]>([]);
  const [leocashWithdrawals, setLeocashWithdrawals] = useState<LeocashWithdrawalRequest[]>([]);
  const [loanApplications, setLoanApplications] = useState<LoanApplicationRecord[]>([]);
  const [loans, setLoans] = useState<LoanRecord[]>([]);
  const [staffUsers, setStaffUsers] = useState<User[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [summary, setSummary] = useState(() => ledgerEngine.getManagementSystemSummary());

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [programmeFilter, setProgrammeFilter] = useState('ALL');

  // Modals & Action States
  const [modalType, setModalType] = useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRecord | null>(null);
  const [selectedLoanApp, setSelectedLoanApp] = useState<LoanApplicationRecord | null>(null);
  const [selectedLoan, setSelectedLoan] = useState<LoanRecord | null>(null);
  const [reversalPayment, setReversalPayment] = useState<ProgrammePaymentRecord | null>(null);
  const [reversalReason, setReversalReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Form states for modals
  // Customer Registration
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custEmail, setCustEmail] = useState('');
  const [custAddress, setCustAddress] = useState('');
  const [custNextOfKin, setCustNextOfKin] = useState('');
  const [custNIN, setCustNIN] = useState('');
  const [custNotes, setCustNotes] = useState('');

  // Fixed Target Plan
  const [ftpCustomerId, setFtpCustomerId] = useState('');
  const [ftpPlanName, setFtpPlanName] = useState('');
  const [ftpTargetAmount, setFtpTargetAmount] = useState('500000');
  const [ftpFrequency, setFtpFrequency] = useState<'DAILY' | 'WEEKLY' | 'MONTHLY'>('MONTHLY');
  const [ftpDurationMonths, setFtpDurationMonths] = useState(6);

  // Daily Ajo
  const [ajoCustomerId, setAjoCustomerId] = useState('');
  const [ajoDailyRate, setAjoDailyRate] = useState('2000');

  // Food Contribution
  const [foodCustomerId, setFoodCustomerId] = useState('');
  const [foodHouseholdHeadName, setFoodHouseholdHeadName] = useState('');
  const [foodPackage, setFoodPackage] = useState<FoodPackageType>('FAMILY_VALUE');
  const [foodDeliveryAddress, setFoodDeliveryAddress] = useState('');

  // Leocash
  const [leocashCustomerId, setLeocashCustomerId] = useState('');
  const [leocashWithdrawAmount, setLeocashWithdrawAmount] = useState('20000');
  const [leocashWithdrawReason, setLeocashWithdrawReason] = useState('');
  const [selectedLeocashAccount, setSelectedLeocashAccount] = useState<LeocashAccountRecord | null>(null);

  // Loan Application & Disbursement
  const [loanBorrowerId, setLoanBorrowerId] = useState('');
  const [loanRequestedAmount, setLoanRequestedAmount] = useState('500000');
  const [loanDurationMonths, setLoanDurationMonths] = useState(6);
  const [loanPurpose, setLoanPurpose] = useState('');
  const [loanApprovalConditions, setLoanApprovalConditions] = useState('');

  // Loan Repayment
  const [repaymentAmount, setRepaymentAmount] = useState('');
  const [repaymentMethod, setRepaymentMethod] = useState<'CASH' | 'BANK_TRANSFER' | 'POS'>('BANK_TRANSFER');

  // Unified Manual Payment
  const [payCustomerId, setPayCustomerId] = useState('');
  const [payProgramme, setPayProgramme] = useState<'FIXED_TARGET' | 'DAILY_AJO' | 'EVERYHOME_FOOD' | 'LEOCASH'>('FIXED_TARGET');
  const [payAmount, setPayAmount] = useState('10000');
  const [payMethod, setPayMethod] = useState<'CASH' | 'BANK_TRANSFER' | 'POS'>('CASH');
  const [payNotes, setPayNotes] = useState('');

  // New Staff User
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newStaffPhone, setNewStaffPhone] = useState('');
  const [newStaffRole, setNewStaffRole] = useState<StaffRole>('LOAN_OFFICER');

  // Load authoritative data from ledgerEngine
  const loadData = () => {
    setCustomers(ledgerEngine.getCustomers());
    setPayments(ledgerEngine.getProgrammePayments());
    setFixedTargetPlans(ledgerEngine.getFixedTargetPlans());
    setDailyAjoEnrolments(ledgerEngine.getDailyAjoEnrolments());
    setFoodEnrolments(ledgerEngine.getEveryhomeFoodEnrolments());
    setLeocashAccounts(ledgerEngine.getLeocashAccounts());
    setLeocashWithdrawals(ledgerEngine.getLeocashWithdrawalRequests());
    setLoanApplications(ledgerEngine.getLoanApplications());
    setLoans(ledgerEngine.getLoans());
    setStaffUsers(ledgerEngine.getStaffUsers());
    setAuditEvents(ledgerEngine.getAuditEvents().slice(0, 50));
    setSummary(ledgerEngine.getManagementSystemSummary());
  };

  useEffect(() => {
    const activeStaff = ledgerEngine.getCurrentUser();
    if (activeStaff) {
      setCurrentUser(activeStaff);
    }
    loadData();
    ledgerEngine
      .syncCustomersFromServer()
      .then((synced) => {
        setCustomers(synced);
        setSummary(ledgerEngine.getManagementSystemSummary());
      })
      .catch(() => {});
    const unsub = ledgerEngine.subscribe(() => {
      loadData();
    });
    return unsub;
  }, []);



  const handleLogout = () => {
    if (onLogout) {
      onLogout();
    } else {
      ledgerEngine.setCurrentUser(null);
      onNavigate('/staff/login');
    }
  };

  // ==========================================
  // ACTION HANDLERS
  // ==========================================

  // Register Customer
  const handleRegisterCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    try {
      if (!custName.trim() || !custPhone.trim()) {
        throw new Error('Customer full name and phone number are required.');
      }
      const existing = ledgerEngine.checkCustomerDuplicate(custPhone.trim(), custEmail.trim() || undefined);
      if (existing) {
        throw new Error(existing.reason || `Customer with phone ${custPhone} already exists (${existing.fullName})`);
      }
      const created = ledgerEngine.saveCustomer(
        {
          fullName: custName.trim(),
          phone: custPhone.trim(),
          email: custEmail.trim() || undefined,
          address: custAddress.trim() || 'Lagos, Nigeria',
          assignedStaffId: currentUser.id,
          assignedStaffName: currentUser.fullName,
          enrolledProgrammes: [],
          status: 'active',
          notes: custNotes,
          kycIdNumber: custNIN.trim(),
          ninOrBvn: custNIN.trim(),
          nextOfKinName: custNextOfKin.trim(),
        },
        currentUser
      );

      setCustomers((prev) => [created, ...prev.filter((c) => c.id !== created.id)]);
      loadData();
      setActionSuccess(`Customer "${created.fullName}" (${created.customerCode}) successfully registered.`);
      setModalType(null);
      setCustName('');
      setCustPhone('');
      setCustEmail('');
      setCustAddress('');
      setCustNextOfKin('');
      setCustNIN('');
      setCustNotes('');
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      setActionError(err.message || 'Failed to register customer');
    }
  };

  // Create Fixed Target Plan
  const handleCreateFixedTarget = (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    try {
      const cust = customers.find((c) => c.id === ftpCustomerId);
      if (!cust) throw new Error('Please select a valid customer.');
      const targetKobo = nairaToKobo(parseFloat(ftpTargetAmount));
      if (isNaN(targetKobo) || targetKobo <= 0) throw new Error('Enter a valid target amount.');

      const months = ftpDurationMonths || 6;
      const contributionAmountKobo = Math.round(targetKobo / months);

      const startDate = new Date().toISOString().split('T')[0];
      const targetDateObj = new Date();
      targetDateObj.setMonth(targetDateObj.getMonth() + months);
      const targetDate = targetDateObj.toISOString().split('T')[0];

      ledgerEngine.createFixedTargetPlan(
        {
          customerId: cust.id,
          customerName: cust.fullName,
          planName: ftpPlanName || `${cust.fullName.split(' ')[0]}'s Savings Target`,
          targetAmountKobo: targetKobo,
          contributionFrequency: ftpFrequency,
          contributionAmountKobo,
          durationMonths: months,
          startDate,
          targetDate,
          assignedStaffId: currentUser.id,
        },
        currentUser
      );

      setActionSuccess(`Fixed Target Savings Plan created for ${cust.fullName}`);
      setModalType(null);
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      setActionError(err.message || 'Failed to create plan');
    }
  };

  // Record Fixed Target Contribution
  const handleRecordFixedTargetPayment = (plan: FixedTargetPlan) => {
    const input = prompt(`Enter contribution amount for ${plan.customerName} (Plan: ${plan.planName}) in Naira:`, '10000');
    if (!input) return;
    const amount = parseFloat(input);
    if (isNaN(amount) || amount <= 0) {
      alert('Invalid amount entered.');
      return;
    }
    try {
      ledgerEngine.recordFixedTargetContribution(
        plan.id,
        nairaToKobo(amount),
        'CASH',
        currentUser,
        'Cash payment collected at branch'
      );
      setActionSuccess(`Recorded contribution of ${formatNaira(nairaToKobo(amount))} for ${plan.customerName}`);
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Enrol Daily Ajo
  const handleEnrolDailyAjo = (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    try {
      const cust = customers.find((c) => c.id === ajoCustomerId);
      if (!cust) throw new Error('Please select a customer.');
      const rateKobo = nairaToKobo(parseFloat(ajoDailyRate));
      if (isNaN(rateKobo) || rateKobo <= 0) throw new Error('Invalid daily contribution rate.');

      const now = new Date();
      const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

      ledgerEngine.enrolDailyAjo(
        {
          customerId: cust.id,
          customerName: cust.fullName,
          dailyAmountKobo: rateKobo,
          cycleMonth: currentMonthStr,
          cycleDurationDays: 31,
          startDate: now.toISOString(),
          assignedStaffId: currentUser.id,
        },
        currentUser
      );

      setActionSuccess(`Enrolled ${cust.fullName} into Daily Ajo (${formatNaira(rateKobo)}/day)`);
      setModalType(null);
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      setActionError(err.message || 'Failed to enrol');
    }
  };

  // Record Daily Ajo Payment (adds next unpaid day)
  const handleRecordAjoDayPayment = (enrolment: DailyAjoEnrolment) => {
    const nextDay = enrolment.paidDays.length + 1;
    const maxDays = enrolment.cycleDurationDays || enrolment.cycleDays || 31;
    if (nextDay > maxDays) {
      alert('Cycle already fully completed!');
      return;
    }
    try {
      ledgerEngine.recordDailyAjoPayment(
        enrolment.id,
        nextDay,
        'CASH',
        currentUser,
        'Daily Ajo collection'
      );
      setActionSuccess(`Daily Ajo contribution for Day ${nextDay} recorded for ${enrolment.customerName}`);
      setTimeout(() => setActionSuccess(null), 3000);
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Enrol Everyhome Food
  const handleEnrolFood = (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    try {
      const cust = customers.find((c) => c.id === foodCustomerId);
      if (!cust) throw new Error('Please select a customer.');

      const packageNames: Record<FoodPackageType, string> = {
        BASIC_HOUSEHOLD: 'Basic Household Pantry (Rice, Beans, Garri, Oil)',
        FAMILY_VALUE: 'Family Value Package (Grain staples, Seasonings, Tubers)',
        MEGA_ENTERPRISE: 'Mega Enterprise Bulk Provisions',
        FESTIVE_SPECIAL: 'Festive Season Family Special Bundle',
      };

      const packageCosts: Record<FoodPackageType, number> = {
        BASIC_HOUSEHOLD: 4500000, // ₦45,000
        FAMILY_VALUE: 9000000,    // ₦90,000
        MEGA_ENTERPRISE: 18000000,// ₦180,000
        FESTIVE_SPECIAL: 25000000,// ₦250,000
      };

      const packageCostKobo = packageCosts[foodPackage];
      const instalmentAmountKobo = Math.round(packageCostKobo / 3);

      ledgerEngine.enrolEveryhomeFood(
        {
          customerId: cust.id,
          customerName: cust.fullName,
          householdHeadName: foodHouseholdHeadName || cust.fullName,
          householdSize: 4,
          deliveryAddress: foodDeliveryAddress || cust.address,
          packageType: foodPackage,
          packageName: packageNames[foodPackage],
          packageCostKobo,
          contributionSchedule: 'MONTHLY',
          instalmentAmountKobo,
          assignedStaffId: currentUser.id,
        },
        currentUser
      );

      setActionSuccess(`Enrolled ${cust.fullName} in Everyhome Food Contribution`);
      setModalType(null);
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      setActionError(err.message || 'Failed to enrol');
    }
  };

  // Record Food Payment
  const handleRecordFoodPayment = (foodItem: EveryhomeFoodEnrolment) => {
    const input = prompt(`Enter food contribution amount for ${foodItem.householdHeadName} in Naira:`, '15000');
    if (!input) return;
    const amount = parseFloat(input);
    if (isNaN(amount) || amount <= 0) {
      alert('Invalid amount.');
      return;
    }
    try {
      ledgerEngine.recordEveryhomePayment(
        foodItem.id,
        nairaToKobo(amount),
        'CASH',
        currentUser,
        'Monthly food staple contribution'
      );
      setActionSuccess(`Recorded food payment for ${foodItem.householdHeadName}`);
      setTimeout(() => setActionSuccess(null), 3000);
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Food Fulfilment Progression
  const handleFoodFulfilmentStatus = (enrolmentId: string, status: 'READY' | 'DISTRIBUTED') => {
    try {
      ledgerEngine.updateFoodFulfilmentStatus(
        enrolmentId,
        status,
        status === 'READY' ? 'All package staples staged in central distribution hub.' : 'Delivered and signed for by household representative.',
        currentUser
      );
      setActionSuccess(`Updated package fulfilment status to ${status}`);
      setTimeout(() => setActionSuccess(null), 3000);
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Create Leocash Account
  const handleCreateLeocash = (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    try {
      const cust = customers.find((c) => c.id === leocashCustomerId);
      if (!cust) throw new Error('Please select a customer.');

      ledgerEngine.createLeocashAccount(cust.id, currentUser);

      setActionSuccess(`Leocash flexible savings account opened for ${cust.fullName}`);
      setModalType(null);
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      setActionError(err.message || 'Failed to create Leocash account');
    }
  };

  // Record Leocash Deposit
  const handleRecordLeocashDeposit = (account: LeocashAccountRecord) => {
    const input = prompt(`Enter deposit amount for ${account.customerName} (${account.accountNumber}) in Naira:`, '25000');
    if (!input) return;
    const amount = parseFloat(input);
    if (isNaN(amount) || amount <= 0) {
      alert('Invalid amount.');
      return;
    }
    try {
      ledgerEngine.recordLeocashDeposit(
        account.id,
        nairaToKobo(amount),
        'CASH',
        currentUser,
        'Leocash flexible savings counter deposit'
      );
      setActionSuccess(`Deposited ${formatNaira(nairaToKobo(amount))} into ${account.accountNumber}`);
      setTimeout(() => setActionSuccess(null), 3000);
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Request Leocash Withdrawal
  const handleRequestWithdrawal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLeocashAccount) return;
    setActionError(null);
    try {
      const amountKobo = nairaToKobo(parseFloat(leocashWithdrawAmount));
      if (isNaN(amountKobo) || amountKobo <= 0) throw new Error('Enter a valid withdrawal amount.');
      const availableKobo = selectedLeocashAccount.balanceKobo ?? (selectedLeocashAccount.availableBalance * 100);
      if (amountKobo > availableKobo) throw new Error('Insufficient balance in Leocash account.');

      ledgerEngine.requestLeocashWithdrawal(
        selectedLeocashAccount.id,
        amountKobo,
        leocashWithdrawReason || 'Customer counter cash withdrawal',
        currentUser
      );

      setActionSuccess(`Withdrawal request submitted for review.`);
      setModalType(null);
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      setActionError(err.message || 'Failed to request withdrawal');
    }
  };

  // Review Leocash Withdrawal
  const handleReviewWithdrawal = (requestId: string, action: 'APPROVED' | 'REJECTED') => {
    try {
      ledgerEngine.reviewLeocashWithdrawal(requestId, action, currentUser);
      setActionSuccess(`Withdrawal request ${action.toLowerCase()}.`);
      setTimeout(() => setActionSuccess(null), 3000);
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Loan Application
  const handleCreateLoanApp = (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    try {
      const cust = customers.find((c) => c.id === loanBorrowerId);
      if (!cust) throw new Error('Please select a borrower.');
      const amountKobo = nairaToKobo(parseFloat(loanRequestedAmount));
      if (isNaN(amountKobo) || amountKobo <= 0) throw new Error('Invalid loan amount requested.');

      ledgerEngine.createLoanApplication(
        {
          borrowerId: cust.id,
          borrowerName: cust.fullName,
          borrowerPhone: cust.phone,
          requestedAmountKobo: amountKobo,
          proposedDurationMonths: loanDurationMonths,
          purpose: loanPurpose || 'Working capital expansion',
          assignedLoanOfficerId: currentUser.id,
          assignedLoanOfficerName: currentUser.fullName,
          interestRateMonthlyPercent: config.rates.smeLoanMonthlyRatePercent,
        },
        currentUser
      );

      setActionSuccess(`Loan application submitted for ${cust.fullName}`);
      setModalType(null);
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      setActionError(err.message || 'Failed to create loan application');
    }
  };

  // Review Loan Application
  const handleReviewLoanApp = (app: LoanApplicationRecord, decision: 'APPROVED' | 'REJECTED') => {
    try {
      ledgerEngine.reviewLoanApplication(
        app.id,
        decision,
        app.requestedAmountKobo,
        decision === 'APPROVED' ? (loanApprovalConditions || 'Standard guarantor pledge verified') : 'Credit scoring threshold not met',
        currentUser
      );
      setActionSuccess(`Loan application ${decision}.`);
      setSelectedLoanApp(null);
      setTimeout(() => setActionSuccess(null), 3000);
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Disburse Loan (Strictly Decoupled Step)
  const handleDisburseLoan = (app: LoanApplicationRecord) => {
    const confirm = window.confirm(
      `Confirm disbursement of ${formatNaira(app.approvedAmountKobo || app.requestedAmountKobo)} to ${app.borrowerName}?\nThis will generate the binding amortization schedule.`
    );
    if (!confirm) return;
    try {
      const newLoan = ledgerEngine.disburseLoan(app.id, 'BANK_TRANSFER', currentUser, 'Direct working capital disbursement');
      setActionSuccess(`Loan ${newLoan.loanReference} successfully disbursed to ${app.borrowerName}`);
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Record Loan Repayment
  const handleRecordRepayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoan) return;
    setActionError(null);
    try {
      const amountKobo = nairaToKobo(parseFloat(repaymentAmount));
      if (isNaN(amountKobo) || amountKobo <= 0) throw new Error('Enter a valid repayment amount.');

      ledgerEngine.recordLoanRepayment(
        selectedLoan.id,
        amountKobo,
        repaymentMethod,
        currentUser,
        `Loan instalment payment recorded via ${repaymentMethod}`
      );

      setActionSuccess(`Repayment of ${formatNaira(amountKobo)} recorded for ${selectedLoan.borrowerName}`);
      setModalType(null);
      setSelectedLoan(null);
      setRepaymentAmount('');
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      setActionError(err.message || 'Failed to record repayment');
    }
  };

  // Unified Manual Payment Recording
  const handleRecordUnifiedPayment = (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    try {
      const cust = customers.find((c) => c.id === payCustomerId);
      if (!cust) throw new Error('Select a customer.');
      const amountKobo = nairaToKobo(parseFloat(payAmount));
      if (isNaN(amountKobo) || amountKobo <= 0) throw new Error('Invalid payment amount.');

      ledgerEngine.recordUnifiedPayment({
        customerId: cust.id,
        customerName: cust.fullName,
        programme: payProgramme,
        relatedRecordId: `REC-${Date.now().toString().slice(-4)}`,
        type: 'CONTRIBUTION',
        amountKobo,
        paymentMethod: payMethod,
        actor: currentUser,
        notes: payNotes || 'Manual payment verified by branch staff',
      });

      setActionSuccess(`Payment of ${formatNaira(amountKobo)} recorded successfully.`);
      setModalType(null);
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      setActionError(err.message || 'Failed to record payment');
    }
  };

  // Reverse Transaction
  const handleExecuteReversal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reversalPayment) return;
    setActionError(null);
    try {
      if (!reversalReason.trim()) {
        throw new Error('Mandatory reversal justification required.');
      }
      ledgerEngine.reverseProgrammePayment(reversalPayment.id, reversalReason, currentUser);
      setActionSuccess(`Payment ${reversalPayment.reference} reversed. Traceable offset entry created.`);
      setReversalPayment(null);
      setReversalReason('');
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      setActionError(err.message || 'Failed to reverse payment');
    }
  };

  // Export CSV Report
  const handleExportCSV = () => {
    const headers = ['Reference', 'Customer Name', 'Programme', 'Type', 'Amount (NGN)', 'Payment Method', 'Date Time', 'Status', 'Recorded By'];
    const rows = payments.map((p) => [
      p.reference || p.transactionReference || p.receiptNumber || '',
      `"${p.customerName}"`,
      p.programme || p.programmeLabel || p.programmeType || '',
      p.type || 'PAYMENT',
      ((p.amountKobo ?? (p.amount ? p.amount * 100 : 0)) / 100).toFixed(2),
      p.paymentMethod || p.paymentChannel || 'CASH',
      p.dateTime || p.timestamp || '',
      p.status,
      `"${p.recordedByStaffName || p.collectedByStaffName || 'Staff'}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `TEAMACRO_Management_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Add Staff User
  const handleAddStaffUser = (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    try {
      if (!newStaffName || !newStaffEmail) throw new Error('Name and email are required.');
      ledgerEngine.createStaffUser(
        {
          fullName: newStaffName,
          email: newStaffEmail,
          phone: newStaffPhone || '+234 800 000 0000',
          role: newStaffRole,
        },
        currentUser
      );
      setActionSuccess(`Staff user ${newStaffName} created with role ${newStaffRole}`);
      setModalType(null);
      setNewStaffName('');
      setNewStaffEmail('');
      setTimeout(() => setActionSuccess(null), 3000);
    } catch (err: any) {
      setActionError(err.message || 'Failed to create staff');
    }
  };

  const handleRoleSwitch = (staffId: string) => {
    const targetStaff = staffUsers.find((s) => s.id === staffId);
    if (targetStaff) {
      ledgerEngine.setCurrentUser(targetStaff);
      setCurrentUser(targetStaff);
      setActionSuccess(`Switched active context to ${targetStaff.fullName} (${targetStaff.role})`);
      setTimeout(() => setActionSuccess(null), 3000);
    }
  };

  // Filtered Lists
  const filteredCustomers = customers.filter((c) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      (c.fullName || '').toLowerCase().includes(q) ||
      (c.phone || '').includes(searchQuery) ||
      (c.id || '').toLowerCase().includes(q) ||
      (c.customerCode || '').toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q);
    const normStatus = (c.status || 'active').toUpperCase();
    const matchesStatus = statusFilter === 'ALL' || normStatus === statusFilter.toUpperCase();
    return matchesSearch && matchesStatus;
  });

  const filteredPayments = payments.filter((p) => {
    const ref = (p.reference || p.transactionReference || p.receiptNumber || '').toLowerCase();
    const matchesSearch =
      p.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ref.includes(searchQuery.toLowerCase());
    const matchesProgramme = programmeFilter === 'ALL' || p.programme === programmeFilter;
    return matchesSearch && matchesProgramme;
  });

  return (
    <div className="min-h-screen bg-[#F4F7FB] dark:bg-[#060D1F] flex flex-col font-sans text-slate-900 dark:text-slate-100">
      {/* TOP NOTIFICATION / FEEDBACK BANNER */}
      {actionSuccess && (
        <div className="bg-[#16A34A] text-white px-6 py-2.5 text-xs font-bold tracking-wide flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={15} />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} className="hover:opacity-80 cursor-pointer">
            <X size={15} />
          </button>
        </div>
      )}
      {actionError && (
        <div className="bg-rose-600 text-white px-6 py-2.5 text-xs font-bold tracking-wide flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle size={15} />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError(null)} className="hover:opacity-80 cursor-pointer">
            <X size={15} />
          </button>
        </div>
      )}

      {/* TOP AJO.MONEY-STYLE FINTECH COMMAND BAR */}
      <header className="bg-[#0B2A5B] text-white border-b border-white/15 px-4 sm:px-6 h-16 flex items-center justify-between gap-4 sticky top-0 z-40 shadow-sm">
        <div className="flex items-center gap-4">
          <div
            onClick={() => onNavigate('/')}
            className="cursor-pointer flex items-center gap-3"
            title="TEAMACRO SERVICES LTD"
          >
            <BrandLogo variant="horizontal" theme="dark" size="sm" />
          </div>

          <div className="hidden md:flex items-center gap-3 pl-4 border-l border-white/15">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-300">
              PORTAL 01 · STAFF OPERATIONS
            </span>
            <span className="px-3 py-0.5 rounded-full bg-[#1E5BD8] text-white text-[10px] font-display font-extrabold uppercase tracking-wider border border-blue-400/30">
              {currentUser.role.replace(/_/g, ' ')}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden lg:flex items-center gap-2 pr-3 border-r border-white/15 text-right">
            <div className="w-2 h-2 rounded-full bg-[#16A34A]" />
            <div>
              <div className="font-display text-xs font-bold text-white leading-tight">
                {currentUser.fullName}
              </div>
              <div className="text-[10px] text-blue-200 font-mono">
                {currentUser.email || 'Active Staff Session'}
              </div>
            </div>
          </div>

          <ThemeSelector />

          <button
            onClick={() => onNavigate('/')}
            className="px-4 py-1.5 text-xs font-bold bg-white/10 hover:bg-white/15 text-white rounded-full flex items-center gap-1.5 transition-colors border border-white/15 cursor-pointer"
            title="Return to Public Website"
          >
            <ExternalLink size={13} />
            <span className="hidden sm:inline">Public Website</span>
          </button>

          <button
            onClick={handleLogout}
            className="px-4 py-1.5 text-xs font-display font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-full flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <LogOut size={13} />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* MAIN TWO-COLUMN WORKSPACE */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* LEFT SIDEBAR NAVIGATION */}
        <aside className="w-full lg:w-72 bg-[#0B2A5B] text-slate-200 border-b lg:border-b-0 lg:border-r border-white/10 flex flex-col shrink-0">
          <div className="p-4 border-b border-white/10 bg-[#081F44] flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase font-extrabold tracking-wider text-blue-300">
                OPERATOR CONSOLE
              </div>
              <div className="font-display text-sm font-bold text-white truncate max-w-[190px] mt-0.5">
                {currentUser.fullName}
              </div>
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-[#16A34A]/20 border border-[#16A34A]/40 text-[#4ADE80] text-[10px] font-extrabold uppercase">
              ONLINE
            </span>
          </div>

          <nav className="flex-1 overflow-x-auto lg:overflow-y-auto p-3 flex lg:flex-col gap-1">
            <div className="hidden lg:block pt-1 pb-1.5 px-3 font-mono text-[10px] font-bold tracking-[0.18em] text-blue-300/80 uppercase">
              Core Operations
            </div>

            <button
              onClick={() => setActiveTab('dashboard')}
              className={`w-auto lg:w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer shrink-0 ${
                activeTab === 'dashboard'
                  ? 'bg-[#1E5BD8] text-white shadow-xs font-bold'
                  : 'text-blue-100/80 hover:bg-white/10 hover:text-white'
              }`}
            >
              <span className="font-mono text-[10px] opacity-75">01</span>
              <LayoutDashboard size={16} />
              <span className="font-display tracking-tight">Executive Overview</span>
            </button>

            <button
              onClick={() => setActiveTab('customers')}
              className={`w-auto lg:w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer shrink-0 ${
                activeTab === 'customers'
                  ? 'bg-[#1E5BD8] text-white shadow-xs font-bold'
                  : 'text-blue-100/80 hover:bg-white/10 hover:text-white'
              }`}
            >
              <span className="font-mono text-[10px] opacity-75">02</span>
              <Users size={16} />
              <span className="font-display tracking-tight">Customer Registry</span>
              <span className="ml-auto font-mono text-[10px] tabular-nums bg-white/15 px-2 py-0.5 rounded-full text-white">
                {customers.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('payments')}
              className={`w-auto lg:w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer shrink-0 ${
                activeTab === 'payments'
                  ? 'bg-[#1E5BD8] text-white shadow-xs font-bold'
                  : 'text-blue-100/80 hover:bg-white/10 hover:text-white'
              }`}
            >
              <span className="font-mono text-[10px] opacity-75">03</span>
              <CreditCard size={16} />
              <span className="font-display tracking-tight">Unified Payments</span>
            </button>

            <div className="hidden lg:block pt-4 pb-1.5 px-3 font-mono text-[10px] font-bold tracking-[0.18em] text-blue-300/80 uppercase border-t border-white/10 mt-2">
              5 Financial Programmes
            </div>

            <button
              onClick={() => setActiveTab('fixed_target')}
              className={`w-auto lg:w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer shrink-0 ${
                activeTab === 'fixed_target'
                  ? 'bg-[#2563EB] text-white shadow-xs font-bold'
                  : 'text-blue-100/80 hover:bg-white/10 hover:text-white'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-[#2563EB] shrink-0" />
              <Target size={16} className="text-blue-300" />
              <span className="font-display tracking-tight">Fixed Target</span>
              <span className="ml-auto font-mono text-[10px] tabular-nums bg-white/15 text-white px-2 py-0.5 rounded-full">
                {fixedTargetPlans.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('daily_ajo')}
              className={`w-auto lg:w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer shrink-0 ${
                activeTab === 'daily_ajo'
                  ? 'bg-[#16A34A] text-white shadow-xs font-bold'
                  : 'text-blue-100/80 hover:bg-white/10 hover:text-white'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-[#16A34A] shrink-0" />
              <Calendar size={16} className="text-emerald-300" />
              <span className="font-display tracking-tight">Daily Ajo (ROSCA)</span>
              <span className="ml-auto font-mono text-[10px] tabular-nums bg-white/15 text-white px-2 py-0.5 rounded-full">
                {dailyAjoEnrolments.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('everyhome_food')}
              className={`w-auto lg:w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer shrink-0 ${
                activeTab === 'everyhome_food'
                  ? 'bg-[#F97316] text-white shadow-xs font-bold'
                  : 'text-blue-100/80 hover:bg-white/10 hover:text-white'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-[#F97316] shrink-0" />
              <ShoppingBag size={16} className="text-orange-300" />
              <span className="font-display tracking-tight">Everyhome Food</span>
              <span className="ml-auto font-mono text-[10px] tabular-nums bg-white/15 text-white px-2 py-0.5 rounded-full">
                {foodEnrolments.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('leocash')}
              className={`w-auto lg:w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer shrink-0 ${
                activeTab === 'leocash'
                  ? 'bg-[#7C3AED] text-white shadow-xs font-bold'
                  : 'text-blue-100/80 hover:bg-white/10 hover:text-white'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-[#7C3AED] shrink-0" />
              <Coins size={16} className="text-purple-300" />
              <span className="font-display tracking-tight">Leocash Savings</span>
              <span className="ml-auto font-mono text-[10px] tabular-nums bg-white/15 text-white px-2 py-0.5 rounded-full">
                {leocashAccounts.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('loans')}
              className={`w-auto lg:w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer shrink-0 ${
                activeTab === 'loans'
                  ? 'bg-[#0D9488] text-white shadow-xs font-bold'
                  : 'text-blue-100/80 hover:bg-white/10 hover:text-white'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-[#0D9488] shrink-0" />
              <FileSpreadsheet size={16} className="text-teal-300" />
              <span className="font-display tracking-tight">Loan System</span>
              <span className="ml-auto font-mono text-[10px] tabular-nums bg-white/15 text-white px-2 py-0.5 rounded-full">
                {loans.length}
              </span>
            </button>

            <div className="hidden lg:block pt-4 pb-1.5 px-3 font-mono text-[10px] font-bold tracking-[0.18em] text-blue-300/80 uppercase border-t border-white/10 mt-2">
              Governance & Reports
            </div>

            <button
              onClick={() => setActiveTab('reports')}
              className={`w-auto lg:w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer shrink-0 ${
                activeTab === 'reports'
                  ? 'bg-[#1E5BD8] text-white shadow-xs font-bold'
                  : 'text-blue-100/80 hover:bg-white/10 hover:text-white'
              }`}
            >
              <span className="font-mono text-[10px] opacity-75">09</span>
              <BarChart3 size={16} />
              <span className="font-display tracking-tight">Financial Reports</span>
            </button>

            <button
              onClick={() => setActiveTab('staff_mgmt')}
              className={`w-auto lg:w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer shrink-0 ${
                activeTab === 'staff_mgmt'
                  ? 'bg-[#1E5BD8] text-white shadow-xs font-bold'
                  : 'text-blue-100/80 hover:bg-white/10 hover:text-white'
              }`}
            >
              <span className="font-mono text-[10px] opacity-75">10</span>
              <UserCheck size={16} />
              <span className="font-display tracking-tight">Staff Roster</span>
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`w-auto lg:w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer shrink-0 ${
                activeTab === 'settings'
                  ? 'bg-[#1E5BD8] text-white shadow-xs font-bold'
                  : 'text-blue-100/80 hover:bg-white/10 hover:text-white'
              }`}
            >
              <span className="font-mono text-[10px] opacity-75">11</span>
              <Settings size={16} />
              <span className="font-display tracking-tight">Audit Trail</span>
            </button>
          </nav>

          <div className="hidden lg:flex p-3.5 border-t border-white/10 bg-[#081F44] text-[10px] font-mono text-blue-200/70 items-center justify-between">
            <span>TEAMACRO SERVICES LTD</span>
            <span>RC-1589421</span>
          </div>
        </aside>

        {/* RIGHT CONTENT WORKSPACE */}
        <main className="flex-1 overflow-y-auto p-5 sm:p-8 bg-[#F4F7FB] dark:bg-[#060D1F] text-slate-900 dark:text-slate-100">
          {actionError && (
            <div className="mb-5 p-3.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-2xl text-xs text-red-700 dark:text-red-300 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0" />
                <span>{normalizeError(actionError)}</span>
              </div>
              <button onClick={() => setActionError(null)} className="text-red-500 hover:text-red-700 cursor-pointer">
                <X size={14} />
              </button>
            </div>
          )}

          {actionSuccess && (
            <div className="mb-5 p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl text-xs text-emerald-700 dark:text-emerald-300 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="shrink-0" />
                <span>{actionSuccess}</span>
              </div>
              <button onClick={() => setActionSuccess(null)} className="text-emerald-500 hover:text-emerald-700 cursor-pointer">
                <X size={14} />
              </button>
            </div>
          )}

          {/* ========================================================= */}
          {/* 1. DASHBOARD OVERVIEW */}
          {/* ========================================================= */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              {/* Ajo.money-Style Fintech Hero Header */}
              <div className="bg-white dark:bg-[#0B1536] p-6 sm:p-7 rounded-3xl border border-slate-200/90 dark:border-[#1E2E64] shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#1E5BD8]/10 text-[#1E5BD8] dark:text-blue-400 text-[10px] font-extrabold uppercase tracking-wider">
                    <span>MODULE 01 · AJO, THRIFT & CREDIT OPERATIONS</span>
                  </div>
                  <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[#0B2A5B] dark:text-white tracking-tight mt-2">
                    Operations{' '}
                    <span className="relative inline-block text-[#1E5BD8] dark:text-[#60A5FA]">
                      Executive
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
                    Dashboard
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1.5">
                    Real-time consolidated management across Daily Ajo, Fixed Target, Everyhome Food, Leocash & Loans
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    onClick={() => setModalType('register_customer')}
                    className="px-5 py-2.5 bg-[#0B2A5B] hover:bg-[#1E5BD8] text-white rounded-full text-xs font-display font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                  >
                    <Plus size={15} />
                    <span>Register Customer</span>
                  </button>
                  <button
                    onClick={() => setModalType('record_payment')}
                    className="px-5 py-2.5 bg-[#16A34A] hover:bg-emerald-700 text-white rounded-full text-xs font-display font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                  >
                    <CreditCard size={15} />
                    <span>Record Payment</span>
                  </button>
                </div>
              </div>

              {/* 5 TOP AJO.MONEY-STYLE ROUNDED-2XL METRIC CARDS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                {/* Total Customers */}
                <div className="bg-white dark:bg-[#0B1536] rounded-2xl border border-slate-200/90 dark:border-[#1E2E64] shadow-xs overflow-hidden flex flex-col justify-between">
                  <div className="h-1.5 w-full bg-[#0B2A5B]" />
                  <div className="p-5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                        01 · CUSTOMERS
                      </span>
                      <Users size={16} className="text-[#0B2A5B] dark:text-blue-400" />
                    </div>
                    <div className="font-display text-2xl sm:text-3xl font-extrabold text-[#0B2A5B] dark:text-white tabular-nums mt-2.5">
                      {summary.totalCustomers.toLocaleString()}
                    </div>
                    <div className="text-[11px] text-[#16A34A] dark:text-emerald-400 font-semibold mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-1">
                      <CheckCircle2 size={12} />
                      <span className="tabular-nums">{summary.activeCustomers} active members</span>
                    </div>
                  </div>
                </div>

                {/* Total Savings Collected */}
                <div className="bg-white dark:bg-[#0B1536] rounded-2xl border border-slate-200/90 dark:border-[#1E2E64] shadow-xs overflow-hidden flex flex-col justify-between">
                  <div className="h-1.5 w-full bg-[#2563EB]" />
                  <div className="p-5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                        02 · TOTAL SAVINGS
                      </span>
                      <Coins size={16} className="text-[#2563EB]" />
                    </div>
                    <div className="font-display text-2xl sm:text-3xl font-extrabold text-[#2563EB] dark:text-blue-400 tabular-nums mt-2.5">
                      {formatNaira(summary.totalSavingsCollectedKobo)}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      Cumulative ledger balance
                    </div>
                  </div>
                </div>

                {/* Total Contributions */}
                <div className="bg-white dark:bg-[#0B1536] rounded-2xl border border-slate-200/90 dark:border-[#1E2E64] shadow-xs overflow-hidden flex flex-col justify-between">
                  <div className="h-1.5 w-full bg-[#F97316]" />
                  <div className="p-5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                        03 · CONTRIBUTIONS
                      </span>
                      <ShoppingBag size={16} className="text-[#F97316]" />
                    </div>
                    <div className="font-display text-2xl sm:text-3xl font-extrabold text-[#F97316] dark:text-orange-400 tabular-nums mt-2.5">
                      {formatNaira(
                        (summary.totalDailyAjoCollectedKobo ?? (summary.totalDailyAjoCollected * 100)) +
                        (summary.totalFoodContributedKobo ?? (summary.totalFoodContributionValue * 100))
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      Daily Ajo & Everyhome Food
                    </div>
                  </div>
                </div>

                {/* Total Withdrawals */}
                <div className="bg-white dark:bg-[#0B1536] rounded-2xl border border-slate-200/90 dark:border-[#1E2E64] shadow-xs overflow-hidden flex flex-col justify-between">
                  <div className="h-1.5 w-full bg-[#7C3AED]" />
                  <div className="p-5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                        04 · WITHDRAWALS
                      </span>
                      <ArrowDownLeft size={16} className="text-[#7C3AED]" />
                    </div>
                    <div className="font-display text-2xl sm:text-3xl font-extrabold text-[#7C3AED] dark:text-purple-400 tabular-nums mt-2.5">
                      {formatNaira(
                        payments
                          .filter((p) => p.type === 'WITHDRAWAL')
                          .reduce((sum, p) => sum + (p.amountKobo ?? (p.amount ? p.amount * 100 : 0)), 0)
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      Approved staff payouts
                    </div>
                  </div>
                </div>

                {/* Total Loans Disbursed */}
                <div className="bg-white dark:bg-[#0B1536] rounded-2xl border border-slate-200/90 dark:border-[#1E2E64] shadow-xs overflow-hidden flex flex-col justify-between">
                  <div className="h-1.5 w-full bg-[#0D9488]" />
                  <div className="p-5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                        05 · LOANS DISBURSED
                      </span>
                      <FileSpreadsheet size={16} className="text-[#0D9488]" />
                    </div>
                    <div className="font-display text-2xl sm:text-3xl font-extrabold text-[#0D9488] dark:text-teal-400 tabular-nums mt-2.5">
                      {formatNaira(summary.totalDisbursedKobo)}
                    </div>
                    <div className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 tabular-nums">
                      {formatNaira(summary.totalOutstandingLoansKobo)} outstanding
                    </div>
                  </div>
                </div>
              </div>

              {/* 5 ARCHITECTURAL PROGRAMME BREAKDOWN BAYS */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div
                  onClick={() => setActiveTab('fixed_target')}
                  className="bg-white dark:bg-[#0B1536] p-5 rounded-md border border-slate-200 dark:border-[#1E2E64] border-l-4 border-l-[#2563EB] cursor-pointer hover:border-[#2563EB] hover:shadow-md transition-all group"
                >
                  <div className="flex items-center justify-between text-[#2563EB] font-display font-bold text-xs uppercase tracking-wider">
                    <span>01 · Fixed Target</span>
                    <Target size={15} />
                  </div>
                  <div className="font-display text-xl font-extrabold text-[#0B2A5B] dark:text-white tabular-nums mt-2.5">
                    {formatNaira(summary.totalFixedTargetSavedKobo)}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 flex items-center justify-between">
                    <span>{fixedTargetPlans.length} active plans</span>
                    <ChevronRight size={14} className="text-[#2563EB] group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>

                <div
                  onClick={() => setActiveTab('daily_ajo')}
                  className="bg-white dark:bg-[#0B1536] p-5 rounded-md border border-slate-200 dark:border-[#1E2E64] border-l-4 border-l-[#16A34A] cursor-pointer hover:border-[#16A34A] hover:shadow-md transition-all group"
                >
                  <div className="flex items-center justify-between text-[#16A34A] font-display font-bold text-xs uppercase tracking-wider">
                    <span>02 · Daily Ajo</span>
                    <Calendar size={15} />
                  </div>
                  <div className="font-display text-xl font-extrabold text-[#0B2A5B] dark:text-white tabular-nums mt-2.5">
                    {formatNaira(summary.totalDailyAjoCollectedKobo)}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 flex items-center justify-between">
                    <span>{dailyAjoEnrolments.length} running cycles</span>
                    <ChevronRight size={14} className="text-[#16A34A] group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>

                <div
                  onClick={() => setActiveTab('everyhome_food')}
                  className="bg-white dark:bg-[#0B1536] p-5 rounded-md border border-slate-200 dark:border-[#1E2E64] border-l-4 border-l-[#F97316] cursor-pointer hover:border-[#F97316] hover:shadow-md transition-all group"
                >
                  <div className="flex items-center justify-between text-[#F97316] font-display font-bold text-xs uppercase tracking-wider">
                    <span>03 · Everyhome Food</span>
                    <ShoppingBag size={15} />
                  </div>
                  <div className="font-display text-xl font-extrabold text-[#0B2A5B] dark:text-white tabular-nums mt-2.5">
                    {formatNaira(summary.totalFoodContributedKobo)}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 flex items-center justify-between">
                    <span>{foodEnrolments.length} subscriptions</span>
                    <ChevronRight size={14} className="text-[#F97316] group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>

                <div
                  onClick={() => setActiveTab('leocash')}
                  className="bg-white dark:bg-[#0B1536] p-5 rounded-md border border-slate-200 dark:border-[#1E2E64] border-l-4 border-l-[#7C3AED] cursor-pointer hover:border-[#7C3AED] hover:shadow-md transition-all group"
                >
                  <div className="flex items-center justify-between text-[#7C3AED] font-display font-bold text-xs uppercase tracking-wider">
                    <span>04 · Leocash Savings</span>
                    <Coins size={15} />
                  </div>
                  <div className="font-display text-xl font-extrabold text-[#0B2A5B] dark:text-white tabular-nums mt-2.5">
                    {formatNaira(summary.totalLeocashBalanceKobo)}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 flex items-center justify-between">
                    <span>{leocashAccounts.length} liquid accounts</span>
                    <ChevronRight size={14} className="text-[#7C3AED] group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>

                <div
                  onClick={() => setActiveTab('loans')}
                  className="bg-white dark:bg-[#0B1536] p-5 rounded-md border border-slate-200 dark:border-[#1E2E64] border-l-4 border-l-[#0D9488] cursor-pointer hover:border-[#0D9488] hover:shadow-md transition-all group"
                >
                  <div className="flex items-center justify-between text-[#0D9488] font-display font-bold text-xs uppercase tracking-wider">
                    <span>05 · Loan System</span>
                    <FileSpreadsheet size={15} />
                  </div>
                  <div className="font-display text-xl font-extrabold text-[#0B2A5B] dark:text-white tabular-nums mt-2.5">
                    {formatNaira(summary.totalDisbursedKobo)}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 flex items-center justify-between">
                    <span>{summary.totalLoanApplications} apps · {summary.approvedLoans} active</span>
                    <ChevronRight size={14} className="text-[#0D9488] group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              </div>

              {/* RECENT PAYMENTS TABLE MATCHING ARCHITECTURAL BLUEPRINT */}
              <div className="bg-white dark:bg-[#0B1536] rounded-md border border-slate-200 dark:border-[#1E2E64] shadow-xs overflow-hidden">
                <div className="p-5 border-b border-slate-200 dark:border-[#1E2E64] flex items-center justify-between">
                  <div>
                    <div className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#1E5BD8] dark:text-blue-400">
                      CHRONOLOGICAL LEDGER STREAM
                    </div>
                    <h3 className="font-display font-bold text-[#0B2A5B] dark:text-white text-base mt-0.5">
                      Recent Unified Payments & Contributions
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Authoritatively captured and verified transactions across all 5 programmes
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveTab('payments')}
                    className="px-3 py-1.5 rounded-xs bg-[#F4F7FB] dark:bg-slate-800 text-xs font-display font-bold text-[#1E5BD8] dark:text-blue-400 hover:bg-[#1E5BD8] hover:text-white transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <span>View Full Ledger</span>
                    <ChevronRight size={14} />
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#0B2A5B] text-white font-display font-bold uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="px-4 py-3"># Ref</th>
                        <th className="px-4 py-3">Customer</th>
                        <th className="px-4 py-3">Programme</th>
                        <th className="px-4 py-3">Amount</th>
                        <th className="px-4 py-3">Payment Method</th>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                      {payments.slice(0, 8).map((p) => (
                        <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
                          <td className="px-4 py-3 font-mono font-bold text-slate-700 dark:text-slate-300">
                            {p.reference}
                          </td>
                          <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                            {p.customerName}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase ${
                                p.programme === 'FIXED_TARGET'
                                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300'
                                  : p.programme === 'DAILY_AJO'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300'
                                  : p.programme === 'EVERYHOME_FOOD'
                                  ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/60 dark:text-orange-300'
                                  : p.programme === 'LEOCASH'
                                  ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-300'
                                  : p.programme === 'LOAN_REPAYMENT'
                                  ? 'bg-teal-100 text-teal-800 dark:bg-teal-900/60 dark:text-teal-300'
                                  : 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200'
                              }`}
                            >
                              {(p.programme || p.programmeLabel || p.programmeType || 'PROGRAMME').replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">
                            {formatNaira(p.amountKobo ?? (p.amount ? p.amount * 100 : 0))}
                          </td>
                          <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                            {p.paymentMethod || p.paymentChannel}
                          </td>
                          <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                            {new Date(p.dateTime || p.timestamp || Date.now()).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3">
                            {p.status === 'CONFIRMED_RECORDED' || p.status === 'completed' ? (
                              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold text-[11px]">
                                <CheckCircle2 size={12} />
                                <span>Recorded</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 font-bold text-[11px]">
                                <AlertTriangle size={12} />
                                <span>Reversed</span>
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {(p.status === 'CONFIRMED_RECORDED' || p.status === 'completed') && (
                              <button
                                onClick={() => {
                                  setReversalPayment(p);
                                  setReversalReason('');
                                }}
                                className="text-slate-400 hover:text-rose-600 text-[11px] font-semibold underline"
                              >
                                Reverse
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

          {/* ========================================================= */}
          {/* 2. CUSTOMERS MANAGEMENT */}
          {/* ========================================================= */}
          {activeTab === 'customers' && (
            <div className="space-y-6">
              <div className="bg-white dark:bg-[#0B1536] p-6 rounded-md border border-slate-200 dark:border-[#1E2E64] shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <div className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[#1E5BD8] dark:text-blue-400">
                    MODULE 02 // CENTRAL CUSTOMER REGISTRY
                  </div>
                  <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[#0B2A5B] dark:text-white tracking-tight mt-1">
                    Customer Records Directory
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                    Internal customer profiles, enrolled programmes, and transaction activity
                  </p>
                </div>
                <button
                  onClick={() => setModalType('register_customer')}
                  className="px-4 py-2.5 bg-[#0B2A5B] hover:bg-[#1E5BD8] text-white rounded-xs text-xs font-display font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                >
                  <Plus size={16} />
                  <span>Register New Customer</span>
                </button>
              </div>

              {/* Filters & Search */}
              <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-[#0B1536] p-4 rounded-md border border-slate-200 dark:border-[#1E2E64] shadow-xs">
                <div className="flex-1 min-w-[240px] relative">
                  <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by customer name, phone number, or ID..."
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xs border border-slate-300 dark:border-slate-600 bg-[#F4F7FB] dark:bg-slate-900 focus:outline-none focus:border-[#2563EB]"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 font-semibold">Status:</span>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="text-xs rounded-xs border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 font-medium"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="ACTIVE">Active Only</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </div>
              </div>

              {/* Customers Table */}
              <div className="bg-white dark:bg-[#0B1536] rounded-md border border-slate-200 dark:border-[#1E2E64] shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#0B2A5B] text-white font-display font-bold uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="px-4 py-3">Customer ID</th>
                        <th className="px-4 py-3">Full Name</th>
                        <th className="px-4 py-3">Phone & Email</th>
                        <th className="px-4 py-3">Residential Address</th>
                        <th className="px-4 py-3">Enrolled Programmes</th>
                        <th className="px-4 py-3">Registered Date</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                      {filteredCustomers.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                            No customer records found. Click &ldquo;Register New Customer&rdquo; to enrol a customer.
                          </td>
                        </tr>
                      ) : (
                        filteredCustomers.map((cust) => (
                          <tr key={cust.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
                            <td className="px-4 py-3 font-mono font-bold text-[#1E5BD8] dark:text-blue-400">
                              <div>{cust.customerCode || cust.id}</div>
                              <div className="text-[10px] text-slate-400 font-normal">{cust.id}</div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-display font-bold text-[#0B2A5B] dark:text-white">
                                {cust.fullName}
                              </div>
                              {cust.nextOfKinName && (
                                <div className="text-[11px] text-slate-400">
                                  NOK: {cust.nextOfKinName}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-semibold text-slate-800 dark:text-slate-200 tabular-nums">
                                {cust.phone}
                              </div>
                              <div className="text-[11px] text-slate-400">
                                {cust.email || 'No email registered'}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-slate-600 dark:text-slate-300 max-w-xs truncate">
                              {cust.address}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap gap-1">
                                {cust.enrolledProgrammes && cust.enrolledProgrammes.length > 0 ? (
                                  cust.enrolledProgrammes.map((p) => (
                                    <span
                                      key={p}
                                      className="px-1.5 py-0.5 rounded-xs text-[10px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                                    >
                                      {p.replace(/_/g, ' ')}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-slate-400 text-[11px]">None enrolled</span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-slate-500 dark:text-slate-400 tabular-nums">
                              {cust.registrationDate ? new Date(cust.registrationDate).toLocaleDateString() : 'Today'}
                            </td>
                            <td className="px-4 py-3">
                              <span className="px-2 py-0.5 rounded-xs text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300">
                                {(cust.status || 'active').toUpperCase()}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                onClick={() => setSelectedCustomer(cust)}
                                className="px-3 py-1.5 text-xs font-display font-bold bg-[#0B2A5B] hover:bg-[#1E5BD8] text-white rounded-xs transition-colors cursor-pointer"
                              >
                                Profile & Enrol
                              </button>
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

          {/* ========================================================= */}
          {/* 3. PAYMENTS & COLLECTIONS */}
          {/* ========================================================= */}
          {activeTab === 'payments' && (
            <div className="space-y-6">
              <div className="bg-white dark:bg-[#0B1536] p-6 rounded-md border border-slate-200 dark:border-[#1E2E64] shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <div className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[#1E5BD8] dark:text-blue-400">
                    MODULE 03 // UNIFIED TRANSACTION LEDGER
                  </div>
                  <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[#0B2A5B] dark:text-white tracking-tight mt-1">
                    Unified Payment & Contribution Ledger
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                    Comprehensive chronological record of cash collections, repayments, deposits, and reversals
                  </p>
                </div>
                <div className="flex items-center gap-2.5">
                  <button
                    onClick={handleExportCSV}
                    className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-[#0B2A5B] dark:text-white rounded-xs text-xs font-display font-bold uppercase tracking-wider flex items-center gap-1.5 border border-slate-200 dark:border-slate-700 cursor-pointer"
                  >
                    <Download size={15} />
                    <span>Export CSV</span>
                  </button>
                  <button
                    onClick={() => setModalType('record_payment')}
                    className="px-4 py-2.5 bg-[#16A34A] hover:bg-emerald-700 text-white rounded-xs text-xs font-display font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <Plus size={16} />
                    <span>Record Manual Payment</span>
                  </button>
                </div>
              </div>

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-[#0B1536] p-4 rounded-md border border-slate-200 dark:border-[#1E2E64] shadow-xs">
                <div className="flex-1 min-w-[240px] relative">
                  <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by customer name or payment reference..."
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xs border border-slate-300 dark:border-slate-600 bg-[#F4F7FB] dark:bg-slate-900 focus:outline-none focus:border-[#2563EB]"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 font-semibold">Programme:</span>
                  <select
                    value={programmeFilter}
                    onChange={(e) => setProgrammeFilter(e.target.value)}
                    className="text-xs rounded-xs border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 font-medium"
                  >
                    <option value="ALL">All Programmes</option>
                    <option value="FIXED_TARGET">Fixed Target</option>
                    <option value="DAILY_AJO">Daily Ajo</option>
                    <option value="EVERYHOME_FOOD">Everyhome Food</option>
                    <option value="LEOCASH">Leocash Savings</option>
                    <option value="LOAN_REPAYMENT">Loan Repayment</option>
                  </select>
                </div>
              </div>

              {/* Payments Table */}
              <div className="bg-white dark:bg-[#0B1536] rounded-md border border-slate-200 dark:border-[#1E2E64] shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#0B2A5B] text-white font-display font-bold uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="px-4 py-3">Reference</th>
                        <th className="px-4 py-3">Customer</th>
                        <th className="px-4 py-3">Programme</th>
                        <th className="px-4 py-3">Amount</th>
                        <th className="px-4 py-3">Method</th>
                        <th className="px-4 py-3">Recorded By</th>
                        <th className="px-4 py-3">Date & Time</th>
                        <th className="px-4 py-3">Verification</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                      {filteredPayments.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
                          <td className="px-4 py-3 font-mono font-bold text-slate-700 dark:text-slate-300">
                            {p.reference}
                          </td>
                          <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">
                            {p.customerName}
                          </td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                              {(p.programme || p.programmeLabel || p.programmeType || '').replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-black text-slate-900 dark:text-white">
                            {formatNaira(p.amountKobo ?? (p.amount ? p.amount * 100 : 0))}
                          </td>
                          <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                            {p.paymentMethod || p.paymentChannel}
                          </td>
                          <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                            {p.recordedByStaffName || p.collectedByStaffName}
                          </td>
                          <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                            {new Date(p.dateTime || p.timestamp || Date.now()).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                            <span className="text-[11px] bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded font-medium">
                              {p.verificationNote || p.notes || p.transactionReference}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {p.status === 'CONFIRMED_RECORDED' || p.status === 'completed' ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300">
                                CONFIRMED
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-300">
                                REVERSED
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {(p.status === 'CONFIRMED_RECORDED' || p.status === 'completed') && (
                              <button
                                onClick={() => {
                                  setReversalPayment(p);
                                  setReversalReason('');
                                }}
                                className="text-xs text-rose-600 hover:text-rose-700 font-bold underline"
                              >
                                Reverse
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

          {/* ========================================================= */}
          {/* 4. FIXED TARGET SAVINGS */}
          {/* ========================================================= */}
          {activeTab === 'fixed_target' && (
            <div className="space-y-6">
              <div className="bg-white dark:bg-[#0B162C] border border-slate-200 dark:border-slate-800 p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 relative overflow-hidden">
                <div className="h-1 bg-[#2563EB] absolute top-0 left-0 right-0" />
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-[#2563EB]/10 text-[#2563EB] text-[10px] font-bold uppercase tracking-[0.2em] mb-1.5">
                    <Target size={13} />
                    <span>PROGRAMME 01 // FIXED TARGET SAVINGS</span>
                  </div>
                  <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[#0B2A5B] dark:text-white tracking-tight">
                    Fixed Target Savings Plans
                  </h1>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    Organise disciplined savings targets, scheduled contributions, and progress tracking
                  </p>
                </div>
                <button
                  onClick={() => setModalType('create_fixed_target')}
                  className="px-4 py-2.5 bg-[#2563EB] hover:bg-[#1E5BD8] text-white text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-sm transition-colors"
                >
                  <Plus size={15} />
                  <span>Create Target Plan</span>
                </button>
              </div>

              {/* Plans Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {fixedTargetPlans.map((plan) => {
                  const savedKobo = plan.savedAmountKobo ?? (plan.currentBalanceKobo ?? plan.currentBalance * 100);
                  const targetKobo = plan.targetAmountKobo ?? (plan.targetAmount ? plan.targetAmount * 100 : 1);
                  const progressPercent = Math.min(
                    100,
                    Math.round((savedKobo / (targetKobo || 1)) * 100)
                  );
                  const remainingKobo = Math.max(0, targetKobo - savedKobo);

                  return (
                    <div
                      key={plan.id}
                      className="bg-white dark:bg-[#0B162C] border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4 relative overflow-hidden"
                    >
                      <div className="h-1 bg-[#2563EB] absolute top-0 left-0 right-0" />
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="text-[11px] font-bold text-[#2563EB] uppercase tracking-wider font-mono">
                            {plan.id} · {plan.contributionFrequency || plan.frequency}
                          </div>
                          <h3 className="font-display font-extrabold text-base text-[#0B2A5B] dark:text-white mt-0.5">
                            {plan.planName || plan.title}
                          </h3>
                          <div className="text-xs text-slate-500 font-medium mt-0.5">
                            Customer: <strong className="text-slate-800 dark:text-slate-200">{plan.customerName}</strong>
                          </div>
                        </div>
                        <span
                          className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                            plan.status === 'COMPLETED' || plan.status === 'completed'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-[#2563EB]/10 text-[#2563EB]'
                          }`}
                        >
                          {plan.status}
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs font-semibold">
                          <span className="text-slate-500">Progress ({progressPercent}%)</span>
                          <span className="font-display font-bold text-[#0B2A5B] dark:text-white tabular-nums">
                            {formatNaira(savedKobo)} / {formatNaira(targetKobo)}
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 overflow-hidden">
                          <div
                            className="bg-[#2563EB] h-full transition-all duration-500"
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                        <div className="text-[11px] text-slate-500 flex justify-between tabular-nums">
                          <span>Remaining: {formatNaira(remainingKobo)}</span>
                          <span>Target Date: {plan.targetDate}</span>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                        <div className="text-xs text-slate-500 font-semibold">
                          Tenor: {plan.durationMonths || plan.totalExpectedInstalments || 12} Months
                        </div>
                        {(plan.status === 'ACTIVE' || plan.status === 'active') && (
                          <button
                            onClick={() => handleRecordFixedTargetPayment(plan)}
                            className="px-3 py-1.5 bg-[#2563EB] hover:bg-[#1E5BD8] text-white text-xs font-bold uppercase tracking-wider flex items-center gap-1 shadow-sm transition-colors"
                          >
                            <Plus size={14} />
                            <span>Record Contribution</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 5. DAILY AJO SAVINGS */}
          {/* ========================================================= */}
          {activeTab === 'daily_ajo' && (
            <div className="space-y-6">
              <div className="bg-white dark:bg-[#0B162C] border border-slate-200 dark:border-slate-800 p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 relative overflow-hidden">
                <div className="h-1 bg-[#16A34A] absolute top-0 left-0 right-0" />
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-[#16A34A]/10 text-[#16A34A] text-[10px] font-bold uppercase tracking-[0.2em] mb-1.5">
                    <Calendar size={13} />
                    <span>PROGRAMME 02 // DAILY AJO SAVINGS</span>
                  </div>
                  <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[#0B2A5B] dark:text-white tracking-tight">
                    Daily Ajo Savings Operations
                  </h1>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    Daily collection rounds, 31-day cycle tracking, payout calculations, and cycle roll-over
                  </p>
                </div>
                <button
                  onClick={() => setModalType('enrol_daily_ajo')}
                  className="px-4 py-2.5 bg-[#16A34A] hover:bg-emerald-700 text-white text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-sm transition-colors"
                >
                  <Plus size={15} />
                  <span>Enrol New Ajo Cycle</span>
                </button>
              </div>

              {/* Ajo Cycles List with Visual Calendar Cards */}
              <div className="space-y-4">
                {dailyAjoEnrolments.map((enrolment) => (
                  <div
                    key={enrolment.id}
                    className="bg-white dark:bg-[#0B162C] border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4 relative overflow-hidden"
                  >
                    <div className="h-1 bg-[#16A34A] absolute top-0 left-0 right-0" />
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-[#16A34A]">
                            {enrolment.id}
                          </span>
                          <span className="text-slate-300">·</span>
                          <span className="text-xs font-semibold text-slate-500">
                            Month: {enrolment.cycleMonth || (enrolment.startDate ? enrolment.startDate.substring(0, 7) : 'Active Cycle')}
                          </span>
                        </div>
                        <h3 className="font-display text-lg font-extrabold text-[#0B2A5B] dark:text-white">
                          {enrolment.customerName}
                        </h3>
                        <div className="text-xs text-slate-500 tabular-nums">
                          Daily Rate:{' '}
                          <strong className="text-[#16A34A] font-bold">
                            {formatNaira(enrolment.dailyAmountKobo ?? (enrolment.dailyAmount ? enrolment.dailyAmount * 100 : 0))}/day
                          </strong>{' '}
                          · Total Collected:{' '}
                          <strong className="text-[#0B2A5B] dark:text-white font-bold">
                            {formatNaira(enrolment.totalCollectedKobo ?? (enrolment.totalSavedKobo ?? enrolment.totalSaved * 100))}
                          </strong>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleRecordAjoDayPayment(enrolment)}
                          className="px-3.5 py-2 bg-[#16A34A] hover:bg-emerald-700 text-white text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-sm transition-colors"
                        >
                          <Plus size={14} />
                          <span>Record Day Payment</span>
                        </button>
                      </div>
                    </div>

                    {/* Interactive 31-Day Visual Cycle Calendar Grid */}
                    <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-400">
                        <span>31-Day Cycle Calendar ({enrolment.paidDays.length}/31 Days Completed)</span>
                        <div className="flex items-center gap-3 text-[11px]">
                          <span className="flex items-center gap-1">
                            <span className="w-2.5 h-2.5 bg-[#16A34A]" /> Paid
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="w-2.5 h-2.5 bg-slate-200 dark:bg-slate-700" /> Upcoming
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-11 sm:grid-cols-16 lg:grid-cols-31 gap-1">
                        {Array.from({ length: 31 }, (_, i) => i + 1).map((dayNum) => {
                          const isPaid = enrolment.paidDays.includes(dayNum);
                          return (
                            <div
                              key={dayNum}
                              className={`h-7 flex items-center justify-center text-[11px] font-bold tabular-nums transition-all ${
                                isPaid
                                  ? 'bg-[#16A34A] text-white shadow-sm'
                                  : 'bg-[#F4F7FB] dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700'
                              }`}
                              title={`Day ${dayNum}: ${isPaid ? 'Paid' : 'Pending'}`}
                            >
                              {dayNum}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 6. EVERYHOME FOOD CONTRIBUTION */}
          {/* ========================================================= */}
          {activeTab === 'everyhome_food' && (
            <div className="space-y-6">
              <div className="bg-white dark:bg-[#0B162C] border border-slate-200 dark:border-slate-800 p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 relative overflow-hidden">
                <div className="h-1 bg-[#F97316] absolute top-0 left-0 right-0" />
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-[#F97316]/10 text-[#F97316] text-[10px] font-bold uppercase tracking-[0.2em] mb-1.5">
                    <ShoppingBag size={13} />
                    <span>PROGRAMME 03 // EVERYHOME FOOD CONTRIBUTION</span>
                  </div>
                  <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[#0B2A5B] dark:text-white tracking-tight">
                    Everyhome Food Contribution
                  </h1>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    Household subscriptions, scheduled contributions, and food staple parcel distribution
                  </p>
                </div>
                <button
                  onClick={() => setModalType('enrol_food')}
                  className="px-4 py-2.5 bg-[#F97316] hover:bg-orange-600 text-white text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-sm transition-colors"
                >
                  <Plus size={15} />
                  <span>Enrol Household</span>
                </button>
              </div>

              {/* Food Subscriptions Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {foodEnrolments.map((food) => {
                  const contributedKobo = food.totalContributedKobo ?? (food.amountPaid ? food.amountPaid * 100 : 0);
                  const costKobo = food.packageCostKobo ?? (food.packageValue ? food.packageValue * 100 : 1);
                  const progressPercent = Math.min(
                    100,
                    Math.round((contributedKobo / (costKobo || 1)) * 100)
                  );
                  return (
                    <div
                      key={food.id}
                      className="bg-white dark:bg-[#0B162C] border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4 relative overflow-hidden"
                    >
                      <div className="h-1 bg-[#F97316] absolute top-0 left-0 right-0" />
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="text-[11px] font-bold text-[#F97316] uppercase tracking-wider font-mono">
                            {food.id} · {(food.packageType || food.packageName || 'PACKAGE').replace(/_/g, ' ')}
                          </div>
                          <h3 className="font-display font-extrabold text-base text-[#0B2A5B] dark:text-white mt-0.5">
                            {food.householdHeadName || food.customerName}
                          </h3>
                        </div>
                        <span
                          className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                            food.fulfilmentStatus === 'DISTRIBUTED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : food.fulfilmentStatus === 'READY'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-[#F97316]/10 text-[#F97316]'
                          }`}
                        >
                          {food.fulfilmentStatus}
                        </span>
                      </div>

                      {/* Progress */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs font-semibold">
                          <span className="text-slate-500">Contribution ({progressPercent}%)</span>
                          <span className="font-display font-bold text-[#0B2A5B] dark:text-white tabular-nums">
                            {formatNaira(food.totalContributedKobo)} / {formatNaira(food.packageCostKobo)}
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 overflow-hidden">
                          <div
                            className="bg-[#F97316] h-full transition-all duration-500"
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                        <div className="text-[11px] text-slate-500 flex justify-between tabular-nums">
                          <span>Outstanding: {formatNaira(food.outstandingBalanceKobo)}</span>
                          <span>{food.distributionDate ? `Distributed: ${food.distributionDate.slice(0, 10)}` : 'Distribution: Scheduled'}</span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                        {food.fulfilmentStatus === 'PENDING' && (
                          <button
                            onClick={() => handleRecordFoodPayment(food)}
                            className="px-3 py-1.5 bg-[#F97316] hover:bg-orange-600 text-white text-xs font-bold uppercase tracking-wider shadow-sm transition-colors"
                          >
                            Record Payment
                          </button>
                        )}
                        {food.fulfilmentStatus === 'READY' && (
                          <button
                            onClick={() => handleFoodFulfilmentStatus(food.id, 'DISTRIBUTED')}
                            className="px-3 py-1.5 bg-[#16A34A] hover:bg-emerald-700 text-white text-xs font-bold uppercase tracking-wider shadow-sm transition-colors"
                          >
                            Confirm Distribution
                          </button>
                        )}
                        {food.fulfilmentStatus === 'DISTRIBUTED' && (
                          <span className="text-xs font-bold text-[#16A34A] flex items-center gap-1 uppercase tracking-wider">
                            <CheckCircle2 size={13} /> Delivered
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 7. LEOCASH SAVINGS */}
          {/* ========================================================= */}
          {activeTab === 'leocash' && (
            <div className="space-y-6">
              <div className="bg-white dark:bg-[#0B162C] border border-slate-200 dark:border-slate-800 p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 relative overflow-hidden">
                <div className="h-1 bg-[#7C3AED] absolute top-0 left-0 right-0" />
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-[#7C3AED]/10 text-[#7C3AED] text-[10px] font-bold uppercase tracking-[0.2em] mb-1.5">
                    <Coins size={13} />
                    <span>PROGRAMME 04 // LEOCASH FLEXIBLE SAVINGS</span>
                  </div>
                  <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[#0B2A5B] dark:text-white tracking-tight">
                    Leocash Flexible Savings Accounts
                  </h1>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    Manage on-demand liquid savings accounts, deposits, withdrawals, and authorization queues
                  </p>
                </div>
                <button
                  onClick={() => setModalType('create_leocash')}
                  className="px-4 py-2.5 bg-[#7C3AED] hover:bg-purple-700 text-white text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-sm transition-colors"
                >
                  <Plus size={15} />
                  <span>Open Leocash Account</span>
                </button>
              </div>

              {/* Accounts Table */}
              <div className="bg-white dark:bg-[#0B162C] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#0B2A5B] text-white font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="px-4 py-3.5">Account Number</th>
                        <th className="px-4 py-3.5">Customer Name</th>
                        <th className="px-4 py-3.5">Available Balance</th>
                        <th className="px-4 py-3.5">Total Deposits</th>
                        <th className="px-4 py-3.5">Total Withdrawals</th>
                        <th className="px-4 py-3.5">Status</th>
                        <th className="px-4 py-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                      {leocashAccounts.map((acc) => (
                        <tr key={acc.id} className="hover:bg-[#F4F7FB] dark:hover:bg-slate-800/60 transition-colors">
                          <td className="px-4 py-3.5 font-mono font-bold text-[#7C3AED]">
                            {acc.accountNumber}
                          </td>
                          <td className="px-4 py-3.5 font-bold text-[#0B2A5B] dark:text-white">
                            {acc.customerName}
                          </td>
                          <td className="px-4 py-3.5 font-display font-extrabold text-base text-[#0B2A5B] dark:text-white tabular-nums">
                            {formatNaira(acc.balanceKobo)}
                          </td>
                          <td className="px-4 py-3.5 text-slate-600 dark:text-slate-300 tabular-nums">
                            {formatNaira(acc.totalDepositsKobo)}
                          </td>
                          <td className="px-4 py-3.5 text-slate-600 dark:text-slate-300 tabular-nums">
                            {formatNaira(acc.totalWithdrawalsKobo)}
                          </td>
                          <td className="px-4 py-3.5">
                            <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800">
                              {acc.status}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-right space-x-2">
                            <button
                              onClick={() => handleRecordLeocashDeposit(acc)}
                              className="px-2.5 py-1.5 text-xs font-bold uppercase tracking-wider bg-[#7C3AED] hover:bg-purple-700 text-white shadow-sm transition-colors"
                            >
                              Deposit
                            </button>
                            <button
                              onClick={() => {
                                setSelectedLeocashAccount(acc);
                                setModalType('request_leocash_withdrawal');
                              }}
                              className="px-2.5 py-1.5 text-xs font-bold uppercase tracking-wider bg-[#F4F7FB] hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-[#0B2A5B] dark:text-white border border-slate-200 dark:border-slate-700 transition-colors"
                            >
                              Withdraw
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Pending Withdrawal Requests Queue */}
              {leocashWithdrawals.length > 0 && (
                <div className="bg-white dark:bg-[#0B162C] border border-slate-200 dark:border-slate-800 p-5 space-y-3">
                  <h3 className="font-display font-bold text-sm text-[#0B2A5B] dark:text-white flex items-center gap-2">
                    <Clock size={16} className="text-amber-500" />
                    <span>Withdrawal Authorization Queue</span>
                  </h3>
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {leocashWithdrawals.map((req) => (
                      <div key={req.id} className="py-2.5 flex items-center justify-between text-xs">
                        <div>
                          <div className="font-bold text-[#0B2A5B] dark:text-white tabular-nums">
                            {req.customerName} · {formatNaira(req.amountKobo)}
                          </div>
                          <div className="text-slate-500 text-[11px]">
                            Reason: {req.reason} · Requested: {new Date(req.requestDate || req.requestedDate || Date.now()).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {req.status === 'PENDING_APPROVAL' ? (
                            <>
                              <button
                                onClick={() => handleReviewWithdrawal(req.id, 'APPROVED')}
                                className="px-3 py-1 bg-[#16A34A] hover:bg-emerald-700 text-white text-xs font-bold uppercase tracking-wider"
                              >
                                Authorize
                              </button>
                              <button
                                onClick={() => handleReviewWithdrawal(req.id, 'REJECTED')}
                                className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold uppercase tracking-wider"
                              >
                                Decline
                              </button>
                            </>
                          ) : (
                            <span className="font-bold text-slate-500 uppercase">{req.status}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================= */}
          {/* 8. LOAN MANAGEMENT SYSTEM */}
          {/* ========================================================= */}
          {activeTab === 'loans' && (
            <div className="space-y-6">
              <div className="bg-white dark:bg-[#0B162C] border border-slate-200 dark:border-slate-800 p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 relative overflow-hidden">
                <div className="h-1 bg-[#0D9488] absolute top-0 left-0 right-0" />
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-[#0D9488]/10 text-[#0D9488] text-[10px] font-bold uppercase tracking-[0.2em] mb-1.5">
                    <FileSpreadsheet size={13} />
                    <span>PROGRAMME 05 // LOAN MANAGEMENT & SERVICING</span>
                  </div>
                  <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[#0B2A5B] dark:text-white tracking-tight">
                    Loan Management & Servicing
                  </h1>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    Origination, risk reviews, decoupled disbursement, repayment schedules, and arrears tracking
                  </p>
                </div>
                <button
                  onClick={() => setModalType('create_loan_app')}
                  className="px-4 py-2.5 bg-[#0D9488] hover:bg-teal-700 text-white text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-sm transition-colors"
                >
                  <Plus size={15} />
                  <span>New Loan Application</span>
                </button>
              </div>

              {/* Sub-section: Loan Applications */}
              <div className="bg-white dark:bg-[#0B162C] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-200 dark:border-slate-800">
                  <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#0D9488]">
                    ORIGINATION // CREDIT PIPELINE
                  </div>
                  <h3 className="font-display font-bold text-[#0B2A5B] dark:text-white text-base mt-0.5">
                    Loan Applications Pipeline
                  </h3>
                  <p className="text-xs text-slate-500">
                    Applications under review, credit decisions, and approved loans awaiting disbursement
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#0B2A5B] text-white font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="px-4 py-3.5">App ID</th>
                        <th className="px-4 py-3.5">Borrower</th>
                        <th className="px-4 py-3.5">Requested Amount</th>
                        <th className="px-4 py-3.5">Duration</th>
                        <th className="px-4 py-3.5">Purpose</th>
                        <th className="px-4 py-3.5">Status</th>
                        <th className="px-4 py-3.5 text-right">Workflow Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                      {loanApplications.map((app) => (
                        <tr key={app.id} className="hover:bg-[#F4F7FB] dark:hover:bg-slate-800/60 transition-colors">
                          <td className="px-4 py-3.5 font-mono font-bold text-[#0D9488]">
                            {app.id}
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="font-bold text-[#0B2A5B] dark:text-white">
                              {app.borrowerName}
                            </div>
                            <div className="text-[11px] text-slate-400">{app.borrowerPhone}</div>
                          </td>
                          <td className="px-4 py-3.5 font-display font-bold text-[#0B2A5B] dark:text-white tabular-nums">
                            {formatNaira(app.requestedAmountKobo)}
                          </td>
                          <td className="px-4 py-3.5 text-slate-600 dark:text-slate-300">
                            {app.proposedDurationMonths} Months ({app.interestRateMonthlyPercent}%/mo)
                          </td>
                          <td className="px-4 py-3.5 text-slate-600 dark:text-slate-300">
                            {app.purpose}
                          </td>
                          <td className="px-4 py-3.5">
                            <span
                              className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                                app.isDisbursed
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : app.status === 'APPROVED'
                                  ? 'bg-amber-100 text-amber-800'
                                  : app.status === 'REJECTED'
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-[#2563EB]/10 text-[#2563EB]'
                              }`}
                            >
                              {app.isDisbursed
                                ? 'DISBURSED'
                                : app.status === 'APPROVED'
                                ? 'APPROVED · AWAITING DISBURSEMENT'
                                : app.status}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-right space-x-2">
                            {app.status === 'PENDING' && (
                              <button
                                onClick={() => setSelectedLoanApp(app)}
                                className="px-2.5 py-1.5 text-xs font-bold uppercase tracking-wider bg-[#0D9488] hover:bg-teal-700 text-white transition-colors"
                              >
                                Review Decision
                              </button>
                            )}
                            {app.status === 'APPROVED' && !app.isDisbursed && (
                              <button
                                onClick={() => handleDisburseLoan(app)}
                                className="px-2.5 py-1.5 text-xs font-bold uppercase tracking-wider bg-[#16A34A] hover:bg-emerald-700 text-white shadow-sm transition-colors"
                              >
                                Disburse Loan
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Sub-section: Active Disbursed Loans & Schedules */}
              <div className="bg-white dark:bg-[#0B162C] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#0D9488]">
                      SERVICING // ACTIVE CREDIT LEDGER
                    </div>
                    <h3 className="font-display font-bold text-[#0B2A5B] dark:text-white text-base mt-0.5">
                      Active Loan Facilities & Repayment Schedules
                    </h3>
                    <p className="text-xs text-slate-500">
                      Disbursed loans, interest accruals, outstanding balances, and repayment recording
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#0B2A5B] text-white font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="px-4 py-3.5">Loan Ref</th>
                        <th className="px-4 py-3.5">Borrower</th>
                        <th className="px-4 py-3.5">Principal</th>
                        <th className="px-4 py-3.5">Total Payable</th>
                        <th className="px-4 py-3.5">Repaid</th>
                        <th className="px-4 py-3.5">Outstanding</th>
                        <th className="px-4 py-3.5">Status</th>
                        <th className="px-4 py-3.5 text-right">Repayment</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                      {loans.map((loan) => (
                        <tr key={loan.id} className="hover:bg-[#F4F7FB] dark:hover:bg-slate-800/60 transition-colors">
                          <td className="px-4 py-3.5 font-mono font-bold text-[#0D9488]">
                            {loan.loanReference}
                          </td>
                          <td className="px-4 py-3.5 font-bold text-[#0B2A5B] dark:text-white">
                            {loan.borrowerName}
                          </td>
                          <td className="px-4 py-3.5 font-display font-bold text-[#0B2A5B] dark:text-white tabular-nums">
                            {formatNaira(loan.principalKobo)}
                          </td>
                          <td className="px-4 py-3.5 text-slate-600 dark:text-slate-300 tabular-nums">
                            {formatNaira(loan.totalPayableKobo)}
                          </td>
                          <td className="px-4 py-3.5 font-semibold text-[#16A34A] tabular-nums">
                            {formatNaira(loan.totalRepaidKobo)}
                          </td>
                          <td className="px-4 py-3.5 font-display font-extrabold text-rose-600 dark:text-rose-400 tabular-nums">
                            {formatNaira(loan.outstandingBalanceKobo)}
                          </td>
                          <td className="px-4 py-3.5">
                            <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800">
                              {loan.status.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            <button
                              onClick={() => {
                                setSelectedLoan(loan);
                                setRepaymentAmount(koboToNaira(loan.repaymentSchedule[0]?.outstandingKobo || 5000000).toString());
                                setModalType('record_loan_repayment');
                              }}
                              className="px-2.5 py-1.5 text-xs font-bold uppercase tracking-wider bg-[#16A34A] hover:bg-emerald-700 text-white shadow-sm transition-colors"
                            >
                              Record Repayment
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

          {/* ========================================================= */}
          {/* 9. REPORTS & EXPORT */}
          {/* ========================================================= */}
          {activeTab === 'reports' && (
            <div className="space-y-6">
              <div className="bg-white dark:bg-[#0B162C] border border-slate-200 dark:border-slate-800 p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#2563EB] mb-1">
                    MODULE 09 // FINANCIAL ANALYTICS & EXPORT
                  </div>
                  <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[#0B2A5B] dark:text-white tracking-tight">
                    Operational & Financial Reports
                  </h1>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    Comprehensive reporting across programmes, collections, disbursements, and staff performance
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => window.print()}
                    className="px-3.5 py-2.5 bg-[#F4F7FB] hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-[#0B2A5B] dark:text-white border border-slate-200 dark:border-slate-700 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors"
                  >
                    <Printer size={15} />
                    <span>Print Report</span>
                  </button>
                  <button
                    onClick={handleExportCSV}
                    className="px-4 py-2.5 bg-[#1E5BD8] hover:bg-[#0B2A5B] text-white text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-sm transition-colors"
                  >
                    <Download size={15} />
                    <span>Export Ledger (CSV)</span>
                  </button>
                </div>
              </div>

              {/* Summary Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-[#0B162C] p-5 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
                  <div className="h-1 bg-[#16A34A] absolute top-0 left-0 right-0" />
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Total Inflow / Collections
                  </div>
                  <div className="font-display text-2xl font-extrabold text-[#16A34A] mt-2 tabular-nums">
                    {formatNaira(
                      payments
                        .filter((p) => p.type === 'CONTRIBUTION' || p.type === 'DEPOSIT' || p.type === 'REPAYMENT')
                        .reduce((sum, p) => sum + (p.amountKobo ?? (p.amount ? p.amount * 100 : 0)), 0)
                    )}
                  </div>
                </div>

                <div className="bg-white dark:bg-[#0B162C] p-5 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
                  <div className="h-1 bg-[#0D9488] absolute top-0 left-0 right-0" />
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Total Outflow / Disbursed
                  </div>
                  <div className="font-display text-2xl font-extrabold text-[#0B2A5B] dark:text-white mt-2 tabular-nums">
                    {formatNaira(summary.totalDisbursedKobo)}
                  </div>
                </div>

                <div className="bg-white dark:bg-[#0B162C] p-5 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
                  <div className="h-1 bg-[#F97316] absolute top-0 left-0 right-0" />
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Net Outstanding Credit
                  </div>
                  <div className="font-display text-2xl font-extrabold text-[#F97316] mt-2 tabular-nums">
                    {formatNaira(summary.totalOutstandingLoansKobo)}
                  </div>
                </div>

                <div className="bg-white dark:bg-[#0B162C] p-5 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
                  <div className="h-1 bg-[#2563EB] absolute top-0 left-0 right-0" />
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Total Transactions Recorded
                  </div>
                  <div className="font-display text-2xl font-extrabold text-[#2563EB] mt-2 tabular-nums">
                    {payments.length}
                  </div>
                </div>
              </div>

              {/* Program Summary Breakdown Table */}
              <div className="bg-white dark:bg-[#0B162C] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-200 dark:border-slate-800">
                  <h3 className="font-display font-bold text-sm text-[#0B2A5B] dark:text-white">
                    Summary by Programme
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#0B2A5B] text-white font-bold uppercase tracking-wider">
                      <tr>
                        <th className="px-4 py-3">Programme Name</th>
                        <th className="px-4 py-3">Enrolments</th>
                        <th className="px-4 py-3">Total Saved / Contributed</th>
                        <th className="px-4 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                      <tr>
                        <td className="px-4 py-3.5 font-bold text-[#2563EB]">01 · Fixed Target Savings</td>
                        <td className="px-4 py-3.5 tabular-nums">{fixedTargetPlans.length}</td>
                        <td className="px-4 py-3.5 font-display font-bold tabular-nums">{formatNaira(summary.totalFixedTargetSavedKobo)}</td>
                        <td className="px-4 py-3.5 text-[#16A34A] font-bold uppercase text-[10px]">Active</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3.5 font-bold text-[#16A34A]">02 · Daily Ajo Savings</td>
                        <td className="px-4 py-3.5 tabular-nums">{dailyAjoEnrolments.length}</td>
                        <td className="px-4 py-3.5 font-display font-bold tabular-nums">{formatNaira(summary.totalDailyAjoCollectedKobo)}</td>
                        <td className="px-4 py-3.5 text-[#16A34A] font-bold uppercase text-[10px]">Active</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3.5 font-bold text-[#F97316]">03 · Everyhome Food Contribution</td>
                        <td className="px-4 py-3.5 tabular-nums">{foodEnrolments.length}</td>
                        <td className="px-4 py-3.5 font-display font-bold tabular-nums">{formatNaira(summary.totalFoodContributedKobo)}</td>
                        <td className="px-4 py-3.5 text-[#16A34A] font-bold uppercase text-[10px]">Active</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3.5 font-bold text-[#7C3AED]">04 · Leocash Savings</td>
                        <td className="px-4 py-3.5 tabular-nums">{leocashAccounts.length}</td>
                        <td className="px-4 py-3.5 font-display font-bold tabular-nums">{formatNaira(summary.totalLeocashBalanceKobo)}</td>
                        <td className="px-4 py-3.5 text-[#16A34A] font-bold uppercase text-[10px]">Active</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3.5 font-bold text-[#0D9488]">05 · Loan Management System</td>
                        <td className="px-4 py-3.5 tabular-nums">{loans.length}</td>
                        <td className="px-4 py-3.5 font-display font-bold tabular-nums">{formatNaira(summary.totalDisbursedKobo)}</td>
                        <td className="px-4 py-3.5 text-[#16A34A] font-bold uppercase text-[10px]">Active</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 10. STAFF MANAGEMENT & PERMISSIONS */}
          {/* ========================================================= */}
          {activeTab === 'staff_mgmt' && (
            <div className="space-y-6">
              <div className="bg-white dark:bg-[#0B162C] border border-slate-200 dark:border-slate-800 p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#2563EB] mb-1">
                    MODULE 10 // ROLE-BASED ACCESS MATRIX
                  </div>
                  <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[#0B2A5B] dark:text-white tracking-tight">
                    Staff Accounts & Role Permissions
                  </h1>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    Authorised staff credentials, assigned roles, and granular capability matrices
                  </p>
                </div>
                {currentUser.role === 'SUPER_ADMIN' && (
                  <button
                    onClick={() => setModalType('add_staff')}
                    className="px-4 py-2.5 bg-[#1E5BD8] hover:bg-[#0B2A5B] text-white text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-sm transition-colors"
                  >
                    <Plus size={15} />
                    <span>Add Staff Member</span>
                  </button>
                )}
              </div>

              {/* Staff Roster Table */}
              <div className="bg-white dark:bg-[#0B162C] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#0B2A5B] text-white font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="px-4 py-3.5">Staff Name</th>
                        <th className="px-4 py-3.5">Work Email</th>
                        <th className="px-4 py-3.5">Phone</th>
                        <th className="px-4 py-3.5">Assigned Role</th>
                        <th className="px-4 py-3.5">Status</th>
                        <th className="px-4 py-3.5 text-right">Switch Active</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                      {staffUsers.map((staff) => (
                        <tr key={staff.id} className="hover:bg-[#F4F7FB] dark:hover:bg-slate-800/60 transition-colors">
                          <td className="px-4 py-3.5 font-bold text-[#0B2A5B] dark:text-white">
                            {staff.fullName}
                          </td>
                          <td className="px-4 py-3.5 text-slate-600 dark:text-slate-300 font-mono">
                            {staff.email}
                          </td>
                          <td className="px-4 py-3.5 text-slate-600 dark:text-slate-300">
                            {staff.phone}
                          </td>
                          <td className="px-4 py-3.5">
                            <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-[#2563EB]/10 text-[#2563EB]">
                              {staff.role.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="px-4 py-3.5">
                            <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800">
                              {staff.active ? 'ACTIVE' : 'DEACTIVATED'}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            <button
                              onClick={() => handleRoleSwitch(staff.id)}
                              className={`px-2.5 py-1 text-xs font-bold uppercase tracking-wider transition-colors ${
                                currentUser.id === staff.id
                                  ? 'bg-[#16A34A] text-white'
                                  : 'bg-[#F4F7FB] hover:bg-slate-200 dark:bg-slate-800 text-[#0B2A5B] dark:text-white border border-slate-200 dark:border-slate-700'
                              }`}
                            >
                              {currentUser.id === staff.id ? 'Active Context' : 'Select'}
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

          {/* ========================================================= */}
          {/* 11. SETTINGS & AUDIT LOGS */}
          {/* ========================================================= */}
          {activeTab === 'settings' && (
            <div className="space-y-6">
              <div className="bg-white dark:bg-[#0B162C] border border-slate-200 dark:border-slate-800 p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#2563EB] mb-1">
                    MODULE 11 // IMMUTABLE COMPLIANCE TELEMETRY
                  </div>
                  <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[#0B2A5B] dark:text-white tracking-tight">
                    Immutable Audit Trail & System Parameters
                  </h1>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    Tamper-evident logs of all customer registrations, payments, approvals, and reversals
                  </p>
                </div>
              </div>

              {/* Audit Log Table */}
              <div className="bg-white dark:bg-[#0B162C] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-200 dark:border-slate-800">
                  <h3 className="font-display font-bold text-[#0B2A5B] dark:text-white text-base">
                    Live Audit Events
                  </h3>
                </div>

                <div className="overflow-x-auto max-h-[500px]">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#0B2A5B] text-white font-bold uppercase tracking-wider sticky top-0">
                      <tr>
                        <th className="px-4 py-3.5">Timestamp</th>
                        <th className="px-4 py-3.5">Staff Actor</th>
                        <th className="px-4 py-3.5">Action</th>
                        <th className="px-4 py-3.5">Entity</th>
                        <th className="px-4 py-3.5">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                      {auditEvents.map((evt) => (
                        <tr key={evt.id} className="hover:bg-[#F4F7FB] dark:hover:bg-slate-800/60 transition-colors">
                          <td className="px-4 py-3.5 font-mono text-slate-500">
                            {new Date(evt.timestamp || Date.now()).toLocaleString()}
                          </td>
                          <td className="px-4 py-3.5 font-semibold text-[#0B2A5B] dark:text-white">
                            {evt.actorName} ({evt.actorRole})
                          </td>
                          <td className="px-4 py-3.5 font-bold text-[#2563EB]">
                            {evt.action}
                          </td>
                          <td className="px-4 py-3.5 text-slate-600 dark:text-slate-400">
                            {evt.entityType} ({evt.entityId})
                          </td>
                          <td className="px-4 py-3.5 text-slate-500 max-w-xs truncate font-mono text-[11px]">
                            {JSON.stringify(evt.details || {})}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ========================================================= */}
      {/* MODAL DIALOGS */}
      {/* ========================================================= */}

      {/* 1. Register Customer Modal */}
      {modalType === 'register_customer' && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg max-w-lg w-full p-6 space-y-4 shadow-xl border border-slate-200 dark:border-slate-700 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3 border-slate-200 dark:border-slate-700">
              <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">
                Register New Customer
              </h3>
              <button onClick={() => setModalType(null)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleRegisterCustomer} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Full Customer Name *
                </label>
                <input
                  type="text"
                  required
                  value={custName}
                  onChange={(e) => setCustName(e.target.value)}
                  placeholder="e.g. Alaba Johnson Chukwu"
                  className="w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 font-semibold focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Phone Number (Unique Identifier) *
                  </label>
                  <input
                    type="tel"
                    required
                    value={custPhone}
                    onChange={(e) => setCustPhone(e.target.value)}
                    placeholder="+2348012345678"
                    className="w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 font-semibold focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Email Address (Optional)
                  </label>
                  <input
                    type="email"
                    value={custEmail}
                    onChange={(e) => setCustEmail(e.target.value)}
                    placeholder="customer@example.com"
                    className="w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Residential / Business Address *
                </label>
                <input
                  type="text"
                  required
                  value={custAddress}
                  onChange={(e) => setCustAddress(e.target.value)}
                  placeholder="Plot 12, Idumota Market, Lagos Island"
                  className="w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    NIN / BVN Verification (Optional)
                  </label>
                  <input
                    type="text"
                    value={custNIN}
                    onChange={(e) => setCustNIN(e.target.value)}
                    placeholder="22345678901"
                    className="w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Next of Kin Name & Phone
                  </label>
                  <input
                    type="text"
                    value={custNextOfKin}
                    onChange={(e) => setCustNextOfKin(e.target.value)}
                    placeholder="Ngozi Chukwu (+2348098765432)"
                    className="w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setModalType(null)}
                  className="px-4 py-2 border rounded font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold shadow"
                >
                  Confirm & Save Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Record Manual Payment Modal */}
      {modalType === 'record_payment' && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg max-w-lg w-full p-6 space-y-4 shadow-xl border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between border-b pb-3 border-slate-200 dark:border-slate-700">
              <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">
                Record Payment or Contribution
              </h3>
              <button onClick={() => setModalType(null)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleRecordUnifiedPayment} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Select Customer *
                </label>
                <select
                  required
                  value={payCustomerId}
                  onChange={(e) => setPayCustomerId(e.target.value)}
                  className="w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 font-semibold"
                >
                  <option value="">-- Choose Customer --</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.fullName} ({c.phone})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Target Programme *
                  </label>
                  <select
                    value={payProgramme}
                    onChange={(e) => setPayProgramme(e.target.value as any)}
                    className="w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 font-semibold"
                  >
                    <option value="FIXED_TARGET">Fixed Target Savings</option>
                    <option value="DAILY_AJO">Daily Ajo Savings</option>
                    <option value="EVERYHOME_FOOD">Everyhome Food Contribution</option>
                    <option value="LEOCASH">Leocash Savings</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Payment Amount (₦) *
                  </label>
                  <input
                    type="number"
                    required
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    placeholder="10000"
                    className="w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 font-bold text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Payment Method
                </label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value as any)}
                  className="w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 font-semibold"
                >
                  <option value="CASH">Cash Collection (Branch/Field)</option>
                  <option value="BANK_TRANSFER">Bank Direct Transfer</option>
                  <option value="POS">POS Terminal Card Swipe</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Internal Staff Verification Note
                </label>
                <input
                  type="text"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  placeholder="e.g. Verified against physical cash collection register"
                  className="w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setModalType(null)}
                  className="px-4 py-2 border rounded font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold shadow"
                >
                  Record Payment Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Reversal Modal */}
      {reversalPayment && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg max-w-md w-full p-6 space-y-4 shadow-xl border border-rose-300 dark:border-rose-900">
            <div className="flex items-center gap-3 text-rose-600 border-b pb-3 border-slate-200 dark:border-slate-700">
              <ShieldAlert size={24} />
              <div>
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                  Execute Transaction Reversal
                </h3>
                <div className="text-xs text-rose-600 font-semibold">
                  Offsetting adjustment will be created
                </div>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded text-xs space-y-1">
              <div>Ref: <strong className="font-mono">{reversalPayment.reference}</strong></div>
              <div>Customer: <strong>{reversalPayment.customerName}</strong></div>
              <div>Amount: <strong className="text-rose-600">{formatNaira(reversalPayment.amountKobo)}</strong></div>
            </div>

            <form onSubmit={handleExecuteReversal} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Mandatory Reversal Justification *
                </label>
                <textarea
                  required
                  rows={3}
                  value={reversalReason}
                  onChange={(e) => setReversalReason(e.target.value)}
                  placeholder="Explain why this entry is being reversed (e.g. duplicate teller entry, customer returned wrong denomination)..."
                  className="w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setReversalPayment(null)}
                  className="px-4 py-2 border rounded font-bold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded font-bold shadow"
                >
                  Confirm Reversal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Create Fixed Target Modal */}
      {modalType === 'create_fixed_target' && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between border-b pb-3 border-slate-200 dark:border-slate-700">
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                Create Fixed Target Savings Plan
              </h3>
              <button onClick={() => setModalType(null)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateFixedTarget} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Customer *
                </label>
                <select
                  required
                  value={ftpCustomerId}
                  onChange={(e) => setFtpCustomerId(e.target.value)}
                  className="w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 font-semibold"
                >
                  <option value="">-- Choose Customer --</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.fullName} ({c.phone})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Target Amount (₦) *
                </label>
                <input
                  type="number"
                  required
                  value={ftpTargetAmount}
                  onChange={(e) => setFtpTargetAmount(e.target.value)}
                  placeholder="500000"
                  className="w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 font-bold text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Frequency
                  </label>
                  <select
                    value={ftpFrequency}
                    onChange={(e) => setFtpFrequency(e.target.value as any)}
                    className="w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 font-semibold"
                  >
                    <option value="DAILY">Daily</option>
                    <option value="WEEKLY">Weekly</option>
                    <option value="MONTHLY">Monthly</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Duration (Months)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={36}
                    value={ftpDurationMonths}
                    onChange={(e) => setFtpDurationMonths(parseInt(e.target.value) || 6)}
                    className="w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 font-semibold"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalType(null)}
                  className="px-4 py-2 border rounded font-bold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold shadow"
                >
                  Create Plan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Enrol Daily Ajo Modal */}
      {modalType === 'enrol_daily_ajo' && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between border-b pb-3 border-slate-200 dark:border-slate-700">
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                Enrol Customer in Daily Ajo
              </h3>
              <button onClick={() => setModalType(null)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleEnrolDailyAjo} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Customer *
                </label>
                <select
                  required
                  value={ajoCustomerId}
                  onChange={(e) => setAjoCustomerId(e.target.value)}
                  className="w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 font-semibold"
                >
                  <option value="">-- Choose Customer --</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.fullName} ({c.phone})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Daily Contribution Rate (₦) *
                </label>
                <input
                  type="number"
                  required
                  value={ajoDailyRate}
                  onChange={(e) => setAjoDailyRate(e.target.value)}
                  placeholder="2000"
                  className="w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 font-bold text-sm"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalType(null)}
                  className="px-4 py-2 border rounded font-bold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold shadow"
                >
                  Start Cycle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Enrol Everyhome Food Modal */}
      {modalType === 'enrol_food' && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between border-b pb-3 border-slate-200 dark:border-slate-700">
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                Enrol in Everyhome Food Contribution
              </h3>
              <button onClick={() => setModalType(null)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleEnrolFood} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Customer Representative *
                </label>
                <select
                  required
                  value={foodCustomerId}
                  onChange={(e) => setFoodCustomerId(e.target.value)}
                  className="w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 font-semibold"
                >
                  <option value="">-- Choose Customer --</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.fullName} ({c.phone})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Food Package Tier
                </label>
                <select
                  value={foodPackage}
                  onChange={(e) => setFoodPackage(e.target.value as any)}
                  className="w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 font-semibold"
                >
                  <option value="BASIC_HOUSEHOLD">Basic Household (₦45,000)</option>
                  <option value="FAMILY_VALUE">Family Value Package (₦90,000)</option>
                  <option value="MEGA_ENTERPRISE">Mega Enterprise Bulk (₦180,000)</option>
                  <option value="FESTIVE_SPECIAL">Festive Season Family Special (₦250,000)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Household Head Name
                </label>
                <input
                  type="text"
                  value={foodHouseholdHeadName}
                  onChange={(e) => setFoodHouseholdHeadName(e.target.value)}
                  placeholder="e.g. Elder Emmanuel Adeleke"
                  className="w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalType(null)}
                  className="px-4 py-2 border rounded font-bold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded font-bold shadow"
                >
                  Confirm Household Enrolment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. Create Leocash Account Modal */}
      {modalType === 'create_leocash' && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between border-b pb-3 border-slate-200 dark:border-slate-700">
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                Open Leocash Account
              </h3>
              <button onClick={() => setModalType(null)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateLeocash} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Customer *
                </label>
                <select
                  required
                  value={leocashCustomerId}
                  onChange={(e) => setLeocashCustomerId(e.target.value)}
                  className="w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 font-semibold"
                >
                  <option value="">-- Choose Customer --</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.fullName} ({c.phone})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalType(null)}
                  className="px-4 py-2 border rounded font-bold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded font-bold shadow"
                >
                  Issue Leocash Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 8. Loan Application Review Modal */}
      {selectedLoanApp && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between border-b pb-3 border-slate-200 dark:border-slate-700">
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                Credit Committee Decision · {selectedLoanApp.id}
              </h3>
              <button onClick={() => setSelectedLoanApp(null)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded text-xs space-y-1.5">
              <div>Borrower: <strong>{selectedLoanApp.borrowerName}</strong> ({selectedLoanApp.borrowerPhone})</div>
              <div>Requested: <strong className="text-teal-600 font-bold">{formatNaira(selectedLoanApp.requestedAmountKobo)}</strong></div>
              <div>Duration: <strong>{selectedLoanApp.proposedDurationMonths} Months</strong> @ {selectedLoanApp.interestRateMonthlyPercent}% monthly</div>
              <div>Purpose: <strong>{selectedLoanApp.purpose}</strong></div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Approval Conditions / Guarantor Note
                </label>
                <input
                  type="text"
                  value={loanApprovalConditions}
                  onChange={(e) => setLoanApprovalConditions(e.target.value)}
                  placeholder="e.g. 2 viable shop guarantors verified"
                  className="w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => handleReviewLoanApp(selectedLoanApp, 'REJECTED')}
                  className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded font-bold"
                >
                  Reject Loan
                </button>
                <button
                  type="button"
                  onClick={() => handleReviewLoanApp(selectedLoanApp, 'APPROVED')}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold shadow"
                >
                  Approve Application
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 9. Record Loan Repayment Modal */}
      {modalType === 'record_loan_repayment' && selectedLoan && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between border-b pb-3 border-slate-200 dark:border-slate-700">
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                Record Loan Repayment
              </h3>
              <button onClick={() => setModalType(null)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleRecordRepayment} className="space-y-4 text-xs">
              <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded text-xs space-y-1">
                <div>Loan: <strong>{selectedLoan.loanReference}</strong></div>
                <div>Borrower: <strong>{selectedLoan.borrowerName}</strong></div>
                <div>Outstanding: <strong className="text-rose-600 font-bold">{formatNaira(selectedLoan.outstandingBalanceKobo)}</strong></div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Repayment Amount (₦) *
                </label>
                <input
                  type="number"
                  required
                  value={repaymentAmount}
                  onChange={(e) => setRepaymentAmount(e.target.value)}
                  className="w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 font-bold text-sm"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Payment Method
                </label>
                <select
                  value={repaymentMethod}
                  onChange={(e) => setRepaymentMethod(e.target.value as any)}
                  className="w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 font-semibold"
                >
                  <option value="BANK_TRANSFER">Bank Direct Transfer</option>
                  <option value="CASH">Cash Collection</option>
                  <option value="POS">POS Terminal</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalType(null)}
                  className="px-4 py-2 border rounded font-bold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold shadow"
                >
                  Post Repayment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 10. New Loan Application Modal */}
      {modalType === 'create_loan_app' && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between border-b pb-3 border-slate-200 dark:border-slate-700">
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                New Loan Facility Application
              </h3>
              <button onClick={() => setModalType(null)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateLoanApp} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Borrower *
                </label>
                <select
                  required
                  value={loanBorrowerId}
                  onChange={(e) => setLoanBorrowerId(e.target.value)}
                  className="w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 font-semibold"
                >
                  <option value="">-- Choose Customer --</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.fullName} ({c.phone})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Requested Amount (₦) *
                </label>
                <input
                  type="number"
                  required
                  value={loanRequestedAmount}
                  onChange={(e) => setLoanRequestedAmount(e.target.value)}
                  placeholder="500000"
                  className="w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 font-bold text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Duration (Months)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={24}
                    value={loanDurationMonths}
                    onChange={(e) => setLoanDurationMonths(parseInt(e.target.value) || 6)}
                    className="w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 font-semibold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Monthly Rate
                  </label>
                  <input
                    type="text"
                    disabled
                    value={`${config.rates.smeLoanMonthlyRatePercent}% per month`}
                    className="w-full px-3 py-2 rounded border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 font-semibold text-slate-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Business Purpose
                </label>
                <input
                  type="text"
                  value={loanPurpose}
                  onChange={(e) => setLoanPurpose(e.target.value)}
                  placeholder="e.g. Retail stock expansion for festive sales"
                  className="w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalType(null)}
                  className="px-4 py-2 border rounded font-bold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded font-bold shadow"
                >
                  Submit Application
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 11. Customer Profile Drawer / Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg max-w-lg w-full p-6 space-y-4 shadow-xl border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between border-b pb-3 border-slate-200 dark:border-slate-700">
              <div>
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                  {selectedCustomer.fullName}
                </h3>
                <div className="text-xs font-mono text-slate-400">ID: {selectedCustomer.id}</div>
              </div>
              <button onClick={() => setSelectedCustomer(null)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 bg-slate-50 dark:bg-slate-900 p-3 rounded">
                <div>Phone: <strong>{selectedCustomer.phone}</strong></div>
                <div>Email: <strong>{selectedCustomer.email || 'N/A'}</strong></div>
                <div>Registered: <strong>{new Date(selectedCustomer.registrationDate).toLocaleDateString()}</strong></div>
                <div>Status: <strong className="text-emerald-600">{selectedCustomer.status}</strong></div>
              </div>

              <div>
                <div className="font-bold text-slate-700 dark:text-slate-300 mb-1">Residential Address:</div>
                <div className="text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900 p-2 rounded">
                  {selectedCustomer.address}
                </div>
              </div>

              <div>
                <div className="font-bold text-slate-700 dark:text-slate-300 mb-1">Enrolled Programmes:</div>
                <div className="flex flex-wrap gap-1">
                  {selectedCustomer.enrolledProgrammes && selectedCustomer.enrolledProgrammes.length > 0 ? (
                    selectedCustomer.enrolledProgrammes.map((p) => (
                      <span key={p} className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300">
                        {p.replace(/_/g, ' ')}
                      </span>
                    ))
                  ) : (
                    <span className="text-slate-400">None currently enrolled</span>
                  )}
                </div>
              </div>

              <div className="pt-2 border-t flex justify-end">
                <button
                  onClick={() => setSelectedCustomer(null)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 text-slate-800 dark:text-white rounded font-bold"
                >
                  Close Profile
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 12. Add Staff User Modal */}
      {modalType === 'add_staff' && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between border-b pb-3 border-slate-200 dark:border-slate-700">
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                Add Authorised Staff User
              </h3>
              <button onClick={() => setModalType(null)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddStaffUser} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Staff Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={newStaffName}
                  onChange={(e) => setNewStaffName(e.target.value)}
                  placeholder="e.g. Samuel Okafor"
                  className="w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Staff Official Email *
                </label>
                <input
                  type="email"
                  required
                  value={newStaffEmail}
                  onChange={(e) => setNewStaffEmail(e.target.value)}
                  placeholder="s.okafor@teamacro.ng"
                  className="w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={newStaffPhone}
                  onChange={(e) => setNewStaffPhone(e.target.value)}
                  placeholder="+234 803 000 0000"
                  className="w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Assigned Staff Role
                </label>
                <select
                  value={newStaffRole}
                  onChange={(e) => setNewStaffRole(e.target.value as any)}
                  className="w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 font-semibold"
                >
                  <option value="OPERATIONS_MANAGER">Operations Manager</option>
                  <option value="LOAN_OFFICER">Loan Officer</option>
                  <option value="PAYMENT_COLLECTION_OFFICER">Payment Collection Officer</option>
                  <option value="CUSTOMER_REGISTRATION_OFFICER">Customer Registration Officer</option>
                  <option value="ACCOUNTS_OFFICER">Accounts Officer</option>
                  <option value="AUDITOR">Auditor</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalType(null)}
                  className="px-4 py-2 border rounded font-bold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold shadow"
                >
                  Create Staff Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
