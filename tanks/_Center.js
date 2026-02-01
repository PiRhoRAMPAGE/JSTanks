function main(tank, arena) {

    if (tank.iteration === 1) {
        tank.color = "#000000";
        tank.fillColor = "#ffffff";
    }

    // Define helper function
    function normalizeAngle(angle) {
        angle %= 360;
        if (angle > 180) angle -= 360;
        if (angle < -180) angle += 360;
        return angle;
    }

    // Calculate distance and angle to center
    const distanceToCenter = tank.distanceTo(0, 0);
    const angleToCenter = tank.angleTo(0, 0);

    // Turn toward center and drive
    if (distanceToCenter > tank.size) {
        const isClose = distanceToCenter < tank.size * 2
        const turnDiff = normalizeAngle(angleToCenter - tank.bodyAim);
        const slowDown = distanceToCenter / (tank.size * 2)
        tank.bodyTurn = Math.max(-1, Math.min(1, turnDiff / 10));
        tank.speed = (isClose) ? slowDown : 1;
    } 

    // Stop when close enough
    else {
        tank.speed = 0;
    }
    return tank;
}