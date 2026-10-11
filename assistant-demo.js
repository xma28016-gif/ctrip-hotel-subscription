/* One local walkthrough; real input immediately takes over the phone. */
(() => {
  const stage = document.querySelector('.phone-stage');
  const phone = document.querySelector('#assistant-preview');
  const screen = phone.querySelector('.phone-content');
  const touch = phone.querySelector('.phone-demo-touch');
  const notice = phone.querySelector('.phone-demo-notice');
  const status = document.querySelector('#assistant-demo-status');
  const toggle = document.querySelector('#assistant-demo-toggle');
  const replay = document.querySelector('#assistant-demo-replay');
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let wantsPlay = !motion.matches;
  let inView = false;
  let running = false;
  let runId = 0;
  let timer = null;
  let resolveWait = null;
  let autoSaved = false;
  let savedBefore = false;

  const setStatus = text => { status.textContent = text; };
  function updateControls(state) {
    stage.dataset.demoState = state;
    toggle.setAttribute('aria-label', wantsPlay ? '暂停使用演示' : '播放使用演示');
    toggle.innerHTML = `<span aria-hidden="true">${wantsPlay ? 'Ⅱ' : '▷'}</span><span>${wantsPlay ? '暂停' : '播放'}</span>`;
  }
  function clearEffects() {
    touch.classList.remove('is-visible', 'is-tapping');
    notice.classList.remove('is-visible');
    phone.querySelectorAll('.is-demonstrating,.demo-detail-enter,.demo-highlight').forEach(element => {
      element.classList.remove('is-demonstrating', 'demo-detail-enter', 'demo-highlight');
    });
  }
  function stop(state = 'paused') {
    runId++;
    running = false;
    clearTimeout(timer);
    timer = null;
    if (resolveWait) { resolveWait(false); resolveWait = null; }
    // Stop an in-progress internal scroll without moving the webpage.
    screen.scrollTo({ top: screen.scrollTop, behavior: 'instant' });
    clearEffects();
    updateControls(state);
  }
  function wait(ms, id) {
    return new Promise(resolve => {
      resolveWait = resolve;
      timer = setTimeout(() => { timer = null; resolveWait = null; resolve(id === runId && running); }, ms);
    });
  }
  function pointAt(element) {
    const bounds = element.getBoundingClientRect();
    const frame = phone.getBoundingClientRect();
    const scale = frame.width / phone.offsetWidth;
    const x = (bounds.left + bounds.width * .72 - frame.left) / scale - phone.clientLeft - 14;
    const y = (bounds.top + bounds.height / 2 - frame.top) / scale - phone.clientTop - 7;
    touch.style.setProperty('--touch-x', `${x}px`);
    touch.style.setProperty('--touch-y', `${y}px`);
    touch.classList.add('is-visible');
  }
  function tap() { touch.classList.add('is-tapping'); }
  function revealInside(element, margin = 16) {
    const target = element.getBoundingClientRect();
    const viewport = screen.getBoundingClientRect();
    const scale = viewport.width / screen.clientWidth;
    const bottom = (target.bottom - viewport.bottom) / scale + margin;
    if (bottom > 0) screen.scrollTo({ top: screen.scrollTop + bottom, behavior: motion.matches ? 'instant' : 'smooth' });
  }
  function restoreAutoReminder() {
    if (autoSaved && !savedBefore) savedReminders.delete('arrival');
    autoSaved = false;
  }
  async function walkThrough(id) {
    while (id === runId && running) {
      restoreAutoReminder();
      savedBefore = savedReminders.has('arrival');
      activeFeature = 'arrival';
      renderPhone(); renderTimeline();
      screen.scrollTo({ top: 0, behavior: 'instant' });
      clearEffects();
      setStatus('01 / 点开到店指引');
      if (!await wait(1100, id)) return;
      pointAt(phone.querySelector('[data-phone-feature="arrival"]'));
      if (!await wait(750, id)) return;
      tap();
      if (!await wait(550, id)) return;
      touch.classList.remove('is-visible', 'is-tapping');
      phone.querySelector('.phone-detail-card').classList.add('demo-detail-enter');
      phone.querySelector('.route-map').classList.add('is-demonstrating');
      setStatus('02 / 查看路线与交通方式');
      if (!await wait(3600, id)) return;
      setStatus('03 / 一键加入行程');
      revealInside(phone.querySelector('[data-save="arrival"]'));
      if (!await wait(800, id)) return;
      pointAt(phone.querySelector('[data-save="arrival"]'));
      if (!await wait(750, id)) return;
      tap();
      if (!await wait(500, id)) return;
      savedReminders.add('arrival');
      autoSaved = !savedBefore;
      renderPhone(); renderTimeline();
      touch.classList.remove('is-visible', 'is-tapping');
      const event = [...phone.querySelectorAll('.saved-event')].find(row => row.textContent.includes('机场到店'));
      event?.classList.add('demo-highlight');
      revealInside(phone.querySelector('.phone-timeline'), 48);
      notice.classList.add('is-visible');
      setStatus('提醒已加入 · 到店更从容');
      if (!await wait(3000, id)) return;
      notice.classList.remove('is-visible');
      if (!await wait(4500, id)) return;
    }
  }
  function play() {
    if (!wantsPlay || !inView || document.hidden || document.querySelector('dialog[open]') || running) return;
    running = true;
    updateControls('playing');
    const id = ++runId;
    void walkThrough(id);
  }
  function takeOver(event) {
    if (!event.target.closest('#assistant-preview,.feature-tabs')) return;
    wantsPlay = false;
    // The displayed example is now theirs to edit, including any saved reminder.
    autoSaved = false;
    stop('manual');
    setStatus('亲自试试 · 点击提醒卡片');
  }
  const section = document.querySelector('#assistant');
  section.addEventListener('pointerdown', takeOver, { capture: true, passive: true });
  section.addEventListener('wheel', takeOver, { capture: true, passive: true });
  section.addEventListener('keydown', takeOver, true);
  section.addEventListener('focusin', takeOver, true);
  // Includes keyboard / assistive-technology activation with no pointer event.
  section.addEventListener('click', takeOver, true);
  toggle.addEventListener('click', () => {
    wantsPlay = !wantsPlay;
    if (wantsPlay) { setStatus('使用演示 · 等待播放'); play(); }
    else { stop(); setStatus('演示已暂停 · 可亲自体验'); }
  });
  replay.addEventListener('click', () => {
    stop(); wantsPlay = true; setStatus('使用演示 · 从头开始'); play();
  });
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting && entry.intersectionRatio >= .25;
      if (inView) play();
      else { stop(); if (wantsPlay) setStatus('使用演示 · 回到屏幕继续'); }
    }, { threshold: .25 });
    observer.observe(phone);
  } else { inView = true; play(); }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop(); else play();
  });
  window.addEventListener('blur', () => stop());
  window.addEventListener('focus', play);
  window.addEventListener('resize', () => { stop(); play(); });
  document.querySelectorAll('dialog').forEach(dialog => {
    new MutationObserver(() => { if (dialog.open) stop(); else play(); }).observe(dialog, { attributes: true, attributeFilter: ['open'] });
  });
  motion.addEventListener('change', () => {
    if (motion.matches) { wantsPlay = false; stop(); setStatus('点击播放 · 查看使用步骤'); }
  });
  updateControls('ready');
  if (motion.matches) setStatus('点击播放 · 查看使用步骤');
})();
