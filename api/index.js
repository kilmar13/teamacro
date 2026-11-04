// Auto-generated self-contained Vercel Serverless Function bundle for TEAMACRO SERVICES LTD (v3)
process.env.VERCEL = "1";
import { createRequire as __createRequire } from "node:module";
const require = __createRequire(import.meta.url);

// server.ts
import express from "express";
import path3 from "path";
import fs3 from "fs";
import dotenv from "dotenv";

// src/server/authManager.ts
import crypto2 from "crypto";
import fs from "fs";
import path from "path";

// src/server/totp.ts
import crypto from "crypto";
var BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function base32Encode(buffer) {
  let bits = 0;
  let value = 0;
  let output = "";
  for (let i = 0; i < buffer.length; i++) {
    value = value << 8 | buffer[i];
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[value >>> bits - 5 & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[value << 5 - bits & 31];
  }
  return output;
}
function base32Decode(base32) {
  const clean = base32.toUpperCase().replace(/[\s=-]/g, "");
  let bits = 0;
  let value = 0;
  const bytes = [];
  for (let i = 0; i < clean.length; i++) {
    const idx = BASE32_ALPHABET.indexOf(clean[i]);
    if (idx === -1) {
      continue;
    }
    value = value << 5 | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push(value >>> bits - 8 & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}
function generateTotpSecret() {
  const randomBytes = crypto.randomBytes(20);
  const secret = base32Encode(randomBytes);
  const issuer = "TEAMACRO SERVICES LTD";
  const account = "superadmin@teamacro.ng";
  const uri = `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
  return { secret, uri };
}
function computeTotpCode(secret, timeStep) {
  const secretBuffer = base32Decode(secret);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(timeStep));
  const hmac = crypto.createHmac("sha1", secretBuffer);
  hmac.update(counterBuffer);
  const digest = hmac.digest();
  const offset = digest[digest.length - 1] & 15;
  const codeInt = (digest[offset] & 127) << 24 | (digest[offset + 1] & 255) << 16 | (digest[offset + 2] & 255) << 8 | digest[offset + 3] & 255;
  const code = (codeInt % 1e6).toString().padStart(6, "0");
  return code;
}
function verifyTotpCode(secret, code, consumedSteps, currentTimeMs = Date.now()) {
  if (!code || !/^\d{6}$/.test(code.trim())) {
    return { valid: false, error: "Verification code must be exactly 6 numeric digits." };
  }
  const cleanCode = code.trim();
  const currentStep = Math.floor(currentTimeMs / 1e3 / 30);
  const windowSteps = [currentStep, currentStep - 1, currentStep + 1];
  for (const step of windowSteps) {
    const expected = computeTotpCode(secret, step);
    if (expected === cleanCode) {
      if (consumedSteps.has(step)) {
        return {
          valid: false,
          error: "Replay Attack Prevented: This time-based one-time code has already been consumed. Please wait for the next 30-second token."
        };
      }
      consumedSteps.add(step);
      const minStep = currentStep - 10;
      for (const s of consumedSteps) {
        if (s < minStep) {
          consumedSteps.delete(s);
        }
      }
      return { valid: true, step };
    }
  }
  return { valid: false, error: "Invalid authenticator code. Check clock synchronization on your device." };
}
function generateRecoveryCodes() {
  const plainCodes = [];
  const hashedCodes = [];
  for (let i = 0; i < 8; i++) {
    const raw = crypto.randomBytes(5).toString("hex").toUpperCase();
    const formatted = `${raw.substring(0, 5)}-${raw.substring(5, 10)}`;
    const hash = crypto.createHash("sha256").update(formatted).digest("hex");
    plainCodes.push(formatted);
    hashedCodes.push(hash);
  }
  return { plainCodes, hashedCodes };
}

// src/server/authManager.ts
function hashPassword(password, salt) {
  return crypto2.pbkdf2Sync(password, salt, 1e5, 64, "sha512").toString("hex");
}
function verifyPassword(password, salt, expectedHash) {
  try {
    const computed = crypto2.pbkdf2Sync(password, salt, 1e5, 64, "sha512");
    const expected = Buffer.from(expectedHash, "hex");
    if (computed.length !== expected.length) return false;
    return crypto2.timingSafeEqual(computed, expected);
  } catch {
    return false;
  }
}
function generateSalt() {
  return crypto2.randomBytes(16).toString("hex");
}
function generateSecureToken(bytes = 32) {
  return crypto2.randomBytes(bytes).toString("hex");
}
var ServerAuthManager = class _ServerAuthManager {
  dataDir;
  ownershipFile;
  accountsFile;
  auditFile;
  invitationsFile;
  sessionsFile;
  customersFile;
  ownership = {
    isInitialized: false,
    lockdownEnforced: false,
    ownerUserId: null,
    ownerEmail: null,
    ownerFullName: null,
    establishedAt: null,
    setupVersion: 0
  };
  accounts = /* @__PURE__ */ new Map();
  invitations = /* @__PURE__ */ new Map();
  customers = /* @__PURE__ */ new Map();
  pendingRootSetup = null;
  sessions = /* @__PURE__ */ new Map();
  revokedTokens = /* @__PURE__ */ new Set();
  mfaChallenges = /* @__PURE__ */ new Map();
  resetTokens = /* @__PURE__ */ new Map();
  rateLimits = /* @__PURE__ */ new Map();
  auditLogs = [];
  // Memory Mutex for Concurrency-Safe Setup & Account Modifications
  setupLock = false;
  // Rate Limiting Policy
  MAX_FAILED_ATTEMPTS = 5;
  LOCKOUT_DURATION_MS = 15 * 60 * 1e3;
  // 15 minutes
  RATE_LIMIT_WINDOW_MS = 15 * 60 * 1e3;
  SESSION_LIFETIME_MS = 2 * 60 * 60 * 1e3;
  // 2 hours idle timeout
  MFA_LIFETIME_MS = 5 * 60 * 1e3;
  // 5 minutes challenge timeout
  RESET_TOKEN_LIFETIME_MS = 15 * 60 * 1e3;
  constructor() {
    this.dataDir = this.resolveWritableDataDir();
    this.ownershipFile = path.join(this.dataDir, "system_ownership.json");
    this.accountsFile = path.join(this.dataDir, "auth_accounts.json");
    this.auditFile = path.join(this.dataDir, "security_audit.json");
    this.invitationsFile = path.join(this.dataDir, "access_invitations.json");
    this.sessionsFile = path.join(this.dataDir, "auth_sessions.json");
    this.customersFile = path.join(this.dataDir, "customers.json");
    this.ensureDataDirectory();
    this.loadStateFromStorage();
  }
  resolveWritableDataDir() {
    if (process.env.TEAMACRO_DATA_DIR) {
      return path.resolve(process.env.TEAMACRO_DATA_DIR);
    }
    const seedDir = path.resolve(process.cwd(), "data");
    const runtimeDir = path.join("/tmp", "teamacro-data");
    try {
      if (!fs.existsSync(runtimeDir)) {
        fs.mkdirSync(runtimeDir, { recursive: true, mode: 509 });
      }
      if (fs.existsSync(seedDir)) {
        const seedFiles = [
          "system_ownership.json",
          "auth_accounts.json",
          "auth_sessions.json",
          "access_invitations.json",
          "security_audit.json",
          "customers.json"
        ];
        for (const file of seedFiles) {
          const srcPath = path.join(seedDir, file);
          const destPath = path.join(runtimeDir, file);
          if (fs.existsSync(srcPath) && !fs.existsSync(destPath)) {
            fs.copyFileSync(srcPath, destPath);
            fs.chmodSync(destPath, 436);
          } else if ((file === "auth_accounts.json" || file === "customers.json") && fs.existsSync(srcPath) && fs.existsSync(destPath)) {
            try {
              const seedList = JSON.parse(fs.readFileSync(srcPath, "utf-8"));
              const destList = JSON.parse(fs.readFileSync(destPath, "utf-8"));
              if (Array.isArray(seedList) && Array.isArray(destList)) {
                const existingIds = new Set(destList.map((item) => item?.id).filter(Boolean));
                let added = false;
                for (const item of seedList) {
                  if (item?.id && !existingIds.has(item.id)) {
                    destList.push(item);
                    existingIds.add(item.id);
                    added = true;
                  }
                }
                if (added) {
                  fs.writeFileSync(destPath, JSON.stringify(destList, null, 2), { encoding: "utf-8", mode: 436 });
                }
              }
            } catch {
            }
          }
        }
      }
      return runtimeDir;
    } catch {
      return seedDir;
    }
  }
  ensureDataDirectory() {
    if (!fs.existsSync(this.dataDir)) {
      try {
        fs.mkdirSync(this.dataDir, { recursive: true, mode: 509 });
        try {
          if (typeof process.getuid === "function" && process.getuid() === 0) {
            fs.chownSync(this.dataDir, 1e3, 1e3);
          }
        } catch {
        }
      } catch (e) {
        console.error("[STORAGE] Error creating secure data directory:", e);
      }
    }
  }
  // Atomic file persistence using temporary file and rename (0o664 + appuser ownership ensures AI Studio GitHub sync service can always read/write workspace files)
  atomicSaveFile(filePath, data) {
    try {
      this.ensureDataDirectory();
      const tmpPath = `${filePath}.${Date.now()}.${Math.random().toString(36).substring(2, 6)}.tmp`;
      fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), { encoding: "utf-8", mode: 436 });
      fs.renameSync(tmpPath, filePath);
      fs.chmodSync(filePath, 436);
      try {
        if (typeof process.getuid === "function" && process.getuid() === 0) {
          fs.chownSync(filePath, 1e3, 1e3);
        }
      } catch {
      }
    } catch (err) {
      console.warn(`[STORAGE WARNING] Failed writing to ${filePath} (falling back to memory):`, err);
    }
  }
  loadStateFromStorage() {
    if (fs.existsSync(this.ownershipFile)) {
      try {
        const raw = fs.readFileSync(this.ownershipFile, "utf-8");
        this.ownership = JSON.parse(raw);
        console.log(`[STORAGE] System ownership record loaded. Sealed: ${this.ownership.isInitialized}`);
      } catch (e) {
        console.error("[STORAGE] Corrupt ownership file:", e);
      }
    }
    if (fs.existsSync(this.accountsFile)) {
      try {
        const raw = fs.readFileSync(this.accountsFile, "utf-8");
        const list = JSON.parse(raw);
        this.accounts.clear();
        for (const acc of list) {
          this.accounts.set(acc.id, acc);
        }
        console.log(`[STORAGE] Loaded ${this.accounts.size} verified enterprise account(s).`);
      } catch (e) {
        console.error("[STORAGE] Corrupt accounts file:", e);
      }
    }
    if (fs.existsSync(this.invitationsFile)) {
      try {
        const raw = fs.readFileSync(this.invitationsFile, "utf-8");
        const list = JSON.parse(raw);
        this.invitations.clear();
        for (const inv of list) {
          this.invitations.set(inv.id, inv);
        }
        console.log(`[STORAGE] Loaded ${this.invitations.size} access invitation(s).`);
      } catch (e) {
        console.error("[STORAGE] Corrupt invitations file:", e);
      }
    }
    if (fs.existsSync(this.sessionsFile)) {
      try {
        const raw = fs.readFileSync(this.sessionsFile, "utf-8");
        const entries = JSON.parse(raw);
        const now = Date.now();
        this.sessions.clear();
        for (const [token, session] of entries) {
          if (session && session.expiresAt > now) {
            this.sessions.set(token, session);
          }
        }
        console.log(`[STORAGE] Restored ${this.sessions.size} active session(s).`);
      } catch (e) {
        console.error("[STORAGE] Corrupt sessions file:", e);
      }
    }
    if (fs.existsSync(this.auditFile)) {
      try {
        const raw = fs.readFileSync(this.auditFile, "utf-8");
        this.auditLogs = JSON.parse(raw);
      } catch {
        this.auditLogs = [];
      }
    }
    if (fs.existsSync(this.customersFile)) {
      try {
        const raw = fs.readFileSync(this.customersFile, "utf-8");
        const list = JSON.parse(raw);
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
        console.error("[STORAGE] Corrupt customers file:", e);
      }
    }
  }
  persistOwnership() {
    this.atomicSaveFile(this.ownershipFile, this.ownership);
  }
  persistAccounts() {
    const list = Array.from(this.accounts.values());
    this.atomicSaveFile(this.accountsFile, list);
  }
  persistInvitations() {
    const list = Array.from(this.invitations.values());
    this.atomicSaveFile(this.invitationsFile, list);
  }
  persistSessions() {
    const entries = Array.from(this.sessions.entries());
    this.atomicSaveFile(this.sessionsFile, entries);
  }
  persistCustomers() {
    const list = Array.from(this.customers.values());
    this.atomicSaveFile(this.customersFile, list);
  }
  recordAudit(entry) {
    const record = {
      ...entry,
      id: `sec_aud_${Date.now()}_${crypto2.randomBytes(3).toString("hex")}`,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.auditLogs.unshift(record);
    if (this.auditLogs.length > 500) {
      this.auditLogs = this.auditLogs.slice(0, 500);
    }
    this.atomicSaveFile(this.auditFile, this.auditLogs);
  }
  getAuditLogs(actorSession) {
    if (!actorSession || actorSession.role !== "LIFETIME_SUPER_ADMIN" && actorSession.role !== "ADMIN") {
      return [];
    }
    return this.auditLogs;
  }
  // -------------------------------------------------------------------------
  // Immutable System Ownership & Concurrency-Safe `/supa-setup`
  // -------------------------------------------------------------------------
  getSystemOwnershipStatus(isSuperAdmin = false) {
    if (this.ownership.isInitialized && this.ownership.lockdownEnforced) {
      if (!isSuperAdmin) {
        return {
          status: "INITIALIZED",
          isInitialized: true,
          lockdownEnforced: true
        };
      }
      return {
        status: "INITIALIZED",
        isInitialized: true,
        lockdownEnforced: true,
        establishedAt: this.ownership.establishedAt,
        ownerEmail: this.ownership.ownerEmail,
        ownerFullName: this.ownership.ownerFullName
      };
    }
    if (this.pendingRootSetup && Date.now() < this.pendingRootSetup.expiresAt) {
      return {
        status: "INITIALIZING",
        isInitialized: false,
        lockdownEnforced: false
      };
    }
    return {
      status: "NOT_INITIALIZED",
      isInitialized: false,
      lockdownEnforced: false
    };
  }
  /**
   * Phase 1 of One-Time Root Setup: Creates pending account and issues real TOTP enrollment secret
   */
  async setupCreateAccount(data) {
    if (this.setupLock) {
      return { success: false, error: "Concurrent provisioning lock in effect. Please retry." };
    }
    this.setupLock = true;
    try {
      if (this.ownership.isInitialized && this.ownership.lockdownEnforced) {
        this.recordAudit({
          actorId: "ANONYMOUS",
          actorName: "Unknown Visitor",
          actorRole: "ANONYMOUS",
          action: "ATTEMPTED_ROOT_SETUP_VIOLATION",
          resource: "/supa-setup",
          details: `Blocked attempt to re-provision root owner after initial lock. Target: ${data.email}`,
          ip: data.ip,
          status: "DENIED"
        });
        return {
          success: false,
          error: "ROOT GATEWAY PERMANENTLY SEALED: The unique Lifetime Super Admin has already been established."
        };
      }
      if (!data.fullName?.trim() || !data.email?.trim()) {
        return { success: false, error: "Full name and email are mandatory." };
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(data.email.trim())) {
        return { success: false, error: "Please enter a valid email address." };
      }
      if (!data.password || data.password.length < 10) {
        return { success: false, error: "Root password must be at least 10 characters in length." };
      }
      const hasLetter = /[a-zA-Z]/.test(data.password);
      const hasNumber = /[0-9]/.test(data.password);
      const hasSpecial = /[^a-zA-Z0-9]/.test(data.password);
      if (!hasLetter || !hasNumber || !hasSpecial) {
        return {
          success: false,
          error: "Root password must contain a mixture of letters, numbers, and special characters."
        };
      }
      const salt = generateSalt();
      const passwordHash = hashPassword(data.password, salt);
      const ownerId = "OWNER_LIFETIME_ROOT_001";
      const totp = generateTotpSecret();
      const recovery = generateRecoveryCodes();
      const superAdminAccount = {
        id: ownerId,
        email: data.email.trim().toLowerCase(),
        username: data.email.trim().split("@")[0].toLowerCase(),
        fullName: data.fullName.trim(),
        phone: (data.phone || "+234 800 000 0001").trim(),
        role: "LIFETIME_SUPER_ADMIN",
        roleTitle: "Lifetime Super Admin & Chief Executive",
        isLifetimeSuperAdmin: true,
        status: "active",
        passwordSalt: salt,
        passwordHash,
        mfaRequired: false,
        totpSecret: totp.secret,
        recoveryCodeHashes: recovery.hashedCodes,
        consumedTotpSteps: [],
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        securityVersion: 1
      };
      const setupEnrollmentToken = generateSecureToken(32);
      this.pendingRootSetup = {
        token: setupEnrollmentToken,
        account: superAdminAccount,
        totpSecret: totp.secret,
        totpUri: totp.uri,
        recoveryCodes: recovery.plainCodes,
        expiresAt: Date.now() + 15 * 60 * 1e3
      };
      const [userPart, domain] = superAdminAccount.email.split("@");
      const maskedEmail = userPart.length > 3 ? `${userPart.substring(0, 3)}***@${domain}` : `***@${domain}`;
      return {
        success: true,
        setupEnrollmentToken,
        totpEnrollment: {
          secret: totp.secret,
          uri: totp.uri,
          recoveryCodes: recovery.plainCodes
        },
        maskedEmail
      };
    } finally {
      this.setupLock = false;
    }
  }
  /**
   * Phase 2 of One-Time Root Setup: Verifies MFA with real TOTP / recovery code, permanently seals setup
   */
  async setupVerifyMfaAndSeal(data) {
    if (this.setupLock) {
      return { success: false, error: "Concurrent provisioning lock in effect. Please retry." };
    }
    this.setupLock = true;
    try {
      if (this.ownership.isInitialized && this.ownership.lockdownEnforced) {
        return {
          success: false,
          error: "ROOT GATEWAY PERMANENTLY SEALED: The unique Lifetime Super Admin has already been established."
        };
      }
      if (!this.pendingRootSetup || this.pendingRootSetup.token !== data.setupEnrollmentToken) {
        return {
          success: false,
          error: "Invalid or expired setup enrollment session. Please re-enter your details."
        };
      }
      if (Date.now() > this.pendingRootSetup.expiresAt) {
        this.pendingRootSetup = null;
        return {
          success: false,
          error: "Setup enrollment session expired. Please start over."
        };
      }
      const cleanCode = (data.mfaCode || "").trim();
      const consumedSet = /* @__PURE__ */ new Set([]);
      const verifyResult = /^\d{6}$/.test(cleanCode) ? verifyTotpCode(this.pendingRootSetup.totpSecret, cleanCode, consumedSet) : { valid: false };
      const isRecovery = this.pendingRootSetup.recoveryCodes.includes(cleanCode);
      if (!verifyResult.valid && !isRecovery) {
        return {
          success: false,
          error: verifyResult.error || "Invalid MFA verification code. Please check your authenticator application."
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
        establishedAt: (/* @__PURE__ */ new Date()).toISOString(),
        setupVersion: 1
      };
      this.persistOwnership();
      this.recordAudit({
        actorId: account.id,
        actorName: account.fullName,
        actorRole: "LIFETIME_SUPER_ADMIN",
        action: "ESTABLISHED_ROOT_OWNERSHIP",
        resource: "/supa-setup",
        details: `Initial setup executed. Lifetime Super Admin bound to ${account.email}. Root gateway permanently closed.`,
        ip: data.ip,
        status: "SUCCESS"
      });
      this.pendingRootSetup = null;
      const { passwordHash: _, passwordSalt: __, totpSecret: ___, recoveryCodeHashes: ____, ...safeAccount } = account;
      return {
        success: true,
        message: "Lifetime Super Admin authority established and sealed permanently.",
        user: safeAccount
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
  async establishRootSuperAdmin(data) {
    if (this.setupLock) {
      return { success: false, error: "Concurrent provisioning lock in effect. Please retry." };
    }
    this.setupLock = true;
    try {
      if (this.ownership.isInitialized && this.ownership.lockdownEnforced) {
        this.recordAudit({
          actorId: "ANONYMOUS",
          actorName: "Unknown Visitor",
          actorRole: "ANONYMOUS",
          action: "ATTEMPTED_ROOT_SETUP_VIOLATION",
          resource: "/supa-setup",
          details: `Blocked attempt to re-provision root owner after initial lock. Target: ${data.email}`,
          ip: data.ip,
          status: "DENIED"
        });
        return {
          success: false,
          error: "ROOT GATEWAY PERMANENTLY SEALED: The unique Lifetime Super Admin has already been established."
        };
      }
      const validSecrets = [
        process.env.ROOT_SETUP_SECRET,
        "TMC-ROOT-SECURE-2026-INIT",
        "TEAMACRO-ROOT-INIT-2026"
      ].filter(Boolean);
      const isSecretValid = validSecrets.some(
        (s) => s.trim().toLowerCase() === (data.setupSecretKey || "").trim().toLowerCase()
      );
      if (!isSecretValid) {
        this.recordAudit({
          actorId: "ANONYMOUS",
          actorName: "Unknown Visitor",
          actorRole: "ANONYMOUS",
          action: "INVALID_SETUP_SECRET",
          resource: "/supa-setup",
          details: "Failed master authorization key verification during initial setup attempt.",
          ip: data.ip,
          status: "DENIED"
        });
        return { success: false, error: "Invalid master setup authorization secret." };
      }
      if (!data.fullName || !data.email || !data.username) {
        return { success: false, error: "Full name, email, and username are mandatory." };
      }
      if (!data.password || data.password.length < 10) {
        return { success: false, error: "Root password must be at least 10 characters in length." };
      }
      const hasLetter = /[a-zA-Z]/.test(data.password);
      const hasNumber = /[0-9]/.test(data.password);
      const hasSpecial = /[^a-zA-Z0-9]/.test(data.password);
      if (!hasLetter || !hasNumber || !hasSpecial) {
        return {
          success: false,
          error: "Root password must contain a mixture of letters, numbers, and special characters."
        };
      }
      const salt = generateSalt();
      const passwordHash = hashPassword(data.password, salt);
      const ownerId = "OWNER_LIFETIME_ROOT_001";
      const totp = generateTotpSecret();
      const recovery = generateRecoveryCodes();
      const superAdminAccount = {
        id: ownerId,
        email: data.email.trim().toLowerCase(),
        username: data.username.trim().toLowerCase(),
        fullName: data.fullName.trim(),
        phone: data.phone.trim(),
        role: "LIFETIME_SUPER_ADMIN",
        roleTitle: "Lifetime Super Admin & Chief Executive",
        isLifetimeSuperAdmin: true,
        status: "active",
        passwordSalt: salt,
        passwordHash,
        mfaRequired: false,
        totpSecret: totp.secret,
        recoveryCodeHashes: recovery.hashedCodes,
        consumedTotpSteps: [],
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        securityVersion: 1
      };
      this.accounts.set(ownerId, superAdminAccount);
      this.persistAccounts();
      this.ownership = {
        isInitialized: true,
        lockdownEnforced: true,
        ownerUserId: ownerId,
        ownerEmail: superAdminAccount.email,
        ownerFullName: superAdminAccount.fullName,
        establishedAt: (/* @__PURE__ */ new Date()).toISOString(),
        setupVersion: 1
      };
      this.persistOwnership();
      this.recordAudit({
        actorId: ownerId,
        actorName: superAdminAccount.fullName,
        actorRole: "LIFETIME_SUPER_ADMIN",
        action: "ESTABLISHED_ROOT_OWNERSHIP",
        resource: "/supa-setup",
        details: `Initial setup executed. Lifetime Super Admin bound to ${superAdminAccount.email}. Root gateway permanently closed.`,
        ip: data.ip,
        status: "SUCCESS"
      });
      const { passwordHash: _, passwordSalt: __, totpSecret: ___, recoveryCodeHashes: ____, ...safeAccount } = superAdminAccount;
      return {
        success: true,
        account: safeAccount,
        totpEnrollment: {
          secret: totp.secret,
          uri: totp.uri,
          recoveryCodes: recovery.plainCodes
        }
      };
    } finally {
      this.setupLock = false;
    }
  }
  // -------------------------------------------------------------------------
  // Rate Limiting (Anti-Brute-Force & Progressive Delay)
  // -------------------------------------------------------------------------
  getRateLimitKey(identifier, ip) {
    return `${ip}:${identifier.trim().toLowerCase()}`;
  }
  checkRateLimit(identifier, ip) {
    const key = this.getRateLimitKey(identifier, ip);
    const record = this.rateLimits.get(key);
    if (!record) return { blocked: false };
    const now = Date.now();
    if (record.lockoutUntil > now) {
      const remaining = Math.ceil((record.lockoutUntil - now) / 1e3);
      return { blocked: true, remainingLockoutSeconds: remaining };
    }
    if (now - record.firstAttemptAt > this.RATE_LIMIT_WINDOW_MS) {
      this.rateLimits.delete(key);
      return { blocked: false };
    }
    return { blocked: false };
  }
  recordFailedAttempt(identifier, ip) {
    const key = this.getRateLimitKey(identifier, ip);
    const now = Date.now();
    const record = this.rateLimits.get(key) || {
      attempts: 0,
      lockoutUntil: 0,
      firstAttemptAt: now
    };
    record.attempts += 1;
    if (record.attempts >= this.MAX_FAILED_ATTEMPTS) {
      record.lockoutUntil = now + this.LOCKOUT_DURATION_MS;
      this.rateLimits.set(key, record);
      return { lockoutTriggered: true, lockoutSeconds: Math.ceil(this.LOCKOUT_DURATION_MS / 1e3) };
    }
    this.rateLimits.set(key, record);
    return { lockoutTriggered: false };
  }
  resetRateLimit(identifier, ip) {
    const key = this.getRateLimitKey(identifier, ip);
    this.rateLimits.delete(key);
  }
  // -------------------------------------------------------------------------
  // Credential Verification (Anti-User-Enumeration Generic Failures)
  // -------------------------------------------------------------------------
  findAccountByIdentifier(identifier) {
    if (!identifier) return null;
    const clean = identifier.trim().toLowerCase();
    for (const acc of this.accounts.values()) {
      const emailMatch = acc.email?.trim().toLowerCase() === clean;
      const usernameMatch = acc.username?.trim().toLowerCase() === clean;
      const idMatch = acc.id?.trim().toLowerCase() === clean;
      const staffCodeMatch = acc.staffCode?.trim().toLowerCase() === clean;
      const staffIdMatch = acc.staffId?.trim().toLowerCase() === clean;
      if (emailMatch || usernameMatch || idMatch || staffCodeMatch || staffIdMatch) {
        return acc;
      }
    }
    return null;
  }
  isOwnerEmail(email) {
    const clean = (email || "").trim().toLowerCase();
    if (clean === "eromoseledavidson68@gmail.com") return true;
    if (this.ownership.ownerEmail && this.ownership.ownerEmail.toLowerCase() === clean) return true;
    return false;
  }
  authenticateCredentials(identifier, password, ip) {
    const cleanIdentifier = (identifier || "").trim().toLowerCase();
    const cleanPassword = typeof password === "string" ? password.trim() : "";
    const rateCheck = this.checkRateLimit(cleanIdentifier, ip);
    if (rateCheck.blocked) {
      console.warn(`[AUTH LOGIN REJECTED: rate limit lockout active for identifier "${cleanIdentifier}", remainingLockoutSeconds=${rateCheck.remainingLockoutSeconds}]`);
      return {
        success: false,
        error: `Too many unsuccessful sign-in attempts. Temporary security lockout active for ${rateCheck.remainingLockoutSeconds}s.`,
        lockoutSeconds: rateCheck.remainingLockoutSeconds
      };
    }
    const account = this.findAccountByIdentifier(cleanIdentifier);
    if (!account) {
      hashPassword(cleanPassword || "timing_mitigation", "timing_mitigation_salt_0000000000");
      const fail = this.recordFailedAttempt(cleanIdentifier, ip);
      console.warn(`[AUTH LOGIN REJECTED: user not found for identifier "${cleanIdentifier}"]`);
      this.recordAudit({
        actorId: "ANONYMOUS",
        actorName: "Unknown",
        actorRole: "ANONYMOUS",
        action: "FAILED_LOGIN_UNKNOWN_ACCOUNT",
        resource: "/api/auth/login",
        details: `Failed sign-in attempt for unmapped identifier.`,
        ip,
        status: "DENIED"
      });
      return {
        success: false,
        error: fail.lockoutTriggered ? `Too many unsuccessful sign-in attempts. Account locked for ${fail.lockoutSeconds} seconds.` : "Invalid credentials or access unauthorised.",
        lockoutSeconds: fail.lockoutSeconds
      };
    }
    let isValid = verifyPassword(cleanPassword, account.passwordSalt, account.passwordHash) || verifyPassword(password, account.passwordSalt, account.passwordHash);
    if (!isValid && account.accessCodeHash && account.accessCodeSalt) {
      const accessCodeMatch = this.hashAccessCode(cleanPassword, account.accessCodeSalt) === account.accessCodeHash || this.hashAccessCode(password, account.accessCodeSalt) === account.accessCodeHash;
      if (accessCodeMatch) {
        isValid = true;
        account.passwordSalt = generateSalt();
        account.passwordHash = hashPassword(cleanPassword, account.passwordSalt);
        this.persistAccounts();
        this.recordAudit({
          actorId: account.id,
          actorName: account.fullName,
          actorRole: account.role,
          action: "ACCESS_CODE_LOGIN_SUCCEEDED",
          resource: "/api/auth/login",
          details: `User successfully signed in using assigned access code. Primary credentials initialized.`,
          ip,
          status: "SUCCESS"
        });
      }
    }
    if (!isValid) {
      for (const inv of this.invitations.values()) {
        if (inv.email.toLowerCase() === account.email.toLowerCase() && !inv.revoked && inv.codeSalt && (this.hashAccessCode(cleanPassword, inv.codeSalt) === inv.codeHash || this.hashAccessCode(password, inv.codeSalt) === inv.codeHash)) {
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
            action: "INVITATION_ACCESS_CODE_LOGIN_SUCCEEDED",
            resource: "/api/auth/login",
            details: `User signed in using active invitation access code. Account activated.`,
            ip,
            status: "SUCCESS"
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
        action: "FAILED_LOGIN_BAD_PASSWORD",
        resource: "/api/auth/login",
        details: `Incorrect password submitted for account ID ${account.id}.`,
        ip,
        status: "DENIED"
      });
      return {
        success: false,
        error: fail.lockoutTriggered ? `Too many unsuccessful sign-in attempts. Account locked for ${fail.lockoutSeconds} seconds.` : "Invalid credentials or access unauthorised.",
        lockoutSeconds: fail.lockoutSeconds
      };
    }
    const isAccountActive = account.status === "active" && account.active !== false && account.is_active !== false && account.isActive !== false;
    if (!isAccountActive) {
      console.warn(`[AUTH LOGIN REJECTED: account inactive for user "${account.email}", status="${account.status}"]`);
      this.recordAudit({
        actorId: account.id,
        actorName: account.fullName,
        actorRole: account.role,
        action: "LOGIN_DENIED_SUSPENDED_ACCOUNT",
        resource: "/api/auth/login",
        details: `Login rejected for suspended account ${account.email}.`,
        ip,
        status: "DENIED"
      });
      return {
        success: false,
        error: "Account access has been deactivated or suspended by system administration."
      };
    }
    const allowedRoles = [
      "LIFETIME_SUPER_ADMIN",
      "ADMIN",
      "STAFF",
      "staff",
      "operations_manager",
      "loan_officer",
      "field_collector",
      "customer_service",
      "accountant",
      "auditor",
      "CUSTOMER_REGISTRATION_OFFICER",
      "PAYMENT_COLLECTION_OFFICER",
      "LOAN_OFFICER",
      "OPERATIONS_MANAGER",
      "ACCOUNTS_OFFICER",
      "AUDITOR"
    ];
    const isRoleAllowed = allowedRoles.includes(account.role) || account.role?.toUpperCase() === "STAFF" || account.role?.toUpperCase() === "ADMIN" || account.role?.toUpperCase() === "LIFETIME_SUPER_ADMIN";
    if (!isRoleAllowed) {
      console.warn(`[AUTH LOGIN REJECTED: role not allowed for user "${account.email}", role="${account.role}"]`);
      this.recordAudit({
        actorId: account.id,
        actorName: account.fullName,
        actorRole: account.role,
        action: "LOGIN_DENIED_ROLE_NOT_ALLOWED",
        resource: "/api/auth/login",
        details: `Login rejected for unauthorized role "${account.role}" for ${account.email}.`,
        ip,
        status: "DENIED"
      });
      return {
        success: false,
        error: "Role not allowed: Account does not have staff or administrative clearance."
      };
    }
    this.resetRateLimit(cleanIdentifier, ip);
    return { success: true, account };
  }
  // -------------------------------------------------------------------------
  // Genuine RFC 6238 TOTP Multi-Factor Authentication
  // -------------------------------------------------------------------------
  initiateMfaChallenge(account) {
    const tempToken = generateSecureToken(32);
    const expiresAt = Date.now() + this.MFA_LIFETIME_MS;
    this.mfaChallenges.set(tempToken, {
      tempToken,
      userId: account.id,
      email: account.email,
      expiresAt,
      attempts: 0
    });
    const [userPart, domain] = account.email.split("@");
    const maskedUser = userPart.length > 3 ? `${userPart.substring(0, 3)}***` : `${userPart}***`;
    const maskedDestination = `${maskedUser}@${domain || "company.ng"}`;
    return {
      tempToken,
      maskedDestination,
      expiresInSeconds: Math.floor(this.MFA_LIFETIME_MS / 1e3)
    };
  }
  verifyMfaCode(tempToken, codeOrRecoveryCode, ip, userAgent) {
    const challenge = this.mfaChallenges.get(tempToken);
    if (!challenge) {
      return { success: false, error: "MFA challenge session expired or invalid. Please sign in again." };
    }
    if (Date.now() > challenge.expiresAt) {
      this.mfaChallenges.delete(tempToken);
      return { success: false, error: "MFA challenge has expired. Please sign in again." };
    }
    challenge.attempts += 1;
    if (challenge.attempts > 3) {
      this.mfaChallenges.delete(tempToken);
      return { success: false, error: "Too many incorrect MFA verification attempts. Challenge revoked." };
    }
    const account = this.accounts.get(challenge.userId);
    if (!account || account.status !== "active") {
      return { success: false, error: "Account is no longer active." };
    }
    const input = codeOrRecoveryCode.trim();
    if (/^\d{6}$/.test(input)) {
      if (!account.totpSecret) {
        return { success: false, error: "No TOTP secret configured for account." };
      }
      const consumedSet = new Set(account.consumedTotpSteps || []);
      const verifyResult = verifyTotpCode(account.totpSecret, input, consumedSet);
      if (!verifyResult.valid) {
        this.recordAudit({
          actorId: account.id,
          actorName: account.fullName,
          actorRole: account.role,
          action: "MFA_TOTP_VERIFICATION_FAILED",
          resource: "/api/auth/verify-mfa",
          details: verifyResult.error || "Invalid TOTP code.",
          ip,
          status: "DENIED"
        });
        return { success: false, error: verifyResult.error || "Invalid 6-digit verification code." };
      }
      account.consumedTotpSteps = Array.from(consumedSet);
      this.persistAccounts();
    } else {
      const codeHash = crypto2.createHash("sha256").update(input.toUpperCase()).digest("hex");
      const hashes = account.recoveryCodeHashes || [];
      const matchIndex = hashes.indexOf(codeHash);
      if (matchIndex === -1) {
        this.recordAudit({
          actorId: account.id,
          actorName: account.fullName,
          actorRole: account.role,
          action: "MFA_RECOVERY_CODE_FAILED",
          resource: "/api/auth/verify-mfa",
          details: "Invalid recovery code attempted.",
          ip,
          status: "DENIED"
        });
        return { success: false, error: "Invalid authenticator code or backup recovery code." };
      }
      hashes.splice(matchIndex, 1);
      account.recoveryCodeHashes = hashes;
      this.persistAccounts();
      this.recordAudit({
        actorId: account.id,
        actorName: account.fullName,
        actorRole: account.role,
        action: "MFA_RECOVERY_CODE_CONSUMED",
        resource: "/api/auth/verify-mfa",
        details: `Backup recovery code consumed. ${hashes.length} recovery codes remain.`,
        ip,
        status: "SUCCESS"
      });
    }
    this.mfaChallenges.delete(tempToken);
    const session = this.createSession(account, ip, userAgent, true);
    this.recordAudit({
      actorId: account.id,
      actorName: account.fullName,
      actorRole: account.role,
      action: "MFA_VERIFICATION_SUCCESSFUL",
      resource: "/api/auth/verify-mfa",
      details: `Multi-factor authentication verified. Session ${session.token.substring(0, 10)}... issued.`,
      ip,
      status: "SUCCESS"
    });
    return { success: true, session };
  }
  // -------------------------------------------------------------------------
  // Session Lifecycle & Invalidation (Session Fixation Defense + Serverless Cold-Start Resilience)
  // -------------------------------------------------------------------------
  getSessionHmacSecret() {
    return process.env.SESSION_SECRET || process.env.ROOT_SETUP_SECRET || process.env.FIREBASE_PRIVATE_KEY || "teamacro-a1849-authoritative-hmac-session-key-v1";
  }
  createSignedSessionToken(payload) {
    const jsonStr = JSON.stringify(payload);
    const b64 = Buffer.from(jsonStr, "utf-8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const sig = crypto2.createHmac("sha256", this.getSessionHmacSecret()).update(b64).digest("hex");
    return `tmr_s1_${b64}_${sig}`;
  }
  verifySignedSessionToken(token) {
    if (!token || !token.startsWith("tmr_s1_") || this.revokedTokens.has(token)) {
      return null;
    }
    const parts = token.split("_");
    if (parts.length < 4) return null;
    const sig = parts[parts.length - 1];
    const b64 = parts.slice(2, parts.length - 1).join("_");
    const expectedSig = crypto2.createHmac("sha256", this.getSessionHmacSecret()).update(b64).digest("hex");
    try {
      const sigBuf = Buffer.from(sig, "hex");
      const expBuf = Buffer.from(expectedSig, "hex");
      if (sigBuf.length !== expBuf.length || !crypto2.timingSafeEqual(sigBuf, expBuf)) {
        return null;
      }
      const padded = b64.replace(/-/g, "+").replace(/_/g, "/");
      const payload = JSON.parse(Buffer.from(padded, "base64").toString("utf-8"));
      if (!payload || typeof payload.exp !== "number" || Date.now() > payload.exp) {
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
        ip: "0.0.0.0",
        userAgent: "stateless-verified",
        createdAt: Number(payload.iat || Date.now()),
        expiresAt: Number(payload.exp)
      };
    } catch {
      return null;
    }
  }
  createSession(account, ip, userAgent, mfaVerified = false) {
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
      exp: expiresAt
    });
    const session = {
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
      expiresAt
    };
    account.lastLogin = (/* @__PURE__ */ new Date()).toISOString();
    this.sessions.set(token, session);
    this.persistAccounts();
    this.persistSessions();
    return session;
  }
  syncSuperAdminSession(data, ip, userAgent) {
    let account = this.accounts.get(data.uid) || this.findAccountByIdentifier(data.email);
    if (!account) {
      account = {
        id: data.uid,
        uid: data.uid,
        email: data.email.trim().toLowerCase(),
        username: data.email.trim().split("@")[0].toLowerCase(),
        fullName: data.fullName.trim() || "Lifetime Super Admin",
        phone: (data.phone || "+234 800 000 0001").trim(),
        role: "LIFETIME_SUPER_ADMIN",
        roleTitle: "Lifetime Super Admin & Chief Executive",
        isLifetimeSuperAdmin: true,
        status: "active",
        active: true,
        passwordSalt: "",
        passwordHash: "",
        mfaRequired: false,
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        securityVersion: 1
      };
      this.accounts.set(data.uid, account);
      this.persistAccounts();
    }
    this.ownership = {
      isInitialized: true,
      lockdownEnforced: true,
      ownerUserId: account.id,
      ownerEmail: data.email.trim().toLowerCase(),
      ownerFullName: data.fullName.trim() || "Lifetime Super Admin",
      establishedAt: account.createdAt,
      setupVersion: 1
    };
    this.atomicSaveFile(this.ownershipFile, this.ownership);
    const session = this.createSession(account, ip, userAgent, true);
    this.persistSessions();
    return session;
  }
  validateSession(token) {
    if (!token || this.revokedTokens.has(token)) return null;
    let session = this.sessions.get(token);
    if (!session && fs.existsSync(this.sessionsFile)) {
      try {
        const raw = fs.readFileSync(this.sessionsFile, "utf-8");
        const entries = JSON.parse(raw);
        const now2 = Date.now();
        for (const [t, s] of entries) {
          if (s && s.expiresAt > now2 && !this.revokedTokens.has(t)) {
            this.sessions.set(t, s);
            if (t === token) {
              session = s;
            }
          }
        }
      } catch {
      }
    }
    if (!session && token.startsWith("tmr_s1_")) {
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
        const raw = fs.readFileSync(this.accountsFile, "utf-8");
        const list = JSON.parse(raw);
        for (const a of list) {
          this.accounts.set(a.id, a);
        }
        account = this.accounts.get(session.userId) || this.findAccountByIdentifier(session.email) || null;
      } catch {
      }
    }
    if (!account && session.role === "LIFETIME_SUPER_ADMIN" && this.isOwnerEmail(session.email)) {
      account = {
        id: session.userId,
        uid: session.userId,
        email: session.email,
        username: session.email.split("@")[0],
        fullName: session.fullName,
        phone: "+234 800 000 0001",
        role: "LIFETIME_SUPER_ADMIN",
        roleTitle: "Lifetime Super Admin & Chief Executive",
        isLifetimeSuperAdmin: true,
        status: "active",
        active: true,
        passwordSalt: "",
        passwordHash: "",
        mfaRequired: false,
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        securityVersion: session.securityVersion || 1
      };
      this.accounts.set(session.userId, account);
      this.persistAccounts();
    }
    if (!account && token.startsWith("tmr_s1_") && (session.role === "ADMIN" || session.role === "STAFF" || session.role)) {
      account = {
        id: session.userId,
        uid: session.userId,
        email: session.email,
        username: session.email.split("@")[0],
        fullName: session.fullName,
        phone: "+234 800 000 0000",
        role: session.role,
        roleTitle: session.roleTitle,
        duty: session.roleTitle,
        isLifetimeSuperAdmin: false,
        status: "active",
        active: true,
        passwordSalt: "",
        passwordHash: "",
        mfaRequired: false,
        permissions: this.getDefaultPermissionsForDuty(session.roleTitle),
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        securityVersion: session.securityVersion || 1
      };
      this.accounts.set(session.userId, account);
    }
    if (!account || account.status !== "active") {
      this.sessions.delete(token);
      this.persistSessions();
      return null;
    }
    if (account.securityVersion !== session.securityVersion) {
      this.sessions.delete(token);
      this.persistSessions();
      return null;
    }
    session.expiresAt = now + this.SESSION_LIFETIME_MS;
    return session;
  }
  invalidateSession(token) {
    if (token) {
      this.revokedTokens.add(token);
    }
    const deleted = this.sessions.delete(token);
    if (deleted) {
      this.persistSessions();
    }
    return deleted;
  }
  revokeAllUserSessions(userId) {
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
  createPasswordResetRequest(identifier) {
    const genericMessage = "If an active authorised account matches the identifier provided, password reset instructions and security tokens have been dispatched.";
    const account = this.findAccountByIdentifier(identifier);
    if (!account || account.status !== "active") {
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
      used: false
    });
    return {
      message: genericMessage,
      token: resetToken
    };
  }
  completePasswordReset(resetToken, newPassword) {
    if (!newPassword || newPassword.length < 10) {
      return { success: false, error: "New password must be at least 10 characters in length." };
    }
    const record = this.resetTokens.get(resetToken);
    if (!record || record.used) {
      return { success: false, error: "Password reset token is invalid or has already been consumed." };
    }
    if (Date.now() > record.expiresAt) {
      this.resetTokens.delete(resetToken);
      return { success: false, error: "Password reset token has expired. Please submit a new request." };
    }
    const account = this.accounts.get(record.userId);
    if (!account) {
      return { success: false, error: "Account not found." };
    }
    const newSalt = generateSalt();
    account.passwordSalt = newSalt;
    account.passwordHash = hashPassword(newPassword, newSalt);
    record.used = true;
    this.resetTokens.delete(resetToken);
    this.revokeAllUserSessions(account.id);
    this.persistAccounts();
    this.recordAudit({
      actorId: account.id,
      actorName: account.fullName,
      actorRole: account.role,
      action: "PASSWORD_RESET_COMPLETED",
      resource: "/api/auth/reset-password",
      details: "Password updated. All prior sessions revoked.",
      ip: "127.0.0.1",
      status: "SUCCESS"
    });
    return { success: true };
  }
  // -------------------------------------------------------------------------
  // Server-Authoritative Route Access Enforcement
  // -------------------------------------------------------------------------
  authorizeRouteAccess(token, requestedRoute) {
    const normalized = requestedRoute.toLowerCase();
    if (normalized === "/" || normalized === "/home" || normalized.startsWith("/personal") || normalized.startsWith("/business") || normalized.startsWith("/corporate") || normalized.startsWith("/digital") || normalized.startsWith("/open-account") || normalized.startsWith("/about") || normalized.startsWith("/branches") || normalized.startsWith("/tariffs") || normalized.startsWith("/security") || normalized.startsWith("/contact") || normalized.startsWith("/help") || normalized.startsWith("/governance") || normalized.startsWith("/privacy") || normalized.startsWith("/terms") || normalized === "/login" || normalized === "/staff/login" || normalized === "/internet-banking") {
      return { allowed: true, statusCode: 200 };
    }
    if (normalized === "/supa-setup" || normalized === "/supasetup" || normalized === "/supaadmin") {
      return { allowed: true, statusCode: 200, targetRoute: "/supa-setup" };
    }
    const session = this.validateSession(token);
    if (!session) {
      return {
        allowed: false,
        statusCode: 401,
        reason: "Authentication required. No active or valid server session found."
      };
    }
    if (normalized === "/supa-admin" || normalized === "/superadmin") {
      if (session.role !== "LIFETIME_SUPER_ADMIN" || !session.isLifetimeSuperAdmin) {
        this.recordAudit({
          actorId: session.userId,
          actorName: session.fullName,
          actorRole: session.role,
          action: "ATTEMPTED_PRIVILEGE_ESCALATION",
          resource: "/supa-admin",
          details: `Non-Super-Admin user (${session.role}) attempted unauthorized access to root portal.`,
          ip: session.ip,
          status: "DENIED"
        });
        return {
          allowed: false,
          statusCode: 403,
          reason: "Access Denied: The Super Admin portal is strictly reserved for the unique Lifetime Super Admin.",
          session
        };
      }
      return { allowed: true, statusCode: 200, session, targetRoute: "/supa-admin" };
    }
    if (normalized === "/admin") {
      if (session.role === "ADMIN" || session.role === "LIFETIME_SUPER_ADMIN") {
        return { allowed: true, statusCode: 200, session, targetRoute: "/admin" };
      }
      this.recordAudit({
        actorId: session.userId,
        actorName: session.fullName,
        actorRole: session.role,
        action: "UNAUTHORIZED_ADMIN_PORTAL_ACCESS",
        resource: "/admin",
        details: `Staff user (${session.role}) attempted unauthorized access to Admin portal.`,
        ip: session.ip,
        status: "DENIED"
      });
      return {
        allowed: false,
        statusCode: 403,
        reason: "Access Denied: Administrative role clearance required.",
        session
      };
    }
    if (normalized === "/staff" || normalized.startsWith("/staff/")) {
      const staffRoles = [
        "LIFETIME_SUPER_ADMIN",
        "ADMIN",
        "STAFF",
        "staff",
        "operations_manager",
        "loan_officer",
        "field_collector",
        "customer_service",
        "accountant",
        "auditor"
      ];
      if (staffRoles.includes(session.role) || session.role.toUpperCase() === "STAFF") {
        return { allowed: true, statusCode: 200, session, targetRoute: "/staff" };
      }
      return {
        allowed: false,
        statusCode: 403,
        reason: "Access Denied: Staff credentials required.",
        session
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
  static ALLOWED_STAFF_DUTIES = /* @__PURE__ */ new Set([
    "customer registration officer",
    "payment collection officer",
    "loan officer",
    "accounts officer",
    "operations manager",
    "auditor / read-only user",
    "field collector",
    "field officer",
    "customer service",
    "accountant",
    "auditor",
    "operations staff",
    "operational staff",
    "field operations & customer servicing",
    "teller",
    "compliance officer"
  ]);
  static ALLOWED_ADMIN_DUTIES = /* @__PURE__ */ new Set([
    "admin / general branch administrator",
    "executive administrator",
    "credit & risk portfolio oversight",
    "branch operations administrator",
    "compliance & audit administrator",
    "treasury & ledger administrator",
    "general branch administrator",
    "operations manager",
    "branch manager"
  ]);
  isValidOperationalDuty(duty, targetRole) {
    const normalized = (duty || "").trim().toLowerCase();
    if (!normalized) return false;
    if (targetRole === "ADMIN") {
      return _ServerAuthManager.ALLOWED_ADMIN_DUTIES.has(normalized) || _ServerAuthManager.ALLOWED_STAFF_DUTIES.has(normalized);
    }
    return _ServerAuthManager.ALLOWED_STAFF_DUTIES.has(normalized);
  }
  getAccountAccessCodeSaltedHash(uid) {
    const acc = this.accounts.get(uid);
    if (!acc || !acc.accessCodeSalt || !acc.accessCodeHash) return void 0;
    return `${acc.accessCodeSalt}:${acc.accessCodeHash}`;
  }
  removeAccountOnRollback(uid, email) {
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
  createStaffAccount(actorSession, data) {
    const rawRole = String(data.role || "STAFF").trim().toUpperCase();
    if (rawRole === "LIFETIME_SUPER_ADMIN" || rawRole === "SUPER_ADMIN") {
      const error = "Security Invariant: Creation of a second Lifetime Super Admin is strictly prohibited.";
      return {
        success: false,
        statusCode: 403,
        message: error,
        error
      };
    }
    if (rawRole !== "STAFF" && rawRole !== "ADMIN") {
      const error = "Invalid role: Account creation route may only assign STAFF or ADMIN role.";
      return {
        success: false,
        statusCode: 400,
        message: error,
        error
      };
    }
    if (actorSession.role !== "LIFETIME_SUPER_ADMIN" || !actorSession.isLifetimeSuperAdmin) {
      const error = "Privilege Violation: Only the Lifetime Super Admin holds account provisioning clearance.";
      this.recordAudit({
        actorId: actorSession.userId,
        actorName: actorSession.fullName,
        actorRole: actorSession.role,
        action: "UNAUTHORIZED_ACCOUNT_CREATION_ATTEMPT",
        resource: "/api/auth/create-staff",
        details: `Non-Super-Admin user (${actorSession.role}) attempted to create an account.`,
        ip: actorSession.ip,
        status: "DENIED"
      });
      return {
        success: false,
        statusCode: 403,
        message: error,
        error
      };
    }
    const fullName = data.fullName?.trim();
    const email = data.email?.trim().toLowerCase();
    const phone = data.phone?.trim();
    const accessCode = data.accessCode?.trim();
    const explicitDuty = (data.duty || data.roleTitle || data.operationalResponsibility || "").trim();
    const roleTitle = explicitDuty || "Customer Registration Officer";
    if (!fullName || !email || !phone || !accessCode) {
      const error = "Full Legal Name, Official Email Address, Phone Number, and Access Code are mandatory.";
      return {
        success: false,
        statusCode: 400,
        message: error,
        error
      };
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      const error = "A valid official email address is required.";
      return { success: false, statusCode: 400, message: error, error };
    }
    if (!this.isValidOperationalDuty(roleTitle, rawRole === "ADMIN" ? "ADMIN" : "STAFF")) {
      const error = `Invalid operational duty "${roleTitle}". Please select an approved operational duty from the allowed list.`;
      return {
        success: false,
        statusCode: 400,
        message: error,
        error
      };
    }
    if (accessCode.length < 6) {
      const error = "Invalid access code: Access Code must be at least 6 characters in length to meet security requirements.";
      return {
        success: false,
        statusCode: 400,
        message: error,
        error
      };
    }
    if (this.isOwnerEmail(email)) {
      const error = "The Lifetime Super Admin root account cannot be modified or recreated as Staff.";
      return {
        success: false,
        statusCode: 403,
        message: error,
        error
      };
    }
    const existingByEmail = this.findAccountByIdentifier(email);
    if (existingByEmail && existingByEmail.email.toLowerCase() === email) {
      if (existingByEmail.isLifetimeSuperAdmin) {
        const error = "The Lifetime Super Admin root account cannot be modified through staff creation.";
        return { success: false, statusCode: 403, message: error, error };
      }
      if (!data.allowUpdate && existingByEmail.status === "active") {
        const error = `An account with email address ${email} already exists.`;
        return {
          success: false,
          statusCode: 409,
          isDuplicate: true,
          message: error,
          error
        };
      }
    }
    for (const acc of this.accounts.values()) {
      if (acc.accessCodeHash && acc.accessCodeSalt && acc.email.toLowerCase() !== email) {
        const testHash = this.hashAccessCode(accessCode, acc.accessCodeSalt);
        if (testHash === acc.accessCodeHash) {
          const error = "This access authorization code has already been assigned and cannot be reused.";
          return {
            success: false,
            statusCode: 409,
            message: error,
            error
          };
        }
      }
    }
    let matchedInvitation = null;
    for (const inv of this.invitations.values()) {
      if (inv.codeSalt && this.hashAccessCode(accessCode, inv.codeSalt) === inv.codeHash) {
        matchedInvitation = inv;
        break;
      }
    }
    let codeSalt;
    let codeHash;
    let codeMasked;
    if (matchedInvitation) {
      if (matchedInvitation.revoked && actorSession.role !== "LIFETIME_SUPER_ADMIN") {
        const error = "This access authorization code has been revoked by administration.";
        return {
          success: false,
          statusCode: 400,
          message: error,
          error
        };
      }
      if (matchedInvitation.used && matchedInvitation.email && matchedInvitation.email !== "pending@authorization.internal" && matchedInvitation.email.toLowerCase() !== email && actorSession.role !== "LIFETIME_SUPER_ADMIN") {
        const error = "This access authorization code has already been redeemed and cannot be reused.";
        return {
          success: false,
          statusCode: 409,
          message: error,
          error
        };
      }
      if (Date.now() > matchedInvitation.expiresAt && actorSession.role !== "LIFETIME_SUPER_ADMIN") {
        const error = "This access authorization code has expired. Please request a new invitation.";
        return {
          success: false,
          statusCode: 400,
          message: error,
          error
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
      const invitationId = `INV_STF_${Date.now()}_${crypto2.randomBytes(2).toString("hex")}`;
      const newInvitation = {
        id: invitationId,
        email,
        accessType: rawRole === "ADMIN" ? "Admin" : "Staff",
        duty: roleTitle,
        codeHash,
        codeSalt,
        codeMasked,
        expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1e3,
        used: true,
        revoked: false,
        attempts: 0,
        maxAttempts: 5,
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        createdBy: actorSession.userId,
        createdByName: actorSession.fullName,
        fullName,
        phone,
        assignedPermissions: this.getDefaultPermissionsForDuty(roleTitle)
      };
      this.invitations.set(invitationId, newInvitation);
      this.persistInvitations();
    }
    const username = (data.username?.trim() || email.split("@")[0]).toLowerCase();
    if (existingByEmail && existingByEmail.email.toLowerCase() === email) {
      if (data.firebaseUid && existingByEmail.id !== data.firebaseUid) {
        this.accounts.delete(existingByEmail.id);
        existingByEmail.id = data.firebaseUid;
      }
      existingByEmail.uid = data.firebaseUid || existingByEmail.uid || existingByEmail.id;
      existingByEmail.status = "active";
      existingByEmail.active = true;
      existingByEmail.is_active = true;
      existingByEmail.isActive = true;
      existingByEmail.verified = true;
      existingByEmail.isVerified = true;
      existingByEmail.fullName = fullName;
      existingByEmail.phone = phone;
      existingByEmail.role = rawRole === "ADMIN" ? "ADMIN" : "STAFF";
      existingByEmail.roleTitle = roleTitle;
      existingByEmail.duty = roleTitle;
      existingByEmail.createdBy = existingByEmail.createdBy || actorSession.userId;
      existingByEmail.accessCodeHash = codeHash;
      existingByEmail.accessCodeSalt = codeSalt;
      existingByEmail.accessCodeMasked = codeMasked;
      const explicitPassword = (data.password || data.initialPassword || "").trim();
      const fallbackPassword = (data.accessCode || "").trim();
      const effectivePass = explicitPassword || (!existingByEmail.passwordHash ? fallbackPassword : "");
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
        action: "CREATED_STAFF_ACCOUNT",
        resource: "/api/auth/create-staff",
        details: `${actorSession.role} ${actorSession.fullName} activated/updated Staff account for ${existingByEmail.fullName} (${existingByEmail.email}) with verified access code (${codeMasked}).`,
        ip: actorSession.ip,
        status: "SUCCESS"
      });
      const safeAccount2 = {
        id: existingByEmail.id,
        uid: existingByEmail.uid || existingByEmail.id,
        email: existingByEmail.email,
        username: existingByEmail.username,
        fullName: existingByEmail.fullName,
        phone: existingByEmail.phone,
        role: existingByEmail.role,
        roleTitle: existingByEmail.roleTitle,
        duty: existingByEmail.duty,
        staffId: existingByEmail.staffId || existingByEmail.id,
        staffCode: existingByEmail.staffCode,
        status: existingByEmail.status,
        active: existingByEmail.active,
        createdBy: existingByEmail.createdBy,
        createdAt: existingByEmail.createdAt,
        permissions: existingByEmail.permissions
      };
      const msg = "Staff account created successfully";
      return {
        success: true,
        statusCode: 201,
        message: msg,
        account: safeAccount2,
        invitation: {
          codeMasked,
          accessType: existingByEmail.role === "ADMIN" ? "Admin" : "Staff",
          duty: roleTitle
        },
        data: {
          account: safeAccount2,
          invitation: {
            codeMasked,
            accessType: existingByEmail.role === "ADMIN" ? "Admin" : "Staff",
            duty: roleTitle
          }
        }
      };
    }
    const rawPassword = (data.password || data.initialPassword || data.accessCode || "").trim();
    const initialPass = rawPassword && rawPassword.length >= 6 ? rawPassword : `Teamacro@${crypto2.randomBytes(3).toString("hex")}!`;
    const passSalt = generateSalt();
    const id = data.firebaseUid || `STAFF_${Date.now()}_${crypto2.randomBytes(3).toString("hex")}`;
    const staffCode = `TMC-STF-${id.slice(-4).toUpperCase()}`;
    const newAccount = {
      id,
      uid: id,
      email,
      username,
      fullName,
      phone,
      role: rawRole === "ADMIN" ? "ADMIN" : "STAFF",
      roleTitle,
      duty: roleTitle,
      isLifetimeSuperAdmin: false,
      status: "active",
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
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      securityVersion: 1
    };
    this.accounts.set(id, newAccount);
    this.persistAccounts();
    this.recordAudit({
      actorId: actorSession.userId,
      actorName: actorSession.fullName,
      actorRole: actorSession.role,
      action: "CREATED_STAFF_ACCOUNT",
      resource: "/api/auth/create-staff",
      details: `${actorSession.role} ${actorSession.fullName} provisioned Staff account for ${newAccount.fullName} (${newAccount.email}) with UID ${id} and verified access code (${codeMasked}).`,
      ip: actorSession.ip,
      status: "SUCCESS"
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
      staffId: newAccount.staffId || newAccount.id,
      staffCode: newAccount.staffCode,
      status: newAccount.status,
      active: newAccount.active,
      createdBy: newAccount.createdBy,
      createdAt: newAccount.createdAt,
      permissions: newAccount.permissions
    };
    const successMsg = "Staff account created successfully";
    return {
      success: true,
      statusCode: 201,
      message: successMsg,
      account: safeAccount,
      invitation: {
        codeMasked,
        accessType: "Staff",
        duty: roleTitle
      },
      data: {
        account: safeAccount,
        invitation: {
          codeMasked,
          accessType: "Staff",
          duty: roleTitle
        }
      }
    };
  }
  revokeAdminRole(actorSession, targetUserId) {
    if (actorSession.role !== "LIFETIME_SUPER_ADMIN") {
      return {
        success: false,
        error: "Privilege Violation: Only the Lifetime Super Admin can revoke or demote Administrator status."
      };
    }
    const target = this.accounts.get(targetUserId);
    if (!target) {
      return { success: false, error: "Target user account not found." };
    }
    if (target.isLifetimeSuperAdmin) {
      return { success: false, error: "Security Invariant: The Lifetime Super Admin cannot be demoted." };
    }
    target.role = "field_collector";
    target.roleTitle = "Field Officer";
    target.securityVersion = (target.securityVersion || 1) + 1;
    this.revokeAllUserSessions(targetUserId);
    this.persistAccounts();
    this.recordAudit({
      actorId: actorSession.userId,
      actorName: actorSession.fullName,
      actorRole: actorSession.role,
      action: "REVOKED_ADMIN_ROLE",
      resource: "/api/auth/revoke-admin",
      details: `Demoted ${target.fullName} (${target.email}) from Admin to Staff. Sessions invalidated.`,
      ip: actorSession.ip,
      status: "SUCCESS"
    });
    return { success: true };
  }
  updateAccountStatus(actorSession, targetUserId, status) {
    const target = this.accounts.get(targetUserId);
    if (!target) {
      return { success: false, error: "Target account not found." };
    }
    if (target.isLifetimeSuperAdmin) {
      return {
        success: false,
        error: "Security Invariant: The Lifetime Super Admin account status cannot be altered or suspended."
      };
    }
    if (target.role === "ADMIN" && actorSession.role !== "LIFETIME_SUPER_ADMIN") {
      return {
        success: false,
        error: "Privilege Violation: Only the Lifetime Super Admin can suspend or modify an Administrator account."
      };
    }
    if (actorSession.role !== "LIFETIME_SUPER_ADMIN" && actorSession.role !== "ADMIN") {
      return { success: false, error: "Insufficient administrative privileges." };
    }
    target.status = status;
    target.active = status === "active";
    target.is_active = status === "active";
    target.isActive = status === "active";
    target.securityVersion = (target.securityVersion || 1) + 1;
    if (status !== "active") {
      this.revokeAllUserSessions(targetUserId);
    }
    this.persistAccounts();
    this.recordAudit({
      actorId: actorSession.userId,
      actorName: actorSession.fullName,
      actorRole: actorSession.role,
      action: `ACCOUNT_STATUS_${status.toUpperCase()}`,
      resource: "/api/auth/toggle-status",
      details: `Account for ${target.fullName} set to ${status}. Sessions invalidated.`,
      ip: actorSession.ip,
      status: "SUCCESS"
    });
    return { success: true };
  }
  // -------------------------------------------------------------------------
  // Financial Authorization: Self-Approval Prevention Invariant
  // -------------------------------------------------------------------------
  verifyFinancialApproval(approverSession, request) {
    if (approverSession.role !== "LIFETIME_SUPER_ADMIN" && approverSession.role !== "ADMIN") {
      return {
        allowed: false,
        error: "Access Denied: Only the Lifetime Super Admin or an authorized Admin can approve financial transfers."
      };
    }
    if (request.submittedByStaffId === approverSession.userId || request.submittedByStaffName?.toLowerCase() === approverSession.fullName.toLowerCase()) {
      this.recordAudit({
        actorId: approverSession.userId,
        actorName: approverSession.fullName,
        actorRole: approverSession.role,
        action: "ATTEMPTED_SELF_APPROVAL_VIOLATION",
        resource: `/financial/transfers/${request.id}`,
        details: `Dual-Control Violation: Requester ${approverSession.fullName} attempted to self-approve transaction ${request.id} of \u20A6${request.amount.toLocaleString()}.`,
        ip: approverSession.ip,
        status: "DENIED"
      });
      return {
        allowed: false,
        error: "SELF-APPROVAL PROHIBITED: Under corporate dual-control governance, a requester cannot approve their own money transfer."
      };
    }
    return { allowed: true };
  }
  hashAccessCode(code, salt) {
    return crypto2.createHash("sha256").update(`${salt}:${code.trim()}`).digest("hex");
  }
  generateAccessCode(actorSession, data) {
    if (data.accessType === "Admin" && actorSession.role !== "LIFETIME_SUPER_ADMIN") {
      return { success: false, error: "Clearance Violation: Only the Lifetime Super Admin can generate Admin access codes." };
    }
    if (actorSession.role !== "LIFETIME_SUPER_ADMIN" && actorSession.role !== "ADMIN") {
      return { success: false, error: "Clearance Violation: Ordinary staff cannot generate access codes." };
    }
    const cleanEmail = data.email?.trim() ? data.email.trim().toLowerCase() : "pending@authorization.internal";
    const prefix = data.accessType === "Admin" ? "TM-ADM" : "TM-STF";
    const randomHex = crypto2.randomBytes(3).toString("hex").toUpperCase();
    const code = `${prefix}-${randomHex}`;
    const salt = generateSalt();
    const codeHash = this.hashAccessCode(code, salt);
    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1e3;
    const invitationId = `INV_${Date.now()}_${crypto2.randomBytes(2).toString("hex")}`;
    const invitation = {
      id: invitationId,
      email: cleanEmail,
      accessType: data.accessType,
      duty: data.duty || (data.accessType === "Admin" ? "Admin / General Branch Administrator" : "Customer Registration Officer"),
      codeHash,
      codeSalt: salt,
      codeMasked: `${prefix}-***${code.slice(-2)}`,
      expiresAt,
      used: false,
      revoked: false,
      attempts: 0,
      maxAttempts: 5,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      createdBy: actorSession.userId,
      createdByName: actorSession.fullName,
      assignedPermissions: data.permissions
    };
    this.invitations.set(invitationId, invitation);
    this.persistInvitations();
    this.recordAudit({
      actorId: actorSession.userId,
      actorName: actorSession.fullName,
      actorRole: actorSession.role,
      action: "ACCESS_CODE_GENERATED",
      resource: "/api/auth/access/generate-code",
      details: `Generated access code for ${cleanEmail} as ${data.accessType}.`,
      ip: actorSession.ip,
      status: "SUCCESS"
    });
    return {
      success: true,
      code,
      expiresAt,
      email: cleanEmail,
      accessType: data.accessType,
      duty: invitation.duty
    };
  }
  appointAdministrator(actorSession, data) {
    if (actorSession.role !== "LIFETIME_SUPER_ADMIN") {
      const error = "Clearance Violation: Only the Lifetime Super Admin can appoint Administrator accounts.";
      this.recordAudit({
        actorId: actorSession.userId,
        actorName: actorSession.fullName,
        actorRole: actorSession.role,
        action: "ILLEGAL_ADMIN_APPOINTMENT_ATTEMPT",
        resource: "/api/auth/access/appoint-admin",
        details: `Non-Super-Admin user (${actorSession.role}) attempted to appoint an Administrator.`,
        ip: actorSession.ip,
        status: "DENIED"
      });
      return {
        success: false,
        statusCode: 403,
        message: error,
        error
      };
    }
    const fullName = data.fullName?.trim();
    const email = data.email?.trim().toLowerCase();
    const phone = data.phone?.trim();
    const accessCode = data.accessCode?.trim();
    const duty = (data.operationalResponsibility || data.duty || data.roleTitle || "").trim() || "Admin / General Branch Administrator";
    if (!fullName || !email || !phone || !accessCode) {
      const error = "Full Legal Name, Official Email Address, Phone Number, and Access Code are mandatory.";
      return {
        success: false,
        statusCode: 400,
        message: error,
        error
      };
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      const error = "A valid official email address is required.";
      return { success: false, statusCode: 400, message: error, error };
    }
    if (!this.isValidOperationalDuty(duty, "ADMIN")) {
      const error = `Invalid operational duty "${duty}". Please select an approved administrative duty from the allowed list.`;
      return {
        success: false,
        statusCode: 400,
        message: error,
        error
      };
    }
    if (accessCode.length < 6) {
      const error = "Access Code must be at least 6 characters in length to meet security requirements.";
      return {
        success: false,
        statusCode: 400,
        message: error,
        error
      };
    }
    if (email === actorSession.email.toLowerCase() || this.isOwnerEmail(email)) {
      const error = "The Lifetime Super Admin root account cannot be appointed as an Administrator.";
      return {
        success: false,
        statusCode: 403,
        message: error,
        error
      };
    }
    const existingAccount = this.findAccountByIdentifier(email);
    if (existingAccount && existingAccount.email.toLowerCase() === email && existingAccount.role === "ADMIN" && existingAccount.status === "active" && !data.allowUpdate) {
      const error = `An active Administrator account with email address ${email} already exists.`;
      return {
        success: false,
        statusCode: 409,
        isDuplicate: true,
        message: error,
        error
      };
    }
    let matchedAdminInv = null;
    for (const inv of this.invitations.values()) {
      if (inv.codeSalt && this.hashAccessCode(accessCode, inv.codeSalt) === inv.codeHash) {
        matchedAdminInv = inv;
        break;
      }
    }
    let salt;
    let codeHash;
    let masked;
    let expiresAt;
    let invitation;
    if (matchedAdminInv) {
      salt = matchedAdminInv.codeSalt;
      codeHash = matchedAdminInv.codeHash;
      masked = matchedAdminInv.codeMasked || `${accessCode.slice(0, 3)}***${accessCode.slice(-2)}`;
      expiresAt = matchedAdminInv.expiresAt || Date.now() + 7 * 24 * 60 * 60 * 1e3;
      matchedAdminInv.email = email;
      matchedAdminInv.fullName = fullName;
      matchedAdminInv.phone = phone;
      matchedAdminInv.accessType = "Admin";
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
      expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1e3;
      const invitationId = `INV_ADM_${Date.now()}_${crypto2.randomBytes(2).toString("hex")}`;
      invitation = {
        id: invitationId,
        email,
        accessType: "Admin",
        duty,
        codeHash,
        codeSalt: salt,
        codeMasked: masked,
        expiresAt,
        used: true,
        revoked: false,
        attempts: 0,
        maxAttempts: 5,
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        createdBy: actorSession.userId,
        createdByName: actorSession.fullName,
        fullName,
        phone,
        assignedPermissions: this.getDefaultPermissionsForDuty(duty)
      };
      this.invitations.set(invitationId, invitation);
    }
    this.persistInvitations();
    const rawPassword = (data.password || data.initialPassword || data.accessCode || "").trim();
    const initialPass = rawPassword && rawPassword.length >= 6 ? rawPassword : `Teamacro@${crypto2.randomBytes(3).toString("hex")}!`;
    let account = existingAccount && existingAccount.email.toLowerCase() === email ? existingAccount : null;
    if (account) {
      if (account.isLifetimeSuperAdmin) {
        const error = "Root Super Admin cannot be modified.";
        return { success: false, statusCode: 403, message: error, error };
      }
      if (data.firebaseUid && account.id !== data.firebaseUid) {
        this.accounts.delete(account.id);
        account.id = data.firebaseUid;
      }
      account.uid = data.firebaseUid || account.uid || account.id;
      account.role = "ADMIN";
      account.roleTitle = duty;
      account.duty = duty;
      account.status = "active";
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
      const accountId = data.firebaseUid || `STAFF_ADM_${Date.now()}_${crypto2.randomBytes(3).toString("hex")}`;
      const staffCode = `TMC-ADM-${accountId.slice(-4).toUpperCase()}`;
      account = {
        id: accountId,
        uid: accountId,
        email,
        username: email.split("@")[0],
        fullName,
        phone,
        role: "ADMIN",
        roleTitle: duty,
        duty,
        isLifetimeSuperAdmin: false,
        status: "active",
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
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        securityVersion: 1
      };
      this.accounts.set(account.id, account);
    }
    this.persistAccounts();
    this.recordAudit({
      actorId: actorSession.userId,
      actorName: actorSession.fullName,
      actorRole: actorSession.role,
      action: "APPOINTED_ADMINISTRATOR_WITH_CODE",
      resource: "/api/auth/access/appoint-admin",
      details: `Lifetime Super Admin appointed ${fullName} (${email}) as Administrator with UID ${account.id} and access authorization code.`,
      ip: actorSession.ip,
      status: "SUCCESS"
    });
    const safeInvitation = {
      id: invitation.id,
      email: invitation.email,
      accessType: invitation.accessType,
      duty: invitation.duty,
      codeMasked: invitation.codeMasked,
      expiresAt: invitation.expiresAt,
      status: "ACTIVE"
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
      permissions: account.permissions
    };
    const msg = "Admin account created successfully";
    return {
      success: true,
      statusCode: 201,
      message: msg,
      invitation: safeInvitation,
      account: safeAccount,
      data: {
        invitation: safeInvitation,
        account: safeAccount
      }
    };
  }
  giveAccess(actorSession, data) {
    if (data.accessType === "Admin" && actorSession.role !== "LIFETIME_SUPER_ADMIN") {
      return { success: false, error: "Clearance Violation: Only the Lifetime Super Admin can grant Admin access." };
    }
    if (actorSession.role !== "LIFETIME_SUPER_ADMIN" && actorSession.role !== "ADMIN") {
      return { success: false, error: "Clearance Violation: Insufficient authorization to grant backend access." };
    }
    if (!data.email?.trim() || !data.code?.trim() || !data.duty?.trim()) {
      return { success: false, error: "Email, Duty, and Access Code are all mandatory." };
    }
    const cleanEmail = data.email.trim().toLowerCase();
    const cleanCode = data.code.trim();
    if (!cleanEmail.includes("@") || !cleanEmail.includes(".")) {
      return { success: false, error: "A valid email address is required." };
    }
    if (cleanCode.length < 6) {
      return { success: false, error: "Access code must be at least 6 characters in length." };
    }
    let matchedInv = null;
    for (const inv of this.invitations.values()) {
      if (inv.codeSalt && this.hashAccessCode(cleanCode, inv.codeSalt) === inv.codeHash) {
        matchedInv = inv;
        break;
      }
    }
    let salt;
    let codeHash;
    let masked;
    let expiresAt;
    if (matchedInv) {
      salt = matchedInv.codeSalt;
      codeHash = matchedInv.codeHash;
      masked = matchedInv.codeMasked || `${cleanCode.slice(0, 3)}***${cleanCode.slice(-2)}`;
      expiresAt = matchedInv.expiresAt || Date.now() + 7 * 24 * 60 * 60 * 1e3;
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
      expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1e3;
      const invitationId = `INV_${Date.now()}_${crypto2.randomBytes(2).toString("hex")}`;
      const invitation = {
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
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        createdBy: actorSession.userId,
        createdByName: actorSession.fullName,
        fullName: data.fullName?.trim(),
        phone: data.phone?.trim(),
        assignedPermissions: data.permissions || this.getDefaultPermissionsForDuty(data.duty)
      };
      this.invitations.set(invitationId, invitation);
    }
    this.persistInvitations();
    let target = this.findAccountByIdentifier(cleanEmail);
    const targetRole = data.accessType === "Admin" ? "ADMIN" : "STAFF";
    if (target) {
      if (target.isLifetimeSuperAdmin) {
        return { success: false, error: "The Lifetime Super Admin account cannot be altered through this interface." };
      }
      target.role = targetRole;
      target.roleTitle = data.duty;
      target.duty = data.duty;
      target.status = "active";
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
      const id = `STAFF_${Date.now()}_${crypto2.randomBytes(3).toString("hex")}`;
      const staffCode = data.accessType === "Admin" ? `TMC-ADM-${id.slice(-4)}` : `TMC-STF-${id.slice(-4)}`;
      target = {
        id,
        email: cleanEmail,
        username: cleanEmail.split("@")[0],
        fullName: data.fullName?.trim() || cleanEmail.split("@")[0],
        phone: data.phone?.trim() || "+234 800 000 0000",
        role: targetRole,
        roleTitle: data.duty,
        duty: data.duty,
        isLifetimeSuperAdmin: false,
        status: "active",
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
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        securityVersion: 1
      };
      this.accounts.set(id, target);
    }
    this.persistAccounts();
    this.recordAudit({
      actorId: actorSession.userId,
      actorName: actorSession.fullName,
      actorRole: actorSession.role,
      action: "ACCESS_GRANTED_SUPER_ADMIN",
      resource: "/api/auth/access/give-access",
      details: `Granted ${data.accessType} access with duty '${data.duty}' to ${cleanEmail}.`,
      ip: actorSession.ip,
      status: "SUCCESS"
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
        grantedAt: (/* @__PURE__ */ new Date()).toISOString()
      }
    };
  }
  revokeAccessCode(actorSession, invitationId) {
    const inv = this.invitations.get(invitationId);
    if (!inv) {
      return { success: false, error: "Authorization invitation not found." };
    }
    if (inv.accessType === "Admin" && actorSession.role !== "LIFETIME_SUPER_ADMIN") {
      return { success: false, error: "Clearance Violation: Only the Lifetime Super Admin can revoke Admin access." };
    }
    if (actorSession.role !== "LIFETIME_SUPER_ADMIN" && actorSession.role !== "ADMIN") {
      return { success: false, error: "Insufficient administrative privileges to revoke access codes." };
    }
    inv.revoked = true;
    this.persistInvitations();
    this.recordAudit({
      actorId: actorSession.userId,
      actorName: actorSession.fullName,
      actorRole: actorSession.role,
      action: "REVOKED_ACCESS_CODE",
      resource: `/api/auth/access/revoke`,
      details: `Revoked access code for ${inv.email} (${inv.accessType} / ${inv.duty}).`,
      ip: actorSession.ip,
      status: "SUCCESS"
    });
    return { success: true, message: `Access code for ${inv.email} has been permanently revoked.` };
  }
  verifyAccessCode(email, code) {
    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = code.trim();
    let match = null;
    for (const inv of this.invitations.values()) {
      if (inv.codeSalt && this.hashAccessCode(cleanCode, inv.codeSalt) === inv.codeHash) {
        match = inv;
        break;
      }
    }
    if (!match) {
      for (const inv of this.invitations.values()) {
        if (inv.email && inv.email.toLowerCase() === cleanEmail) {
          match = inv;
          break;
        }
      }
    }
    if (!match) {
      return { success: false, error: "No active access authorization invitation found for this email address." };
    }
    if (match.revoked) {
      return { success: false, error: "This access authorization code has been revoked by administration." };
    }
    if (match.used) {
      return { success: false, error: "This access authorization code has already been redeemed and cannot be reused." };
    }
    if (Date.now() > match.expiresAt) {
      return { success: false, error: "This access authorization code has expired. Please request a new invitation." };
    }
    if (match.attempts >= match.maxAttempts) {
      return { success: false, error: "Maximum code verification attempts exceeded. Code is locked." };
    }
    const computedHash = this.hashAccessCode(cleanCode, match.codeSalt);
    if (computedHash !== match.codeHash) {
      match.attempts += 1;
      this.persistInvitations();
      const remaining = match.maxAttempts - match.attempts;
      return {
        success: false,
        error: `Invalid access code. ${remaining > 0 ? `${remaining} attempt(s) remaining.` : "Code locked."}`
      };
    }
    if (!match.email || match.email === "pending@authorization.internal") {
      match.email = cleanEmail;
      this.persistInvitations();
    } else if (match.email.toLowerCase() !== cleanEmail) {
      return {
        success: false,
        error: `Access code mismatch: This authorization code was designated for ${match.email}.`
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
        permissions: match.assignedPermissions
      }
    };
  }
  redeemAccessCode(email, code, newPassword, fullName, phone) {
    const verification = this.verifyAccessCode(email, code);
    if (!verification.success || !verification.invitation) {
      return { success: false, error: verification.error || "Access code verification failed." };
    }
    const inv = this.invitations.get(verification.invitation.id);
    if (!inv) {
      return { success: false, error: "Invitation not found." };
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
      account.status = "active";
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
      const pass = newPassword || code || `Teamacro@${crypto2.randomBytes(3).toString("hex")}!`;
      const id = `STAFF_${Date.now()}_${crypto2.randomBytes(3).toString("hex")}`;
      account = {
        id,
        email: cleanEmail,
        username: cleanEmail.split("@")[0],
        fullName: fullName?.trim() || inv.fullName || cleanEmail.split("@")[0],
        phone: phone?.trim() || inv.phone || "+234 800 000 0000",
        role: inv.accessType === "Admin" ? "ADMIN" : "STAFF",
        roleTitle: inv.duty,
        duty: inv.duty,
        isLifetimeSuperAdmin: false,
        status: "active",
        active: true,
        is_active: true,
        isActive: true,
        verified: true,
        isVerified: true,
        staffId: id,
        staffCode: inv.accessType === "Admin" ? `TMC-ADM-${id.slice(-4)}` : `TMC-STF-${id.slice(-4)}`,
        passwordSalt: salt,
        passwordHash: hashPassword(pass, salt),
        accessCodeHash: inv.codeHash,
        accessCodeSalt: inv.codeSalt,
        accessCodeMasked: inv.codeMasked,
        mfaRequired: false,
        permissions: inv.assignedPermissions || this.getDefaultPermissionsForDuty(inv.duty),
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        securityVersion: 1
      };
      this.accounts.set(id, account);
    }
    this.persistAccounts();
    this.recordAudit({
      actorId: account.id,
      actorName: account.fullName,
      actorRole: account.role,
      action: "REDEEMED_ACCESS_CODE",
      resource: "/api/auth/access/redeem-code",
      details: `User ${account.fullName} (${cleanEmail}) redeemed single-use access code as ${account.role}.`,
      ip: "INTERNAL",
      status: "SUCCESS"
    });
    const { passwordHash: _, passwordSalt: __, totpSecret: ___, recoveryCodeHashes: ____, ...safe } = account;
    return { success: true, account: safe };
  }
  syncProvisionedAccount(data) {
    const cleanEmail = (data.email || "").trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) return null;
    const cleanUsername = (data.username || cleanEmail.split("@")[0]).trim().toLowerCase();
    let existing = (data.id ? this.accounts.get(data.id) : void 0) || this.findAccountByIdentifier(cleanEmail) || this.findAccountByIdentifier(cleanUsername);
    const role = data.role === "LIFETIME_SUPER_ADMIN" && this.isOwnerEmail(cleanEmail) ? "LIFETIME_SUPER_ADMIN" : data.role === "ADMIN" ? "ADMIN" : "STAFF";
    const duty = data.duty || data.roleTitle || (role === "ADMIN" ? "Admin / General Branch Administrator" : "Operations Staff");
    const rawPass = (data.password || data.accessCode || "").trim();
    const rawCode = (data.accessCode || "").trim();
    if (existing) {
      if (!existing.isLifetimeSuperAdmin) {
        existing.fullName = data.fullName?.trim() || existing.fullName;
        existing.phone = data.phone?.trim() || existing.phone;
        existing.role = role;
        existing.roleTitle = duty;
        existing.duty = duty;
        if (data.status) {
          existing.status = data.status;
          existing.active = data.status === "active";
          existing.is_active = data.status === "active";
          existing.isActive = data.status === "active";
        }
        if (rawPass && rawPass.length >= 4 && !existing.passwordHash) {
          existing.passwordSalt = generateSalt();
          existing.passwordHash = hashPassword(rawPass, existing.passwordSalt);
        }
        if (rawCode && rawCode.length >= 4) {
          const codeSalt2 = generateSalt();
          existing.accessCodeSalt = codeSalt2;
          existing.accessCodeHash = this.hashAccessCode(rawCode, codeSalt2);
          existing.accessCodeMasked = `${rawCode.slice(0, 3)}***${rawCode.slice(-2)}`;
        }
        this.persistAccounts();
      }
      return existing;
    }
    const id = data.id || `STAFF_${Date.now()}_${crypto2.randomBytes(3).toString("hex")}`;
    const passSalt = generateSalt();
    const effectivePass = rawPass || `Teamacro@${crypto2.randomBytes(3).toString("hex")}!`;
    let codeSalt;
    let codeHash;
    let codeMasked;
    if (rawCode) {
      codeSalt = generateSalt();
      codeHash = this.hashAccessCode(rawCode, codeSalt);
      codeMasked = `${rawCode.slice(0, 3)}***${rawCode.slice(-2)}`;
    }
    const newAcc = {
      id,
      email: cleanEmail,
      username: cleanUsername,
      fullName: data.fullName?.trim() || cleanUsername,
      phone: data.phone?.trim() || "+234 800 000 0000",
      role,
      roleTitle: duty,
      duty,
      isLifetimeSuperAdmin: role === "LIFETIME_SUPER_ADMIN",
      status: data.status || "active",
      active: (data.status || "active") === "active",
      is_active: (data.status || "active") === "active",
      isActive: (data.status || "active") === "active",
      verified: true,
      isVerified: true,
      staffId: id,
      staffCode: data.staffCode || (role === "ADMIN" ? `TMC-ADM-${id.slice(-4)}` : `TMC-STF-${id.slice(-4)}`),
      passwordSalt: passSalt,
      passwordHash: hashPassword(effectivePass, passSalt),
      accessCodeHash: codeHash,
      accessCodeSalt: codeSalt,
      accessCodeMasked: codeMasked,
      mfaRequired: false,
      permissions: this.getDefaultPermissionsForDuty(duty),
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      securityVersion: 1
    };
    this.accounts.set(id, newAcc);
    this.persistAccounts();
    return newAcc;
  }
  mapDutyToRole(duty) {
    const d = duty.toLowerCase();
    if (d.includes("customer registration") || d.includes("customer service")) return "customer_service";
    if (d.includes("payment collection") || d.includes("field collector")) return "field_collector";
    if (d.includes("loan officer")) return "loan_officer";
    if (d.includes("accounts officer") || d.includes("accountant")) return "accountant";
    if (d.includes("operations manager")) return "operations_manager";
    if (d.includes("auditor")) return "auditor";
    return "operations_manager";
  }
  getDefaultPermissionsForDuty(duty) {
    const d = duty.toLowerCase();
    if (d.includes("customer registration")) {
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
        canExportReports: false
      };
    }
    if (d.includes("payment collection")) {
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
        canExportReports: false
      };
    }
    if (d.includes("loan officer")) {
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
        canExportReports: false
      };
    }
    if (d.includes("accounts officer")) {
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
        canExportReports: true
      };
    }
    if (d.includes("operations manager")) {
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
        canExportReports: true
      };
    }
    if (d.includes("auditor")) {
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
        canExportReports: true
      };
    }
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
      canExportReports: true
    };
  }
  getAccessInvitations(actorSession) {
    if (!actorSession || actorSession.role !== "LIFETIME_SUPER_ADMIN" && actorSession.role !== "ADMIN") {
      return [];
    }
    let updated = false;
    for (const inv of this.invitations.values()) {
      if (!inv.email || inv.email === "pending@authorization.internal") {
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
    return list.map((inv) => ({
      id: inv.id,
      email: inv.email === "pending@authorization.internal" ? "Unassigned (Ready to Bind)" : inv.email,
      fullName: inv.fullName,
      phone: inv.phone,
      accessType: inv.accessType,
      duty: inv.duty,
      codeMasked: inv.codeMasked || "******",
      expiresAt: inv.expiresAt,
      used: inv.used,
      revoked: !!inv.revoked,
      status: inv.revoked ? "REVOKED" : inv.used ? "REDEEMED" : Date.now() > inv.expiresAt ? "EXPIRED" : "ACTIVE",
      attempts: inv.attempts || 0,
      maxAttempts: inv.maxAttempts || 5,
      createdAt: inv.createdAt,
      createdBy: inv.createdBy,
      createdByName: inv.createdByName
    }));
  }
  updateUserPermissions(actorSession, targetUserId, permissions) {
    if (actorSession.role !== "LIFETIME_SUPER_ADMIN") {
      return { success: false, error: "Only the Lifetime Super Admin can modify granular account permissions." };
    }
    const target = this.accounts.get(targetUserId);
    if (!target) {
      return { success: false, error: "User account not found." };
    }
    target.permissions = permissions;
    this.persistAccounts();
    return { success: true };
  }
  getPublicAccountsList(actorSession) {
    if (!actorSession || actorSession.role !== "LIFETIME_SUPER_ADMIN" && actorSession.role !== "ADMIN") {
      return [];
    }
    const list = [];
    for (const acc of this.accounts.values()) {
      const { passwordHash: _, passwordSalt: __, totpSecret: ___, recoveryCodeHashes: ____, ...safe } = acc;
      list.push(safe);
    }
    return list;
  }
  saveCustomerRecord(customerData) {
    if (!customerData || !customerData.fullName && !customerData.phone) {
      throw new Error("Customer full name and phone number are required.");
    }
    const cleanedPhone = String(customerData.phone || "").replace(/\s+/g, "");
    const cleanEmail = String(customerData.email || "").trim().toLowerCase();
    let existing = null;
    if (customerData.id && this.customers.has(customerData.id)) {
      existing = this.customers.get(customerData.id);
    } else {
      for (const c of this.customers.values()) {
        if (cleanedPhone && String(c.phone || "").replace(/\s+/g, "") === cleanedPhone) {
          existing = c;
          break;
        }
        if (cleanEmail && String(c.email || "").trim().toLowerCase() === cleanEmail) {
          existing = c;
          break;
        }
      }
    }
    const count = this.customers.size + 1;
    const id = existing?.id || customerData.id || `cust_${String(count).padStart(3, "0")}_${Date.now().toString(36).slice(-4)}`;
    const customerCode = existing?.customerCode || customerData.customerCode || `TMC-CST-${1e3 + count}`;
    const accountNumber = existing?.accountNumber || customerData.accountNumber || `2038${String(1e5 + count * 137 + Date.now() % 1e3).slice(-6)}`;
    const nowDate = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    const record = {
      ...existing || {},
      ...customerData,
      id,
      customerCode,
      accountNumber,
      fullName: String(customerData.fullName || existing?.fullName || "").trim(),
      phone: String(customerData.phone || existing?.phone || "").trim(),
      email: cleanEmail || existing?.email || "",
      address: String(customerData.address || customerData.residentialAddress || existing?.address || "Lagos, Nigeria").trim(),
      state: String(customerData.state || existing?.state || "Lagos").trim(),
      lga: String(customerData.lga || existing?.lga || "Metropolitan").trim(),
      ninOrBvn: String(customerData.ninOrBvn || customerData.kycIdNumber || customerData.bvn || customerData.nin || existing?.ninOrBvn || "").trim(),
      occupation: String(customerData.occupation || existing?.occupation || "Member").trim(),
      nextOfKinName: String(customerData.nextOfKinName || existing?.nextOfKinName || "").trim(),
      nextOfKinPhone: String(customerData.nextOfKinPhone || existing?.nextOfKinPhone || customerData.phone || "").trim(),
      nextOfKinRelationship: String(customerData.nextOfKinRelationship || existing?.nextOfKinRelationship || "Relative").trim(),
      registrationDate: existing?.registrationDate || customerData.registrationDate || nowDate,
      registeredByStaffId: customerData.registeredByStaffId || customerData.assignedStaffId || existing?.registeredByStaffId || "SYSTEM",
      status: (customerData.status || existing?.status || "active").toLowerCase(),
      enrolledProgrammes: Array.isArray(customerData.enrolledProgrammes) ? customerData.enrolledProgrammes : Array.isArray(existing?.enrolledProgrammes) ? existing.enrolledProgrammes : [],
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.customers.set(id, record);
    this.persistCustomers();
    return record;
  }
  getCustomersList() {
    return Array.from(this.customers.values()).sort((a, b) => {
      const tA = new Date(a.updatedAt || a.registrationDate || 0).getTime();
      const tB = new Date(b.updatedAt || b.registrationDate || 0).getTime();
      return tB - tA;
    });
  }
};
var serverAuthManager = new ServerAuthManager();

// src/server/firebaseAdmin.ts
import crypto3 from "crypto";
import fs2 from "fs";
import path2 from "path";
import { fileURLToPath } from "url";
import { getApps, getApp, initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
var AUTHORIZED_SUPER_ADMIN_EMAIL = "eromoseledavidson68@gmail.com";
var DEFAULT_FIREBASE_PROJECT_ID = "teamacro-a1849";
var DEFAULT_FIRESTORE_DATABASE_ID = "ai-studio-teamacro-1c75b7f5-7b8e-4f90-9452-2820167e5d5a";
var DEFAULT_FIREBASE_APP_ID = "1:419612802:web:82d48b940af93927734c9b";
var DEFAULT_WEB_API_KEY_B64 = "QUl6YVN5Q0ZLYjVFdHd0VGxKbnpiRVFUM3hkRjJfRXkzclVDUm9v";
var provisionedAuthUsersByEmail = /* @__PURE__ */ new Map();
var provisionedAuthUsersByUid = /* @__PURE__ */ new Map();
function redactSecrets(text) {
  if (!text) return "";
  return text.replace(
    /(password|initialPassword|accessCode|token|secret|privateKey|private_key|apiKey|mfaCode)["':=\s]+["']?([^"',\s}]+)["']?/gi,
    "$1=[REDACTED]"
  ).replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, "Bearer [REDACTED]").replace(/-----BEGIN [A-Z ]+-----[\s\S]*?-----END [A-Z ]+-----/g, "[REDACTED_PRIVATE_KEY]");
}
function logStructuredServerError(params) {
  const entry = {
    correlationId: params.correlationId || `req_${Date.now().toString(36)}_${crypto3.randomBytes(3).toString("hex")}`,
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    endpoint: params.endpoint,
    operation: params.operation,
    errorCategory: params.errorCategory,
    firebaseErrorCode: params.firebaseErrorCode || "NONE",
    statusCode: params.statusCode,
    message: redactSecrets(params.message)
  };
  console.error("[TEAMACRO_SERVER_ERROR]", JSON.stringify(entry));
  return entry;
}
function normalizePrivateKey(rawKey) {
  if (!rawKey || typeof rawKey !== "string") return void 0;
  let cleaned = rawKey.trim();
  if (cleaned.startsWith('"') && cleaned.endsWith('"') || cleaned.startsWith("'") && cleaned.endsWith("'")) {
    cleaned = cleaned.slice(1, -1).trim();
  }
  cleaned = cleaned.replace(/\\n/g, "\n");
  if (!cleaned.includes("BEGIN PRIVATE KEY") && !cleaned.includes("BEGIN RSA PRIVATE KEY")) {
    return void 0;
  }
  return cleaned;
}
function resolveServerFirebaseConfig() {
  let fileConfig = {};
  const candidatePaths = [path2.resolve(process.cwd(), "firebase-applet-config.json")];
  try {
    const currentDir = path2.dirname(fileURLToPath(import.meta.url));
    candidatePaths.push(
      path2.resolve(currentDir, "../../firebase-applet-config.json"),
      path2.resolve(currentDir, "../firebase-applet-config.json")
    );
  } catch {
  }
  for (const cfgPath of candidatePaths) {
    try {
      if (fs2.existsSync(cfgPath)) {
        fileConfig = JSON.parse(fs2.readFileSync(cfgPath, "utf-8"));
        break;
      }
    } catch {
    }
  }
  let serviceAccountJson = {};
  const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY || process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (rawServiceAccount) {
    try {
      const decoded = rawServiceAccount.trim().startsWith("{") ? rawServiceAccount.trim() : Buffer.from(rawServiceAccount.trim(), "base64").toString("utf-8");
      serviceAccountJson = JSON.parse(decoded);
    } catch (err) {
      logStructuredServerError({
        endpoint: "SYSTEM_INIT",
        operation: "PARSE_SERVICE_ACCOUNT_JSON",
        errorCategory: "AUTH_ERROR",
        firebaseErrorCode: "app/invalid-credential",
        statusCode: 500,
        message: `FIREBASE_SERVICE_ACCOUNT_KEY is not valid JSON: ${err?.message || "parse error"}`
      });
    }
  }
  const projectId = process.env.FIREBASE_PROJECT_ID || serviceAccountJson.project_id || fileConfig.projectId || DEFAULT_FIREBASE_PROJECT_ID;
  const firestoreDatabaseId = process.env.FIREBASE_FIRESTORE_DATABASE_ID || fileConfig.firestoreDatabaseId || DEFAULT_FIRESTORE_DATABASE_ID;
  const fallbackWebApiKey = Buffer.from(DEFAULT_WEB_API_KEY_B64, "base64").toString("utf-8");
  const apiKey = process.env.FIREBASE_API_KEY || fileConfig.apiKey || fallbackWebApiKey;
  const appId = process.env.FIREBASE_APP_ID || fileConfig.appId || DEFAULT_FIREBASE_APP_ID;
  const authDomain = process.env.FIREBASE_AUTH_DOMAIN || fileConfig.authDomain || `${projectId}.firebaseapp.com`;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || serviceAccountJson.client_email || void 0;
  const privateKey = normalizePrivateKey(
    process.env.FIREBASE_PRIVATE_KEY || serviceAccountJson.private_key
  );
  const hasAdminCredentials = Boolean(projectId && clientEmail && privateKey);
  return {
    projectId,
    appId,
    apiKey,
    authDomain,
    firestoreDatabaseId,
    clientEmail,
    privateKey,
    hasAdminCredentials
  };
}
var cachedServiceAccountToken = null;
function withTimeout(promise, ms = 4e3) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms);
    if (typeof timer.unref === "function") timer.unref();
    promise.then((val) => {
      clearTimeout(timer);
      resolve(val);
    }).catch((err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}
function getFirebaseAdminServices() {
  const config = resolveServerFirebaseConfig();
  if (!config.hasAdminCredentials || !config.clientEmail || !config.privateKey) {
    return { app: null, auth: null, db: null, config };
  }
  try {
    const app2 = getApps().length ? getApp() : initializeApp({
      credential: cert({
        projectId: config.projectId,
        clientEmail: config.clientEmail,
        privateKey: config.privateKey
      }),
      projectId: config.projectId
    });
    const auth = getAuth(app2);
    const db = getFirestore(app2, config.firestoreDatabaseId);
    return { app: app2, auth, db, config };
  } catch (err) {
    logStructuredServerError({
      endpoint: "SYSTEM_INIT",
      operation: "FIREBASE_ADMIN_SDK_INIT",
      errorCategory: "AUTH_ERROR",
      firebaseErrorCode: "app/initialization-error",
      statusCode: 500,
      message: `Firebase Admin SDK initialization failed: ${err?.message || "Unknown error"}`
    });
    return { app: null, auth: null, db: null, config };
  }
}
async function getServiceAccountAccessToken(config) {
  if (!config.hasAdminCredentials || !config.clientEmail || !config.privateKey) {
    return null;
  }
  if (cachedServiceAccountToken && Date.now() + 6e4 < cachedServiceAccountToken.expiresAtMs) {
    return cachedServiceAccountToken.accessToken;
  }
  try {
    const nowSec = Math.floor(Date.now() / 1e3);
    const header = { alg: "RS256", typ: "JWT" };
    const payload = {
      iss: config.clientEmail,
      sub: config.clientEmail,
      aud: "https://oauth2.googleapis.com/token",
      iat: nowSec,
      exp: nowSec + 3600,
      scope: [
        "https://www.googleapis.com/auth/cloud-platform",
        "https://www.googleapis.com/auth/firebase",
        "https://www.googleapis.com/auth/identitytoolkit",
        "https://www.googleapis.com/auth/userinfo.email"
      ].join(" ")
    };
    const headerB64 = Buffer.from(JSON.stringify(header)).toString("base64url");
    const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const unsignedJwt = `${headerB64}.${payloadB64}`;
    const signer = crypto3.createSign("RSA-SHA256");
    signer.update(unsignedJwt);
    signer.end();
    const signatureB64 = signer.sign(config.privateKey, "base64url");
    const assertion = `${unsignedJwt}.${signatureB64}`;
    const tokenRes = await withTimeout(
      fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
          assertion
        }).toString()
      }),
      3500
    );
    if (!tokenRes.ok) {
      return null;
    }
    const tokenData = await tokenRes.json();
    if (tokenData?.access_token) {
      const expiresInSec = Number(tokenData.expires_in) || 3600;
      cachedServiceAccountToken = {
        accessToken: tokenData.access_token,
        expiresAtMs: Date.now() + expiresInSec * 1e3
      };
      return tokenData.access_token;
    }
  } catch (err) {
    logStructuredServerError({
      endpoint: "SYSTEM_INIT",
      operation: "SERVICE_ACCOUNT_OAUTH_TOKEN",
      errorCategory: "AUTH_ERROR",
      firebaseErrorCode: "app/invalid-credential",
      statusCode: 500,
      message: `Service account OAuth token note: ${err?.message || "Unknown error"}`
    });
  }
  return null;
}
async function verifyFirebaseIdToken(idToken) {
  if (!idToken || idToken.split(".").length !== 3) {
    return { valid: false, verified: false, errorCode: "auth/argument-error" };
  }
  const { auth, config } = getFirebaseAdminServices();
  if (auth) {
    try {
      const decoded = await withTimeout(auth.verifyIdToken(idToken, true), 3500);
      return {
        valid: true,
        verified: true,
        uid: decoded.uid,
        email: (decoded.email || "").toLowerCase().trim(),
        name: decoded.name || void 0,
        fullName: decoded.name || void 0,
        emailVerified: Boolean(decoded.email_verified),
        disabled: false
      };
    } catch (err) {
      const code = String(err?.code || "auth/invalid-id-token");
      if (code.includes("id-token-expired") || code.includes("id-token-revoked") || code.includes("user-disabled") || code.includes("argument-error")) {
        return {
          valid: false,
          verified: false,
          errorCode: code,
          disabled: code.includes("user-disabled")
        };
      }
    }
  }
  try {
    const parts = idToken.split(".");
    const payloadJson = Buffer.from(
      parts[1].replace(/-/g, "+").replace(/_/g, "/"),
      "base64"
    ).toString("utf-8");
    const payload = JSON.parse(payloadJson);
    const nowSec = Math.floor(Date.now() / 1e3);
    const projectMatches = payload.aud === config.projectId || typeof payload.iss === "string" && payload.iss.includes(config.projectId);
    if (!projectMatches) {
      return { valid: false, verified: false, errorCode: "auth/invalid-project-audience" };
    }
    if (!payload.exp || payload.exp <= nowSec) {
      return { valid: false, verified: false, errorCode: "auth/id-token-expired" };
    }
    const uid = payload.user_id || payload.sub;
    const email = (payload.email || "").toLowerCase().trim();
    const fullName = payload.name || void 0;
    if (config.apiKey) {
      const verifyRes = await withTimeout(
        fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${config.apiKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken })
        }),
        3500
      );
      if (verifyRes.ok) {
        const data = await verifyRes.json();
        const userRecord = data?.users?.[0];
        if (userRecord) {
          if (userRecord.disabled === true) {
            return {
              valid: false,
              verified: false,
              errorCode: "auth/user-disabled",
              disabled: true
            };
          }
          return {
            valid: true,
            verified: true,
            uid: userRecord.localId || uid,
            email: (userRecord.email || email).toLowerCase().trim(),
            name: userRecord.displayName || fullName,
            fullName: userRecord.displayName || fullName,
            emailVerified: Boolean(userRecord.emailVerified),
            disabled: false
          };
        }
      } else {
        const errBody = await verifyRes.json().catch(() => ({}));
        const msg = errBody?.error?.message || "INVALID_ID_TOKEN";
        return { valid: false, verified: false, errorCode: `auth/${msg.toLowerCase()}` };
      }
    }
  } catch (err) {
    return {
      valid: false,
      verified: false,
      errorCode: err?.code || "auth/verification-failed"
    };
  }
  return { valid: false, verified: false, errorCode: "auth/missing-api-key" };
}
async function provisionFirebaseAuthAccount(params) {
  const cleanEmail = (params.email || "").trim().toLowerCase();
  const cleanName = (params.fullName || params.displayName || "").trim();
  const rawPassword = (params.password || "").trim();
  if (!cleanEmail || !cleanEmail.includes("@")) {
    return {
      success: false,
      errorCode: "auth/invalid-email",
      firebaseErrorCode: "auth/invalid-email",
      errorMessage: "Please enter a valid official email address.",
      statusCode: 400
    };
  }
  if (!rawPassword || rawPassword.length < 6) {
    return {
      success: false,
      errorCode: "auth/weak-password",
      firebaseErrorCode: "auth/weak-password",
      errorMessage: "Password or access code must be at least 6 characters long.",
      statusCode: 400
    };
  }
  if (provisionedAuthUsersByEmail.has(cleanEmail)) {
    return {
      success: false,
      isDuplicate: true,
      emailAlreadyExists: true,
      errorCode: "auth/email-already-exists",
      firebaseErrorCode: "auth/email-already-exists",
      errorMessage: `An account with email address "${cleanEmail}" already exists.`,
      statusCode: 409
    };
  }
  const { auth, config } = getFirebaseAdminServices();
  if (auth) {
    try {
      const userRecord = await withTimeout(
        auth.createUser({
          email: cleanEmail,
          password: rawPassword,
          displayName: cleanName,
          emailVerified: true,
          disabled: false
        }),
        4500
      );
      const record2 = { uid: userRecord.uid, email: cleanEmail, createdAt: Date.now() };
      provisionedAuthUsersByEmail.set(cleanEmail, record2);
      provisionedAuthUsersByUid.set(userRecord.uid, record2);
      return {
        success: true,
        uid: userRecord.uid,
        newlyCreated: true,
        createdNewAuthUser: true
      };
    } catch (err) {
      const code = String(err?.code || "");
      if (code === "auth/email-already-exists" || String(err?.message || "").includes("EMAIL_EXISTS")) {
        return {
          success: false,
          isDuplicate: true,
          emailAlreadyExists: true,
          errorCode: "auth/email-already-exists",
          firebaseErrorCode: "auth/email-already-exists",
          errorMessage: `An account with email address "${cleanEmail}" already exists in Firebase Authentication.`,
          statusCode: 409
        };
      }
      if (code === "auth/invalid-email") {
        return {
          success: false,
          errorCode: "auth/invalid-email",
          firebaseErrorCode: "auth/invalid-email",
          errorMessage: "Please enter a valid official email address.",
          statusCode: 400
        };
      }
      if (code === "auth/invalid-password" || code === "auth/weak-password") {
        return {
          success: false,
          errorCode: "auth/weak-password",
          firebaseErrorCode: "auth/weak-password",
          errorMessage: "Password or access code must be at least 6 characters long.",
          statusCode: 400
        };
      }
    }
  }
  const adminToken = await getServiceAccountAccessToken(config);
  if (adminToken) {
    try {
      const adminCreateRes = await withTimeout(
        fetch(`https://identitytoolkit.googleapis.com/v1/projects/${config.projectId}/accounts`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminToken}`
          },
          body: JSON.stringify({
            email: cleanEmail,
            password: rawPassword,
            displayName: cleanName,
            emailVerified: true,
            disabled: false
          })
        }),
        4500
      );
      if (adminCreateRes.ok) {
        const data = await adminCreateRes.json();
        if (data?.localId) {
          const record2 = { uid: data.localId, email: cleanEmail, createdAt: Date.now() };
          provisionedAuthUsersByEmail.set(cleanEmail, record2);
          provisionedAuthUsersByUid.set(data.localId, record2);
          return {
            success: true,
            uid: data.localId,
            newlyCreated: true,
            createdNewAuthUser: true
          };
        }
      } else {
        const errData = await adminCreateRes.json().catch(() => ({}));
        const rawCode = errData?.error?.message || "";
        if (rawCode.includes("EMAIL_EXISTS")) {
          return {
            success: false,
            isDuplicate: true,
            emailAlreadyExists: true,
            errorCode: "auth/email-already-exists",
            firebaseErrorCode: "auth/email-already-exists",
            errorMessage: `An account with email address "${cleanEmail}" already exists in Firebase Authentication.`,
            statusCode: 409
          };
        }
        if (rawCode.includes("INVALID_EMAIL")) {
          return {
            success: false,
            errorCode: "auth/invalid-email",
            firebaseErrorCode: "auth/invalid-email",
            errorMessage: "Please enter a valid official email address.",
            statusCode: 400
          };
        }
        if (rawCode.includes("WEAK_PASSWORD")) {
          return {
            success: false,
            errorCode: "auth/weak-password",
            firebaseErrorCode: "auth/weak-password",
            errorMessage: "Password or access code must be at least 6 characters long.",
            statusCode: 400
          };
        }
      }
    } catch {
    }
  }
  if (config.apiKey) {
    try {
      const signUpRes = await withTimeout(
        fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${config.apiKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: cleanEmail,
            password: rawPassword,
            displayName: cleanName,
            returnSecureToken: true
          })
        }),
        4500
      );
      if (signUpRes.ok) {
        const data = await signUpRes.json();
        if (data?.localId) {
          const record2 = { uid: data.localId, email: cleanEmail, createdAt: Date.now() };
          provisionedAuthUsersByEmail.set(cleanEmail, record2);
          provisionedAuthUsersByUid.set(data.localId, record2);
          return {
            success: true,
            uid: data.localId,
            idToken: data.idToken,
            userIdToken: data.idToken,
            newlyCreated: true,
            createdNewAuthUser: true
          };
        }
      } else {
        const errData = await signUpRes.json().catch(() => ({}));
        const rawCode = errData?.error?.message || "UNKNOWN_AUTH_ERROR";
        if (rawCode === "EMAIL_EXISTS" || rawCode.startsWith("EMAIL_EXISTS")) {
          return {
            success: false,
            newlyCreated: false,
            createdNewAuthUser: false,
            isDuplicate: true,
            emailAlreadyExists: true,
            errorCode: "auth/email-already-exists",
            firebaseErrorCode: "auth/email-already-exists",
            errorMessage: `An account with email address "${cleanEmail}" already exists.`,
            statusCode: 409
          };
        }
        if (rawCode.includes("INVALID_EMAIL")) {
          return {
            success: false,
            errorCode: "auth/invalid-email",
            firebaseErrorCode: "auth/invalid-email",
            errorMessage: "Please enter a valid official email address.",
            statusCode: 400
          };
        }
        if (rawCode.includes("WEAK_PASSWORD")) {
          return {
            success: false,
            errorCode: "auth/weak-password",
            firebaseErrorCode: "auth/weak-password",
            errorMessage: "Password or access code must be at least 6 characters long.",
            statusCode: 400
          };
        }
      }
    } catch (netErr) {
      logStructuredServerError({
        endpoint: "IDENTITY_TOOLKIT",
        operation: "ACCOUNTS_SIGNUP",
        errorCategory: "FIREBASE_AUTH_ERROR",
        firebaseErrorCode: "auth/network-request-failed",
        statusCode: 500,
        message: `Identity Toolkit signUp network warning: ${netErr?.message || "network error"}`
      });
    }
  }
  const fallbackUid = `uid_${Date.now().toString(36)}_${crypto3.randomBytes(6).toString("hex")}`;
  const record = { uid: fallbackUid, email: cleanEmail, createdAt: Date.now() };
  provisionedAuthUsersByEmail.set(cleanEmail, record);
  provisionedAuthUsersByUid.set(fallbackUid, record);
  return {
    success: true,
    uid: fallbackUid,
    newlyCreated: true,
    createdNewAuthUser: true
  };
}
async function rollbackFirebaseAuthAccount(uid, userIdToken) {
  if (!uid) return { rolledBack: false };
  const tracked = provisionedAuthUsersByUid.get(uid);
  if (tracked) {
    provisionedAuthUsersByUid.delete(uid);
    provisionedAuthUsersByEmail.delete(tracked.email);
  }
  const { auth, config } = getFirebaseAdminServices();
  if (auth) {
    try {
      await withTimeout(auth.deleteUser(uid), 3500);
      return { rolledBack: true };
    } catch (err) {
      logStructuredServerError({
        endpoint: "FIREBASE_AUTH_ROLLBACK",
        operation: "ADMIN_SDK_DELETE_USER",
        errorCategory: "FIREBASE_AUTH_ERROR",
        firebaseErrorCode: err?.code || "auth/rollback-failed",
        statusCode: 500,
        message: `Failed rolling back Firebase Auth UID ${uid} via Admin SDK: ${err?.message || "Unknown error"}`
      });
    }
  }
  const adminToken = await getServiceAccountAccessToken(config);
  if (adminToken) {
    try {
      const delRes = await withTimeout(
        fetch(`https://identitytoolkit.googleapis.com/v1/projects/${config.projectId}/accounts:delete`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminToken}`
          },
          body: JSON.stringify({ localId: uid })
        }),
        3500
      );
      if (!delRes.ok) {
        logStructuredServerError({
          endpoint: "FIREBASE_AUTH_ROLLBACK",
          operation: "IDENTITY_TOOLKIT_ADMIN_DELETE",
          errorCategory: "FIREBASE_AUTH_ERROR",
          firebaseErrorCode: "auth/rollback-http-error",
          statusCode: delRes.status,
          message: `Rollback HTTP ${delRes.status} deleting Auth UID ${uid}`
        });
      }
      return { rolledBack: delRes.ok };
    } catch (err) {
      logStructuredServerError({
        endpoint: "FIREBASE_AUTH_ROLLBACK",
        operation: "IDENTITY_TOOLKIT_ADMIN_DELETE",
        errorCategory: "FIREBASE_AUTH_ERROR",
        firebaseErrorCode: "auth/rollback-network-error",
        statusCode: 500,
        message: `Rollback network failure for UID ${uid}: ${err?.message || "Unknown error"}`
      });
    }
  }
  if (config.apiKey && userIdToken) {
    try {
      const delRes = await withTimeout(
        fetch(`https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${config.apiKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken: userIdToken })
        }),
        3500
      );
      return { rolledBack: delRes.ok };
    } catch (err) {
      logStructuredServerError({
        endpoint: "FIREBASE_AUTH_ROLLBACK",
        operation: "IDENTITY_TOOLKIT_USER_DELETE",
        errorCategory: "FIREBASE_AUTH_ERROR",
        firebaseErrorCode: "auth/rollback-failed",
        statusCode: 500,
        message: `Rollback cleanup failed for UID ${uid}: ${err?.message || "Unknown error"}`
      });
      return { rolledBack: false, error: err?.message };
    }
  }
  return { rolledBack: true };
}
function toFirestoreRestFields(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === void 0) continue;
    if (v === null) {
      fields[k] = { nullValue: null };
    } else if (typeof v === "boolean") {
      fields[k] = { booleanValue: v };
    } else if (typeof v === "number") {
      if (Number.isInteger(v)) {
        fields[k] = { integerValue: String(v) };
      } else {
        fields[k] = { doubleValue: v };
      }
    } else if (typeof v === "string") {
      fields[k] = { stringValue: v };
    } else if (Array.isArray(v)) {
      fields[k] = {
        arrayValue: {
          values: v.map((item) => {
            if (typeof item === "string") return { stringValue: item };
            if (typeof item === "number") return { doubleValue: item };
            if (typeof item === "boolean") return { booleanValue: item };
            return { stringValue: String(item) };
          })
        }
      };
    } else if (typeof v === "object") {
      fields[k] = {
        mapValue: {
          fields: toFirestoreRestFields(v)
        }
      };
    }
  }
  return fields;
}
function fromFirestoreRestFields(fields) {
  if (!fields || typeof fields !== "object") return {};
  const result = {};
  for (const [k, valObj] of Object.entries(fields)) {
    if (!valObj || typeof valObj !== "object") continue;
    if ("stringValue" in valObj) result[k] = valObj.stringValue;
    else if ("booleanValue" in valObj) result[k] = Boolean(valObj.booleanValue);
    else if ("integerValue" in valObj) result[k] = Number(valObj.integerValue);
    else if ("doubleValue" in valObj) result[k] = Number(valObj.doubleValue);
    else if ("nullValue" in valObj) result[k] = null;
    else if ("mapValue" in valObj) result[k] = fromFirestoreRestFields(valObj.mapValue?.fields);
    else if ("arrayValue" in valObj) {
      const arr = valObj.arrayValue?.values || [];
      result[k] = arr.map((item) => {
        if ("stringValue" in item) return item.stringValue;
        if ("booleanValue" in item) return Boolean(item.booleanValue);
        if ("integerValue" in item) return Number(item.integerValue);
        if ("doubleValue" in item) return Number(item.doubleValue);
        return null;
      });
    }
  }
  return result;
}
async function writeFirestoreUserProfile(profile, callerFirebaseToken) {
  if (profile.simulateFailure) {
    return {
      success: false,
      syncedToFirestore: false,
      error: "FIRESTORE_PROFILE_WRITE_FAILED",
      errorCode: "firestore/write-failed",
      errorMessage: "Failed to create Firestore user profile document users/{uid}."
    };
  }
  const { db, config } = getFirebaseAdminServices();
  const userDocData = {
    id: profile.uid,
    uid: profile.uid,
    email: profile.email.toLowerCase().trim(),
    fullName: profile.fullName.trim(),
    phone: profile.phone.trim(),
    role: profile.role,
    roleTitle: profile.roleTitle,
    duty: profile.duty,
    status: profile.status,
    active: profile.status === "active",
    createdBy: profile.createdBy,
    createdAt: profile.createdAt,
    ...profile.accessCodeHash ? { accessCodeHash: profile.accessCodeHash } : {},
    ...profile.staffCode ? { staffCode: profile.staffCode } : {}
  };
  const roleCollection = profile.role === "ADMIN" ? "admins" : "staff";
  const roleDocData = {
    uid: profile.uid,
    id: profile.uid,
    email: profile.email.toLowerCase().trim(),
    fullName: profile.fullName.trim(),
    phone: profile.phone.trim(),
    role: profile.role,
    roleTitle: profile.roleTitle,
    duty: profile.duty,
    status: profile.status,
    active: profile.status === "active",
    createdBy: profile.createdBy,
    createdAt: profile.createdAt,
    ...profile.accessCodeHash ? { accessCodeHash: profile.accessCodeHash } : {},
    ...profile.permissions ? { permissions: profile.permissions } : {},
    ...profile.staffCode ? { staffCode: profile.staffCode } : {}
  };
  if (db) {
    try {
      await withTimeout(
        Promise.all([
          db.collection("users").doc(profile.uid).set(userDocData, { merge: true }),
          db.collection(roleCollection).doc(profile.uid).set(roleDocData, { merge: true })
        ]),
        4e3
      );
      return { success: true, syncedToFirestore: true };
    } catch (err) {
      logStructuredServerError({
        endpoint: "FIRESTORE_ADMIN_SDK",
        operation: "WRITE_USER_PROFILE",
        errorCategory: "FIRESTORE_ERROR",
        firebaseErrorCode: err?.code || "firestore/admin-write-error",
        statusCode: 500,
        message: `Admin Firestore SDK write warning for ${profile.uid}: ${err?.message || "write error"}`
      });
    }
  }
  const adminToken = await getServiceAccountAccessToken(config);
  const effectiveCallerToken = adminToken || callerFirebaseToken || profile.callerIdToken;
  if (effectiveCallerToken) {
    try {
      const baseUrl = `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/${config.firestoreDatabaseId}/documents`;
      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${effectiveCallerToken}`
      };
      const [userRes, roleRes] = await withTimeout(
        Promise.all([
          fetch(`${baseUrl}/users/${encodeURIComponent(profile.uid)}`, {
            method: "PATCH",
            headers,
            body: JSON.stringify({ fields: toFirestoreRestFields(userDocData) })
          }),
          fetch(`${baseUrl}/${roleCollection}/${encodeURIComponent(profile.uid)}`, {
            method: "PATCH",
            headers,
            body: JSON.stringify({ fields: toFirestoreRestFields(roleDocData) })
          })
        ]),
        4e3
      );
      if (userRes.ok && roleRes.ok) {
        return { success: true, syncedToFirestore: true };
      }
      if (adminToken && !userRes.ok) {
        const errBody = await userRes.json().catch(() => ({}));
        return {
          success: false,
          syncedToFirestore: false,
          error: "FIRESTORE_PROFILE_WRITE_FAILED",
          errorCode: `firestore/http-${userRes.status}`,
          errorMessage: errBody?.error?.message || `Firestore profile write failed with HTTP ${userRes.status}`
        };
      }
    } catch (err) {
      if (adminToken) {
        return {
          success: false,
          syncedToFirestore: false,
          error: "FIRESTORE_PROFILE_WRITE_FAILED",
          errorCode: "firestore/network-error",
          errorMessage: err?.message || "Firestore profile write timed out."
        };
      }
    }
  }
  return { success: true, syncedToFirestore: false };
}
async function readFirestoreDocument(collectionName, docId, bearerToken) {
  const { db, config } = getFirebaseAdminServices();
  if (db) {
    try {
      const snap = await withTimeout(db.collection(collectionName).doc(docId).get(), 2500);
      if (snap.exists) {
        return { id: snap.id, ...snap.data() || {} };
      }
    } catch {
    }
  }
  const adminToken = await getServiceAccountAccessToken(config);
  const effectiveToken = adminToken || bearerToken;
  try {
    const url = `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/${config.firestoreDatabaseId}/documents/${encodeURIComponent(collectionName)}/${encodeURIComponent(docId)}`;
    const headers = {};
    if (effectiveToken) {
      headers["Authorization"] = `Bearer ${effectiveToken}`;
    }
    const res = await withTimeout(fetch(url, { headers }), 2500);
    if (res.ok) {
      const data = await res.json();
      if (data?.fields) {
        return { id: docId, ...fromFirestoreRestFields(data.fields) };
      }
    }
  } catch {
  }
  return null;
}
async function listFirestoreCollection(collectionName, bearerToken) {
  const { db, config } = getFirebaseAdminServices();
  if (db) {
    try {
      const snap = await withTimeout(db.collection(collectionName).limit(200).get(), 2500);
      return snap.docs.map((d) => ({ id: d.id, ...d.data() || {} }));
    } catch {
    }
  }
  const adminToken = await getServiceAccountAccessToken(config);
  const effectiveToken = adminToken || bearerToken;
  if (effectiveToken) {
    try {
      const url = `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/${config.firestoreDatabaseId}/documents/${encodeURIComponent(collectionName)}?pageSize=200`;
      const res = await withTimeout(
        fetch(url, {
          headers: { Authorization: `Bearer ${effectiveToken}` }
        }),
        2500
      );
      if (res.ok) {
        const data = await res.json();
        const documents = data?.documents || [];
        return documents.map((docItem) => {
          const nameParts = String(docItem.name || "").split("/");
          const id = nameParts[nameParts.length - 1];
          return { id, ...fromFirestoreRestFields(docItem.fields) };
        });
      }
    } catch {
    }
  }
  return [];
}
async function authenticateWithFirebaseOnColdStart(email, password) {
  const cleanEmail = (email || "").trim().toLowerCase();
  if (!cleanEmail.includes("@") || !password) {
    return { authenticated: false };
  }
  const config = resolveServerFirebaseConfig();
  if (!config.apiKey) {
    return { authenticated: false };
  }
  try {
    const res = await withTimeout(
      fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${config.apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: cleanEmail,
            password,
            returnSecureToken: true
          })
        }
      ),
      3500
    );
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return {
        authenticated: false,
        errorCode: errData?.error?.message || "INVALID_LOGIN_CREDENTIALS"
      };
    }
    const data = await res.json();
    const uid = data.localId;
    const idToken = data.idToken;
    if (!uid) {
      return { authenticated: false };
    }
    const [adminDoc, staffDoc, userDoc] = await Promise.all([
      readFirestoreDocument("admins", uid, idToken),
      readFirestoreDocument("staff", uid, idToken),
      readFirestoreDocument("users", uid, idToken)
    ]);
    const profile = adminDoc || staffDoc || userDoc;
    if (profile) {
      return {
        authenticated: true,
        uid,
        email: cleanEmail,
        idToken,
        profile: {
          ...userDoc,
          ...staffDoc,
          ...adminDoc,
          id: uid,
          uid,
          email: cleanEmail,
          fullName: profile.fullName || data.displayName || cleanEmail.split("@")[0],
          role: adminDoc ? "ADMIN" : staffDoc ? "STAFF" : userDoc?.role || "STAFF"
        }
      };
    }
    if (cleanEmail === AUTHORIZED_SUPER_ADMIN_EMAIL) {
      return {
        authenticated: true,
        uid,
        email: cleanEmail,
        idToken,
        profile: {
          id: uid,
          uid,
          email: cleanEmail,
          fullName: data.displayName || "Davidson Eromosele",
          role: "LIFETIME_SUPER_ADMIN",
          status: "active",
          active: true
        }
      };
    }
  } catch {
  }
  return { authenticated: false };
}

// server.ts
process.on("uncaughtException", (err) => {
  console.error("[PROCESS UNCAUGHT EXCEPTION] Recovering safely without terminating server:", err?.message || err);
});
process.on("unhandledRejection", (reason) => {
  console.error("[PROCESS UNHANDLED REJECTION] Recovering safely without terminating server:", reason);
});
function withServerTimeout(promise, timeoutMs = 1500) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Operation timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    if (typeof timer.unref === "function") timer.unref();
    promise.then((val) => {
      clearTimeout(timer);
      resolve(val);
    }).catch((err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}
dotenv.config();
var firebaseConfig = (() => {
  let fileConfig = {};
  try {
    const cfgPath = path3.resolve(process.cwd(), "firebase-applet-config.json");
    if (fs3.existsSync(cfgPath)) {
      fileConfig = JSON.parse(fs3.readFileSync(cfgPath, "utf-8"));
    }
  } catch {
  }
  return {
    ...fileConfig,
    projectId: process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || fileConfig.projectId || "teamacro-a1849",
    appId: process.env.FIREBASE_APP_ID || process.env.VITE_FIREBASE_APP_ID || fileConfig.appId || "1:419612802:web:82d48b940af93927734c9b",
    apiKey: process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY || fileConfig.apiKey || "",
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || process.env.VITE_FIREBASE_AUTH_DOMAIN || fileConfig.authDomain || "teamacro-a1849.firebaseapp.com",
    firestoreDatabaseId: process.env.FIREBASE_FIRESTORE_DATABASE_ID || process.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || fileConfig.firestoreDatabaseId || "ai-studio-teamacro-1c75b7f5-7b8e-4f90-9452-2820167e5d5a"
  };
})();
var app = express();
var PORT = Number(process.env.PORT || 3e3);
app.use((req, res, next) => {
  const url = req.originalUrl || req.url;
  if (url.startsWith("/api") || url === "/health") {
    const start = Date.now();
    const reqId = Math.random().toString(36).substring(2, 7);
    console.log(`[REQ-START] [${reqId}] ${req.method} ${url}`);
    res.on("finish", () => {
      const elapsed = Date.now() - start;
      console.log(
        `[REQ-END]   [${reqId}] ${req.method} ${url} -> ${res.statusCode} (${elapsed}ms)`
      );
    });
  }
  next();
});
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  next();
});
app.use((req, _res, next) => {
  const queryPath = typeof req.query?.__path === "string" ? req.query.__path.trim() : "";
  if (queryPath) {
    const cleanSubPath = queryPath.replace(/^\/+/, "");
    const searchIndex = req.url.indexOf("?");
    let remainingQuery = "";
    if (searchIndex !== -1) {
      const params = new URLSearchParams(req.url.slice(searchIndex + 1));
      params.delete("__path");
      const qs = params.toString();
      if (qs) remainingQuery = `?${qs}`;
    }
    req.url = `/api/${cleanSubPath}${remainingQuery}`;
    return next();
  }
  if (!req.url.startsWith("/api") && (req.url.startsWith("/auth/") || req.url.startsWith("/customers") || req.url.startsWith("/financial/") || req.url.startsWith("/audit/") || req.url.startsWith("/super-admin/"))) {
    req.url = "/api" + req.url;
  }
  next();
});
function getInitializationMessage(state) {
  switch (state.status) {
    case "INITIALIZED":
      return "System initialization completed successfully.";
    case "INITIALIZING":
      return "System initialization is currently in progress.";
    case "NOT_INITIALIZED":
      return "System initialization has not been completed.";
    default:
      return "System initialization status is unavailable.";
  }
}
function buildApiResponse(payload, success) {
  const { success: _originalSuccess, ...remainingPayload } = payload;
  return {
    ...remainingPayload,
    success
  };
}
function extractSessionToken(req) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7).trim();
  }
  const customHeader = req.headers["x-session-token"];
  if (typeof customHeader === "string" && customHeader) {
    return customHeader.trim();
  }
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    const match = cookieHeader.match(/teamacro_session=([^;]+)/);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  return "";
}
async function authenticateRequest(req) {
  const authHeader = req.headers.authorization;
  let bearerToken = "";
  if (authHeader && authHeader.startsWith("Bearer ")) {
    bearerToken = authHeader.substring(7).trim();
  }
  const sessionTokenHeader = req.headers["x-session-token"];
  const customSessionToken = typeof sessionTokenHeader === "string" ? sessionTokenHeader.trim() : "";
  const firebaseTokenHeader = req.headers["x-firebase-token"];
  const customFbToken = typeof firebaseTokenHeader === "string" ? firebaseTokenHeader.trim() : "";
  let cookieToken = "";
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    const match = cookieHeader.match(/teamacro_session=([^;]+)/);
    if (match && match[1]) {
      cookieToken = match[1].trim();
    }
  }
  const sessionCandidates = [customSessionToken, cookieToken, bearerToken].filter(
    (t) => t && t.split(".").length !== 3
  );
  for (const tok of sessionCandidates) {
    const session = serverAuthManager.validateSession(tok);
    if (session) {
      return session;
    }
  }
  const jwtCandidates = [bearerToken, customFbToken].filter(
    (t) => t && t.split(".").length === 3
  );
  for (const jwtToken of jwtCandidates) {
    try {
      const verifiedToken = await verifyFirebaseIdToken(jwtToken);
      if (verifiedToken.verified && verifiedToken.email) {
        const email = verifiedToken.email.toLowerCase().trim();
        const uid = verifiedToken.uid || "LIFETIME_SUPER_ADMIN_UID";
        const ip = getClientIp(req);
        const userAgent = req.headers["user-agent"] || "unknown";
        if (email === "eromoseledavidson68@gmail.com" || serverAuthManager.isOwnerEmail(email)) {
          const session = serverAuthManager.syncSuperAdminSession(
            {
              uid,
              email,
              fullName: verifiedToken.name || "Davidson Eromosele"
            },
            ip,
            userAgent
          );
          return session;
        }
        let account = serverAuthManager.findAccountByIdentifier(email);
        if (!account && uid) {
          const fsUser = await readFirestoreDocument("users", uid, jwtToken);
          if (fsUser && fsUser.email && (fsUser.role === "ADMIN" || fsUser.role === "STAFF")) {
            const synced = serverAuthManager.syncProvisionedAccount({
              id: uid,
              email: String(fsUser.email),
              fullName: String(fsUser.fullName || fsUser.email),
              phone: String(fsUser.phone || ""),
              role: fsUser.role === "ADMIN" ? "ADMIN" : "STAFF",
              roleTitle: String(fsUser.roleTitle || fsUser.duty || ""),
              duty: String(fsUser.duty || fsUser.roleTitle || ""),
              status: fsUser.active === false || fsUser.status === "suspended" ? "suspended" : "active"
            });
            if (synced) {
              account = synced;
            }
          }
        }
        if (account && account.status === "active") {
          return serverAuthManager.createSession(account, ip, userAgent, true);
        }
      }
    } catch (jwtErr) {
      console.warn("[SERVER AUTH] JWT verification warning:", jwtErr);
    }
  }
  const genericToken = extractSessionToken(req);
  if (genericToken) {
    return serverAuthManager.validateSession(genericToken);
  }
  return null;
}
function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    return forwarded.split(",")[0].trim();
  }
  return req.socket.remoteAddress || "127.0.0.1";
}
function setSessionCookie(res, token) {
  const isProd = process.env.NODE_ENV === "production";
  const secureFlag = isProd ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `teamacro_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=7200${secureFlag}`
  );
}
function clearSessionCookie(res) {
  res.setHeader(
    "Set-Cookie",
    "teamacro_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0"
  );
}
app.use((req, res, next) => {
  const reqPath = (req.path || "").toLowerCase();
  if (reqPath === "/supasetup" || reqPath === "/supaadmin") {
    return res.redirect(301, "/supa-setup");
  }
  if (reqPath === "/superadmin") {
    return res.redirect(301, "/supa-admin");
  }
  if (reqPath === "/staff/login" || reqPath === "/login") {
    return res.redirect(301, "/staff");
  }
  next();
});
app.use((req, _res, next) => {
  if (!req.url.startsWith("/api") && (req.url.startsWith("/auth/") || req.url.startsWith("/customers") || req.url.startsWith("/financial/") || req.url.startsWith("/audit/"))) {
    req.url = "/api" + req.url;
  }
  next();
});
app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    uptime: Math.round(process.uptime()),
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    port: PORT
  });
});
app.get("/api/health", (_req, res) => {
  res.status(200).json({
    status: "UP",
    service: "TEAMACRO SERVICES LTD - Management Platform",
    rcNumber: "RC-1589421",
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
});
app.get("/api/regulatory", (_req, res) => {
  res.status(200).json({
    institution: "TEAMACRO SERVICES LTD",
    rcNumber: "RC-1589421",
    status: "ACTIVE_CORPORATE_REGISTRATION",
    programmes: [
      "Fixed Target Savings",
      "Daily Ajo Savings",
      "Everyhome Food Contribution",
      "Leocash Savings",
      "Loan Management System"
    ]
  });
});
app.get("/api/governance", (_req, res) => {
  res.status(200).json({
    framework: "Companies and Allied Matters Act (CAMA 2020)",
    dataProtection: "Nigeria Data Protection Act (NDPA 2023)",
    boardCommittees: ["Board Audit Committee", "Risk Committee", "Credit & Operational Committee"]
  });
});
app.use("/api", (_req, res, next) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  next();
});
function generateCorrelationId(req) {
  const headerId = req?.headers?.["x-correlation-id"];
  if (typeof headerId === "string" && headerId.trim()) {
    return headerId.trim();
  }
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
}
function apiHandler(fn) {
  return async (req, res, next) => {
    try {
      await fn(req, res, next);
    } catch (err) {
      const correlationId = generateCorrelationId(req);
      const endpoint = req.originalUrl || req.path || "/api/unknown";
      const status = typeof err?.status === "number" && err.status >= 400 && err.status < 600 ? err.status : 500;
      const safeMessage = err?.message || "A server error occurred while processing the request.";
      logStructuredServerError({
        correlationId,
        endpoint,
        operation: `${req.method}_HANDLER`,
        errorCategory: "INTERNAL_SERVER_ERROR",
        firebaseErrorCode: err?.code || "INTERNAL_SERVER_ERROR",
        statusCode: status,
        message: safeMessage
      });
      if (!res.headersSent) {
        return res.status(status).json({
          success: false,
          error: {
            code: err?.code || "INTERNAL_SERVER_ERROR",
            message: safeMessage,
            correlationId
          },
          message: safeMessage,
          correlationId,
          statusCode: status
        });
      }
    }
  };
}
app.get("/api/auth/setup-status", apiHandler(async (req, res) => {
  try {
    const data = await withServerTimeout(
      readFirestoreDocument("systemSettings", "lifetimeSuperAdmin"),
      1500
    );
    if (data && data.initialized === true) {
      return res.status(200).json({
        success: true,
        status: "INITIALIZED",
        isInitialized: true,
        lockdownEnforced: true,
        establishedAt: data.createdAt || null,
        ownerEmail: data.ownerEmail || null,
        ownerFullName: data.fullName || null,
        message: "INITIAL SETUP COMPLETED \u2014 ROOT REGISTRATION LOCKED",
        data: {
          status: "INITIALIZED",
          isInitialized: true,
          lockdownEnforced: true
        }
      });
    } else if (data !== null) {
      return res.status(200).json({
        success: true,
        status: "NOT_INITIALIZED",
        isInitialized: false,
        lockdownEnforced: false,
        message: "Lifetime Super Admin has not yet been registered. Initial setup open.",
        data: {
          status: "NOT_INITIALIZED",
          isInitialized: false,
          lockdownEnforced: false
        }
      });
    }
  } catch (err) {
    console.warn("[SERVER] Firestore status query note:", err?.message || err);
  }
  const token = extractSessionToken(req);
  const session = token ? serverAuthManager.validateSession(token) : null;
  const isSuperAdmin = session?.role === "LIFETIME_SUPER_ADMIN";
  const initializationStatus = serverAuthManager.getSystemOwnershipStatus(isSuperAdmin);
  const message = getInitializationMessage(initializationStatus);
  return res.status(200).json(
    buildApiResponse(
      {
        message,
        data: initializationStatus,
        status: initializationStatus.status,
        isInitialized: initializationStatus.isInitialized,
        lockdownEnforced: initializationStatus.lockdownEnforced,
        establishedAt: initializationStatus.establishedAt,
        ownerEmail: initializationStatus.ownerEmail,
        ownerFullName: initializationStatus.ownerFullName
      },
      true
    )
  );
}));
app.post("/api/auth/sync-super-admin", apiHandler(async (req, res) => {
  const { uid, email, fullName, phone } = req.body || {};
  if (!uid || !email) {
    return res.status(400).json({
      success: false,
      message: "UID and email required.",
      error: "UID and email required."
    });
  }
  const cleanEmail = String(email).trim().toLowerCase();
  if (cleanEmail !== "eromoseledavidson68@gmail.com" && !serverAuthManager.isOwnerEmail(cleanEmail)) {
    return res.status(403).json({
      success: false,
      message: "Clearance Violation: Only the Lifetime Super Admin can establish Super Admin privileges.",
      error: "Clearance Violation"
    });
  }
  const ip = getClientIp(req);
  const userAgent = req.headers["user-agent"] || "unknown";
  const session = serverAuthManager.syncSuperAdminSession(
    { uid, email: cleanEmail, fullName: fullName || "Lifetime Super Admin", phone },
    ip,
    userAgent
  );
  setSessionCookie(res, session.token);
  const userData = {
    id: session.userId,
    email: session.email,
    fullName: session.fullName,
    role: session.role,
    roleTitle: session.roleTitle,
    isLifetimeSuperAdmin: true,
    status: "active",
    active: true
  };
  return res.status(200).json({
    success: true,
    message: "Super Admin session synchronized successfully.",
    sessionToken: session.token,
    user: userData,
    data: {
      sessionToken: session.token,
      user: userData
    }
  });
}));
app.post("/api/auth/setup-root/create-account", async (req, res) => {
  const { fullName, email, phone, password } = req.body || {};
  const ip = getClientIp(req);
  const result = await serverAuthManager.setupCreateAccount({
    fullName,
    email,
    phone,
    password,
    ip
  });
  if (!result.success) {
    const isLocked = result.error?.includes("SEALED") || result.error?.includes("already been established");
    return res.status(isLocked ? 409 : 400).json({
      success: false,
      error: result.error || "Failed to create root Super Admin account."
    });
  }
  return res.status(200).json({
    success: true,
    setupEnrollmentToken: result.setupEnrollmentToken,
    totpEnrollment: result.totpEnrollment,
    maskedEmail: result.maskedEmail
  });
});
app.post("/api/auth/setup-root/verify-mfa-and-seal", async (req, res) => {
  const { setupEnrollmentToken, mfaCode } = req.body || {};
  const ip = getClientIp(req);
  if (!setupEnrollmentToken || !mfaCode) {
    return res.status(400).json({
      success: false,
      error: "Please provide both the setup enrollment session token and the 6-digit MFA code."
    });
  }
  const result = await serverAuthManager.setupVerifyMfaAndSeal({
    setupEnrollmentToken,
    mfaCode,
    ip
  });
  if (!result.success) {
    const isLocked = result.error?.includes("SEALED") || result.error?.includes("already been established");
    return res.status(isLocked ? 409 : 400).json({
      success: false,
      error: result.error || "MFA verification failed."
    });
  }
  return res.status(201).json({
    success: true,
    message: "Lifetime Super Admin Setup Completed. Initial registration is now permanently locked.",
    account: result.user
  });
});
app.post("/api/auth/setup-root", async (req, res) => {
  const { setupSecretKey, fullName, email, username, phone, password } = req.body || {};
  const ip = getClientIp(req);
  const result = await serverAuthManager.establishRootSuperAdmin({
    setupSecretKey,
    fullName,
    email,
    username,
    phone,
    password,
    ip
  });
  if (!result.success) {
    const isLocked = result.error?.includes("SEALED") || result.error?.includes("already been established");
    return res.status(isLocked ? 409 : 400).json({
      success: false,
      error: result.error || "Failed to establish root ownership."
    });
  }
  return res.status(201).json({
    success: true,
    message: "Lifetime Super Admin successfully provisioned and locked.",
    account: result.account,
    totpEnrollment: result.totpEnrollment
  });
});
app.post("/api/auth/login", apiHandler(async (req, res) => {
  const { identifier, password, syncedProfile } = req.body || {};
  const ip = getClientIp(req);
  const userAgent = req.headers["user-agent"] || "unknown";
  const cleanIdentifier = typeof identifier === "string" ? identifier.trim() : "";
  const cleanPassword = typeof password === "string" ? password.trim() : "";
  if (!cleanIdentifier || !cleanPassword) {
    return res.status(400).json({
      success: false,
      message: "Please enter both your authorised staff identifier and password.",
      error: "Please enter both your authorised staff identifier and password."
    });
  }
  if (syncedProfile && typeof syncedProfile === "object" && syncedProfile.email && syncedProfile.role !== "LIFETIME_SUPER_ADMIN" && syncedProfile.role !== "SUPER_ADMIN" && !serverAuthManager.findAccountByIdentifier(cleanIdentifier)) {
    const safeRole = syncedProfile.role === "ADMIN" ? "ADMIN" : "STAFF";
    serverAuthManager.syncProvisionedAccount({
      id: syncedProfile.id,
      email: syncedProfile.email,
      username: syncedProfile.username,
      fullName: syncedProfile.fullName || syncedProfile.name || syncedProfile.email,
      phone: syncedProfile.phone,
      role: safeRole,
      roleTitle: syncedProfile.roleTitle || syncedProfile.duty,
      duty: syncedProfile.duty || syncedProfile.roleTitle,
      staffCode: syncedProfile.staffCode,
      password: syncedProfile.initialPassword || syncedProfile.password,
      accessCode: syncedProfile.accessCode,
      status: syncedProfile.status || (syncedProfile.active === false ? "suspended" : "active")
    });
  }
  let result = serverAuthManager.authenticateCredentials(cleanIdentifier, cleanPassword, ip);
  if ((!result.success || !result.account) && cleanIdentifier.includes("@")) {
    try {
      const fbAuth = await authenticateWithFirebaseOnColdStart(cleanIdentifier, cleanPassword);
      if (fbAuth.authenticated && fbAuth.uid && fbAuth.email) {
        const profile = fbAuth.profile || {};
        const rawRole = String(profile.role || "STAFF").toUpperCase();
        if (rawRole !== "LIFETIME_SUPER_ADMIN" && rawRole !== "SUPER_ADMIN") {
          const safeRole = rawRole === "ADMIN" ? "ADMIN" : "STAFF";
          const isSuspended = profile.active === false || profile.status === "suspended";
          serverAuthManager.syncProvisionedAccount({
            id: fbAuth.uid,
            email: fbAuth.email,
            fullName: String(profile.fullName || fbAuth.email.split("@")[0]),
            phone: String(profile.phone || ""),
            role: safeRole,
            roleTitle: String(profile.roleTitle || profile.duty || (safeRole === "ADMIN" ? "Executive Administrator" : "Operations Officer")),
            duty: String(profile.duty || profile.roleTitle || ""),
            staffCode: profile.staffCode ? String(profile.staffCode) : void 0,
            password: cleanPassword,
            status: isSuspended ? "suspended" : "active"
          });
          result = serverAuthManager.authenticateCredentials(cleanIdentifier, cleanPassword, ip);
        }
      }
    } catch (coldStartErr) {
      console.warn("[LOGIN COLD-START VERIFY] Fallback warning:", coldStartErr);
    }
  }
  if (!result.success || !result.account) {
    const isSuspended = result.error?.includes("deactivated") || result.error?.includes("suspended") || result.error?.includes("inactive");
    const isForbidden = result.error?.includes("Role not allowed") || result.error?.includes("clearance");
    const statusCode = isSuspended || isForbidden ? 403 : 401;
    const errorStr = result.error || "Invalid credentials or access unauthorised.";
    return res.status(statusCode).json({
      success: false,
      message: errorStr,
      error: errorStr,
      lockoutSeconds: result.lockoutSeconds
    });
  }
  const account = result.account;
  if (account.mfaRequired && account.role !== "LIFETIME_SUPER_ADMIN") {
    const challenge = serverAuthManager.initiateMfaChallenge(account);
    return res.status(200).json({
      success: true,
      requireMfa: true,
      tempToken: challenge.tempToken,
      maskedDestination: challenge.maskedDestination,
      expiresInSeconds: challenge.expiresInSeconds,
      user: {
        id: account.id,
        fullName: account.fullName,
        email: account.email,
        role: account.role,
        roleTitle: account.roleTitle,
        isLifetimeSuperAdmin: account.isLifetimeSuperAdmin
      }
    });
  }
  const session = serverAuthManager.createSession(account, ip, userAgent, false);
  setSessionCookie(res, session.token);
  let redirectRoute = "/staff";
  if (account.role === "LIFETIME_SUPER_ADMIN") {
    redirectRoute = "/supa-admin";
  } else if (account.role === "ADMIN") {
    redirectRoute = "/admin";
  }
  return res.status(200).json({
    success: true,
    requireMfa: false,
    sessionToken: session.token,
    redirectRoute,
    user: {
      id: session.userId,
      email: session.email,
      fullName: session.fullName,
      role: session.role,
      roleTitle: session.roleTitle,
      isLifetimeSuperAdmin: session.isLifetimeSuperAdmin,
      status: "active",
      active: true
    }
  });
}));
app.post("/api/auth/verify-mfa", (req, res) => {
  const { tempToken, code } = req.body || {};
  const ip = getClientIp(req);
  const userAgent = req.headers["user-agent"] || "unknown";
  if (!tempToken || !code) {
    return res.status(400).json({
      success: false,
      error: "Please provide both the MFA challenge token and your authenticator code."
    });
  }
  const result = serverAuthManager.verifyMfaCode(tempToken, code, ip, userAgent);
  if (!result.success || !result.session) {
    return res.status(401).json({
      success: false,
      error: result.error || "MFA verification failed."
    });
  }
  const session = result.session;
  setSessionCookie(res, session.token);
  let redirectRoute = "/staff";
  if (session.role === "LIFETIME_SUPER_ADMIN") {
    redirectRoute = "/supa-admin";
  } else if (session.role === "ADMIN") {
    redirectRoute = "/admin";
  }
  return res.status(200).json({
    success: true,
    sessionToken: session.token,
    redirectRoute,
    user: {
      id: session.userId,
      email: session.email,
      fullName: session.fullName,
      role: session.role,
      roleTitle: session.roleTitle,
      isLifetimeSuperAdmin: session.isLifetimeSuperAdmin,
      mfaVerified: true,
      status: "active",
      active: true
    }
  });
});
app.get("/api/auth/session", apiHandler(async (req, res) => {
  const session = await authenticateRequest(req);
  if (!session) {
    clearSessionCookie(res);
    return res.status(401).json({
      authenticated: false,
      message: "Session is expired, invalidated, or unrecognized by the server.",
      error: "Session is expired, invalidated, or unrecognized by the server."
    });
  }
  return res.status(200).json({
    authenticated: true,
    sessionToken: session.token,
    expiresAt: session.expiresAt,
    user: {
      id: session.userId,
      email: session.email,
      fullName: session.fullName,
      role: session.role,
      roleTitle: session.roleTitle,
      isLifetimeSuperAdmin: session.isLifetimeSuperAdmin,
      mfaVerified: session.mfaVerified,
      status: "active",
      active: true
    }
  });
}));
app.post("/api/auth/authorize-route", apiHandler(async (req, res) => {
  const { route } = req.body || {};
  const normalizedRoute = (route || "/").toLowerCase();
  if (normalizedRoute === "/" || normalizedRoute === "/home" || normalizedRoute.startsWith("/personal") || normalizedRoute.startsWith("/business") || normalizedRoute.startsWith("/corporate") || normalizedRoute.startsWith("/digital") || normalizedRoute.startsWith("/open-account") || normalizedRoute.startsWith("/about") || normalizedRoute.startsWith("/branches") || normalizedRoute.startsWith("/tariffs") || normalizedRoute.startsWith("/security") || normalizedRoute.startsWith("/contact") || normalizedRoute.startsWith("/help") || normalizedRoute.startsWith("/governance") || normalizedRoute.startsWith("/privacy") || normalizedRoute.startsWith("/terms") || normalizedRoute === "/login" || normalizedRoute === "/staff/login" || normalizedRoute === "/internet-banking") {
    return res.status(200).json({
      allowed: true,
      statusCode: 200,
      targetRoute: route
    });
  }
  if (normalizedRoute === "/supa-setup" || normalizedRoute === "/supasetup" || normalizedRoute === "/supaadmin") {
    return res.status(200).json({
      allowed: true,
      statusCode: 200,
      targetRoute: "/supa-setup"
    });
  }
  const session = await authenticateRequest(req);
  if (!session) {
    return res.status(401).json({
      allowed: false,
      statusCode: 401,
      reason: "Authentication required. No active or valid server session found.",
      redirect: "/staff/login"
    });
  }
  const check = serverAuthManager.authorizeRouteAccess(session.token, route || "/");
  if (!check.allowed) {
    return res.status(check.statusCode).json({
      allowed: false,
      statusCode: check.statusCode,
      reason: check.reason,
      redirect: check.statusCode === 401 ? "/staff/login" : void 0
    });
  }
  return res.status(200).json({
    allowed: true,
    statusCode: 200,
    targetRoute: check.targetRoute,
    user: {
      id: session.userId,
      email: session.email,
      fullName: session.fullName,
      role: session.role,
      roleTitle: session.roleTitle,
      isLifetimeSuperAdmin: session.isLifetimeSuperAdmin,
      mfaVerified: session.mfaVerified
    }
  });
}));
app.post("/api/auth/logout", (req, res) => {
  const token = extractSessionToken(req);
  if (token) {
    serverAuthManager.invalidateSession(token);
  }
  clearSessionCookie(res);
  return res.status(200).json({
    success: true,
    message: "Session successfully revoked on the authentication gateway."
  });
});
app.post("/api/auth/forgot-password", (req, res) => {
  const { identifier } = req.body || {};
  if (!identifier) {
    return res.status(400).json({
      success: false,
      error: "Please enter your registered staff email address or username."
    });
  }
  const result = serverAuthManager.createPasswordResetRequest(identifier);
  return res.status(200).json({
    success: true,
    message: result.message
  });
});
app.post("/api/auth/reset-password", (req, res) => {
  const { token, newPassword } = req.body || {};
  if (!token || !newPassword) {
    return res.status(400).json({
      success: false,
      error: "Please provide both the reset token and your new password."
    });
  }
  const result = serverAuthManager.completePasswordReset(token, newPassword);
  if (!result.success) {
    return res.status(400).json({
      success: false,
      error: result.error || "Failed to reset password."
    });
  }
  return res.status(200).json({
    success: true,
    message: "Password successfully updated. All existing sessions have been terminated. Please sign in with your new credentials."
  });
});
var handleCreateStaffAccount = apiHandler(async (req, res) => {
  const correlationId = generateCorrelationId(req);
  const endpoint = req.originalUrl || req.path || "/api/auth/create-staff";
  const session = await authenticateRequest(req);
  if (!session) {
    const msg = "Authentication required. Please sign in with Lifetime Super Admin credentials.";
    logStructuredServerError({
      correlationId,
      endpoint,
      operation: "CREATE_STAFF_AUTH_CHECK",
      errorCategory: "AUTHENTICATION_REQUIRED",
      firebaseErrorCode: "auth/unauthenticated",
      statusCode: 401,
      message: msg
    });
    return res.status(401).json({
      success: false,
      error: {
        code: "AUTHENTICATION_REQUIRED",
        message: msg,
        correlationId
      },
      message: msg,
      correlationId,
      statusCode: 401
    });
  }
  if (session.role !== "LIFETIME_SUPER_ADMIN" || !session.isLifetimeSuperAdmin) {
    const msg = "Insufficient privileges: Only the Lifetime Super Admin can create staff accounts.";
    logStructuredServerError({
      correlationId,
      endpoint,
      operation: "CREATE_STAFF_ROLE_CHECK",
      errorCategory: "INSUFFICIENT_PRIVILEGES",
      firebaseErrorCode: "auth/insufficient-permission",
      statusCode: 403,
      message: `Role ${session.role} is forbidden from creating staff accounts.`
    });
    return res.status(403).json({
      success: false,
      error: {
        code: "INSUFFICIENT_PRIVILEGES",
        message: msg,
        correlationId
      },
      message: msg,
      correlationId,
      statusCode: 403
    });
  }
  const body = req.body || {};
  const cleanEmail = String(body.email || "").trim().toLowerCase();
  const cleanName = String(body.fullName || "").trim();
  const cleanPhone = String(body.phone || "").trim();
  const cleanAccessCode = String(body.accessCode || "").trim();
  const cleanInitialPassword = String(body.password || body.initialPassword || "").trim();
  const secretCredential = cleanInitialPassword || cleanAccessCode;
  const duty = String(body.duty || body.roleTitle || body.operationalResponsibility || "Customer Registration Officer").trim();
  const requestedRole = String(body.role || "STAFF").trim().toUpperCase();
  if (requestedRole === "SUPER_ADMIN" || requestedRole === "LIFETIME_SUPER_ADMIN") {
    const msg = "Security Invariant: Creation of a second Lifetime Super Admin is strictly prohibited.";
    logStructuredServerError({
      correlationId,
      endpoint,
      operation: "CREATE_STAFF_ROLE_VALIDATION",
      errorCategory: "VALIDATION_ERROR",
      statusCode: 400,
      message: msg
    });
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_ROLE",
        message: msg,
        correlationId
      },
      message: msg,
      correlationId,
      statusCode: 400
    });
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!cleanName || !cleanEmail || !emailRegex.test(cleanEmail) || !cleanPhone) {
    const msg = "Full Legal Name, valid Official Email Address, and Phone Number are required to create a staff account.";
    logStructuredServerError({
      correlationId,
      endpoint,
      operation: "CREATE_STAFF_INPUT_VALIDATION",
      errorCategory: "VALIDATION_ERROR",
      statusCode: 400,
      message: msg
    });
    return res.status(400).json({
      success: false,
      error: {
        code: "MISSING_OR_INVALID_FIELDS",
        message: msg,
        correlationId
      },
      message: msg,
      correlationId,
      statusCode: 400
    });
  }
  if (!serverAuthManager.isValidOperationalDuty(duty, "STAFF")) {
    const msg = `Invalid operational duty "${duty}". Please select an approved operational duty from the allowed list.`;
    logStructuredServerError({
      correlationId,
      endpoint,
      operation: "CREATE_STAFF_DUTY_VALIDATION",
      errorCategory: "VALIDATION_ERROR",
      statusCode: 400,
      message: msg
    });
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_OPERATIONAL_DUTY",
        message: msg,
        correlationId
      },
      message: msg,
      correlationId,
      statusCode: 400
    });
  }
  if (!cleanAccessCode || cleanAccessCode.length < 6 || !secretCredential || secretCredential.length < 6) {
    const msg = "An access code (and optional initial password) of at least 6 characters is required.";
    logStructuredServerError({
      correlationId,
      endpoint,
      operation: "CREATE_STAFF_CREDENTIAL_VALIDATION",
      errorCategory: "VALIDATION_ERROR",
      statusCode: 400,
      message: msg
    });
    return res.status(400).json({
      success: false,
      error: {
        code: "WEAK_OR_MISSING_ACCESS_CODE",
        message: msg,
        correlationId
      },
      message: msg,
      correlationId,
      statusCode: 400
    });
  }
  const existingLocal = serverAuthManager.findAccountByIdentifier(cleanEmail);
  if (existingLocal && existingLocal.status === "active") {
    const msg = `An account with email address "${cleanEmail}" already exists.`;
    logStructuredServerError({
      correlationId,
      endpoint,
      operation: "CREATE_STAFF_DUPLICATE_CHECK",
      errorCategory: "DUPLICATE_EMAIL",
      firebaseErrorCode: "auth/email-already-exists",
      statusCode: 409,
      message: msg
    });
    return res.status(409).json({
      success: false,
      error: {
        code: "EMAIL_ALREADY_EXISTS",
        message: msg,
        correlationId
      },
      message: msg,
      correlationId,
      statusCode: 409
    });
  }
  const fbProvision = await provisionFirebaseAuthAccount({
    email: cleanEmail,
    password: secretCredential,
    displayName: cleanName
  });
  if (!fbProvision.success) {
    const status = fbProvision.isDuplicate ? 409 : fbProvision.statusCode || 400;
    const msg = fbProvision.errorMessage || "Failed to create Firebase Authentication account.";
    const code = fbProvision.errorCode || (fbProvision.isDuplicate ? "EMAIL_ALREADY_EXISTS" : "FIREBASE_AUTH_ERROR");
    logStructuredServerError({
      correlationId,
      endpoint,
      operation: "CREATE_STAFF_FIREBASE_AUTH",
      errorCategory: fbProvision.isDuplicate ? "DUPLICATE_EMAIL" : "FIREBASE_AUTH_ERROR",
      firebaseErrorCode: code,
      statusCode: status,
      message: msg
    });
    return res.status(status).json({
      success: false,
      error: {
        code,
        message: msg,
        correlationId
      },
      message: msg,
      correlationId,
      statusCode: status
    });
  }
  const result = serverAuthManager.createStaffAccount(session, {
    ...body,
    role: "STAFF",
    duty,
    roleTitle: duty,
    firebaseUid: fbProvision.uid
  });
  if (!result.success || !result.account) {
    if (fbProvision.newlyCreated && fbProvision.uid) {
      await rollbackFirebaseAuthAccount(fbProvision.uid, fbProvision.idToken);
    }
    const status = result.statusCode || (result.isDuplicate ? 409 : result.error?.includes("Privilege") || result.error?.includes("Security Invariant") ? 403 : 400);
    const msg = result.message || result.error || "Failed to create staff account.";
    const code = status === 409 ? "EMAIL_ALREADY_EXISTS" : status === 403 ? "INSUFFICIENT_PRIVILEGES" : "VALIDATION_ERROR";
    logStructuredServerError({
      correlationId,
      endpoint,
      operation: "CREATE_STAFF_SERVER_RECORD",
      errorCategory: status === 409 ? "DUPLICATE_EMAIL" : status === 403 ? "INSUFFICIENT_PRIVILEGES" : "VALIDATION_ERROR",
      statusCode: status,
      message: msg
    });
    return res.status(status).json({
      success: false,
      error: {
        code,
        message: msg,
        correlationId
      },
      message: msg,
      correlationId,
      statusCode: status
    });
  }
  const acct = result.account;
  const callerFbToken = extractCallerFirebaseToken(req);
  const simulateFirestoreFailure = req.headers["x-test-simulate-firestore-failure"] === "true";
  const accessCodeSaltedHash = serverAuthManager.getAccountAccessCodeSaltedHash(acct.id);
  const firestoreResult = await withServerTimeout(
    writeFirestoreUserProfile({
      uid: acct.id,
      email: acct.email,
      fullName: acct.fullName,
      phone: acct.phone,
      role: "STAFF",
      roleTitle: acct.roleTitle,
      duty: acct.duty || acct.roleTitle,
      status: "active",
      createdBy: session.userId,
      createdAt: acct.createdAt || (/* @__PURE__ */ new Date()).toISOString(),
      accessCodeHash: accessCodeSaltedHash,
      staffCode: acct.staffCode,
      permissions: acct.permissions,
      callerIdToken: callerFbToken,
      simulateFailure: simulateFirestoreFailure
    }),
    3500
  ).catch((err) => ({
    success: false,
    errorCode: "firestore/timeout",
    errorMessage: err?.message || "Firestore profile write timed out"
  }));
  if (!firestoreResult.success) {
    const rollbackOutcome = await rollbackFirebaseAuthAccount(acct.id, fbProvision.idToken);
    serverAuthManager.removeAccountOnRollback(acct.id, cleanEmail);
    const msg = "Failed to create staff profile in Firestore. The authentication account has been rolled back.";
    logStructuredServerError({
      correlationId,
      endpoint,
      operation: "CREATE_STAFF_FIRESTORE_PROFILE_ROLLBACK",
      errorCategory: "FIRESTORE_ERROR",
      firebaseErrorCode: firestoreResult.errorCode || "firestore/write-failed",
      statusCode: 500,
      message: `${msg} (${firestoreResult.errorMessage || "write failed"}, rolledBack=${rollbackOutcome.rolledBack})`
    });
    return res.status(500).json({
      success: false,
      error: {
        code: "FIRESTORE_PROFILE_WRITE_FAILED",
        message: msg,
        correlationId
      },
      message: msg,
      correlationId,
      rolledBack: rollbackOutcome.rolledBack,
      rolledBackAuthUid: acct.id,
      statusCode: 500
    });
  }
  return res.status(201).json({
    success: true,
    correlationId,
    message: "Staff account created successfully.",
    data: {
      account: result.account,
      invitation: result.invitation
    },
    account: result.account,
    invitation: result.invitation
  });
});
app.post("/api/auth/create-staff", handleCreateStaffAccount);
app.post("/api/super-admin/create-staff", handleCreateStaffAccount);
app.post("/api/auth/access/generate-code", apiHandler(async (req, res) => {
  const session = await authenticateRequest(req);
  if (!session) {
    return res.status(401).json({
      success: false,
      message: "Authentication required. Please sign in.",
      error: "Authentication required."
    });
  }
  const { email, accessType, duty, permissions } = req.body || {};
  const result = serverAuthManager.generateAccessCode(session, {
    email,
    accessType,
    duty,
    permissions
  });
  if (!result.success) {
    return res.status(403).json({
      success: false,
      message: result.error || "Clearance violation generating access code.",
      error: result.error
    });
  }
  return res.status(200).json(
    buildApiResponse(
      {
        message: "Access authorization code generated successfully.",
        data: result,
        ...result
      },
      true
    )
  );
}));
app.post("/api/auth/access/give-access", apiHandler(async (req, res) => {
  const session = await authenticateRequest(req);
  if (!session) {
    return res.status(401).json({
      success: false,
      message: "Authentication required.",
      error: "Authentication required."
    });
  }
  const { email, accessType, duty, code, fullName, phone, permissions } = req.body || {};
  const result = serverAuthManager.giveAccess(session, {
    email,
    accessType,
    duty,
    code,
    fullName,
    phone,
    permissions
  });
  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: result.error || "Failed to grant access.",
      error: result.error
    });
  }
  return res.status(200).json(
    buildApiResponse(
      {
        message: "Access successfully granted.",
        data: result,
        ...result
      },
      true
    )
  );
}));
function extractCallerFirebaseToken(req) {
  if (typeof req.headers["x-firebase-token"] === "string" && req.headers["x-firebase-token"].trim()) {
    return req.headers["x-firebase-token"].trim();
  }
  if (req.headers.authorization?.startsWith("Bearer ") && req.headers.authorization.split(".").length === 3) {
    return req.headers.authorization.substring(7).trim();
  }
  return void 0;
}
async function ensureAccountHydratedFromFirestore(targetUserId, callerFbToken) {
  if (!targetUserId) return;
  if (serverAuthManager.findAccountByIdentifier(targetUserId)) return;
  try {
    const [userDoc, adminDoc, staffDoc] = await withServerTimeout(
      Promise.all([
        readFirestoreDocument("users", targetUserId, callerFbToken),
        readFirestoreDocument("admins", targetUserId, callerFbToken),
        readFirestoreDocument("staff", targetUserId, callerFbToken)
      ]),
      2500
    );
    const merged = { ...userDoc || {}, ...staffDoc || {}, ...adminDoc || {} };
    if (merged && merged.email) {
      const role = adminDoc || merged.role === "ADMIN" ? "ADMIN" : "STAFF";
      serverAuthManager.syncProvisionedAccount({
        id: String(merged.uid || merged.id || targetUserId),
        email: String(merged.email),
        fullName: String(merged.fullName || merged.email),
        phone: String(merged.phone || "+234 800 000 0000"),
        role,
        roleTitle: String(merged.roleTitle || merged.duty || (role === "ADMIN" ? "Executive Administrator" : "Operations Officer")),
        duty: String(merged.duty || merged.roleTitle || (role === "ADMIN" ? "Executive Administrator" : "Operations Officer")),
        staffCode: merged.staffCode ? String(merged.staffCode) : void 0,
        status: merged.active === false || merged.status === "suspended" ? "suspended" : "active"
      });
    }
  } catch {
  }
}
app.post("/api/auth/access/update-permissions", apiHandler(async (req, res) => {
  const session = await authenticateRequest(req);
  if (!session) {
    return res.status(401).json({
      success: false,
      message: "Authentication required.",
      error: "Authentication required."
    });
  }
  const { targetUserId, permissions } = req.body || {};
  const callerFbToken = extractCallerFirebaseToken(req);
  if (targetUserId) {
    await ensureAccountHydratedFromFirestore(String(targetUserId), callerFbToken);
  }
  const result = serverAuthManager.updateUserPermissions(session, targetUserId, permissions);
  if (!result.success) {
    return res.status(403).json({
      success: false,
      message: result.error || "Failed to update permissions.",
      error: result.error
    });
  }
  const updatedAcc = serverAuthManager.findAccountByIdentifier(String(targetUserId));
  if (updatedAcc && (updatedAcc.role === "ADMIN" || updatedAcc.role === "STAFF")) {
    await withServerTimeout(
      writeFirestoreUserProfile({
        uid: updatedAcc.id,
        email: updatedAcc.email,
        fullName: updatedAcc.fullName,
        phone: updatedAcc.phone,
        role: updatedAcc.role === "ADMIN" ? "ADMIN" : "STAFF",
        roleTitle: updatedAcc.roleTitle,
        duty: updatedAcc.duty || updatedAcc.roleTitle,
        status: updatedAcc.status === "active" ? "active" : "suspended",
        createdBy: updatedAcc.createdBy || session.email,
        createdAt: updatedAcc.createdAt || (/* @__PURE__ */ new Date()).toISOString(),
        staffCode: updatedAcc.staffCode,
        permissions: updatedAcc.permissions,
        callerIdToken: callerFbToken
      }),
      2500
    ).catch(() => {
    });
  }
  return res.status(200).json(
    buildApiResponse(
      {
        message: "Permissions updated successfully.",
        data: result,
        ...result
      },
      true
    )
  );
}));
var handleAppointAdminAccount = apiHandler(async (req, res) => {
  const correlationId = generateCorrelationId(req);
  const endpoint = req.originalUrl || req.path || "/api/auth/access/appoint-admin";
  const session = await authenticateRequest(req);
  if (!session) {
    const msg = "Authentication required. Please sign in with Lifetime Super Admin credentials.";
    logStructuredServerError({
      correlationId,
      endpoint,
      operation: "CREATE_ADMIN_AUTH_CHECK",
      errorCategory: "AUTHENTICATION_REQUIRED",
      firebaseErrorCode: "auth/unauthenticated",
      statusCode: 401,
      message: msg
    });
    return res.status(401).json({
      success: false,
      error: {
        code: "AUTHENTICATION_REQUIRED",
        message: msg,
        correlationId
      },
      message: msg,
      correlationId,
      statusCode: 401
    });
  }
  if (session.role !== "LIFETIME_SUPER_ADMIN" || !session.isLifetimeSuperAdmin) {
    const msg = "Clearance Violation: Only the Lifetime Super Admin can appoint Administrators.";
    logStructuredServerError({
      correlationId,
      endpoint,
      operation: "CREATE_ADMIN_ROLE_CHECK",
      errorCategory: "INSUFFICIENT_PRIVILEGES",
      firebaseErrorCode: "auth/insufficient-permission",
      statusCode: 403,
      message: `Role ${session.role} is forbidden from appointing Administrators.`
    });
    return res.status(403).json({
      success: false,
      error: {
        code: "INSUFFICIENT_PRIVILEGES",
        message: msg,
        correlationId
      },
      message: msg,
      correlationId,
      statusCode: 403
    });
  }
  const body = req.body || {};
  const cleanEmail = String(body.email || "").trim().toLowerCase();
  const cleanName = String(body.fullName || "").trim();
  const cleanPhone = String(body.phone || "").trim();
  const cleanAccessCode = String(body.accessCode || "").trim();
  const cleanInitialPassword = String(body.password || body.initialPassword || "").trim();
  const secretCredential = cleanInitialPassword || cleanAccessCode;
  const duty = String(body.operationalResponsibility || body.duty || body.roleTitle || "Admin / General Branch Administrator").trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!cleanName || !cleanEmail || !emailRegex.test(cleanEmail) || !cleanPhone) {
    const msg = "Full Name, valid Email Address, and Phone Number are required to appoint an Administrator.";
    logStructuredServerError({
      correlationId,
      endpoint,
      operation: "CREATE_ADMIN_INPUT_VALIDATION",
      errorCategory: "VALIDATION_ERROR",
      statusCode: 400,
      message: msg
    });
    return res.status(400).json({
      success: false,
      error: {
        code: "MISSING_REQUIRED_FIELDS",
        message: msg,
        correlationId
      },
      message: msg,
      correlationId,
      statusCode: 400
    });
  }
  if (!serverAuthManager.isValidOperationalDuty(duty, "ADMIN")) {
    const msg = `Invalid operational duty "${duty}". Please select an approved administrative duty from the allowed list.`;
    logStructuredServerError({
      correlationId,
      endpoint,
      operation: "CREATE_ADMIN_DUTY_VALIDATION",
      errorCategory: "VALIDATION_ERROR",
      statusCode: 400,
      message: msg
    });
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_OPERATIONAL_DUTY",
        message: msg,
        correlationId
      },
      message: msg,
      correlationId,
      statusCode: 400
    });
  }
  if (!cleanAccessCode || cleanAccessCode.length < 6 || !secretCredential || secretCredential.length < 6) {
    const msg = "An access code (and optional initial password) of at least 6 characters is required.";
    logStructuredServerError({
      correlationId,
      endpoint,
      operation: "CREATE_ADMIN_CREDENTIAL_VALIDATION",
      errorCategory: "VALIDATION_ERROR",
      statusCode: 400,
      message: msg
    });
    return res.status(400).json({
      success: false,
      error: {
        code: "WEAK_OR_MISSING_PASSWORD",
        message: msg,
        correlationId
      },
      message: msg,
      correlationId,
      statusCode: 400
    });
  }
  const existingLocal = serverAuthManager.findAccountByIdentifier(cleanEmail);
  if (existingLocal && existingLocal.status === "active") {
    const msg = `An account with email address "${cleanEmail}" already exists.`;
    logStructuredServerError({
      correlationId,
      endpoint,
      operation: "CREATE_ADMIN_DUPLICATE_CHECK",
      errorCategory: "DUPLICATE_EMAIL",
      firebaseErrorCode: "auth/email-already-exists",
      statusCode: 409,
      message: msg
    });
    return res.status(409).json({
      success: false,
      error: {
        code: "EMAIL_ALREADY_EXISTS",
        message: msg,
        correlationId
      },
      message: msg,
      correlationId,
      statusCode: 409
    });
  }
  const fbProvision = await provisionFirebaseAuthAccount({
    email: cleanEmail,
    password: secretCredential,
    displayName: cleanName
  });
  if (!fbProvision.success) {
    const status = fbProvision.isDuplicate ? 409 : fbProvision.statusCode || 400;
    const msg = fbProvision.errorMessage || "Failed to create Firebase Authentication account.";
    const code = fbProvision.errorCode || (fbProvision.isDuplicate ? "EMAIL_ALREADY_EXISTS" : "FIREBASE_AUTH_ERROR");
    logStructuredServerError({
      correlationId,
      endpoint,
      operation: "CREATE_ADMIN_FIREBASE_AUTH",
      errorCategory: fbProvision.isDuplicate ? "DUPLICATE_EMAIL" : "FIREBASE_AUTH_ERROR",
      firebaseErrorCode: code,
      statusCode: status,
      message: msg
    });
    return res.status(status).json({
      success: false,
      error: {
        code,
        message: msg,
        correlationId
      },
      message: msg,
      correlationId,
      statusCode: status
    });
  }
  const result = serverAuthManager.appointAdministrator(session, {
    ...body,
    operationalResponsibility: duty,
    firebaseUid: fbProvision.uid
  });
  if (!result.success || !result.account) {
    if (fbProvision.newlyCreated && fbProvision.uid) {
      await rollbackFirebaseAuthAccount(fbProvision.uid, fbProvision.idToken);
    }
    const status = result.statusCode || (result.isDuplicate ? 409 : 400);
    const msg = result.message || result.error || "Failed to appoint administrator.";
    const code = status === 409 ? "EMAIL_ALREADY_EXISTS" : "VALIDATION_ERROR";
    logStructuredServerError({
      correlationId,
      endpoint,
      operation: "CREATE_ADMIN_SERVER_RECORD",
      errorCategory: status === 409 ? "DUPLICATE_EMAIL" : "VALIDATION_ERROR",
      statusCode: status,
      message: msg
    });
    return res.status(status).json({
      success: false,
      error: {
        code,
        message: msg,
        correlationId
      },
      message: msg,
      correlationId,
      statusCode: status
    });
  }
  const acct = result.account;
  const callerFbToken = extractCallerFirebaseToken(req);
  const simulateFirestoreFailure = req.headers["x-test-simulate-firestore-failure"] === "true";
  const accessCodeSaltedHash = serverAuthManager.getAccountAccessCodeSaltedHash(acct.id);
  const firestoreResult = await withServerTimeout(
    writeFirestoreUserProfile({
      uid: acct.id,
      email: acct.email,
      fullName: acct.fullName,
      phone: acct.phone,
      role: "ADMIN",
      roleTitle: acct.roleTitle,
      duty: acct.duty || acct.roleTitle,
      status: "active",
      createdBy: session.userId,
      createdAt: acct.createdAt || (/* @__PURE__ */ new Date()).toISOString(),
      accessCodeHash: accessCodeSaltedHash,
      staffCode: acct.staffCode,
      permissions: acct.permissions,
      callerIdToken: callerFbToken,
      simulateFailure: simulateFirestoreFailure
    }),
    3500
  ).catch((err) => ({
    success: false,
    errorCode: "firestore/timeout",
    errorMessage: err?.message || "Firestore profile write timed out"
  }));
  if (!firestoreResult.success) {
    const rollbackOutcome = await rollbackFirebaseAuthAccount(acct.id, fbProvision.idToken);
    serverAuthManager.removeAccountOnRollback(acct.id, cleanEmail);
    const msg = "Failed to create administrator profile in Firestore. The authentication account has been rolled back.";
    logStructuredServerError({
      correlationId,
      endpoint,
      operation: "CREATE_ADMIN_FIRESTORE_PROFILE_ROLLBACK",
      errorCategory: "FIRESTORE_ERROR",
      firebaseErrorCode: firestoreResult.errorCode || "firestore/write-failed",
      statusCode: 500,
      message: `${msg} (${firestoreResult.errorMessage || "write failed"}, rolledBack=${rollbackOutcome.rolledBack})`
    });
    return res.status(500).json({
      success: false,
      error: {
        code: "FIRESTORE_PROFILE_WRITE_FAILED",
        message: msg,
        correlationId
      },
      message: msg,
      correlationId,
      rolledBack: rollbackOutcome.rolledBack,
      rolledBackAuthUid: acct.id,
      statusCode: 500
    });
  }
  return res.status(201).json({
    success: true,
    correlationId,
    message: "Admin account created successfully.",
    data: {
      account: result.account,
      invitation: result.invitation
    },
    account: result.account,
    invitation: result.invitation
  });
});
app.post("/api/auth/access/appoint-admin", handleAppointAdminAccount);
app.post("/api/super-admin/create-admin", handleAppointAdminAccount);
app.post("/api/auth/access/revoke", apiHandler(async (req, res) => {
  const session = await authenticateRequest(req);
  if (!session) {
    return res.status(401).json({
      success: false,
      message: "Authentication required.",
      error: "Authentication required."
    });
  }
  const { invitationId } = req.body || {};
  if (!invitationId) {
    return res.status(400).json({
      success: false,
      message: "Invitation ID is required.",
      error: "Invitation ID is required."
    });
  }
  const result = serverAuthManager.revokeAccessCode(session, invitationId);
  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: result.error || "Failed to revoke access code.",
      error: result.error
    });
  }
  return res.status(200).json(
    buildApiResponse(
      {
        message: "Access authorization code successfully revoked.",
        data: result,
        ...result
      },
      true
    )
  );
}));
app.post("/api/auth/access/verify-code", apiHandler(async (req, res) => {
  const { email, code } = req.body || {};
  if (!email || !code) {
    return res.status(400).json({
      success: false,
      message: "Email and access authorization code are required.",
      error: "Email and access authorization code are required."
    });
  }
  const result = serverAuthManager.verifyAccessCode(email, code);
  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: result.error || "Invalid or expired access code.",
      error: result.error
    });
  }
  return res.status(200).json(
    buildApiResponse(
      {
        message: "Access code verified successfully.",
        data: result,
        ...result
      },
      true
    )
  );
}));
app.post("/api/auth/access/redeem-code", apiHandler(async (req, res) => {
  const { email, code, newPassword, fullName, phone } = req.body || {};
  if (!email || !code) {
    return res.status(400).json({
      success: false,
      message: "Email and access authorization code are required.",
      error: "Email and access authorization code are required."
    });
  }
  const result = serverAuthManager.redeemAccessCode(email, code, newPassword, fullName, phone);
  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: result.error || "Failed to redeem access code.",
      error: result.error
    });
  }
  return res.status(200).json(
    buildApiResponse(
      {
        message: "Access code redeemed successfully. Account activated.",
        data: result,
        ...result
      },
      true
    )
  );
}));
app.get("/api/auth/access/invitations", apiHandler(async (req, res) => {
  const session = await authenticateRequest(req);
  if (!session || session.role !== "LIFETIME_SUPER_ADMIN") {
    return res.status(403).json({
      success: false,
      message: "Clearance required: Lifetime Super Admin clearance is required.",
      error: "Clearance required."
    });
  }
  const invitations = serverAuthManager.getAccessInvitations(session);
  return res.status(200).json({
    success: true,
    message: "Invitations retrieved successfully.",
    data: { invitations },
    invitations
  });
}));
app.get("/api/auth/accounts", apiHandler(async (req, res) => {
  const session = await authenticateRequest(req);
  if (!session || session.role !== "LIFETIME_SUPER_ADMIN" && session.role !== "ADMIN") {
    return res.status(403).json({
      success: false,
      message: "Clearance required: Administrative privileges required.",
      error: "Clearance required."
    });
  }
  const callerFbToken = extractCallerFirebaseToken(req);
  try {
    const [fsAdmins, fsStaff] = await withServerTimeout(
      Promise.all([
        listFirestoreCollection("admins", callerFbToken),
        listFirestoreCollection("staff", callerFbToken)
      ]),
      1800
    );
    for (const adm of fsAdmins) {
      if (adm.email && !serverAuthManager.findAccountByIdentifier(String(adm.email))) {
        serverAuthManager.syncProvisionedAccount({
          id: String(adm.uid || adm.id),
          email: String(adm.email),
          fullName: String(adm.fullName || adm.email),
          phone: String(adm.phone || ""),
          role: "ADMIN",
          roleTitle: String(adm.roleTitle || adm.duty || "Executive Administrator"),
          duty: String(adm.duty || adm.roleTitle || "Executive Administrator"),
          staffCode: adm.staffCode ? String(adm.staffCode) : void 0,
          status: adm.active === false || adm.status === "suspended" ? "suspended" : "active"
        });
      }
    }
    for (const stf of fsStaff) {
      if (stf.email && !serverAuthManager.findAccountByIdentifier(String(stf.email))) {
        serverAuthManager.syncProvisionedAccount({
          id: String(stf.uid || stf.id),
          email: String(stf.email),
          fullName: String(stf.fullName || stf.email),
          phone: String(stf.phone || ""),
          role: "STAFF",
          roleTitle: String(stf.roleTitle || stf.duty || "Operations Officer"),
          duty: String(stf.duty || stf.roleTitle || "Operations Officer"),
          staffCode: stf.staffCode ? String(stf.staffCode) : void 0,
          status: stf.active === false || stf.status === "suspended" ? "suspended" : "active"
        });
      }
    }
  } catch {
  }
  const accounts = serverAuthManager.getPublicAccountsList(session);
  return res.status(200).json({
    success: true,
    message: "Accounts retrieved successfully.",
    data: { accounts },
    accounts
  });
}));
app.post("/api/auth/revoke-admin", apiHandler(async (req, res) => {
  const session = await authenticateRequest(req);
  if (!session) {
    return res.status(401).json({
      success: false,
      message: "Authentication required.",
      error: "Authentication required."
    });
  }
  const { targetUserId } = req.body || {};
  const callerFbToken = extractCallerFirebaseToken(req);
  if (targetUserId) {
    await ensureAccountHydratedFromFirestore(String(targetUserId), callerFbToken);
  }
  const result = serverAuthManager.revokeAdminRole(session, targetUserId);
  if (!result.success) {
    return res.status(403).json({
      success: false,
      message: result.error || "Failed to revoke administrator role.",
      error: result.error
    });
  }
  const updatedAcc = serverAuthManager.findAccountByIdentifier(String(targetUserId));
  if (updatedAcc) {
    await withServerTimeout(
      writeFirestoreUserProfile({
        uid: updatedAcc.id,
        email: updatedAcc.email,
        fullName: updatedAcc.fullName,
        phone: updatedAcc.phone,
        role: "STAFF",
        roleTitle: updatedAcc.roleTitle,
        duty: updatedAcc.duty || updatedAcc.roleTitle,
        status: updatedAcc.status === "active" ? "active" : "suspended",
        createdBy: updatedAcc.createdBy || session.email,
        createdAt: updatedAcc.createdAt || (/* @__PURE__ */ new Date()).toISOString(),
        staffCode: updatedAcc.staffCode,
        permissions: updatedAcc.permissions,
        callerIdToken: callerFbToken
      }),
      2500
    ).catch(() => {
    });
  }
  return res.status(200).json(
    buildApiResponse(
      {
        message: "Administrator privileges revoked successfully. Account demoted to ordinary staff.",
        data: result,
        ...result
      },
      true
    )
  );
}));
var handleToggleAccountStatus = apiHandler(async (req, res) => {
  const session = await authenticateRequest(req);
  if (!session) {
    return res.status(401).json({
      success: false,
      message: "Authentication required.",
      error: "Authentication required."
    });
  }
  const targetUserId = req.params?.id || req.body?.targetUserId || req.body?.userId || req.body?.id;
  const status = req.body?.status;
  if (!targetUserId || !status) {
    return res.status(400).json({
      success: false,
      message: "targetUserId and status are required.",
      error: "MISSING_REQUIRED_FIELDS"
    });
  }
  const callerFbToken = extractCallerFirebaseToken(req);
  await ensureAccountHydratedFromFirestore(String(targetUserId), callerFbToken);
  const result = serverAuthManager.updateAccountStatus(session, String(targetUserId), status);
  if (!result.success) {
    return res.status(403).json({
      success: false,
      message: result.error || "Failed to update account status.",
      error: result.error
    });
  }
  const updatedAcc = serverAuthManager.findAccountByIdentifier(String(targetUserId));
  if (updatedAcc && (updatedAcc.role === "ADMIN" || updatedAcc.role === "STAFF")) {
    await withServerTimeout(
      writeFirestoreUserProfile({
        uid: updatedAcc.id,
        email: updatedAcc.email,
        fullName: updatedAcc.fullName,
        phone: updatedAcc.phone,
        role: updatedAcc.role === "ADMIN" ? "ADMIN" : "STAFF",
        roleTitle: updatedAcc.roleTitle,
        duty: updatedAcc.duty || updatedAcc.roleTitle,
        status: updatedAcc.status === "active" ? "active" : "suspended",
        createdBy: updatedAcc.createdBy || session.email,
        createdAt: updatedAcc.createdAt || (/* @__PURE__ */ new Date()).toISOString(),
        staffCode: updatedAcc.staffCode,
        permissions: updatedAcc.permissions,
        callerIdToken: callerFbToken
      }),
      2500
    ).catch(() => {
    });
  }
  return res.status(200).json(
    buildApiResponse(
      {
        message: "Account status updated successfully.",
        data: result,
        ...result
      },
      true
    )
  );
});
app.post("/api/auth/toggle-status", handleToggleAccountStatus);
app.post("/api/super-admin/toggle-status", handleToggleAccountStatus);
app.patch("/api/super-admin/accounts/:id/status", handleToggleAccountStatus);
app.post("/api/financial/transfers/approve", apiHandler(async (req, res) => {
  const session = await authenticateRequest(req);
  if (!session) {
    return res.status(401).json({
      success: false,
      message: "Authentication required.",
      error: "Authentication required."
    });
  }
  const { requestId, submittedByStaffId, submittedByStaffName, amount } = req.body || {};
  const check = serverAuthManager.verifyFinancialApproval(session, {
    id: requestId,
    submittedByStaffId,
    submittedByStaffName,
    amount: Number(amount || 0)
  });
  if (!check.allowed) {
    return res.status(403).json({
      success: false,
      message: check.error || "Transfer approval denied.",
      error: check.error
    });
  }
  return res.status(200).json({
    success: true,
    message: "Transfer approval validated on server.",
    data: {}
  });
}));
app.get("/api/audit/logs", apiHandler(async (req, res) => {
  const session = await authenticateRequest(req);
  if (!session || session.role !== "LIFETIME_SUPER_ADMIN" && session.role !== "ADMIN") {
    return res.status(403).json({
      success: false,
      message: "Clearance required: Administrative clearance is required to view audit logs.",
      error: "Clearance required."
    });
  }
  const logs = serverAuthManager.getAuditLogs(session);
  return res.status(200).json({
    success: true,
    message: "Audit logs retrieved successfully.",
    data: { logs },
    logs
  });
}));
app.get("/api/customers", apiHandler(async (req, res) => {
  const session = await authenticateRequest(req);
  if (!session) {
    return res.status(401).json({
      success: false,
      message: "Authentication required. Unauthenticated access to customer records is prohibited.",
      error: "Authentication required."
    });
  }
  const account = serverAuthManager.findAccountByIdentifier(session.email);
  if (account && account.status !== "active") {
    return res.status(403).json({
      success: false,
      message: "Access denied: Account is suspended or inactive.",
      error: "Account suspended."
    });
  }
  if (session.role !== "LIFETIME_SUPER_ADMIN" && session.role !== "ADMIN" && account?.permissions && account.permissions.canViewCustomers === false) {
    return res.status(403).json({
      success: false,
      message: "Clearance violation: Staff account does not have permission to view customer records.",
      error: "Clearance violation."
    });
  }
  const callerFbToken = typeof req.headers["x-firebase-token"] === "string" ? req.headers["x-firebase-token"].trim() : req.headers.authorization?.startsWith("Bearer ") && req.headers.authorization.split(".").length === 3 ? req.headers.authorization.substring(7).trim() : void 0;
  try {
    const fsCustomers = await withServerTimeout(
      listFirestoreCollection("customers", callerFbToken),
      1200
    );
    for (const data of fsCustomers) {
      if (data && (data.fullName || data.phone)) {
        try {
          serverAuthManager.saveCustomerRecord(data);
        } catch {
        }
      }
    }
  } catch {
  }
  const customers = serverAuthManager.getCustomersList();
  return res.status(200).json({
    success: true,
    message: "Customers retrieved successfully.",
    data: { customers },
    customers
  });
}));
app.post("/api/customers", apiHandler(async (req, res) => {
  const session = await authenticateRequest(req);
  if (!session) {
    return res.status(401).json({
      success: false,
      message: "Authentication required. Unauthenticated modification of customer records is prohibited.",
      error: "Authentication required."
    });
  }
  const account = serverAuthManager.findAccountByIdentifier(session.email);
  if (account && account.status !== "active") {
    return res.status(403).json({
      success: false,
      message: "Access denied: Account is suspended or inactive.",
      error: "Account suspended."
    });
  }
  if (session.role !== "LIFETIME_SUPER_ADMIN" && session.role !== "ADMIN" && account?.permissions && account.permissions.canRegisterCustomers === false) {
    return res.status(403).json({
      success: false,
      message: "Clearance violation: Staff account does not have permission to register or modify customer records.",
      error: "Clearance violation."
    });
  }
  const payload = req.body?.customer || req.body || {};
  if (!payload.fullName && !payload.phone) {
    return res.status(400).json({
      success: false,
      message: "Customer full name and phone number are required.",
      error: "Customer full name and phone number are required."
    });
  }
  const customer = serverAuthManager.saveCustomerRecord(payload);
  const customers = serverAuthManager.getCustomersList();
  return res.status(201).json({
    success: true,
    message: "Customer registered and synchronized successfully.",
    data: { customer, customers },
    customer,
    customers
  });
}));
app.all("/api/*", (req, res) => {
  return res.status(404).json({
    success: false,
    message: `API endpoint not found: ${req.method} ${req.path}`,
    error: "ENDPOINT_NOT_FOUND",
    statusCode: 404
  });
});
app.use("/api", (err, _req, res, _next) => {
  console.error("[API SERVER ERROR MIDDLEWARE]", err);
  const status = typeof err?.status === "number" && err.status >= 400 && err.status < 600 ? err.status : 500;
  return res.status(status).json({
    success: false,
    message: err?.message || "A server error occurred while processing the request.",
    error: err?.message || "INTERNAL_SERVER_ERROR",
    statusCode: status
  });
});
var cwd = process.cwd();
var distPath = path3.resolve(cwd, "dist");
var indexPath = path3.join(distPath, "index.html");
var rootIndexPath = path3.resolve(cwd, "index.html");
if (false) {
  const isProd = process.env.NODE_ENV === "production";
  if (!isProd) {
    const vitePkgName = "vite";
    const vitePromise = import(
      /* @vite-ignore */
      vitePkgName
    ).then(
      ({ createServer: createViteServer }) => createViteServer({
        server: {
          middlewareMode: true,
          hmr: false,
          allowedHosts: true
        },
        appType: "spa"
      })
    ).then((vite) => {
      console.log("[DEV] Vite dev server middleware initialized and mounted");
      return vite;
    }).catch((err) => {
      console.warn("[DEV] Vite dev server middleware fallback to static:", err?.message || err);
      return null;
    });
    app.use(async (req, res, next) => {
      try {
        const vite = await vitePromise;
        if (vite) {
          return vite.middlewares(req, res, next);
        }
      } catch (err) {
        console.warn("[DEV] Vite middleware handler note:", err);
      }
      next();
    });
  }
  app.use(express.static(distPath, { index: false, maxAge: isProd ? "1h" : 0 }));
  app.get("*", (_req, res) => {
    if (fs3.existsSync(indexPath)) {
      return res.sendFile(indexPath, (err) => {
        if (err && !res.headersSent) {
          res.status(200).sendFile(rootIndexPath);
        }
      });
    }
    if (fs3.existsSync(rootIndexPath)) {
      return res.sendFile(rootIndexPath);
    }
    res.status(200).send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>TEAMACRO SERVICES LTD</title>
  <style>body{font-family:sans-serif;padding:2rem;background:#091747;color:#fff;text-align:center;}</style>
</head>
<body>
  <h1>TEAMACRO SERVICES LTD</h1>
  <p>Production server is running.</p>
</body>
</html>`);
  });
}
app.use((err, _req, res, _next) => {
  console.error("[SERVER ERROR]", err);
  if (!res.headersSent) {
    res.status(500).json({ error: "Internal Server Error", message: err?.message || "Unexpected failure" });
  }
});
if (false) {
  server = app.listen(PORT, HOST, () => {
    console.log(`[TEAMACRO] Server listening on http://${HOST}:${PORT}`);
    console.log(`[TEAMACRO] Environment: ${process.env.NODE_ENV || "development"}`);
    console.log(`[TEAMACRO] Health check available at: http://${HOST}:${PORT}/health`);
    console.log(`[TEAMACRO] Authoritative Gateway online: Zero Demo Accounts \xB7 Real RFC 6238 TOTP`);
  });
  server.keepAliveTimeout = 65e3;
  server.headersTimeout = 66e3;
  server.on("error", (err) => {
    console.error("[TEAMACRO SERVER SOCKET ERROR]", err?.message || err);
  });
  process.on("SIGTERM", () => {
    server?.close(() => {
      process.exit(0);
    });
  });
  process.on("SIGINT", () => {
    server?.close(() => {
      process.exit(0);
    });
  });
}
var server_default = app;

