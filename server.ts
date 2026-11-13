import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { serverAuthManager, UserSession } from './src/server/authManager.js';
import {
  verifyFirebaseIdToken,
  provisionFirebaseAuthAccount,
  rollbackFirebaseAuthAccount,
  writeFirestoreUserProfile,
  readFirestoreDocument,
  listFirestoreCollection,
  getFirestoreSystemOwnership,
  authenticateWithFirebaseOnColdStart,
  logStructuredServerError,
  inspectFirebaseAdminEnvironment,
  runDeepHealthDiagnostics,
  getFirestoreSessionByHash,
  revokeFirestoreSessionByHash,
  listFirestoreInvitations,
  saveFirestoreInvitation,
  setFirebaseAuthUserDisabled,
  syncSuperAdminFirebaseAuthCredentials,
  deleteFirebaseAccountAndFirestoreProfile,
  updateFirebaseAuthUserCredentials,
  deleteFirestoreDocument,
  writeFirestoreDocument,
  invalidateFirestoreCache,
} from './src/server/firebaseAdmin.js';
import {
  getDedicatedRouteForUser,
  normalizeCanonicalPosition,
  sanitizePermissionsForPosition,
} from './src/utils/roleRouting.js';

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

// Load environment variables from .env if present before resolving configuration
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

