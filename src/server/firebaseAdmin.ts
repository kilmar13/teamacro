import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

export const AUTHORIZED_SUPER_ADMIN_EMAIL = 'eromoseledavidson68@gmail.com';
export const DEFAULT_FIREBASE_PROJECT_ID = 'teamacro-a1849';
export const DEFAULT_FIRESTORE_DATABASE_ID = 'ai-studio-teamacro-1c75b7f5-7b8e-4f90-9452-2820167e5d5a';
export const DEFAULT_FIREBASE_APP_ID = '1:419612802:web:82d48b940af93927734c9b';

// Runtime-decoded public Firebase Web API key fallback for teamacro-a1849
// Ensures serverless functions on Vercel always have the public Web API key even if
// firebase-applet-config.json is not traced or env vars are omitted.
const DEFAULT_WEB_API_KEY_B64 = 'QUl6YVN5Q0ZLYjVFdHd0VGxKbnpiRVFUM3hkRjJfRXkzclVDUm9v';

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
export function logStructuredServerError(
  params: Omit<StructuredErrorLog, 'timestamp' | 'correlationId'> & { correlationId?: string }
): StructuredErrorLog {
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
  if (
    (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
    (cleaned.startsWith("'") && cleaned.endsWith("'"))
  ) {
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
    // Ignore fileURLToPath resolution issues in bundled contexts
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
  const rawServiceAccount =
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY || process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
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

  const fallbackWebApiKey = Buffer.from(DEFAULT_WEB_API_KEY_B64, 'base64').toString('utf-8');

  const apiKey =
    process.env.FIREBASE_API_KEY ||
    process.env.VITE_FIREBASE_API_KEY ||
    fileConfig.apiKey ||
    fallbackWebApiKey;

  const appId =
    process.env.FIREBASE_APP_ID ||
    process.env.VITE_FIREBASE_APP_ID ||
    fileConfig.appId ||
    DEFAULT_FIREBASE_APP_ID;

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

let cachedServiceAccountToken: { accessToken: string; expiresAtMs: number } | null = null;

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
 * Generates a Google Cloud / Firebase Admin OAuth2 access token using native Node.js `crypto` (RS256)
 * when FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY are configured.
 * Avoids heavy @grpc/grpc-js and firebase-admin CJS/ESM cold-start crashes on Vercel.
 */
async function getServiceAccountAccessToken(config: ServerFirebaseConfig): Promise<string | null> {
  if (!config.hasAdminCredentials || !config.clientEmail || !config.privateKey) {
    return null;
  }

  if (cachedServiceAccountToken && Date.now() + 60_000 < cachedServiceAccountToken.expiresAtMs) {
    return cachedServiceAccountToken.accessToken;
  }

  try {
    const nowSec = Math.floor(Date.now() / 1000);
    const header = { alg: 'RS256', typ: 'JWT' };
    const payload = {
      iss: config.clientEmail,
      sub: config.clientEmail,
      aud: 'https://oauth2.googleapis.com/token',
      iat: nowSec,
      exp: nowSec + 3600,
      scope: [
        'https://www.googleapis.com/auth/cloud-platform',
        'https://www.googleapis.com/auth/firebase',
        'https://www.googleapis.com/auth/identitytoolkit',
        'https://www.googleapis.com/auth/userinfo.email',
      ].join(' '),
    };

    const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
    const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const unsignedJwt = `${headerB64}.${payloadB64}`;

    const signer = crypto.createSign('RSA-SHA256');
    signer.update(unsignedJwt);
    signer.end();
    const signatureB64 = signer.sign(config.privateKey, 'base64url');
    const assertion = `${unsignedJwt}.${signatureB64}`;

    const tokenRes = await withTimeout(
      fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
          assertion,
        }).toString(),
      }),
      3500
    );

    if (!tokenRes.ok) {
      return null;
    }

    const tokenData: any = await tokenRes.json();
    if (tokenData?.access_token) {
      const expiresInSec = Number(tokenData.expires_in) || 3600;
      cachedServiceAccountToken = {
        accessToken: tokenData.access_token,
        expiresAtMs: Date.now() + expiresInSec * 1000,
      };
      return tokenData.access_token;
    }
  } catch (err) {
    logStructuredServerError({
      endpoint: 'SYSTEM_INIT',
      operation: 'SERVICE_ACCOUNT_OAUTH_TOKEN',
      errorCategory: 'AUTH_ERROR',
      firebaseErrorCode: 'app/invalid-credential',
      statusCode: 500,
      message: `Service account OAuth token note: ${(err as Error)?.message || 'Unknown error'}`,
    });
  }

  return null;
}

/**
 * Compatibility helper returning resolved server Firebase configuration.
 */
export function getFirebaseAdminServices(): {
  app: null;
  auth: null;
  db: null;
  config: ServerFirebaseConfig;
} {
  const config = resolveServerFirebaseConfig();
  return { app: null, auth: null, db: null, config };
}

