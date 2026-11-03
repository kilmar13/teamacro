/**
 * NIBSS Instant Payment (NIP) & Interbank Transfer Provider Adapter
 * 
 * Defines standard interfaces for Nigerian interbank clearing and settlement,
 * account name enquiry, and webhook dispatch.
 * 
 * In development and sandbox modes, provides deterministic simulated name enquiries
 * and status queries while strictly enforcing sandbox disclaimers.
 */

export interface SupportedBank {
  code: string;
  name: string;
  slug: string;
  category: 'COMMERCIAL_BANK' | 'MICROFINANCE_BANK' | 'FINTECH' | 'PAYMENT_SERVICE_BANK';
}

export interface NameEnquiryRequest {
  bankCode: string;
  accountNumber: string;
}

export interface NameEnquiryResponse {
  success: boolean;
  accountNumber: string;
  accountName: string;
  bankCode: string;
  bankName: string;
  bvnMasked?: string;
  sessionID: string;
  responseCode: '00' | '01' | '03' | '99';
  message: string;
}

export interface ExternalTransferInitiationRequest {
  sourceAccountId: string;
  destinationBankCode: string;
  destinationAccountNumber: string;
  destinationAccountName: string;
  amountKobo: number;
  narration: string;
  idempotencyKey: string;
  nameEnquirySessionId?: string;
}

export interface ExternalTransferResponse {
  success: boolean;
  providerReference: string;
  status: 'PENDING' | 'SUCCESSFUL' | 'FAILED' | 'UNDER_REVIEW';
  responseCode: string;
  message: string;
  settlementBatchId: string;
  timestamp: string;
}

export interface SettlementRecord {
  id: string;
  batchId: string;
  clearingCycle: 'CYCLE_1_10AM' | 'CYCLE_2_2PM' | 'CYCLE_3_6PM';
  totalTransactions: number;
  totalInwardKobo: number;
  totalOutwardKobo: number;
  netSettlementKobo: number; // positive = net credit, negative = net debit
  status: 'RECONCILED' | 'PENDING_CONFIRMATION' | 'DISCREPANCY_FLAGGED';
  reconciledAt?: string;
}

// Officially supported Nigerian financial institutions
export const SUPPORTED_BANKS: SupportedBank[] = [
  { code: '057', name: 'Zenith Bank PLC', slug: 'zenith-bank', category: 'COMMERCIAL_BANK' },
  { code: '044', name: 'Access Bank PLC', slug: 'access-bank', category: 'COMMERCIAL_BANK' },
  { code: '058', name: 'Guaranty Trust Bank (GTCO)', slug: 'gtbank', category: 'COMMERCIAL_BANK' },
  { code: '011', name: 'First Bank of Nigeria', slug: 'first-bank', category: 'COMMERCIAL_BANK' },
  { code: '033', name: 'United Bank for Africa (UBA)', slug: 'uba', category: 'COMMERCIAL_BANK' },
  { code: '214', name: 'First City Monument Bank (FCMB)', slug: 'fcmb', category: 'COMMERCIAL_BANK' },
  { code: '032', name: 'Union Bank of Nigeria', slug: 'union-bank', category: 'COMMERCIAL_BANK' },
  { code: '221', name: 'Stanbic IBTC Bank', slug: 'stanbic-ibtc', category: 'COMMERCIAL_BANK' },
  { code: '070', name: 'Fidelity Bank PLC', slug: 'fidelity-bank', category: 'COMMERCIAL_BANK' },
  { code: '232', name: 'Sterling Bank PLC', slug: 'sterling-bank', category: 'COMMERCIAL_BANK' },
  { code: '035', name: 'Wema Bank (ALAT)', slug: 'wema-bank', category: 'COMMERCIAL_BANK' },
  { code: '50211', name: 'Kuda Microfinance Bank', slug: 'kuda-bank', category: 'MICROFINANCE_BANK' },
  { code: '50515', name: 'Moniepoint Microfinance Bank', slug: 'moniepoint-mfb', category: 'MICROFINANCE_BANK' },
  { code: '999991', name: 'OPay Digital Services (Paycom)', slug: 'opay', category: 'FINTECH' },
  { code: '999992', name: 'PalmPay (PSB)', slug: 'palmpay', category: 'PAYMENT_SERVICE_BANK' },
];

/**
 * Realistic Mock Names for Name Enquiry Sandbox simulation
 */
