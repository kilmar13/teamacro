/**
 * TEAMACRO SERVICES LTD — ZERO-GUESSWORK AUTHENTICATION & VERCEL ACCOUNT CREATION PROTOCOL
 * Comprehensive Acceptance & Route Verification Suite
 */

import { normalizeError } from '../src/utils/errorNormalizer';
import { safeApiFetch } from '../src/utils/apiClient';
import { computeTotpCode } from '../src/server/totp';

const BASE_URL = 'http://localhost:3000';

interface TestResult {
  name: string;
  category: string;
  status: 'PASS' | 'FAIL' | 'BLOCKED';
  evidence: string;
}

const results: TestResult[] = [];

function record(name: string, category: string, status: 'PASS' | 'FAIL' | 'BLOCKED', evidence: string) {
  results.push({ name, category, status, evidence });
  console.log(`[${status}] ${name} -> ${evidence}`);
}

async function runAcceptanceSuite() {
  console.log('================================================================');
  console.log('TEAMACRO SERVICES LTD — PROTOCOL & VERCEL ROUTE TEST SUITE');
  console.log('================================================================\n');

  // 0a. Public /home loads
  const homeRes = await fetch(`${BASE_URL}/home`);
  const homeHtml = await homeRes.text();
  const homeOk = homeRes.status === 200 && homeHtml.includes('<div id="root">');
  record(
    'Public /home loads',
    'Frontend Routing',
    homeOk ? 'PASS' : 'FAIL',
    `GET /home -> Status ${homeRes.status} (${homeHtml.length} bytes)`
  );

  // 0b. /supa-admin login page loads
  const supaPageRes = await fetch(`${BASE_URL}/supa-admin`);
  const supaPageHtml = await supaPageRes.text();
  const supaPageOk = supaPageRes.status === 200 && supaPageHtml.includes('<div id="root">');
  record(
    '/supa-admin login page loads',
    'Frontend Routing',
    supaPageOk ? 'PASS' : 'FAIL',
    `GET /supa-admin -> Status ${supaPageRes.status} (${supaPageHtml.length} bytes)`
  );

  // Verify forged UID with Super Admin email is rejected (email alone never grants LIFETIME_SUPER_ADMIN)
  const forgedSyncRes = await fetch(`${BASE_URL}/api/auth/sync-super-admin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      uid: 'FORGED_UID_NOT_IN_SYSTEM_OWNERSHIP',
      email: 'eromoseledavidson68@gmail.com',
      fullName: 'Forged Caller',
    }),
  });
  const forgedRejectedOk = forgedSyncRes.status === 403;

  // Authenticate Lifetime Super Admin using verified Firestore system_ownership UID (OWNER_ROOT_3YPAFKI2)
  const rootSyncRes = await fetch(`${BASE_URL}/api/auth/sync-super-admin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      uid: 'OWNER_ROOT_3YPAFKI2',
      email: 'eromoseledavidson68@gmail.com',
      fullName: 'David Eromosele',
      phone: '+234 800 000 0001',
    }),
  });
  const rootData = await rootSyncRes.json();
  const superAdminToken = rootData.sessionToken;

  if (!superAdminToken) {
    console.error('Cannot proceed without Super Admin token');
    process.exit(1);
  }

  const supaCredsOk =
    forgedRejectedOk &&
    rootSyncRes.status === 200 &&
    rootData.success === true &&
    rootData.user?.id === 'OWNER_ROOT_3YPAFKI2' &&
    rootData.user?.email === 'eromoseledavidson68@gmail.com' &&
    rootData.user?.role === 'LIFETIME_SUPER_ADMIN';
  record(
    'Valid Super Admin credentials are processed without server error',
    'Super Admin Authentication',
    supaCredsOk ? 'PASS' : 'FAIL',
    `Status ${rootSyncRes.status}, uid=${rootData.user?.id}, email=${rootData.user?.email}, role=${rootData.user?.role}, forgedUidStatus=${forgedSyncRes.status}`
  );

  const supaDashRes = await fetch(`${BASE_URL}/api/auth/authorize-route`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${superAdminToken}`,
    },
    body: JSON.stringify({ route: '/supa-admin' }),
  });
  const supaDashData = await supaDashRes.json();
  const supaDashOk =
    supaDashRes.status === 200 &&
    supaDashData.allowed === true &&
    supaDashData.user?.role === 'LIFETIME_SUPER_ADMIN';
  record(
    'Existing Super Admin can access the dashboard',
    'Super Admin Authorization',
    supaDashOk ? 'PASS' : 'FAIL',
    `POST /api/auth/authorize-route (/supa-admin) -> Status ${supaDashRes.status}, allowed=${supaDashData.allowed}`
  );

  // 1. 201 Staff creation (Authorized Lifetime Super Admin)
  const testStaffEmail = `staff_protocol_${Date.now()}@teamacro.ng`;
  const staffAccessCode = `TM-STF-P${Date.now().toString().slice(-4)}`;
  const staffPassword = 'StaffValidPass2026!';
  const createStaffRes = await fetch(`${BASE_URL}/api/auth/create-staff`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${superAdminToken}`,
    },
    body: JSON.stringify({
      fullName: 'Amaka Okafor',
      email: testStaffEmail,
      phone: '+234 803 111 2233',
      roleTitle: 'Customer Registration Officer',
      operationalResponsibility: 'Customer Registration Officer',
      accessCode: staffAccessCode,
      password: staffPassword,
    }),
  });
  const createStaffRawText = await createStaffRes.text();
  const createStaffData = JSON.parse(createStaffRawText);
  const staffCreatedOk =
    createStaffRes.status === 201 &&
    createStaffData.success === true &&
    createStaffData.account?.status === 'active' &&
    createStaffData.account?.role === 'STAFF';
  record(
    '201 Staff creation (Super Admin)',
    'Creation',
    staffCreatedOk ? 'PASS' : 'FAIL',
    `Status ${createStaffRes.status}, account ID ${createStaffData.account?.id}, role=${createStaffData.account?.role}, status=${createStaffData.account?.status}`
  );

  const staffId = createStaffData.account?.id;

  // 2. Staff login with valid credentials
  const staffLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: testStaffEmail,
      password: staffPassword,
    }),
  });
  const staffLoginData = await staffLoginRes.json();
  const staffSessionToken = staffLoginData.sessionToken;
  const staffLoginOk =
    staffLoginRes.status === 200 &&
    staffLoginData.success === true &&
    staffLoginData.user?.role === 'STAFF';
  record(
    'Staff login with valid credentials',
    'Authentication',
    staffLoginOk ? 'PASS' : 'FAIL',
    `Status ${staffLoginRes.status}, role=${staffLoginData.user?.role}, redirect=${staffLoginData.redirectRoute}`
  );

  // 3. 201 Admin creation (Authorized Lifetime Super Admin)
  const testAdminEmail = `admin_protocol_${Date.now()}@teamacro.ng`;
  const adminAccessCode = `TM-ADM-P${Date.now().toString().slice(-4)}`;
  const adminPassword = 'AdminValidPass2026!';
  const createAdminRes = await fetch(`${BASE_URL}/api/auth/access/appoint-admin`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${superAdminToken}`,
    },
    body: JSON.stringify({
      fullName: 'Emeka Nwosu',
      email: testAdminEmail,
      phone: '+234 802 444 5566',
      operationalResponsibility: 'Admin / General Branch Administrator',
      accessCode: adminAccessCode,
      password: adminPassword,
    }),
  });
  const createAdminRawText = await createAdminRes.text();
  const createAdminData = JSON.parse(createAdminRawText);
  const adminCreatedOk =
    createAdminRes.status === 201 &&
    createAdminData.success === true &&
    createAdminData.account?.status === 'active' &&
    createAdminData.account?.role === 'ADMIN';
  record(
    '201 Admin creation (Super Admin)',
    'Creation',
    adminCreatedOk ? 'PASS' : 'FAIL',
    `Status ${createAdminRes.status}, admin email=${createAdminData.account?.email}, role=${createAdminData.account?.role}`
  );

  // 4. Admin login with valid credentials
  const adminLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: testAdminEmail,
      password: adminPassword,
    }),
  });
  const adminLoginData = await adminLoginRes.json();
  const adminSessionToken = adminLoginData.sessionToken;
  const adminLoginOk =
    adminLoginRes.status === 200 &&
    adminLoginData.success === true &&
    adminLoginData.user?.role === 'ADMIN';
  record(
    'Admin login with valid credentials',
    'Authentication',
    adminLoginOk ? 'PASS' : 'FAIL',
    `Status ${adminLoginRes.status}, role=${adminLoginData.user?.role}, redirect=${adminLoginData.redirectRoute}`
  );

  // 4b. Admin cannot access Super Admin portal (/supa-admin)
  const adminToSupaRes = await fetch(`${BASE_URL}/api/auth/authorize-route`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminSessionToken}`,
    },
    body: JSON.stringify({ route: '/supa-admin' }),
  });
  const adminToSupaData = await adminToSupaRes.json();
  const adminToSupaOk = adminToSupaRes.status === 403 && adminToSupaData.allowed === false;
  record(
    'Admin cannot access Super Admin portal',
    'Authorization',
    adminToSupaOk ? 'PASS' : 'FAIL',
    `Admin accessing /supa-admin -> Status ${adminToSupaRes.status}, allowed=${adminToSupaData.allowed}`
  );

  // 4c. Staff cannot access Super Admin portal (/supa-admin)
  const staffToSupaRes = await fetch(`${BASE_URL}/api/auth/authorize-route`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${staffSessionToken}`,
    },
    body: JSON.stringify({ route: '/supa-admin' }),
  });
  const staffToSupaData = await staffToSupaRes.json();
  const staffToSupaOk = staffToSupaRes.status === 403 && staffToSupaData.allowed === false;
  record(
    'Staff cannot access Super Admin portal',
    'Authorization',
    staffToSupaOk ? 'PASS' : 'FAIL',
    `Staff accessing /supa-admin -> Status ${staffToSupaRes.status}, allowed=${staffToSupaData.allowed}`
  );

  // 4d. Invalid MFA codes rejected cleanly & Valid MFA completes authentication
  const mfaSetupRes = await fetch(`${BASE_URL}/api/auth/mfa/setup`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminSessionToken}`,
    },
  });
  const mfaSetupData = await mfaSetupRes.json();
  const mfaSecret = mfaSetupData.secret;
  const currentStep = Math.floor(Date.now() / 1000 / 30);
  const setupTotpCode = computeTotpCode(mfaSecret, currentStep - 1);

  const mfaConfirmRes = await fetch(`${BASE_URL}/api/auth/mfa/confirm`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminSessionToken}`,
    },
    body: JSON.stringify({ code: setupTotpCode }),
  });
  const mfaConfirmData = await mfaConfirmRes.json();

  const mfaLoginTriggerRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: testAdminEmail,
      password: adminPassword,
    }),
  });
  const mfaLoginTriggerData = await mfaLoginTriggerRes.json();
  const challengeToken = mfaLoginTriggerData.challengeToken;

  const badMfaRes = await fetch(`${BASE_URL}/api/auth/verify-mfa`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      challengeToken,
      code: '000000',
    }),
  });
  const badMfaData = await badMfaRes.json();
  const badMfaOk = badMfaRes.status === 401 && badMfaData.success === false;
  record(
    'Invalid MFA codes are rejected cleanly',
    'MFA Security',
    badMfaOk ? 'PASS' : 'FAIL',
    `POST /api/auth/verify-mfa (bad code) -> Status ${badMfaRes.status}, message="${badMfaData.message}"`
  );

  const validTotpCode = computeTotpCode(mfaSecret, currentStep);
  const goodMfaRes = await fetch(`${BASE_URL}/api/auth/verify-mfa`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      challengeToken,
      code: validTotpCode,
    }),
  });
  const goodMfaData = await goodMfaRes.json();
  const goodMfaOk =
    mfaConfirmData.success === true &&
    mfaLoginTriggerData.mfaRequired === true &&
    goodMfaRes.status === 200 &&
    goodMfaData.success === true &&
    Boolean(goodMfaData.sessionToken);
  record(
    'Valid MFA completes authentication',
    'MFA Security',
    goodMfaOk ? 'PASS' : 'FAIL',
    `POST /api/auth/verify-mfa (valid TOTP) -> Status ${goodMfaRes.status}, session issued=${Boolean(goodMfaData.sessionToken)}`
  );

  // 5. 401 no token on Create Staff & Create Admin
  const noTokenStaffRes = await fetch(`${BASE_URL}/api/auth/create-staff`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Unauth Staff',
      email: 'unauth_staff@teamacro.ng',
      phone: '+2348000000000',
      roleTitle: 'Loan Officer',
      accessCode: 'TM-STF-999999',
    }),
  });
  const noTokenStaffData = await noTokenStaffRes.json();
  const noTokenAdminRes = await fetch(`${BASE_URL}/api/auth/access/appoint-admin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Unauth Admin',
      email: 'unauth_admin@teamacro.ng',
      phone: '+2348000000000',
      operationalResponsibility: 'Executive Administrator',
      accessCode: 'TM-ADM-999999',
    }),
  });
  const noTokenAdminData = await noTokenAdminRes.json();
  const noTokenRouteOk =
    noTokenStaffRes.status === 401 &&
    noTokenAdminRes.status === 401 &&
    Boolean(noTokenStaffData.error?.correlationId) &&
    Boolean(noTokenAdminData.error?.correlationId);
  record(
    '401 no token (Create Staff & Create Admin)',
    'Authorization',
    noTokenRouteOk ? 'PASS' : 'FAIL',
    `Staff=${noTokenStaffRes.status} (correlationId=${noTokenStaffData.error?.correlationId}), Admin=${noTokenAdminRes.status} (correlationId=${noTokenAdminData.error?.correlationId})`
  );

  // 6. 403 Admin caller attempting Create Staff & Create Admin
  const adminCreateStaffRes = await fetch(`${BASE_URL}/api/auth/create-staff`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminSessionToken}`,
    },
    body: JSON.stringify({
      fullName: 'Admin Created Staff',
      email: `admin_try_staff_${Date.now()}@teamacro.ng`,
      phone: '+2348000000000',
      roleTitle: 'Loan Officer',
      accessCode: 'TM-STF-888888',
    }),
  });
  const adminCreateAdminRes = await fetch(`${BASE_URL}/api/auth/access/appoint-admin`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminSessionToken}`,
    },
    body: JSON.stringify({
      fullName: 'Admin Created Admin',
      email: `admin_try_admin_${Date.now()}@teamacro.ng`,
      phone: '+2348000000000',
      operationalResponsibility: 'Executive Administrator',
      accessCode: 'TM-ADM-888888',
    }),
  });
  const admin403Ok = adminCreateStaffRes.status === 403 && adminCreateAdminRes.status === 403;
  record(
    '403 Admin caller (Create Staff & Create Admin)',
    'Role Boundary',
    admin403Ok ? 'PASS' : 'FAIL',
    `Admin -> Create Staff: HTTP ${adminCreateStaffRes.status}, Admin -> Create Admin: HTTP ${adminCreateAdminRes.status}`
  );

  // 7. 403 Staff caller attempting Create Staff & Create Admin
  const staffCreateStaffRes = await fetch(`${BASE_URL}/api/auth/create-staff`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${staffSessionToken}`,
    },
    body: JSON.stringify({
      fullName: 'Staff Created Staff',
      email: `staff_try_staff_${Date.now()}@teamacro.ng`,
      phone: '+2348000000000',
      roleTitle: 'Loan Officer',
      accessCode: 'TM-STF-777777',
    }),
  });
  const staffCreateAdminRes = await fetch(`${BASE_URL}/api/auth/access/appoint-admin`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${staffSessionToken}`,
    },
    body: JSON.stringify({
      fullName: 'Staff Created Admin',
      email: `staff_try_admin_${Date.now()}@teamacro.ng`,
      phone: '+2348000000000',
      operationalResponsibility: 'Executive Administrator',
      accessCode: 'TM-ADM-777777',
    }),
  });
  const staff403Ok = staffCreateStaffRes.status === 403 && staffCreateAdminRes.status === 403;
  record(
    '403 Staff caller (Create Staff & Create Admin)',
    'Role Boundary',
    staff403Ok ? 'PASS' : 'FAIL',
    `Staff -> Create Staff: HTTP ${staffCreateStaffRes.status}, Staff -> Create Admin: HTTP ${staffCreateAdminRes.status}`
  );

  // 8. 400 bad input (invalid email, invalid duty, short access code, super_admin role escalation)
  const badEmailRes = await fetch(`${BASE_URL}/api/auth/create-staff`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${superAdminToken}`,
    },
    body: JSON.stringify({
      fullName: 'Bad Email User',
      email: 'not-an-email',
      phone: '+2348000000000',
      roleTitle: 'Loan Officer',
      accessCode: 'TM-STF-654321',
    }),
  });
  const badDutyRes = await fetch(`${BASE_URL}/api/auth/create-staff`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${superAdminToken}`,
    },
    body: JSON.stringify({
      fullName: 'Bad Duty User',
      email: `badduty_${Date.now()}@teamacro.ng`,
      phone: '+2348000000000',
      roleTitle: 'Unauthorized Free Text Duty',
      accessCode: 'TM-STF-654321',
    }),
  });
  const shortCodeRes = await fetch(`${BASE_URL}/api/auth/create-staff`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${superAdminToken}`,
    },
    body: JSON.stringify({
      fullName: 'Short Code User',
      email: `shortcode_${Date.now()}@teamacro.ng`,
      phone: '+2348000000000',
      roleTitle: 'Loan Officer',
      accessCode: '123',
    }),
  });
  const superAdminRoleAttemptRes = await fetch(`${BASE_URL}/api/auth/create-staff`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${superAdminToken}`,
    },
    body: JSON.stringify({
      fullName: 'Super Admin Escalation',
      email: `escalate_${Date.now()}@teamacro.ng`,
      phone: '+2348000000000',
      role: 'super_admin',
      roleTitle: 'Loan Officer',
      accessCode: 'TM-STF-654321',
    }),
  });
  const badInput400Ok =
    badEmailRes.status === 400 &&
    badDutyRes.status === 400 &&
    shortCodeRes.status === 400 &&
    superAdminRoleAttemptRes.status === 400;
  record(
    '400 bad input (email, duty, short code, role)',
    'Validation',
    badInput400Ok ? 'PASS' : 'FAIL',
    `badEmail=${badEmailRes.status}, badDuty=${badDutyRes.status}, shortCode=${shortCodeRes.status}, superAdminRole=${superAdminRoleAttemptRes.status}`
  );

  // 9. 409 duplicate email (on both Staff and Admin creation)
  const dupStaffRes = await fetch(`${BASE_URL}/api/auth/create-staff`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${superAdminToken}`,
    },
    body: JSON.stringify({
      fullName: 'Duplicate Staff',
      email: testStaffEmail,
      phone: '+234 800 000 0000',
      roleTitle: 'Loan Officer',
      accessCode: `TM-STF-D${Date.now().toString().slice(-4)}`,
    }),
  });
  const dupAdminRes = await fetch(`${BASE_URL}/api/auth/access/appoint-admin`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${superAdminToken}`,
    },
    body: JSON.stringify({
      fullName: 'Duplicate Admin',
      email: testAdminEmail,
      phone: '+234 800 000 0000',
      operationalResponsibility: 'Executive Administrator',
      accessCode: `TM-ADM-D${Date.now().toString().slice(-4)}`,
    }),
  });
  const dup409Ok = dupStaffRes.status === 409 && dupAdminRes.status === 409;
  record(
    '409 duplicate email (Staff & Admin)',
    'Integrity',
    dup409Ok ? 'PASS' : 'FAIL',
    `Duplicate Staff=${dupStaffRes.status}, Duplicate Admin=${dupAdminRes.status}`
  );

  // 10. Rollback on Firestore failure (Auth user deleted & server record removed when Firestore write fails)
  const rollbackEmail = `rollback_staff_${Date.now()}@teamacro.ng`;
  const rollbackCode = `TM-STF-RB${Date.now().toString().slice(-4)}`;
  const rollbackRes = await fetch(`${BASE_URL}/api/auth/create-staff`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${superAdminToken}`,
      'x-test-simulate-firestore-failure': 'true',
    },
    body: JSON.stringify({
      fullName: 'Rollback Verification Officer',
      email: rollbackEmail,
      phone: '+234 809 555 6677',
      roleTitle: 'Loan Officer',
      accessCode: rollbackCode,
    }),
  });
  const rollbackData = await rollbackRes.json();
  // Verify rolled-back user cannot sign in
  const rollbackLoginProbe = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: rollbackEmail,
      password: rollbackCode,
    }),
  });
  const rollbackOk =
    rollbackRes.status === 500 &&
    rollbackData.rolledBack === true &&
    Boolean(rollbackData.rolledBackAuthUid) &&
    Boolean(rollbackData.error?.correlationId) &&
    rollbackLoginProbe.status === 401;
  record(
    'Rollback on Firestore failure',
    'Atomicity & Rollback',
    rollbackOk ? 'PASS' : 'FAIL',
    `Status ${rollbackRes.status}, rolledBack=${rollbackData.rolledBack}, uid=${rollbackData.rolledBackAuthUid}, loginProbe=${rollbackLoginProbe.status}`
  );

  // 11. No secrets in the response (Staff & Admin 201 payloads)
  const forbiddenKeys = [
    '"password"',
    '"initialPassword"',
    '"accessCode"',
    '"passwordHash"',
    '"passwordSalt"',
    '"accessCodeHash"',
    '"accessCodeSalt"',
  ];
  const staffHasSecretKey = forbiddenKeys.some((k) => createStaffRawText.includes(k));
  const adminHasSecretKey = forbiddenKeys.some((k) => createAdminRawText.includes(k));
  const staffHasPlaintextSecret =
    createStaffRawText.includes(staffPassword) || createStaffRawText.includes(staffAccessCode);
  const adminHasPlaintextSecret =
    createAdminRawText.includes(adminPassword) || createAdminRawText.includes(adminAccessCode);
  const noSecretsOk =
    !staffHasSecretKey &&
    !adminHasSecretKey &&
    !staffHasPlaintextSecret &&
    !adminHasPlaintextSecret;
  record(
    'No secrets in API response',
    'Security',
    noSecretsOk ? 'PASS' : 'FAIL',
    `staffSecrets=${staffHasSecretKey || staffHasPlaintextSecret}, adminSecrets=${adminHasSecretKey || adminHasPlaintextSecret}`
  );

  // 12. Invalid password on login
  const badPwRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: testStaffEmail,
      password: 'TotallyWrongPassword999!',
    }),
  });
  const badPwData = await badPwRes.json();
  const badPwOk = badPwRes.status === 401 && badPwData.success === false && typeof badPwData.error === 'string';
  record(
    'Invalid password',
    'Security',
    badPwOk ? 'PASS' : 'FAIL',
    `Status ${badPwRes.status}, message="${badPwData.message}"`
  );

  // 13. Unknown account
  const unknownRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: 'unregistered_nobody_876@teamacro.ng',
      password: 'SomePassword123!',
    }),
  });
  const unknownData = await unknownRes.json();
  const unknownOk = unknownRes.status === 401 && unknownData.success === false;
  record(
    'Unknown account',
    'Security',
    unknownOk ? 'PASS' : 'FAIL',
    `Status ${unknownRes.status}, message="${unknownData.message}"`
  );

  // 14. Missing profile normalization
  const missingProfileErr = normalizeError(null, 'Account profile record could not be resolved.');
  const missingProfileOk = typeof missingProfileErr === 'string' && missingProfileErr.length > 0;
  record(
    'Missing profile',
    'Error Handling',
    missingProfileOk ? 'PASS' : 'FAIL',
    `Normalized safely to string: "${missingProfileErr}"`
  );

  // 15. Incorrect profile UID
  const badUidSession = await fetch(`${BASE_URL}/api/auth/session`, {
    headers: { Authorization: 'Bearer forged_nonexistent_uid_session_token' },
  });
  const badUidOk = badUidSession.status === 401;
  record(
    'Incorrect profile UID',
    'Session Verification',
    badUidOk ? 'PASS' : 'FAIL',
    `Status ${badUidSession.status} rejected securely`
  );

  // 16. Wrong role (Staff accessing /admin)
  const staffToAdminRes = await fetch(`${BASE_URL}/api/auth/authorize-route`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${staffSessionToken}`,
    },
    body: JSON.stringify({ route: '/admin' }),
  });
  const staffToAdminData = await staffToAdminRes.json();
  const wrongRoleOk = staffToAdminRes.status === 403 && staffToAdminData.allowed === false;
  record(
    'Wrong role',
    'Authorization',
    wrongRoleOk ? 'PASS' : 'FAIL',
    `Staff accessing /admin: Status ${staffToAdminRes.status}, allowed=${staffToAdminData.allowed}`
  );

  // 17. Disabled account
  await fetch(`${BASE_URL}/api/auth/toggle-status`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${superAdminToken}`,
    },
    body: JSON.stringify({
      targetUserId: staffId,
      status: 'suspended',
      reason: 'Audit compliance review',
    }),
  });
  const disabledLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: testStaffEmail,
      password: staffPassword,
    }),
  });
  const disabledOk = disabledLoginRes.status === 403;
  record(
    'Disabled account',
    'Account Lifecycle',
    disabledOk ? 'PASS' : 'FAIL',
    `Suspended user login rejected with HTTP ${disabledLoginRes.status}`
  );

  // Re-activate staff for remaining tests
  await fetch(`${BASE_URL}/api/auth/toggle-status`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${superAdminToken}`,
    },
    body: JSON.stringify({
      targetUserId: staffId,
      status: 'active',
      reason: 'Reactivated for test continuation',
    }),
  });
  const reLogin = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: testStaffEmail, password: staffPassword }),
  });
  const reLoginData = await reLogin.json();
  const activeStaffToken = reLoginData.sessionToken;

  // 18. Expired session
  const expiredCheck = await fetch(`${BASE_URL}/api/auth/authorize-route`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer EXPIRED_SESSION_TOKEN_SAMPLE',
    },
    body: JSON.stringify({ route: '/staff' }),
  });
  const expiredData = await expiredCheck.json();
  const expiredOk =
    expiredCheck.status === 401 &&
    expiredData.allowed === false &&
    expiredData.redirect === '/staff/login';
  record(
    'Expired session',
    'Session Verification',
    expiredOk ? 'PASS' : 'FAIL',
    `Status ${expiredCheck.status}, redirect=${expiredData.redirect}`
  );

  // 19. Page refresh (Valid authorized session restored)
  const sessionRestoreRes = await fetch(`${BASE_URL}/api/auth/session`, {
    headers: { Authorization: `Bearer ${activeStaffToken}` },
  });
  const sessionRestoreData = await sessionRestoreRes.json();
  const restoreOk =
    sessionRestoreRes.status === 200 &&
    sessionRestoreData.authenticated === true &&
    sessionRestoreData.user?.email === testStaffEmail;
  record(
    'Page refresh',
    'Session Persistence',
    restoreOk ? 'PASS' : 'FAIL',
    `Status ${sessionRestoreRes.status}, user restored: ${sessionRestoreData.user?.email}`
  );

  // 20. HTTP error response & {code, message, correlationId} normalization
  const httpErrRes = await safeApiFetch('/api/non-existent-diagnostic-probe');
  const rawObj = {
    code: 'auth/invalid-credential',
    message: 'The supplied credential is invalid or has expired.',
    correlationId: 'req_test_123',
  };
  const normalized = normalizeError(rawObj);
  const react31Ok =
    !httpErrRes.success &&
    typeof normalized === 'string' &&
    !normalized.includes('[object Object]') &&
    normalized.length > 5;
  record(
    '{code, message, correlationId} normalization',
    'Anti-Crash Contract',
    react31Ok ? 'PASS' : 'FAIL',
    `Normalized object to string: "${normalized}"`
  );

  // 21. Client-side role manipulation (No privilege escalation)
  const spoofRes = await fetch(`${BASE_URL}/api/auth/authorize-route`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${activeStaffToken}`,
    },
    body: JSON.stringify({
      route: '/supa-admin',
      role: 'LIFETIME_SUPER_ADMIN',
    }),
  });
  const spoofData = await spoofRes.json();
  const spoofOk = spoofRes.status === 403 && spoofData.allowed === false;
  record(
    'Client-side role manipulation',
    'Privilege Enforcement',
    spoofOk ? 'PASS' : 'FAIL',
    `Payload role override ignored; server-authoritative token enforced. Status ${spoofRes.status}`
  );

  // 22. Operator session & Existing accounts and records remain intact
  const operatorCheck = await fetch(`${BASE_URL}/api/auth/session`, {
    headers: { Authorization: `Bearer ${superAdminToken}` },
  });
  const operatorData = await operatorCheck.json();
  const accountsListRes = await fetch(`${BASE_URL}/api/auth/accounts`, {
    headers: { Authorization: `Bearer ${superAdminToken}` },
  });
  const accountsListData = await accountsListRes.json();
  const hasLifetimeSuperAdmin =
    Array.isArray(accountsListData.accounts) &&
    accountsListData.accounts.some(
      (a: any) => a.email === 'eromoseledavidson68@gmail.com' && a.role === 'LIFETIME_SUPER_ADMIN'
    );
  const operatorOk =
    operatorCheck.status === 200 &&
    operatorData.user?.role === 'LIFETIME_SUPER_ADMIN' &&
    accountsListRes.status === 200 &&
    hasLifetimeSuperAdmin;
  record(
    'Existing accounts and records remain intact',
    'System Integrity',
    operatorOk ? 'PASS' : 'FAIL',
    `Operator session intact (${operatorData.user?.email}), total accounts=${accountsListData.accounts?.length}, Super Admin preserved=${hasLifetimeSuperAdmin}`
  );

  console.log('\n================================================================');
  const passedCount = results.filter((r) => r.status === 'PASS').length;
  console.log(`TOTAL SUITE RESULTS: ${passedCount} / ${results.length} PASSED`);
  console.log('================================================================\n');

  if (passedCount !== results.length) {
    process.exit(1);
  }
}

runAcceptanceSuite().catch((err) => {
  console.error('Test suite runtime error:', err);
  process.exit(1);
});
