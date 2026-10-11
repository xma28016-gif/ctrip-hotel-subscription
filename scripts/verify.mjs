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
const results = [];
const failures = [];
const page = await browser.newPage({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
page.on('pageerror', error => failures.push(error.message));
page.on('response', response => { if (response.status() >= 400) failures.push(`HTTP ${response.status()}: ${response.url()}`); });
page.on('requestfailed', request => failures.push(`Request failed: ${request.url()}`));
try {
  await page.goto(base, { waitUntil: 'networkidle' });
  assert.equal(await page.locator('h1').innerText(), '把假期，\n交给海风。');
  await page.evaluate(() => document.querySelectorAll('img').forEach(image => { image.loading = 'eager'; }));
  await page.waitForFunction(() => [...document.images].every(image => image.complete && image.naturalWidth > 0));
  results.push('All real photography loads locally.');
  assert.equal(await page.locator('a[href^="http"]').count(), 0);
  results.push('No external page navigation.');
  const actionColors = await page.locator('.phone-action').evaluate(button => ({ background: getComputedStyle(button).backgroundColor, foreground: getComputedStyle(button).color }));
  assert.equal(actionColors.background, 'rgb(98, 122, 81)');
  assert.equal(actionColors.foreground, 'rgb(255, 255, 255)');
  results.push('Assistant action buttons retain readable colors inside their cards.');

  // Test the real room selector, a full booking, and nights across France's DST change.
  await page.locator('[data-book="sea"]').first().click();
  assert.equal(await page.locator('#booking-room').inputValue(), 'sea');
  await page.locator('#check-in').fill('2027-03-27');
  await page.locator('#check-out').fill('2027-03-30');
  await page.locator('#adults').selectOption('2');
  await page.locator('#children').selectOption('1');
  await page.locator('.booking-next').click();
  assert.match(await page.locator('#booking-summary').innerText(), /3 晚/);
  assert.match(await page.locator('#booking-summary').innerText(), /9,840/);
  await page.screenshot({ path: path.join(artifacts, 'booking-desktop.png') });
  await page.locator('#booking-complete').click();
  assert.match(await page.locator('.completion-description').innerText(), /没有创建订单/);
  results.push('Booking: 3 calendar nights across DST = ¥9,840; completion is explicitly a demo.');
  await page.locator('#booking-restart').click();
  await page.locator('#check-out').fill('2027-03-27');
  await page.locator('.booking-next').click();
  assert.match(await page.locator('#booking-error').innerText(), /离店日期须晚于/);
  await page.locator('#check-in').fill('2020-01-01');
  await page.locator('#check-out').fill('2020-01-03');
  await page.locator('.booking-next').click();
  assert.match(await page.locator('#booking-error').innerText(), /不能早于今天/);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#booking-dialog').evaluate(dialog => dialog.open), false);
  results.push('Invalid and past dates are rejected; Escape closes the dialog.');

  for (const [id, nightly] of [['wood', 2280], ['family', 3880]]) {
    await page.locator(`[data-book="${id}"]`).first().click();
    await page.locator('#check-in').fill('2027-06-18');
    await page.locator('#check-out').fill('2027-06-20');
    await page.locator('.booking-next').click();
    assert.match(await page.locator('#booking-summary').innerText(), new RegExp((nightly * 2).toLocaleString('en-US')));
    await page.keyboard.press('Escape');
  }
  results.push('Both other room types use their agreed nightly prices.');

  const firstSeaImage = await page.locator('[data-room="sea"] .room-photo img').getAttribute('src');
  await page.locator('[data-photo-next="sea"]').click();
  assert.notEqual(await page.locator('[data-room="sea"] .room-photo img').getAttribute('src'), firstSeaImage);
  await page.locator('[data-gallery="sea"]').click();
  assert.equal(await page.locator('#dialog-photo-count').innerText(), '2 / 3');
  await page.locator('[data-dialog-next]').click();
  assert.equal(await page.locator('#dialog-photo-count').innerText(), '3 / 3');
  await page.keyboard.press('Escape');
  await page.locator('[data-service="wellness"]').first().click();
  await page.locator('[data-wellness="fitness"]').click();
  assert.match(await page.locator('.dialog-gallery-image').getAttribute('src'), /fitness/);
  await page.keyboard.press('Escape');
  results.push('Room galleries and SPA/fitness switching work.');

  await page.locator('#tab-route').click();
  await page.locator('#phone-destination').selectOption('beach');
  assert.match(await page.locator('#phone-detail').innerText(), /约 8 公里/);
  await page.locator('[data-save="route"]').click();
  assert.match(await page.locator('#timeline-events').innerText(), /前往庞普洛讷海滩/);
  await page.locator('[data-save="route"]').click();
  assert.doesNotMatch(await page.locator('#timeline-events').innerText(), /前往庞普洛讷海滩/);
  await page.locator('#tab-departure').click();
  assert.match(await page.locator('#phone-detail').innerText(), /3 小时 49 分钟/);
  await page.locator('[data-save="departure"]').click();
  assert.match(await page.locator('#timeline-events').innerText(), /出发前 30 分钟/);
  await page.locator('#tab-dynamic').click();
  await page.locator('[data-simulate]').click();
  assert.match(await page.locator('.flight-status').innerText(), /延误 50 分钟/);
  assert.match(await page.locator('#timeline-events').innerText(), /19:20/);
  await page.locator('[data-simulate]').click();
  assert.doesNotMatch(await page.locator('#timeline-events').innerText(), /航班延误/);
  await page.locator('#tab-arrival').focus();
  await page.keyboard.press('ArrowDown');
  assert.equal(await page.locator('#tab-route').getAttribute('aria-selected'), 'true');
  results.push('All assistant cards work, including routes, reminders, delay reset, and keyboard selection.');

  await page.reload({ waitUntil: 'networkidle' });
  await page.evaluate(() => document.querySelectorAll('img').forEach(image => { image.loading = 'eager'; }));
  await page.waitForFunction(() => [...document.images].every(image => image.complete && image.naturalWidth > 0));
  await page.evaluate(() => document.querySelectorAll('.reveal').forEach(element => element.classList.add('visible')));
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: path.join(artifacts, 'desktop-full.png'), fullPage: true });
  await page.screenshot({ path: path.join(artifacts, 'desktop-hero.png') });
  await page.locator('#assistant').screenshot({ path: path.join(artifacts, 'assistant-desktop.png') });

  // Verify relative assets under the actual GitHub Pages project URL pattern.
  await page.goto(`${base}/ctrip-hotel-subscription/`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.querySelectorAll('img').forEach(image => { image.loading = 'eager'; }));
  await page.waitForFunction(() => [...document.images].every(image => image.complete && image.naturalWidth > 0));
  assert.equal(await page.locator('#phone-detail .phone-detail-card').count(), 1);
  results.push('The GitHub Pages project subdirectory resolves scripts and all photos.');

  for (const width of [375, 320, 768]) {
    await page.setViewportSize({ width, height: 812 });
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.querySelectorAll('img').forEach(image => { image.loading = 'eager'; }));
    await page.waitForFunction(() => [...document.images].every(image => image.complete && image.naturalWidth > 0));
    const dimensions = await page.evaluate(() => ({ body: document.documentElement.scrollWidth, viewport: window.innerWidth }));
    assert.ok(dimensions.body <= dimensions.viewport, `Horizontal overflow at ${width}px: ${JSON.stringify(dimensions)}`);
    const foodImage = await page.locator('.food-strip img').first().boundingBox();
    assert.ok(foodImage.height < foodImage.width * 1.05, `Food photo crop is too tall at ${width}px.`);
    await page.locator('.menu-toggle').click();
    assert.equal(await page.locator('.menu-toggle').getAttribute('aria-expanded'), 'true');
    await page.locator('#mobile-nav a[href="#rooms"]').click();
    assert.equal(await page.locator('#mobile-nav').isVisible(), false);
    await page.locator('[data-book="family"]').first().click();
    const dialogSize = await page.locator('#booking-dialog').boundingBox();
    assert.ok(dialogSize.width <= width - 16);
    await page.locator('#check-in').fill('2027-06-18');
    await page.locator('#check-out').fill('2027-06-19');
    await page.locator('.booking-next').click();
    assert.match(await page.locator('#booking-summary').innerText(), /3,880/);
    await page.keyboard.press('Escape');
    if (width === 375) {
      await page.evaluate(() => { document.querySelectorAll('.reveal').forEach(element => element.classList.add('visible')); window.scrollTo(0, 0); });
      await page.screenshot({ path: path.join(artifacts, 'mobile-full.png'), fullPage: true });
      await page.screenshot({ path: path.join(artifacts, 'mobile-hero.png') });
    }
    results.push(`${width}px layout: no horizontal overflow; navigation and booking work.`);
  }
  assert.deepEqual(failures, []);
  const report = { passed: true, checks: results, browserErrors: failures };
  await fs.writeFile(path.join(artifacts, 'verification.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally { await browser.close(); }
