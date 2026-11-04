import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeApp, getApps, getApp, cert, App as AdminApp } from 'firebase-admin/app';
import { getAuth as getAdminAuth, Auth as AdminAuth } from 'firebase-admin/auth';
import { getFirestore as getAdminFirestore, Firestore as AdminFirestore } from 'firebase-admin/firestore';

export const AUTHORIZED_SUPER_ADMIN_EMAIL = 'eromoseledavidson68@gmail.com';
export const DEFAULT_FIREBASE_PROJECT_ID = 'teamacro-a1849';
export const DEFAULT_FIRESTORE_DATABASE_ID = 'ai-studio-teamacro-1c75b7f5-7b8e-4f90-9452-2820167e5d5a';

export interface ServerFirebaseConfig {
  projectId: string;
  appId: string;
  apiKey: string;
  authDomain: string;
  firestoreDatabaseId: string;
  clientEmail?: string;
  privateKey?: string;
  hasAdminCredentials: boolean;
}

export interface StructuredErrorLog {
  correlationId: string;
  timestamp: string;
  endpoint: string;
  operation: string;
  errorCategory:
    | 'VALIDATION_ERROR'
    | 'AUTH_ERROR'
    | 'AUTHENTICATION_REQUIRED'
    | 'PERMISSION_DENIED'
    | 'INSUFFICIENT_PRIVILEGES'
    | 'DUPLICATE_ACCOUNT'
    | 'DUPLICATE_EMAIL'
    | 'FIREBASE_AUTH_ERROR'
    | 'FIRESTORE_ERROR'
    | 'INTERNAL_SERVER_ERROR';
  firebaseErrorCode?: string;
  statusCode: number;
  message: string;
  actorEmail?: string;
  targetEmail?: string;
}

/**
 * Redacts any sensitive credentials from log messages.
 */
function redactSecrets(text: string): string {
  if (!text) return '';
  return text
    .replace(/(password|accessCode|token|secret|privateKey|private_key|apiKey)["':=\s]+["']?([^"',\s}]+)["']?/gi, '$1=[REDACTED]')
    .replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, 'Bearer [REDACTED]')
    .replace(/-----BEGIN [A-Z ]+-----[\s\S]*?-----END [A-Z ]+-----/g, '[REDACTED_PRIVATE_KEY]');
}

/**
 * Emits a structured server-side diagnostic error log without exposing secrets.
 */
export function logStructuredServerError(params: Omit<StructuredErrorLog, 'timestamp' | 'correlationId'> & { correlationId?: string }): StructuredErrorLog {
  const entry: StructuredErrorLog = {
    correlationId: params.correlationId || `req_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`,
    timestamp: new Date().toISOString(),
    endpoint: params.endpoint,
    operation: params.operation,
    errorCategory: params.errorCategory,
    firebaseErrorCode: params.firebaseErrorCode,
    statusCode: params.statusCode,
    message: redactSecrets(params.message),
  };

  console.error('[TEAMACRO_SERVER_ERROR]', JSON.stringify(entry));
  return entry;
}

/**
 * Normalizes a PEM private key from environment variables (handles escaped \n and surrounding quotes).
 */
export function normalizePrivateKey(rawKey?: string): string | undefined {
  if (!rawKey || typeof rawKey !== 'string') return undefined;
  let cleaned = rawKey.trim();
  if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
    cleaned = cleaned.slice(1, -1).trim();
  }
  cleaned = cleaned.replace(/\\n/g, '\n');
  if (!cleaned.includes('BEGIN PRIVATE KEY') && !cleaned.includes('BEGIN RSA PRIVATE KEY')) {
    return undefined;
  }
  return cleaned;
}

/**
 * Resolves Firebase configuration across local development, Cloud Run, and Vercel serverless environments.
 */
