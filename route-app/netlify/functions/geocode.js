// GET /api/geocode?text=Екатеринбург, ул. Ленина 1
const json = (status, body) => ({ statusCode: status, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

exports.handler = async (event) => {
  try {
    const text = (event.queryStringParameters || {}).text;
    if (!text) return json(400, { error: 'text обязателен' });
    const url = new URL('https://api.openrouteservice.org/geocode/search');
    url.searchParams.set('api_key', process.env.ORS_API_KEY);
    url.searchParams.set('text', text);
    url.searchParams.set('size', '5');
    url.searchParams.set('boundary.country', 'RU');
    const r = await fetch(url);
    const d = await r.json();
    if (!r.ok) return json(502, { error: 'Геокодер недоступен' });
    return json(200, {
      results: (d.features || []).map((f) => ({
        label: f.properties.label, lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0], confidence: f.properties.confidence,
      })),
    });
  } catch (e) {
    return json(500, { error: e.message });
  }
};
