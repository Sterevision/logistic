/* global L, supabase */
'use strict';
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ───────── иконки ─────────
const ICONS = {
  truck: '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>',
  warehouse: '<path d="M22 8.35V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8.35A2 2 0 0 1 3.26 6.5l8-3.2a2 2 0 0 1 1.48 0l8 3.2A2 2 0 0 1 22 8.35Z"/><path d="M6 18h12"/><path d="M6 14h12"/><rect width="12" height="12" x="6" y="10"/>',
  navigation: '<polygon points="3 11 22 2 13 21 11 13 3 11"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>',
  route: '<circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/>',
  clipboard: '<rect width="8" height="4" x="8" y="2" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/>',
  road: '<path d="M4 19 8 5"/><path d="m20 19-4-14"/><path d="M12 6v2"/><path d="M12 11v2"/><path d="M12 16v2"/>',
  scale: '<path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/>',
  banknote: '<rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  hourglass: '<path d="M5 22h14"/><path d="M5 2h14"/><path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"/><path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/>',
  phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  grip: '<circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/>',
  flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/>',
  locate: '<line x1="2" x2="5" y1="12" y2="12"/><line x1="19" x2="22" y1="12" y2="12"/><line x1="12" x2="12" y1="2" y2="5"/><line x1="12" x2="12" y1="19" y2="22"/><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="3"/>',
  pencil: '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  skip: '<polygon points="5 4 15 12 5 20 5 4"/><line x1="19" x2="19" y1="5" y2="19"/>',
  flagcheck: '<path d="M4 22V4"/><path d="M4 4h12l-2 4 2 4H4"/>',
};
const svg = (n, cls = '') => `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n] || ''}</svg>`;
function setIcon(el, name) { el.dataset.i = name; el.innerHTML = svg(name); }
function paintIcons(root = document) { root.querySelectorAll('[data-i]').forEach((el) => { el.innerHTML = svg(el.dataset.i); }); }

const HZ = {
  bad_road: { icon: 'road', label: 'Плохая дорога' },
  weigh_post: { icon: 'scale', label: 'Весовой контроль' },
  toll: { icon: 'banknote', label: 'Платный участок' },
};
const MAX_KM = 600;
const DEFAULT_CENTER = { lat: 54.74, lng: 55.97 }; // если склад ещё не задан

// ───────── вспомогательные ─────────
const pad = (n) => String(n).padStart(2, '0');
const hm = (min) => (min == null ? '' : `${pad(Math.floor(min / 60) % 24)}:${pad(Math.round(min) % 60)}`);
const parseHM = (v) => { if (!v) return null; const [h, m] = String(v).split(':'); return Number(h) * 60 + Number(m); };
const fmtNum = (n) => Number(n).toLocaleString('ru-RU');
const plural = (n, f) => { const a = Math.abs(n) % 100, b = a % 10; return a > 10 && a < 20 ? f[2] : b > 1 && b < 5 ? f[1] : b === 1 ? f[0] : f[2]; };
function dateISO(offsetDays = 0) { const d = new Date(); d.setDate(d.getDate() + offsetDays); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
const tomorrow = () => dateISO(1);
const fmtDate = (s) => new Date(s + 'T00:00:00').toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'long' });
const fmtDay = (s) => new Date(s + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
const vibrate = (ms) => { try { navigator.vibrate && navigator.vibrate(ms); } catch { /* нет вибро */ } };
function km(a, b) {
  const R = 6371, r = Math.PI / 180;
  const h = Math.sin(((b.lat - a.lat) * r) / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(((b.lng - a.lng) * r) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
function windowText(from, to) {
  if (from == null && to == null) return '';
  if (from != null && to != null) return `${hm(from)}–${hm(to)}`;
  return from != null ? `с ${hm(from)}` : `до ${hm(to)}`;
}
const chip = (cls, icon, text) => `<span class="chip ${cls}">${icon ? svg(icon) : ''}${esc(text)}</span>`;

// ───────── состояние ─────────
let sb, session, clients = [], hazards = [], trips = [], depot = null;
let isDispatcher = false, editingId = null, newPoint = null, pendingHazard = null;
let lastResult = null; // { auto, cur, manual, savedId, depot, settings }
let ui = { state: 'build', tripId: null, tripDone: 0, tripTotal: 0, tripStatus: null, view: 'login' };
let map, mapLayer, mapH, mapHLayer, pendingMarker, installEvent;
let drive = null;

// ───────── уведомления, шторки, блокировка прокрутки ─────────
let toastTimer, toastUndo = null;
function toast(text, { undo = null, bad = false, ms = 5200 } = {}) {
  $('toast-text').textContent = text;
  $('toast').classList.toggle('bad', bad);
  $('toast').classList.add('show');
  toastUndo = undo;
  $('toast-undo').classList.toggle('hidden', !undo);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $('toast').classList.remove('show'); toastUndo = null; }, ms);
}
$('toast-undo').onclick = async () => { const f = toastUndo; toastUndo = null; $('toast').classList.remove('show'); if (f) await f(); };

function syncLock() {
  const driving = !$('drive').classList.contains('hidden');
  const open = driving || !$('pick').classList.contains('hidden') || document.querySelector('.sheet.open');
  document.body.classList.toggle('lock', !!open);
  document.body.classList.toggle('driving', driving);
}
function openSheet(id) { $(id).classList.add('open'); $('backdrop').classList.add('open'); syncLock(); }
function closeSheet(id) {
  $(id).classList.remove('open');
  if (!document.querySelector('.sheet.open')) $('backdrop').classList.remove('open');
  syncLock();
}
$('backdrop').onclick = () => document.querySelectorAll('.sheet.open').forEach((s) => closeSheet(s.id));

// ───────── установка на телефон ─────────
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvent = e; $('btn-install').classList.remove('hidden'); });
$('btn-install').onclick = async () => { if (!installEvent) return; installEvent.prompt(); await installEvent.userChoice; installEvent = null; $('btn-install').classList.add('hidden'); };

// ───────── старт ─────────
async function init() {
  paintIcons();
  $('trip-date').value = tomorrow();
  updatePlanTitle();
  restoreSettings();
  try { depot = JSON.parse(localStorage.getItem('depot')); } catch { depot = null; }
  let cfg;
  try { cfg = await (await fetch('/api/config')).json(); } catch { cfg = {}; }
  if (!cfg.supabaseUrl) { document.querySelector('main').innerHTML = '<div class="note bad">Не заданы SUPABASE_URL и SUPABASE_ANON_KEY в настройках Netlify.</div>'; return; }
  sb = supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
  const { data } = await sb.auth.getSession();
  session = data.session;
  sb.auth.onAuthStateChange((_e, s) => { const was = !!session; session = s; if (was !== !!s) render(); });
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
  render();
}

function show(v) {
  ui.view = v;
  for (const x of ['login', 'plan', 'trips', 'clients', 'hazards']) $('view-' + x).classList.toggle('hidden', x !== v);
  document.querySelectorAll('nav [data-v]').forEach((b) => b.classList.toggle('active', b.dataset.v === v));
  if (v === 'hazards') initHazardMap();
  if (v === 'trips') loadTrips();
  if (v === 'plan') { loadResume(); if (map) setTimeout(() => map.invalidateSize(), 60); }
  refreshCta();
  window.scrollTo(0, 0);
}
document.querySelectorAll('nav [data-v]').forEach((b) => (b.onclick = () => show(b.dataset.v)));

