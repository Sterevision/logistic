/* global L, supabase */
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const TYPE = { bad_road: ['🕳️', 'Плохая дорога'], weigh_post: ['⚖️', 'Весовой контроль'], toll: ['💰', 'Платный участок'] };

let sb, session, clients = [], hazards = [], depot = null, lastResult = null, pendingHazard = null;
let map, mapLayer, mapH, mapHLayer, pendingMarker;

// ---------- старт ----------
(async function init() {
  const cfg = await (await fetch('/api/config')).json();
  if (!cfg.supabaseUrl) { document.body.innerHTML = '<p style="padding:16px">Не заданы SUPABASE_URL / SUPABASE_ANON_KEY в Netlify.</p>'; return; }
  sb = supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
  const { data } = await sb.auth.getSession();
  sb.auth.onAuthStateChange((_e, s) => { session = s; render(); });
  session = data.session;
  try { depot = JSON.parse(localStorage.getItem('depot')); } catch { depot = null; }
  const saved = JSON.parse(localStorage.getItem('settings') || '{}');
  for (const [k, v] of Object.entries(saved)) if ($(k)) $(k).value = v;
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
  render();
})();

function show(view) {
  for (const v of ['login', 'plan', 'clients', 'hazards']) $('view-' + v).classList.toggle('hidden', v !== view);
  document.querySelectorAll('nav [data-v]').forEach((b) => b.classList.toggle('active', b.dataset.v === view));
  if (view === 'hazards') initHazardMap();
}

async function render() {
  const logged = !!session;
  $('nav').classList.toggle('hidden', !logged);
  $('who').textContent = logged ? session.user.email : '';
  if (!logged) return show('login');
  show('plan');
  await Promise.all([loadClients(), loadHazards()]);
  $('depot-info').textContent = depot ? `📍 ${depot.name} (${depot.lat.toFixed(4)}, ${depot.lng.toFixed(4)})` : 'Склад не задан';
  if (depot) $('depot-text').value = depot.name;
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

// ---------- геокодер ----------
async function geocode(text) {
  const r = await fetch('/api/geocode?text=' + encodeURIComponent(text));
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || 'Ошибка геокодера');
  return d.results;
}

$('btn-depot').onclick = async () => {
  try {
    const res = await geocode($('depot-text').value);
    if (!res.length) return ($('depot-info').textContent = 'Адрес не найден');
    depot = { name: res[0].label, lat: res[0].lat, lng: res[0].lng };
    localStorage.setItem('depot', JSON.stringify(depot));
    $('depot-info').textContent = `📍 ${depot.name}`;
  } catch (e) { $('depot-info').textContent = e.message; }
};

// ---------- клиенты ----------
async function loadClients() {
  const { data, error } = await sb.from('clients').select('*').order('name');
  if (error) { $('client-checks').textContent = error.message; return; }
  clients = data;
  $('client-checks').innerHTML = clients.length
    ? clients.map((c) => `<label class="chk"><input type="checkbox" value="${c.id}" ${c.lat ? '' : 'disabled'}>
        <span><b>${esc(c.name)}</b> <span class="muted">${esc(c.kind)}</span><br><span class="muted">${esc(c.address)}${c.lat ? '' : ' — нет координат'}</span></span></label>`).join('')
    : 'Клиентов пока нет — добавьте на вкладке «Клиенты».';
  $('clients-list').innerHTML = '<b>Все клиенты</b>' + clients.map((c) => `<div class="stop"><span>${esc(c.name)} <span class="muted">${esc(c.kind)} · ${esc(c.address)}</span></span></div>`).join('');
}

let foundCands = [];
$('btn-find').onclick = async () => {
  try {
    foundCands = await geocode($('c-addr').value);
    const sel = $('c-candidates');
    sel.innerHTML = foundCands.map((c, i) => `<option value="${i}">${esc(c.label)}</option>`).join('');
    sel.classList.toggle('hidden', !foundCands.length);
    $('c-coords').textContent = foundCands.length ? 'Выберите подходящий вариант адреса' : 'Не найдено — уточните адрес';
  } catch (e) { $('c-coords').textContent = e.message; }
};

$('btn-add-client').onclick = async () => {
  const cand = foundCands[Number($('c-candidates').value) || 0];
  if (!$('c-name').value || !$('c-addr').value) return ($('c-msg').textContent = 'Заполните название и адрес');
  const { error } = await sb.from('clients').insert({
    name: $('c-name').value, kind: $('c-kind').value, address: $('c-addr').value,
    unload_minutes: Number($('c-unload').value) || 15, lat: cand?.lat ?? null, lng: cand?.lng ?? null,
  });
  $('c-msg').textContent = error ? 'Ошибка: ' + error.message + ' (добавлять клиентов может диспетчер)' : 'Добавлено';
  if (!error) { $('c-name').value = ''; $('c-addr').value = ''; foundCands = []; $('c-candidates').classList.add('hidden'); loadClients(); }
};