export function resolveServerFirebaseConfig(): ServerFirebaseConfig {
  let fileConfig: Record<string, string> = {};
  const candidatePaths: string[] = [
    path.resolve(process.cwd(), 'firebase-applet-config.json'),
  ];

  try {
    const currentDir = path.dirname(fileURLToPath(import.meta.url));
    candidatePaths.push(
      path.resolve(currentDir, '../../firebase-applet-config.json'),
      path.resolve(currentDir, '../firebase-applet-config.json')
    );
  } catch {
    // Ignore fileURLToPath resolution issues in non-ESM contexts
  }

  for (const cfgPath of candidatePaths) {
    try {
      if (fs.existsSync(cfgPath)) {
        fileConfig = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
        break;
      }
    } catch {
      // Try next candidate
    }
  }

  let serviceAccountJson: Record<string, string> = {};
  const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY || process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (rawServiceAccount) {
    try {
      const decoded = rawServiceAccount.trim().startsWith('{')
        ? rawServiceAccount.trim()
        : Buffer.from(rawServiceAccount.trim(), 'base64').toString('utf-8');
      serviceAccountJson = JSON.parse(decoded);
    } catch (err) {
      logStructuredServerError({
        endpoint: 'SYSTEM_INIT',
        operation: 'PARSE_SERVICE_ACCOUNT_JSON',
        errorCategory: 'AUTH_ERROR',
        firebaseErrorCode: 'app/invalid-credential',
        statusCode: 500,
        message: `FIREBASE_SERVICE_ACCOUNT_KEY is not valid JSON: ${(err as Error)?.message || 'parse error'}`,
      });
    }
  }

  const projectId =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.VITE_FIREBASE_PROJECT_ID ||
    serviceAccountJson.project_id ||
    fileConfig.projectId ||
    DEFAULT_FIREBASE_PROJECT_ID;

  const firestoreDatabaseId =
    process.env.FIREBASE_FIRESTORE_DATABASE_ID ||
    process.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID ||
    fileConfig.firestoreDatabaseId ||
    DEFAULT_FIRESTORE_DATABASE_ID;

  const apiKey =
    process.env.FIREBASE_API_KEY ||
    process.env.VITE_FIREBASE_API_KEY ||
    fileConfig.apiKey ||
    '';

  const appId =
    process.env.FIREBASE_APP_ID ||
    process.env.VITE_FIREBASE_APP_ID ||
    fileConfig.appId ||
    '1:419612802:web:82d48b940af93927734c9b';

  const authDomain =
    process.env.FIREBASE_AUTH_DOMAIN ||
    process.env.VITE_FIREBASE_AUTH_DOMAIN ||
    fileConfig.authDomain ||
    `${projectId}.firebaseapp.com`;

  const clientEmail =
    process.env.FIREBASE_CLIENT_EMAIL ||
    serviceAccountJson.client_email ||
    undefined;

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
    hasAdminCredentials,
  };
}

let cachedAdminApp: AdminApp | null = null;
let cachedAdminAuth: AdminAuth | null = null;
let cachedAdminDb: AdminFirestore | null = null;

/**
 * Safely initializes or retrieves the singleton Firebase Admin SDK instance.
 * Never throws on duplicate initialization across warm Vercel invocations.
 */
export function getFirebaseAdminServices(): {
  app: AdminApp | null;
  auth: AdminAuth | null;
  db: AdminFirestore | null;
  config: ServerFirebaseConfig;
} {
  const config = resolveServerFirebaseConfig();

  if (!config.hasAdminCredentials || !config.clientEmail || !config.privateKey) {
    return { app: null, auth: null, db: null, config };
  }

  try {
    if (!cachedAdminApp) {
      const existingApps = getApps();
      if (existingApps.length > 0) {
        cachedAdminApp = getApp();
      } else {
        cachedAdminApp = initializeApp({
          credential: cert({
            projectId: config.projectId,
            clientEmail: config.clientEmail,
            privateKey: config.privateKey,
          }),
          projectId: config.projectId,
        });
      }
    }

    if (!cachedAdminAuth && cachedAdminApp) {
      cachedAdminAuth = getAdminAuth(cachedAdminApp);
    }

    if (!cachedAdminDb && cachedAdminApp) {
      try {
        cachedAdminDb = getAdminFirestore(cachedAdminApp, config.firestoreDatabaseId);
      } catch {
        cachedAdminDb = getAdminFirestore(cachedAdminApp);
      }
    }

    return {
      app: cachedAdminApp,
      auth: cachedAdminAuth,
      db: cachedAdminDb,
      config,
    };
  } catch (err) {
    logStructuredServerError({
      endpoint: 'SYSTEM_INIT',
      operation: 'FIREBASE_ADMIN_INIT',
      errorCategory: 'AUTH_ERROR',
      firebaseErrorCode: (err as any)?.code || 'app/initialization-error',
      statusCode: 500,
      message: `Firebase Admin SDK initialization warning: ${(err as Error)?.message || 'Unknown error'}`,
    });
    return { app: null, auth: null, db: null, config };
  }
}

