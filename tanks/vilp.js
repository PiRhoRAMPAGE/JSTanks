function main(e, t) {
  const n = (e) => (e * Math.PI) / 180,
    a = (e, t) => {
      let n = (((t % 360) + 360) % 360) - (((e % 360) + 360) % 360);
      return n > 180 ? (n -= 360) : n < -180 && (n += 360), n;
    };
  function i(t) {
    let n = t;
    e.retained.recentAccuracy > 0.75 && (n = 50);
    const a = e.fire(Math.min(n, e.energy));
    a &&
      e.retained.shotMissiles.push({
        id: a,
        strategy: e.retained.currentInterceptStrategy,
      });
  }
  const r = (e, t, n) =>
      ((e, t, n) => Math.max(t, Math.min(n, e)))(a(e, t), -n, n) / n,
    s = (t, n) => ((180 * Math.atan2(n - e.y, t - e.x)) / Math.PI + 360) % 360,
    o = (t, n) => {
      const i = s(t, n);
      let r = a(e.bodyAim + e.gunAim, i);
      return Math.max(-1, Math.min(1, r / 10));
    };
  function c(t = null, r = null) {
    if (!e.detectedMissiles.length) return;
    const c = e.detectedMissiles
      .filter(
        (e, t, n) =>
          !n.some((n, a) => {
            if (a === t) return !1;
            const i = e.x - n.x,
              r = e.y - n.y;
            return Math.hypot(i, r) < 50 && n.energy > e.energy;
          })
      )
      .sort((e, t) => {
        const n = e.angleTo + 180,
          i = t.angleTo + 180,
          r = a(e.aim, n),
          s = a(t.aim, i);
        return r !== s ? r - s : t.distance - e.distance;
      })
      .filter((e) => {
        if (e.energy > 15 && e.distance <= 100) return e;
      });
    for (let u of c) {
      const g = 1 + u.energy / 50,
        h = e.x - u.x,
        y = e.y - u.y,
        l = e.size + g,
        M = 10 * Math.cos(u.angleTo),
        m = 10 * Math.sin(u.angleTo);
      function d(e, t, n, a, i, r, s) {
        const o = n - i,
          c = a - r,
          d = o * o + c * c,
          u = 2 * (e * o + t * c),
          g = u * u - 4 * d * (e * e + t * t - s * s);
        if (g < 0 || 0 === d) return 1 / 0;
        const h = [
          (-u - Math.sqrt(g)) / (2 * d),
          (-u + Math.sqrt(g)) / (2 * d),
        ].filter((e) => e > 0);
        return h.length ? Math.min(...h) : 1 / 0;
      }
      const f = e.bodyAim * (Math.PI / 180),
        b = 1,
        x = Math.PI / 18,
        p = d(h, y, M, m, -b * Math.cos(f), -b * Math.sin(f), l),
        T = Math.PI,
        S = Math.abs(T) / x;
      p >
      S +
        d(
          h + M * S,
          y + m * S,
          M,
          m,
          b * Math.cos(f + Math.PI),
          b * Math.sin(f + Math.PI),
          l
        )
        ? ((e.bodyTurn = 0), (e.speed = -1))
        : ((e.bodyTurn = 1), (e.speed = 1));
    }
    if (t) {
      s(t.x, t.y), e.bodyAim, e.gunAim;
      e.gunTurn = o(t.x, t.y);
      const A = 10 * e.gunTurn,
        P = e.bodyAim + e.gunAim + A,
        k = s(t.x, t.y),
        v = a(P, k),
        I = n(v);
      if (Math.abs(Math.sin(I) * r) < 1 * e.size) {
        i(10);
      }
    }
  }
  function d(r = null, c = null) {
    const d = e.x + e.actualSpeed * Math.cos((e.bodyAim * Math.PI) / 180),
      u = e.y + e.actualSpeed * Math.sin((e.bodyAim * Math.PI) / 180);
    if (!(Math.abs(d) > t.width / 2 - 50 || Math.abs(u) > t.height / 2 - 50))
      return;
    const g = Math.min(
      Math.abs(-t.width / 2 + e.x),
      Math.abs(t.width / 2 - e.x),
      Math.abs(-t.height / 2 + e.y),
      Math.abs(t.height / 2 - e.x)
    );
    e.speed = 0.9 + (g / 50) * 0.1;
    const h = s(0, 0);
    let y = a(e.bodyAim, h);
    if (
      ((e.bodyTurn = y / 180),
      Math.abs(y) > 180 && ((e.speed *= -1), (e.bodyTurn *= -1)),
      r)
    ) {
      s(r.x, r.y), e.bodyAim, e.gunAim;
      e.gunTurn = o(r.x, r.y);
      const t = 10 * e.gunTurn,
        d = e.bodyAim + e.gunAim + t,
        u = s(r.x, r.y),
        g = a(d, u),
        h = n(g);
      if (Math.abs(Math.sin(h) * c) < 1 * e.size) {
        i(10);
      }
    }
  }
  return (function () {
    if (
      ((e.speed = 0),
      (e.bodyTurn = 0),
      (e.gunTurn = 0),
      (e.radarArc = 0.99),
      (e.name = "Kektank"),
      (e.victoryMessage = "Tank u come again!"),
      (e.color = "#25faa1"),
      (e.fillColor = "#000000"),
      (e.treadColor = "#089972"),
      (e.gunColor = "#52f2c7"),
      0 === e.iteration &&
        (e.retained = {
          lastPositions: [],
          weavePhase: 0,
          engageStrategies: [{ 60: 0 }, { 80: 0 }, { 100: 0 }],
          interceptStrategies: [
            { 1: 0 },
            { 2: 0 },
            { 3: 0 },
            { 4: 0 },
            { 5: 0 },
            { 6: 0 },
            { 7: 0 },
          ],
          shotMissiles: [],
          circleDir: Math.random() < 0.5 ? -1 : 1,
          currentEngagementStrategy: Math.floor(3 * Math.random()),
          currentInterceptStrategy: Math.floor(7 * Math.random()),
          dodgePhase: 0,
          recentAccuracy: 0,
        }),
      (function () {
        if (e.detectedTanks.length) {
          const t = e.detectedTanks[0];
          e.retained.lastPositions.push({ x: t.x, y: t.y }),
            e.retained.lastPositions.length >
              Object.keys(
                e.retained.interceptStrategies[
                  e.retained.currentInterceptStrategy
                ]
              )[0] && e.retained.lastPositions.shift();
        }
      })(),
      (function () {
        if (e.missileCollision) {
          const t = Object.keys(
            e.retained.engageStrategies[e.retained.currentEngagementStrategy]
          )[0];
          e.retained.engageStrategies[e.retained.currentEngagementStrategy][
            t
          ] += 1;
          const n = e.retained.engageStrategies
            .map((e, t) => ({ idx: t, value: e[Object.keys(e)[0]] }))
            .sort((e, t) => e.value - t.value)[0];
          e.retained.currentEngagementStrategy = n.idx;
        }
        for (let t of e.retained.shotMissiles)
          if (e.missiles[t.id].hit) {
            const n = Object.keys(
              e.retained.interceptStrategies[t.strategy]
            )[0];
            e.retained.interceptStrategies[t.strategy][n] += 1;
            const a = e.retained.interceptStrategies
              .map((e, t) => ({ idx: t, value: e[Object.keys(e)[0]] }))
              .sort((e, t) => e.value - t.value)[0];
            e.retained.currentInterceptStrategy = a.idx;
          } else if (e.missiles[t.id].miss) {
            const n = Object.keys(
              e.retained.interceptStrategies[t.strategy]
            )[0];
            e.retained.interceptStrategies[t.strategy][n] -= 1;
            const a = e.retained.interceptStrategies
              .map((e, t) => ({ idx: t, value: e[Object.keys(e)[0]] }))
              .sort((e, t) => e.value - t.value)[0];
            e.retained.currentInterceptStrategy = a.idx;
          }
        for (let t of e.retained.shotMissiles.slice(
          Math.max(e.retained.shotMissiles.length - 5, 0)
        )) {
          let n = 0,
            a = 0;
          if (
            (e.missiles[t.id].hit
              ? (n += 1)
              : e.missiles[t.id].miss && (a += 1),
            n + a > 0)
          ) {
            const t = n / (n + a);
            e.retained.recentAccuracy = t;
          }
        }
      })(),
      e.detectedTanks.length)
    ) {
      const g = e.detectedTanks[0],
        h = (function (t, n) {
          let a = 0,
            i = 0;
          const r = e.retained.lastPositions;
          if (r.length >= 2) {
            for (let e = 1; e < r.length; e++)
              (a += r[e].x - r[e - 1].x), (i += r[e].y - r[e - 1].y);
            (a /= r.length - 1), (i /= r.length - 1);
          }
          const s = t - e.x,
            o = n - e.y,
            c = a * a + i * i - 100,
            d = 2 * (s * a + o * i),
            u = s * s + o * o;
          let g;
          if (Math.abs(c) < 1e-4) g = -u / d;
          else {
            const e = d * d - 4 * c * u;
            if (e < 0) return null;
            const t = (-d + Math.sqrt(e)) / (2 * c),
              n = (-d - Math.sqrt(e)) / (2 * c);
            g = Math.min(t > 0 ? t : 1 / 0, n > 0 ? n : 1 / 0);
          }
          return !g || g <= 0 ? null : { x: t + a * g, y: n + i * g };
        })(g.x, g.y) || { x: g.x, y: g.y },
        y = ((t = h.x), (u = h.y), Math.hypot(t - e.x, u - e.y));
      y > 10 * e.size || e.energy > g.energy
        ? (function (t, c, d) {
            const u = s(t, c);
            e.retained.weavePhase =
              (e.retained.weavePhase + 0.1) % (2 * Math.PI);
            const g = +Object.keys(
                e.retained.engageStrategies[
                  e.retained.currentEngagementStrategy
                ]
              )[0],
              h = (u + Math.sin(e.retained.weavePhase) * g + 360) % 360;
            (e.bodyTurn = r(e.bodyAim, h, 1)),
              (e.speed = 1 * Math.random() + 0.1),
              (e.gunTurn = o(t, c));
            const y = 10 * e.gunTurn,
              l = e.bodyAim + e.gunAim + y,
              M = s(t, c),
              m = a(l, M),
              f = n(m);
            Math.abs(Math.sin(f) * d) < 1 * e.size && i(10);
          })(h.x, h.y, y)
        : (function (t) {
            const c = s(t.x, t.y);
            (e.retained.circleDir = e.retained.circleDir || 1),
              (e.bodyTurn = r(
                e.bodyAim,
                (c + 90 * e.retained.circleDir + 360) % 360,
                1
              )),
              (e.speed = 1 * Math.random() + 0.1),
              (e.gunTurn = o(t.x, t.y));
            const d = 10 * e.gunTurn,
              u = e.bodyAim + e.gunAim + d,
              g = s(t.x, t.y),
              h = a(u, g),
              y = n(h);
            Math.abs(Math.sin(y) * t.distance) < 1 * e.size && i(10);
          })({ x: h.x, y: h.y, distance: y }),
        c(h, y),
        d(h, y),
        e.energy < 50 && e.fire(0);
    } else (e.gunTurn = -0.75), c(), d();
    var t, u;
    return (e.gunTurn -= e.bodyTurn), e;
  })();
}