// Normalize Vercel serverless request URL when /api/(.*) is rewritten to /api?__path=$1 or stripped
app.use((req: Request, _res: Response, next: NextFunction) => {
  const queryPath = typeof req.query?.__path === 'string' ? req.query.__path.trim() : '';
  if (queryPath) {
    const cleanSubPath = queryPath.replace(/^\/+/, '');
    const searchIndex = req.url.indexOf('?');
    let remainingQuery = '';
    if (searchIndex !== -1) {
      const params = new URLSearchParams(req.url.slice(searchIndex + 1));
      params.delete('__path');
      const qs = params.toString();
      if (qs) remainingQuery = `?${qs}`;
    }
    req.url = `/api/${cleanSubPath}${remainingQuery}`;
    return next();
  }

  if (
    !req.url.startsWith('/api') &&
    (req.url.startsWith('/auth/') ||
      req.url.startsWith('/admin/diagnostics') ||
      req.url.startsWith('/customers') ||
      req.url.startsWith('/operations/') ||
      req.url.startsWith('/financial/') ||
      req.url.startsWith('/audit/') ||
      req.url.startsWith('/super-admin/'))
  ) {
    req.url = '/api' + req.url;
  }
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

  // 1. Check direct session token candidates (internal session hex tokens or signed tmr_s1_ tokens)
  const sessionCandidates = [customSessionToken, cookieToken, bearerToken].filter(
    (t) => t && t.split('.').length !== 3
  );
  const isColdStartSimulated = req.headers['x-test-simulate-cold-start'] === 'true';

  for (const tok of sessionCandidates) {
    const isWarm = !isColdStartSimulated && serverAuthManager.hasWarmSession(tok);
    const peeked = serverAuthManager.peekSessionToken(tok);
    if (peeked) {
      const accountInMemory =
        peeked.role === 'LIFETIME_SUPER_ADMIN' ||
        Boolean(serverAuthManager.findAccountByIdentifier(peeked.userId));

      if (!isWarm || !accountInMemory) {
        const tokenHash = serverAuthManager.getSessionTokenHash(tok);
        const [fsSession] = await Promise.all([
          withServerTimeout(getFirestoreSessionByHash(tokenHash), 1000).catch(() => null),
          peeked.role !== 'LIFETIME_SUPER_ADMIN'
            ? ensureAccountHydratedFromFirestore(peeked.userId, undefined, true)
            : Promise.resolve(),
        ]);
        if (fsSession && fsSession.revoked === true) {
          serverAuthManager.markTokenRevokedInMemory(tok);
          continue;
        }
      }
    }

    const session = serverAuthManager.validateSession(tok);
    if (session) {
      return session;
    }
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

function setSessionCookie(res: Response, token: string, req?: Request): void {
  const isSecure =
    process.env.NODE_ENV === 'production' ||
    Boolean(process.env.VERCEL) ||
    Boolean(req?.secure) ||
    req?.headers?.['x-forwarded-proto'] === 'https';
  const secureFlag = isSecure ? '; Secure' : '';
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

app.get('/api/health', async (req: Request, res: Response) => {
  try {
    const forceRefresh = req.query.force === 'true' || req.query.refresh === 'true';
    const simulateFailure = Boolean(req.headers['x-test-simulate-health-failure']);
    const diag = await runDeepHealthDiagnostics(forceRefresh, simulateFailure);
    const firebaseDiagnostics = inspectFirebaseAdminEnvironment();

    return res.status(diag.httpStatus).json({
      status: diag.status,
      healthy: diag.healthy,
      service: 'TEAMACRO SERVICES LTD - Management Platform',
      rcNumber: 'RC-1589421',
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: diag.timestamp,
      latencyMs: diag.latencyMs,
      checks: diag.checks,
      environment: diag.environment,
      firebaseAdmin: {
        projectId: firebaseDiagnostics.projectId,
        firestoreDatabaseId: firebaseDiagnostics.firestoreDatabaseId,
        hasServiceAccountKeyEnv: firebaseDiagnostics.hasServiceAccountKeyEnv,
        serviceAccountKeyValidJson: firebaseDiagnostics.serviceAccountKeyValidJson,
        hasAdminCredentials: firebaseDiagnostics.hasAdminCredentials,
        credentialSource: firebaseDiagnostics.credentialSource,
        adminAppInitialized: firebaseDiagnostics.adminAppInitialized,
        singletonAppCount: firebaseDiagnostics.singletonAppCount,
        missingEnvVars: firebaseDiagnostics.missingEnvVars,
      },
    });
  } catch (err: any) {
    return res.status(503).json({
      status: 'DOWN',
      healthy: false,
      service: 'TEAMACRO SERVICES LTD - Management Platform',
      rcNumber: 'RC-1589421',
      timestamp: new Date().toISOString(),
      checks: {
        backendResponding: true,
        firebaseAdminInitialized: false,
        serviceAccountCredentialsValid: false,
        correctFirestoreDatabaseSelected: false,
        firestoreConnectivity: false,
        systemOwnershipReadable: false,
        authServiceAvailable: false,
      },
      error: err?.message || 'Health check failed.',
    });
  }
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
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  next();
});

/**
 * Robust async route handler wrapper.
 * Catches all errors and returns standardized JSON responses.
 */
function generateCorrelationId(req?: Request): string {
  const headerId = req?.headers?.['x-correlation-id'];
  if (typeof headerId === 'string' && headerId.trim()) {
    return headerId.trim();
  }
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
}

let lastAccountsHydratedAt = 0;
let lastCustomersHydratedAt = 0;
const HYDRATION_COOLDOWN_MS = 15_000;

function apiHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<any> | any) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.headers['x-test-simulate-cold-start'] === 'true') {
        serverAuthManager.simulateServerlessColdStart();
        invalidateFirestoreCache();
        lastAccountsHydratedAt = 0;
        lastCustomersHydratedAt = 0;
      }
      await fn(req, res, next);
    } catch (err: any) {
      const correlationId = generateCorrelationId(req);
      const endpoint = req.originalUrl || req.path || '/api/unknown';
      const status = typeof err?.status === 'number' && err.status >= 400 && err.status < 600 ? err.status : 500;
      const safeMessage = err?.message || 'A server error occurred while processing the request.';
      logStructuredServerError({
        correlationId,
        endpoint,
        operation: `${req.method}_HANDLER`,
        errorCategory: 'INTERNAL_SERVER_ERROR',
        firebaseErrorCode: err?.code || 'INTERNAL_SERVER_ERROR',
        statusCode: status,
        message: safeMessage,
      });
      if (!res.headersSent) {
        return res.status(status).json({
          success: false,
          error: {
            code: err?.code || 'INTERNAL_SERVER_ERROR',
            message: safeMessage,
            correlationId,
          },
          message: safeMessage,
          correlationId,
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
    const fsOwnership = await withServerTimeout(
      getFirestoreSystemOwnership(),
      1500
    );
    if (fsOwnership && fsOwnership.isInitialized && fsOwnership.ownerUserId) {
      serverAuthManager.syncOwnershipRecord(fsOwnership);
      return res.status(200).json({
        success: true,
        status: 'INITIALIZED',
        isInitialized: true,
        lockdownEnforced: true,
        establishedAt: fsOwnership.establishedAt || null,
        ownerUid: fsOwnership.ownerUserId,
        ownerEmail: fsOwnership.ownerEmail || null,
        ownerFullName: fsOwnership.ownerFullName || null,
        message: 'INITIAL SETUP COMPLETED — ROOT REGISTRATION LOCKED',
        data: {
          status: 'INITIALIZED',
          isInitialized: true,
          lockdownEnforced: true,
          ownerUid: fsOwnership.ownerUserId,
          ownerEmail: fsOwnership.ownerEmail || null,
          ownerFullName: fsOwnership.ownerFullName || null,
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
 * Protected Administrator-Only Diagnostic Endpoint
 * Available at GET /api/admin/diagnostics and GET /api/auth/diagnostics
 * Never exposes private keys, service-account JSON, passwords, or raw session tokens.
 */
const handleAdminDiagnostics = apiHandler(async (req: Request, res: Response) => {
  const correlationId = generateCorrelationId(req);
  const session = await authenticateRequest(req);
  if (!session) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication required to access administrative diagnostics.',
        correlationId,
      },
      message: 'Authentication required to access administrative diagnostics.',
      correlationId,
      statusCode: 401,
    });
  }

  if (session.role !== 'LIFETIME_SUPER_ADMIN' && session.role !== 'ADMIN') {
    return res.status(403).json({
      success: false,
      error: {
        code: 'INSUFFICIENT_PRIVILEGES',
        message: 'Administrative clearance required to view system diagnostics.',
        correlationId,
      },
      message: 'Administrative clearance required to view system diagnostics.',
      correlationId,
      statusCode: 403,
    });
  }

  const [healthDiag, ownership, usersList, adminsList, staffList, invitationsList] = await Promise.all([
    runDeepHealthDiagnostics(true),
    getFirestoreSystemOwnership().catch(() => null),
    listFirestoreCollection('users').catch(() => []),
    listFirestoreCollection('admins').catch(() => []),
    listFirestoreCollection('staff').catch(() => []),
    listFirestoreInvitations().catch(() => []),
  ]);

  const envReport = inspectFirebaseAdminEnvironment();

  return res.status(healthDiag.httpStatus).json({
    success: healthDiag.healthy,
    status: healthDiag.status,
    healthy: healthDiag.healthy,
    correlationId,
    timestamp: new Date().toISOString(),
    checks: healthDiag.checks,
    environment: envReport,
    firestore: {
      systemOwnership: {
        isInitialized: Boolean(ownership?.isInitialized),
        ownerUserId: ownership?.ownerUserId || null,
        lockdownEnforced: Boolean(ownership?.lockdownEnforced),
      },
    },
    firestoreCollections: {
      usersCount: usersList.length,
      adminsCount: adminsList.length,
      staffCount: staffList.length,
      invitationsCount: invitationsList.length,
      systemOwnershipInitialized: Boolean(ownership?.isInitialized),
      systemOwnershipLockdownEnforced: Boolean(ownership?.lockdownEnforced),
    },
  });
});

app.get('/api/admin/diagnostics', handleAdminDiagnostics);
app.get('/api/auth/diagnostics', handleAdminDiagnostics);

/**
 * POST /api/auth/sync-super-admin
 * Authoritatively verifies a Firebase ID token via Firebase Admin SDK and compares the verified UID
 * against the authoritative `system_ownership` record in Firestore.
 * Never trusts unverified browser-submitted UID or email values.
 */
app.post('/api/auth/sync-super-admin', apiHandler(async (req: Request, res: Response) => {
  const { uid: bodyUid, email: bodyEmail, fullName, phone, idToken: bodyIdToken } = req.body || {};
  const correlationId = generateCorrelationId(req);

  const callerJwt = extractCallerFirebaseToken(req);
  const effectiveIdToken = typeof bodyIdToken === 'string' && bodyIdToken.trim() ? bodyIdToken.trim() : callerJwt;

  // Reject unverified requests that do not present a real Firebase ID token (JWT)
  if (!effectiveIdToken || effectiveIdToken.split('.').length !== 3) {
    const msg = 'A verified Firebase ID token is required to synchronize Super Admin session privileges.';
    logStructuredServerError({
      correlationId,
      endpoint: '/api/auth/sync-super-admin',
      operation: 'SYNC_SUPER_ADMIN_TOKEN_REQUIRED',
      errorCategory: 'AUTHENTICATION_REQUIRED',
      firebaseErrorCode: 'auth/missing-id-token',
      statusCode: 401,
      message: `Rejected unverified sync-super-admin request without Firebase ID token (submitted uid=${bodyUid || 'none'}, email=${bodyEmail || 'none'}).`,
    });
    return res.status(401).json({
      success: false,
      error: {
        code: 'FIREBASE_ID_TOKEN_REQUIRED',
        message: msg,
        correlationId,
      },
      message: msg,
      correlationId,
      statusCode: 401,
    });
  }

  // 1. Cryptographically verify the Firebase ID token using Firebase Admin SDK
  const verifiedToken = await verifyFirebaseIdToken(effectiveIdToken);
  if (!verifiedToken.valid || !verifiedToken.verified || !verifiedToken.uid) {
    const msg = 'Invalid, expired, or unverified Firebase ID token.';
    logStructuredServerError({
      correlationId,
      endpoint: '/api/auth/sync-super-admin',
      operation: 'SYNC_SUPER_ADMIN_TOKEN_VERIFY',
      errorCategory: 'AUTH_ERROR',
      firebaseErrorCode: verifiedToken.errorCode || 'auth/invalid-id-token',
      statusCode: 401,
      message: `Firebase ID token verification failed: ${verifiedToken.errorCode || 'invalid token'}`,
    });
    return res.status(401).json({
      success: false,
      error: {
        code: verifiedToken.errorCode || 'INVALID_FIREBASE_ID_TOKEN',
        message: msg,
        correlationId,
      },
      message: msg,
      correlationId,
      statusCode: 401,
    });
  }

  // 2. Read the authoritative system_ownership record from Firestore
  let fsOwnership: Awaited<ReturnType<typeof getFirestoreSystemOwnership>> = null;
  try {
    fsOwnership = await withServerTimeout(getFirestoreSystemOwnership(effectiveIdToken), 2500);
  } catch (err: any) {
    logStructuredServerError({
      correlationId,
      endpoint: '/api/auth/sync-super-admin',
      operation: 'SYNC_SUPER_ADMIN_FIRESTORE_OWNERSHIP_READ',
      errorCategory: 'FIRESTORE_ERROR',
      firebaseErrorCode: 'firestore/unavailable',
      statusCode: 503,
      message: `Failed reading system_ownership from Firestore: ${err?.message || 'timeout'}`,
    });
  }

  if (!fsOwnership || !fsOwnership.isInitialized || !fsOwnership.ownerUserId) {
    const msg = 'Unable to verify authoritative system_ownership record in Firestore. Super Admin access denied.';
    logStructuredServerError({
      correlationId,
      endpoint: '/api/auth/sync-super-admin',
      operation: 'SYNC_SUPER_ADMIN_OWNERSHIP_UNAVAILABLE',
      errorCategory: 'SERVICE_UNAVAILABLE',
      firebaseErrorCode: 'firestore/ownership-unverified',
      statusCode: 503,
      message: msg,
    });
    return res.status(503).json({
      success: false,
      error: {
        code: 'OWNERSHIP_VERIFICATION_UNAVAILABLE',
        message: msg,
        correlationId,
      },
      message: msg,
      correlationId,
      statusCode: 503,
    });
  }

  serverAuthManager.syncOwnershipRecord(fsOwnership);

  const verifiedUid = verifiedToken.uid.trim();
  const verifiedEmail = (verifiedToken.email || '').trim().toLowerCase();
  const submittedUid = typeof bodyUid === 'string' ? bodyUid.trim() : '';
  const submittedEmail = typeof bodyEmail === 'string' ? bodyEmail.trim().toLowerCase() : '';

  // Reject if browser-submitted UID/email contradicts the verified token or authoritative ownership
  const uidContradicts =
    Boolean(submittedUid) &&
    submittedUid !== verifiedUid &&
    submittedUid !== fsOwnership.ownerUserId;
  const emailContradicts =
    Boolean(submittedEmail) &&
    Boolean(verifiedEmail) &&
    submittedEmail !== verifiedEmail;

  if (
    uidContradicts ||
    emailContradicts ||
    !serverAuthManager.isVerifiedOwner(verifiedUid, verifiedEmail)
  ) {
    const msg = 'Clearance Violation: Verified Firebase identity does not match the authoritative Lifetime Super Admin ownership record.';
    logStructuredServerError({
      correlationId,
      endpoint: '/api/auth/sync-super-admin',
      operation: 'SYNC_SUPER_ADMIN_OWNERSHIP_CHECK',
      errorCategory: 'PERMISSION_DENIED',
      firebaseErrorCode: 'auth/insufficient-permission',
      statusCode: 403,
      message: `Rejected sync-super-admin for verifiedUid=${verifiedUid}, verifiedEmail=${verifiedEmail}, submittedUid=${submittedUid}: does not match ownerUserId=${fsOwnership.ownerUserId}.`,
    });
    return res.status(403).json({
      success: false,
      error: {
        code: 'OWNERSHIP_MISMATCH',
        message: msg,
        correlationId,
      },
      message: msg,
      correlationId,
      statusCode: 403,
    });
  }

  const canonicalOwnerUid = fsOwnership.ownerUserId;
  const canonicalOwnerEmail = (fsOwnership.ownerEmail || verifiedEmail).toLowerCase().trim();
  await ensureAccountHydratedFromFirestore(canonicalOwnerUid, effectiveIdToken, true);

  const existingOwnerAccount = serverAuthManager.findAccountByIdentifier(canonicalOwnerUid) ||
    serverAuthManager.findAccountByIdentifier(canonicalOwnerEmail);

  // Maintain mandatory MFA verification if configured on the Super Admin account
  if (existingOwnerAccount && existingOwnerAccount.mfaRequired && existingOwnerAccount.totpSecret) {
    const challenge = serverAuthManager.initiateMfaChallenge(existingOwnerAccount);
    return res.status(200).json({
      success: true,
      requireMfa: true,
      mfaRequired: true,
      tempToken: challenge.tempToken,
      challengeToken: challenge.tempToken,
      maskedDestination: challenge.maskedDestination,
      expiresInSeconds: challenge.expiresInSeconds,
      user: {
        id: existingOwnerAccount.id,
        fullName: existingOwnerAccount.fullName,
        email: existingOwnerAccount.email,
        role: existingOwnerAccount.role,
        roleTitle: existingOwnerAccount.roleTitle,
        isLifetimeSuperAdmin: true,
      },
    });
  }

  const ip = getClientIp(req);
  const userAgent = (req.headers['user-agent'] as string) || 'unknown';

  const session = serverAuthManager.syncSuperAdminSession(
    {
      uid: canonicalOwnerUid,
      email: canonicalOwnerEmail,
      fullName: fullName || verifiedToken.fullName || fsOwnership.ownerFullName || 'David Eromosele',
      phone: phone || fsOwnership.ownerPhone || undefined,
    },
    ip,
    userAgent
  );

  setSessionCookie(res, session.token, req);

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
  const { identifier, password } = req.body || {};
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

  const isColdStartSimulated = req.headers['x-test-simulate-cold-start'] === 'true';
  const warmCandidate = !isColdStartSimulated
    ? serverAuthManager.findAccountByIdentifier(cleanIdentifier)
    : undefined;

  let result: ReturnType<typeof serverAuthManager.authenticateCredentials> = {
    success: false,
  };

  // Fast-path: If the account is already warm in memory with a password hash, verify immediately (~5ms)
  if (warmCandidate && warmCandidate.passwordHash && warmCandidate.passwordSalt) {
    result = serverAuthManager.authenticateCredentials(cleanIdentifier, cleanPassword, ip);
  }

  // Hydrate from Firestore only if fast-path did not succeed or cold-start is simulated
  if (!result.success || !result.account) {
    try {
      const fsOwnership = await withServerTimeout(getFirestoreSystemOwnership(), 1200);
      if (fsOwnership?.isInitialized && fsOwnership.ownerUserId) {
        serverAuthManager.syncOwnershipRecord(fsOwnership);
      }
    } catch {
      // Non-fatal if Firestore ownership lookup times out
    }

    try {
      const [fsUsers, fsAdmins, fsStaff, fsInvitations] = await withServerTimeout(
        Promise.all([
          listFirestoreCollection('users'),
          listFirestoreCollection('admins'),
          listFirestoreCollection('staff'),
          listFirestoreInvitations(),
        ]),
        1800
      );
      for (const inv of fsInvitations) {
        serverAuthManager.upsertInvitationFromFirestore(inv);
      }
      const userMap = new Map<string, Record<string, any>>();
      for (const u of fsUsers) {
        const uid = String(u.uid || u.id || '');
        if (uid) userMap.set(uid, u);
      }
      for (const adm of fsAdmins) {
        const uid = String(adm.uid || adm.id || '');
        const merged = { ...(userMap.get(uid) || {}), ...adm };
        if (merged.email && (
          String(merged.email).toLowerCase() === cleanIdentifier.toLowerCase() ||
          String(merged.staffCode || '').toLowerCase() === cleanIdentifier.toLowerCase() ||
          uid === cleanIdentifier
        )) {
          const isRootOwner = serverAuthManager.isVerifiedOwner(uid, String(merged.email));
          const pos = String(merged.position || merged.duty || merged.roleTitle || (isRootOwner ? 'Lifetime Super Admin' : 'Account Manager'));
          serverAuthManager.syncProvisionedAccount({
            id: uid,
            email: String(merged.email),
            fullName: String(merged.fullName || merged.email),
            phone: String(merged.phone || ''),
            role: isRootOwner ? 'LIFETIME_SUPER_ADMIN' : 'ADMIN',
            roleTitle: pos,
            duty: pos,
            position: pos,
            dashboardRoute: merged.dashboardRoute ? String(merged.dashboardRoute) : undefined,
            assignedProgramme: merged.assignedProgramme ? String(merged.assignedProgramme) : undefined,
            staffCode: merged.staffCode ? String(merged.staffCode) : undefined,
            status: merged.active === false || merged.status === 'suspended' ? 'suspended' : 'active',
            passwordHash: merged.passwordHash ? String(merged.passwordHash) : undefined,
            passwordSalt: merged.passwordSalt ? String(merged.passwordSalt) : undefined,
            accessCodeHash: merged.accessCodeHash ? String(merged.accessCodeHash) : undefined,
            accessCodeSalt: merged.accessCodeSalt ? String(merged.accessCodeSalt) : undefined,
            accessCodeMasked: merged.accessCodeMasked ? String(merged.accessCodeMasked) : undefined,
            mfaRequired: typeof merged.mfaRequired === 'boolean' ? merged.mfaRequired : undefined,
            totpSecret: merged.totpSecret ? String(merged.totpSecret) : undefined,
            recoveryCodeHashes: Array.isArray(merged.recoveryCodeHashes) ? merged.recoveryCodeHashes : undefined,
            consumedTotpSteps: Array.isArray(merged.consumedTotpSteps) ? merged.consumedTotpSteps : undefined,
            securityVersion: typeof merged.securityVersion === 'number' ? merged.securityVersion : undefined,
            permissions: merged.permissions && typeof merged.permissions === 'object' ? merged.permissions : undefined,
            fromFirestore: true,
          });
        }
      }
      for (const stf of fsStaff) {
        const uid = String(stf.uid || stf.id || '');
        const merged = { ...(userMap.get(uid) || {}), ...stf };
        if (merged.email && (
          String(merged.email).toLowerCase() === cleanIdentifier.toLowerCase() ||
          String(merged.staffCode || '').toLowerCase() === cleanIdentifier.toLowerCase() ||
          uid === cleanIdentifier
        )) {
          const pos = String(merged.position || merged.duty || merged.roleTitle || 'Customer Registration Officer');
          serverAuthManager.syncProvisionedAccount({
            id: uid,
            email: String(merged.email),
            fullName: String(merged.fullName || merged.email),
            phone: String(merged.phone || ''),
            role: 'STAFF',
            roleTitle: pos,
            duty: pos,
            position: pos,
            dashboardRoute: merged.dashboardRoute ? String(merged.dashboardRoute) : undefined,
            assignedProgramme: merged.assignedProgramme ? String(merged.assignedProgramme) : undefined,
            staffCode: merged.staffCode ? String(merged.staffCode) : undefined,
            status: merged.active === false || merged.status === 'suspended' ? 'suspended' : 'active',
            passwordHash: merged.passwordHash ? String(merged.passwordHash) : undefined,
            passwordSalt: merged.passwordSalt ? String(merged.passwordSalt) : undefined,
            accessCodeHash: merged.accessCodeHash ? String(merged.accessCodeHash) : undefined,
            accessCodeSalt: merged.accessCodeSalt ? String(merged.accessCodeSalt) : undefined,
            accessCodeMasked: merged.accessCodeMasked ? String(merged.accessCodeMasked) : undefined,
            mfaRequired: typeof merged.mfaRequired === 'boolean' ? merged.mfaRequired : undefined,
            totpSecret: merged.totpSecret ? String(merged.totpSecret) : undefined,
            recoveryCodeHashes: Array.isArray(merged.recoveryCodeHashes) ? merged.recoveryCodeHashes : undefined,
            consumedTotpSteps: Array.isArray(merged.consumedTotpSteps) ? merged.consumedTotpSteps : undefined,
            securityVersion: typeof merged.securityVersion === 'number' ? merged.securityVersion : undefined,
            permissions: merged.permissions && typeof merged.permissions === 'object' ? merged.permissions : undefined,
            fromFirestore: true,
          });
        }
      }
    } catch {
      // Non-fatal if cold-start collection list times out
    }

    result = serverAuthManager.authenticateCredentials(cleanIdentifier, cleanPassword, ip);
  }

  // If account was not found or password hash was not yet synced in local serverless memory (e.g. Vercel cold start)
  // and identifier is an email, verify against Firebase Authentication + Cloud Firestore authoritative records.
  if ((!result.success || !result.account) && cleanIdentifier.includes('@')) {
    try {
      const fbAuth = await authenticateWithFirebaseOnColdStart(cleanIdentifier, cleanPassword);
      if (fbAuth.authenticated && fbAuth.uid && fbAuth.email) {
        const profile = fbAuth.profile || {};
        const rawRole = String(profile.role || 'STAFF').toUpperCase();
        const isRootSuperAdmin =
          (rawRole === 'LIFETIME_SUPER_ADMIN' || rawRole === 'SUPER_ADMIN') &&
          serverAuthManager.isVerifiedOwner(fbAuth.uid, fbAuth.email);

        if (isRootSuperAdmin) {
          serverAuthManager.syncSuperAdminSession(
            {
              uid: fbAuth.uid,
              email: fbAuth.email,
              fullName: String(profile.fullName || 'David Eromosele'),
              phone: String(profile.phone || '+234 800 000 0001'),
              password: cleanPassword,
            },
            ip,
            userAgent
          );
          result = serverAuthManager.authenticateCredentials(cleanIdentifier, cleanPassword, ip);
        } else if (rawRole !== 'LIFETIME_SUPER_ADMIN' && rawRole !== 'SUPER_ADMIN') {
          const safeRole = rawRole === 'ADMIN' ? 'ADMIN' : 'STAFF';
          const isSuspended = profile.active === false || profile.status === 'suspended';
          serverAuthManager.syncProvisionedAccount({
            id: fbAuth.uid,
            email: fbAuth.email,
            fullName: String(profile.fullName || fbAuth.email.split('@')[0]),
            phone: String(profile.phone || ''),
            role: safeRole,
            roleTitle: String(profile.roleTitle || profile.duty || (safeRole === 'ADMIN' ? 'Executive Administrator' : 'Operations Officer')),
            duty: String(profile.duty || profile.roleTitle || ''),
            staffCode: profile.staffCode ? String(profile.staffCode) : undefined,
            password: cleanPassword,
            status: isSuspended ? 'suspended' : 'active',
          });
          result = serverAuthManager.authenticateCredentials(cleanIdentifier, cleanPassword, ip);
        }
      }
    } catch (coldStartErr) {
      console.warn('[LOGIN COLD-START VERIFY] Fallback warning:', coldStartErr);
    }
  }

  if (!result.success || !result.account) {
    const correlationId = generateCorrelationId(req);
    const isSuspended =
      result.error?.includes('deactivated') ||
      result.error?.includes('suspended') ||
      result.error?.includes('inactive');
    const isForbidden =
      result.error?.includes('Role not allowed') ||
      result.error?.includes('clearance');
    const statusCode = isSuspended || isForbidden ? 403 : 401;
    const errorStr = result.error || 'Invalid credentials or access unauthorised.';
    logStructuredServerError({
      correlationId,
      endpoint: '/api/auth/login',
      operation: 'AUTH_LOGIN',
      errorCategory: statusCode === 403 ? 'PERMISSION_DENIED' : 'AUTH_ERROR',
      firebaseErrorCode: statusCode === 403 ? 'auth/user-disabled' : 'auth/invalid-credential',
      statusCode,
      message: errorStr,
    });
    return res.status(statusCode).json({
      success: false,
      message: errorStr,
      error: errorStr,
      correlationId,
      lockoutSeconds: result.lockoutSeconds,
    });
  }

  const account = result.account;

  if (account.isLifetimeSuperAdmin || account.role === 'LIFETIME_SUPER_ADMIN') {
    syncSuperAdminFirebaseAuthCredentials(
      account.id,
      account.email,
      cleanPassword,
      account.fullName
    ).catch(() => {});
  }

  // 1. Mandatory Multi-Factor Authentication check (Disabled for Super Admin)
  if (account.mfaRequired && account.totpSecret) {
    const challenge = serverAuthManager.initiateMfaChallenge(account);
    return res.status(200).json({
      success: true,
      requireMfa: true,
      mfaRequired: true,
      tempToken: challenge.tempToken,
      challengeToken: challenge.tempToken,
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

  // 2. Direct Session Issuance (Non-MFA Staff & Admins)
  const session = serverAuthManager.createSession(account, ip, userAgent, false);
  setSessionCookie(res, session.token);

  const redirectRoute = getDedicatedRouteForUser({
    role: session.role,
    roleTitle: session.roleTitle,
    duty: account.duty || session.roleTitle,
    position: session.position || account.position || account.duty || session.roleTitle,
    dashboardRoute: session.dashboardRoute || account.dashboardRoute,
    isLifetimeSuperAdmin: session.isLifetimeSuperAdmin,
  });

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
      duty: account.duty || session.position || session.roleTitle,
      position: session.position || account.position || account.duty || session.roleTitle,
      dashboardRoute: redirectRoute,
      assignedProgramme: session.assignedProgramme || account.assignedProgramme,
      permissions: account.permissions,
      isLifetimeSuperAdmin: session.isLifetimeSuperAdmin,
      status: 'active',
      active: true,
    },
  });
}));

/**
 * POST /api/auth/mfa/setup
 * Initiates RFC 6238 TOTP secret and single-use recovery codes for the authenticated account.
 */
app.post('/api/auth/mfa/setup', apiHandler(async (req: Request, res: Response) => {
  const session = await authenticateRequest(req);
  if (!session) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required to configure MFA.',
      message: 'Authentication required to configure MFA.',
    });
  }

  const callerFbToken = extractCallerFirebaseToken(req);
  await ensureAccountHydratedFromFirestore(session.userId, callerFbToken, true);

  const result = serverAuthManager.setupAccountMfa(session.userId);
  if (!result.success) {
    return res.status(400).json({
      success: false,
      error: result.error || 'Failed to initialize MFA setup.',
      message: result.error || 'Failed to initialize MFA setup.',
    });
  }

  const acc = serverAuthManager.findAccountByIdentifier(session.userId);
  const authStorageFields = serverAuthManager.getAccountAuthStorageFields(session.userId) || {};
  if (acc) {
    await withServerTimeout(
      writeFirestoreUserProfile({
        uid: acc.id,
        email: acc.email,
        fullName: acc.fullName,
        phone: acc.phone,
        role: acc.role === 'LIFETIME_SUPER_ADMIN' ? 'LIFETIME_SUPER_ADMIN' : acc.role === 'ADMIN' ? 'ADMIN' : 'STAFF',
        roleTitle: acc.roleTitle,
        duty: acc.duty || acc.roleTitle,
        status: acc.status === 'active' ? 'active' : 'suspended',
        createdBy: acc.createdBy || session.userId,
        createdAt: acc.createdAt || new Date().toISOString(),
        staffCode: acc.staffCode,
        permissions: acc.permissions as unknown as Record<string, boolean>,
        ...authStorageFields,
        callerIdToken: callerFbToken,
      }),
      2500
    ).catch(() => {});
  }

  return res.status(200).json({
    success: true,
    secret: result.secret,
    uri: result.uri,
    recoveryCodes: result.recoveryCodes,
  });
}));

/**
 * POST /api/auth/mfa/confirm
 * Confirms TOTP enrollment with a valid 6-digit code and activates MFA on the account.
 */
app.post('/api/auth/mfa/confirm', apiHandler(async (req: Request, res: Response) => {
  const session = await authenticateRequest(req);
  if (!session) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required to confirm MFA.',
      message: 'Authentication required to confirm MFA.',
    });
  }

  const callerFbToken = extractCallerFirebaseToken(req);
  await ensureAccountHydratedFromFirestore(session.userId, callerFbToken, true);

  const { code } = req.body || {};
  const result = serverAuthManager.confirmAccountMfa(session.userId, String(code || ''));
  if (!result.success) {
    return res.status(400).json({
      success: false,
      error: result.error || 'Failed to confirm MFA code.',
      message: result.error || 'Failed to confirm MFA code.',
    });
  }

  const acc = serverAuthManager.findAccountByIdentifier(session.userId);
  const authStorageFields = serverAuthManager.getAccountAuthStorageFields(session.userId) || {};
  if (acc) {
    await withServerTimeout(
      writeFirestoreUserProfile({
        uid: acc.id,
        email: acc.email,
        fullName: acc.fullName,
        phone: acc.phone,
        role: acc.role === 'LIFETIME_SUPER_ADMIN' ? 'LIFETIME_SUPER_ADMIN' : acc.role === 'ADMIN' ? 'ADMIN' : 'STAFF',
        roleTitle: acc.roleTitle,
        duty: acc.duty || acc.roleTitle,
        status: acc.status === 'active' ? 'active' : 'suspended',
        createdBy: acc.createdBy || session.userId,
        createdAt: acc.createdAt || new Date().toISOString(),
        staffCode: acc.staffCode,
        permissions: acc.permissions as unknown as Record<string, boolean>,
        ...authStorageFields,
        callerIdToken: callerFbToken,
      }),
      2500
    ).catch(() => {});
  }

  return res.status(200).json({
    success: true,
    message: 'Multi-factor authentication has been verified and enabled.',
  });
}));

