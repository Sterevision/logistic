// POST /api/optimize
// body: { depot:{lat,lng,name}, stops:[{id,name,lat,lng}], settings:{
//   returnToDepot, vehicle:{weightKg,heightM}, avoidTolls:'auto'|'always'|'never',
//   valueOfHourRub, costPerKmRub } }
// header: Authorization: Bearer <supabase access token>
const { solve } = require('./lib/solver');

const ORS = 'https://api.openrouteservice.org';
const PROFILE = 'driving-hgv';

const json = (status, body) => ({ statusCode: status, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

async function ors(path, body) {
  const r = await fetch(ORS + path, {
    method: 'POST',
    headers: { Authorization: process.env.ORS_API_KEY, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`ORS ${path}: ${r.status} ${data?.error?.message || data?.error || ''}`);
  return data;
}

async function loadHazards(token) {
  const r = await fetch(`${process.env.SUPABASE_URL}/rest/v1/hazards?active=eq.true&select=*`, {
    headers: { apikey: process.env.SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
  });
  if (!r.ok) throw new Error('Supabase: не удалось прочитать опасные точки (' + r.status + ')');
  return r.json();
}

// Квадрат вокруг точки (для avoid_polygons)
function box(lat, lng, meters) {
  const dLat = meters / 111320, dLng = meters / (111320 * Math.cos((lat * Math.PI) / 180));
  return [[[lng - dLng, lat - dLat], [lng + dLng, lat - dLat], [lng + dLng, lat + dLat], [lng - dLng, lat + dLat], [lng - dLng, lat - dLat]]];
}

function distPointToSegM(p, a, b) {
  const k = Math.cos((p.lat * Math.PI) / 180);
  const ax = (a[0] - p.lng) * 111320 * k, ay = (a[1] - p.lat) * 111320;
  const bx = (b[0] - p.lng) * 111320 * k, by = (b[1] - p.lat) * 111320;
  const dx = bx - ax, dy = by - ay;
  const t = dx || dy ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy))) : 0;
  return Math.hypot(ax + t * dx, ay + t * dy);
}

function hazardsOnRoute(coords, hazards) {
  const hit = [];
  for (const h of hazards) {
    const r = h.radius_m || 150;
    for (let i = 0; i < coords.length - 1; i++) {
      if (distPointToSegM({ lat: h.lat, lng: h.lng }, coords[i], coords[i + 1]) <= r) { hit.push(h); break; }
    }
  }
  return hit;
}

async function route(points, { avoidTolls, avoidPolys, vehicle }) {
  const options = {};
  if (avoidTolls) options.avoid_features = ['tollways'];
  if (avoidPolys.length) options.avoid_polygons = { type: 'MultiPolygon', coordinates: avoidPolys };
  if (vehicle?.weightKg || vehicle?.heightM) {
    const restrictions = {};
    if (vehicle.weightKg) restrictions.weight = vehicle.weightKg / 1000; // тонны
    if (vehicle.heightM) restrictions.height = vehicle.heightM;
    options.profile_params = { restrictions };
  }
  const data = await ors(`/v2/directions/${PROFILE}/geojson`, {
    coordinates: points.map((p) => [p.lng, p.lat]),
    instructions: false,
    options,
  });
  const f = data.features[0];
  return { coords: f.geometry.coordinates, distance: f.properties.summary.distance, duration: f.properties.summary.duration };
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') return json(405, { error: 'POST only' });
    const token = (event.headers.authorization || '').replace(/^Bearer /i, '');
    if (!token) return json(401, { error: 'Нужен вход в приложение' });

    const { depot, stops, settings = {} } = JSON.parse(event.body || '{}');
    if (!depot || !Array.isArray(stops) || stops.length < 1) return json(400, { error: 'Нужны склад и хотя бы одна точка' });
    if (stops.length > 45) return json(400, { error: 'Максимум 45 точек за раз (лимит API маршрутизации)' });

    const valueOfHour = settings.valueOfHourRub ?? 600; // сколько стоит час водителя+машины
    const perKm = settings.costPerKmRub ?? 18; // топливо + износ
    const returnToDepot = settings.returnToDepot !== false;
    const vehicle = settings.vehicle || {};

    const hazards = await loadHazards(token);
    const badRoads = hazards.filter((h) => h.type === 'bad_road');
    const avoidPolys = badRoads.map((h) => box(h.lat, h.lng, Math.max(h.radius_m || 150, 100)));

    const points = [depot, ...stops];

    // 1) матрица время/расстояние для грузового профиля
    const m = await ors(`/v2/matrix/${PROFILE}`, {
      locations: points.map((p) => [p.lng, p.lat]),
      metrics: ['duration', 'distance'],
      units: 'm',
    });
    const n = points.length;
    const cost = Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_, j) => {
        if (i === j) return 0;
        const sec = m.durations[i][j], meters = m.distances[i][j];
        if (sec == null || meters == null) return 1e9; // нет проезда для этой машины
        return (sec / 3600) * valueOfHour + (meters / 1000) * perKm;
      })
    );

    // 2) оптимальный порядок
    const { order } = solve(cost, { returnToDepot });
    const ordered = order.map((i) => points[i]);
    const wayPoints = returnToDepot ? [...ordered, depot] : ordered;

    // 3) маршрут: сравниваем «с платными» и «без платных»
    const variants = {};
    if (settings.avoidTolls !== 'always') variants.withTolls = await route(wayPoints, { avoidTolls: false, avoidPolys, vehicle });
    if (settings.avoidTolls !== 'never') variants.noTolls = await route(wayPoints, { avoidTolls: true, avoidPolys, vehicle });

    const tollHazards = hazards.filter((h) => h.type === 'toll');
    const score = (v, usesTolls) => {
      let c = (v.duration / 3600) * valueOfHour + (v.distance / 1000) * perKm;
      if (usesTolls) c += hazardsOnRoute(v.coords, tollHazards).reduce((s, h) => s + (Number(h.toll_price_rub) || 0), 0);
      return c;
    };
    let chosenKey, chosen;
    if (variants.withTolls && variants.noTolls) {
      const a = score(variants.withTolls, true), b = score(variants.noTolls, false);
      chosenKey = a <= b ? 'withTolls' : 'noTolls';
      chosen = variants[chosenKey];
      chosen.costRub = Math.round(Math.min(a, b));
      chosen.alternativeCostRub = Math.round(Math.max(a, b));
    } else {
      chosenKey = Object.keys(variants)[0];
      chosen = variants[chosenKey];
      chosen.costRub = Math.round(score(chosen, chosenKey === 'withTolls'));
    }

    // 4) предупреждения вдоль выбранного маршрута
    const warn = hazardsOnRoute(chosen.coords, hazards).map((h) => ({
      id: h.id, type: h.type, title: h.title, lat: h.lat, lng: h.lng, toll_price_rub: h.toll_price_rub,
    }));

    return json(200, {
      order: order.slice(1).map((i) => stops[i - 1].id), // id клиентов по порядку
      stops: ordered.slice(1).map((p, k) => ({ seq: k + 1, id: p.id, name: p.name, lat: p.lat, lng: p.lng })),
      route: {
        geometry: chosen.coords,
        distance_km: Math.round(chosen.distance / 100) / 10,
        duration_min: Math.round(chosen.duration / 60),
        cost_rub: chosen.costRub,
        alternative_cost_rub: chosen.alternativeCostRub ?? null,
        tolls: chosenKey === 'withTolls' ? 'allowed' : 'avoided',
      },
      warnings: warn,
      note: 'Порядок рассчитан по времени и км грузового профиля; плохие дороги обходятся, весовые посты и платные участки — показаны как предупреждения.',
    });
  } catch (e) {
    return json(500, { error: e.message });
  }
};
