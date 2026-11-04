/**
 * Vercel Serverless Function Handler for TEAMACRO SERVICES LTD.
 * Bundled into /api/index.js during `npm run build` so Vercel Node.js ESM
 * runtime executes a single self-contained module with zero relative-import crashes.
 */
import app from '../../server';

export default async function handler(req: any, res: any) {
  try {
    return await new Promise<void>((resolve) => {
      res.on('finish', resolve);
      res.on('close', resolve);
      app(req, res, (err: any) => {
        if (err && !res.headersSent) {
          const correlationId = `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
          const safeMessage = 'A server error occurred while processing the request.';
          console.error(
            '[TEAMACRO_SERVER_ERROR]',
            JSON.stringify({
              correlationId,
              timestamp: new Date().toISOString(),
              endpoint: req?.url || '/api',
              operation: 'VERCEL_EXPRESS_NEXT_ERROR',
              errorCategory: 'INTERNAL_SERVER_ERROR',
              firebaseErrorCode: err?.code || 'INTERNAL_SERVER_ERROR',
              statusCode: 500,
              message: err?.message || 'Unhandled Express error',
            })
          );
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(
            JSON.stringify({
              success: false,
              error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: safeMessage,
                correlationId,
              },
              message: safeMessage,
              correlationId,
              statusCode: 500,
            })
          );
        }
        resolve();
      });
    });
  } catch (err: any) {
    const correlationId = `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    const safeMessage = 'A server error occurred while processing the request.';
    console.error(
      '[TEAMACRO_SERVER_ERROR]',
      JSON.stringify({
        correlationId,
        timestamp: new Date().toISOString(),
        endpoint: req?.url || '/api',
        operation: 'VERCEL_HANDLER_TOP_LEVEL',
        errorCategory: 'INTERNAL_SERVER_ERROR',
        firebaseErrorCode: err?.code || 'INTERNAL_SERVER_ERROR',
        statusCode: 500,
        message: err?.message || 'Unhandled invocation exception',
      })
    );
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(
        JSON.stringify({
          success: false,
          error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: safeMessage,
            correlationId,
          },
          message: safeMessage,
          correlationId,
          statusCode: 500,
        })
      );
    }
  }
}
