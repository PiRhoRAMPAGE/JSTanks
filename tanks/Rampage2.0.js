function main(tank, arena) {
    // --- 1. INITIALIZATION & STATE ---
    // 1.1 Initialize variables and constants
    let forceX = 0, forceY = 0;
    const memory = tank.retained;
    const target = tank.detectedTanks.sort((a, b) => {
        const aPriority = (1 - a.distance / MAX_DISTANCE) * (1 - a.energy / MAX_TANK_ENERGY);
        const bPriority = (1 - b.distance / MAX_DISTANCE) * (1 - b.energy / MAX_TANK_ENERGY);
        return bPriority - aPriority;
    })[0];
    const weights = {
        walls: 20000,
        missiles: 10000,
        powerups: 5000,
        targets: 1000,
        center: 100,
    };

    // 1.2 Imitialize memory
    if (tank.iteration === 0) {
        memory.target = target;
        memory.powerupsSeen = 0;
        memory.powerupsCollected = 0;
        memory.powerupsCollectedByTarget = 0;
        memory.powerups = [];
        memory.targetHistory = [];
        memory.timeTillRadarSweep = 0;
    }

    // --- 2. HELPER UTILITIES ---
    // 2.1 Normalizes angles
    const normalizeAngle = (angle) => {
        angle %= 360;
        if (angle > 180) angle -= 360;
        if (angle < -180) angle += 360;
        return angle;
    };
    // 2.2 Applies forces to force vectors
    const applyForce = (directionRad, magnitude) => {
        forceX += Math.cos(directionRad) * magnitude;
        forceY += Math.sin(directionRad) * magnitude;
    };
    // 2.3 Calculates perpendicular component of target trajectory
    const getPerpendicularComponent = (t) => {
        const angleDifference = normalizeAngle(t.angleTo - t.bodyAim);
        return Math.sin(angleDifference * RADIANS);
    };
    // 2.4 Predicts the future position of a tank or missile
    const predictPosition = (t, iterations) => {
        let predicted = { ...t };
        const initialTrajectory = t.bodyAim || t.aim;
        const history = tank.retained.targetHistory;
        const recentStates = history.slice(-7);
        const weightSum = (recentStates.length * (recentStates.length + 1)) / 2;
        let avgRotationRate = 0;
        let avgSpeed = 0;
        let isContinuous = true;
        recentStates.slice(1).forEach((state, i) => {
            const weight = i;
            const prev = recentStates[i];            
            if (!isContinuous || prev.iteration !== state.iteration - 1) {
                isContinuous = false;
                return;
            }
            const stateAim = state.bodyAim || state.aim;
            const prevAim = prev.bodyAim || prev.aim;            
            avgRotationRate += normalizeAngle(stateAim - prevAim) * weight;
            avgSpeed += state.actualSpeed * weight;
        });
        avgRotationRate /= weightSum;
        avgSpeed /= weightSum;
        let currentRotation = initialTrajectory * RADIANS;
        const stepRotation = avgRotationRate * RADIANS;
        for (let i = 0; i < iterations; i++) {
            let vx = Math.cos(currentRotation) * avgSpeed;
            let vy = Math.sin(currentRotation) * avgSpeed;            
            const nextX = predicted.x + vx;
            const nextY = predicted.y + vy;
            if (t.bodyAim) {
                vx = (nextX - tank.size < MIN_X || nextX + tank.size > MAX_X) ? 0 : vx;
                vy = (nextY - tank.size < MIN_Y || nextY + tank.size > MAX_Y) ? 0 : vy;
            }
            predicted.x += vx;
            predicted.y += vy;
            currentRotation += stepRotation;
        }
        predicted.angleTo = tank.angleTo(predicted.x, predicted.y);
        predicted.distance = tank.distanceTo(predicted.x, predicted.y);
        predicted.energy -= Math.abs(avgSpeed) * iterations * MOVEMENT_COST_MULTIPLIER;
        return predicted;
    };
    // 2.5 Caclulates recent accuracy over specified number of frames
    const getRecentAccuracy = (frames) => {
        const allMissiles = Object.values(tank.missiles);
        const recentMissiles = allMissiles.filter(m => (tank.iteration - m.iterationFired) <= frames);
        const completedShots = recentMissiles.filter(m => m.hit || m.miss);
        if (completedShots.length === 0) return 0.5;
        const hits = completedShots.filter(m => m.hit).length;
        return hits / completedShots.length;
    };

    // --- 3. AESTHETICS ---
    // 3.1 Default colors
    tank.color = "#FF0000";
    tank.fillColor = "#000000";
    tank.indicator.color = "#00ff00";
    tank.indicator.intensity = (tank.iteration >> 2) & 1;
    // 3.2 Backup version colors
    if (tank.name.indexOf(".bak") > -1) { 
        tank.color = "#00FF00";
        tank.fillColor = "#000000";
        tank.indicator.color = "#ff0000";
        tank.indicator.intensity = (tank.iteration >> 2) & 1;
    }

    // --- 4. COLLECT MISSILE DATA ---
    const incomingMissiles = tank.detectedMissiles.filter(m => {
        const safetyBuffer = tank.size * 2.5;
        const dx = m.x - tank.x;
        const dy = m.y - tank.y;
        const mvx = Math.cos(m.aim * RADIANS) * MISSILE_SPEED;
        const mvy = Math.sin(m.aim * RADIANS) * MISSILE_SPEED;
        const dotProduct = dotProduct2D(mvx, mvy, dx, dy);
        if (dotProduct >= 0) return false; // Missile moving away
        const timeToCpa = -dotProduct / (MISSILE_SPEED ** 2);
        const cpaX = m.x + mvx * timeToCpa;
        const cpaY = m.y + mvy * timeToCpa;
        const distAtCpa = tank.distanceTo(cpaX, cpaY);
        m.priority = (
            0.50 * (1 - (m.distance / MAX_DISTANCE) ** 2) +
            0.35 * (1 - (distAtCpa / safetyBuffer) ** 2) +
            0.15 * (m.energy / MAX_MISSILE_ENERGY) 
        );
        return distAtCpa < safetyBuffer;
    }).sort((a, b) => b.priority - a.priority);

    // --- 5. COLLECT POWERUP DATA ---
    // 5.1 Update known powerups
    memory.powerups = memory.powerups.filter(p => {
        p.duration--;
        p.distance = tank.distanceTo(p.x, p.y);
        let isCollected = tank.powerupCollected || p.distance < tank.size * 2;
        if (isCollected) memory.powerupsCollected++;
        if (!isCollected && tank.detectedTanks.length > 0) {
            isCollected = tank.detectedTanks.some(enemy => {
                const distToEnemy = getDistance(enemy.x, enemy.y, p.x, p.y);
                if (distToEnemy <= enemy.size * 2) {
                    memory.powerupsCollectedByTarget++;
                    return true;
                }
                return false;
            });
        }
        const isExpired = p.duration <= 0;
        return !isCollected && !isExpired;
    });

    // 5.2 Scan for new powerups
    memory.timeTillRadarSweep--;
    const powerupsCollectedByMe = memory.powerupsCollected;
    const powerupsCollectedTotal = memory.powerupsCollected + memory.powerupsCollectedByTarget;
    const powerupFitness = powerupsCollectedByMe / powerupsCollectedTotal || 0.5;
    const scanInterval = Math.floor(45 + 10 * powerupFitness);
    if (tank.iteration % scanInterval === 0 || tank.radarAim !== 0) {
        tank.radarTurn = Math.sign(tank.radarAim) || 1; 
    }

    // 5.3 Remember any newly detected powerups
    tank.detectedPowerups.forEach(newP => {
        const exists = memory.powerups.find(p => p.x === newP.x && p.y === newP.y);
        if (!exists) {
            memory.powerupsSeen++;
            memory.powerups.push(newP)
        }
        else exists.duration = newP.duration;
    });

    // --- 6. TARGETING AND OFFENSE ---
    if (target) {
        // 6.1 Predictive aiming 
        const eventRecord = { ...target };
        let predicted = { ...target };
        let missileTime = target.distance / MISSILE_SPEED;
        let gunWorldAngle = tank.bodyAim + tank.gunAim;
        let turretTurnTime = Math.abs(normalizeAngle(target.angleTo - gunWorldAngle)) / MAX_GUN_TURN_DEGREES;
        for (let i = 0; i < missileTime; i++) {
            const lastX = predicted.x;
            const lastY = predicted.y;
            const prediction = predictPosition(target, missileTime + turretTurnTime);
            predicted.x = lastX + (prediction.x - lastX) / 2;
            predicted.y = lastY + (prediction.y - lastY) / 2;
            const newDist = tank.distanceTo(predicted.x, predicted.y);
            missileTime = newDist / MISSILE_SPEED;
            const angleToNewSpot = tank.angleTo(predicted.x, predicted.y);
            turretTurnTime = Math.abs(normalizeAngle(angleToNewSpot - gunWorldAngle)) / MAX_GUN_TURN_DEGREES;
            if (getDistance(lastX, lastY, predicted.x, predicted.y) < MAX_ACTUAL_SPEED / 2) {
                break;
            }
        }
        eventRecord.predicted = predicted;

        // 6.2 Wall-pinning logic 
        const normalizedTargetDistance = predicted.distance / MAX_DISTANCE;
        const aimOffset = (0.75 - normalizedTargetDistance / 2) * (normalizedTargetDistance ** 2);
        const finalAngleToTarget = tank.angleTo(predicted.x, predicted.y);
        const targetWallAngle = arena.nearestWallAngle(predicted.x, predicted.y);
        let targetAngleToRef = normalizeAngle(targetWallAngle - finalAngleToTarget);
        // 6.3 Powerup denial logic
        if (memory.powerups.length > 0) { 
            const targePowerupAngle = getAngle(predicted.x, predicted.y, memory.powerups[0].x, memory.powerups[0].y);
            targetAngleToRef = normalizeAngle(180 + targePowerupAngle - finalAngleToTarget);
        }
        const aimBias = (targetAngleToRef > 0) ? -aimOffset : aimOffset;
        let desiredGunAngle = normalizeAngle(finalAngleToTarget + aimBias) - (tank.bodyAim + tank.gunAim);
        desiredGunAngle = normalizeAngle(desiredGunAngle);        
        tank.gunTurn = clamp(desiredGunAngle / MAX_GUN_TURN_DEGREES, -1, 1);

        // 6.4 Firing logic
        const aimThreshold = 10 - 9 * Math.sqrt(target.distance / MAX_DISTANCE);
        const gunError = Math.abs(desiredGunAngle);
        if (gunError < aimThreshold) {
            const distanceFactor = Math.max(0.1, 1 - normalizedTargetDistance);
            const trajectoryFactor = 1 - Math.abs(getPerpendicularComponent(target));
            const precisionFactor = (aimThreshold - gunError) / aimThreshold;
            const recentAccuracy = getRecentAccuracy(50);
            let firePower = MAX_MISSILE_ENERGY * (1.25 + 1.75 * recentAccuracy); 
            if (tank.powerup.type === "guncool") firePower /= 2; 
            if (tank.powerup.type === "firepower") firePower *= 2;
            firePower *= (trajectoryFactor * 0.75 + 0.25);
            firePower *= (distanceFactor ** 2 * 0.9 + 0.1);
            firePower *= (precisionFactor * 0.1 + 0.9);
            firePower = Math.min(MAX_MISSILE_ENERGY, firePower);
            const energyInMissile = firePower * MISSILE_ENERGY_MULTIPLIER;
            const energyToTravel = (predicted.distance / MISSILE_SPEED) * MISSILE_FLIGHT_COST;
            const maxEnergyNeeded = predicted.energy / MISSILE_ENERGY_MULTIPLIER;
            const costToMe = firePower / tank.energy;
            const costToTarget = Math.max(0, energyInMissile - energyToTravel) / target.energy;
            const depletionRate = costToMe / costToTarget * Math.max(0.1, recentAccuracy);
            const energyRatio = tank.energy / target.energy;
            const missileEnergyOk = energyToTravel < energyInMissile;
            const hasGoodShot = depletionRate < energyRatio && missileEnergyOk;
            const applyingPressure = missileEnergyOk && Math.random() < energyRatio;
            if (hasGoodShot || applyingPressure) {
                const travelTax = (predicted.distance / MISSILE_SPEED) * MISSILE_FLIGHT_COST;
                const killShotPower = (maxEnergyNeeded + travelTax) * 1.05;
                firePower = Math.min(firePower, killShotPower);
                tank.fire(firePower);
            }
        }
        eventRecord.iteration = tank.iteration;
        memory.targetHistory.push(eventRecord);
        memory.target = eventRecord;
    } 
    
    // 6.5 Scan for lost target
    else if (tank.radarAim === 0) {
        tank.gunTurn = 1;
    }

    // --- 7. NAVIGATION & STEERING ---
    // 7.1 Center Attraction (Idle behavior)
    if (tank.detectedMissiles.length === 0 && memory.powerups.length === 0) {
        const orbitTheta = tank.iteration;
        const centerX = 100 * Math.cos(orbitTheta * RADIANS);
        const centerY = 100 * Math.sin(orbitTheta * RADIANS);
        const centerAngle = tank.angleTo(centerX, centerY) * RADIANS;
        applyForce(centerAngle, weights.center);
    }

    // 7.2 Missile Evasion
    let missileThreats = 0;
    for (const m of incomingMissiles) {
        const missileAngle = tank.angleTo(m.x, m.y);
        const relativeAngle = normalizeAngle(missileAngle - m.aim);        
        const normalizedDistance = m.distance / MAX_DISTANCE;
        const rawStrafe = ((1 - normalizedDistance) * 2) ** 2;
        const strafeAmount = clamp(rawStrafe, 0, 1);        
        const strafeDirection = 90 * Math.sign(relativeAngle) * strafeAmount;
        const evasionAngle = (missileAngle + strafeDirection) * RADIANS;
        const repulsionForce = weights.missiles * (1 + m.priority);        
        applyForce(evasionAngle, repulsionForce);
        missileThreats++;
    }

    // 7.3 Powerup Seeking
    let seekingPowerups = 0;
    for (const p of memory.powerups) {
        const enemy = target || tank;        
        const enemyAccess = 1 - getDistance(enemy.x, enemy.y, p.x, p.y) / MAX_DISTANCE;
        const myAccess = 1 - tank.distanceTo(p.x, p.y) / MAX_DISTANCE;
        const canReachInTime = p.duration >= (p.distance / MAX_ACTUAL_SPEED);
        const riskValue = (enemyAccess * enemy.energy / MAX_TANK_ENERGY) * (p.distance / MAX_DISTANCE);
        const rewardValue = (myAccess * tank.energy / MAX_TANK_ENERGY) * (p.amount / MAX_POWERUP_AMOUNT);
        if (rewardValue > riskValue && canReachInTime) {
            const angleToP = tank.angleTo(p.x, p.y) * RADIANS;
            const attractionForce = weights.powerups / Math.max(1, p.distance);
            applyForce(angleToP, attractionForce);
            seekingPowerups++;
        }
    }

    // 7.4 Target Engagement (Dynamic distancing)
    let targetThreats = 0;
    if (target) {
        const targetAngleRad = tank.angleTo(target.x, target.y) * RADIANS;
        const accuracyFactor = tank.aimAccuracy || 0.5;
        const energyDisadvantage = 1 - tank.energy / (tank.energy + target.energy);        
        const idealDistance = MAX_DISTANCE * (accuracyFactor * energyDisadvantage);
        let engagementForce = (target.distance - idealDistance) / 10;
        engagementForce = clamp(engagementForce, -weights.targets, weights.targets);
        applyForce(targetAngleRad, engagementForce);        
        if (target.distance < Math.max(tank.size * 3, idealDistance / 4)) {
            targetThreats++;
        }
    }

    // 7.5 Wall Avoidance
    let desiredSpeed = 1;
    const wallDist = arena.nearestWallDistance(tank.x, tank.y);
    const wallAngle = arena.nearestWallAngle(tank.x, tank.y);
    const wallSafetyMargin = tank.size * (8 + 2 * Math.abs(tank.speed));
    if (wallDist < wallSafetyMargin) {
        const awayAngleRad = (wallAngle + 180) * RADIANS;
        const severityFactor = 1 - (wallDist / wallSafetyMargin);
        applyForce(awayAngleRad, weights.walls * severityFactor ** 2);
        desiredSpeed = 0.05 + 0.45 * (1 - severityFactor);
    }

    // --- 8. ACTUATION ---
    const totalForceMag = getDistance(0, 0, forceX, forceY);
    if (totalForceMag > 0.1) {
        const desiredBodyAngle = getAngle(0, 0, forceX, forceY);
        const bodyTurnDiff = normalizeAngle(desiredBodyAngle - tank.bodyAim);        
        tank.bodyTurn = clamp(bodyTurnDiff / MAX_BODY_TURN_DEGREES, -1, 1);
        tank.speed = desiredSpeed;
        if (Math.abs(bodyTurnDiff) > 90) {
            tank.bodyTurn *= -1;
            tank.speed *= -1;
        }
    }

    // 8.1 Counter-steer gun to maintain aim while body turns
    tank.gunTurn -= tank.bodyTurn * MAX_BODY_TURN_DEGREES / MAX_GUN_TURN_DEGREES;

    // 8.2 Handle radar scans (if radar isn't aligned with gun continue to rotate in the same direction until it is.)
    if (Math.abs(tank.radarAim) > 0) tank.radarTurn = Math.sign(tank.radarAim);

    // 9. Energy Conservation
    const hasLowEnergy = tank.energy < (memory.target || tank).energy * 3;
    const hasActiveObjectives = missileThreats || targetThreats || seekingPowerups;
    if (hasLowEnergy && !hasActiveObjectives) {
        tank.speed = 0;
    }

    return tank;
}