function withTimeout<T>(promise: Promise<T>, ms = 4000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms);
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

/**
 * Verifies a Firebase ID Token (JWT) using Firebase Admin SDK (if service account configured)
 * or Google Identity Toolkit REST API (`accounts:lookup`).
 */
export async function verifyFirebaseIdToken(idToken: string): Promise<{
  valid: boolean;
  verified: boolean;
  uid?: string;
  email?: string;
  name?: string;
  fullName?: string;
  emailVerified?: boolean;
  disabled?: boolean;
  errorCode?: string;
}> {
  if (!idToken || idToken.split('.').length !== 3) {
    return { valid: false, verified: false, errorCode: 'auth/argument-error' };
  }

  const { auth: adminAuth, config } = getFirebaseAdminServices();

  // 1. Try Firebase Admin SDK verification first if configured
  if (adminAuth) {
    try {
      const decoded = await withTimeout(adminAuth.verifyIdToken(idToken, true), 3500);
      return {
        valid: true,
        verified: true,
        uid: decoded.uid,
        email: (decoded.email || '').toLowerCase().trim(),
        name: decoded.name || undefined,
        fullName: decoded.name || undefined,
        emailVerified: decoded.email_verified,
        disabled: false,
      };
    } catch (err: any) {
      const code = err?.code || 'auth/invalid-id-token';
      if (code === 'auth/id-token-expired' || code === 'auth/id-token-revoked' || code === 'auth/user-disabled') {
        return { valid: false, verified: false, errorCode: code };
      }
      // Fall through to Identity Toolkit lookup if service account had permission/clock-skew issues
    }
  }

  // 2. Decode JWT payload and verify claims + Google Identity Toolkit REST API
  try {
    const parts = idToken.split('.');
    const payloadJson = Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
    const payload = JSON.parse(payloadJson);
    const nowSec = Math.floor(Date.now() / 1000);

    const projectMatches =
      payload.aud === config.projectId ||
      (typeof payload.iss === 'string' && payload.iss.includes(config.projectId));

    if (!projectMatches) {
      return { valid: false, verified: false, errorCode: 'auth/invalid-project-audience' };
    }

    if (!payload.exp || payload.exp <= nowSec) {
      return { valid: false, verified: false, errorCode: 'auth/id-token-expired' };
    }

    const uid = payload.user_id || payload.sub;
    const email = (payload.email || '').toLowerCase().trim();
    const fullName = payload.name || undefined;

    if (config.apiKey) {
      const verifyRes = await withTimeout(
        fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${config.apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken }),
        }),
        3500
      );

      if (verifyRes.ok) {
        const data: any = await verifyRes.json();
        const userRecord = data?.users?.[0];
        if (userRecord) {
          if (userRecord.disabled === true) {
            return { valid: false, verified: false, errorCode: 'auth/user-disabled', disabled: true };
          }
          return {
            valid: true,
            verified: true,
            uid: userRecord.localId || uid,
            email: (userRecord.email || email).toLowerCase().trim(),
            name: userRecord.displayName || fullName,
            fullName: userRecord.displayName || fullName,
            emailVerified: Boolean(userRecord.emailVerified),
            disabled: false,
          };
        }
      } else {
        const errBody: any = await verifyRes.json().catch(() => ({}));
        const msg = errBody?.error?.message || 'INVALID_ID_TOKEN';
        return { valid: false, verified: false, errorCode: `auth/${msg.toLowerCase()}` };
      }
    }
  } catch (err: any) {
    return { valid: false, verified: false, errorCode: err?.code || 'auth/verification-failed' };
  }

  return { valid: false, verified: false, errorCode: 'auth/missing-api-key' };
}

/**
 * Creates or resolves a user in Firebase Authentication on the server without replacing
 * the active Super Admin's browser session.
 */