/**
 * POST /api/auth/verify-mfa
 * Validates real RFC 6238 TOTP code or single-use recovery code on the server.
 * Includes replay protection and session fixation defense.
 */
app.post('/api/auth/verify-mfa', apiHandler(async (req: Request, res: Response) => {
  const { tempToken, challengeToken, code } = req.body || {};
  const resolvedTempToken = tempToken || challengeToken;
  const ip = getClientIp(req);
  const userAgent = (req.headers['user-agent'] as string) || 'unknown';
  const correlationId = generateCorrelationId(req);

  if (!resolvedTempToken || !code) {
    logStructuredServerError({
      correlationId,
      endpoint: '/api/auth/verify-mfa',
      operation: 'VERIFY_MFA',
      errorCategory: 'VALIDATION_ERROR',
      firebaseErrorCode: 'auth/missing-mfa-code',
      statusCode: 400,
      message: 'Missing MFA challenge token or verification code.',
    });
    return res.status(400).json({
      success: false,
      error: 'Please provide both the MFA challenge token and your authenticator code.',
      message: 'Please provide both the MFA challenge token and your authenticator code.',
      correlationId,
    });
  }

  const challengeUser = serverAuthManager.extractMfaChallengeUser(resolvedTempToken);
  if (challengeUser?.userId) {
    await ensureAccountHydratedFromFirestore(challengeUser.userId, undefined, true);
  }

  const result = serverAuthManager.verifyMfaCode(resolvedTempToken, code, ip, userAgent);

  if (!result.success || !result.session) {
    const errMsg = result.error || 'MFA verification failed.';
    logStructuredServerError({
      correlationId,
      endpoint: '/api/auth/verify-mfa',
      operation: 'VERIFY_MFA',
      errorCategory: 'AUTH_ERROR',
      firebaseErrorCode: 'auth/invalid-mfa-code',
      statusCode: 401,
      message: errMsg,
    });
    return res.status(401).json({
      success: false,
      error: errMsg,
      message: errMsg,
      correlationId,
    });
  }

  const session = result.session;
  setSessionCookie(res, session.token);
  const acc = serverAuthManager.findAccountByIdentifier(session.userId);
  const redirectRoute = getDedicatedRouteForUser({
    role: session.role,
    roleTitle: session.roleTitle,
    duty: acc?.duty || session.position || session.roleTitle,
    position: session.position || acc?.position || acc?.duty || session.roleTitle,
    dashboardRoute: session.dashboardRoute || acc?.dashboardRoute,
    isLifetimeSuperAdmin: session.isLifetimeSuperAdmin,
  });

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
      duty: acc?.duty || session.position || session.roleTitle,
      position: session.position || acc?.position || acc?.duty || session.roleTitle,
      dashboardRoute: redirectRoute,
      assignedProgramme: session.assignedProgramme || acc?.assignedProgramme,
      permissions: acc?.permissions || session.permissions,
      isLifetimeSuperAdmin: session.isLifetimeSuperAdmin,
      mfaVerified: true,
      status: 'active',
      active: true,
    },
  });
}));

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

  const acc = serverAuthManager.findAccountByIdentifier(session.userId) || serverAuthManager.findAccountByIdentifier(session.email);
  const redirectRoute = getDedicatedRouteForUser({
    role: session.role,
    roleTitle: session.roleTitle,
    duty: acc?.duty || session.position || session.roleTitle,
    position: session.position || acc?.position || acc?.duty || session.roleTitle,
    dashboardRoute: session.dashboardRoute || acc?.dashboardRoute,
    isLifetimeSuperAdmin: session.isLifetimeSuperAdmin,
  });

  return res.status(200).json({
    authenticated: true,
    sessionToken: session.token,
    expiresAt: session.expiresAt,
    redirectRoute,
    user: {
      id: session.userId,
      email: session.email,
      fullName: session.fullName,
      role: session.role,
      roleTitle: session.roleTitle,
      duty: acc?.duty || session.position || session.roleTitle,
      position: session.position || acc?.position || acc?.duty || session.roleTitle,
      dashboardRoute: redirectRoute,
      assignedProgramme: session.assignedProgramme || acc?.assignedProgramme,
      permissions: acc?.permissions || session.permissions,
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
  const acc = serverAuthManager.findAccountByIdentifier(session.userId) || serverAuthManager.findAccountByIdentifier(session.email);
  const dedicatedRoute = getDedicatedRouteForUser({
    role: session.role,
    roleTitle: session.roleTitle,
    duty: acc?.duty || session.position || session.roleTitle,
    position: session.position || acc?.position || acc?.duty || session.roleTitle,
    dashboardRoute: session.dashboardRoute || acc?.dashboardRoute,
    isLifetimeSuperAdmin: session.isLifetimeSuperAdmin,
  });

  if (!check.allowed) {
    return res.status(check.statusCode).json({
      allowed: false,
      statusCode: check.statusCode,
      reason: check.reason,
      targetRoute: check.targetRoute || dedicatedRoute,
      redirect: check.statusCode === 401 ? '/staff/login' : check.targetRoute || dedicatedRoute,
    });
  }

  return res.status(200).json({
    allowed: true,
    statusCode: 200,
    targetRoute: check.targetRoute || dedicatedRoute,
    user: {
      id: session.userId,
      email: session.email,
      fullName: session.fullName,
      role: session.role,
      roleTitle: session.roleTitle,
      duty: acc?.duty || session.position || session.roleTitle,
      position: session.position || acc?.position || acc?.duty || session.roleTitle,
      dashboardRoute: dedicatedRoute,
      assignedProgramme: session.assignedProgramme || acc?.assignedProgramme,
      permissions: acc?.permissions || session.permissions,
      isLifetimeSuperAdmin: session.isLifetimeSuperAdmin,
      mfaVerified: session.mfaVerified,
    },
  });
}));

/**
 * POST /api/auth/logout
 * Explicitly terminates and invalidates the session token on the server.
 */
app.post('/api/auth/logout', apiHandler(async (req: Request, res: Response) => {
  const token = extractSessionToken(req);
  if (token) {
    serverAuthManager.invalidateSession(token);
    const tokenHash = serverAuthManager.getSessionTokenHash(token);
    await withServerTimeout(revokeFirestoreSessionByHash(tokenHash), 1500).catch(() => {});
  }
  clearSessionCookie(res);
  return res.status(200).json({
    success: true,
    message: 'Session successfully revoked on the authentication gateway.',
  });
}));

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
 * Shared handler for creating Staff accounts (used by /api/auth/create-staff and /api/super-admin/create-staff)
 */