async function render() {
  const logged = !!session;
  $('nav').classList.toggle('hidden', !logged);
  $('btn-logout').classList.toggle('hidden', !logged);
  if (!logged) return show('login');
  await loadRole();
  show('plan');
  showDepot();
  await Promise.all([loadClients(), loadHazards()]);
}

async function loadRole() {
  const { data } = await sb.from('profiles').select('role').eq('id', session.user.id).maybeSingle();
  isDispatcher = data?.role === 'dispatcher';
  $('c-nodisp').classList.toggle('hidden', isDispatcher);
  $('btn-new-client').classList.toggle('hidden', !isDispatcher);
}

// ───────── вход ─────────
$('btn-login').onclick = async () => {
  const { error } = await sb.auth.signInWithPassword({ email: $('email').value, password: $('password').value });
  $('login-msg').textContent = error ? 'Не удалось войти: ' + error.message : '';
  $('login-msg').classList.toggle('err', !!error);
};
$('btn-signup').onclick = async () => {
  const { error } = await sb.auth.signUp({ email: $('email').value, password: $('password').value });
  $('login-msg').textContent = error ? 'Не удалось создать аккаунт: ' + error.message : 'Аккаунт создан. Если включено подтверждение, проверьте почту.';
  $('login-msg').classList.toggle('err', !!error);
};
$('btn-logout').onclick = () => sb.auth.signOut();

// ───────── настройки (запоминаются на телефоне) ─────────
const SETTING_IDS = ['v-weight', 'v-height', 'tolls', 'ret', 'v-hour', 'v-km', 'v-reserve', 'v-start'];
function restoreSettings() {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem('settings') || '{}'); } catch { saved = {}; }
  for (const k of SETTING_IDS) if (saved[k] != null && $(k)) $(k).value = saved[k];
}
function settings() {
  localStorage.setItem('settings', JSON.stringify(Object.fromEntries(SETTING_IDS.map((k) => [k, $(k).value]))));
  return {
    returnToDepot: $('ret').value === '1',
    avoidTolls: $('tolls').value,
    valueOfHourRub: Number($('v-hour').value) || 600,
    costPerKmRub: Number($('v-km').value) || 18,
    reservePct: $('v-reserve').value === '' ? 15 : Number($('v-reserve').value),
    startMin: parseHM($('v-start').value) ?? 480,
    vehicle: { weightKg: Number($('v-weight').value) || undefined, heightM: Number($('v-height').value) || undefined },
  };
}
function updatePlanTitle() {
  const v = $('trip-date').value || tomorrow();
  const prefix = v === tomorrow() ? 'завтра, ' : v === dateISO(0) ? 'сегодня, ' : '';
  $('plan-title').textContent = `Рейс на ${prefix}${fmtDay(v)}`;
}
$('trip-date').addEventListener('change', updatePlanTitle);

// ───────── выбор точки на карте ─────────
let pickMap, pickMarker, pickLatLng, pickCb;
function pickPoint(start, cb) {
  pickCb = cb; pickLatLng = null;
  $('pick').classList.remove('hidden');
  syncLock();
  $('pick-ok').disabled = true;
  $('pick-hint').textContent = 'Нажмите на карту, где находится точка';
  if (!pickMap) {
    pickMap = L.map('pick-map');
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(pickMap);
    pickMap.on('click', (e) => setPick(e.latlng));
  }
  if (pickMarker) { pickMarker.remove(); pickMarker = null; }
  const c = start || depot || DEFAULT_CENTER;
  pickMap.setView([c.lat, c.lng], start ? 16 : depot ? 12 : 9);
  if (start) setPick({ lat: start.lat, lng: start.lng });
  setTimeout(() => pickMap.invalidateSize(), 60);
}
function setPick(ll) {
  pickLatLng = { lat: ll.lat, lng: ll.lng };
  if (pickMarker) pickMarker.setLatLng(ll); else pickMarker = L.marker(ll).addTo(pickMap);
  $('pick-ok').disabled = false;
  $('pick-hint').textContent = depot ? `Точка выбрана. От склада по прямой около ${Math.round(km(depot, pickLatLng))} км.` : 'Точка выбрана.';
}
function getPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Телефон не отдаёт местоположение.'));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => reject(new Error('Нет доступа к GPS. Разрешите геолокацию для сайта в настройках браузера.')),
      { enableHighAccuracy: true, timeout: 9000, maximumAge: 15000 }
    );
  });
}
$('pick-gps').onclick = async () => {
  $('pick-hint').textContent = 'Определяю местоположение…';
  try { const ll = await getPosition(); pickMap.setView([ll.lat, ll.lng], 17); setPick(ll); } catch (e) { $('pick-hint').textContent = e.message; }
};
$('pick-cancel').onclick = () => { $('pick').classList.add('hidden'); syncLock(); };
$('pick-ok').onclick = () => { $('pick').classList.add('hidden'); syncLock(); if (pickLatLng && pickCb) pickCb(pickLatLng); };

// ───────── геокодер ─────────
async function geocode(text, near) {
  const q = new URLSearchParams({ text });
  if (near) { q.set('lat', near.lat); q.set('lng', near.lng); }
  const r = await fetch('/api/geocode?' + q);
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || 'Геокодер недоступен');
  return d.results;
}
const candLabel = (c) => `${c.label}${c.dist_km != null ? ` — ${c.dist_km} км от склада` : ''}`;

// ───────── склад ─────────
function showDepot() {
  $('depot-info').textContent = depot ? depot.name : 'Склад не задан. Укажите, откуда выезжаете.';
  $('depot-edit').classList.toggle('hidden', !!depot);
  $('depot-view').classList.toggle('hidden', !depot);
}
$('btn-depot-edit').onclick = () => { $('depot-edit').classList.remove('hidden'); $('depot-view').classList.add('hidden'); $('depot-text').value = depot?.name || ''; };
function setDepot(p, name) {
  depot = { name, lat: p.lat, lng: p.lng };
  localStorage.setItem('depot', JSON.stringify(depot));
  $('depot-cands').classList.add('hidden');
  showDepot(); loadClients(); markStale();
}
$('btn-depot').onclick = async () => {
  try {
    const found = await geocode($('depot-text').value, null);
    if (!found.length) return setMsg('Адрес склада не найден. Добавьте город или укажите точку на карте.', true);
    const sel = $('depot-cands');
    sel.innerHTML = '<option value="">Выберите адрес из списка</option>' + found.map((c, i) => `<option value="${i}">${esc(c.label)}</option>`).join('');
    sel.classList.remove('hidden');
    sel.onchange = () => { if (sel.value !== '') { const c = found[Number(sel.value)]; setDepot(c, c.label); setMsg(''); } };
    setMsg('');
  } catch (e) { setMsg(e.message, true); }
};
$('btn-depot-pick').onclick = () => pickPoint(depot, (ll) => setDepot(ll, $('depot-text').value || `Склад (${ll.lat.toFixed(4)}, ${ll.lng.toFixed(4)})`));
function setMsg(t, err = false) { $('plan-msg').textContent = t; $('plan-msg').classList.toggle('err', !!err); }

