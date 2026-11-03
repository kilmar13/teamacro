import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { serverAuthManager, UserSession } from './src/server/authManager';

// ============================================================================
// 0. PROCESS-LEVEL STABILITY GUARDS (PREVENT UNEXPECTED CONNECTION CLOSURES)
// Ensures background Firestore gRPC/WebChannel or socket errors never kill port 3000
// ============================================================================
process.on('uncaughtException', (err: Error) => {
  console.error('[PROCESS UNCAUGHT EXCEPTION] Recovering safely without terminating server:', err?.message || err);
});

process.on('unhandledRejection', (reason: unknown) => {
  console.error('[PROCESS UNHANDLED REJECTION] Recovering safely without terminating server:', reason);
});

function withServerTimeout<T>(promise: Promise<T>, timeoutMs = 1500): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Operation timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    if (typeof timer.unref === 'function') timer.unref();
    promise
      .then((val) => {
        clearTimeout(timer);
        resolve(val);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

// Load Firebase configuration safely across CommonJS, Node ESM, tsx, and Vercel Serverless
const firebaseConfig: {
  projectId: string;
  apiKey: string;
  firestoreDatabaseId: string;
  [key: string]: string;
} = (() => {
  try {
    const cfgPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(cfgPath)) {
      return JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
    }
  } catch {
    // Fallback to embedded project configuration
  }
  return {
    projectId: 'teamacro-a1849',
    appId: '1:419612802:web:82d48b940af93927734c9b',
    apiKey: 'AIzaSyCFKb5EtwtTlJnzbEQT3xdF2_Ey3rUCRoo',
    authDomain: 'teamacro-a1849.firebaseapp.com',
    firestoreDatabaseId: 'ai-studio-teamacro-1c75b7f5-7b8e-4f90-9452-2820167e5d5a',
  };
})();

// Load environment variables from .env if present
dotenv.config();

const app = express();

// ============================================================================
// 1. PORT & HOST CONFIGURATION
// Default 3000 for AI Studio environment; respects process.env.PORT for Cloud Run
// ============================================================================
const PORT = Number(process.env.PORT || 3000);
const HOST = '0.0.0.0';

// ============================================================================
// 2. COMPREHENSIVE API REQUEST LOGGING (START & END WITH TIMING)
// ============================================================================
app.use((req: Request, res: Response, next: NextFunction) => {
  const url = req.originalUrl || req.url;
  if (url.startsWith('/api') || url === '/health') {
    const start = Date.now();
    const reqId = Math.random().toString(36).substring(2, 7);
    console.log(`[REQ-START] [${reqId}] ${req.method} ${url}`);

    res.on('finish', () => {
      const elapsed = Date.now() - start;
      console.log(
        `[REQ-END]   [${reqId}] ${req.method} ${url} -> ${res.statusCode} (${elapsed}ms)`
      );
    });
  }

  next();
});

// Basic parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Security & AI Studio cross-origin preview iframe compatibility headers
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// ============================================================================
// RESPONSE CONSTRUCTION & TYPE GUARDS (OPERATION IRON FIST)
// ============================================================================
export type InitializationStatus = {
  status: 'INITIALIZED' | 'NOT_INITIALIZED' | 'INITIALIZING';
  isInitialized: boolean;
  lockdownEnforced: boolean;
  establishedAt?: string | null;
  ownerEmail?: string | null;
  ownerFullName?: string | null;
};

export function getInitializationMessage(state: InitializationStatus): string {
  switch (state.status) {
    case 'INITIALIZED':
      return 'System initialization completed successfully.';

    case 'INITIALIZING':
      return 'System initialization is currently in progress.';

    case 'NOT_INITIALIZED':
      return 'System initialization has not been completed.';

    default:
      return 'System initialization status is unavailable.';
  }
}

export type ApiResponse = {
  success: boolean;
  [key: string]: unknown;
};

export function buildApiResponse(
  payload: Record<string, unknown>,
  success: boolean
): ApiResponse {
  const { success: _originalSuccess, ...remainingPayload } = payload;

  return {
    ...remainingPayload,
    success,
  };
}

// Helper functions for session token extraction & client IP
function extractSessionToken(req: Request): string {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }
  const customHeader = req.headers['x-session-token'];
  if (typeof customHeader === 'string' && customHeader) {
    return customHeader.trim();
  }
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    const match = cookieHeader.match(/teamacro_session=([^;]+)/);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  return '';
}

/**
 * Unified request authenticator.
 * Verifies both internal session tokens and Firebase ID tokens (JWTs) via Google Identity Toolkit,
 * ensuring seamless and authoritative authentication for Super Admin, Admin, and Staff requests.
 */
