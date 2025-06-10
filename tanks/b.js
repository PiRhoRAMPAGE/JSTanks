function main(tank, arena) {
  const saved = tank.retained;

  // ------- helpers -------
  const angleDifference = (a1, a2) => {
    a1 = (a1 + 360000) % 360;
    a2 = (a2 + 360000) % 360;
    if (a1 > 180) a1 -= 360;
    if (a2 > 180) a2 -= 360;
    return (a2 - a1 + 180) % 360 - 180;
  };
  const limit = (v, m) => Math.max(-m, Math.min(m, v));

  // ------- one‑time setup -------
  if (tank.iteration === 0) {
    tank.name        = "b";
    tank.color       = "#0022ff";
    tank.fillColor   = "#000066";
    tank.treadColor  = "#0033cc";
    tank.gunColor    = "#0022ff";
    tank.radarColor  = "#0022ff";
    tank.radarArc    = 6;          // much wider radar than Rampage

    saved.orbitDir   = 1;          // 1 = clockwise, -1 = counter‑clockwise
    saved.target     = null;
    saved.evasion    = 0;
  }

  // ------- target acquisition & radar -------
  if (tank.detectedTanks.length) {
    // Pick the closest enemy.
    tank.detectedTanks.sort((a, b) => a.distance - b.distance);
    saved.target = tank.detectedTanks[0];

    // keep radar roughly on the target so we don’t lose the lock
    tank.radarTurn = limit(
      angleDifference(tank.radarAim, tank.angleTo(saved.target.x, saved.target.y)) / 20,
      1
    );
  } else {
    saved.target  = null;
    tank.radarTurn = 1;            // 360° sweep in search mode
  }

  // ------- incoming‑missile evasion -------
  if (tank.detectedMissiles.length) {
    // most urgent missile = closest
    tank.detectedMissiles.sort((a, b) => a.distance - b.distance);
    const m         = tank.detectedMissiles[0];
    const trajectoryDifference  = Math.abs(angleDifference(tank.angleFrom(m.x, m.y), m.aim));
    if (trajectoryDifference < 4) {            // missile on collision course
      saved.evasion    = 25;       // dodge for the next ~25 frames
      saved.evasionDir = (trajectoryDifference < 0 ? 1 : -1);  // choose a bank direction
    }
  }
  if (saved.evasion > 0) saved.evasion--;

  // ------- wall avoidance -------
  const margin  = tank.size * 4;
  const nextX   = tank.x + Math.cos(tank.bodyAim * DEGREES) * tank.actualSpeed * 10;
  const nextY   = tank.y + Math.sin(tank.bodyAim * DEGREES) * tank.actualSpeed * 10;
  const nearWall =
    Math.abs(nextX) > arena.width / 2  - margin ||
    Math.abs(nextY) > arena.height / 2 - margin;

  if (nearWall) {
    // steer toward centre if we’re getting too close
    const toCentre = tank.angleTo(0, 0);
    const diff     = angleDifference(tank.bodyAim, toCentre);
    tank.bodyTurn  = limit(diff / 90, 1);
    tank.speed     = 1;
  } else if (saved.evasion) {
    // dedicated dodge manoeuvre while evading a missile
    tank.bodyTurn = saved.evasionDir || 1;
    tank.speed    = 1;
  } else if (saved.target) {
    // ------- main movement: constant orbit around the target -------
    const target    = saved.target;
    const desiredR  = arena.width / 4;               // desired orbit radius
    const baseAngle = tank.angleTo(target.x, target.y);

    // switch orbit direction every 600 frames to stay unpredictable
    if (tank.iteration % 600 === 0) saved.orbitDir *= -1;

    let desired     = baseAngle + 90 * saved.orbitDir; // perfect circle path
    desired        += ((target.distance - desiredR) / desiredR) * -30 * saved.orbitDir; // radial correction
    const diff      = angleDifference(tank.bodyAim, desired);

    tank.bodyTurn   = limit(diff / 90, 1);
    tank.speed      = 1;
  } else {
    // wander when no target in sight
    tank.bodyTurn = 0.5;
    tank.speed    = 1;
  }

  // ------- gun handling & firing -------
  if (saved.target) {
    const tgt = saved.target;

    // linear‑lead intercept calculation (iterative refinement)
    const vx = tgt.actualSpeed * Math.cos(tgt.bodyAim * DEGREES);
    const vy = tgt.actualSpeed * Math.sin(tgt.bodyAim * DEGREES);
    let time = tgt.distance / MISSILE_SPEED;
    let px   = tgt.x + vx * time;
    let py   = tgt.y + vy * time;
    for (let i = 0; i < 4; i++) {
      time = tank.distanceTo(px, py) / MISSILE_SPEED;
      px   = tgt.x + vx * time;
      py   = tgt.y + vy * time;
    }

    const aim     = tank.angleTo(px, py);
    const gunDiff = angleDifference(tank.bodyAim + tank.gunAim, aim);
    tank.gunTurn  = limit(gunDiff / 10, 1);

    // pull trigger when cool and roughly on target
    if (Math.abs(gunDiff) < 3 && tank.gunHeat === 0) {
      const firePower = Math.min(MAX_MISSILE_ENERGY, Math.max(10, tank.energy / 10));
      tank.fire(firePower);
    }
  } else {
    tank.gunTurn = 0;  // keep gun steady while searching
  }

  // ------- cosmetic feedback -------
  tank.indicator.color     = saved.evasion ? "#ff00ff" : "#00ff00";
  tank.indicator.intensity = saved.evasion ? 1 : 0.3;

  return tank;
}
