/* global L, supabase */
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const TYPE = { bad_road: ['🕳️', 'Плохая дорога'], weigh_post: ['⚖️', 'Весовой контроль'], toll: ['💰', 'Платный участок'] };
const MAX_KM = 600;
const DEFAULT_CENTER = { lat: 54.74, lng: 55.97 }; // если склад ещё не задан

let sb, session, clients = [], hazards = [], trips = [], depot = null, lastResult = null, pendingHazard = null, newPoint = null;
let isDispatcher = false, editingId = null;

function tomorrow() {
  const d = new Date(); d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const fmtDate = (s) => new Date(s + 'T00:00:00').toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'long' });
let map, mapLayer, mapH, mapHLayer, pendingMarker, installEvent;

function km(a, b) {
  const R = 6371, r = Math.PI / 180;
  const h = Math.sin(((b.lat - a.lat) * r) / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(((b.lng - a.lng) * r) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// ---------- установка на телефон ----------
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvent = e; $('btn-install').classList.remove('hidden'); });
$('btn-install').onclick = async () => { if (!installEvent) return; installEvent.prompt(); await installEvent.userChoice; installEvent = null; $('btn-install').classList.add('hidden'); };

// ---------- старт ----------
(async function init() {
  let cfg;
  try { cfg = await (await fetch('/api/config')).json(); } catch { cfg = {}; }
  if (!cfg.supabaseUrl) { document.body.innerHTML = '<p style="padding:16px">Не заданы SUPABASE_URL / SUPABASE_ANON_KEY в Netlify.</p>'; return; }
  sb = supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
  const { data } = await sb.auth.getSession();
  session = data.session;
  sb.auth.onAuthStateChange((_e, s) => { const was = !!session; session = s; if (was !== !!s) render(); });
  try { depot = JSON.parse(localStorage.getItem('depot')); } catch { depot = null; }
  const saved = JSON.parse(localStorage.getItem('settings') || '{}');
  for (const [k, v] of Object.entries(saved)) if ($(k)) $(k).value = v;
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
  render();
})();

function show(view) {
  for (const v of ['login', 'plan', 'trips', 'clients', 'hazards']) $('view-' + v).classList.toggle('hidden', v !== view);
  document.querySelectorAll('nav [data-v]').forEach((b) => b.classList.toggle('active', b.dataset.v === view));
  if (view === 'hazards') initHazardMap();
  if (view === 'trips') loadTrips();
  window.scrollTo(0, 0);
}

async function render() {
  const logged = !!session;
  $('nav').classList.toggle('hidden', !logged);
  $('btn-logout').classList.toggle('hidden', !logged);
  if (!logged) return show('login');
  $('trip-date').value = tomorrow();
  await loadRole();
  show('plan');
  showDepot();
  await Promise.all([loadClients(), loadHazards()]);
}

async function loadRole() {
  const { data } = await sb.from('profiles').select('role').eq('id', session.user.id).maybeSingle();
  isDispatcher = data?.role === 'dispatcher';
  $('client-form').classList.toggle('hidden', !isDispatcher);
  $('c-nodisp').classList.toggle('hidden', isDispatcher);
}

function showDepot() {
  $('depot-info').innerHTML = depot ? `📍 ${esc(depot.name)}` : 'Склад не задан';
  const edit = !depot;
  $('depot-edit').classList.toggle('hidden', !edit);
  $('depot-view').classList.toggle('hidden', edit);
}

// ---------- вход ----------
$('btn-login').onclick = async () => {
  const { error } = await sb.auth.signInWithPassword({ email: $('email').value, password: $('password').value });
  $('login-msg').textContent = error ? 'Ошибка: ' + error.message : '';
};
$('btn-signup').onclick = async () => {
  const { error } = await sb.auth.signUp({ email: $('email').value, password: $('password').value });
  $('login-msg').textContent = error ? 'Ошибка: ' + error.message : 'Готово. Если включено подтверждение — проверьте почту.';
};
$('btn-logout').onclick = () => sb.auth.signOut();
document.querySelectorAll('nav [data-v]').forEach((b) => (b.onclick = () => show(b.dataset.v)));

// ---------- выбор точки на карте ----------
let pickMap, pickMarker, pickLatLng, pickCb;
function pickPoint(start, cb) {
  pickCb = cb; pickLatLng = null;
  $('pick').classList.remove('hidden');
  $('pick-ok').disabled = true;
  if (!pickMap) {
    pickMap = L.map('pick-map');
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(pickMap);
    pickMap.on('click', (e) => setPick(e.latlng));
  }
  if (pickMarker) { pickMarker.remove(); pickMarker = null; }
  const c = start || depot || DEFAULT_CENTER;
  pickMap.setView([c.lat, c.lng], start ? 16 : depot ? 12 : 9);
  if (start) setPick({ lat: start.lat, lng: start.lng });
  setTimeout(() => pickMap.invalidateSize(), 50);
}
function setPick(ll) {
  pickLatLng = { lat: ll.lat, lng: ll.lng };
  if (pickMarker) pickMarker.setLatLng(ll); else pickMarker = L.marker(ll).addTo(pickMap);
  $('pick-ok').disabled = false;
  $('pick-hint').textContent = depot ? `Выбрано. От склада по прямой: ${Math.round(km(depot, pickLatLng))} км` : 'Выбрано';
}
$('pick-gps').onclick = () => {
  if (!navigator.geolocation) return ($('pick-hint').textContent = 'Телефон не отдаёт местоположение');
  navigator.geolocation.getCurrentPosition(
    (p) => { const ll = { lat: p.coords.latitude, lng: p.coords.longitude }; pickMap.setView([ll.lat, ll.lng], 17); setPick(ll); },
    () => ($('pick-hint').textContent = 'Нет доступа к местоположению. Разрешите его в настройках браузера.'),
    { enableHighAccuracy: true, timeout: 15000 }
  );
};
$('pick-cancel').onclick = () => $('pick').classList.add('hidden');
$('pick-ok').onclick = () => { $('pick').classList.add('hidden'); if (pickLatLng && pickCb) pickCb(pickLatLng); };

// ---------- геокодер ----------
async function geocode(text) {
  const q = new URLSearchParams({ text });
  if (depot) { q.set('lat', depot.lat); q.set('lng', depot.lng); }
  const r = await fetch('/api/geocode?' + q);
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || 'Ошибка геокодера');
  return d.results;
}
const candLabel = (c) => `${c.label}${c.dist_km != null ? ` — ${c.dist_km} км от склада` : ''}`;

