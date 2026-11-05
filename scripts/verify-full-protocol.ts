import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { computeTotpCode } from '../src/server/totp.js';
import {
  mintVerifiedFirebaseIdToken,
  readFirestoreDocument,
  listFirestoreCollection,
  getFirestoreSystemOwnership,
  deleteFirestoreDocument,
  rollbackFirebaseAuthAccount,
  getFirebaseAdminServices,
} from '../src/server/firebaseAdmin.js';

const PORT = 3000;
const BASE_URL = `http://localhost:${PORT}`;

interface ApiResponse<T = any> {
  status: number;
  headers: Headers;
  body: T;
}

async function apiRequest<T = any>(
  path: string,
  options: {
    method?: string;
    body?: any;
    token?: string;
    cookie?: string;
    extraHeaders?: Record<string, string>;
  } = {}
): Promise<ApiResponse<T>> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(options.extraHeaders || {}),
  };

  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (options.token) {
    headers['Authorization'] = `Bearer ${options.token}`;
    headers['X-Session-Token'] = options.token;
  }
  if (options.cookie) {
    headers['Cookie'] = options.cookie;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const text = await res.text();
  let parsed: any = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`Endpoint ${path} returned non-JSON response (HTTP ${res.status}): ${text.slice(0, 200)}`);
  }

  return {
    status: res.status,
    headers: res.headers,
    body: parsed as T,
  };
}

/**
 * Clean up any isolated test artifacts created during verification runs while strictly
 * protecting production records (OWNER_ROOT_3YPAFKI2 and system_ownership).
 */
async function cleanupSyntheticTestArtifacts(createdUids: string[], createdInvitationIds: string[]) {
  for (const uid of createdUids) {
    if (!uid || uid === 'OWNER_ROOT_3YPAFKI2') continue;
    await rollbackFirebaseAuthAccount(uid).catch(() => {});
    await deleteFirestoreDocument('users', uid).catch(() => {});
    await deleteFirestoreDocument('staff', uid).catch(() => {});
    await deleteFirestoreDocument('admins', uid).catch(() => {});
  }

  for (const invId of createdInvitationIds) {
    if (!invId) continue;
    await deleteFirestoreDocument('invitations', invId).catch(() => {});
  }

  // Also sweep any leftover synthetic test records from prior test runs
  const testEmailPattern = /^(staff_protocol_|admin_protocol_|vercel_adm_|dup_staff_|rollback_staff_|rollback_admin_)/i;
  for (const col of ['users', 'staff', 'admins', 'invitations'] as const) {
    const docs = await listFirestoreCollection(col).catch(() => []);
    for (const d of docs) {
      const id = String(d.id || d.uid || '');
      const email = String(d.email || '');
      if (id && id !== 'OWNER_ROOT_3YPAFKI2' && testEmailPattern.test(email)) {
        if (col !== 'invitations') {
          await rollbackFirebaseAuthAccount(id).catch(() => {});
        }
        await deleteFirestoreDocument(col, id).catch(() => {});
      }
    }
  }
}

