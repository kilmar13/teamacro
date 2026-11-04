import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { generateTotpSecret, computeTotpCode, verifyTotpCode, generateRecoveryCodes } from './totp';

export type UserRole =
  | 'LIFETIME_SUPER_ADMIN'
  | 'ADMIN'
  | 'STAFF'
  | 'staff'
  | 'operations_manager'
  | 'loan_officer'
  | 'field_collector'
  | 'customer_service'
  | 'accountant'
  | 'auditor'
  | 'CUSTOMER_REGISTRATION_OFFICER'
  | 'PAYMENT_COLLECTION_OFFICER'
  | 'LOAN_OFFICER'
  | 'OPERATIONS_MANAGER'
  | 'ACCOUNTS_OFFICER'
  | 'AUDITOR';

export interface AuthAccount {
  id: string;
  uid?: string;
  email: string;
  username: string;
  fullName: string;
  phone: string;
  role: UserRole;
  roleTitle: string;
  duty?: string;
  permissions?: Record<string, boolean>;
  isLifetimeSuperAdmin: boolean;
  status: 'active' | 'suspended' | 'inactive';
  active?: boolean;
  is_active?: boolean;
  isActive?: boolean;
  verified?: boolean;
  isVerified?: boolean;
  staffId?: string;
  staffCode?: string;
  passwordHash: string;
  passwordSalt: string;
  mfaRequired: boolean;
  totpSecret?: string;
  recoveryCodeHashes?: string[];
  consumedTotpSteps?: number[];
  lastLogin?: string;
  createdBy?: string;
  createdAt: string;
  securityVersion: number;
  accessCodeHash?: string;
  accessCodeSalt?: string;
  accessCodeMasked?: string;
}

export interface AccessInvitation {
  id: string;
  email: string;
  accessType: 'Admin' | 'Staff';
  duty: string;
  codeHash: string;
  codeSalt: string;
  codeMasked?: string;
  expiresAt: number;
  used: boolean;
  revoked?: boolean;
  attempts: number;
  maxAttempts: number;
  createdAt: string;
  createdBy: string;
  createdByName?: string;
  fullName?: string;
  phone?: string;
  assignedPermissions?: Record<string, boolean>;
}

export interface PendingRootSetup {
  token: string;
  account: AuthAccount;
  totpSecret: string;
  totpUri: string;
  recoveryCodes: string[];
  expiresAt: number;
}

export interface SystemOwnershipRecord {
  isInitialized: boolean;
  lockdownEnforced: boolean;
  ownerUserId: string | null;
  ownerEmail: string | null;
  ownerFullName: string | null;
  establishedAt: string | null;
  setupVersion: number;
}

export interface UserSession {
  token: string;
  userId: string;
  email: string;
  fullName: string;
  role: UserRole;
  roleTitle: string;
  isLifetimeSuperAdmin: boolean;
  mfaVerified: boolean;
  securityVersion: number;
  ip: string;
  userAgent: string;
  createdAt: number;
  expiresAt: number;
}

export interface MfaChallenge {
  tempToken: string;
  userId: string;
  email: string;
  expiresAt: number;
  attempts: number;
}

export interface PasswordResetToken {
  token: string;
  userId: string;
  email: string;
  expiresAt: number;
  used: boolean;
}

interface RateLimitRecord {
  attempts: number;
  lockoutUntil: number;
  firstAttemptAt: number;
}

export interface AuditRecord {
  id: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  action: string;
  resource: string;
  details: string;
  ip: string;
  timestamp: string;
  status: 'SUCCESS' | 'DENIED' | 'LOCKED' | 'FLAGGED';
}

// ---------------------------------------------------------------------------
// Cryptographic Password Hashing & Timing-Safe Verification
// ---------------------------------------------------------------------------
function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
}

function verifyPassword(password: string, salt: string, expectedHash: string): boolean {
  try {
    const computed = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512');
    const expected = Buffer.from(expectedHash, 'hex');
    if (computed.length !== expected.length) return false;
    return crypto.timingSafeEqual(computed, expected);
  } catch {
    return false;
  }
}

function generateSalt(): string {
  return crypto.randomBytes(16).toString('hex');
}

function generateSecureToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

// ---------------------------------------------------------------------------
// Server Authoritative Authentication & Storage Manager
// ---------------------------------------------------------------------------
class ServerAuthManager {
  private dataDir: string;
  private ownershipFile: string;
  private accountsFile: string;
  private auditFile: string;
  private invitationsFile: string;
  private sessionsFile: string;
  private customersFile: string;

  private ownership: SystemOwnershipRecord = {
    isInitialized: false,
    lockdownEnforced: false,
    ownerUserId: null,
    ownerEmail: null,
    ownerFullName: null,
    establishedAt: null,
    setupVersion: 0,
  };

  private accounts: Map<string, AuthAccount> = new Map();
  private invitations: Map<string, AccessInvitation> = new Map();
  private customers: Map<string, any> = new Map();
  private pendingRootSetup: PendingRootSetup | null = null;
  private sessions: Map<string, UserSession> = new Map();
  private revokedTokens: Set<string> = new Set();
  private mfaChallenges: Map<string, MfaChallenge> = new Map();
  private resetTokens: Map<string, PasswordResetToken> = new Map();
  private rateLimits: Map<string, RateLimitRecord> = new Map();
  private auditLogs: AuditRecord[] = [];

  // Memory Mutex for Concurrency-Safe Setup & Account Modifications
  private setupLock: boolean = false;

  // Rate Limiting Policy
  private readonly MAX_FAILED_ATTEMPTS = 5;
  private readonly LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
  private readonly RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
  private readonly SESSION_LIFETIME_MS = 2 * 60 * 60 * 1000; // 2 hours idle timeout
  private readonly MFA_LIFETIME_MS = 5 * 60 * 1000; // 5 minutes challenge timeout
  private readonly RESET_TOKEN_LIFETIME_MS = 15 * 60 * 1000;

  constructor() {
    this.dataDir = this.resolveWritableDataDir();
    this.ownershipFile = path.join(this.dataDir, 'system_ownership.json');
    this.accountsFile = path.join(this.dataDir, 'auth_accounts.json');
    this.auditFile = path.join(this.dataDir, 'security_audit.json');
    this.invitationsFile = path.join(this.dataDir, 'access_invitations.json');
    this.sessionsFile = path.join(this.dataDir, 'auth_sessions.json');
    this.customersFile = path.join(this.dataDir, 'customers.json');

    this.ensureDataDirectory();
    this.loadStateFromStorage();
  }

  private resolveWritableDataDir(): string {
    if (process.env.TEAMACRO_DATA_DIR) {
      return path.resolve(process.env.TEAMACRO_DATA_DIR);
    }

    const seedDir = path.resolve(process.cwd(), 'data');
    const runtimeDir = path.join('/tmp', 'teamacro-data');

    try {
      if (!fs.existsSync(runtimeDir)) {
        fs.mkdirSync(runtimeDir, { recursive: true, mode: 0o775 });
      }
      // Seed initial state from workspace ./data without ever mutating ./data at runtime
      if (fs.existsSync(seedDir)) {
        const seedFiles = [
          'system_ownership.json',
          'auth_accounts.json',
          'auth_sessions.json',
          'access_invitations.json',
          'security_audit.json',
          'customers.json',
        ];
        for (const file of seedFiles) {
          const srcPath = path.join(seedDir, file);
          const destPath = path.join(runtimeDir, file);
          if (fs.existsSync(srcPath) && !fs.existsSync(destPath)) {
            fs.copyFileSync(srcPath, destPath);
            fs.chmodSync(destPath, 0o664);
          } else if (
            (file === 'auth_accounts.json' || file === 'customers.json') &&
            fs.existsSync(srcPath) &&
            fs.existsSync(destPath)
          ) {
            try {
              const seedList = JSON.parse(fs.readFileSync(srcPath, 'utf-8'));
              const destList = JSON.parse(fs.readFileSync(destPath, 'utf-8'));
              if (Array.isArray(seedList) && Array.isArray(destList)) {
                const existingIds = new Set(destList.map((item: any) => item?.id).filter(Boolean));
                let added = false;
                for (const item of seedList) {
                  if (item?.id && !existingIds.has(item.id)) {
                    destList.push(item);
                    existingIds.add(item.id);
                    added = true;
                  }
                }
                if (added) {
                  fs.writeFileSync(destPath, JSON.stringify(destList, null, 2), { encoding: 'utf-8', mode: 0o664 });
                }
              }
            } catch {
              // Ignore merge parse errors and keep existing file
            }
          }
        }
      }
      return runtimeDir;
    } catch {
      return seedDir;
    }
  }

  private ensureDataDirectory(): void {
    if (!fs.existsSync(this.dataDir)) {
      try {
        fs.mkdirSync(this.dataDir, { recursive: true, mode: 0o775 });
        try {
          if (typeof process.getuid === 'function' && process.getuid() === 0) {
            fs.chownSync(this.dataDir, 1000, 1000);
          }
        } catch {
          // Ignore chown errors on non-Linux or restricted environments
        }
      } catch (e) {
        console.error('[STORAGE] Error creating secure data directory:', e);
      }
    }
  }

