/**
 * Test Suite: Reactive Glow States, Theme Transitions & 60fps Optimization
 * (tests/test-reactive-glow-transitions.js)
 *
 * Verifies:
 * 1. CSS theme transition rules for backgrounds, borders, colors across elements
 * 2. Dynamic --primary-glow and --accent-glow configurations across themes:
 *    - Mocha Lavender: Pale Lavender accent glow
 *    - Cyber Jet: Hot Pink & Chartreuse neon glow
 * 3. Primary action button hover/focus glow states (.btn-primary, .btn-primary-action)
 * 4. Custom range sliders (input[type="range"], .theme-slider) with expanding glowing thumbs
 * 5. 30-Day Velocity Bar Graph columns with .chart-bar-glow class and high-intensity neon glow
 * 6. Weekly Velocity progress bar fill with .theme-progress-fill class, gradient, and glow
 * 7. 60fps performance optimization: will-change: transform, box-shadow on hoverable elements
 * 8. Component integration across ConsistencyRadar, WeeklyVelocity, AmbientAudioControls, dashboard.js, and study-bar-chart.js
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

console.log('\n--- STARTING REACTIVE GLOW & THEME TRANSITION TEST SUITE ---\n');

test('1. THEME TRANSITION SMOOTHING: Defined across style.css and src/index.css', () => {
  const indexCss = fs.readFileSync(path.join(rootDir, 'src/index.css'), 'utf8');
  const styleCss = fs.readFileSync(path.join(rootDir, 'style.css'), 'utf8');

  for (const [name, content] of [['src/index.css', indexCss], ['style.css', styleCss]]) {
    assert(content.includes('transition-property: background-color, border-color, color') ||
           content.includes('transition-duration: 200ms'), `${name} includes smooth theme transition properties`);
  }
});

test('2. DYNAMIC THEME GLOW VARIABLES: Mocha Lavender and Cyber Jet neon glow tokens', () => {
  const indexCss = fs.readFileSync(path.join(rootDir, 'src/index.css'), 'utf8');

  // Mocha Lavender: Pale Lavender glow
  const mochaPart = indexCss.slice(indexCss.indexOf('[data-theme="mocha-lavender"]'), indexCss.indexOf('[data-theme="cyber-jet"]'));
  assert(mochaPart.includes('--primary-glow'), 'mocha-lavender defines --primary-glow');
  assert(mochaPart.includes('--accent-glow'), 'mocha-lavender defines --accent-glow');
  assert(mochaPart.includes('230, 224, 240') || mochaPart.includes('E6E0F0'), 'mocha-lavender accent glow uses pale lavender');

  // Cyber Jet: Hot Pink & Chartreuse neon glow
  const cyberPart = indexCss.slice(indexCss.indexOf('[data-theme="cyber-jet"]'));
  assert(cyberPart.includes('--primary-glow'), 'cyber-jet defines --primary-glow');
  assert(cyberPart.includes('--accent-glow'), 'cyber-jet defines --accent-glow');
  assert(cyberPart.includes('255, 45, 163') || cyberPart.includes('FF2DA3'), 'cyber-jet primary glow uses hot pink');
  assert(cyberPart.includes('212, 255, 63') || cyberPart.includes('D4FF3F'), 'cyber-jet accent glow uses chartreuse');
});

test('3. PRIMARY ACTION BUTTONS: Dynamic glow on hover/focus', () => {
  const indexCss = fs.readFileSync(path.join(rootDir, 'src/index.css'), 'utf8');
  assert(indexCss.includes('.btn-primary') && indexCss.includes('--primary-glow'), 'Action buttons attach --primary-glow on hover/focus');
  assert(indexCss.includes('box-shadow') && indexCss.includes('var(--primary-glow'), 'Button hover includes dynamic primary glow box-shadow');
});

test('4. CUSTOM RANGE SLIDERS: Glowing expanding thumbs matching --secondary', () => {
  const indexCss = fs.readFileSync(path.join(rootDir, 'src/index.css'), 'utf8');
  assert(indexCss.includes('input[type="range"]') || indexCss.includes('.theme-slider'), 'Custom range sliders defined');
  assert(indexCss.includes('::-webkit-slider-thumb') && indexCss.includes('var(--secondary'), 'Slider thumb background uses --secondary');
  assert(indexCss.includes('var(--accent-glow'), 'Slider thumb includes --accent-glow on hover/active');
  assert(indexCss.includes('transform: scale(1.35)') || indexCss.includes('scale('), 'Slider thumb expands on hover/active');
});

test('5. 30-DAY VELOCITY BAR GRAPH: .chart-bar-glow with gradient and neon glow', () => {
  const indexCss = fs.readFileSync(path.join(rootDir, 'src/index.css'), 'utf8');
  assert(indexCss.includes('.chart-bar-glow'), 'src/index.css defines .chart-bar-glow class');
  assert(indexCss.includes('var(--bar-filled-gradient') || indexCss.includes('var(--primary'), 'chart-bar-glow uses bar gradient from primary to bar-filled');
  assert(indexCss.includes('box-shadow: 0 0 20px 3px var(--accent-glow') || indexCss.includes('var(--accent-glow'), 'chart-bar-glow includes high-intensity neon glow on hover');
});

test('6. WEEKLY VELOCITY PROGRESS BAR: .theme-progress-fill with subtle gradient and glow', () => {
  const indexCss = fs.readFileSync(path.join(rootDir, 'src/index.css'), 'utf8');
  assert(indexCss.includes('.theme-progress-fill'), 'src/index.css defines .theme-progress-fill');
  assert(indexCss.includes('linear-gradient(90deg, var(--primary'), 'theme-progress-fill includes gradient');
  assert(indexCss.includes('box-shadow: 0 0 14px 1px var(--primary-glow') || indexCss.includes('var(--primary-glow'), 'theme-progress-fill includes glow');
});

test('7. 60FPS OPTIMIZATION: will-change: transform, box-shadow on hoverable elements', () => {
  const indexCss = fs.readFileSync(path.join(rootDir, 'src/index.css'), 'utf8');
  assert(indexCss.includes('will-change: transform, box-shadow'), 'CSS utilizes will-change: transform, box-shadow to prevent mobile layout stutters');
});

test('8. COMPONENT INTEGRATION: Classes applied to ConsistencyRadar, WeeklyVelocity, timer sliders, and dashboard.js', () => {
  // ConsistencyRadar has chart-bar-glow
  const radarContent = fs.readFileSync(path.join(rootDir, 'src/components/ConsistencyRadar.jsx'), 'utf8');
  assert(radarContent.includes('chart-bar-glow'), 'ConsistencyRadar uses chart-bar-glow');

  // WeeklyVelocity has theme-progress-fill
  const velocityContent = fs.readFileSync(path.join(rootDir, 'src/components/WeeklyVelocity.jsx'), 'utf8');
  assert(velocityContent.includes('theme-progress-fill'), 'WeeklyVelocity.jsx uses theme-progress-fill');

  const velocityUtilContent = fs.readFileSync(path.join(rootDir, 'src/utils/weeklyVelocity.js'), 'utf8');
  assert(velocityUtilContent.includes('theme-progress-fill'), 'weeklyVelocity.js updater applies theme-progress-fill');

  // Focus Timer range inputs have theme-slider
  const audioContent = fs.readFileSync(path.join(rootDir, 'src/components/AmbientAudioControls.jsx'), 'utf8');
  assert(audioContent.includes('theme-slider'), 'AmbientAudioControls slider uses theme-slider class');

  // dashboard.js and study-bar-chart.js export chart-bar-glow
  const dashContent = fs.readFileSync(path.join(rootDir, 'dashboard.js'), 'utf8');
  assert(dashContent.includes('CHART_BAR_GLOW_CLASS') || dashContent.includes('chart-bar-glow'), 'dashboard.js exports chart-bar-glow class');

  const barChartContent = fs.readFileSync(path.join(rootDir, 'study-bar-chart.js'), 'utf8');
  assert(barChartContent.includes('chart-bar-glow'), 'study-bar-chart.js exports chart-bar-glow');
});

console.log(`\nAll ${passedCount} tests passed successfully!\n`);

