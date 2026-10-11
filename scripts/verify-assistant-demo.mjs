import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.HOTEL_PLAYWRIGHT_PATH || 'playwright');
const root = fileURLToPath(new URL('../', import.meta.url));
const artifacts = path.join(root, 'artifacts');
const base = process.env.HOTEL_TEST_URL || 'http://127.0.0.1:4173';
const browser = await chromium.launch({ headless: true, ...(process.env.HOTEL_CHROME_PATH ? { executablePath: process.env.HOTEL_CHROME_PATH } : {}) });
const errors = [];
const checks = [];
async function newPage(options) {
  const page = await browser.newPage(options);
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400) errors.push(`HTTP ${response.status()}: ${response.url()}`); });
  return page;
}
try {
  await fs.mkdir(artifacts, { recursive: true });
  const page = await newPage({ viewport: { width: 1440, height: 1080 }, reducedMotion: 'no-preference' });
  await page.goto(base, { waitUntil: 'networkidle' });
  assert.equal(await page.locator('.phone-demo-touch.is-visible').count(), 0);
  assert.equal(await page.locator('[data-save="arrival"]').getAttribute('aria-pressed'), 'false');
  await page.goto(`${base}/#assistant-preview`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.querySelector('#assistant-preview').getBoundingClientRect().top < 150);
  await page.waitForTimeout(1000);
  const pageY = await page.evaluate(() => scrollY);
  await page.waitForSelector('.route-map.is-demonstrating', { timeout: 12000 });
  await page.waitForSelector('.phone-demo-touch.is-tapping', { timeout: 10000 });
  await page.screenshot({ path: path.join(artifacts, 'assistant-demo-tap.png') });
  await page.waitForSelector('.phone-demo-notice.is-visible', { timeout: 12000 });
  await page.waitForFunction(() => document.querySelector('.phone-content').scrollTop > 200);
  assert.equal(await page.evaluate(() => scrollY), pageY);
  assert.match(await page.locator('#timeline-events').innerText(), /机场到店/);
  assert.equal(await page.locator('[data-save="arrival"]').getAttribute('aria-pressed'), 'true');
  await page.screenshot({ path: path.join(artifacts, 'assistant-demo-success.png') });
  checks.push('Visible walkthrough taps, draws a route, saves a reminder and scrolls only inside the phone.');

  await page.locator('#assistant-demo-toggle').click();
  const pausedStatus = await page.locator('#assistant-demo-status').innerText();
  await page.waitForTimeout(1500);
  assert.equal(await page.locator('#assistant-demo-status').innerText(), pausedStatus);
  assert.equal(await page.locator('.phone-demo-touch.is-visible').count(), 0);
  await page.locator('#assistant-demo-replay').click();
  await page.waitForSelector('.route-map.is-demonstrating', { timeout: 10000 });
  await page.locator('.header-book').click();
  assert.equal(await page.locator('#booking-dialog').isVisible(), true);
  assert.equal(await page.locator('.phone-stage').getAttribute('data-demo-state'), 'paused');
  await page.keyboard.press('Escape');
  await page.goto(`${base}/#home`);
  await page.waitForFunction(() => document.querySelector('.phone-stage').dataset.demoState === 'paused');
  assert.equal(await page.locator('.phone-demo-touch.is-visible').count(), 0);
  checks.push('Pause, replay, offscreen suspension and dialog suspension work.');

  const mobile = await newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'no-preference' });
  await mobile.goto(`${base}/ctrip-hotel-subscription/#assistant-preview`, { waitUntil: 'networkidle' });
  await mobile.waitForSelector('.phone-demo-notice.is-visible', { timeout: 16000 });
  await mobile.waitForFunction(() => document.querySelector('.phone-content').scrollTop > 200);
  assert.ok(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await mobile.screenshot({ path: path.join(artifacts, 'assistant-demo-mobile.png') });
  await mobile.locator('[data-phone-feature="route"]').click();
  await mobile.locator('#phone-destination').selectOption('beach');
  await mobile.locator('[data-save="route"]').click();
  await mobile.waitForTimeout(2500);
  assert.equal(await mobile.locator('#tab-route').getAttribute('aria-selected'), 'true');
  assert.match(await mobile.locator('#timeline-events').innerText(), /前往庞普洛讷海滩/);
  assert.equal(await mobile.locator('.phone-demo-touch.is-visible').count(), 0);
  checks.push('Touch-size layout and GitHub Pages paths work; manual selection and reminders stop the walkthrough.');

  const reduced = await newPage({ viewport: { width: 375, height: 812 }, reducedMotion: 'reduce' });
  await reduced.goto(`${base}/#assistant-preview`, { waitUntil: 'networkidle' });
  await reduced.waitForTimeout(1800);
  assert.equal(await reduced.locator('.route-map.is-demonstrating').count(), 0);
  assert.equal(await reduced.locator('[data-save="arrival"]').getAttribute('aria-pressed'), 'false');
  assert.equal(await reduced.locator('#assistant-demo-toggle').getAttribute('aria-label'), '播放使用演示');
  assert.equal(await reduced.locator('.phone-demo-touch').evaluate(element => getComputedStyle(element).display), 'none');
  checks.push('Reduced-motion preference prevents autoplay and hides the animated hand.');

  assert.deepEqual(errors, []);
  const report = { passed: true, checks, browserErrors: errors };
  await fs.writeFile(path.join(artifacts, 'assistant-demo-verification.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally { await browser.close(); }