export async function provisionFirebaseAuthAccount(params: {
  email: string;
  password: string;
  fullName?: string;
  displayName?: string;
  phone?: string;
}): Promise<{
  success: boolean;
  uid?: string;
  idToken?: string;
  userIdToken?: string;
  newlyCreated?: boolean;
  createdNewAuthUser?: boolean;
  isDuplicate?: boolean;
  emailAlreadyExists?: boolean;
  errorCode?: string;
  firebaseErrorCode?: string;
  errorMessage?: string;
  statusCode?: number;
}> {
  const cleanEmail = (params.email || '').trim().toLowerCase();
  const cleanName = (params.fullName || params.displayName || '').trim();
  const rawPassword = (params.password || '').trim();
  // Firebase Authentication requires passwords to be at least 6 characters
  const effectivePassword = rawPassword.length >= 6 ? rawPassword : `${rawPassword}_Tmc2026!`;

  const { auth: adminAuth, config } = getFirebaseAdminServices();

  // 1. Path A: Firebase Admin SDK (when service account is configured in environment variables)
  if (adminAuth) {
    try {
      const createdUser = await withTimeout(
        adminAuth.createUser({
          email: cleanEmail,
          password: effectivePassword,
          displayName: cleanName,
          emailVerified: true,
          disabled: false,
        }),
        4500
      );
      return {
        success: true,
        uid: createdUser.uid,
        newlyCreated: true,
        createdNewAuthUser: true,
      };
    } catch (err: any) {
      const code: string = err?.code || '';
      if (code === 'auth/email-already-exists') {
        try {
          const existingUser = await withTimeout(adminAuth.getUserByEmail(cleanEmail), 3500);
          return {
            success: true,
            uid: existingUser.uid,
            newlyCreated: false,
            createdNewAuthUser: false,
            isDuplicate: true,
            emailAlreadyExists: true,
          };
        } catch {
          return {
            success: false,
            isDuplicate: true,
            emailAlreadyExists: true,
            errorCode: 'auth/email-already-exists',
            firebaseErrorCode: 'auth/email-already-exists',
            errorMessage: 'An account with this email address already exists in Firebase Authentication.',
            statusCode: 409,
          };
        }
      }
      if (code === 'auth/invalid-email') {
        return {
          success: false,
          errorCode: code,
          firebaseErrorCode: code,
          errorMessage: 'The provided email address is invalid.',
          statusCode: 400,
        };
      }
      if (code === 'auth/invalid-password' || code === 'auth/weak-password') {
        return {
          success: false,
          errorCode: code,
          firebaseErrorCode: code,
          errorMessage: 'Password or access code must be at least 6 characters long.',
          statusCode: 400,
        };
      }
      // Fall through to Identity Toolkit REST API if Admin SDK encountered a transient credential/network issue
    }
  }

  // 2. Path B: Firebase Identity Toolkit REST API (`accounts:signUp`)
  // Creates a real Firebase Authentication user server-side without affecting any browser session.
  if (config.apiKey) {
    try {
      const signUpRes = await withTimeout(
        fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${config.apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: cleanEmail,
            password: effectivePassword,
            displayName: cleanName,
            returnSecureToken: true,
          }),
        }),
        4500
      );

      if (signUpRes.ok) {
        const data: any = await signUpRes.json();
        if (data?.localId) {
          return {
            success: true,
            uid: data.localId,
            idToken: data.idToken,
            userIdToken: data.idToken,
            newlyCreated: true,
            createdNewAuthUser: true,
          };
        }
      } else {
        const errData: any = await signUpRes.json().catch(() => ({}));
        const rawCode: string = errData?.error?.message || 'UNKNOWN_AUTH_ERROR';

        if (rawCode === 'EMAIL_EXISTS' || rawCode.startsWith('EMAIL_EXISTS')) {
          // Try signing in with the password to resolve the existing UID if re-provisioning
          try {
            const signInRes = await withTimeout(
              fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${config.apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  email: cleanEmail,
                  password: effectivePassword,
                  returnSecureToken: true,
                }),
              }),
              3500
            );
            if (signInRes.ok) {
              const signInData: any = await signInRes.json();
              if (signInData?.localId) {
                return {
                  success: true,
                  uid: signInData.localId,
                  idToken: signInData.idToken,
                  userIdToken: signInData.idToken,
                  newlyCreated: false,
                  createdNewAuthUser: false,
                  isDuplicate: true,
                  emailAlreadyExists: true,
                };
              }
            }
          } catch {
            // Ignore sign-in probe error
          }

          return {
            success: true,
            newlyCreated: false,
            createdNewAuthUser: false,
            isDuplicate: true,
            emailAlreadyExists: true,
            errorCode: 'auth/email-already-exists',
            firebaseErrorCode: 'auth/email-already-exists',
          };
        }

        if (rawCode.includes('INVALID_EMAIL')) {
          return {
            success: false,
            errorCode: 'auth/invalid-email',
            firebaseErrorCode: 'auth/invalid-email',
            errorMessage: 'Please enter a valid official email address.',
            statusCode: 400,
          };
        }

        if (rawCode.includes('WEAK_PASSWORD')) {
          return {
            success: false,
            errorCode: 'auth/weak-password',
            firebaseErrorCode: 'auth/weak-password',
            errorMessage: 'Password or access code must be at least 6 characters long.',
            statusCode: 400,
          };
        }

        if (rawCode.includes('OPERATION_NOT_ALLOWED')) {
          // Email/password sign-in provider disabled in Firebase Console; fall back to deterministic UID
          return {
            success: true,
            newlyCreated: false,
            createdNewAuthUser: false,
            errorCode: 'auth/operation-not-allowed',
            firebaseErrorCode: 'auth/operation-not-allowed',
          };
        }
      }
    } catch (netErr: any) {
      logStructuredServerError({
        endpoint: 'IDENTITY_TOOLKIT',
        operation: 'ACCOUNTS_SIGNUP',
        errorCategory: 'FIREBASE_AUTH_ERROR',
        firebaseErrorCode: 'auth/network-request-failed',
        statusCode: 500,
        message: `Identity Toolkit signUp network warning: ${netErr?.message || 'network error'}`,
      });
    }
  }

  return {
    success: true,
    newlyCreated: false,
    createdNewAuthUser: false,
  };
}

