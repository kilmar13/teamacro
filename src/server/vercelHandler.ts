import app from '../../server';

/**
 * Vercel Serverless Function Entry Point for TEAMACRO SERVICES LTD.
 * Normalizes Vercel rewrite URLs (`/api/index?__path=...`, `/api?__path=...`, or `/api/...`)
 * and delegates execution to the Express application without ever throwing an uncaught exception.
 */
export default function handler(req: any, res: any) {
  try {
    const rawUrl = typeof req?.url === 'string' && req.url.length > 0 ? req.url : '/';
    const parsed = new URL(rawUrl, 'http://localhost');
    const rewrittenPath = parsed.searchParams.get('__path');

    if (rewrittenPath !== null) {
      parsed.searchParams.delete('__path');
      const cleanSubPath = rewrittenPath.replace(/^\/+/, '');
      const remainingQuery = parsed.searchParams.toString();
      req.url = `/api/${cleanSubPath}${remainingQuery ? `?${remainingQuery}` : ''}`;
    } else if (parsed.pathname === '/api/index' || parsed.pathname === '/api/index.js') {
      req.url = `/api${parsed.search || ''}`;
    } else if (!parsed.pathname.startsWith('/api') && parsed.pathname !== '/health') {
      req.url = `/api${parsed.pathname.startsWith('/') ? '' : '/'}${parsed.pathname}${parsed.search || ''}`;
    }

    return (app as any)(req, res);
  } catch (err: any) {
    console.error('[TEAMACRO_VERCEL_HANDLER_ERROR]', err?.message || err);
    if (res && !res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({
          success: false,
          error: 'INTERNAL_SERVER_ERROR',
          message: err?.message || 'An unexpected server error occurred.',
        })
      );
    }
  }
}
