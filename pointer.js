'use strict';
(() => {
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let layer, lastTime = 0, lastX = -100, lastY = -100;
  function clear() { layer?.replaceChildren(); }
  function wave(event, press = false) {
    if (!fine.matches || reduced.matches || document.hidden || event.pointerType !== 'mouse') return;
    const now = performance.now();
    if (!press && (now - lastTime < 65 || Math.hypot(event.clientX - lastX, event.clientY - lastY) < 18)) return;
    lastTime = now; lastX = event.clientX; lastY = event.clientY;
    if (!layer) { layer = document.createElement('div'); layer.className = 'cursor-water-layer'; layer.setAttribute('aria-hidden', 'true'); }
    const parent = document.fullscreenElement || document.querySelector('dialog[open]') || document.body;
    if (layer.parentElement !== parent) parent.append(layer);
    while (layer.childElementCount >= 18) layer.firstElementChild.remove();
    const ripple = document.createElement('div');
    ripple.className = `cursor-water-wave${press ? ' is-press' : ''}`;
    ripple.style.left = `${event.clientX}px`; ripple.style.top = `${event.clientY}px`;
    layer.append(ripple);
    setTimeout(() => ripple.remove(), 940);
  }
  document.addEventListener('pointermove', event => wave(event), { passive: true, capture: true });
  document.addEventListener('pointerdown', event => wave(event, true), { passive: true, capture: true });
  document.addEventListener('visibilitychange', clear);
  fine.addEventListener('change', clear);
  reduced.addEventListener('change', clear);
})();