async function runVerificationSuite() {
  console.log('================================================================================');
  console.log('TEAMACRO SERVICES LTD — PRODUCTION AUTH & FIRESTORE VERIFICATION PROTOCOL');
  console.log('================================================================================\n');

  const createdUids: string[] = [];
  const createdInvitationIds: string[] = [];

  try {
    // -------------------------------------------------------------------------
    // 0. VERCEL SERVERLESS ENTRYPOINT & CJS/ESM DEPENDENCY VERIFICATION
    // -------------------------------------------------------------------------
    console.log('[0/10] Verifying Vercel Serverless Entrypoint (/api/index.ts) & CJS/ESM module resolution...');
    const cjsRequire = createRequire(import.meta.url);
    const jwksRsaPkg = cjsRequire('jwks-rsa/package.json');
    const josePkg = cjsRequire('jose/package.json');
    const jwksRsaMod = cjsRequire('jwks-rsa');
    const joseMod = cjsRequire('jose');
    const fbAdminAuthMod = cjsRequire('firebase-admin/auth');
    assert.equal(typeof jwksRsaMod, 'function', 'jwks-rsa must load cleanly via CommonJS require()');
    assert.equal(typeof joseMod.importJWK, 'function', 'jose must load cleanly via CommonJS require() without ERR_REQUIRE_ESM');
    assert.equal(typeof fbAdminAuthMod.getAuth, 'function', 'firebase-admin/auth must load cleanly via CommonJS require()');
    console.log(`  ✓ Dependency tree verified: jwks-rsa@${jwksRsaPkg.version} -> jose@${josePkg.version} (CJS/ESM compatible)`);

    getFirebaseAdminServices();
    process.env.VERCEL = '1';
    const { default: vercelHandler } = await import('../api/index.js');
    assert.equal(typeof vercelHandler, 'function', 'api/index.ts default export must be a function handler');
    console.log('  ✓ api/index.ts exports a valid serverless request handler.\n');

    // -------------------------------------------------------------------------
    // 1. DEEP HEALTH CHECK & PROTECTED DIAGNOSTICS (/api/health & /api/admin/diagnostics)
    // -------------------------------------------------------------------------
    console.log('[1/10] Verifying /api/health deep Firebase & Firestore checks...');
    const healthRes = await apiRequest('/api/health');
    assert.equal(healthRes.status, 200, `Expected /api/health HTTP 200, got ${healthRes.status}`);
    assert.equal(healthRes.body.status, 'UP', 'Expected /api/health status UP');
    assert.equal(healthRes.body.checks?.backendResponding, true, 'backendResponding must be true');
    assert.equal(healthRes.body.checks?.firebaseAdminInitialized, true, 'firebaseAdminInitialized must be true');
    assert.equal(healthRes.body.checks?.serviceAccountCredentialsValid, true, 'serviceAccountCredentialsValid must be true');
    assert.equal(healthRes.body.checks?.correctFirestoreDatabaseSelected, true, 'correctFirestoreDatabaseSelected must be true');
    assert.equal(healthRes.body.checks?.firestoreConnectivity, true, 'firestoreConnectivity must be true');
    assert.equal(healthRes.body.checks?.systemOwnershipReadable, true, 'systemOwnershipReadable must be true');
    assert.equal(healthRes.body.checks?.authServiceAvailable, true, 'authServiceAvailable must be true');

    // Ensure no sensitive secrets or ownership PII leak in public /api/health
    const rawHealthJson = JSON.stringify(healthRes.body);
    assert.equal(rawHealthJson.includes('PRIVATE KEY'), false, '/api/health must never expose private keys');
    assert.equal(rawHealthJson.includes('eromoseledavidson68@gmail.com'), false, '/api/health must not expose owner email publicly');

    // Verify /api/health returns 503 when a critical dependency is unavailable
    const degradedHealthRes = await apiRequest('/api/health', {
      extraHeaders: { 'x-test-simulate-health-failure': 'firestore' },
    });
    assert.equal(degradedHealthRes.status, 503, 'Expected /api/health to return 503 when Firestore is unavailable');
    assert.equal(degradedHealthRes.body.status, 'DOWN', 'Expected status DOWN when Firestore is unavailable');

    // Verify /api/admin/diagnostics is protected (rejects unauthenticated requests with 401)
    const unauthDiagRes = await apiRequest('/api/admin/diagnostics');
    assert.equal(unauthDiagRes.status, 401, 'Expected unauthenticated /api/admin/diagnostics to return 401');
    console.log('  ✓ /api/health verified all 7 live checks (HTTP 200 UP, 503 on failure) and /api/admin/diagnostics is protected.\n');

    // -------------------------------------------------------------------------
    // 2. REJECTION OF UNVERIFIED OR NON-OWNER SUPER ADMIN LOGIN ATTEMPTS
    // -------------------------------------------------------------------------
    console.log('[2/10] Verifying rejection of unverified or non-owner Super Admin login attempts...');
    // Attempt 2a: Unverified browser-submitted { uid, email } without a Firebase ID token
    const unverifiedSyncRes = await apiRequest('/api/auth/sync-super-admin', {
      method: 'POST',
      body: {
        uid: 'OWNER_ROOT_3YPAFKI2',
        email: 'eromoseledavidson68@gmail.com',
        fullName: 'Unverified Caller',
      },
    });
    assert.equal(
      unverifiedSyncRes.status,
      401,
      `Expected 401 when calling /api/auth/sync-super-admin without verified idToken, got ${unverifiedSyncRes.status}`
    );

    // Attempt 2b: Validly signed Firebase ID token for a non-owner UID attempting to claim Super Admin
    const nonOwnerIdToken = await mintVerifiedFirebaseIdToken('NON_OWNER_TEST_UID_999', {
      ownerEmail: 'intruder.nonowner@teamacro.internal',
    });
    assert.ok(nonOwnerIdToken, 'Failed to mint non-owner test Firebase ID token');
    const nonOwnerSyncRes = await apiRequest('/api/auth/sync-super-admin', {
      method: 'POST',
      token: nonOwnerIdToken,
      body: {
        idToken: nonOwnerIdToken,
      },
    });
    assert.equal(
      nonOwnerSyncRes.status,
      403,
      `Expected 403 when non-owner Firebase token calls /api/auth/sync-super-admin, got ${nonOwnerSyncRes.status}`
    );
    console.log('  ✓ Unverified { uid, email } rejected with 401; non-owner verified token rejected with 403.\n');

    // -------------------------------------------------------------------------
    // 3. SUPER ADMIN LOGIN WITH VERIFIED FIREBASE ID TOKEN & FIRESTORE OWNERSHIP CHECK
    // -------------------------------------------------------------------------
    console.log('[3/10] Verifying Lifetime Super Admin login with verified Firebase ID token & Firestore ownership...');
    const ownership = await getFirestoreSystemOwnership();
    assert.ok(ownership && ownership.isInitialized, 'Firestore system_ownership document must exist and be initialized');
    assert.equal(ownership.ownerUserId, 'OWNER_ROOT_3YPAFKI2', 'Authoritative ownerUserId must be preserved as OWNER_ROOT_3YPAFKI2');

    const ownerIdToken = await mintVerifiedFirebaseIdToken('OWNER_ROOT_3YPAFKI2', {
      ownerEmail: ownership.ownerEmail,
    });
    assert.ok(ownerIdToken, 'Owner Firebase ID token must be non-empty');

    const superAdminSyncRes = await apiRequest('/api/auth/sync-super-admin', {
      method: 'POST',
      token: ownerIdToken,
      body: {
        idToken: ownerIdToken,
      },
    });
    assert.equal(
      superAdminSyncRes.status,
      200,
      `Expected 200 from /api/auth/sync-super-admin with verified owner token, got ${superAdminSyncRes.status}: ${JSON.stringify(superAdminSyncRes.body)}`
    );
    assert.equal(superAdminSyncRes.body.success, true);

    let superAdminToken: string = superAdminSyncRes.body.sessionToken || '';
    if (superAdminSyncRes.body.requireMfa && superAdminSyncRes.body.tempToken) {
      const ownerDoc = await readFirestoreDocument('users', 'OWNER_ROOT_3YPAFKI2');
      const mfaCode = ownerDoc?.totpSecret ? computeTotpCode(String(ownerDoc.totpSecret)) : '';
      assert.ok(mfaCode, 'Expected valid TOTP code for MFA-enabled owner');
      const mfaVerifyRes = await apiRequest('/api/auth/verify-mfa', {
        method: 'POST',
        body: {
          tempToken: superAdminSyncRes.body.tempToken,
          code: mfaCode,
        },
      });
      assert.equal(mfaVerifyRes.status, 200, 'Expected 200 from /api/auth/verify-mfa');
      superAdminToken = mfaVerifyRes.body.sessionToken;
    }

    assert.ok(superAdminToken && superAdminToken.startsWith('tmr_s1_'), 'Super Admin session token must be a signed stateless token');

    // Verify protected /api/admin/diagnostics works for authenticated Super Admin
    const adminDiagRes = await apiRequest('/api/admin/diagnostics', {
      token: superAdminToken,
    });
    assert.equal(adminDiagRes.status, 200, 'Expected 200 from /api/admin/diagnostics for Super Admin');
    assert.equal(adminDiagRes.body.firestore?.systemOwnership?.ownerUserId, 'OWNER_ROOT_3YPAFKI2');
    console.log('  ✓ Lifetime Super Admin authenticated via verified Firebase ID token & Firestore system_ownership.\n');

    // -------------------------------------------------------------------------
    // 4. SESSION PERSISTENCE ACROSS STATELESS SERVERLESS COLD STARTS
    // -------------------------------------------------------------------------
    console.log('[4/10] Verifying session persistence across requests and simulated serverless cold start...');
    const sessionRes = await apiRequest('/api/auth/session', {
      token: superAdminToken,
      extraHeaders: { 'x-test-simulate-cold-start': 'true' },
    });
    assert.equal(sessionRes.status, 200, 'Session must remain valid after serverless cold start');
    assert.equal(sessionRes.body.authenticated, true);
    assert.equal(sessionRes.body.user?.id, 'OWNER_ROOT_3YPAFKI2');
    assert.equal(sessionRes.body.user?.role, 'LIFETIME_SUPER_ADMIN');

    const routeAuthRes = await apiRequest('/api/auth/authorize-route', {
      method: 'POST',
      token: superAdminToken,
      extraHeaders: { 'x-test-simulate-cold-start': 'true' },
      body: { route: '/supa-admin' },
    });
    assert.equal(routeAuthRes.status, 200);
    assert.equal(routeAuthRes.body.allowed, true);
    console.log('  ✓ Signed session token and Firestore session record persisted across simulated cold start.\n');

    // -------------------------------------------------------------------------
    // 5. ACCESS CODE GENERATION & VALIDATION ACROSS SERVERLESS INSTANCES
    // -------------------------------------------------------------------------
    console.log('[5/10] Verifying access code generation and validation across serverless instances...');
    const ts = Date.now();
    const staffEmail = `staff_protocol_${ts}@teamacro.internal`;
    const staffDuty = 'Customer Registration Officer';

    const genStaffCodeRes = await apiRequest('/api/auth/access/generate-code', {
      method: 'POST',
      token: superAdminToken,
      body: {
        email: staffEmail,
        accessType: 'STAFF',
        duty: staffDuty,
      },
    });
    assert.equal(genStaffCodeRes.status, 200, 'Expected 200 from /api/auth/access/generate-code');
    const staffAccessCode = genStaffCodeRes.body.plainCode;
    const staffInvId = genStaffCodeRes.body.invitation?.id;
    assert.ok(staffAccessCode && staffAccessCode.length >= 8, 'Generated access code must be returned');
    if (staffInvId) createdInvitationIds.push(staffInvId);

    // Simulate serverless cold start on the server before verifying the access code
    const verifyCodeRes = await apiRequest('/api/auth/access/verify-code', {
      method: 'POST',
      extraHeaders: { 'x-test-simulate-cold-start': 'true' },
      body: {
        email: staffEmail,
        code: staffAccessCode,
      },
    });
    assert.equal(verifyCodeRes.status, 200, 'Access code must verify across cold-started serverless instances via Firestore');
    assert.equal(verifyCodeRes.body.success, true);
    console.log('  ✓ Access code generated, stored in Firestore, and verified across serverless cold start.\n');

    // -------------------------------------------------------------------------
    // 6. STAFF ACCOUNT CREATION & LIVE FIRESTORE VERIFICATION
    // -------------------------------------------------------------------------
    console.log('[6/10] Verifying Staff account creation (/api/auth/create-staff) and Firestore persistence...');
    const staffPassword = `StfPass#${ts}!`;
    const createStaffRes = await apiRequest('/api/auth/create-staff', {
      method: 'POST',
      token: superAdminToken,
      body: {
        fullName: 'Protocol Verification Staff',
        email: staffEmail,
        phone: '+2348031112233',
        duty: staffDuty,
        accessCode: staffAccessCode,
        initialPassword: staffPassword,
      },
    });
    assert.equal(
      createStaffRes.status,
      201,
      `Expected 201 from /api/auth/create-staff, got ${createStaffRes.status}: ${JSON.stringify(createStaffRes.body)}`
    );
    const staffUid = createStaffRes.body.account?.id;
    assert.ok(staffUid, 'Created staff account must have a Firebase UID');
    createdUids.push(staffUid);
    if (createStaffRes.body.invitation?.id) {
      createdInvitationIds.push(createStaffRes.body.invitation.id);
    }

    // Verify in live Firestore (/users/{uid} and /staff/{uid})
    const [fsStaffUserDoc, fsStaffDoc] = await Promise.all([
      readFirestoreDocument('users', staffUid),
      readFirestoreDocument('staff', staffUid),
    ]);
    assert.ok(fsStaffUserDoc, `Expected users/${staffUid} document in Firestore`);
    assert.ok(fsStaffDoc, `Expected staff/${staffUid} document in Firestore`);
    assert.equal(fsStaffDoc.email, staffEmail);
    assert.equal(fsStaffDoc.role, 'STAFF');
    assert.equal(fsStaffDoc.status, 'active');

    // Simulate cold start on server and verify the new Staff member can log in immediately
    const staffLoginRes = await apiRequest('/api/auth/login', {
      method: 'POST',
      extraHeaders: { 'x-test-simulate-cold-start': 'true' },
      body: {
        identifier: staffEmail,
        password: staffPassword,
      },
    });
    assert.equal(staffLoginRes.status, 200, 'Newly created Staff member must be able to log in after cold start');
    assert.equal(staffLoginRes.body.user?.role, 'STAFF');
    const staffSessionToken = staffLoginRes.body.sessionToken;
    assert.ok(staffSessionToken, 'Staff login must issue a session token');
    console.log(`  ✓ Staff account created (UID: ${staffUid}), verified in Firestore (/users & /staff), and logged in.\n`);

    // -------------------------------------------------------------------------
    // 7. ADMIN ACCOUNT CREATION & LIVE FIRESTORE VERIFICATION + MFA ACROSS COLD START
    // -------------------------------------------------------------------------
    console.log('[7/10] Verifying Admin account creation (/api/auth/create-admin) and Firestore persistence...');
    const adminEmail = `admin_protocol_${ts}@teamacro.internal`;
    const adminDuty = 'Admin / General Branch Administrator';
    const adminPassword = `AdmPass#${ts}!`;

    const genAdminCodeRes = await apiRequest('/api/auth/access/generate-code', {
      method: 'POST',
      token: superAdminToken,
      body: {
        email: adminEmail,
        accessType: 'ADMIN',
        duty: adminDuty,
      },
    });
    assert.equal(genAdminCodeRes.status, 200);
    const adminAccessCode = genAdminCodeRes.body.plainCode;
    if (genAdminCodeRes.body.invitation?.id) {
      createdInvitationIds.push(genAdminCodeRes.body.invitation.id);
    }

    const createAdminRes = await apiRequest('/api/auth/create-admin', {
      method: 'POST',
      token: superAdminToken,
      body: {
        fullName: 'Protocol Verification Admin',
        email: adminEmail,
        phone: '+2348034445566',
        operationalResponsibility: adminDuty,
        accessCode: adminAccessCode,
        initialPassword: adminPassword,
      },
    });
    assert.equal(
      createAdminRes.status,
      201,
      `Expected 201 from /api/auth/create-admin, got ${createAdminRes.status}: ${JSON.stringify(createAdminRes.body)}`
    );
    const adminUid = createAdminRes.body.account?.id;
    assert.ok(adminUid, 'Created admin account must have a Firebase UID');
    createdUids.push(adminUid);
    if (createAdminRes.body.invitation?.id) {
      createdInvitationIds.push(createAdminRes.body.invitation.id);
    }

    const [fsAdminUserDoc, fsAdminDoc] = await Promise.all([
      readFirestoreDocument('users', adminUid),
      readFirestoreDocument('admins', adminUid),
    ]);
    assert.ok(fsAdminUserDoc, `Expected users/${adminUid} document in Firestore`);
    assert.ok(fsAdminDoc, `Expected admins/${adminUid} document in Firestore`);
    assert.equal(fsAdminDoc.email, adminEmail);
    assert.equal(fsAdminDoc.role, 'ADMIN');
    assert.equal(fsAdminDoc.status, 'active');

    // Step 7a: Initial Admin login across simulated cold start
    const adminInitialLoginRes = await apiRequest('/api/auth/login', {
      method: 'POST',
      extraHeaders: { 'x-test-simulate-cold-start': 'true' },
      body: {
        identifier: adminEmail,
        password: adminPassword,
      },
    });
    assert.equal(adminInitialLoginRes.status, 200, 'Newly created Admin must log in across cold start');
    const adminInitialToken = adminInitialLoginRes.body.sessionToken;
    assert.ok(adminInitialToken, 'Admin initial login must return a session token');

    // Step 7b: Enroll MFA on Admin account and confirm across simulated cold start
    const mfaSetupRes = await apiRequest('/api/auth/mfa/setup', {
      method: 'POST',
      token: adminInitialToken,
      extraHeaders: { 'x-test-simulate-cold-start': 'true' },
    });
    assert.equal(mfaSetupRes.status, 200, 'Admin MFA setup must succeed');
    const enrolledTotpSecret = mfaSetupRes.body.secret;
    assert.ok(enrolledTotpSecret, 'MFA setup must return TOTP secret');

    const confirmCode = computeTotpCode(String(enrolledTotpSecret), Math.floor(Date.now() / 1000 / 30));
    assert.ok(confirmCode, 'Must generate valid TOTP code for MFA confirmation');

    const mfaConfirmRes = await apiRequest('/api/auth/mfa/confirm', {
      method: 'POST',
      token: adminInitialToken,
      extraHeaders: { 'x-test-simulate-cold-start': 'true' },
      body: { code: confirmCode },
    });
    assert.equal(mfaConfirmRes.status, 200, 'Admin MFA confirmation must succeed across cold start');

    // Step 7c: Test Admin login + MFA challenge verification across simulated serverless cold start
    const adminLoginRes = await apiRequest('/api/auth/login', {
      method: 'POST',
      extraHeaders: { 'x-test-simulate-cold-start': 'true' },
      body: {
        identifier: adminEmail,
        password: adminPassword,
      },
    });
    assert.equal(adminLoginRes.status, 200, 'Admin login must succeed with MFA challenge');
    assert.equal(adminLoginRes.body.requireMfa, true, 'MFA-enabled Admin account must require MFA');
    const mfaTempToken = adminLoginRes.body.tempToken;
    assert.ok(mfaTempToken, 'Admin login must return signed MFA tempToken');

    // Simulate cold start on server between /api/auth/login and /api/auth/verify-mfa!
    const recoveryCode = Array.isArray(mfaSetupRes.body.recoveryCodes) ? mfaSetupRes.body.recoveryCodes[0] : confirmCode;
    const adminMfaRes = await apiRequest('/api/auth/verify-mfa', {
      method: 'POST',
      extraHeaders: { 'x-test-simulate-cold-start': 'true' },
      body: {
        tempToken: mfaTempToken,
        code: recoveryCode,
      },
    });
    assert.equal(adminMfaRes.status, 200, 'Admin MFA verification must succeed across serverless cold start');
    assert.ok(adminMfaRes.body.sessionToken, 'Admin MFA verification must issue sessionToken');
    console.log(`  ✓ Admin account created (UID: ${adminUid}), verified in Firestore (/users & /admins), and MFA verified across cold start.\n`);

    // -------------------------------------------------------------------------
    // 8. DUPLICATE ACCOUNT PREVENTION (409 CONFLICT)
    // -------------------------------------------------------------------------
    console.log('[8/10] Verifying duplicate account prevention (HTTP 409)...');
    const dupStaffRes = await apiRequest('/api/auth/create-staff', {
      method: 'POST',
      token: superAdminToken,
      body: {
        fullName: 'Duplicate Staff Attempt',
        email: staffEmail,
        phone: '+2348039998877',
        duty: staffDuty,
        accessCode: 'DUPCODE123',
        initialPassword: 'DupPassword#123',
      },
    });
    assert.equal(dupStaffRes.status, 409, `Expected 409 for duplicate staff email, got ${dupStaffRes.status}`);

    const dupAdminRes = await apiRequest('/api/auth/create-admin', {
      method: 'POST',
      token: superAdminToken,
      body: {
        fullName: 'Duplicate Admin Attempt',
        email: adminEmail,
        phone: '+2348039998877',
        operationalResponsibility: adminDuty,
        accessCode: 'DUPADMIN123',
        initialPassword: 'DupPassword#123',
      },
    });
    assert.equal(dupAdminRes.status, 409, `Expected 409 for duplicate admin email, got ${dupAdminRes.status}`);
    console.log('  ✓ Duplicate Staff and Admin emails rejected with HTTP 409 Conflict.\n');

    // -------------------------------------------------------------------------
    // 9. ATOMIC ROLLBACK WHEN FIRESTORE PROFILE WRITE FAILS AFTER FIREBASE AUTH CREATION
    // -------------------------------------------------------------------------
    console.log('[9/10] Verifying atomic rollback when Firestore profile creation fails...');
    const rollbackEmail = `rollback_staff_${ts}@teamacro.internal`;
    const rollbackRes = await apiRequest('/api/auth/create-staff', {
      method: 'POST',
      token: superAdminToken,
      extraHeaders: {
        'x-test-simulate-firestore-failure': 'true',
      },
      body: {
        fullName: 'Rollback Test Staff',
        email: rollbackEmail,
        phone: '+2348037776655',
        duty: staffDuty,
        accessCode: 'RBACK12345',
        initialPassword: 'RollbackPass#123',
      },
    });
    assert.equal(rollbackRes.status, 500, 'Expected HTTP 500 when Firestore write fails');
    assert.equal(rollbackRes.body.rolledBack, true, 'Expected rolledBack: true when Firestore write fails');
    const rolledBackUid = rollbackRes.body.rolledBackAuthUid;
    if (rolledBackUid) {
      const orphanedDoc = await readFirestoreDocument('users', rolledBackUid);
      assert.equal(orphanedDoc, null, 'Rolled back account must not leave a Firestore profile');
    }
    console.log('  ✓ Failed Firestore profile write triggered clean rollback of Firebase Auth account.\n');

    // -------------------------------------------------------------------------
    // 10. SUSPENDED OR REVOKED ACCOUNT REJECTION ACROSS SERVERLESS INSTANCES
    // -------------------------------------------------------------------------
    console.log('[10/10] Verifying suspended account rejection across serverless instances...');
    const suspendRes = await apiRequest('/api/auth/toggle-status', {
      method: 'POST',
      token: superAdminToken,
      body: {
        targetUserId: staffUid,
        status: 'suspended',
      },
    });
    assert.equal(suspendRes.status, 200, 'Expected 200 when suspending staff account');

    // Simulate a different Vercel serverless instance handling the staff member's existing session token
    const suspendedSessionRes = await apiRequest('/api/auth/session', {
      token: staffSessionToken,
      extraHeaders: { 'x-test-simulate-cold-start': 'true' },
    });
    assert.equal(
      suspendedSessionRes.status,
      401,
      `Expected suspended staff member's existing session token to be rejected with 401 across serverless instances, got ${suspendedSessionRes.status}`
    );

    const suspendedLoginRes = await apiRequest('/api/auth/login', {
      method: 'POST',
      extraHeaders: { 'x-test-simulate-cold-start': 'true' },
      body: {
        identifier: staffEmail,
        password: staffPassword,
      },
    });
    assert.equal(
      suspendedLoginRes.status,
      403,
      `Expected suspended staff login attempt to be rejected with 403, got ${suspendedLoginRes.status}`
    );
    console.log('  ✓ Suspended account immediately rejected for both existing sessions (401) and new logins (403) across cold starts.\n');

    console.log('================================================================================');
    console.log('ALL 10 PRODUCTION AUTHENTICATION & FIRESTORE VERIFICATION CHECKS PASSED');
    console.log('================================================================================');
  } finally {
    console.log('\nCleaning up isolated test records from Firebase Auth and Firestore...');
    await cleanupSyntheticTestArtifacts(createdUids, createdInvitationIds);
    const ownerStillIntact = await getFirestoreSystemOwnership();
    assert.equal(
      ownerStillIntact?.ownerUserId,
      'OWNER_ROOT_3YPAFKI2',
      'Production Lifetime Super Admin ownership record must remain untouched'
    );
    console.log('  ✓ Test cleanup complete. Production records (OWNER_ROOT_3YPAFKI2) confirmed intact.');
  }
}

runVerificationSuite().catch((err) => {
  console.error('\n[VERIFICATION SUITE FAILED]:', err);
  process.exit(1);
});
