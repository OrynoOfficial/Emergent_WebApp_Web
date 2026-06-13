/**
 * Oryno — App Store screenshot harness
 * ────────────────────────────────────
 * Generates the screenshot matrix required by Apple & Google for store
 * listings, by driving the real preview app with Playwright at the exact
 * device pixel dimensions each store mandates.
 *
 * Apple (iOS): 6.7", 6.1", 12.9" iPad Pro — at least 3 each.
 * Google Play: phone (16:9), 7" tablet, 10" tablet — at least 2 each.
 *
 * Usage:
 *   yarn add -D playwright @playwright/test
 *   yarn playwright install chromium webkit
 *   node scripts/screenshot-harness.js \
 *     --url=https://app.oryno.tech \
 *     --email=demo@oryno.tech \
 *     --password='YourPass123'
 *
 * Outputs to ./store-screenshots/<device>/<flow>-<step>.png
 *
 * Re-runnable any time the UI changes — just bump VERSION below and the
 * filenames will include the version stamp so you can A/B old vs. new.
 */
const { chromium, devices } = require('playwright');
const fs = require('fs');
const path = require('path');

const VERSION = '1.0.0';

// Apple + Google required device sizes. Names match the Playwright `devices`
// registry where possible; otherwise we use raw viewport dimensions.
const DEVICE_MATRIX = [
  // iOS
  { id: 'ios-6_7',     viewport: { width: 1290, height: 2796 }, deviceScaleFactor: 3, isMobile: true,  store: 'apple', name: 'iPhone 14 Pro Max' },
  { id: 'ios-6_1',     viewport: { width: 1179, height: 2556 }, deviceScaleFactor: 3, isMobile: true,  store: 'apple', name: 'iPhone 14 Pro' },
  { id: 'ipad-12_9',   viewport: { width: 2048, height: 2732 }, deviceScaleFactor: 2, isMobile: true,  store: 'apple', name: 'iPad Pro 12.9"' },
  // Android
  { id: 'android-phone', viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 3, isMobile: true,  store: 'google', name: 'Pixel 7' },
  { id: 'android-7in',   viewport: { width: 1200, height: 1920 }, deviceScaleFactor: 2, isMobile: true,  store: 'google', name: '7" tablet' },
  { id: 'android-10in',  viewport: { width: 1600, height: 2560 }, deviceScaleFactor: 2, isMobile: true,  store: 'google', name: '10" tablet' },
];

// The 5 flows we capture for each device. Add more as the app grows.
const FLOWS = [
  { id: '01-welcome',       path: '/login' },
  { id: '02-services',      path: '/services',    auth: true },
  { id: '03-cinema-search', path: '/cinema',      auth: true },
  { id: '04-hotel-detail',  path: '/hotels',      auth: true },
  { id: '05-bookings',      path: '/my/bookings', auth: true },
];

function parseArgs() {
  const out = { url: 'https://app.oryno.tech', email: null, password: null };
  process.argv.slice(2).forEach((arg) => {
    const [k, v] = arg.replace(/^--/, '').split('=');
    if (k && v) out[k] = v;
  });
  return out;
}

async function login(page, baseUrl, email, password) {
  await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded' });
  await page.click('[data-testid="welcome-login-btn"]');
  await page.fill('[data-testid="login-identifier-input"]', email);
  await page.click('[data-testid="login-continue-btn"]');
  await page.fill('[data-testid="login-password-input"]', password);
  await page.click('[data-testid="login-submit-btn"]');
  await page.waitForLoadState('networkidle');
}

async function runDevice(browser, device, flows, args) {
  const outDir = path.resolve(__dirname, '..', 'store-screenshots', device.id);
  fs.mkdirSync(outDir, { recursive: true });

  const context = await browser.newContext({
    viewport: device.viewport,
    deviceScaleFactor: device.deviceScaleFactor,
    isMobile: device.isMobile,
    userAgent: device.id.startsWith('ios') || device.id.startsWith('ipad')
      ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148'
      : 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Mobile',
  });
  const page = await context.newPage();

  // Authenticate once per device so the auth-required flows reuse the session.
  if (args.email && args.password) {
    try {
      await login(page, args.url, args.email, args.password);
    } catch (err) {
      console.warn(`  ⚠️  Login failed on ${device.id}:`, err.message);
    }
  }

  for (const flow of flows) {
    if (flow.auth && (!args.email || !args.password)) continue;
    try {
      await page.goto(`${args.url}${flow.path}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2500); // let lazy content settle
      const file = path.join(outDir, `${VERSION}__${flow.id}.png`);
      await page.screenshot({ path: file, fullPage: false });
      console.log(`  ✓ ${device.id}/${flow.id}`);
    } catch (err) {
      console.warn(`  ✗ ${device.id}/${flow.id}: ${err.message}`);
    }
  }

  await context.close();
}

(async () => {
  const args = parseArgs();
  console.log(`Oryno screenshot harness v${VERSION} → ${args.url}`);

  const browser = await chromium.launch();
  for (const device of DEVICE_MATRIX) {
    console.log(`📱 ${device.name} (${device.id})`);
    await runDevice(browser, device, FLOWS, args);
  }
  await browser.close();
  console.log('Done. Output in ./store-screenshots/');
})();