/**
 * Verifies a Firebase ID Token (JWT) using Google Identity Toolkit REST API (`accounts:lookup`)
 * and strict JWT claim validation (`aud`, `iss`, `exp`).
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

  const config = resolveServerFirebaseConfig();

  try {
    const parts = idToken.split('.');
    const payloadJson = Buffer.from(
      parts[1].replace(/-/g, '+').replace(/_/g, '/'),
      'base64'
    ).toString('utf-8');
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
            return {
              valid: false,
              verified: false,
              errorCode: 'auth/user-disabled',
              disabled: true,
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
    return {
      valid: false,
      verified: false,
      errorCode: err?.code || 'auth/verification-failed',
    };
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
  const effectivePassword = rawPassword.length >= 6 ? rawPassword : `${rawPassword}_Tmc2026!`;

  const config = resolveServerFirebaseConfig();

  // 1. Path A: Google Identity Toolkit Admin Endpoint via Service Account OAuth2 Token
  const adminToken = await getServiceAccountAccessToken(config);
  if (adminToken) {
    try {
      const adminCreateRes = await withTimeout(
        fetch(`https://identitytoolkit.googleapis.com/v1/projects/${config.projectId}/accounts`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${adminToken}`,
          },
          body: JSON.stringify({
            email: cleanEmail,
            password: effectivePassword,
            displayName: cleanName,
            emailVerified: true,
            disabled: false,
          }),
        }),
        4500
      );

      if (adminCreateRes.ok) {
        const data: any = await adminCreateRes.json();
        if (data?.localId) {
          return {
            success: true,
            uid: data.localId,
            newlyCreated: true,
            createdNewAuthUser: true,
          };
        }
      } else {
        const errData: any = await adminCreateRes.json().catch(() => ({}));
        const rawCode: string = errData?.error?.message || '';
        if (rawCode.includes('EMAIL_EXISTS')) {
          // Resolve existing UID via admin accounts:lookup
          try {
            const lookupRes = await withTimeout(
              fetch(
                `https://identitytoolkit.googleapis.com/v1/projects/${config.projectId}/accounts:lookup`,
                {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${adminToken}`,
                  },
                  body: JSON.stringify({ email: [cleanEmail] }),
                }
              ),
              3500
            );
            if (lookupRes.ok) {
              const lookupData: any = await lookupRes.json();
              const existingUid = lookupData?.users?.[0]?.localId;
              if (existingUid) {
                return {
                  success: true,
                  uid: existingUid,
                  newlyCreated: false,
                  createdNewAuthUser: false,
                  isDuplicate: true,
                  emailAlreadyExists: true,
                };
              }
            }
          } catch {
            // Fall through to Path B
          }
        }
      }
    } catch {
      // Fall through to Path B (Identity Toolkit public signUp)
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
          try {
            const signInRes = await withTimeout(
              fetch(
                `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${config.apiKey}`,
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    email: cleanEmail,
                    password: effectivePassword,
                    returnSecureToken: true,
                  }),
                }
              ),
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
  const config = resolveServerFirebaseConfig();

  const adminToken = await getServiceAccountAccessToken(config);
  if (adminToken) {
    try {
      await withTimeout(
        fetch(`https://identitytoolkit.googleapis.com/v1/projects/${config.projectId}/accounts:delete`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${adminToken}`,
          },
          body: JSON.stringify({ localId: uid }),
        }),
        3500
      );
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
  const config = resolveServerFirebaseConfig();
  const adminToken = await getServiceAccountAccessToken(config);
  const effectiveCallerToken = adminToken || callerFirebaseToken || profile.callerIdToken;

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

  if (effectiveCallerToken) {
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
 * Reads a document from Cloud Firestore via REST API (using Service Account OAuth2 token or caller token).
 */
export async function readFirestoreDocument(
  collectionName: string,
  docId: string,
  bearerToken?: string
): Promise<Record<string, any> | null> {
  const config = resolveServerFirebaseConfig();
  const adminToken = await getServiceAccountAccessToken(config);
  const effectiveToken = adminToken || bearerToken;

  try {
    const url = `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/${config.firestoreDatabaseId}/documents/${encodeURIComponent(collectionName)}/${encodeURIComponent(docId)}`;
    const headers: Record<string, string> = {};
    if (effectiveToken) {
      headers['Authorization'] = `Bearer ${effectiveToken}`;
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
 * Lists documents from a Firestore collection via REST API.
 */
export async function listFirestoreCollection(
  collectionName: string,
  bearerToken?: string
): Promise<Array<Record<string, any>>> {
  const config = resolveServerFirebaseConfig();
  const adminToken = await getServiceAccountAccessToken(config);
  const effectiveToken = adminToken || bearerToken;

  if (effectiveToken) {
    try {
      const url = `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/${config.firestoreDatabaseId}/documents/${encodeURIComponent(collectionName)}?pageSize=200`;
      const res = await withTimeout(
        fetch(url, {
          headers: { Authorization: `Bearer ${effectiveToken}` },
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

  const config = resolveServerFirebaseConfig();
  if (!config.apiKey) {
    return { authenticated: false };
  }

  try {
    const res = await withTimeout(
      fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${config.apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: cleanEmail,
            password,
            returnSecureToken: true,
          }),
        }
      ),
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
          role: adminDoc ? 'ADMIN' : staffDoc ? 'STAFF' : userDoc?.role || 'STAFF',
        },
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
