function main(tank, arena) {
  class ArenaBounds {
      constructor(width, height) {
          this._halfWidth = width / 2;
          this._halfHeight = height / 2;
      }
  
      contains(position, margin = 0) {
          return Math.abs(position._x) < this._halfWidth - margin &&
              Math.abs(position._y) < this._halfHeight - margin;
      }
  
      distanceToWall(position) {
          const leftWallDistance = Math.abs(-this._halfWidth - position._x);
          const rightWallDistance = Math.abs(this._halfWidth - position._x);
          const topWallDistance = Math.abs(-this._halfHeight - position._y);
          const bottomWallDistance = Math.abs(this._halfHeight - position._y);
          return Math.min(leftWallDistance, rightWallDistance, topWallDistance, bottomWallDistance);
      }
  
      nearestWallAngle(position) {
          const leftWallDistance = Math.abs(-this._halfWidth - position._x);
          const rightWallDistance = Math.abs(this._halfWidth - position._x);
          const topWallDistance = Math.abs(-this._halfHeight - position._y);
          const bottomWallDistance = Math.abs(this._halfHeight - position._y);
  
          let wallDistance = Infinity;
          let wallAngle = 0;
  
          if (leftWallDistance < wallDistance) {
              wallDistance = leftWallDistance;
              wallAngle = Math.PI; // 180 degrees
          }
          if (rightWallDistance < wallDistance) {
              wallDistance = rightWallDistance;
              wallAngle = 0; // 0 degrees
          }
          if (topWallDistance < wallDistance) {
              wallDistance = topWallDistance;
              wallAngle = -Math.PI / 2; // -90 degrees
          }
          if (bottomWallDistance < wallDistance) {
              wallDistance = bottomWallDistance;
              wallAngle = Math.PI / 2; // 90 degrees
          }
  
          return new Angle(wallAngle);
      }
  }
    
  const TAU = new Angle(2.0 * Math.PI);
  const HALF_TAU = TAU.div(2);
  const MAX_RADAR_ARC = TAU.div(4);
  const MAX_BODY_TURN = Angle.fromDegrees(1.5); // Maximum degrees tank body can turn per iteration
  const MAX_GUN_TURN = Angle.fromDegrees(3.0); // Maximum degrees gun can turn per iteration
  const MAX_MISSILE_ENERGY = 50; // Maximum energy a missile can have
  const MISSILE_SPEED = 4; // Speed of missiles
  const MAX_ACTUAL_SPEED = 2; // Maximum actual speed of tank
  const MAX_POWERUP_AMOUNT = 100; // Maximum amount for power-ups
  const POWERUP_PICKUP_DURATION = 300; // Duration for powerup pickup
  const MAX_GUN_HEAT = 30; // Maximum gun heat
  const MAX_TANK_ENERGY = 1000; // Maximum tank energy

  // Tank-specific constants
  const COLLISION_COOLDOWN_TIME = 40;
  const LOW_ENERGY_THRESHOLD = 120;

  // Missile interception constants
  const INTERCEPTION_BASE_THRESHOLD = 3.2;
  const INTERCEPTION_DISTANCE_FACTOR = 3.2;

  // Create arena bounds and calculate the maximum possible arena distance
  const arenaBounds = new ArenaBounds(arena.width, arena.height);
  const MAX_DISTANCE = Math.sqrt(arena.width * arena.width + arena.height * arena.height) / 2;
  const saved = tank.retained;

  const calculateGunTurn = (tank, x, y) => {
    const targetAngle = Angle.fromDegrees(tank.angleTo(x, y));
    let gunAngleDifference = Angle.fromDegrees(tank.bodyAim + tank.gunAim).difference(targetAngle);
    return gunAngleDifference.div(10.0).clamp(Angle.fromDegrees(-1.0), Angle.fromDegrees(1.0))
  };

  const perpendicularSpeedComponent = (target) => {
    const targetAngle = Angle.fromDegrees(target.angleTo);
    const bodyAngle = Angle.fromDegrees(target.bodyAim);
    const angleDifference = bodyAngle.difference(targetAngle);
    return Math.sin(angleDifference.radians);
  };

  const getTargetPriority = (tank, target) => {
    const bodyGunAngle = Angle.fromDegrees(tank.bodyAim + tank.gunAim);
    const targetAngle = Angle.fromDegrees(target.angleTo);
    const angleDiff = bodyGunAngle.difference(targetAngle);
    const accuracyFactor = (
      1
      - Math.abs(angleDiff.degrees) / (tank.radarArc * MAX_RADAR_ARC.degrees)
    ) ** 2;
    const trajectoryFactor = (1 - Math.abs(perpendicularSpeedComponent(target)));
    const distanceFactor = (1 - target.distance / MAX_DISTANCE) ** 2;
    const energyFactor = (1 - target.energy / (saved.maxTargetEnergy || 1000));
    const speedFactor = 1 - Math.abs(target.speed);
    const gunHeatFactor = (1 - Math.min(1, 1 / Math.max(1, target.gunHeat))) ** (1 / 2);

    const hitProbability = accuracyFactor * 0.35 + trajectoryFactor * 0.35 + distanceFactor * 0.3;
    const vulnerabilityFactor = energyFactor * 0.7 + speedFactor * 0.15 + gunHeatFactor * 0.15;

    return (hitProbability * 3 + vulnerabilityFactor * 2) / 5;
  };

  const getMissilePriority = (tank, missile) => {
    const perfectTrajectory = Angle.fromDegrees(tank.angleFrom(missile.x, missile.y));
    const missileAim = Angle.fromDegrees(missile.aim);
    const trajectoryDifference = perfectTrajectory.difference(missileAim);
    const trajectoryFactor = (1 - Math.abs(trajectoryDifference.degrees) / HALF_TAU.degrees);
    const distanceFactor = 1 - (missile.distance / MAX_DISTANCE);
    const energyFactor = 1 - (missile.energy / MAX_MISSILE_ENERGY);

    return trajectoryFactor * 0.5 + distanceFactor * 0.4 + energyFactor * 0.1;
  };

  const getPowerupPriority = (tank, powerup) => {
    const energyThreshold = saved.target?.energy || 500;

    const powerupValues = {
      "speed": 0.95,
      "energy": (tank.energy < energyThreshold) ? 1 : 0.9,
      "firepower": 1,
      "guncool": 0.9,
    };
    const safetyFactor = (
      (saved.target)
        ? new Vector2(saved.target.x, saved.target.y).distanceTo(new Vector2(powerup.x, powerup.y)) / MAX_DISTANCE
        : 0.5
    );
    const typeFactor = powerupValues[powerup.type] || 0;
    const amountFactor = powerup.amount / MAX_POWERUP_AMOUNT;
    const distanceFactor = 1 - powerup.distance / MAX_DISTANCE;
    const durationFactor = powerup.duration / POWERUP_PICKUP_DURATION;
    const durationTooShort = powerup.duration < powerup.distance / MAX_ACTUAL_SPEED;
    const priority = typeFactor * (
      amountFactor * 0.3 + safetyFactor * 0.3 + distanceFactor * 0.3 + durationFactor * 0.1
    );
    return (durationTooShort) ? 0 : priority;
  };

  predictedMissileCollision = (tank, missile) => {
    const PREDICTION_STEPS = MAX_DISTANCE / MISSILE_SPEED;
    const COLLISION_BUFFER = tank.size * 1.6;
    let predictedMissile = new Vector2(missile.x, missile.y);
    let predictedTank = new Vector2(tank.x, tank.y);
    let currentTankSpeed = tank.actualSpeed;
    let predictedBodyAim = Angle.fromDegrees(tank.bodyAim);
    const missileAim = Angle.fromDegrees(missile.aim);

    for (let i = 0; i < PREDICTION_STEPS; i++) {
      predictedMissile = predictedMissile.polarOffset(MISSILE_SPEED, missileAim);
      predictedTank = predictedTank.polarOffset(currentTankSpeed, predictedBodyAim);
      const distance = predictedMissile.distanceTo(predictedTank);

      if (distance < COLLISION_BUFFER) {
        return true;
      }
      if (
        missile.energy <= 0.01
        || !arenaBounds.contains(predictedMissile)
      ) {
        break;
      }
    }
    return false;
  };

  if (tank.iteration === 0) {
    tank.name = "b";
    tank.color = "#0022ff";
    tank.fillColor = "#000066";
    tank.treadColor = "#000000";
    tank.gunColor = "#eeeeee";
    tank.radarColor = "#0022ff";
    tank.radarArc = 0.8;

    saved.wanderPattern = 0;
    saved.previousTargetData = [];
    saved.missileEvasionReverse = 0;
    saved.target = null;
    saved.scanDirection = 0;
    saved.targets = {};
    saved.wallCollisions = 0;
    saved.wallAvoidance = {
      slowDown: 0.6,
      threshold: 8.0,
    };
    saved.lastMissileId = false;
    saved.firedMissiles = [];
    saved.orbitDir = 1; // 1 = clockwise, -1 = counter-clockwise
    saved.evasion = 0;
  }

  const tankPosition = new Vector2(tank.x, tank.y);

  // Determine if tank is near wall
  const wallProximityThreshold = saved.wallAvoidance.threshold * tank.size;
  const bodyAngle = Angle.fromDegrees(tank.bodyAim);
  const nextPosition = tankPosition.polarOffset(tank.actualSpeed, bodyAngle);
  tank.isNearWall = !arenaBounds.contains(nextPosition, wallProximityThreshold);

  // Calculate number of frames until wall collision
  let predictedAim = Angle.fromDegrees(tank.bodyAim + tank.bodyTurn * MAX_BODY_TURN.degrees);
  let predictedPosition = new Vector2(tank.x, tank.y);
  predictedPosition = predictedPosition.polarOffset(tank.actualSpeed, predictedAim);
  let collision = !arenaBounds.contains(predictedPosition, tank.size);
  let framesUntilWallCollision = 0;
  while (framesUntilWallCollision < 100 && !collision) {
    predictedAim = Angle.fromDegrees(predictedAim.degrees + tank.bodyTurn * MAX_BODY_TURN.degrees);
    predictedPosition = predictedPosition.polarOffset(tank.actualSpeed, predictedAim);
    collision = !arenaBounds.contains(predictedPosition, tank.size);
    framesUntilWallCollision++;
  }

  // Calculate distance to nearest wall and its angle
  const wallDistance = arenaBounds.distanceToWall(tankPosition);
  const wallAngleObj = arenaBounds.nearestWallAngle(tankPosition);
  const wallAngle = wallAngleObj.degrees;

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
  if (tank.energy < LOW_ENERGY_THRESHOLD) {
    tank.energyLow = true;
    let energyFactor = tank.energy / LOW_ENERGY_THRESHOLD;
    let direction = Math.sign(tank.speed);
    let desiredSpeed = 0.5 + 0.5 * energyFactor * direction;
    if (Math.abs(tank.speed) > Math.abs(desiredSpeed)) {
      tank.speed = desiredSpeed;
    }
  }
  else {
    tank.energyLow = false;
  }

  // Default behavior is to orient towards the center of the arena.
  const angleToCenter = Angle.fromDegrees(tank.angleTo(0, 0));
  const currentBodyAngle = Angle.fromDegrees(tank.bodyAim);
  const angleDifference = currentBodyAngle.difference(angleToCenter);
  tank.bodyTurn = angleDifference.clamp(Angle.fromDegrees(-1.0), Angle.fromDegrees(1.0)).degrees;

  // Handle detected tanks
  if (tank.detectedTanks.length > 0) {
    // Reset radar scan
    saved.scanSpeed = 1;
    saved.scanDirection = 0;
    saved.scanRotation = 0;

    tank.detectedTanks = tank.detectedTanks.sort((a, b) => getTargetPriority(tank, b) - getTargetPriority(tank, a));
    let target = tank.detectedTanks[0];
    saved.target = { ...target };

    const taunts = [
      "Get fuct", ",l.."
    ];
    tank.victoryMessage = taunts[~~(Math.random() * taunts.length)];

    // Conserve energy
    const targetsFarEnough = target.distance > arena.width / 3.5;
    const targetsGunIsCoolEnough = target.gunHeat < 15;
    const shouldConserveEnergy = target.energy * 2.5 > tank.energy;
    if (shouldConserveEnergy && targetsFarEnough && targetsGunIsCoolEnough) {
      tank.conserveEnergy = true;
    }

    // Store and average previous target data for velocity
    const targetPosition = new Vector2(target.x, target.y);
    saved.previousTargetData.push({
      position: targetPosition,
      angle: target.bodyAim,
      time: tank.iteration
    });
    if (saved.previousTargetData.length > 6) {
      saved.previousTargetData.shift();
    }

    // Calculate average velocity over the stored history
    let avgVelocityX = 0;
    let avgVelocityY = 0;
    if (saved.previousTargetData.length >= 2) {
      let totalDeltaTime = 0;
      for (let i = 1; i < saved.previousTargetData.length; i++) {
        const last = saved.previousTargetData[i];
        const prev = saved.previousTargetData[i - 1];
        const deltaTime = last.time - prev.time;
        avgVelocityX += (last.position._x - prev.position._x);
        avgVelocityY += (last.position._y - prev.position._y);
        totalDeltaTime += deltaTime;
      }
      avgVelocityX /= Math.max(1, totalDeltaTime);
      avgVelocityY /= Math.max(1, totalDeltaTime);
    }
    else {
      const targetBodyAngle = Angle.fromDegrees(target.bodyAim);
      const velocityVector = new Vector2(0, 0).polarOffset(target.actualSpeed, targetBodyAngle);
      avgVelocityX = velocityVector._x;
      avgVelocityY = velocityVector._y;
    }

    // Calculate missile intercept time
    let timeToIntercept = target.distance / MISSILE_SPEED;
    const baseIterations = 6;
    const velocityFactor = Math.abs(target.speed);
    const distanceFactor = target.distance / arena.width;
    const additionalIterations = (velocityFactor + distanceFactor) * baseIterations;
    const interceptCalculationIterations = baseIterations + additionalIterations;

    for (let i = 0; i < interceptCalculationIterations; i++) {
      const predictedTargetPosition = new Vector2(
        targetPosition._x + avgVelocityX * timeToIntercept,
        targetPosition._y + avgVelocityY * timeToIntercept
      );
      timeToIntercept = tank.distanceTo(predictedTargetPosition._x, predictedTargetPosition._y) / MISSILE_SPEED;
    }

    // Calculate final predicted target position
    const predictedTargetPosition = new Vector2(
      targetPosition._x + avgVelocityX * timeToIntercept,
      targetPosition._y + avgVelocityY * timeToIntercept
    );

    // Turn gun to the desired angle
    tank.gunTurn = calculateGunTurn(tank, predictedTargetPosition._x, predictedTargetPosition._y);

    // Calculate firing conditions
    const MAX_AIM_ACCURACY = 4.8;
    const DISTANCE_EXPONENT = 2.0;
    const aimAccuracyThreshold = Math.min(
      MAX_AIM_ACCURACY, Math.atan2(MAX_ACTUAL_SPEED * timeToIntercept, target.distance) * 180 / Math.PI
    );
    const predictedTargetAngle = Angle.fromDegrees(tank.angleTo(predictedTargetPosition._x, predictedTargetPosition._y));
    const bodyGunAngle = Angle.fromDegrees(tank.bodyAim + tank.gunAim);
    const gunAngleDifference = bodyGunAngle.difference(predictedTargetAngle);
    const aimError = Math.abs(gunAngleDifference.degrees);
    const aimErrorThreshold = aimAccuracyThreshold * (1 - (target.distance / arena.width) ** DISTANCE_EXPONENT);
    const perpendicularSpeedComponent_ = Math.abs(perpendicularSpeedComponent(target));
    const historicAccuracy = tank.aimAccuracy || 0.5;
    const probabilityOfHit = (1 - aimError / aimErrorThreshold) * (
      (1 - target.distance / MAX_DISTANCE) *
      (1 - perpendicularSpeedComponent_)
    );

    if (aimError < aimErrorThreshold) {
      const MIN_FIRE_POWER = 5;
      const DISTANCE_MULTIPLIER = 3;
      const AGGRESSIVE_FIRE_THRESHOLD = 0.85;

      const accuracyBonus = MAX_MISSILE_ENERGY * historicAccuracy ** (1 / 2) * probabilityOfHit ** 2;
      let firePower = (tank.energyLow) ? MIN_FIRE_POWER : Math.min(MAX_MISSILE_ENERGY, MIN_FIRE_POWER + accuracyBonus);
      firePower *= 4 - (target.distance / MAX_DISTANCE) * DISTANCE_MULTIPLIER;
      const weaponUpgrades = ["guncool", "firepower"];
      if (weaponUpgrades.includes(tank.powerup?.type) || Math.random() > AGGRESSIVE_FIRE_THRESHOLD) {
        firePower = Math.max(firePower, MAX_MISSILE_ENERGY * probabilityOfHit);
      }
      const HIGH_HIT_PROBABILITY_THRESHOLD = 0.85;
      if (probabilityOfHit > HIGH_HIT_PROBABILITY_THRESHOLD) {
        firePower = MAX_MISSILE_ENERGY;
      }
      const missileEnergy = firePower * MISSILE_ENERGY_MULTIPLIER;
      const missileEnergyAtImpact = missileEnergy - (target.distance / MISSILE_SPEED);
      if (tank.powerup?.type === "firepower") {
        firePower *= 1 + probabilityOfHit;
      }
      if (firePower > MIN_FIRE_POWER && missileEnergyAtImpact > firePower) {
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
        const desiredGunTurn = calculateGunTurn(tank, aimAtX, aimAtY);
        const randomDirection = 1 - Math.round(Math.random() * 2);
        saved.scanDirection = Math.sign(desiredGunTurn.radians) || randomDirection;
      }

      // Calculate scan speed and turn gun (radar will follow gun)
      const rotationAmount = saved.scanDirection * saved.scanSpeed;
      tank.gunTurn = saved.scanDirection * saved.scanSpeed;
      saved.scanRotation += Math.abs(rotationAmount * MAX_GUN_TURN.degrees);
      const fullRotations = ~~(saved.scanRotation / TAU.degrees);
      const slowDownRate = Math.min(4, fullRotations) / 4;
      saved.scanSpeed = 1 - 0.45 * slowDownRate;
      if (fullRotations === 5) {
        saved.scanRotation = 0;
        saved.scanDirection *= -1;
      }
    }
  }

  // Wall avoidance logic
  if (tank.isNearWall) {
    // Slow down for better handling
    const bodyAngle = Angle.fromDegrees(tank.bodyAim);
    const wallAngleObj = Angle.fromDegrees(wallAngle);
    const wallOffset = Math.abs(bodyAngle.difference(wallAngleObj).degrees);
    const directionFactor = 1 - (wallOffset / (HALF_TAU.degrees / 2));
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

    // Turn away from the wall
    const angleToCenter = Angle.fromDegrees(tank.angleTo(0, 0));
    const bodyAngleDiff = bodyAngle.difference(angleToCenter);
    tank.bodyTurn = bodyAngleDiff.degrees / HALF_TAU.degrees;

    // Always take the shortest turn path
    if (Math.abs(bodyAngleDiff.degrees) > HALF_TAU.degrees) {
      tank.speed *= -1;
      tank.bodyTurn *= -1;
    }
  }
  // Distance from wall is safe
  else {
    // Handle detected missiles
    if (tank.detectedMissiles.length > 0) {
      saved.incomingMissiles = tank.detectedMissiles.filter((missile) => {
        const perfectTrajectory = Angle.fromDegrees(tank.angleFrom(missile.x, missile.y));
        const missileAim = Angle.fromDegrees(missile.aim);
        const trajectoryDifference = perfectTrajectory.difference(missileAim);
        const aimError = Math.abs(trajectoryDifference.degrees);
        const interceptionAimThreshold = (
          INTERCEPTION_BASE_THRESHOLD + INTERCEPTION_DISTANCE_FACTOR * missile.distance / MAX_DISTANCE
        );
        return aimError < interceptionAimThreshold;
      });
      saved.underRapidFire = Math.max(0, tank.detectedMissiles.length - 1) * COLLISION_COOLDOWN_TIME;
      tank.detectedMissiles = tank.detectedMissiles.sort(
        (a, b) => getMissilePriority(tank, b) - getMissilePriority(tank, a)
      );
      const missile = tank.detectedMissiles[0];
      const perfectTrajectory = Angle.fromDegrees(tank.angleFrom(missile.x, missile.y));
      const missileAim = Angle.fromDegrees(missile.aim);
      const trajectoryDifference = perfectTrajectory.difference(missileAim);
      const aimError = Math.abs(trajectoryDifference.degrees);
      const interceptionAimThreshold = (
        INTERCEPTION_BASE_THRESHOLD + INTERCEPTION_DISTANCE_FACTOR * missile.distance / MAX_DISTANCE
      );
      saved.threatAngle = (saved.target?.angleTo) || missile.angleTo;

      // Move out of missiles path.
      const evasionExceptions = saved.missileEvasionReverse || tank.isNearWall;
      saved.willBeHitByMissile = saved.willBeHitByMissile || predictedMissileCollision(tank, missile);
      if (saved.willBeHitByMissile || aimError < interceptionAimThreshold && !evasionExceptions) {
        saved.missileEvasion = COLLISION_COOLDOWN_TIME;

        const EVASION_ANGLE_OFFSET = Angle.fromDegrees(85); // 85 degrees
        const EVASION_TURN_DIVISOR = 9;
        const bodyAngle = Angle.fromDegrees(tank.bodyAim);
        const threatAngle = Angle.fromDegrees(saved.threatAngle);
        const offsetAngle = Angle.fromDegrees(threatAngle.degrees + EVASION_ANGLE_OFFSET.degrees);
        const turnAngle = bodyAngle.difference(offsetAngle);
        tank.bodyTurn = turnAngle.degrees / EVASION_TURN_DIVISOR;
        tank.speed = 1;
        if (trajectoryDifference.radians < 0) {
          tank.speed *= -1;
          saved.missileEvasionReverse = ~~(missile.distance / missile.speed);
        }
      }
      // Conserve energy if safe
      else if (arena.tanksRemaining === 2 && saved.target?.gunHeat > 12) {
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
      saved.missileThreat = tank.detectedMissiles.reduce((sum, _missile) => sum + getMissilePriority(tank, missile), 0);
      if (saved.missileThreat > tank.energy) {
        tank.bodyColor = "#ff0000";
      }
    }
    // If no missiles are detected
    else {
      saved.willBeHitByMissile = false;
      saved.missileEvasion = 0;
      saved.missileEvasionReverse = 0;
      if (saved.target?.gunHeat > 1) {
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
        const missileAim = Angle.fromDegrees(missile.aim);
        const position = new Vector2(missile.x, missile.y);
        const newPosition = position.polarOffset(MISSILE_SPEED, missileAim);
        missile.energy -= MISSILE_SPEED;

        if (missile.energy <= 0) {
          missile.energy = 1 / Number.MAX_SAFE_INTEGER;
        }

        if (!arenaBounds.contains(newPosition)) {
          return false;
        }
        saved.missileThreat += missile.energy;
        return true;

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
      const bodyGunAngle = Angle.fromDegrees(tank.bodyAim + tank.gunAim);
      const collisionAngle = Angle.fromDegrees(saved.collisionAngle);
      const desiredGunTurn = bodyGunAngle.difference(collisionAngle);
      tank.gunTurn = desiredGunTurn.degrees / 10;
    }
    if (tank.isNearWall && saved.collisionCoolDown && !saved.underRapidFire) {
      const COLLISION_ANGLE_OFFSET = Angle.fromDegrees(90); // 90 degrees
      const COLLISION_TURN_DIVISOR = 10;
      const bodyAngle = Angle.fromDegrees(tank.bodyAim);
      const collisionAngle = Angle.fromDegrees(saved.collisionAngle);
      const offsetAngle = Angle.fromDegrees(collisionAngle.degrees + COLLISION_ANGLE_OFFSET.degrees);
      const directionDifference = bodyAngle.difference(offsetAngle);
      tank.bodyTurn = directionDifference.degrees / COLLISION_TURN_DIVISOR;
      tank.speed = (saved.collisionCoolDown || 1) / COLLISION_COOLDOWN_TIME;
      if (Math.abs(collisionAngle.degrees) > (HALF_TAU.degrees / 2)) {
        tank.bodyTurn *= -tank.bodyTurn;
        tank.speed *= -1;
      }
    }

    // Orient tanks body perpendicular to target for missile evasion
    if (saved.target && !tank.isNearWall) {
      const EVASION_PERPENDICULAR_OFFSET = Angle.fromDegrees(88); // Almost perpendicular for better evasion
      const bodyAngle = Angle.fromDegrees(tank.bodyAim);
      const targetAngle = Angle.fromDegrees(saved.target.angleTo);
      const offsetAngle = Angle.fromDegrees(targetAngle.degrees + EVASION_PERPENDICULAR_OFFSET.degrees);
      const angleDifference = bodyAngle.difference(offsetAngle);
      tank.bodyTurn = angleDifference.degrees / HALF_TAU.degrees;
    }
  }

  // Handle powerups
  if (tank.detectedPowerups.length > 0) {
    saved.scannedPowerups = true;
    tank.detectedPowerups = tank.detectedPowerups.sort(
      (a, b) => getPowerupPriority(tank, b) - getPowerupPriority(tank, a)
    );
    saved.powerup = tank.detectedPowerups[0];
    saved.powerup.priority = getPowerupPriority(tank, saved.powerup);
    const WALL_PROXIMITY_FACTOR = 0.75; // How close to the wall is considered "near wall"
    const powerupPosition = new Vector2(saved.powerup.x, saved.powerup.y);
    saved.powerup.isNearWall = !arenaBounds.contains(powerupPosition, arenaBounds._halfWidth * (1 - WALL_PROXIMITY_FACTOR));
  }

  // Calculate safety level of grabbing powerup
  if (saved.powerup) {
    saved.powerup.safety = 1;
  }
  if (saved.powerup && saved.target) {
    const targetAngle = Angle.fromDegrees(tank.angleTo(saved.target.x, saved.target.y));
    const powerupAngle = Angle.fromDegrees(tank.angleTo(saved.powerup.x, saved.powerup.y));
    let angleOffset = Math.abs(targetAngle.difference(powerupAngle).degrees);
    if (angleOffset > (HALF_TAU.degrees / 2)) {
      angleOffset = (HALF_TAU.degrees / 2) - (angleOffset - (HALF_TAU.degrees / 2));
    }
    let trajectoryFactor = 1 - angleOffset / (HALF_TAU.degrees / 2);
    let gunHeatFactor = 1 - saved.target.gunHeat / MAX_GUN_HEAT;
    const powerupPosition = new Vector2(saved.powerup.x, saved.powerup.y);
    const targetPosition = new Vector2(saved.target.x, saved.target.y);
    const tankPosition = new Vector2(tank.x, tank.y);
    const distanceFactor = (1 - tankPosition.distanceTo(powerupPosition) / MAX_DISTANCE) ** 2;
    const targetDistanceFactor = tankPosition.distanceTo(targetPosition) / MAX_DISTANCE;
    const missileFactor = (saved.incomingMissiles || []).length;
    const evasionFactor = saved.missileEvasion / COLLISION_COOLDOWN_TIME;

    const numerator = (
      distanceFactor * 0.6 +
      trajectoryFactor * 0.25 +
      targetDistanceFactor * 0.15
    );
    const denominator = (
      1 +
      missileFactor * 0.9 +
      gunHeatFactor * 0.8 +
      evasionFactor * 0.7
    );
    saved.powerup.safety = numerator / denominator;
  }

  // Check for exceptions to getting the powerup
  if (saved.powerup) {
    const distanceToPowerup = tank.distanceTo(saved.powerup.x, saved.powerup.y);
    saved.powerup.safetyThreshold = 1 - saved.powerup.priority / 8;
    if (saved.powerup.type === "energy") {
      const newSafetyThreshold = (saved.powerup.safety + distanceToPowerup / MAX_DISTANCE) / 2;
      saved.powerup.safetyThreshold = Math.min(saved.powerup.safetyThreshold, newSafetyThreshold);
    }
    saved.powerup.exceptions = (
      (saved.willBeHitByMissile) ||
      (saved.missileEvasion) ||
      (saved.powerup?.safety < saved.powerup.safetyThreshold) ||
      (tank.isNearWall || saved.powerup?.isNearWall)
    );
  }

  // Grab the powerup
  saved.isSeekingPowerup = false;
  if (saved.powerup && !saved.powerup.exceptions) {
    saved.isSeekingPowerup = true;
    const powerupPosition = new Vector2(saved.powerup.x, saved.powerup.y);
    const tankPosition = new Vector2(tank.x, tank.y);
    const distance = tankPosition.distanceTo(powerupPosition);
    const angle = Angle.fromDegrees(tank.angleTo(saved.powerup.x, saved.powerup.y));
    const bodyAngle = Angle.fromDegrees(tank.bodyAim);
    const directionDifference = bodyAngle.difference(angle);
    const POWERUP_TURN_DIVISOR = 10;
    tank.bodyTurn = directionDifference.degrees / POWERUP_TURN_DIVISOR;
    tank.speed = (distance > tank.size * 2) ? 1 : distance / MAX_DISTANCE;
    if (Math.abs(directionDifference.degrees) > HALF_TAU.degrees) {
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
    const targetPosition = new Vector2(saved.target.x, saved.target.y);
    const powerupPosition = new Vector2(saved.powerup.x, saved.powerup.y);
    const distance = targetPosition.distanceTo(powerupPosition);
    if (distance < saved.target.size) {
      saved.powerup = false;
      saved.isSeekingPowerup = false;
    }
  }

  // Scan arena periodically
  if (tank.iteration % 75 === 0 || tank.radarAim > 0) {
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

  // Handle energy regeneration
  if (tank.conserveEnergy && tank.energy < MAX_TANK_ENERGY && !saved.willBeHitByMissile && !saved.isSeekingPowerup) {
    tank.speed = 0;
  }

  // Color tank
  const colorTankPart = (amount) => {
    const r = Math.round((1 - amount) * 255);
    return r.toString(16).padStart(2, "0");
  };

  // Fill color
  const energyGrade = Math.min(1, tank.energy / 1000);
  const colorShade = energyGrade ** (1 / 4);
  const rHex = colorTankPart(colorShade);
  tank.fillColor = `#${rHex}0066`;

  // Tread color
  tank.treadColor = (tank.speed === 0) ? "#000000" : "#0033cc";

  // Gun color
  tank.gunColor = (tank.gunHeat === 0) ? "#0022ff" : "#0033cc";

  // Radar color
  tank.radarColor = (tank.detectedTanks.length > 0 || tank.detectedMissiles.length > 0) ? "#0022ff" : "#0033cc";

  // Indicator light
  tank.indicator.color = "#00ff00";
  tank.indicator.intensity = 0;
  if (saved.powerup) {
    tank.indicator.color = "#00ff00";
    tank.indicator.intensity = (saved.isSeekingPowerup) ? 1 : 0.5;
  } else if (saved.missileEvasion) {
    tank.indicator.color = "#ff00ff";
    tank.indicator.intensity = 1;
  } else if (saved.target) {
    tank.indicator.color = "#00ff00";
    tank.indicator.intensity = 0.3;
  }

  return tank;
}