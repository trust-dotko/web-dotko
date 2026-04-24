/**
 * Setup script — copies branding assets from dtk/dtk/assets/ to web/public/
 * 
 * Run: node setup-assets.js
 */
import { cpSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const assetsDir = join(__dirname, '..', 'dtk', 'dtk', 'assets');
const publicDir = join(__dirname, 'public');

// Ensure public directory exists
if (!existsSync(publicDir)) {
  mkdirSync(publicDir, { recursive: true });
  console.log('Created public/ directory');
}

// Assets to copy
const assets = [
  { src: 'icon.png',    dest: 'icon.png' },
  { src: 'favicon.png', dest: 'favicon.png' },
  { src: 'splash-icon.png', dest: 'splash-icon.png' },
];

for (const { src, dest } of assets) {
  const srcPath = join(assetsDir, src);
  const destPath = join(publicDir, dest);
  
  if (existsSync(srcPath)) {
    cpSync(srcPath, destPath);
    console.log(`✓ Copied ${src} → public/${dest}`);
  } else {
    console.warn(`⚠ Source not found: ${srcPath}`);
  }
}

console.log('\n✅ Branding assets setup complete!');