// склад
let depotCands = [];
$('btn-depot-edit').onclick = () => { $('depot-edit').classList.remove('hidden'); $('depot-view').classList.add('hidden'); $('depot-text').value = depot?.name || ''; };
function setDepot(p, name) {
  depot = { name, lat: p.lat, lng: p.lng };
  localStorage.setItem('depot', JSON.stringify(depot));
  $('depot-cands').classList.add('hidden');
  showDepot(); loadClients();
}
$('btn-depot').onclick = async () => {
  try {
    const old = depot; depot = null; // при поиске склада не ограничиваем регион
    depotCands = await geocode($('depot-text').value);
    depot = old;
    if (!depotCands.length) return ($('depot-info').textContent = 'Адрес не найден. Уточните или отметьте на карте.');
    const sel = $('depot-cands');
    sel.innerHTML = '<option value="">— выберите вариант —</option>' + depotCands.map((c, i) => `<option value="${i}">${esc(c.label)}</option>`).join('');
    sel.classList.remove('hidden');
    sel.onchange = () => { if (sel.value !== '') { const c = depotCands[Number(sel.value)]; setDepot(c, c.label); } };
  } catch (e) { $('depot-info').textContent = e.message; }
};
$('btn-depot-pick').onclick = () => pickPoint(depot, (ll) => setDepot(ll, $('depot-text').value || `Склад (${ll.lat.toFixed(4)}, ${ll.lng.toFixed(4)})`));

// ---------- клиенты ----------
function clientStatus(c) {
  if (c.lat == null) return { ok: false, text: 'нет точки на карте' };
  if (depot && km(depot, c) > MAX_KM) return { ok: false, text: 'точка слишком далеко от склада — исправьте' };
  return { ok: true, text: '' };
}

