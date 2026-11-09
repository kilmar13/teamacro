/**
 * TEAMACRO SERVICES LTD — Safe Resilient API Client
 * 
 * Guarantees that frontend API requests:
 * 1. Read response body safely and only once (via res.text()).
 * 2. Safely parse JSON with try/catch, eliminating SyntaxError ("Unexpected token 'A', 'A server e'...").
 * 3. Gracefully handle plain-text errors ("A server error..."), HTML error pages, 404s, 502/503/504s, and empty bodies.
 * 4. Standardize response payload into { success: boolean, message: string, data?: any, error?: string }.
 * 5. Automatically include active session token and Content-Type headers.
 */

import { normalizeError } from './errorNormalizer';
import { auth } from '../services/firebase';

let cachedFbToken: { uid: string; token: string; expiresAt: number } | null = null;

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
  statusCode?: number;
  [key: string]: any;
}

const SESSION_STORAGE_KEY = 'teamacro_auth_session_token';
const LOCAL_STORAGE_KEY = 'teamacro_auth_session_token';

/**
 * Retrieve active session token from memory, sessionStorage, or localStorage
 */
export function getActiveSessionToken(): string | null {
  if (typeof window === 'undefined') return null;

  try {
    const sToken = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (sToken) return sToken;
  } catch {
    // SessionStorage restricted
  }

  try {
    const lToken = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (lToken) return lToken;
  } catch {
    // LocalStorage restricted
  }

  return null;
}

/**
 * Persist active session token
 */
export function setActiveSessionToken(token: string | null): void {
  if (typeof window === 'undefined') return;

  try {
    if (token) {
      sessionStorage.setItem(SESSION_STORAGE_KEY, token);
      localStorage.setItem(LOCAL_STORAGE_KEY, token);
    } else {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    }
  } catch {
    // Storage restricted in sandboxed environment
  }
}

/**
 * Clean and extract human-readable text from HTML or plain-text server error messages
 */
function extractCleanErrorMessage(rawText: string, status: number, statusText: string): string {
  const trimmed = rawText.trim();

  if (!trimmed) {
    return `Server communication error (HTTP ${status || 500}: ${statusText || 'Empty response'}).`;
  }

  // Handle common server gateway / Vercel / Cloud Run plain-text error messages
  if (
    trimmed.startsWith('A server error') ||
    trimmed.includes('server error') ||
    trimmed.startsWith('Internal Server Error')
  ) {
    return 'A server error occurred while processing your request. Please try again or contact system administration.';
  }

  // Handle HTML responses (e.g. 404 / 500 HTML pages)
  if (trimmed.toLowerCase().includes('<!doctype') || trimmed.toLowerCase().includes('<html')) {
    if (status === 404) {
      return 'The requested API service endpoint was not found (HTTP 404).';
    }
    return `The server returned an HTML error response (HTTP ${status || 500}: ${statusText || 'Server Error'}).`;
  }

  // Strip possible inline tags and return clean snippet
  const stripped = trimmed.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  return stripped.length > 180 ? `${stripped.substring(0, 180)}...` : stripped;
}

export interface SafeFetchOptions extends Omit<RequestInit, 'body'> {
  body?: any;
}

/**
 * Safe fetch utility with automatic session injection, non-JSON defense,
 * and standardized response structure.
 */