// ───────── клиенты ─────────
function clientStatus(c) {
  if (c.lat == null) return { ok: false, text: 'Нет точки на карте' };
  if (depot && km(depot, c) > MAX_KM) return { ok: false, text: 'Точка слишком далеко от склада' };
  return { ok: true, text: '' };
}
function clientChips(c, s) {
  let h = '';
  const w = windowText(parseHM(c.work_from), parseHM(c.work_to));
  if (w) h += chip('window', 'clock', w);
  if (c.unload_minutes) h += chip('', '', `разгрузка ${c.unload_minutes} мин`);
  if (!s.ok) h += chip('bad', 'alert', s.text);
  return h ? `<div class="chips">${h}</div>` : '';
}

async function loadClients() {
  if (!sb || !session) return;
  const checked = new Set([...document.querySelectorAll('#client-checks input:checked')].map((i) => i.value));
  const { data, error } = await sb.from('clients').select('*').order('name');
  if (error) { $('client-checks').innerHTML = `<div class="empty">${esc(error.message)}</div>`; return; }
  clients = data;
  $('client-checks').innerHTML = clients.length
    ? clients.map((c) => {
        const s = clientStatus(c);
        return `<label class="client ${s.ok ? '' : 'off'}"><input type="checkbox" value="${c.id}" ${s.ok ? '' : 'disabled'} ${checked.has(c.id) ? 'checked' : ''}>
          <span class="tick">${svg('check')}</span>
          <span class="grow"><b>${esc(c.name)}</b> <span class="muted" style="color:var(--ink-3)">${esc(c.kind)}</span><span class="addr">${esc(c.address)}</span>${clientChips(c, s)}</span></label>`;
      }).join('')
    : `<div class="empty"><b>Клиентов пока нет</b>${isDispatcher ? 'Добавьте их на вкладке «Клиенты».' : 'Их добавляет диспетчер.'}</div>`;
  renderClientsList();
  refreshCta();
}

function renderClientsList() {
  const q = $('c-search').value.trim().toLowerCase();
  const list = clients.filter((c) => !q || c.name.toLowerCase().includes(q) || (c.address || '').toLowerCase().includes(q));
  $('clients-list').innerHTML = list.length
    ? list.map((c) => {
        const s = clientStatus(c);
        const extra = c.phone ? chip('', 'phone', c.phone) : '';
        return `<div class="client" style="cursor:default"><span class="grow"><b>${esc(c.name)}</b> <span style="color:var(--ink-3)">${esc(c.kind)}</span><span class="addr">${esc(c.address)}</span>
          ${clientChips(c, s).replace('</div>', extra + '</div>') || (extra ? `<div class="chips">${extra}</div>` : '')}</span>
          ${isDispatcher ? `<span class="row-actions"><button class="icon-btn" data-edit="${c.id}" aria-label="Изменить">${svg('pencil')}</button><button class="icon-btn" data-del="${c.id}" aria-label="Удалить" style="color:var(--stop)">${svg('trash')}</button></span>` : ''}</div>`;
      }).join('')
    : `<div class="empty"><b>${q ? 'Ничего не найдено' : 'Клиентов пока нет'}</b>${q ? 'Измените запрос.' : 'Нажмите «+», чтобы добавить первого.'}</div>`;
}
$('c-search').addEventListener('input', renderClientsList);

$('btn-all').onclick = () => { document.querySelectorAll('#client-checks input:not(:disabled)').forEach((i) => (i.checked = true)); markStale(); };
$('btn-none').onclick = () => { document.querySelectorAll('#client-checks input').forEach((i) => (i.checked = false)); markStale(); };
$('client-checks').addEventListener('change', () => markStale());
$('view-plan').querySelector('details').addEventListener('change', () => markStale());
$('v-start').addEventListener('change', () => markStale());

// форма клиента (шторка)
function showNewPoint() {
  $('c-coords').textContent = newPoint ? `Точка выбрана${depot ? `, около ${Math.round(km(depot, newPoint))} км от склада по прямой` : ''}.` : '';
}
function resetClientForm() {
  editingId = null; newPoint = null; foundCands = [];
  for (const id of ['c-name', 'c-addr', 'c-from', 'c-to', 'c-phone']) $(id).value = '';
  $('c-unload').value = 15; setKind('ООО');
  $('c-coords').textContent = ''; $('c-msg').textContent = ''; $('c-candidates').classList.add('hidden');
  $('c-title').textContent = 'Новый клиент'; $('btn-add-client').textContent = 'Добавить';
}
function setKind(k) {
  $('c-kind').value = k;
  document.querySelectorAll('#c-kind-seg button').forEach((b) => b.classList.toggle('on', b.dataset.kind === k));
}
document.querySelectorAll('#c-kind-seg button').forEach((b) => (b.onclick = () => setKind(b.dataset.kind)));
$('btn-new-client').onclick = () => { resetClientForm(); openSheet('sheet-client'); };
$('btn-cancel-edit').onclick = () => closeSheet('sheet-client');

$('clients-list').addEventListener('click', async (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.edit) {
    const c = clients.find((x) => x.id === b.dataset.edit);
    resetClientForm();
    editingId = c.id;
    newPoint = c.lat != null ? { lat: c.lat, lng: c.lng } : null;
    $('c-name').value = c.name; setKind(c.kind); $('c-addr').value = c.address; $('c-unload').value = c.unload_minutes ?? 15;
    $('c-from').value = hm(parseHM(c.work_from)); $('c-to').value = hm(parseHM(c.work_to)); $('c-phone').value = c.phone || '';
    $('c-title').textContent = 'Редактирование клиента'; $('btn-add-client').textContent = 'Сохранить';
    $('c-msg').textContent = 'Чтобы изменить место, нажмите «Найти адрес» или «На карте».';
    showNewPoint(); openSheet('sheet-client');
  }
  if (b.dataset.del) {
    const c = clients.find((x) => x.id === b.dataset.del);
    if (!confirm(`Удалить клиента «${c.name}»? Сохранённые рейсы останутся.`)) return;
    const { error } = await sb.from('clients').delete().eq('id', c.id);
    if (error) return toast('Не удалось удалить: ' + error.message, { bad: true });
    toast('Клиент удалён');
    loadClients();
  }
});

let foundCands = [];
$('btn-find').onclick = async () => {
  try {
    foundCands = await geocode($('c-addr').value, depot);
    const sel = $('c-candidates');
    sel.innerHTML = '<option value="">Выберите адрес из списка</option>' + foundCands.map((c, i) => `<option value="${i}">${esc(candLabel(c))}</option>`).join('');
    sel.classList.toggle('hidden', !foundCands.length);
    $('c-coords').textContent = foundCands.length ? 'Выберите адрес. Если нужного нет, нажмите «На карте».' : 'Адрес не найден. Добавьте город или нажмите «На карте».';
    sel.onchange = () => { if (sel.value !== '') { newPoint = foundCands[Number(sel.value)]; showNewPoint(); } };
  } catch (e) { $('c-coords').textContent = e.message; }
};
$('btn-pick-new').onclick = () => pickPoint(newPoint, (ll) => { newPoint = ll; $('c-candidates').classList.add('hidden'); showNewPoint(); });