const handleCreateStaffAccount = apiHandler(async (req: Request, res: Response) => {
  const correlationId = generateCorrelationId(req);
  const endpoint = req.originalUrl || req.path || '/api/auth/create-staff';
  const session = await authenticateRequest(req);
  if (!session) {
    const msg = 'Authentication required. Please sign in with Lifetime Super Admin credentials.';
    logStructuredServerError({
      correlationId,
      endpoint,
      operation: 'CREATE_STAFF_AUTH_CHECK',
      errorCategory: 'AUTHENTICATION_REQUIRED',
      firebaseErrorCode: 'auth/unauthenticated',
      statusCode: 401,
      message: msg,
    });
    return res.status(401).json({
      success: false,
      error: {
        code: 'AUTHENTICATION_REQUIRED',
        message: msg,
        correlationId,
      },
      message: msg,
      correlationId,
      statusCode: 401,
    });
  }

  const actorAcc = serverAuthManager.findAccountByIdentifier(session.userId);
  const isSuperAdmin = session.role === 'LIFETIME_SUPER_ADMIN' && session.isLifetimeSuperAdmin;
  const isAuthorizedAdmin =
    session.role === 'ADMIN' &&
    !serverAuthManager.isAuditorSession(session) &&
    actorAcc?.permissions?.canManageStaff !== false &&
    session.permissions?.canManageStaff !== false;

  if (!isSuperAdmin && !isAuthorizedAdmin) {
    const msg = serverAuthManager.isAuditorSession(session)
      ? 'Read-Only Restriction: Auditors are strictly prohibited from creating or modifying staff accounts.'
      : 'Insufficient privileges: Only the Lifetime Super Admin or an authorized Operations Manager / Admin can create staff accounts.';
    logStructuredServerError({
      correlationId,
      endpoint,
      operation: 'CREATE_STAFF_ROLE_CHECK',
      errorCategory: 'INSUFFICIENT_PRIVILEGES',
      firebaseErrorCode: 'auth/insufficient-permission',
      statusCode: 403,
      message: `Role ${session.role} (${session.position || session.roleTitle}) is forbidden from creating staff accounts.`,
    });
    return res.status(403).json({
      success: false,
      error: {
        code: 'INSUFFICIENT_PRIVILEGES',
        message: msg,
        correlationId,
      },
      message: msg,
      correlationId,
      statusCode: 403,
    });
  }

  const body = req.body || {};
  const cleanEmail = String(body.email || '').trim().toLowerCase();
  const cleanName = String(body.fullName || '').trim();
  const cleanPhone = String(body.phone || '').trim();
  const cleanAccessCode = String(body.accessCode || '').trim();
  const cleanInitialPassword = String(body.password || body.initialPassword || '').trim();
  const secretCredential = cleanInitialPassword || cleanAccessCode;
  const rawPosition = String(body.position || body.duty || body.roleTitle || body.operationalResponsibility || 'Customer Registration Officer').trim();
  const canonicalPos = normalizeCanonicalPosition(rawPosition, 'STAFF');
  const duty = canonicalPos || rawPosition;
  const assignedProgramme = String(body.assignedProgramme || 'General Operations & Multi-Programme').trim();
  const requestedStatus: 'active' | 'suspended' = body.status === 'suspended' ? 'suspended' : 'active';
  const requestedRole = String(body.role || 'STAFF').trim().toUpperCase();

  if (requestedRole === 'SUPER_ADMIN' || requestedRole === 'LIFETIME_SUPER_ADMIN') {
    const msg = 'Security Invariant: Creation of a second Lifetime Super Admin is strictly prohibited.';
    logStructuredServerError({
      correlationId,
      endpoint,
      operation: 'CREATE_STAFF_ROLE_VALIDATION',
      errorCategory: 'VALIDATION_ERROR',
      statusCode: 400,
      message: msg,
    });
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_ROLE',
        message: msg,
        correlationId,
      },
      message: msg,
      correlationId,
      statusCode: 400,
    });
  }

  if (requestedRole === 'ADMIN' && !isSuperAdmin) {
    const msg = 'Clearance Violation: Only the Lifetime Super Admin can create Administrator accounts.';
    return res.status(403).json({
      success: false,
      error: {
        code: 'INSUFFICIENT_PRIVILEGES',
        message: msg,
        correlationId,
      },
      message: msg,
      correlationId,
      statusCode: 403,
    });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!cleanName || !cleanEmail || !emailRegex.test(cleanEmail) || !cleanPhone) {
    const msg = 'Full Legal Name, valid Official Email Address, and Phone Number are required to create a staff account.';
    logStructuredServerError({
      correlationId,
      endpoint,
      operation: 'CREATE_STAFF_INPUT_VALIDATION',
      errorCategory: 'VALIDATION_ERROR',
      statusCode: 400,
      message: msg,
    });
    return res.status(400).json({
      success: false,
      error: {
        code: 'MISSING_OR_INVALID_FIELDS',
        message: msg,
        correlationId,
      },
      message: msg,
      correlationId,
      statusCode: 400,
    });
  }

  if (!serverAuthManager.isValidOperationalDuty(duty, 'STAFF')) {
    const msg = `Invalid staff position "${duty}". Please select Customer Registration Officer, Payment Collection Officer, Loan Officer, or Accounts Officer.`;
    logStructuredServerError({
      correlationId,
      endpoint,
      operation: 'CREATE_STAFF_DUTY_VALIDATION',
      errorCategory: 'VALIDATION_ERROR',
      statusCode: 400,
      message: msg,
    });
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_OPERATIONAL_DUTY',
        message: msg,
        correlationId,
      },
      message: msg,
      correlationId,
      statusCode: 400,
    });
  }

  if (!cleanAccessCode || cleanAccessCode.length < 6 || !secretCredential || secretCredential.length < 6) {
    const msg = 'An access code (and optional initial password) of at least 6 characters is required.';
    logStructuredServerError({
      correlationId,
      endpoint,
      operation: 'CREATE_STAFF_CREDENTIAL_VALIDATION',
      errorCategory: 'VALIDATION_ERROR',
      statusCode: 400,
      message: msg,
    });
    return res.status(400).json({
      success: false,
      error: {
        code: 'WEAK_OR_MISSING_ACCESS_CODE',
        message: msg,
        correlationId,
      },
      message: msg,
      correlationId,
      statusCode: 400,
    });
  }

  // Hydrate invitations from Firestore so access codes generated on another serverless instance are recognized
  const callerFbToken = extractCallerFirebaseToken(req);
  await hydrateInvitationsFromFirestore(callerFbToken);

  // Check if duplicate active account already exists in server memory
  const existingLocal = serverAuthManager.findAccountByIdentifier(cleanEmail);
  if (existingLocal && existingLocal.status === 'active') {
    const msg = `An account with email address "${cleanEmail}" already exists.`;
    logStructuredServerError({
      correlationId,
      endpoint,
      operation: 'CREATE_STAFF_DUPLICATE_CHECK',
      errorCategory: 'DUPLICATE_EMAIL',
      firebaseErrorCode: 'auth/email-already-exists',
      statusCode: 409,
      message: msg,
    });
    return res.status(409).json({
      success: false,
      error: {
        code: 'EMAIL_ALREADY_EXISTS',
        message: msg,
        correlationId,
      },
      message: msg,
      correlationId,
      statusCode: 409,
    });
  }

  // 1. Provision account in Firebase Authentication on the server (never replaces Super Admin browser session)
  const fbProvision = await provisionFirebaseAuthAccount({
    email: cleanEmail,
    password: secretCredential,
    displayName: cleanName,
  });

  if (!fbProvision.success) {
    const status = fbProvision.isDuplicate ? 409 : fbProvision.statusCode || 400;
    const msg = fbProvision.errorMessage || 'Failed to create Firebase Authentication account.';
    const code = fbProvision.errorCode || (fbProvision.isDuplicate ? 'EMAIL_ALREADY_EXISTS' : 'FIREBASE_AUTH_ERROR');
    logStructuredServerError({
      correlationId,
      endpoint,
      operation: 'CREATE_STAFF_FIREBASE_AUTH',
      errorCategory: fbProvision.isDuplicate ? 'DUPLICATE_EMAIL' : 'FIREBASE_AUTH_ERROR',
      firebaseErrorCode: code,
      statusCode: status,
      message: msg,
    });
    return res.status(status).json({
      success: false,
      error: {
        code,
        message: msg,
        correlationId,
      },
      message: msg,
      correlationId,
      statusCode: status,
    });
  }

  // 2. Create authoritative server account record linked to Firebase UID
  const result = serverAuthManager.createStaffAccount(session, {
    ...body,
    role: 'STAFF',
    duty,
    roleTitle: duty,
    position: duty,
    assignedProgramme,
    status: requestedStatus,
    firebaseUid: fbProvision.uid,
  });

  if (!result.success || !result.account) {
    // Rollback newly created Firebase Auth user if server validation failed
    if (fbProvision.newlyCreated && fbProvision.uid) {
      await rollbackFirebaseAuthAccount(fbProvision.uid, fbProvision.idToken);
    }
    const status =
      result.statusCode ||
      (result.isDuplicate ? 409 : result.error?.includes('Privilege') || result.error?.includes('Security Invariant') ? 403 : 400);
    const msg = result.message || result.error || 'Failed to create staff account.';
    const code = status === 409 ? 'EMAIL_ALREADY_EXISTS' : status === 403 ? 'INSUFFICIENT_PRIVILEGES' : 'VALIDATION_ERROR';
    logStructuredServerError({
      correlationId,
      endpoint,
      operation: 'CREATE_STAFF_SERVER_RECORD',
      errorCategory: status === 409 ? 'DUPLICATE_EMAIL' : status === 403 ? 'INSUFFICIENT_PRIVILEGES' : 'VALIDATION_ERROR',
      statusCode: status,
      message: msg,
    });
    return res.status(status).json({
      success: false,
      error: {
        code,
        message: msg,
        correlationId,
      },
      message: msg,
      correlationId,
      statusCode: status,
    });
  }

  // 3. Synchronize Staff profile to Cloud Firestore (/users/{uid} and /staff/{uid})
  const acct = result.account;
  const simulateFirestoreFailure = req.headers['x-test-simulate-firestore-failure'] === 'true';
  const accessCodeSaltedHash = serverAuthManager.getAccountAccessCodeSaltedHash(acct.id);
  const authStorageFields = serverAuthManager.getAccountAuthStorageFields(acct.id) || {};

  if (acct.status === 'suspended') {
    await setFirebaseAuthUserDisabled(acct.id, true).catch(() => {});
  }

  const firestoreResult = await withServerTimeout(
    writeFirestoreUserProfile({
      uid: acct.id,
      email: acct.email,
      fullName: acct.fullName,
      phone: acct.phone,
      role: 'STAFF',
      roleTitle: acct.roleTitle,
      duty: acct.duty || acct.roleTitle,
      position: acct.position || acct.duty || acct.roleTitle,
      dashboardRoute: acct.dashboardRoute,
      assignedProgramme: acct.assignedProgramme,
      status: acct.status === 'suspended' ? 'suspended' : 'active',
      createdBy: session.userId,
      createdAt: acct.createdAt || new Date().toISOString(),
      accessCodeHash: accessCodeSaltedHash,
      staffCode: acct.staffCode,
      permissions: acct.permissions as unknown as Record<string, boolean>,
      ...authStorageFields,
      callerIdToken: callerFbToken,
      simulateFailure: simulateFirestoreFailure,
    }),
    3500
  ).catch((err) => ({
    success: false,
    errorCode: 'firestore/timeout',
    errorMessage: err?.message || 'Firestore profile write timed out',
  }));

  if (!firestoreResult.success) {
    // Rollback both the Firebase Auth user and the in-memory/disk server account record
    const rollbackOutcome = await rollbackFirebaseAuthAccount(acct.id, fbProvision.idToken);
    serverAuthManager.removeAccountOnRollback(acct.id, cleanEmail);

    const msg = 'Failed to create staff profile in Firestore. The authentication account has been rolled back.';
    logStructuredServerError({
      correlationId,
      endpoint,
      operation: 'CREATE_STAFF_FIRESTORE_PROFILE_ROLLBACK',
      errorCategory: 'FIRESTORE_ERROR',
      firebaseErrorCode: (firestoreResult as any).errorCode || 'firestore/write-failed',
      statusCode: 500,
      message: `${msg} (${firestoreResult.errorMessage || 'write failed'}, rolledBack=${rollbackOutcome.rolledBack})`,
    });

    return res.status(500).json({
      success: false,
      error: {
        code: 'FIRESTORE_PROFILE_WRITE_FAILED',
        message: msg,
        correlationId,
      },
      message: msg,
      correlationId,
      rolledBack: rollbackOutcome.rolledBack,
      rolledBackAuthUid: acct.id,
      statusCode: 500,
    });
  }

  return res.status(201).json({
    success: true,
    correlationId,
    message: 'Staff account created successfully.',
    data: {
      account: result.account,
      invitation: result.invitation,
    },
    account: result.account,
    invitation: result.invitation,
  });
});

