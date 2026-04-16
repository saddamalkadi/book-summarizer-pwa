import { chromium, devices } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5001/';
const OUT = 'screenshots';
mkdirSync(OUT, { recursive: true });

async function shot(page, name) {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
  console.log(`  saved ${OUT}/${name}.png`);
}

const browser = await chromium.launch();

// Desktop light
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  await shot(page, 'desktop-home-light');
  await page.locator('[data-page="chat"]').first().click();
  await page.waitForTimeout(400);
  await shot(page, 'desktop-chat-light');
  await page.locator('[data-page="downloads"]').first().click().catch(()=>{});
  await page.waitForTimeout(400);
  await shot(page, 'desktop-downloads-light');

  // dark mode toggle
  await page.evaluate(() => document.body.classList.add('dark'));
  await page.waitForTimeout(300);
  await shot(page, 'desktop-chat-dark');
  await ctx.close();
}

// Mobile
{
  const ctx = await browser.newContext({ ...devices['Pixel 7'] });
  const page = await ctx.newPage();
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  await shot(page, 'mobile-home');
  await page.locator('#openSideBtn').first().click();
  await page.waitForTimeout(400);
  await shot(page, 'mobile-drawer');
  await ctx.close();
}

await browser.close();
console.log('DONE');
