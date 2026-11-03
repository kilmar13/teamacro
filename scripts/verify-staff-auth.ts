import { normalizeError } from '../src/utils/errorNormalizer';
import { safeApiFetch } from '../src/utils/apiClient';

async function runTests() {
  console.log('=== RUNNING COMPREHENSIVE 10-POINT VERIFICATION SUITE ===\n');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: any) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}`, detail || '');
      failed++;
    }
  }

  const BASE_URL = 'http://localhost:3000';

  // SCENARIO 7: Unit test normalizeError with various tricky error payloads
  // 7a. Object with { code, message }
  const objErr1 = { code: 'auth/invalid-credential', message: 'Firebase auth error message' };
  const norm1 = normalizeError(objErr1);
  assert(
    typeof norm1 === 'string' && norm1.includes('incorrect'),
    'Scenario 7a: normalizeError({ code, message }) maps to human-readable string without crashing',
    norm1
  );

  // 7b. Raw object with custom { code, message }
  const objErr2 = { code: 'CUSTOM_ERR', message: 'Custom failure reason' };
  const norm2 = normalizeError(objErr2);
  assert(
    norm2 === 'Custom failure reason',
    'Scenario 7b: Custom { code, message } extracts clean message string',
    norm2
  );

  // 7c. Deeply nested error { error: { message: "Internal fault" } }
  const objErr3 = { error: { message: 'Internal fault' } };
  const norm3 = normalizeError(objErr3);
  assert(
    norm3 === 'Internal fault',
    'Scenario 7c: Nested object { error: { message } } resolves to string',
    norm3
  );

  // 7d. Null, undefined, empty
  assert(
    normalizeError(null) === 'An unexpected error occurred. Please try again.',
    'Scenario 7d: Null error resolves to fallback'
  );

  // SCENARIO 8: Malformed JSON, empty string, or 500 response handling
  const jsonStringErr = '{"error": "JSON string error text"}';
  assert(
    normalizeError(jsonStringErr) === 'JSON string error text',
    'Scenario 8a: JSON string representation unwraps to string message'
  );

  // 8b. safeApiFetch handles non-JSON / 404 / 500 gracefully without crashing
  const apiRes = await safeApiFetch('/api/non-existent-endpoint-test-404');
  assert(
    !apiRes.success && typeof apiRes.message === 'string' && typeof apiRes.error === 'string',
    'Scenario 8b: safeApiFetch returns string message and error on 404',
    apiRes
  );

  // SCENARIO 2: Incorrect password attempt against /api/auth/login
  const resBadPw = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'nonexistent@teamacro.ng', password: 'WrongPassword123!' }),
  });
  const dataBadPw: any = await resBadPw.json();
  assert(
    resBadPw.status === 401 && typeof dataBadPw.error === 'string' && typeof dataBadPw.message === 'string',
    'Scenario 2: Incorrect password returns 401 with normalized string error/message',
    dataBadPw
  );

  // SCENARIO 3: Invalid or expired token sent to /api/auth/session
  const resBadToken = await fetch(`${BASE_URL}/api/auth/session`, {
    headers: { Authorization: 'Bearer invalid_hex_session_token_12345' },
  });
  const dataBadToken: any = await resBadToken.json();
  assert(
    resBadToken.status === 401 && dataBadToken.authenticated === false,
    'Scenario 3: Invalid token to /api/auth/session returns 401 authenticated: false',
    dataBadToken
  );

  // SCENARIO 4: Missing token or credentials
  const resNoToken = await fetch(`${BASE_URL}/api/auth/session`);
  const dataNoToken: any = await resNoToken.json();
  assert(
    resNoToken.status === 401 && dataNoToken.authenticated === false,
    'Scenario 4: Request with no session returns 401 unauthenticated safely',
    dataNoToken
  );

  // Authenticate Lifetime Super Admin
  const resLoginSuper = await fetch(`${BASE_URL}/api/auth/sync-super-admin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      uid: 'TEST_SUPER_ADMIN_UID_001',
      email: 'eromoseledavidson68@gmail.com',
      fullName: 'Davidson Eromosele (Super Admin)',
    }),
  });
  const dataSuper: any = await resLoginSuper.json();
  const superToken = dataSuper.sessionToken;

  assert(
    resLoginSuper.ok && !!superToken,
    'Super Admin session sync succeeded for provisioning tests',
    dataSuper
  );

  // Generate single-use access code by Super Admin
  const testStaffEmail = `test.staff.${Date.now()}@teamacro.ng`;
  const resGenCode = await fetch(`${BASE_URL}/api/auth/access/generate-code`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${superToken}`,
    },
    body: JSON.stringify({
      email: testStaffEmail,
      accessType: 'Staff',
      duty: 'Credit Operations Officer',
    }),
  });
  const dataGenCode: any = await resGenCode.json();
  const accessCode = dataGenCode.code || dataGenCode.data?.code;

  assert(
    resGenCode.ok && !!accessCode,
    'Super Admin generates single-use access code',
    dataGenCode
  );

  // SCENARIO 1a: Authorized Super Admin creates staff account with valid access code
  const resCreateStaff = await fetch(`${BASE_URL}/api/auth/create-staff`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${superToken}`,
    },
    body: JSON.stringify({
      fullName: 'Verification Staff Member',
      email: testStaffEmail,
      phone: '+2348039998877',
      duty: 'Credit Operations Officer',
      accessCode,
      initialPassword: 'InitialPassword123!',
      role: 'STAFF',
    }),
  });
  const dataStaff: any = await resCreateStaff.json();
  assert(
    resCreateStaff.status === 201 && dataStaff.message === 'Staff account created successfully',
    'Scenario 1a: Authorized Super Admin creates staff account successfully (201)',
    dataStaff
  );

  // SCENARIO 1b: Valid staff login with newly created credentials
  const resStaffLogin = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: testStaffEmail,
      password: 'InitialPassword123!',
    }),
  });
  const dataStaffLogin: any = await resStaffLogin.json();
  const staffToken = dataStaffLogin.sessionToken;
  assert(
    resStaffLogin.ok && dataStaffLogin.success && !!staffToken && dataStaffLogin.user?.role === 'STAFF',
    'Scenario 1b: Valid staff login succeeds and returns sessionToken with STAFF role',
    dataStaffLogin
  );

  // SCENARIO 10: Session persistence across refresh (GET /api/auth/session with staff token)
  const resStaffSession = await fetch(`${BASE_URL}/api/auth/session`, {
    headers: { Authorization: `Bearer ${staffToken}` },
  });
  const dataStaffSession: any = await resStaffSession.json();
  assert(
    resStaffSession.ok && dataStaffSession.authenticated && dataStaffSession.user?.email === testStaffEmail,
    'Scenario 10: Staff session persists on refresh (GET /api/auth/session returns user profile)',
    dataStaffSession
  );

  // SCENARIO 6: Staff attempting to access unauthorized portal (/supa-admin)
  const resStaffAccessSupa = await fetch(`${BASE_URL}/api/auth/authorize-route`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${staffToken}`,
    },
    body: JSON.stringify({ route: '/supa-admin' }),
  });
  const dataStaffAccessSupa: any = await resStaffAccessSupa.json();
  assert(
    resStaffAccessSupa.status === 403 && dataStaffAccessSupa.allowed === false,
    'Scenario 6: Staff member accessing /supa-admin is rejected with 403 Forbidden',
    dataStaffAccessSupa
  );

  // SCENARIO 1c: Staff accessing authorized portal (/staff)
  const resStaffAccessStaff = await fetch(`${BASE_URL}/api/auth/authorize-route`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${staffToken}`,
    },
    body: JSON.stringify({ route: '/staff' }),
  });
  const dataStaffAccessStaff: any = await resStaffAccessStaff.json();
  assert(
    resStaffAccessStaff.status === 200 && dataStaffAccessStaff.allowed === true,
    'Scenario 1c: Staff member accessing /staff is granted entry (200 OK)',
    dataStaffAccessStaff
  );

  // SCENARIO 5: Disabled / Deactivated staff account returns 403
  // Test by calling toggle status or checking suspended account login
  const resSuspend = await fetch(`${BASE_URL}/api/auth/toggle-status`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${superToken}`,
    },
    body: JSON.stringify({
      targetUserId: dataStaff.account?.id,
      status: 'suspended',
      reason: 'Testing suspended account rejection',
    }),
  });
  const dataSuspend: any = await resSuspend.json();
  assert(resSuspend.ok, 'Super Admin suspended test staff account', dataSuspend);

  // Attempt login with suspended account
  const resSuspendedLogin = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: testStaffEmail,
      password: 'InitialPassword123!',
    }),
  });
  const dataSuspendedLogin: any = await resSuspendedLogin.json();
  assert(
    resSuspendedLogin.status === 403,
    'Scenario 5: Suspended staff account returns 403 Forbidden on login attempt',
    dataSuspendedLogin
  );

  // SCENARIO 9: Backend API health check is UP
  const resHealth = await fetch(`${BASE_URL}/api/health`);
  assert(resHealth.ok, 'Scenario 9: Backend API health check is UP');

  console.log(`\n=== RESULTS: ${passed} PASSED, ${failed} FAILED ===`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((e) => {
  console.error('Fatal test runner failure:', e);
  process.exit(1);
});