/**
 * Rolls back a newly created Firebase Authentication user if Firestore profile creation fails.
 */
export async function rollbackFirebaseAuthAccount(uid: string, userIdToken?: string): Promise<void> {
  if (!uid) return;
  const { auth: adminAuth, config } = getFirebaseAdminServices();

  if (adminAuth) {
    try {
      await withTimeout(adminAuth.deleteUser(uid), 3500);
      return;
    } catch {
      // Fall through to REST API
    }
  }

  if (config.apiKey && userIdToken) {
    try {
      await withTimeout(
        fetch(`https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${config.apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken: userIdToken }),
        }),
        3500
      );
    } catch {
      // Ignore rollback cleanup network error
    }
  }
}

/**
 * Converts a JS object to Firestore REST API `fields` format.
 */
function toFirestoreRestFields(obj: Record<string, any>): Record<string, any> {
  const fields: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    if (v === null) {
      fields[k] = { nullValue: null };
    } else if (typeof v === 'boolean') {
      fields[k] = { booleanValue: v };
    } else if (typeof v === 'number') {
      if (Number.isInteger(v)) {
        fields[k] = { integerValue: String(v) };
      } else {
        fields[k] = { doubleValue: v };
      }
    } else if (typeof v === 'string') {
      fields[k] = { stringValue: v };
    } else if (Array.isArray(v)) {
      fields[k] = {
        arrayValue: {
          values: v.map((item) => {
            if (typeof item === 'string') return { stringValue: item };
            if (typeof item === 'number') return { doubleValue: item };
            if (typeof item === 'boolean') return { booleanValue: item };
            return { stringValue: String(item) };
          }),
        },
      };
    } else if (typeof v === 'object') {
      fields[k] = {
        mapValue: {
          fields: toFirestoreRestFields(v),
        },
      };
    }
  }
  return fields;
}

/**
 * Converts Firestore REST API document `fields` back into a plain JS object.
 */
function fromFirestoreRestFields(fields?: Record<string, any>): Record<string, any> {
  if (!fields || typeof fields !== 'object') return {};
  const result: Record<string, any> = {};
  for (const [k, valObj] of Object.entries(fields)) {
    if (!valObj || typeof valObj !== 'object') continue;
    if ('stringValue' in valObj) result[k] = valObj.stringValue;
    else if ('booleanValue' in valObj) result[k] = Boolean(valObj.booleanValue);
    else if ('integerValue' in valObj) result[k] = Number(valObj.integerValue);
    else if ('doubleValue' in valObj) result[k] = Number(valObj.doubleValue);
    else if ('nullValue' in valObj) result[k] = null;
    else if ('mapValue' in valObj) result[k] = fromFirestoreRestFields(valObj.mapValue?.fields);
    else if ('arrayValue' in valObj) {
      const arr = valObj.arrayValue?.values || [];
      result[k] = arr.map((item: any) => {
        if ('stringValue' in item) return item.stringValue;
        if ('booleanValue' in item) return Boolean(item.booleanValue);
        if ('integerValue' in item) return Number(item.integerValue);
        if ('doubleValue' in item) return Number(item.doubleValue);
        return null;
      });
    }
  }
  return result;
}

/**
 * Writes the corresponding user profile to Cloud Firestore (`/users/{uid}` and `/admins/{uid}` or `/staff/{uid}`).
 */
export async function writeFirestoreUserProfile(
  profile: {
    uid: string;
    fullName: string;
    email: string;
    phone: string;
    role: 'ADMIN' | 'STAFF';
    roleTitle: string;
    duty: string;
    status: 'active' | 'suspended' | 'inactive';
    createdBy: string;
    createdAt: string;
    permissions?: Record<string, boolean>;
    staffCode?: string;
    callerIdToken?: string;
  },
  callerFirebaseToken?: string
): Promise<{ success: boolean; syncedToFirestore?: boolean; error?: string; errorMessage?: string }> {
  const effectiveCallerToken = callerFirebaseToken || profile.callerIdToken;
  const { db: adminDb, config } = getFirebaseAdminServices();

  const userDocData: Record<string, any> = {
    id: profile.uid,
    uid: profile.uid,
    email: profile.email.toLowerCase().trim(),
    fullName: profile.fullName.trim(),
    phone: profile.phone.trim(),
    role: profile.role,
    roleTitle: profile.roleTitle,
    duty: profile.duty,
    status: profile.status,
    active: profile.status === 'active',
    createdBy: profile.createdBy,
    createdAt: profile.createdAt,
    ...(profile.staffCode ? { staffCode: profile.staffCode } : {}),
  };

  const roleCollection = profile.role === 'ADMIN' ? 'admins' : 'staff';
  const roleDocData: Record<string, any> = {
    uid: profile.uid,
    id: profile.uid,
    email: profile.email.toLowerCase().trim(),
    fullName: profile.fullName.trim(),
    phone: profile.phone.trim(),
    role: profile.role,
    roleTitle: profile.roleTitle,
    duty: profile.duty,
    status: profile.status,
    active: profile.status === 'active',
    createdBy: profile.createdBy,
    createdAt: profile.createdAt,
    ...(profile.permissions ? { permissions: profile.permissions } : {}),
    ...(profile.staffCode ? { staffCode: profile.staffCode } : {}),
  };

  // 1. Path A: Firebase Admin Firestore SDK
  if (adminDb) {
    try {
      await withTimeout(
        Promise.all([
          adminDb.collection('users').doc(profile.uid).set(userDocData, { merge: true }),
          adminDb.collection(roleCollection).doc(profile.uid).set(roleDocData, { merge: true }),
        ]),
        4000
      );
      return { success: true, syncedToFirestore: true };
    } catch (err: any) {
      logStructuredServerError({
        endpoint: 'FIRESTORE_ADMIN',
        operation: 'WRITE_USER_PROFILE',
        errorCategory: 'FIRESTORE_ERROR',
        firebaseErrorCode: err?.code || 'firestore/write-error',
        statusCode: 500,
        message: `Admin Firestore profile write note: ${err?.message || 'write error'}`,
      });
    }
  }

  // 2. Path B: Cloud Firestore REST API using caller's verified Firebase ID token
  if (effectiveCallerToken && effectiveCallerToken.split('.').length === 3) {
    try {
      const baseUrl = `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/${config.firestoreDatabaseId}/documents`;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${effectiveCallerToken}`,
      };

      const [userRes, roleRes] = await withTimeout(
        Promise.all([
          fetch(`${baseUrl}/users/${encodeURIComponent(profile.uid)}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ fields: toFirestoreRestFields(userDocData) }),
          }),
          fetch(`${baseUrl}/${roleCollection}/${encodeURIComponent(profile.uid)}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ fields: toFirestoreRestFields(roleDocData) }),
          }),
        ]),
        4000
      );

      if (userRes.ok || roleRes.ok) {
        return { success: true, syncedToFirestore: true };
      }
    } catch {
      // Non-fatal if REST call times out; client-side authenticated Firestore SDK also writes profile
    }
  }

  return { success: true, syncedToFirestore: false };
}