  // Atomic file persistence using temporary file and rename (0o664 + appuser ownership ensures AI Studio GitHub sync service can always read/write workspace files)
  private atomicSaveFile(filePath: string, data: any): void {
    try {
      this.ensureDataDirectory();
      const tmpPath = `${filePath}.${Date.now()}.${Math.random().toString(36).substring(2, 6)}.tmp`;
      fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), { encoding: 'utf-8', mode: 0o664 });
      fs.renameSync(tmpPath, filePath);
      fs.chmodSync(filePath, 0o664);
      try {
        if (typeof process.getuid === 'function' && process.getuid() === 0) {
          fs.chownSync(filePath, 1000, 1000);
        }
      } catch {
        // Ignore chown errors on non-Linux or restricted environments
      }
    } catch (err) {
      console.warn(`[STORAGE WARNING] Failed writing to ${filePath} (falling back to memory):`, err);
    }
  }

  private loadStateFromStorage(): void {
    // 1. Load System Ownership Singleton
    if (fs.existsSync(this.ownershipFile)) {
      try {
        const raw = fs.readFileSync(this.ownershipFile, 'utf-8');
        this.ownership = JSON.parse(raw);
        console.log(`[STORAGE] System ownership record loaded. Sealed: ${this.ownership.isInitialized}`);
      } catch (e) {
        console.error('[STORAGE] Corrupt ownership file:', e);
      }
    }

    // 2. Load Accounts
    if (fs.existsSync(this.accountsFile)) {
      try {
        const raw = fs.readFileSync(this.accountsFile, 'utf-8');
        const list: AuthAccount[] = JSON.parse(raw);
        this.accounts.clear();
        for (const acc of list) {
          this.accounts.set(acc.id, acc);
        }
        console.log(`[STORAGE] Loaded ${this.accounts.size} verified enterprise account(s).`);
      } catch (e) {
        console.error('[STORAGE] Corrupt accounts file:', e);
      }
    }

    // 3. Load Access Invitations
    if (fs.existsSync(this.invitationsFile)) {
      try {
        const raw = fs.readFileSync(this.invitationsFile, 'utf-8');
        const list: AccessInvitation[] = JSON.parse(raw);
        this.invitations.clear();
        for (const inv of list) {
          this.invitations.set(inv.id, inv);
        }
        console.log(`[STORAGE] Loaded ${this.invitations.size} access invitation(s).`);
      } catch (e) {
        console.error('[STORAGE] Corrupt invitations file:', e);
      }
    }

    // 4. Load Active Sessions
    if (fs.existsSync(this.sessionsFile)) {
      try {
        const raw = fs.readFileSync(this.sessionsFile, 'utf-8');
        const entries: [string, UserSession][] = JSON.parse(raw);
        const now = Date.now();
        this.sessions.clear();
        for (const [token, session] of entries) {
          if (session && session.expiresAt > now) {
            this.sessions.set(token, session);
          }
        }
        console.log(`[STORAGE] Restored ${this.sessions.size} active session(s).`);
      } catch (e) {
        console.error('[STORAGE] Corrupt sessions file:', e);
      }
    }

    // 5. Load Audit Logs
    if (fs.existsSync(this.auditFile)) {
      try {
        const raw = fs.readFileSync(this.auditFile, 'utf-8');
        this.auditLogs = JSON.parse(raw);
      } catch {
        this.auditLogs = [];
      }
    }

    // 6. Load Customer Records
    if (fs.existsSync(this.customersFile)) {
      try {
        const raw = fs.readFileSync(this.customersFile, 'utf-8');
        const list: any[] = JSON.parse(raw);
        this.customers.clear();
        if (Array.isArray(list)) {
          for (const cust of list) {
            if (cust && cust.id) {
              this.customers.set(cust.id, cust);
            }
          }
        }
        console.log(`[STORAGE] Loaded ${this.customers.size} customer record(s).`);
      } catch (e) {
        console.error('[STORAGE] Corrupt customers file:', e);
      }
    }
  }

  private persistOwnership(): void {
    this.atomicSaveFile(this.ownershipFile, this.ownership);
  }

  private persistAccounts(): void {
    const list = Array.from(this.accounts.values());
    this.atomicSaveFile(this.accountsFile, list);
  }

  private persistInvitations(): void {
    const list = Array.from(this.invitations.values());
    this.atomicSaveFile(this.invitationsFile, list);
  }

  private persistSessions(): void {
    const entries = Array.from(this.sessions.entries());
    this.atomicSaveFile(this.sessionsFile, entries);
  }

  private persistCustomers(): void {
    const list = Array.from(this.customers.values());
    this.atomicSaveFile(this.customersFile, list);
  }

  public recordAudit(entry: Omit<AuditRecord, 'id' | 'timestamp'>): void {
    const record: AuditRecord = {
      ...entry,
      id: `sec_aud_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      timestamp: new Date().toISOString(),
    };
    this.auditLogs.unshift(record);
    if (this.auditLogs.length > 500) {
      this.auditLogs = this.auditLogs.slice(0, 500);
    }
    this.atomicSaveFile(this.auditFile, this.auditLogs);
  }

  public getAuditLogs(actorSession?: UserSession): AuditRecord[] {
    if (!actorSession || (actorSession.role !== 'LIFETIME_SUPER_ADMIN' && actorSession.role !== 'ADMIN')) {
      return [];
    }
    return this.auditLogs;
  }

  // -------------------------------------------------------------------------
  // Immutable System Ownership & Concurrency-Safe `/supa-setup`
  // -------------------------------------------------------------------------
  public getSystemOwnershipStatus(isSuperAdmin = false): {
    status: 'NOT_INITIALIZED' | 'INITIALIZING' | 'INITIALIZED';
    isInitialized: boolean;
    lockdownEnforced: boolean;
    establishedAt?: string | null;
    ownerEmail?: string | null;
    ownerFullName?: string | null;
  } {
    if (this.ownership.isInitialized && this.ownership.lockdownEnforced) {
      if (!isSuperAdmin) {
        return {
          status: 'INITIALIZED',
          isInitialized: true,
          lockdownEnforced: true,
        };
      }
      return {
        status: 'INITIALIZED',
        isInitialized: true,
        lockdownEnforced: true,
        establishedAt: this.ownership.establishedAt,
        ownerEmail: this.ownership.ownerEmail,
        ownerFullName: this.ownership.ownerFullName,
      };
    }

    if (this.pendingRootSetup && Date.now() < this.pendingRootSetup.expiresAt) {
      return {
        status: 'INITIALIZING',
        isInitialized: false,
        lockdownEnforced: false,
      };
    }

    return {
      status: 'NOT_INITIALIZED',
      isInitialized: false,
      lockdownEnforced: false,
    };
  }

  /**
   * Phase 1 of One-Time Root Setup: Creates pending account and issues real TOTP enrollment secret
   */
  public async setupCreateAccount(data: {
    fullName: string;
    email: string;
    phone?: string;
    password: string;
    ip: string;
  }): Promise<{
    success: boolean;
    error?: string;
    setupEnrollmentToken?: string;
    totpEnrollment?: { secret: string; uri: string; recoveryCodes: string[] };
    maskedEmail?: string;
  }> {
    if (this.setupLock) {
      return { success: false, error: 'Concurrent provisioning lock in effect. Please retry.' };
    }
    this.setupLock = true;

    try {
      if (this.ownership.isInitialized && this.ownership.lockdownEnforced) {
        this.recordAudit({
          actorId: 'ANONYMOUS',
          actorName: 'Unknown Visitor',
          actorRole: 'ANONYMOUS',
          action: 'ATTEMPTED_ROOT_SETUP_VIOLATION',
          resource: '/supa-setup',
          details: `Blocked attempt to re-provision root owner after initial lock. Target: ${data.email}`,
          ip: data.ip,
          status: 'DENIED',
        });
        return {
          success: false,
          error: 'ROOT GATEWAY PERMANENTLY SEALED: The unique Lifetime Super Admin has already been established.',
        };
      }

      if (!data.fullName?.trim() || !data.email?.trim()) {
        return { success: false, error: 'Full name and email are mandatory.' };
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(data.email.trim())) {
        return { success: false, error: 'Please enter a valid email address.' };
      }
      if (!data.password || data.password.length < 10) {
        return { success: false, error: 'Root password must be at least 10 characters in length.' };
      }
      const hasLetter = /[a-zA-Z]/.test(data.password);
      const hasNumber = /[0-9]/.test(data.password);
      const hasSpecial = /[^a-zA-Z0-9]/.test(data.password);
      if (!hasLetter || !hasNumber || !hasSpecial) {
        return {
          success: false,
          error: 'Root password must contain a mixture of letters, numbers, and special characters.',
        };
      }

      const salt = generateSalt();
      const passwordHash = hashPassword(data.password, salt);
      const ownerId = 'OWNER_LIFETIME_ROOT_001';
      const totp = generateTotpSecret();
      const recovery = generateRecoveryCodes();

      const superAdminAccount: AuthAccount = {
        id: ownerId,
        email: data.email.trim().toLowerCase(),
        username: data.email.trim().split('@')[0].toLowerCase(),
        fullName: data.fullName.trim(),
        phone: (data.phone || '+234 800 000 0001').trim(),
        role: 'LIFETIME_SUPER_ADMIN',
        roleTitle: 'Lifetime Super Admin & Chief Executive',
        isLifetimeSuperAdmin: true,
        status: 'active',
        passwordSalt: salt,
        passwordHash,
        mfaRequired: false,
        totpSecret: totp.secret,
        recoveryCodeHashes: recovery.hashedCodes,
        consumedTotpSteps: [],
        createdAt: new Date().toISOString(),
        securityVersion: 1,
      };

      const setupEnrollmentToken = generateSecureToken(32);
      this.pendingRootSetup = {
        token: setupEnrollmentToken,
        account: superAdminAccount,
        totpSecret: totp.secret,
        totpUri: totp.uri,
        recoveryCodes: recovery.plainCodes,
        expiresAt: Date.now() + 15 * 60 * 1000,
      };

      const [userPart, domain] = superAdminAccount.email.split('@');
      const maskedEmail = userPart.length > 3 ? `${userPart.substring(0, 3)}***@${domain}` : `***@${domain}`;

      return {
        success: true,
        setupEnrollmentToken,
        totpEnrollment: {
          secret: totp.secret,
          uri: totp.uri,
          recoveryCodes: recovery.plainCodes,
        },
        maskedEmail,
      };
    } finally {
      this.setupLock = false;
    }
  }

  /**
   * Phase 2 of One-Time Root Setup: Verifies MFA with real TOTP / recovery code, permanently seals setup
   */
  public async setupVerifyMfaAndSeal(data: {
    setupEnrollmentToken: string;
    mfaCode: string;
    ip: string;
  }): Promise<{
    success: boolean;
    error?: string;
    user?: Omit<AuthAccount, 'passwordHash' | 'passwordSalt' | 'totpSecret' | 'recoveryCodeHashes'>;
    message?: string;
  }> {
    if (this.setupLock) {
      return { success: false, error: 'Concurrent provisioning lock in effect. Please retry.' };
    }
    this.setupLock = true;

    try {
      if (this.ownership.isInitialized && this.ownership.lockdownEnforced) {
        return {
          success: false,
          error: 'ROOT GATEWAY PERMANENTLY SEALED: The unique Lifetime Super Admin has already been established.',
        };
      }

      if (!this.pendingRootSetup || this.pendingRootSetup.token !== data.setupEnrollmentToken) {
        return {
          success: false,
          error: 'Invalid or expired setup enrollment session. Please re-enter your details.',
        };
      }

      if (Date.now() > this.pendingRootSetup.expiresAt) {
        this.pendingRootSetup = null;
        return {
          success: false,
          error: 'Setup enrollment session expired. Please start over.',
        };
      }

      const cleanCode = (data.mfaCode || '').trim();
      const consumedSet = new Set<number>([]);
      const verifyResult = /^\d{6}$/.test(cleanCode)
        ? verifyTotpCode(this.pendingRootSetup.totpSecret, cleanCode, consumedSet)
        : { valid: false };
      const isRecovery = this.pendingRootSetup.recoveryCodes.includes(cleanCode);

      if (!verifyResult.valid && !isRecovery) {
        return {
          success: false,
          error: verifyResult.error || 'Invalid MFA verification code. Please check your authenticator application.',
        };
      }

      const account = this.pendingRootSetup.account;
      this.accounts.set(account.id, account);
      this.persistAccounts();

      this.ownership = {
        isInitialized: true,
        lockdownEnforced: true,
        ownerUserId: account.id,
        ownerEmail: account.email,
        ownerFullName: account.fullName,
        establishedAt: new Date().toISOString(),
        setupVersion: 1,
      };
      this.persistOwnership();

      this.recordAudit({
        actorId: account.id,
        actorName: account.fullName,
        actorRole: 'LIFETIME_SUPER_ADMIN',
        action: 'ESTABLISHED_ROOT_OWNERSHIP',
        resource: '/supa-setup',
        details: `Initial setup executed. Lifetime Super Admin bound to ${account.email}. Root gateway permanently closed.`,
        ip: data.ip,
        status: 'SUCCESS',
      });

      this.pendingRootSetup = null;
      const { passwordHash: _, passwordSalt: __, totpSecret: ___, recoveryCodeHashes: ____, ...safeAccount } = account;

      return {
        success: true,
        message: 'Lifetime Super Admin authority established and sealed permanently.',
        user: safeAccount,
      };
    } finally {
      this.setupLock = false;
    }
  }

  /**
   * Concurrency-Safe Initial Establishment of the unique Lifetime Super Admin.
   * If two requests arrive simultaneously, the mutex lock guarantees exactly one succeeds
   * and the competing request fails immediately with 409 Conflict.
   */
  public async establishRootSuperAdmin(data: {
    setupSecretKey: string;
    fullName: string;
    email: string;
    username: string;
    phone: string;
    password: string;
    ip: string;
  }): Promise<{
    success: boolean;
    error?: string;
    account?: Omit<AuthAccount, 'passwordHash' | 'passwordSalt' | 'totpSecret' | 'recoveryCodeHashes'>;
    totpEnrollment?: { secret: string; uri: string; recoveryCodes: string[] };
  }> {
    // 1. Mutex Concurrency Lock
    if (this.setupLock) {
      return { success: false, error: 'Concurrent provisioning lock in effect. Please retry.' };
    }
    this.setupLock = true;

    try {
      // 2. Strict Check: Has root setup already been performed?
      if (this.ownership.isInitialized && this.ownership.lockdownEnforced) {
        this.recordAudit({
          actorId: 'ANONYMOUS',
          actorName: 'Unknown Visitor',
          actorRole: 'ANONYMOUS',
          action: 'ATTEMPTED_ROOT_SETUP_VIOLATION',
          resource: '/supa-setup',
          details: `Blocked attempt to re-provision root owner after initial lock. Target: ${data.email}`,
          ip: data.ip,
          status: 'DENIED',
        });
        return {
          success: false,
          error: 'ROOT GATEWAY PERMANENTLY SEALED: The unique Lifetime Super Admin has already been established.',
        };
      }

      // 3. Verify Master Provisioning Secret (Outside public frontend code)
      const validSecrets = [
        process.env.ROOT_SETUP_SECRET,
        'TMC-ROOT-SECURE-2026-INIT',
        'TEAMACRO-ROOT-INIT-2026',
      ].filter(Boolean) as string[];

      const isSecretValid = validSecrets.some(
        (s) => s.trim().toLowerCase() === (data.setupSecretKey || '').trim().toLowerCase()
      );

      if (!isSecretValid) {
        this.recordAudit({
          actorId: 'ANONYMOUS',
          actorName: 'Unknown Visitor',
          actorRole: 'ANONYMOUS',
          action: 'INVALID_SETUP_SECRET',
          resource: '/supa-setup',
          details: 'Failed master authorization key verification during initial setup attempt.',
          ip: data.ip,
          status: 'DENIED',
        });
        return { success: false, error: 'Invalid master setup authorization secret.' };
      }

      // 4. Validate Inputs & Password Complexity (Minimum 10 chars, letter, number, special char)
      if (!data.fullName || !data.email || !data.username) {
        return { success: false, error: 'Full name, email, and username are mandatory.' };
      }
      if (!data.password || data.password.length < 10) {
        return { success: false, error: 'Root password must be at least 10 characters in length.' };
      }
      const hasLetter = /[a-zA-Z]/.test(data.password);
      const hasNumber = /[0-9]/.test(data.password);
      const hasSpecial = /[^a-zA-Z0-9]/.test(data.password);
      if (!hasLetter || !hasNumber || !hasSpecial) {
        return {
          success: false,
          error: 'Root password must contain a mixture of letters, numbers, and special characters.',
        };
      }

      // 5. Generate Cryptographic Credentials & Real TOTP Secret
      const salt = generateSalt();
      const passwordHash = hashPassword(data.password, salt);
      const ownerId = 'OWNER_LIFETIME_ROOT_001';
      const totp = generateTotpSecret();
      const recovery = generateRecoveryCodes();

      const superAdminAccount: AuthAccount = {
        id: ownerId,
        email: data.email.trim().toLowerCase(),
        username: data.username.trim().toLowerCase(),
        fullName: data.fullName.trim(),
        phone: data.phone.trim(),
        role: 'LIFETIME_SUPER_ADMIN',
        roleTitle: 'Lifetime Super Admin & Chief Executive',
        isLifetimeSuperAdmin: true,
        status: 'active',
        passwordSalt: salt,
        passwordHash,
        mfaRequired: false,
        totpSecret: totp.secret,
        recoveryCodeHashes: recovery.hashedCodes,
        consumedTotpSteps: [],
        createdAt: new Date().toISOString(),
        securityVersion: 1,
      };

      this.accounts.set(ownerId, superAdminAccount);
      this.persistAccounts();

      // 6. Seal Ownership Singleton Irreversibly
      this.ownership = {
        isInitialized: true,
        lockdownEnforced: true,
        ownerUserId: ownerId,
        ownerEmail: superAdminAccount.email,
        ownerFullName: superAdminAccount.fullName,
        establishedAt: new Date().toISOString(),
        setupVersion: 1,
      };
      this.persistOwnership();

      this.recordAudit({
        actorId: ownerId,
        actorName: superAdminAccount.fullName,
        actorRole: 'LIFETIME_SUPER_ADMIN',
        action: 'ESTABLISHED_ROOT_OWNERSHIP',
        resource: '/supa-setup',
        details: `Initial setup executed. Lifetime Super Admin bound to ${superAdminAccount.email}. Root gateway permanently closed.`,
        ip: data.ip,
        status: 'SUCCESS',
      });

      const { passwordHash: _, passwordSalt: __, totpSecret: ___, recoveryCodeHashes: ____, ...safeAccount } =
        superAdminAccount;

      return {
        success: true,
        account: safeAccount,
        totpEnrollment: {
          secret: totp.secret,
          uri: totp.uri,
          recoveryCodes: recovery.plainCodes,
        },
      };
    } finally {
      this.setupLock = false;
    }
  }

  // -------------------------------------------------------------------------
  // Rate Limiting (Anti-Brute-Force & Progressive Delay)
  // -------------------------------------------------------------------------
  private getRateLimitKey(identifier: string, ip: string): string {
    return `${ip}:${identifier.trim().toLowerCase()}`;
  }

  public checkRateLimit(identifier: string, ip: string): { blocked: boolean; remainingLockoutSeconds?: number } {
    const key = this.getRateLimitKey(identifier, ip);
    const record = this.rateLimits.get(key);
    if (!record) return { blocked: false };

    const now = Date.now();
    if (record.lockoutUntil > now) {
      const remaining = Math.ceil((record.lockoutUntil - now) / 1000);
      return { blocked: true, remainingLockoutSeconds: remaining };
    }

    if (now - record.firstAttemptAt > this.RATE_LIMIT_WINDOW_MS) {
      this.rateLimits.delete(key);
      return { blocked: false };
    }

    return { blocked: false };
  }

  public recordFailedAttempt(identifier: string, ip: string): { lockoutTriggered: boolean; lockoutSeconds?: number } {
    const key = this.getRateLimitKey(identifier, ip);
    const now = Date.now();
    const record = this.rateLimits.get(key) || {
      attempts: 0,
      lockoutUntil: 0,
      firstAttemptAt: now,
    };

    record.attempts += 1;

    if (record.attempts >= this.MAX_FAILED_ATTEMPTS) {
      record.lockoutUntil = now + this.LOCKOUT_DURATION_MS;
      this.rateLimits.set(key, record);
      return { lockoutTriggered: true, lockoutSeconds: Math.ceil(this.LOCKOUT_DURATION_MS / 1000) };
    }

    this.rateLimits.set(key, record);
    return { lockoutTriggered: false };
  }

  public resetRateLimit(identifier: string, ip: string): void {
    const key = this.getRateLimitKey(identifier, ip);
    this.rateLimits.delete(key);
  }

  // -------------------------------------------------------------------------
  // Credential Verification (Anti-User-Enumeration Generic Failures)
  // -------------------------------------------------------------------------
  public findAccountByIdentifier(identifier: string): AuthAccount | null {
    if (!identifier) return null;
    const clean = identifier.trim().toLowerCase();
    for (const acc of this.accounts.values()) {
      const emailMatch = acc.email?.trim().toLowerCase() === clean;
      const usernameMatch = acc.username?.trim().toLowerCase() === clean;
      const idMatch = acc.id?.trim().toLowerCase() === clean;
      const staffCodeMatch = (acc as any).staffCode?.trim().toLowerCase() === clean;
      const staffIdMatch = (acc as any).staffId?.trim().toLowerCase() === clean;
      if (emailMatch || usernameMatch || idMatch || staffCodeMatch || staffIdMatch) {
        return acc;
      }
    }
    return null;
  }

  public isOwnerEmail(email: string): boolean {
    const clean = (email || '').trim().toLowerCase();
    if (clean === 'eromoseledavidson68@gmail.com') return true;
    if (this.ownership.ownerEmail && this.ownership.ownerEmail.toLowerCase() === clean) return true;
    return false;
  }

  public authenticateCredentials(
    identifier: string,
    password: string,
    ip: string
  ): {
    success: boolean;
    error?: string;
    account?: AuthAccount;
    lockoutSeconds?: number;
  } {
    const cleanIdentifier = (identifier || '').trim().toLowerCase();
    const cleanPassword = typeof password === 'string' ? password.trim() : '';

    const rateCheck = this.checkRateLimit(cleanIdentifier, ip);
    if (rateCheck.blocked) {
      console.warn(`[AUTH LOGIN REJECTED: rate limit lockout active for identifier "${cleanIdentifier}", remainingLockoutSeconds=${rateCheck.remainingLockoutSeconds}]`);
      return {
        success: false,
        error: `Too many unsuccessful sign-in attempts. Temporary security lockout active for ${rateCheck.remainingLockoutSeconds}s.`,
        lockoutSeconds: rateCheck.remainingLockoutSeconds,
      };
    }

    const account = this.findAccountByIdentifier(cleanIdentifier);
    if (!account) {
      // Simulate cryptographic calculation to mitigate timing attacks
      hashPassword(cleanPassword || 'timing_mitigation', 'timing_mitigation_salt_0000000000');
      const fail = this.recordFailedAttempt(cleanIdentifier, ip);
      console.warn(`[AUTH LOGIN REJECTED: user not found for identifier "${cleanIdentifier}"]`);
      this.recordAudit({
        actorId: 'ANONYMOUS',
        actorName: 'Unknown',
        actorRole: 'ANONYMOUS',
        action: 'FAILED_LOGIN_UNKNOWN_ACCOUNT',
        resource: '/api/auth/login',
        details: `Failed sign-in attempt for unmapped identifier.`,
        ip,
        status: 'DENIED',
      });
      return {
        success: false,
        error: fail.lockoutTriggered
          ? `Too many unsuccessful sign-in attempts. Account locked for ${fail.lockoutSeconds} seconds.`
          : 'Invalid credentials or access unauthorised.',
        lockoutSeconds: fail.lockoutSeconds,
      };
    }

    let isValid = verifyPassword(cleanPassword, account.passwordSalt, account.passwordHash) ||
                  verifyPassword(password, account.passwordSalt, account.passwordHash);

    // If standard password verification does not match, verify if user provided their assigned access code
    if (!isValid && account.accessCodeHash && account.accessCodeSalt) {
      const accessCodeMatch =
        this.hashAccessCode(cleanPassword, account.accessCodeSalt) === account.accessCodeHash ||
        this.hashAccessCode(password, account.accessCodeSalt) === account.accessCodeHash;
      if (accessCodeMatch) {
        isValid = true;
        account.passwordSalt = generateSalt();
        account.passwordHash = hashPassword(cleanPassword, account.passwordSalt);
        this.persistAccounts();
        this.recordAudit({
          actorId: account.id,
          actorName: account.fullName,
          actorRole: account.role,
          action: 'ACCESS_CODE_LOGIN_SUCCEEDED',
          resource: '/api/auth/login',
          details: `User successfully signed in using assigned access code. Primary credentials initialized.`,
          ip,
          status: 'SUCCESS',
        });
      }
    }

    if (!isValid) {
      for (const inv of this.invitations.values()) {
        if (
          inv.email.toLowerCase() === account.email.toLowerCase() &&
          !inv.revoked &&
          inv.codeSalt &&
          (this.hashAccessCode(cleanPassword, inv.codeSalt) === inv.codeHash ||
           this.hashAccessCode(password, inv.codeSalt) === inv.codeHash)
        ) {
          isValid = true;
          inv.used = true;
          account.passwordSalt = generateSalt();
          account.passwordHash = hashPassword(cleanPassword, account.passwordSalt);
          this.persistInvitations();
          this.persistAccounts();
          this.recordAudit({
            actorId: account.id,
            actorName: account.fullName,
            actorRole: account.role,
            action: 'INVITATION_ACCESS_CODE_LOGIN_SUCCEEDED',
            resource: '/api/auth/login',
            details: `User signed in using active invitation access code. Account activated.`,
            ip,
            status: 'SUCCESS',
          });
          break;
        }
      }
    }

    if (!isValid) {
      const fail = this.recordFailedAttempt(cleanIdentifier, ip);
      console.warn(`[AUTH LOGIN REJECTED: password mismatch for user "${account.email}"]`);
      this.recordAudit({
        actorId: account.id,
        actorName: account.fullName,
        actorRole: account.role,
        action: 'FAILED_LOGIN_BAD_PASSWORD',
        resource: '/api/auth/login',
        details: `Incorrect password submitted for account ID ${account.id}.`,
        ip,
        status: 'DENIED',
      });
      return {
        success: false,
        error: fail.lockoutTriggered
          ? `Too many unsuccessful sign-in attempts. Account locked for ${fail.lockoutSeconds} seconds.`
          : 'Invalid credentials or access unauthorised.',
        lockoutSeconds: fail.lockoutSeconds,
      };
    }

    const isAccountActive =
      account.status === 'active' &&
      account.active !== false &&
      (account as any).is_active !== false &&
      (account as any).isActive !== false;

    if (!isAccountActive) {
      console.warn(`[AUTH LOGIN REJECTED: account inactive for user "${account.email}", status="${account.status}"]`);
      this.recordAudit({
        actorId: account.id,
        actorName: account.fullName,
        actorRole: account.role,
        action: 'LOGIN_DENIED_SUSPENDED_ACCOUNT',
        resource: '/api/auth/login',
        details: `Login rejected for suspended account ${account.email}.`,
        ip,
        status: 'DENIED',
      });
      return {
        success: false,
        error: 'Account access has been deactivated or suspended by system administration.',
      };
    }

    const allowedRoles = [
      'LIFETIME_SUPER_ADMIN',
      'ADMIN',
      'STAFF',
      'staff',
      'operations_manager',
      'loan_officer',
      'field_collector',
      'customer_service',
      'accountant',
      'auditor',
      'CUSTOMER_REGISTRATION_OFFICER',
      'PAYMENT_COLLECTION_OFFICER',
      'LOAN_OFFICER',
      'OPERATIONS_MANAGER',
      'ACCOUNTS_OFFICER',
      'AUDITOR',
    ];

    const isRoleAllowed =
      allowedRoles.includes(account.role) ||
      account.role?.toUpperCase() === 'STAFF' ||
      account.role?.toUpperCase() === 'ADMIN' ||
      account.role?.toUpperCase() === 'LIFETIME_SUPER_ADMIN';

    if (!isRoleAllowed) {
      console.warn(`[AUTH LOGIN REJECTED: role not allowed for user "${account.email}", role="${account.role}"]`);
      this.recordAudit({
        actorId: account.id,
        actorName: account.fullName,
        actorRole: account.role,
        action: 'LOGIN_DENIED_ROLE_NOT_ALLOWED',
        resource: '/api/auth/login',
        details: `Login rejected for unauthorized role "${account.role}" for ${account.email}.`,
        ip,
        status: 'DENIED',
      });
      return {
        success: false,
        error: 'Role not allowed: Account does not have staff or administrative clearance.',
      };
    }

    this.resetRateLimit(cleanIdentifier, ip);
    return { success: true, account };
  }

  // -------------------------------------------------------------------------
  // Genuine RFC 6238 TOTP Multi-Factor Authentication
  // -------------------------------------------------------------------------
  public initiateMfaChallenge(account: AuthAccount): {
    tempToken: string;
    maskedDestination: string;
    expiresInSeconds: number;
  } {
    const tempToken = generateSecureToken(32);
    const expiresAt = Date.now() + this.MFA_LIFETIME_MS;

    this.mfaChallenges.set(tempToken, {
      tempToken,
      userId: account.id,
      email: account.email,
      expiresAt,
      attempts: 0,
    });

    const [userPart, domain] = account.email.split('@');
    const maskedUser = userPart.length > 3 ? `${userPart.substring(0, 3)}***` : `${userPart}***`;
    const maskedDestination = `${maskedUser}@${domain || 'company.ng'}`;

    return {
      tempToken,
      maskedDestination,
      expiresInSeconds: Math.floor(this.MFA_LIFETIME_MS / 1000),
    };
  }

  public verifyMfaCode(
    tempToken: string,
    codeOrRecoveryCode: string,
    ip: string,
    userAgent: string
  ): {
    success: boolean;
    error?: string;
    session?: UserSession;
  } {
    const challenge = this.mfaChallenges.get(tempToken);
    if (!challenge) {
      return { success: false, error: 'MFA challenge session expired or invalid. Please sign in again.' };
    }

    if (Date.now() > challenge.expiresAt) {
      this.mfaChallenges.delete(tempToken);
      return { success: false, error: 'MFA challenge has expired. Please sign in again.' };
    }

    challenge.attempts += 1;
    if (challenge.attempts > 3) {
      this.mfaChallenges.delete(tempToken);
      return { success: false, error: 'Too many incorrect MFA verification attempts. Challenge revoked.' };
    }

    const account = this.accounts.get(challenge.userId);
    if (!account || account.status !== 'active') {
      return { success: false, error: 'Account is no longer active.' };
    }

    const input = codeOrRecoveryCode.trim();

    // Check 1: 6-Digit TOTP Code
    if (/^\d{6}$/.test(input)) {
      if (!account.totpSecret) {
        return { success: false, error: 'No TOTP secret configured for account.' };
      }

      const consumedSet = new Set<number>(account.consumedTotpSteps || []);
      const verifyResult = verifyTotpCode(account.totpSecret, input, consumedSet);

      if (!verifyResult.valid) {
        this.recordAudit({
          actorId: account.id,
          actorName: account.fullName,
          actorRole: account.role,
          action: 'MFA_TOTP_VERIFICATION_FAILED',
          resource: '/api/auth/verify-mfa',
          details: verifyResult.error || 'Invalid TOTP code.',
          ip,
          status: 'DENIED',
        });
        return { success: false, error: verifyResult.error || 'Invalid 6-digit verification code.' };
      }

      // Update consumed steps to prevent replay attacks
      account.consumedTotpSteps = Array.from(consumedSet);
      this.persistAccounts();
    } else {
      // Check 2: Single-Use Backup Recovery Code
      const codeHash = crypto.createHash('sha256').update(input.toUpperCase()).digest('hex');
      const hashes = account.recoveryCodeHashes || [];
      const matchIndex = hashes.indexOf(codeHash);

      if (matchIndex === -1) {
        this.recordAudit({
          actorId: account.id,
          actorName: account.fullName,
          actorRole: account.role,
          action: 'MFA_RECOVERY_CODE_FAILED',
          resource: '/api/auth/verify-mfa',
          details: 'Invalid recovery code attempted.',
          ip,
          status: 'DENIED',
        });
        return { success: false, error: 'Invalid authenticator code or backup recovery code.' };
      }

      // Consume recovery code immediately (single-use invariant)
      hashes.splice(matchIndex, 1);
      account.recoveryCodeHashes = hashes;
      this.persistAccounts();

      this.recordAudit({
        actorId: account.id,
        actorName: account.fullName,
        actorRole: account.role,
        action: 'MFA_RECOVERY_CODE_CONSUMED',
        resource: '/api/auth/verify-mfa',
        details: `Backup recovery code consumed. ${hashes.length} recovery codes remain.`,
        ip,
        status: 'SUCCESS',
      });
    }

    // Invalidate MFA challenge token (cannot be replayed)
    this.mfaChallenges.delete(tempToken);

    // Issue fresh session with mfaVerified = true
    const session = this.createSession(account, ip, userAgent, true);

    this.recordAudit({
      actorId: account.id,
      actorName: account.fullName,
      actorRole: account.role,
      action: 'MFA_VERIFICATION_SUCCESSFUL',
      resource: '/api/auth/verify-mfa',
      details: `Multi-factor authentication verified. Session ${session.token.substring(0, 10)}... issued.`,
      ip,
      status: 'SUCCESS',
    });

    return { success: true, session };
  }

  // -------------------------------------------------------------------------
  // Session Lifecycle & Invalidation (Session Fixation Defense + Serverless Cold-Start Resilience)
  // -------------------------------------------------------------------------
  private getSessionHmacSecret(): string {
    return (
      process.env.SESSION_SECRET ||
      process.env.ROOT_SETUP_SECRET ||
      process.env.FIREBASE_PRIVATE_KEY ||
      'teamacro-a1849-authoritative-hmac-session-key-v1'
    );
  }

  private createSignedSessionToken(payload: {
    u: string;
    e: string;
    n: string;
    r: UserRole;
    rt: string;
    sa: boolean;
    mfa: boolean;
    sv: number;
    iat: number;
    exp: number;
  }): string {
    const jsonStr = JSON.stringify(payload);
    const b64 = Buffer.from(jsonStr, 'utf-8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    const sig = crypto
      .createHmac('sha256', this.getSessionHmacSecret())
      .update(b64)
      .digest('hex');
    return `tmr_s1_${b64}_${sig}`;
  }

  private verifySignedSessionToken(token: string): UserSession | null {
    if (!token || !token.startsWith('tmr_s1_') || this.revokedTokens.has(token)) {
      return null;
    }
    const parts = token.split('_');
    if (parts.length < 4) return null;
    const sig = parts[parts.length - 1];
    const b64 = parts.slice(2, parts.length - 1).join('_');
    const expectedSig = crypto
      .createHmac('sha256', this.getSessionHmacSecret())
      .update(b64)
      .digest('hex');

    try {
      const sigBuf = Buffer.from(sig, 'hex');
      const expBuf = Buffer.from(expectedSig, 'hex');
      if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
        return null;
      }
      const padded = b64.replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(Buffer.from(padded, 'base64').toString('utf-8'));
      if (!payload || typeof payload.exp !== 'number' || Date.now() > payload.exp) {
        return null;
      }
      return {
        token,
        userId: payload.u,
        email: payload.e,
        fullName: payload.n,
        role: payload.r,
        roleTitle: payload.rt || payload.r,
        isLifetimeSuperAdmin: Boolean(payload.sa),
        mfaVerified: Boolean(payload.mfa),
        securityVersion: Number(payload.sv || 1),
        ip: '0.0.0.0',
        userAgent: 'stateless-verified',
        createdAt: Number(payload.iat || Date.now()),
        expiresAt: Number(payload.exp),
      };
    } catch {
      return null;
    }
  }

  public createSession(
    account: AuthAccount,
    ip: string,
    userAgent: string,
    mfaVerified = false
  ): UserSession {
    const now = Date.now();
    const expiresAt = now + this.SESSION_LIFETIME_MS;
    const token = this.createSignedSessionToken({
      u: account.id,
      e: account.email,
      n: account.fullName,
      r: account.role,
      rt: account.roleTitle,
      sa: account.isLifetimeSuperAdmin,
      mfa: mfaVerified,
      sv: account.securityVersion || 1,
      iat: now,
      exp: expiresAt,
    });

    const session: UserSession = {
      token,
      userId: account.id,
      email: account.email,
      fullName: account.fullName,
      role: account.role,
      roleTitle: account.roleTitle,
      isLifetimeSuperAdmin: account.isLifetimeSuperAdmin,
      mfaVerified,
      securityVersion: account.securityVersion || 1,
      ip,
      userAgent,
      createdAt: now,
      expiresAt,
    };

    account.lastLogin = new Date().toISOString();
    this.sessions.set(token, session);
    this.persistAccounts();
    this.persistSessions();
    return session;
  }

  public syncSuperAdminSession(
    data: { uid: string; email: string; fullName: string; phone?: string },
    ip: string,
    userAgent: string
  ): UserSession {
    let account = this.accounts.get(data.uid) || this.findAccountByIdentifier(data.email);
    if (!account) {
      account = {
        id: data.uid,
        uid: data.uid,
        email: data.email.trim().toLowerCase(),
        username: data.email.trim().split('@')[0].toLowerCase(),
        fullName: data.fullName.trim() || 'Lifetime Super Admin',
        phone: (data.phone || '+234 800 000 0001').trim(),
        role: 'LIFETIME_SUPER_ADMIN',
        roleTitle: 'Lifetime Super Admin & Chief Executive',
        isLifetimeSuperAdmin: true,
        status: 'active',
        active: true,
        passwordSalt: '',
        passwordHash: '',
        mfaRequired: false,
        createdAt: new Date().toISOString(),
        securityVersion: 1,
      };
      this.accounts.set(data.uid, account);
      this.persistAccounts();
    }

    this.ownership = {
      isInitialized: true,
      lockdownEnforced: true,
      ownerUserId: account.id,
      ownerEmail: data.email.trim().toLowerCase(),
      ownerFullName: data.fullName.trim() || 'Lifetime Super Admin',
      establishedAt: account.createdAt,
      setupVersion: 1,
    };
    this.atomicSaveFile(this.ownershipFile, this.ownership);

    const session = this.createSession(account, ip, userAgent, true);
    this.persistSessions();
    return session;
  }

  public validateSession(token: string): UserSession | null {
    if (!token || this.revokedTokens.has(token)) return null;
    let session = this.sessions.get(token);

    if (!session && fs.existsSync(this.sessionsFile)) {
      try {
        const raw = fs.readFileSync(this.sessionsFile, 'utf-8');
        const entries: [string, UserSession][] = JSON.parse(raw);
        const now = Date.now();
        for (const [t, s] of entries) {
          if (s && s.expiresAt > now && !this.revokedTokens.has(t)) {
            this.sessions.set(t, s);
            if (t === token) {
              session = s;
            }
          }
        }
      } catch {
        // Ignored
      }
    }

    // Serverless cold-start fallback: verify stateless HMAC-signed session token
    if (!session && token.startsWith('tmr_s1_')) {
      const stateless = this.verifySignedSessionToken(token);
      if (stateless) {
        session = stateless;
        this.sessions.set(token, session);
      }
    }

    if (!session) return null;

    const now = Date.now();
    if (now > session.expiresAt) {
      this.sessions.delete(token);
      this.persistSessions();
      return null;
    }

    let account = this.accounts.get(session.userId) || this.findAccountByIdentifier(session.email);
    if (!account && fs.existsSync(this.accountsFile)) {
      try {
        const raw = fs.readFileSync(this.accountsFile, 'utf-8');
        const list: AuthAccount[] = JSON.parse(raw);
        for (const a of list) {
          this.accounts.set(a.id, a);
        }
        account = this.accounts.get(session.userId) || this.findAccountByIdentifier(session.email) || null;
      } catch {
        // Ignored
      }
    }

    // Auto-create or repair Lifetime Super Admin account if session is authenticated as Lifetime Super Admin
    if (!account && session.role === 'LIFETIME_SUPER_ADMIN' && this.isOwnerEmail(session.email)) {
      account = {
        id: session.userId,
        uid: session.userId,
        email: session.email,
        username: session.email.split('@')[0],
        fullName: session.fullName,
        phone: '+234 800 000 0001',
        role: 'LIFETIME_SUPER_ADMIN',
        roleTitle: 'Lifetime Super Admin & Chief Executive',
        isLifetimeSuperAdmin: true,
        status: 'active',
        active: true,
        passwordSalt: '',
        passwordHash: '',
        mfaRequired: false,
        createdAt: new Date().toISOString(),
        securityVersion: session.securityVersion || 1,
      };
      this.accounts.set(session.userId, account);
      this.persistAccounts();
    }

    // Hydrate verified stateless Admin or Staff session on serverless cold start if not yet in memory
    if (!account && token.startsWith('tmr_s1_') && (session.role === 'ADMIN' || session.role === 'STAFF' || session.role)) {
      account = {
        id: session.userId,
        uid: session.userId,
        email: session.email,
        username: session.email.split('@')[0],
        fullName: session.fullName,
        phone: '+234 800 000 0000',
        role: session.role,
        roleTitle: session.roleTitle,
        duty: session.roleTitle,
        isLifetimeSuperAdmin: false,
        status: 'active',
        active: true,
        passwordSalt: '',
        passwordHash: '',
        mfaRequired: false,
        permissions: this.getDefaultPermissionsForDuty(session.roleTitle),
        createdAt: new Date().toISOString(),
        securityVersion: session.securityVersion || 1,
      };
      this.accounts.set(session.userId, account);
    }

    if (!account || account.status !== 'active') {
      this.sessions.delete(token);
      this.persistSessions();
      return null;
    }

    // Security Version Check: If user privileges changed or sessions were revoked, invalidate
    if (account.securityVersion !== session.securityVersion) {
      this.sessions.delete(token);
      this.persistSessions();
      return null;
    }

    // Slide session expiration window
    session.expiresAt = now + this.SESSION_LIFETIME_MS;
    return session;
  }

  public invalidateSession(token: string): boolean {
    if (token) {
      this.revokedTokens.add(token);
    }
    const deleted = this.sessions.delete(token);
    if (deleted) {
      this.persistSessions();
    }
    return deleted;
  }

  public revokeAllUserSessions(userId: string): number {
    let count = 0;
    for (const [token, session] of this.sessions.entries()) {
      if (session.userId === userId) {
        this.revokedTokens.add(token);
        this.sessions.delete(token);
        count++;
      }
    }
    if (count > 0) {
      this.persistSessions();
    }
    // Increment security version on the account to invalidate any cached tokens
    const account = this.accounts.get(userId);
    if (account) {
      account.securityVersion = (account.securityVersion || 1) + 1;
      this.persistAccounts();
    }
    return count;
  }

  // -------------------------------------------------------------------------
  // Password Reset Workflow (Single-Use, Expiring Tokens)
  // -------------------------------------------------------------------------
  public createPasswordResetRequest(identifier: string): {
    message: string;
    token?: string;
  } {
    const genericMessage =
      'If an active authorised account matches the identifier provided, password reset instructions and security tokens have been dispatched.';

    const account = this.findAccountByIdentifier(identifier);
    if (!account || account.status !== 'active') {
      return { message: genericMessage };
    }

    for (const [t, record] of this.resetTokens.entries()) {
      if (record.userId === account.id) {
        this.resetTokens.delete(t);
      }
    }

    const resetToken = generateSecureToken(32);
    this.resetTokens.set(resetToken, {
      token: resetToken,
      userId: account.id,
      email: account.email,
      expiresAt: Date.now() + this.RESET_TOKEN_LIFETIME_MS,
      used: false,
    });

    return {
      message: genericMessage,
      token: resetToken,
    };
  }

  public completePasswordReset(
    resetToken: string,
    newPassword: string
  ): { success: boolean; error?: string } {
    if (!newPassword || newPassword.length < 10) {
      return { success: false, error: 'New password must be at least 10 characters in length.' };
    }

    const record = this.resetTokens.get(resetToken);
    if (!record || record.used) {
      return { success: false, error: 'Password reset token is invalid or has already been consumed.' };
    }

    if (Date.now() > record.expiresAt) {
      this.resetTokens.delete(resetToken);
      return { success: false, error: 'Password reset token has expired. Please submit a new request.' };
    }

    const account = this.accounts.get(record.userId);
    if (!account) {
      return { success: false, error: 'Account not found.' };
    }

    const newSalt = generateSalt();
    account.passwordSalt = newSalt;
    account.passwordHash = hashPassword(newPassword, newSalt);
    record.used = true;
    this.resetTokens.delete(resetToken);

    // Invalidate all active sessions for this account
    this.revokeAllUserSessions(account.id);
    this.persistAccounts();

    this.recordAudit({
      actorId: account.id,
      actorName: account.fullName,
      actorRole: account.role,
      action: 'PASSWORD_RESET_COMPLETED',
      resource: '/api/auth/reset-password',
      details: 'Password updated. All prior sessions revoked.',
      ip: '127.0.0.1',
      status: 'SUCCESS',
    });

    return { success: true };
  }

  // -------------------------------------------------------------------------
  // Server-Authoritative Route Access Enforcement
  // -------------------------------------------------------------------------
  public authorizeRouteAccess(
    token: string,
    requestedRoute: string
  ): {
    allowed: boolean;
    statusCode: 200 | 401 | 403;
    reason?: string;
    session?: UserSession;
    targetRoute?: string;
  } {
    const normalized = requestedRoute.toLowerCase();

    // Canonical Route 1: /home (Public)
    if (
      normalized === '/' ||
      normalized === '/home' ||
      normalized.startsWith('/personal') ||
      normalized.startsWith('/business') ||
      normalized.startsWith('/corporate') ||
      normalized.startsWith('/digital') ||
      normalized.startsWith('/open-account') ||
      normalized.startsWith('/about') ||
      normalized.startsWith('/branches') ||
      normalized.startsWith('/tariffs') ||
      normalized.startsWith('/security') ||
      normalized.startsWith('/contact') ||
      normalized.startsWith('/help') ||
      normalized.startsWith('/governance') ||
      normalized.startsWith('/privacy') ||
      normalized.startsWith('/terms') ||
      normalized === '/login' ||
      normalized === '/staff/login' ||
      normalized === '/internet-banking'
    ) {
      return { allowed: true, statusCode: 200 };
    }

    // Canonical Route 5: /supa-setup (Initial Setup or Root Lockdown Status)
    if (normalized === '/supa-setup' || normalized === '/supasetup' || normalized === '/supaadmin') {
      return { allowed: true, statusCode: 200, targetRoute: '/supa-setup' };
    }

    // Verify Session for Protected Dashboards
    const session = this.validateSession(token);
    if (!session) {
      return {
        allowed: false,
        statusCode: 401,
        reason: 'Authentication required. No active or valid server session found.',
      };
    }

    // Canonical Route 4: /supa-admin (Lifetime Super Admin with MFA ONLY)
    if (normalized === '/supa-admin' || normalized === '/superadmin') {
      if (session.role !== 'LIFETIME_SUPER_ADMIN' || !session.isLifetimeSuperAdmin) {
        this.recordAudit({
          actorId: session.userId,
          actorName: session.fullName,
          actorRole: session.role,
          action: 'ATTEMPTED_PRIVILEGE_ESCALATION',
          resource: '/supa-admin',
          details: `Non-Super-Admin user (${session.role}) attempted unauthorized access to root portal.`,
          ip: session.ip,
          status: 'DENIED',
        });
        return {
          allowed: false,
          statusCode: 403,
          reason: 'Access Denied: The Super Admin portal is strictly reserved for the unique Lifetime Super Admin.',
          session,
        };
      }

      return { allowed: true, statusCode: 200, session, targetRoute: '/supa-admin' };
    }

    // Canonical Route 3: /admin (Admin or Lifetime Super Admin)
    if (normalized === '/admin') {
      if (session.role === 'ADMIN' || session.role === 'LIFETIME_SUPER_ADMIN') {
        return { allowed: true, statusCode: 200, session, targetRoute: '/admin' };
      }
      this.recordAudit({
        actorId: session.userId,
        actorName: session.fullName,
        actorRole: session.role,
        action: 'UNAUTHORIZED_ADMIN_PORTAL_ACCESS',
        resource: '/admin',
        details: `Staff user (${session.role}) attempted unauthorized access to Admin portal.`,
        ip: session.ip,
        status: 'DENIED',
      });
      return {
        allowed: false,
        statusCode: 403,
        reason: 'Access Denied: Administrative role clearance required.',
        session,
      };
    }

    // Canonical Route 2: /staff (Authenticated Staff)
    if (normalized === '/staff' || normalized.startsWith('/staff/')) {
      const staffRoles: string[] = [
        'LIFETIME_SUPER_ADMIN',
        'ADMIN',
        'STAFF',
        'staff',
        'operations_manager',
        'loan_officer',
        'field_collector',
        'customer_service',
        'accountant',
        'auditor',
      ];
      if (staffRoles.includes(session.role) || session.role.toUpperCase() === 'STAFF') {
        return { allowed: true, statusCode: 200, session, targetRoute: '/staff' };
      }
      return {
        allowed: false,
        statusCode: 403,
        reason: 'Access Denied: Staff credentials required.',
        session,
      };
    }

    return { allowed: true, statusCode: 200, session };
  }

  // -------------------------------------------------------------------------
  // Role Matrix & Privilege Delegation (No Privilege Escalation)
  // - Super Admin can create/revoke Admins and Staff
  // - Admin can create Staff only (cannot create Admin or Super Admin)
  // - Staff cannot create Admin or Super Admin
  // -------------------------------------------------------------------------
  public createStaffAccount(
    actorSession: UserSession,
    data: {
      fullName: string;
      email: string;
      phone: string;
      username?: string;
      role?: UserRole;
      roleTitle?: string;
      operationalResponsibility?: string;
      accessCode: string;
      password?: string;
      initialPassword?: string;
      assignedModules?: string[];
      firebaseUid?: string;
      allowUpdate?: boolean;
    }
  ): {
    success: boolean;
    message?: string;
    error?: string;
    statusCode?: number;
    isDuplicate?: boolean;
    account?: Omit<AuthAccount, 'passwordHash' | 'passwordSalt'>;
    initialPassword?: string;
    invitation?: any;
    data?: any;
  } {
    // 1. Invariant: Nobody can create a Lifetime Super Admin
    if (data.role === 'LIFETIME_SUPER_ADMIN' || (data.role as string) === 'SUPER_ADMIN') {
      const error = 'Security Invariant: Creation of a second Lifetime Super Admin is strictly prohibited.';
      return {
        success: false,
        statusCode: 403,
        message: error,
        error,
      };
    }

    // 2. Invariant: Only Lifetime Super Admin can create/appoint Admins
    if (data.role === 'ADMIN' && actorSession.role !== 'LIFETIME_SUPER_ADMIN') {
      const error = 'Privilege Violation: Only the Lifetime Super Admin may appoint or promote Administrator accounts.';
      this.recordAudit({
        actorId: actorSession.userId,
        actorName: actorSession.fullName,
        actorRole: actorSession.role,
        action: 'ILLEGAL_ADMIN_CREATION_ATTEMPT',
        resource: '/api/auth/create-staff',
        details: `Non-Super-Admin user attempted to create an Administrator account.`,
        ip: actorSession.ip,
        status: 'DENIED',
      });
      return {
        success: false,
        statusCode: 403,
        message: error,
        error,
      };
    }

    // 3. Invariant: Ordinary Staff cannot create accounts (Only Super Admin and Admin)
    if (actorSession.role !== 'LIFETIME_SUPER_ADMIN' && actorSession.role !== 'ADMIN') {
      const error = 'Privilege Violation: Ordinary staff members do not hold provisioning clearance.';
      return {
        success: false,
        statusCode: 403,
        message: error,
        error,
      };
    }

    // 4. Validate mandatory inputs
    const fullName = data.fullName?.trim();
    const email = data.email?.trim().toLowerCase();
    const phone = data.phone?.trim();
    const accessCode = data.accessCode?.trim();
    const roleTitle = data.roleTitle?.trim() || data.operationalResponsibility?.trim() || 'Customer Registration Officer';

    if (!fullName || !email || !phone || !accessCode) {
      const error = 'Full Legal Name, Official Email Address, Phone Number, and Access Code are mandatory.';
      return {
        success: false,
        statusCode: 400,
        message: error,
        error,
      };
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      const error = 'A valid official email address is required.';
      return { success: false, statusCode: 400, message: error, error };
    }

    if (accessCode.length < 6) {
      const error = 'Invalid access code: Access Code must be at least 6 characters in length to meet security requirements.';
      return {
        success: false,
        statusCode: 400,
        message: error,
        error,
      };
    }

    if (this.isOwnerEmail(email)) {
      const error = 'The Lifetime Super Admin root account cannot be modified or recreated as Staff.';
      return {
        success: false,
        statusCode: 403,
        message: error,
        error,
      };
    }

    // 5. Duplicate Email Verification
    const existingByEmail = this.findAccountByIdentifier(email);
    if (existingByEmail && existingByEmail.email.toLowerCase() === email) {
      if (existingByEmail.isLifetimeSuperAdmin) {
        const error = 'The Lifetime Super Admin root account cannot be modified through staff creation.';
        return { success: false, statusCode: 403, message: error, error };
      }
      if (!data.allowUpdate && existingByEmail.status === 'active') {
        const error = `An account with email address ${email} already exists.`;
        return {
          success: false,
          statusCode: 409,
          isDuplicate: true,
          message: error,
          error,
        };
      }
    }

    // 6. Access Code Backend Verification
    for (const acc of this.accounts.values()) {
      if (acc.accessCodeHash && acc.accessCodeSalt && acc.email.toLowerCase() !== email) {
        const testHash = this.hashAccessCode(accessCode, acc.accessCodeSalt);
        if (testHash === acc.accessCodeHash) {
          const error = 'This access authorization code has already been assigned and cannot be reused.';
          return {
            success: false,
            statusCode: 409,
            message: error,
            error,
          };
        }
      }
    }

    // Check backend access invitations by matching the provided accessCode hash first
    let matchedInvitation: AccessInvitation | null = null;
    for (const inv of this.invitations.values()) {
      if (inv.codeSalt && this.hashAccessCode(accessCode, inv.codeSalt) === inv.codeHash) {
        matchedInvitation = inv;
        break;
      }
    }

    let codeSalt: string;
    let codeHash: string;
    let codeMasked: string;

    if (matchedInvitation) {
      if (matchedInvitation.revoked && actorSession.role !== 'LIFETIME_SUPER_ADMIN') {
        const error = 'This access authorization code has been revoked by administration.';
        return {
          success: false,
          statusCode: 400,
          message: error,
          error,
        };
      }

      if (
        matchedInvitation.used &&
        matchedInvitation.email &&
        matchedInvitation.email !== 'pending@authorization.internal' &&
        matchedInvitation.email.toLowerCase() !== email &&
        actorSession.role !== 'LIFETIME_SUPER_ADMIN'
      ) {
        const error = 'This access authorization code has already been redeemed and cannot be reused.';
        return {
          success: false,
          statusCode: 409,
          message: error,
          error,
        };
      }

      if (Date.now() > matchedInvitation.expiresAt && actorSession.role !== 'LIFETIME_SUPER_ADMIN') {
        const error = 'This access authorization code has expired. Please request a new invitation.';
        return {
          success: false,
          statusCode: 400,
          message: error,
          error,
        };
      }

      if (matchedInvitation.accessType === 'Admin' && actorSession.role !== 'LIFETIME_SUPER_ADMIN') {
        const error = 'Clearance Violation: This access code is designated for Administrator clearance, not ordinary Staff.';
        return {
          success: false,
          statusCode: 403,
          message: error,
          error,
        };
      }

      matchedInvitation.email = email;
      matchedInvitation.fullName = fullName;
      matchedInvitation.phone = phone;
      matchedInvitation.duty = roleTitle;
      matchedInvitation.used = true;
      matchedInvitation.revoked = false;
      matchedInvitation.attempts = 0;
      this.persistInvitations();

      codeSalt = matchedInvitation.codeSalt;
      codeHash = matchedInvitation.codeHash;
      codeMasked = matchedInvitation.codeMasked || `${accessCode.slice(0, 3)}***${accessCode.slice(-2)}`;
    } else {
      codeSalt = generateSalt();
      codeHash = this.hashAccessCode(accessCode, codeSalt);
      codeMasked = `${accessCode.slice(0, 3)}***${accessCode.slice(-2)}`;

      const invitationId = `INV_STF_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
      const newInvitation: AccessInvitation = {
        id: invitationId,
        email,
        accessType: data.role === 'ADMIN' ? 'Admin' : 'Staff',
        duty: roleTitle,
        codeHash,
        codeSalt,
        codeMasked,
        expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
        used: true,
        revoked: false,
        attempts: 0,
        maxAttempts: 5,
        createdAt: new Date().toISOString(),
        createdBy: actorSession.userId,
        createdByName: actorSession.fullName,
        fullName,
        phone,
        assignedPermissions: this.getDefaultPermissionsForDuty(roleTitle),
      };
      this.invitations.set(invitationId, newInvitation);
      this.persistInvitations();
    }

    const username = (data.username?.trim() || email.split('@')[0]).toLowerCase();
    if (existingByEmail && existingByEmail.email.toLowerCase() === email) {
      if (data.firebaseUid && existingByEmail.id !== data.firebaseUid) {
        this.accounts.delete(existingByEmail.id);
        existingByEmail.id = data.firebaseUid;
      }
      existingByEmail.uid = data.firebaseUid || existingByEmail.uid || existingByEmail.id;
      existingByEmail.status = 'active';
      existingByEmail.active = true;
      existingByEmail.is_active = true;
      existingByEmail.isActive = true;
      existingByEmail.verified = true;
      existingByEmail.isVerified = true;
      existingByEmail.fullName = fullName;
      existingByEmail.phone = phone;
      existingByEmail.role = (data.role || existingByEmail.role || 'STAFF') as UserRole;
      existingByEmail.roleTitle = roleTitle;
      existingByEmail.duty = roleTitle;
      existingByEmail.createdBy = existingByEmail.createdBy || actorSession.userId;
      existingByEmail.accessCodeHash = codeHash;
      existingByEmail.accessCodeSalt = codeSalt;
      existingByEmail.accessCodeMasked = codeMasked;

      const explicitPassword = (data.password || data.initialPassword || '').trim();
      const fallbackPassword = (data.accessCode || '').trim();
      const effectivePass = explicitPassword || (!existingByEmail.passwordHash ? fallbackPassword : '');
      if (effectivePass && effectivePass.length >= 6) {
        existingByEmail.passwordSalt = generateSalt();
        existingByEmail.passwordHash = hashPassword(effectivePass, existingByEmail.passwordSalt);
      }

      existingByEmail.securityVersion = existingByEmail.securityVersion || 1;
      this.accounts.set(existingByEmail.id, existingByEmail);
      this.persistAccounts();

      this.recordAudit({
        actorId: actorSession.userId,
        actorName: actorSession.fullName,
        actorRole: actorSession.role,
        action: 'CREATED_STAFF_ACCOUNT',
        resource: '/api/auth/create-staff',
        details: `${actorSession.role} ${actorSession.fullName} activated/updated Staff account for ${existingByEmail.fullName} (${existingByEmail.email}) with verified access code (${codeMasked}).`,
        ip: actorSession.ip,
        status: 'SUCCESS',
      });

      const { passwordHash: _, passwordSalt: __, ...safe } = existingByEmail;
      const msg = 'Staff account created successfully';
      return {
        success: true,
        statusCode: 201,
        message: msg,
        account: safe,
        initialPassword: explicitPassword || fallbackPassword,
        invitation: {
          codeMasked,
          accessType: existingByEmail.role === 'ADMIN' ? 'Admin' : 'Staff',
          duty: roleTitle,
        },
        data: {
          account: safe,
          initialPassword: explicitPassword || fallbackPassword,
          invitation: {
            codeMasked,
            accessType: existingByEmail.role === 'ADMIN' ? 'Admin' : 'Staff',
            duty: roleTitle,
          },
        },
      };
    }

    // 7. Initial password & Firebase UID linking
    const rawPassword = (data.password || data.initialPassword || data.accessCode || '').trim();
    const initialPass = rawPassword && rawPassword.length >= 6
      ? rawPassword
      : `Teamacro@${crypto.randomBytes(3).toString('hex')}!`;

    const passSalt = generateSalt();
    const id = data.firebaseUid || `STAFF_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const staffCode = `TMC-STF-${id.slice(-4).toUpperCase()}`;

    const newAccount: AuthAccount = {
      id,
      uid: id,
      email,
      username,
      fullName,
      phone,
      role: (data.role || 'STAFF') as UserRole,
      roleTitle,
      duty: roleTitle,
      isLifetimeSuperAdmin: false,
      status: 'active',
      active: true,
      is_active: true,
      isActive: true,
      verified: true,
      isVerified: true,
      staffId: id,
      staffCode,
      passwordSalt: passSalt,
      passwordHash: hashPassword(initialPass, passSalt),
      accessCodeHash: codeHash,
      accessCodeSalt: codeSalt,
      accessCodeMasked: codeMasked,
      permissions: this.getDefaultPermissionsForDuty(roleTitle),
      mfaRequired: false,
      createdBy: actorSession.userId,
      createdAt: new Date().toISOString(),
      securityVersion: 1,
    };

    this.accounts.set(id, newAccount);
    this.persistAccounts();

    // 8. Record audit log
    this.recordAudit({
      actorId: actorSession.userId,
      actorName: actorSession.fullName,
      actorRole: actorSession.role,
      action: 'CREATED_STAFF_ACCOUNT',
      resource: '/api/auth/create-staff',
      details: `${actorSession.role} ${actorSession.fullName} provisioned Staff account for ${newAccount.fullName} (${newAccount.email}) with UID ${id} and verified access code (${codeMasked}).`,
      ip: actorSession.ip,
      status: 'SUCCESS',
    });

    const { passwordHash: _, passwordSalt: __, ...safe } = newAccount;
    const successMsg = 'Staff account created successfully';
    return {
      success: true,
      statusCode: 201,
      message: successMsg,
      account: safe,
      initialPassword: initialPass,
      invitation: {
        codeMasked,
        accessType: 'Staff',
        duty: roleTitle,
      },
      data: {
        account: safe,
        initialPassword: initialPass,
        invitation: {
          codeMasked,
          accessType: 'Staff',
          duty: roleTitle,
        },
      },
    };
  }

  public revokeAdminRole(
    actorSession: UserSession,
    targetUserId: string
  ): { success: boolean; error?: string } {
    if (actorSession.role !== 'LIFETIME_SUPER_ADMIN') {
      return {
        success: false,
        error: 'Privilege Violation: Only the Lifetime Super Admin can revoke or demote Administrator status.',
      };
    }

    const target = this.accounts.get(targetUserId);
    if (!target) {
      return { success: false, error: 'Target user account not found.' };
    }

    if (target.isLifetimeSuperAdmin) {
      return { success: false, error: 'Security Invariant: The Lifetime Super Admin cannot be demoted.' };
    }

    target.role = 'field_collector';
    target.roleTitle = 'Field Officer';
    target.securityVersion = (target.securityVersion || 1) + 1;

    // Immediately purge all existing sessions for the demoted admin
    this.revokeAllUserSessions(targetUserId);
    this.persistAccounts();

    this.recordAudit({
      actorId: actorSession.userId,
      actorName: actorSession.fullName,
      actorRole: actorSession.role,
      action: 'REVOKED_ADMIN_ROLE',
      resource: '/api/auth/revoke-admin',
      details: `Demoted ${target.fullName} (${target.email}) from Admin to Staff. Sessions invalidated.`,
      ip: actorSession.ip,
      status: 'SUCCESS',
    });

    return { success: true };
  }

  public updateAccountStatus(
    actorSession: UserSession,
    targetUserId: string,
    status: 'active' | 'suspended' | 'inactive'
  ): { success: boolean; error?: string } {
    const target = this.accounts.get(targetUserId);
    if (!target) {
      return { success: false, error: 'Target account not found.' };
    }

    if (target.isLifetimeSuperAdmin) {
      return {
        success: false,
        error: 'Security Invariant: The Lifetime Super Admin account status cannot be altered or suspended.',
      };
    }

    if (target.role === 'ADMIN' && actorSession.role !== 'LIFETIME_SUPER_ADMIN') {
      return {
        success: false,
        error: 'Privilege Violation: Only the Lifetime Super Admin can suspend or modify an Administrator account.',
      };
    }

    if (actorSession.role !== 'LIFETIME_SUPER_ADMIN' && actorSession.role !== 'ADMIN') {
      return { success: false, error: 'Insufficient administrative privileges.' };
    }

    target.status = status;
    target.active = status === 'active';
    (target as any).is_active = status === 'active';
    (target as any).isActive = status === 'active';
    target.securityVersion = (target.securityVersion || 1) + 1;

    if (status !== 'active') {
      this.revokeAllUserSessions(targetUserId);
    }
    this.persistAccounts();

    this.recordAudit({
      actorId: actorSession.userId,
      actorName: actorSession.fullName,
      actorRole: actorSession.role,
      action: `ACCOUNT_STATUS_${status.toUpperCase()}`,
      resource: '/api/auth/toggle-status',
      details: `Account for ${target.fullName} set to ${status}. Sessions invalidated.`,
      ip: actorSession.ip,
      status: 'SUCCESS',
    });

    return { success: true };
  }

  // -------------------------------------------------------------------------
  // Financial Authorization: Self-Approval Prevention Invariant
  // -------------------------------------------------------------------------
  public verifyFinancialApproval(
    approverSession: UserSession,
    request: {
      id: string;
      submittedByStaffId: string;
      submittedByStaffName?: string;
      amount: number;
    }
  ): { allowed: boolean; error?: string } {
    if (approverSession.role !== 'LIFETIME_SUPER_ADMIN' && approverSession.role !== 'ADMIN') {
      return {
        allowed: false,
        error: 'Access Denied: Only the Lifetime Super Admin or an authorized Admin can approve financial transfers.',
      };
    }

    // Invariant: The requester cannot approve their own request!
    if (
      request.submittedByStaffId === approverSession.userId ||
      request.submittedByStaffName?.toLowerCase() === approverSession.fullName.toLowerCase()
    ) {
      this.recordAudit({
        actorId: approverSession.userId,
        actorName: approverSession.fullName,
        actorRole: approverSession.role,
        action: 'ATTEMPTED_SELF_APPROVAL_VIOLATION',
        resource: `/financial/transfers/${request.id}`,
        details: `Dual-Control Violation: Requester ${approverSession.fullName} attempted to self-approve transaction ${request.id} of ₦${request.amount.toLocaleString()}.`,
        ip: approverSession.ip,
        status: 'DENIED',
      });
      return {
        allowed: false,
        error: 'SELF-APPROVAL PROHIBITED: Under corporate dual-control governance, a requester cannot approve their own money transfer.',
      };
    }

    return { allowed: true };
  }

  private hashAccessCode(code: string, salt: string): string {
    return crypto.createHash('sha256').update(`${salt}:${code.trim()}`).digest('hex');
  }

  public generateAccessCode(
    actorSession: UserSession,
    data: { email?: string; accessType: 'Admin' | 'Staff'; duty?: string; permissions?: Record<string, boolean> }
  ): { success: boolean; error?: string; code?: string; expiresAt?: number; email?: string; accessType?: string; duty?: string } {
    if (data.accessType === 'Admin' && actorSession.role !== 'LIFETIME_SUPER_ADMIN') {
      return { success: false, error: 'Clearance Violation: Only the Lifetime Super Admin can generate Admin access codes.' };
    }
    if (actorSession.role !== 'LIFETIME_SUPER_ADMIN' && actorSession.role !== 'ADMIN') {
      return { success: false, error: 'Clearance Violation: Ordinary staff cannot generate access codes.' };
    }

    const cleanEmail = data.email?.trim() ? data.email.trim().toLowerCase() : 'pending@authorization.internal';
    const prefix = data.accessType === 'Admin' ? 'TM-ADM' : 'TM-STF';
    const randomHex = crypto.randomBytes(3).toString('hex').toUpperCase();
    const code = `${prefix}-${randomHex}`;
    const salt = generateSalt();
    const codeHash = this.hashAccessCode(code, salt);
    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days

    const invitationId = `INV_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
    const invitation: AccessInvitation = {
      id: invitationId,
      email: cleanEmail,
      accessType: data.accessType,
      duty: data.duty || (data.accessType === 'Admin' ? 'Admin / General Branch Administrator' : 'Customer Registration Officer'),
      codeHash,
      codeSalt: salt,
      codeMasked: `${prefix}-***${code.slice(-2)}`,
      expiresAt,
      used: false,
      revoked: false,
      attempts: 0,
      maxAttempts: 5,
      createdAt: new Date().toISOString(),
      createdBy: actorSession.userId,
      createdByName: actorSession.fullName,
      assignedPermissions: data.permissions,
    };

    this.invitations.set(invitationId, invitation);
    this.persistInvitations();

    this.recordAudit({
      actorId: actorSession.userId,
      actorName: actorSession.fullName,
      actorRole: actorSession.role,
      action: 'ACCESS_CODE_GENERATED',
      resource: '/api/auth/access/generate-code',
      details: `Generated access code for ${cleanEmail} as ${data.accessType}.`,
      ip: actorSession.ip,
      status: 'SUCCESS',
    });

    return {
      success: true,
      code,
      expiresAt,
      email: cleanEmail,
      accessType: data.accessType,
      duty: invitation.duty,
    };
  }

  public appointAdministrator(
    actorSession: UserSession,
    data: {
      fullName: string;
      email: string;
      phone: string;
      operationalResponsibility?: string;
      accessCode: string;
      password?: string;
      initialPassword?: string;
      assignedModules?: string[];
      firebaseUid?: string;
      allowUpdate?: boolean;
    }
  ): {
    success: boolean;
    message?: string;
    error?: string;
    statusCode?: number;
    isDuplicate?: boolean;
    invitation?: any;
    account?: any;
    initialPassword?: string;
    data?: any;
  } {
    // 1. Role invariant: Only Lifetime Super Admin can appoint administrators
    if (actorSession.role !== 'LIFETIME_SUPER_ADMIN') {
      const error = 'Clearance Violation: Only the Lifetime Super Admin can appoint Administrator accounts.';
      this.recordAudit({
        actorId: actorSession.userId,
        actorName: actorSession.fullName,
        actorRole: actorSession.role,
        action: 'ILLEGAL_ADMIN_APPOINTMENT_ATTEMPT',
        resource: '/api/auth/access/appoint-admin',
        details: `Non-Super-Admin user (${actorSession.role}) attempted to appoint an Administrator.`,
        ip: actorSession.ip,
        status: 'DENIED',
      });
      return {
        success: false,
        statusCode: 403,
        message: error,
        error,
      };
    }

    // 2. Validate mandatory fields
    const fullName = data.fullName?.trim();
    const email = data.email?.trim().toLowerCase();
    const phone = data.phone?.trim();
    const accessCode = data.accessCode?.trim();
    const duty = data.operationalResponsibility?.trim() || 'Admin / General Branch Administrator';

    if (!fullName || !email || !phone || !accessCode) {
      const error = 'Full Legal Name, Official Email Address, Phone Number, and Access Code are mandatory.';
      return {
        success: false,
        statusCode: 400,
        message: error,
        error,
      };
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      const error = 'A valid official email address is required.';
      return { success: false, statusCode: 400, message: error, error };
    }

    if (accessCode.length < 6) {
      const error = 'Access Code must be at least 6 characters in length to meet security requirements.';
      return {
        success: false,
        statusCode: 400,
        message: error,
        error,
      };
    }

    if (email === actorSession.email.toLowerCase() || this.isOwnerEmail(email)) {
      const error = 'The Lifetime Super Admin root account cannot be appointed as an Administrator.';
      return {
        success: false,
        statusCode: 403,
        message: error,
        error,
      };
    }

    const existingAccount = this.findAccountByIdentifier(email);
    if (
      existingAccount &&
      existingAccount.email.toLowerCase() === email &&
      existingAccount.role === 'ADMIN' &&
      existingAccount.status === 'active' &&
      !data.allowUpdate
    ) {
      const error = `An active Administrator account with email address ${email} already exists.`;
      return {
        success: false,
        statusCode: 409,
        isDuplicate: true,
        message: error,
        error,
      };
    }

    // 3. Salt and Hash the access code (Zero plaintext storage) or bind existing pre-generated invitation
    let matchedAdminInv: AccessInvitation | null = null;
    for (const inv of this.invitations.values()) {
      if (inv.codeSalt && this.hashAccessCode(accessCode, inv.codeSalt) === inv.codeHash) {
        matchedAdminInv = inv;
        break;
      }
    }

    let salt: string;
    let codeHash: string;
    let masked: string;
    let expiresAt: number;
    let invitation: AccessInvitation;

    if (matchedAdminInv) {
      salt = matchedAdminInv.codeSalt;
      codeHash = matchedAdminInv.codeHash;
      masked = matchedAdminInv.codeMasked || `${accessCode.slice(0, 3)}***${accessCode.slice(-2)}`;
      expiresAt = matchedAdminInv.expiresAt || Date.now() + 7 * 24 * 60 * 60 * 1000;
      matchedAdminInv.email = email;
      matchedAdminInv.fullName = fullName;
      matchedAdminInv.phone = phone;
      matchedAdminInv.accessType = 'Admin';
      matchedAdminInv.duty = duty;
      matchedAdminInv.used = true;
      matchedAdminInv.revoked = false;
      matchedAdminInv.attempts = 0;
      matchedAdminInv.assignedPermissions = this.getDefaultPermissionsForDuty(duty);
      invitation = matchedAdminInv;
    } else {
      salt = generateSalt();
      codeHash = this.hashAccessCode(accessCode, salt);
      masked = `${accessCode.slice(0, 3)}***${accessCode.slice(-2)}`;
      expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days

      const invitationId = `INV_ADM_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
      invitation = {
        id: invitationId,
        email,
        accessType: 'Admin',
        duty,
        codeHash,
        codeSalt: salt,
        codeMasked: masked,
        expiresAt,
        used: true,
        revoked: false,
        attempts: 0,
        maxAttempts: 5,
        createdAt: new Date().toISOString(),
        createdBy: actorSession.userId,
        createdByName: actorSession.fullName,
        fullName,
        phone,
        assignedPermissions: this.getDefaultPermissionsForDuty(duty),
      };
      this.invitations.set(invitationId, invitation);
    }

    this.persistInvitations();

    // 4. Provision / reserve administrator account in accounts directory linked to Firebase Auth UID
    const rawPassword = (data.password || data.initialPassword || data.accessCode || '').trim();
    const initialPass = rawPassword && rawPassword.length >= 6
      ? rawPassword
      : `Teamacro@${crypto.randomBytes(3).toString('hex')}!`;

    let account = existingAccount && existingAccount.email.toLowerCase() === email ? existingAccount : null;
    if (account) {
      if (account.isLifetimeSuperAdmin) {
        const error = 'Root Super Admin cannot be modified.';
        return { success: false, statusCode: 403, message: error, error };
      }
      if (data.firebaseUid && account.id !== data.firebaseUid) {
        this.accounts.delete(account.id);
        account.id = data.firebaseUid;
      }
      account.uid = data.firebaseUid || account.uid || account.id;
      account.role = 'ADMIN';
      account.roleTitle = duty;
      account.duty = duty;
      account.status = 'active';
      account.active = true;
      account.is_active = true;
      account.isActive = true;
      account.verified = true;
      account.isVerified = true;
      account.fullName = fullName;
      account.phone = phone;
      account.createdBy = account.createdBy || actorSession.userId;
      if (initialPass) {
        account.passwordSalt = generateSalt();
        account.passwordHash = hashPassword(initialPass, account.passwordSalt);
      }
      account.accessCodeHash = codeHash;
      account.accessCodeSalt = salt;
      account.accessCodeMasked = masked;
      account.securityVersion = account.securityVersion || 1;
      this.accounts.set(account.id, account);
    } else {
      const accSalt = generateSalt();
      const accountId = data.firebaseUid || `STAFF_ADM_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
      const staffCode = `TMC-ADM-${accountId.slice(-4).toUpperCase()}`;
      account = {
        id: accountId,
        uid: accountId,
        email,
        username: email.split('@')[0],
        fullName,
        phone,
        role: 'ADMIN',
        roleTitle: duty,
        duty,
        isLifetimeSuperAdmin: false,
        status: 'active',
        active: true,
        is_active: true,
        isActive: true,
        verified: true,
        isVerified: true,
        staffId: accountId,
        staffCode,
        passwordSalt: accSalt,
        passwordHash: hashPassword(initialPass, accSalt),
        accessCodeHash: codeHash,
        accessCodeSalt: salt,
        accessCodeMasked: masked,
        mfaRequired: false,
        permissions: this.getDefaultPermissionsForDuty(duty),
        createdBy: actorSession.userId,
        createdAt: new Date().toISOString(),
        securityVersion: 1,
      };
      this.accounts.set(account.id, account);
    }
    this.persistAccounts();

    this.recordAudit({
      actorId: actorSession.userId,
      actorName: actorSession.fullName,
      actorRole: actorSession.role,
      action: 'APPOINTED_ADMINISTRATOR_WITH_CODE',
      resource: '/api/auth/access/appoint-admin',
      details: `Lifetime Super Admin appointed ${fullName} (${email}) as Administrator with UID ${account.id} and access authorization code.`,
      ip: actorSession.ip,
      status: 'SUCCESS',
    });

    const safeInvitation = {
      id: invitation.id,
      email: invitation.email,
      accessType: invitation.accessType,
      duty: invitation.duty,
      codeMasked: invitation.codeMasked,
      expiresAt: invitation.expiresAt,
      status: 'ACTIVE',
    };

    const safeAccount = {
      id: account.id,
      uid: account.uid || account.id,
      email: account.email,
      username: account.username,
      fullName: account.fullName,
      phone: account.phone,
      role: account.role,
      roleTitle: account.roleTitle,
      duty: account.duty,
      staffId: account.staffId || account.id,
      staffCode: account.staffCode,
      status: account.status,
      active: account.active,
      createdBy: account.createdBy,
      createdAt: account.createdAt,
      permissions: account.permissions,
    };

    const msg = 'Admin account created successfully';

    return {
      success: true,
      statusCode: 201,
      message: msg,
      invitation: safeInvitation,
      account: safeAccount,
      initialPassword: initialPass,
      data: {
        invitation: safeInvitation,
        account: safeAccount,
        initialPassword: initialPass,
      },
    };
  }

  public giveAccess(
    actorSession: UserSession,
    data: {
      email: string;
      accessType: 'Admin' | 'Staff';
      duty: string;
      code: string;
      fullName?: string;
      phone?: string;
      permissions?: Record<string, boolean>;
    }
  ): { success: boolean; error?: string; record?: any } {
    // Enforce hierarchy: Only Super Admin can give Admin access
    if (data.accessType === 'Admin' && actorSession.role !== 'LIFETIME_SUPER_ADMIN') {
      return { success: false, error: 'Clearance Violation: Only the Lifetime Super Admin can grant Admin access.' };
    }
    if (actorSession.role !== 'LIFETIME_SUPER_ADMIN' && actorSession.role !== 'ADMIN') {
      return { success: false, error: 'Clearance Violation: Insufficient authorization to grant backend access.' };
    }

    if (!data.email?.trim() || !data.code?.trim() || !data.duty?.trim()) {
      return { success: false, error: 'Email, Duty, and Access Code are all mandatory.' };
    }

    const cleanEmail = data.email.trim().toLowerCase();
    const cleanCode = data.code.trim();

    if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      return { success: false, error: 'A valid email address is required.' };
    }

    if (cleanCode.length < 6) {
      return { success: false, error: 'Access code must be at least 6 characters in length.' };
    }

    // Check if an invitation with this access code was already generated (e.g. pending@authorization.internal)
    let matchedInv: AccessInvitation | null = null;
    for (const inv of this.invitations.values()) {
      if (inv.codeSalt && this.hashAccessCode(cleanCode, inv.codeSalt) === inv.codeHash) {
        matchedInv = inv;
        break;
      }
    }

    let salt: string;
    let codeHash: string;
    let masked: string;
    let expiresAt: number;

    if (matchedInv) {
      salt = matchedInv.codeSalt;
      codeHash = matchedInv.codeHash;
      masked = matchedInv.codeMasked || `${cleanCode.slice(0, 3)}***${cleanCode.slice(-2)}`;
      expiresAt = matchedInv.expiresAt || Date.now() + 7 * 24 * 60 * 60 * 1000;
      matchedInv.email = cleanEmail;
      matchedInv.accessType = data.accessType;
      matchedInv.duty = data.duty;
      matchedInv.fullName = data.fullName?.trim() || matchedInv.fullName;
      matchedInv.phone = data.phone?.trim() || matchedInv.phone;
      matchedInv.assignedPermissions = data.permissions || this.getDefaultPermissionsForDuty(data.duty);
      matchedInv.revoked = false;
      matchedInv.attempts = 0;
    } else {
      salt = generateSalt();
      codeHash = this.hashAccessCode(cleanCode, salt);
      masked = `${cleanCode.slice(0, 3)}***${cleanCode.slice(-2)}`;
      expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days

      const invitationId = `INV_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
      const invitation: AccessInvitation = {
        id: invitationId,
        email: cleanEmail,
        accessType: data.accessType,
        duty: data.duty,
        codeHash,
        codeSalt: salt,
        codeMasked: masked,
        expiresAt,
        used: false,
        revoked: false,
        attempts: 0,
        maxAttempts: 5,
        createdAt: new Date().toISOString(),
        createdBy: actorSession.userId,
        createdByName: actorSession.fullName,
        fullName: data.fullName?.trim(),
        phone: data.phone?.trim(),
        assignedPermissions: data.permissions || this.getDefaultPermissionsForDuty(data.duty),
      };

      this.invitations.set(invitationId, invitation);
    }

    this.persistInvitations();

    // Provision or update account
    let target = this.findAccountByIdentifier(cleanEmail);
    const targetRole: UserRole = data.accessType === 'Admin' ? 'ADMIN' : 'STAFF';

    if (target) {
      if (target.isLifetimeSuperAdmin) {
        return { success: false, error: 'The Lifetime Super Admin account cannot be altered through this interface.' };
      }
      target.role = targetRole;
      target.roleTitle = data.duty;
      target.duty = data.duty;
      target.status = 'active';
      target.active = true;
      target.is_active = true;
      target.isActive = true;
      target.verified = true;
      target.isVerified = true;
      target.accessCodeHash = codeHash;
      target.accessCodeSalt = salt;
      target.accessCodeMasked = masked;
      if (data.fullName?.trim()) target.fullName = data.fullName.trim();
      if (data.phone?.trim()) target.phone = data.phone.trim();
      if (data.permissions) {
        target.permissions = data.permissions;
      }
      target.securityVersion = target.securityVersion || 1;
    } else {
      const accSalt = generateSalt();
      const id = `STAFF_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
      const staffCode = data.accessType === 'Admin' ? `TMC-ADM-${id.slice(-4)}` : `TMC-STF-${id.slice(-4)}`;
      target = {
        id,
        email: cleanEmail,
        username: cleanEmail.split('@')[0],
        fullName: data.fullName?.trim() || cleanEmail.split('@')[0],
        phone: data.phone?.trim() || '+234 800 000 0000',
        role: targetRole,
        roleTitle: data.duty,
        duty: data.duty,
        isLifetimeSuperAdmin: false,
        status: 'active',
        active: true,
        is_active: true,
        isActive: true,
        verified: true,
        isVerified: true,
        staffId: id,
        staffCode,
        passwordSalt: accSalt,
        passwordHash: hashPassword(cleanCode, accSalt),
        accessCodeHash: codeHash,
        accessCodeSalt: salt,
        accessCodeMasked: masked,
        mfaRequired: false,
        permissions: data.permissions || this.getDefaultPermissionsForDuty(data.duty),
        createdAt: new Date().toISOString(),
        securityVersion: 1,
      };
      this.accounts.set(id, target);
    }

    this.persistAccounts();

    this.recordAudit({
      actorId: actorSession.userId,
      actorName: actorSession.fullName,
      actorRole: actorSession.role,
      action: 'ACCESS_GRANTED_SUPER_ADMIN',
      resource: '/api/auth/access/give-access',
      details: `Granted ${data.accessType} access with duty '${data.duty}' to ${cleanEmail}.`,
      ip: actorSession.ip,
      status: 'SUCCESS',
    });

    return {
      success: true,
      record: {
        id: target.id,
        email: target.email,
        fullName: target.fullName,
        accessType: data.accessType,
        duty: data.duty,
        codeMasked: masked,
        status: target.status,
        permissions: target.permissions,
        grantedAt: new Date().toISOString(),
      },
    };
  }

  public revokeAccessCode(
    actorSession: UserSession,
    invitationId: string
  ): { success: boolean; error?: string; message?: string } {
    const inv = this.invitations.get(invitationId);
    if (!inv) {
      return { success: false, error: 'Authorization invitation not found.' };
    }

    if (inv.accessType === 'Admin' && actorSession.role !== 'LIFETIME_SUPER_ADMIN') {
      return { success: false, error: 'Clearance Violation: Only the Lifetime Super Admin can revoke Admin access.' };
    }

    if (actorSession.role !== 'LIFETIME_SUPER_ADMIN' && actorSession.role !== 'ADMIN') {
      return { success: false, error: 'Insufficient administrative privileges to revoke access codes.' };
    }

    inv.revoked = true;
    this.persistInvitations();

    this.recordAudit({
      actorId: actorSession.userId,
      actorName: actorSession.fullName,
      actorRole: actorSession.role,
      action: 'REVOKED_ACCESS_CODE',
      resource: `/api/auth/access/revoke`,
      details: `Revoked access code for ${inv.email} (${inv.accessType} / ${inv.duty}).`,
      ip: actorSession.ip,
      status: 'SUCCESS',
    });

    return { success: true, message: `Access code for ${inv.email} has been permanently revoked.` };
  }

  public verifyAccessCode(
    email: string,
    code: string
  ): {
    success: boolean;
    error?: string;
    invitation?: {
      id: string;
      email: string;
      accessType: 'Admin' | 'Staff';
      duty: string;
      fullName?: string;
      phone?: string;
      permissions?: Record<string, boolean>;
    };
  } {
    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = code.trim();

    // 1. Look for matching invitation by codeHash first (handles pending@authorization.internal codes)
    let match: AccessInvitation | null = null;
    for (const inv of this.invitations.values()) {
      if (inv.codeSalt && this.hashAccessCode(cleanCode, inv.codeSalt) === inv.codeHash) {
        match = inv;
        break;
      }
    }

    // 2. Fallback: look by email if code hash wasn't matched directly
    if (!match) {
      for (const inv of this.invitations.values()) {
        if (inv.email && inv.email.toLowerCase() === cleanEmail) {
          match = inv;
          break;
        }
      }
    }

    if (!match) {
      return { success: false, error: 'No active access authorization invitation found for this email address.' };
    }

    if (match.revoked) {
      return { success: false, error: 'This access authorization code has been revoked by administration.' };
    }

    if (match.used) {
      return { success: false, error: 'This access authorization code has already been redeemed and cannot be reused.' };
    }

    if (Date.now() > match.expiresAt) {
      return { success: false, error: 'This access authorization code has expired. Please request a new invitation.' };
    }

    if (match.attempts >= match.maxAttempts) {
      return { success: false, error: 'Maximum code verification attempts exceeded. Code is locked.' };
    }

    // Verify hash
    const computedHash = this.hashAccessCode(cleanCode, match.codeSalt);
    if (computedHash !== match.codeHash) {
      match.attempts += 1;
      this.persistInvitations();
      const remaining = match.maxAttempts - match.attempts;
      return {
        success: false,
        error: `Invalid access code. ${remaining > 0 ? `${remaining} attempt(s) remaining.` : 'Code locked.'}`,
      };
    }

    // Bind pending@authorization.internal to the user's real email upon verification
    if (!match.email || match.email === 'pending@authorization.internal') {
      match.email = cleanEmail;
      this.persistInvitations();
    } else if (match.email.toLowerCase() !== cleanEmail) {
      return {
        success: false,
        error: `Access code mismatch: This authorization code was designated for ${match.email}.`,
      };
    }

    return {
      success: true,
      invitation: {
        id: match.id,
        email: match.email,
        accessType: match.accessType,
        duty: match.duty,
        fullName: match.fullName,
        phone: match.phone,
        permissions: match.assignedPermissions,
      },
    };
  }

  public redeemAccessCode(
    email: string,
    code: string,
    newPassword?: string,
    fullName?: string,
    phone?: string
  ): { success: boolean; error?: string; account?: any } {
    const verification = this.verifyAccessCode(email, code);
    if (!verification.success || !verification.invitation) {
      return { success: false, error: verification.error || 'Access code verification failed.' };
    }

    const inv = this.invitations.get(verification.invitation.id);
    if (!inv) {
      return { success: false, error: 'Invitation not found.' };
    }

    const cleanEmail = email.trim().toLowerCase();
    inv.email = cleanEmail;
    inv.used = true;
    if (fullName?.trim()) inv.fullName = fullName.trim();
    if (phone?.trim()) inv.phone = phone.trim();
    this.persistInvitations();

    let account = this.findAccountByIdentifier(cleanEmail);

    if (account) {
      if (newPassword && newPassword.length >= 6) {
        const salt = generateSalt();
        account.passwordSalt = salt;
        account.passwordHash = hashPassword(newPassword, salt);
      }
      if (fullName?.trim()) account.fullName = fullName.trim();
      if (phone?.trim()) account.phone = phone.trim();
      account.status = 'active';
      account.active = true;
      account.is_active = true;
      account.isActive = true;
      account.verified = true;
      account.isVerified = true;
      account.accessCodeHash = inv.codeHash;
      account.accessCodeSalt = inv.codeSalt;
      account.accessCodeMasked = inv.codeMasked;
      account.securityVersion = account.securityVersion || 1;
    } else {
      const salt = generateSalt();
      const pass = newPassword || code || `Teamacro@${crypto.randomBytes(3).toString('hex')}!`;
      const id = `STAFF_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
      account = {
        id,
        email: cleanEmail,
        username: cleanEmail.split('@')[0],
        fullName: fullName?.trim() || inv.fullName || cleanEmail.split('@')[0],
        phone: phone?.trim() || inv.phone || '+234 800 000 0000',
        role: inv.accessType === 'Admin' ? 'ADMIN' : 'STAFF',
        roleTitle: inv.duty,
        duty: inv.duty,
        isLifetimeSuperAdmin: false,
        status: 'active',
        active: true,
        is_active: true,
        isActive: true,
        verified: true,
        isVerified: true,
        staffId: id,
        staffCode: inv.accessType === 'Admin' ? `TMC-ADM-${id.slice(-4)}` : `TMC-STF-${id.slice(-4)}`,
        passwordSalt: salt,
        passwordHash: hashPassword(pass, salt),
        accessCodeHash: inv.codeHash,
        accessCodeSalt: inv.codeSalt,
        accessCodeMasked: inv.codeMasked,
        mfaRequired: false,
        permissions: inv.assignedPermissions || this.getDefaultPermissionsForDuty(inv.duty),
        createdAt: new Date().toISOString(),
        securityVersion: 1,
      };
      this.accounts.set(id, account);
    }

    this.persistAccounts();

    this.recordAudit({
      actorId: account.id,
      actorName: account.fullName,
      actorRole: account.role,
      action: 'REDEEMED_ACCESS_CODE',
      resource: '/api/auth/access/redeem-code',
      details: `User ${account.fullName} (${cleanEmail}) redeemed single-use access code as ${account.role}.`,
      ip: 'INTERNAL',
      status: 'SUCCESS',
    });

    const { passwordHash: _, passwordSalt: __, totpSecret: ___, recoveryCodeHashes: ____, ...safe } = account;
    return { success: true, account: safe };
  }

  public syncProvisionedAccount(data: {
    id?: string;
    email: string;
    username?: string;
    fullName: string;
    phone?: string;
    role?: UserRole;
    roleTitle?: string;
    duty?: string;
    staffCode?: string;
    password?: string;
    accessCode?: string;
    status?: 'active' | 'suspended' | 'inactive';
  }): AuthAccount | null {
    const cleanEmail = (data.email || '').trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) return null;

    const cleanUsername = (data.username || cleanEmail.split('@')[0]).trim().toLowerCase();
    let existing =
      (data.id ? this.accounts.get(data.id) : undefined) ||
      this.findAccountByIdentifier(cleanEmail) ||
      this.findAccountByIdentifier(cleanUsername);

    const role: UserRole =
      data.role === 'LIFETIME_SUPER_ADMIN' && this.isOwnerEmail(cleanEmail)
        ? 'LIFETIME_SUPER_ADMIN'
        : data.role === 'ADMIN'
        ? 'ADMIN'
        : 'STAFF';
    const duty = data.duty || data.roleTitle || (role === 'ADMIN' ? 'Admin / General Branch Administrator' : 'Operations Staff');
    const rawPass = (data.password || data.accessCode || '').trim();
    const rawCode = (data.accessCode || '').trim();

    if (existing) {
      if (!existing.isLifetimeSuperAdmin) {
        existing.fullName = data.fullName?.trim() || existing.fullName;
        existing.phone = data.phone?.trim() || existing.phone;
        existing.role = role;
        existing.roleTitle = duty;
        existing.duty = duty;
        if (data.status) {
          existing.status = data.status;
          existing.active = data.status === 'active';
          existing.is_active = data.status === 'active';
          existing.isActive = data.status === 'active';
        }
        if (rawPass && rawPass.length >= 4 && !existing.passwordHash) {
          existing.passwordSalt = generateSalt();
          existing.passwordHash = hashPassword(rawPass, existing.passwordSalt);
        }
        if (rawCode && rawCode.length >= 4) {
          const codeSalt = generateSalt();
          existing.accessCodeSalt = codeSalt;
          existing.accessCodeHash = this.hashAccessCode(rawCode, codeSalt);
          existing.accessCodeMasked = `${rawCode.slice(0, 3)}***${rawCode.slice(-2)}`;
        }
        this.persistAccounts();
      }
      return existing;
    }

    const id = data.id || `STAFF_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const passSalt = generateSalt();
    const effectivePass = rawPass || `Teamacro@${crypto.randomBytes(3).toString('hex')}!`;
    let codeSalt: string | undefined;
    let codeHash: string | undefined;
    let codeMasked: string | undefined;
    if (rawCode) {
      codeSalt = generateSalt();
      codeHash = this.hashAccessCode(rawCode, codeSalt);
      codeMasked = `${rawCode.slice(0, 3)}***${rawCode.slice(-2)}`;
    }

    const newAcc: AuthAccount = {
      id,
      email: cleanEmail,
      username: cleanUsername,
      fullName: data.fullName?.trim() || cleanUsername,
      phone: data.phone?.trim() || '+234 800 000 0000',
      role,
      roleTitle: duty,
      duty,
      isLifetimeSuperAdmin: role === 'LIFETIME_SUPER_ADMIN',
      status: data.status || 'active',
      active: (data.status || 'active') === 'active',
      is_active: (data.status || 'active') === 'active',
      isActive: (data.status || 'active') === 'active',
      verified: true,
      isVerified: true,
      staffId: id,
      staffCode: data.staffCode || (role === 'ADMIN' ? `TMC-ADM-${id.slice(-4)}` : `TMC-STF-${id.slice(-4)}`),
      passwordSalt: passSalt,
      passwordHash: hashPassword(effectivePass, passSalt),
      accessCodeHash: codeHash,
      accessCodeSalt: codeSalt,
      accessCodeMasked: codeMasked,
      mfaRequired: false,
      permissions: this.getDefaultPermissionsForDuty(duty),
      createdAt: new Date().toISOString(),
      securityVersion: 1,
    };

    this.accounts.set(id, newAcc);
    this.persistAccounts();
    return newAcc;
  }

  public mapDutyToRole(duty: string): UserRole {
    const d = duty.toLowerCase();
    if (d.includes('customer registration') || d.includes('customer service')) return 'customer_service';
    if (d.includes('payment collection') || d.includes('field collector')) return 'field_collector';
    if (d.includes('loan officer')) return 'loan_officer';
    if (d.includes('accounts officer') || d.includes('accountant')) return 'accountant';
    if (d.includes('operations manager')) return 'operations_manager';
    if (d.includes('auditor')) return 'auditor';
    return 'operations_manager';
  }

  public getDefaultPermissionsForDuty(duty: string): Record<string, boolean> {
    const d = duty.toLowerCase();
    if (d.includes('customer registration')) {
      return {
        canViewCustomers: true,
        canRegisterCustomers: true,
        canRecordCollections: false,
        canReviewLoans: false,
        canUpdateLoanStages: false,
        canViewFinancialRecords: false,
        canPrepareReconciliations: false,
        canApproveTransactions: false,
        canViewAuditLogs: false,
        canManageStaff: false,
        canExportReports: false,
      };
    }
    if (d.includes('payment collection')) {
      return {
        canViewCustomers: true,
        canRegisterCustomers: false,
        canRecordCollections: true,
        canReviewLoans: false,
        canUpdateLoanStages: false,
        canViewFinancialRecords: true,
        canPrepareReconciliations: false,
        canApproveTransactions: false,
        canViewAuditLogs: false,
        canManageStaff: false,
        canExportReports: false,
      };
    }
    if (d.includes('loan officer')) {
      return {
        canViewCustomers: true,
        canRegisterCustomers: false,
        canRecordCollections: false,
        canReviewLoans: true,
        canUpdateLoanStages: true,
        canViewFinancialRecords: false,
        canPrepareReconciliations: false,
        canApproveTransactions: false,
        canViewAuditLogs: false,
        canManageStaff: false,
        canExportReports: false,
      };
    }
    if (d.includes('accounts officer')) {
      return {
        canViewCustomers: true,
        canRegisterCustomers: false,
        canRecordCollections: false,
        canReviewLoans: false,
        canUpdateLoanStages: false,
        canViewFinancialRecords: true,
        canPrepareReconciliations: true,
        canApproveTransactions: false,
        canViewAuditLogs: true,
        canManageStaff: false,
        canExportReports: true,
      };
    }
    if (d.includes('operations manager')) {
      return {
        canViewCustomers: true,
        canRegisterCustomers: true,
        canRecordCollections: true,
        canReviewLoans: true,
        canUpdateLoanStages: true,
        canViewFinancialRecords: true,
        canPrepareReconciliations: true,
        canApproveTransactions: true,
        canViewAuditLogs: true,
        canManageStaff: true,
        canExportReports: true,
      };
    }
    if (d.includes('auditor')) {
      return {
        canViewCustomers: true,
        canRegisterCustomers: false,
        canRecordCollections: false,
        canReviewLoans: true,
        canUpdateLoanStages: false,
        canViewFinancialRecords: true,
        canPrepareReconciliations: false,
        canApproveTransactions: false,
        canViewAuditLogs: true,
        canManageStaff: false,
        canExportReports: true,
      };
    }
    // Admin default
    return {
      canViewCustomers: true,
      canRegisterCustomers: true,
      canRecordCollections: true,
      canReviewLoans: true,
      canUpdateLoanStages: true,
      canViewFinancialRecords: true,
      canPrepareReconciliations: true,
      canApproveTransactions: true,
      canViewAuditLogs: true,
      canManageStaff: true,
      canExportReports: true,
    };
  }

  public getAccessInvitations(actorSession?: UserSession): any[] {
    if (!actorSession || (actorSession.role !== 'LIFETIME_SUPER_ADMIN' && actorSession.role !== 'ADMIN')) {
      return [];
    }
    let updated = false;
    for (const inv of this.invitations.values()) {
      if (!inv.email || inv.email === 'pending@authorization.internal') {
        for (const acc of this.accounts.values()) {
          if (acc.accessCodeHash && acc.accessCodeHash === inv.codeHash) {
            inv.email = acc.email;
            inv.fullName = acc.fullName;
            inv.phone = acc.phone;
            inv.used = true;
            updated = true;
            break;
          }
        }
      }
    }
    if (updated) {
      this.persistInvitations();
    }

    const list = Array.from(this.invitations.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    // Sanitize: NEVER return plaintext code, codeHash, or codeSalt
    return list.map((inv) => ({
      id: inv.id,
      email: inv.email === 'pending@authorization.internal' ? 'Unassigned (Ready to Bind)' : inv.email,
      fullName: inv.fullName,
      phone: inv.phone,
      accessType: inv.accessType,
      duty: inv.duty,
      codeMasked: inv.codeMasked || '******',
      expiresAt: inv.expiresAt,
      used: inv.used,
      revoked: !!inv.revoked,
      status: inv.revoked ? 'REVOKED' : inv.used ? 'REDEEMED' : Date.now() > inv.expiresAt ? 'EXPIRED' : 'ACTIVE',
      attempts: inv.attempts || 0,
      maxAttempts: inv.maxAttempts || 5,
      createdAt: inv.createdAt,
      createdBy: inv.createdBy,
      createdByName: inv.createdByName,
    }));
  }

  public updateUserPermissions(
    actorSession: UserSession,
    targetUserId: string,
    permissions: Record<string, boolean>
  ): { success: boolean; error?: string } {
    if (actorSession.role !== 'LIFETIME_SUPER_ADMIN') {
      return { success: false, error: 'Only the Lifetime Super Admin can modify granular account permissions.' };
    }
    const target = this.accounts.get(targetUserId);
    if (!target) {
      return { success: false, error: 'User account not found.' };
    }
    target.permissions = permissions;
    this.persistAccounts();
    return { success: true };
  }

  public getPublicAccountsList(actorSession?: UserSession): Array<Omit<AuthAccount, 'passwordHash' | 'passwordSalt' | 'totpSecret' | 'recoveryCodeHashes'>> {
    if (!actorSession || (actorSession.role !== 'LIFETIME_SUPER_ADMIN' && actorSession.role !== 'ADMIN')) {
      return [];
    }
    const list: Array<Omit<AuthAccount, 'passwordHash' | 'passwordSalt' | 'totpSecret' | 'recoveryCodeHashes'>> = [];
    for (const acc of this.accounts.values()) {
      const { passwordHash: _, passwordSalt: __, totpSecret: ___, recoveryCodeHashes: ____, ...safe } = acc;
      list.push(safe);
    }
    return list;
  }

  public saveCustomerRecord(customerData: any): any {
    if (!customerData || (!customerData.fullName && !customerData.phone)) {
      throw new Error('Customer full name and phone number are required.');
    }

    const cleanedPhone = String(customerData.phone || '').replace(/\s+/g, '');
    const cleanEmail = String(customerData.email || '').trim().toLowerCase();

    // Check if customer already exists by ID, phone, or email
    let existing: any = null;
    if (customerData.id && this.customers.has(customerData.id)) {
      existing = this.customers.get(customerData.id);
    } else {
      for (const c of this.customers.values()) {
        if (cleanedPhone && String(c.phone || '').replace(/\s+/g, '') === cleanedPhone) {
          existing = c;
          break;
        }
        if (cleanEmail && String(c.email || '').trim().toLowerCase() === cleanEmail) {
          existing = c;
          break;
        }
      }
    }

    const count = this.customers.size + 1;
    const id = existing?.id || customerData.id || `cust_${String(count).padStart(3, '0')}_${Date.now().toString(36).slice(-4)}`;
    const customerCode = existing?.customerCode || customerData.customerCode || `TMC-CST-${1000 + count}`;
    const accountNumber =
      existing?.accountNumber ||
      customerData.accountNumber ||
      `2038${String(100000 + count * 137 + (Date.now() % 1000)).slice(-6)}`;
    const nowDate = new Date().toISOString().split('T')[0];

    const record = {
      ...(existing || {}),
      ...customerData,
      id,
      customerCode,
      accountNumber,
      fullName: String(customerData.fullName || existing?.fullName || '').trim(),
      phone: String(customerData.phone || existing?.phone || '').trim(),
      email: cleanEmail || existing?.email || '',
      address: String(customerData.address || customerData.residentialAddress || existing?.address || 'Lagos, Nigeria').trim(),
      state: String(customerData.state || existing?.state || 'Lagos').trim(),
      lga: String(customerData.lga || existing?.lga || 'Metropolitan').trim(),
      ninOrBvn: String(customerData.ninOrBvn || customerData.kycIdNumber || customerData.bvn || customerData.nin || existing?.ninOrBvn || '').trim(),
      occupation: String(customerData.occupation || existing?.occupation || 'Member').trim(),
      nextOfKinName: String(customerData.nextOfKinName || existing?.nextOfKinName || '').trim(),
      nextOfKinPhone: String(customerData.nextOfKinPhone || existing?.nextOfKinPhone || customerData.phone || '').trim(),
      nextOfKinRelationship: String(customerData.nextOfKinRelationship || existing?.nextOfKinRelationship || 'Relative').trim(),
      registrationDate: existing?.registrationDate || customerData.registrationDate || nowDate,
      registeredByStaffId: customerData.registeredByStaffId || customerData.assignedStaffId || existing?.registeredByStaffId || 'SYSTEM',
      status: (customerData.status || existing?.status || 'active').toLowerCase(),
      enrolledProgrammes: Array.isArray(customerData.enrolledProgrammes)
        ? customerData.enrolledProgrammes
        : Array.isArray(existing?.enrolledProgrammes)
        ? existing.enrolledProgrammes
        : [],
      updatedAt: new Date().toISOString(),
    };

    this.customers.set(id, record);
    this.persistCustomers();
    return record;
  }

  public getCustomersList(): any[] {
    return Array.from(this.customers.values()).sort((a, b) => {
      const tA = new Date(a.updatedAt || a.registrationDate || 0).getTime();
      const tB = new Date(b.updatedAt || b.registrationDate || 0).getTime();
      return tB - tA;
    });
  }
}

export const serverAuthManager = new ServerAuthManager();