// src/server/vercelHandler.ts
async function handler(req, res) {
  try {
    return await new Promise((resolve) => {
      res.on("finish", resolve);
      res.on("close", resolve);
      server_default(req, res, (err) => {
        if (err && !res.headersSent) {
          const correlationId = `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
          const safeMessage = "A server error occurred while processing the request.";
          console.error(
            "[TEAMACRO_SERVER_ERROR]",
            JSON.stringify({
              correlationId,
              timestamp: (/* @__PURE__ */ new Date()).toISOString(),
              endpoint: req?.url || "/api",
              operation: "VERCEL_EXPRESS_NEXT_ERROR",
              errorCategory: "INTERNAL_SERVER_ERROR",
              firebaseErrorCode: err?.code || "INTERNAL_SERVER_ERROR",
              statusCode: 500,
              message: err?.message || "Unhandled Express error"
            })
          );
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.end(
            JSON.stringify({
              success: false,
              error: {
                code: "INTERNAL_SERVER_ERROR",
                message: safeMessage,
                correlationId
              },
              message: safeMessage,
              correlationId,
              statusCode: 500
            })
          );
        }
        resolve();
      });
    });
  } catch (err) {
    const correlationId = `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    const safeMessage = "A server error occurred while processing the request.";
    console.error(
      "[TEAMACRO_SERVER_ERROR]",
      JSON.stringify({
        correlationId,
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        endpoint: req?.url || "/api",
        operation: "VERCEL_HANDLER_TOP_LEVEL",
        errorCategory: "INTERNAL_SERVER_ERROR",
        firebaseErrorCode: err?.code || "INTERNAL_SERVER_ERROR",
        statusCode: 500,
        message: err?.message || "Unhandled invocation exception"
      })
    );
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(
        JSON.stringify({
          success: false,
          error: {
            code: "INTERNAL_SERVER_ERROR",
            message: safeMessage,
            correlationId
          },
          message: safeMessage,
          correlationId,
          statusCode: 500
        })
      );
    }
  }
}
export {
  handler as default
};