app.post('/api/auth/create-staff', handleCreateStaffAccount);
app.post('/api/super-admin/create-staff', handleCreateStaffAccount);

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

  if (result.invitation) {
    await withServerTimeout(saveFirestoreInvitation(result.invitation as any), 2000).catch(() => {});
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
 * Helper to extract caller Firebase ID token if present on request headers
 */
function extractCallerFirebaseToken(req: Request): string | undefined {
  if (typeof req.headers['x-firebase-token'] === 'string' && req.headers['x-firebase-token'].trim()) {
    return req.headers['x-firebase-token'].trim();
  }
  if (
    req.headers.authorization?.startsWith('Bearer ') &&
    req.headers.authorization.split('.').length === 3
  ) {
    return req.headers.authorization.substring(7).trim();
  }
  return undefined;
}

/**
 * Hydrate access code invitations from Firestore into serverAuthManager so codes generated
 * on one serverless instance can be verified, redeemed, or used on any other instance.
 */
async function hydrateInvitationsFromFirestore(callerFbToken?: string): Promise<void> {
  try {
    const docs = await withServerTimeout(listFirestoreInvitations(callerFbToken), 1800);
    for (const doc of docs) {
      serverAuthManager.upsertInvitationFromFirestore(doc);
    }
  } catch {
    // Non-fatal if Firestore invitation fetch times out
  }
}

/**
 * Hydrate an Admin or Staff account from Firestore into serverAuthManager if a stateless
 * Vercel serverless instance cold-started or if forceRefresh is requested.
 */
async function ensureAccountHydratedFromFirestore(
  targetUserId: string,
  callerFbToken?: string,
  forceRefresh = false
): Promise<void> {
  if (!targetUserId) return;
  if (!forceRefresh && serverAuthManager.findAccountByIdentifier(targetUserId)) return;

  try {
    const [userDoc, adminDoc, staffDoc] = await withServerTimeout(
      Promise.all([
        readFirestoreDocument('users', targetUserId, callerFbToken),
        readFirestoreDocument('admins', targetUserId, callerFbToken),
        readFirestoreDocument('staff', targetUserId, callerFbToken),
      ]),
      2500
    );
    const merged = { ...(userDoc || {}), ...(staffDoc || {}), ...(adminDoc || {}) };
    if (merged && merged.email) {
      const uid = String(merged.uid || merged.id || targetUserId);
      const isRootOwner = serverAuthManager.isVerifiedOwner(uid, String(merged.email));
      const role = isRootOwner
        ? 'LIFETIME_SUPER_ADMIN'
        : adminDoc || merged.role === 'ADMIN'
        ? 'ADMIN'
        : 'STAFF';
      const resolvedPos = String(
        merged.position ||
          merged.duty ||
          merged.roleTitle ||
          (role === 'ADMIN' ? 'Account Manager' : 'Customer Registration Officer')
      );
      serverAuthManager.syncProvisionedAccount({
        id: uid,
        email: String(merged.email),
        fullName: String(merged.fullName || merged.email),
        phone: String(merged.phone || '+234 800 000 0000'),
        role,
        roleTitle: resolvedPos,
        duty: resolvedPos,
        position: resolvedPos,
        dashboardRoute: merged.dashboardRoute ? String(merged.dashboardRoute) : undefined,
        staffCode: merged.staffCode ? String(merged.staffCode) : undefined,
        status: merged.active === false || merged.status === 'suspended' ? 'suspended' : 'active',
        passwordHash: merged.passwordHash ? String(merged.passwordHash) : undefined,
        passwordSalt: merged.passwordSalt ? String(merged.passwordSalt) : undefined,
        accessCodeHash: merged.accessCodeHash ? String(merged.accessCodeHash) : undefined,
        accessCodeSalt: merged.accessCodeSalt ? String(merged.accessCodeSalt) : undefined,
        accessCodeMasked: merged.accessCodeMasked ? String(merged.accessCodeMasked) : undefined,
        mfaRequired: typeof merged.mfaRequired === 'boolean' ? merged.mfaRequired : undefined,
        totpSecret: merged.totpSecret ? String(merged.totpSecret) : undefined,
        recoveryCodeHashes: Array.isArray(merged.recoveryCodeHashes) ? merged.recoveryCodeHashes : undefined,
        consumedTotpSteps: Array.isArray(merged.consumedTotpSteps) ? merged.consumedTotpSteps : undefined,
        securityVersion: typeof merged.securityVersion === 'number' ? merged.securityVersion : undefined,
        permissions: merged.permissions && typeof merged.permissions === 'object' ? merged.permissions : undefined,
        fromFirestore: true,
      });
    }
  } catch {
    // Non-fatal if Firestore lookup times out
  }
}

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
  const callerFbToken = extractCallerFirebaseToken(req);
  if (targetUserId) {
    await ensureAccountHydratedFromFirestore(String(targetUserId), callerFbToken);
  }

  const result = serverAuthManager.updateUserPermissions(session, targetUserId, permissions);

  if (!result.success) {
    return res.status(403).json({
      success: false,
      message: result.error || 'Failed to update permissions.',
      error: result.error,
    });
  }

  const updatedAcc = serverAuthManager.findAccountByIdentifier(String(targetUserId));
  if (updatedAcc && (updatedAcc.role === 'ADMIN' || updatedAcc.role === 'STAFF')) {
    await withServerTimeout(
      writeFirestoreUserProfile({
        uid: updatedAcc.id,
        email: updatedAcc.email,
        fullName: updatedAcc.fullName,
        phone: updatedAcc.phone,
        role: updatedAcc.role === 'ADMIN' ? 'ADMIN' : 'STAFF',
        roleTitle: updatedAcc.roleTitle,
        duty: updatedAcc.duty || updatedAcc.roleTitle,
        status: updatedAcc.status === 'active' ? 'active' : 'suspended',
        createdBy: updatedAcc.createdBy || session.email,
        createdAt: updatedAcc.createdAt || new Date().toISOString(),
        staffCode: updatedAcc.staffCode,
        permissions: updatedAcc.permissions as unknown as Record<string, boolean>,
        callerIdToken: callerFbToken,
      }),
      2500
    ).catch(() => {});
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
 * Shared handler for appointing Administrators (used by /api/auth/access/appoint-admin and /api/super-admin/create-admin)
 * Exclusive privilege: Lifetime Super Admin appoints an Administrator.
 */
const handleAppointAdminAccount = apiHandler(async (req: Request, res: Response) => {
  const correlationId = generateCorrelationId(req);
  const endpoint = req.originalUrl || req.path || '/api/auth/access/appoint-admin';
  const session = await authenticateRequest(req);
  if (!session) {
    const msg = 'Authentication required. Please sign in with Lifetime Super Admin credentials.';
    logStructuredServerError({
      correlationId,
      endpoint,
      operation: 'CREATE_ADMIN_AUTH_CHECK',
      errorCategory: 'AUTHENTICATION_REQUIRED',
      firebaseErrorCode: 'auth/unauthenticated',
      statusCode: 401,
      message: msg,
    });
    return res.status(401).json({
      success: false,
      error: {
        code: 'AUTHENTICATION_REQUIRED',
        message: msg,
        correlationId,
      },
      message: msg,
      correlationId,
      statusCode: 401,
    });
  }

  if (session.role !== 'LIFETIME_SUPER_ADMIN' || !session.isLifetimeSuperAdmin) {
    const msg = 'Clearance Violation: Only the Lifetime Super Admin can appoint Administrators.';
    logStructuredServerError({
      correlationId,
      endpoint,
      operation: 'CREATE_ADMIN_ROLE_CHECK',
      errorCategory: 'INSUFFICIENT_PRIVILEGES',
      firebaseErrorCode: 'auth/insufficient-permission',
      statusCode: 403,
      message: `Role ${session.role} is forbidden from appointing Administrators.`,
    });
    return res.status(403).json({
      success: false,
      error: {
        code: 'INSUFFICIENT_PRIVILEGES',
        message: msg,
        correlationId,
      },
      message: msg,
      correlationId,
      statusCode: 403,
    });
  }

  const body = req.body || {};
  const cleanEmail = String(body.email || '').trim().toLowerCase();
  const cleanName = String(body.fullName || '').trim();
  const cleanPhone = String(body.phone || '').trim();
  const cleanAccessCode = String(body.accessCode || '').trim();
  const cleanInitialPassword = String(body.password || body.initialPassword || '').trim();
  const secretCredential = cleanInitialPassword || cleanAccessCode;
  const rawPosition = String(body.position || body.operationalResponsibility || body.duty || body.roleTitle || 'Account Manager').trim();
  const canonicalPos = normalizeCanonicalPosition(rawPosition, 'ADMIN');
  const duty = canonicalPos || rawPosition;
  const assignedProgramme = String(body.assignedProgramme || 'All Savings & Loan Programmes').trim();
  const requestedStatus: 'active' | 'suspended' = body.status === 'suspended' ? 'suspended' : 'active';

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!cleanName || !cleanEmail || !emailRegex.test(cleanEmail) || !cleanPhone) {
    const msg = 'Full Name, valid Email Address, and Phone Number are required to appoint an Administrator.';
    logStructuredServerError({
      correlationId,
      endpoint,
      operation: 'CREATE_ADMIN_INPUT_VALIDATION',
      errorCategory: 'VALIDATION_ERROR',
      statusCode: 400,
      message: msg,
    });
    return res.status(400).json({
      success: false,
      error: {
        code: 'MISSING_REQUIRED_FIELDS',
        message: msg,
        correlationId,
      },
      message: msg,
      correlationId,
      statusCode: 400,
    });
  }

  if (!serverAuthManager.isValidOperationalDuty(duty, 'ADMIN')) {
    const msg = `Invalid administrative position "${duty}". Please select Account Manager, Operations Manager, or Auditor.`;
    logStructuredServerError({
      correlationId,
      endpoint,
      operation: 'CREATE_ADMIN_DUTY_VALIDATION',
      errorCategory: 'VALIDATION_ERROR',
      statusCode: 400,
      message: msg,
    });
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_OPERATIONAL_DUTY',
        message: msg,
        correlationId,
      },
      message: msg,
      correlationId,
      statusCode: 400,
    });
  }

  if (!cleanAccessCode || cleanAccessCode.length < 6 || !secretCredential || secretCredential.length < 6) {
    const msg = 'An access code (and optional initial password) of at least 6 characters is required.';
    logStructuredServerError({
      correlationId,
      endpoint,
      operation: 'CREATE_ADMIN_CREDENTIAL_VALIDATION',
      errorCategory: 'VALIDATION_ERROR',
      statusCode: 400,
      message: msg,
    });
    return res.status(400).json({
      success: false,
      error: {
        code: 'WEAK_OR_MISSING_PASSWORD',
        message: msg,
        correlationId,
      },
      message: msg,
      correlationId,
      statusCode: 400,
    });
  }

  // Hydrate invitations from Firestore so access codes generated on another serverless instance are recognized
  const callerFbToken = extractCallerFirebaseToken(req);
  await hydrateInvitationsFromFirestore(callerFbToken);

  // Check if duplicate active account already exists in server memory
  const existingLocal = serverAuthManager.findAccountByIdentifier(cleanEmail);
  if (existingLocal && existingLocal.status === 'active') {
    const msg = `An account with email address "${cleanEmail}" already exists.`;
    logStructuredServerError({
      correlationId,
      endpoint,
      operation: 'CREATE_ADMIN_DUPLICATE_CHECK',
      errorCategory: 'DUPLICATE_EMAIL',
      firebaseErrorCode: 'auth/email-already-exists',
      statusCode: 409,
      message: msg,
    });
    return res.status(409).json({
      success: false,
      error: {
        code: 'EMAIL_ALREADY_EXISTS',
        message: msg,
        correlationId,
      },
      message: msg,
      correlationId,
      statusCode: 409,
    });
  }

  // 1. Provision account in Firebase Authentication on the server (never replaces Super Admin browser session)
  const fbProvision = await provisionFirebaseAuthAccount({
    email: cleanEmail,
    password: secretCredential,
    displayName: cleanName,
  });

  if (!fbProvision.success) {
    const status = fbProvision.isDuplicate ? 409 : fbProvision.statusCode || 400;
    const msg = fbProvision.errorMessage || 'Failed to create Firebase Authentication account.';
    const code = fbProvision.errorCode || (fbProvision.isDuplicate ? 'EMAIL_ALREADY_EXISTS' : 'FIREBASE_AUTH_ERROR');
    logStructuredServerError({
      correlationId,
      endpoint,
      operation: 'CREATE_ADMIN_FIREBASE_AUTH',
      errorCategory: fbProvision.isDuplicate ? 'DUPLICATE_EMAIL' : 'FIREBASE_AUTH_ERROR',
      firebaseErrorCode: code,
      statusCode: status,
      message: msg,
    });
    return res.status(status).json({
      success: false,
      error: {
        code,
        message: msg,
        correlationId,
      },
      message: msg,
      correlationId,
      statusCode: status,
    });
  }

  // 2. Create authoritative server account record linked to Firebase UID
  const result = serverAuthManager.appointAdministrator(session, {
    ...body,
    operationalResponsibility: duty,
    position: duty,
    duty,
    roleTitle: duty,
    assignedProgramme,
    status: requestedStatus,
    firebaseUid: fbProvision.uid,
  });

  if (!result.success || !result.account) {
    if (fbProvision.newlyCreated && fbProvision.uid) {
      await rollbackFirebaseAuthAccount(fbProvision.uid, fbProvision.idToken);
    }
    const status = result.statusCode || (result.isDuplicate ? 409 : 400);
    const msg = result.message || result.error || 'Failed to appoint administrator.';
    const code = status === 409 ? 'EMAIL_ALREADY_EXISTS' : 'VALIDATION_ERROR';
    logStructuredServerError({
      correlationId,
      endpoint,
      operation: 'CREATE_ADMIN_SERVER_RECORD',
      errorCategory: status === 409 ? 'DUPLICATE_EMAIL' : 'VALIDATION_ERROR',
      statusCode: status,
      message: msg,
    });
    return res.status(status).json({
      success: false,
      error: {
        code,
        message: msg,
        correlationId,
      },
      message: msg,
      correlationId,
      statusCode: status,
    });
  }

  // 3. Synchronize Admin profile to Cloud Firestore (/users/{uid} and /admins/{uid})
  const acct = result.account;
  const simulateFirestoreFailure = req.headers['x-test-simulate-firestore-failure'] === 'true';
  const accessCodeSaltedHash = serverAuthManager.getAccountAccessCodeSaltedHash(acct.id);
  const authStorageFields = serverAuthManager.getAccountAuthStorageFields(acct.id) || {};

  if (acct.status === 'suspended') {
    await setFirebaseAuthUserDisabled(acct.id, true).catch(() => {});
  }

  const firestoreResult = await withServerTimeout(
    writeFirestoreUserProfile({
      uid: acct.id,
      email: acct.email,
      fullName: acct.fullName,
      phone: acct.phone,
      role: 'ADMIN',
      roleTitle: acct.roleTitle,
      duty: acct.duty || acct.roleTitle,
      position: acct.position || acct.duty || acct.roleTitle,
      dashboardRoute: acct.dashboardRoute,
      assignedProgramme: acct.assignedProgramme,
      status: acct.status === 'suspended' ? 'suspended' : 'active',
      createdBy: session.userId,
      createdAt: acct.createdAt || new Date().toISOString(),
      accessCodeHash: accessCodeSaltedHash,
      staffCode: acct.staffCode,
      permissions: acct.permissions as unknown as Record<string, boolean>,
      ...authStorageFields,
      callerIdToken: callerFbToken,
      simulateFailure: simulateFirestoreFailure,
    }),
    3500
  ).catch((err) => ({
    success: false,
    errorCode: 'firestore/timeout',
    errorMessage: err?.message || 'Firestore profile write timed out',
  }));

  if (!firestoreResult.success) {
    const rollbackOutcome = await rollbackFirebaseAuthAccount(acct.id, fbProvision.idToken);
    serverAuthManager.removeAccountOnRollback(acct.id, cleanEmail);

    const msg = 'Failed to create administrator profile in Firestore. The authentication account has been rolled back.';
    logStructuredServerError({
      correlationId,
      endpoint,
      operation: 'CREATE_ADMIN_FIRESTORE_PROFILE_ROLLBACK',
      errorCategory: 'FIRESTORE_ERROR',
      firebaseErrorCode: (firestoreResult as any).errorCode || 'firestore/write-failed',
      statusCode: 500,
      message: `${msg} (${firestoreResult.errorMessage || 'write failed'}, rolledBack=${rollbackOutcome.rolledBack})`,
    });

    return res.status(500).json({
      success: false,
      error: {
        code: 'FIRESTORE_PROFILE_WRITE_FAILED',
        message: msg,
        correlationId,
      },
      message: msg,
      correlationId,
      rolledBack: rollbackOutcome.rolledBack,
      rolledBackAuthUid: acct.id,
      statusCode: 500,
    });
  }

  return res.status(201).json({
    success: true,
    correlationId,
    message: 'Admin account created successfully.',
    data: {
      account: result.account,
      invitation: result.invitation,
    },
    account: result.account,
    invitation: result.invitation,
  });
});

