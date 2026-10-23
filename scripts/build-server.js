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

  // Bundle server.ts into api/index.js for Vercel
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

  // Also bundle server.ts into server.js for Render / standalone Node.js production service
  await esbuild.build({
    entryPoints: ['server.ts'],
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node20',
    packages: 'external',
    outfile: 'server.js',
    banner: {
      js: '// Clario Production Server - Built with esbuild\n',
    },
  });
  console.log('[Build Server] Generated server.js for Render/standalone service');

  console.log('[Build Server] Server builds completed successfully.');
}

buildServer().catch((err) => {
  console.error('[Build Server] Build failed:', err);
  process.exit(1);
});