const SAMPLE_RECIPIENT_NAMES: Record<string, string> = {
  '1': 'CHUKWUEMEKA GABRIEL OKAFOR',
  '2': 'OLUWASEUN TEMITOPE BAKARE',
  '3': 'FATIMA BELLO ENTERPRISES',
  '4': 'IBRAHIM ALHAJI YUSUF',
  '5': 'BLESSING ADESUWA ENOMA',
  '6': 'KAYODE & SONS AGRO SERVICES LTD',
  '7': 'CHIDIEBERE ANTHONY NWANKWO',
  '8': 'AISHAT ZAINAB DANJUMA',
  '9': 'TAIWO ADEBAYO LOGISTICS',
  '0': 'DR. EROMOSELE DAVIDSON ENTERPRISE',
};

/**
 * Production-ready Interbank Transfer Provider Adapter interface
 */
export interface INipProviderAdapter {
  isConfigured(): boolean;
  nameEnquiry(request: NameEnquiryRequest): Promise<NameEnquiryResponse>;
  initiateTransfer(request: ExternalTransferInitiationRequest): Promise<ExternalTransferResponse>;
  queryTransactionStatus(providerReference: string): Promise<ExternalTransferResponse>;
}

/**
 * Sandboxed NIP Provider Adapter
 * Adheres strictly to the NIBSS API specifications while safely preventing
 * real financial fund movement without live production payment switch credentials.
 */
export class SandboxNipAdapter implements INipProviderAdapter {
  private isLiveProduction = false;

  public isConfigured(): boolean {
    return this.isLiveProduction;
  }

  public async nameEnquiry(req: NameEnquiryRequest): Promise<NameEnquiryResponse> {
    // Artificial latency to mirror real NIBSS switch round-trip
    await new Promise((r) => setTimeout(r, 600));

    const bank = SUPPORTED_BANKS.find((b) => b.code === req.bankCode);
    if (!bank) {
      return {
        success: false,
        accountNumber: req.accountNumber,
        accountName: '',
        bankCode: req.bankCode,
        bankName: 'Unknown Institution',
        sessionID: '',
        responseCode: '03',
        message: 'Invalid or unsupported destination bank code.',
      };
    }

    if (!/^\d{10}$/.test(req.accountNumber)) {
      return {
        success: false,
        accountNumber: req.accountNumber,
        accountName: '',
        bankCode: req.bankCode,
        bankName: bank.name,
        sessionID: '',
        responseCode: '01',
        message: 'Invalid account number. Nigerian NUBAN must be 10 digits.',
      };
    }

    // Deterministic name lookup based on the last digit of the account number
    const lastDigit = req.accountNumber.slice(-1);
    const resolvedName = SAMPLE_RECIPIENT_NAMES[lastDigit] || 'ADEKUNLE BABATUNDE O.';
    const sessionId = `9990${Date.now()}${Math.floor(Math.random() * 1000)}`;

    return {
      success: true,
      accountNumber: req.accountNumber,
      accountName: resolvedName,
      bankCode: bank.code,
      bankName: bank.name,
      bvnMasked: '222••••901',
      sessionID: sessionId,
      responseCode: '00',
      message: 'Approved or completed successfully',
    };
  }

  public async initiateTransfer(req: ExternalTransferInitiationRequest): Promise<ExternalTransferResponse> {
    await new Promise((r) => setTimeout(r, 800));

    const providerReference = `NIP-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    const settlementBatch = `BATCH-${new Date().toISOString().slice(0, 10)}-01`;

    // Strict validation: amount must be positive
    if (req.amountKobo <= 0) {
      return {
        success: false,
        providerReference,
        status: 'FAILED',
        responseCode: '05',
        message: 'Transaction rejected: Invalid amount minor unit.',
        settlementBatchId: settlementBatch,
        timestamp: new Date().toISOString(),
      };
    }

    return {
      success: true,
      providerReference,
      status: 'SUCCESSFUL',
      responseCode: '00',
      message: 'Transaction successfully processed and routed via NIBSS NIP sandbox gateway.',
      settlementBatchId: settlementBatch,
      timestamp: new Date().toISOString(),
    };
  }

  public async queryTransactionStatus(providerReference: string): Promise<ExternalTransferResponse> {
    await new Promise((r) => setTimeout(r, 400));
    return {
      success: true,
      providerReference,
      status: 'SUCCESSFUL',
      responseCode: '00',
      message: 'Transaction settled on interbank clearing switch.',
      settlementBatchId: `BATCH-${new Date().toISOString().slice(0, 10)}-01`,
      timestamp: new Date().toISOString(),
    };
  }
}

export const nipAdapter = new SandboxNipAdapter();