app.post('/api/auth/create-admin', handleAppointAdminAccount);
app.post('/api/auth/access/appoint-admin', handleAppointAdminAccount);
app.post('/api/super-admin/create-admin', handleAppointAdminAccount);

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

  await hydrateInvitationsFromFirestore(extractCallerFirebaseToken(req));
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

  await hydrateInvitationsFromFirestore(extractCallerFirebaseToken(req));
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

  await hydrateInvitationsFromFirestore(extractCallerFirebaseToken(req));
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

  await hydrateInvitationsFromFirestore(extractCallerFirebaseToken(req));
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

  const callerFbToken = extractCallerFirebaseToken(req);
  const forceRefresh =
    req.query.refresh === 'true' ||
    req.headers['x-test-simulate-cold-start'] === 'true' ||
    Date.now() - lastAccountsHydratedAt > HYDRATION_COOLDOWN_MS;

  // Hydrate any Admin/Staff profiles stored in Firestore when cold-started or TTL expired
  if (forceRefresh) {
    try {
      const [fsAdmins, fsStaff, fsUsers] = await withServerTimeout(
        Promise.all([
          listFirestoreCollection('admins', callerFbToken),
          listFirestoreCollection('staff', callerFbToken),
          listFirestoreCollection('users', callerFbToken),
        ]),
        1800
      );

      for (const adm of fsAdmins) {
        const admId = String(adm.uid || adm.id || '');
        const admEmail = String(adm.email || '');
        if (
          admEmail &&
          !serverAuthManager.isDeletedAccount(admId) &&
          !serverAuthManager.isDeletedAccount(admEmail) &&
          !serverAuthManager.findAccountByIdentifier(admEmail)
        ) {
          const pos = String(adm.position || adm.duty || adm.roleTitle || 'Account Manager');
          serverAuthManager.syncProvisionedAccount({
            id: admId,
            email: admEmail,
            fullName: String(adm.fullName || admEmail),
            phone: String(adm.phone || ''),
            role: 'ADMIN',
            roleTitle: pos,
            duty: pos,
            position: pos,
            dashboardRoute: adm.dashboardRoute ? String(adm.dashboardRoute) : undefined,
            assignedProgramme: adm.assignedProgramme ? String(adm.assignedProgramme) : undefined,
            staffCode: adm.staffCode ? String(adm.staffCode) : undefined,
            status: adm.active === false || adm.status === 'suspended' ? 'suspended' : 'active',
            fromFirestore: true,
          });
        }
      }

      for (const stf of fsStaff) {
        const stfId = String(stf.uid || stf.id || '');
        const stfEmail = String(stf.email || '');
        if (
          stfEmail &&
          !serverAuthManager.isDeletedAccount(stfId) &&
          !serverAuthManager.isDeletedAccount(stfEmail) &&
          !serverAuthManager.findAccountByIdentifier(stfEmail)
        ) {
          const pos = String(stf.position || stf.duty || stf.roleTitle || 'Customer Registration Officer');
          serverAuthManager.syncProvisionedAccount({
            id: stfId,
            email: stfEmail,
            fullName: String(stf.fullName || stfEmail),
            phone: String(stf.phone || ''),
            role: 'STAFF',
            roleTitle: pos,
            duty: pos,
            position: pos,
            dashboardRoute: stf.dashboardRoute ? String(stf.dashboardRoute) : undefined,
            assignedProgramme: stf.assignedProgramme ? String(stf.assignedProgramme) : undefined,
            staffCode: stf.staffCode ? String(stf.staffCode) : undefined,
            status: stf.active === false || stf.status === 'suspended' ? 'suspended' : 'active',
            fromFirestore: true,
          });
        }
      }

      for (const usr of fsUsers) {
        const usrId = String(usr.uid || usr.id || '');
        const usrEmail = String(usr.email || '');
        const usrRole = String(usr.role || '').toUpperCase();
        if (
          usrEmail &&
          (usrRole === 'ADMIN' || usrRole === 'STAFF') &&
          !serverAuthManager.isDeletedAccount(usrId) &&
          !serverAuthManager.isDeletedAccount(usrEmail) &&
          !serverAuthManager.findAccountByIdentifier(usrEmail)
        ) {
          const pos = String(
            usr.position ||
              usr.duty ||
              usr.roleTitle ||
              (usrRole === 'ADMIN' ? 'Account Manager' : 'Customer Registration Officer')
          );
          serverAuthManager.syncProvisionedAccount({
            id: usrId,
            email: usrEmail,
            fullName: String(usr.fullName || usrEmail),
            phone: String(usr.phone || ''),
            role: usrRole === 'ADMIN' ? 'ADMIN' : 'STAFF',
            roleTitle: pos,
            duty: pos,
            position: pos,
            dashboardRoute: usr.dashboardRoute ? String(usr.dashboardRoute) : undefined,
            assignedProgramme: usr.assignedProgramme ? String(usr.assignedProgramme) : undefined,
            staffCode: usr.staffCode ? String(usr.staffCode) : undefined,
            status: usr.active === false || usr.status === 'suspended' ? 'suspended' : 'active',
            fromFirestore: true,
          });
        }
      }
      lastAccountsHydratedAt = Date.now();
    } catch {
      // Non-fatal if Firestore list times out
    }
  }

  const accounts = serverAuthManager.getPublicAccountsList(session);
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
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
  const callerFbToken = extractCallerFirebaseToken(req);
  if (targetUserId) {
    await ensureAccountHydratedFromFirestore(String(targetUserId), callerFbToken);
  }

  const result = serverAuthManager.revokeAdminRole(session, targetUserId);
  if (!result.success) {
    return res.status(403).json({
      success: false,
      message: result.error || 'Failed to revoke administrator role.',
      error: result.error,
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
        role: 'STAFF',
        roleTitle: updatedAcc.roleTitle,
        duty: updatedAcc.duty || updatedAcc.roleTitle,
        status: updatedAcc.status === 'active' ? 'active' : 'suspended',
        createdBy: updatedAcc.createdBy || session.email,
        createdAt: updatedAcc.createdAt || new Date().toISOString(),
        staffCode: updatedAcc.staffCode,
        permissions: updatedAcc.permissions as unknown as Record<string, boolean>,
        callerIdToken: callerFbToken,
      }),
      2500
    ).catch(() => {});
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
 * Shared handler for server-verified account suspension/reactivation
 * (used by POST /api/auth/toggle-status, POST /api/super-admin/toggle-status, PATCH /api/super-admin/accounts/:id/status)
 */
const handleToggleAccountStatus = apiHandler(async (req: Request, res: Response) => {
  const session = await authenticateRequest(req);
  if (!session) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required.',
      error: 'Authentication required.',
    });
  }

  if (serverAuthManager.isAuditorSession(session)) {
    return res.status(403).json({
      success: false,
      message: 'Read-Only Restriction: Auditors are strictly prohibited from modifying account status.',
      error: 'Read-Only Restriction: Auditors cannot suspend or modify accounts.',
    });
  }

  const targetUserId = req.params?.id || req.body?.targetUserId || req.body?.userId || req.body?.id;
  const status = req.body?.status;

  if (!targetUserId || !status) {
    return res.status(400).json({
      success: false,
      message: 'targetUserId and status are required.',
      error: 'MISSING_REQUIRED_FIELDS',
    });
  }

  const callerFbToken = extractCallerFirebaseToken(req);
  await ensureAccountHydratedFromFirestore(String(targetUserId), callerFbToken);

  const result = serverAuthManager.updateAccountStatus(session, String(targetUserId), status);
  if (!result.success) {
    return res.status(403).json({
      success: false,
      message: result.error || 'Failed to update account status.',
      error: result.error,
    });
  }

  const updatedAcc = serverAuthManager.findAccountByIdentifier(String(targetUserId));
  if (updatedAcc && (updatedAcc.role === 'ADMIN' || updatedAcc.role === 'STAFF')) {
    const authStorageFields = serverAuthManager.getAccountAuthStorageFields(updatedAcc.id) || {};
    await Promise.all([
      setFirebaseAuthUserDisabled(updatedAcc.id, updatedAcc.status !== 'active').catch(() => {}),
      withServerTimeout(
        writeFirestoreUserProfile({
          uid: updatedAcc.id,
          email: updatedAcc.email,
          fullName: updatedAcc.fullName,
          phone: updatedAcc.phone,
          role: updatedAcc.role === 'ADMIN' ? 'ADMIN' : 'STAFF',
          roleTitle: updatedAcc.roleTitle,
          duty: updatedAcc.duty || updatedAcc.roleTitle,
          position: updatedAcc.position || updatedAcc.duty || updatedAcc.roleTitle,
          dashboardRoute: updatedAcc.dashboardRoute,
          assignedProgramme: updatedAcc.assignedProgramme,
          status: updatedAcc.status === 'active' ? 'active' : 'suspended',
          createdBy: updatedAcc.createdBy || session.email,
          createdAt: updatedAcc.createdAt || new Date().toISOString(),
          staffCode: updatedAcc.staffCode,
          permissions: updatedAcc.permissions as unknown as Record<string, boolean>,
          ...authStorageFields,
          callerIdToken: callerFbToken,
        }),
        2500
      ).catch(() => {}),
    ]);
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
});

app.post('/api/auth/toggle-status', handleToggleAccountStatus);
app.post('/api/super-admin/toggle-status', handleToggleAccountStatus);
app.patch('/api/super-admin/accounts/:id/status', handleToggleAccountStatus);

/**
 * Shared handler for permanently deleting an Admin or Staff account from
 * serverAuthManager, Firebase Authentication, and Firestore (`users`, `admins`, `staff`).
 */
const handleDeleteAccount = apiHandler(async (req: Request, res: Response) => {
  const session = await authenticateRequest(req);
  if (!session) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required.',
      error: 'Authentication required.',
    });
  }

  if (serverAuthManager.isAuditorSession(session)) {
    return res.status(403).json({
      success: false,
      message: 'Read-Only Restriction: Auditors are strictly prohibited from deleting accounts.',
      error: 'Read-Only Restriction: Auditors cannot delete accounts.',
    });
  }

  const targetUserId = String(
    req.params?.id || req.body?.targetUserId || req.body?.userId || req.body?.id || ''
  ).trim();
  const targetEmail = String(req.body?.email || '').trim().toLowerCase();

  if (!targetUserId && !targetEmail) {
    return res.status(400).json({
      success: false,
      message: 'targetUserId or email is required to delete an account.',
      error: 'MISSING_REQUIRED_FIELDS',
    });
  }

  const callerFbToken = extractCallerFirebaseToken(req);

  const result = serverAuthManager.deleteUserAccount(session, targetUserId || targetEmail, targetEmail);
  if (!result.success) {
    return res.status(403).json({
      success: false,
      message: result.error || 'Failed to delete account.',
      error: result.error,
    });
  }

  const effectiveUid = result.deletedId || targetUserId;
  const effectiveEmail = result.deletedEmail || targetEmail;

  await withServerTimeout(
    deleteFirebaseAccountAndFirestoreProfile(effectiveUid, effectiveEmail, callerFbToken),
    2500
  ).catch(() => {});

  return res.status(200).json(
    buildApiResponse(
      {
        message: 'Account permanently deleted from authentication and Firestore records.',
        data: result,
        ...result,
      },
      true
    )
  );
});

app.post('/api/auth/delete-account', handleDeleteAccount);
app.post('/api/super-admin/delete-account', handleDeleteAccount);
app.delete('/api/auth/accounts/:id', handleDeleteAccount);

/**
 * Shared handler for updating/editing an Admin or Staff account's profile, role, position,
 * assigned programme, status, permissions, and optional password/access code.
 */
const handleUpdateAccount = apiHandler(async (req: Request, res: Response) => {
  const session = await authenticateRequest(req);
  if (!session) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required.',
      error: 'Authentication required.',
    });
  }

  if (serverAuthManager.isAuditorSession(session)) {
    return res.status(403).json({
      success: false,
      message: 'Read-Only Restriction: Auditors are strictly prohibited from modifying accounts.',
      error: 'Read-Only Restriction: Auditors cannot modify accounts.',
    });
  }

  const targetUserId = String(
    req.params?.id || req.body?.targetUserId || req.body?.userId || req.body?.id || ''
  ).trim();

  if (!targetUserId) {
    return res.status(400).json({
      success: false,
      message: 'targetUserId is required to update an account.',
      error: 'MISSING_REQUIRED_FIELDS',
    });
  }

  const callerFbToken = extractCallerFirebaseToken(req);
  await ensureAccountHydratedFromFirestore(targetUserId, callerFbToken);

  const body = req.body || {};
  const result = serverAuthManager.updateUserAccount(session, targetUserId, {
    fullName: body.fullName,
    email: body.email,
    phone: body.phone,
    role: body.role,
    position: body.position,
    duty: body.duty,
    roleTitle: body.roleTitle,
    dashboardRoute: body.dashboardRoute,
    assignedProgramme: body.assignedProgramme,
    status: body.status,
    permissions: body.permissions,
    password: body.password || body.newPassword,
    accessCode: body.accessCode || body.newAccessCode,
  });

  if (!result.success || !result.account) {
    return res.status(400).json({
      success: false,
      message: result.error || 'Failed to update account.',
      error: result.error,
    });
  }

  const updatedAcc = result.account;
  const authStorageFields = serverAuthManager.getAccountAuthStorageFields(updatedAcc.id) || {};
  const newSecret = String(body.password || body.newPassword || body.accessCode || body.newAccessCode || '').trim();

  // If role tier changed between ADMIN and STAFF, remove the stale document in the previous role collection
  if (result.previousRole && result.previousRole !== updatedAcc.role) {
    const staleCollection = updatedAcc.role === 'ADMIN' ? 'staff' : 'admins';
    await withServerTimeout(deleteFirestoreDocument(staleCollection, updatedAcc.id, callerFbToken), 2500).catch(() => {});
  }

  await Promise.all([
    updateFirebaseAuthUserCredentials(updatedAcc.id, {
      email: updatedAcc.email,
      displayName: updatedAcc.fullName,
      ...(newSecret.length >= 6 ? { password: newSecret } : {}),
      disabled: updatedAcc.status !== 'active',
    }).catch(() => {}),
    withServerTimeout(
      writeFirestoreUserProfile({
        uid: updatedAcc.id,
        email: updatedAcc.email,
        fullName: updatedAcc.fullName,
        phone: updatedAcc.phone,
        role: updatedAcc.role === 'ADMIN' ? 'ADMIN' : 'STAFF',
        roleTitle: updatedAcc.roleTitle,
        duty: updatedAcc.duty || updatedAcc.roleTitle,
        position: updatedAcc.position || updatedAcc.duty || updatedAcc.roleTitle,
        dashboardRoute: updatedAcc.dashboardRoute,
        assignedProgramme: updatedAcc.assignedProgramme,
        status: updatedAcc.status === 'active' ? 'active' : 'suspended',
        createdBy: updatedAcc.createdBy || session.userId,
        createdAt: updatedAcc.createdAt || new Date().toISOString(),
        staffCode: updatedAcc.staffCode,
        permissions: updatedAcc.permissions as unknown as Record<string, boolean>,
        ...authStorageFields,
        callerIdToken: callerFbToken,
      }),
      3000
    ).catch(() => {}),
  ]);

  return res.status(200).json(
    buildApiResponse(
      {
        message: 'Account updated successfully.',
        data: { account: updatedAcc },
        account: updatedAcc,
      },
      true
    )
  );
});