$('btn-add-client').onclick = async () => {
  const msg = (t) => { $('c-msg').textContent = t; $('c-msg').classList.add('err'); };
  $('c-msg').classList.remove('err');
  if (!$('c-name').value.trim() || !$('c-addr').value.trim()) return msg('Заполните название и адрес.');
  if (!newPoint) return msg('Нужна точка: нажмите «Найти адрес» или «На карте».');
  if (depot && km(depot, newPoint) > MAX_KM) return msg('Точка слишком далеко от склада. Проверьте её на карте.');
  const from = $('c-from').value, to = $('c-to').value;
  if (from && to && parseHM(from) >= parseHM(to)) return msg('Время «Принимает с» должно быть раньше «Принимает до».');
  const row = {
    name: $('c-name').value.trim(), kind: $('c-kind').value, address: $('c-addr').value.trim(),
    unload_minutes: Number($('c-unload').value) || 15, lat: newPoint.lat, lng: newPoint.lng,
    work_from: from || null, work_to: to || null, phone: $('c-phone').value.trim() || null,
  };
  const wasEdit = !!editingId;
  const { error } = wasEdit ? await sb.from('clients').update(row).eq('id', editingId) : await sb.from('clients').insert(row);
  if (error) return msg('Не сохранилось: ' + error.message + '. Клиентов меняет диспетчер; для окон и телефона нужен migration_3.sql.');
  closeSheet('sheet-client');
  toast(wasEdit ? 'Изменения сохранены' : 'Клиент добавлен');
  resetClientForm();
  loadClients(); markStale();
};

// ───────── панель действия (внизу) ─────────
const selectedIds = () => [...document.querySelectorAll('#client-checks input:checked')].map((i) => i.value);
function markStale() {
  if (ui.state === 'result') { ui.state = 'build'; $('result').classList.add('stale'); }
  else if (ui.state === 'saved') { ui.state = 'build'; $('result').classList.add('hidden'); }
  refreshCta();
}
function refreshCta() {
  const onPlan = ui.view === 'plan' && !!session;
  $('cta').classList.toggle('hidden', !onPlan);
  document.body.classList.toggle('has-cta', onPlan);
  if (!onPlan) return;
  const sec = $('btn-secondary'), main = $('btn-main');
  sec.classList.add('hidden'); main.disabled = false;
  if (ui.state === 'build') {
    const n = selectedIds().length;
    $('cta-title').textContent = String(n);
    $('cta-sub').textContent = plural(n, ['клиент', 'клиента', 'клиентов']);
    $('btn-main-label').textContent = 'Построить маршрут';
    setIcon($('btn-main-icon'), 'route');
    main.disabled = n === 0;
  } else if (ui.state === 'result' && lastResult) {
    const R = lastResult.cur.route;
    $('cta-title').textContent = hm(R.finish_min);
    $('cta-sub').textContent = R.return_to_depot ? 'возврат на склад' : 'конец рейса';
    $('btn-main-label').textContent = 'Начать рейс';
    setIcon($('btn-main-icon'), 'navigation');
    sec.classList.remove('hidden');
  } else if (ui.state === 'saved') {
    $('cta-title').textContent = `${ui.tripDone}/${ui.tripTotal}`;
    $('cta-sub').textContent = 'выполнено';
    $('btn-main-label').textContent = ui.tripStatus === 'done' ? 'Итоги рейса' : ui.tripDone > 0 ? 'Продолжить рейс' : 'Начать рейс';
    setIcon($('btn-main-icon'), 'navigation');
  }
}
$('btn-main').onclick = async () => {
  if (ui.state === 'build') return buildRoute();
  if (ui.state === 'result') { const id = await saveTrip(); if (id) openDrive(id); return; }
  if (ui.state === 'saved') return openDrive(ui.tripId);
};
$('btn-secondary').onclick = async () => {
  if (lastResult?.savedId) return toast('Рейс уже сохранён: он во вкладке «Рейсы».');
  const id = await saveTrip();
  if (id) toast('Рейс сохранён. Он во вкладке «Рейсы».');
};

// ───────── построение маршрута ─────────
const stopPayload = (c) => ({ id: c.id, name: c.name, lat: c.lat, lng: c.lng, from: parseHM(c.work_from), to: parseHM(c.work_to), unload: c.unload_minutes });

