'use strict';

(() => {
  const hero = document.querySelector('#home');
  const header = document.querySelector('#site-header');
  const container = document.querySelector('#lobby-panorama');
  const tools = document.querySelector('.panorama-tools');
  const status = document.querySelector('#panorama-status');
  const feedback = document.querySelector('#panorama-feedback');
  const tourButton = document.querySelector('#panorama-tour-toggle');
  const orientationButton = document.querySelector('#panorama-orientation');
  const detail = document.querySelector('#panorama-detail');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const smallScreen = window.matchMedia('(max-width: 600px)');
  const initialView = { yaw: 90, pitch: 8, hfov: smallScreen.matches ? 65 : 105 };
  const landmarks = [
    { id: 'stairs', title: '雕花楼梯', kicker: '01 / THE GRAND STAIRWAY', yaw: 104, pitch: 18, hfov: 78,
      copy: '双侧弧形楼梯围绕雕花石材门廊展开。沿着精细的栏杆与金色装饰，看见这座历史大堂的宫殿气韵。' },
    { id: 'arches', title: '古典拱廊', kicker: '02 / THE ARCADES', yaw: 0, pitch: 12, hfov: 88,
      copy: '石材拱门依次展开，古典壁灯与雕饰相映。把目光沿着长廊缓缓移动，感受建筑的节奏与纵深。' },
    { id: 'ceiling', title: '雕饰顶面', kicker: '03 / LOOK UP', yaw: 90, pitch: 57, hfov: 86,
      copy: '抬头看，金色线条与深绿顶面交织，古典吊灯悬于其间。丰富的几何纹样，为大堂留下细腻的艺术表情。' },
    { id: 'lounge', title: '大堂休息区', kicker: '04 / A QUIET MOMENT', yaw: -92, pitch: -4, hfov: 90,
      copy: '沙发、扶手椅与中央喷泉，构成大堂里的停留角落。透过高窗洒入的光线，让等待与小憩也成为旅途的一部分。' },
  ];
  const interactive = 'a, button, input, select, .panorama-tools, .panorama-detail';
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const angleDifference = (a, b) => ((a - b + 540) % 360) - 180;
  let viewer;
  let ready = false;
  let inView = true;
  let windowFocused = true;
  let rotating = false;
  let wantsTour = !reducedMotion.matches;
  let movingToDetail = false;
  let transitionTimer;
  let detailTrigger;
  let followFrame = 0;
  let followTime = 0;
  let targetYawSpeed = 0;
  let targetPitchSpeed = 0;
  let yawSpeed = 0;
  let pitchSpeed = 0;
  let orientationActive = false;
  let orientationAttempt = 0;
  let orientationTimer;
  let orientationFrame = 0;
  let orientationBase;
  let orientationTarget;

  function updateTour() {
    const shouldRotate = ready && wantsTour && inView && windowFocused && !document.hidden && !orientationActive;
    if (viewer && shouldRotate !== rotating) {
      if (shouldRotate) viewer.startAutoRotate(-0.8, viewer.getPitch());
      else { viewer.stopAutoRotate(); viewer.stopMovement(); }
    }
    rotating = shouldRotate;
    container.dataset.touring = String(rotating);
    tourButton.setAttribute('aria-pressed', String(rotating));
    tourButton.setAttribute('aria-label', rotating ? '暂停自动环视' : '开始自动环视');
    tourButton.querySelector('[data-tour-label]').textContent = rotating ? '暂停环视' : '自动环视';
    tourButton.querySelector('[data-tour-icon]').setAttribute('d', rotating ? 'M9 5v14M15 5v14' : 'm9 5 10 7-10 7Z');
  }

  function stopTour() { wantsTour = false; updateTour(); }

  function clearFollow() {
    cancelAnimationFrame(followFrame);
    followFrame = followTime = targetYawSpeed = targetPitchSpeed = yawSpeed = pitchSpeed = 0;
    container.dataset.looking = 'false';
  }

  function canFollow() {
    return ready && inView && windowFocused && !document.hidden && finePointer.matches &&
      !reducedMotion.matches && !movingToDetail && !orientationActive && !document.querySelector('dialog[open]');
  }

  function followPointer(time) {
    if (!canFollow()) { clearFollow(); return; }
    const seconds = followTime ? Math.min((time - followTime) / 1000, .05) : 1 / 60;
    followTime = time;
    const easing = 1 - Math.exp(-seconds / .18);
    yawSpeed += (targetYawSpeed - yawSpeed) * easing;
    pitchSpeed += (targetPitchSpeed - pitchSpeed) * easing;
    viewer.lookAt(viewer.getPitch() + pitchSpeed * seconds, viewer.getYaw() + yawSpeed * seconds, undefined, false);
    if (Math.max(Math.abs(yawSpeed), Math.abs(pitchSpeed), Math.abs(targetYawSpeed), Math.abs(targetPitchSpeed)) < .015) {
      clearFollow(); return;
    }
    container.dataset.looking = 'true';
    followFrame = requestAnimationFrame(followPointer);
  }

  // The central area is still; nearer the edges, the visitor gently turns their head.
  function edgeSpeed(position) {
    const strength = clamp((Math.abs(position) - .42) / .58, 0, 1);
    return Math.sign(position) * strength * strength;
  }

  hero.addEventListener('pointermove', event => {
    if (event.pointerType !== 'mouse' || !finePointer.matches || !ready) return;
    if (!event.target.closest('#panorama-tour-toggle')) stopTour();
    if (event.buttons || event.target.closest(interactive) || !canFollow()) { clearFollow(); return; }
    const bounds = container.getBoundingClientRect();
    targetYawSpeed = edgeSpeed((event.clientX - bounds.left) / bounds.width * 2 - 1) * 12;
    targetPitchSpeed = -edgeSpeed((event.clientY - bounds.top) / bounds.height * 2 - 1) * 8;
    if (!followFrame && (targetYawSpeed || targetPitchSpeed)) followFrame = requestAnimationFrame(followPointer);
  }, { passive: true });
  hero.addEventListener('pointerleave', clearFollow);

  function say(message) { feedback.textContent = message; feedback.hidden = !message; }

  function stopOrientation() {
    orientationAttempt += 1;
    clearTimeout(orientationTimer);
    cancelAnimationFrame(orientationFrame);
    window.removeEventListener('deviceorientation', onOrientation);
    orientationActive = false;
    orientationBase = orientationTarget = undefined;
    orientationFrame = 0;
    container.dataset.orientation = 'false';
    orientationButton.disabled = false;
    orientationButton.setAttribute('aria-pressed', 'false');
    orientationButton.setAttribute('aria-label', '开启体感环视');
  }

  function interruptView() {
    stopTour();
    clearFollow();
    if (orientationActive) say('');
    stopOrientation();
    clearTimeout(transitionTimer);
    movingToDetail = false;
    if (ready) viewer.stopMovement();
  }

  // Manual actions take priority over hover, tours, sensor input and guided transitions.
  hero.addEventListener('pointerdown', event => {
    if (!event.target.closest('#panorama-tour-toggle, #panorama-orientation')) interruptView();
    else clearFollow();
  }, { capture: true, passive: true });
  hero.addEventListener('click', event => {
    if (!event.target.closest('#panorama-tour-toggle')) stopTour();
  });
  header.addEventListener('pointerenter', () => { clearFollow(); stopTour(); });
  header.addEventListener('pointerdown', interruptView, { passive: true });
  header.addEventListener('click', interruptView);
  container.addEventListener('wheel', interruptView, { capture: true, passive: true });
  container.addEventListener('touchstart', event => {
    if (!event.target.closest('button')) interruptView();
  }, { capture: true, passive: true });
  container.addEventListener('keydown', event => {
    // Keys on a hotspot belong to that button, rather than the panorama behind it.
    if (!ready || event.target.closest('button')) return;
    interruptView();
    if (event.key === 'Home') {
      event.preventDefault();
      event.stopImmediatePropagation();
      viewer.lookAt(initialView.pitch, initialView.yaw, initialView.hfov, reducedMotion.matches ? false : 500);
    }
  }, { capture: true });
  hero.addEventListener('focusin', clearFollow);

  function markDetail(id) {
    hero.querySelectorAll('[data-panorama-landmark]').forEach(button => {
      button.setAttribute('aria-expanded', String(button.dataset.panoramaLandmark === id));
    });
    container.dataset.landmark = id || '';
  }

  function openDetail(landmark, trigger, keyboard = false) {
    if (!ready) return;
    interruptView();
    say('');
    detailTrigger = trigger;
    document.querySelector('#panorama-detail-kicker').textContent = landmark.kicker;
    document.querySelector('#panorama-detail-title').textContent = landmark.title;
    document.querySelector('#panorama-detail-copy').textContent = landmark.copy;
    detail.hidden = false;
    markDetail(landmark.id);
    if (keyboard) document.querySelector('#panorama-detail-close').focus({ preventScroll: true });
    movingToDetail = !reducedMotion.matches;
    viewer.lookAt(landmark.pitch, landmark.yaw, smallScreen.matches ? 65 : landmark.hfov, reducedMotion.matches ? false : 1100);
    if (movingToDetail) transitionTimer = setTimeout(() => { movingToDetail = false; }, 1150);
  }

  function closeDetail(restoreFocus = false) {
    detail.hidden = true;
    markDetail('');
    if (restoreFocus) {
      const guide = tools.querySelector(`[data-panorama-landmark="${detailTrigger?.dataset.panoramaLandmark}"]`);
      guide?.focus({ preventScroll: true });
    }
  }

  tools.querySelectorAll('[data-panorama-landmark]').forEach(button => {
    button.addEventListener('mousedown', event => event.preventDefault());
    button.addEventListener('click', event => openDetail(landmarks.find(item => item.id === button.dataset.panoramaLandmark), button, event.detail === 0));
  });
  document.querySelector('#panorama-detail-close').addEventListener('click', () => closeDetail(true));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !detail.hidden) { interruptView(); closeDetail(true); }
  });

  function createLandmark(element, landmark) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.panoramaLandmark = landmark.id;
    button.setAttribute('aria-label', `探索${landmark.title}`);
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-controls', 'panorama-detail');
    const label = document.createElement('span');
    label.textContent = landmark.title;
    button.append(label);
    button.addEventListener('mousedown', event => { event.preventDefault(); event.stopPropagation(); });
    ['touchstart', 'keydown', 'keyup'].forEach(name => button.addEventListener(name, event => event.stopPropagation()));
    button.addEventListener('click', event => { event.stopPropagation(); openDetail(landmark, button, event.detail === 0); });
    element.append(button);
  }

  tourButton.addEventListener('click', () => {
    const resume = !rotating;
    interruptView();
    closeDetail();
    say('');
    wantsTour = resume;
    updateTour();
  });
  document.querySelectorAll('[data-panorama-zoom]').forEach(button => {
    button.addEventListener('click', () => {
      if (!ready) return;
      interruptView();
      const change = button.dataset.panoramaZoom === 'in' ? -10 : 10;
      viewer.setHfov(viewer.getHfov() + change, reducedMotion.matches ? false : 250);
    });
  });
  document.querySelector('#panorama-reset').addEventListener('click', () => {
    if (!ready) return;
    interruptView();
    closeDetail();
    say('');
    viewer.lookAt(initialView.pitch, initialView.yaw, initialView.hfov, reducedMotion.matches ? false : 650);
  });

  // Convert the device pose to camera angles, using the same quaternion convention
  // as the locally vendored MIT-licensed Pannellum viewer. Calibrate to the current view.
  function deviceAngles(event) {
    const half = Math.PI / 360;
    const [x, y, z] = [event.beta * half, event.gamma * half, event.alpha * half];
    const [cx, cy, cz, sx, sy, sz] = [Math.cos(x), Math.cos(y), Math.cos(z), Math.sin(x), Math.sin(y), Math.sin(z)];
    const multiply = (a, b) => [
      a[0] * b[0] - a[1] * b[1] - a[2] * b[2] - a[3] * b[3],
      a[1] * b[0] + a[0] * b[1] + a[2] * b[3] - a[3] * b[2],
      a[2] * b[0] + a[0] * b[2] + a[3] * b[1] - a[1] * b[3],
      a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    ];
    const pose = [cx * cy * cz - sx * sy * sz, sx * cy * cz - cx * sy * sz, cx * sy * cz + sx * cy * sz, cx * cy * sz + sx * sy * cz];
    const screenAngle = -(window.screen.orientation?.angle ?? window.orientation ?? 0) * half;
    const [w, qx, qy, qz] = multiply(multiply(pose, [Math.SQRT1_2, -Math.SQRT1_2, 0, 0]), [Math.cos(screenAngle), 0, -Math.sin(screenAngle), 0]);
    return {
      pitch: Math.atan2(2 * (w * qx + qy * qz), 1 - 2 * (qx * qx + qy * qy)) * 180 / Math.PI,
      yaw: Math.atan2(2 * (w * qz + qx * qy), 1 - 2 * (qy * qy + qz * qz)) * 180 / Math.PI,
    };
  }

  function renderOrientation() {
    if (!orientationActive || !orientationTarget || !ready || !inView || document.hidden) { orientationFrame = 0; return; }
    const yawDelta = angleDifference(orientationTarget.yaw, viewer.getYaw());
    const pitchDelta = orientationTarget.pitch - viewer.getPitch();
    viewer.lookAt(viewer.getPitch() + pitchDelta * .12, viewer.getYaw() + yawDelta * .12, undefined, false);
    if (Math.abs(yawDelta) + Math.abs(pitchDelta) > .03) orientationFrame = requestAnimationFrame(renderOrientation);
    else orientationFrame = 0;
  }

  function onOrientation(event) {
    if (!orientationActive || ![event.alpha, event.beta, event.gamma].every(Number.isFinite)) return;
    clearTimeout(orientationTimer);
    const angles = deviceAngles(event);
    if (!orientationBase) {
      orientationBase = { ...angles, viewYaw: viewer.getYaw(), viewPitch: viewer.getPitch() };
      say('转动手机，环顾大堂。');
    }
    orientationTarget = {
      yaw: orientationBase.viewYaw - angleDifference(angles.yaw, orientationBase.yaw),
      pitch: clamp(orientationBase.viewPitch + angleDifference(angles.pitch, orientationBase.pitch), -75, 75),
    };
    if (!orientationFrame) orientationFrame = requestAnimationFrame(renderOrientation);
  }

  orientationButton.hidden = !(navigator.maxTouchPoints > 0 || window.matchMedia('(pointer: coarse)').matches);
  orientationButton.addEventListener('click', async () => {
    if (!ready) return;
    if (orientationActive) { stopOrientation(); say('体感已关闭，可以继续拖动环顾。'); return; }
    interruptView();
    if (!window.isSecureContext || !window.DeviceOrientationEvent) {
      say('这个设备暂时无法开启体感，可以拖动环顾。'); return;
    }
    const attempt = ++orientationAttempt;
    orientationButton.disabled = true;
    try {
      // This call stays inside the user's click; never request sensor access on load.
      const permission = typeof window.DeviceOrientationEvent.requestPermission === 'function'
        ? await window.DeviceOrientationEvent.requestPermission() : 'granted';
      if (attempt !== orientationAttempt) return;
      if (permission !== 'granted') { stopOrientation(); say('体感未开启，可以继续拖动环顾。'); return; }
      orientationActive = true;
      orientationButton.disabled = false;
      orientationButton.setAttribute('aria-pressed', 'true');
      orientationButton.setAttribute('aria-label', '关闭体感环视');
      container.dataset.orientation = 'true';
      window.addEventListener('deviceorientation', onOrientation, { passive: true });
      say('轻轻转动手机，开始体感环视。');
      orientationTimer = setTimeout(() => {
        stopOrientation(); say('未读取到体感信息，可以继续拖动环顾。');
      }, 4000);
    } catch {
      if (attempt === orientationAttempt) { stopOrientation(); say('体感暂时无法开启，可以继续拖动环顾。'); }
    }
  });

  function pauseHiddenInput() {
    clearFollow();
    stopOrientation();
    if (ready) viewer.stopMovement();
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pauseHiddenInput();
    updateTour();
  });
  window.addEventListener('blur', () => { windowFocused = false; pauseHiddenInput(); updateTour(); });
  window.addEventListener('focus', () => { windowFocused = true; updateTour(); });
  reducedMotion.addEventListener('change', () => { if (reducedMotion.matches) interruptView(); });
  finePointer.addEventListener('change', clearFollow);
  new MutationObserver(() => {
    if (document.querySelector('dialog[open]')) interruptView();
  }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['open'] });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => {
      inView = entries[0].isIntersecting;
      if (!inView) pauseHiddenInput();
      updateTour();
    }, { threshold: 0 }).observe(hero);
  }

  function showFallback() {
    interruptView();
    ready = false;
    if (viewer) viewer.destroy();
    hero.classList.remove('panorama-ready');
    container.hidden = true;
    container.dataset.state = 'fallback';
    tools.hidden = true;
    detail.hidden = true;
    status.hidden = false;
    status.textContent = '全景暂时无法打开，可以继续向下探索酒店。';
  }

  if (!window.pannellum) { showFallback(); return; }
  try {
    viewer = window.pannellum.viewer(container, {
      type: 'equirectangular',
      panorama: smallScreen.matches ? './assets/photos/palace-lobby-4k.webp' : './assets/photos/palace-lobby-8k.webp',
      autoLoad: true, autoRotate: 0, autoRotateInactivityDelay: -1,
      showControls: false, compass: false, mouseZoom: true, keyboardZoom: true,
      capturedKeyNumbers: [37, 38, 39, 40, 187, 189, 107, 109, 61, 173],
      draggable: true, friction: 0.22, minHfov: 38, maxHfov: 120,
      ...initialView,
      escapeHTML: true,
      hotSpots: landmarks.map(landmark => ({
        id: landmark.id, pitch: landmark.pitch, yaw: landmark.yaw,
        cssClass: 'panorama-landmark', createTooltipFunc: createLandmark, createTooltipArgs: landmark,
      })),
      strings: {
        loadingLabel: '正在打开全景大厅…', loadButtonLabel: '进入全景大厅',
        noPanoramaError: '全景暂时无法打开。', webglError: '这个设备暂时无法显示全景。', fileAccessError: '全景照片暂时无法加载。',
      },
    });
    container.querySelector('.pnlm-about-msg')?.remove();
    viewer.on('load', () => {
      ready = true;
      container.dataset.state = 'ready';
      hero.classList.add('panorama-ready');
      status.hidden = true;
      tools.hidden = false;
      updateTour();
    });
    viewer.on('error', showFallback);
    window.lobbyPanorama = viewer;
  } catch { showFallback(); }
})();
