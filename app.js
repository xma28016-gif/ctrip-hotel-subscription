'use strict';

const photo = (name, alt) => ({ src: `./assets/photos/${name}.webp`, alt });
const rooms = {
  sea: { name: '海景房', price: 3280, label: 'KUBE · Suite Natural Sea & Spa 实景参考', photos: [photo('sea-room', '真实海景套房主卧与明亮窗景'), photo('sea-lounge', '海景套房的自然光休息区'), photo('sea-terrace', '面向圣特罗佩海湾的套房露台')] },
  wood: { name: '自然原木房', price: 2280, label: 'KUBE · Deluxe Wood 实景参考', photos: [photo('wood-room', '木质客房与面向花园的明亮窗景'), photo('wood-bed', '原木床头与温暖床品的客房实拍'), photo('wood-terrace', '原木客房的户外露台实拍')] },
  family: { name: '亲子儿童房', price: 3880, label: '禾风新栈 · 米米亲子房实拍 · 不同主题配置', photos: [photo('family-room', '真实亲子房：绿色室内滑梯、上下铺、大型泰迪熊与儿童桌椅'), photo('family-detail', '真实亲子房：室内滑梯、儿童帐篷、动物跳跳玩具与儿童桌椅')] },
};
const services = {
  dining: { eyebrow: 'DINING BY THE SEA', title: '把一顿晚餐，留给海湾。', description: '海风、暖灯与露台上的餐桌，组成一段悠长的晚餐时光。用法式料理、牛排、精致海鲜和香槟，探索酒店里的餐饮体验。照片来自真实餐厅与酒店，餐饮组合用于概念展示。', label: 'KUBE、Le Petit Célestin 与法国酒店 · 实景参考', photos: [photo('restaurant-night', '暮色中的 KUBE 露天餐厅与泳池'), photo('food-seafood', '真实海鲜料理摆盘'), photo('food-steak', '真实法式牛排料理'), photo('food-champagne', '真实香槟与餐饮体验'), photo('restaurant', '面朝海湾的露台餐桌')] },
  pool: { eyebrow: 'POOL & SUNSHINE', title: '把时间，交给水与阳光。', description: '在面朝海湾的泳池旁，游一会儿，或只是躺一会儿。让遮阳休息区、地中海的蓝与漫长的午后，成为假期最简单的快乐。', label: 'KUBE Saint-Tropez · 实景参考', photos: [photo('pool', '真实酒店室外泳池与海湾景色'), photo('coast', '真实海滨遮阳休憩区域')] },
  wellness: { eyebrow: 'SPA & WELLNESS', title: '给身体，一次温柔的暂停。', description: '从柔和烛光里的按摩与水疗，到让身体舒展的健身空间，为你的假期留一点专属于自己的时间。点击下方切换 SPA 或健身实景。', label: 'KUBE Saint-Tropez · 实景参考', photos: [photo('spa', '真实按摩水疗体验'), photo('spa-detail', '真实酒店按摩服务实拍'), photo('fitness', '真实酒店健身空间')] },
};
const money = value => new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY', maximumFractionDigits: 0 }).format(value);
const icon = name => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
const roomPhotoIndexes = { sea: 0, wood: 0, family: 0 };
const experienceDialog = document.querySelector('#experience-dialog');
const bookingDialog = document.querySelector('#booking-dialog');
const dialogBody = document.querySelector('#experience-dialog-body');
let dialogGallery = null;
let bookingDetails = null;
let activeFeature = 'arrival';
let destination = 'port';
let flightDelayed = false;
const savedReminders = new Set();
let toastTimer;

document.documentElement.classList.add('js');
if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(entries => entries.forEach(entry => {
    if (entry.isIntersecting) { entry.target.classList.add('visible'); observer.unobserve(entry.target); }
  }), { threshold: 0.06 });
  document.querySelectorAll('.reveal').forEach(element => observer.observe(element));
} else document.querySelectorAll('.reveal').forEach(element => element.classList.add('visible'));

