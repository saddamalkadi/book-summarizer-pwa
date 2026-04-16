import { chromium, devices } from 'playwright';

const baseUrl = process.env.RC_BASE_URL || 'http://127.0.0.1:4173/';

async function bypassAuthGate(page){
  const gate = page.locator('#authGate.show');
  if (await gate.count()){
    await gate.waitFor({ state: 'visible' });
    await page.evaluate(() => {
      const gateEl = document.getElementById('authGate');
      if (gateEl) gateEl.classList.remove('show');
      document.body.classList.remove('mobileSidebarOpen');
      const side = document.getElementById('side');
      if (side){
        side.classList.remove('show');
        side.setAttribute('aria-hidden', 'true');
      }
      const backdrop = document.getElementById('backdrop');
      if (backdrop){
        backdrop.classList.remove('show');
        backdrop.hidden = true;
      }
    });
  }
}

async function checkDesktop(browser){
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await bypassAuthGate(page);

  await page.locator('#topTitle').waitFor({ state: 'visible' });
  await page.locator('.topbar').waitFor({ state: 'visible' });
  await page.locator('.subtopbar').waitFor({ state: 'visible' });
  await page.locator('.side').waitFor({ state: 'visible' });

  const sideBox = await page.locator('.side').boundingBox();
  const topBarBox = await page.locator('.topbar').boundingBox();
  if (!sideBox || sideBox.width < 240) throw new Error('Desktop sidebar width is unstable.');
  if (!topBarBox || topBarBox.height < 40) throw new Error('Desktop topbar is not visible.');

  await page.locator('#darkModeBtn').click();
  await page.locator('body.dark').waitFor({ state: 'attached' });

  await page.locator('.navbtn[data-page="chat"]').click();
  await page.locator('#page-chat.page.active').waitFor({ state: 'visible' });
  await page.locator('#chatInput').click();
  await page.locator('#chatInput').fill('اختبار smoke للحقل.');
  const rowsAfterExpand = await page.locator('#chatInput').getAttribute('rows');
  if (Number(rowsAfterExpand || 0) < 2) throw new Error('Composer did not expand as expected.');

  await page.locator('.navbtn[data-page="downloads"]').click();
  await page.locator('#page-downloads.page.active').waitFor({ state: 'visible' });
  await page.locator('#downloadsOverview').waitFor({ state: 'visible' });
  const downloadsText = await page.locator('#downloadsOverview').innerText();
  if (!downloadsText.includes('APK') || downloadsText.includes('AAB')) {
    throw new Error('Downloads overview still exposes unexpected artifacts.');
  }

  await page.close();
}

async function checkMobile(browser){
  const context = await browser.newContext({
    ...devices['Pixel 7'],
    locale: 'ar-SA'
  });
  const page = await context.newPage();
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await bypassAuthGate(page);

  try {
    await page.locator('#openSideBtn').click();
  } catch (error) {
    const overlayDebug = await page.evaluate(() => {
      const btn = document.getElementById('openSideBtn');
      const side = document.getElementById('side');
      const rect = btn?.getBoundingClientRect();
      const hit = rect ? document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2) : null;
      return {
        bodyClasses: document.body.className,
        sideClass: side?.className || '',
        sideAriaHidden: side?.getAttribute('aria-hidden'),
        sidePointerEvents: side ? getComputedStyle(side).pointerEvents : '',
        sideVisibility: side ? getComputedStyle(side).visibility : '',
        sideTransform: side ? getComputedStyle(side).transform : '',
        hitTag: hit?.tagName || '',
        hitId: hit?.id || '',
        hitClass: hit?.className || ''
      };
    });
    throw new Error(`Mobile sidebar button blocked: ${JSON.stringify(overlayDebug)} :: ${error.message}`);
  }
  await page.locator('.side.show').waitFor({ state: 'visible' });
  const sideBox = await page.locator('.side.show').boundingBox();
  if (!sideBox || sideBox.width < 220) throw new Error('Mobile drawer width is unstable.');

  await page.locator('.navbtn[data-page="chat"]').click();
  await page.locator('#page-chat.page.active').waitFor({ state: 'visible' });
  await page.locator('#chatInput').click();
  await page.locator('#chatInput').fill('اختبار موبايل.');

  const topBarVisible = await page.locator('.topbar').isVisible();
  if (!topBarVisible) throw new Error('Mobile topbar is not reachable.');

  await page.locator('#darkModeBtn').click();
  await page.locator('body.dark').waitFor({ state: 'attached' });

  await page.locator('.backdrop2').click({ force: true });
  await page.locator('.side.show').waitFor({ state: 'hidden' });

  await context.close();
}

const browser = await chromium.launch({ headless: true });
try {
  await checkDesktop(browser);
  await checkMobile(browser);
  console.log(`RC smoke passed for ${baseUrl}`);
} finally {
  await browser.close();
}
