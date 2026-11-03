/**
 * TEAMACRO SERVICES LTD — Robust Type-Safe Error Normalization Utility
 * 
 * Prevents "Minified React error #31" (Objects are not valid as a React child - found: object with keys {code, message})
 * by guaranteeing that ANY error (Firebase error, API payload, network failure, Error instance, or raw object)
 * is safely normalized into a clean, human-readable string suitable for React rendering.
 */

export interface NormalizedErrorResult {
  message: string;
  code?: string;
  statusCode?: number;
}

/**
 * Maps known Firebase Auth and system error codes to human-readable explanations.
 */
const KNOWN_ERROR_CODES: Record<string, string> = {
  // Firebase Auth Codes
  'auth/invalid-credential': 'The email address, username, or password you entered is incorrect.',
  'auth/user-not-found': 'No registered account found with these credentials.',
  'auth/wrong-password': 'The password you entered is incorrect.',
  'auth/user-disabled': 'This account has been suspended or deactivated by system administration.',
  'auth/too-many-requests': 'Access has been temporarily restricted due to multiple failed attempts. Please try again later.',
  'auth/id-token-expired': 'Your authentication session has expired. Please sign in again.',
  'auth/id-token-revoked': 'Your authentication session has been revoked. Please sign in again.',
  'auth/network-request-failed': 'Unable to connect to the authentication service. Please check your network connection.',
  'auth/operation-not-allowed': 'This sign-in method is currently not enabled.',
  'auth/invalid-email': 'Please provide a valid official email address.',
  'auth/weak-password': 'Password does not meet the minimum security strength requirements.',

  // TEAMACRO Custom Gateway Codes
  'ENDPOINT_NOT_FOUND': 'The requested service endpoint was not found.',
  'INTERNAL_SERVER_ERROR': 'A server error occurred while processing your request.',
  'AUTHENTICATION_REQUIRED': 'Active authentication required. Please sign in to continue.',
  'CLEARANCE_VIOLATION': 'Access Denied: Your account role does not hold the clearance required for this operation.',
  'PRIVILEGE_VIOLATION': 'Access Denied: Insufficient authorization privileges.',
  'SESSION_EXPIRED': 'Your session has expired. Please sign in again.',
  'ACCOUNT_DISABLED': 'This staff account has been deactivated. Please contact your system administrator.',
  'PROFILE_NOT_FOUND': 'No staff profile associated with this account was found.',
};

/**
 * Strips secrets, passwords, tokens, and access codes from text/logs
 */
export function sanitizeLogOutput(input: string): string {
  if (!input) return '';
  return input
    .replace(/(password|accessCode|token|secret|apiKey)["':\s]+["']?([^"',\s]+)["']?/gi, '$1: "[REDACTED]"')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [REDACTED]');
}

/**
 * Normalizes any error value into a clean, human-readable string guaranteed safe for React JSX rendering.
 * Never returns an object, undefined, or null.
 * 
 * @param error Any error object, string, exception, or unknown value
 * @param fallback Optional fallback message if the error is empty
 */
export function normalizeError(error: unknown, fallback = 'An unexpected error occurred. Please try again.'): string {
  if (error === null || error === undefined) {
    return fallback;
  }

  // 1. Primitive string
  if (typeof error === 'string') {
    const trimmed = error.trim();
    if (!trimmed) return fallback;

    // Check if it's a JSON string representing an error object (e.g. from FirestoreErrorInfo or API)
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed === 'object') {
          return normalizeError(parsed, fallback);
        }
      } catch {
        // Not valid JSON, continue with raw string
      }
    }

    // Clean common HTML tags or error wrappers
    return trimmed.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ');
  }

  // 2. Numbers, booleans
  if (typeof error === 'number' || typeof error === 'boolean') {
    return String(error);
  }

  // 3. Array of errors
  if (Array.isArray(error)) {
    const validMessages = error
      .map((item) => normalizeError(item, ''))
      .filter((msg) => msg.length > 0);
    return validMessages.length > 0 ? validMessages.join('; ') : fallback;
  }

  // 4. Object handling ({ code, message }, Error instance, API payload, etc.)
  if (typeof error === 'object') {
    const errObj = error as Record<string, any>;

    // Case A: errObj has a code and message property
    const code = typeof errObj.code === 'string' ? errObj.code.trim() : typeof errObj.code === 'number' ? `HTTP_${errObj.code}` : undefined;
    const rawMsg = errObj.message || errObj.error || errObj.reason || errObj.details;

    // If code is known in dictionary, use friendly message
    if (code && KNOWN_ERROR_CODES[code]) {
      return KNOWN_ERROR_CODES[code];
    }

    // If rawMsg is string
    if (typeof rawMsg === 'string' && rawMsg.trim().length > 0) {
      const clean = rawMsg.trim();
      // Check if rawMsg is itself JSON
      if (clean.startsWith('{') && clean.endsWith('}')) {
        try {
          const parsed = JSON.parse(clean);
          return normalizeError(parsed, fallback);
        } catch {
          // ignore
        }
      }
      return clean;
    }

    // If rawMsg is nested object (e.g. { error: { message: "..." } })
    if (typeof rawMsg === 'object' && rawMsg !== null) {
      return normalizeError(rawMsg, fallback);
    }

    // Case B: Standard JavaScript Error object with message
    if (error instanceof Error && typeof error.message === 'string' && error.message.trim().length > 0) {
      const clean = error.message.trim();
      if (clean.startsWith('{') && clean.endsWith('}')) {
        try {
          const parsed = JSON.parse(clean);
          return normalizeError(parsed, fallback);
        } catch {
          // ignore
        }
      }
      return clean;
    }

    // Case C: Object has code only
    if (code) {
      return `Error (${code}). Please check your input or contact system administrator.`;
    }
  }

  return fallback;
}

/**
 * Extracts normalized details for diagnostic logging without leaking credentials
 */
export function extractErrorDetails(error: unknown): NormalizedErrorResult {
  const message = normalizeError(error);
  let code: string | undefined = undefined;
  let statusCode: number | undefined = undefined;

  if (error && typeof error === 'object') {
    const obj = error as Record<string, any>;
    if (typeof obj.code === 'string') code = obj.code;
    if (typeof obj.code === 'number') statusCode = obj.code;
    if (typeof obj.status === 'number') statusCode = obj.status;
    if (typeof obj.statusCode === 'number') statusCode = obj.statusCode;
  }

  return { message, code, statusCode };
}