async function buildRoute(manualIds) {
  const ids = manualIds || selectedIds();
  if (!depot) return setMsg('Сначала задайте склад.', true);
  if (!ids.length) return setMsg('Отметьте клиентов на этот рейс.', true);
  setMsg('');
  const resultOpen = !$('result').classList.contains('hidden');
  if (manualIds) { $('tiles').classList.add('busy'); $('ordered').classList.add('busy'); }
  else { $('btn-main').disabled = true; $('btn-main-label').textContent = 'Считаю…'; }
  try {
    const st = manualIds ? lastResult.settings : settings();
    const stops = ids.map((id) => clients.find((c) => c.id === id)).filter(Boolean).map(stopPayload);
    const r = await fetch('/api/optimize', {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: 'Bearer ' + session.access_token },
      body: JSON.stringify({ depot, stops, settings: st, mode: manualIds ? 'manual' : 'auto', order: manualIds || undefined }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || 'Не удалось построить маршрут');
    if (manualIds) { lastResult = { ...lastResult, cur: d, manual: true, savedId: null }; }
    else { lastResult = { auto: d, cur: d, manual: false, savedId: null, depot, settings: st }; }
    ui.state = 'result';
    renderResult(d, { dep: depot, auto: lastResult.auto, manual: lastResult.manual });
    if (!manualIds) $('result').scrollIntoView({ behavior: 'smooth' });
  } catch (e) {
    setMsg(e.message, true);
    if (manualIds && resultOpen) { renderResult(lastResult.cur, { dep: depot, auto: lastResult.auto, manual: lastResult.manual }); toast('Не получилось пересчитать. Порядок возвращён.', { bad: true }); }
  }
  $('tiles').classList.remove('busy'); $('ordered').classList.remove('busy');
  refreshCta();
}

function renderResult(d, { dep, readonly = false, savedNote = '', auto = null, manual = false } = {}) {
  const R = d.route;
  $('result').classList.remove('hidden', 'stale');
  $('saved-note').classList.toggle('hidden', !savedNote);
  $('saved-note').innerHTML = savedNote ? `${svg('clipboard')}<span class="grow">${savedNote}</span>` : '';
  $('drag-hint').classList.toggle('hidden', readonly);
  $('ordered').classList.toggle('readonly', readonly);

  const h = Math.floor(R.duration_min / 60), m = R.duration_min % 60;
  $('tiles').innerHTML = `
    <div class="tile main"><small>${R.return_to_depot ? 'Вернётесь на склад' : 'Закончите рейс'}</small><div class="v">${hm(R.finish_min)}</div><small>выезд в ${hm(R.depart_min)}</small></div>
    <div class="tile"><small>В пути</small><div class="v">${h}<u>ч</u> ${pad(m)}<u>мин</u></div></div>
    <div class="tile"><small>Расстояние</small><div class="v">${R.distance_km}<u>км</u></div></div>
    <div class="tile"><small>Затраты</small><div class="v">${fmtNum(R.cost_rub)}<u>₽</u></div></div>`;

  // сравнение с расчётным порядком
  const rn = $('reorder-note');
  if (manual && auto && !readonly) {
    const dKm = Math.round((R.distance_km - auto.route.distance_km) * 10) / 10, dMin = R.duration_min - auto.route.duration_min;
    const worse = dKm > 0.05 || dMin > 0 || R.late_count > auto.route.late_count;
    const sg = (v) => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v);
    rn.className = 'note ' + (worse ? 'warn' : '');
    rn.innerHTML = `${svg('route')}<span class="grow"><b>Ваш порядок</b><br>${sg(dKm)} км и ${sg(dMin)} мин к расчётному${R.late_count > auto.route.late_count ? `, опозданий: ${R.late_count}` : ''}.</span><button class="btn sm ghost" id="btn-auto">Вернуть расчётный</button>`;
    $('btn-auto').onclick = () => { lastResult.cur = lastResult.auto; lastResult.manual = false; lastResult.savedId = null; renderResult(lastResult.auto, { dep, auto: lastResult.auto, manual: false }); refreshCta(); };
  } else rn.className = 'note hidden';

  // предупреждения
  let w = '';
  const late = d.stops.filter((s) => s.late_min > 0);
  if (late.length) w += `<div class="note bad">${svg('clock')}<span class="grow"><b>Не успеваете к окну приёмки</b><br>${late.map((s) => `${esc(s.name)}: опоздание ${s.late_min} мин`).join('<br>')}<br>Поменяйте порядок или выезжайте раньше.</span></div>`;
  if (d.warnings.length) {
    w += `<div class="card"><h2 style="margin-bottom:4px">На маршруте</h2>${d.warnings.map((x) => `<div class="client" style="padding:10px 0;border:0;cursor:default"><span class="plate sm ghost">${svg(HZ[x.type].icon)}</span><span class="grow"><b>${esc(x.title)}</b><span class="addr">${HZ[x.type].label}${x.toll_price_rub ? ', ' + fmtNum(x.toll_price_rub) + ' ₽' : ''}</span></span></div>`).join('')}</div>`;
  } else if (!readonly || d.warnings) {
    w += `<div class="note">${svg('check')}<span class="grow">Известных плохих дорог, весовых постов и платных участков на маршруте нет.</span></div>`;
  }
  $('warnings').innerHTML = w;

  // таймлайн
  const rows = d.stops.map((s) => {
    const addr = s.address ?? clients.find((c) => c.id === s.id)?.address ?? '';
    let chips = '';
    const wt = windowText(s.from, s.to);
    if (wt) chips += chip('window', 'clock', wt);
    if (s.wait_min > 0) chips += chip('wait', 'hourglass', `ждать ${s.wait_min} мин`);
    if (s.late_min > 0) chips += chip('late', 'alert', `опоздание ${s.late_min} мин`);
    if (s.done_at) chips += chip('ok', 'check', `выполнено в ${new Date(s.done_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`);
    return `<div class="tl-row stop ${s.late_min > 0 ? 'late' : ''}" data-id="${esc(s.id)}">
      <div class="tl-time">${hm(s.arrive_min)}</div>
      <span class="plate ${s.done_at ? 'done' : s.late_min > 0 ? 'late' : ''}">${s.seq}</span>
      <div class="tl-body"><b>${esc(s.name)}</b>${addr ? `<span class="sub">${esc(addr)}</span>` : ''}${chips ? `<div class="chips">${chips}</div>` : ''}</div>
      <div class="grip" aria-label="Перетащить">${svg('grip')}</div></div>`;
  }).join('');
  $('ordered').innerHTML = `
    <div class="tl-row first"><div class="tl-time">${hm(R.depart_min)}</div><span class="plate ghost">${svg('warehouse')}</span><div class="tl-body"><b>Выезд со склада</b></div><span></span></div>
    ${rows}
    <div class="tl-row last"><div class="tl-time">${hm(R.finish_min)}</div><span class="plate ghost">${svg('flag')}</span><div class="tl-body"><b>${R.return_to_depot ? 'Возврат на склад' : 'Конец рейса'}</b></div><span></span></div>`;

  const pts = [dep, ...d.stops.filter((s) => s.lat != null), ...(R.return_to_depot ? [dep] : [])];
  $('yandex').href = 'https://yandex.ru/maps/?rtt=auto&rtext=' + pts.map((p) => `${p.lat},${p.lng}`).join('~');
  drawMap(d, dep);
}

function drawMap(d, dep) {
  if (!map) {
    map = L.map('map');
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(map);
    mapLayer = L.layerGroup().addTo(map);
  }
  mapLayer.clearLayers();
  const cs = getComputedStyle(document.documentElement);
  const withCoords = d.stops.filter((s) => s.lat != null);
  const coords = d.route.geometry && d.route.geometry.length ? d.route.geometry.map(([x, y]) => [y, x]) : [dep, ...withCoords].map((p) => [p.lat, p.lng]);
  L.polyline(coords, { weight: 10, color: cs.getPropertyValue('--casing').trim() || '#fff', opacity: 0.9 }).addTo(mapLayer);
  const line = L.polyline(coords, { weight: 5, color: cs.getPropertyValue('--route').trim() || '#0B4FC4' }).addTo(mapLayer);
  const icon = (cls, inner) => L.divIcon({ className: '', html: `<div class="pin ${cls}">${inner}</div>`, iconSize: [30, 30], iconAnchor: [15, 15] });
  L.marker([dep.lat, dep.lng], { icon: icon('depot', svg('warehouse')) }).addTo(mapLayer);
  withCoords.forEach((s) => L.marker([s.lat, s.lng], { icon: icon('', s.seq) }).bindPopup(esc(s.name)).addTo(mapLayer));
  d.warnings.forEach((x) => L.marker([x.lat, x.lng], { icon: icon('haz', svg(HZ[x.type].icon)) }).bindPopup(esc(x.title)).addTo(mapLayer));
  map.fitBounds(line.getBounds(), { padding: [28, 28] });
  setTimeout(() => map.invalidateSize(), 60);
}

