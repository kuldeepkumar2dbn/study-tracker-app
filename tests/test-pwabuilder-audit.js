import fs from 'fs';
import path from 'path';

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASS: ${message}`);
}

console.log('--- Starting PWABuilder & PWA Asset Audit ---');

// 1. Audit manifest.json
const manifestPath = path.resolve('public/manifest.json');
assert(fs.existsSync(manifestPath), 'public/manifest.json must exist');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

assert(manifest.id === '/', 'Manifest id must be "/"');
assert(manifest.name === 'Study Tracker Pro', 'Manifest name matches brand');
assert(manifest.short_name === 'StudyTracker', 'Manifest short_name matches');
assert(manifest.start_url === '/', 'Manifest start_url must be "/"');
assert(manifest.scope === '/', 'Manifest scope must be "/"');
assert(manifest.display === 'standalone', 'Manifest display must be "standalone"');
assert(manifest.orientation === 'portrait-primary', 'Manifest orientation must be "portrait-primary"');
assert(manifest.theme_color === '#4f46e5', 'Manifest theme_color must be "#4f46e5"');
assert(manifest.background_color === '#ffffff', 'Manifest background_color must be "#ffffff"');

// 2. Audit Icons
assert(Array.isArray(manifest.icons) && manifest.icons.length >= 4, 'Manifest must have at least 4 icons');

const requiredIcons = [
  { sizes: '192x192', purpose: 'any', width: 192, height: 192 },
  { sizes: '192x192', purpose: 'maskable', width: 192, height: 192 },
  { sizes: '512x512', purpose: 'any', width: 512, height: 512 },
  { sizes: '512x512', purpose: 'maskable', width: 512, height: 512 }
];

for (const req of requiredIcons) {
  const iconEntry = manifest.icons.find(
    (i) => i.sizes === req.sizes && i.purpose === req.purpose
  );
  assert(iconEntry, `Manifest must have separate entry for ${req.sizes} with purpose "${req.purpose}"`);
  
  const iconDiskPath = path.join('public', iconEntry.src.replace(/^\//, ''));
  assert(fs.existsSync(iconDiskPath), `Icon file exists at ${iconDiskPath}`);

  const buf = fs.readFileSync(iconDiskPath);
  assert(buf.slice(0, 8).toString('hex') === '89504e470d0a1a0a', `${iconDiskPath} has valid PNG header`);
  const w = buf.readUInt32BE(16);
  const h = buf.readUInt32BE(20);
  assert(w === req.width && h === req.height, `${iconDiskPath} dimensions match exact ${req.width}x${req.height} (got ${w}x${h})`);
}

// 3. Audit Screenshots
assert(Array.isArray(manifest.screenshots) && manifest.screenshots.length >= 2, 'Manifest must have at least 2 screenshots');

const wideScreenshot = manifest.screenshots.find((s) => s.form_factor === 'wide');
assert(wideScreenshot, 'Manifest must have screenshot with form_factor "wide"');
assert(wideScreenshot.sizes === '1280x720', 'Wide screenshot sizes must be "1280x720"');
const wideDiskPath = path.join('public', wideScreenshot.src.replace(/^\//, ''));
assert(fs.existsSync(wideDiskPath), `Wide screenshot exists at ${wideDiskPath}`);
const wideBuf = fs.readFileSync(wideDiskPath);
assert(wideBuf.readUInt32BE(16) === 1280 && wideBuf.readUInt32BE(20) === 720, 'Wide screenshot has 1280x720 dimensions');

const narrowScreenshot = manifest.screenshots.find((s) => s.form_factor === 'narrow');
assert(narrowScreenshot, 'Manifest must have screenshot with form_factor "narrow"');
assert(narrowScreenshot.sizes === '390x844', 'Narrow screenshot sizes must be "390x844"');
const narrowDiskPath = path.join('public', narrowScreenshot.src.replace(/^\//, ''));
assert(fs.existsSync(narrowDiskPath), `Narrow screenshot exists at ${narrowDiskPath}`);
const narrowBuf = fs.readFileSync(narrowDiskPath);
assert(narrowBuf.readUInt32BE(16) === 390 && narrowBuf.readUInt32BE(20) === 844, 'Narrow screenshot has 390x844 dimensions');

// 4. Audit vercel.json
const vercelPath = path.resolve('vercel.json');
assert(fs.existsSync(vercelPath), 'vercel.json must exist');
const vercel = JSON.parse(fs.readFileSync(vercelPath, 'utf8'));

const manifestHeader = vercel.headers.find((h) => h.source === '/manifest.json');
assert(manifestHeader, 'vercel.json has dedicated header block for /manifest.json');
const manifestCt = manifestHeader.headers.find((h) => h.key === 'Content-Type');
assert(manifestCt && manifestCt.value.includes('application/manifest+json'), 'manifest.json has Content-Type: application/manifest+json');

const assetlinksHeader = vercel.headers.find((h) => h.source === '/.well-known/assetlinks.json');
assert(assetlinksHeader, 'vercel.json has dedicated header block for /.well-known/assetlinks.json');
const assetlinksCt = assetlinksHeader.headers.find((h) => h.key === 'Content-Type');
assert(assetlinksCt && assetlinksCt.value.includes('application/json'), 'assetlinks.json has Content-Type: application/json');

const swHeader = vercel.headers.find((h) => h.source === '/sw.js');
assert(swHeader, 'vercel.json has dedicated header block for /sw.js');
const swCt = swHeader.headers.find((h) => h.key === 'Content-Type');
assert(swCt && swCt.value.includes('application/javascript'), 'sw.js has Content-Type: application/javascript');

// Check rewrites preserve static assets
assert(Array.isArray(vercel.rewrites), 'vercel.json has explicit rewrites list');
assert(vercel.rewrites.some((r) => r.source === '/manifest.json' && r.destination === '/manifest.json'), 'manifest.json rewrite is direct');
assert(vercel.rewrites.some((r) => r.source === '/sw.js' && r.destination === '/sw.js'), 'sw.js rewrite is direct');
assert(vercel.rewrites.some((r) => r.source === '/icons/(.*)' && r.destination === '/icons/$1'), 'icons rewrite is direct');
assert(vercel.rewrites.some((r) => r.source === '/.well-known/(.*)' && r.destination === '/.well-known/$1'), '.well-known rewrite is direct');

// 5. Audit index.html
const indexPath = path.resolve('index.html');
const indexHtml = fs.readFileSync(indexPath, 'utf8');
assert(indexHtml.includes('rel="manifest"') && indexHtml.includes('href="/manifest.json"'), 'index.html has <link rel="manifest" href="/manifest.json" />');
assert(indexHtml.includes('name="theme-color"') && indexHtml.includes('#4f46e5'), 'index.html has <meta name="theme-color" content="#4f46e5" />');
assert(indexHtml.includes('navigator.serviceWorker.register'), 'index.html has serviceWorker.register call');

// 6. Audit assetlinks.json
const assetlinksPath = path.resolve('public/.well-known/assetlinks.json');
assert(fs.existsSync(assetlinksPath), 'assetlinks.json exists');
const assetlinks = JSON.parse(fs.readFileSync(assetlinksPath, 'utf8'));
assert(Array.isArray(assetlinks) && assetlinks[0].target.namespace === 'android_app', 'assetlinks.json is configured for android_app target');

console.log('\n🎉 ALL PWA & PWABuilder AUDIT CHECKS PASSED SUCCESSFULLY!');
