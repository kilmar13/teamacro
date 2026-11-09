import { User, StaffRole } from '../types/banking';
import { ledgerEngine } from './ledgerEngine';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import {
  db,
  auth,
  handleFirestoreError,
  OperationType,
} from './firebase';
import { safeApiFetch, getActiveSessionToken, setActiveSessionToken } from '../utils/apiClient';
import { normalizeError } from '../utils/errorNormalizer';
import { getDedicatedRouteForUser, normalizeCanonicalPosition } from '../utils/roleRouting';

export interface AuthSessionResponse {
  authenticated: boolean;
  user?: User;
  redirectRoute?: string;
  sessionToken?: string;
  expiresAt?: number;
  error?: string;
  message?: string;
}

export interface LoginResult {
  success: boolean;
  requireMfa?: boolean;
  tempToken?: string;
  maskedDestination?: string;
  expiresInSeconds?: number;
  sessionToken?: string;
  redirectRoute?: string;
  user?: User;
  error?: string;
  message?: string;
  lockoutSeconds?: number;
}

export interface RouteAuthResult {
  allowed: boolean;
  statusCode: number;
  reason?: string;
  redirect?: string;
  user?: Partial<User>;
  targetRoute?: string;
}

export interface PasswordResetResult {
  success: boolean;
  message?: string;
  error?: string;
}

export interface SetupStatusResponse {
  status: 'NOT_INITIALIZED' | 'INITIALIZING' | 'INITIALIZED';
  isInitialized: boolean;
  lockdownEnforced: boolean;
  establishedAt?: string | null;
  ownerEmail?: string | null;
  ownerFullName?: string | null;
  message?: string;
}

const SESSION_STORAGE_KEY = 'teamacro_auth_session_token';

class AuthService {
  private activeToken: string | null = null;
  private cachedUser: User | null = null;
  private deletedAccountKeys: Set<string> = new Set();

  constructor() {
    this.activeToken = getActiveSessionToken();
  }

  public getStoredToken(): string | null {
    if (this.activeToken) return this.activeToken;
    this.activeToken = getActiveSessionToken();
    return this.activeToken;
  }

  public setStoredToken(token: string | null): void {
    this.activeToken = token;
    setActiveSessionToken(token);
  }