async function loadClients() {
  if (!sb || !session) return;
  const { data, error } = await sb.from('clients').select('*').order('name');
  if (error) { $('client-checks').textContent = error.message; return; }
  clients = data;
  const checked = new Set([...document.querySelectorAll('#client-checks input:checked')].map((i) => i.value));
  $('client-checks').innerHTML = clients.length
    ? clients.map((c) => { const s = clientStatus(c);
        return `<label class="chk"><input type="checkbox" value="${c.id}" ${s.ok ? '' : 'disabled'} ${checked.has(c.id) ? 'checked' : ''}>
        <span class="grow"><b>${esc(c.name)}</b> <span class="muted">${esc(c.kind)}</span><br><span class="muted">${esc(c.address)}</span>${s.ok ? '' : `<br><span class="bad">⚠️ ${s.text}</span>`}</span></label>`; }).join('')
    : 'Клиентов пока нет — добавьте на вкладке «Клиенты».';
  $('clients-list').innerHTML = clients.length ? clients.map((c) => { const s = clientStatus(c);
    return `<div class="stop"><span class="grow"><b>${esc(c.name)}</b> <span class="muted">${esc(c.kind)}</span><br><span class="muted">${esc(c.address)}</span>${s.ok ? '' : `<br><span class="bad">⚠️ ${s.text}</span>`}</span>
      ${isDispatcher ? `<span style="display:flex;gap:6px"><button class="ghost small" data-fix="${c.id}">📍</button><button class="ghost small" data-edit="${c.id}">✏️</button><button class="ghost small bad" data-del="${c.id}">🗑</button></span>` : ''}</div>`; }).join('') : '<span class="muted">Пока никого</span>';
  document.querySelectorAll('[data-fix]').forEach((b) => (b.onclick = () => {
    const c = clients.find((x) => x.id === b.dataset.fix);
    pickPoint(c.lat != null && (!depot || km(depot, c) <= MAX_KM) ? { lat: c.lat, lng: c.lng } : null, async (ll) => {
      const { error: err } = await sb.from('clients').update({ lat: ll.lat, lng: ll.lng }).eq('id', c.id);
      $('c-msg').textContent = err ? 'Ошибка: ' + err.message + ' (менять клиентов может диспетчер)' : 'Точка обновлена';
      loadClients();
    });
  }));
}
function resetClientForm() {
  editingId = null; newPoint = null; foundCands = [];
  $('c-name').value = ''; $('c-addr').value = ''; $('c-unload').value = 15;
  $('c-coords').textContent = ''; $('c-candidates').classList.add('hidden');
  $('c-title').textContent = 'Новый клиент';
  $('btn-add-client').textContent = 'Добавить клиента';
  $('btn-cancel-edit').classList.add('hidden');
}
$('btn-cancel-edit').onclick = () => { resetClientForm(); $('c-msg').textContent = ''; };

// правка и удаление клиентов (кнопки ✏️ и 🗑 видит только диспетчер)
$('clients-list').addEventListener('click', async (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.edit) {
    const c = clients.find((x) => x.id === b.dataset.edit);
    editingId = c.id;
    newPoint = c.lat != null ? { lat: c.lat, lng: c.lng } : null;
    $('c-name').value = c.name; $('c-kind').value = c.kind; $('c-addr').value = c.address; $('c-unload').value = c.unload_minutes ?? 15;
    $('c-title').textContent = 'Редактирование клиента';
    $('btn-add-client').textContent = 'Сохранить изменения';
    $('btn-cancel-edit').classList.remove('hidden');
    $('c-candidates').classList.add('hidden');
    $('c-msg').textContent = 'Чтобы изменить место, нажмите «Найти адрес» или «Указать на карте».';
    showNewPoint();
    $('client-form').scrollIntoView({ behavior: 'smooth' });
  }
  if (b.dataset.del) {
    const c = clients.find((x) => x.id === b.dataset.del);
    if (!confirm(`Удалить клиента «${c.name}»? Уже сохранённые рейсы останутся.`)) return;
    const { error } = await sb.from('clients').delete().eq('id', c.id);
    $('c-msg').textContent = error ? 'Ошибка: ' + error.message : 'Клиент удалён';
    if (editingId === c.id) resetClientForm();
    loadClients();
  }
});

$('btn-all').onclick = () => document.querySelectorAll('#client-checks input:not(:disabled)').forEach((i) => (i.checked = true));
$('btn-none').onclick = () => document.querySelectorAll('#client-checks input').forEach((i) => (i.checked = false));

