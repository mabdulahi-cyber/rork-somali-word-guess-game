import { existsSync, mkdirSync, copyFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';

const publicDir = resolve('public');
const toDir = resolve('dist');

try {
  if (!existsSync(toDir)) {
    console.log('[copy-web-assets] dist/ does not exist; skipping');
    process.exit(0);
  }

  mkdirSync(toDir, { recursive: true });

  const filesToCopy = ['_redirects'];
  
  for (const file of filesToCopy) {
    const from = resolve(publicDir, file);
    const to = resolve(toDir, file);
    
    if (existsSync(from)) {
      copyFileSync(from, to);
      console.log('[copy-web-assets] Copied', file);
    } else {
      console.log('[copy-web-assets] File not found, skipping:', file);
    }
  }

  console.log('[copy-web-assets] Done copying web assets');
} catch (error) {
  console.error('[copy-web-assets] Failed to copy assets', error);
  process.exit(1);
}
