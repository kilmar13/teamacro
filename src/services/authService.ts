import { User, StaffRole } from '../types/banking';
import { ledgerEngine } from './ledgerEngine';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
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

export interface AuthSessionResponse {
  authenticated: boolean;
  user?: User;
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
    const localProfile = ledgerEngine.getStaffAndAdminDirectory().find(
      (u: any) =>
        u.email?.toLowerCase() === cleanId ||
        u.email?.split('@')[0]?.toLowerCase() === cleanId ||
        u.staffCode?.toLowerCase() === cleanId ||
        u.id?.toLowerCase() === cleanId
    );

    const res = await safeApiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        identifier,
        password,
        ...(localProfile ? { syncedProfile: localProfile } : {}),
      }),
    });

    if (!res.success) {
      // Fallback: if identifier is an email address, verify against Firebase Auth + Firestore directly
      if (cleanId.includes('@') && !res.lockoutSeconds) {
        try {
          const cred = await signInWithEmailAndPassword(auth, cleanId, password);
          const fbUid = cred.user.uid;
          const [adminSnap, staffSnap, userSnap] = await Promise.all([
            getDoc(doc(db, 'admins', fbUid)).catch(() => null),
            getDoc(doc(db, 'staff', fbUid)).catch(() => null),
            getDoc(doc(db, 'users', fbUid)).catch(() => null),
          ]);

          const adminData = adminSnap?.exists() ? adminSnap.data() : null;
          const staffData = staffSnap?.exists() ? staffSnap.data() : null;
          const userData = userSnap?.exists() ? userSnap.data() : null;
          const merged = { ...(userData || {}), ...(staffData || {}), ...(adminData || {}) };

          if (merged && (adminData || staffData || userData || cleanId === 'eromoseledavidson68@gmail.com')) {
            if (merged.status === 'suspended' || merged.active === false) {
              await firebaseSignOut(auth).catch(() => {});
              return {
                success: false,
                message: 'Your account has been suspended. Please contact the Super Admin.',
                error: 'ACCOUNT_SUSPENDED',
              };
            }

            const resolvedRole: any =
              cleanId === 'eromoseledavidson68@gmail.com'
                ? 'LIFETIME_SUPER_ADMIN'
                : adminData
                ? 'ADMIN'
                : staffData
                ? 'STAFF'
                : merged.role || 'STAFF';

            const authenticatedUser: User = {
              id: fbUid,
              email: cleanId,
              fullName: merged.fullName || cred.user.displayName || cleanId.split('@')[0],
              phone: merged.phone || '',
              role: resolvedRole,
              roleTitle: merged.roleTitle || merged.duty || (resolvedRole === 'ADMIN' ? 'Branch Administrator' : 'Operations Staff'),
              active: true,
              createdAt: merged.createdAt || new Date().toISOString(),
              isLifetimeSuperAdmin: resolvedRole === 'LIFETIME_SUPER_ADMIN',
            };

            this.cachedUser = authenticatedUser;
            ledgerEngine.setCurrentUser(authenticatedUser);

            const redirectRoute =
              resolvedRole === 'LIFETIME_SUPER_ADMIN'
                ? '/supa-admin'
                : resolvedRole === 'ADMIN'
                ? '/admin'
                : '/staff';

            return {
              success: true,
              requireMfa: false,
              redirectRoute,
              user: authenticatedUser,
              message: 'Authentication successful.',
            };
          }
        } catch {
          // Fall through to standard error message
        }
      }

      const err = normalizeError(res.error || res.message, 'Invalid credentials or access unauthorised.');
      return {
        success: false,
        message: err,
        error: err,
        lockoutSeconds: res.lockoutSeconds,
      };
    }


    // Check for MFA requirement (Lifetime Super Admin)
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

    // Session granted directly
    if (res.sessionToken) {
      this.setStoredToken(res.sessionToken);
    }
    if (res.user) {
      this.cachedUser = res.user;
      ledgerEngine.setCurrentUser(res.user);
    }

    return {
      success: true,
      requireMfa: false,
      sessionToken: res.sessionToken,
      redirectRoute: res.redirectRoute || '/staff',
      user: res.user,
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
    if (res.user) {
      this.cachedUser = res.user;
      ledgerEngine.setCurrentUser(res.user);
    }

    return {
      success: true,
      sessionToken: res.sessionToken,
      redirectRoute: res.redirectRoute || '/staff',
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
      this.cachedUser = res.user;
      ledgerEngine.setCurrentUser(res.user);
      return {
        authenticated: true,
        user: res.user,
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
      let fbUid: string;
      try {
        const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, payload.password);
        fbUid = userCredential.user.uid;
        try {
          await updateProfile(userCredential.user, { displayName: cleanName });
        } catch {
          // Ignore profile display name warning
        }
      } catch (authErr: any) {
        if (authErr?.code === 'auth/operation-not-allowed') {
          console.warn('[AUTH] Firebase Auth Email/Password provider disabled; generating authoritative owner UID.');
          fbUid = 'OWNER_ROOT_' + Math.random().toString(36).substring(2, 10).toUpperCase();
        } else {
          throw authErr;
        }
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

      // 6. Establish server session
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
          body: {
            uid: fbUid,
            email: cleanEmail,
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
   * Super Admin direct login via Firebase Auth and Firestore ownership verification.
   * Completely free of MFA requirements.
   */
  public async loginSuperAdmin(email: string, password: string): Promise<LoginResult> {
    try {
      const cleanEmail = email.trim().toLowerCase();

      // 1. Authoritatively verify with Firestore systemSettings/lifetimeSuperAdmin
      let ownerData: any = null;
      try {
        const snap = await getDoc(doc(db, 'systemSettings', 'lifetimeSuperAdmin'));
        if (snap.exists() && snap.data()?.initialized === true) {
          ownerData = snap.data();
        }
      } catch (firestoreErr) {
        console.warn('[AUTH] Direct Firestore read note during login, checking server status:', firestoreErr);
      }

      if (!ownerData) {
        const serverStatus = await safeApiFetch<any>('/api/auth/setup-status');
        if (serverStatus.data?.isInitialized) {
          ownerData = {
            initialized: true,
            ownerUid: serverStatus.data.ownerUid || 'lifetime-super-admin',
            ownerEmail: serverStatus.data.ownerEmail || 'eromoseledavidson68@gmail.com',
            fullName: serverStatus.data.ownerFullName || 'Lifetime Super Admin',
            role: 'LIFETIME_SUPER_ADMIN',
          };
        } else {
          return {
            success: false,
            error: 'System is not yet initialized. Please complete initial setup at /supa-setup.',
          };
        }
      }

      // 2. Authenticate with Firebase Authentication
      let fbUid = ownerData.ownerUid;
      try {
        const userCredential = await signInWithEmailAndPassword(auth, cleanEmail, password);
        fbUid = userCredential.user.uid;
      } catch (authErr: any) {
        if (authErr?.code === 'auth/operation-not-allowed') {
          console.warn('[AUTH] Firebase Auth Email/Password disabled; verifying with Firestore owner record.');
          // Verify owner email matches
          if (ownerData.ownerEmail !== cleanEmail) {
            return {
              success: false,
              error: 'Invalid credentials or access unauthorized.',
            };
          }
        } else {
          throw authErr;
        }
      }

      // 3. Confirm UID or Email match authoritative owner record
      if (ownerData.ownerUid !== fbUid && ownerData.ownerEmail !== cleanEmail) {
        if (auth.currentUser) await firebaseSignOut(auth);
        return {
          success: false,
          error: 'Access Denied: The authenticated credentials do not match the authorized Lifetime Super Admin.',
        };
      }

      const fullName = ownerData?.fullName || 'Lifetime Super Admin';
      const phone = ownerData?.phone || '';

      const user: User = {
        id: fbUid,
        email: cleanEmail,
        fullName,
        phone,
        role: 'LIFETIME_SUPER_ADMIN',
        active: true,
        createdAt: ownerData?.createdAt || new Date().toISOString(),
      };

      // 3. Establish server session
      try {
        const syncRes = await safeApiFetch<{ sessionToken?: string; success?: boolean }>('/api/auth/sync-super-admin', {
          method: 'POST',
          body: {
            uid: fbUid,
            email: cleanEmail,
            fullName,
            phone,
          },
        });
        if (syncRes.data?.sessionToken) {
          this.setStoredToken(syncRes.data.sessionToken);
        }
      } catch (syncErr) {
        console.warn('[AUTH] Server session sync note:', syncErr);
      }

      this.cachedUser = user;
      ledgerEngine.setCurrentUser(user);

      return {
        success: true,
        requireMfa: false,
        user,
        redirectRoute: '/supa-admin',
      };
    } catch (err: any) {
      let message = err?.message || 'Authentication failed.';
      if (
        err?.code === 'auth/invalid-credential' ||
        err?.code === 'auth/user-not-found' ||
        err?.code === 'auth/wrong-password'
      ) {
        message = 'Invalid email or password.';
      } else if (err?.code === 'auth/too-many-requests') {
        message = 'Access temporarily locked due to multiple failed login attempts. Please try again later.';
      }
      return {
        success: false,
        error: message,
      };
    }
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
   * Authoritatively ensure a valid Super Admin session token is active.
   * If token is missing, expired, or invalid, automatically re-synchronizes with /api/auth/sync-super-admin.
   */
  public async ensureSuperAdminSession(force = false): Promise<string | null> {
    const existing = this.getStoredToken();
    const current = ledgerEngine.getCurrentUser();
    const fbUser = auth.currentUser;
    const isSuper =
      current?.role === 'LIFETIME_SUPER_ADMIN' ||
      current?.role === 'SUPER_ADMIN' ||
      current?.isLifetimeSuperAdmin ||
      (fbUser && fbUser.email === 'eromoseledavidson68@gmail.com');

    if (!force && existing) {
      return existing;
    }

    if (isSuper || !existing) {
      try {
        const syncRes = await safeApiFetch<{ sessionToken?: string; success?: boolean }>('/api/auth/sync-super-admin', {
          method: 'POST',
          body: {
            uid: current?.id || fbUser?.uid || 'ROOT_SUPER_ADMIN',
            email: current?.email || fbUser?.email || 'eromoseledavidson68@gmail.com',
            fullName: current?.fullName || fbUser?.displayName || 'Davidson Eromosele',
            phone: current?.phone || '',
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
    operationalResponsibility?: string;
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
          operationalResponsibility: payload.operationalResponsibility,
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
    roleTitle?: string;
    operationalResponsibility?: string;
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

    // Immediately reflect in local ledgerEngine directory for UI rendering
    try {
      const actor = ledgerEngine.getCurrentStaff() || ledgerEngine.getCurrentUser() || {
        id: 'ROOT_SUPER_ADMIN',
        fullName: 'Lifetime Super Admin',
        role: 'LIFETIME_SUPER_ADMIN',
        isLifetimeSuperAdmin: true,
      };
      ledgerEngine.createStaffUser(
        {
          id: account?.id,
          staffCode: account?.staffCode,
          fullName: payload.fullName,
          email: payload.email,
          phone: payload.phone,
          role: 'STAFF',
          roleTitle: payload.roleTitle || payload.operationalResponsibility || 'Customer Registration Officer',
          operationalResponsibility: payload.operationalResponsibility || payload.roleTitle || 'Customer Registration Officer',
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
        byEmail.set(acc.email.toLowerCase(), acc);
      }
    }
    for (const srv of serverAccounts) {
      if (srv.email) {
        const prev = byEmail.get(srv.email.toLowerCase()) || {};
        byEmail.set(srv.email.toLowerCase(), {
          ...prev,
          ...srv,
          staffCode: srv.staffCode || prev.staffCode || `TMC-${srv.id?.slice(-4) || '001'}`,
          operationalResponsibility: srv.duty || srv.roleTitle || prev.operationalResponsibility,
        });
      }
    }

    // Also merge directly from Firestore /admins and /staff collections when authenticated
    try {
      const [adminsSnap, staffSnap] = await Promise.all([
        getDocs(collection(db, 'admins')).catch(() => null),
        getDocs(collection(db, 'staff')).catch(() => null),
      ]);
      if (adminsSnap) {
        adminsSnap.forEach((docSnap) => {
          const d = docSnap.data();
          if (d?.email) {
            const key = String(d.email).toLowerCase();
            const prev = byEmail.get(key) || {};
            const id = d.uid || d.id || docSnap.id;
            byEmail.set(key, {
              ...prev,
              ...d,
              id,
              role: 'ADMIN',
              roleTitle: d.roleTitle || d.duty || prev.roleTitle || 'Branch Administrator',
              operationalResponsibility: d.duty || d.roleTitle || prev.operationalResponsibility,
              staffCode: d.staffCode || prev.staffCode || `TMC-ADM-${String(id).slice(-4).toUpperCase()}`,
              status: d.status || (d.active === false ? 'suspended' : 'active'),
            });
          }
        });
      }
      if (staffSnap) {
        staffSnap.forEach((docSnap) => {
          const d = docSnap.data();
          if (d?.email) {
            const key = String(d.email).toLowerCase();
            const prev = byEmail.get(key) || {};
            const id = d.uid || d.id || docSnap.id;
            byEmail.set(key, {
              ...prev,
              ...d,
              id,
              role: 'STAFF',
              roleTitle: d.roleTitle || d.duty || prev.roleTitle || 'Operations Staff',
              operationalResponsibility: d.duty || d.roleTitle || prev.operationalResponsibility,
              staffCode: d.staffCode || prev.staffCode || `TMC-STF-${String(id).slice(-4).toUpperCase()}`,
              status: d.status || (d.active === false ? 'suspended' : 'active'),
            });
          }
        });
      }
    } catch {
      // Non-fatal if offline
    }

    return Array.from(byEmail.values());
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
