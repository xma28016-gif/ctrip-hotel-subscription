import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.HOTEL_PLAYWRIGHT_PATH || 'playwright');
const root = fileURLToPath(new URL('../', import.meta.url));
const artifacts = path.join(root, 'artifacts');
const base = process.env.HOTEL_TEST_URL || 'http://127.0.0.1:4173/';
await fs.mkdir(artifacts, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.HOTEL_CHROME_PATH ? { executablePath: process.env.HOTEL_CHROME_PATH } : {}) });
const checks = [], errors = [], media = {};
async function pageFor(options = {}) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'no-preference', ...options });
  page.on('pageerror', error => errors.push(error.message));
  return page;
}
const state = page => page.locator('#wood-room-film').getAttribute('data-state');
const activeTime = page => page.evaluate(() => {
  const film = document.querySelector('#wood-room-film');
  return film.querySelectorAll('video')[Number(film.dataset.activeVideo)].currentTime;
});
async function loaded(page, url = new URL('#wood-room', base).href) {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.locator('#wood-room-film').scrollIntoViewIfNeeded();
  await page.waitForFunction(() => document.querySelector('#wood-room-film').dataset.state === 'playing');
}
try {
  const page = await pageFor();
  const range = await page.request.get(new URL('assets/videos/wood-room-film-hd.mp4', base).href, { headers: { Range: 'bytes=0-63' } });
  assert.equal(range.status(), 206);
  assert.match(range.headers()['content-type'], /video\/mp4/);
  assert.equal((await range.body()).length, 64);
  checks.push('The video server supports MP4 byte ranges and correct media types.');

  await page.goto(base, { waitUntil: 'networkidle' });
  assert.ok(await page.locator('#wood-room-film video').evaluateAll(videos => videos.every(video => !video.getAttribute('src'))));
  await page.locator('#wood-room-film').scrollIntoViewIfNeeded();
  await page.waitForFunction(() => document.querySelector('#wood-room-film').dataset.state === 'playing');
  media.desktop = await page.locator('#wood-room-film video').first().evaluate(v => ({ width: v.videoWidth, height: v.videoHeight, duration: v.duration, rate: v.playbackRate, muted: v.muted, inline: v.playsInline, source: v.currentSrc }));
  assert.ok(media.desktop.width >= 1500);
  assert.ok(Math.abs(media.desktop.width / media.desktop.height - 1504 / 640) < .01);
  assert.ok(media.desktop.muted && media.desktop.inline);
  const start = await activeTime(page);
  await page.waitForTimeout(700);
  assert.ok(await activeTime(page) > start + .3);
  await page.locator('#wood-room').screenshot({ path: path.join(artifacts, 'room-film-desktop.png') });
  checks.push('The film loads near its room, plays muted inline, and preserves the full original frame.');

  await page.locator('#wood-room-film [data-film-toggle]').click();
  const paused = await activeTime(page);
  await page.waitForTimeout(450);
  assert.ok(Math.abs(await activeTime(page) - paused) < .05);
  await page.locator('#home').scrollIntoViewIfNeeded();
  await page.locator('#wood-room-film').scrollIntoViewIfNeeded();
  assert.equal(await state(page), 'paused');
  await page.locator('#wood-room-film [data-film-toggle]').click();
  await page.waitForFunction(() => document.querySelector('#wood-room-film').dataset.state === 'playing');
  await page.locator('[data-book="wood"]').first().click();
  await page.waitForFunction(() => document.querySelector('#wood-room-film').dataset.state === 'paused');
  assert.equal(await page.locator('#booking-room').inputValue(), 'wood');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.querySelector('#wood-room-film').dataset.state === 'playing');
  await page.locator('[data-gallery="wood"]').click();
  await page.waitForFunction(() => document.querySelector('#wood-room-film').dataset.state === 'paused');
  assert.equal(await page.locator('#dialog-photo-count').innerText(), '1 / 3');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.querySelector('#wood-room-film').dataset.state === 'playing');
  checks.push('Pause is persistent after scrolling; booking and the real-photo gallery pause playback and restore it when closed.');

  let sawBlend = false, sawLoop = false;
  const initialActive = await page.locator('#wood-room-film').getAttribute('data-active-video');
  for (let i = 0; i < 95; i++) {
    const snapshot = await page.locator('#wood-room-film').evaluate(film => ({ active: film.dataset.activeVideo, state: film.dataset.state, opacity: [...film.querySelectorAll('video')].map(v => Number(v.style.opacity || 0)) }));
    assert.equal(snapshot.state, 'playing');
    assert.ok(snapshot.opacity.reduce((a, b) => a + b, 0) >= .99, 'The rendered film must never fade to black.');
    sawBlend ||= snapshot.opacity.some(value => value > .05 && value < .95);
    sawLoop ||= snapshot.active !== initialActive;
    await page.waitForTimeout(100);
  }
  assert.ok(sawBlend && sawLoop, 'The film should smoothly blend into another complete playback.');
  checks.push('Playback continues beyond the clip duration with a visible dissolve and no black gap.');
  await page.locator('#wood-room-film [data-film-fullscreen]').click();
  await page.waitForFunction(() => document.fullscreenElement?.id === 'wood-room-film');
  await page.locator('#wood-room-film [data-film-fullscreen]').click();
  await page.waitForFunction(() => !document.fullscreenElement);
  checks.push('Fullscreen opens and exits without leaving the page.');

  await page.goto(new URL('#sea-room', base).href, { waitUntil: 'networkidle' });
  await page.locator('#sea-room-film').scrollIntoViewIfNeeded();
  await page.waitForFunction(() => document.querySelector('#sea-room-film').dataset.state === 'playing');
  media.sea = await page.locator('#sea-room-film video').first().evaluate(v => ({ width: v.videoWidth, height: v.videoHeight, duration: v.duration, muted: v.muted }));
  assert.equal(media.sea.width, 1120);
  assert.equal(media.sea.height, 832);
  assert.ok(media.sea.muted);
  assert.equal(await page.locator('#sea-room .room-film-photos img').count(), 3);
  await page.locator('#sea-room [data-gallery-index="2"]').click();
  assert.equal(await page.locator('#dialog-photo-count').innerText(), '3 / 3');
  assert.match(await page.locator('.dialog-gallery-image').getAttribute('src'), /sea-terrace/);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.querySelector('#sea-room-film').dataset.state === 'playing');
  await page.locator('#sea-room').screenshot({ path: path.join(artifacts, 'sea-film-desktop.png') });
  checks.push('The sea suite video plays independently and all three original photographs remain accessible at their correct gallery positions.');

  const mobile = await pageFor({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await loaded(mobile);
  media.mobile = await mobile.locator('#wood-room-film video').first().evaluate(v => ({ width: v.videoWidth, height: v.videoHeight, source: v.currentSrc }));
  assert.match(media.mobile.source, /mobile\.mp4$/);
  assert.ok(Math.abs(media.mobile.width / media.mobile.height - 1504 / 640) < .01);
  assert.ok(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await mobile.locator('#wood-room').screenshot({ path: path.join(artifacts, 'room-film-mobile.png') });
  await mobile.setViewportSize({ width: 320, height: 812 });
  assert.ok(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await mobile.close();
  checks.push('Mobile uses the smaller movie, keeps the full room view and fits 390px and 320px screens.');

  const reduced = await pageFor({ reducedMotion: 'reduce' });
  await reduced.goto(new URL('#wood-room', base).href, { waitUntil: 'networkidle' });
  await reduced.locator('#wood-room-film').scrollIntoViewIfNeeded();
  assert.equal(await state(reduced), 'paused');
  assert.ok(await reduced.locator('#wood-room-film video').evaluateAll(videos => videos.every(v => v.paused)));
  await reduced.locator('#wood-room-film [data-film-toggle]').click();
  await reduced.waitForFunction(() => document.querySelector('#wood-room-film').dataset.state === 'playing');
  await reduced.close();
  checks.push('Reduced-motion preference keeps the poster still until the viewer explicitly plays the film.');

  const fallback = await pageFor();
  await fallback.route('**/assets/videos/*.mp4', route => route.abort());
  await fallback.goto(new URL('#wood-room', base).href, { waitUntil: 'networkidle' });
  await fallback.waitForFunction(() => document.querySelector('#wood-room-film').dataset.state === 'error');
  assert.ok(await fallback.locator('#wood-room-film .room-film-poster').evaluate(img => img.complete && img.naturalWidth > 0));
  await fallback.locator('[data-book="wood"]').first().click();
  assert.ok(await fallback.locator('#booking-dialog').isVisible());
  await fallback.close();
  checks.push('Unavailable video falls back to its poster while booking remains usable.');

  await loaded(page, new URL('/ctrip-hotel-subscription/#wood-room', base).href);
  assert.match(await page.locator('#wood-room-film video').first().getAttribute('src'), /^\.\/assets\/videos\//);
  assert.deepEqual(errors, []);
  const report = { passed: true, checks, media, errors };
  await fs.writeFile(path.join(artifacts, 'room-film-verification.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally { await browser.close(); }