// ───────── перетаскивание порядка ─────────
(function initDrag() {
  const box = $('ordered');
  let drag = null;
  const renumber = () => box.querySelectorAll('.tl-row.stop .plate').forEach((p, i) => (p.textContent = i + 1));
  box.addEventListener('pointerdown', (e) => {
    if (box.classList.contains('readonly')) return;
    const grip = e.target.closest('.grip');
    const row = grip && grip.closest('.tl-row.stop');
    if (!row) return;
    e.preventDefault();
    grip.setPointerCapture(e.pointerId);
    drag = { row, grip, startY: e.clientY, pid: e.pointerId, moved: false, before: [...box.querySelectorAll('.tl-row.stop')].map((r) => r.dataset.id).join('|') };
    row.classList.add('dragging');
    vibrate(10);
  });
  box.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.pid) return;
    if (e.clientY < 110) window.scrollBy(0, -14); else if (e.clientY > window.innerHeight - 190) window.scrollBy(0, 14);
    const rows = [...box.querySelectorAll('.tl-row.stop')];
    const i = rows.indexOf(drag.row);
    const rect = drag.row.getBoundingClientRect();
    const mid = rect.top + rect.height / 2;
    const prev = rows[i - 1], next = rows[i + 1];
    if (prev) { const pr = prev.getBoundingClientRect(); if (mid < pr.top + pr.height / 2) { box.insertBefore(drag.row, prev); drag.startY -= pr.height; drag.moved = true; renumber(); } }
    if (next) { const nr = next.getBoundingClientRect(); if (mid > nr.top + nr.height / 2) { box.insertBefore(next, drag.row); drag.startY += nr.height; drag.moved = true; renumber(); } }
    drag.row.style.transform = `translateY(${e.clientY - drag.startY}px) scale(1.02)`;
  });
  const end = (e) => {
    if (!drag || e.pointerId !== drag.pid) return;
    const d = drag; drag = null;
    d.row.style.transform = ''; d.row.classList.remove('dragging');
    const after = [...box.querySelectorAll('.tl-row.stop')].map((r) => r.dataset.id);
    if (d.moved && after.join('|') !== d.before) buildRoute(after);
  };
  box.addEventListener('pointerup', end);
  box.addEventListener('pointercancel', end);
})();

// ───────── сохранение рейса ─────────
async function saveTrip() {
  if (!lastResult) return null;
  if (lastResult.savedId) return lastResult.savedId;
  const d = lastResult.cur;
  const round = (v) => Math.round(v * 1e5) / 1e5;
  const route = { ...d.route, geometry: (d.route.geometry || []).map(([x, y]) => [round(x), round(y)]) };
  const { data, error } = await sb.from('trip_plans')
    .insert({ plan_date: $('trip-date').value || tomorrow(), depot: lastResult.depot, settings: lastResult.settings, result: { route, warnings: d.warnings } })
    .select().single();
  if (error) { toast('Не удалось сохранить рейс: ' + error.message, { bad: true }); return null; }
  const rows = d.stops.map((s) => {
    const c = clients.find((x) => x.id === s.id);
    return {
      plan_id: data.id, client_id: s.id, seq: s.seq, name: s.name, address: c?.address ?? null, phone: c?.phone ?? null,
      lat: s.lat, lng: s.lng, work_from: s.from != null ? hm(s.from) : null, work_to: s.to != null ? hm(s.to) : null,
      unload_min: s.unload, eta_min: s.arrive_min, wait_min: s.wait_min, late_min: s.late_min,
    };
  });
  const { error: e2 } = await sb.from('trip_stops').insert(rows);
  if (e2) {
    await sb.from('trip_plans').delete().eq('id', data.id);
    toast('Не удалось сохранить точки рейса: ' + e2.message + '. Выполнен ли migration_3.sql?', { bad: true });
    return null;
  }
  lastResult.savedId = data.id;
  return data.id;
}

// ───────── список рейсов ─────────
async function loadTrips() {
  if (!sb || !session) return;
  $('trips-list').innerHTML = '<div class="skeleton"></div><div class="skeleton"></div>';
  const { data, error } = await sb.from('trip_plans')
    .select('id, plan_date, driver_id, status, result, trip_stops(done_at)')
    .order('plan_date', { ascending: false }).order('created_at', { ascending: false }).limit(50);
  if (error) { $('trips-list').innerHTML = `<div class="empty">${esc(error.message)}</div>`; return; }
  trips = data;
  $('trips-list').innerHTML = trips.length ? trips.map((t) => {
    const r = t.result?.route || {};
    const total = t.trip_stops?.length || 0, done = (t.trip_stops || []).filter((x) => x.done_at).length;
    const mins = r.duration_min ? `${Math.floor(r.duration_min / 60)} ч ${pad(r.duration_min % 60)} мин` : '';
    const badge = t.status === 'done' ? chip('ok', 'check', 'завершён') : t.status === 'in_progress' ? chip('window', 'navigation', `в пути ${done}/${total}`) : '';
    return `<div class="trip"><span class="grow"><div class="d">${fmtDate(t.plan_date)}</div>
      <div style="color:var(--ink-3);font-size:14px">${total} ${plural(total, ['точка', 'точки', 'точек'])} · ${r.distance_km ?? '?'} км${mins ? ' · ' + mins : ''}${t.driver_id === session.user.id ? '' : ' · другой водитель'}</div>
      ${badge ? `<div class="chips">${badge}</div>` : ''}${t.status === 'in_progress' ? `<div class="bar-progress"><i style="width:${total ? (done / total) * 100 : 0}%"></i></div>` : ''}</span>
      <button class="btn sm ${t.status === 'in_progress' ? 'primary' : 'sign'}" data-open="${t.id}">${t.status === 'in_progress' ? 'Продолжить' : 'Открыть'}</button>
      <button class="icon-btn" data-trip-del="${t.id}" aria-label="Удалить рейс" style="color:var(--stop)">${svg('trash')}</button></div>`;
  }).join('') : '<div class="empty"><b>Рейсов пока нет</b>Постройте маршрут и нажмите «Начать рейс» или «Сохранить».</div>';
}
$('trips-list').addEventListener('click', async (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.tripDel) {
    if (!confirm('Удалить этот рейс?')) return;
    const { error } = await sb.from('trip_plans').delete().eq('id', b.dataset.tripDel);
    if (error) return toast('Не удалось удалить: ' + error.message, { bad: true });
    loadTrips();
  }
  if (b.dataset.open) openTripView(b.dataset.open);
});

async function openTripView(id) {
  const t = trips.find((x) => x.id === id);
  const { data: rows, error } = await sb.from('trip_stops').select('*').eq('plan_id', id).order('seq');
  if (error) return toast('Не удалось открыть рейс: ' + error.message, { bad: true });
  const stops = rows.map((s) => {
    const c = clients.find((x) => x.id === s.client_id);
    return {
      seq: s.seq, id: s.client_id ?? 'x' + s.seq, name: s.name ?? c?.name ?? 'Клиент удалён', address: s.address ?? c?.address ?? '',
      lat: s.lat ?? c?.lat ?? null, lng: s.lng ?? c?.lng ?? null, from: parseHM(s.work_from), to: parseHM(s.work_to), unload: s.unload_min,
      arrive_min: s.eta_min ?? 0, wait_min: s.wait_min ?? 0, late_min: s.late_min ?? 0, done_at: s.done_at,
    };
  });
  const route = t.result?.route || {};
  route.depart_min ??= t.settings?.startMin ?? 480; route.finish_min ??= route.depart_min; route.return_to_depot ??= t.settings?.returnToDepot !== false;
  route.late_count ??= stops.filter((s) => s.late_min > 0).length; route.duration_min ??= 0; route.distance_km ??= 0; route.cost_rub ??= 0;
  ui.state = 'saved'; ui.tripId = id; ui.tripStatus = t.status;
  ui.tripTotal = stops.length; ui.tripDone = stops.filter((s) => s.done_at).length;
  show('plan');
  $('plan-title').textContent = `Рейс на ${fmtDay(t.plan_date)}`;
  renderResult({ stops, route, warnings: t.result?.warnings || [] }, { dep: t.depot, readonly: true, savedNote: `<b>Сохранённый рейс</b><br>Выполнено ${ui.tripDone} из ${ui.tripTotal}.` });
  refreshCta();
  $('result').scrollIntoView({ behavior: 'smooth' });
}
$('trip-date').addEventListener('change', () => { if (ui.state === 'saved') updatePlanTitle(); });

