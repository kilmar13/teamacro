import { serverAuthManager } from '../src/server/authManager';
import { computeTotpCode } from '../src/server/totp';

async function runTests() {
  console.log('\n======================================================================');
  console.log('TEAMACRO SERVICES LTD — /supa-setup & /supa-admin INTEGRATION SUITE');
  console.log('======================================================================\n');

  let passed = 0;
  let failed = 0;

  function test(name: string, ok: boolean, msg: string) {
    if (ok) {
      console.log(`✅ PASS: ${name} -> ${msg}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${name} -> ${msg}`);
      failed++;
    }
  }

  // 1. Root ownership status verification
  const status = serverAuthManager.getSystemOwnershipStatus();
  test(
    '1. Setup Status Check',
    status.isInitialized === true && status.status === 'INITIALIZED' && status.lockdownEnforced === true,
    `Status=${status.status}, isInitialized=${status.isInitialized}, Owner=${status.ownerEmail}`
  );

  // 2. Reject re-initialization on /supa-setup (Lockdown Guarantee)
  const attemptReinit = await serverAuthManager.setupCreateAccount({
    fullName: 'Intruder Attacker',
    email: 'intruder@unauthorized.com',
    password: 'Password123!@#',
    ip: '127.0.0.1',
  });
  test(
    '2. Root Lockdown Enforcement on /supa-setup',
    attemptReinit.success === false && !!attemptReinit.error?.includes('SEALED'),
    `Blocked attempt with message: "${attemptReinit.error}"`
  );

  // 3. Separation of Portals: Route Authorization Check
  // Unauthenticated access to /supa-admin should be denied (401)
  const unauthSupa = serverAuthManager.authorizeRouteAccess('invalid_token', '/supa-admin');
  test(
    '3a. Protected /supa-admin denies unauthenticated requests',
    unauthSupa.allowed === false && unauthSupa.statusCode === 401,
    `StatusCode=${unauthSupa.statusCode}, Allowed=${unauthSupa.allowed}`
  );

  // Public /supa-setup must allow access so user sees either registration or lockdown banner
  const setupRoute = serverAuthManager.authorizeRouteAccess(undefined, '/supa-setup');
  test(
    '3b. Canonical /supa-setup accessible for SPA presentation',
    setupRoute.allowed === true && setupRoute.statusCode === 200,
    `StatusCode=${setupRoute.statusCode}, Allowed=${setupRoute.allowed}`
  );

  // 4. Authenticate Super Admin with MFA requirement
  const rootLogin = serverAuthManager.authenticateCredentials(
    'davidson.executive@teamacro.ng',
    'MasterSuperSecret2026#',
    '127.0.0.1'
  );
  test(
    '4a. Super Admin credentials verified',
    rootLogin.success === true && !!rootLogin.account,
    `Super Admin authenticated successfully, ID=${rootLogin.account?.id}`
  );

  // 4b. MFA Challenge generation
  const mfaChallenge = serverAuthManager.initiateMfaChallenge(rootLogin.account!);
  test(
    '4b. Mandatory MFA challenge initiated for Super Admin',
    !!mfaChallenge.tempToken && mfaChallenge.expiresInSeconds > 0,
    `TempToken=${mfaChallenge.tempToken.substring(0, 10)}..., Masked=${mfaChallenge.maskedDestination}`
  );

  // 4c. Verify valid TOTP code
  const currentStep = Math.floor(Date.now() / 1000 / 30);
  const validCode = computeTotpCode(rootLogin.account!.totpSecret!, currentStep);
  const mfaResult = serverAuthManager.verifyMfaCode(
    mfaChallenge.tempToken,
    validCode,
    '127.0.0.1',
    'TestRunner/1.0'
  );
  test(
    '4c. RFC 6238 TOTP verification grants Lifetime Super Admin session',
    mfaResult.success === true && mfaResult.session?.role === 'LIFETIME_SUPER_ADMIN',
    `SessionToken=${mfaResult.session?.token.substring(0, 10)}..., Role=${mfaResult.session?.role}`
  );

  const superAdminSessionToken = mfaResult.session?.token;

  // 5. Authorize Super Admin to /supa-admin, /admin, and /staff
  const checkSupaAuth = serverAuthManager.authorizeRouteAccess(superAdminSessionToken, '/supa-admin');
  test(
    '5a. Super Admin cleared for /supa-admin',
    checkSupaAuth.allowed === true && checkSupaAuth.statusCode === 200,
    `Allowed=${checkSupaAuth.allowed}, StatusCode=${checkSupaAuth.statusCode}`
  );

  // 6. Access Code Generation via /api/auth/access/generate-code
  const codeResult = serverAuthManager.generateAccessCode(mfaResult.session!, {
    accessType: 'Staff',
    duty: 'Loan Officer',
  });
  test(
    '6. Access Code Generation for Staff',
    codeResult.success === true && !!codeResult.code?.startsWith('TM-STF-'),
    `Generated Code=${codeResult.code}`
  );

  // 7. Give Access Flow: Granting Backend Access to a Staff Officer (e.g. Loan Officer)
  const testStaffEmail = `officer.test.${Date.now()}@teamacro.ng`;
  const grantResult = serverAuthManager.giveAccess(
    mfaResult.session!,
    {
      email: testStaffEmail,
      accessType: 'Staff',
      duty: 'Loan Officer',
      code: codeResult.code!,
      fullName: 'Bolanle Balogun',
      phone: '+234 803 999 1122',
    }
  );
  test(
    '7. Give Access creates authorized account with correct duty',
    grantResult.success === true && grantResult.record?.duty === 'Loan Officer' && grantResult.record?.accessType === 'Staff',
    `Created Officer=${grantResult.record?.fullName}, Role=${grantResult.record?.role}, Duty=${grantResult.record?.duty}`
  );

  // 8. Granular Permissions Update
  const updatePermResult = serverAuthManager.updateUserPermissions(
    mfaResult.session!,
    grantResult.record!.id,
    {
      manage_customers: true,
      manage_loans: true,
      collect_payments: false,
      ledger_posting: false,
      approve_transfers: false,
      audit_inspection: false,
      cms_rates: false,
    }
  );
  test(
    '8. Granular permissions update enforced',
    updatePermResult.success === true,
    `Updated permissions successfully for user ${grantResult.record!.id}`
  );

  // 9. All 6 Core Staff Positions Mapped Correctly
  const coreDuties = [
    'Customer Registration Officer',
    'Payment Collection Officer',
    'Loan Officer',
    'Accounts Officer',
    'Operations Manager',
    'Auditor / Read-Only User',
  ];
  let allMapped = true;
  for (const duty of coreDuties) {
    const role = serverAuthManager.mapDutyToRole(duty);
    const perms = serverAuthManager.getDefaultPermissionsForDuty(duty);
    if (!role || !perms) {
      allMapped = false;
      break;
    }
  }
  test(
    '9. 6 Core Staff Positions and Granular Defaults Verified',
    allMapped,
    'All 6 positions mapped to specific roles and granular permissions'
  );

  // 10. Access Invitations List
  const invitations = serverAuthManager.getAccessInvitations(mfaResult.session!);
  test(
    '10. Active invitations retrieval',
    Array.isArray(invitations) && invitations.length > 0,
    `Found ${invitations.length} recorded backend invitations`
  );

  console.log('\n======================================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
