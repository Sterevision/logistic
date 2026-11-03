// GET /api/geocode?text=...&lat=..&lng=..   (lat/lng — склад: ищем рядом с ним)
const { haversine } = require('./lib/solver');
const json = (status, body) => ({ statusCode: status, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

exports.handler = async (event) => {
  try {
    const q = event.queryStringParameters || {};
    if (!q.text) return json(400, { error: 'text обязателен' });
    const near = q.lat && q.lng ? { lat: Number(q.lat), lng: Number(q.lng) } : null;

    const url = new URL('https://api.openrouteservice.org/geocode/search');
    url.searchParams.set('api_key', process.env.ORS_API_KEY);
    url.searchParams.set('text', q.text);
    url.searchParams.set('size', '10');
    url.searchParams.set('boundary.country', 'RU');
    if (near) {
      url.searchParams.set('focus.point.lat', near.lat);
      url.searchParams.set('focus.point.lon', near.lng);
      url.searchParams.set('boundary.circle.lat', near.lat);
      url.searchParams.set('boundary.circle.lon', near.lng);
      url.searchParams.set('boundary.circle.radius', '300'); // км
    }
    const r = await fetch(url);
    const d = await r.json();
    if (!r.ok) return json(502, { error: 'Геокодер недоступен' });

    let results = (d.features || []).map((f) => {
      const p = { lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0] };
      return { label: f.properties.label, ...p, dist_km: near ? Math.round(haversine(near, p) / 1000) : null };
    });
    if (near) results.sort((a, b) => a.dist_km - b.dist_km);
    return json(200, { results: results.slice(0, 5) });
  } catch (e) {
    return json(500, { error: e.message });
  }
};
