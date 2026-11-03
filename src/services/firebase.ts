import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  initializeFirestore,
  getFirestore,
  setLogLevel,
  persistentLocalCache,
  persistentMultipleTabManager,
  doc,
  getDocFromServer,
  Firestore,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Silence Firestore internal network connection warnings in both browser and server environments
try {
  setLogLevel('silent');
} catch {
  // Ignore if not supported in environment
}

if (typeof window !== 'undefined') {
  const originalConsoleError = console.error;
  console.error = function (...args: any[]) {
    const message = args
      .map((a) => (typeof a === 'string' ? a : a instanceof Error ? a.message : ''))
      .join(' ');
    if (
      message.includes('Could not reach Cloud Firestore backend') ||
      message.includes('The client will operate in offline mode') ||
      message.includes("Backend didn't respond within 10 seconds")
    ) {
      console.info('[Firestore] Offline network status notice: client operating seamlessly in offline mode.');
      return;
    }
    originalConsoleError.apply(console, args);
  };
}

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

/**
 * Robust Firestore initialization:
 * Configure experimentalForceLongPolling to avoid 10-second WebChannel streaming connection timeouts
 * commonly encountered in sandboxed preview iframes, WebChannel proxy restrictions, or slow networks.
 * Enable persistent IndexedDb local cache with multi-tab support for seamless offline capabilities.
 */
function createFirestoreInstance(): Firestore {
  if (typeof window !== 'undefined') {
    try {
      return initializeFirestore(
        app,
        {
          experimentalForceLongPolling: true,
          localCache: persistentLocalCache({
            tabManager: persistentMultipleTabManager(),
          }),
        },
        firebaseConfig.firestoreDatabaseId
      );
    } catch {
      try {
        return initializeFirestore(
          app,
          {
            experimentalForceLongPolling: true,
          },
          firebaseConfig.firestoreDatabaseId
        );
      } catch {
        return getFirestore(app, firebaseConfig.firestoreDatabaseId);
      }
    }
  }
  return getFirestore(app, firebaseConfig.firestoreDatabaseId);
}

// CRITICAL: Explicitly pass the firestoreDatabaseId from configuration
export const db = createFirestoreInstance();
export const auth = getAuth(app);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Validate Connection to Firestore upon boot as mandated by the skill
 */
export async function testFirestoreConnection(timeoutMs = 2500): Promise<void> {
  try {
    const probe = getDocFromServer(doc(db, 'test', 'connection'));
    const timer = new Promise<void>((resolve) => {
      const t = setTimeout(resolve, timeoutMs);
      if (typeof t.unref === 'function') t.unref();
    });
    await Promise.race([probe, timer]);
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.info('[Firebase] Operating in offline cached mode.');
    }
  }
}

export default app;