function showNewPoint() {
  $('c-coords').innerHTML = newPoint
    ? `📍 Точка выбрана${depot ? ` · ${Math.round(km(depot, newPoint))} км от склада по прямой` : ''}`
    : '';
}
let foundCands = [];
$('btn-find').onclick = async () => {
  try {
    foundCands = await geocode($('c-addr').value);
    const sel = $('c-candidates');
    sel.innerHTML = '<option value="">— выберите подходящий адрес —</option>' + foundCands.map((c, i) => `<option value="${i}">${esc(candLabel(c))}</option>`).join('');
    sel.classList.toggle('hidden', !foundCands.length);
    $('c-coords').textContent = foundCands.length ? 'Выберите адрес из списка. Если нужного нет — «Указать на карте».' : 'Не найдено. Добавьте город или нажмите «Указать на карте».';
    sel.onchange = () => { if (sel.value !== '') { newPoint = foundCands[Number(sel.value)]; showNewPoint(); } };
  } catch (e) { $('c-coords').textContent = e.message; }
};
$('btn-pick-new').onclick = () => pickPoint(newPoint, (ll) => { newPoint = ll; $('c-candidates').classList.add('hidden'); showNewPoint(); });

$('btn-add-client').onclick = async () => {
  if (!$('c-name').value || !$('c-addr').value) return ($('c-msg').textContent = 'Заполните название и адрес');
  if (!newPoint) return ($('c-msg').textContent = 'Нужна точка: нажмите «Найти адрес» или «Указать на карте»');
  if (depot && km(depot, newPoint) > MAX_KM) return ($('c-msg').textContent = 'Точка слишком далеко от склада. Проверьте её на карте.');
  const row = {
    name: $('c-name').value, kind: $('c-kind').value, address: $('c-addr').value,
    unload_minutes: Number($('c-unload').value) || 15, lat: newPoint.lat, lng: newPoint.lng,
  };
  const wasEdit = !!editingId;
  const { error } = wasEdit ? await sb.from('clients').update(row).eq('id', editingId) : await sb.from('clients').insert(row);
  $('c-msg').textContent = error ? 'Ошибка: ' + error.message + ' (менять клиентов может диспетчер)' : wasEdit ? 'Изменения сохранены' : 'Клиент добавлен';
  if (!error) { resetClientForm(); $('c-msg').textContent = wasEdit ? 'Изменения сохранены' : 'Клиент добавлен'; loadClients(); }
};

// ---------- опасные точки ----------
async function loadHazards() {
  if (!sb || !session) return;
  const { data } = await sb.from('hazards').select('*').eq('active', true).order('created_at', { ascending: false });
  hazards = data || [];
  $('hazards-list').innerHTML = hazards.length ? hazards.map((h) => `
    <div class="stop"><span style="font-size:22px">${TYPE[h.type][0]}</span><span class="grow">${esc(h.title)}<br><span class="muted">${TYPE[h.type][1]} · подтверждений: ${h.confirmations}${h.toll_price_rub ? ' · ' + h.toll_price_rub + ' ₽' : ''}</span></span>
    <button class="ghost small" data-confirm="${h.id}">+1</button></div>`).join('') : '<span class="muted">Пока пусто</span>';
  document.querySelectorAll('[data-confirm]').forEach((b) => (b.onclick = async () => { await sb.rpc('confirm_hazard', { hid: b.dataset.confirm }); loadHazards(); }));
  drawHazardMarkers();
}

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
  setTimeout(() => mapH.invalidateSize(), 50);
  drawHazardMarkers();
}
function drawHazardMarkers() {
  if (!mapHLayer) return;
  mapHLayer.clearLayers();
  hazards.forEach((h) => L.marker([h.lat, h.lng]).bindPopup(`${TYPE[h.type][0]} ${esc(h.title)}`).addTo(mapHLayer));
}
$('btn-add-hazard').onclick = async () => {
  if (!pendingHazard) return;
  const type = $('h-type').value;
  const { error } = await sb.from('hazards').insert({
    type, title: $('h-title').value || TYPE[type][1], lat: pendingHazard.lat, lng: pendingHazard.lng,
    toll_price_rub: type === 'toll' ? Number($('h-price').value) || null : null,
  });
  $('h-msg').textContent = error ? 'Ошибка: ' + error.message : 'Отметка сохранена';
  if (!error) { pendingHazard = null; pendingMarker?.remove(); $('btn-add-hazard').disabled = true; $('btn-add-hazard').textContent = 'Сначала нажмите на карту'; $('h-title').value = ''; loadHazards(); }
};

