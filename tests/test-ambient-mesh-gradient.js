/**
 * Test Suite: Animated Lightweight CSS Ambient Gradient Mesh (tests/test-ambient-mesh-gradient.js)
 * 
 * Verifies:
 * 1. CSS variables --mesh-blob-1, --mesh-blob-2, --mesh-blob-3 in :root, mocha-lavender, and cyber-jet
 * 2. Theme color tints:
 *    - Default: Emerald, Indigo, Sky Blue soft transparencies
 *    - Mocha Lavender: Mocha Brown (#6F4E37), Pale Lavender (#E6E0F0), Platinum Silver (#E5E4E2)
 *    - Cyber Jet: Hot Pink (#FF2DA3) and Chartreuse (#D4FF3F) radiant dark halos
 * 3. .ambient-mesh-canvas container positioning (fixed, full viewport bounds, pointer-events: none, z-index: 0)
 * 4. Three .mesh-blob elements with radial gradients, 80px blur, and drift keyframe animations
 * 5. 0.6s cubic-bezier background transition for smooth theme color morphing
 * 6. HTML injection into index.html at top of <body>
 * 7. Elevated layers: #app, main, and sidebar with position: relative and z-index: 1
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

let passedCount = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
    passedCount++;
  } catch (err) {
    console.error(`✗ ${name}`);
    console.error(err);
    process.exit(1);
  }
}

console.log('\n--- STARTING AMBIENT GRADIENT MESH TEST SUITE ---\n');

test('1. CSS VARIABLES & MESH ENGINE: --mesh-blob tokens defined in :root, mocha-lavender, and cyber-jet', () => {
  const indexCss = fs.readFileSync(path.join(rootDir, 'src/index.css'), 'utf8');
  const styleCss = fs.readFileSync(path.join(rootDir, 'style.css'), 'utf8');

  for (const [name, content] of [['src/index.css', indexCss], ['style.css', styleCss]]) {
    // :root default tokens
    assert(content.includes('--mesh-blob-1') && content.includes('--mesh-blob-2') && content.includes('--mesh-blob-3'), `${name} has mesh-blob variables in :root`);

    // Mocha Lavender tokens
    const mochaPart = content.slice(content.indexOf('[data-theme="mocha-lavender"]'), content.indexOf('[data-theme="cyber-jet"]'));
    assert(mochaPart.includes('--mesh-blob-1') && mochaPart.includes('--mesh-blob-2') && mochaPart.includes('--mesh-blob-3'), `${name} has mesh-blob variables in mocha-lavender`);

    // Cyber Jet tokens
    const cyberPart = content.slice(content.indexOf('[data-theme="cyber-jet"]'));
    assert(cyberPart.includes('--mesh-blob-1') && cyberPart.includes('--mesh-blob-2') && cyberPart.includes('--mesh-blob-3'), `${name} has mesh-blob variables in cyber-jet`);
  }
});

test('2. THEME COLOR TINTS: Emerald/Indigo/Sky, Mocha/Lavender/Silver, and Hot Pink/Chartreuse', () => {
  const indexCss = fs.readFileSync(path.join(rootDir, 'src/index.css'), 'utf8');

  // Default: Emerald (16, 185, 129), Indigo (99, 102, 241), Sky Blue (56, 189, 248)
  const rootPart = indexCss.slice(indexCss.indexOf(':root'), indexCss.indexOf('/* Clean Studio'));
  assert(rootPart.includes('16, 185, 129'), 'Default mesh includes Emerald soft transparency');
  assert(rootPart.includes('99, 102, 241'), 'Default mesh includes Indigo soft transparency');
  assert(rootPart.includes('56, 189, 248'), 'Default mesh includes Sky Blue soft transparency');

  // Mocha Lavender: Mocha Brown (111, 78, 55), Pale Lavender (230, 224, 240), Platinum Silver (229, 228, 226)
  const mochaPart = indexCss.slice(indexCss.indexOf('[data-theme="mocha-lavender"]'), indexCss.indexOf('[data-theme="cyber-jet"]'));
  assert(mochaPart.includes('111, 78, 55'), 'Mocha Lavender mesh includes Mocha Brown tint');
  assert(mochaPart.includes('230, 224, 240'), 'Mocha Lavender mesh includes Pale Lavender tint');
  assert(mochaPart.includes('229, 228, 226'), 'Mocha Lavender mesh includes Platinum Silver tint');

  // Cyber Jet: Hot Pink (255, 45, 163), Chartreuse (212, 255, 63)
  const cyberPart = indexCss.slice(indexCss.indexOf('[data-theme="cyber-jet"]'));
  assert(cyberPart.includes('255, 45, 163'), 'Cyber Jet mesh includes Hot Pink radiant dark halo');
  assert(cyberPart.includes('212, 255, 63'), 'Cyber Jet mesh includes Chartreuse radiant dark halo');
});

test('3. AMBIENT MESH CONTAINER: Fixed bounds, pointer-events none, z-index 0', () => {
  const indexCss = fs.readFileSync(path.join(rootDir, 'src/index.css'), 'utf8');
  assert(indexCss.includes('.ambient-mesh-canvas'), 'CSS defines .ambient-mesh-canvas');
  assert(indexCss.includes('position: fixed'), 'Container has position: fixed');
  assert(indexCss.includes('pointer-events: none'), 'Container has pointer-events: none');
  assert(indexCss.includes('z-index: 0'), 'Container has z-index: 0');
});

test('4. THREE MESH BLOBS: Radial gradients, 80px blur, and drift keyframes', () => {
  const indexCss = fs.readFileSync(path.join(rootDir, 'src/index.css'), 'utf8');
  assert(indexCss.includes('.mesh-blob.blob-1'), 'Defines .mesh-blob.blob-1');
  assert(indexCss.includes('.mesh-blob.blob-2'), 'Defines .mesh-blob.blob-2');
  assert(indexCss.includes('.mesh-blob.blob-3'), 'Defines .mesh-blob.blob-3');

  assert(indexCss.includes('blur(80px)'), 'Applies 80px Gaussian blur to blobs');
  assert(indexCss.includes('radial-gradient'), 'Uses radial gradients for soft light dissemination');

  // Staggered keyframe animations
  assert(indexCss.includes('driftPrimary'), 'Implements driftPrimary keyframes');
  assert(indexCss.includes('driftSecondary'), 'Implements driftSecondary keyframes');
  assert(indexCss.includes('driftAccent'), 'Implements driftAccent keyframes');
});

test('5. SMOOTH THEME COLOR MORPHING: 0.6s cubic-bezier transition on .mesh-blob', () => {
  const indexCss = fs.readFileSync(path.join(rootDir, 'src/index.css'), 'utf8');
  assert(indexCss.includes('transition: background 0.6s cubic-bezier'), 'Applies 0.6s cubic-bezier transition to mesh-blob background');
});

test('6. HTML INJECTION: index.html has ambient-mesh-canvas at top of <body>', () => {
  const indexHtml = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
  assert(indexHtml.includes('class="ambient-mesh-canvas"'), 'index.html contains .ambient-mesh-canvas');
  assert(indexHtml.includes('mesh-blob blob-1') && indexHtml.includes('mesh-blob blob-2') && indexHtml.includes('mesh-blob blob-3'), 'index.html contains all 3 mesh-blob elements');

  // Verify position: placed before #root inside body
  const bodyIndex = indexHtml.indexOf('<body');
  const canvasIndex = indexHtml.indexOf('class="ambient-mesh-canvas"');
  const rootIndex = indexHtml.indexOf('id="root"');

  assert(bodyIndex < canvasIndex, 'ambient-mesh-canvas is inside <body>');
  assert(canvasIndex < rootIndex, 'ambient-mesh-canvas is inserted at top of <body> before #root');
});

test('7. ELEVATED UI LAYERS: #app, main, and sidebar carry position: relative; z-index: 1', () => {
  const indexCss = fs.readFileSync(path.join(rootDir, 'src/index.css'), 'utf8');
  assert(indexCss.includes('#app') && indexCss.includes('main') && indexCss.includes('#app-sidebar'), 'Elevates #app, main, and #app-sidebar in CSS');
  assert(indexCss.includes('position: relative') && indexCss.includes('z-index: 1'), 'Ensures elevated layers have position: relative and z-index: 1');
});

console.log(`\nAll ${passedCount} tests passed successfully!\n`);