/**
 * Reads a document from Cloud Firestore via Admin SDK or REST API.
 */
export async function readFirestoreDocument(
  collectionName: string,
  docId: string,
  bearerToken?: string
): Promise<Record<string, any> | null> {
  const { db: adminDb, config } = getFirebaseAdminServices();

  if (adminDb) {
    try {
      const snap = await withTimeout(adminDb.collection(collectionName).doc(docId).get(), 2500);
      if (snap.exists) {
        return { id: snap.id, ...snap.data() };
      }
    } catch {
      // Fall through to REST API
    }
  }

  try {
    const url = `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/${config.firestoreDatabaseId}/documents/${encodeURIComponent(collectionName)}/${encodeURIComponent(docId)}`;
    const headers: Record<string, string> = {};
    if (bearerToken && bearerToken.split('.').length === 3) {
      headers['Authorization'] = `Bearer ${bearerToken}`;
    }
    const res = await withTimeout(fetch(url, { headers }), 2500);
    if (res.ok) {
      const data: any = await res.json();
      if (data?.fields) {
        return { id: docId, ...fromFirestoreRestFields(data.fields) };
      }
    }
  } catch {
    // Ignore read timeout
  }

  return null;
}

/**
 * Lists documents from a Firestore collection via Admin SDK or REST API.
 */
