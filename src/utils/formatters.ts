/**
 * Financial formatters and Lagos timezone utilities
 * Enforces Africa/Lagos (UTC+1, no DST) format and integer kobo precision
 */

/**
 * Formats an integer amount in kobo into formatted Nigerian Naira (NGN)
 * e.g. 2500000 -> "₦25,000.00"
 */
export function formatNaira(kobo: number | bigint | undefined | null, showSymbol = true): string {
  if (kobo === undefined || kobo === null) return showSymbol ? '₦0.00' : '0.00';
  const numericKobo = typeof kobo === 'bigint' ? Number(kobo) : kobo;
  const naira = numericKobo / 100;
  
  const formatted = new Intl.NumberFormat('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(naira);

  return showSymbol ? `₦${formatted}` : formatted;
}

/**
 * Converts user input naira string or float into exact integer kobo
 * e.g. "2,500.50" -> 250050
 */
export function nairaToKobo(input: string | number): number {
  if (typeof input === 'number') {
    return Math.round(input * 100);
  }
  const clean = input.replace(/[^0-9.]/g, '');
  if (!clean || isNaN(Number(clean))) return 0;
  return Math.round(parseFloat(clean) * 100);
}

/**
 * Converts kobo integer to decimal naira number
 */
export function koboToNaira(kobo: number): number {
  return kobo / 100;
}

/**
 * Formats ISO date string in Africa/Lagos timezone (UTC+1)
 * e.g. "22 Oct 2026, 10:15 AM WAT"
 */
export function formatLagosDate(isoString?: string | null, includeTime = true): string {
  if (!isoString) return '—';
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;

    const options: Intl.DateTimeFormatOptions = {
      timeZone: 'Africa/Lagos',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      ...(includeTime ? { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true } : {}),
    };

    return new Intl.DateTimeFormat('en-GB', options).format(date);
  } catch {
    return isoString;
  }
}

/**
 * Formats a short Lagos date for cards/tables
 * e.g. "22 Oct 2026"
 */
export function formatLagosDateShort(isoString?: string | null): string {
  return formatLagosDate(isoString, false);
}

/**
 * Masks 10-digit account number (e.g. "1023456789" -> "102••••789")
 */
export function maskAccountNumber(num?: string | null): string {
  if (!num) return '—';
  if (num.length < 8) return num;
  return `${num.slice(0, 3)}••••${num.slice(-3)}`;
}

/**
 * Masks 11-digit BVN or NIN (e.g. "22334455667" -> "223•••••667")
 */
export function maskIdentity(id?: string | null): string {
  if (!id) return '—';
  if (id.length < 8) return id;
  return `${id.slice(0, 3)}•••••${id.slice(-3)}`;
}

/**
 * Generates an authoritative financial transaction reference
 * e.g. "TRF-20261022-8F92A1"
 */
export function generateReference(prefix = 'TRF'): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const randomHex = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}-${year}${month}${day}-${randomHex}`;
}

/**
 * Generates a standard 10-digit NUBAN style account number
 */
export function generateNuban(prefix = '20'): string {
  const middle = Math.floor(1000000 + Math.random() * 9000000).toString();
  return `${prefix}${middle.slice(0, 7)}${Math.floor(Math.random() * 10)}`;
}

/**
 * Validates a 10-digit NUBAN format
 */
export function isValidNuban(accountNumber: string): boolean {
  return /^\d{10}$/.test(accountNumber.trim());
}
