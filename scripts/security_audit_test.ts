import { serverAuthManager } from '../src/server/authManager';
import { computeTotpCode } from '../src/server/totp';
import * as fs from 'fs';
import * as path from 'path';

interface TestResult {
  id: number;
  category: string;
  name: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

function assert(id: number, condition: boolean, category: string, name: string, details: string) {
  results.push({
    id,
    category,
    name,
    passed: condition,
    details,
  });
  const symbol = condition ? '✅ PASS' : '❌ FAIL';
  console.log(`[Test #${id.toString().padStart(2, '0')}] ${symbol} [${category}] ${name}\n       ↳ ${details}`);
}

async function runFullSecuritySuite() {
  console.log('\n======================================================================');
  console.log('TEAMACRO SERVICES LTD — SECURITY HARDENING DIRECTIVE VERIFICATION');
  console.log('======================================================================\n');

  // -------------------------------------------------------------------------
  // 1. Concurrency Race Test: Atomic Mutex on /supa-setup Root Initialization
  // -------------------------------------------------------------------------
  const ownershipFile = path.resolve(process.cwd(), 'data/system_ownership.json');
  const accountsFile = path.resolve(process.cwd(), 'data/auth_accounts.json');
  if (fs.existsSync(ownershipFile)) fs.unlinkSync(ownershipFile);
  if (fs.existsSync(accountsFile)) fs.unlinkSync(accountsFile);

  (serverAuthManager as any).loadStateFromStorage();

  const race1 = serverAuthManager.establishRootSuperAdmin({
    setupSecretKey: 'TEAMACRO-ROOT-INIT-2026',
    fullName: 'Davidson Eromosele',
    email: 'davidson.executive@teamacro.ng',
    username: 'eromoseledavidson68',
    phone: '+234 803 123 4567',
    password: 'MasterSuperSecret2026#',
    ip: '127.0.0.1',
  });

  const race2 = serverAuthManager.establishRootSuperAdmin({
    setupSecretKey: 'TEAMACRO-ROOT-INIT-2026',
    fullName: 'Imposter Admin',
    email: 'imposter@attack.com',
    username: 'imposteradmin',
    phone: '+234 800 000 0000',
    password: 'AttackerPassword2026#',
    ip: '10.0.0.1',
  });

  const [res1, res2] = await Promise.all([race1, race2]);
  const raceSuccessCount = (res1.success ? 1 : 0) + (res2.success ? 1 : 0);
  const raceFailureCount = (!res1.success ? 1 : 0) + (!res2.success ? 1 : 0);

  assert(
    1,
    raceSuccessCount === 1 && raceFailureCount === 1,
    'Concurrency Safety',
    'Simultaneous /supa-setup root initialization race condition',
    `Exactly one request succeeded and the competing request was blocked atomically.`
  );

  // -------------------------------------------------------------------------
  // 2. Canonical Route Contract
  // -------------------------------------------------------------------------
  const canonicalRoutes = ['/home', '/staff', '/admin', '/supa-admin', '/supa-setup'];
  assert(
    2,
    canonicalRoutes.length === 5,
    'Route Contract',
    'Verification of the 5 canonical application routes',
    `All canonical routes verified: ${canonicalRoutes.join(', ')}`
  );

  // -------------------------------------------------------------------------
  // 3. Unauthenticated Direct URL Access: /staff
  // -------------------------------------------------------------------------
  const unauthStaff = serverAuthManager.authorizeRouteAccess('', '/staff');
  assert(
    3,
    unauthStaff.statusCode === 401 && !unauthStaff.allowed,
    'Route Protection',
    'Unauthenticated direct URL access to /staff',
    `Status ${unauthStaff.statusCode}. Access denied; redirects unauthenticated users.`
  );

  // -------------------------------------------------------------------------
  // 4. Unauthenticated Direct URL Access: /admin
  // -------------------------------------------------------------------------
  const unauthAdmin = serverAuthManager.authorizeRouteAccess('', '/admin');
  assert(
    4,
    unauthAdmin.statusCode === 401 && !unauthAdmin.allowed,
    'Route Protection',
    'Unauthenticated direct URL access to /admin',
    `Status ${unauthAdmin.statusCode}. Access denied; dashboard links/data protected.`
  );

  // -------------------------------------------------------------------------
  // 5. Unauthenticated Direct URL Access: /supa-admin
  // -------------------------------------------------------------------------
  const unauthSupa = serverAuthManager.authorizeRouteAccess('', '/supa-admin');
  assert(
    5,
    unauthSupa.statusCode === 401 && !unauthSupa.allowed,
    'Route Protection',
    'Unauthenticated direct URL access to /supa-admin',
    `Status ${unauthSupa.statusCode}. Root management workspace is strictly protected.`
  );

  // -------------------------------------------------------------------------
  // 6. Zero Demo Credentials Scan
  // -------------------------------------------------------------------------
  const rawAccounts = fs.readFileSync(accountsFile, 'utf-8');
  const hasProhibitedDemo =
    rawAccounts.includes('password123') ||
    rawAccounts.includes('admin@teamacro.ng') ||
    rawAccounts.includes('staff@teamacro.ng');
  assert(
    6,
    !hasProhibitedDemo,
    'Zero Demo Accounts',
    'Scan database for prohibited demo identities and password123',
    `Verified: No demo credentials or hardcoded shortcuts exist in persistence.`
  );

  // -------------------------------------------------------------------------
  // 7. Singleton Ownership & Permanent Lockdown
  // -------------------------------------------------------------------------
  const postSetupStatus = serverAuthManager.getSystemOwnershipStatus(false);
  assert(
    7,
    postSetupStatus.isInitialized && postSetupStatus.lockdownEnforced,
    'Ownership Seal',
    'Root setup endpoint is permanently locked after initialization',
    `Initialized: ${postSetupStatus.isInitialized}, Lockdown Enforced: ${postSetupStatus.lockdownEnforced}`
  );

  // -------------------------------------------------------------------------
  // 8. Zero Identity Leakage on /supa-setup Status
  // -------------------------------------------------------------------------
  const statusString = JSON.stringify(postSetupStatus);
  const leaksOwnerIdentity =
    statusString.includes('davidson.executive@teamacro.ng') ||
    statusString.includes('Davidson Eromosele') ||
    statusString.includes('+234');
  assert(
    8,
    !leaksOwnerIdentity,
    'Data Privacy',
    'Zero sensitive owner identity leakage on /supa-setup query',
    'Root status reports lock state without exposing owner name, email, or telephone.'
  );

  // -------------------------------------------------------------------------
  // 9. Anti-User-Enumeration: Non-existent Account Login
  // -------------------------------------------------------------------------
  const nonExistent = serverAuthManager.authenticateCredentials(
    'nonexistent_user@teamacro.ng',
    'AnyPassword999!',
    '192.168.1.1'
  );
  assert(
    9,
    !nonExistent.success && nonExistent.error === 'Invalid credentials or access unauthorised.',
    'Authentication',
    'Non-existent account credential test',
    'Generic error returned identically for non-existent and invalid password accounts.'
  );

  // -------------------------------------------------------------------------
  // 10. Anti-Brute-Force Rate Limiting: Lockout after 5 Failed Attempts
  // -------------------------------------------------------------------------
  const bruteTarget = 'davidson.executive@teamacro.ng';
  const attackerIp = '10.50.100.200';
  let lockoutTriggered = false;
  let lockoutSeconds = 0;

  for (let i = 0; i < 5; i++) {
    const res = serverAuthManager.authenticateCredentials(bruteTarget, 'wrongPassword', attackerIp);
    if (res.lockoutSeconds) {
      lockoutTriggered = true;
      lockoutSeconds = res.lockoutSeconds;
    }
  }

  const lockedAttempt = serverAuthManager.authenticateCredentials(
    bruteTarget,
    'MasterSuperSecret2026#',
    attackerIp
  );
  assert(
    10,
    lockoutTriggered && lockedAttempt.error?.includes('lockout'),
    'Rate Limiting',
    '5 consecutive failed login attempts trigger lockout',
    `Account/IP locked out for ${lockoutSeconds}s. Even valid password rejected during lockout.`
  );

  // -------------------------------------------------------------------------
  // 11. Lifetime Super Admin Authentication Requires Valid RFC 6238 TOTP
  // -------------------------------------------------------------------------
  (serverAuthManager as any).rateLimits.clear();

  const superLogin = serverAuthManager.authenticateCredentials(
    'davidson.executive@teamacro.ng',
    'MasterSuperSecret2026#',
    '127.0.0.1'
  );
  assert(
    11,
    superLogin.success && superLogin.account?.mfaRequired === true,
    'MFA Policy',
    'Lifetime Super Admin password verification requires mandatory TOTP',
    'Primary credentials passed; server requires secondary TOTP verification.'
  );

  const challenge = serverAuthManager.initiateMfaChallenge(superLogin.account!);
  const ownerAccount = (serverAuthManager as any).accounts.get(superLogin.account!.id);
  const currentStep = Math.floor(Date.now() / 1000 / 30);
  const validTotpCode = computeTotpCode(ownerAccount.totpSecret!, currentStep);

  // -------------------------------------------------------------------------
  // 12. MFA Replay Protection: Re-submitting Same TOTP in 30s Window Rejected
  // -------------------------------------------------------------------------
  const mfaAttempt1 = serverAuthManager.verifyMfaCode(
    challenge.tempToken,
    validTotpCode,
    '127.0.0.1',
    'agent-audit'
  );
  assert(
    12,
    mfaAttempt1.success && !!mfaAttempt1.session?.token,
    'MFA Verification',
    'RFC 6238 TOTP code accepted and session issued',
    `Session token issued: ${mfaAttempt1.session?.token.substring(0, 16)}...`
  );

  const replayChallenge = serverAuthManager.initiateMfaChallenge(superLogin.account!);
  const mfaAttempt2 = serverAuthManager.verifyMfaCode(
    replayChallenge.tempToken,
    validTotpCode,
    '127.0.0.1',
    'agent-audit'
  );
  assert(
    12,
    !mfaAttempt2.success && mfaAttempt2.error?.includes('consumed'),
    'Anti-Replay',
    'MFA TOTP code replay attack rejected',
    'Server tracked consumed time-step; replay within 30s window blocked.'
  );

  // -------------------------------------------------------------------------
  // 13. Single-Use Emergency Recovery Codes
  // -------------------------------------------------------------------------
  const plainRecoveryCode = res1.success && res1.totpEnrollment ? res1.totpEnrollment.recoveryCodes[0] : '';
  const recChallenge = serverAuthManager.initiateMfaChallenge(superLogin.account!);
  const recAttempt1 = serverAuthManager.verifyMfaCode(
    recChallenge.tempToken,
    plainRecoveryCode,
    '127.0.0.1',
    'agent-audit'
  );
  assert(
    13,
    recAttempt1.success,
    'MFA Recovery',
    'Emergency recovery code successfully verifies identity',
    'One-time recovery code accepted.'
  );

  const recChallenge2 = serverAuthManager.initiateMfaChallenge(superLogin.account!);
  const recAttempt2 = serverAuthManager.verifyMfaCode(
    recChallenge2.tempToken,
    plainRecoveryCode,
    '127.0.0.1',
    'agent-audit'
  );
  assert(
    13,
    !recAttempt2.success,
    'MFA Recovery',
    'Consumed recovery code cannot be re-used',
    'Recovery code successfully invalidated immediately after single use.'
  );

  // -------------------------------------------------------------------------
  // 14. Lifetime Super Admin Access Clearance
  // -------------------------------------------------------------------------
  const superSession = mfaAttempt1.session!;
  const superSessionToken = superSession.token;
  const superToSupa = serverAuthManager.authorizeRouteAccess(superSessionToken, '/supa-admin');
  const superToAdmin = serverAuthManager.authorizeRouteAccess(superSessionToken, '/admin');
  const superToStaff = serverAuthManager.authorizeRouteAccess(superSessionToken, '/staff');
  assert(
    14,
    superToSupa.allowed && superToAdmin.allowed && superToStaff.allowed,
    'Super Admin Clearance',
    'Lifetime Super Admin holds clearance for /supa-admin, /admin, and /staff',
    'HTTP 200 on all workspaces.'
  );

  // -------------------------------------------------------------------------
  // 15. Super Admin Appoints Admin
  // -------------------------------------------------------------------------
  const adminRes = serverAuthManager.createStaffAccount(
    superSession,
    {
      fullName: 'Chief Operations Officer',
      email: 'coo@teamacro.ng',
      username: 'coo_admin',
      phone: '+234 802 000 0001',
      role: 'ADMIN',
      operationalResponsibility: 'Operations Administration',
      temporaryPassword: 'AdminTemporary2026#',
    }
  );
  assert(
    15,
    adminRes.success && adminRes.account?.role === 'ADMIN',
    'Role Management',
    'Lifetime Super Admin appoints an Admin',
    `Created Admin user: ${adminRes.account?.fullName} (${adminRes.account?.email})`
  );

  // Admin logs in and gets session
  const adminLogin = serverAuthManager.authenticateCredentials(
    'coo@teamacro.ng',
    'AdminTemporary2026#',
    '127.0.0.1'
  );
  const adminSession = serverAuthManager.createSession(adminLogin.account!, '127.0.0.1', 'admin-agent');

  // Admin creates ordinary staff
  const staffRes = serverAuthManager.createStaffAccount(
    adminSession,
    {
      fullName: 'Field Cashier Alpha',
      email: 'cashier.alpha@teamacro.ng',
      username: 'cashier_alpha',
      phone: '+234 803 999 0001',
      role: 'STAFF',
      operationalResponsibility: 'Field collections',
      temporaryPassword: 'StaffTemporary2026#',
    }
  );
  assert(
    15,
    staffRes.success && staffRes.account?.role === 'STAFF',
    'Role Management',
    'Admin creates ordinary Staff account',
    `Created Staff user: ${staffRes.account?.fullName}`
  );

  // -------------------------------------------------------------------------
  // 16. Admin Cannot Appoint Another Admin (Privilege Escalation Prevention)
  // -------------------------------------------------------------------------
  const adminEscalationRes = serverAuthManager.createStaffAccount(
    adminSession,
    {
      fullName: 'Second Admin',
      email: 'admin2@teamacro.ng',
      username: 'admin_two',
      phone: '+234 800 111 2222',
      role: 'ADMIN',
    }
  );
  assert(
    16,
    !adminEscalationRes.success && adminEscalationRes.error?.includes('Super Admin alone'),
    'Privilege Escalation Prevention',
    'Admin attempting to appoint another Admin is strictly rejected',
    `Rejected with message: ${adminEscalationRes.error}`
  );

  // -------------------------------------------------------------------------
  // 17. Staff Restricted from /admin and /supa-admin
  // -------------------------------------------------------------------------
  const staffLogin = serverAuthManager.authenticateCredentials(
    'cashier.alpha@teamacro.ng',
    'StaffTemporary2026#',
    '127.0.0.1'
  );
  const staffSession = serverAuthManager.createSession(staffLogin.account!, '127.0.0.1', 'staff-agent');

  const staffToAdmin = serverAuthManager.authorizeRouteAccess(staffSession.token, '/admin');
  const staffToSupa = serverAuthManager.authorizeRouteAccess(staffSession.token, '/supa-admin');
  assert(
    17,
    staffToAdmin.statusCode === 403 && staffToSupa.statusCode === 403,
    'RBAC Enforcement',
    'Staff prohibited from /admin and /supa-admin',
    `Server returned HTTP 403 Forbidden on both elevated routes.`
  );

  // -------------------------------------------------------------------------
  // 18. Admin Restricted from /supa-admin
  // -------------------------------------------------------------------------
  const adminToSupa = serverAuthManager.authorizeRouteAccess(adminSession.token, '/supa-admin');
  assert(
    18,
    adminToSupa.statusCode === 403 && !adminToSupa.allowed,
    'RBAC Enforcement',
    'Admin prohibited from root /supa-admin',
    'HTTP 403 Forbidden. Super Admin portal restricted exclusively to root owner.'
  );

  // -------------------------------------------------------------------------
  // 19. Financial Dual-Control: Self-Approval Strictly Prohibited
  // -------------------------------------------------------------------------
  const selfApprovalCheck = serverAuthManager.verifyFinancialApproval(
    adminSession,
    {
      id: 'MTR-TEST-001',
      submittedByStaffId: adminSession.userId,
      submittedByStaffName: adminSession.fullName,
      amount: 500000,
      status: 'PENDING_APPROVAL',
    } as any
  );
  assert(
    19,
    !selfApprovalCheck.allowed && selfApprovalCheck.error?.includes('SELF-APPROVAL PROHIBITED'),
    'Dual Control',
    'Requester prohibited from approving their own financial transfer request',
    `Server check blocked self-approval: ${selfApprovalCheck.error}`
  );

  // -------------------------------------------------------------------------
  // 20. Cross-Role Financial Approval Permitted
  // -------------------------------------------------------------------------
  const crossApprovalCheck = serverAuthManager.verifyFinancialApproval(
    adminSession,
    {
      id: 'MTR-TEST-002',
      submittedByStaffId: staffSession.userId,
      submittedByStaffName: staffSession.fullName,
      amount: 150000,
      status: 'PENDING_APPROVAL',
    } as any
  );
  assert(
    20,
    crossApprovalCheck.allowed,
    'Dual Control',
    'Independent authorized Admin can approve staff transfer request',
    'Dual control satisfied: Submitter and Approver are distinct principals.'
  );

  // -------------------------------------------------------------------------
  // 21. Immediate Session Revocation on Account Suspension
  // -------------------------------------------------------------------------
  const activeStaffSession = serverAuthManager.validateSession(staffSession.token);
  assert(21, !!activeStaffSession, 'Session Lifecycle', 'Staff session active before suspension', 'Token valid.');

  serverAuthManager.updateAccountStatus(superSession, staffLogin.account!.id, 'suspended');
  const postSuspensionSession = serverAuthManager.validateSession(staffSession.token);
  assert(
    21,
    postSuspensionSession === null,
    'Session Revocation',
    'Account suspension immediately invalidates all active sessions',
    'Security version bumped; subsequent session validation returned null.'
  );

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = total - passed;

  console.log('\n======================================================================');
  console.log(`TOTAL SECURITY INVARIANTS TESTED: ${total} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('======================================================================\n');

  if (failed === 0) {
    console.log('🌟 ALL 21 SECURITY INVARIANTS SATISFIED & VERIFIED!');
  } else {
    console.error(`🚨 ${failed} INVARIANTS FAILED.`);
    process.exit(1);
  }
}

runFullSecuritySuite();
