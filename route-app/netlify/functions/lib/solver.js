// Порядок объезда точек: старт на складе (индекс 0), далее все клиенты.
// cost[i][j] — «стоимость» проезда из i в j (может быть несимметричной).
// n <= 12  -> точное решение (Held-Karp)
// n  > 12  -> ближайший сосед + 2-opt + or-opt (хватает для 50 точек)

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

function improve(cost, order, returnToDepot) {
  const n = order.length;
  let best = pathCost(cost, order, returnToDepot);
  let improved = true, guard = 0;
  while (improved && guard++ < 200) {
    improved = false;
    // 2-opt (разворот отрезка; для несимметричных матриц цена пересчитывается целиком)
    for (let i = 1; i < n - 1; i++) {
      for (let j = i + 1; j < n; j++) {
        const cand = order.slice(0, i).concat(order.slice(i, j + 1).reverse(), order.slice(j + 1));
        const c = pathCost(cost, cand, returnToDepot);
        if (c + 1e-9 < best) { order = cand; best = c; improved = true; }
      }
    }
    // or-opt (перенос одной точки)
    for (let i = 1; i < n; i++) {
      for (let j = 1; j < n; j++) {
        if (i === j) continue;
        const cand = order.slice();
        const [x] = cand.splice(i, 1);
        cand.splice(j, 0, x);
        const c = pathCost(cost, cand, returnToDepot);
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
  else order = improve(cost, nearestNeighbor(cost), returnToDepot);
  return { order, cost: pathCost(cost, order, returnToDepot) };
}

// Расстояние по прямой — запасной вариант, если картографический API недоступен.
function haversine(a, b) {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

module.exports = { solve, pathCost, haversine };
