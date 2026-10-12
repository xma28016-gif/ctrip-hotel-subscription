'use strict';

(() => {
  function initializeRoomFilm(film) {
  const videos = [...film.querySelectorAll('video')];
  const toggle = film.querySelector('[data-film-toggle]');
  const fullScreen = film.querySelector('[data-film-fullscreen]');
  const status = film.querySelector('[data-film-status]');
  const progress = film.querySelector('.room-film-progress');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const saveData = Boolean(navigator.connection?.saveData);
  const rate = Number(film.dataset.playbackRate) || .85;
  const fadeDuration = 1000;
  let active = 0, fade = null, frame = 0, lastTick = 0, playVersion = 0;
  let inView = false, userPaused = false, manuallyStarted = false, attached = false, usingMobile = false;
  let starting = false, switching = false, disposed = false;

  function setState(state, message) {
    film.dataset.state = state;
    status.textContent = message;
    const playing = state === 'playing';
    toggle.setAttribute('aria-label', playing ? '暂停客房视频' : '播放客房视频');
    toggle.setAttribute('aria-pressed', String(playing));
    toggle.querySelector('[data-film-toggle-label]').textContent = playing ? '暂停' : state === 'error' ? '重试' : '播放';
    toggle.querySelector('[data-film-toggle-icon]').innerHTML = playing ? '<path d="M8 5v14M16 5v14"/>' : '<path d="m8 4 12 8-12 8Z"/>';
  }

  function attachSource(mobile = innerWidth <= 800 || saveData) {
    attached = true;
    usingMobile = mobile;
    film.dataset.quality = mobile ? 'mobile' : 'hd';
    const source = mobile ? film.dataset.mobileSrc : film.dataset.hdSrc;
    videos.forEach(video => { video.src = source; video.preload = 'auto'; video.load(); });
  }

  function mayPlay() {
    return !disposed && !userPaused && (manuallyStarted || (!reducedMotion.matches && !saveData))
      && (inView || document.fullscreenElement === film) && !document.hidden && !document.querySelector('dialog[open]');
  }

  function stop() {
    playVersion++;
    starting = false;
    cancelAnimationFrame(frame);
    frame = 0;
    lastTick = 0;
    videos.forEach(video => video.pause());
    if (film.dataset.state !== 'error') setState('paused', userPaused ? '已暂停 · 随时继续' : '静音看房 · 随时播放');
  }

  async function start(manual = false) {
    if (manual) { userPaused = false; manuallyStarted = true; }
    if (!mayPlay() || starting || film.dataset.state === 'playing') return;
    if (!attached) attachSource();
    const version = ++playVersion;
    starting = true;
    setState('loading', '正在打开房间…');
    try {
      videos[active].playbackRate = rate;
      await videos[active].play();
      if (version !== playVersion || !mayPlay()) return;
      if (fade) { videos[fade.next].playbackRate = rate; await videos[fade.next].play(); }
      if (version !== playVersion || !mayPlay()) return;
      videos[active].style.opacity = fade ? videos[active].style.opacity : '1';
      setState('playing', '慢慢走进房间');
      frame = requestAnimationFrame(tick);
    } catch (error) {
      if (version !== playVersion || error.name === 'AbortError') return;
      userPaused = true;
      if (error.name === 'NotAllowedError') setState('paused', '点击播放，走进房间');
      else setState('error', '视频暂不可用 · 可查看实景相册');
    } finally { if (version === playVersion) starting = false; }
  }

  async function beginFade() {
    switching = true;
    const next = 1 - active;
    const video = videos[next];
    const version = playVersion;
    video.currentTime = 0;
    video.playbackRate = rate;
    video.style.zIndex = '2';
    video.style.opacity = '0';
    try {
      await video.play();
      if (version !== playVersion || !mayPlay()) { video.pause(); return; }
      // Start blending only after the incoming clip can display a decoded frame.
      if (video.readyState >= 2) fade = { next, elapsed: 0 };
    } catch { /* The current clip remains visible if the standby clip cannot play. */ }
    finally { switching = false; }
  }

  function finishFade() {
    const previous = active;
    active = fade.next;
    videos[active].style.opacity = '1';
    videos[active].style.zIndex = '1';
    videos[previous].style.opacity = '0';
    videos[previous].style.zIndex = '1';
    videos[previous].pause();
    videos[previous].currentTime = 0;
    film.dataset.activeVideo = String(active);
    fade = null;
  }

  function tick(now) {
    if (!mayPlay()) { stop(); return; }
    const delta = lastTick ? Math.min(now - lastTick, 100) : 0;
    lastTick = now;
    const current = videos[active];
    if (fade) {
      fade.elapsed += delta;
      const t = Math.min(fade.elapsed / fadeDuration, 1);
      videos[fade.next].style.opacity = String(t * t * (3 - 2 * t));
      if (t >= 1) finishFade();
    } else if (!switching && Number.isFinite(current.duration) && current.duration - current.currentTime <= fadeDuration / 1000 * rate + .12) {
      beginFade();
    }
    const visibleVideo = videos[active];
    progress.style.transform = `scaleX(${visibleVideo.duration ? visibleVideo.currentTime / visibleVideo.duration : 0})`;
    frame = requestAnimationFrame(tick);
  }

  videos.forEach((video, index) => {
    video.muted = true;
    video.defaultMuted = true;
    video.addEventListener('ended', () => {
      if (index !== active || !mayPlay()) return;
      if (fade) finishFade();
      else { video.currentTime = 0; video.play().catch(() => stop()); }
    });
    video.addEventListener('error', () => {
      if (!attached || disposed || !video.error) return;
      stop();
      if (!usingMobile) {
        fade = null; switching = false; active = 0;
        videos.forEach(v => { v.style.opacity = '0'; v.style.zIndex = '1'; });
        attachSource(true);
        start();
      } else {
        videos.forEach(v => { v.style.opacity = '0'; });
        setState('error', '视频暂不可用 · 可查看实景相册');
      }
    });
  });

  toggle.addEventListener('click', () => {
    if (film.dataset.state === 'playing' || starting) { userPaused = true; stop(); }
    else {
      if (film.dataset.state === 'error') { attached = false; fade = null; active = 0; }
      start(true);
    }
  });
  fullScreen.addEventListener('click', async () => {
    try {
      if (document.fullscreenElement === film) await document.exitFullscreen();
      else if (film.requestFullscreen) await film.requestFullscreen();
      else if (videos[active].webkitEnterFullscreen) videos[active].webkitEnterFullscreen();
    } catch { status.textContent = '请在当前画面继续观看'; }
  });
  if (!film.requestFullscreen && !videos[0].webkitEnterFullscreen) fullScreen.hidden = true;
  document.addEventListener('fullscreenchange', () => {
    const full = document.fullscreenElement === film;
    fullScreen.setAttribute('aria-label', full ? '退出客房视频全屏' : '全屏查看客房视频');
    fullScreen.querySelector('span').textContent = full ? '退出全屏' : '全屏';
    if (mayPlay()) start();
  });

  if ('IntersectionObserver' in window) {
    const preload = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        if (!saveData && !reducedMotion.matches && !attached) attachSource();
        preload.disconnect();
      }
    }, { rootMargin: '700px 0px' });
    preload.observe(film);
    const visibility = new IntersectionObserver(entries => {
      inView = entries[0].isIntersecting && entries[0].intersectionRatio >= .15;
      if (mayPlay()) start(); else stop();
    }, { threshold: [0, .15] });
    visibility.observe(film);
  } else { inView = true; start(); }
  document.addEventListener('visibilitychange', () => { if (mayPlay()) start(); else stop(); });
  const dialogs = new MutationObserver(() => { if (mayPlay()) start(); else stop(); });
  document.querySelectorAll('dialog').forEach(dialog => dialogs.observe(dialog, { attributes: true, attributeFilter: ['open'] }));
  reducedMotion.addEventListener('change', () => { manuallyStarted = false; if (mayPlay()) start(); else stop(); });
  window.addEventListener('pagehide', () => { disposed = true; stop(); });
  window.addEventListener('pageshow', () => { disposed = false; if (mayPlay()) start(); });
  setState('paused', '静音看房 · 随时播放');
  }
  document.querySelectorAll('[data-room-film]').forEach(initializeRoomFilm);
})();
