// Порядок объезда точек: старт на складе (индекс 0), далее все клиенты.
// cost[i][j] — «стоимость» проезда из i в j (может быть несимметричной).
// Без окон приёмки:  n <= 12 -> точное решение (Held-Karp), иначе ближайший сосед + 2-opt + or-opt.
// С окнами приёмки:  solveWindows — перебор до 8 точек, дальше локальный поиск из нескольких стартов.

function pathCost(cost, order, returnToDepot) {
  let c = 0;
  for (let i = 0; i < order.length - 1; i++) c += cost[order[i]][order[i + 1]];
  if (returnToDepot) c += cost[order[order.length - 1]][order[0]];
  return c;
}

function heldKarp(cost, returnToDepot) {
  const n = cost.length;
  if (n <= 2) return [...Array(n).keys()];
  const m = n - 1; // клиенты 1..n-1 -> биты 0..m-1
  const FULL = 1 << m;
  const dp = Array.from({ length: FULL }, () => new Float64Array(m).fill(Infinity));
  const par = Array.from({ length: FULL }, () => new Int16Array(m).fill(-1));
  for (let j = 0; j < m; j++) dp[1 << j][j] = cost[0][j + 1];
  for (let mask = 1; mask < FULL; mask++) {
    for (let j = 0; j < m; j++) {
      if (!(mask & (1 << j))) continue;
      const cur = dp[mask][j];
      if (cur === Infinity) continue;
      for (let k = 0; k < m; k++) {
        if (mask & (1 << k)) continue;
        const nm = mask | (1 << k);
        const v = cur + cost[j + 1][k + 1];
        if (v < dp[nm][k]) { dp[nm][k] = v; par[nm][k] = j; }
      }
    }
  }
  let best = Infinity, last = 0;
  for (let j = 0; j < m; j++) {
    const v = dp[FULL - 1][j] + (returnToDepot ? cost[j + 1][0] : 0);
    if (v < best) { best = v; last = j; }
  }
  const seq = [];
  let mask = FULL - 1, j = last;
  while (j !== -1) { seq.push(j + 1); const pj = par[mask][j]; mask ^= 1 << j; j = pj; }
  return [0, ...seq.reverse()];
}

function nearestNeighbor(cost) {
  const n = cost.length;
  const used = new Array(n).fill(false);
  const order = [0];
  used[0] = true;
  for (let step = 1; step < n; step++) {
    const last = order[order.length - 1];
    let best = -1, bc = Infinity;
    for (let j = 1; j < n; j++) if (!used[j] && cost[last][j] < bc) { bc = cost[last][j]; best = j; }
    order.push(best); used[best] = true;
  }
  return order;
}

// Локальный поиск по любой функции оценки: разворот отрезка (2-opt) и перенос одной точки (or-opt).
function improveBy(order, score) {
  const n = order.length;
  let best = score(order);
  let improved = true, guard = 0;
  while (improved && guard++ < 200) {
    improved = false;
    for (let i = 1; i < n - 1; i++) {
      for (let j = i + 1; j < n; j++) {
        const cand = order.slice(0, i).concat(order.slice(i, j + 1).reverse(), order.slice(j + 1));
        const c = score(cand);
        if (c + 1e-9 < best) { order = cand; best = c; improved = true; }
      }
    }
    for (let i = 1; i < n; i++) {
      for (let j = 1; j < n; j++) {
        if (i === j) continue;
        const cand = order.slice();
        const [x] = cand.splice(i, 1);
        cand.splice(j, 0, x);
        const c = score(cand);
        if (c + 1e-9 < best) { order = cand; best = c; improved = true; }
      }
    }
  }
  return order;
}

function solve(cost, { returnToDepot = true } = {}) {
  const n = cost.length;
  let order;
  if (n <= 12) order = heldKarp(cost, returnToDepot);
  else order = improveBy(nearestNeighbor(cost), (o) => pathCost(cost, o, returnToDepot));
  return { order, cost: pathCost(cost, order, returnToDepot) };
}

// ---------- окна приёмки ----------
// cost[i][j] — деньги, dur[i][j] — секунды в пути, service[i] — секунды на разгрузку,
// from[i]/to[i] — окно приёмки в секундах от полуночи (или null), startSec — время выезда.
function makeEvaluator({ cost, dur, service, from, to, startSec = 0, returnToDepot = true, valueOfHour = 600 }) {
  const LATE_FIXED = 3000; // штраф за каждое опоздание, ₽-эквивалент
  return function evaluate(order) {
    let t = startSec, total = 0, lateCount = 0;
    const rows = [];
    for (let k = 1; k < order.length; k++) {
      const i = order[k - 1], j = order[k];
      total += cost[i][j];
      t += dur[i][j];
      const arrive = t;
      let wait = 0, late = 0;
      if (from[j] != null && t < from[j]) { wait = from[j] - t; t = from[j]; total += (wait / 3600) * valueOfHour; }
      if (to[j] != null && t > to[j]) { late = t - to[j]; lateCount++; total += LATE_FIXED + (late / 3600) * valueOfHour * 10; }
      rows.push({ idx: j, arrive, start: t, wait, late });
      t += service[j] || 0;
    }
    let end = t;
    if (returnToDepot && order.length > 1) {
      const last = order[order.length - 1];
      total += cost[last][0];
      end = t + dur[last][0];
    }
    return { total, lateCount, rows, endSec: end };
  };
}

function permute(arr, cb) {
  const a = arr.slice();
  const rec = (k) => {
    if (k === a.length) return cb(a);
    for (let i = k; i < a.length; i++) {
      [a[k], a[i]] = [a[i], a[k]];
      rec(k + 1);
      [a[k], a[i]] = [a[i], a[k]];
    }
  };
  rec(0);
}

function solveWindows(opts) {
  const n = opts.cost.length;
  const ev = makeEvaluator(opts);
  const idx = [...Array(n).keys()].slice(1);
  let best = null;
  const consider = (order) => {
    const r = ev(order);
    if (!best || r.total < best.total - 1e-9) best = { order: order.slice(), ...r };
  };
  if (idx.length <= 8) {
    permute(idx, (p) => consider([0, ...p]));
    return best;
  }
  const inf = Number.POSITIVE_INFINITY;
  const seeds = [
    nearestNeighbor(opts.cost),
    [0, ...idx.slice().sort((a, b) => (opts.to[a] ?? inf) - (opts.to[b] ?? inf))],
    [0, ...idx.slice().sort((a, b) => (opts.from[a] ?? 0) - (opts.from[b] ?? 0))],
  ];
  for (const s of seeds) consider(improveBy(s, (o) => ev(o).total));
  return best;
}

// Расстояние по прямой — запасной вариант и проверка «точка не в том регионе».
function haversine(a, b) {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

module.exports = { solve, solveWindows, makeEvaluator, pathCost, haversine };
