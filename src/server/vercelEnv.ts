/**
 * Marks the current Node.js runtime as a serverless invocation before `server.ts` is imported.
 * Prevents `server.ts` from starting a persistent HTTP listener or mounting Vite dev middleware.
 */
(globalThis as any).__TEAMACRO_SERVERLESS__ = true;
process.env.VERCEL = '1';
