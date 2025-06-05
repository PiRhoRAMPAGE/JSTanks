function main(tank, arena) {

    // Initialize retained data
    if (tank.iteration === 0) {
        tank.name = "Manual";
        tank.color = "#ffffff";
        tank.fillColor = "#000000";
        tank.retained.gunCharge = 0;
        tank.retained.controllerConnected = false;
        if (gameCount === 1) {
            const name = prompt("Enter a name for your tank", "Manual");
            tank.name = name || "Manual";
        }
    }

    // Accessing the objects in the global scope is cheating
    const cheat = tanks.find((other) => other.index === tank.index);
    if (tank.name === "Cheater") {
        cheat.energy = 999999999;
        tank.color = getRandomColorHex();
    }

    // Helper functions
    const angleTo = (x, y) => Math.atan2(y - tank.y, x - tank.x) * 180 / Math.PI;
    const angleDifference = (a1, a2) => {
        a1 = (a1 + 360000) % 360;
        a2 = (a2 + 360000) % 360;
        if (a1 > 180) a1 -= 360;
        if (a2 > 180) a2 -= 360;
        return (a2 - a1 + 180) % 360 - 180;
    };


    let desiredSpeed = 0;
    let desiredAngle = tank.bodyAim;

    const controller = gamepad.getControlState();
    if (controller.axis1.magnitude) {
        tank.retained.controllerConnected = true;
        desiredAngle = controller.axis1.direction * 180 / Math.PI;
        desiredSpeed = controller.axis1.magnitude;
    }
    else {
        tank.speed = 0;
    }

    if (keyDown["ArrowUp"] || keyDown["w"] || controller.up) {
        desiredAngle = 270;
        desiredSpeed = 1;
    }
    if (keyDown["ArrowDown"] || keyDown["s"] || controller.down) {
        desiredAngle = 90;
        desiredSpeed = 1;
    }
    if (keyDown["ArrowRight"] || keyDown["d"] || controller.right) {
        desiredAngle = 0;
        desiredSpeed = 1;
    }
    if (keyDown["ArrowLeft"] || keyDown["a"] || controller.left) {
        desiredAngle = 180;
        desiredSpeed = 1;
    }

    // Handle diagonal movement
    if ((keyDown["ArrowUp"] || keyDown["w"]) && (keyDown["ArrowRight"] || keyDown["d"]) || (controller.up && controller.right)) {
        desiredAngle = 315; // Up-Right
        desiredSpeed = 1;
    }
    if ((keyDown["ArrowUp"] || keyDown["w"]) && (keyDown["ArrowLeft"] || keyDown["a"]) || (controller.up && controller.left)) {
        desiredAngle = 225; // Up-Left
        desiredSpeed = 1;
    }
    if ((keyDown["ArrowDown"] || keyDown["s"]) && (keyDown["ArrowRight"] || keyDown["d"]) || (controller.down && controller.right)) {
        desiredAngle = 45;  // Down-Right
        desiredSpeed = 1;
    }
    if ((keyDown["ArrowDown"] || keyDown["s"]) && (keyDown["ArrowLeft"] || keyDown["a"]) || (controller.down && controller.left)) {
        desiredAngle = 135; // Down-Left
        desiredSpeed = 1;
    }

    let turnAmount = angleDifference(tank.bodyAim, desiredAngle);
    tank.bodyTurn = turnAmount / 10;
    if (desiredSpeed) {
        tank.speed = desiredSpeed;
        if (Math.abs(turnAmount) > 90) {
            tank.speed *= -1;
        }
    }

    // Turn gun toward mouse
    if (!tank.retained.controllerConnected) {
        const mouseAngle = angleTo(mouse.x, mouse.y);
        const desiredAim = angleDifference(tank.bodyAim + tank.gunAim + tank.bodyTurn, mouseAngle);
        const normalizedAngleDifference = Math.min(desiredAim, 360 - desiredAim); // Ensure 0 to 180 range
        tank.gunTurn = normalizedAngleDifference / 10;
    }
    
    // Turn gun using gamepad / controller
    if (controller.axis2.magnitude) {
        const desiredGunAim = controller.axis2.direction * 180 / Math.PI;
        const gunTurn = angleDifference(tank.bodyAim + tank.gunAim, desiredGunAim);
        tank.gunTurn = gunTurn / 10;
        tank.retained.controllerConnected = true;
    }

    // Detect mouse click and fire
    if (mouse.isDown || keyDown["f"] || controller.r2 || controller.b) {
        tank.retained.gunCharge += 5;
        tank.retained.mouseDown = 1;
        if (tank.retained.gunCharge > tank.energy / 2) {
            tank.retained.gunCharge = tank.energy / 2;
        }
        // This is cheating...
        cheat.message = 5 + ~~tank.retained.gunCharge;
        cheat.showMessage = 100;
    }
    else if (tank.retained.mouseDown) {
        tank.retained.mouseDown = 0;
        tank.fire(5 + tank.retained.gunCharge + 10);
        tank.retained.gunCharge = 0;
        // still cheating
        cheat.showMessage = 0;
    }
    
    // Handle rapid fire
    if (keyDown["r"] || controller.r1 || controller.a) {
        tank.fire(5);
    }

    if (keyDown["t"]) {
        tank.fire(50);
        cheat.gunHeat = 0;
    }
    
    
    const wallProximityThreshold = tank.size * 3;
    const lookAheadTime = 1; // How many frames to look ahead
    const predictedSpeed = tank.speed; // Assume speed remains constant for prediction
    const predictedTurn = tank.bodyTurn * lookAheadTime; // Estimate total turn in look-ahead time
    const predictedAngleRad = (tank.bodyAim + predictedTurn) * Math.PI / 180;
    const predictedX = tank.x + predictedSpeed * lookAheadTime * Math.cos(predictedAngleRad);
    const predictedY = tank.y + predictedSpeed * lookAheadTime * Math.sin(predictedAngleRad);

    const isAboutToHitWall = (
        predictedX < -arena.width / 2 + wallProximityThreshold ||
        predictedX > arena.width / 2 - wallProximityThreshold ||
        predictedY < -arena.height / 2 + wallProximityThreshold ||
        predictedY > arena.height / 2 - wallProximityThreshold
    );

    if (isAboutToHitWall) {
    }


    return tank;
}