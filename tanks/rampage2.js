function main(tank, arena) {
    
    function getAngle(x1, y1, x2, y2) {
        return Math.atan2(y2 - y1, x2 - x1);
    }

    function getDistance(x1, y1, x2, y2) {
        return Math.hypot(x2 - x1, y2 - y1);
    }
    
    function getAngleDifference(a1, a2) {
        a1 = (a1 + 360000) % 360;
        a2 = (a2 + 360000) % 360;
        if (a1 > 180) a1 -= 360;
        if (a2 > 180) a2 -= 360;
        return (a2 - a1 + 180) % 360 - 180;
    };
    
    function predictLocation(obj, iterations) {
        let predictedX = obj.x;
        let predictedY = obj.y;
        let predictedSpeed = obj.actualSpeed || MISSILE_SPEED;
        let predictedAim = obj.bodyAim || obj.aim;
        for (let i = 0; i < iterations; i++) {
            predictedX += predictedSpeed * Math.cos(predictedAim * DEGREES);
            predictedY += predictedSpeed * Math.sin(predictedAim * DEGREES);
        }
        return { x: predictedX, y: predictedY };
    }

    function predictedCollision(obj1, obj2) {
        const PREDICTION_STEPS = MAX_DISTANCE / Math.max(obj1.actualSpeed || 0.1, obj2.actualSpeed || MISSILE_SPEED);
        const COLLISION_BUFFER = obj1.size + obj2.size;
        let predictedObj1X = obj1.x;
        let predictedObj1Y = obj1.y;
        let currentObj1Speed = obj1.actualSpeed || 0;
        let currentObj1Aim = obj1.bodyAim || obj1.aim;
        let predictedObj2X = obj2.x;
        let predictedObj2Y = obj2.y;
        let predictedObj2Speed = obj2.actualSpeed || 0;
        let predictedObj2Aim = obj2.bodyAim || obj2.aim;
        for (let i = 0; i < PREDICTION_STEPS; i++) {
            predictedObj1X += currentObj1Speed * Math.cos(currentObj1Aim * DEGREES);
            predictedObj1Y += currentObj1Speed * Math.sin(currentObj1Aim * DEGREES);
            predictedObj2X += predictedObj2Speed * Math.cos(predictedObj2Aim * DEGREES);
            predictedObj2Y += predictedObj2Speed * Math.sin(predictedObj2Aim * DEGREES);
            const distance = getDistance(predictedObj1X, predictedObj1Y, predictedObj2X, predictedObj2Y);
            if (distance < COLLISION_BUFFER) {
                return true;
            }
            const obj1OutOfBounds = (obj1.aim) ? Math.abs(predictedObj1X) > arena.width / 2 || Math.abs(predictedObj1Y) > arena.height / 2 : false;
            const obj2OutOfBounds = (obj1.aim) ? Math.abs(predictedObj2X) > arena.width / 2 || Math.abs(predictedObj2Y) > arena.height / 2 : false;
            const obj1Dead = (obj1.energy !== undefined && obj1.energy <= 0.01) || obj1OutOfBounds;
            const obj2Dead = (obj2.energy !== undefined && obj2.energy <= 0.01) || obj2OutOfBounds;
            if (obj1Dead || obj2Dead) {
                break;
            }
        }
        return false;
    }

    tank.angleTo(obj) {
        return angleOf(tank.x, tank.y, obj.x, obj.y);
    }

    tank.distanceTo(obj) {
        return distanceOf(tank.x, tank.y, obj.x, obj.y);
    }

    tank.perpendicularSpeedComponent = (target) => {
        let angleDifference = (target.angleTo - target.bodyAim + 360000) % 360;
        return Math.sin(angleDifference * DEGREES);
    };

    tank.getMissilePriority = (missile) => {
        if (!predictedCollision(tank, missile)) {
            return 0;
        }
        const perfectTrajectory = (Math.atan2(tank.y - missile.y, tank.x - missile.x) * DEGREES + 36000) % 360;
        const trajectoryDifference = getAngleDifference(perfectTrajectory, missile.aim);
        const trajectoryFactor = (1 - Math.abs(trajectoryDifference) / 180);
        const distanceFactor = 1 - (missile.distance / MAX_DISTANCE);
        const energyFactor = 1 - (missile.energy / MAX_MISSILE_ENERGY);
        return trajectoryFactor * 0.4 + distanceFactor * 0.4 + energyFactor * 0.2;
    };

    tank.getTargetPriority = (target) => {
        const accuracyFactor = (1 - Math.abs(getAngleDifference(tank.bodyAim + tank.gunAim, target.angleTo)) / (tank.radarArc * MAX_RADAR_ARC_DEGREES)) ** 2;
        const trajectoryFactor = (1 - Math.abs(tank.perpendicularSpeedComponent(target)));
        const distanceFactor = (1 - target.distance / MAX_DISTANCE) ** 2;
        const energyFactor = (1 - target.energy / (saved.maxTargetEnergy || 1000));
        const speedFactor = 1 - Math.abs(target.speed);
        const gunHeatFactor = (1 - Math.min(1, 1 / Math.max(1, target.gunHeat))) ** (1 / 2);
        const hitProbability = accuracyFactor * 0.4 + trajectoryFactor * 0.3 + distanceFactor * 0.2 + speedFactor * 0.1;
        const vulnerabilityFactor = energyFactor * 0.6 + speedFactor * 0.25 + gunHeatFactor * 0.15;
        return (hitProbability * 4 + vulnerabilityFactor) / 5;
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

    let saved = tank.retained;
    let radar = {
        targets: tank.detectedTanks.sort((a, b) => { return tank.getTargetPriority(a) - tank.getTargetPriority(b) }),
        missiles: tank.detectedMissiles.sort((a, b) => { return tank.getMissilePriority(b) - tank.getMissilePriority(a) }),
        powerups: tank.detectedPowerups.sort((a, b) => { return tank.getPowerupPriority(a) - tank.getPowerupPriority(b) }),
    }

    let desiredGunTurn = 0;
    let desiredRadarTurn = 0;
    let desiredFirePower = 0;
    
    let _targetSpeed = 0;
    let _missileSpeed = 0;
    let _wallSpeed = 0;
    let _powerupSpeed = 0;
    let _wanderSpeed = 0;

    let _targetTurn = 0;
    let _missileTurn = 0;
    let _wallTurn = 0;
    let _powerupTurn = 0;
    let _wanderTurn = 0;

    if (tank.iteration === 0) {
        tank.name = "Rampage v2";
        saved = {
            targets: [],
            missiles: [],
            powerups: [],
        }
    }

    if (saved.isScanning) {
        if (!saved.scanRotation) {
            saved.scanRotation = 0;
            saved.tanks = [];
            saved.powerups = [];
            saved.missiles = [];
        }
        if (saved.scanRotation === 360) {
            saved.scanRotation = 0;
            saved.isScanning = false;
        }
        else {
            tank.radarTurn = 1;
            saved.scanRotation += MAX_RADAR_TURN_DEGREES;
        }
    }
    radar.tanks.forEach((tank) => {
        tank.priority = tank.getTargetPriority(tank);
        saved.tanks.push(tank);
    });
    radar.missiles.forEach((missile) => {
        missile.priority = missile.getTargetPriority(missile);
        saved.tanks.push(missile);
    });
    radar.powerups.forEach((powerup) => {
        powerup.priority = powerup.getTargetPriority(powerup);
        saved.powerups.push(powerup);
    });

    tank.speed = _wallSpeed || _missileSpeed || _targetSpeed || _powerupSpeed || _wanderSpeed;
    tank.bodyTurn = _wallTurn || _missileTurn || _targetTurn || _powerupTurn || _wanderTurn;
    tank.gunTurn = desiredGunTurn - tank.bodyTurn;

}