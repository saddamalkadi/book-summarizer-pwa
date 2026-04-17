import { chromium, devices } from 'playwright';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5001/';
const EXPECTED_VERSION = process.env.EXPECTED_VERSION || '8.95';
const issues = [];

function log(...args) { console.log('[smoke]', ...args); }
function fail(msg) { issues.push(msg); console.error('[smoke][FAIL]', msg); }

async function dismissAuthGateIfVisible(page) {
  const gate = page.locator('#authGate.show').first();
  if (await gate.count() === 0 || !(await gate.isVisible().catch(() => false))) return false;
  log('auth-gate is open — force-hiding it for UI smoke');
  await page.evaluate(() => {
    const g = document.getElementById('authGate');
    if (g) g.classList.remove('show');
    document.body.classList.remove('auth-gate-open');
  });
  await page.waitForTimeout(150);
  return true;
}

async function checkSelectorVisible(page, selector, label) {
  try {
    const locator = page.locator(selector).first();
    const count = await locator.count();
    if (count === 0) { fail(`${label}: not found (${selector})`); return false; }
    const visible = await locator.isVisible().catch(() => false);
    if (!visible) { fail(`${label}: not visible (${selector})`); return false; }
    log(`OK  ${label} (${selector})`);
    return true;
  } catch (e) {
    fail(`${label} check error: ${e.message}`);
    return false;
  }
}

async function clickQuiet(page, selector) {
  const loc = page.locator(selector).first();
  await loc.click({ force: true }).catch(() => {});
}

async function checkDesktop() {
  log('=== DESKTOP ===');
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('pageerror', (err) => { consoleErrors.push(String(err.message || err)); });
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const t = msg.text();
      if (!/favicon|manifest|Service Worker|blocked a frame|CORS|font|Noto|GSI|registered|waiting|401|ERR_FAILED/i.test(t)) {
        consoleErrors.push('console: ' + t);
      }
    }
  });
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3500);
  await dismissAuthGateIfVisible(page);

  await checkSelectorVisible(page, '.topbar', 'topbar');
  await checkSelectorVisible(page, '#side', 'sidebar');
  await checkSelectorVisible(page, '[data-page="chat"]', 'chat nav');
  await checkSelectorVisible(page, '#newThreadBtn', 'new thread button');
  await checkSelectorVisible(page, '#sideAccountStrip', 'side account strip');

  const verLabel = await page.textContent('#sideVersionLabel').catch(() => '');
  const re = new RegExp(EXPECTED_VERSION.replace('.', '\\.'));
  if (!re.test(verLabel || '')) fail(`sideVersionLabel != v${EXPECTED_VERSION}: got "${verLabel}"`);
  else log(`OK  sideVersionLabel: ${verLabel}`);

  await clickQuiet(page, '[data-page="chat"]');
  await page.waitForTimeout(500);
  await checkSelectorVisible(page, '#chatInput', 'chat input (composer)');
  await checkSelectorVisible(page, '#sendBtn', 'send button');

  log('console-error-count:', consoleErrors.length);
  if (consoleErrors.length) log('first errors:', consoleErrors.slice(0, 3));

  await browser.close();
}

async function checkMobile() {
  log('=== MOBILE ===');
  const browser = await chromium.launch();
  const context = await browser.newContext({ ...devices['Pixel 7'] });
  const page = await context.newPage();
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3500);
  await dismissAuthGateIfVisible(page);

  await checkSelectorVisible(page, '.topbar', 'topbar (mobile)');
  await checkSelectorVisible(page, '#openSideBtn', 'openSideBtn (mobile)');

  await clickQuiet(page, '#openSideBtn');
  await page.waitForTimeout(400);
  const sideVisible = await page.locator('#side').first().isVisible().catch(() => false);
  if (!sideVisible) fail('Mobile: side drawer did not open');
  else log('OK  Mobile: side drawer opened');

  await clickQuiet(page, '[data-page="chat"]');
  await page.waitForTimeout(400);
  await checkSelectorVisible(page, '#chatInput', 'mobile chat input');

  await browser.close();
}

try {
  await checkDesktop();
  await checkMobile();
} catch (e) {
  fail('fatal: ' + (e.message || e));
}

console.log('\n=== SUMMARY ===');
if (issues.length === 0) {
  console.log('ALL_CHECKS_PASSED');
  process.exit(0);
} else {
  console.log(`FAILURES (${issues.length}):`);
  for (const i of issues) console.log('  -', i);
  process.exit(2);
}
