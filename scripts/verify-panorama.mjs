import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.HOTEL_PLAYWRIGHT_PATH || 'playwright');
const root = fileURLToPath(new URL('../', import.meta.url));
const artifacts = path.join(root, 'artifacts');
await fs.mkdir(artifacts, { recursive: true });
const base = process.env.HOTEL_TEST_URL || 'http://127.0.0.1:4173';
const browser = await chromium.launch({ headless: true, ...(process.env.HOTEL_CHROME_PATH ? { executablePath: process.env.HOTEL_CHROME_PATH } : {}) });
const checks = [];
const errors = [];
const contexts = [];
const difference = (a, b) => Math.abs(((a - b + 540) % 360) - 180);

async function createPage(options = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, ...options });
  contexts.push(context);
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  return page;
}
async function load(page, url = base) {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.querySelector('#lobby-panorama').dataset.state === 'ready');
  assert.ok(await page.evaluate(() => window.lobbyPanorama.isLoaded()));
}
async function view(page) {
  return page.evaluate(() => ({ yaw: window.lobbyPanorama.getYaw(), pitch: window.lobbyPanorama.getPitch(), hfov: window.lobbyPanorama.getHfov() }));
}
async function reset(page) {
  await page.locator('#lobby-panorama').focus();
  await page.keyboard.press('Home');
  await page.waitForFunction(() => Math.abs(window.lobbyPanorama.getYaw() - 90) < .1 && Math.abs(window.lobbyPanorama.getPitch() - 8) < .1);
}

