function main(tank, arena) {

    // Utility functions (same as before)
    tank.angleTo = (x, y) => Math.atan2(y - tank.y, x - tank.x) * 180 / Math.PI;
    tank.distanceTo = (x, y) => Math.sqrt((y - tank.y) ** 2 + (x - y) ** 2);
    tank.angleDifference = (a1, a2) => {
        a1 = (a1 + 360000) % 360;
        a2 = (a2 + 360000) % 360;
        if (a1 > 180) a1 -= 360;
        if (a2 > 180) a2 -= 360;
        return (a2 - a1 + 180) % 360 - 180;
    };

    // Initialization (same as before, but add history)
    if (tank.iteration === 0) {
        tank.name = "Gemini's Tank";
        tank.color = "#ffa500";
        tank.fillColor = "#442c00";
        tank.treadColor = "#f4a460";
        tank.gunColor = "#ffa500";
        tank.radarArc = 1;
        tank.speed = 0;
        tank.bodyTurn = 0;
        tank.gunTurn = 0;
        tank.radarTurn = 0; // Initially, radar is aligned
        tank.retained.target = null;
        tank.retained.evasiveManeuver = 0;
        tank.retained.lastKnownPosition = null;
        tank.retained.targetHistory = []; // Track target positions
        tank.retained.wallAvoidancePhase = 0;
        tank.retained.aimAccuracy = 0.7; // Initial aim accuracy
    }

    // Movement
    let desiredSpeed = 0.75;
    let angleToCenter = tank.angleTo(0, 0);
    let angleDifferenceToCenter = tank.angleDifference(tank.bodyAim, angleToCenter);
    tank.speed = desiredSpeed;

    // Target Acquisition
    if (tank.detectedTanks.length > 0) {
        // Prioritize "Rampage" or closest tank
        tank.retained.target = tank.detectedTanks.find(t => t.name === "Rampage") || tank.detectedTanks.reduce((closest, t) => tank.distanceTo(t.x, t.y) < tank.distanceTo(closest.x, closest.y) ? t : closest, tank.detectedTanks[0]);
    }

    // Declare both angleToTarget and bodyAngleDifference here
    let angleToTarget = 0;
    let bodyAngleDifference = 0;

    if (tank.retained.target) {
        const target = tank.retained.target;
        const distanceToTarget = tank.distanceTo(target.x, target.y);
        angleToTarget = tank.angleTo(target.x, target.y);
        bodyAngleDifference = tank.angleDifference(tank.bodyAim, angleToTarget);
        const gunAngleDifference = tank.angleDifference(tank.bodyAim + tank.gunAim, angleToTarget);

        // Predictive Aiming (Enhanced)
        let predictedX = target.x;
        let predictedY = target.y;
        if (tank.retained.targetHistory.length > 2) {
            // Using a longer history for smoother prediction
            const lastPos = tank.retained.targetHistory[tank.retained.targetHistory.length - 1];
            const secondLastPos = tank.retained.targetHistory[tank.retained.targetHistory.length - 2];
            const thirdLastPos = tank.retained.targetHistory[tank.retained.targetHistory.length - 3];
            const dx = (lastPos.x - secondLastPos.x + secondLastPos.x - thirdLastPos.x) / 2; // Average change
            const dy = (lastPos.y - secondLastPos.y + secondLastPos.y - thirdLastPos.y) / 2;
            predictedX = target.x + dx * tank.retained.target.actualSpeed;
            predictedY = target.y + dy * tank.retained.target.actualSpeed;
        }
        const predictedAngle = tank.angleTo(predictedX, predictedY);

        // Aim with adjusted accuracy
        let aimError = (Math.random() - 0.5) * 10 * (1 - tank.retained.aimAccuracy);
        tank.gunTurn = tank.angleDifference(tank.gunAim, predictedAngle - tank.bodyAim + aimError) / 10;

        // Firing Strategy
        if (Math.abs(gunAngleDifference) < 3 && Math.random() > 0.9) {
            // More frequent, but controlled fire
            tank.fire = tank.energy > 150 ? 4 + Math.random() * 3 : tank.energy / 3;
        }

        // Evasive Maneuvers (slightly more aggressive)
        if (distanceToTarget < arena.width / 2.5) {
            const evadeAngle = angleToTarget + 90 + (Math.random() - 0.5) * 40; // Add some variation
            const evadeDirection = Math.sin(tank.iteration / 15) > 0 ? 1 : -1;
            tank.bodyTurn = tank.angleDifference(tank.bodyAim, evadeAngle + (35 * evadeDirection)) / 180;
            desiredSpeed = 0.9;
        }

        // Target Tracking
        tank.retained.targetHistory.push({ x: target.x, y: target.y });
        if (tank.retained.targetHistory.length > 10) tank.retained.targetHistory.shift();

        // Engage or disengage (more nuanced)
        if (tank.energy < target.energy * 0.7) {
            desiredSpeed = 1; // Flee, but not blindly
            tank.bodyTurn = tank.angleDifference(tank.bodyAim, angleToTarget + 170 + (Math.random() - 0.5) * 20) / 180;
        }
        else {
            desiredSpeed = Math.min(1, distanceToTarget / (arena.width / 4)); // Closer approach
            tank.bodyTurn = bodyAngleDifference / 180;
            // Gradually improve aim
            tank.retained.aimAccuracy = Math.min(0.95, tank.retained.aimAccuracy + 0.005);
        }
        tank.speed = desiredSpeed;

    } else {
        tank.retained.aimAccuracy = 0.7; // Reset aim accuracy
    }

    // Radar - keep scanning or tracking (more focused)
    if (!tank.retained.target) {
        tank.radarTurn = 0.4; // Slightly slower, more deliberate scan
    } else {
        // Focused tracking, but occasionally widen
        tank.radarTurn = tank.angleDifference(tank.radarAim, angleToTarget) / 10 + (Math.random() < 0.05 ? 0.3 : 0);
    }

    // Energy management (more conservative)
    if (tank.speed === 0) {
        tank.speed = 0.3; // Slower stall recovery
    }

    // Wall collision avoidance (as before, but with reset)
    let wallProximityThreshold = tank.actualSpeed * 5;
    const isNearWall = (
        tank.x + tank.actualSpeed * Math.cos(tank.bodyAim * Math.PI / 180) < -arena.width / 2 + wallProximityThreshold ||
        tank.x + tank.actualSpeed * Math.cos(tank.bodyAim * Math.PI / 180) > arena.width / 2 - wallProximityThreshold ||
        tank.y + tank.actualSpeed * Math.sin(tank.bodyAim * Math.PI / 180) < -arena.height / 2 + wallProximityThreshold ||
        tank.y + tank.actualSpeed * Math.sin(tank.bodyAim * Math.PI / 180) > arena.height / 2 - wallProximityThreshold
    );
    if (isNearWall) {
        if (tank.retained.wallAvoidancePhase === 0) {
            tank.retained.wallAvoidancePhase = 1;
            if (angleDifferenceToCenter > 0) {
                tank.bodyTurn = -0.5;
            } else {
                tank.bodyTurn = 0.5;
            }
        } else if (tank.retained.wallAvoidancePhase > 20) {
            tank.retained.wallAvoidancePhase = 0;
        } else {
            tank.retained.wallAvoidancePhase++;
        }
        tank.speed = desiredSpeed * 0.5;
    } else {
        tank.retained.wallAvoidancePhase = 0;
        tank.bodyTurn = bodyAngleDifference / 180;
    }

    return tank;
}