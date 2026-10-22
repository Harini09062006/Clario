import esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';

async function buildServer() {
  console.log('[Build Server] Preparing Vercel serverless function bundles...');

  // Remove old .ts files in api/ to avoid Vercel duplicate function conflicts
  const tsIndex = path.resolve('api', 'index.ts');
  const tsCatchAll = path.resolve('api', '[...all].ts');
  const jsCatchAll = path.resolve('api', '[...all].js');
  if (fs.existsSync(tsIndex)) {
    fs.unlinkSync(tsIndex);
    console.log('[Build Server] Removed legacy api/index.ts');
  }
  if (fs.existsSync(tsCatchAll)) {
    fs.unlinkSync(tsCatchAll);
    console.log('[Build Server] Removed legacy api/[...all].ts');
  }
  if (fs.existsSync(jsCatchAll)) {
    fs.unlinkSync(jsCatchAll);
    console.log('[Build Server] Removed legacy api/[...all].js');
  }

  // Ensure api directory exists
  if (!fs.existsSync('api')) {
    fs.mkdirSync('api', { recursive: true });
  }

  // Bundle server.ts into api/index.js
  await esbuild.build({
    entryPoints: ['server.ts'],
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node20',
    packages: 'external',
    outfile: 'api/index.js',
    banner: {
      js: '// Clario Vercel Serverless Function - Built with esbuild\n',
    },
    footer: {
      js: '\nexport const config = { maxDuration: 60 };\n',
    },
  });
  console.log('[Build Server] Generated api/index.js');

  console.log('[Build Server] Serverless build completed successfully.');
}

buildServer().catch((err) => {
  console.error('[Build Server] Build failed:', err);
  process.exit(1);
});
