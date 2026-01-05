import { existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { resolve } from 'node:path';

const from = resolve('public/_redirects');
const toDir = resolve('dist');
const to = resolve('dist/_redirects');

console.log('[copy-web-redirects] Starting copy operation');
console.log('[copy-web-redirects] From:', from);
console.log('[copy-web-redirects] To:', to);

try {
  if (!existsSync(from)) {
    console.log('[copy-web-redirects] No public/_redirects found; skipping');
    process.exit(0);
  }

  if (!existsSync(toDir)) {
    console.log('[copy-web-redirects] dist/ does not exist; skipping');
    process.exit(0);
  }

  mkdirSync(toDir, { recursive: true });
  copyFileSync(from, to);
  console.log('[copy-web-redirects] ✅ Successfully copied _redirects to dist/');
  console.log('[copy-web-redirects] Build timestamp:', new Date().toISOString());
} catch (error) {
  console.error('[copy-web-redirects] ❌ Failed to copy redirects', error);
  process.exit(1);
}
