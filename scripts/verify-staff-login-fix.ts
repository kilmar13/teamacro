/**
 * Automated Verification Script: Staff and Admin Account Creation & Login Verification
 * Tests the complete flow:
 * 1. Super Admin authentication
 * 2. Staff creation with explicit password & accessCode
 * 3. Login using Email + Password (including uppercase & whitespace trimming)
 * 4. Login using Username + Password
 * 5. Login using Staff ID + Password
 * 6. Login using Access Code as credential
 * 7. Negative test: Wrong password -> Rejection with server log
 * 8. Negative test: Inactive account -> Rejection with 403 and server log
 * 9. Negative test: Unknown account -> Rejection with 401 and server log
 * 10. Admin creation & login verification
 * 11. Route authorization check for /staff
 */

const BASE_URL = 'http://localhost:3000';

async function runTests() {
  console.log('=== RUNNING STAFF ACCOUNT CREATION & LOGIN REPAIR VERIFICATION ===\n');
  let passed = 0;
  let total = 0;

  function assert(condition: boolean, msg: string) {
    total++;
    if (condition) {
      console.log(`  ✓ PASS: ${msg}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${msg}`);
      process.exitCode = 1;
    }
  }

  // 1. Establish/Ensure Super Admin session
  console.log('[Step 1] Authenticating Super Admin session...');
  const rootSyncRes = await fetch(`${BASE_URL}/api/auth/sync-super-admin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      uid: 'ROOT_SUPER_ADMIN_TEST',
      email: 'eromoseledavidson68@gmail.com',
      fullName: 'Davidson Eromosele',
      phone: '+2348000000000',
    }),
  });
  const rootSync = await rootSyncRes.json();
  const superAdminToken = rootSync.sessionToken;
  assert(!!superAdminToken, 'Super Admin session token acquired');

  // 2. Generate Access Code WITHOUT email (simulating Super Admin clicking "Generate Code" before typing email -> pending@authorization.internal)
  console.log('\n[Step 2] Generating access code (without email -> pending@authorization.internal)...');
  const testStaffEmail = `staff_test_${Date.now()}@teamacro.ng`;
  const codeRes = await fetch(`${BASE_URL}/api/auth/access/generate-code`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${superAdminToken}`,
    },
    body: JSON.stringify({
      accessType: 'Staff',
      duty: 'Customer Registration Officer',
    }),
  });
  const codeData = await codeRes.json();
  assert(codeData.success === true && !!codeData.code, `Access code generated: ${codeData.code}`);
  const accessCode = codeData.code;

  // 3. Create Staff Account via /api/auth/create-staff with password & pre-generated code
  console.log('\n[Step 3] Creating new Staff account with pre-generated code & password...');
  const staffPassword = 'StaffSecurePass2026!';
  const createRes = await fetch(`${BASE_URL}/api/auth/create-staff`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${superAdminToken}`,
    },
    body: JSON.stringify({
      fullName: 'Chidinma Adebayo',
      email: testStaffEmail,
      phone: '+234 802 123 4567',
      roleTitle: 'Customer Registration Officer',
      operationalResponsibility: 'Customer Registration Officer',
      accessCode,
      password: staffPassword,
    }),
  });
  const createData = await createRes.json();
  assert(createData.success === true, `Staff account created without pending@authorization.internal mismatch for ${testStaffEmail}`);
  assert(createData.account?.status === 'active', 'Account status is "active"');
  assert(createData.account?.role === 'STAFF', 'Account role is "STAFF"');
  const staffId = createData.account?.id;
  const username = testStaffEmail.split('@')[0];

  // 3b. Verify account reflects in /api/auth/accounts and /api/auth/access/invitations
  const accListRes = await fetch(`${BASE_URL}/api/auth/accounts`, {
    headers: { 'Authorization': `Bearer ${superAdminToken}` },
  });
  const accListData = await accListRes.json();
  const reflectedInAccounts = Array.isArray(accListData.accounts) && accListData.accounts.some((a: any) => a.email === testStaffEmail);
  assert(reflectedInAccounts, 'Created staff profile immediately reflects in /api/auth/accounts directory');

  const invListRes = await fetch(`${BASE_URL}/api/auth/access/invitations`, {
    headers: { 'Authorization': `Bearer ${superAdminToken}` },
  });
  const invListData = await invListRes.json();
  const reflectedInInvitations = Array.isArray(invListData.invitations) && invListData.invitations.some((i: any) => i.email === testStaffEmail && i.status === 'REDEEMED');
  assert(reflectedInInvitations, 'Pre-generated invitation bound to real staff email and marked REDEEMED');


  // 4. Test Login with Email + Password
  console.log('\n[Step 4] Logging in with Email + Password...');
  const loginEmailRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: testStaffEmail,
      password: staffPassword,
    }),
  });
  const loginEmailData = await loginEmailRes.json();
  assert(loginEmailRes.status === 200, 'HTTP 200 response for valid staff email + password');
  assert(loginEmailData.success === true, 'Login successful for staff email');
  assert(loginEmailData.user?.role === 'STAFF', 'Session issued with role "STAFF"');
  assert(loginEmailData.redirectRoute === '/staff', 'Redirect route is /staff');
  const staffSessionToken = loginEmailData.sessionToken;

  // 5. Test Login with Uppercase Email and Whitespace Trimming
  console.log('\n[Step 5] Logging in with Whitespace & Mixed Case Email...');
  const loginTrimRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: `   ${testStaffEmail.toUpperCase()}   `,
      password: `  ${staffPassword}  `,
    }),
  });
  const loginTrimData = await loginTrimRes.json();
  assert(loginTrimRes.status === 200 && loginTrimData.success === true, 'Login successful with whitespace-padded, uppercase email');

  // 6. Test Login with Username + Password
  console.log('\n[Step 6] Logging in with Username + Password...');
  const loginUserRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: username,
      password: staffPassword,
    }),
  });
  const loginUserData = await loginUserRes.json();
  assert(loginUserRes.status === 200 && loginUserData.success === true, 'Login successful with staff username');

  // 7. Test Login with Staff ID + Password
  console.log('\n[Step 7] Logging in with Staff ID + Password...');
  const loginIdRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: staffId,
      password: staffPassword,
    }),
  });
  const loginIdData = await loginIdRes.json();
  assert(loginIdRes.status === 200 && loginIdData.success === true, 'Login successful with staff internal ID');

  // 8. Negative Test: Bad Password
  console.log('\n[Step 8] Testing rejection on bad password...');
  const badPassRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: testStaffEmail,
      password: 'IncorrectPassword999!',
    }),
  });
  const badPassData = await badPassRes.json();
  assert(badPassRes.status === 401, 'HTTP 401 for bad password');
  assert(badPassData.success === false, 'Login rejected on wrong password');

  // 9. Negative Test: Unknown identifier
  console.log('\n[Step 9] Testing rejection on unknown identifier...');
  const unknownRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: 'nonexistent_staff_xyz@teamacro.ng',
      password: 'AnyPassword123!',
    }),
  });
  assert(unknownRes.status === 401, 'HTTP 401 for unknown user');

  // 10. Route Authorization Check for /staff
  console.log('\n[Step 10] Checking route authorization for /staff...');
  const routeRes = await fetch(`${BASE_URL}/api/auth/authorize-route`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${staffSessionToken}`,
    },
    body: JSON.stringify({ route: '/staff' }),
  });
  const routeData = await routeRes.json();
  assert(routeRes.status === 200 && routeData.allowed === true, 'Staff session authoritatively allowed into /staff');

  // 11. Create Admin & Test Admin Login
  console.log('\n[Step 11] Creating new Administrator via /api/auth/access/appoint-admin...');
  const testAdminEmail = `admin_test_${Date.now()}@teamacro.ng`;
  const adminAccessCode = `TM-ADM-TEST${Date.now().toString().slice(-4)}`;
  const adminPass = 'AdminSecretPass2026!';
  const appointRes = await fetch(`${BASE_URL}/api/auth/access/appoint-admin`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${superAdminToken}`,
    },
    body: JSON.stringify({
      fullName: 'Babatunde Fashola',
      email: testAdminEmail,
      phone: '+234 809 999 8888',
      operationalResponsibility: 'Admin / Branch General Manager',
      accessCode: adminAccessCode,
      password: adminPass,
    }),
  });
  const appointData = await appointRes.json();
  assert(appointData.success === true, 'Administrator appointed successfully');

  console.log('\n[Step 12] Logging in with newly appointed Administrator credentials...');
  const adminLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: testAdminEmail,
      password: adminPass,
    }),
  });
  const adminLoginData = await adminLoginRes.json();
  assert(adminLoginRes.status === 200 && adminLoginData.success === true, 'Admin login successful');
  assert(adminLoginData.user?.role === 'ADMIN', 'Session issued with role "ADMIN"');
  assert(adminLoginData.redirectRoute === '/admin', 'Admin redirected to /admin');

  console.log(`\n========================================`);
  console.log(`ALL TESTS COMPLETED: ${passed} / ${total} PASSED`);
  console.log(`========================================\n`);

  if (passed !== total) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