async function loadResume() {
  const box = $('resume');
  box.classList.add('hidden');
  if (!sb || !session || drive) return;
  const { data } = await sb.from('trip_plans').select('id, plan_date, trip_stops(done_at)')
    .eq('status', 'in_progress').eq('driver_id', session.user.id).order('created_at', { ascending: false }).limit(1);
  const t = data && data[0];
  if (!t) return;
  const total = t.trip_stops.length, done = t.trip_stops.filter((x) => x.done_at).length;
  box.className = 'note warn';
  box.innerHTML = `${svg('navigation')}<span class="grow"><b>Рейс на ${fmtDay(t.plan_date)} не завершён</b><br>Выполнено ${done} из ${total}.</span><button class="btn sm primary" data-resume="${t.id}">Продолжить</button>`;
}
$('resume').addEventListener('click', (e) => { const b = e.target.closest('[data-resume]'); if (b) openDrive(b.dataset.resume); });

// ───────── режим «Еду» ─────────
async function setPlanStatus(status, extra = {}) {
  const { error } = await sb.from('trip_plans').update({ status, ...extra }).eq('id', drive.plan.id);
  if (!error) { drive.plan.status = status; Object.assign(drive.plan, extra); }
  return !error;
}
async function openDrive(planId) {
  const { data: plan, error } = await sb.from('trip_plans').select('*').eq('id', planId).single();
  if (error) return toast('Не удалось открыть рейс: ' + error.message, { bad: true });
  const { data: rows, error: e2 } = await sb.from('trip_stops').select('*').eq('plan_id', planId).order('seq');
  if (e2) return toast('Не удалось открыть точки рейса: ' + e2.message, { bad: true });
  drive = { plan, stops: rows };
  if (plan.status === 'planned') await setPlanStatus('in_progress', { started_at: new Date().toISOString() });
  $('drive').classList.remove('hidden');
  syncLock();
  renderDrive();
}
function currentStop() {
  const pending = drive.stops.filter((s) => !s.done_at);
  const fresh = pending.filter((s) => !s.skipped_at);
  return fresh[0] || [...pending].sort((a, b) => new Date(a.skipped_at) - new Date(b.skipped_at))[0] || null;
}
function renderDrive() {
  const stops = drive.stops, total = stops.length, done = stops.filter((s) => s.done_at).length;
  const cur = currentStop();
  const finished = drive.plan.status === 'done' || !cur;
  $('drive-segs').innerHTML = stops.map((s) => `<i class="${s.done_at ? 'done' : !finished && cur && s.seq === cur.seq ? 'cur' : ''}"></i>`).join('');
  $('drive-count').textContent = `${done}/${total}`;
  const body = $('drive-body'), act = $('drive-actions');

  if (finished) {
    const t0 = drive.plan.started_at ? new Date(drive.plan.started_at) : null;
    const t1 = drive.plan.finished_at ? new Date(drive.plan.finished_at) : new Date();
    const mins = t0 ? Math.max(1, Math.round((t1 - t0) / 60000)) : null;
    const skipped = total - done;
    body.innerHTML = `<div class="finish"><div class="big-plate">${svg('check')}</div><h1>Рейс завершён</h1>
      <div class="stat-row"><div><small>Выполнено</small><div class="num">${done} из ${total}</div></div><div><small>${mins ? 'Время рейса' : 'Не выполнено'}</small><div class="num">${mins ? `${Math.floor(mins / 60)} ч ${pad(mins % 60)} мин` : skipped}</div></div></div>
      ${skipped && mins ? `<p style="opacity:.85;margin:14px 0 0">Не выполнено: ${skipped}</p>` : ''}</div>`;
    act.innerHTML = `<div class="drive-actions"><button id="drive-exit" class="btn primary">Закрыть</button></div>`;
    paintIcons(body);
    if (drive.plan.status !== 'done' && !cur) setPlanStatus('done', { finished_at: new Date().toISOString() });
    $('drive-exit').onclick = closeDrive;
    return;
  }

  const pendingAfter = stops.filter((s) => !s.done_at && s.seq !== cur.seq);
  const nxt = pendingAfter.filter((s) => !s.skipped_at).slice(0, 2);
  let chips = '';
  const wt = windowText(parseHM(cur.work_from), parseHM(cur.work_to));
  if (wt) chips += chip('', 'clock', 'принимает ' + wt);
  if (cur.wait_min > 0) chips += chip('wait', 'hourglass', `ждать ${cur.wait_min} мин`);
  if (cur.late_min > 0) chips += chip('late', 'alert', `опоздание ${cur.late_min} мин`);
  if (cur.skipped_at) chips += chip('', 'skip', 'вы пропустили его раньше');
  const nav = `https://yandex.ru/maps/?rtext=~${cur.lat},${cur.lng}&rtt=auto`;
  body.innerHTML = `
    <div class="who"><div class="big-plate">${cur.seq}</div><div class="grow"><h1>${esc(cur.name)}</h1><div class="addr">${esc(cur.address || '')}</div></div></div>
    <div class="eta"><div><small>Плановое прибытие</small><div class="t">${hm(cur.eta_min)}</div></div></div>
    ${chips ? `<div class="chips">${chips}</div>` : ''}
    ${nxt.length ? `<div class="next"><span>Дальше</span>${nxt.map((s) => `<b>${s.seq}. ${esc(s.name)}</b>`).join('')}</div>` : ''}
    <div class="contact-row">${cur.phone ? `<a class="btn" href="tel:${esc(cur.phone.replace(/[^+\d]/g, ''))}">${svg('phone')}Позвонить</a>` : ''}<a class="btn ${cur.phone ? '' : 'solo'}" href="${nav}" target="_blank" rel="noopener">${svg('navigation')}Навигатор</a></div>`;
  act.innerHTML = `
    <div class="drive-actions"><button id="drive-alert" class="btn alert" aria-label="Проблема на дороге">${svg('alert')}</button><button id="drive-done" class="btn primary">${svg('check')}Готово</button></div>
    <div class="drive-sub"><button id="drive-skip" ${pendingAfter.length ? '' : 'disabled style="opacity:.35"'}>${svg('skip')}Пропустить пока</button><button id="drive-finish">${svg('flagcheck')}Завершить рейс</button></div>`;
  $('drive-alert').onclick = () => openSheet('sheet-report');
  $('drive-done').onclick = driveDone;
  $('drive-skip').onclick = driveSkip;
  $('drive-finish').onclick = driveFinish;
}
async function driveDone() {
  const s = currentStop();
  if (!s) return;
  $('drive-done').disabled = true;
  const now = new Date().toISOString();
  const { error } = await sb.from('trip_stops').update({ done_at: now, skipped_at: null }).eq('plan_id', drive.plan.id).eq('seq', s.seq);
  if (error) { renderDrive(); return toast('Отметка не сохранилась. Проверьте связь и нажмите ещё раз.', { bad: true }); }
  const wasSkipped = s.skipped_at;
  s.done_at = now; s.skipped_at = null;
  vibrate(35);
  if (!drive.stops.some((x) => !x.done_at)) await setPlanStatus('done', { finished_at: now });
  renderDrive();
  toast(`Готово: ${s.name}`, {
    undo: async () => {
      const { error: er } = await sb.from('trip_stops').update({ done_at: null, skipped_at: wasSkipped }).eq('plan_id', drive.plan.id).eq('seq', s.seq);
      if (er) return toast('Не удалось отменить: ' + er.message, { bad: true });
      s.done_at = null; s.skipped_at = wasSkipped;
      if (drive.plan.status === 'done') await setPlanStatus('in_progress', { finished_at: null });
      renderDrive();
    },
  });
}
async function driveSkip() {
  const s = currentStop();
  if (!s) return;
  const now = new Date().toISOString();
  const { error } = await sb.from('trip_stops').update({ skipped_at: now }).eq('plan_id', drive.plan.id).eq('seq', s.seq);
  if (error) return toast('Не удалось пропустить: ' + error.message, { bad: true });
  s.skipped_at = now;
  vibrate(20);
  renderDrive();
}
async function driveFinish() {
  const left = drive.stops.filter((s) => !s.done_at).length;
  if (!confirm(left ? `Завершить рейс? Не выполнено: ${left}.` : 'Завершить рейс?')) return;
  if (await setPlanStatus('done', { finished_at: new Date().toISOString() })) renderDrive();
  else toast('Не удалось завершить рейс. Проверьте связь.', { bad: true });
}
function closeDrive() {
  $('drive').classList.add('hidden');
  closeSheet('sheet-report');
  syncLock();
  drive = null;
  show('trips');
}
$('drive-close').onclick = closeDrive;