const header = document.querySelector('#site-header');
const updateHeader = () => header.classList.toggle('scrolled', window.scrollY > 120);
window.addEventListener('scroll', updateHeader, { passive: true });
updateHeader();
const menuToggle = document.querySelector('.menu-toggle');
const mobileNav = document.querySelector('#mobile-nav');
function closeMenu() { mobileNav.hidden = true; menuToggle.setAttribute('aria-expanded', 'false'); menuToggle.setAttribute('aria-label', '打开导航菜单'); }
menuToggle.addEventListener('click', () => {
  const open = menuToggle.getAttribute('aria-expanded') !== 'true';
  mobileNav.hidden = !open; menuToggle.setAttribute('aria-expanded', String(open)); menuToggle.setAttribute('aria-label', open ? '关闭导航菜单' : '打开导航菜单');
});
mobileNav.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
window.addEventListener('resize', () => { if (window.innerWidth > 800) closeMenu(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape') closeMenu(); });

function openDialog(dialog) {
  closeMenu();
  if (dialog === bookingDialog && experienceDialog.open) experienceDialog.close();
  if (!dialog.open) dialog.showModal();
  document.body.classList.add('modal-open');
}
document.querySelectorAll('dialog').forEach(dialog => {
  dialog.addEventListener('close', () => { if (!document.querySelector('dialog[open]')) document.body.classList.remove('modal-open'); });
  dialog.addEventListener('click', event => {
    const bounds = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) dialog.close();
  });
});
function showToast(message) {
  const toast = document.querySelector('#toast');
  clearTimeout(toastTimer); toast.textContent = message; toast.hidden = false;
  toastTimer = setTimeout(() => { toast.hidden = true; }, 3200);
}

function rotateRoomPhoto(id, amount) {
  const room = rooms[id];
  roomPhotoIndexes[id] = (roomPhotoIndexes[id] + amount + room.photos.length) % room.photos.length;
  const image = document.querySelector(`[data-room="${id}"] .room-photo img`);
  const current = room.photos[roomPhotoIndexes[id]];
  image.src = current.src; image.alt = current.alt;
  document.querySelector(`[data-photo-count="${id}"]`).textContent = `${String(roomPhotoIndexes[id] + 1).padStart(2, '0')} / ${String(room.photos.length).padStart(2, '0')}`;
}
function openGallery({ title, eyebrow, description, photos, label, index = 0, roomId = null, serviceId = null }) {
  dialogGallery = { photos, index, serviceId };
  experienceDialog.classList.toggle('family-gallery', roomId === 'family');
  const current = photos[index];
  dialogBody.innerHTML = `<img class="dialog-gallery-image" src="${current.src}" alt="${current.alt}"><div class="dialog-gallery-bar"><span>${label}</span><div><button data-dialog-prev aria-label="上一张实景照片">${icon('chevron').replace('class="icon"', 'class="icon flip"')}</button><span id="dialog-photo-count">${index + 1} / ${photos.length}</span><button data-dialog-next aria-label="下一张实景照片">${icon('chevron')}</button></div></div><div class="dialog-copy"><p class="eyebrow">${eyebrow}</p><h2 class="serif" id="experience-dialog-title">${title}</h2>${serviceId === 'wellness' ? '<div class="dialog-service-tabs" aria-label="SPA 与健身照片"><button class="active" data-wellness="spa">SPA 水疗</button><button data-wellness="fitness">健身空间</button></div>' : ''}<p>${description}</p>${roomId ? `<button class="button button-sage" data-book="${roomId}">体验预订 · ${money(rooms[roomId].price)} / 晚 ${icon('arrow')}</button>` : ''}</div>`;
  openDialog(experienceDialog);
}
function renderDialogPhoto() {
  const current = dialogGallery.photos[dialogGallery.index];
  const image = dialogBody.querySelector('.dialog-gallery-image');
  image.src = current.src; image.alt = current.alt;
  document.querySelector('#dialog-photo-count').textContent = `${dialogGallery.index + 1} / ${dialogGallery.photos.length}`;
  dialogBody.querySelectorAll('[data-wellness]').forEach(button => button.classList.toggle('active', button.dataset.wellness === (dialogGallery.index === 2 ? 'fitness' : 'spa')));
}

function parisDate() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const part = type => parts.find(p => p.type === type).value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
function addDays(isoDate, count) {
  const date = new Date(`${isoDate}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + count); return date.toISOString().slice(0, 10);
}
function dayNumber(isoDate) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return NaN;
  const value = Date.parse(`${isoDate}T00:00:00Z`);
  if (!Number.isFinite(value) || new Date(value).toISOString().slice(0, 10) !== isoDate) return NaN;
  return value / 86400000;
}
function shortDate(isoDate) { const [year, month, day] = isoDate.split('-'); return `${year} 年 ${Number(month)} 月 ${Number(day)} 日`; }
function showBookingStep(step) {
  document.querySelectorAll('[data-booking-step]').forEach(section => { section.hidden = Number(section.dataset.bookingStep) !== step; });
  document.querySelectorAll('[data-step-marker]').forEach(marker => {
    const current = Number(marker.dataset.stepMarker);
    marker.classList.toggle('current', current === step); marker.classList.toggle('done', current < step);
    if (current === step) marker.setAttribute('aria-current', 'step'); else marker.removeAttribute('aria-current');
  });
  bookingDialog.scrollTop = 0;
}
function initializeDates() {
  const checkIn = document.querySelector('#check-in'); const checkOut = document.querySelector('#check-out');
  const today = parisDate(); checkIn.min = today; checkIn.value = addDays(today, 1); checkOut.min = addDays(checkIn.value, 1); checkOut.value = addDays(checkIn.value, 3);
}
initializeDates();
document.querySelector('#check-in').addEventListener('input', event => {
  const checkOut = document.querySelector('#check-out');
  if (Number.isFinite(dayNumber(event.target.value))) checkOut.min = addDays(event.target.value, 1);
  document.querySelector('#booking-error').hidden = true;
});
document.querySelector('#check-out').addEventListener('input', () => { document.querySelector('#booking-error').hidden = true; });

function startBooking(id = 'sea') {
  document.querySelector('#booking-room').value = rooms[id] ? id : 'sea';
  document.querySelector('#booking-error').hidden = true;
  document.querySelector('#check-in').min = parisDate();
  if (document.querySelector('#check-in').value < parisDate()) initializeDates();
  bookingDetails = null; showBookingStep(1); openDialog(bookingDialog);
}
const bookingForm = document.querySelector('#booking-form');
bookingForm.noValidate = true;
bookingForm.addEventListener('submit', event => {
  event.preventDefault();
  const roomId = document.querySelector('#booking-room').value;
  const checkIn = document.querySelector('#check-in').value; const checkOut = document.querySelector('#check-out').value;
  const start = dayNumber(checkIn); const end = dayNumber(checkOut); const error = document.querySelector('#booking-error');
  let message = '';
  if (!rooms[roomId]) message = '请选择有效的房型。';
  else if (!Number.isFinite(start) || !Number.isFinite(end)) message = '请选择完整的入住与离店日期。';
  else if (checkIn < parisDate()) message = '入住日期不能早于今天（法国当地日期）。';
  else if (end <= start) message = '离店日期须晚于入住日期，至少入住一晚。';
  if (message) { error.textContent = message; error.hidden = false; return; }
  const adults = Number(document.querySelector('#adults').value); const children = Number(document.querySelector('#children').value);
  bookingDetails = { roomId, checkIn, checkOut, adults, children, nights: end - start, total: (end - start) * rooms[roomId].price };
  const room = rooms[roomId];
  document.querySelector('#booking-summary').innerHTML = `<div class="booking-summary-card"><img src="${room.photos[0].src}" alt="${room.photos[0].alt}"><div class="summary-copy"><h3>${room.name}</h3><div class="summary-row"><span>入住</span><span>${shortDate(checkIn)}</span></div><div class="summary-row"><span>离店</span><span>${shortDate(checkOut)}</span></div><div class="summary-row"><span>入住人数</span><span>${adults} 位成人${children ? ` · ${children} 位儿童` : ''}</span></div><div class="summary-row"><span>房价 × 晚数</span><span>${money(room.price)} × ${bookingDetails.nights} 晚</span></div><div class="summary-total"><span>示例总价 · 人民币</span><strong>${money(bookingDetails.total)}</strong></div><p class="summary-fine-print">仅按示例每晚价格计算，不代表实际库存、报价或任何预订承诺。</p></div></div>`;
  showBookingStep(2); document.querySelector('#booking-complete').focus();
});
document.querySelector('#booking-back').addEventListener('click', () => { showBookingStep(1); document.querySelector('#booking-room').focus(); });
document.querySelector('#booking-complete').addEventListener('click', () => {
  if (!bookingDetails) return;
  document.querySelector('#completion-summary').textContent = `${rooms[bookingDetails.roomId].name} · ${bookingDetails.nights} 晚 · 示例总价 ${money(bookingDetails.total)}`;
  showBookingStep(3); document.querySelector('#booking-restart').focus();
});
document.querySelector('#booking-restart').addEventListener('click', () => { showBookingStep(1); document.querySelector('#booking-room').focus(); });

const routeMap = (from, to) => `<svg class="route-map" viewBox="0 0 248 83" role="img" aria-label="${from}到${to}的示例路线示意，非真实地图"><path d="M0 55Q45 38 98 55T185 45L248 25V83H0Z" fill="#d6e3dc"/><path d="m0 25 65 16 58-25 59 22 66-13M36 0l18 83M163 0l-6 83" fill="none" stroke="#fcfcf2" stroke-width="9"/><path class="route-line" d="M38 27 75 37 118 26 166 37 210 58" fill="none" stroke="#799761" stroke-width="3" stroke-dasharray="4 3"/><path class="route-demo-line" d="M38 27 75 37 118 26 166 37 210 58" pathLength="1" fill="none" stroke="#577447" stroke-width="3" stroke-linecap="round"/><circle cx="38" cy="27" r="5" fill="#fffdf7" stroke="#637d50" stroke-width="2"/><circle class="route-end" cx="210" cy="58" r="5" fill="#637d50" stroke="#fffdf7" stroke-width="2"/><text x="13" y="15">${from}</text><text x="161" y="75">${to}</text></svg>`;
const actionButton = feature => `<button class="phone-action" data-save="${feature}" aria-pressed="${savedReminders.has(feature)}">${icon(savedReminders.has(feature) ? 'check' : 'bell')}${savedReminders.has(feature) ? '已加入示例行程 · 点击移除' : '加入示例行程'}</button>`;
const destinations = {
  port: { name: '圣特罗佩旧港', distance: '约 3 公里', taxi: '10–15 分钟 · €15–25', walk: '30–40 分钟 · €0', shuttle: '10–20 分钟 · 费用另询', time: '17:10', event: '前往圣特罗佩旧港' },
  beach: { name: '庞普洛讷海滩', distance: '约 8 公里', taxi: '20–30 分钟 · €30–50', walk: '约 100 分钟 · €0', shuttle: '30–45 分钟 · €3–8', time: '10:00', event: '前往庞普洛讷海滩' },
};
function renderPhone() {
  const detail = document.querySelector('#phone-detail');
  let content = '';
  if (activeFeature === 'arrival') content = `<div class="phone-detail-title">机场到店交通指引 <span>路线示例</span></div><p class="phone-detail-subtitle">尼斯机场 → 圣特罗佩海湾度假区</p>${routeMap('尼斯机场', '酒店示例')}<div class="transport-row"><span>机场专车 <b class="recommended">省心</b><small>约 110 公里 · 行程示例</small></span><span>100–150 分钟<br>€220–320</span></div><div class="transport-row"><span>租车自驾<small>自行安排出发与休息</small></span><span>110–160 分钟<br>€80–140 / 日</span></div><div class="transport-row"><span>铁路 + 地区巴士<small>周边车站换乘</small></span><span>180–240 分钟<br>€25–50</span></div><p class="phone-callout">示例建议：行李较多时选择专车；到店后沿入口步行约 3 分钟至大堂，建议 16:00 后办理入住。</p>${actionButton('arrival')}`;
  if (activeFeature === 'route') {
    const place = destinations[destination];
    content = `<div class="phone-detail-title">酒店到目的地 <span>路线示例</span></div><label class="phone-detail-subtitle" for="phone-destination">今天想去哪里？</label><select class="phone-destination" id="phone-destination"><option value="port" ${destination === 'port' ? 'selected' : ''}>圣特罗佩旧港</option><option value="beach" ${destination === 'beach' ? 'selected' : ''}>庞普洛讷海滩</option></select>${routeMap('酒店示例', place.name)}<div class="transport-row"><span>出租车<small>${place.distance}</small></span><span>${place.taxi}</span></div><div class="transport-row"><span>步行</span><span>${place.walk}</span></div><div class="transport-row"><span>${destination === 'port' ? '酒店接驳' : '地区巴士'}</span><span>${place.shuttle}</span></div><p class="phone-callout">为目的地添加出发前提醒，留出轻松到达的余量。路线和费用均为示例。</p>${actionButton('route')}`;
  }
  if (activeFeature === 'departure') content = `<div class="phone-detail-title">建议出发时间 <span>返程示例</span></div><p class="phone-detail-subtitle">酒店 → 尼斯机场 · 航班 18:30 起飞</p><div class="countdown">13:30</div><p class="countdown-label">距建议出发还有 3 小时 49 分钟 · 示例倒计时</p><div class="departure-facts"><div>路程预留<strong>2 小时</strong></div><div>机场提前量<strong>2 小时</strong></div><div>天气余量<strong>1 小时</strong></div></div><p class="phone-callout">示例天气：阵雨；路况：车流增多。结合道路行程、机场手续与意外余量，将出发时间提前至 13:30。</p><div class="transport-row"><span>出发前提醒</span><span>13:00 · 提前 30 分钟</span></div>${actionButton('departure')}`;
  if (activeFeature === 'dynamic') content = `<div class="phone-detail-title">航班动态关注 <span>模拟事件</span></div><p class="phone-detail-subtitle">返程航班 · 尼斯 → 巴黎</p><div class="flight-times"><div><span>${flightDelayed ? '原计划' : '计划起飞'}</span><strong>18:30</strong></div>${icon('plane')}<div><span>${flightDelayed ? '变更后' : '预计到达'}</span><strong>${flightDelayed ? '19:20' : '20:00'}</strong></div></div><div class="flight-status ${flightDelayed ? 'delayed' : ''}">${flightDelayed ? '示例变更：航班延误 50 分钟' : '示例状态：航班按计划运行'}</div><p class="phone-callout">${flightDelayed ? '已更新示例行程。建议关注后续转机衔接，联系航空公司核对连接航班；保留原出发余量，避免再次变更。' : '持续关注航班、列车、天气与路况。当变化影响行程时，展示提醒及改路线、调整衔接等应对建议。'}</p><button class="phone-action" data-simulate>${icon('plane')}${flightDelayed ? '重置航班示例' : '模拟一次航班延误'}</button>`;
  detail.innerHTML = `<div class="phone-detail-card">${content}</div>`;
  const phoneLabels = { arrival: '机场到店交通指引', route: '酒店到景点距离与路线', departure: '建议出发时间提醒', dynamic: '航班动态变更提醒' };
  document.querySelectorAll('[data-phone-feature]').forEach(card => { card.querySelector('span').textContent = phoneLabels[card.dataset.phoneFeature]; });
  document.querySelector(`[data-phone-feature="${activeFeature}"]`).after(detail);
  document.querySelectorAll('[data-feature]').forEach(tab => { const selected = tab.dataset.feature === activeFeature; tab.classList.toggle('active', selected); tab.setAttribute('aria-selected', String(selected)); tab.tabIndex = selected ? 0 : -1; });
  document.querySelectorAll('[data-phone-feature]').forEach(card => { const selected = card.dataset.phoneFeature === activeFeature; card.classList.toggle('selected', selected); card.setAttribute('aria-pressed', String(selected)); });
  document.querySelector('#assistant-preview').setAttribute('aria-labelledby', `tab-${activeFeature}`);
}
function revealPhoneSelection() {
  const screen = document.querySelector('#assistant-preview .phone-content');
  const card = document.querySelector('[data-phone-feature="' + activeFeature + '"]');
  const scale = screen.getBoundingClientRect().width / screen.clientWidth;
  const offset = (card.getBoundingClientRect().top - screen.getBoundingClientRect().top) / scale;
  screen.scrollTo({ top: Math.max(0, screen.scrollTop + offset - 12), behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
}
function renderTimeline() {
  const events = [{ time: '16:00', text: '抵达酒店，开启假期' }, { time: '19:00', text: '海湾露台晚餐' }];
  if (savedReminders.has('arrival')) events.push({ time: '13:00', text: '机场到店 · 专车路线提醒', saved: true });
  if (savedReminders.has('route')) events.push({ time: destinations[destination].time, text: destinations[destination].event, saved: true });
  if (savedReminders.has('departure')) events.push({ time: '13:00', text: '返程日 · 出发前 30 分钟提醒', saved: true });
  if (flightDelayed) events.push({ time: '19:20', text: '返程日 · 航班延误示例已更新', saved: true });
  const displayEvents = [...events].sort((a, b) => a.time.localeCompare(b.time));
  document.querySelector('#timeline-events').innerHTML = displayEvents.map(event => `<p class="${event.saved ? 'saved-event' : ''}"><span class="timeline-dot"></span><time>${event.time}</time><span>${event.text}</span></p>`).join('');
}
renderPhone();
document.querySelector('.feature-tabs').addEventListener('keydown', event => {
  const tabs = [...document.querySelectorAll('[data-feature]')];
  const index = tabs.indexOf(document.activeElement);
  if (index < 0) return;
  let next = index;
  if (event.key === 'ArrowDown' || event.key === 'ArrowRight') next = (index + 1) % tabs.length;
  else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
  else if (event.key === 'Home') next = 0;
  else if (event.key === 'End') next = tabs.length - 1;
  else return;
  event.preventDefault(); activeFeature = tabs[next].dataset.feature; renderPhone(); revealPhoneSelection(); tabs[next].focus();
});
document.addEventListener('change', event => {
  if (event.target.id === 'phone-destination') { destination = event.target.value; renderPhone(); renderTimeline(); document.querySelector('#phone-destination').focus(); }
});
document.addEventListener('click', event => {
  const target = event.target.closest('button');
  if (!target) return;
  if (target.hasAttribute('data-close')) { target.closest('dialog').close(); return; }
  if (target.hasAttribute('data-book')) { startBooking(target.dataset.book || 'sea'); return; }
  if (target.dataset.service) { openGallery({ ...services[target.dataset.service], serviceId: target.dataset.service }); return; }
  if (target.dataset.gallery) { const id = target.dataset.gallery; openGallery({ ...rooms[id], title: rooms[id].name, eyebrow: 'YOUR OWN RETREAT', description: '真实客房摄影，作为房型体验参考。每晚价格为人民币示例价，可继续体验日期选择与费用计算。', index: roomPhotoIndexes[id], roomId: id }); return; }
  if (target.dataset.photoPrev) { rotateRoomPhoto(target.dataset.photoPrev, -1); return; }
  if (target.dataset.photoNext) { rotateRoomPhoto(target.dataset.photoNext, 1); return; }
  if (target.hasAttribute('data-dialog-prev') || target.hasAttribute('data-dialog-next')) { const direction = target.hasAttribute('data-dialog-next') ? 1 : -1; dialogGallery.index = (dialogGallery.index + direction + dialogGallery.photos.length) % dialogGallery.photos.length; renderDialogPhoto(); return; }
  if (target.dataset.wellness) { dialogGallery.index = target.dataset.wellness === 'fitness' ? 2 : 0; renderDialogPhoto(); return; }
  if (target.dataset.feature || target.dataset.phoneFeature) { activeFeature = target.dataset.feature || target.dataset.phoneFeature; renderPhone(); revealPhoneSelection(); return; }
  if (target.dataset.save) {
    const key = target.dataset.save; const existed = savedReminders.has(key);
    if (existed) savedReminders.delete(key); else savedReminders.add(key);
    renderPhone(); renderTimeline(); showToast(existed ? '已从示例行程移除提醒' : '已加入示例行程，提醒仅在本页演示'); document.querySelector(`[data-save="${key}"]`).focus(); return;
  }
  if (target.hasAttribute('data-simulate')) { flightDelayed = !flightDelayed; renderPhone(); renderTimeline(); showToast(flightDelayed ? '航班延误示例已更新，查看调整建议' : '航班示例已重置'); document.querySelector('[data-simulate]').focus(); }
});
document.querySelector('#copyright-year').textContent = new Date().getFullYear();
