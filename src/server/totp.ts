import crypto from 'crypto';

// Standard RFC 4648 Base32 alphabet
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Encodes a buffer to a standard base32 string without padding.
 */
export function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

/**
 * Decodes a base32 string to a Buffer.
 */
export function base32Decode(base32: string): Buffer {
  const clean = base32.toUpperCase().replace(/[\s=-]/g, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (let i = 0; i < clean.length; i++) {
    const idx = BASE32_ALPHABET.indexOf(clean[i]);
    if (idx === -1) {
      continue; // Skip invalid characters
    }

    value = (value << 5) | idx;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

/**
 * Generates a 160-bit (20-byte) cryptographically secure random base32 TOTP secret.
 */
export function generateTotpSecret(): { secret: string; uri: string } {
  const randomBytes = crypto.randomBytes(20);
  const secret = base32Encode(randomBytes);
  const issuer = 'TEAMACRO SERVICES LTD';
  const account = 'superadmin@teamacro.ng';
  const uri = `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
  return { secret, uri };
}

/**
 * Computes RFC 6238 6-digit TOTP code for a given time-step.
 */
export function computeTotpCode(secret: string, timeStep: number): string {
  const secretBuffer = base32Decode(secret);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(timeStep));

  const hmac = crypto.createHmac('sha1', secretBuffer);
  hmac.update(counterBuffer);
  const digest = hmac.digest();

  // Dynamic truncation
  const offset = digest[digest.length - 1] & 0x0f;
  const codeInt =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);

  const code = (codeInt % 1000000).toString().padStart(6, '0');
  return code;
}

/**
 * Verifies a 6-digit TOTP code against a secret within a time window of ±1 step (30 seconds).
 * Includes replay protection by tracking consumed steps.
 */
export function verifyTotpCode(
  secret: string,
  code: string,
  consumedSteps: Set<number>,
  currentTimeMs: number = Date.now()
): { valid: boolean; error?: string; step?: number } {
  if (!code || !/^\d{6}$/.test(code.trim())) {
    return { valid: false, error: 'Verification code must be exactly 6 numeric digits.' };
  }

  const cleanCode = code.trim();
  const currentStep = Math.floor(currentTimeMs / 1000 / 30);
  const windowSteps = [currentStep, currentStep - 1, currentStep + 1];

  for (const step of windowSteps) {
    const expected = computeTotpCode(secret, step);
    if (expected === cleanCode) {
      // Replay Attack Protection
      if (consumedSteps.has(step)) {
        return {
          valid: false,
          error: 'Replay Attack Prevented: This time-based one-time code has already been consumed. Please wait for the next 30-second token.',
        };
      }

      // Valid and not replayed
      consumedSteps.add(step);

      // Housekeeping: remove old consumed steps older than 5 minutes
      const minStep = currentStep - 10;
      for (const s of consumedSteps) {
        if (s < minStep) {
          consumedSteps.delete(s);
        }
      }

      return { valid: true, step };
    }
  }

  return { valid: false, error: 'Invalid authenticator code. Check clock synchronization on your device.' };
}

/**
 * Generates 8 cryptographically secure, single-use backup recovery codes.
 */
export function generateRecoveryCodes(): { plainCodes: string[]; hashedCodes: string[] } {
  const plainCodes: string[] = [];
  const hashedCodes: string[] = [];

  for (let i = 0; i < 8; i++) {
    const raw = crypto.randomBytes(5).toString('hex').toUpperCase();
    const formatted = `${raw.substring(0, 5)}-${raw.substring(5, 10)}`;
    const hash = crypto.createHash('sha256').update(formatted).digest('hex');
    plainCodes.push(formatted);
    hashedCodes.push(hash);
  }

  return { plainCodes, hashedCodes };
}
