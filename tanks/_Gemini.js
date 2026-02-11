/*
     I tried making Gemini build an opponent...
     Had to hold it's hand through every step of the process,
     and it still has a lower win rate than the tank I made
     even with the genetic algorithm, it never really improves.
     I am keeping it in the pool because it does outperform
     most of the other tanks.
*/

function main(tank, arena) {
    const STORAGE_KEY = `${tank.name}_DNA`;
    const mem = tank.retained;
    // Loads DNA from localStorage
    const getDNA = () => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) return JSON.parse(stored);
        } catch (e) {}
        return {
            generation: 0,
            bestFitness: -Infinity,
            momentum: {},
            dna: {
                wallFear: 8000,
                missileFear: 7000,
                powerupGreed: 6000,
                targetDistance: ARENA_WIDTH / 2,
                targetDistanceWeight: 20,
                aggression: 1,
                gunAimThresh: 10,
                firingWeightDistance: 0.90,
                firingWeightTrajectory: 0.75,
                firingWeightAccuracy: 0.1,
                powerupCaution: 0.5,
                scanInterval: 50,
                predictionSampleSize: 7,
                missileSafetyBuffer: 2.5,
                missileThreatDistanceWeight: 0.5,
                missileThreatAccuracyWeight: 0.35,
                missileThreatEnergyWeight: 0.15,
                wallSafetyBuffer: 2.5,
                targetSafetyBuffer: 2.5,
            }
        };
    };
    // Saves DNA to localStorage
    const saveDNA = (record) => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(record)) } catch (e) {} };
    // Predicts the future position of a tank or missile
    const predictPosition = (t, iterations) => {
        let predicted = { ...t };
        const initialTrajectory = t.bodyAim || t.aim;
        const history = tank.retained.targetHistory;
        const recentStates = history.slice(-Math.round(DNA.predictionSampleSize));
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
    // Calculates the normalized lateral speed of a target
    const getPerpendicularComponent = (t) => {
        const angleDifference = normalizeAngle(t.angleTo - t.bodyAim);
        return Math.sin(angleDifference * RADIANS);
    };        
    // Calculates tanks aim accuracy over specified number of frames
    const getRecentAccuracy = (frames) => {
        const allMissiles = Object.values(tank.missiles);
        const recentMissiles = allMissiles.filter(m => (tank.iteration - m.iterationFired) <= frames);
        const completedShots = recentMissiles.filter(m => m.hit || m.miss);
        if (completedShots.length === 0) return 0.5;
        const hits = completedShots.filter(m => m.hit).length;
        return hits / completedShots.length;
    };
    // Calculates the saftey score of a particular path
    const getPathScore = (x, y) => {
        let weight = 0;
        const wallDist = Math.min(x - MIN_X, MAX_X - x, y - MIN_Y, MAX_Y - y);
        // Walls
        if (wallDist < TANK_SIZE * DNA.wallSafetyBuffer) weight -= DNA.wallFear / Math.max(1, wallDist);
        // Missiles
        incomingMissiles.forEach(m => { weight -= DNA.missileFear / (m.distance + 1) });
        // Targets
        if (target) {
            weight -= Math.abs(target.distance - DNA.targetDistance) * DNA.targetDistanceWeight;
            if (target.distance < tank.size * DNA.targetSafetyBuffer) target.isTooClose == true;
        }
        // Powerups
        mem.powerups.forEach(p => {
            const enemy = mem.target || tank;        
            const enemyAccess = 1 - getDistance(enemy.x, enemy.y, p.x, p.y) / MAX_DISTANCE;
            const myAccess = 1 - tank.distanceTo(p.x, p.y) / MAX_DISTANCE;
            const canReachInTime = p.duration >= (p.distance / MAX_ACTUAL_SPEED);
            const riskValue = (enemyAccess * enemy.energy / MAX_TANK_ENERGY) * (p.distance / MAX_DISTANCE);
            let rewardValue = (myAccess * tank.energy / MAX_TANK_ENERGY) * (p.amount / MAX_POWERUP_AMOUNT);
            rewardValue -= DNA.powerupCaution - 0.5;
            if (rewardValue > riskValue && canReachInTime) {
                const d = getDistance(x, y, p.x, p.y);
                weight += (1 - d / MAX_DISTANCE) * DNA.powerupGreed;
            }
        });
        return weight;
    };

    // Initialize DNA and memory
    if (!mem.init) {
        let record = getDNA();
        let currentDNA = { ...record.dna };
        let deltas = {};
        const stats = record.stats || { wallCollisions: 0, damageRatio: 0.5, avgAccuracy: 0.5, energyRatio: 0.5 };
        const fitnessGap = 1 - (record.bestFitness || 0.01);
        const mutationRate = clamp(fitnessGap / 500, 0.01, 0.2);
        const mutationProbability = clamp(fitnessGap / 1000, 0.01, 0.1);         
        // Categorize genes for intelligent mutation
        const categories = {
            WallAvoidance: ['wallFear', 'wallSafetyBuffer'],
            Evasion: ['missileFear', 'missileSafetyBuffer', 'missileThreatDistanceWeight', 'missileThreatAccuracyWeight', 'missileThreatEnergyWeight', 'targetSafetyBuffer'],
            Targeting: ['gunAimThresh', 'predictionSampleSize', 'targetDistance', 'targetDistanceWeight'],
            Ballistics: ['firingWeightDistance', 'firingWeightTrajectory', 'firingWeightAccuracy', 'aggression'],
            ResourceManagement: ['powerupGreed', 'powerupCaution', 'scanInterval']
        };
        let targetCategories = [];
        // Select genes to mutate based off previous performance metrics
        if (stats.wallCollisions > 0) targetCategories.push('WallAvoidance');
        if (stats.avgAccuracy < 0.5) targetCategories.push('Targeting', 'Ballistics');
        if (stats.damageRatio < 0.5) targetCategories.push('Evasion', 'Targeting', 'Ballistics');
        if (stats.energyRatio < 0.5) targetCategories.push('ResourceManagement', 'Evasion', 'Targeting', 'Ballistics');
        if (targetCategories.length === 0) targetCategories.push('Evasion', 'WallAvoidance', 'Targeting', 'Ballistics', 'ResourceManagement')
        const targetCategory = targetCategories[Math.floor(Math.random() * targetCategories.length)];
        const dnaPool = categories[targetCategory];
        const forcedKey = dnaPool[Math.floor(Math.random() * dnaPool.length)];
        // Apply the mutations
        Object.keys(currentDNA).forEach(key => {
            if (typeof currentDNA[key] !== 'number') return;
            const shouldMutate = (key === forcedKey) || (Math.random() < mutationProbability);            
            if (shouldMutate) {
                let dir = record.momentum[key] || (Math.random() > 0.5 ? 1 : -1);
                if (Math.random() < 0.2) dir *= -1; 
                currentDNA[key] += currentDNA[key] * mutationRate * dir;
                deltas[key] = dir;
            } else { deltas[key] = record.momentum[key] || 0 }
        });          
        // Initialize memory
        mem.dna = currentDNA;
        mem.deltas = deltas;
        mem.startEnergy = tank.energy;
        mem.damageDealt = 0;
        mem.init = true;
        mem.target = tank;
        mem.damageTaken = 0;
        mem.damageDealt = 0;
        mem.lastDamageTaken = 0;
        mem.lastDamageDealt = 0;        
        mem.powerupsSeen = 0;
        mem.powerupsCollected = 0;
        mem.wallCollisions = 0;
        mem.powerups = [];
        mem.targetHistory = [];
    }
    const DNA = mem.dna;

    // Update damage stats
    if (tank.missileCollision) mem.damageTaken += tank.missileCollision.damage;
    mem.damageDealt = 0;
    tank.missiles.forEach(m => { if (m.hit) mem.damageDealt += m.energy });
    if (tank.wallCollision) mem.wallCollisions++;

    // Update missile data
    const incomingMissiles = tank.detectedMissiles.filter(m => {
        const safetyBuffer = tank.size * DNA.missileSafetyBuffer;
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
            DNA.missileThreatDistanceWeight * (1 - (m.distance / MAX_DISTANCE) ** 2) +
            DNA.missileThreatAccuracyWeight * (1 - (distAtCpa / safetyBuffer) ** 2) +
            DNA.missileThreatEnergyWeight * (m.energy / MAX_MISSILE_ENERGY) 
        );
        return distAtCpa < safetyBuffer;
    }).sort((a, b) => b.priority - a.priority);

    // Update powerup data
    mem.powerups = mem.powerups.filter(p => {
        p.duration--;
        p.distance = tank.distanceTo(p.x, p.y);
        let isCollected = tank.powerupCollected || p.distance < tank.size * 2;
        if (isCollected) mem.powerupsCollected++;
        if (!isCollected && tank.detectedTanks.length > 0) {
            isCollected = tank.detectedTanks.some(enemy => {
                const distToEnemy = getDistance(enemy.x, enemy.y, p.x, p.y);
                if (distToEnemy <= enemy.size * 2) {
                    mem.powerupsCollectedByTarget++;
                    return true;
                }
                return false;
            });
        }
        const isExpired = p.duration <= 0;
        return !isCollected && !isExpired;
    });
    tank.detectedPowerups.forEach(newP => {
        const exists = mem.powerups.find(p => p.x === newP.x && p.y === newP.y);
        if (!exists) {
            mem.powerupsSeen++;
            mem.powerups.push(newP)
        }
        else exists.duration = newP.duration;
    });

    // Calculate DNA fitness
    const totalDamageExchanged = mem.damageDealt + mem.damageTaken;
    const damageRatio = totalDamageExchanged > 0 ? (mem.damageDealt / totalDamageExchanged) : 0.5;
    const winRate = tank.wins / (gameCount || 1);
    const energyRatio = tank.energy / (tank.energy + mem.target.energy);
    const powerupRatio = mem.powerupsSeen > 0 ? mem.powerupsCollected / mem.powerupsSeen : 0.5;
    const accuracyRatio = tank.aimAccuracy || 0.5;
    const fitness = (() => {
        return (
            winRate * 55 +
            damageRatio * 20 +
            energyRatio * 15 +
            powerupRatio * 6 + 
            accuracyRatio * 4 
        );
    })();

    // Save DNA
    if (tank.iteration % 100 === 0 || arena.tanksRemaining === 1) {
        let record = getDNA();
        if (fitness > record.bestFitness) {
            record.bestFitness = fitness;
            record.dna = { ...DNA };
            record.momentum = { ...mem.deltas };
            record.generation++;
            record.damageRatio = damageRatio;
            record.energyRatio = energyRatio;
            record.accuracyRatio = accuracyRatio;
            record.winRate = winRate;
            record.wallCollisions = mem.wallCollisions;
            saveDNA(record);
        }
        mem.record = record;
    }

    // Aesthetics
    tank.color = "#338888";
    const pValue = (fitness - mem.record.bestFitness) / 100;
    const saturation1 = (~~Math.abs(pValue * 255)).toString(16).padStart(2, "0");
    const saturation2 = (~~Math.abs(-pValue * 255)).toString(16).padStart(2, "0");
    if (pValue > 0) { tank.fillColor = `#${saturation1}${saturation2}00` }
    else if (pValue < 0) { tank.fillColor = `#${saturation2}${saturation1}00`};
    tank.message = `GEN ${getDNA().generation} | P: ${Math.floor(pValue * 100)}`;

    // Target Prioritization
    let target = null;
    if (tank.detectedTanks.length > 0) {
        target = tank.detectedTanks.sort((a, b) => {
            const aPriority = (1 - a.distance / MAX_DISTANCE) * (1 - a.energy / MAX_TANK_ENERGY);
            const bPriority = (1 - b.distance / MAX_DISTANCE) * (1 - b.energy / MAX_TANK_ENERGY);
            return bPriority - aPriority;
        })[0];
        mem.target = target;
    }

    // Simulate next moves
    let bestScore = -Infinity;
    let bestMove = { speed: 0, turn: 0 };
    for (let t = -1; t <= 1; t += 0.2) {
        for (let s = -1; s <= 1; s += 0.2) {
            const simA = tank.bodyAim + (t * MAX_BODY_TURN_DEGREES);
            const mvx = Math.cos(simA * RADIANS) * s * MAX_ACTUAL_SPEED;
            const mvy = Math.sin(simA * RADIANS) * s * MAX_ACTUAL_SPEED;
            const lookAheads = [1, 5, 10, 15]; 
            let pathScore = 0;
            for (let i = 0; i < lookAheads.length; i++) {
                const frames = lookAheads[i];
                const simX = tank.x + (mvx * frames);
                const simY = tank.y + (mvy * frames);
                pathScore += getPathScore(simX, simY) / (1 + i ** 2);
            }

            if (pathScore > bestScore) {
                bestScore = pathScore;
                bestMove = { speed: s, turn: t };
            }
        }
    }
    tank.speed = bestMove.speed;
    tank.bodyTurn = bestMove.turn;

    // Target engagement
    if (target) {
        // Predictive aiming 
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
        // Wall-pinning logic 
        const normalizedTargetDistance = predicted.distance / MAX_DISTANCE;
        const aimOffset = (0.75 - normalizedTargetDistance / 2) * (normalizedTargetDistance ** 2);
        const finalAngleToTarget = tank.angleTo(predicted.x, predicted.y);
        const targetWallAngle = arena.nearestWallAngle(predicted.x, predicted.y);
        let targetAngleToRef = normalizeAngle(targetWallAngle - finalAngleToTarget);
        // Powerup denial logic
        if (mem.powerups.length > 0) { 
            const targePowerupAngle = getAngle(predicted.x, predicted.y, mem.powerups[0].x, mem.powerups[0].y);
            targetAngleToRef = normalizeAngle(180 + targePowerupAngle - finalAngleToTarget);
        }
        const aimBias = (targetAngleToRef > 0) ? -aimOffset : aimOffset;
        let desiredGunAngle = normalizeAngle(finalAngleToTarget + aimBias) - (tank.bodyAim + tank.gunAim);
        desiredGunAngle = normalizeAngle(desiredGunAngle);        
        tank.gunTurn = clamp(desiredGunAngle / MAX_GUN_TURN_DEGREES, -1, 1);
        // Firing logic
        const aimThreshold = DNA.gunAimThresh - (DNA.gunAimThresh - 1) * Math.sqrt(target.distance / MAX_DISTANCE);
        const gunError = Math.abs(desiredGunAngle);
        if (gunError < aimThreshold) {
            const distanceFactor = Math.max(0.1, 1 - normalizedTargetDistance);
            const trajectoryFactor = 1 - Math.abs(getPerpendicularComponent(target));
            const accuracyFactor = (aimThreshold - gunError) / aimThreshold;
            const recentAccuracy = getRecentAccuracy(50);
            let firePower = DNA.aggression * MAX_MISSILE_ENERGY * (1 + recentAccuracy); 
            firePower = firePower * (
                distanceFactor * DNA.firingWeightDistance +
                trajectoryFactor * DNA.firingWeightTrajectory +
                accuracyFactor * DNA.firingWeightAccuracy
            );
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
        mem.targetHistory.push(eventRecord);
        if (mem.targetHistory.length > 100) {
            mem.targetHistory = mem.targetHistory.slice(-100);
        }
        mem.target = eventRecord;
    } else { tank.gunTurn = 1 }

    // Scan arena
    if (tank.iteration % DNA.scanInterval === 0 || tank.radarAim !== 0) tank.radarTurn = 1; 
    // Conserve energy
    if (incomingMissiles.length === 0 && mem.powerups.length === 0 && !mem.target?.isTooClose) tank.speed = 0;
    // Counter-steer aiming
    tank.gunTurn -= tank.bodyTurn * MAX_BODY_TURN_DEGREES / MAX_GUN_TURN_DEGREES;
    tank.retained = mem;
    return tank;
}