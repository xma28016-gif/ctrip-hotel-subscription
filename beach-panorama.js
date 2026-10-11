(() => {
  const scene = document.querySelector('#beach-preview');
  const container = document.querySelector('#beach-panorama');
  if (!scene || !container) return;
  const controls = scene.querySelector('.beach-controls');
  const status = scene.querySelector('#beach-status');
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const smallScreen = window.matchMedia('(max-width: 800px)');
  const initialView = { yaw: -150, pitch: smallScreen.matches ? -9 : -4, hfov: smallScreen.matches ? 80 : 105 };
  let viewer;
  let started = false;
  let ready = false;
  let retried = false;
  let imageUrl;

  function releaseImage() {
    if (imageUrl) { URL.revokeObjectURL(imageUrl); imageUrl = undefined; }
  }

  function showFallback() {
    ready = false;
    viewer?.destroy();
    releaseImage();
    container.hidden = true;
    container.dataset.state = 'fallback';
    scene.classList.remove('beach-ready', 'beach-immersed');
    controls.hidden = true;
    status.hidden = false;
    status.textContent = '当前设备暂时无法打开全景，已展示实景照片。';
  }

  function retryOrFallback(useSmallImage) {
    if (!useSmallImage && !retried) {
      retried = true;
      viewer?.destroy();
      releaseImage();
      createViewer(true);
    } else showFallback();
  }

  async function createViewer(useSmallImage) {
    try {
      container.dataset.state = 'loading';
      status.hidden = false;
      status.textContent = '正在打开海滩全景…';
      const source = `./assets/photos/beach-panorama-${useSmallImage ? '4k' : '8k'}.webp`;
      // Handle network failures before handing a valid image to the viewer.
      const response = await fetch(source);
      if (!response.ok) throw new Error('Panorama photo unavailable');
      imageUrl = URL.createObjectURL(await response.blob());
      container.dataset.source = source;
      viewer = window.pannellum.viewer(container, {
        type: 'equirectangular',
        panorama: imageUrl,
        autoLoad: true, autoRotate: 0, autoRotateInactivityDelay: -1,
        showControls: false, compass: false, mouseZoom: true, keyboardZoom: true,
        capturedKeyNumbers: [37, 38, 39, 40, 187, 189, 107, 109, 61, 173],
        draggable: true, friction: .18, minHfov: 40, maxHfov: 120,
        ...initialView, escapeHTML: true,
        strings: { loadingLabel: '正在打开海滩全景…', noPanoramaError: '全景暂时无法打开。', webglError: '当前设备暂时无法显示全景。', fileAccessError: '全景照片暂时无法加载。' },
      });
      container.querySelector('.pnlm-about-msg')?.remove();
      viewer.on('load', () => {
        ready = true;
        releaseImage();
        container.dataset.state = 'ready';
        scene.classList.add('beach-ready');
        status.hidden = true;
        controls.hidden = false;
      });
      viewer.on('error', () => retryOrFallback(useSmallImage));
      window.beachPanorama = viewer;
    } catch { retryOrFallback(useSmallImage); }
  }

  function start() {
    if (started) return;
    started = true;
    if (!window.pannellum) { showFallback(); return; }
    createViewer(smallScreen.matches);
  }

  function stop() { if (ready) viewer.stopMovement(); }
  const duration = () => motion.matches ? 0 : 300;
  scene.querySelectorAll('[data-beach-view]').forEach(button => button.addEventListener('click', () => {
    if (!ready) return;
    stop();
    const view = button.dataset.beachView === 'beach' ? { yaw: -10, pitch: -4, hfov: smallScreen.matches ? 80 : 100 } : initialView;
    viewer.lookAt(view.pitch, view.yaw, view.hfov, motion.matches ? 0 : 800);
  }));
  scene.querySelector('#beach-zoom-in').addEventListener('click', () => {
    if (ready) { stop(); viewer.setHfov(viewer.getHfov() - 12, duration()); }
  });
  scene.querySelector('#beach-zoom-out').addEventListener('click', () => {
    if (ready) { stop(); viewer.setHfov(viewer.getHfov() + 12, duration()); }
  });
  scene.querySelector('#beach-reset').addEventListener('click', () => {
    if (ready) { stop(); viewer.lookAt(initialView.pitch, initialView.yaw, initialView.hfov, duration()); }
  });
  scene.querySelector('#beach-text-toggle').addEventListener('click', event => {
    const immersed = scene.classList.toggle('beach-immersed');
    event.currentTarget.setAttribute('aria-pressed', String(immersed));
    event.currentTarget.textContent = immersed ? '显示标题' : '纯享海景';
    event.currentTarget.title = immersed ? '显示标题和预订入口' : '收起标题，尽情观看海景';
  });
  container.addEventListener('keydown', event => {
    if (event.key === 'Home' && ready) {
      event.preventDefault(); stop();
      viewer.lookAt(initialView.pitch, initialView.yaw, initialView.hfov, duration());
    }
    if (event.key === 'Escape') container.blur();
  });
  window.addEventListener('blur', stop);
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  const modalObserver = new MutationObserver(() => { if (document.querySelector('dialog[open]')) stop(); });
  document.querySelectorAll('dialog').forEach(dialog => modalObserver.observe(dialog, { attributes: true, attributeFilter: ['open'] }));

  if ('IntersectionObserver' in window) {
    const loader = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { start(); loader.disconnect(); }
    }, { rootMargin: '500px' });
    loader.observe(scene);
    const visibility = new IntersectionObserver(entries => {
      if (!entries[0].isIntersecting) stop();
    });
    visibility.observe(scene);
  } else start();
})();