try {
  const page = await createPage();
  await load(page);
  assert.equal(await page.locator('#lobby-panorama').getAttribute('data-touring'), 'true');
  const initialYaw = (await view(page)).yaw;
  await page.waitForFunction(yaw => Math.abs(window.lobbyPanorama.getYaw() - yaw) > .4, initialYaw);
  checks.push('The genuine 360° texture loads and the initial scene slowly rotates.');

  await page.mouse.move(720, 480);
  assert.equal(await page.locator('#lobby-panorama').getAttribute('data-touring'), 'false');
  const central = await view(page);
  await page.waitForTimeout(300);
  assert.ok(difference((await view(page)).yaw, central.yaw) < .1);
  await page.mouse.move(1395, 430);
  await page.waitForFunction(yaw => window.lobbyPanorama.getYaw() - yaw > 3, central.yaw);
  await page.mouse.move(720, 480);
  await page.waitForFunction(() => document.querySelector('#lobby-panorama').dataset.looking === 'false');
  const stopped = await view(page);
  await page.waitForTimeout(250);
  assert.ok(difference((await view(page)).yaw, stopped.yaw) < .05);
  await page.mouse.move(35, 430);
  await page.waitForFunction(yaw => yaw - window.lobbyPanorama.getYaw() > 2, stopped.yaw);
  await page.mouse.move(720, 115);
  const beforeUp = (await view(page)).pitch;
  await page.waitForFunction(pitch => window.lobbyPanorama.getPitch() - pitch > 1, beforeUp);
  await page.mouse.move(720, 935);
  const beforeDown = (await view(page)).pitch;
  await page.waitForFunction(pitch => pitch - window.lobbyPanorama.getPitch() > 1, beforeDown);
  await page.locator('#site-header .brand').hover();
  const beforeButtonHover = await view(page);
  await page.waitForTimeout(250);
  assert.ok(difference((await view(page)).yaw, beforeButtonHover.yaw) < .05);
  assert.equal(await page.locator('#lobby-panorama').getAttribute('data-looking'), 'false');
  assert.match(await page.locator('.hero-buttons a').first().evaluate(el => getComputedStyle(el).cursor), /white-pointer\.png/);
  const cursor = await page.request.get(`${base}/assets/white-pointer.png`);
  assert.equal(cursor.status(), 200);
  assert.match(cursor.headers()['content-type'], /image\/png/);
  checks.push('Moving the pointer toward left, right and upper edges turns the view without holding a button; the central area and navigation remain still.');

  await reset(page);
  const stairHotspot = await page.locator('.panorama-landmark [data-panorama-landmark="stairs"]').boundingBox();
  await page.mouse.click(stairHotspot.x + stairHotspot.width / 2, stairHotspot.y + stairHotspot.height / 2);
  await page.waitForFunction(() => Math.abs(window.lobbyPanorama.getYaw() - 104) < .1 && Math.abs(window.lobbyPanorama.getPitch() - 18) < .1);
  assert.equal(await page.evaluate(() => scrollY), 0);
  const detailPosition = await page.locator('#panorama-detail').boundingBox();
  assert.ok(detailPosition.y >= 100 && detailPosition.y + detailPosition.height <= 960);
  assert.equal(await page.locator('#panorama-detail-title').innerText(), '雕花楼梯');
  assert.equal(await page.locator('.panorama-guide [data-panorama-landmark="stairs"]').getAttribute('aria-expanded'), 'true');
  await page.screenshot({ path: path.join(artifacts, 'panorama-detail.png') });
  for (const [id, yaw, pitch, title] of [['arches', 0, 12, '古典拱廊'], ['ceiling', 90, 57, '雕饰顶面'], ['lounge', -92, -4, '大堂休息区']]) {
    await page.locator(`.panorama-guide [data-panorama-landmark="${id}"]`).click();
    await page.waitForFunction(({ yaw, pitch }) => Math.abs(window.lobbyPanorama.getYaw() - yaw) < .1 && Math.abs(window.lobbyPanorama.getPitch() - pitch) < .1, { yaw, pitch });
    assert.equal(await page.locator('#panorama-detail-title').innerText(), title);
    assert.equal(await page.evaluate(() => scrollY), 0);
  }
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#panorama-detail').isVisible(), false);
  assert.equal(await page.locator('.panorama-guide [aria-expanded="true"]').count(), 0);
  await page.keyboard.press('Enter');
  assert.equal(await page.locator('#panorama-detail-title').innerText(), '大堂休息区');
  await page.locator('#panorama-detail-close').click();
  checks.push('Scene-anchored hotspots and keyboard-accessible guide buttons pan to four real architectural details and show an on-page description; close and Escape restore focus.');
  await reset(page);

  // Drag through the title overlay, not just an uncovered part of the canvas.
  const beforeDrag = await view(page);
  await page.mouse.move(300, 380);
  await page.mouse.down();
  await page.mouse.move(750, 270, { steps: 14 });
  await page.mouse.up();
  assert.equal(await page.locator('#lobby-panorama').getAttribute('data-touring'), 'false');
  const afterDrag = await view(page);
  assert.ok(difference(afterDrag.yaw, beforeDrag.yaw) > 10);
  assert.ok(Math.abs(afterDrag.pitch - beforeDrag.pitch) > 2);
  assert.equal(await page.locator('#panorama-tour-toggle').getAttribute('aria-pressed'), 'false');
  assert.equal(await page.evaluate(() => window.lobbyPanorama.getConfig().autoRotateInactivityDelay), -1);
  checks.push('Dragging across the title rotates horizontally and vertically; automatic rotation stops permanently until explicitly restarted.');

  await reset(page);
  await page.mouse.move(1100, 420);
  await page.mouse.wheel(0, -240);
  await page.waitForFunction(() => window.lobbyPanorama.getHfov() < 100);
  const zoomedIn = (await view(page)).hfov;
  await page.mouse.wheel(0, 300);
  await page.waitForFunction(fov => window.lobbyPanorama.getHfov() > fov + 3, zoomedIn);
  assert.equal(await page.evaluate(() => window.scrollY), 0);
  await page.locator('#lobby-panorama').focus();
  const firstButtonZoom = (await view(page)).hfov;
  await page.keyboard.down('+');
  await page.waitForFunction(fov => window.lobbyPanorama.getHfov() < fov - 3, firstButtonZoom);
  await page.keyboard.up('+');
  checks.push('Mouse wheel and keyboard zoom change the field of view without scrolling the page.');

  await page.evaluate(() => { window.lobbyPanorama.setHfov(1, false); });
  assert.ok((await view(page)).hfov >= 38);
  await page.evaluate(() => { window.lobbyPanorama.setHfov(200, false); });
  assert.ok((await view(page)).hfov <= 120);
  await reset(page);
  await page.locator('#lobby-panorama').focus();
  const beforeKey = await view(page);
  await page.keyboard.down('ArrowRight');
  await page.waitForFunction(yaw => Math.abs(window.lobbyPanorama.getYaw() - yaw) > 2, beforeKey.yaw);
  await page.keyboard.up('ArrowRight');
  await page.keyboard.press('Home');
  await page.waitForFunction(() => Math.abs(window.lobbyPanorama.getYaw() - 90) < .1);
  checks.push('Zoom bounds, keyboard navigation and reset work.');

  // Cross the texture seam repeatedly and confirm the entire panorama stays rendered.
  await page.evaluate(() => { window.lobbyPanorama.stopMovement(); window.lobbyPanorama.setYaw(175, false); });
  await page.mouse.move(1040, 420);
  await page.mouse.down();
  await page.mouse.move(500, 420, { steps: 18 });
  await page.mouse.up();
  assert.ok(difference((await view(page)).yaw, 175) > 20);
  assert.ok(await page.locator('#lobby-panorama canvas').isVisible());
  await reset(page);
  assert.equal(await page.locator('#lobby-panorama').getAttribute('data-touring'), 'false');
  assert.equal(await page.locator('.panorama-bottomline').isVisible(), false);
  assert.equal(await page.locator('.hero-bottom .photo-credit').count(), 0);
  checks.push('The yaw wraps across 360° while the removed hints, toolbar and hero credit remain absent.');

  await load(page);
  await page.evaluate(() => window.scrollTo(0, document.querySelector('#rooms').offsetTop));
  await page.waitForFunction(() => document.querySelector('#lobby-panorama').dataset.touring === 'false');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForFunction(() => document.querySelector('#lobby-panorama').dataset.touring === 'true');
  await page.locator('.hero-buttons a[href="#rooms"]').click();
  assert.equal(await page.locator('#lobby-panorama').getAttribute('data-touring'), 'false');
  assert.ok(await page.locator('#rooms').isVisible());
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForFunction(() => window.scrollY === 0);
  assert.equal(await page.locator('#lobby-panorama').getAttribute('data-touring'), 'false');
  await page.locator('.header-book').click();
  assert.ok(await page.locator('#booking-dialog').evaluate(dialog => dialog.open));
  await page.keyboard.press('Escape');
  checks.push('Offscreen rendering pauses; navigation and booking remain clickable and a user action does not restart the tour.');

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await load(page);
  assert.equal(await page.locator('#lobby-panorama').getAttribute('data-touring'), 'false');
  const quietView = await view(page);
  await page.mouse.move(1395, 430);
  await page.waitForTimeout(300);
  assert.ok(difference((await view(page)).yaw, quietView.yaw) < .1);
  await page.locator('.panorama-guide [data-panorama-landmark="arches"]').click();
  assert.ok(Math.abs((await view(page)).yaw) < .1);
  await reset(page);
  await page.evaluate(() => document.activeElement.blur());
  await page.screenshot({ path: path.join(artifacts, 'panorama-desktop.png') });
  for (const [name, yaw, pitch] of [['left', 0, 8], ['ceiling', 90, 65], ['floor', 90, -65], ['back', -90, 0]]) {
    await page.evaluate(({ yaw, pitch }) => window.lobbyPanorama.lookAt(pitch, yaw, 105, false), { yaw, pitch });
    await page.screenshot({ path: path.join(artifacts, `panorama-${name}.png`) });
  }
  checks.push('Reduced-motion preference prevents autoplay; left, ceiling, floor and rear views all render.');
  await load(page, `${base}/ctrip-hotel-subscription/`);
  assert.equal(await page.locator('a[href^="http"]').count(), 0);
  checks.push('All panorama assets and the local viewer work under the GitHub Pages project path, without external navigation.');

  const mobile = await createPage({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  await load(mobile);
  assert.match(await mobile.evaluate(() => window.lobbyPanorama.getConfig().panorama), /4k/);
  const cdp = await mobile.context().newCDPSession(mobile);
  const start = await view(mobile);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 280, y: 330 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 130, y: 270 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  assert.ok(difference((await view(mobile)).yaw, start.yaw) > 10);
  assert.equal(await mobile.locator('#lobby-panorama').getAttribute('data-touring'), 'false');
  await reset(mobile);
  const beforePinch = (await view(mobile)).hfov;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 140, y: 340 }, { x: 240, y: 340 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 105, y: 340 }, { x: 275, y: 340 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  assert.ok((await view(mobile)).hfov < beforePinch - 3);
  assert.equal(await mobile.evaluate(() => window.scrollY), 0);
  await reset(mobile);
  await mobile.locator('.panorama-guide [data-panorama-landmark="ceiling"]').tap();
  await mobile.waitForFunction(() => Math.abs(window.lobbyPanorama.getPitch() - 57) < .1);
  await mobile.screenshot({ path: path.join(artifacts, 'panorama-mobile-detail.png') });
  await mobile.locator('#panorama-detail-close').tap();
  await reset(mobile);
  await mobile.screenshot({ path: path.join(artifacts, 'panorama-mobile.png') });
  for (const width of [320, 768]) {
    await mobile.setViewportSize({ width, height: 812 });
    assert.ok(await mobile.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    const controls = await mobile.locator('.panorama-tools').boundingBox();
    assert.ok(controls.x >= 0 && controls.x + controls.width <= width);
  }
  checks.push('Mobile touch drag and two-finger zoom work; controls stay within 320px, 375px and 768px screens.');

  const sensor = await createPage({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  await sensor.addInitScript(() => {
    window.sensorPermissionCalls = 0;
    window.sensorPermission = 'denied';
    Object.defineProperty(DeviceOrientationEvent, 'requestPermission', { configurable: true, value: async () => {
      window.sensorPermissionCalls++;
      return window.sensorPermission;
    } });
  });
  await load(sensor);
  assert.equal(await sensor.evaluate(() => window.sensorPermissionCalls), 0);
  assert.equal(await sensor.locator('#panorama-orientation').isVisible(), false);
  checks.push('The hidden control strip does not request device sensor permissions.');

  const fallback = await createPage({ reducedMotion: 'reduce' });
  await fallback.addInitScript(() => { const original = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function(type, ...args) { return /webgl/i.test(type) ? null : original.call(this, type, ...args); }; });
  await fallback.goto(base, { waitUntil: 'networkidle' });
  await fallback.waitForFunction(() => document.querySelector('#lobby-panorama').dataset.state === 'fallback');
  assert.ok(await fallback.locator('.hero-image').isVisible());
  assert.equal(await fallback.locator('.panorama-tools').isVisible(), false);
  await fallback.locator('.header-book').click();
  assert.ok(await fallback.locator('#booking-dialog').evaluate(dialog => dialog.open));
  checks.push('Without WebGL, the same photograph supplies the static fallback and booking remains usable.');

  assert.deepEqual(errors, []);
  const report = { passed: true, checks, browserErrors: errors };
  await fs.writeFile(path.join(artifacts, 'panorama-verification.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  for (const context of contexts) await context.close();
  await browser.close();
}
