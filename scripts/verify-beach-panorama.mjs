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
await fs.mkdir(artifacts, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.HOTEL_CHROME_PATH ? { executablePath: process.env.HOTEL_CHROME_PATH } : {}) });
const checks = [], errors = [];
const view = page => page.evaluate(() => ({ yaw: window.beachPanorama.getYaw(), pitch: window.beachPanorama.getPitch(), hfov: window.beachPanorama.getHfov() }));
const difference = (a, b) => Math.abs(((a - b + 540) % 360) - 180);
async function pageFor(options = {}) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce', ...options });
  page.on('pageerror', error => errors.push(error.message));
  return page;
}
async function load(page, url = `${base}/#beach-preview`) {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.querySelector('#beach-panorama').dataset.state === 'ready');
  await page.locator('#beach-preview').scrollIntoViewIfNeeded();
  assert.ok(await page.evaluate(() => window.beachPanorama.isLoaded()));
}
try {
  const page = await pageFor();
  await page.goto(base, { waitUntil: 'networkidle' });
  assert.equal(await page.locator('#beach-panorama').getAttribute('data-state'), 'waiting');
  assert.equal(await page.evaluate(() => window.beachPanorama), undefined);
  checks.push('The beach scene is lazy-loaded independently of the lobby.');
  await page.locator('#beach-preview').scrollIntoViewIfNeeded();
  await page.waitForFunction(() => document.querySelector('#beach-panorama').dataset.state === 'ready');
  assert.match(await page.locator('#beach-panorama').getAttribute('data-source'), /8k\.webp$/);
  const bounds = await page.locator('#beach-panorama').boundingBox();
  const start = await view(page), pageY = await page.evaluate(() => scrollY);
  // Drag through the heading overlay in both dimensions.
  await page.mouse.move(bounds.x + 350, bounds.y + 220);
  await page.mouse.down();
  await page.mouse.move(bounds.x + 780, bounds.y + 140, { steps: 16 });
  await page.mouse.up();
  await page.waitForTimeout(450);
  const dragged = await view(page);
  assert.ok(difference(dragged.yaw, start.yaw) > 10);
  assert.ok(Math.abs(dragged.pitch - start.pitch) > 2);
  await page.mouse.wheel(0, -350);
  await page.waitForTimeout(350);
  assert.ok((await view(page)).hfov < dragged.hfov);
  assert.ok(Math.abs((await page.evaluate(() => scrollY)) - pageY) < 3);
  await page.locator('#beach-reset').click();
  assert.ok(difference((await view(page)).yaw, start.yaw) < .1);
  assert.equal((await view(page)).hfov, 105);
  await page.locator('#beach-zoom-in').click();
  assert.equal((await view(page)).hfov, 93);
  await page.locator('#beach-zoom-out').click();
  assert.equal((await view(page)).hfov, 105);
  checks.push('Dragging through the title rotates horizontally and vertically; wheel zoom leaves page position unchanged; zoom buttons and reset work.');
  await page.locator('#beach-panorama').focus();
  const keyed = await view(page);
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(300);
  await page.keyboard.up('ArrowRight');
  assert.ok(difference((await view(page)).yaw, keyed.yaw) > 1);
  await page.keyboard.press('Home');
  assert.ok(difference((await view(page)).yaw, start.yaw) < .1);
  await page.locator('[data-beach-view="beach"]').click();
  assert.ok(difference((await view(page)).yaw, -10) < .1);
  await page.locator('#beach-text-toggle').click();
  assert.equal(await page.locator('.closing-content').isVisible(), false);
  await page.screenshot({ path: path.join(artifacts, 'beach-panorama-loungers.png') });
  await page.locator('#beach-text-toggle').click();
  await page.locator('[data-beach-view="hammock"]').click();
  await page.screenshot({ path: path.join(artifacts, 'beach-panorama-desktop.png') });
  await page.locator('.closing [data-book]').click();
  assert.equal(await page.locator('#booking-dialog').isVisible(), true);
  await page.locator('#booking-dialog .dialog-close').click();
  checks.push('Keyboard controls, both viewing locations and immersive mode work; the preserved booking button opens the on-page flow.');

  const mobile = await pageFor({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await load(mobile);
  assert.match(await mobile.locator('#beach-panorama').getAttribute('data-source'), /4k\.webp$/);
  const mb = await mobile.locator('#beach-panorama').boundingBox();
  const client = await mobile.context().newCDPSession(mobile);
  const beforeTouch = await view(mobile);
  const tx = 120, ty = mb.y + 200;
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: tx, y: ty, id: 1 }] });
  for (let i = 1; i <= 10; i++) await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: tx + i * 15, y: ty - i * 5, id: 1 }] });
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await mobile.waitForTimeout(350);
  assert.ok(difference((await view(mobile)).yaw, beforeTouch.yaw) > 8);
  assert.ok(Math.abs((await view(mobile)).pitch - beforeTouch.pitch) > 1);
  await mobile.locator('#beach-reset').click();
  const beforePinch = await view(mobile);
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 150, y: ty, id: 1 }, { x: 230, y: ty, id: 2 }] });
  await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 80, y: ty, id: 1 }, { x: 300, y: ty, id: 2 }] });
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await mobile.waitForTimeout(350);
  assert.ok((await view(mobile)).hfov < beforePinch.hfov);
  assert.ok(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await mobile.locator('#beach-reset').click();
  await mobile.screenshot({ path: path.join(artifacts, 'beach-panorama-mobile.png') });
  checks.push('The mobile 4K scene supports one-finger horizontal/vertical looking and two-finger zoom without horizontal page overflow.');

  const fallback = await pageFor();
  await fallback.route(/\/beach-panorama-[48]k\.webp$/, route => route.abort());
  await fallback.goto(`${base}/#beach-preview`, { waitUntil: 'networkidle' });
  await fallback.waitForFunction(() => document.querySelector('#beach-panorama').dataset.state === 'fallback');
  assert.equal(await fallback.locator('.beach-poster').evaluate(img => img.complete && img.naturalWidth > 0), true);
  await fallback.locator('.closing [data-book]').click();
  assert.equal(await fallback.locator('#booking-dialog').isVisible(), true);
  checks.push('After both panorama sizes fail, the matching real-photo fallback and booking flow remain available.');

  const subpath = await pageFor();
  await load(subpath, `${base}/ctrip-hotel-subscription/#beach-preview`);
  const bad = [];
  subpath.on('response', response => { if (response.status() >= 400) bad.push(response.url()); });
  for (const file of ['beach-panorama.js', 'beach-panorama.css', 'assets/photos/beach-panorama-4k.webp']) {
    assert.equal((await subpath.request.get(`${base}/ctrip-hotel-subscription/${file}`)).status(), 200);
  }
  assert.deepEqual(bad, []);
  assert.deepEqual(errors, []);
  checks.push('The scene works with GitHub Pages project-relative paths and produces no page errors.');
  await fs.writeFile(path.join(artifacts, 'beach-panorama-verification.json'), JSON.stringify({ status: 'passed', checks, errors }, null, 2));
  console.log(JSON.stringify({ status: 'passed', checks, errors }, null, 2));
} finally { await browser.close(); }
