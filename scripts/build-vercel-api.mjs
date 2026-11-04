import { build } from 'esbuild';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

async function buildVercelApi() {
  await build({
    entryPoints: [path.resolve(rootDir, 'src/server/vercelHandler.ts')],
    outfile: path.resolve(rootDir, 'api/index.js'),
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'esm',
    define: {
      'process.env.VERCEL': '"1"',
    },
    external: ['vite', 'firebase-admin', 'firebase-admin/app', 'firebase-admin/auth', 'firebase-admin/firestore'],
    banner: {
      js: [
        '// Auto-generated self-contained Vercel Serverless Function bundle for TEAMACRO SERVICES LTD',
        'import { createRequire as __createRequire } from "node:module";',
        'const require = __createRequire(import.meta.url);',
      ].join('\n'),
    },
    logLevel: 'info',
  });
  console.log('[BUILD] Successfully bundled self-contained Vercel serverless handler -> api/index.js');
}

buildVercelApi().catch((err) => {
  console.error('[BUILD] Failed to bundle Vercel serverless handler:', err);
  process.exit(1);
});
