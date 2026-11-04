const test = require('node:test');
const assert = require('node:assert');
const { solve, solveWindows, makeEvaluator, pathCost, haversine } = require('../netlify/functions/lib/solver');

function matrixFromPoints(pts) {
  return pts.map((a) => pts.map((b) => haversine(a, b)));
}

test('точки на прямой — порядок по возрастанию', () => {
  const pts = [0, 4, 2, 1, 3].map((x) => ({ lat: 0, lng: x * 0.01 }));
  const r = solve(matrixFromPoints(pts), { returnToDepot: false });
  assert.deepStrictEqual(r.order, [0, 3, 2, 4, 1]);
});

test('эвристика (n>12) даёт валидную перестановку не хуже исходной', () => {
  const pts = Array.from({ length: 25 }, (_, i) => ({ lat: 56 + Math.sin(i * 7.3) * 0.1, lng: 60 + Math.cos(i * 3.1) * 0.1 }));
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

// --- окна приёмки: склад в точке 0, клиенты A (x=1) и B (x=2), 600 секунд на единицу пути ---
function lineProblem(over = {}) {
  const xs = [0, 1, 2];
  const dur = xs.map((a) => xs.map((b) => Math.abs(a - b) * 600));
  const cost = dur.map((r) => r.map((s) => (s / 3600) * 600));
  return { cost, dur, service: [0, 1800, 0], from: [null, null, null], to: [null, null, null], startSec: 0, returnToDepot: false, valueOfHour: 600, ...over };
}

test('без окон выбирается ближайшая точка первой', () => {
  assert.deepStrictEqual(solveWindows(lineProblem()).order, [0, 1, 2]);
});

test('окно закрытия у дальней точки меняет порядок', () => {
  // A: 30 минут разгрузки. Если ехать к A первой, к B приедем в 50 мин, а окно B закрывается в 20 мин.
  const r = solveWindows(lineProblem({ to: [null, null, 1200] }));
  assert.deepStrictEqual(r.order, [0, 2, 1]);
  assert.strictEqual(r.lateCount, 0);
});

test('ранний приезд даёт ожидание, а не опоздание', () => {
  const r = solveWindows(lineProblem({ from: [null, 7200, null], to: [null, 9000, null] }));
  const rowA = r.rows.find((x) => x.idx === 1);
  assert.strictEqual(rowA.wait > 0 || rowA.arrive >= 7200, true);
  assert.strictEqual(rowA.late, 0);
});

test('невыполнимое окно помечается опозданием, а не ломает расчёт', () => {
  const r = solveWindows(lineProblem({ to: [null, 60, 60] }));
  assert.ok(r.lateCount >= 1);
  assert.strictEqual(new Set(r.order).size, 3);
});

test('эвристика с окнами (12 точек) даёт валидный порядок не хуже исходного', () => {
  const n = 13;
  const pts = Array.from({ length: n }, (_, i) => ({ lat: 54.7 + Math.sin(i * 2.3) * 0.2, lng: 56 + Math.cos(i * 1.7) * 0.2 }));
  const dist = pts.map((a) => pts.map((b) => haversine(a, b)));
  const dur = dist.map((r) => r.map((m) => m / 12)); // ~43 км/ч
  const cost = dur.map((r) => r.map((s) => (s / 3600) * 600));
  const from = Array(n).fill(null), to = Array(n).fill(null);
  for (let i = 1; i < n; i += 3) { from[i] = 9 * 3600; to[i] = 12 * 3600; }
  const opts = { cost, dur, service: Array(n).fill(900), from, to, startSec: 8 * 3600, returnToDepot: true, valueOfHour: 600 };
  const r = solveWindows(opts);
  assert.strictEqual(new Set(r.order).size, n);
  assert.strictEqual(r.order[0], 0);
  assert.ok(r.total <= makeEvaluator(opts)([...Array(n).keys()]).total + 1e-6);
});
