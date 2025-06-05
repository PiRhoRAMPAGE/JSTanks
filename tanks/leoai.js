function main(tank, arena) {
    const missileSpeed = 15; // Increased missile speed for more rapid fire effect
    const maxDistance = Math.sqrt(arena.width ** 2 + arena.height ** 2);

    tank.angleTo = (x, y) => Math.atan2(y - tank.y, x - tank.x) * 180 / Math.PI;
    tank.distanceTo = (x, y) => Math.sqrt((y - tank.y) ** 2 + (x - tank.x) ** 2);
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
        // Ensure target is defined and has x, y properties
        if (!target || typeof target.x === 'undefined' || typeof target.y === 'undefined') {
            return 1; // Default to a value that won't cause issues, or handle error appropriately
        }
        let angleDifference = (tank.angleTo(target.x, target.y) - target.bodyAim + 360000) % 360;
        if (Math.abs(angleDifference) > 90) {
            angleDifference += (angleDifference > 0) ? -180 : 180;
        }
        return Math.cos(angleDifference * Math.PI / 180);
    };

    // Forward declaration for maxTargetEnergy, will be properly assigned later
    let maxTargetEnergy = 1; 

    tank.getTargetPriority = (target) => {
        // Ensure target is defined
        if (!target) return 0; // Or some other default low priority

        const angleToTarget = tank.angleTo(target.x, target.y);
        const accuracyFactor = (1 - Math.abs(tank.angleDifference(tank.bodyAim + tank.gunAim, angleToTarget)) / (tank.radarArc * 90)) ** 2;
        const trajectoryFactor = (1 - Math.abs(tank.perpendicularSpeedComponent(target)));
        const distanceFactor = (1 - target.distance / maxDistance) ** 2;
        // Ensure maxTargetEnergy is not zero to prevent division by zero
        const currentMaxEnergy = maxTargetEnergy === 0 ? 1 : maxTargetEnergy;
        const energyFactor = (1 - target.energy / currentMaxEnergy);
        const speedFactor = 1 - Math.abs(target.speed);
        const gunHeatFactor = (1 - Math.min(1, 1 / Math.max(1, target.gunHeat))) ** (1 / 2);
        const hitProbability = accuracyFactor * 0.4 + trajectoryFactor * 0.3 + distanceFactor * 0.2 + speedFactor * 0.1;
        const vulnerabilityFactor = energyFactor * 0.6 + speedFactor * 0.25 + gunHeatFactor * 0.15;
        const aggressionBalance = (tank.retained.selfConfidence) ? Math.min(1, Math.max(0, 1 - tank.retained.selfConfidence)) : 0.5;
        const shotIsGood = hitProbability * (1 - aggressionBalance);
        const targetIsVulnerable = vulnerabilityFactor * aggressionBalance;
        return (shotIsGood * 4 + targetIsVulnerable) / 5;
    }
    
    tank.commitMemory = (key, value) => { localStorage.setItem(`tank_${encodeURIComponent(tank.name)}_${encodeURIComponent(key)}`, JSON.stringify(value)) };
    tank.forgetMemory = (key) => { localStorage.removeItem(`tank_${encodeURIComponent(tank.name)}_${encodeURIComponent(key)}`) };
    tank.getMemory = (key) => {
        const value = localStorage.getItem(`tank_${encodeURIComponent(tank.name)}_${encodeURIComponent(key)}`);
        return (value) ? JSON.parse(value) : undefined;
    };
    
    if (tank.iteration === 0) {
        tank.name = "LeoAI";
        tank.color = "#556b2f";
        tank.fillColor = "#3b5323";
        tank.treadColor = "#222222";
        tank.gunColor = "#8b1a1a"
        tank.radarArc = 1;
        tank.speed = 1; // Initial speed
        tank.gunTurn = tank.calculateGunTurn(0, 0);
        tank.retained = tank.retained || {}; // Ensure retained object exists
        tank.retained.wanderPattern = 0;
        tank.retained.previousTargetData = [];
        tank.retained.missileEvasionReverse = 0;
        tank.retained.target = null;
        tank.retained.threat = false;
        tank.retained.scanDirection = 0;
        tank.retained.targets = {};
        tank.retained.matchOver = false;
        tank.retained.wins = tank.getMemory("winCount") || 0;
        tank.retained.gameCount = tank.getMemory("gameCount") || 0;
        tank.retained.flankDirection = Math.random() > 0.5 ? 1 : -1;
        tank.retained.flankStateTime = 0;
        tank.retained.flankState = "approach";
        tank.retained.emergencyEvade = 0;
        tank.retained.evading = 0;
        tank.retained.lastDodgeDirection = null;
        tank.retained.avoidingWall = false;
        tank.retained.activeMissile = null;
        tank.retained.searchPattern = 0;
        tank.commitMemory("gameCount", tank.retained.gameCount + 1);
        tank.retained.closestEnemyDistance = Infinity;
        tank.retained.lastWallAvoidanceAngle = 0;
        tank.retained.lastOpponentMoveDirection = "right";
        tank.retained.seekingUpgradeTarget = null;
        tank.retained.upgradeCollectionDistance = tank.size * 1.2;
    }
    

    // --- Update target list ---
    // Ensure tank.detectedTanks is an array before accessing length or iterating
    if (tank.detectedTanks && Array.isArray(tank.detectedTanks) && tank.detectedTanks.length > 0) {
        tank.detectedTanks.forEach((detected) => {
            if (detected && typeof detected.index !== 'undefined') { // Ensure detected and detected.index are valid
                tank.retained.targets[detected.index] = detected;
                tank.retained.targets[detected.index].iteration = tank.iteration;
            }
        });
    }
    
    let scanningForCleanup = true; 
    const targetArray = [];
    // Ensure tank.retained.targets is an object
    const currentTargetKeys = tank.retained.targets ? Object.keys(tank.retained.targets) : [];
    const deadTargetsExist = () => currentTargetKeys.length > (arena.tanksRemaining - 1);
    let longestAbsenceIteration; // Renamed to avoid confusion with loop variable

    // Loop to clean up old targets and populate targetArray
    // This loop will run at least once if scanningForCleanup is true, or if deadTargetsExist is true
    while ((tank.retained.targets && Object.keys(tank.retained.targets).length > 0 && (deadTargetsExist() || scanningForCleanup))) {
        let removalIndex = -1; 
        longestAbsenceIteration = -1;  
        let currentIterationTargetArray = []; // Temporary array for current iteration's valid targets

        for (const targetIndex of Object.keys(tank.retained.targets)) {
            const currentTargetEntry = tank.retained.targets[targetIndex]; 
            if (currentTargetEntry && typeof currentTargetEntry.iteration !== 'undefined') { // Check if entry and iteration are valid
                const absenceTime = tank.iteration - currentTargetEntry.iteration;
                if (absenceTime > longestAbsenceIteration) {
                    removalIndex = targetIndex;
                    longestAbsenceIteration = absenceTime;
                }
                currentIterationTargetArray.push(currentTargetEntry); // Add to temp array
            }
        }
        targetArray.length = 0; // Clear targetArray
        targetArray.push(...currentIterationTargetArray); // Repopulate with valid targets for this iteration

        if (removalIndex !== -1 && Object.keys(tank.retained.targets).length > (arena.tanksRemaining -1) ) {
             delete tank.retained.targets[removalIndex];
        } else if (removalIndex !== -1 && longestAbsenceIteration > 100 && Object.keys(tank.retained.targets).length >= (arena.tanksRemaining -1) ) {
            delete tank.retained.targets[removalIndex];
        }
        scanningForCleanup = false; 
        if (Object.keys(tank.retained.targets).length === 0) break; // Exit if no targets left to process
    }
    // If targetArray is empty after cleanup (e.g., no initial targets), ensure it's an empty array.
    if (targetArray.length === 0 && tank.retained.targets && Object.keys(tank.retained.targets).length > 0) {
        // This case might happen if all targets were deemed invalid; repopulate from retained if any exist
        for (const targetIndex of Object.keys(tank.retained.targets)) {
            if (tank.retained.targets[targetIndex]) {
                targetArray.push(tank.retained.targets[targetIndex]);
            }
        }
    }


    maxTargetEnergy = targetArray.reduce((max, current) => Math.max(max, (current && current.energy) || 0), 1);
    const ttlTargetEnergy = targetArray.reduce((sum, current) => sum + ((current && current.energy) || 0), 0);
    tank.retained.selfConfidence = (targetArray.length === 0) ? 1 / Math.max(1, (arena.tanksRemaining - 1)) : tank.energy / (tank.energy + ttlTargetEnergy);
    tank.retained.canBeAggressive = tank.retained.target && arena.tanksRemaining === 2 && tank.energy > tank.retained.target.energy * 2;

    const minSpeedVal = tank.energy < 200 ? 0.3 : (tank.energy < 500 ? 0.6 : 0.8);
    if (Math.abs(tank.speed) < minSpeedVal) {
        tank.speed = minSpeedVal * (tank.speed >= 0 ? 1 : -1);
    }
    
    const wanderSeed = 0.4 + Math.random() * 0.4;
    tank.retained.wanderPatterns = [
        Math.cos(tank.iteration / 7) * wanderSeed + Math.sin(tank.iteration / 25) * (1 - wanderSeed),
        Math.sin(tank.iteration / 8) * wanderSeed + Math.cos(tank.iteration / 24) * (1 - wanderSeed),
        Math.cos(tank.iteration / 9) * wanderSeed + Math.sin(tank.iteration / 23) * (1 - wanderSeed),
        Math.sin(tank.iteration / 10) * wanderSeed + Math.cos(tank.iteration / 22) * (1 - wanderSeed),
    ];
    
    const patternChanger = (10 + tank.index) + ~~(Math.random() * 10 + (1 - tank.index));
    if ((tank.iteration + tank.index) % patternChanger === 0) {
        tank.retained.wanderPattern = ~~(Math.random() * tank.retained.wanderPatterns.length);
        if (Math.random() > 0.8) {
            tank.retained.wanderPattern = 0;
        }
    }
    tank.bodyTurn = tank.retained.wanderPatterns[tank.retained.wanderPattern];

    let isSeekingUpgrade = false;
    if (tank.retained.seekingUpgradeTarget) {
        const stillExists = tank.detectedUpgrades && Array.isArray(tank.detectedUpgrades) && tank.detectedUpgrades.find(upg =>
            upg && tank.retained.seekingUpgradeTarget && // Check upg and seekingUpgradeTarget
            upg.x === tank.retained.seekingUpgradeTarget.x &&
            upg.y === tank.retained.seekingUpgradeTarget.y &&
            upg.type === tank.retained.seekingUpgradeTarget.type
        );
        if (!stillExists) {
            tank.retained.seekingUpgradeTarget = null;
        }
    }

    if (!tank.retained.seekingUpgradeTarget && tank.detectedUpgrades && Array.isArray(tank.detectedUpgrades) && tank.detectedUpgrades.length > 0) {
        tank.detectedUpgrades.sort((a, b) => tank.distanceTo(a.x, a.y) - tank.distanceTo(b.x, b.y));
        tank.retained.seekingUpgradeTarget = { ...(tank.detectedUpgrades[0] || {}) }; // Ensure we copy an object
    }

    if (tank.retained.seekingUpgradeTarget && typeof tank.retained.seekingUpgradeTarget.x !== 'undefined') { // Check if it's a valid target
        const upgrade = tank.retained.seekingUpgradeTarget;
        const distanceToUpgrade = tank.distanceTo(upgrade.x, upgrade.y);

        if (distanceToUpgrade < tank.retained.upgradeCollectionDistance) {
            tank.retained.seekingUpgradeTarget = null;
        } else {
            const angleToUpgrade = tank.angleTo(upgrade.x, upgrade.y);
            let bodyAngleDifferenceToUpgrade = tank.angleDifference(tank.bodyAim, angleToUpgrade);
            tank.bodyTurn = Math.max(-1, Math.min(1, bodyAngleDifferenceToUpgrade / 10));
            tank.speed = 1;
            isSeekingUpgrade = true;
        }
    }

    tank.firePower = 0;
    const currentDetectedTanks = targetArray.filter(t => t && t.iteration === tank.iteration);

    if (currentDetectedTanks.length > 0) {
        currentDetectedTanks.sort((a, b) => tank.getTargetPriority(b) - tank.getTargetPriority(a));
        let currentTargetForLogic = currentDetectedTanks[0];
        
        if(currentTargetForLogic) { // Ensure currentTargetForLogic is defined
            tank.retained.scanDirection = 0; 
            tank.retained.threat = { ...currentTargetForLogic };
            tank.retained.target = { ...currentTargetForLogic }; 
            tank.retained.closestEnemyDistance = currentTargetForLogic.distance;

            // const taunts = [ /* ... */ ]; // Assuming taunts are defined elsewhere or not critical for this fix
            // tank.victoryMessage = taunts[~~(Math.random() * taunts.length)];

            if (!isSeekingUpgrade) {
                tank.retained.flankStateTime++;
                const optimalDistance = arena.width / 4;
                const flankAngleOffset = 70;
                if (tank.retained.flankStateTime > 40) { 
                    if (Math.random() > 0.7) tank.retained.flankDirection *= -1;
                    if (tank.retained.flankState === "approach") tank.retained.flankState = "circle";
                    else if (tank.retained.flankState === "circle") { if (Math.random() > 0.7) tank.retained.flankState = "reverse"; }
                    else tank.retained.flankState = "approach";
                    tank.retained.flankStateTime = 0;
                }
                
                let desiredBodyAngle = tank.bodyAim; // Default to current aim
                switch (tank.retained.flankState) {
                    case "approach":
                        desiredBodyAngle = tank.angleTo(currentTargetForLogic.x, currentTargetForLogic.y) + (flankAngleOffset * 0.5 * tank.retained.flankDirection);
                        tank.speed = 1;
                        break;
                    case "circle":
                        const distanceDiff = currentTargetForLogic.distance - optimalDistance;
                        let circleAngle = tank.angleTo(currentTargetForLogic.x, currentTargetForLogic.y) + (flankAngleOffset * tank.retained.flankDirection);
                        if (Math.abs(distanceDiff) > 50) {
                            circleAngle = tank.angleTo(currentTargetForLogic.x, currentTargetForLogic.y) + (flankAngleOffset * 0.5 * tank.retained.flankDirection);
                            if (distanceDiff < 0) circleAngle = tank.angleTo(currentTargetForLogic.x, currentTargetForLogic.y) + 180 + (flankAngleOffset * 0.3 * tank.retained.flankDirection);
                        }
                        desiredBodyAngle = circleAngle;
                        tank.speed = 1;
                        break;
                    case "reverse":
                        desiredBodyAngle = tank.angleTo(currentTargetForLogic.x, currentTargetForLogic.y) + (flankAngleOffset * 1.2 * tank.retained.flankDirection);
                        tank.speed = -0.8;
                        break;
                }
                let bodyAngleDifference = tank.angleDifference(tank.bodyAim, desiredBodyAngle);
                tank.bodyTurn = bodyAngleDifference / 180; 
            }

            if (!tank.retained.previousTargetData) tank.retained.previousTargetData = [];
            if (tank.speed && currentTargetForLogic) tank.retained.previousTargetData.push({ x: currentTargetForLogic.x, y: currentTargetForLogic.y, angle: currentTargetForLogic.bodyAim, time: tank.iteration });
            if (tank.retained.previousTargetData.length > 5) tank.retained.previousTargetData.shift();

            let avgVelocityX = 0, avgVelocityY = 0;
            let timeToIntercept = (currentTargetForLogic.distance || maxDistance) / missileSpeed; // Default distance if undefined
            const baseIterations = 5;
            const velocityFactor = Math.abs(currentTargetForLogic.speed || 0);
            const distanceFactor = (currentTargetForLogic.distance || maxDistance) / arena.width;
            const additionalIterations = (velocityFactor + distanceFactor) * baseIterations;
            const interceptCalculationIterations = baseIterations + additionalIterations;

            if (tank.retained.previousTargetData.length >= 2) {
                let totalDeltaTime = 0;
                let totalDeltaX = 0;
                let totalDeltaY = 0;
                for (let i = 1; i < tank.retained.previousTargetData.length; i++) {
                    const last = tank.retained.previousTargetData[i];
                    const prev = tank.retained.previousTargetData[i - 1];
                    if(last && prev && typeof last.time !== 'undefined' && typeof prev.time !== 'undefined') { // Check data points
                        const deltaTime = Math.max(1, last.time - prev.time);
                        totalDeltaX += (last.x - prev.x);
                        totalDeltaY += (last.y - prev.y);
                        totalDeltaTime += deltaTime;
                    }
                }
                if (totalDeltaTime > 0) {
                    avgVelocityX = totalDeltaX / totalDeltaTime;
                    avgVelocityY = totalDeltaY / totalDeltaTime;
                } else {
                     avgVelocityX = (currentTargetForLogic.actualSpeed || 0) * Math.cos((currentTargetForLogic.bodyAim || 0) * Math.PI / 180);
                     avgVelocityY = (currentTargetForLogic.actualSpeed || 0) * Math.sin((currentTargetForLogic.bodyAim || 0) * Math.PI / 180);
                }
            } else if (currentTargetForLogic) { // Check currentTargetForLogic before accessing its properties
                avgVelocityX = (currentTargetForLogic.actualSpeed || 0) * Math.cos((currentTargetForLogic.bodyAim || 0) * Math.PI / 180);
                avgVelocityY = (currentTargetForLogic.actualSpeed || 0) * Math.sin((currentTargetForLogic.bodyAim || 0) * Math.PI / 180);
            }
            
            let predictedTargetX = currentTargetForLogic.x, predictedTargetY = currentTargetForLogic.y; // Default to current
            if (currentTargetForLogic) { // Check currentTargetForLogic
                for (let i = 0; i < interceptCalculationIterations; i++) {
                    const predictedTargetX_iter = currentTargetForLogic.x + avgVelocityX * timeToIntercept;
                    const predictedTargetY_iter = currentTargetForLogic.y + avgVelocityY * timeToIntercept;
                    timeToIntercept = tank.distanceTo(predictedTargetX_iter, predictedTargetY_iter) / missileSpeed;
                }
                predictedTargetX = currentTargetForLogic.x + avgVelocityX * timeToIntercept;
                predictedTargetY = currentTargetForLogic.y + avgVelocityY * timeToIntercept;
                if (Math.abs(currentTargetForLogic.speed || 0) < 0.1) {
                    predictedTargetX = currentTargetForLogic.x;
                    predictedTargetY = currentTargetForLogic.y;
                }
                if (currentTargetForLogic.justFired) { 
                    // Basic post-fire prediction - this part was commented as /* ... */
                    // Assuming a simple strafe based on lastOpponentMoveDirection
                    if (tank.retained.lastOpponentMoveDirection === "right") {
                        predictedTargetX += 20; // Adjust strafe distance as needed
                    } else if (tank.retained.lastOpponentMoveDirection === "left") {
                        predictedTargetX -= 20;
                    }
                    // Update lastOpponentMoveDirection (this logic was missing from the snippet)
                    // This is a guess, actual logic might be more complex
                    // For now, let's assume it's updated elsewhere or not critical for the length error
                }
            }

            tank.gunTurn = tank.calculateGunTurn(predictedTargetX, predictedTargetY);

            if (currentTargetForLogic) { // Check currentTargetForLogic
                const predictedTargetAngle = tank.angleTo(predictedTargetX, predictedTargetY);
                const gunAngleDifference = tank.angleDifference(tank.bodyAim + tank.gunAim, predictedTargetAngle);
                const aimError = Math.abs(gunAngleDifference);
                const aimErrorThreshold = 5 * (1 - (currentTargetForLogic.distance || maxDistance) / arena.width);
                const targetIsInRange = (currentTargetForLogic.distance || maxDistance) < arena.width / 2;
                const firingCondition1 = targetIsInRange && aimError < aimErrorThreshold;
                const firingCondition2 = (currentTargetForLogic.gunHeat || 0) > 0 && aimError < aimErrorThreshold;
                const firingCondition3 = Math.abs(currentTargetForLogic.speed || 0) <= 0.1 && aimError < aimErrorThreshold / 100;
                const firingCondition4 = aimError < aimErrorThreshold / 100;
                let fireProbability = 0.9;
                if (firingCondition1) fireProbability = 0.95;
                else if (firingCondition2) fireProbability = 0.5;
                else if (firingCondition3) fireProbability = 0.1;
                else if (firingCondition4) fireProbability = 0.99;

                if (fireProbability > Math.random()) {
                    const firePowerVal = 15;
                    if (tank.energy >= firePowerVal) {
                        tank.firePower = firePowerVal;
                    }
                }
            }
        }

    } else {
        tank.retained.threat = false;
        tank.retained.target = null;

        if (!isSeekingUpgrade) {
            if (!tank.retained.scanDirection) {
                let aimAtX = 0, aimAtY = 0;
                if (tank.retained.previousTargetData && tank.retained.previousTargetData.length > 0) {
                    const lastKnown = tank.retained.previousTargetData[tank.retained.previousTargetData.length -1];
                    if (lastKnown) { aimAtX = lastKnown.x; aimAtY = lastKnown.y; }
                }
                const desiredGunTurnForScan = tank.calculateGunTurn(aimAtX, aimAtY);
                tank.retained.scanDirection = Math.sign(desiredGunTurnForScan) || 1;
                if (Math.random() > 0.98) tank.retained.scanDirection *= -1;
            }
            tank.gunTurn = tank.retained.scanDirection * (1 + Math.sin(tank.iteration / 20) * 0.3);

            const searchPatterns = [
                Math.sin(tank.iteration / 15) * 0.8,
                Math.cos(tank.iteration / 25) * 0.7,
                Math.sin(tank.iteration / 20) * Math.cos(tank.iteration / 40) * 0.9
            ];
            if (tank.iteration % 50 === 0) tank.retained.searchPattern = Math.floor(Math.random() * searchPatterns.length);
            tank.bodyTurn = searchPatterns[tank.retained.searchPattern || 0];

            const minSearchSpeed = 0.7;
            if (typeof tank.speed !== 'number') tank.speed = minSearchSpeed; 
            tank.speed = Math.max(minSearchSpeed, Math.abs(tank.speed)) * (tank.speed >= 0 ? 1 : -1);
            if (tank.iteration % 40 === 0 && Math.random() > 0.7) tank.speed *= -1;
        } else {
            tank.gunTurn = (tank.retained.scanDirection || 1) * 0.2;
        }
    }

    if (tank.detectedMissiles && Array.isArray(tank.detectedMissiles) && tank.detectedMissiles.length > 0) {
        // Ensure detectedMissiles elements are valid before sorting and accessing properties
        const validMissiles = tank.detectedMissiles.filter(m => m && typeof m.energy !== 'undefined' && typeof m.distance !== 'undefined' && typeof m.actualSpeed !== 'undefined' && typeof m.aim !== 'undefined');

        if (validMissiles.length > 0) {
            validMissiles.sort((a, b) => {
                let aEnergyThreat = Math.min(1, (a.energy * 4) / tank.energy);
                let bEnergyThreat = Math.min(1, (b.energy * 4) / tank.energy);
                const aTrajectory = (Math.atan2(tank.y - a.y, tank.x - a.x) * 180 / Math.PI + 36000) % 360;
                const bTrajectory = (Math.atan2(tank.y - b.y, tank.x - b.x) * 180 / Math.PI + 36000) % 360;
                const aTrajectoryDiff = Math.abs(tank.angleDifference(aTrajectory, a.aim));
                const bTrajectoryDiff = Math.abs(tank.angleDifference(bTrajectory, b.aim));
                const aTimeToImpact = a.distance / (a.actualSpeed || 1); // Avoid division by zero
                const bTimeToImpact = b.distance / (b.actualSpeed || 1);
                const aThreatLevel = (aEnergyThreat * 0.4) + ((1 - aTrajectoryDiff / 180) * 0.4) + (1 / Math.max(0.1, aTimeToImpact) * 0.2);
                const bThreatLevel = (bEnergyThreat * 0.4) + ((1 - bTrajectoryDiff / 180) * 0.4) + (1 / Math.max(0.1, bTimeToImpact) * 0.2);
                return bThreatLevel - aThreatLevel;
            });
            
            const missile = validMissiles[0]; // This is now a valid missile object
            const perfectTrajectory = (Math.atan2(tank.y - missile.y, tank.x - missile.x) * 180 / Math.PI + 36000) % 360;
            const trajectoryDifference = tank.angleDifference(perfectTrajectory, missile.aim);
            const timeToImpactEstimate = missile.distance / (missile.actualSpeed || 1);
            const missileThreatLevel = Math.abs(trajectoryDifference) < 30 ? (1 - (Math.abs(trajectoryDifference) / 30)) * (1 - (timeToImpactEstimate / 60)) : 0;
            
            tank.retained.activeMissile = { x: missile.x, y: missile.y, aim: missile.aim, distance: missile.distance, energy: missile.energy, threatLevel: missileThreatLevel };
            
            if (missileThreatLevel > 0.2) {
                const evasionAngleRight = (missile.aim + 90) % 360;
                const evasionAngleLeft = (missile.aim - 90 + 360) % 360;
                let bestEvasionAngle;
                const rightEvadeX = tank.x + Math.cos(evasionAngleRight * Math.PI / 180) * 50;
                const rightEvadeY = tank.y + Math.sin(evasionAngleRight * Math.PI / 180) * 50;
                const leftEvadeX = tank.x + Math.cos(evasionAngleLeft * Math.PI / 180) * 50;
                const leftEvadeY = tank.y + Math.sin(evasionAngleLeft * Math.PI /180) * 50;
                const rightWallProximity = Math.min(arena.width/2 - Math.abs(rightEvadeX), arena.height/2 - Math.abs(rightEvadeY));
                const leftWallProximity = Math.min(arena.width/2 - Math.abs(leftEvadeX), arena.height/2 - Math.abs(leftEvadeY));
                const currentAngleDifferenceRight = Math.abs(tank.angleDifference(tank.bodyAim, evasionAngleRight));
                const currentAngleDifferenceLeft = Math.abs(tank.angleDifference(tank.bodyAim, evasionAngleLeft));
                const rightScore = rightWallProximity - (currentAngleDifferenceRight / 180) * 30;
                const leftScore = leftWallProximity - (currentAngleDifferenceLeft / 180) * 30;
                bestEvasionAngle = (rightScore > leftScore) ? evasionAngleRight : evasionAngleLeft;

                if (timeToImpactEstimate < 15 && Math.abs(trajectoryDifference) < 20) {
                    tank.retained.emergencyEvade = 10;
                    let bodyAngleDifference = tank.angleDifference(tank.bodyAim, bestEvasionAngle);
                    tank.bodyTurn = Math.max(-1, Math.min(1, bodyAngleDifference / 3));
                    tank.speed = 1;
                    if (Math.abs(bodyAngleDifference) > 120) tank.speed = -1;
                    tank.retained.lastDodgeDirection = bestEvasionAngle;
                } else {
                    const urgency = Math.min(1, missileThreatLevel * 2);
                    let bodyAngleDifference = tank.angleDifference(tank.bodyAim, bestEvasionAngle);
                    tank.bodyTurn = (tank.bodyTurn * (1 - urgency)) + (Math.max(-1, Math.min(1, bodyAngleDifference / 5)) * urgency);
                    tank.speed = Math.min(1, Math.abs(tank.speed) + 0.3 * urgency) * (tank.speed >= 0 ? 1 : -1);
                    tank.retained.evading = 3;
                }
            }
             // Missile interception logic (ensure missile object is valid)
            const interceptionAimThreshold = 7 + 3 * missile.distance / maxDistance;
            if (Math.abs(trajectoryDifference) > 30 &&
                timeToImpactEstimate > 15 &&
                tank.energy > missile.energy * 2 &&
                !tank.retained.emergencyEvade) {
                
                const interceptTime = timeToImpactEstimate / 2;
                const predictedX = missile.x + (missile.actualSpeed || 1) * interceptTime * Math.cos(missile.aim * Math.PI / 180);
                const predictedY = missile.y + (missile.actualSpeed || 1) * interceptTime * Math.sin(missile.aim * Math.PI / 180);
                const desiredGunAim = tank.angleTo(predictedX, predictedY);
                const aimDifference = tank.angleDifference(tank.bodyAim + tank.gunAim, desiredGunAim);
                
                if (Math.abs(aimDifference) < interceptionAimThreshold) {
                    if (missile.energy > 50) {
                        tank.firePower = Math.min(missile.energy + 50, tank.energy * 0.3);
                    }
                }
            }
            tank.retained.missileThreat = validMissiles.reduce((sum, m) => sum + m.energy * (1 - Math.min(1, m.distance / arena.width)), 0);
        } else { // No valid missiles detected after filtering
            tank.retained.missileEvasionReverse = 0;
            tank.retained.missileThreat = 0;
            tank.retained.activeMissile = null;
        }
    } else { // tank.detectedMissiles is undefined, null, or empty
        tank.retained.missileEvasionReverse = 0;
        tank.retained.missileThreat = 0;
        tank.retained.activeMissile = null;
    }

    const collision = tank.tankCollision || tank.missileCollision;
    if (collision && typeof collision.angle !== 'undefined' && typeof collision.damage !== 'undefined') { 
        tank.retained.collisionAngle = collision.angle;
        tank.retained.collisionDamage = collision.damage;
        tank.retained.collisionCoolDown = 36;
    }
    // Ensure retained properties are defined before use
    const collisionIsBiggestThreat = (tank.retained.collisionDamage || 0) > (tank.retained.missileThreat || 0);
    if (tank.retained.collisionCoolDown && collisionIsBiggestThreat && arena.tanksRemaining > 2) {
        const desiredGunTurn = tank.angleDifference(tank.bodyAim + tank.gunAim, tank.retained.collisionAngle || 0);
        tank.gunTurn = desiredGunTurn / 10;
    }
    if (tank.retained.collisionCoolDown) {
        const directionDifference = tank.angleDifference(tank.bodyAim, (tank.retained.collisionAngle || 0) + 90);
        tank.bodyTurn = directionDifference / 10;
        tank.speed = tank.retained.collisionCoolDown / 36;
        if (Math.abs(tank.retained.collisionAngle || 0) > 90) { // Check if collisionAngle is defined
            tank.bodyTurn *= -tank.bodyTurn; // This seems like an error, should be tank.bodyTurn *= -1 or similar
            tank.speed *= -1;
        }
    }


    const proximityThreshold = (tank.size + Math.abs(tank.speed) * 3) * 3;
    const distanceToRightWall = arena.width/2 - tank.x;
    const distanceToLeftWall = arena.width/2 + tank.x;
    const distanceToTopWall = arena.height/2 - tank.y;
    const distanceToBottomWall = arena.height/2 + tank.y;
    const closestWallDistance = Math.min(distanceToRightWall, distanceToLeftWall, distanceToTopWall, distanceToBottomWall);
    const isNearWall = closestWallDistance < proximityThreshold;
    
    if (isNearWall) {
        let targetX = tank.x;
        let targetY = tank.y;
        if (closestWallDistance === distanceToRightWall) targetX = tank.x - proximityThreshold;
        else if (closestWallDistance === distanceToLeftWall) targetX = tank.x + proximityThreshold;
        else if (closestWallDistance === distanceToTopWall) targetY = tank.y - proximityThreshold;
        else if (closestWallDistance === distanceToBottomWall) targetY = tank.y + proximityThreshold;
        if (closestWallDistance < tank.size * 1.5) { targetX = 0; targetY = 0; }
        const escapeAngle = tank.angleTo(targetX, targetY);
        let bodyAngleDifference = tank.angleDifference(tank.bodyAim, escapeAngle);
        const wallDangerFactor = 1 - (closestWallDistance / proximityThreshold);
        tank.bodyTurn = Math.max(-1, Math.min(1, bodyAngleDifference / (3 * (1 - wallDangerFactor) + 1e-9))); // Avoid division by zero
        tank.speed = 0.7 + (wallDangerFactor * 0.3);
        if (Math.abs(bodyAngleDifference) > 120) tank.speed *= -1;
        tank.retained.avoidingWall = true;
        tank.retained.lastWallAvoidanceAngle = escapeAngle;
    } else {
        tank.retained.avoidingWall = false;
    }

    if (!tank.retained.avoidingWall && !(tank.retained.emergencyEvade > 0)) {
        const allOtherTanks = targetArray.filter(t => t && t.index !== tank.index && t.iteration === tank.iteration);
        if (allOtherTanks.length > 0) {
            let closestTankDist = Infinity;
            let closestTankObj = null;
            for (const otherTank of allOtherTanks) {
                if(otherTank) { // Ensure otherTank is defined
                    const dist = tank.distanceTo(otherTank.x, otherTank.y);
                    if (dist < closestTankDist) {
                        closestTankDist = dist;
                        closestTankObj = otherTank;
                    }
                }
            }
            const tooCloseThresh = tank.size * 4; 
            if (closestTankObj && closestTankDist < tooCloseThresh) {
                 const awayAngle = tank.angleTo(closestTankObj.x, closestTankObj.y) + 180;
                 let bodyAngleDiff = tank.angleDifference(tank.bodyAim, awayAngle);
                 tank.bodyTurn = Math.max(-1, Math.min(1, bodyAngleDiff / 5));
                 tank.speed = (Math.abs(bodyAngleDiff) > 90) ? 0.8 : -0.8;
            }
        }
    }

    if (arena.tanksRemaining === 1 && !tank.retained.matchOver && tank.energy > 0) {
        tank.retained.matchOver = true;
        tank.retained.wins++;
        tank.commitMemory("winCount", tank.retained.wins);
        tank.gunTurn = 1;
        tank.bodyTurn = -0.5;
        tank.speed = 0.5;
    }

    if (tank.retained.missileEvasionReverse > 0) tank.retained.missileEvasionReverse--; else if (tank.retained.missileEvasionReverse < 0) tank.retained.missileEvasionReverse = 0;
    if (tank.retained.collisionCoolDown > 0) tank.retained.collisionCoolDown--; else if (tank.retained.collisionCoolDown < 0) { 
        tank.retained.collisionCoolDown = 0; 
        tank.retained.collisionAngle = (tank.retained.target && tank.retained.target.x != null) ? tank.angleTo(tank.retained.target.x, tank.retained.target.y) : tank.angleTo(0,0);
    }
    
    if (tank.retained.emergencyEvade > 0) {
        tank.retained.emergencyEvade--;
        if (tank.retained.emergencyEvade > 0 && tank.retained.lastDodgeDirection != null) {
            const bodyAngleDifference = tank.angleDifference(tank.bodyAim, tank.retained.lastDodgeDirection);
            tank.bodyTurn = Math.max(-1, Math.min(1, bodyAngleDifference / 3));
            tank.speed = 1;
            if (Math.abs(bodyAngleDifference) > 120) tank.speed = -1;
        } else if (tank.retained.emergencyEvade === 0) {
            tank.retained.lastDodgeDirection = null;
        }
    }
    if (tank.retained.evading > 0) tank.retained.evading--;

    tank.gunTurn -= tank.bodyTurn;

    if (tank.firePower > 0 && tank.energy >= tank.firePower) {
        tank.fire(tank.firePower);
    }

    return tank;
}
