function main(tank, arena) {

    // **Understanding Angles and Distances**
    // These are helper functions to figure out where other tanks are relative to this one.
    // Imagine this tank has a built-in protractor and ruler!

    // `tank.angleTo(x, y)`: This calculates the angle (like a direction on a compass)
    // from our tank to a specific point (x, y) on the battlefield.
    // Think of (x, y) as the coordinates of another tank or a location.
    tank.angleTo = (x, y) => Math.atan2(y - tank.y, x - tank.x) * 180 / Math.PI;

    // `tank.distanceTo(x, y)`: This calculates how far away our tank is from a
    // specific point (x, y) on the battlefield. It's like measuring the straight-line
    // distance to another tank.
    tank.distanceTo = (x, y) => Math.sqrt((y - tank.y) ** 2 + (x - tank.x) ** 2);

    // `angleDifference(a1, a2)`: This figures out the shortest difference
    // between two angles. Imagine you're pointing in one direction (a1) and want
    // to quickly turn to another direction (a2) - this tells you how much you need to turn.
    angleDifference = (a1, a2) => {
        a1 = (a1 + 360000) % 360; // Makes sure the angle is always between 0 and 360 degrees.
        a2 = (a2 + 360000) % 360; // Same for the second angle.
        if (a1 > 180) a1 -= 360;   // Converts angles to be between -180 and 180 for easier calculation.
        if (a2 > 180) a2 -= 360;   // Same for the second angle.
         // Calculates the shortest turning angle.
        return (a2 - a1 + 180) % 360 - 180;
    }

    // **Setting Up Our Tank at the Beginning**
    // This code runs only once when our tank first enters the arena.

    if (tank.iteration === 0) {
        tank.name = "ExampleTank"; // Gives our tank a name.
        tank.color = "#00ff00";    // Sets the color of our tank to green.
        tank.radarArc = 1;         // Sets the width of our radar sweep (how much it can see).
        tank.gunTurn = tank.angleTo(0, 0) / 180; // Initially points the gun towards the center of the arena.
        tank.retained.wanderPattern = 0; // Initializes a variable to help with wandering (if we were doing that).
        tank.speed = 0.8;           // Sets the initial speed of our tank.
    }

    const maxDistance = Math.sqrt(arena.width ** 2 + arena.height ** 2); // The furthest distance across the arena.

    // **Reacting to Other Tanks**
    // This part of the code runs if our tank has spotted other tanks.

    if (tank.detectedTanks && tank.detectedTanks.length > 0) {

        const target = tank.detectedTanks[0]; // Focus on the first tank we see.
        const chargeAngle = tank.angleTo(target.x, target.y); // Angle towards the target tank.

        // **Chasing the Target**
        // This makes our tank move towards the enemy.

        let bodyAngleDifference = angleDifference(tank.bodyAim, chargeAngle); // How much our tank body needs to turn.
        tank.bodyTurn = bodyAngleDifference / 180; // Sets the turning speed of our tank body.
        tank.speed = (target.distance > tank.size * 1.5) ? 1 : target.distance / (tank.size * 1.5);
        // If the target is far, move at full speed; otherwise, slow down as we get closer.

        // **Predicting the Target's Future Position**
        // This helps us aim more accurately by guessing where the target will be.

        const missileSpeed = 10; // How fast our missiles travel.
        const interceptTime = target.distance / missileSpeed; // How long it will take for our missile to reach the target's current spot.
        const predictedX = target.x + target.actualSpeed * interceptTime * Math.cos(target.bodyAim * Math.PI / 180);
        const predictedY = target.y + target.actualSpeed * interceptTime * Math.sin(target.bodyAim * Math.PI / 180);
        // Calculates where the target is likely to be by the time our missile arrives,
        // based on its current position, speed, and direction.
        const predictedAngle = tank.angleTo(predictedX, predictedY); // Angle to the predicted future position.

        // **Turning the Gun to Aim**
        // This makes our gun point at the predicted location.

        const angleDif = angleDifference(tank.bodyAim + tank.gunAim, predictedAngle); // How much our gun needs to turn.
        tank.gunTurn = angleDif / 180; // Sets the turning speed of our gun.

        // **Firing at the Target**
        // This decides when and how powerfully to shoot.

        const aimError = Math.abs(angleDif); // How far off our aim is.
        if (aimError < 5) { // Only fire if our aim is reasonably good.
            const distanceFactor = (1 - target.distance / maxDistance) ** 2; // Power increases if the target is far.
            const accuracyFactor = (1 - aimError / (5 * distanceFactor)) ** 2; // Power increases if our aim is good.
             // Calculate the firing power.
            tank.fire (1 + accuracyFactor * 25 + distanceFactor * 24) // Tell the game to fire with the calculated power.
        }
    }
    else {
        tank.gunTurn = 1; // If no tanks are detected, keep the gun turning (scanning).
    }

    // **Avoiding Walls**
    // This helps our tank not get stuck by driving into walls.

    const proximityThreshold = (tank.size + Math.abs(tank.speed)) * 2.5;
    const isNearWall = (
        Math.abs(tank.x) > arena.width / 2 - proximityThreshold ||
        Math.abs(tank.y) > arena.height / 2 - proximityThreshold
    );
    if (isNearWall) {
        const angleToCenter = tank.angleTo(0, 0);
        let bodyAngleDifference = angleDifference(tank.bodyAim, angleToCenter);
        tank.bodyTurn = Math.min(1, bodyAngleDifference / 10);
        tank.speed = Math.min(0.5, 1 - Math.abs(bodyAngleDifference) / 180);
        if (Math.abs(bodyAngleDifference) > 90) {
            tank.speed *= -1;
            tank.bodyTurn *= -1;
        }
    }

    // **Celebrating Victory!**
    // This makes the tank do something special when it wins.

    if (tank.state === "winner") {
        tank.gunTurn = (Math.abs(tank.gunAim) > 0.1) ? -tank.gunAim / 360 : 0; // Slowly spins the gun back to the center.
    }

    // **Final Adjustment**
    // Make sure the gun turning is relative to the body turning.

    tank.gunTurn -= tank.bodyTurn;

    // **Important!**
    // This line is crucial - it sends the updated information about our tank
    // (like where it should move, turn, and if it should fire) back to the game.
    return tank;
}