// ───────── проблема на дороге: один тап ─────────
$('btn-report').onclick = () => { $('report-msg').textContent = 'Отметка встанет на место, где вы сейчас находитесь.'; openSheet('sheet-report'); };
$('btn-report-close').onclick = () => closeSheet('sheet-report');
document.querySelectorAll('#sheet-report .tile-btn').forEach((b) => (b.onclick = () => reportHazard(b.dataset.type)));

async function reportHazard(type) {
  const tiles = document.querySelectorAll('#sheet-report .tile-btn');
  tiles.forEach((t) => (t.disabled = true));
  $('report-msg').textContent = 'Определяю место…';
  try {
    const pos = await getPosition();
    const near = hazards.find((h) => h.type === type && km(h, pos) * 1000 < 120);
    closeSheet('sheet-report');
    if (near) {
      await sb.rpc('confirm_hazard', { hid: near.id });
      toast(`Это место уже отмечено. Подтвердили: ${HZ[type].label.toLowerCase()}`);
    } else {
      const { data, error } = await sb.from('hazards').insert({ type, title: HZ[type].label, lat: pos.lat, lng: pos.lng }).select().single();
      if (error) throw new Error('Не удалось сохранить отметку: ' + error.message);
      vibrate(30);
      toast(`Отмечено: ${HZ[type].label.toLowerCase()}`, { undo: async () => { await sb.from('hazards').delete().eq('id', data.id); loadHazards(); toast('Отметка удалена'); } });
    }
    loadHazards();
  } catch (e) {
    $('report-msg').textContent = e.message;
  }
  tiles.forEach((t) => (t.disabled = false));
}

// ───────── список и карта опасных точек ─────────
async function loadHazards() {
  if (!sb || !session) return;
  const { data } = await sb.from('hazards').select('*').eq('active', true).order('created_at', { ascending: false });
  hazards = data || [];
  $('hazards-list').innerHTML = hazards.length ? hazards.map((h) => {
    const mine = h.created_by === session.user.id;
    return `<div class="client" style="cursor:default"><span class="plate sm ghost">${svg(HZ[h.type].icon)}</span>
      <span class="grow"><b>${esc(h.title)}</b><span class="addr">${HZ[h.type].label} · подтверждений: ${h.confirmations}${h.toll_price_rub ? ' · ' + fmtNum(h.toll_price_rub) + ' ₽' : ''}</span></span>
      <button class="btn sm ghost" data-confirm="${h.id}">+1</button>
      ${isDispatcher || mine ? `<button class="icon-btn" data-hdel="${h.id}" aria-label="Удалить" style="color:var(--stop)">${svg('trash')}</button>` : ''}</div>`;
  }).join('') : '<div class="empty"><b>Отметок пока нет</b>Нажмите «Отметить проблему здесь», когда увидите яму или весовой пост.</div>';
  drawHazardMarkers();
}
$('hazards-list').addEventListener('click', async (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.confirm) { await sb.rpc('confirm_hazard', { hid: b.dataset.confirm }); loadHazards(); }
  if (b.dataset.hdel) {
    if (!confirm('Удалить отметку?')) return;
    const { error } = await sb.from('hazards').delete().eq('id', b.dataset.hdel);
    if (error) toast('Не удалось удалить: ' + error.message, { bad: true });
    loadHazards();
  }
});
function initHazardMap() {
  if (!mapH) {
    const c = depot || DEFAULT_CENTER;
    mapH = L.map('map-h').setView([c.lat, c.lng], depot ? 11 : 9);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(mapH);
    mapHLayer = L.layerGroup().addTo(mapH);
    mapH.on('click', (e) => {
      pendingHazard = e.latlng;
      if (pendingMarker) pendingMarker.remove();
      pendingMarker = L.marker(e.latlng).addTo(mapH);
      $('btn-add-hazard').disabled = false;
      $('btn-add-hazard').textContent = 'Добавить отметку здесь';
    });
  }
  setTimeout(() => mapH.invalidateSize(), 60);
  drawHazardMarkers();
}
function drawHazardMarkers() {
  if (!mapHLayer) return;
  mapHLayer.clearLayers();
  hazards.forEach((h) => L.marker([h.lat, h.lng], { icon: L.divIcon({ className: '', html: `<div class="pin haz">${svg(HZ[h.type].icon)}</div>`, iconSize: [30, 30], iconAnchor: [15, 15] }) }).bindPopup(`${esc(h.title)}`).addTo(mapHLayer));
}
$('btn-add-hazard').onclick = async () => {
  if (!pendingHazard) return;
  const type = $('h-type').value;
  const { error } = await sb.from('hazards').insert({
    type, title: $('h-title').value.trim() || HZ[type].label, lat: pendingHazard.lat, lng: pendingHazard.lng,
    toll_price_rub: type === 'toll' ? Number($('h-price').value) || null : null,
  });
  $('h-msg').textContent = error ? 'Не удалось сохранить: ' + error.message : 'Отметка сохранена.';
  $('h-msg').classList.toggle('err', !!error);
  if (!error) { pendingHazard = null; pendingMarker?.remove(); $('btn-add-hazard').disabled = true; $('btn-add-hazard').textContent = 'Сначала нажмите на карту'; $('h-title').value = ''; loadHazards(); }
};

// запуск — в самом конце, когда всё объявлено
init();