app.post('/api/auth/update-account', handleUpdateAccount);
app.post('/api/super-admin/update-account', handleUpdateAccount);
app.put('/api/auth/accounts/:id', handleUpdateAccount);


/**
 * POST /api/financial/transfers/approve
 * Server-side financial approval checking self-approval prohibition and Auditor read-only restriction.
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

  if (serverAuthManager.isAuditorSession(session)) {
    return res.status(403).json({
      success: false,
      message: 'Read-Only Restriction: Auditors are strictly prohibited from approving financial transfers.',
      error: 'Read-Only Restriction: Auditors cannot approve financial transfers.',
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
 * Returns registered customer records exclusively to authenticated Staff, Admin, or Super Admin sessions.
 */
app.get('/api/customers', apiHandler(async (req: Request, res: Response) => {
  const session = await authenticateRequest(req);
  if (!session) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required. Unauthenticated access to customer records is prohibited.',
      error: 'Authentication required.',
    });
  }

  const account = serverAuthManager.findAccountByIdentifier(session.email);
  if (account && account.status !== 'active') {
    return res.status(403).json({
      success: false,
      message: 'Access denied: Account is suspended or inactive.',
      error: 'Account suspended.',
    });
  }
  if (
    session.role !== 'LIFETIME_SUPER_ADMIN' &&
    session.role !== 'ADMIN' &&
    account?.permissions &&
    account.permissions.canViewCustomers === false
  ) {
    return res.status(403).json({
      success: false,
      message: 'Clearance violation: Staff account does not have permission to view customer records.',
      error: 'Clearance violation.',
    });
  }

  const callerFbToken =
    typeof req.headers['x-firebase-token'] === 'string'
      ? req.headers['x-firebase-token'].trim()
      : req.headers.authorization?.startsWith('Bearer ') && req.headers.authorization.split('.').length === 3
      ? req.headers.authorization.substring(7).trim()
      : undefined;

  const forceCustomerRefresh =
    req.query.refresh === 'true' ||
    req.headers['x-test-simulate-cold-start'] === 'true' ||
    Date.now() - lastCustomersHydratedAt > HYDRATION_COOLDOWN_MS;

  if (forceCustomerRefresh) {
    try {
      const fsCustomers = await withServerTimeout(
        listFirestoreCollection('customers', callerFbToken),
        1200
      );
      for (const data of fsCustomers) {
        if (data && (data.fullName || data.phone)) {
          try {
            serverAuthManager.saveCustomerRecord(data, undefined, { fromFirestoreSync: true });
          } catch {
            // Ignore malformed records
          }
        }
      }
      lastCustomersHydratedAt = Date.now();
    } catch {
      // Non-fatal if Firestore read is unavailable or times out
    }
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
 * GET /api/customers/:customerId
 * Retrieves a single customer's complete internal profile, including Next of Kin, Guarantor,
 * original registering staff metadata, and full activity history timeline.
 */
app.get('/api/customers/:customerId', apiHandler(async (req: Request, res: Response) => {
  const session = await authenticateRequest(req);
  if (!session) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required. Unauthenticated access to customer profiles is prohibited.',
      error: 'Authentication required.',
    });
  }

  const account = serverAuthManager.findAccountByIdentifier(session.email);
  if (account && account.status !== 'active') {
    return res.status(403).json({
      success: false,
      message: 'Access denied: Account is suspended or inactive.',
      error: 'Account suspended.',
    });
  }
  if (
    session.role !== 'LIFETIME_SUPER_ADMIN' &&
    session.role !== 'ADMIN' &&
    account?.permissions &&
    account.permissions.canViewCustomers === false
  ) {
    return res.status(403).json({
      success: false,
      message: 'Clearance violation: Staff account does not have permission to view customer profiles.',
      error: 'Clearance violation.',
    });
  }

  const customerId = String(req.params.customerId || '').trim();
  const callerFbToken =
    typeof req.headers['x-firebase-token'] === 'string'
      ? req.headers['x-firebase-token'].trim()
      : req.headers.authorization?.startsWith('Bearer ') && req.headers.authorization.split('.').length === 3
      ? req.headers.authorization.substring(7).trim()
      : undefined;

  try {
    const fsDoc = await withServerTimeout(
      readFirestoreDocument('customers', customerId, callerFbToken),
      1200
    );
    if (fsDoc && (fsDoc.fullName || fsDoc.phone)) {
      serverAuthManager.saveCustomerRecord(fsDoc, undefined, { fromFirestoreSync: true });
    }
  } catch {
    // Non-fatal if Firestore read times out
  }

  const customer = serverAuthManager.findCustomerByIdentifier(customerId);
  if (!customer) {
    return res.status(404).json({
      success: false,
      message: 'Customer record not found.',
      error: 'Customer record not found.',
    });
  }

  serverAuthManager.recordAudit({
    actorId: session.userId,
    actorName: session.fullName,
    actorRole: session.role,
    action: 'VIEWED_CUSTOMER_PROFILE',
    resource: `/api/customers/${customer.id}`,
    details: `Accessed internal customer profile for ${customer.fullName} (${customer.customerCode || customer.id}).`,
    ip: session.ip,
    status: 'SUCCESS',
  });

  return res.status(200).json({
    success: true,
    message: 'Customer profile retrieved successfully.',
    data: { customer },
    customer,
  });
}));

/**
 * POST /api/customers
 * Persists a newly created or updated customer record on the backend and Firestore.
 * Automatically captures the authenticated registering employee's identity on creation
 * and permanently preserves original registration ownership on subsequent updates.
 */
const handleSaveCustomerRequest = apiHandler(async (req: Request, res: Response) => {
  const session = await authenticateRequest(req);
  if (!session) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required. Unauthenticated modification of customer records is prohibited.',
      error: 'Authentication required.',
    });
  }

  const callerFbToken =
    typeof req.headers['x-firebase-token'] === 'string'
      ? req.headers['x-firebase-token'].trim()
      : req.headers.authorization?.startsWith('Bearer ') && req.headers.authorization.split('.').length === 3
      ? req.headers.authorization.substring(7).trim()
      : undefined;

  await ensureAccountHydratedFromFirestore(session.userId, callerFbToken);

  if (serverAuthManager.isAuditorSession(session)) {
    return res.status(403).json({
      success: false,
      message: 'Read-Only Restriction: Auditors are strictly prohibited from creating or modifying customer records.',
      error: 'Read-Only Restriction: Auditors cannot create or edit customer records.',
    });
  }

  const account =
    serverAuthManager.findAccountByIdentifier(session.userId) ||
    serverAuthManager.findAccountByIdentifier(session.email);
  if (account && account.status !== 'active') {
    return res.status(403).json({
      success: false,
      message: 'Access denied: Account is suspended or inactive.',
      error: 'Account suspended.',
    });
  }

  const payload = req.body?.customer || req.body || {};
  const targetId = String(req.params?.customerId || payload.id || '').trim();
  const isExplicitUpdate =
    req.method === 'PUT' || Boolean(targetId) || Boolean(payload.isUpdate);

  // Enforce backend RBAC permissions for customer creation and modification
  const canonicalPos = normalizeCanonicalPosition(
    account?.position || account?.duty || account?.roleTitle || session.position || session.roleTitle,
    session.role
  );
  const effectivePermissions = sanitizePermissionsForPosition(
    canonicalPos || account?.position || session.position || session.roleTitle,
    account?.permissions
  );

  if (session.role !== 'LIFETIME_SUPER_ADMIN') {
    if (!isExplicitUpdate) {
      const canCreate =
        effectivePermissions.canRegisterCustomers === true ||
        effectivePermissions.canRegisterCustomer === true ||
        account?.permissions?.manage_customers === true;
      if (!canCreate) {
        return res.status(403).json({
          success: false,
          message: `Access denied: Your assigned position (${canonicalPos || session.roleTitle || session.role}) does not have permission to create customer records.`,
          error: 'Clearance violation: Missing customer creation permission.',
        });
      }
    } else {
      const canEdit =
        effectivePermissions.canEditCustomer === true ||
        effectivePermissions.canRegisterCustomers === true ||
        effectivePermissions.canRegisterCustomer === true ||
        account?.permissions?.manage_customers === true;
      if (!canEdit) {
        return res.status(403).json({
          success: false,
          message: `Access denied: Your assigned position (${canonicalPos || session.roleTitle || session.role}) does not have permission to modify customer records.`,
          error: 'Clearance violation: Missing customer edit permission.',
        });
      }
    }
  }

  if (!isExplicitUpdate && (!String(payload.fullName || '').trim() || !String(payload.phone || '').trim())) {
    return res.status(400).json({
      success: false,
      message: 'Customer full name and primary phone number are required.',
      error: 'Customer full name and primary phone number are required.',
    });
  }

  // Ensure existing customers from Firestore are hydrated before duplicate detection or updates
  const nowMs = Date.now();
  if (
    nowMs - lastCustomersHydratedAt >= HYDRATION_COOLDOWN_MS ||
    serverAuthManager.getCustomersList().length === 0
  ) {
    try {
      const fsCustomers = await withServerTimeout(
        listFirestoreCollection('customers', callerFbToken),
        2000
      );
      if (Array.isArray(fsCustomers) && fsCustomers.length > 0) {
        for (const doc of fsCustomers) {
          if (doc && (doc.fullName || doc.phone)) {
            serverAuthManager.saveCustomerRecord(doc, undefined, { fromFirestoreSync: true });
          }
        }
        lastCustomersHydratedAt = Date.now();
      }
    } catch {
      // Non-fatal if Firestore read times out
    }
  }

  // Hydrate specific target customer if updating by ID across cold starts
  if (targetId && !serverAuthManager.findCustomerByIdentifier(targetId)) {
    try {
      const fsExisting = await withServerTimeout(
        readFirestoreDocument('customers', targetId, callerFbToken),
        1500
      );
      if (fsExisting && (fsExisting.fullName || fsExisting.phone)) {
        serverAuthManager.saveCustomerRecord(fsExisting, undefined, { fromFirestoreSync: true });
      }
    } catch {
      // Ignore lookup timeout
    }
  }

  // Duplicate check: Never silently overwrite or merge existing customers on new registration
  if (!isExplicitUpdate) {
    const duplicateCheck = serverAuthManager.findDuplicateCustomer(payload);
    if (duplicateCheck.isDuplicate && duplicateCheck.existingCustomer) {
      const existingCust = duplicateCheck.existingCustomer;
      return res.status(409).json({
        success: false,
        isDuplicate: true,
        duplicateField: duplicateCheck.field,
        existingCustomer: {
          id: existingCust.id,
          customerCode: existingCust.customerCode,
          fullName: existingCust.fullName,
          phone: existingCust.phone,
        },
        message: `Duplicate customer warning: A customer with this ${duplicateCheck.field} (${duplicateCheck.matchedValue}) is already registered under ${existingCust.fullName} (Customer ID: ${existingCust.customerCode || existingCust.id}). Existing customer records cannot be overwritten.`,
        error: `Duplicate customer detected (${duplicateCheck.field}: ${duplicateCheck.matchedValue}).`,
      });
    }
  } else if (targetId) {
    const duplicateOnUpdate = serverAuthManager.findDuplicateCustomer(payload, targetId);
    if (duplicateOnUpdate.isDuplicate && duplicateOnUpdate.existingCustomer) {
      const existingCust = duplicateOnUpdate.existingCustomer;
      return res.status(409).json({
        success: false,
        isDuplicate: true,
        duplicateField: duplicateOnUpdate.field,
        existingCustomer: {
          id: existingCust.id,
          customerCode: existingCust.customerCode,
          fullName: existingCust.fullName,
          phone: existingCust.phone,
        },
        message: `Duplicate customer warning: Another customer (${existingCust.fullName}, Customer ID: ${existingCust.customerCode || existingCust.id}) already uses this ${duplicateOnUpdate.field} (${duplicateOnUpdate.matchedValue}).`,
        error: `Duplicate customer detected (${duplicateOnUpdate.field}: ${duplicateOnUpdate.matchedValue}).`,
      });
    }
  }

  const mergedPayload = targetId ? { ...payload, id: targetId } : { ...payload, id: undefined };
  const customer = serverAuthManager.saveCustomerRecord(mergedPayload, session, {
    skipAutoFirestoreWrite: true,
    forceCreateNew: !isExplicitUpdate,
  });

  // Authoritatively persist to Cloud Firestore /customers/{customer.id} and confirm write
  const savedToFirestore = await withServerTimeout(
    writeFirestoreDocument('customers', customer.id, customer, callerFbToken),
    4000
  ).catch(() => false);

  if (!savedToFirestore) {
    if (!isExplicitUpdate) {
      serverAuthManager.removeCustomerFromMemory(customer.id);
    }
    return res.status(500).json({
      success: false,
      savedToFirestore: false,
      message: 'Failed to save customer record to the TEAMACRO Firestore database. Please verify connection and try again.',
      error: 'Firestore write failed.',
    });
  }

  lastCustomersHydratedAt = Date.now();

  serverAuthManager.recordAudit({
    actorId: session.userId,
    actorName: session.fullName,
    actorRole: session.role,
    action: isExplicitUpdate ? 'UPDATED_CUSTOMER_PROFILE' : 'REGISTERED_NEW_CUSTOMER',
    resource: `/api/customers/${customer.id}`,
    details: isExplicitUpdate
      ? `Updated customer profile for ${customer.fullName} (${customer.customerCode}). Original registering officer: ${customer.registeredByName} (${customer.registeredByStaffCode}).`
      : `Registered new customer ${customer.fullName} (${customer.customerCode}) by ${customer.registeredByName} (${customer.registeredByPosition}, Staff ID: ${customer.registeredByStaffCode}).`,
    ip: session.ip,
    status: 'SUCCESS',
  });

  const customers = serverAuthManager.getCustomersList();
  return res.status(isExplicitUpdate ? 200 : 201).json({
    success: true,
    savedToFirestore: true,
    message: isExplicitUpdate
      ? 'Customer profile updated and synchronized to Firestore.'
      : 'Customer successfully registered',
    data: { customer, customers, savedToFirestore: true },
    customer,
    customers,
  });
});

