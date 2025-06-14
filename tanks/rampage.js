function main(tank, arena) {
    const LEARNING_ENABLED = false;
    const COLLISION_COOLDOWN_TIME = 36;
    const LOW_ENERGY_THRESHOLD = 100;
    const saved = tank.retained;
    
    tank.angleDifference = (a1, a2) => {
        a1 = (a1 + 360000) % 360;
        a2 = (a2 + 360000) % 360;
        if (a1 > 180) a1 -= 360;
        if (a2 > 180) a2 -= 360;
        return (a2 - a1 + 180) % 360 - 180;
    };
    tank.calculateGunTurn = (x, y) => {
        const targetAngle = tank.angleTo(x, y);
        let gunAngleDifference = tank.angleDifference(tank.bodyAim + tank.gunAim, targetAngle);
        return Math.max(-1, Math.min(1, gunAngleDifference / 10));
    }
    tank.perpendicularSpeedComponent = (target) => {
        let angleDifference = (target.angleTo - target.bodyAim + 360000) % 360;
        return Math.sin(angleDifference * DEGREES);
    };
    tank.getTargetPriority = (target) => {
        const accuracyFactor = (1 - Math.abs(tank.angleDifference(tank.bodyAim + tank.gunAim, target.angleTo)) / (tank.radarArc * MAX_RADAR_ARC_DEGREES)) ** 2;
        const trajectoryFactor = (1 - Math.abs(tank.perpendicularSpeedComponent(target)));
        const distanceFactor = (1 - target.distance / MAX_DISTANCE) ** 2;
        const energyFactor = (1 - target.energy / (saved.maxTargetEnergy || 1000));
        const speedFactor = 1 - Math.abs(target.speed);
        const gunHeatFactor = (1 - Math.min(1, 1 / Math.max(1, target.gunHeat))) ** (1 / 2);
        const hitProbability = accuracyFactor * 0.4 + trajectoryFactor * 0.3 + distanceFactor * 0.2 + speedFactor * 0.1;
        const vulnerabilityFactor = energyFactor * 0.6 + speedFactor * 0.25 + gunHeatFactor * 0.15;
        return (hitProbability * 4 + vulnerabilityFactor) / 5;
    };
    tank.getMissilePriority = (missile) => {
        const perfectTrajectory = (Math.atan2(tank.y - missile.y, tank.x - missile.x) * DEGREES + 36000) % 360;
        const trajectoryDifference = tank.angleDifference(perfectTrajectory, missile.aim);
        const trajectoryFactor = (1 - Math.abs(trajectoryDifference) / 180);
        const distanceFactor = 1 - (missile.distance / MAX_DISTANCE);
        const energyFactor = 1 - (missile.energy / MAX_MISSILE_ENERGY);
        return trajectoryFactor * 0.4 + distanceFactor * 0.4 + energyFactor * 0.2;
    };
    tank.getPowerupPriority = (powerup) => {
        const energyThreshold = saved.target?.energy || 500;
        const powerupValues = {
            "speed": 1,
            "energy": (tank.energy < energyThreshold) ? 1 : 0.95,
            "firepower": 0.90,
            "guncool": 0.85,
        };
        const safetyFactor = (saved.target) ? Math.sqrt((saved.target.x - powerup.x) ** 2 + (saved.target.y - powerup.y) ** 2) / MAX_DISTANCE : 0.5;
        const typeFactor = powerupValues[powerup.type] || 0;
        const amountFactor = powerup.amount / MAX_POWERUP_AMOUNT;
        const distanceFactor = 1 - powerup.distance / MAX_DISTANCE;
        const durationFactor = powerup.duration / POWERUP_PICKUP_DURATION;
        const durationTooShort = powerup.duration < powerup.distance / MAX_ACTUAL_SPEED;
        const priority = typeFactor * (amountFactor * 0.3 + safetyFactor * 0.3 + distanceFactor * 0.3 + durationFactor * 0.1);
        return (durationTooShort) ? 0 : priority;
    };

    tank.predictedMissileCollision = (missile) => {
        const PREDICTION_STEPS = MAX_DISTANCE / MISSILE_SPEED;
        const COLLISION_BUFFER = tank.size * 1.5;
        let predictedMissileX = missile.x;
        let predictedMissileY = missile.y;
        let predictedTankX = tank.x;
        let predictedTankY = tank.y;
        let currentTankSpeed = tank.actualSpeed;
        let predictedBodyAim = tank.bodyAim;
    
        for (let i = 0; i < PREDICTION_STEPS; i++) {
            predictedMissileX += MISSILE_SPEED * Math.cos(missile.aim * DEGREES);
            predictedMissileY += MISSILE_SPEED * Math.sin(missile.aim * DEGREES);
            predictedTankX += currentTankSpeed * Math.cos(predictedBodyAim * DEGREES);
            predictedTankY += currentTankSpeed * Math.sin(predictedBodyAim * DEGREES);
            const distance = Math.sqrt((predictedMissileX - predictedTankX) ** 2 + (predictedMissileY - predictedTankY) ** 2);
            if (distance < COLLISION_BUFFER) {
                return true;
            }
            if (missile.energy <= 0.01 || Math.abs(predictedMissileX) > arena.width / 2 || Math.abs(predictedMissileY) > arena.height / 2) {
                break;
            }
        }
        return false;
    }
    tank.commitMemory = (key, value) => { localStorage.setItem(`tank_${encodeURIComponent(tank.name)}_${encodeURIComponent(key)}`, JSON.stringify(value)) };
    tank.forgetMemory = (key) => { localStorage.removeItem(`tank_${encodeURIComponent(tank.name)}_${encodeURIComponent(key)}`) };
    tank.getMemory = (key) => {
        const value = localStorage.getItem(`tank_${encodeURIComponent(tank.name)}_${encodeURIComponent(key)}`);
        return (value) ? JSON.parse(value) : undefined;
    };
    
    // Set initial values
    if (tank.iteration === 0) {
        tank.name = "Rampage";
        tank.color = "#c80000";
        tank.fillColor = "#000000";
        tank.treadColor = "#df0000";
        tank.gunColor = "#c80000"
        tank.radarArc = 1;
        tank.speed = 1;
        tank.gunTurn = tank.calculateGunTurn(0, 0);
        saved.wanderPattern = 0;
        saved.previousTargetData = [];
        saved.missileEvasionReverse = 0;
        saved.target = null;
        saved.scanDirection = 0;
        saved.targets = {};
        saved.wallCollisions = 0;
        saved.wallAvoidance = tank.getMemory("wallAvoidance") || {
            adjustmentAmount: 0,
            adjustmentCount: 0,
            adjustmentMatchCurrent: 0,
            adjustmentMatchTarget: 1000,
            learningRate: 0.01,
            learningDecay: 0.001,
            matchesSinceCollisionBest: 0,
            matchesSinceCollisionCurrent: 0,
            rewardsPositive: 0,
            rewardsNegative: 0,
            slowDown: 0.58,
            threshold: 7.8,
            trainingIteration: 0,
            largestUnsafe: {
                slowDown: 0,
                threshold: 0,
            }
        }
        saved.lastMissileId = false;
        saved.firedMissiles = [];
    }
    
    // Determine if tank is near wall
    const wallProximityThreshold = saved.wallAvoidance.threshold * tank.size;
    const nextX = tank.x + tank.actualSpeed * Math.cos(tank.bodyAim * DEGREES);
    const nextY = tank.y + tank.actualSpeed * Math.sin(tank.bodyAim * DEGREES);
    tank.isNearWall = (
        Math.abs(nextX) > arena.width / 2 - wallProximityThreshold ||
        Math.abs(nextY) > arena.height / 2 - wallProximityThreshold
    );
    
    // Calculate number of frames until wall collision
    let predictedAim = tank.bodyAim + tank.bodyTurn * MAX_BODY_TURN_DEGREES;
    let predictedX = tank.x + tank.actualSpeed * Math.cos(predictedAim * DEGREES);
    let predictedY = tank.y + tank.actualSpeed * Math.sin(predictedAim * DEGREES);
    let collision = Math.abs(predictedX) > arena.width / 2 - tank.size || Math.abs(predictedY) > arena.height / 2 - tank.size;
    let framesUntilWallCollision = 0;
    while (framesUntilWallCollision < 100 && !collision) {
        predictedAim += tank.bodyTurn * MAX_BODY_TURN_DEGREES;
        predictedX += tank.actualSpeed * Math.cos(predictedAim * DEGREES);
        predictedY += tank.actualSpeed * Math.sin(predictedAim * DEGREES);
        collision = Math.abs(predictedX) > arena.width / 2 - tank.size || Math.abs(predictedY) > arena.height / 2 - tank.size;
        framesUntilWallCollision++;
    }


    // Calculate distances to each wall
    let wallDistance = Infinity;
    let wallAngle = 0;
    const leftWallDistance = Math.abs(-arena.width / 2 - tank.x);
    const rightWallDistance = Math.abs(arena.width / 2 - tank.x);
    const topWallDistance = Math.abs(-arena.height / 2 - tank.y);
    const bottomWallDistance = Math.abs(arena.height / 2 - tank.y);

    // Determine the nearest wall and the angle to it
    if (leftWallDistance < wallDistance) {
        wallDistance = leftWallDistance;
        wallAngle = 180;
    }
    if (rightWallDistance < wallDistance) {
        wallDistance = rightWallDistance;
        wallAngle = 0
    }
    if (topWallDistance < wallDistance) {
        wallDistance = topWallDistance;
        wallAngle = -90;
    }
    if (bottomWallDistance < wallDistance) {
        wallDistance = bottomWallDistance;
        wallAngle = 90;
    }

    // Update fired missile information
    if (saved.lastMissileId) {
        const missile = tank.missiles[saved.lastMissileId];
        saved.firedMissiles.push(missile);
        saved.lastMissileId = false;
    }

    // Update powerups information
    if (saved.powerup) {
        saved.powerup.duration--;
        if (saved.powerup.duration <= 0) {
            saved.powerup = false;
        }
    }

    // Update targets information
    saved.maxTargetEnergy = 0;
    if (tank.detectedTanks.length > 0) {
        tank.detectedTanks.forEach((detected) => {
            saved.targets[detected.index] = detected;
            saved.targets[detected.index].iteration = tank.iteration;
            if (detected.energy > saved.maxTargetEnergy) {
                saved.maxTargetEnergy = detected.energy;
            }
        });
    }
    
    
    // Remove dead targets
    const deadTargetsExist = () => Object.keys(saved.targets).length > arena.tanksRemaining - 1;
    let longestAbsence;
    while (deadTargetsExist()) {
        let removalIndex = longestAbsence = -1;
        for (const targetIndex of Object.keys(saved.targets)) {
            const target = saved.targets[targetIndex];
            const absenceTime = tank.iteration - target.iteration;
            if (absenceTime > longestAbsence) {
                removalIndex = targetIndex;
                longestAbsence = absenceTime;
            }
        }
        delete saved.targets[removalIndex];
    }

    // Low energy mode
    tank.energyLow = false;
    if (tank.energy < LOW_ENERGY_THRESHOLD) {
        tank.energyLow = true;
        let energyFactor =  tank.energy / LOW_ENERGY_THRESHOLD;
        let direction =  Math.sign(tank.speed)
        let desiredSpeed = 0.5 + 0.5 * energyFactor * direction;
        if (Math.abs(tank.speed) > Math.abs(desiredSpeed)) {
            tank.speed = desiredSpeed;
        }
    }

    // Wander around the arena (default action)
    const wanderSeed = 0.3 + Math.random() * 0.4;
    saved.wanderPatterns = [
        Math.cos(tank.iteration / 10) * wanderSeed + Math.sin(tank.iteration / 33) * (1 - wanderSeed),
        Math.sin(tank.iteration / 11) * wanderSeed + Math.cos(tank.iteration / 32) * (1 - wanderSeed),
        Math.cos(tank.iteration / 12) * wanderSeed + Math.sin(tank.iteration / 31) * (1 - wanderSeed),
        Math.sin(tank.iteration / 13) * wanderSeed + Math.cos(tank.iteration / 30) * (1 - wanderSeed),
    ];
    const patternChanger = (15 + tank.index) + ~~(Math.random() * 15 + (1 - tank.index));
    if ((tank.iteration + tank.index) % patternChanger === 0) {
        saved.wanderPattern = ~~(Math.random() * saved.wanderPatterns.length);
        // Go straight half of the time
        if (Math.random() > 0.5) {
            saved.wanderPattern = 0;
        }
    }
    tank.bodyTurn = saved.wanderPatterns[saved.wanderPattern];


    // Handle detected tanks
    if (tank.detectedTanks.length > 0) {

        // Reset radar scan
        saved.scanSpeed = 1;
        saved.scanDirection = 0;
        saved.scanRotation = 0;

        // Save primary target
        tank.detectedTanks = tank.detectedTanks.sort((a, b) => { return tank.getTargetPriority(a) - tank.getTargetPriority(b) });
        let target = tank.detectedTanks[0];
        saved.target = { ...target };

        // Set a victory message (in case target is destroyed)
        const taunts = [
            "🖕",
            "I win!",
            "Ur dead.",
            "Get rekt.",
            `Fuck u, ${target.name}!`,
        ];
        tank.victoryMessage = taunts[~~(Math.random() * taunts.length)];

        // Conserve energy
        const targetsFarEnough = target.distance > arena.width / 4;
        const targetsGunIsCoolEnough = target.gunHeat < 10;
        const shouldConserveEnergy = target.energy * 3 > tank.energy;
        if (shouldConserveEnergy && targetsFarEnough && targetsGunIsCoolEnough) {
            tank.conserveEnergy = true;
        }

        // Store and average previous target data for velocity
        saved.previousTargetData.push({ x: target.x, y: target.y, angle: target.bodyAim, time: tank.iteration });
        if (saved.previousTargetData.length > 5) {
            saved.previousTargetData.shift();
        }

        // Calculate average velocity over the stored history
        let avgVelocityX = avgVelocityY = 0;
        if (saved.previousTargetData.length >= 2) {
            let totalDeltaTime = 0;
            for (let i = 1; i < saved.previousTargetData.length; i++) {
                const last = saved.previousTargetData[i];
                const prev = saved.previousTargetData[i - 1];
                const deltaTime = last.time - prev.time;
                avgVelocityX += (last.x - prev.x);
                avgVelocityY += (last.y - prev.y);
                totalDeltaTime += deltaTime;
            }
            avgVelocityX /= Math.max(1, totalDeltaTime);
            avgVelocityY /= Math.max(1, totalDeltaTime);
        }
        else {
            avgVelocityX = target.actualSpeed * Math.cos(target.bodyAim * DEGREES);
            avgVelocityY = target.actualSpeed * Math.sin(target.bodyAim * DEGREES);
        }

        // Calculate missile intercept time
        let timeToIntercept = target.distance / MISSILE_SPEED;
        const baseIterations = 5;
        const velocityFactor = Math.abs(target.speed);
        const distanceFactor = target.distance / arena.width;
        const additionalIterations = (velocityFactor + distanceFactor) * baseIterations;
        const interceptCalculationIterations = baseIterations + additionalIterations;
        for (let i = 0; i < interceptCalculationIterations; i++) {
            const predictedTargetX = target.x + avgVelocityX * timeToIntercept;
            const predictedTargetY = target.y + avgVelocityY * timeToIntercept;
            timeToIntercept = tank.distanceTo(predictedTargetX, predictedTargetY) / MISSILE_SPEED;
        }

        // Calculate final predicted target position
        let predictedTargetX = target.x + avgVelocityX * timeToIntercept;
        let predictedTargetY = target.y + avgVelocityY * timeToIntercept;

        // Turn gun to the desired angle
        tank.gunTurn = tank.calculateGunTurn(predictedTargetX, predictedTargetY);

        // Calculate firing conditions
        let aimAccuracyThreshold = Math.min(2 + 2 * tank.aimAccuracy, Math.atan2(MAX_ACTUAL_SPEED * timeToIntercept, target.distance) * DEGREES);
        const predictedTargetAngle = tank.angleTo(predictedTargetX, predictedTargetY);
        const gunAngleDifference = tank.angleDifference(tank.bodyAim + tank.gunAim, predictedTargetAngle);
        const aimError = Math.abs(gunAngleDifference);
        const aimErrorThreshold = aimAccuracyThreshold * (1 - (target.distance / arena.width) ** 2);
        const perpendicularSpeedComponent = Math.abs(tank.perpendicularSpeedComponent(target));
        const historicAccuracy = tank.aimAccuracy || 0.5;
        const probabilityOfHit = (1 - aimError / aimErrorThreshold) * (
            (1 - target.distance / MAX_DISTANCE) *
            (1 - perpendicularSpeedComponent) ** 2
        );
        let hitProbabilityThreshold = (target.distance / MAX_DISTANCE) ** (1 / 2);
        if (aimError < aimErrorThreshold && probabilityOfHit >= hitProbabilityThreshold) {
            const minFirePower = MAX_MISSILE_ENERGY * ((historicAccuracy + probabilityOfHit) / 2);
            const accuracyBonus = MAX_MISSILE_ENERGY * historicAccuracy ** (1 / 3) * probabilityOfHit ** 2;
            let firePower = (tank.energyLow) ? minFirePower : Math.min(MAX_MISSILE_ENERGY, minFirePower + accuracyBonus);
            firePower *= 4 - (target.distance / MAX_DISTANCE) * 3;
            if (tank.powerup?.type === "firepower") {
                firePower *= 1 + probabilityOfHit;
            }
            if ((historicAccuracy * 0.5 + probabilityOfHit * 0.5) > 0.5 || Math.random() > 0.95) {
                firePower = MAX_MISSILE_ENERGY;
            }
            if (firePower > MAX_MISSILE_ENERGY) {
                firePower = MAX_MISSILE_ENERGY;
            }
            const missileEnergy = firePower * MISSILE_ENERGY_MULTIPLIER;
            const missileEnergyAtImpact = missileEnergy - (target.distance / MISSILE_SPEED);
            if (missileEnergyAtImpact > firePower) {
                saved.lastMissileId = tank.fire(firePower);
            }
        }
    }

    // If no tank is detected
    else {
        if (!saved.scanning) {
            // Calculate scan direction
            if (!saved.scanDirection) {
                let aimAtX = saved?.target?.x || 0;
                let aimAtY = saved?.target?.y || 0;
                const desiredGunTurn = tank.calculateGunTurn(aimAtX, aimAtY);
                const randomDirection = 1 - Math.round(Math.random() * 2);
                saved.scanDirection = Math.sign(desiredGunTurn) || randomDirection;
            }
    
            // Calculate scan speed and turn gun (radar will follow gun)
            const rotationAmount = saved.scanDirection * saved.scanSpeed;
            tank.gunTurn = saved.scanDirection * saved.scanSpeed;
            saved.scanRotation += Math.abs(rotationAmount * MAX_GUN_TURN_DEGREES);
            const fullRotations = ~~(saved.scanRotation / 360);
            const slowDownRate = Math.min(4, fullRotations) / 4;
            saved.scanSpeed = 1 - 0.5 * slowDownRate;
            if (fullRotations === 5) {
                saved.scanRotation = 0;
                saved.scanDirection *= -1;
            }
        }
    }


    // Wall avoidance logic
    if (tank.isNearWall) {
        
        // Learn from wall collisions
        if (LEARNING_ENABLED && tank.wallCollision) {
            if (saved.wallAvoidance.slowDown > saved.wallAvoidance.largestUnsafe.slowDown) {
                saved.wallAvoidance.largestUnsafe.slowDown = saved.wallAvoidance.slowDown;
            }
            if (saved.wallAvoidance.threshold > saved.wallAvoidance.largestUnsafe.threshold) {
                saved.wallAvoidance.largestUnsafe.threshold = saved.wallAvoidance.threshold;
            }
            saved.wallCollisions++;
            saved.wallAvoidance.collisions++;
            saved.wallAvoidance.adjustmentCount++;
            saved.wallAvoidance.rewardsNegative++;
            saved.wallAvoidance.adjustmentAmount += saved.wallAvoidance.learningRate;
            saved.wallAvoidance.slowDown *= (1 + saved.wallAvoidance.learningRate);
            saved.wallAvoidance.threshold *= (1 + saved.wallAvoidance.learningRate);
            saved.wallAvoidance.matchesSinceCollisionBest = saved.wallAvoidance.matchesSinceCollisionCurrent;
            saved.wallAvoidance.matchesSinceCollisionCurrent = 0;
            tank.commitMemory("wallAvoidance", saved.wallAvoidance);
        }

        // Slow down for better handling
        const wallOffset = Math.abs(tank.angleDifference(tank.bodyAim, wallAngle));
        const directionFactor =  1 - (wallOffset / 90);
        const distanceFactor = wallDistance / wallProximityThreshold;
        const slowDownFactor = saved.wallAvoidance.slowDown * directionFactor;
        tank.speed = (1 - slowDownFactor) + (slowDownFactor * distanceFactor);

        // If collision is likely slow down even more
        if (framesUntilWallCollision < 15) {
            tank.speed /= 16 - framesUntilWallCollision;
        }
        
        // If collision is imminent then stop
        if (framesUntilWallCollision === 1) {
            tank.speed = 0;
        }

        // Turn away fom the wall
        const angleToCenter = tank.angleTo(0, 0);
        let bodyAngleDifference = tank.angleDifference(tank.bodyAim, angleToCenter);
        tank.bodyTurn = bodyAngleDifference / 180;

        // Always take the shortest turn path
        if (Math.abs(bodyAngleDifference) > 180) {
            tank.speed *= -1;
            tank.bodyTurn *= -1;
        }

    }


    // Distance from wall is safe
    else {

        // Handle detected missiles
        if (tank.detectedMissiles.length > 0) {
            saved.incomingMissiles = tank.detectedMissiles.filter((missile) => {
                const perfectTrajectory = tank.angleFrom(missile.x, missile.y);
                const trajectoryDifference = tank.angleDifference(perfectTrajectory, missile.aim);
                const aimError = Math.abs(trajectoryDifference);
                const interceptionAimThreshold = 3 + 3 * missile.distance / MAX_DISTANCE;
                return aimError < interceptionAimThreshold;
            });
            saved.underRapidFire = Math.max(0, tank.detectedMissiles.length - 1) * COLLISION_COOLDOWN_TIME;
            tank.detectedMissiles = tank.detectedMissiles.sort((a, b) => { return tank.getMissilePriority(b) - tank.getMissilePriority(a) });
            const missile = tank.detectedMissiles[0];
            const perfectTrajectory = tank.angleFrom(missile.x, missile.y);
            const trajectoryDifference = tank.angleDifference(perfectTrajectory, missile.aim);
            const aimError = Math.abs(trajectoryDifference);
            const interceptionAimThreshold = 3 + 3 * missile.distance / MAX_DISTANCE;
            saved.threatAngle = (saved.target?.angleTo) || missile.angleTo;
            // Move out of missiles path
            const evasionExceptions = saved.missileEvasionReverse || tank.isNearWall;
            saved.willBeHitByMissile = saved.willBeHitByMissile || tank.predictedMissileCollision(missile);
            if (saved.willBeHitByMissile || aimError < interceptionAimThreshold && !evasionExceptions) {
                saved.missileEvasion = COLLISION_COOLDOWN_TIME;
                tank.bodyTurn = tank.angleDifference(tank.bodyAim, saved.threatAngle + 90) / 10;
                tank.speed = 1;
                if (trajectoryDifference < 0) {
                    tank.speed *= -1;
                    saved.missileEvasionReverse = ~~(missile.distance / missile.speed);
                }
            }

            // Conserve energy if safe
            else if (arena.tanksRemaining === 2 && saved.target?.gunHeat > 10) {
                if (saved.collisionCoolDown || saved.underRapidFire || saved.missileEvasion) {
                    tank.speed = Math.sign(tank.speed) || 1;
                }
                else {
                    if (!saved.missileEvasion) {
                        tank.conserveEnergy = true;
                    }
                }
            }
            
            // Calculate the threat level of all detected missiles
            saved.missileThreat = tank.detectedMissiles.reduce((sum, _missile) => { return sum + tank.getMissilePriority(missile) });
            if (saved.missileThreat > tank.energy) {
                tank.bodyColor = "#ff0000";
            }
        }
        
        // If no missiles are detected
        else {
            saved.willBeHitByMissile = false;
            saved.missileEvasion = 0;
            saved.missileEvasionReverse = 0;
            if (!saved.isUnderRapidFire && saved.target?.gunHeat > 1) {
                tank.conserveEnergy = true;
            }
            else {
                tank.speed = 1;
            }
            saved.missileThreat = 0;
        }


        // Update saved missile information
        saved.missileThreat = 0;
        if (saved.incomingMissiles) {
            saved.incomingMissiles = saved.incomingMissiles.filter((missile) => {
                missile.x += MISSILE_SPEED * Math.cos(missile.aim * DEGREES);
                missile.y += MISSILE_SPEED * Math.sin(missile.aim * DEGREES);
                missile.energy -= MISSILE_SPEED;
                if (missile.energy <= 0 ) {
                    missile.energy = 1 / Number.MAX_SAFE_INTEGER;
                }
                if (Math.abs(missile.x) > arena.width / 2 || Math.abs(missile.y) > arena.height / 2) {
                    return false;
                }
                else {
                    saved.missileThreat += missile.energy;
                    return true;
                }
            });
        }

        // Handle missile and tank collisions
        const collision = tank.tankCollision || tank.missileCollision;
        if (collision) {
            saved.collisionAngle = collision.angle;
            saved.collisionDamage = collision.damage;
            saved.collisionCoolDown = COLLISION_COOLDOWN_TIME;
        }
        const collisionIsBiggestThreat = saved.collisionDamage > saved.missileThreat;
        if (saved.collisionCoolDown && collisionIsBiggestThreat && arena.tanksRemaining > 2) {
            const desiredGunTurn = tank.angleDifference(tank.bodyAim + tank.gunAim, saved.collisionAngle);
            tank.gunTurn = desiredGunTurn / 10;
        }
        if (tank.isNearWall && saved.collisionCoolDown && !saved.underRapidFire) {
            const directionDifference = tank.angleDifference(tank.bodyAim, saved.collisionAngle + 90);
            tank.bodyTurn = directionDifference / 10;
            tank.speed = (saved.collisionCoolDown || 1) / COLLISION_COOLDOWN_TIME;
            if (Math.abs(saved.collisionAngle) > 90) {
                tank.bodyTurn *= -tank.bodyTurn;
                tank.speed *= -1;
            }
        }
    
    
        // Orient tanks body perpendicular to target for missile evasion
        if (saved.target && !tank.isNearWall) {
            const angleDifference = tank.angleDifference(tank.bodyAim, saved.target.angleTo + 90);
            tank.bodyTurn = angleDifference / 180;
        }
        

    }
    

    // Handle powerups
    if (tank.detectedPowerups.length > 0) {
        saved.scannedPowerups = true;
        tank.detectedPowerups = tank.detectedPowerups.sort((a, b) => { return tank.getPowerupPriority(a) - tank.getPowerupPriority(b) });
        saved.powerup = tank.detectedPowerups[0];
        saved.powerup.priority = tank.getPowerupPriority(saved.powerup);
        saved.powerup.isNearWall = (
            Math.abs(saved.powerup.x) > arena.width / 2 - Math.abs(tank.actualSpeed * 10) ||
            Math.abs(saved.powerup.y) > arena.height / 2 -  Math.abs(tank.actualSpeed * 10)
        );
    }
    
    // Calculate safety level of grabbing powerup
    const distanceToPowerup = (saved.powerup) ? tank.distanceTo(saved.powerup.x, saved.powerup.y) : MAX_DISTANCE;
    const distanceToTarget = (saved.target) ? tank.distanceTo(saved.target.x, saved.target.y) : MAX_DISTANCE;
    const targetDistanceToPowerup = (saved.powerup && saved.target) ? Math.sqrt((saved.powerup.x - saved.target.x) ** 2 + (saved.powerup.y - saved.target.y) ** 2) : MAX_DISTANCE;
    if (saved.powerup) {
        saved.powerup.safety = 1;
    }
    if (saved.powerup && saved.target) {
        const targetAngle = tank.angleTo(saved.target.x, saved.target.y);
        const powerupAngle = tank.angleTo(saved.powerup.x, saved.powerup.y);
        let angleOffset = (tank.angleDifference(targetAngle, powerupAngle) + 36000) % 360;
        if (angleOffset > 180) {
            angleOffset -= 360;
        }
        angleOffset = Math.abs(angleOffset);
        if (angleOffset > 90) {
            angleOffset = 90 - (angleOffset - 90);
        }
        let trajectoryFactor = 1 - angleOffset / 90;
        let gunHeatFactor = 1 - saved.target.gunHeat / MAX_GUN_HEAT;
        const distanceFactor = tank.distanceTo(saved.powerup.x, saved.powerup.y) / MAX_DISTANCE;
        const missileFactor = Math.min(1, (saved.incomingMissiles || []).length / 3);
        const evasionFactor = saved.missileEvasion / COLLISION_COOLDOWN_TIME;
        const totalRisk = (
            trajectoryFactor * 0.4 +
            distanceFactor * 0.2 +
            gunHeatFactor * 0.2 +
            missileFactor * 0.1 +
            evasionFactor * 0.1
        );
        saved.powerup.safety = 1 - totalRisk;
    }
    
    // Check for execeptions to getting the powerup
    if (saved.powerup) {
        const distanceToPowerup = tank.distanceTo(saved.powerup.x, saved.powerup.y);
        saved.powerup.safetyThreshold = (1 - saved.powerup.priority / 20) * (distanceToPowerup / MAX_DISTANCE);
        if (saved.powerup.type === "energy") {
            const newSafetyThreshold = (saved.powerup.safety + distanceToPowerup / MAX_DISTANCE) / 2;
            saved.powerup.safetyThreshold = Math.min(saved.powerup.safetyThreshold, newSafetyThreshold);
        }
        saved.powerup.exceptions = (
            (saved.willBeHitByMissile) ||
            (saved.missileEvasion) ||
            (saved.collisionCooldown) ||
            (saved.powerup?.saftey < saved.powerup.safetyThreshold) ||
            (tank.isNearWall || saved.powerup?.isNearWall)
        );
    }
    
    // Grab the powerup
    saved.isSeekingPowerup = false;
    if (saved.powerup && !saved.powerup.exceptions) {
        saved.isSeekingPowerup = true;
        const distance = tank.distanceTo(saved.powerup.x, saved.powerup.y);
        const angle = tank.angleTo(saved.powerup.x, saved.powerup.y);
        const directionDifference = tank.angleDifference(tank.bodyAim, angle);
        tank.bodyTurn = directionDifference / 10;
        tank.speed = (distance > tank.size * 2) ? 1 : distance / MAX_DISTANCE;
        if (directionDifference > 180) {
            tank.bodyTurn *= -1;
            tank.speed *= -1;
        }
        if (distance < tank.size) {
            saved.powerup = false;
            saved.isSeekingPowerup = false;
        }
    }


    // Target picked up powerup
    if (saved.powerup && saved.target) {
        const distance = Math.sqrt((saved.target.x - saved.powerup.x) ** 2 + (saved.target.y + saved.powerup.y) ** 2);
        if (distance < saved.target.size) {
            saved.powerup = false;
            saved.isSeekingPowerup = false;
        }
    }


    // Scan arena periodically
    if (tank.iteration % 80 === 0 || tank.radarAim > 0) {
        tank.radarTurn = 1;
        saved.scanning = true;
        if (tank.radarAim === 0) {
            saved.scannedPowerups = false;
        }
        if (tank.detectedPowerups.length > 0) {
            saved.scannedPowerups = true;
        }
    }
    else if (tank.radarAim === 0) {
        saved.scanning = false;
        if (!saved.scannedPowerups) {
            saved.powerup = false;
            saved.isSeekingPowerup = false;
        }
    }
    

    // Handle cool downs
    if (saved.underRapidFire > 0) {
        saved.underRapidFire = Math.max(0, saved.underRapidFire - 1);
    }
    if (saved.missileEvasion > 0) {
        saved.missileEvasion = Math.max(0, saved.missileEvasion - 1);
    }
    if (saved.missileEvasionReverse > 0) {
        saved.missileEvasionReverse = Math.max(0, saved.missileEvasionReverse - 1);
    }
    if (saved.collisionCoolDown > 0) {
        saved.collisionCoolDown = Math.max(0, saved.collisionCoolDown - 1);
    }


    // Correct gun turn for steering changes
    tank.gunTurn -= tank.bodyTurn;
    
    // Learn from successful wall avoidance
    if (LEARNING_ENABLED && arena.tanksRemaining === 1 && !saved.wallCollisions && !saved.learningSaved) {
        saved.learningSaved = true;
        if (saved.wallAvoidance.matchesSinceCollisionCurrent > saved.wallAvoidance.matchesSinceCollisionBest) {
            saved.wallAvoidance.matchesSinceCollisionBest = saved.wallAvoidance.matchesSinceCollisionCurrent;
        }
        saved.wallAvoidance.trainingIteration++;
        saved.wallAvoidance.adjustmentMatchCurrent++;
        saved.wallAvoidance.matchesSinceCollisionCurrent++;
        tank.commitMemory("wallAvoidance", saved.wallAvoidance);
        let current = saved.wallAvoidance.adjustmentMatchCurrent;
        let best = saved.wallAvoidance.adjustmentMatchTarget;
        if (current >= best * 1.05) {
            const nextSlowDown = saved.wallAvoidance.slowDown * (1 - saved.wallAvoidance.learningDecay);
            const nextThreshold = saved.wallAvoidance.Threshold * (1 - saved.wallAvoidance.learningDecay);
            if (nextSlowDown > saved.wallAvoidance.largestUnsafe.slowDown && nextThreshold > saved.wallAvoidance.largestUnsafe.threshold) {
                saved.wallAvoidance.rewardsPositive++;
                saved.wallAvoidance.adjustmentCount++;
                saved.wallAvoidance.adjustmentMatchCurrent = 0;
                saved.wallAvoidance.adjustmentMatchTarget = current;
                saved.wallAvoidance.adjustmentAmount -= saved.wallAvoidance.learningDecay;
                saved.wallAvoidance.slowDown = nextSlowDown;
                saved.wallAvoidance.threshold = nextThreshold;
                tank.commitMemory("wallAvoidance", saved.wallAvoidance);
            }
        }
    }

    // Handle energy regeneration
    const conservationExceptions = (
        saved.approachTarget ||
        saved.willBeHitByMissile ||
        saved.isSeekingPowerup
    )
    if (tank.conserveEnergy && tank.energy < MAX_TANK_ENERGY && !conservationExceptions) {
        tank.speed = 0;
    }

    // Color tank
    const colorTankPart = (amount) => {
        const r = Math.round((1 - amount) * 255);
        return r.toString(16).padStart(2, "0");
    }

    // Fill color
    const energyGrade = Math.min(1, tank.energy / 1000);
    const colorShade = energyGrade ** (1 / 4);
    const rHex = colorTankPart(colorShade);
    tank.fillColor = `#${rHex}0000`;

    // Tread color
    tank.treadColor = (tank.speed === 0) ? "#c80000" : "#ff0000";

    // Gun color
    tank.gunColor = (tank.gunHeat === 0) ? "#c80000" : "#ff0000";

    // Radar color
    tank.radarColor = (tank.detectedTanks > 0 || tank.detectedMissiles.length > 0) ? "#ff0000" : "#c80000";

    // Indicator light
    tank.indicator.color = "#ff0000";
    tank.indicator.intensity = 0;
    if (saved.powerup) {
        tank.indicator.color = "#00ff00";
        tank.indicator.intensity = (saved.isSeekingPowerup) ? 1 : 0.5;
    }
    
    // This function must return the tank object
    return tank;

    
}