// ---------- опасные точки ----------
async function loadHazards() {
  const { data } = await sb.from('hazards').select('*').eq('active', true).order('created_at', { ascending: false });
  hazards = data || [];
  $('hazards-list').innerHTML = '<b>Все отметки</b>' + (hazards.length ? hazards.map((h) => `
    <div class="stop"><span>${TYPE[h.type][0]}</span><span style="flex:1">${esc(h.title)}<br><span class="muted">${TYPE[h.type][1]} · подтверждений: ${h.confirmations}${h.toll_price_rub ? ' · ' + h.toll_price_rub + ' ₽' : ''}</span></span>
    <button class="ghost" style="width:auto" data-confirm="${h.id}">+1</button></div>`).join('') : '<p class="muted">Пока пусто</p>');
  document.querySelectorAll('[data-confirm]').forEach((b) => (b.onclick = async () => { await sb.rpc('confirm_hazard', { hid: b.dataset.confirm }); loadHazards(); }));
  drawHazardMarkers();
}

function initHazardMap() {
  if (!mapH) {
    mapH = L.map('map-h').setView(depot ? [depot.lat, depot.lng] : [56.84, 60.6], 11);
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
  const s = {
    returnToDepot: $('ret').value === '1',
    avoidTolls: $('tolls').value,
    valueOfHourRub: Number($('v-hour').value) || 600,
    costPerKmRub: Number($('v-km').value) || 18,
    vehicle: { weightKg: Number($('v-weight').value) || undefined, heightM: Number($('v-height').value) || undefined },
  };
  localStorage.setItem('settings', JSON.stringify({ 'v-weight': $('v-weight').value, 'v-height': $('v-height').value, tolls: $('tolls').value, ret: $('ret').value, 'v-hour': $('v-hour').value, 'v-km': $('v-km').value }));
  return s;
}

$('btn-optimize').onclick = async () => {
  const ids = [...document.querySelectorAll('#client-checks input:checked')].map((i) => i.value);
  if (!depot) return ($('plan-msg').textContent = 'Сначала задайте склад');
  if (!ids.length) return ($('plan-msg').textContent = 'Отметьте клиентов на завтра');
  $('plan-msg').textContent = 'Считаю…';
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

function showResult(d) {
  $('result').classList.remove('hidden');
  const R = d.route;
  $('summary').innerHTML = `<b>${R.distance_km} км · ${Math.floor(R.duration_min / 60)} ч ${R.duration_min % 60} мин в пути</b><br>
    <span class="muted">Оценка стоимости: ${R.cost_rub} ₽ · платные дороги: ${R.tolls === 'allowed' ? 'используются' : 'объезжаются'}${R.alternative_cost_rub ? ` (альтернатива ${R.alternative_cost_rub} ₽)` : ''}</span><br>
    <span class="muted">Время разгрузки на точках не включено.</span>`;
  $('warnings').innerHTML = d.warnings.length
    ? '<b class="warn">На маршруте</b>' + d.warnings.map((w) => `<div class="stop"><span>${TYPE[w.type][0]}</span><span>${esc(w.title)} <span class="muted">${TYPE[w.type][1]}${w.toll_price_rub ? ', ' + w.toll_price_rub + ' ₽' : ''}</span></span></div>`).join('')
    : '<span class="ok">Известных весовых постов, плохих дорог и платных участков на маршруте нет</span>';
  $('ordered').innerHTML = '<b>Порядок объезда</b>' + d.stops.map((s) => `<div class="stop"><span class="num">${s.seq}</span><span>${esc(s.name)}</span></div>`).join('');
  const pts = [depot, ...d.stops, ...(R.tolls !== undefined && $('ret').value === '1' ? [depot] : [])];
  $('yandex').href = 'https://yandex.ru/maps/?rtt=auto&rtext=' + pts.map((p) => `${p.lat},${p.lng}`).join('~');

  if (!map) {
    map = L.map('map');
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(map);
    mapLayer = L.layerGroup().addTo(map);
  }
  mapLayer.clearLayers();
  const line = L.polyline(R.geometry.map(([lng, lat]) => [lat, lng]), { weight: 5 }).addTo(mapLayer);
  L.marker([depot.lat, depot.lng]).bindPopup('Склад').addTo(mapLayer);
  d.stops.forEach((s) => L.marker([s.lat, s.lng], { icon: L.divIcon({ className: '', html: `<div class="num">${s.seq}</div>`, iconSize: [30, 30] }) }).addTo(mapLayer));
  d.warnings.forEach((w) => L.marker([w.lat, w.lng]).bindPopup(`${TYPE[w.type][0]} ${esc(w.title)}`).addTo(mapLayer));
  map.fitBounds(line.getBounds(), { padding: [20, 20] });
  setTimeout(() => map.invalidateSize(), 50);
  $('result').scrollIntoView({ behavior: 'smooth' });
}

$('btn-save').onclick = async () => {
  if (!lastResult) return;
  const { data, error } = await sb.from('trip_plans').insert({ depot, settings: settings(), result: { route: { ...lastResult.route, geometry: undefined }, warnings: lastResult.warnings } }).select().single();
  if (error) return ($('plan-msg').textContent = 'Ошибка сохранения: ' + error.message);
  await sb.from('trip_stops').insert(lastResult.stops.map((s) => ({ plan_id: data.id, client_id: s.id, seq: s.seq })));
  $('plan-msg').textContent = 'Рейс сохранён';
};