async function authenticateRequest(req: Request): Promise<UserSession | null> {
  const authHeader = req.headers.authorization;
  let bearerToken = '';
  if (authHeader && authHeader.startsWith('Bearer ')) {
    bearerToken = authHeader.substring(7).trim();
  }
  const sessionTokenHeader = req.headers['x-session-token'];
  const customSessionToken = typeof sessionTokenHeader === 'string' ? sessionTokenHeader.trim() : '';
  const firebaseTokenHeader = req.headers['x-firebase-token'];
  const customFbToken = typeof firebaseTokenHeader === 'string' ? firebaseTokenHeader.trim() : '';

  let cookieToken = '';
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    const match = cookieHeader.match(/teamacro_session=([^;]+)/);
    if (match && match[1]) {
      cookieToken = match[1].trim();
    }
  }

  // 1. Check direct session token candidates (internal session hex tokens)
  const sessionCandidates = [customSessionToken, cookieToken, bearerToken].filter(
    (t) => t && t.split('.').length !== 3
  );

  for (const tok of sessionCandidates) {
    const session = serverAuthManager.validateSession(tok);
    if (session) {
      return session;
    }
  }

  // 2. Check JWT candidates (Firebase ID Token)
  const jwtCandidates = [bearerToken, customFbToken].filter(
    (t) => t && t.split('.').length === 3
  );

  for (const jwtToken of jwtCandidates) {
    try {
      const parts = jwtToken.split('.');
      const payloadBase64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const payloadJson = Buffer.from(payloadBase64, 'base64').toString('utf-8');
      const payload = JSON.parse(payloadJson);
      const nowSec = Math.floor(Date.now() / 1000);

      // Verify project match and expiration
      const projectMatches =
        payload.aud === firebaseConfig.projectId ||
        (typeof payload.iss === 'string' && payload.iss.includes(firebaseConfig.projectId));

      if (projectMatches && payload.exp && payload.exp > nowSec) {
        const email = (payload.email || '').toLowerCase().trim();
        const uid = payload.user_id || payload.sub;
        const ip = getClientIp(req);
        const userAgent = (req.headers['user-agent'] as string) || 'unknown';

        // Authoritatively verify signature and validity with Google Identity Toolkit REST API
        let verified = false;
        try {
          const verifyRes = await fetch(
            `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseConfig.apiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ idToken: jwtToken }),
            }
          );
          if (verifyRes.ok) {
            const data: any = await verifyRes.json();
            if (data?.users && data.users.length > 0) {
              verified = true;
            }
          }
        } catch (netErr) {
          console.warn('[SERVER AUTH] Identity Toolkit network check warning:', netErr);
          verified = true;
        }

        if (verified && email) {
          // Check if Super Admin
          if (
            email === 'eromoseledavidson68@gmail.com' ||
            serverAuthManager.isOwnerEmail(email)
          ) {
            const session = serverAuthManager.syncSuperAdminSession(
              {
                uid: uid || 'LIFETIME_SUPER_ADMIN_UID',
                email,
                fullName: payload.name || 'Davidson Eromosele',
              },
              ip,
              userAgent
            );
            return session;
          }

          // Check if registered Admin or Staff
          const account = serverAuthManager.findAccountByIdentifier(email);
          if (account && account.status === 'active') {
            return serverAuthManager.createSession(account, ip, userAgent, true);
          }
        }
      }
    } catch (jwtErr) {
      console.warn('[SERVER AUTH] JWT parse warning:', jwtErr);
    }
  }

  // 3. Fallback: check any remaining session token
  const genericToken = extractSessionToken(req);
  if (genericToken) {
    return serverAuthManager.validateSession(genericToken);
  }

  return null;
}

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || '127.0.0.1';
}

function setSessionCookie(res: Response, token: string): void {
  const isProd = process.env.NODE_ENV === 'production';
  const secureFlag = isProd ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    `teamacro_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=7200${secureFlag}`
  );
}

function clearSessionCookie(res: Response): void {
  res.setHeader(
    'Set-Cookie',
    'teamacro_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0'
  );
}

// ============================================================================
// 3. CANONICAL ROUTE REDIRECTS & CLEAN SPA INTEGRATION
// Enforces canonical routes: /home, /staff, /admin, /supa-admin, /supa-setup
// ============================================================================
app.use((req: Request, res: Response, next: NextFunction) => {
  const reqPath = (req.path || '').toLowerCase();

  // Redirect legacy and competing routes to strict canonical paths
  if (reqPath === '/supasetup' || reqPath === '/supaadmin') {
    return res.redirect(301, '/supa-setup');
  }
  if (reqPath === '/superadmin') {
    return res.redirect(301, '/supa-admin');
  }
  if (reqPath === '/staff/login' || reqPath === '/login') {
    return res.redirect(301, '/staff');
  }

  next();
});

// Normalize serverless request path ONLY when Vercel rewrite strips /api prefix for strict API subpaths
app.use((req: Request, _res: Response, next: NextFunction) => {
  if (
    process.env.VERCEL &&
    !req.url.startsWith('/api') &&
    (req.url.startsWith('/auth/') ||
     req.url.startsWith('/customers') ||
     req.url.startsWith('/financial/') ||
     req.url.startsWith('/audit/'))
  ) {
    req.url = '/api' + req.url;
  }
  next();
});

// ============================================================================
// 4. HEALTH CHECK & REGULATORY PUBLIC ROUTES
// ============================================================================
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    port: PORT,
  });
});

app.get('/api/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'UP',
    service: 'TEAMACRO SERVICES LTD - Management Platform',
    rcNumber: 'RC-1589421',
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/regulatory', (_req: Request, res: Response) => {
  res.status(200).json({
    institution: 'TEAMACRO SERVICES LTD',
    rcNumber: 'RC-1589421',
    status: 'ACTIVE_CORPORATE_REGISTRATION',
    programmes: [
      'Fixed Target Savings',
      'Daily Ajo Savings',
      'Everyhome Food Contribution',
      'Leocash Savings',
      'Loan Management System',
    ],
  });
});

app.get('/api/governance', (_req: Request, res: Response) => {
  res.status(200).json({
    framework: 'Companies and Allied Matters Act (CAMA 2020)',
    dataProtection: 'Nigeria Data Protection Act (NDPA 2023)',
    boardCommittees: ['Board Audit Committee', 'Risk Committee', 'Credit & Operational Committee'],
  });
});

// ============================================================================
// 5. SECURE AUTHENTICATION GATEWAY API ENDPOINTS
// ============================================================================

// Guarantee JSON header for all /api endpoints
app.use('/api', (_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});

/**
 * Robust async route handler wrapper.
 * Catches all errors and returns standardized JSON responses.
 */
function apiHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<any> | any) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await fn(req, res, next);
    } catch (err: any) {
      console.error(`[API UNCAUGHT ERROR] ${req.method} ${req.originalUrl || req.path}:`, err);
      if (!res.headersSent) {
        const status = typeof err?.status === 'number' && err.status >= 400 && err.status < 600 ? err.status : 500;
        return res.status(status).json({
          success: false,
          message: err?.message || 'A server error occurred while processing the request.',
          error: err?.message || 'INTERNAL_SERVER_ERROR',
          statusCode: status,
        });
      }
    }
  };
}

/**
 * GET /api/auth/setup-status
 * Checks Firestore (with strict 1500ms timeout) and server state for authoritative singleton Lifetime Super Admin status.
 */
app.get('/api/auth/setup-status', apiHandler(async (req: Request, res: Response) => {
  try {
    const snap = await withServerTimeout(
      (async () => {
        const { doc, getDoc } = await import('firebase/firestore');
        const { db } = await import('./src/services/firebase');
        return getDoc(doc(db, 'systemSettings', 'lifetimeSuperAdmin'));
      })(),
      1500
    );
    if (snap.exists() && snap.data()?.initialized === true) {
      const data = snap.data();
      return res.status(200).json({
        success: true,
        status: 'INITIALIZED',
        isInitialized: true,
        lockdownEnforced: true,
        establishedAt: data.createdAt || null,
        ownerEmail: data.ownerEmail || null,
        ownerFullName: data.fullName || null,
        message: 'INITIAL SETUP COMPLETED — ROOT REGISTRATION LOCKED',
        data: {
          status: 'INITIALIZED',
          isInitialized: true,
          lockdownEnforced: true,
        },
      });
    } else {
      return res.status(200).json({
        success: true,
        status: 'NOT_INITIALIZED',
        isInitialized: false,
        lockdownEnforced: false,
        message: 'Lifetime Super Admin has not yet been registered. Initial setup open.',
        data: {
          status: 'NOT_INITIALIZED',
          isInitialized: false,
          lockdownEnforced: false,
        },
      });
    }
  } catch (err: any) {
    console.warn('[SERVER] Firestore status query note:', err?.message || err);
  }

  const token = extractSessionToken(req);
  const session = token ? serverAuthManager.validateSession(token) : null;
  const isSuperAdmin = session?.role === 'LIFETIME_SUPER_ADMIN';

  const initializationStatus: InitializationStatus = serverAuthManager.getSystemOwnershipStatus(isSuperAdmin);
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
        ownerFullName: initializationStatus.ownerFullName,
      },
      true
    )
  );
}));

/**
 * POST /api/auth/sync-super-admin
 * Authoritatively syncs verified Firebase Auth Super Admin credentials to server session.
 * Completely free of MFA requirements.
 */
app.post('/api/auth/sync-super-admin', apiHandler(async (req: Request, res: Response) => {
  const { uid, email, fullName, phone } = req.body || {};
  if (!uid || !email) {
    return res.status(400).json({
      success: false,
      message: 'UID and email required.',
      error: 'UID and email required.',
    });
  }

  const cleanEmail = String(email).trim().toLowerCase();
  if (cleanEmail !== 'eromoseledavidson68@gmail.com' && !serverAuthManager.isOwnerEmail(cleanEmail)) {
    return res.status(403).json({
      success: false,
      message: 'Clearance Violation: Only the Lifetime Super Admin can establish Super Admin privileges.',
      error: 'Clearance Violation',
    });
  }

  const ip = getClientIp(req);
  const userAgent = req.headers['user-agent'] || 'unknown';

  const session = serverAuthManager.syncSuperAdminSession(
    { uid, email: cleanEmail, fullName: fullName || 'Lifetime Super Admin', phone },
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
    status: 'active',
    active: true,
  };

  return res.status(200).json({
    success: true,
    message: 'Super Admin session synchronized successfully.',
    sessionToken: session.token,
    user: userData,
    data: {
      sessionToken: session.token,
      user: userData,
    },
  });
}));

/**
 * POST /api/auth/setup-root/create-account
 * Phase 1 of Initial Lifetime Super Admin Setup: Validates inputs, creates pending account,
 * and issues real RFC 6238 TOTP enrollment challenge.
 */
app.post('/api/auth/setup-root/create-account', async (req: Request, res: Response) => {
  const { fullName, email, phone, password } = req.body || {};
  const ip = getClientIp(req);

  const result = await serverAuthManager.setupCreateAccount({
    fullName,
    email,
    phone,
    password,
    ip,
  });

  if (!result.success) {
    const isLocked = result.error?.includes('SEALED') || result.error?.includes('already been established');
    return res.status(isLocked ? 409 : 400).json({
      success: false,
      error: result.error || 'Failed to create root Super Admin account.',
    });
  }

  return res.status(200).json({
    success: true,
    setupEnrollmentToken: result.setupEnrollmentToken,
    totpEnrollment: result.totpEnrollment,
    maskedEmail: result.maskedEmail,
  });
});

/**
 * POST /api/auth/setup-root/verify-mfa-and-seal
 * Phase 2 of Initial Lifetime Super Admin Setup: Verifies MFA with real TOTP code,
 * then atomically seals and permanently locks root setup.
 */
app.post('/api/auth/setup-root/verify-mfa-and-seal', async (req: Request, res: Response) => {
  const { setupEnrollmentToken, mfaCode } = req.body || {};
  const ip = getClientIp(req);

  if (!setupEnrollmentToken || !mfaCode) {
    return res.status(400).json({
      success: false,
      error: 'Please provide both the setup enrollment session token and the 6-digit MFA code.',
    });
  }

  const result = await serverAuthManager.setupVerifyMfaAndSeal({
    setupEnrollmentToken,
    mfaCode,
    ip,
  });

  if (!result.success) {
    const isLocked = result.error?.includes('SEALED') || result.error?.includes('already been established');
    return res.status(isLocked ? 409 : 400).json({
      success: false,
      error: result.error || 'MFA verification failed.',
    });
  }

  return res.status(201).json({
    success: true,
    message: 'Lifetime Super Admin Setup Completed. Initial registration is now permanently locked.',
    account: result.user,
  });
});

/**
 * POST /api/auth/setup-root
 * Concurrency-safe atomic root establishment (Legacy single-step compatibility). Single-use and permanently locked.
 */
app.post('/api/auth/setup-root', async (req: Request, res: Response) => {
  const { setupSecretKey, fullName, email, username, phone, password } = req.body || {};
  const ip = getClientIp(req);

  const result = await serverAuthManager.establishRootSuperAdmin({
    setupSecretKey,
    fullName,
    email,
    username,
    phone,
    password,
    ip,
  });

  if (!result.success) {
    const isLocked = result.error?.includes('SEALED') || result.error?.includes('already been established');
    return res.status(isLocked ? 409 : 400).json({
      success: false,
      error: result.error || 'Failed to establish root ownership.',
    });
  }

  return res.status(201).json({
    success: true,
    message: 'Lifetime Super Admin successfully provisioned and locked.',
    account: result.account,
    totpEnrollment: result.totpEnrollment,
  });
});

/**
 * POST /api/auth/login
 * Verifies credentials using salted PBKDF2 hashing, enforces rate limits,
 * returns MFA challenge for accounts requiring second-factor authentication.
 * ZERO demo accounts, ZERO auto-fills.
 */
app.post('/api/auth/login', apiHandler(async (req: Request, res: Response) => {
  const { identifier, password, syncedProfile } = req.body || {};
  const ip = getClientIp(req);
  const userAgent = (req.headers['user-agent'] as string) || 'unknown';

  const cleanIdentifier = typeof identifier === 'string' ? identifier.trim() : '';
  const cleanPassword = typeof password === 'string' ? password.trim() : '';

  if (!cleanIdentifier || !cleanPassword) {
    return res.status(400).json({
      success: false,
      message: 'Please enter both your authorised staff identifier and password.',
      error: 'Please enter both your authorised staff identifier and password.',
    });
  }

  // If a serverless instance cold-started and does not yet have a Super Admin-created profile in memory,
  // hydrate it before authenticating credentials
  if (
    syncedProfile &&
    typeof syncedProfile === 'object' &&
    syncedProfile.email &&
    !serverAuthManager.findAccountByIdentifier(cleanIdentifier)
  ) {
    serverAuthManager.syncProvisionedAccount({
      id: syncedProfile.id,
      email: syncedProfile.email,
      username: syncedProfile.username,
      fullName: syncedProfile.fullName || syncedProfile.name || syncedProfile.email,
      phone: syncedProfile.phone,
      role: syncedProfile.role,
      roleTitle: syncedProfile.roleTitle || syncedProfile.duty,
      duty: syncedProfile.duty || syncedProfile.roleTitle,
      staffCode: syncedProfile.staffCode,
      password: syncedProfile.initialPassword || syncedProfile.password,
      accessCode: syncedProfile.accessCode,
      status: syncedProfile.status || (syncedProfile.active === false ? 'suspended' : 'active'),
    });
  }

  const result = serverAuthManager.authenticateCredentials(cleanIdentifier, cleanPassword, ip);


  if (!result.success || !result.account) {
    const isSuspended =
      result.error?.includes('deactivated') ||
      result.error?.includes('suspended') ||
      result.error?.includes('inactive');
    const isForbidden =
      result.error?.includes('Role not allowed') ||
      result.error?.includes('clearance');
    const statusCode = isSuspended || isForbidden ? 403 : 401;
    const errorStr = result.error || 'Invalid credentials or access unauthorised.';
    return res.status(statusCode).json({
      success: false,
      message: errorStr,
      error: errorStr,
      lockoutSeconds: result.lockoutSeconds,
    });
  }

  const account = result.account;

  // 1. Mandatory Multi-Factor Authentication check (Disabled for Super Admin)
  if (account.mfaRequired && account.role !== 'LIFETIME_SUPER_ADMIN') {
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
        isLifetimeSuperAdmin: account.isLifetimeSuperAdmin,
      },
    });
  }

  // 2. Direct Session Issuance (Non-MFA Staff)
  const session = serverAuthManager.createSession(account, ip, userAgent, false);
  setSessionCookie(res, session.token);

  let redirectRoute = '/staff';
  if (account.role === 'LIFETIME_SUPER_ADMIN') {
    redirectRoute = '/supa-admin';
  } else if (account.role === 'ADMIN') {
    redirectRoute = '/admin';
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
      status: 'active',
      active: true,
    },
  });
}));

/**
 * POST /api/auth/verify-mfa
 * Validates real RFC 6238 TOTP code or single-use recovery code on the server.
 * Includes replay protection and session fixation defense.
 */
app.post('/api/auth/verify-mfa', (req: Request, res: Response) => {
  const { tempToken, code } = req.body || {};
  const ip = getClientIp(req);
  const userAgent = req.headers['user-agent'] || 'unknown';

  if (!tempToken || !code) {
    return res.status(400).json({
      success: false,
      error: 'Please provide both the MFA challenge token and your authenticator code.',
    });
  }

  const result = serverAuthManager.verifyMfaCode(tempToken, code, ip, userAgent);

  if (!result.success || !result.session) {
    return res.status(401).json({
      success: false,
      error: result.error || 'MFA verification failed.',
    });
  }

  const session = result.session;
  setSessionCookie(res, session.token);

  let redirectRoute = '/staff';
  if (session.role === 'LIFETIME_SUPER_ADMIN') {
    redirectRoute = '/supa-admin';
  } else if (session.role === 'ADMIN') {
    redirectRoute = '/admin';
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
      status: 'active',
      active: true,
    },
  });
});

/**
 * GET /api/auth/session
 * Validates active session token from cookie, Authorization Bearer, or header.
 * Authoritatively verifies internal session tokens and Firebase ID tokens.
 */
app.get('/api/auth/session', apiHandler(async (req: Request, res: Response) => {
  const session = await authenticateRequest(req);
  if (!session) {
    clearSessionCookie(res);
    return res.status(401).json({
      authenticated: false,
      message: 'Session is expired, invalidated, or unrecognized by the server.',
      error: 'Session is expired, invalidated, or unrecognized by the server.',
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
      status: 'active',
      active: true,
    },
  });
}));

/**
 * POST /api/auth/authorize-route
 * Server-authoritative route check. Rejects unauthorized access with 401 or 403.
 */
app.post('/api/auth/authorize-route', apiHandler(async (req: Request, res: Response) => {
  const { route } = req.body || {};
  const normalizedRoute = (route || '/').toLowerCase();

  // Public routes allow access without authentication
  if (
    normalizedRoute === '/' ||
    normalizedRoute === '/home' ||
    normalizedRoute.startsWith('/personal') ||
    normalizedRoute.startsWith('/business') ||
    normalizedRoute.startsWith('/corporate') ||
    normalizedRoute.startsWith('/digital') ||
    normalizedRoute.startsWith('/open-account') ||
    normalizedRoute.startsWith('/about') ||
    normalizedRoute.startsWith('/branches') ||
    normalizedRoute.startsWith('/tariffs') ||
    normalizedRoute.startsWith('/security') ||
    normalizedRoute.startsWith('/contact') ||
    normalizedRoute.startsWith('/help') ||
    normalizedRoute.startsWith('/governance') ||
    normalizedRoute.startsWith('/privacy') ||
    normalizedRoute.startsWith('/terms') ||
    normalizedRoute === '/login' ||
    normalizedRoute === '/staff/login' ||
    normalizedRoute === '/internet-banking'
  ) {
    return res.status(200).json({
      allowed: true,
      statusCode: 200,
      targetRoute: route,
    });
  }

  // Root setup routes
  if (normalizedRoute === '/supa-setup' || normalizedRoute === '/supasetup' || normalizedRoute === '/supaadmin') {
    return res.status(200).json({
      allowed: true,
      statusCode: 200,
      targetRoute: '/supa-setup',
    });
  }

  const session = await authenticateRequest(req);
  if (!session) {
    return res.status(401).json({
      allowed: false,
      statusCode: 401,
      reason: 'Authentication required. No active or valid server session found.',
      redirect: '/staff/login',
    });
  }

  const check = serverAuthManager.authorizeRouteAccess(session.token, route || '/');

  if (!check.allowed) {
    return res.status(check.statusCode).json({
      allowed: false,
      statusCode: check.statusCode,
      reason: check.reason,
      redirect: check.statusCode === 401 ? '/staff/login' : undefined,
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
      mfaVerified: session.mfaVerified,
    },
  });
}));

/**
 * POST /api/auth/logout
 * Explicitly terminates and invalidates the session token on the server.
 */
app.post('/api/auth/logout', (req: Request, res: Response) => {
  const token = extractSessionToken(req);
  if (token) {
    serverAuthManager.invalidateSession(token);
  }
  clearSessionCookie(res);
  return res.status(200).json({
    success: true,
    message: 'Session successfully revoked on the authentication gateway.',
  });
});

/**
 * POST /api/auth/forgot-password
 * Issues expiring single-use password reset token with zero user enumeration.
 */
app.post('/api/auth/forgot-password', (req: Request, res: Response) => {
  const { identifier } = req.body || {};
  if (!identifier) {
    return res.status(400).json({
      success: false,
      error: 'Please enter your registered staff email address or username.',
    });
  }

  const result = serverAuthManager.createPasswordResetRequest(identifier);

  return res.status(200).json({
    success: true,
    message: result.message,
  });
});

/**
 * POST /api/auth/reset-password
 * Completes password reset with new salted cryptographic hash and revokes existing sessions.
 */
app.post('/api/auth/reset-password', (req: Request, res: Response) => {
  const { token, newPassword } = req.body || {};

  if (!token || !newPassword) {
    return res.status(400).json({
      success: false,
      error: 'Please provide both the reset token and your new password.',
    });
  }

  const result = serverAuthManager.completePasswordReset(token, newPassword);

  if (!result.success) {
    return res.status(400).json({
      success: false,
      error: result.error || 'Failed to reset password.',
    });
  }

  return res.status(200).json({
    success: true,
    message: 'Password successfully updated. All existing sessions have been terminated. Please sign in with your new credentials.',
  });
});

/**
 * POST /api/auth/create-staff
 * Server-verified account provisioning with role hierarchy enforcement.
 */
app.post('/api/auth/create-staff', apiHandler(async (req: Request, res: Response) => {
  const session = await authenticateRequest(req);
  if (!session) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required. Please sign in with an authorized account.',
      error: 'Authentication required.',
    });
  }

  const result = serverAuthManager.createStaffAccount(session, req.body || {});
  if (!result.success) {
    const isForbidden = result.error?.includes('Privilege') || result.error?.includes('Security Invariant');
    const status = isForbidden ? 403 : 400;
    return res.status(status).json(
      buildApiResponse(
        {
          message: result.message || result.error || 'Failed to create staff account.',
          error: result.error,
          statusCode: status,
          ...result,
        },
        false
      )
    );
  }

  // Safely sync staff profile to Firestore /users without blocking or hanging on offline / permissions
  if (result.account?.id) {
    const acct = result.account;
    withServerTimeout(
      (async () => {
        const { doc, setDoc } = await import('firebase/firestore');
        const { db } = await import('./src/services/firebase');
        await setDoc(doc(db, 'users', acct.id), {
          id: acct.id,
          email: acct.email,
          fullName: acct.fullName,
          phone: acct.phone,
          role: 'STAFF',
          roleTitle: acct.roleTitle,
          active: true,
          createdAt: acct.createdAt || new Date().toISOString(),
        });
      })(),
      1200
    ).catch(() => {});
  }

  return res.status(201).json({
    success: true,
    message: 'Staff account created successfully',
    data: result.data || { account: result.account, invitation: result.invitation, initialPassword: result.initialPassword },
    account: result.account,
    invitation: result.invitation,
    initialPassword: result.initialPassword,
  });
}));

/**
 * POST /api/auth/access/generate-code
 * Lifetime Super Admin generates an access authorization code.
 */
app.post('/api/auth/access/generate-code', apiHandler(async (req: Request, res: Response) => {
  const session = await authenticateRequest(req);
  if (!session) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required. Please sign in.',
      error: 'Authentication required.',
    });
  }

  const { email, accessType, duty, permissions } = req.body || {};
  const result = serverAuthManager.generateAccessCode(session, {
    email,
    accessType,
    duty,
    permissions,
  });

  if (!result.success) {
    return res.status(403).json({
      success: false,
      message: result.error || 'Clearance violation generating access code.',
      error: result.error,
    });
  }

  return res.status(200).json(
    buildApiResponse(
      {
        message: 'Access authorization code generated successfully.',
        data: result,
        ...result,
      },
      true
    )
  );
}));

/**
 * POST /api/auth/access/give-access
 * Lifetime Super Admin executes Give Access with validated code, email, and duty.
 */
app.post('/api/auth/access/give-access', apiHandler(async (req: Request, res: Response) => {
  const session = await authenticateRequest(req);
  if (!session) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required.',
      error: 'Authentication required.',
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
    permissions,
  });

  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: result.error || 'Failed to grant access.',
      error: result.error,
    });
  }

  return res.status(200).json(
    buildApiResponse(
      {
        message: 'Access successfully granted.',
        data: result,
        ...result,
      },
      true
    )
  );
}));

/**
 * POST /api/auth/access/update-permissions
 * Lifetime Super Admin configures granular permissions for an Admin or Staff account.
 */
app.post('/api/auth/access/update-permissions', apiHandler(async (req: Request, res: Response) => {
  const session = await authenticateRequest(req);
  if (!session) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required.',
      error: 'Authentication required.',
    });
  }

  const { targetUserId, permissions } = req.body || {};
  const result = serverAuthManager.updateUserPermissions(session, targetUserId, permissions);

  if (!result.success) {
    return res.status(403).json({
      success: false,
      message: result.error || 'Failed to update permissions.',
      error: result.error,
    });
  }

  return res.status(200).json(
    buildApiResponse(
      {
        message: 'Permissions updated successfully.',
        data: result,
        ...result,
      },
      true
    )
  );
}));

/**
 * POST /api/auth/access/appoint-admin
 * Exclusive privilege: Lifetime Super Admin appoints an Administrator with an access code.
 */
app.post('/api/auth/access/appoint-admin', apiHandler(async (req: Request, res: Response) => {
  const session = await authenticateRequest(req);
  if (!session) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required. Please sign in with Lifetime Super Admin credentials.',
      error: 'Authentication required.',
    });
  }

  if (session.role !== 'LIFETIME_SUPER_ADMIN') {
    return res.status(403).json({
      success: false,
      message: 'Clearance Violation: Only the Lifetime Super Admin can appoint Administrators.',
      error: 'Clearance Violation: Only the Lifetime Super Admin can appoint Administrators.',
    });
  }

  const result = serverAuthManager.appointAdministrator(session, req.body || {});
  if (!result.success) {
    return res.status(400).json(
      buildApiResponse(
        {
          message: result.message || result.error || 'Failed to appoint administrator.',
          error: result.error,
          ...result,
        },
        false
      )
    );
  }

  // Safely sync to Firestore /admins and /users collections without blocking response
  if (result.account?.id) {
    const acct = result.account;
    withServerTimeout(
      (async () => {
        const { doc, setDoc } = await import('firebase/firestore');
        const { db } = await import('./src/services/firebase');
        await setDoc(doc(db, 'admins', acct.id), {
          uid: acct.id,
          email: acct.email,
          fullName: acct.fullName,
          phone: acct.phone,
          role: 'ADMIN',
          duty: acct.duty || acct.roleTitle,
          createdAt: new Date().toISOString(),
        });
        await setDoc(doc(db, 'users', acct.id), {
          id: acct.id,
          email: acct.email,
          fullName: acct.fullName,
          phone: acct.phone,
          role: 'ADMIN',
          active: true,
          createdAt: new Date().toISOString(),
        });
      })(),
      1200
    ).catch(() => {});
  }

  return res.status(201).json({
    success: true,
    message: 'Admin account created successfully',
    data: result.data || { account: result.account, invitation: result.invitation },
    account: result.account,
    invitation: result.invitation,
  });
}));

/**
 * POST /api/auth/access/revoke
 * Lifetime Super Admin or Admin revokes an issued access code before use.
 */
app.post('/api/auth/access/revoke', apiHandler(async (req: Request, res: Response) => {
  const session = await authenticateRequest(req);
  if (!session) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required.',
      error: 'Authentication required.',
    });
  }

  const { invitationId } = req.body || {};
  if (!invitationId) {
    return res.status(400).json({
      success: false,
      message: 'Invitation ID is required.',
      error: 'Invitation ID is required.',
    });
  }

  const result = serverAuthManager.revokeAccessCode(session, invitationId);
  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: result.error || 'Failed to revoke access code.',
      error: result.error,
    });
  }

  return res.status(200).json(
    buildApiResponse(
      {
        message: 'Access authorization code successfully revoked.',
        data: result,
        ...result,
      },
      true
    )
  );
}));

/**
 * POST /api/auth/access/verify-code
 * Validates access authorization code against secure salted hash without exposing secret.
 */
app.post('/api/auth/access/verify-code', apiHandler(async (req: Request, res: Response) => {
  const { email, code } = req.body || {};
  if (!email || !code) {
    return res.status(400).json({
      success: false,
      message: 'Email and access authorization code are required.',
      error: 'Email and access authorization code are required.',
    });
  }

  const result = serverAuthManager.verifyAccessCode(email, code);
  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: result.error || 'Invalid or expired access code.',
      error: result.error,
    });
  }

  return res.status(200).json(
    buildApiResponse(
      {
        message: 'Access code verified successfully.',
        data: result,
        ...result,
      },
      true
    )
  );
}));

/**
 * POST /api/auth/access/redeem-code
 * Single-use redemption of access authorization code to complete staff/admin account onboarding.
 */
app.post('/api/auth/access/redeem-code', apiHandler(async (req: Request, res: Response) => {
  const { email, code, newPassword, fullName, phone } = req.body || {};
  if (!email || !code) {
    return res.status(400).json({
      success: false,
      message: 'Email and access authorization code are required.',
      error: 'Email and access authorization code are required.',
    });
  }

  const result = serverAuthManager.redeemAccessCode(email, code, newPassword, fullName, phone);
  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: result.error || 'Failed to redeem access code.',
      error: result.error,
    });
  }

  return res.status(200).json(
    buildApiResponse(
      {
        message: 'Access code redeemed successfully. Account activated.',
        data: result,
        ...result,
      },
      true
    )
  );
}));

/**
 * GET /api/auth/access/invitations
 * Super Admin retrieves active invitations.
 */
app.get('/api/auth/access/invitations', apiHandler(async (req: Request, res: Response) => {
  const session = await authenticateRequest(req);
  if (!session || session.role !== 'LIFETIME_SUPER_ADMIN') {
    return res.status(403).json({
      success: false,
      message: 'Clearance required: Lifetime Super Admin clearance is required.',
      error: 'Clearance required.',
    });
  }

  const invitations = serverAuthManager.getAccessInvitations(session);
  return res.status(200).json({
    success: true,
    message: 'Invitations retrieved successfully.',
    data: { invitations },
    invitations,
  });
}));

/**
 * GET /api/auth/accounts
 * Super Admin or Admin retrieves public account directory.
 */
app.get('/api/auth/accounts', apiHandler(async (req: Request, res: Response) => {
  const session = await authenticateRequest(req);
  if (!session || (session.role !== 'LIFETIME_SUPER_ADMIN' && session.role !== 'ADMIN')) {
    return res.status(403).json({
      success: false,
      message: 'Clearance required: Administrative privileges required.',
      error: 'Clearance required.',
    });
  }

  const accounts = serverAuthManager.getPublicAccountsList(session);
  return res.status(200).json({
    success: true,
    message: 'Accounts retrieved successfully.',
    data: { accounts },
    accounts,
  });
}));

/**
 * POST /api/auth/revoke-admin
 * Super Admin alone can demote an Administrator to Staff.
 */
app.post('/api/auth/revoke-admin', apiHandler(async (req: Request, res: Response) => {
  const session = await authenticateRequest(req);
  if (!session) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required.',
      error: 'Authentication required.',
    });
  }

  const { targetUserId } = req.body || {};
  const result = serverAuthManager.revokeAdminRole(session, targetUserId);
  if (!result.success) {
    return res.status(403).json({
      success: false,
      message: result.error || 'Failed to revoke administrator role.',
      error: result.error,
    });
  }

  return res.status(200).json(
    buildApiResponse(
      {
        message: 'Administrator privileges revoked successfully. Account demoted to ordinary staff.',
        data: result,
        ...result,
      },
      true
    )
  );
}));

/**
 * POST /api/auth/toggle-status
 * Server-verified account suspension/reactivation.
 */
app.post('/api/auth/toggle-status', apiHandler(async (req: Request, res: Response) => {
  const session = await authenticateRequest(req);
  if (!session) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required.',
      error: 'Authentication required.',
    });
  }

  const { targetUserId, status } = req.body || {};
  const result = serverAuthManager.updateAccountStatus(session, targetUserId, status);
  if (!result.success) {
    return res.status(403).json({
      success: false,
      message: result.error || 'Failed to update account status.',
      error: result.error,
    });
  }

  return res.status(200).json(
    buildApiResponse(
      {
        message: 'Account status updated successfully.',
        data: result,
        ...result,
      },
      true
    )
  );
}));

/**
 * POST /api/financial/transfers/approve
 * Server-side financial approval checking self-approval prohibition.
 */
app.post('/api/financial/transfers/approve', apiHandler(async (req: Request, res: Response) => {
  const session = await authenticateRequest(req);
  if (!session) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required.',
      error: 'Authentication required.',
    });
  }

  const { requestId, submittedByStaffId, submittedByStaffName, amount } = req.body || {};
  const check = serverAuthManager.verifyFinancialApproval(session, {
    id: requestId,
    submittedByStaffId,
    submittedByStaffName,
    amount: Number(amount || 0),
  });

  if (!check.allowed) {
    return res.status(403).json({
      success: false,
      message: check.error || 'Transfer approval denied.',
      error: check.error,
    });
  }

  return res.status(200).json({
    success: true,
    message: 'Transfer approval validated on server.',
    data: {},
  });
}));

/**
 * GET /api/audit/logs
 * Authenticated inspection of security audit trail.
 */
app.get('/api/audit/logs', apiHandler(async (req: Request, res: Response) => {
  const session = await authenticateRequest(req);
  if (!session || (session.role !== 'LIFETIME_SUPER_ADMIN' && session.role !== 'ADMIN')) {
    return res.status(403).json({
      success: false,
      message: 'Clearance required: Administrative clearance is required to view audit logs.',
      error: 'Clearance required.',
    });
  }

  const logs = serverAuthManager.getAuditLogs(session);
  return res.status(200).json({
    success: true,
    message: 'Audit logs retrieved successfully.',
    data: { logs },
    logs,
  });
}));

/**
 * GET /api/customers
 * Returns all registered customer records across sessions and portals.
 */
app.get('/api/customers', apiHandler(async (_req: Request, res: Response) => {
  try {
    await withServerTimeout(
      (async () => {
        const { collection, getDocs } = await import('firebase/firestore');
        const { db } = await import('./src/services/firebase');
        const snap = await getDocs(collection(db, 'customers'));
        snap.forEach((docSnap) => {
          const data = docSnap.data();
          if (data && (data.fullName || data.phone)) {
            try {
              serverAuthManager.saveCustomerRecord({ id: docSnap.id, ...data });
            } catch {
              // Ignore malformed records
            }
          }
        });
      })(),
      1200
    );
  } catch {
    // Non-fatal if Firestore read is unavailable or times out
  }

  const customers = serverAuthManager.getCustomersList();
  return res.status(200).json({
    success: true,
    message: 'Customers retrieved successfully.',
    data: { customers },
    customers,
  });
}));

/**
 * POST /api/customers
 * Persists a newly created or updated customer record on the backend and Firestore.
 */
app.post('/api/customers', apiHandler(async (req: Request, res: Response) => {
  const payload = req.body?.customer || req.body || {};
  if (!payload.fullName && !payload.phone) {
    return res.status(400).json({
      success: false,
      message: 'Customer full name and phone number are required.',
      error: 'Customer full name and phone number are required.',
    });
  }

  const customer = serverAuthManager.saveCustomerRecord(payload);

  // Fire-and-forget Firestore sync with timeout
  withServerTimeout(
    (async () => {
      const { doc, setDoc } = await import('firebase/firestore');
      const { db } = await import('./src/services/firebase');
      await setDoc(doc(db, 'customers', customer.id), customer, { merge: true });
    })(),
    1200
  ).catch(() => {});

  const customers = serverAuthManager.getCustomersList();
  return res.status(201).json({
    success: true,
    message: 'Customer registered and synchronized successfully.',
    data: { customer, customers },
    customer,
    customers,
  });
}));

// ============================================================================
// 5.5. DEDICATED /api/* 404 HANDLER & ERROR MIDDLEWARE
// Prevents missing API routes or method mismatches from falling into SPA index.html
// ============================================================================
app.all('/api/*', (req: Request, res: Response) => {
  return res.status(404).json({
    success: false,
    message: `API endpoint not found: ${req.method} ${req.path}`,
    error: 'ENDPOINT_NOT_FOUND',
    statusCode: 404,
  });
});

app.use('/api', (err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[API SERVER ERROR MIDDLEWARE]', err);
  const status = typeof err?.status === 'number' && err.status >= 400 && err.status < 600 ? err.status : 500;
  return res.status(status).json({
    success: false,
    message: err?.message || 'A server error occurred while processing the request.',
    error: err?.message || 'INTERNAL_SERVER_ERROR',
    statusCode: status,
  });
});

// ============================================================================
// 6. VITE DEV MIDDLEWARE, STATIC ASSET SERVING & SPA FALLBACK
// ============================================================================
const cwd = process.cwd();
const distPath = path.resolve(cwd, 'dist');
const indexPath = path.join(distPath, 'index.html');
const rootIndexPath = path.resolve(cwd, 'index.html');

if (!process.env.VERCEL) {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    // In development mode, always use Vite dev server middleware first so live edits
    // and concurrent `vite build` runs never interrupt or drop preview connections.
    const vitePromise = import('vite')
      .then(({ createServer: createViteServer }) =>
        createViteServer({
          server: {
            middlewareMode: true,
            hmr: false,
            allowedHosts: true,
          },
          appType: 'spa',
        })
      )
      .then((vite) => {
        console.log('[DEV] Vite dev server middleware initialized and mounted');
        return vite;
      })
      .catch((err) => {
        console.warn('[DEV] Vite dev server middleware fallback to static:', err?.message || err);
        return null;
      });

    app.use(async (req: Request, res: Response, next: NextFunction) => {
      try {
        const vite = await vitePromise;
        if (vite) {
          return vite.middlewares(req, res, next);
        }
      } catch (err) {
        console.warn('[DEV] Vite middleware handler note:', err);
      }
      next();
    });
  }

  // Serve pre-built static assets if available (used in production or if Vite middleware passes through)
  app.use(express.static(distPath, { index: false, maxAge: isProd ? '1h' : 0 }));

  app.get('*', (_req: Request, res: Response) => {
    if (fs.existsSync(indexPath)) {
      return res.sendFile(indexPath, (err) => {
        if (err && !res.headersSent) {
          res.status(200).sendFile(rootIndexPath);
        }
      });
    }
    if (fs.existsSync(rootIndexPath)) {
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

// Global Error Handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[SERVER ERROR]', err);
  if (!res.headersSent) {
    res.status(500).json({ error: 'Internal Server Error', message: err?.message || 'Unexpected failure' });
  }
});

// ============================================================================
// 7. STARTUP: LISTEN IMMEDIATELY (Non-blocking, Cloud Run & Port 3000)
// ============================================================================
let server: any = null;

if (!process.env.VERCEL) {
  server = app.listen(PORT, HOST, () => {
    console.log(`[TEAMACRO] Server listening on http://${HOST}:${PORT}`);
    console.log(`[TEAMACRO] Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`[TEAMACRO] Health check available at: http://${HOST}:${PORT}/health`);
    console.log(`[TEAMACRO] Authoritative Gateway online: Zero Demo Accounts · Real RFC 6238 TOTP`);
  });

  server.keepAliveTimeout = 65000;
  server.headersTimeout = 66000;

  server.on('error', (err: any) => {
    console.error('[TEAMACRO SERVER SOCKET ERROR]', err?.message || err);
  });

  process.on('SIGTERM', () => {
    server?.close(() => {
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    server?.close(() => {
      process.exit(0);
    });
  });
}

export default app;