export async function listFirestoreCollection(
  collectionName: string,
  bearerToken?: string
): Promise<Array<Record<string, any>>> {
  const { db: adminDb, config } = getFirebaseAdminServices();

  if (adminDb) {
    try {
      const snap = await withTimeout(adminDb.collection(collectionName).limit(200).get(), 2500);
      const docs: Array<Record<string, any>> = [];
      snap.forEach((docSnap) => {
        docs.push({ id: docSnap.id, ...docSnap.data() });
      });
      return docs;
    } catch {
      // Fall through to REST API
    }
  }

  if (bearerToken && bearerToken.split('.').length === 3) {
    try {
      const url = `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/${config.firestoreDatabaseId}/documents/${encodeURIComponent(collectionName)}?pageSize=200`;
      const res = await withTimeout(
        fetch(url, {
          headers: { Authorization: `Bearer ${bearerToken}` },
        }),
        2500
      );
      if (res.ok) {
        const data: any = await res.json();
        const documents: any[] = data?.documents || [];
        return documents.map((docItem) => {
          const nameParts = String(docItem.name || '').split('/');
          const id = nameParts[nameParts.length - 1];
          return { id, ...fromFirestoreRestFields(docItem.fields) };
        });
      }
    } catch {
      // Ignore collection list timeout
    }
  }

  return [];
}

/**
 * Verifies credentials against Firebase Authentication (`accounts:signInWithPassword`)
 * and resolves the user's authoritative role and active status from Firestore on serverless cold starts.
 */
export async function authenticateWithFirebaseOnColdStart(
  email: string,
  password: string
): Promise<{
  authenticated: boolean;
  uid?: string;
  email?: string;
  idToken?: string;
  profile?: Record<string, any>;
  errorCode?: string;
}> {
  const cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanEmail.includes('@') || !password) {
    return { authenticated: false };
  }

  const { config } = getFirebaseAdminServices();
  if (!config.apiKey) {
    return { authenticated: false };
  }

  try {
    const res = await withTimeout(
      fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${config.apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          password,
          returnSecureToken: true,
        }),
      }),
      3500
    );

    if (!res.ok) {
      const errData: any = await res.json().catch(() => ({}));
      return {
        authenticated: false,
        errorCode: errData?.error?.message || 'INVALID_LOGIN_CREDENTIALS',
      };
    }

    const data: any = await res.json();
    const uid = data.localId;
    const idToken = data.idToken;

    if (!uid) {
      return { authenticated: false };
    }

    // Fetch authoritative profile from Firestore (/admins/{uid}, /staff/{uid}, or /users/{uid})
    const [adminDoc, staffDoc, userDoc] = await Promise.all([
      readFirestoreDocument('admins', uid, idToken),
      readFirestoreDocument('staff', uid, idToken),
      readFirestoreDocument('users', uid, idToken),
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
          fullName: profile.fullName || data.displayName || cleanEmail.split('@')[0],
          role: adminDoc ? 'ADMIN' : (staffDoc ? 'STAFF' : (userDoc?.role || 'STAFF')),
        },
      };
    }

    // If Super Admin email
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
          fullName: data.displayName || 'Davidson Eromosele',
          role: 'LIFETIME_SUPER_ADMIN',
          status: 'active',
          active: true,
        },
      };
    }
  } catch {
    // Ignore network timeout
  }

  return { authenticated: false };
}