app.post('/api/customers', handleSaveCustomerRequest);
app.put('/api/customers/:customerId', handleSaveCustomerRequest);

/**
 * POST /api/customers/:customerId/activity
 * Appends an authorised activity entry (account adjustment, contribution, loan activity, payment collection, or reversal)
 * to a customer's activity timeline without altering the original registering staff member.
 */
app.post('/api/customers/:customerId/activity', apiHandler(async (req: Request, res: Response) => {
  const session = await authenticateRequest(req);
  if (!session) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required.',
      error: 'Authentication required.',
    });
  }

  if (serverAuthManager.isAuditorSession(session)) {
    return res.status(403).json({
      success: false,
      message: 'Read-Only Restriction: Auditors are strictly prohibited from modifying customer activity records.',
      error: 'Read-Only Restriction: Auditors cannot record customer activities.',
    });
  }

  const customerId = String(req.params.customerId || '').trim();
  const callerFbToken =
    typeof req.headers['x-firebase-token'] === 'string'
      ? req.headers['x-firebase-token'].trim()
      : req.headers.authorization?.startsWith('Bearer ') && req.headers.authorization.split('.').length === 3
      ? req.headers.authorization.substring(7).trim()
      : undefined;

  if (!serverAuthManager.findCustomerByIdentifier(customerId)) {
    try {
      const fsDoc = await withServerTimeout(
        readFirestoreDocument('customers', customerId, callerFbToken),
        1200
      );
      if (fsDoc && (fsDoc.fullName || fsDoc.phone)) {
        serverAuthManager.saveCustomerRecord(fsDoc, undefined, { fromFirestoreSync: true });
      }
    } catch {
      // Ignore lookup timeout
    }
  }

  const { category, action, description, reference, amount } = req.body || {};
  if (!action || !description) {
    return res.status(400).json({
      success: false,
      message: 'Activity action title and description are required.',
      error: 'Activity action title and description are required.',
    });
  }

  const updated = serverAuthManager.appendCustomerActivity(customerId, session, {
    category: category || 'ACCOUNT_ADJUSTMENT',
    action: String(action).trim(),
    description: String(description).trim(),
    reference: reference ? String(reference).trim() : undefined,
    amount: typeof amount === 'number' && Number.isFinite(amount) ? amount : undefined,
  });

  if (!updated) {
    return res.status(404).json({
      success: false,
      message: 'Customer record not found.',
      error: 'Customer record not found.',
    });
  }

  await withServerTimeout(
    writeFirestoreDocument('customers', updated.id, updated, callerFbToken),
    2500
  ).catch(() => false);

  serverAuthManager.recordAudit({
    actorId: session.userId,
    actorName: session.fullName,
    actorRole: session.role,
    action: 'RECORDED_CUSTOMER_ACTIVITY',
    resource: `/api/customers/${updated.id}/activity`,
    details: `Recorded ${category || 'ACCOUNT_ADJUSTMENT'} (${action}) on customer ${updated.fullName} (${updated.customerCode}).`,
    ip: session.ip,
    status: 'SUCCESS',
  });

  return res.status(201).json({
    success: true,
    message: 'Customer activity recorded and persisted to Firestore.',
    data: { customer: updated },
    customer: updated,
  });
}));

/**
 * GET /api/operations/collections
 * Retrieves recorded savings contributions and loan repayments for authorized positions.
 */
app.get('/api/operations/collections', apiHandler(async (req: Request, res: Response) => {
  const session = await authenticateRequest(req);
  if (!session) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required.',
      error: 'Authentication required.',
    });
  }

  const collections = serverAuthManager.getCollectionsList();
  return res.status(200).json({
    success: true,
    message: 'Collection transactions retrieved successfully.',
    data: { collections },
    collections,
  });
}));

/**
 * POST /api/operations/collections
 * Records a savings contribution or loan repayment with duplicate reference & submission prevention.
 */
app.post('/api/operations/collections', apiHandler(async (req: Request, res: Response) => {
  const session = await authenticateRequest(req);
  if (!session) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required.',
      error: 'Authentication required.',
    });
  }

  const result = serverAuthManager.recordCollectionTransaction(session, req.body || {});
  if (!result.success) {
    return res.status(result.statusCode || 400).json({
      success: false,
      message: result.error || 'Failed to record collection transaction.',
      error: result.error,
    });
  }

  return res.status(201).json({
    success: true,
    message: 'Collection transaction recorded and confirmed.',
    data: { record: result.record, collections: serverAuthManager.getCollectionsList() },
    record: result.record,
    collections: serverAuthManager.getCollectionsList(),
  });
}));

/**
 * GET /api/operations/loans
 * Retrieves loan applications and repayment schedules.
 */
app.get('/api/operations/loans', apiHandler(async (req: Request, res: Response) => {
  const session = await authenticateRequest(req);
  if (!session) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required.',
      error: 'Authentication required.',
    });
  }

  const loans = serverAuthManager.getLoanApplicationsList();
  return res.status(200).json({
    success: true,
    message: 'Loan records retrieved successfully.',
    data: { loans },
    loans,
  });
}));

/**
 * POST /api/operations/loans
 * Creates or updates a loan application (Loan Officer, Operations Manager, Account Manager, Super Admin).
 */
app.post('/api/operations/loans', apiHandler(async (req: Request, res: Response) => {
  const session = await authenticateRequest(req);
  if (!session) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required.',
      error: 'Authentication required.',
    });
  }

  const result = serverAuthManager.createLoanApplicationRecord(session, req.body || {});
  if (!result.success) {
    return res.status(result.statusCode || 400).json({
      success: false,
      message: result.error || 'Failed to process loan application.',
      error: result.error,
    });
  }

  return res.status(result.statusCode || 201).json({
    success: true,
    message: 'Loan application saved successfully.',
    data: { record: result.record, loans: serverAuthManager.getLoanApplicationsList() },
    record: result.record,
    loans: serverAuthManager.getLoanApplicationsList(),
  });
}));

/**
 * GET /api/operations/reconciliations
 * Retrieves financial reconciliation records.
 */
app.get('/api/operations/reconciliations', apiHandler(async (req: Request, res: Response) => {
  const session = await authenticateRequest(req);
  if (!session) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required.',
      error: 'Authentication required.',
    });
  }

  const reconciliations = serverAuthManager.getReconciliationsList();
  return res.status(200).json({
    success: true,
    message: 'Reconciliation records retrieved successfully.',
    data: { reconciliations },
    reconciliations,
  });
}));

/**
 * POST /api/operations/reconciliations
 * Submits a financial reconciliation report (Accounts Officer, Account Manager, Operations Manager, Super Admin).
 */
app.post('/api/operations/reconciliations', apiHandler(async (req: Request, res: Response) => {
  const session = await authenticateRequest(req);
  if (!session) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required.',
      error: 'Authentication required.',
    });
  }

  const result = serverAuthManager.submitReconciliationRecord(session, req.body || {});
  if (!result.success) {
    return res.status(result.statusCode || 400).json({
      success: false,
      message: result.error || 'Failed to submit reconciliation record.',
      error: result.error,
    });
  }

  return res.status(201).json({
    success: true,
    message: 'Reconciliation report submitted successfully.',
    data: { record: result.record, reconciliations: serverAuthManager.getReconciliationsList() },
    record: result.record,
    reconciliations: serverAuthManager.getReconciliationsList(),
  });
}));

/**
 * POST /api/financial/reverse
 * Reverses a confirmed financial transaction. Strictly restricted to Lifetime Super Admin.
 */
app.post('/api/financial/reverse', apiHandler(async (req: Request, res: Response) => {
  const session = await authenticateRequest(req);
  if (!session) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required.',
      error: 'Authentication required.',
    });
  }

  const { transactionId, reason } = req.body || {};
  const result = serverAuthManager.reverseFinancialTransaction(
    session,
    String(transactionId || ''),
    String(reason || '')
  );
  if (!result.success) {
    return res.status(result.statusCode || 403).json({
      success: false,
      message: result.error || 'Transaction reversal denied.',
      error: result.error,
    });
  }

  return res.status(200).json({
    success: true,
    message: 'Transaction reversed by Lifetime Super Admin.',
    data: { record: result.record },
    record: result.record,
  });
}));

// ============================================================================
// 5.5. DEDICATED /api/* 404 HANDLER & ERROR MIDDLEWARE
// Prevents missing API routes or method mismatches from falling into SPA index.html
// ============================================================================
app.all('/api/*', (req: Request, res: Response) => {
  const correlationId = generateCorrelationId(req);
  const msg = `API endpoint not found: ${req.method} ${req.path}`;
  logStructuredServerError({
    correlationId,
    endpoint: req.path || '/api/unknown',
    operation: 'API_ROUTE_LOOKUP',
    errorCategory: 'ENDPOINT_NOT_FOUND',
    firebaseErrorCode: 'NONE',
    statusCode: 404,
    message: msg,
  });
  return res.status(404).json({
    success: false,
    message: msg,
    error: {
      code: 'ENDPOINT_NOT_FOUND',
      message: msg,
      correlationId,
    },
    correlationId,
    statusCode: 404,
  });
});

app.use('/api', (err: any, req: Request, res: Response, _next: NextFunction) => {
  const correlationId = generateCorrelationId(req);
  const status = typeof err?.status === 'number' && err.status >= 400 && err.status < 600 ? err.status : 500;
  const safeMessage = 'A server error occurred while processing the request.';
  logStructuredServerError({
    correlationId,
    endpoint: req?.path || '/api/unknown',
    operation: 'EXPRESS_API_ERROR_MIDDLEWARE',
    errorCategory: status === 503 ? 'SERVICE_UNAVAILABLE' : 'INTERNAL_SERVER_ERROR',
    firebaseErrorCode: err?.code || 'INTERNAL_SERVER_ERROR',
    statusCode: status,
    message: err?.message || safeMessage,
  });
  return res.status(status).json({
    success: false,
    message: safeMessage,
    error: {
      code: status === 503 ? 'SERVICE_UNAVAILABLE' : 'INTERNAL_SERVER_ERROR',
      message: safeMessage,
      correlationId,
    },
    correlationId,
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
const isServerlessRuntime = Boolean(
  process.env.VERCEL ||
  process.env.VERCEL_ENV ||
  process.env.AWS_LAMBDA_FUNCTION_NAME ||
  (globalThis as any).__TEAMACRO_SERVERLESS__
);

if (!isServerlessRuntime) {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    // In development mode, initialize Vite dev server middleware immediately after port 3000 binds
    // so container startup readiness probes never time out waiting for esbuild pre-bundling.
    // Use dynamic module specifier so @vercel/nft never bundles 'vite' into serverless functions.
    let viteInstance: any = null;
    let vitePromise: Promise<any> | null = null;

    const getViteServer = () => {
      if (viteInstance) return Promise.resolve(viteInstance);
      if (!vitePromise) {
        const vitePkgName = 'vite';
        vitePromise = import(/* @vite-ignore */ vitePkgName)
          .then(({ createServer: createViteServer }: any) =>
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
            viteInstance = vite;
            console.log('[DEV] Vite dev server middleware initialized and mounted');
            if (typeof vite.transformRequest === 'function') {
              vite.transformRequest('/src/main.tsx').catch(() => {});
              vite.transformRequest('/src/App.tsx').catch(() => {});
            }
            return vite;
          })
          .catch((err) => {
            console.warn('[DEV] Vite dev server middleware fallback to static:', err?.message || err);
            return null;
          });
      }
      return vitePromise;
    };

    app.head('/', (_req: Request, res: Response) => {
      res.status(200).end();
    });

    app.use(async (req: Request, res: Response, next: NextFunction) => {
      try {
        // If Vite is already initialized, or if the request is specifically for a source module (/src/*, /@vite/*, /node_modules/*), await Vite
        const needsViteTransform =
          req.url.startsWith('/src/') ||
          req.url.startsWith('/@') ||
          req.url.startsWith('/node_modules/');

        if (viteInstance) {
          return viteInstance.middlewares(req, res, next);
        }

        if (needsViteTransform || !fs.existsSync(indexPath)) {
          const vite = await getViteServer();
          if (vite) {
            return vite.middlewares(req, res, next);
          }
        } else {
          // Trigger Vite warm-up in background while serving pre-built dist asset immediately
          getViteServer().catch(() => {});
        }
      } catch (err) {
        console.warn('[DEV] Vite middleware handler note:', err);
      }
      next();
    });

    setTimeout(() => {
      getViteServer().catch(() => {});
    }, 150);
  }

  // Serve pre-built static assets and public icons before SPA fallback
  const publicPath = path.resolve(cwd, 'public');
  app.use(express.static(distPath, { index: false, maxAge: isProd ? '1h' : 0 }));
  app.use(express.static(publicPath, { index: false, maxAge: isProd ? '1h' : 0 }));

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

if (!isServerlessRuntime) {
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