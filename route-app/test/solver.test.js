const test = require('node:test');
const assert = require('node:assert');
const { solve, pathCost, haversine } = require('../netlify/functions/lib/solver');

function matrixFromPoints(pts) {
  return pts.map((a) => pts.map((b) => haversine(a, b)));
}

test('точки на прямой — порядок по возрастанию', () => {
  const pts = [0, 4, 2, 1, 3].map((x) => ({ lat: 0, lng: x * 0.01 }));
  const r = solve(matrixFromPoints(pts), { returnToDepot: false });
  assert.deepStrictEqual(r.order, [0, 3, 2, 4, 1]);
});

test('эвристика (n>12) не хуже ближайшего соседа и даёт валидную перестановку', () => {
  const pts = Array.from({ length: 25 }, (_, i) => ({
    lat: 56 + Math.sin(i * 7.3) * 0.1,
    lng: 60 + Math.cos(i * 3.1) * 0.1,
  }));
  const m = matrixFromPoints(pts);
  const r = solve(m, { returnToDepot: true });
  assert.strictEqual(new Set(r.order).size, 25);
  assert.strictEqual(r.order[0], 0);
  assert.ok(r.cost <= pathCost(m, [...Array(25).keys()], true));
});

test('точное решение совпадает с перебором для 7 точек', () => {
  const pts = Array.from({ length: 7 }, (_, i) => ({ lat: Math.sin(i * 2.1), lng: Math.cos(i * 1.3) }));
  const m = matrixFromPoints(pts);
  const perms = (a) => (a.length <= 1 ? [a] : a.flatMap((x, i) => perms([...a.slice(0, i), ...a.slice(i + 1)]).map((p) => [x, ...p])));
  let best = Infinity;
  for (const p of perms([1, 2, 3, 4, 5, 6])) best = Math.min(best, pathCost(m, [0, ...p], true));
  assert.ok(Math.abs(solve(m, { returnToDepot: true }).cost - best) < 1e-6);
});
