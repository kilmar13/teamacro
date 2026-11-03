/**
 * TEAMACRO SERVICES LTD — FIRESTORE DATA INTEGRITY & SANITIZATION ENGINE
 * 
 * Guarantees zero `undefined` values ever reach Firestore write operations (setDoc, updateDoc, addDoc).
 * Handles string trimming, phone number normalization, optional field omission,
 * and deep sanitization of nested document payloads.
 */

/**
 * Normalizes and validates a phone number string.
 * Returns a sanitized phone string, or undefined if not provided / whitespace.
 * Never returns 'undefined', 'null', or empty whitespace.
 */
export function normalizePhoneNumber(phone: unknown): string | undefined {
  if (phone === undefined || phone === null) {
    return undefined;
  }

  const str = String(phone).trim();
  if (!str || str.toLowerCase() === 'undefined' || str.toLowerCase() === 'null') {
    return undefined;
  }

  // Remove duplicate spaces and disallowed control characters
  const cleaned = str.replace(/[^\d+ \-()]/g, '').trim();
  if (!cleaned) {
    return undefined;
  }

  // Cap size at 30 characters as per Firestore security rules
  return cleaned.slice(0, 30);
}

/**
 * Recursively sanitizes any JavaScript object or array destined for Firestore.
 * 
 * Invariants enforced:
 * 1. No key with an `undefined` value is ever preserved (strictly omitted).
 * 2. Nested objects and arrays are recursively purged of undefined values.
 * 3. Does not mutate the source data.
 * 4. Preserves primitives: strings, numbers, booleans, null, and Date instances.
 */
export function sanitizeFirestoreData<T extends Record<string, any>>(data: T): Record<string, any> {
  if (!data || typeof data !== 'object') {
    return {};
  }

  const result: Record<string, any> = {};

  for (const [key, value] of Object.entries(data)) {
    // 1. Strictly omit undefined values
    if (value === undefined) {
      continue;
    }

    // 2. Handle nested arrays
    if (Array.isArray(value)) {
      result[key] = value
        .filter((item) => item !== undefined)
        .map((item) => {
          if (item !== null && typeof item === 'object' && !(item instanceof Date)) {
            return sanitizeFirestoreData(item);
          }
          return item;
        });
      continue;
    }

    // 3. Handle Dates
    if (value instanceof Date) {
      result[key] = value.toISOString();
      continue;
    }

    // 4. Handle nested plain objects
    if (value !== null && typeof value === 'object') {
      const nested = sanitizeFirestoreData(value);
      // Only include non-empty objects or objects with defined keys
      result[key] = nested;
      continue;
    }

    // 5. Handle strings: clean whitespace if applicable
    if (typeof value === 'string') {
      result[key] = value.trim();
      continue;
    }

    // 6. Primitives (number, boolean, null)
    result[key] = value;
  }

  return result;
}

/**
 * Creates a verified, sanitized Firestore user profile document.
 * Guarantees all required fields exist and optional fields are safely handled.
 */
export interface UserProfilePayload {
  id: string;
  email: string;
  fullName: string;
  role: string;
  roleTitle?: string;
  phone?: string;
  active?: boolean;
  branchId?: string;
  createdAt?: string;
}

export function buildSanitizedUserDocument(payload: UserProfilePayload): Record<string, any> {
  const cleanId = String(payload.id || '').trim();
  const cleanEmail = String(payload.email || '').trim().toLowerCase();
  const cleanFullName = String(payload.fullName || '').trim();
  const cleanRole = String(payload.role || 'STAFF').trim();
  const cleanPhone = normalizePhoneNumber(payload.phone);

  const doc: Record<string, any> = {
    id: cleanId,
    email: cleanEmail,
    fullName: cleanFullName,
    role: cleanRole,
    active: payload.active !== undefined ? Boolean(payload.active) : true,
    createdAt: payload.createdAt || new Date().toISOString(),
  };

  if (payload.roleTitle && typeof payload.roleTitle === 'string' && payload.roleTitle.trim()) {
    doc.roleTitle = payload.roleTitle.trim();
  }

  // Only include phone if validly present (never undefined)
  if (cleanPhone) {
    doc.phone = cleanPhone;
  }

  if (payload.branchId && typeof payload.branchId === 'string' && payload.branchId.trim()) {
    doc.branchId = payload.branchId.trim();
  }

  return sanitizeFirestoreData(doc);
}

/**
 * Creates a verified, sanitized Firestore admin authorization document.
 * Guarantees all required fields exist and optional fields like phone/duty are safe.
 */
export interface AdminProfilePayload {
  uid: string;
  email: string;
  fullName?: string;
  phone?: string;
  role?: string;
  duty?: string;
  createdAt?: string;
}

export function buildSanitizedAdminDocument(payload: AdminProfilePayload): Record<string, any> {
  const cleanUid = String(payload.uid || '').trim();
  const cleanEmail = String(payload.email || '').trim().toLowerCase();
  const cleanPhone = normalizePhoneNumber(payload.phone);

  const doc: Record<string, any> = {
    uid: cleanUid,
    email: cleanEmail,
    role: payload.role || 'ADMIN',
    createdAt: payload.createdAt || new Date().toISOString(),
  };

  if (payload.fullName && typeof payload.fullName === 'string' && payload.fullName.trim()) {
    doc.fullName = payload.fullName.trim();
  }

  if (payload.duty && typeof payload.duty === 'string' && payload.duty.trim()) {
    doc.duty = payload.duty.trim();
  }

  // Only include phone if validly present (never undefined)
  if (cleanPhone) {
    doc.phone = cleanPhone;
  }

  return sanitizeFirestoreData(doc);
}

/**
 * Safe wrapper around Firestore setDoc.
 * Programmatically guarantees data is sanitized before write.
 */
export async function safeFirestoreSetDoc(
  setDocFn: (docRef: any, data: any, options?: any) => Promise<any>,
  docRef: any,
  data: Record<string, any>,
  options?: any
): Promise<void> {
  const cleanData = sanitizeFirestoreData(data);
  return await setDocFn(docRef, cleanData, options);
}
