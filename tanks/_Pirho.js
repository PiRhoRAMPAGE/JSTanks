function main(tank, arena) {
    // --- HELPER CONSTANTS (Assuming these are globally available or passed) ---
    const RADIANS = Math.PI / 180;
    const DEGREES = 180 / Math.PI;
    const MISSILE_SPEED = 10; // Example, replace with actual constant
    const MAX_MISSILE_ENERGY = 100; // Example
    const MISSILE_ENERGY_MULTIPLIER = 1; // Example
    const MAX_GUN_TURN_DEGREES = 10; // Example
    const MAX_BODY_TURN_DEGREES = 5; // Example
    const MAX_DISTANCE = Math.sqrt(arena.width * arena.width + arena.height * arena.height); // Example
    const ARENA_WIDTH = arena.width; // Example
    const ARENA_HEIGHT = arena.height; // Example
    const MAX_TANK_ENERGY = 1000; // Example

    // --- HELPER FUNCTIONS ---
    const normalizeAngle = (angle) => {
        angle %= 360;
        if (angle > 180) angle -= 360;
        if (angle < -180) angle += 360;
        return angle;
    };

    const perpendicularSpeedComponent = (target) => {
        let angleDifference = (target.angleTo - target.bodyAim + 360000) % 360;
        return Math.sin(angleDifference * RADIANS);
    };

    // Predict target position
    const predictTargetPosition = (target, time) => {
        if (!target) return null;
        const predictedX = target.x + Math.cos(target.bodyAim * RADIANS) * target.speed * time;
        const predictedY = target.y + Math.sin(target.bodyAim * RADIANS) * target.speed * time;
        return { x: predictedX, y: predictedY };
    };

    // --- INITIALIZATION ---
    const memory = tank.retained;
    const target = tank.detectedTanks[0]; // Assuming only one target
    const seenPowerups = tank.detectedPowerups;

    if (tank.iteration === 0) {
        tank.radarArc = 20; // Wider radar arc for better initial detection
        memory.knownPowerups = [];
        memory.lastTargetX = null;
        memory.lastTargetY = null;
    }

    // --- AESTHETICS (Because a winning bot should look good) ---
    tank.color = "#FF1493"; // Deep Pink
    tank.fillColor = "#8A2BE2"; // Blue Violet
    tank.indicator.intensity = 1;
    tank.indicator.color = "#00FFFF"; // Cyan
    if ((tank.iteration >> 3) & 1) { // A subtle blink effect
        tank.indicator.intensity = 0.5;
    }

    // 1. POWERUP LOGIC
    // --- Update powerups in memory ---
    const freshPowerups = [];
    seenPowerups.forEach(newP => {
        const existing = memory.knownPowerups.find(p => p.x === newP.x && p.y === newP.y);
        if (existing) {
            existing.duration = newP.duration;
            existing.distance = tank.distanceTo(newP.x, newP.y);
        } else {
            newP.distance = tank.distanceTo(newP.x, newP.y);
            memory.knownPowerups.push(newP);
        }
        freshPowerups.push(newP);
    });

    // Remove collected or expired powerups
    memory.knownPowerups = memory.knownPowerups.filter(p => {
        p.duration--;
        // Check if collected by anyone
        let collected = tank.powerupCollected && (tank.powerupCollected.x === p.x && tank.powerupCollected.y === p.y);
        if (!collected && target) { // Check if collected by enemy
            const distToEnemy = tank.distanceTo(target.x, target.y);
            if (distToEnemy < target.size * 2) { // Rough check for proximity
                 // More accurate check: predict enemy position and if it would intersect powerup
                 const enemyPredictedPos = predictTargetPosition(target, 1); // Predict one step
                 if (enemyPredictedPos && tank.distanceBetween(enemyPredictedPos.x, enemyPredictedPos.y, p.x, p.y) < target.size * 1.5) {
                    collected = true;
                 }
            }
        }
        const expired = p.duration <= 0;
        const stillFresh = freshPowerups.some(fp => fp.x === p.x && fp.y === p.y); // Keep if still detected this iteration
        return !collected && !expired && stillFresh;
    });

    // Sort powerups by distance (closer ones first)
    memory.knownPowerups.sort((a, b) => a.distance - b.distance);

    // 2. MISSILE LOGIC (Evade and intercept if necessary)
    const incomingMissiles = tank.detectedMissiles.filter(m => {
        const dx = m.x - tank.x;
        const dy = m.y - tank.y;
        const missileSpeedVecX = Math.cos(m.aim * RADIANS) * MISSILE_SPEED;
        const missileSpeedVecY = Math.sin(m.aim * RADIANS) * MISSILE_SPEED;

        // Relative velocity vector
        const relVelX = missileSpeedVecX - Math.cos(tank.bodyAim * RADIANS) * tank.speed;
        const relVelY = missileSpeedVecY - Math.sin(tank.bodyAim * RADIANS) * tank.speed;

        // Calculate time to closest point of approach (CPA)
        const dotProduct = (dx * relVelX + dy * relVelY);
        const relSpeedSquared = (relVelX * relVelX + relVelY * relVelY);
        const timeToCPA = relSpeedSquared > 0 ? -dotProduct / relSpeedSquared : 0;

        if (timeToCPA < 0 || timeToCPA > 100) return false; // Only consider missiles approaching and within a reasonable time horizon

        const cpaX = m.x + missileSpeedVecX * timeToCPA;
        const cpaY = m.y + missileSpeedVecY * timeToCPA;
        const distAtCPA = tank.distanceTo(cpaX, cpaY);

        return distAtCPA < tank.size * 3; // Threat radius slightly larger than tank size
    });

    // 3. TARGET LOGIC
    let desiredGunAim = 0;
    if (target) {
        memory.lastTargetX = target.x;
        memory.lastTargetY = target.y;

        // Predictive aiming
        const leadTime = target.distance / MISSILE_SPEED; // Time for missile to reach target
        const predictedTarget = predictTargetPosition(target, leadTime);

        if (predictedTarget) {
            desiredGunAim = tank.angleTo(predictedTarget.x, predictedTarget.y);
        } else {
            desiredGunAim = tank.angleTo(target.x, target.y);
        }

        desiredGunAim = normalizeAngle(desiredGunAim - (tank.bodyAim + tank.gunAim));
        tank.gunTurn = Math.max(-1, Math.min(1, desiredGunAim / MAX_GUN_TURN_DEGREES));

        // Firing logic: only fire if aimed well and enough energy
        const absGunOffset = Math.abs(desiredGunAim);
        const aimThreshold = 2 + (target.distance / MAX_DISTANCE) * 3; // Wider threshold for farther targets
        if (absGunOffset < aimThreshold && tank.energy > 50) { // Ensure enough energy
            let firePower = 100; // Default power
            if (target.distance < ARENA_WIDTH / 4) { // Close range, more powerful shots
                firePower = Math.min(MAX_MISSILE_ENERGY, tank.energy * 0.75);
            } else if (target.distance < ARENA_WIDTH / 2) { // Mid range
                firePower = Math.min(MAX_MISSILE_ENERGY, tank.energy * 0.5);
            } else { // Long range, conserve energy
                firePower = Math.min(MAX_MISSILE_ENERGY, tank.energy * 0.25);
            }
            if (firePower > 10) { // Minimum power to fire
                tank.fire(firePower);
            }
        }
    } else if (memory.lastTargetX !== null) {
        // If no target, turn gun to last known target position
        desiredGunAim = tank.angleTo(memory.lastTargetX, memory.lastTargetY);
        desiredGunAim = normalizeAngle(desiredGunAim - (tank.bodyAim + tank.gunAim));
        tank.gunTurn = Math.max(-1, Math.min(1, desiredGunAim / MAX_GUN_TURN_DEGREES));
    } else {
        // If no target and no last known position, sweep radar and gun
        tank.gunTurn = 1;
    }


    // 4. NAVIGATION LOGIC
    let forceX = 0;
    let forceY = 0;

    const applyForce = (direction, magnitude) => {
        forceX += Math.cos(direction * RADIANS) * magnitude;
        forceY += Math.sin(direction * RADIANS) * magnitude;
    };

    // --- MISSILE EVASION ---
    for (const m of incomingMissiles) {
        const missileAngle = tank.angleTo(m.x, m.y);
        const missileDistance = tank.distanceTo(m.x, m.y);

        // Calculate perpendicular evasion direction
        const relativeAngleToMissile = normalizeAngle(missileAngle - tank.bodyAim);
        const evasionDirectionOffset = (relativeAngleToMissile > 0 ? -90 : 90);
        const evasionAngle = normalizeAngle(missileAngle + evasionDirectionOffset);

        const repulsionMagnitude = 50000 / Math.max(1, missileDistance); // Stronger repulsion for closer missiles
        applyForce(evasionAngle, repulsionMagnitude);
    }

    // --- POWERUP SEEKING (Prioritize closest and most needed) ---
    if (memory.knownPowerups.length > 0) {
        const closestPowerup = memory.knownPowerups[0];
        const powerupAngle = tank.angleTo(closestPowerup.x, closestPowerup.y);
        const attractionMagnitude = 10000 / Math.max(1, closestPowerup.distance);
        applyForce(powerupAngle, attractionMagnitude);
    }

    // --- TARGET ENGAGEMENT (Maintain optimal distance) ---
    if (target) {
        const optimalDistance = ARENA_WIDTH * 0.3; // A good mid-range
        const distanceError = target.distance - optimalDistance;
        const orbitAngle = tank.angleTo(target.x, target.y);

        // Adjust attraction/repulsion based on distance error
        applyForce(orbitAngle, distanceError * 50);

        // Add tangential force to orbit
        const orbitDirection = normalizeAngle(orbitAngle + (tank.iteration % 200 < 100 ? 90 : -90)); // Change orbit direction periodically
        applyForce(orbitDirection, 1000);
    }

    // --- WALL AVOIDANCE ---
    const wallDistance = arena.nearestWallDistance(tank.x, tank.y);
    const wallAngle = arena.nearestWallAngle(tank.x, tank.y);
    const wallDistanceThreshold = tank.size * 10; // More aggressive wall avoidance
    if (wallDistance < wallDistanceThreshold) {
        const awayAngle = normalizeAngle(wallAngle + 180);
        const severity = 1 - (wallDistance / wallDistanceThreshold);
        applyForce(awayAngle, 100000 * severity * severity); // Quadratic increase in repulsion
    }

    // --- APPLY FINAL FORCES TO TANKS DIRECTION VECTOR ---
    const totalForceMagnitude = Math.sqrt(forceX * forceX + forceY * forceY);
    if (totalForceMagnitude > 0.1) {
        const targetBodyAngle = Math.atan2(forceY, forceX) * DEGREES;
        const turnDiff = normalizeAngle(targetBodyAngle - tank.bodyAim);
        tank.bodyTurn = Math.max(-1, Math.min(1, turnDiff / MAX_BODY_TURN_DEGREES));
        tank.speed = 1; // Always try to move at full speed if there's a force
    } else {
        tank.speed = 0; // Stop if no significant forces
    }

    // --- FINAL ADJUSTMENTS ---
    // Ensure gun turn doesn't overcompensate for body turn
    tank.gunTurn = normalizeAngle(tank.gunTurn - tank.bodyTurn);
    tank.speed *= (1 - (wallDistanceThreshold - wallDistance) / wallDistanceThreshold); // Slow down near walls

    // 5. CONSERVE ENERGY (More intelligent conservation)
    const criticalEnergyThreshold = MAX_TANK_ENERGY * 0.2;
    const lowEnergy = tank.energy < criticalEnergyThreshold;
    const noImmediateThreat = incomingMissiles.length === 0 && (!target || target.distance > ARENA_WIDTH * 0.5);

    if (lowEnergy && noImmediateThreat) {
        tank.speed = 0;
        tank.gunTurn = 0;
        tank.bodyTurn = 0;
        // Only seek powerups if low energy
        if (memory.knownPowerups.length > 0) {
            const closestPowerup = memory.knownPowerups[0];
            const powerupAngle = tank.angleTo(closestPowerup.x, closestPowerup.y);
            const attractionMagnitude = 20000 / Math.max(1, closestPowerup.distance);
            applyForce(powerupAngle, attractionMagnitude); // Apply force directly for movement
            const totalForceMagnitudeForEnergy = Math.sqrt(forceX * forceX + forceY * forceY);
            if (totalForceMagnitudeForEnergy > 0.1) {
                const targetBodyAngleForEnergy = Math.atan2(forceY, forceX) * DEGREES;
                const turnDiffForEnergy = normalizeAngle(targetBodyAngleForEnergy - tank.bodyAim);
                tank.bodyTurn = Math.max(-1, Math.min(1, turnDiffForEnergy / MAX_BODY_TURN_DEGREES));
                tank.speed = 0.7; // Slower speed to conserve
            }
        }
    }


    return tank;
}