  private getAuthHeaders(): HeadersInit {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    const token = this.getStoredToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
      headers['x-session-token'] = token;
    }
    return headers;
  }

  /**
   * POST /api/auth/login
   */
  public async login(identifier: string, password: string): Promise<LoginResult> {
    const cleanId = (identifier || '').trim().toLowerCase();

    if (!cleanId || !password) {
      return {
        success: false,
        message: 'Please enter both your identifier and password.',
        error: 'MISSING_CREDENTIALS',
      };
    }

    const res = await safeApiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        identifier: cleanId,
        password,
      }),
    });

    if (!res.success) {
      const err = normalizeError(
        res.error || res.message,
        'Invalid credentials or access unauthorised.'
      );

      return {
        success: false,
        message: err,
        error: res.error || err,
        lockoutSeconds: res.lockoutSeconds,
      };
    }

    if (res.requireMfa) {
      return {
        success: true,
        requireMfa: true,
        tempToken: res.tempToken,
        maskedDestination: res.maskedDestination,
        expiresInSeconds: res.expiresInSeconds,
        user: res.user,
      };
    }

    if (!res.user || !res.sessionToken) {
      return {
        success: false,
        message: 'Authentication could not be verified by the server.',
        error: 'INVALID_SERVER_AUTH_RESPONSE',
      };
    }

    const redirectRoute = res.redirectRoute || getDedicatedRouteForUser(res.user);
    const enrichedUser: User = {
      ...res.user,
      position: res.user.position || res.user.duty || res.user.roleTitle,
      dashboardRoute: res.user.dashboardRoute || redirectRoute,
    };

    if (
      auth?.currentUser?.email &&
      enrichedUser.email &&
      auth.currentUser.email.toLowerCase() !== enrichedUser.email.toLowerCase()
    ) {
      try {
        await firebaseSignOut(auth);
      } catch {
        // Ignore signOut failure
      }
    }

    this.setStoredToken(res.sessionToken);
    this.cachedUser = enrichedUser;
    ledgerEngine.setCurrentUser(enrichedUser);

    return {
      success: true,
      requireMfa: false,
      sessionToken: res.sessionToken,
      redirectRoute,
      user: enrichedUser,
      message: res.message || 'Authentication successful.',
    };
  }

  /**
   * POST /api/auth/verify-mfa
   */
  public async verifyMfa(tempToken: string, code: string): Promise<LoginResult> {
    const res = await safeApiFetch('/api/auth/verify-mfa', {
      method: 'POST',
      body: JSON.stringify({ tempToken, code }),
    });

    if (!res.success) {
      const err = normalizeError(res.error || res.message, 'MFA verification failed.');
      return {
        success: false,
        message: err,
        error: err,
      };
    }

    if (res.sessionToken) {
      this.setStoredToken(res.sessionToken);
    }
    const redirectRoute = res.redirectRoute || getDedicatedRouteForUser(res.user);
    if (res.user) {
      res.user.position = res.user.position || res.user.duty || res.user.roleTitle;
      res.user.dashboardRoute = res.user.dashboardRoute || redirectRoute;
      this.cachedUser = res.user;
      ledgerEngine.setCurrentUser(res.user);
    }

    return {
      success: true,
      sessionToken: res.sessionToken,
      redirectRoute,
      user: res.user,
      message: normalizeError(res.message, 'MFA verified successfully.'),
    };
  }

  /**
   * GET /api/auth/session
   */
  public async getSession(): Promise<AuthSessionResponse> {
    const res = await safeApiFetch('/api/auth/session', {
      method: 'GET',
    });

    if (!res.success || !res.authenticated) {
      this.setStoredToken(null);
      this.cachedUser = null;
      ledgerEngine.setCurrentUser(null);
      return { authenticated: false, error: normalizeError(res.error || res.message, 'Unauthenticated') };
    }

    if (res.user) {
      const redirectRoute = res.redirectRoute || getDedicatedRouteForUser(res.user);
      const enrichedUser: User = {
        ...res.user,
        position: res.user.position || res.user.duty || res.user.roleTitle,
        dashboardRoute: res.user.dashboardRoute || redirectRoute,
      };
      this.cachedUser = enrichedUser;
      ledgerEngine.setCurrentUser(enrichedUser);
      return {
        authenticated: true,
        user: enrichedUser,
        redirectRoute,
        sessionToken: res.sessionToken,
        expiresAt: res.expiresAt,
        message: res.message ? normalizeError(res.message) : undefined,
      };
    }

    this.setStoredToken(null);
    this.cachedUser = null;
    ledgerEngine.setCurrentUser(null);
    return { authenticated: false };
  }

  /**
   * POST /api/auth/authorize-route
   */
  public async authorizeRoute(route: string): Promise<RouteAuthResult> {
    const res = await safeApiFetch('/api/auth/authorize-route', {
      method: 'POST',
      body: JSON.stringify({ route }),
    });

    return {
      allowed: !!res.allowed,
      statusCode: res.statusCode || (res.success ? 200 : 403),
      reason: res.reason ? normalizeError(res.reason) : (res.message ? normalizeError(res.message) : undefined),
      redirect: res.redirect,
      user: res.user,
      targetRoute: res.targetRoute,
    };
  }

  /**
   * POST /api/auth/logout
   */
  public async logout(): Promise<void> {
    try {
      await safeApiFetch('/api/auth/logout', {
        method: 'POST',
      });
    } catch {
      // Ignore network errors during logout
    } finally {
      this.setStoredToken(null);
      this.cachedUser = null;
      ledgerEngine.setCurrentUser(null);
    }
  }

  /**
   * POST /api/auth/forgot-password
   */
  public async requestPasswordReset(identifier: string): Promise<PasswordResetResult> {
    const res = await safeApiFetch('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ identifier }),
    });

    return {
      success: res.success,
      message: res.message,
      error: res.error,
    };
  }

  /**
   * POST /api/auth/reset-password
   */
  public async completePasswordReset(token: string, newPassword: string): Promise<PasswordResetResult> {
    const res = await safeApiFetch('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, newPassword }),
    });

    if (!res.success) {
      return {
        success: false,
        message: res.message || res.error || 'Password reset failed.',
        error: res.error || res.message || 'Password reset failed.',
      };
    }

    // Successful password reset revokes all sessions on server
    this.setStoredToken(null);
    this.cachedUser = null;
    ledgerEngine.setCurrentUser(null);

    return {
      success: true,
      message: res.message || 'Password successfully updated.',
    };
  }

  /**
   * Authoritative setup status check from Firestore (systemSettings/lifetimeSuperAdmin)
   * with server endpoint fallback.
   */
  public async getSetupStatus(): Promise<SetupStatusResponse> {
    try {
      const snap = await getDoc(doc(db, 'systemSettings', 'lifetimeSuperAdmin'));
      if (snap.exists() && snap.data()?.initialized === true) {
        const data = snap.data();
        return {
          status: 'INITIALIZED',
          isInitialized: true,
          lockdownEnforced: true,
          establishedAt: data.createdAt || null,
          ownerEmail: data.ownerEmail || null,
          ownerFullName: data.fullName || null,
          message: 'INITIAL SETUP COMPLETED — ROOT REGISTRATION LOCKED',
        };
      }
      return {
        status: 'NOT_INITIALIZED',
        isInitialized: false,
        lockdownEnforced: false,
        message: 'Lifetime Super Admin has not yet been registered. Initial setup open.',
      };
    } catch (firestoreErr) {
      console.warn('[AUTH] Direct Firestore read note, falling back to server route:', firestoreErr);
      try {
        const res = await safeApiFetch<any>('/api/auth/setup-status');
        const data = res.data;
        if (data) {
          return {
            status: data.status || (data.isInitialized ? 'INITIALIZED' : 'NOT_INITIALIZED'),
            isInitialized: !!data.isInitialized,
            lockdownEnforced: !!data.lockdownEnforced,
            establishedAt: data.establishedAt || null,
            ownerEmail: data.ownerEmail || null,
            ownerFullName: data.ownerFullName || null,
            message: data.message || '',
          };
        }
        return {
          status: 'NOT_INITIALIZED',
          isInitialized: false,
          lockdownEnforced: false,
          message: 'Ready for initial Lifetime Super Admin setup.',
        };
      } catch {
        return {
          status: 'NOT_INITIALIZED',
          isInitialized: false,
          lockdownEnforced: false,
          message: 'Ready for initial Lifetime Super Admin setup.',
        };
      }
    }
  }

  /**
   * One-time atomic establishment of the Lifetime Super Admin account using Firebase Auth and Firestore.
   * Completely free of MFA prompts, TOTP enrollment, or blocking second factors.
   */
  public async setupLifetimeSuperAdmin(payload: {
    fullName: string;
    email: string;
    phone?: string;
    password: string;
  }): Promise<{
    success: boolean;
    error?: string;
    user?: User;
    message?: string;
  }> {
    try {
      const cleanEmail = payload.email.trim().toLowerCase();
      const cleanName = payload.fullName.trim();
      const cleanPhone = (payload.phone || '').trim();

      // 1. Verify that setup has not already been completed in Firestore
      let alreadyInitialized = false;
      try {
        const existingSnap = await getDoc(doc(db, 'systemSettings', 'lifetimeSuperAdmin'));
        if (existingSnap.exists() && existingSnap.data()?.initialized === true) {
          alreadyInitialized = true;
        }
      } catch {
        const status = await this.getSetupStatus();
        if (status.isInitialized) {
          alreadyInitialized = true;
        }
      }
      if (alreadyInitialized) {
        return {
          success: false,
          error: 'Setup has already been completed. Initial registration is permanently locked.',
        };
      }

      // 2. Create the user in Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, payload.password);
      const fbUid = userCredential.user.uid;
      const idToken = await userCredential.user.getIdToken();
      try {
        await updateProfile(userCredential.user, { displayName: cleanName });
      } catch {
        // Ignore profile display name warning
      }

      const createdAt = new Date().toISOString();

      // 4. Atomically persist singleton record in Firestore at systemSettings/lifetimeSuperAdmin
      const ownerRecord = {
        initialized: true,
        ownerUid: fbUid,
        ownerEmail: cleanEmail,
        fullName: cleanName,
        phone: cleanPhone,
        role: 'LIFETIME_SUPER_ADMIN',
        setupVersion: 1,
        createdAt,
      };

      try {
        await setDoc(doc(db, 'systemSettings', 'lifetimeSuperAdmin'), ownerRecord);
      } catch (dbErr) {
        handleFirestoreError(dbErr, OperationType.WRITE, 'systemSettings/lifetimeSuperAdmin');
      }

      // 5. Also record in /admins/{uid} and /users/{uid}
      try {
        await setDoc(doc(db, 'admins', fbUid), {
          uid: fbUid,
          email: cleanEmail,
          fullName: cleanName,
          role: 'LIFETIME_SUPER_ADMIN',
          createdAt,
        });
      } catch (adminErr) {
        console.warn('[AUTH] admins collection write note:', adminErr);
      }

      try {
        await setDoc(doc(db, 'users', fbUid), {
          id: fbUid,
          email: cleanEmail,
          fullName: cleanName,
          phone: cleanPhone,
          role: 'SUPER_ADMIN',
          active: true,
          createdAt,
        });
      } catch (userErr) {
        console.warn('[AUTH] users collection write note:', userErr);
      }

      // 6. Establish server session using verified Firebase ID token
      const appUser: User = {
        id: fbUid,
        email: cleanEmail,
        fullName: cleanName,
        phone: cleanPhone,
        role: 'LIFETIME_SUPER_ADMIN',
        active: true,
        createdAt,
      };

      try {
        const syncRes = await safeApiFetch<{ sessionToken?: string; success?: boolean }>('/api/auth/sync-super-admin', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
          body: {
            idToken,
            fullName: cleanName,
            phone: cleanPhone,
          },
        });
        if (syncRes.data?.sessionToken) {
          this.setStoredToken(syncRes.data.sessionToken);
        }
      } catch (syncErr) {
        console.warn('[AUTH] Server session sync note:', syncErr);
      }

      this.cachedUser = appUser;
      ledgerEngine.setCurrentUser(appUser);

      return {
        success: true,
        user: appUser,
        message: 'Lifetime Super Admin account successfully established and permanently registered.',
      };
    } catch (err: any) {
      let message = err?.message || 'Error during initial account creation.';
      if (err?.code === 'auth/email-already-in-use') {
        message = 'This email address is already in use by an existing account.';
      } else if (err?.code === 'auth/weak-password') {
        message = 'The password is too weak. Please use at least 10 characters.';
      } else if (err?.code === 'auth/invalid-email') {
        message = 'The provided email address is invalid.';
      }
      return {
        success: false,
        error: message,
      };
    }
  }

  /**
   * Super Admin login via authoritative backend authentication gateway (/api/auth/login).
   * Enforces Firestore ownership verification, active account status, and MFA verification on the server.
   */
  public async loginSuperAdmin(email: string, password: string): Promise<LoginResult> {
    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail || !password) {
      return {
        success: false,
        error: 'Please enter both your Super Admin email address and master password.',
        message: 'Please enter both your Super Admin email address and master password.',
      };
    }

    const res = await this.login(cleanEmail, password);
    if (!res.success) {
      return res;
    }

    if (res.requireMfa && res.tempToken) {
      if (res.user && res.user.role && res.user.role !== 'LIFETIME_SUPER_ADMIN') {
        return {
          success: false,
          error: 'Access Denied: This portal is strictly reserved for the Lifetime Super Admin.',
          message: 'Access Denied: This portal is strictly reserved for the Lifetime Super Admin.',
        };
      }
      return res;
    }

    if (!res.user || res.user.role !== 'LIFETIME_SUPER_ADMIN') {
      await this.logout();
      return {
        success: false,
        error: 'Access Denied: This portal is strictly reserved for the Lifetime Super Admin.',
        message: 'Access Denied: This portal is strictly reserved for the Lifetime Super Admin.',
      };
    }

    return {
      ...res,
      redirectRoute: '/supa-admin',
    };
  }

  /**
   * Compatibility wrapper for setupCreateAccount
   */
  public async setupCreateAccount(payload: {
    fullName: string;
    email: string;
    phone?: string;
    password: string;
  }): Promise<{
    success: boolean;
    error?: string;
    setupEnrollmentToken?: string;
    totpEnrollment?: { secret: string; uri: string; recoveryCodes: string[] };
    maskedEmail?: string;
  }> {
    const res = await this.setupLifetimeSuperAdmin(payload);
    return {
      success: res.success,
      error: res.error,
    };
  }

  /**
   * Compatibility wrapper for setupVerifyMfaAndSeal
   */
  public async setupVerifyMfaAndSeal(payload: {
    setupEnrollmentToken: string;
    mfaCode: string;
  }): Promise<{
    success: boolean;
    error?: string;
    user?: any;
    message?: string;
  }> {
    return {
      success: true,
      message: 'Setup already sealed.',
    };
  }

  /**
   * Compatibility wrapper for setupRoot
   */
  public async setupRoot(payload: {
    secretKey: string;
    fullName: string;
    email: string;
    phone?: string;
    password?: string;
  }): Promise<{ success: boolean; error?: string; user?: any }> {
    const res = await this.setupLifetimeSuperAdmin({
      fullName: payload.fullName,
      email: payload.email,
      phone: payload.phone,
      password: payload.password || '',
    });
    return res;
  }

  /**
   * Generate Access Authorization Code (Lifetime Super Admin)
   */
  public async generateAccessCode(payload: {
    email?: string;
    accessType: 'Admin' | 'Staff';
    duty?: string;
    permissions?: Record<string, boolean>;
  } | 'Admin' | 'Staff'): Promise<{ success: boolean; message?: string; error?: string; code?: string; expiresAt?: number }> {
    const body = typeof payload === 'string' ? { accessType: payload } : payload;
    const res = await safeApiFetch('/api/auth/access/generate-code', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    if (!res.success) {
      return {
        success: false,
        message: res.message || res.error || 'Failed to generate access code.',
        error: res.error || res.message || 'Failed to generate access code.',
      };
    }

    return {
      success: true,
      message: res.message || 'Access authorization code generated successfully.',
      code: res.code || res.data?.code,
      expiresAt: res.expiresAt || res.data?.expiresAt,
    };
  }

  /**
   * Give Access (Lifetime Super Admin)
   */
  public async giveAccess(payload: {
    email: string;
    accessType: 'Admin' | 'Staff';
    duty: string;
    code: string;
    fullName?: string;
    phone?: string;
    permissions?: Record<string, boolean>;
  }): Promise<{ success: boolean; message?: string; error?: string; record?: any }> {
    const res = await safeApiFetch('/api/auth/access/give-access', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (!res.success) {
      return {
        success: false,
        message: res.message || res.error || 'Failed to grant access.',
        error: res.error || res.message || 'Failed to grant access.',
      };
    }

    return {
      success: true,
      message: res.message || 'Access successfully granted.',
      record: res.record || res.data?.record,
    };
  }

  /**
   * Update Granular Account Permissions (Server-side only)
   */
  public async updatePermissions(targetUserId: string, permissions: Record<string, boolean>): Promise<{ success: boolean; message?: string; error?: string; correlationId?: string }> {
    await this.ensureSuperAdminSession();
    const res = await safeApiFetch('/api/auth/access/update-permissions', {
      method: 'POST',
      body: JSON.stringify({ targetUserId, permissions }),
    });

    if (!res.success) {
      return {
        success: false,
        message: res.message || res.error || 'Failed to update permissions.',
        error: res.error || res.message || 'Failed to update permissions.',
        correlationId: res.correlationId,
      };
    }

    return {
      success: true,
      message: res.message || 'Permissions updated successfully.',
      correlationId: res.correlationId,
    };
  }

  /**
   * Toggle Account Status (Active / Suspended / Inactive) on Server
   */
  public async toggleAccountStatus(
    targetUserId: string,
    status: 'active' | 'suspended' | 'inactive',
    _role?: string
  ): Promise<{ success: boolean; message?: string; error?: string; correlationId?: string }> {
    await this.ensureSuperAdminSession();
    const res = await safeApiFetch('/api/auth/toggle-status', {
      method: 'POST',
      body: JSON.stringify({ targetUserId, status }),
    });

    if (!res.success) {
      return {
        success: false,
        message: res.message || res.error || 'Failed to update account status.',
        error: res.error || res.message || 'Failed to update account status.',
        correlationId: res.correlationId,
      };
    }

    return {
      success: true,
      message: res.message || 'Account status updated successfully.',
      correlationId: res.correlationId,
    };
  }

  /**
   * Revoke Admin Privileges on Server
   */
  public async revokeAdminRole(targetUserId: string): Promise<{ success: boolean; message?: string; error?: string; correlationId?: string }> {
    await this.ensureSuperAdminSession();
    const res = await safeApiFetch('/api/auth/revoke-admin', {
      method: 'POST',
      body: JSON.stringify({ targetUserId }),
    });

    if (!res.success) {
      return {
        success: false,
        message: res.message || res.error || 'Failed to revoke administrator role.',
        error: res.error || res.message || 'Failed to revoke administrator role.',
        correlationId: res.correlationId,
      };
    }

    return {
      success: true,
      message: res.message || 'Administrator privileges revoked successfully.',
      correlationId: res.correlationId,
    };
  }

  /**
   * Authoritatively verify that an active server-validated session token is present.
   * Never synthesizes or grants Super Admin privileges from hardcoded emails or browser storage.
   */
  public async ensureSuperAdminSession(force = false): Promise<string | null> {
    const existing = this.getStoredToken();
    if (!force && existing) {
      return existing;
    }

    try {
      const sessionRes = await safeApiFetch<any>('/api/auth/session', {
        method: 'GET',
      });
      if (sessionRes.success && sessionRes.authenticated && sessionRes.user) {
        const srvToken = sessionRes.sessionToken || sessionRes.data?.sessionToken;
        if (srvToken) {
          this.setStoredToken(srvToken);
          return srvToken;
        }
      }
    } catch {
      // Ignore session check error
    }

    const fbUser = auth.currentUser;
    if (fbUser) {
      try {
        const idToken = await fbUser.getIdToken();
        const syncRes = await safeApiFetch<{ sessionToken?: string; success?: boolean }>('/api/auth/sync-super-admin', {
          method: 'POST',
          body: {
            uid: fbUser.uid,
            email: fbUser.email || '',
            fullName: fbUser.displayName || '',
            idToken,
          },
        });
        const newToken = syncRes.sessionToken || syncRes.data?.sessionToken;
        if (newToken) {
          this.setStoredToken(newToken);
          return newToken;
        }
      } catch (err) {
        console.warn('[AUTH] ensureSuperAdminSession sync note:', err);
      }
    }

    return this.getStoredToken();
  }

  /**
   * Appoint Administrator with Access Code (Exclusive Lifetime Super Admin Privilege - Server-Side Only)
   */
  public async appointAdministrator(payload: {
    fullName: string;
    email: string;
    phone: string;
    position?: string;
    duty?: string;
    roleTitle?: string;
    operationalResponsibility?: string;
    assignedProgramme?: string;
    permissions?: Record<string, boolean>;
    status?: 'active' | 'suspended';
    accessCode: string;
    password?: string;
    initialPassword?: string;
    assignedModules?: string[];
  }): Promise<{
    success: boolean;
    message?: string;
    error?: string;
    correlationId?: string;
    invitation?: any;
    account?: any;
  }> {
    await this.ensureSuperAdminSession();

    let res = await safeApiFetch('/api/auth/access/appoint-admin', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (!res.success && (res.statusCode === 401 || res.statusCode === 403)) {
      await this.ensureSuperAdminSession(true);
      res = await safeApiFetch('/api/auth/access/appoint-admin', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    }

    if (!res.success) {
      return {
        success: false,
        message: res.message || res.error || 'Failed to appoint administrator.',
        error: res.error || res.message || 'Failed to appoint administrator.',
        correlationId: res.correlationId,
      };
    }

    const account = res.account || res.data?.account;
    if (payload.email) this.deletedAccountKeys.delete(payload.email.trim().toLowerCase());
    if (account?.id) this.deletedAccountKeys.delete(String(account.id).trim().toLowerCase());

    // Immediately reflect in local ledgerEngine directory for UI rendering
    try {
      const actor = ledgerEngine.getCurrentStaff() || ledgerEngine.getCurrentUser() || {
        id: 'ROOT_SUPER_ADMIN',
        fullName: 'Lifetime Super Admin',
        role: 'LIFETIME_SUPER_ADMIN',
        isLifetimeSuperAdmin: true,
      };
      ledgerEngine.createAdminUser(
        {
          id: account?.id,
          staffCode: account?.staffCode,
          fullName: payload.fullName,
          email: payload.email,
          phone: payload.phone,
          operationalResponsibility: payload.position || payload.operationalResponsibility || payload.duty,
          assignedModules: payload.assignedModules,
        },
        actor
      );
    } catch (err) {
      console.warn('[AUTH] Local ledgerEngine admin sync note:', err);
    }

    return {
      success: true,
      message: res.message || 'Administrator appointed successfully.',
      correlationId: res.correlationId,
      invitation: res.invitation || res.data?.invitation,
      account,
    };
  }

  /**
   * Create Staff Account with Access Code verification (Server-Side Only)
   */
  public async createStaffAccount(payload: {
    fullName: string;
    email: string;
    phone: string;
    position?: string;
    duty?: string;
    roleTitle?: string;
    operationalResponsibility?: string;
    assignedProgramme?: string;
    permissions?: Record<string, boolean>;
    status?: 'active' | 'suspended';
    accessCode: string;
    password?: string;
    initialPassword?: string;
    assignedModules?: string[];
  }): Promise<{
    success: boolean;
    message?: string;
    error?: string;
    correlationId?: string;
    account?: any;
    invitation?: any;
  }> {
    const existingToken = this.getStoredToken();
    if (!existingToken) {
      await this.ensureSuperAdminSession();
    }

    let res = await safeApiFetch('/api/auth/create-staff', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (!res.success && (res.statusCode === 401 || res.statusCode === 403)) {
      await this.ensureSuperAdminSession(true);
      res = await safeApiFetch('/api/auth/create-staff', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    }

    if (!res.success) {
      return {
        success: false,
        message: res.message || res.error || 'Failed to create staff account.',
        error: res.error || res.message || 'Failed to create staff account.',
        correlationId: res.correlationId,
      };
    }

    const account = res.account || res.data?.account;
    if (payload.email) this.deletedAccountKeys.delete(payload.email.trim().toLowerCase());
    if (account?.id) this.deletedAccountKeys.delete(String(account.id).trim().toLowerCase());

    // Immediately reflect in local ledgerEngine directory for UI rendering
    try {
      const actor = ledgerEngine.getCurrentStaff() || ledgerEngine.getCurrentUser() || {
        id: 'ROOT_SUPER_ADMIN',
        fullName: 'Lifetime Super Admin',
        role: 'LIFETIME_SUPER_ADMIN',
        isLifetimeSuperAdmin: true,
      };
      const resolvedPos = payload.position || payload.roleTitle || payload.operationalResponsibility || 'Customer Registration Officer';
      ledgerEngine.createStaffUser(
        {
          id: account?.id,
          staffCode: account?.staffCode,
          fullName: payload.fullName,
          email: payload.email,
          phone: payload.phone,
          role: 'STAFF',
          roleTitle: resolvedPos,
          operationalResponsibility: resolvedPos,
          assignedModules: payload.assignedModules || ['DASHBOARD'],
        },
        actor
      );
    } catch (err) {
      console.warn('[AUTH] Local ledgerEngine staff sync note:', err);
    }

    return {
      success: true,
      message: res.message || 'Staff account created successfully',
      correlationId: res.correlationId,
      account,
      invitation: res.invitation || res.data?.invitation,
    };
  }

  /**
   * Revoke an issued access authorization code before redemption
   */
  public async revokeAccessCode(invitationId: string): Promise<{ success: boolean; message?: string; error?: string }> {
    const res = await safeApiFetch('/api/auth/access/revoke', {
      method: 'POST',
      body: JSON.stringify({ invitationId }),
    });

    if (!res.success) {
      return {
        success: false,
        message: res.message || res.error || 'Failed to revoke access code.',
        error: res.error || res.message || 'Failed to revoke access code.',
      };
    }

    return {
      success: true,
      message: res.message || 'Access authorization code revoked.',
    };
  }

  /**
   * Verify an access authorization code without redeeming it
   */
  public async verifyAccessCode(email: string, code: string): Promise<{ success: boolean; message?: string; error?: string; invitation?: any }> {
    const res = await safeApiFetch('/api/auth/access/verify-code', {
      method: 'POST',
      body: JSON.stringify({ email, code }),
    });

    if (!res.success) {
      return {
        success: false,
        message: res.message || res.error || 'Invalid or expired access code.',
        error: res.error || res.message || 'Invalid or expired access code.',
      };
    }

    return {
      success: true,
      message: res.message || 'Access authorization code verified.',
      invitation: res.invitation || res.data?.invitation,
    };
  }

  /**
   * Redeem an access authorization code to complete account initialization
   */
  public async redeemAccessCode(payload: {
    email: string;
    code: string;
    newPassword?: string;
    fullName?: string;
    phone?: string;
  }): Promise<{ success: boolean; message?: string; error?: string; account?: any }> {
    const res = await safeApiFetch('/api/auth/access/redeem-code', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (!res.success) {
      return {
        success: false,
        message: res.message || res.error || 'Failed to redeem access code.',
        error: res.error || res.message || 'Failed to redeem access code.',
      };
    }

    return {
      success: true,
      message: res.message || 'Access code redeemed successfully. Account activated.',
      account: res.account || res.data?.account,
    };
  }

  /**
   * Retrieve active invitations
   */
  public async getAccessInvitations(): Promise<any[]> {
    await this.ensureSuperAdminSession();
    let res = await safeApiFetch('/api/auth/access/invitations');
    if (!res.success && (res.statusCode === 401 || res.statusCode === 403)) {
      await this.ensureSuperAdminSession(true);
      res = await safeApiFetch('/api/auth/access/invitations');
    }
    if (!res.success) return [];
    return res.invitations || res.data?.invitations || [];
  }

  /**
   * Retrieve accounts directory (merges server directory and local ledger directory)
   */
  public async getAccountsList(): Promise<any[]> {
    await this.ensureSuperAdminSession();
    let res = await safeApiFetch('/api/auth/accounts');
    if (!res.success && (res.statusCode === 401 || res.statusCode === 403)) {
      await this.ensureSuperAdminSession(true);
      res = await safeApiFetch('/api/auth/accounts');
    }
    const serverAccounts: any[] = res.success ? (res.accounts || res.data?.accounts || []) : [];
    const localDirectory = ledgerEngine.getStaffAndAdminDirectory();
    const byEmail = new Map<string, any>();

    for (const acc of localDirectory) {
      if (acc.email) {
        const emailKey = acc.email.toLowerCase();
        const idKey = String(acc.id || '').toLowerCase();
        if (this.deletedAccountKeys.has(emailKey) || (idKey && this.deletedAccountKeys.has(idKey))) {
          continue;
        }
        byEmail.set(emailKey, acc);
      }
    }
    for (const srv of serverAccounts) {
      if (srv.email) {
        const emailKey = srv.email.toLowerCase();
        const idKey = String(srv.id || '').toLowerCase();
        if (this.deletedAccountKeys.has(emailKey) || (idKey && this.deletedAccountKeys.has(idKey))) {
          byEmail.delete(emailKey);
          continue;
        }
        const prev = byEmail.get(emailKey) || {};
        const pos = normalizeCanonicalPosition(srv.position || srv.duty || srv.roleTitle, srv.role) || srv.position || srv.duty || srv.roleTitle;
        byEmail.set(emailKey, {
          ...prev,
          ...srv,
          position: pos,
          duty: pos,
          roleTitle: pos,
          dashboardRoute: srv.dashboardRoute || getDedicatedRouteForUser(srv),
          staffCode: srv.staffCode || prev.staffCode || `TMC-${srv.id?.slice(-4) || '001'}`,
          operationalResponsibility: pos || prev.operationalResponsibility,
        });
      }
    }

    return Array.from(byEmail.values());
  }

  /**
   * POST /api/auth/delete-account
   * Permanently deletes an Admin or Staff account from backend, Firebase Auth, Firestore, and local ledger directory.
   */
  public async deleteAccount(
    targetUserId: string,
    email?: string
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    const cleanId = String(targetUserId || '').trim();
    const cleanEmail = String(email || '').trim().toLowerCase();

    if (
      cleanId === 'OWNER_ROOT_3YPAFKI2' ||
      cleanId === 'LIFETIME_ROOT_SUPER_ADMIN_001' ||
      cleanEmail === 'eromoseledavidson68@gmail.com'
    ) {
      return {
        success: false,
        message: 'Security Invariant: The Permanent Lifetime Super Admin account cannot be deleted.',
        error: 'Security Invariant: The Permanent Lifetime Super Admin account cannot be deleted.',
      };
    }

    const res = await safeApiFetch('/api/auth/delete-account', {
      method: 'POST',
      body: JSON.stringify({
        targetUserId: cleanId,
        email: cleanEmail,
      }),
    });

    if (!res.success) {
      return {
        success: false,
        message: res.message || res.error || 'Failed to delete account.',
        error: res.error || res.message || 'Failed to delete account.',
      };
    }

    if (cleanId) this.deletedAccountKeys.add(cleanId.toLowerCase());
    if (cleanEmail) this.deletedAccountKeys.add(cleanEmail);

    // Immediately remove from client-side local ledger storage
    ledgerEngine.deleteStaffOrAdminUser(cleanId, cleanEmail);

    return {
      success: true,
      message: res.message || 'Account permanently deleted.',
    };
  }

  /**
   * POST /api/auth/update-account
   * Updates an Admin or Staff account's fullName, email, phone, role, position, assignedProgramme,
   * status, permissions, and optional new password/accessCode across backend, Firebase Auth, Firestore, and local ledger.
   */
  public async updateAccount(
    targetUserId: string,
    updates: {
      fullName?: string;
      email?: string;
      phone?: string;
      role?: 'ADMIN' | 'STAFF' | string;
      position?: string;
      duty?: string;
      roleTitle?: string;
      operationalResponsibility?: string;
      dashboardRoute?: string;
      assignedProgramme?: string;
      status?: 'active' | 'suspended';
      permissions?: Record<string, boolean>;
      password?: string;
      accessCode?: string;
    }
  ): Promise<{ success: boolean; message?: string; error?: string; account?: any }> {
    const cleanId = String(targetUserId || '').trim();
    if (!cleanId) {
      return {
        success: false,
        message: 'Target account ID is required.',
        error: 'Target account ID is required.',
      };
    }

    const res = await safeApiFetch('/api/auth/update-account', {
      method: 'POST',
      body: JSON.stringify({
        targetUserId: cleanId,
        ...updates,
      }),
    });

    if (!res.success) {
      return {
        success: false,
        message: res.message || res.error || 'Failed to update account.',
        error: res.error || res.message || 'Failed to update account.',
      };
    }

    const updatedAcc = res.account || res.data?.account || { id: cleanId, ...updates };
    const effectiveRole = updatedAcc.role === 'ADMIN' ? 'ADMIN' : 'STAFF';
    const effectivePosition =
      updatedAcc.position || updatedAcc.duty || updatedAcc.roleTitle || updates.position || updates.duty;

    // Sync client-side local ledger storage
    ledgerEngine.updateStaffUser(cleanId, {
      fullName: updatedAcc.fullName,
      email: updatedAcc.email,
      phone: updatedAcc.phone,
      role: effectiveRole as StaffRole,
      roleTitle: effectivePosition,
      position: effectivePosition,
      dashboardRoute: updatedAcc.dashboardRoute,
      assignedProgramme: updatedAcc.assignedProgramme,
      operationalResponsibility: effectivePosition,
      status: updatedAcc.status === 'suspended' ? 'suspended' : 'active',
      permissions: updatedAcc.permissions,
    });

    return {
      success: true,
      message: res.message || 'Account updated successfully.',
      account: updatedAcc,
    };
  }



  /**
   * POST /api/financial/transfers/approve
   */
  public async approveTransfer(transferId: string, notes?: string): Promise<{ success: boolean; message?: string; error?: string; transfer?: any }> {
    const res = await safeApiFetch('/api/financial/transfers/approve', {
      method: 'POST',
      body: JSON.stringify({ requestId: transferId, notes }),
    });

    if (!res.success) {
      return {
        success: false,
        message: res.message || res.error || 'Failed to approve transfer.',
        error: res.error || res.message || 'Failed to approve transfer.',
      };
    }

    return {
      success: true,
      message: res.message || 'Transfer approval validated on server.',
      transfer: res.transfer || res.data?.transfer,
    };
  }
}

export const authService = new AuthService();
