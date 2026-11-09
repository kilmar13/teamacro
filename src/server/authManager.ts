import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { generateTotpSecret, computeTotpCode, verifyTotpCode, generateRecoveryCodes } from './totp.js';
import {
  saveFirestoreSystemOwnership,
  saveFirestoreInvitation,
  saveFirestoreSessionHash,
  revokeFirestoreSessionByHash,
  saveFirestoreAuditLog,
  writeFirestoreUserProfile,
  writeFirestoreDocument,
} from './firebaseAdmin.js';
import {
  normalizeCanonicalPosition,
  getDedicatedRouteForUser,
  isReadOnlyAuditor,
  getDefaultPositionPermissions,
  sanitizePermissionsForPosition,
  POSITION_ROUTE_MAP,
} from '../utils/roleRouting.js';

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
  | 'ACCOUNT_MANAGER'
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
  position?: string;
  dashboardRoute?: string;
  assignedProgramme?: string;
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
  position?: string;
  dashboardRoute?: string;
  assignedProgramme?: string;
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
  position?: string;
  dashboardRoute?: string;
  assignedProgramme?: string;
  permissions?: Record<string, boolean>;
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
  private revokedTokenHashes: Set<string> = new Set();
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

    if (!this.isProductionMode()) {
      this.ensureDataDirectory();
    }
    this.loadStateFromStorage();
  }

  public isProductionMode(): boolean {
    return Boolean(process.env.VERCEL || process.env.NODE_ENV === 'production');
  }

  private hashSessionToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private resolveWritableDataDir(): string {
    const seedDir = path.resolve(process.cwd(), 'data');
    if (this.isProductionMode()) {
      return seedDir;
    }
    if (process.env.TEAMACRO_DATA_DIR) {
      return path.resolve(process.env.TEAMACRO_DATA_DIR);
    }

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

  private pendingFileSaves = new Map<string, { timer: NodeJS.Timeout; data: any }>();

  // Debounced non-blocking file persistence for local development only. Production relies exclusively on Cloud Firestore.
  private atomicSaveFile(filePath: string, data: any): void {
    if (this.isProductionMode()) {
      return;
    }
    const existing = this.pendingFileSaves.get(filePath);
    if (existing) {
      existing.data = data;
      return;
    }
    const timer = setTimeout(async () => {
      const entry = this.pendingFileSaves.get(filePath);
      this.pendingFileSaves.delete(filePath);
      const payloadToWrite = entry ? entry.data : data;
      try {
        this.ensureDataDirectory();
        const tmpPath = `${filePath}.${Date.now()}.${Math.random().toString(36).substring(2, 6)}.tmp`;
        await fs.promises.writeFile(tmpPath, JSON.stringify(payloadToWrite, null, 2), {
          encoding: 'utf-8',
          mode: 0o664,
        });
        await fs.promises.rename(tmpPath, filePath);
      } catch (err) {
        console.warn(`[STORAGE WARNING] Failed writing to ${filePath} (falling back to memory):`, err);
      }
    }, 60);
    if (typeof timer.unref === 'function') timer.unref();
    this.pendingFileSaves.set(filePath, { timer, data });
  }

  private loadStateFromStorage(): void {
    // 1. Load System Ownership Singleton baseline (Firestore is authoritative at runtime)
    if (fs.existsSync(this.ownershipFile)) {
      try {
        const raw = fs.readFileSync(this.ownershipFile, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed && parsed.ownerUserId === 'ROOT_SUPER_ADMIN_SUITE_RUNNER') {
          parsed.ownerUserId = 'OWNER_ROOT_3YPAFKI2';
          parsed.ownerFullName = 'David Eromosele';
        }
        this.ownership = parsed;
      } catch (e) {
        console.error('[STORAGE] Corrupt ownership file:', e);
      }
    }

    if (!this.ownership.isInitialized || !this.ownership.ownerUserId) {
      this.ownership = {
        isInitialized: true,
        lockdownEnforced: true,
        ownerUserId: 'OWNER_ROOT_3YPAFKI2',
        ownerEmail: 'eromoseledavidson68@gmail.com',
        ownerFullName: 'David Eromosele',
        establishedAt: '2026-10-27T12:29:12.967Z',
        setupVersion: 1,
      };
    }

    // 2. Load Accounts (in production, only seed the verified root owner baseline; Admin/Staff come from Firestore)
    if (fs.existsSync(this.accountsFile)) {
      try {
        const raw = fs.readFileSync(this.accountsFile, 'utf-8');
        const list: AuthAccount[] = JSON.parse(raw);
        this.accounts.clear();
        for (const acc of list) {
          if (this.isProductionMode()) {
            if (acc.id === 'OWNER_ROOT_3YPAFKI2' || acc.isLifetimeSuperAdmin) {
              if (acc.id !== 'ROOT_SUPER_ADMIN_SUITE_RUNNER') {
                this.accounts.set(acc.id, acc);
              }
            }
          } else {
            this.accounts.set(acc.id, acc);
          }
        }
      } catch (e) {
        console.error('[STORAGE] Corrupt accounts file:', e);
      }
    }

    if (this.isProductionMode()) {
      return;
    }

    // 3. Load Access Invitations (local development only)
    if (fs.existsSync(this.invitationsFile)) {
      try {
        const raw = fs.readFileSync(this.invitationsFile, 'utf-8');
        const list: AccessInvitation[] = JSON.parse(raw);
        this.invitations.clear();
        for (const inv of list) {
          this.invitations.set(inv.id, inv);
        }
      } catch (e) {
        console.error('[STORAGE] Corrupt invitations file:', e);
      }
    }

    // 4. Load Audit Logs (local development only)
    if (fs.existsSync(this.auditFile)) {
      try {
        const raw = fs.readFileSync(this.auditFile, 'utf-8');
        this.auditLogs = JSON.parse(raw);
      } catch {
        this.auditLogs = [];
      }
    }

    // 5. Load Customer Records (local development only)
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
      } catch (e) {
        console.error('[STORAGE] Corrupt customers file:', e);
      }
    }
  }

  public syncOwnershipRecord(record: Partial<SystemOwnershipRecord>): void {
    if (!record) return;
    if (record.isInitialized && record.ownerUserId) {
      this.ownership = {
        isInitialized: true,
        lockdownEnforced: Boolean(record.lockdownEnforced ?? true),
        ownerUserId: record.ownerUserId,
        ownerEmail: record.ownerEmail || this.ownership.ownerEmail || 'eromoseledavidson68@gmail.com',
        ownerFullName: record.ownerFullName || this.ownership.ownerFullName || 'David Eromosele',
        establishedAt: record.establishedAt || this.ownership.establishedAt || '2026-10-27T12:29:12.967Z',
        setupVersion: Number(record.setupVersion || this.ownership.setupVersion || 1),
      };
    }
  }

  public getOwnerUserId(): string {
    return this.ownership.ownerUserId || 'OWNER_ROOT_3YPAFKI2';
  }

  public isVerifiedOwner(uid?: string | null, email?: string | null): boolean {
    if (!uid || !email) return false;
    if (!this.isOwnerEmail(email)) return false;
    const cleanUid = uid.trim();
    const canonicalOwnerUid = this.getOwnerUserId();
    // Accept the authoritative Firestore ownerUserId ('OWNER_ROOT_3YPAFKI2') or the verified Firebase Auth UID for eromoseledavidson68@gmail.com
    if (
      cleanUid === canonicalOwnerUid ||
      cleanUid === 'OWNER_ROOT_3YPAFKI2' ||
      cleanUid === 'pS1G6dcGFgT2fcH3d9yVeaIFHii2'
    ) {
      return true;
    }
    return false;
  }

  private syncAccountToFirestore(account: AuthAccount): void {
    if (!account || !account.id || !account.email) return;
    if (account.isLifetimeSuperAdmin || account.role === 'LIFETIME_SUPER_ADMIN') {
      const mfaFields: Record<string, any> = {
        mfaRequired: Boolean(account.mfaRequired),
        ...(account.passwordHash ? { passwordHash: account.passwordHash } : {}),
        ...(account.passwordSalt ? { passwordSalt: account.passwordSalt } : {}),
        ...(account.totpSecret ? { totpSecret: account.totpSecret } : {}),
        ...(Array.isArray(account.recoveryCodeHashes) ? { recoveryCodeHashes: account.recoveryCodeHashes } : {}),
        ...(Array.isArray(account.consumedTotpSteps) ? { consumedTotpSteps: account.consumedTotpSteps } : {}),
        securityVersion: account.securityVersion || 1,
        updatedAt: new Date().toISOString(),
      };
      writeFirestoreDocument('admins', account.id, mfaFields).catch(() => {});
      writeFirestoreDocument('users', account.id, mfaFields).catch(() => {});
      return;
    }
    const role: 'ADMIN' | 'STAFF' = account.role === 'ADMIN' ? 'ADMIN' : 'STAFF';
    const [parsedSalt, parsedHash] =
      account.accessCodeHash && account.accessCodeHash.includes(':')
        ? account.accessCodeHash.split(':', 2)
        : [account.accessCodeSalt, account.accessCodeHash];
    const combinedAccessHash =
      parsedSalt && parsedHash ? `${parsedSalt}:${parsedHash}` : account.accessCodeHash;

    writeFirestoreUserProfile({
      uid: account.id,
      fullName: account.fullName,
      email: account.email,
      phone: account.phone || '+234 800 000 0000',
      role,
      roleTitle: account.roleTitle || account.position || account.duty || (role === 'ADMIN' ? 'Account Manager' : 'Customer Registration Officer'),
      duty: account.duty || account.position || account.roleTitle || (role === 'ADMIN' ? 'Account Manager' : 'Customer Registration Officer'),
      position: account.position || account.duty || account.roleTitle,
      dashboardRoute: account.dashboardRoute || getDedicatedRouteForUser(account),
      assignedProgramme: account.assignedProgramme,
      status: account.status,
      createdBy: account.createdBy || this.getOwnerUserId(),
      createdAt: account.createdAt || new Date().toISOString(),
      accessCodeHash: combinedAccessHash,
      accessCodeSalt: account.accessCodeSalt || parsedSalt,
      accessCodeMasked: account.accessCodeMasked,
      passwordHash: account.passwordHash,
      passwordSalt: account.passwordSalt,
      mfaRequired: Boolean(account.mfaRequired),
      totpSecret: account.totpSecret,
      recoveryCodeHashes: account.recoveryCodeHashes,
      consumedTotpSteps: account.consumedTotpSteps,
      securityVersion: account.securityVersion || 1,
      permissions: account.permissions,
      staffCode: account.staffCode,
    }).catch(() => {});
  }

  private persistOwnership(): void {
    saveFirestoreSystemOwnership(this.ownership).catch(() => {});
    this.atomicSaveFile(this.ownershipFile, this.ownership);
  }

  private persistAccounts(): void {
    const list = Array.from(this.accounts.values());
    this.atomicSaveFile(this.accountsFile, list);
  }

  private persistInvitations(): void {
    const list = Array.from(this.invitations.values());
    for (const inv of list) {
      const { codeHash, codeSalt, ...rest } = inv;
      saveFirestoreInvitation({ ...rest, codeHash, codeSalt }).catch(() => {});
    }
    this.atomicSaveFile(this.invitationsFile, list);
  }

  private persistSessions(): void {
    // Never write plaintext session tokens to disk or Firestore.
    const hashedEntries = Array.from(this.sessions.entries()).map(([token, session]) => {
      const tokenHash = this.hashSessionToken(token);
      return [
        tokenHash,
        {
          ...session,
          token: '[REDACTED_HASHED]',
          tokenHash,
        },
      ];
    });
    this.atomicSaveFile(this.sessionsFile, hashedEntries);
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
    saveFirestoreAuditLog(record).catch(() => {});
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

    // If the authoritative Lifetime Super Admin record (matched by UID + email against system_ownership)
    // was migrated from Firestore without an initialized PBKDF2 password hash, seal and persist
    // the master password hash on first verified sign-in.
    if (
      !isValid &&
      (!account.passwordHash || !account.passwordSalt) &&
      (account.role === 'LIFETIME_SUPER_ADMIN' || account.isLifetimeSuperAdmin) &&
      this.ownership.isInitialized &&
      this.isVerifiedOwner(account.uid || account.id, account.email) &&
      cleanPassword.length >= 6
    ) {
      account.passwordSalt = generateSalt();
      account.passwordHash = hashPassword(cleanPassword, account.passwordSalt);
      this.persistAccounts();
      this.syncAccountToFirestore(account);
      isValid = true;
      this.recordAudit({
        actorId: account.id,
        actorName: account.fullName,
        actorRole: account.role,
        action: 'SUPER_ADMIN_CREDENTIAL_HASH_SYNCHRONIZED',
        resource: '/api/auth/login',
        details: `Authoritative Lifetime Super Admin credential hash synchronized and sealed for ${account.id}.`,
        ip,
        status: 'SUCCESS',
      });
    }

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

    // Strict Super Admin Ownership Verification against system_ownership
    if (account.role === 'LIFETIME_SUPER_ADMIN' || account.isLifetimeSuperAdmin) {
      const uidToCheck = account.uid || account.id;
      if (!this.ownership.isInitialized || !this.isVerifiedOwner(uidToCheck, account.email)) {
        this.recordAudit({
          actorId: account.id,
          actorName: account.fullName,
          actorRole: account.role,
          action: 'SUPER_ADMIN_OWNERSHIP_MISMATCH',
          resource: '/api/auth/login',
          details: `Rejected Super Admin login for ${account.email} (${uidToCheck}): UID does not match system_ownership record (${this.getOwnerUserId()}).`,
          ip,
          status: 'DENIED',
        });
        return {
          success: false,
          error: 'Access Denied: Account does not match the authoritative Lifetime Super Admin ownership record.',
        };
      }
    }

    this.resetRateLimit(cleanIdentifier, ip);
    return { success: true, account };
  }

  // -------------------------------------------------------------------------
  // Genuine RFC 6238 TOTP Multi-Factor Authentication (Stateless + Firestore-Backed)
  // -------------------------------------------------------------------------
  private createSignedMfaChallengeToken(payload: {
    u: string;
    e: string;
    exp: number;
    n: string;
  }): string {
    const jsonStr = JSON.stringify(payload);
    const b64 = Buffer.from(jsonStr, 'utf-8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    const sig = crypto
      .createHmac('sha256', this.getSessionHmacSecret())
      .update(`mfa:${b64}`)
      .digest('hex');
    return `tmr_mfa1_${b64}_${sig}`;
  }

  public extractMfaChallengeUser(tempToken: string): { userId: string; email: string; expiresAt: number } | null {
    if (!tempToken || this.revokedTokens.has(tempToken)) return null;
    const mem = this.mfaChallenges.get(tempToken);
    if (mem) {
      return { userId: mem.userId, email: mem.email, expiresAt: mem.expiresAt };
    }
    if (!tempToken.startsWith('tmr_mfa1_')) return null;
    const parts = tempToken.split('_');
    if (parts.length < 4) return null;
    const sig = parts[parts.length - 1];
    const b64 = parts.slice(2, parts.length - 1).join('_');

    try {
      const sigBuf = Buffer.from(sig, 'hex');
      let signatureMatched = false;
      for (const secret of this.getSessionHmacSecretCandidates()) {
        const expectedSig = crypto
          .createHmac('sha256', secret)
          .update(`mfa:${b64}`)
          .digest('hex');
        const expBuf = Buffer.from(expectedSig, 'hex');
        if (sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf)) {
          signatureMatched = true;
          break;
        }
      }
      if (!signatureMatched) {
        return null;
      }
      const padded = b64.replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(Buffer.from(padded, 'base64').toString('utf-8'));
      if (!payload || !payload.u || !payload.e || typeof payload.exp !== 'number') {
        return null;
      }
      return {
        userId: String(payload.u),
        email: String(payload.e),
        expiresAt: Number(payload.exp),
      };
    } catch {
      return null;
    }
  }

  public initiateMfaChallenge(account: AuthAccount): {
    tempToken: string;
    maskedDestination: string;
    expiresInSeconds: number;
  } {
    const expiresAt = Date.now() + this.MFA_LIFETIME_MS;
    const tempToken = this.createSignedMfaChallengeToken({
      u: account.id,
      e: account.email,
      exp: expiresAt,
      n: generateSecureToken(8),
    });

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

  public setupAccountMfa(userId: string): {
    success: boolean;
    secret?: string;
    uri?: string;
    recoveryCodes?: string[];
    error?: string;
  } {
    const account = this.accounts.get(userId);
    if (!account) {
      return { success: false, error: 'Account not found.' };
    }
    const { secret, uri } = generateTotpSecret();
    const { plainCodes, hashedCodes } = generateRecoveryCodes();
    account.totpSecret = secret;
    account.recoveryCodeHashes = hashedCodes;
    account.consumedTotpSteps = [];
    this.persistAccounts();
    this.syncAccountToFirestore(account);
    return {
      success: true,
      secret,
      uri,
      recoveryCodes: plainCodes,
    };
  }

  public confirmAccountMfa(userId: string, code: string): {
    success: boolean;
    error?: string;
  } {
    const account = this.accounts.get(userId);
    if (!account || !account.totpSecret) {
      return { success: false, error: 'MFA setup has not been initiated for this account.' };
    }
    const consumedSet = new Set<number>(account.consumedTotpSteps || []);
    const verifyResult = verifyTotpCode(account.totpSecret, code, consumedSet);
    if (!verifyResult.valid) {
      return { success: false, error: verifyResult.error || 'Invalid 6-digit TOTP verification code.' };
    }
    account.consumedTotpSteps = Array.from(consumedSet);
    account.mfaRequired = true;
    this.persistAccounts();
    this.syncAccountToFirestore(account);
    return { success: true };
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
    if (!tempToken || this.revokedTokens.has(tempToken)) {
      return { success: false, error: 'MFA challenge session expired or invalid. Please sign in again.' };
    }

    let challenge = this.mfaChallenges.get(tempToken);
    if (!challenge) {
      const extracted = this.extractMfaChallengeUser(tempToken);
      if (extracted) {
        challenge = {
          tempToken,
          userId: extracted.userId,
          email: extracted.email,
          expiresAt: extracted.expiresAt,
          attempts: 0,
        };
        this.mfaChallenges.set(tempToken, challenge);
      }
    }

    if (!challenge) {
      return { success: false, error: 'MFA challenge session expired or invalid. Please sign in again.' };
    }

    if (Date.now() > challenge.expiresAt) {
      this.mfaChallenges.delete(tempToken);
      this.revokedTokens.add(tempToken);
      return { success: false, error: 'MFA challenge has expired. Please sign in again.' };
    }

    challenge.attempts += 1;
    if (challenge.attempts > 3) {
      this.mfaChallenges.delete(tempToken);
      this.revokedTokens.add(tempToken);
      return { success: false, error: 'Too many incorrect MFA verification attempts. Challenge revoked.' };
    }

    const account = this.accounts.get(challenge.userId) || this.findAccountByIdentifier(challenge.email);
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
      this.syncAccountToFirestore(account);
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
      this.syncAccountToFirestore(account);

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
    this.revokedTokens.add(tempToken);

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
      'teamacro-a1849-authoritative-hmac-session-key-v1'
    );
  }

  private getSessionHmacSecretCandidates(): string[] {
    const candidates = [
      this.getSessionHmacSecret(),
      'teamacro-a1849-authoritative-hmac-session-key-v1',
      process.env.SESSION_SECRET,
      process.env.ROOT_SETUP_SECRET,
      process.env.FIREBASE_SERVICE_ACCOUNT_KEY,
      process.env.FIREBASE_PRIVATE_KEY,
    ].filter((s): s is string => typeof s === 'string' && s.length > 0);
    return Array.from(new Set(candidates));
  }

  private createSignedSessionToken(payload: {
    u: string;
    e: string;
    n: string;
    r: UserRole;
    rt: string;
    pos?: string;
    dr?: string;
    ap?: string;
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

    try {
      const sigBuf = Buffer.from(sig, 'hex');
      let signatureMatched = false;
      for (const secret of this.getSessionHmacSecretCandidates()) {
        const expectedSig = crypto
          .createHmac('sha256', secret)
          .update(b64)
          .digest('hex');
        const expBuf = Buffer.from(expectedSig, 'hex');
        if (sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf)) {
          signatureMatched = true;
          break;
        }
      }
      if (!signatureMatched) {
        return null;
      }
      const padded = b64.replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(Buffer.from(padded, 'base64').toString('utf-8'));
      if (!payload || typeof payload.exp !== 'number' || Date.now() > payload.exp) {
        return null;
      }
      const pos = payload.pos || payload.rt || payload.r;
      const dr = payload.dr || getDedicatedRouteForUser({
        role: payload.r,
        roleTitle: payload.rt || payload.r,
        position: pos,
        isLifetimeSuperAdmin: Boolean(payload.sa),
      });
      return {
        token,
        userId: payload.u,
        email: payload.e,
        fullName: payload.n,
        role: payload.r,
        roleTitle: payload.rt || payload.r,
        position: pos,
        dashboardRoute: dr,
        assignedProgramme: payload.ap,
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
    const canonicalPos = normalizeCanonicalPosition(account.position || account.duty || account.roleTitle, account.role);
    const position = canonicalPos || account.position || account.duty || account.roleTitle;
    const dashboardRoute = getDedicatedRouteForUser({
      role: account.role,
      roleTitle: account.roleTitle,
      duty: account.duty,
      position,
      dashboardRoute: account.dashboardRoute,
      isLifetimeSuperAdmin: account.isLifetimeSuperAdmin,
    });
    const token = this.createSignedSessionToken({
      u: account.id,
      e: account.email,
      n: account.fullName,
      r: account.role,
      rt: account.roleTitle,
      pos: position,
      dr: dashboardRoute,
      ap: account.assignedProgramme,
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
      position,
      dashboardRoute,
      assignedProgramme: account.assignedProgramme,
      permissions: account.permissions,
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
    const tokenHash = this.hashSessionToken(token);
    saveFirestoreSessionHash({
      tokenHash,
      userId: session.userId,
      email: session.email,
      role: session.role,
      mfaVerified: session.mfaVerified,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      lastSeenAt: now,
      revoked: false,
    }).catch(() => {});
    this.persistAccounts();
    this.persistSessions();
    return session;
  }

  public syncSuperAdminSession(
    data: { uid: string; email: string; fullName: string; phone?: string; password?: string },
    ip: string,
    userAgent: string
  ): UserSession {
    const cleanEmail = data.email.trim().toLowerCase();
    this.resetRateLimit(cleanEmail, ip);

    const canonicalUid = this.getOwnerUserId();
    const effectiveUid =
      data.uid === 'pS1G6dcGFgT2fcH3d9yVeaIFHii2' || data.uid === canonicalUid
        ? canonicalUid
        : data.uid || canonicalUid;

    let account =
      this.accounts.get(effectiveUid) ||
      this.accounts.get(canonicalUid) ||
      this.findAccountByIdentifier(cleanEmail);

    if (!account) {
      const salt = data.password ? generateSalt() : '';
      const pwdHash = data.password && salt ? hashPassword(data.password, salt) : '';
      account = {
        id: canonicalUid,
        uid: canonicalUid,
        email: cleanEmail,
        username: cleanEmail.split('@')[0].toLowerCase(),
        fullName: data.fullName.trim() || this.ownership.ownerFullName || 'David Eromosele',
        phone: (data.phone || '+234 800 000 0001').trim(),
        role: 'LIFETIME_SUPER_ADMIN',
        roleTitle: 'Lifetime Super Admin & Chief Executive',
        isLifetimeSuperAdmin: true,
        status: 'active',
        active: true,
        passwordSalt: salt,
        passwordHash: pwdHash,
        mfaRequired: false,
        createdAt: new Date().toISOString(),
        securityVersion: 1,
      };
      this.accounts.set(canonicalUid, account);
      this.persistAccounts();
    } else if (data.password) {
      account.passwordSalt = generateSalt();
      account.passwordHash = hashPassword(data.password, account.passwordSalt);
      this.persistAccounts();
      this.syncAccountToFirestore(account);
    }

    if (!this.ownership.isInitialized || !this.ownership.ownerUserId) {
      this.ownership = {
        isInitialized: true,
        lockdownEnforced: true,
        ownerUserId: canonicalUid,
        ownerEmail: cleanEmail,
        ownerFullName: data.fullName.trim() || account.fullName || 'David Eromosele',
        establishedAt: account.createdAt,
        setupVersion: 1,
      };
      this.persistOwnership();
    }

    const session = this.createSession(account, ip, userAgent, true);
    this.persistSessions();
    return session;
  }

  private deletedIdentifiers: Set<string> = new Set();

  public isDeletedAccount(idOrEmail?: string): boolean {
    if (!idOrEmail) return false;
    return this.deletedIdentifiers.has(idOrEmail.trim().toLowerCase());
  }

  public clearDeletedAccountMarker(idOrEmail?: string): void {
    if (!idOrEmail) return;
    this.deletedIdentifiers.delete(idOrEmail.trim().toLowerCase());
  }

  public hasWarmSession(token: string): boolean {
    if (!token || this.revokedTokens.has(token)) return false;
    const tokenHash = this.hashSessionToken(token);
    if (this.revokedTokenHashes.has(tokenHash)) return false;
    return this.sessions.has(token);
  }

  public getSessionTokenHash(token: string): string {
    return this.hashSessionToken(token);
  }

  public peekSessionToken(token: string): UserSession | null {
    if (!token || this.revokedTokens.has(token)) return null;
    const tokenHash = this.hashSessionToken(token);
    if (this.revokedTokenHashes.has(tokenHash)) return null;
    const mem = this.sessions.get(token);
    if (mem) return mem;
    if (token.startsWith('tmr_s1_')) {
      return this.verifySignedSessionToken(token);
    }
    return null;
  }

  public markTokenRevokedInMemory(token: string): void {
    if (!token) return;
    this.revokedTokens.add(token);
    const tokenHash = this.hashSessionToken(token);
    this.revokedTokenHashes.add(tokenHash);
    this.sessions.delete(token);
  }

  /**
   * Simulates a stateless Vercel serverless instance cold start by clearing in-memory
   * sessions, MFA challenges, invitations, and non-owner accounts.
   */
  public simulateServerlessColdStart(): void {
    this.sessions.clear();
    this.mfaChallenges.clear();
    this.invitations.clear();
    this.revokedTokens.clear();
    this.revokedTokenHashes.clear();
    for (const [id, acc] of Array.from(this.accounts.entries())) {
      if (!acc.isLifetimeSuperAdmin && acc.role !== 'LIFETIME_SUPER_ADMIN') {
        this.accounts.delete(id);
      }
    }
  }

  public validateSession(token: string): UserSession | null {
    if (!token || this.revokedTokens.has(token)) return null;
    const tokenHash = this.hashSessionToken(token);
    if (this.revokedTokenHashes.has(tokenHash)) return null;

    let session = this.sessions.get(token);

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

    // Auto-hydrate Lifetime Super Admin account ONLY if session UID and email match verified ownership record
    if (
      !account &&
      session.role === 'LIFETIME_SUPER_ADMIN' &&
      this.isVerifiedOwner(session.userId, session.email)
    ) {
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
      if (session.role === 'LIFETIME_SUPER_ADMIN') {
        return null;
      }
      const resolvedPos =
        normalizeCanonicalPosition(session.position || session.roleTitle, session.role) ||
        session.position ||
        session.roleTitle;
      account = {
        id: session.userId,
        uid: session.userId,
        email: session.email,
        username: session.email.split('@')[0],
        fullName: session.fullName,
        phone: '+234 800 000 0000',
        role: session.role,
        roleTitle: resolvedPos,
        duty: resolvedPos,
        position: resolvedPos,
        dashboardRoute: session.dashboardRoute || getDedicatedRouteForUser(session),
        isLifetimeSuperAdmin: false,
        status: 'active',
        active: true,
        passwordSalt: '',
        passwordHash: '',
        mfaRequired: false,
        permissions: this.getDefaultPermissionsForDuty(resolvedPos),
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
      const tokenHash = this.hashSessionToken(token);
      this.revokedTokenHashes.add(tokenHash);
      revokeFirestoreSessionByHash(tokenHash).catch(() => {});
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
        const tokenHash = this.hashSessionToken(token);
        this.revokedTokenHashes.add(tokenHash);
        revokeFirestoreSessionByHash(tokenHash).catch(() => {});
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
        const account = this.accounts.get(session.userId) || this.findAccountByIdentifier(session.email);
        const dedicatedRoute = getDedicatedRouteForUser(account || session);
        this.recordAudit({
          actorId: session.userId,
          actorName: session.fullName,
          actorRole: session.role,
          action: 'ATTEMPTED_PRIVILEGE_ESCALATION',
          resource: '/supa-admin',
          details: `Non-Super-Admin user (${session.role} / ${session.position || session.roleTitle}) attempted unauthorized access to root portal.`,
          ip: session.ip,
          status: 'DENIED',
        });
        return {
          allowed: false,
          statusCode: 403,
          reason: 'Access Denied: The Super Admin portal is strictly reserved for the unique Lifetime Super Admin.',
          session,
          targetRoute: dedicatedRoute,
        };
      }

      return { allowed: true, statusCode: 200, session, targetRoute: '/supa-admin' };
    }

    const account = this.accounts.get(session.userId) || this.findAccountByIdentifier(session.email);
    const userAssignedRoute = getDedicatedRouteForUser(account || session);
    const userPosition =
      normalizeCanonicalPosition(
        account?.position || account?.duty || account?.roleTitle || session.position || session.roleTitle,
        account?.role || session.role
      ) ||
      session.position ||
      session.roleTitle;

    // Dedicated Admin Position Routes: /admin/accountmanager, /admin/operationsmanager, /admin/auditor
    if (
      normalized === '/admin/accountmanager' ||
      normalized === '/admin/operationsmanager' ||
      normalized === '/admin/auditor'
    ) {
      if (session.role === 'LIFETIME_SUPER_ADMIN' && session.isLifetimeSuperAdmin) {
        return { allowed: true, statusCode: 200, session, targetRoute: normalized };
      }
      if (session.role === 'ADMIN' && userAssignedRoute.toLowerCase() === normalized) {
        return { allowed: true, statusCode: 200, session, targetRoute: userAssignedRoute };
      }
      this.recordAudit({
        actorId: session.userId,
        actorName: session.fullName,
        actorRole: session.role,
        action: 'UNAUTHORIZED_POSITION_ROUTE_ACCESS',
        resource: normalized,
        details: `User ${session.fullName} (${userPosition}) attempted to access ${normalized} instead of assigned route ${userAssignedRoute}.`,
        ip: session.ip,
        status: 'DENIED',
      });
      return {
        allowed: false,
        statusCode: 403,
        reason: `Access Denied: Your assigned position (${userPosition}) only authorizes access to ${userAssignedRoute}.`,
        session,
        targetRoute: userAssignedRoute,
      };
    }

    // Generic /admin route -> redirects Admin to their specific position route
    if (normalized === '/admin') {
      if (session.role === 'LIFETIME_SUPER_ADMIN' && session.isLifetimeSuperAdmin) {
        return { allowed: true, statusCode: 200, session, targetRoute: '/admin' };
      }
      if (session.role === 'ADMIN') {
        return { allowed: true, statusCode: 200, session, targetRoute: userAssignedRoute };
      }
      this.recordAudit({
        actorId: session.userId,
        actorName: session.fullName,
        actorRole: session.role,
        action: 'UNAUTHORIZED_ADMIN_PORTAL_ACCESS',
        resource: '/admin',
        details: `Staff user (${session.role} / ${userPosition}) attempted unauthorized access to Admin portal.`,
        ip: session.ip,
        status: 'DENIED',
      });
      return {
        allowed: false,
        statusCode: 403,
        reason: 'Access Denied: Administrative role clearance required.',
        session,
        targetRoute: userAssignedRoute,
      };
    }

    // Dedicated Staff Position Routes:
    // /staff/customer-registration, /staff/payment-collection, /staff/loan-officer, /staff/accounts-officer
    if (
      normalized === '/staff/customer-registration' ||
      normalized === '/staff/payment-collection' ||
      normalized === '/staff/loan-officer' ||
      normalized === '/staff/accounts-officer'
    ) {
      if (session.role === 'LIFETIME_SUPER_ADMIN' && session.isLifetimeSuperAdmin) {
        return { allowed: true, statusCode: 200, session, targetRoute: normalized };
      }
      if (userAssignedRoute.toLowerCase() === normalized) {
        return { allowed: true, statusCode: 200, session, targetRoute: userAssignedRoute };
      }
      this.recordAudit({
        actorId: session.userId,
        actorName: session.fullName,
        actorRole: session.role,
        action: 'UNAUTHORIZED_POSITION_ROUTE_ACCESS',
        resource: normalized,
        details: `User ${session.fullName} (${userPosition}) attempted to access ${normalized} instead of assigned route ${userAssignedRoute}.`,
        ip: session.ip,
        status: 'DENIED',
      });
      return {
        allowed: false,
        statusCode: 403,
        reason: `Access Denied: Your assigned position (${userPosition}) only authorizes access to ${userAssignedRoute}.`,
        session,
        targetRoute: userAssignedRoute,
      };
    }

    // Generic /staff route -> resolves to user's dedicated route
    if (normalized === '/staff' || normalized.startsWith('/staff/')) {
      if (session.role === 'LIFETIME_SUPER_ADMIN' && session.isLifetimeSuperAdmin) {
        return { allowed: true, statusCode: 200, session, targetRoute: '/staff' };
      }
      if (session.role === 'ADMIN') {
        return {
          allowed: false,
          statusCode: 403,
          reason: `Access Denied: Administrators should use their dedicated dashboard (${userAssignedRoute}).`,
          session,
          targetRoute: userAssignedRoute,
        };
      }
      const staffRoles: string[] = [
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
        'ACCOUNTS_OFFICER',
      ];
      if (staffRoles.includes(session.role) || session.role.toUpperCase() === 'STAFF') {
        return { allowed: true, statusCode: 200, session, targetRoute: userAssignedRoute };
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
  // - Admin (Operations Manager with canManageStaff) can create Staff only (cannot create Admin or Super Admin)
  // - Auditor is strictly Read-Only
  // - Staff cannot create Admin or Super Admin
  // -------------------------------------------------------------------------
  public static readonly ALLOWED_STAFF_DUTIES: ReadonlySet<string> = new Set([
    'customer registration officer',
    'payment collection officer',
    'loan officer',
    'accounts officer',
    'credit operations officer',
    'operations manager',
    'auditor / read-only user',
    'field collector',
    'field officer',
    'customer service',
    'accountant',
    'auditor',
    'operations staff',
    'operational staff',
    'field operations & customer servicing',
    'teller',
    'compliance officer',
  ]);

  public static readonly ALLOWED_ADMIN_DUTIES: ReadonlySet<string> = new Set([
    'account manager',
    'operations manager',
    'auditor',
    'admin / general branch administrator',
    'executive administrator',
    'credit & risk portfolio oversight',
    'branch operations administrator',
    'compliance & audit administrator',
    'treasury & ledger administrator',
    'general branch administrator',
    'branch manager',
  ]);

  public isValidOperationalDuty(duty: string, targetRole: 'ADMIN' | 'STAFF'): boolean {
    const normalized = (duty || '').trim().toLowerCase();
    if (!normalized) return false;
    if (targetRole === 'ADMIN') {
      return (
        ServerAuthManager.ALLOWED_ADMIN_DUTIES.has(normalized) ||
        ServerAuthManager.ALLOWED_STAFF_DUTIES.has(normalized)
      );
    }
    return ServerAuthManager.ALLOWED_STAFF_DUTIES.has(normalized);
  }

  public getDedicatedRouteForAccount(accountOrSession?: Partial<AuthAccount & UserSession> | null): string {
    return getDedicatedRouteForUser(accountOrSession as any);
  }

  public isAuditorSession(session?: UserSession | AuthAccount | null): boolean {
    if (!session) return false;
    if (session.isLifetimeSuperAdmin || session.role === 'LIFETIME_SUPER_ADMIN') return false;
    const acc = 'userId' in session ? this.accounts.get(session.userId) : session;
    return isReadOnlyAuditor(acc || session);
  }

  public getAccountAccessCodeSaltedHash(uid: string): string | undefined {
    const acc = this.accounts.get(uid);
    if (!acc || !acc.accessCodeSalt || !acc.accessCodeHash) return undefined;
    return `${acc.accessCodeSalt}:${acc.accessCodeHash}`;
  }

  public getAccountAuthStorageFields(uid: string): {
    accessCodeHash?: string;
    accessCodeSalt?: string;
    accessCodeMasked?: string;
    passwordHash?: string;
    passwordSalt?: string;
    mfaRequired?: boolean;
    totpSecret?: string;
    recoveryCodeHashes?: string[];
    consumedTotpSteps?: number[];
    securityVersion?: number;
  } {
    const acc = this.accounts.get(uid);
    if (!acc) return {};
    return {
      accessCodeHash: acc.accessCodeSalt && acc.accessCodeHash ? `${acc.accessCodeSalt}:${acc.accessCodeHash}` : acc.accessCodeHash,
      accessCodeSalt: acc.accessCodeSalt,
      accessCodeMasked: acc.accessCodeMasked,
      passwordHash: acc.passwordHash,
      passwordSalt: acc.passwordSalt,
      mfaRequired: acc.mfaRequired,
      totpSecret: acc.totpSecret,
      recoveryCodeHashes: acc.recoveryCodeHashes,
      consumedTotpSteps: acc.consumedTotpSteps,
      securityVersion: acc.securityVersion || 1,
    };
  }

  public upsertInvitationFromFirestore(raw: Record<string, any>): void {
    if (!raw || !raw.id || !raw.codeHash || !raw.codeSalt) return;
    const inv: AccessInvitation = {
      id: String(raw.id),
      email: String(raw.email || 'pending@authorization.internal').toLowerCase().trim(),
      accessType: raw.accessType === 'Admin' ? 'Admin' : 'Staff',
      duty: String(raw.duty || 'Customer Registration Officer'),
      codeHash: String(raw.codeHash),
      codeSalt: String(raw.codeSalt),
      codeMasked: raw.codeMasked ? String(raw.codeMasked) : undefined,
      expiresAt: Number(raw.expiresAt || Date.now() + 7 * 24 * 60 * 60 * 1000),
      used: Boolean(raw.used),
      revoked: Boolean(raw.revoked),
      attempts: Number(raw.attempts || 0),
      maxAttempts: Number(raw.maxAttempts || 5),
      createdAt: String(raw.createdAt || new Date().toISOString()),
      createdBy: String(raw.createdBy || this.getOwnerUserId()),
      createdByName: raw.createdByName ? String(raw.createdByName) : undefined,
      fullName: raw.fullName ? String(raw.fullName) : undefined,
      phone: raw.phone ? String(raw.phone) : undefined,
      assignedPermissions:
        raw.assignedPermissions && typeof raw.assignedPermissions === 'object'
          ? raw.assignedPermissions
          : undefined,
    };
    this.invitations.set(inv.id, inv);
  }

  public removeAccountOnRollback(uid: string, email?: string): void {
    if (uid && this.accounts.has(uid)) {
      this.accounts.delete(uid);
    }
    if (email) {
      const clean = email.trim().toLowerCase();
      for (const [key, acc] of this.accounts.entries()) {
        if (acc.email.toLowerCase() === clean) {
          this.accounts.delete(key);
        }
      }
      for (const [invId, inv] of this.invitations.entries()) {
        if (inv.email.toLowerCase() === clean) {
          this.invitations.delete(invId);
        }
      }
      this.persistInvitations();
    }
    this.persistAccounts();
  }

  public createStaffAccount(
    actorSession: UserSession,
    data: {
      fullName: string;
      email: string;
      phone: string;
      username?: string;
      role?: UserRole;
      roleTitle?: string;
      duty?: string;
      position?: string;
      dashboardRoute?: string;
      assignedProgramme?: string;
      operationalResponsibility?: string;
      accessCode: string;
      password?: string;
      initialPassword?: string;
      assignedModules?: string[];
      permissions?: Record<string, boolean>;
      status?: 'active' | 'suspended' | 'inactive';
      firebaseUid?: string;
      allowUpdate?: boolean;
    }
  ): {
    success: boolean;
    message?: string;
    error?: string;
    statusCode?: number;
    isDuplicate?: boolean;
    account?: Record<string, any>;
    invitation?: any;
    data?: any;
  } {
    // 1. Invariant: Nobody can create a Lifetime Super Admin
    const rawRole = String(data.role || 'STAFF').trim().toUpperCase();
    if (rawRole === 'LIFETIME_SUPER_ADMIN' || rawRole === 'SUPER_ADMIN') {
      const error = 'Security Invariant: Creation of a second Lifetime Super Admin is strictly prohibited.';
      return {
        success: false,
        statusCode: 403,
        message: error,
        error,
      };
    }

    if (rawRole !== 'STAFF' && rawRole !== 'ADMIN') {
      const error = 'Invalid role: Account creation route may only assign STAFF or ADMIN role.';
      return {
        success: false,
        statusCode: 400,
        message: error,
        error,
      };
    }

    // 2. Role hierarchy invariant:
    // - Only Lifetime Super Admin can create ADMIN accounts
    // - Lifetime Super Admin OR an active non-Auditor ADMIN with canManageStaff clearance can create STAFF accounts
    if (rawRole === 'ADMIN' && (actorSession.role !== 'LIFETIME_SUPER_ADMIN' || !actorSession.isLifetimeSuperAdmin)) {
      const error = 'Privilege Violation: Only the Lifetime Super Admin can create Administrator accounts.';
      this.recordAudit({
        actorId: actorSession.userId,
        actorName: actorSession.fullName,
        actorRole: actorSession.role,
        action: 'UNAUTHORIZED_ADMIN_CREATION_ATTEMPT',
        resource: '/api/auth/create-staff',
        details: `Non-Super-Admin user (${actorSession.role}) attempted to create an ADMIN account.`,
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

    const actorAccount = this.accounts.get(actorSession.userId);
    const isSuperAdmin = actorSession.role === 'LIFETIME_SUPER_ADMIN' && actorSession.isLifetimeSuperAdmin;
    const isAuthorizedAdmin =
      actorSession.role === 'ADMIN' &&
      !this.isAuditorSession(actorSession) &&
      (actorAccount?.permissions?.canManageStaff !== false && actorSession.permissions?.canManageStaff !== false);

    if (!isSuperAdmin && !isAuthorizedAdmin) {
      const error = 'Privilege Violation: Insufficient administrative clearance to provision Staff accounts.';
      this.recordAudit({
        actorId: actorSession.userId,
        actorName: actorSession.fullName,
        actorRole: actorSession.role,
        action: 'UNAUTHORIZED_ACCOUNT_CREATION_ATTEMPT',
        resource: '/api/auth/create-staff',
        details: `Unauthorized user (${actorSession.role} / ${actorSession.position || actorSession.roleTitle}) attempted to create a Staff account.`,
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

    // 3. Validate mandatory inputs
    const fullName = data.fullName?.trim();
    const email = data.email?.trim().toLowerCase();
    const phone = data.phone?.trim();
    const accessCode = data.accessCode?.trim();
    const explicitDuty = (data.position || data.duty || data.roleTitle || data.operationalResponsibility || '').trim();
    const canonicalPos = normalizeCanonicalPosition(explicitDuty, rawRole);
    const roleTitle = canonicalPos || explicitDuty || (rawRole === 'ADMIN' ? 'Account Manager' : 'Customer Registration Officer');
    const assignedProgramme = (data.assignedProgramme || 'General Operations & Multi-Programme').trim();
    const requestedStatus: 'active' | 'suspended' | 'inactive' =
      data.status === 'suspended' ? 'suspended' : data.status === 'inactive' ? 'inactive' : 'active';
    const isActiveStatus = requestedStatus === 'active';

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

    if (!this.isValidOperationalDuty(roleTitle, rawRole === 'ADMIN' ? 'ADMIN' : 'STAFF')) {
      const error = `Invalid operational position "${roleTitle}". Please select an approved position from the allowed list.`;
      return {
        success: false,
        statusCode: 400,
        message: error,
        error,
      };
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

    const dashboardRoute =
      data.dashboardRoute ||
      getDedicatedRouteForUser({
        role: rawRole,
        roleTitle,
        duty: roleTitle,
        position: roleTitle,
        isLifetimeSuperAdmin: false,
      });

    const sanitizedPermissions = sanitizePermissionsForPosition(roleTitle, data.permissions);

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

      matchedInvitation.email = email;
      matchedInvitation.fullName = fullName;
      matchedInvitation.phone = phone;
      matchedInvitation.duty = roleTitle;
      matchedInvitation.position = roleTitle;
      matchedInvitation.dashboardRoute = dashboardRoute;
      matchedInvitation.assignedProgramme = assignedProgramme;
      matchedInvitation.assignedPermissions = sanitizedPermissions;
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
        accessType: rawRole === 'ADMIN' ? 'Admin' : 'Staff',
        duty: roleTitle,
        position: roleTitle,
        dashboardRoute,
        assignedProgramme,
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
        assignedPermissions: sanitizedPermissions,
      };
      this.invitations.set(invitationId, newInvitation);
      this.persistInvitations();
    }

    this.clearDeletedAccountMarker(email);
    if (data.firebaseUid) this.clearDeletedAccountMarker(data.firebaseUid);
    const username = (data.username?.trim() || email.split('@')[0]).toLowerCase();
    if (existingByEmail && existingByEmail.email.toLowerCase() === email) {
      if (data.firebaseUid && existingByEmail.id !== data.firebaseUid) {
        this.accounts.delete(existingByEmail.id);
        existingByEmail.id = data.firebaseUid;
      }
      existingByEmail.uid = data.firebaseUid || existingByEmail.uid || existingByEmail.id;
      existingByEmail.status = requestedStatus;
      existingByEmail.active = isActiveStatus;
      existingByEmail.is_active = isActiveStatus;
      existingByEmail.isActive = isActiveStatus;
      existingByEmail.verified = true;
      existingByEmail.isVerified = true;
      existingByEmail.fullName = fullName;
      existingByEmail.phone = phone;
      existingByEmail.role = (rawRole === 'ADMIN' ? 'ADMIN' : 'STAFF') as UserRole;
      existingByEmail.roleTitle = roleTitle;
      existingByEmail.duty = roleTitle;
      existingByEmail.position = roleTitle;
      existingByEmail.dashboardRoute = dashboardRoute;
      existingByEmail.assignedProgramme = assignedProgramme;
      existingByEmail.permissions = sanitizedPermissions;
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
        details: `${actorSession.role} ${actorSession.fullName} activated/updated Staff account for ${existingByEmail.fullName} (${existingByEmail.email}) as ${roleTitle} (${dashboardRoute}).`,
        ip: actorSession.ip,
        status: 'SUCCESS',
      });

      const safeAccount = {
        id: existingByEmail.id,
        uid: existingByEmail.uid || existingByEmail.id,
        email: existingByEmail.email,
        username: existingByEmail.username,
        fullName: existingByEmail.fullName,
        phone: existingByEmail.phone,
        role: existingByEmail.role,
        roleTitle: existingByEmail.roleTitle,
        duty: existingByEmail.duty,
        position: existingByEmail.position,
        dashboardRoute: existingByEmail.dashboardRoute,
        assignedProgramme: existingByEmail.assignedProgramme,
        staffId: existingByEmail.staffId || existingByEmail.id,
        staffCode: existingByEmail.staffCode,
        status: existingByEmail.status,
        active: existingByEmail.active,
        createdBy: existingByEmail.createdBy,
        createdAt: existingByEmail.createdAt,
        permissions: existingByEmail.permissions,
      };
      const msg = 'Staff account created successfully';
      return {
        success: true,
        statusCode: 201,
        message: msg,
        account: safeAccount,
        invitation: {
          codeMasked,
          accessType: existingByEmail.role === 'ADMIN' ? 'Admin' : 'Staff',
          duty: roleTitle,
          position: roleTitle,
          dashboardRoute,
          assignedProgramme,
        },
        data: {
          account: safeAccount,
          invitation: {
            codeMasked,
            accessType: existingByEmail.role === 'ADMIN' ? 'Admin' : 'Staff',
            duty: roleTitle,
            position: roleTitle,
            dashboardRoute,
            assignedProgramme,
          },
        },
      };
    }

    // 7. Initial password & Firebase UID linking (never echoed in response or logs)
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
      role: (rawRole === 'ADMIN' ? 'ADMIN' : 'STAFF') as UserRole,
      roleTitle,
      duty: roleTitle,
      position: roleTitle,
      dashboardRoute,
      assignedProgramme,
      isLifetimeSuperAdmin: false,
      status: requestedStatus,
      active: isActiveStatus,
      is_active: isActiveStatus,
      isActive: isActiveStatus,
      verified: true,
      isVerified: true,
      staffId: id,
      staffCode,
      passwordSalt: passSalt,
      passwordHash: hashPassword(initialPass, passSalt),
      accessCodeHash: codeHash,
      accessCodeSalt: codeSalt,
      accessCodeMasked: codeMasked,
      permissions: sanitizedPermissions,
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
      details: `${actorSession.role} ${actorSession.fullName} provisioned Staff account for ${newAccount.fullName} (${newAccount.email}) as ${roleTitle} (${dashboardRoute}) with UID ${id}.`,
      ip: actorSession.ip,
      status: 'SUCCESS',
    });

    const safeAccount = {
      id: newAccount.id,
      uid: newAccount.uid || newAccount.id,
      email: newAccount.email,
      username: newAccount.username,
      fullName: newAccount.fullName,
      phone: newAccount.phone,
      role: newAccount.role,
      roleTitle: newAccount.roleTitle,
      duty: newAccount.duty,
      position: newAccount.position,
      dashboardRoute: newAccount.dashboardRoute,
      assignedProgramme: newAccount.assignedProgramme,
      staffId: newAccount.staffId || newAccount.id,
      staffCode: newAccount.staffCode,
      status: newAccount.status,
      active: newAccount.active,
      createdBy: newAccount.createdBy,
      createdAt: newAccount.createdAt,
      permissions: newAccount.permissions,
    };
    const successMsg = 'Staff account created successfully';
    return {
      success: true,
      statusCode: 201,
      message: successMsg,
      account: safeAccount,
      invitation: {
        codeMasked,
        accessType: 'Staff',
        duty: roleTitle,
        position: roleTitle,
        dashboardRoute,
        assignedProgramme,
      },
      data: {
        account: safeAccount,
        invitation: {
          codeMasked,
          accessType: 'Staff',
          duty: roleTitle,
          position: roleTitle,
          dashboardRoute,
          assignedProgramme,
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
    const target = this.accounts.get(targetUserId) || this.findAccountByIdentifier(targetUserId);
    if (!target) {
      return { success: false, error: 'Target account not found.' };
    }

    if (target.isLifetimeSuperAdmin || this.isVerifiedOwner(target.id, target.email)) {
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
      this.revokeAllUserSessions(target.id);
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

  public deleteUserAccount(
    actorSession: UserSession,
    targetUserIdOrEmail: string,
    explicitEmail?: string
  ): {
    success: boolean;
    error?: string;
    deletedId?: string;
    deletedEmail?: string;
    deletedRole?: string;
  } {
    if (this.isAuditorSession(actorSession)) {
      return {
        success: false,
        error: 'Read-Only Restriction: Auditors are strictly prohibited from deleting accounts.',
      };
    }

    if (actorSession.role !== 'LIFETIME_SUPER_ADMIN' && actorSession.role !== 'ADMIN') {
      return {
        success: false,
        error: 'Insufficient administrative privileges to delete Admin or Staff accounts.',
      };
    }

    const cleanIdentifier = (targetUserIdOrEmail || '').trim();
    const cleanEmail = (explicitEmail || '').trim().toLowerCase();

    if (
      cleanIdentifier === 'OWNER_ROOT_3YPAFKI2' ||
      cleanIdentifier === 'LIFETIME_ROOT_SUPER_ADMIN_001' ||
      this.isOwnerEmail(cleanIdentifier) ||
      (cleanEmail && this.isOwnerEmail(cleanEmail))
    ) {
      return {
        success: false,
        error: 'Security Invariant: The Permanent Lifetime Super Admin account cannot be deleted.',
      };
    }

    const target =
      this.accounts.get(cleanIdentifier) ||
      this.findAccountByIdentifier(cleanIdentifier) ||
      (cleanEmail ? this.findAccountByIdentifier(cleanEmail) : null);

    if (target) {
      if (target.isLifetimeSuperAdmin || target.role === 'LIFETIME_SUPER_ADMIN' || this.isVerifiedOwner(target.id, target.email)) {
        return {
          success: false,
          error: 'Security Invariant: The Permanent Lifetime Super Admin account cannot be deleted.',
        };
      }

      if (target.id === actorSession.userId || target.email.toLowerCase() === actorSession.email.toLowerCase()) {
        return {
          success: false,
          error: 'You cannot delete your own currently signed-in account.',
        };
      }

      const deletedId = target.id;
      const deletedEmail = target.email;
      const deletedRole = target.role;

      this.deletedIdentifiers.add(deletedId.toLowerCase());
      this.deletedIdentifiers.add(deletedEmail.toLowerCase());
      if (cleanIdentifier) this.deletedIdentifiers.add(cleanIdentifier.toLowerCase());
      if (cleanEmail) this.deletedIdentifiers.add(cleanEmail.toLowerCase());

      this.revokeAllUserSessions(deletedId);
      this.accounts.delete(deletedId);

      for (const [key, acc] of Array.from(this.accounts.entries())) {
        if (acc.email.toLowerCase() === deletedEmail.toLowerCase() && !acc.isLifetimeSuperAdmin) {
          this.deletedIdentifiers.add(key.toLowerCase());
          this.accounts.delete(key);
        }
      }

      for (const [invId, inv] of Array.from(this.invitations.entries())) {
        if (inv.email.toLowerCase() === deletedEmail.toLowerCase()) {
          this.invitations.delete(invId);
        }
      }

      this.persistAccounts();
      this.persistInvitations();

      this.recordAudit({
        actorId: actorSession.userId,
        actorName: actorSession.fullName,
        actorRole: actorSession.role,
        action: 'DELETED_USER_ACCOUNT',
        resource: '/api/auth/delete-account',
        details: `${actorSession.role} (${actorSession.fullName}) permanently deleted ${deletedRole} account ${target.fullName} (${deletedEmail}, UID: ${deletedId}).`,
        ip: actorSession.ip,
        status: 'SUCCESS',
      });

      return {
        success: true,
        deletedId,
        deletedEmail,
        deletedRole,
      };
    }

    if (cleanIdentifier) this.deletedIdentifiers.add(cleanIdentifier.toLowerCase());
    if (cleanEmail) this.deletedIdentifiers.add(cleanEmail.toLowerCase());

    // Even if not in local memory on a cold-started instance, allow Firestore/Firebase Auth cleanup to proceed
    return {
      success: true,
      deletedId: cleanIdentifier,
      deletedEmail: cleanEmail || (cleanIdentifier.includes('@') ? cleanIdentifier.toLowerCase() : undefined),
      deletedRole: 'STAFF',
    };
  }

  public updateUserAccount(
    actorSession: UserSession,
    targetUserId: string,
    updates: {
      fullName?: string;
      email?: string;
      phone?: string;
      role?: 'ADMIN' | 'STAFF' | string;
      position?: string;
      duty?: string;
      roleTitle?: string;
      dashboardRoute?: string;
      assignedProgramme?: string;
      status?: 'active' | 'suspended' | 'inactive';
      permissions?: Record<string, boolean>;
      password?: string;
      accessCode?: string;
    }
  ): {
    success: boolean;
    error?: string;
    account?: Omit<AuthAccount, 'passwordHash' | 'passwordSalt' | 'totpSecret' | 'recoveryCodeHashes'>;
    previousRole?: string;
  } {
    if (this.isAuditorSession(actorSession)) {
      return {
        success: false,
        error: 'Read-Only Restriction: Auditors are strictly prohibited from modifying accounts.',
      };
    }

    const isSuperAdmin = actorSession.role === 'LIFETIME_SUPER_ADMIN' && actorSession.isLifetimeSuperAdmin;
    const isAdmin = actorSession.role === 'ADMIN';

    if (!isSuperAdmin && !isAdmin) {
      return {
        success: false,
        error: 'Insufficient administrative privileges to modify accounts.',
      };
    }

    const target =
      this.accounts.get(targetUserId) ||
      this.findAccountByIdentifier(targetUserId) ||
      (updates.email ? this.findAccountByIdentifier(updates.email) : null);

    if (!target) {
      return {
        success: false,
        error: 'Target user account not found.',
      };
    }

    if (target.isLifetimeSuperAdmin || target.role === 'LIFETIME_SUPER_ADMIN' || this.isVerifiedOwner(target.id, target.email)) {
      return {
        success: false,
        error: 'Security Invariant: The Permanent Lifetime Super Admin root account cannot be modified or demoted.',
      };
    }

    if (!isSuperAdmin && target.role === 'ADMIN') {
      return {
        success: false,
        error: 'Privilege Violation: Only the Lifetime Super Admin can modify Administrator accounts.',
      };
    }

    const previousRole = target.role;
    const requestedRoleRaw = String(updates.role || target.role || 'STAFF').trim().toUpperCase();
    if (requestedRoleRaw === 'LIFETIME_SUPER_ADMIN' || requestedRoleRaw === 'SUPER_ADMIN') {
      return {
        success: false,
        error: 'Security Invariant: Cannot promote any account to Lifetime Super Admin.',
      };
    }

    const nextRole: 'ADMIN' | 'STAFF' = requestedRoleRaw === 'ADMIN' ? 'ADMIN' : 'STAFF';
    if (nextRole === 'ADMIN' && !isSuperAdmin) {
      return {
        success: false,
        error: 'Privilege Violation: Only the Lifetime Super Admin can assign the ADMIN role.',
      };
    }

    if (updates.fullName && updates.fullName.trim()) {
      target.fullName = updates.fullName.trim();
    }

    if (updates.email && updates.email.trim().includes('@')) {
      const cleanNewEmail = updates.email.trim().toLowerCase();
      if (this.isOwnerEmail(cleanNewEmail)) {
        return {
          success: false,
          error: 'Cannot assign the Lifetime Super Admin email address to another account.',
        };
      }
      target.email = cleanNewEmail;
      target.username = cleanNewEmail.split('@')[0];
    }

    if (updates.phone && updates.phone.trim()) {
      target.phone = updates.phone.trim();
    }

    const rawPos = (
      updates.position ||
      updates.duty ||
      updates.roleTitle ||
      target.position ||
      target.duty ||
      target.roleTitle ||
      (nextRole === 'ADMIN' ? 'Account Manager' : 'Customer Registration Officer')
    ).trim();
    const canonicalPos = normalizeCanonicalPosition(rawPos, nextRole);
    const effectivePosition = canonicalPos || rawPos;

    target.role = nextRole;
    target.roleTitle = effectivePosition;
    target.duty = effectivePosition;
    target.position = effectivePosition;
    target.dashboardRoute =
      updates.dashboardRoute ||
      getDedicatedRouteForUser({
        role: nextRole,
        roleTitle: effectivePosition,
        duty: effectivePosition,
        position: effectivePosition,
        isLifetimeSuperAdmin: false,
      });

    if (typeof updates.assignedProgramme === 'string' && updates.assignedProgramme.trim()) {
      target.assignedProgramme = updates.assignedProgramme.trim();
    }

    if (updates.status === 'active' || updates.status === 'suspended' || updates.status === 'inactive') {
      target.status = updates.status;
      target.active = updates.status === 'active';
      target.is_active = updates.status === 'active';
      target.isActive = updates.status === 'active';
      if (updates.status !== 'active') {
        this.revokeAllUserSessions(target.id);
      }
    }

    if (updates.permissions && typeof updates.permissions === 'object') {
      target.permissions = sanitizePermissionsForPosition(effectivePosition, updates.permissions);
    } else {
      target.permissions = sanitizePermissionsForPosition(effectivePosition, target.permissions);
    }

    const newSecret = (updates.password || updates.accessCode || '').trim();
    if (newSecret && newSecret.length >= 6) {
      const passSalt = generateSalt();
      target.passwordSalt = passSalt;
      target.passwordHash = hashPassword(newSecret, passSalt);

      const codeSalt = generateSalt();
      target.accessCodeSalt = codeSalt;
      target.accessCodeHash = this.hashAccessCode(newSecret, codeSalt);
      target.accessCodeMasked = `${newSecret.slice(0, 3)}***${newSecret.slice(-2)}`;
    }

    target.securityVersion = (target.securityVersion || 1) + 1;
    this.accounts.set(target.id, target);
    this.persistAccounts();

    this.recordAudit({
      actorId: actorSession.userId,
      actorName: actorSession.fullName,
      actorRole: actorSession.role,
      action: 'UPDATED_USER_ACCOUNT',
      resource: '/api/auth/update-account',
      details: `${actorSession.role} (${actorSession.fullName}) updated account ${target.fullName} (${target.email}) -> Role: ${target.role}, Position: ${target.position}, Route: ${target.dashboardRoute}, Status: ${target.status}.`,
      ip: actorSession.ip,
      status: 'SUCCESS',
    });

    const { passwordHash: _, passwordSalt: __, totpSecret: ___, recoveryCodeHashes: ____, ...safeAccount } = target;
    return {
      success: true,
      account: safeAccount,
      previousRole,
    };
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
    data: { email?: string; accessType: 'Admin' | 'Staff' | string; duty?: string; permissions?: Record<string, boolean> }
  ): {
    success: boolean;
    error?: string;
    code?: string;
    plainCode?: string;
    invitation?: AccessInvitation;
    expiresAt?: number;
    email?: string;
    accessType?: string;
    duty?: string;
  } {
    const normalizedAccessType: 'Admin' | 'Staff' =
      String(data.accessType || 'Staff').trim().toUpperCase() === 'ADMIN' ? 'Admin' : 'Staff';

    if (normalizedAccessType === 'Admin' && actorSession.role !== 'LIFETIME_SUPER_ADMIN') {
      return { success: false, error: 'Clearance Violation: Only the Lifetime Super Admin can generate Admin access codes.' };
    }
    if (actorSession.role !== 'LIFETIME_SUPER_ADMIN' && actorSession.role !== 'ADMIN') {
      return { success: false, error: 'Clearance Violation: Ordinary staff cannot generate access codes.' };
    }

    const cleanEmail = data.email?.trim() ? data.email.trim().toLowerCase() : 'pending@authorization.internal';
    const prefix = normalizedAccessType === 'Admin' ? 'TM-ADM' : 'TM-STF';
    const randomHex = crypto.randomBytes(3).toString('hex').toUpperCase();
    const code = `${prefix}-${randomHex}`;
    const salt = generateSalt();
    const codeHash = this.hashAccessCode(code, salt);
    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days

    const invitationId = `INV_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
    const invitation: AccessInvitation = {
      id: invitationId,
      email: cleanEmail,
      accessType: normalizedAccessType,
      duty: data.duty || (normalizedAccessType === 'Admin' ? 'Admin / General Branch Administrator' : 'Customer Registration Officer'),
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
      details: `Generated access code for ${cleanEmail} as ${normalizedAccessType}.`,
      ip: actorSession.ip,
      status: 'SUCCESS',
    });

    return {
      success: true,
      code,
      plainCode: code,
      invitation,
      expiresAt,
      email: cleanEmail,
      accessType: normalizedAccessType,
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
      position?: string;
      duty?: string;
      roleTitle?: string;
      dashboardRoute?: string;
      assignedProgramme?: string;
      permissions?: Record<string, boolean>;
      status?: 'active' | 'suspended' | 'inactive';
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
    const rawPosition = (data.position || data.operationalResponsibility || data.duty || data.roleTitle || '').trim();
    const canonicalPos = normalizeCanonicalPosition(rawPosition, 'ADMIN');
    const duty = canonicalPos || rawPosition || 'Account Manager';
    const assignedProgramme = (data.assignedProgramme || 'All Savings & Loan Programmes').trim();
    const requestedStatus: 'active' | 'suspended' | 'inactive' =
      data.status === 'suspended' ? 'suspended' : data.status === 'inactive' ? 'inactive' : 'active';
    const isActiveStatus = requestedStatus === 'active';

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

    if (!this.isValidOperationalDuty(duty, 'ADMIN')) {
      const error = `Invalid administrative position "${duty}". Please select Account Manager, Operations Manager, or Auditor.`;
      return {
        success: false,
        statusCode: 400,
        message: error,
        error,
      };
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

    const dashboardRoute =
      data.dashboardRoute ||
      getDedicatedRouteForUser({
        role: 'ADMIN',
        roleTitle: duty,
        duty,
        position: duty,
        isLifetimeSuperAdmin: false,
      });

    const sanitizedPermissions = sanitizePermissionsForPosition(duty, data.permissions);

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
      matchedAdminInv.position = duty;
      matchedAdminInv.dashboardRoute = dashboardRoute;
      matchedAdminInv.assignedProgramme = assignedProgramme;
      matchedAdminInv.used = true;
      matchedAdminInv.revoked = false;
      matchedAdminInv.attempts = 0;
      matchedAdminInv.assignedPermissions = sanitizedPermissions;
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
        position: duty,
        dashboardRoute,
        assignedProgramme,
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
        assignedPermissions: sanitizedPermissions,
      };
      this.invitations.set(invitationId, invitation);
    }

    this.persistInvitations();

    // 4. Provision / reserve administrator account in accounts directory linked to Firebase Auth UID
    const rawPassword = (data.password || data.initialPassword || data.accessCode || '').trim();
    const initialPass = rawPassword && rawPassword.length >= 6
      ? rawPassword
      : `Teamacro@${crypto.randomBytes(3).toString('hex')}!`;

    this.clearDeletedAccountMarker(email);
    if (data.firebaseUid) this.clearDeletedAccountMarker(data.firebaseUid);
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
      account.position = duty;
      account.dashboardRoute = dashboardRoute;
      account.assignedProgramme = assignedProgramme;
      account.permissions = sanitizedPermissions;
      account.status = requestedStatus;
      account.active = isActiveStatus;
      account.is_active = isActiveStatus;
      account.isActive = isActiveStatus;
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
        position: duty,
        dashboardRoute,
        assignedProgramme,
        isLifetimeSuperAdmin: false,
        status: requestedStatus,
        active: isActiveStatus,
        is_active: isActiveStatus,
        isActive: isActiveStatus,
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
        permissions: sanitizedPermissions,
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
      details: `Lifetime Super Admin appointed ${fullName} (${email}) as ${duty} (${dashboardRoute}) with UID ${account.id}.`,
      ip: actorSession.ip,
      status: 'SUCCESS',
    });

    const safeInvitation = {
      id: invitation.id,
      email: invitation.email,
      accessType: invitation.accessType,
      duty: invitation.duty,
      position: invitation.position || duty,
      dashboardRoute: invitation.dashboardRoute || dashboardRoute,
      assignedProgramme: invitation.assignedProgramme || assignedProgramme,
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
      position: account.position,
      dashboardRoute: account.dashboardRoute,
      assignedProgramme: account.assignedProgramme,
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
      data: {
        invitation: safeInvitation,
        account: safeAccount,
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
    position?: string;
    dashboardRoute?: string;
    assignedProgramme?: string;
    staffCode?: string;
    password?: string;
    accessCode?: string;
    passwordHash?: string;
    passwordSalt?: string;
    accessCodeHash?: string;
    accessCodeSalt?: string;
    accessCodeMasked?: string;
    mfaRequired?: boolean;
    totpSecret?: string;
    recoveryCodeHashes?: string[];
    consumedTotpSteps?: number[];
    securityVersion?: number;
    permissions?: Record<string, boolean>;
    createdBy?: string;
    createdAt?: string;
    status?: 'active' | 'suspended' | 'inactive';
    fromFirestore?: boolean;
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
    const rawPosition = data.position || data.duty || data.roleTitle || (role === 'ADMIN' ? 'Account Manager' : 'Customer Registration Officer');
    const canonicalPos = normalizeCanonicalPosition(rawPosition, role);
    const duty = canonicalPos || rawPosition;
    const dashboardRoute =
      data.dashboardRoute ||
      getDedicatedRouteForUser({
        role,
        roleTitle: duty,
        duty,
        position: duty,
        isLifetimeSuperAdmin: role === 'LIFETIME_SUPER_ADMIN',
      });
    const assignedProgramme = data.assignedProgramme;
    const rawPass = (data.password || data.accessCode || '').trim();
    const rawCode = (data.accessCode || '').trim();

    let resolvedAccessSalt = data.accessCodeSalt;
    let resolvedAccessHash = data.accessCodeHash;
    if (resolvedAccessHash && resolvedAccessHash.includes(':') && !resolvedAccessSalt) {
      const [s, h] = resolvedAccessHash.split(':', 2);
      resolvedAccessSalt = s;
      resolvedAccessHash = h;
    } else if (resolvedAccessHash && resolvedAccessHash.includes(':') && resolvedAccessSalt) {
      const [, h] = resolvedAccessHash.split(':', 2);
      resolvedAccessHash = h;
    }

    if (existing) {
      if (existing.isLifetimeSuperAdmin) {
        if (data.passwordHash && data.passwordSalt) {
          existing.passwordHash = data.passwordHash;
          existing.passwordSalt = data.passwordSalt;
          this.persistAccounts();
        }
        if (typeof data.mfaRequired === 'boolean') existing.mfaRequired = data.mfaRequired;
        if (data.totpSecret) existing.totpSecret = data.totpSecret;
        if (Array.isArray(data.recoveryCodeHashes)) existing.recoveryCodeHashes = data.recoveryCodeHashes;
        if (Array.isArray(data.consumedTotpSteps)) existing.consumedTotpSteps = data.consumedTotpSteps;
        return existing;
      }

      existing.fullName = data.fullName?.trim() || existing.fullName;
      existing.phone = data.phone?.trim() || existing.phone;
      existing.role = role;
      existing.roleTitle = duty;
      existing.duty = duty;
      existing.position = duty;
      existing.dashboardRoute = dashboardRoute;
      if (assignedProgramme) existing.assignedProgramme = assignedProgramme;
      if (data.staffCode) existing.staffCode = data.staffCode;
      if (data.status) {
        existing.status = data.status;
        existing.active = data.status === 'active';
        existing.is_active = data.status === 'active';
        existing.isActive = data.status === 'active';
      }
      if (data.passwordHash && data.passwordSalt) {
        existing.passwordHash = data.passwordHash;
        existing.passwordSalt = data.passwordSalt;
      } else if (rawPass && rawPass.length >= 4 && !existing.passwordHash) {
        existing.passwordSalt = generateSalt();
        existing.passwordHash = hashPassword(rawPass, existing.passwordSalt);
      }
      if (resolvedAccessHash && resolvedAccessSalt) {
        existing.accessCodeSalt = resolvedAccessSalt;
        existing.accessCodeHash = resolvedAccessHash;
        if (data.accessCodeMasked) existing.accessCodeMasked = data.accessCodeMasked;
      } else if (rawCode && rawCode.length >= 4) {
        const codeSalt = generateSalt();
        existing.accessCodeSalt = codeSalt;
        existing.accessCodeHash = this.hashAccessCode(rawCode, codeSalt);
        existing.accessCodeMasked = `${rawCode.slice(0, 3)}***${rawCode.slice(-2)}`;
      }
      if (typeof data.mfaRequired === 'boolean') existing.mfaRequired = data.mfaRequired;
      if (data.totpSecret) existing.totpSecret = data.totpSecret;
      if (Array.isArray(data.recoveryCodeHashes)) existing.recoveryCodeHashes = data.recoveryCodeHashes;
      if (Array.isArray(data.consumedTotpSteps)) existing.consumedTotpSteps = data.consumedTotpSteps;
      if (typeof data.securityVersion === 'number') existing.securityVersion = data.securityVersion;
      if (data.permissions) existing.permissions = sanitizePermissionsForPosition(duty, data.permissions);
      this.persistAccounts();
      if (!data.fromFirestore) {
        this.syncAccountToFirestore(existing);
      }
      return existing;
    }

    const id = data.id || `STAFF_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const passSalt = data.passwordSalt || (rawPass || !data.fromFirestore ? generateSalt() : '');
    const effectivePass = rawPass || `Teamacro@${crypto.randomBytes(3).toString('hex')}!`;
    const passHash =
      data.passwordHash && data.passwordSalt
        ? data.passwordHash
        : rawPass || !data.fromFirestore
        ? hashPassword(effectivePass, passSalt)
        : '';

    let codeSalt: string | undefined = resolvedAccessSalt;
    let codeHash: string | undefined = resolvedAccessHash;
    let codeMasked: string | undefined = data.accessCodeMasked;
    if (!codeHash && rawCode) {
      codeSalt = generateSalt();
      codeHash = this.hashAccessCode(rawCode, codeSalt);
      codeMasked = `${rawCode.slice(0, 3)}***${rawCode.slice(-2)}`;
    }

    const newAcc: AuthAccount = {
      id,
      uid: id,
      email: cleanEmail,
      username: cleanUsername,
      fullName: data.fullName?.trim() || cleanUsername,
      phone: data.phone?.trim() || '+234 800 000 0000',
      role,
      roleTitle: duty,
      duty,
      position: duty,
      dashboardRoute,
      assignedProgramme,
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
      passwordHash: passHash,
      accessCodeHash: codeHash,
      accessCodeSalt: codeSalt,
      accessCodeMasked: codeMasked,
      mfaRequired: Boolean(data.mfaRequired),
      totpSecret: data.totpSecret,
      recoveryCodeHashes: data.recoveryCodeHashes,
      consumedTotpSteps: data.consumedTotpSteps,
      permissions: sanitizePermissionsForPosition(duty, data.permissions),
      createdBy: data.createdBy || this.getOwnerUserId(),
      createdAt: data.createdAt || new Date().toISOString(),
      securityVersion: data.securityVersion || 1,
    };

    this.accounts.set(id, newAcc);
    this.persistAccounts();
    if (!data.fromFirestore) {
      this.syncAccountToFirestore(newAcc);
    }
    return newAcc;
  }

  public mapDutyToRole(duty: string): UserRole {
    const d = duty.toLowerCase();
    if (d.includes('customer registration') || d.includes('customer service')) return 'customer_service';
    if (d.includes('payment collection') || d.includes('field collector')) return 'field_collector';
    if (d.includes('loan officer')) return 'loan_officer';
    if (d.includes('accounts officer') || d.includes('accountant')) return 'accountant';
    if (d.includes('account manager')) return 'ACCOUNT_MANAGER';
    if (d.includes('operations manager')) return 'operations_manager';
    if (d.includes('auditor')) return 'auditor';
    return 'operations_manager';
  }

  public getDefaultPermissionsForDuty(duty: string): Record<string, boolean> {
    return getDefaultPositionPermissions(duty);
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
      position: inv.position || inv.duty,
      dashboardRoute: inv.dashboardRoute,
      assignedProgramme: inv.assignedProgramme,
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
    target.permissions = sanitizePermissionsForPosition(
      target.position || target.duty || target.roleTitle || '',
      permissions
    );
    this.persistAccounts();
    this.syncAccountToFirestore(target);
    return { success: true };
  }

  public getPublicAccountsList(actorSession?: UserSession): Array<Omit<AuthAccount, 'passwordHash' | 'passwordSalt' | 'totpSecret' | 'recoveryCodeHashes'>> {
    if (!actorSession || (actorSession.role !== 'LIFETIME_SUPER_ADMIN' && actorSession.role !== 'ADMIN')) {
      return [];
    }
    const list: Array<Omit<AuthAccount, 'passwordHash' | 'passwordSalt' | 'totpSecret' | 'recoveryCodeHashes'>> = [];
    for (const acc of this.accounts.values()) {
      const { passwordHash: _, passwordSalt: __, totpSecret: ___, recoveryCodeHashes: ____, ...safe } = acc;
      const canonicalPos = normalizeCanonicalPosition(safe.position || safe.duty || safe.roleTitle, safe.role);
      const position = canonicalPos || safe.position || safe.duty || safe.roleTitle;
      const dashboardRoute = safe.dashboardRoute || getDedicatedRouteForUser(safe);
      list.push({
        ...safe,
        position,
        dashboardRoute,
      });
    }
    return list;
  }

  // -------------------------------------------------------------------------
  // Operational Ledger Records: Collections, Loans, Reconciliations & Reversals
  // -------------------------------------------------------------------------
  private operationalCollections: Map<string, any> = new Map();
  private operationalLoans: Map<string, any> = new Map();
  private operationalReconciliations: Map<string, any> = new Map();

  private seedDefaultOperationalRecordsIfNeeded(): void {
    if (this.operationalCollections.size === 0) {
      const today = new Date().toISOString().split('T')[0];
      const seedCollections = [
        {
          id: 'COL_2026_001',
          reference: 'TMC-COL-882401',
          customerId: 'cust_001',
          customerName: 'Chief Adebayo Ogunlesi',
          accountNumber: '2038194820',
          programme: 'Daily Contribution (Ajo)',
          collectionType: 'SAVINGS_CONTRIBUTION',
          amount: 150000,
          paymentMethod: 'Bank Transfer',
          paymentDate: today,
          recordedById: 'STAFF_COLLECTION',
          recordedByName: 'Payment Collection Desk',
          status: 'CONFIRMED',
          reconciled: true,
          createdAt: new Date(Date.now() - 3600000 * 6).toISOString(),
        },
        {
          id: 'COL_2026_002',
          reference: 'TMC-COL-882402',
          customerId: 'cust_002',
          customerName: 'Hajia Zainab Abubakar',
          accountNumber: '2038491025',
          programme: 'Thrift & Cooperative Savings',
          collectionType: 'SAVINGS_CONTRIBUTION',
          amount: 85000,
          paymentMethod: 'POS Terminal',
          paymentDate: today,
          recordedById: 'STAFF_COLLECTION',
          recordedByName: 'Payment Collection Desk',
          status: 'CONFIRMED',
          reconciled: true,
          createdAt: new Date(Date.now() - 3600000 * 4).toISOString(),
        },
        {
          id: 'COL_2026_003',
          reference: 'TMC-COL-882403',
          customerId: 'cust_003',
          customerName: 'Ngozi Okafor Enterprises',
          accountNumber: '2038773219',
          programme: 'SME Working Capital Loans',
          collectionType: 'LOAN_REPAYMENT',
          amount: 210000,
          paymentMethod: 'Bank Transfer',
          paymentDate: today,
          recordedById: 'STAFF_COLLECTION',
          recordedByName: 'Payment Collection Desk',
          status: 'PENDING_RECONCILIATION',
          reconciled: false,
          createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
        },
      ];
      for (const c of seedCollections) this.operationalCollections.set(c.id, c);
    }

    if (this.operationalLoans.size === 0) {
      const today = new Date().toISOString().split('T')[0];
      const seedLoans = [
        {
          id: 'LN_2026_101',
          loanCode: 'TMC-LN-9041',
          customerId: 'cust_003',
          customerName: 'Ngozi Okafor Enterprises',
          accountNumber: '2038773219',
          programme: 'SME Working Capital Loans',
          principalAmount: 1500000,
          interestRate: 12,
          totalRepayable: 1680000,
          amountRepaid: 840000,
          outstandingBalance: 840000,
          durationMonths: 6,
          purpose: 'Inventory restocking for wholesale distribution',
          guarantorName: 'Chukwuma Okafor',
          guarantorPhone: '+234 803 555 0192',
          stage: 'ACTIVE_DISBURSED',
          repaymentStatus: 'ON_SCHEDULE',
          nextDueDate: today,
          createdByStaffId: 'STAFF_LOAN',
          createdByStaffName: 'Loan Operations Desk',
          createdAt: new Date(Date.now() - 86400000 * 25).toISOString(),
        },
        {
          id: 'LN_2026_102',
          loanCode: 'TMC-LN-9042',
          customerId: 'cust_004',
          customerName: 'Ibrahim Musa Logistics',
          accountNumber: '2038991823',
          programme: 'SME Working Capital Loans',
          principalAmount: 750000,
          interestRate: 10,
          totalRepayable: 825000,
          amountRepaid: 0,
          outstandingBalance: 825000,
          durationMonths: 4,
          purpose: 'Delivery motorcycle fleet maintenance',
          guarantorName: 'Sani Abdullahi',
          guarantorPhone: '+234 802 444 9811',
          stage: 'PENDING_FINAL_APPROVAL',
          repaymentStatus: 'AWAITING_DISBURSEMENT',
          nextDueDate: today,
          createdByStaffId: 'STAFF_LOAN',
          createdByStaffName: 'Loan Operations Desk',
          createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
        },
      ];
      for (const l of seedLoans) this.operationalLoans.set(l.id, l);
    }

    if (this.operationalReconciliations.size === 0) {
      const today = new Date().toISOString().split('T')[0];
      const seedReconciliations = [
        {
          id: 'REC_2026_001',
          reconciliationCode: 'TMC-REC-501',
          periodDate: today,
          programme: 'Daily Contribution (Ajo)',
          recordedCollectionsTotal: 445000,
          verifiedBankLedgerTotal: 445000,
          discrepancyAmount: 0,
          status: 'BALANCED',
          notes: 'All daily field POS and bank transfer receipts matched against settlement statement.',
          preparedById: 'STAFF_ACCOUNTS',
          preparedByName: 'Accounts Review Desk',
          createdAt: new Date(Date.now() - 3600000 * 3).toISOString(),
        },
      ];
      for (const r of seedReconciliations) this.operationalReconciliations.set(r.id, r);
    }
  }

  public getCollectionsList(): any[] {
    this.seedDefaultOperationalRecordsIfNeeded();
    return Array.from(this.operationalCollections.values()).sort(
      (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );
  }

  public recordCollectionTransaction(
    actorSession: UserSession,
    payload: {
      customerId?: string;
      customerName: string;
      accountNumber?: string;
      programme: string;
      collectionType?: 'SAVINGS_CONTRIBUTION' | 'LOAN_REPAYMENT';
      amount: number;
      paymentMethod?: string;
      paymentDate?: string;
      reference: string;
      notes?: string;
    }
  ): { success: boolean; statusCode?: number; error?: string; record?: any } {
    this.seedDefaultOperationalRecordsIfNeeded();
    if (this.isAuditorSession(actorSession)) {
      return {
        success: false,
        statusCode: 403,
        error: 'Read-Only Restriction: Auditors are strictly prohibited from recording or modifying collection transactions.',
      };
    }

    const pos = normalizeCanonicalPosition(actorSession.position || actorSession.roleTitle, actorSession.role);
    const allowedPositions = new Set([
      'Payment Collection Officer',
      'Account Manager',
      'Operations Manager',
    ]);
    const hasPermission =
      actorSession.isLifetimeSuperAdmin ||
      actorSession.role === 'LIFETIME_SUPER_ADMIN' ||
      (pos && allowedPositions.has(pos)) ||
      actorSession.permissions?.canRecordCollections === true;

    if (!hasPermission) {
      return {
        success: false,
        statusCode: 403,
        error: `Access Denied: Your position (${pos || actorSession.roleTitle}) is not authorized to post collection transactions.`,
      };
    }

    const customerName = String(payload.customerName || '').trim();
    const reference = String(payload.reference || '').trim().toUpperCase();
    const amount = Number(payload.amount || 0);
    if (!customerName || !reference || !Number.isFinite(amount) || amount <= 0) {
      return {
        success: false,
        statusCode: 400,
        error: 'Customer name, valid positive amount, and payment reference are mandatory.',
      };
    }

    // Duplicate transaction submission prevention
    for (const existing of this.operationalCollections.values()) {
      if (String(existing.reference || '').toUpperCase() === reference) {
        return {
          success: false,
          statusCode: 409,
          error: `Duplicate Transaction Blocked: Payment reference "${reference}" has already been recorded.`,
        };
      }
      const timeDiff = Date.now() - new Date(existing.createdAt || 0).getTime();
      if (
        timeDiff < 60000 &&
        existing.customerName.toLowerCase() === customerName.toLowerCase() &&
        Number(existing.amount) === amount &&
        existing.collectionType === (payload.collectionType || 'SAVINGS_CONTRIBUTION')
      ) {
        return {
          success: false,
          statusCode: 409,
          error: 'Duplicate Submission Blocked: An identical collection for this customer and amount was recorded less than 60 seconds ago.',
        };
      }
    }

    const id = `COL_${Date.now()}_${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
    const record = {
      id,
      reference,
      customerId: payload.customerId || `cust_${Date.now().toString(36)}`,
      customerName,
      accountNumber: payload.accountNumber || '2038001928',
      programme: payload.programme || 'Daily Contribution (Ajo)',
      collectionType: payload.collectionType || 'SAVINGS_CONTRIBUTION',
      amount,
      paymentMethod: payload.paymentMethod || 'Bank Transfer',
      paymentDate: payload.paymentDate || new Date().toISOString().split('T')[0],
      notes: payload.notes || '',
      recordedById: actorSession.userId,
      recordedByName: actorSession.fullName,
      recordedByPosition: pos || actorSession.roleTitle,
      status: 'CONFIRMED',
      reconciled: false,
      createdAt: new Date().toISOString(),
    };

    this.operationalCollections.set(id, record);
    this.recordAudit({
      actorId: actorSession.userId,
      actorName: actorSession.fullName,
      actorRole: actorSession.role,
      action: 'RECORDED_COLLECTION_TRANSACTION',
      resource: '/api/operations/collections',
      details: `Recorded ${record.collectionType} of ₦${amount.toLocaleString()} for ${customerName} (Ref: ${reference}).`,
      ip: actorSession.ip,
      status: 'SUCCESS',
    });

    // Append to customer's activity history timeline while preserving original registering officer
    this.appendCustomerActivity(
      record.customerId || record.accountNumber || record.customerName,
      actorSession,
      {
        category:
          record.collectionType === 'LOAN_REPAYMENT'
            ? 'PAYMENT_COLLECTION'
            : 'SAVINGS_CONTRIBUTION',
        action:
          record.collectionType === 'LOAN_REPAYMENT'
            ? 'Loan Repayment Collection'
            : 'Savings Contribution Recorded',
        description: `Recorded ${
          record.collectionType === 'LOAN_REPAYMENT' ? 'loan repayment' : 'savings contribution'
        } of ₦${amount.toLocaleString()} under ${record.programme} via ${record.paymentMethod} (Ref: ${reference}).`,
        reference,
        amount,
      }
    );

    return { success: true, statusCode: 201, record };
  }

  public getLoanApplicationsList(): any[] {
    this.seedDefaultOperationalRecordsIfNeeded();
    return Array.from(this.operationalLoans.values()).sort(
      (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );
  }

  public createLoanApplicationRecord(
    actorSession: UserSession,
    payload: {
      id?: string;
      customerId?: string;
      customerName: string;
      accountNumber?: string;
      programme?: string;
      principalAmount: number;
      interestRate?: number;
      durationMonths?: number;
      purpose: string;
      guarantorName: string;
      guarantorPhone: string;
      guarantorRelationship?: string;
      guarantorAddress?: string;
      stage?: string;
    }
  ): { success: boolean; statusCode?: number; error?: string; record?: any } {
    this.seedDefaultOperationalRecordsIfNeeded();
    if (this.isAuditorSession(actorSession)) {
      return {
        success: false,
        statusCode: 403,
        error: 'Read-Only Restriction: Auditors cannot create or modify loan applications.',
      };
    }

    const pos = normalizeCanonicalPosition(actorSession.position || actorSession.roleTitle, actorSession.role);
    const allowedPositions = new Set(['Loan Officer', 'Operations Manager', 'Account Manager']);
    const hasPermission =
      actorSession.isLifetimeSuperAdmin ||
      actorSession.role === 'LIFETIME_SUPER_ADMIN' ||
      (pos && allowedPositions.has(pos)) ||
      actorSession.permissions?.canReviewLoans === true ||
      actorSession.permissions?.canUpdateLoanStages === true;

    if (!hasPermission) {
      return {
        success: false,
        statusCode: 403,
        error: `Access Denied: Your position (${pos || actorSession.roleTitle}) is not authorized to create or update loan applications.`,
      };
    }

    // Loan Officers cannot directly mark a loan as ACTIVE_DISBURSED (requires Admin / Super Admin approval workflow)
    let requestedStage = payload.stage || 'UNDER_CREDIT_REVIEW';
    if (
      requestedStage === 'ACTIVE_DISBURSED' &&
      !actorSession.isLifetimeSuperAdmin &&
      actorSession.role !== 'LIFETIME_SUPER_ADMIN' &&
      actorSession.role !== 'ADMIN'
    ) {
      requestedStage = 'PENDING_FINAL_APPROVAL';
    }

    const principal = Number(payload.principalAmount || 0);
    const rate = Number(payload.interestRate ?? 10);
    const duration = Number(payload.durationMonths ?? 6);
    if (!payload.customerName?.trim() || principal <= 0) {
      return {
        success: false,
        statusCode: 400,
        error: 'Borrower full name and a valid principal loan amount are mandatory.',
      };
    }

    const totalRepayable = Math.round(principal * (1 + rate / 100));
    const id = payload.id && this.operationalLoans.has(payload.id) ? payload.id : `LN_${Date.now()}`;
    const existing = this.operationalLoans.get(id);

    const record = {
      ...(existing || {}),
      id,
      loanCode: existing?.loanCode || `TMC-LN-${Math.floor(1000 + Math.random() * 9000)}`,
      customerId: payload.customerId || existing?.customerId || `cust_${Date.now().toString(36)}`,
      customerName: payload.customerName.trim(),
      accountNumber: payload.accountNumber || existing?.accountNumber || '2038551920',
      programme: payload.programme || existing?.programme || 'SME Working Capital Loans',
      principalAmount: principal,
      interestRate: rate,
      totalRepayable,
      amountRepaid: existing?.amountRepaid || 0,
      outstandingBalance: totalRepayable - (existing?.amountRepaid || 0),
      durationMonths: duration,
      purpose: payload.purpose?.trim() || existing?.purpose || 'Working Capital Financing',
      guarantorName: payload.guarantorName?.trim() || existing?.guarantorName || 'Verified Guarantor',
      guarantorPhone: payload.guarantorPhone?.trim() || existing?.guarantorPhone || '+234 800 000 0000',
      guarantorRelationship: payload.guarantorRelationship?.trim() || existing?.guarantorRelationship || '',
      guarantorAddress: payload.guarantorAddress?.trim() || existing?.guarantorAddress || '',
      stage: requestedStage,
      repaymentStatus: requestedStage === 'ACTIVE_DISBURSED' ? 'ON_SCHEDULE' : 'AWAITING_DISBURSEMENT',
      nextDueDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      createdByStaffId: existing?.createdByStaffId || actorSession.userId,
      createdByStaffName: existing?.createdByStaffName || actorSession.fullName,
      updatedByStaffName: actorSession.fullName,
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.operationalLoans.set(id, record);
    this.recordAudit({
      actorId: actorSession.userId,
      actorName: actorSession.fullName,
      actorRole: actorSession.role,
      action: existing ? 'UPDATED_LOAN_APPLICATION' : 'CREATED_LOAN_APPLICATION',
      resource: '/api/operations/loans',
      details: `${existing ? 'Updated' : 'Created'} loan application ${record.loanCode} for ${record.customerName} (₦${principal.toLocaleString()}, stage: ${requestedStage}).`,
      ip: actorSession.ip,
      status: 'SUCCESS',
    });

    this.appendCustomerActivity(
      record.customerId || record.accountNumber || record.customerName,
      actorSession,
      {
        category: 'LOAN_ACTIVITY',
        action: existing ? 'Loan Application Updated' : 'Loan Application Submitted',
        description: `${existing ? 'Updated' : 'Originated'} loan facility ${record.loanCode} for ₦${principal.toLocaleString()} (${record.programme}, Stage: ${requestedStage}).`,
        reference: record.loanCode,
        amount: principal,
      }
    );

    return { success: true, statusCode: existing ? 200 : 201, record };
  }

  public getReconciliationsList(): any[] {
    this.seedDefaultOperationalRecordsIfNeeded();
    return Array.from(this.operationalReconciliations.values()).sort(
      (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );
  }

  public submitReconciliationRecord(
    actorSession: UserSession,
    payload: {
      periodDate?: string;
      programme: string;
      recordedCollectionsTotal: number;
      verifiedBankLedgerTotal: number;
      notes?: string;
    }
  ): { success: boolean; statusCode?: number; error?: string; record?: any } {
    this.seedDefaultOperationalRecordsIfNeeded();
    if (this.isAuditorSession(actorSession)) {
      return {
        success: false,
        statusCode: 403,
        error: 'Read-Only Restriction: Auditors cannot create or modify financial reconciliation records.',
      };
    }

    const pos = normalizeCanonicalPosition(actorSession.position || actorSession.roleTitle, actorSession.role);
    const allowedPositions = new Set(['Accounts Officer', 'Account Manager', 'Operations Manager']);
    const hasPermission =
      actorSession.isLifetimeSuperAdmin ||
      actorSession.role === 'LIFETIME_SUPER_ADMIN' ||
      (pos && allowedPositions.has(pos)) ||
      actorSession.permissions?.canPrepareReconciliations === true;

    if (!hasPermission) {
      return {
        success: false,
        statusCode: 403,
        error: `Access Denied: Your position (${pos || actorSession.roleTitle}) is not authorized to submit reconciliation reports.`,
      };
    }

    const recorded = Number(payload.recordedCollectionsTotal || 0);
    const verified = Number(payload.verifiedBankLedgerTotal || 0);
    const discrepancy = verified - recorded;
    const status = discrepancy === 0 ? 'BALANCED' : 'DISCREPANCY_FLAGGED';

    const id = `REC_${Date.now()}`;
    const record = {
      id,
      reconciliationCode: `TMC-REC-${Math.floor(100 + Math.random() * 900)}`,
      periodDate: payload.periodDate || new Date().toISOString().split('T')[0],
      programme: payload.programme || 'All Programmes',
      recordedCollectionsTotal: recorded,
      verifiedBankLedgerTotal: verified,
      discrepancyAmount: discrepancy,
      status,
      notes: payload.notes?.trim() || (discrepancy === 0 ? 'Collections reconciled with zero variance.' : 'Variance flagged for Account Manager & Auditor review.'),
      preparedById: actorSession.userId,
      preparedByName: actorSession.fullName,
      preparedByPosition: pos || actorSession.roleTitle,
      createdAt: new Date().toISOString(),
    };

    this.operationalReconciliations.set(id, record);
    this.recordAudit({
      actorId: actorSession.userId,
      actorName: actorSession.fullName,
      actorRole: actorSession.role,
      action: 'SUBMITTED_RECONCILIATION_REPORT',
      resource: '/api/operations/reconciliations',
      details: `Submitted reconciliation ${record.reconciliationCode} for ${record.programme} (Status: ${status}, Discrepancy: ₦${discrepancy.toLocaleString()}).`,
      ip: actorSession.ip,
      status: 'SUCCESS',
    });

    return { success: true, statusCode: 201, record };
  }

  public reverseFinancialTransaction(
    actorSession: UserSession,
    transactionId: string,
    reason: string
  ): { success: boolean; statusCode?: number; error?: string; record?: any } {
    if (actorSession.role !== 'LIFETIME_SUPER_ADMIN' || !actorSession.isLifetimeSuperAdmin) {
      this.recordAudit({
        actorId: actorSession.userId,
        actorName: actorSession.fullName,
        actorRole: actorSession.role,
        action: 'UNAUTHORIZED_TRANSACTION_REVERSAL_ATTEMPT',
        resource: `/api/financial/reverse/${transactionId}`,
        details: `Non-Super-Admin (${actorSession.role} / ${actorSession.position || actorSession.roleTitle}) attempted to reverse confirmed transaction ${transactionId}.`,
        ip: actorSession.ip,
        status: 'DENIED',
      });
      return {
        success: false,
        statusCode: 403,
        error: 'Security Invariant: Only the Lifetime Super Admin can reverse confirmed financial transactions.',
      };
    }

    this.seedDefaultOperationalRecordsIfNeeded();
    const target = this.operationalCollections.get(transactionId);
    if (!target) {
      return { success: false, statusCode: 404, error: 'Transaction record not found.' };
    }

    target.status = 'REVERSED';
    target.reversedAt = new Date().toISOString();
    target.reversedBy = actorSession.fullName;
    target.reversalReason = reason || 'Executive reversal by Lifetime Super Admin';
    this.operationalCollections.set(transactionId, target);

    this.recordAudit({
      actorId: actorSession.userId,
      actorName: actorSession.fullName,
      actorRole: actorSession.role,
      action: 'REVERSED_FINANCIAL_TRANSACTION',
      resource: `/api/financial/reverse/${transactionId}`,
      details: `Lifetime Super Admin reversed transaction ${target.reference} (${transactionId}): ${target.reversalReason}`,
      ip: actorSession.ip,
      status: 'SUCCESS',
    });

    this.appendCustomerActivity(
      target.customerId || target.accountNumber || target.customerName,
      actorSession,
      {
        category: 'CORRECTION_REVERSAL',
        action: 'Authorised Transaction Reversal',
        description: `Reversed transaction ${target.reference} (₦${Number(target.amount || 0).toLocaleString()}): ${target.reversalReason}.`,
        reference: target.reference,
        amount: Number(target.amount || 0),
      }
    );

    return { success: true, statusCode: 200, record: target };
  }

  public resolveActorEmployeeIdentity(
    actorSession?: UserSession,
    fallbackStaffId?: string,
    fallbackName?: string,
    fallbackPosition?: string,
    fallbackStaffCode?: string,
    fallbackDepartment?: string
  ): {
    staffId: string;
    fullName: string;
    staffCode: string;
    position: string;
    role: string;
    department: string;
  } {
    if (actorSession) {
      const acc =
        this.findAccountByIdentifier(actorSession.userId) ||
        this.findAccountByIdentifier(actorSession.email);
      const role = actorSession.role || acc?.role || 'STAFF';
      const pos =
        normalizeCanonicalPosition(
          acc?.position || acc?.duty || actorSession.position || actorSession.roleTitle,
          role
        ) ||
        acc?.position ||
        acc?.duty ||
        actorSession.position ||
        actorSession.roleTitle ||
        (role === 'LIFETIME_SUPER_ADMIN'
          ? 'Lifetime Super Admin & Chief Executive'
          : role === 'ADMIN'
          ? 'Account Manager'
          : 'Customer Registration Officer');
      const staffCode =
        acc?.staffCode ||
        (role === 'LIFETIME_SUPER_ADMIN'
          ? 'TMC-ROOT-0001'
          : role === 'ADMIN'
          ? `TMC-ADM-${String(actorSession.userId).slice(-4).toUpperCase()}`
          : `TMC-STF-${String(actorSession.userId).slice(-4).toUpperCase()}`);
      const department =
        role === 'LIFETIME_SUPER_ADMIN'
          ? 'Executive Board & Root Governance — Lagos Head Office'
          : pos === 'Account Manager' || pos === 'Accounts Officer'
          ? 'Finance, Treasury & Reconciliation Department — Lagos Head Office'
          : pos === 'Operations Manager'
          ? 'Branch Operations & Programme Supervision — Lagos Head Office'
          : pos === 'Auditor'
          ? 'Internal Audit & Regulatory Compliance — Lagos Head Office'
          : pos === 'Loan Officer'
          ? 'Credit & Micro-Loan Operations Department — Lagos Head Office'
          : pos === 'Payment Collection Officer'
          ? 'Field Collections & Savings Operations — Lagos Head Office'
          : 'Customer Onboarding & KYC Department — Lagos Head Office';

      return {
        staffId: actorSession.userId,
        fullName: acc?.fullName || actorSession.fullName || 'Authorised Staff',
        staffCode,
        position: pos,
        role,
        department,
      };
    }

    const cleanId = String(fallbackStaffId || '').trim();
    const matchedAcc = cleanId ? this.findAccountByIdentifier(cleanId) : undefined;
    const role = matchedAcc?.role || (cleanId === 'OWNER_ROOT_3YPAFKI2' ? 'LIFETIME_SUPER_ADMIN' : 'STAFF');
    const pos =
      fallbackPosition ||
      normalizeCanonicalPosition(matchedAcc?.position || matchedAcc?.duty || matchedAcc?.roleTitle, role) ||
      matchedAcc?.position ||
      matchedAcc?.duty ||
      matchedAcc?.roleTitle ||
      (role === 'LIFETIME_SUPER_ADMIN'
        ? 'Lifetime Super Admin & Chief Executive'
        : 'Customer Registration Officer');
    const staffCode =
      fallbackStaffCode ||
      matchedAcc?.staffCode ||
      (role === 'LIFETIME_SUPER_ADMIN'
        ? 'TMC-ROOT-0001'
        : cleanId
        ? `TMC-STF-${cleanId.slice(-4).toUpperCase()}`
        : 'TMC-SYS-0001');
    const department =
      fallbackDepartment ||
      (role === 'LIFETIME_SUPER_ADMIN'
        ? 'Executive Board & Root Governance — Lagos Head Office'
        : 'Customer Onboarding & KYC Department — Lagos Head Office');

    return {
      staffId: cleanId || 'SYSTEM',
      fullName: fallbackName || matchedAcc?.fullName || 'System Registration Officer',
      staffCode,
      position: pos,
      role,
      department,
    };
  }

  public findCustomerByIdentifier(identifier: string): any | null {
    const clean = String(identifier || '').trim();
    if (!clean) return null;
    if (this.customers.has(clean)) return this.customers.get(clean);
    const lower = clean.toLowerCase();
    const cleanPhone = clean.replace(/\s+/g, '');
    for (const c of this.customers.values()) {
      if (
        String(c.id || '').toLowerCase() === lower ||
        String(c.customerCode || '').toLowerCase() === lower ||
        String(c.accountNumber || '').toLowerCase() === lower ||
        String(c.fullName || '').toLowerCase() === lower ||
        (cleanPhone && String(c.phone || '').replace(/\s+/g, '') === cleanPhone)
      ) {
        return c;
      }
    }
    return null;
  }

  public appendCustomerActivity(
    customerIdentifier: string,
    actorSession: UserSession,
    activity: {
      category:
        | 'REGISTRATION'
        | 'PROFILE_UPDATE'
        | 'SAVINGS_CONTRIBUTION'
        | 'LOAN_ACTIVITY'
        | 'PAYMENT_COLLECTION'
        | 'ACCOUNT_ADJUSTMENT'
        | 'CORRECTION_REVERSAL';
      action: string;
      description: string;
      reference?: string;
      amount?: number;
    }
  ): any | null {
    const customer = this.findCustomerByIdentifier(customerIdentifier);
    if (!customer) return null;

    const actor = this.resolveActorEmployeeIdentity(actorSession);
    const nowIso = new Date().toISOString();
    const newEntry = {
      id: `ACT_${Date.now()}_${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
      timestamp: nowIso,
      category: activity.category,
      action: activity.action,
      description: activity.description,
      actorId: actor.staffId,
      actorName: actor.fullName,
      actorStaffCode: actor.staffCode,
      actorRole: actor.role,
      actorPosition: actor.position,
      actorDepartment: actor.department,
      ...(activity.reference ? { reference: activity.reference } : {}),
      ...(typeof activity.amount === 'number' ? { amount: activity.amount } : {}),
    };

    const existingHistory = Array.isArray(customer.activityHistory) ? customer.activityHistory : [];
    const updatedCustomer = {
      ...customer,
      lastModifiedByStaffId: actor.staffId,
      lastModifiedByName: actor.fullName,
      lastModifiedByPosition: actor.position,
      updatedAt: nowIso,
      activityHistory: [newEntry, ...existingHistory],
    };

    this.customers.set(customer.id, updatedCustomer);
    this.persistCustomers();
    writeFirestoreDocument('customers', customer.id, updatedCustomer).catch(() => {});
    return updatedCustomer;
  }

  public normalizeCustomerPhone(rawPhone?: string | null): string {
    const digits = String(rawPhone || '').replace(/\D+/g, '');
    if (!digits) return '';
    // Normalize Nigerian numbers: +2348031234567 -> 8031234567, 08031234567 -> 8031234567
    if (digits.startsWith('234') && digits.length === 13) {
      return digits.slice(3);
    }
    if (digits.startsWith('0') && digits.length === 11) {
      return digits.slice(1);
    }
    return digits;
  }

  public findDuplicateCustomer(
    customerData: any,
    excludeId?: string
  ): {
    isDuplicate: boolean;
    field?: string;
    matchedValue?: string;
    existingCustomer?: any;
  } {
    if (!customerData) return { isDuplicate: false };
    const cleanExcludeId = String(excludeId || '').trim();
    const incomingId = String(customerData.id || '').trim();
    const incomingCode = String(customerData.customerCode || '').trim().toLowerCase();
    const incomingPhoneNorm = this.normalizeCustomerPhone(customerData.phone);
    const incomingNinOrBvn = String(
      customerData.ninOrBvn || customerData.kycIdNumber || customerData.bvn || customerData.nin || ''
    )
      .replace(/\s+/g, '')
      .toLowerCase();

    for (const c of this.customers.values()) {
      if (!c) continue;
      if (cleanExcludeId && c.id === cleanExcludeId) continue;

      if (incomingId && c.id === incomingId) {
        return {
          isDuplicate: true,
          field: 'Customer ID',
          matchedValue: c.customerCode || c.id,
          existingCustomer: c,
        };
      }

      if (incomingCode && c.customerCode && String(c.customerCode).trim().toLowerCase() === incomingCode) {
        return {
          isDuplicate: true,
          field: 'Customer ID',
          matchedValue: c.customerCode,
          existingCustomer: c,
        };
      }

      if (incomingPhoneNorm && incomingPhoneNorm.length >= 7) {
        const existingPhoneNorm = this.normalizeCustomerPhone(c.phone);
        if (existingPhoneNorm && existingPhoneNorm === incomingPhoneNorm) {
          return {
            isDuplicate: true,
            field: 'phone number',
            matchedValue: c.phone,
            existingCustomer: c,
          };
        }
      }

      if (incomingNinOrBvn && incomingNinOrBvn.length >= 6) {
        const existingNinOrBvn = String(c.ninOrBvn || '').replace(/\s+/g, '').toLowerCase();
        if (existingNinOrBvn && existingNinOrBvn === incomingNinOrBvn) {
          return {
            isDuplicate: true,
            field: 'NIN / BVN identification number',
            matchedValue: c.ninOrBvn,
            existingCustomer: c,
          };
        }
      }
    }

    return { isDuplicate: false };
  }

  public removeCustomerFromMemory(customerId: string): void {
    if (customerId && this.customers.has(customerId)) {
      this.customers.delete(customerId);
      this.persistCustomers();
    }
  }

  public saveCustomerRecord(
    customerData: any,
    actorSession?: UserSession,
    options?: {
      fromFirestoreSync?: boolean;
      skipAutoFirestoreWrite?: boolean;
      forceCreateNew?: boolean;
    }
  ): any {
    if (!customerData || (!customerData.fullName && !customerData.phone)) {
      throw new Error('Customer full name and phone number are required.');
    }

    const cleanedPhone = String(customerData.phone || '').replace(/\s+/g, '');
    const cleanEmail = String(customerData.email || '').trim().toLowerCase();

    // Check if customer already exists when updating or syncing from Firestore
    let existing: any = null;
    if (!options?.forceCreateNew) {
      if (customerData.id && this.customers.has(customerData.id)) {
        existing = this.customers.get(customerData.id);
      } else {
        const incomingPhoneNorm = this.normalizeCustomerPhone(customerData.phone);
        for (const c of this.customers.values()) {
          if (
            customerData.customerCode &&
            c.customerCode &&
            String(c.customerCode).toLowerCase() === String(customerData.customerCode).toLowerCase()
          ) {
            existing = c;
            break;
          }
          if (
            (cleanedPhone && String(c.phone || '').replace(/\s+/g, '') === cleanedPhone) ||
            (incomingPhoneNorm &&
              incomingPhoneNorm.length >= 7 &&
              this.normalizeCustomerPhone(c.phone) === incomingPhoneNorm)
          ) {
            existing = c;
            break;
          }
          if (cleanEmail && String(c.email || '').trim().toLowerCase() === cleanEmail) {
            existing = c;
            break;
          }
        }
      }
    }

    const count = this.customers.size + 1;
    let id =
      existing?.id ||
      customerData.id ||
      `cust_${String(count).padStart(3, '0')}_${Date.now().toString(36).slice(-4)}`;
    while (!existing && this.customers.has(id)) {
      id = `cust_${String(count).padStart(3, '0')}_${crypto.randomBytes(2).toString('hex')}`;
    }

    let customerCode = existing?.customerCode || customerData.customerCode || '';
    if (!customerCode) {
      let maxSeq = 1000 + this.customers.size;
      for (const c of this.customers.values()) {
        const m = String(c?.customerCode || '').match(/TMC-CST-(\d+)/i);
        if (m) {
          const n = parseInt(m[1], 10);
          if (!isNaN(n) && n >= maxSeq) maxSeq = n;
        }
      }
      customerCode = `TMC-CST-${maxSeq + 1}`;
    }

    const accountNumber =
      existing?.accountNumber ||
      customerData.accountNumber ||
      `2038${String(100000 + count * 137 + (Date.now() % 1000)).slice(-6)}`;
    const nowIso = new Date().toISOString();
    const nowDate = nowIso.split('T')[0];

    const isFromFirestore = Boolean(options?.fromFirestoreSync);

    // Resolve original registering officer (IMMUTABLE once a customer record is created)
    let regOfficer: {
      staffId: string;
      fullName: string;
      staffCode: string;
      position: string;
      role: string;
      department: string;
    };

    if (existing && existing.registeredByStaffId && existing.registeredByStaffId !== 'SYSTEM') {
      // Preserve the original registering officer permanently even when Staff B updates the customer!
      regOfficer = this.resolveActorEmployeeIdentity(
        undefined,
        existing.registeredByStaffId,
        existing.registeredByName,
        existing.registeredByPosition,
        existing.registeredByStaffCode,
        existing.registeredByDepartment
      );
      regOfficer.role = existing.registeredByRole || regOfficer.role;
    } else if (!existing && actorSession && !isFromFirestore) {
      // New registration by authenticated employee: capture identity directly from session (cannot be spoofed)
      regOfficer = this.resolveActorEmployeeIdentity(actorSession);
    } else {
      // Hydrating from Firestore or legacy record
      regOfficer = this.resolveActorEmployeeIdentity(
        isFromFirestore ? undefined : actorSession,
        customerData.registeredByStaffId || existing?.registeredByStaffId,
        customerData.registeredByName || existing?.registeredByName,
        customerData.registeredByPosition || existing?.registeredByPosition,
        customerData.registeredByStaffCode || existing?.registeredByStaffCode,
        customerData.registeredByDepartment || existing?.registeredByDepartment
      );
      if (customerData.registeredByRole || existing?.registeredByRole) {
        regOfficer.role = customerData.registeredByRole || existing?.registeredByRole;
      }
    }

    const registrationDate =
      existing?.registrationDate || customerData.registrationDate || nowDate;
    const registeredAt =
      existing?.registeredAt ||
      customerData.registeredAt ||
      existing?.createdAt ||
      customerData.createdAt ||
      nowIso;

    // Separate Next of Kin and Guarantor fields (never conflated; show empty string when not provided)
    const nextOfKinName = String(
      customerData.nextOfKinName ?? existing?.nextOfKinName ?? ''
    ).trim();
    const nextOfKinPhone = String(
      customerData.nextOfKinPhone ?? existing?.nextOfKinPhone ?? ''
    ).trim();
    const nextOfKinRelationship = String(
      customerData.nextOfKinRelationship ?? existing?.nextOfKinRelationship ?? ''
    ).trim();
    const nextOfKinAddress = String(
      customerData.nextOfKinAddress ?? existing?.nextOfKinAddress ?? ''
    ).trim();

    const guarantorName = String(
      customerData.guarantorName ?? existing?.guarantorName ?? ''
    ).trim();
    const guarantorPhone = String(
      customerData.guarantorPhone ?? existing?.guarantorPhone ?? ''
    ).trim();
    const guarantorRelationship = String(
      customerData.guarantorRelationship ?? existing?.guarantorRelationship ?? ''
    ).trim();
    const guarantorAddress = String(
      customerData.guarantorAddress ?? existing?.guarantorAddress ?? ''
    ).trim();
    const guarantorOccupation = String(
      customerData.guarantorOccupation ?? existing?.guarantorOccupation ?? ''
    ).trim();
    const guarantorVerificationStatus = String(
      customerData.guarantorVerificationStatus ??
        existing?.guarantorVerificationStatus ??
        (guarantorName ? 'Pending Verification' : 'Not Provided')
    ).trim();

    // Merge activity history without allowing loss or deletion of existing audit trail
    const byActivityId = new Map<string, any>();
    const existingHistory = Array.isArray(existing?.activityHistory)
      ? existing.activityHistory
      : [];
    const incomingHistory = Array.isArray(customerData.activityHistory)
      ? customerData.activityHistory
      : [];

    for (const item of [...existingHistory, ...incomingHistory]) {
      if (item && item.id) {
        byActivityId.set(item.id, item);
      }
    }

    // Ensure initial REGISTRATION entry always exists in activityHistory
    const hasRegEntry = Array.from(byActivityId.values()).some(
      (a) => a.category === 'REGISTRATION'
    );
    if (!hasRegEntry) {
      const regEntryId = `ACT_REG_${id}`;
      byActivityId.set(regEntryId, {
        id: regEntryId,
        timestamp: registeredAt,
        category: 'REGISTRATION',
        action: 'Customer Registration',
        description: `Customer profile registered by ${regOfficer.fullName} (${regOfficer.position}, Staff ID: ${regOfficer.staffCode}).`,
        actorId: regOfficer.staffId,
        actorName: regOfficer.fullName,
        actorStaffCode: regOfficer.staffCode,
        actorRole: regOfficer.role,
        actorPosition: regOfficer.position,
        actorDepartment: regOfficer.department,
      });
    }

    // If an authenticated employee is updating an existing customer, record their update separately
    let lastModifiedByStaffId = existing?.lastModifiedByStaffId || regOfficer.staffId;
    let lastModifiedByName = existing?.lastModifiedByName || regOfficer.fullName;
    let lastModifiedByPosition = existing?.lastModifiedByPosition || regOfficer.position;

    if (existing && actorSession && !isFromFirestore) {
      const modifier = this.resolveActorEmployeeIdentity(actorSession);
      lastModifiedByStaffId = modifier.staffId;
      lastModifiedByName = modifier.fullName;
      lastModifiedByPosition = modifier.position;

      const changedFields: string[] = [];
      if (customerData.fullName && customerData.fullName.trim() !== existing.fullName) {
        changedFields.push('full name');
      }
      if (customerData.phone && customerData.phone.trim() !== existing.phone) {
        changedFields.push('primary phone');
      }
      if (customerData.altPhone !== undefined && String(customerData.altPhone).trim() !== String(existing.altPhone || '')) {
        changedFields.push('alternative phone');
      }
      if (customerData.email !== undefined && cleanEmail !== String(existing.email || '').toLowerCase()) {
        changedFields.push('email');
      }
      if (customerData.address && customerData.address.trim() !== existing.address) {
        changedFields.push('residential address');
      }
      if (customerData.ninOrBvn && customerData.ninOrBvn.trim() !== existing.ninOrBvn) {
        changedFields.push('KYC identification (NIN/BVN)');
      }
      if (nextOfKinName !== (existing.nextOfKinName || '') || nextOfKinPhone !== (existing.nextOfKinPhone || '')) {
        changedFields.push('Next of Kin details');
      }
      if (
        guarantorName !== (existing.guarantorName || '') ||
        guarantorPhone !== (existing.guarantorPhone || '') ||
        guarantorVerificationStatus !== (existing.guarantorVerificationStatus || 'Not Provided')
      ) {
        changedFields.push('Guarantor details');
      }
      if (customerData.status && String(customerData.status).toLowerCase() !== String(existing.status || 'active').toLowerCase()) {
        changedFields.push(`status (${existing.status} -> ${customerData.status})`);
      }
      if (customerData.enrolledProgrammes) {
        changedFields.push('programme associations');
      }

      const updateSummary =
        customerData.updateNote ||
        (changedFields.length > 0
          ? `Updated customer ${changedFields.join(', ')}.`
          : 'Reviewed and updated customer profile information.');

      const updateEntryId = `ACT_UPD_${Date.now()}_${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
      byActivityId.set(updateEntryId, {
        id: updateEntryId,
        timestamp: nowIso,
        category: customerData.activityCategory || 'PROFILE_UPDATE',
        action: customerData.activityAction || 'Customer Information Update',
        description: `${updateSummary} (Original registering officer ${regOfficer.fullName} preserved).`,
        actorId: modifier.staffId,
        actorName: modifier.fullName,
        actorStaffCode: modifier.staffCode,
        actorRole: modifier.role,
        actorPosition: modifier.position,
        actorDepartment: modifier.department,
      });
    }

    const sortedActivityHistory = Array.from(byActivityId.values()).sort(
      (a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime()
    );

    const record = {
      ...(existing || {}),
      ...customerData,
      id,
      customerCode,
      accountNumber,
      fullName: String(customerData.fullName || existing?.fullName || '').trim(),
      phone: String(customerData.phone || existing?.phone || '').trim(),
      altPhone: String(customerData.altPhone ?? existing?.altPhone ?? '').trim(),
      email: cleanEmail || existing?.email || '',
      address: String(
        customerData.address ?? customerData.residentialAddress ?? existing?.address ?? ''
      ).trim(),
      state: String(customerData.state ?? existing?.state ?? '').trim(),
      lga: String(customerData.lga ?? existing?.lga ?? '').trim(),
      ninOrBvn: String(
        customerData.ninOrBvn ??
          customerData.kycIdNumber ??
          customerData.bvn ??
          customerData.nin ??
          existing?.ninOrBvn ??
          ''
      ).trim(),
      idType: String(customerData.idType ?? existing?.idType ?? '').trim(),
      dateOfBirth: String(customerData.dateOfBirth ?? existing?.dateOfBirth ?? '').trim(),
      gender: String(customerData.gender ?? existing?.gender ?? '').trim(),
      occupation: String(customerData.occupation ?? existing?.occupation ?? '').trim(),
      // Separate Next of Kin section
      nextOfKinName,
      nextOfKinPhone,
      nextOfKinRelationship,
      nextOfKinAddress,
      // Separate Guarantor section
      guarantorName,
      guarantorPhone,
      guarantorRelationship,
      guarantorAddress,
      guarantorOccupation,
      guarantorVerificationStatus,
      // Permanent Registration Information
      registrationDate,
      registeredAt,
      createdAt: existing?.createdAt || customerData.createdAt || registeredAt,
      registeredByStaffId: regOfficer.staffId,
      registeredByName: regOfficer.fullName,
      registeredByStaffCode: regOfficer.staffCode,
      registeredByPosition: regOfficer.position,
      registeredByRole: regOfficer.role,
      registeredByDepartment: regOfficer.department,
      lastModifiedByStaffId,
      lastModifiedByName,
      lastModifiedByPosition,
      status: String(customerData.status || existing?.status || 'active').toLowerCase(),
      enrolledProgrammes: Array.isArray(customerData.enrolledProgrammes)
        ? customerData.enrolledProgrammes
        : Array.isArray(existing?.enrolledProgrammes)
        ? existing.enrolledProgrammes
        : [],
      activityHistory: sortedActivityHistory,
      updatedAt: isFromFirestore ? customerData.updatedAt || existing?.updatedAt || nowIso : nowIso,
    };

    delete record.updateNote;
    delete record.activityCategory;
    delete record.activityAction;

    this.customers.set(id, record);
    this.persistCustomers();

    if (!isFromFirestore && !options?.skipAutoFirestoreWrite) {
      writeFirestoreDocument('customers', id, record).catch(() => {});
    }

    return record;
  }

  public getCustomersList(): any[] {
    // Customers remain permanently visible regardless of how long ago they were registered or last viewed (>30 days included)
    return Array.from(this.customers.values()).sort((a, b) => {
      const tA = new Date(a.registeredAt || a.registrationDate || a.updatedAt || 0).getTime();
      const tB = new Date(b.registeredAt || b.registrationDate || b.updatedAt || 0).getTime();
      return tB - tA;
    });
  }
}

export const serverAuthManager = new ServerAuthManager();