// ---------- построение маршрута ----------
function settings() {
  localStorage.setItem('settings', JSON.stringify(Object.fromEntries(['v-weight', 'v-height', 'tolls', 'ret', 'v-hour', 'v-km'].map((k) => [k, $(k).value]))));
  return {
    returnToDepot: $('ret').value === '1',
    avoidTolls: $('tolls').value,
    valueOfHourRub: Number($('v-hour').value) || 600,
    costPerKmRub: Number($('v-km').value) || 18,
    vehicle: { weightKg: Number($('v-weight').value) || undefined, heightM: Number($('v-height').value) || undefined },
  };
}

$('btn-optimize').onclick = async () => {
  const ids = [...document.querySelectorAll('#client-checks input:checked')].map((i) => i.value);
  if (!depot) return ($('plan-msg').textContent = 'Сначала задайте склад');
  if (!ids.length) return ($('plan-msg').textContent = 'Отметьте клиентов на завтра');
  $('plan-msg').textContent = 'Считаю маршрут…';
  $('btn-optimize').disabled = true;
  try {
    const stops = clients.filter((c) => ids.includes(c.id)).map((c) => ({ id: c.id, name: c.name, lat: c.lat, lng: c.lng }));
    const r = await fetch('/api/optimize', {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: 'Bearer ' + session.access_token },
      body: JSON.stringify({ depot, stops, settings: settings() }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error);
    lastResult = d;
    showResult(d);
    $('plan-msg').textContent = '';
  } catch (e) { $('plan-msg').textContent = 'Ошибка: ' + e.message; }
  $('btn-optimize').disabled = false;
};

function showResult(d, dep = depot, back = $('ret').value === '1', savedNote = '') {
  $('result').classList.remove('hidden');
  $('saved-note').classList.toggle('hidden', !savedNote);
  $('saved-note').textContent = savedNote;
  $('save-box').classList.toggle('hidden', !!savedNote);
  const R = d.route;
  $('summary').innerHTML = `<div class="summary-big">${R.distance_km} км · ${Math.floor(R.duration_min / 60)} ч ${R.duration_min % 60} мин</div>
    <div class="muted">≈ ${R.cost_rub} ₽ · платные дороги: ${R.tolls === 'allowed' ? 'используются' : 'объезжаются'}${R.alternative_cost_rub ? ` (другой вариант ${R.alternative_cost_rub} ₽)` : ''}<br>Время разгрузки не включено.</div>`;
  $('warnings').innerHTML = d.warnings.length
    ? '<h2 class="warn">На маршруте</h2>' + d.warnings.map((w) => `<div class="stop"><span style="font-size:22px">${TYPE[w.type][0]}</span><span>${esc(w.title)}<br><span class="muted">${TYPE[w.type][1]}${w.toll_price_rub ? ', ' + w.toll_price_rub + ' ₽' : ''}</span></span></div>`).join('')
    : '<span class="ok">✓ Известных весовых постов, плохих дорог и платных участков на маршруте нет</span>';
  $('ordered').innerHTML = '<h2>Порядок объезда</h2>' + d.stops.map((s) => `<div class="stop"><span class="num">${s.seq}</span><span class="grow">${esc(s.name)}</span></div>`).join('');
  const pts = [dep, ...d.stops.filter((s) => s.lat != null), ...(back ? [dep] : [])];
  $('yandex').href = 'https://yandex.ru/maps/?rtt=auto&rtext=' + pts.map((p) => `${p.lat},${p.lng}`).join('~');

  if (!map) {
    map = L.map('map');
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(map);
    mapLayer = L.layerGroup().addTo(map);
  }
  mapLayer.clearLayers();
  const line = L.polyline(R.geometry ? R.geometry.map(([lng, lat]) => [lat, lng]) : pts.map((p) => [p.lat, p.lng]), { weight: 5 }).addTo(mapLayer);
  L.marker([dep.lat, dep.lng]).bindPopup('Склад').addTo(mapLayer);
  d.stops.filter((s) => s.lat != null).forEach((s) => L.marker([s.lat, s.lng], { icon: L.divIcon({ className: '', html: `<div class="num">${s.seq}</div>`, iconSize: [34, 34] }) }).addTo(mapLayer));
  d.warnings.forEach((w) => L.marker([w.lat, w.lng]).bindPopup(`${TYPE[w.type][0]} ${esc(w.title)}`).addTo(mapLayer));
  map.fitBounds(line.getBounds(), { padding: [20, 20] });
  setTimeout(() => map.invalidateSize(), 50);
  $('result').scrollIntoView({ behavior: 'smooth' });
}

// ---------- сохранённые рейсы ----------
$('btn-save').onclick = async () => {
  if (!lastResult) return;
  $('btn-save').disabled = true;
  const round = (v) => Math.round(v * 1e5) / 1e5;
  const route = { ...lastResult.route, geometry: (lastResult.route.geometry || []).map(([x, y]) => [round(x), round(y)]) };
  const { data, error } = await sb.from('trip_plans')
    .insert({ plan_date: $('trip-date').value || tomorrow(), depot, settings: settings(), result: { route, warnings: lastResult.warnings } })
    .select().single();
  if (error) { $('btn-save').disabled = false; return ($('plan-msg').textContent = 'Ошибка сохранения: ' + error.message); }
  const rows = lastResult.stops.map((s) => {
    const c = clients.find((x) => x.id === s.id);
    return { plan_id: data.id, client_id: s.id, seq: s.seq, name: s.name, address: c?.address ?? null, lat: s.lat, lng: s.lng };
  });
  const { error: e2 } = await sb.from('trip_stops').insert(rows);
  $('btn-save').disabled = false;
  if (e2) { await sb.from('trip_plans').delete().eq('id', data.id); return ($('plan-msg').textContent = 'Ошибка сохранения точек: ' + e2.message + ' (выполнили migration_2.sql?)'); }
  $('plan-msg').textContent = 'Рейс сохранён — он во вкладке «Рейсы»';
};

async function loadTrips() {
  const { data, error } = await sb.from('trip_plans')
    .select('id, plan_date, driver_id, depot, settings, result, trip_stops(count)')
    .order('plan_date', { ascending: false }).order('created_at', { ascending: false }).limit(50);
  if (error) { $('trips-list').textContent = error.message; return; }
  trips = data;
  $('trips-list').innerHTML = trips.length ? trips.map((t) => {
    const r = t.result?.route || {};
    const mins = r.duration_min ? `${Math.floor(r.duration_min / 60)} ч ${r.duration_min % 60} мин` : '';
    const n = t.trip_stops?.[0]?.count;
    return `<div class="stop"><span class="grow"><b>${fmtDate(t.plan_date)}</b>${t.driver_id === session.user.id ? '' : ' <span class="muted">· другой водитель</span>'}<br>
      <span class="muted">${n != null ? n + ' точек · ' : ''}${r.distance_km ?? '?'} км${mins ? ' · ' + mins : ''}</span></span>
      <span style="display:flex;gap:6px"><button class="ghost small" data-open="${t.id}">Открыть</button><button class="ghost small bad" data-trip-del="${t.id}">🗑</button></span></div>`;
  }).join('') : 'Пока нет сохранённых рейсов. Постройте маршрут и нажмите «Сохранить рейс».';
}

$('trips-list').addEventListener('click', async (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.tripDel) {
    if (!confirm('Удалить этот рейс?')) return;
    const { error } = await sb.from('trip_plans').delete().eq('id', b.dataset.tripDel);
    if (error) $('trips-list').insertAdjacentHTML('afterbegin', `<p class="bad">Ошибка: ${esc(error.message)}</p>`); else loadTrips();
  }
  if (b.dataset.open) {
    const t = trips.find((x) => x.id === b.dataset.open);
    const { data: rows, error } = await sb.from('trip_stops').select('*').eq('plan_id', t.id).order('seq');
    if (error) return ($('trips-list').insertAdjacentHTML('afterbegin', `<p class="bad">Ошибка: ${esc(error.message)}</p>`));
    const stops = rows.map((s) => {
      const c = clients.find((x) => x.id === s.client_id);
      return { seq: s.seq, id: s.client_id, name: s.name ?? c?.name ?? 'Клиент удалён', lat: s.lat ?? c?.lat ?? null, lng: s.lng ?? c?.lng ?? null };
    });
    show('plan');
    showResult({ stops, route: t.result.route, warnings: t.result.warnings || [] }, t.depot, t.settings?.returnToDepot !== false, `Сохранённый рейс на ${fmtDate(t.plan_date)}`);
  }
});