export async function safeApiFetch<T = any>(
  url: string,
  options: SafeFetchOptions = {}
): Promise<ApiResponse<T>> {
  const token = getActiveSessionToken();

  const headers: Record<string, string> = {
    'Accept': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const isBlob = typeof Blob !== 'undefined' && options.body instanceof Blob;
  const isArrayBuffer = typeof ArrayBuffer !== 'undefined' && options.body instanceof ArrayBuffer;

  let requestBody: BodyInit | null | undefined = undefined;
  if (options.body !== undefined && options.body !== null) {
    if (typeof options.body === 'object' && !isFormData && !isBlob && !isArrayBuffer) {
      requestBody = JSON.stringify(options.body);
      if (!headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
      }
    } else {
      requestBody = options.body;
      if (!headers['Content-Type'] && !isFormData) {
        headers['Content-Type'] = 'application/json';
      }
    }
  }

  let fbIdToken: string | null = null;
  if (token && typeof window !== 'undefined' && auth?.currentUser) {
    let matchesCurrentSession = true;
    try {
      const storedRaw = window.localStorage.getItem('teamacro_auth_current_user');
      if (storedRaw && auth.currentUser.email) {
        const storedUser = JSON.parse(storedRaw);
        if (
          storedUser?.email &&
          String(storedUser.email).toLowerCase() !== String(auth.currentUser.email).toLowerCase()
        ) {
          matchesCurrentSession = false;
        }
      }
    } catch {
      // Ignore storage parse error
    }

    if (matchesCurrentSession) {
      const currentUid = auth.currentUser.uid;
      const now = Date.now();
      if (cachedFbToken && cachedFbToken.uid === currentUid && now < cachedFbToken.expiresAt) {
        fbIdToken = cachedFbToken.token;
      } else {
        try {
          fbIdToken = await auth.currentUser.getIdToken(false);
          if (fbIdToken) {
            cachedFbToken = { uid: currentUid, token: fbIdToken, expiresAt: now + 60_000 };
          }
        } catch {
          // Firebase auth offline or not initialized in this environment
        }
      }
    }
  }

  if (token && fbIdToken) {
    headers['x-firebase-token'] = fbIdToken;
  }
  if (token) {
    headers['x-session-token'] = token;
  }

  if (!headers['Authorization'] && token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let res: Response;
  try {
    const { body, ...restOptions } = options;
    res = await fetch(url, {
      ...restOptions,
      body: requestBody,
      headers,
    });
  } catch (netErr: any) {
    const errorMsg = netErr?.message || 'Network connection failed.';
    return {
      success: false,
      message: 'Unable to connect to the server. Please check your network connection and verify the service is running.',
      error: errorMsg,
      statusCode: 0,
    };
  }

  // Read response text safely ONCE
  let rawText = '';
  try {
    rawText = await res.text();
  } catch (readErr: any) {
    return {
      success: false,
      message: 'Failed to read response from server.',
      error: readErr?.message || 'READ_ERROR',
      statusCode: res.status,
    };
  }

  // Safe JSON Parsing attempt
  let json: any = null;
  let isJson = false;

  if (rawText && rawText.trim().length > 0) {
    try {
      json = JSON.parse(rawText);
      isJson = typeof json === 'object' && json !== null;
    } catch {
      isJson = false;
    }
  }

  // If response is valid JSON
  if (isJson) {
    const success = typeof json.success === 'boolean' ? json.success : res.ok;
    const correlationId =
      typeof json.correlationId === 'string'
        ? json.correlationId
        : typeof json.error === 'object' && json.error && typeof json.error.correlationId === 'string'
        ? json.error.correlationId
        : undefined;
    const errorCode =
      typeof json.error === 'object' && json.error && typeof json.error.code === 'string'
        ? json.error.code
        : typeof json.error === 'string'
        ? json.error
        : undefined;
    const rawMsg =
      (typeof json.error === 'object' && json.error?.message) ||
      json.message ||
      json.error;
    const baseMessage = rawMsg
      ? normalizeError(rawMsg)
      : success
      ? 'Operation completed successfully.'
      : `Request failed (${res.status}).`;
    const message = !success && correlationId && !baseMessage.includes(correlationId)
      ? `${baseMessage} (Ref: ${correlationId})`
      : baseMessage;
    const error = !success
      ? message
      : undefined;

    return {
      ...json,
      success,
      message,
      error,
      errorCode,
      correlationId,
      statusCode: res.status,
      data: json.data !== undefined ? json.data : json,
    };
  }

  // Non-JSON response (e.g. plain-text "A server error...", HTML error page, empty body)
  const cleanMessage = extractCleanErrorMessage(rawText, res.status, res.statusText);

  return {
    success: false,
    message: cleanMessage,
    error: cleanMessage,
    statusCode: res.status,
    isNonJson: true,
    rawText: rawText.slice(0, 300),
  };
}
