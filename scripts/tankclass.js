class Tank {
    
    constructor(brain, index, x, y, color, bodyAim = Math.random() * 360, gunAim = 0, radarAim = 0) {

        // Things the user can't change
        this.brain = brain; // callback function for bots main function
        this.index = index;
        this.iteration = 0;
        this.x = x;
        this.y = y;
        this.actualSpeed = 0;
        this.bodyAim = bodyAim;
        this.gunAim = gunAim;
        this.radarAim = radarAim;
        this.energy = 1000;
        this.size = TANK_SIZE;
        this.gunHeat = 0;
        this.state = "alive";
        this.detectedTanks = [];
        this.detectedMissiles = [];
        this.wallCollision = false;
        this.wallCollisions = 0;
        this.tankCollision = false;
        this.tankCollisions = 0;
        this.missileCollision = false;
        this.missileCollisions = 0;
        this.showMessage = 0;
        this.matchScore = 0;
        this.missiles = [];
        this.missilesFired = 0;
        this.missilesHit = 0;
        this.accuracy = 0;
        this.message = 0;
        this.victoryMessage = "Winner";

        // Powerups
        this.powerup = { type: null, amount: 0, symbol: "" };
        this.powerupsCollected = 0;
        this.speedMultiplier = 1;
        this.gunCoolFactor = 1;
        this.firePowerMultiplier = 1;

        // Things the user can change
        this.name = `Tank ${index}`;
        this.color = color;
        this.bodyTurn = 0;
        this.gunTurn = 0;
        this.radarTurn = 0;
        this.radarArc = 1;
        this.speed = 0;
        this.retained = {}; // An object to retain
        this.handicap = 0;
        this.indicator = { color: "#00ff00", intensity: 0 };

    }
    
    update(ctx, arena) {

        // Don't update tanks that are dead
        if (this.state === "dead") return;
        
        // Handle exploding
        if (this.state === "exploding") {
            this.explode(ctx, this.size * 2);
            return;
        }

        // Show tank name on first iteration
        if (this.iteration === 1) {
            this.message = this.name;
            this.showMessage = 50;
        }
        
        // Decrement show message timer
        if (this.showMessage) {
            this.showMessage--;
        }
        
        // Handle powerups
        if (this.powerup?.amount > 0) {
            this.powerup.amount--;
            this.speedMultiplier = 1;
            this.gunCoolFactor = 1;
            this.firePowerMultiplier = 1;
            if (this.powerup.type === "speed") {
                this.speedMultiplier = (this.powerup.amount > 0) ? 2 : 1;
            }
            if (this.powerup.type === "guncool") {
                this.gunCoolFactor = (this.powerup.amount > 0) ? 2 : 1;
            }
            if (this.powerup.type === "firepower") {
                this.firePowerMultiplier = (this.powerup.amount > 0) ? 2 : 1;
            }
        }
        
        // Handle energy gain from stalling
        if (this.speed === 0 && this.energy) {
            this.energy++;
        }
        
        // Cap tanks max energy
        if (this.energy > MAX_TANK_ENERGY) {
            this.energy = MAX_TANK_ENERGY;
        }
        
        // Handle energy loss from moving
        else {
            this.energy -= Math.abs(this.speed / 25);
        }

        // Handle low energy
        if (this.energy < 20 && Math.abs(this.speed) > 0) {
            this.speed = this.energy / 20 * Math.sign(this.speed);
            this.bodyTurn = this.energy / 20 * Math.sign(this.bodyTurn);
            this.gunTurn = this.energy / 20 * Math.sign(this.gunTurn);
            this.radarTurn = this.energy / 20 * Math.sign(this.radarTurn);
        }
        
        // Handle no energy
        if (~~this.energy <= 0) {
            this.energy = 0;
            this.state = "dead";
            return;
        }

        // Cool gun down
        if (this.gunHeat > 0) {
            this.gunHeat -= (10 + 2 * Math.abs(this.speed)) * this.gunCoolFactor;
            if (this.gunHeat <= 0) {
                this.gunHeat = 0;
            }
        }

        // Turn body
        if (this.bodyTurn > 1) this.bodyTurn = 1;
        if (this.bodyTurn < -1) this.bodyTurn = -1;
        this.bodyAim += this.bodyTurn * MAX_BODY_TURN_DEGREES;
        this.bodyAim = (this.bodyAim + 360000) % 360;
    
        // Turn turret
        if (this.gunTurn > 1) this.gunTurn = 1;
        if (this.gunTurn < -1) this.gunTurn = -1;
        this.gunAim += this.gunTurn * MAX_GUN_TURN_DEGREES;
        this.gunAim = (this.gunAim + 360000) % 360;

        // Turn radar
        if (this.radarTurn > 1) this.radarTurn = 1;
        if (this.radarTurn < -1) this.radarTurn = -1;
        this.radarAim += this.radarTurn * MAX_RADAR_TURN_DEGREES;
        this.radarAim = (this.radarAim + 360000) % 360;
    
        // Move tank
        this.matchScore += Math.abs(this.speed) * TANK_SPEED_BONUS_POINTS / MAX_ITERATIONS;
        this.x = this.x + this.actualSpeed * Math.cos(this.bodyAim * Math.PI / 180);
        this.y = this.y + this.actualSpeed * Math.sin(this.bodyAim * Math.PI / 180);
        
        // Handle collision checks
        this.checkForWalls(arena);
        this.checkForTanks(arena);
        this.checkForMissiles(arena);
        this.checkForPowerups(arena);
        
        // Calculate tanks accuracy
        this.accuracy = (this.missilesFired > 0) ? this.missilesHit / this.missilesFired : 0;

        // Define parameters for the "brain" function
        const tankData = {
            index: this.index,
            score: scores[this.index] + this.matchScore|| 0,
            iteration: this.iteration,
            name: this.name,
            color: this.color,
            fillColor: this.fillColor,
            treadColor: this.treadColor,
            gunColor: this.gunColor,
            radarColor: this.radarColor,
            indicator: this.indicator,
            size: this.size,
            state: this.state,
            energy: this.energy,
            x: this.x,
            y: this.y,
            bodyTurn: 0,
            bodyAim: this.bodyAim,
            speed: this.speed,
            actualSpeed: this.speed * this.size / 2.5,
            gunTurn: 0,
            gunAim: this.gunAim,
            gunHeat: this.gunHeat,
            aimAccuracy: this.accuracy,
            radarTurn: 0,
            radarAim: this.radarAim,
            radarArc: this.radarArc,
            powerup: (this.powerup.amount > 0) ? { type: this.powerup.type, amount: this.powerup.amount, color: this.powerup.color } : false,
            powerupsCollected: this.powerupsCollected,
            detectedTanks: this.detectedTanks,
            detectedMissiles: this.detectedMissiles,
            detectedPowerups: this.detectedPowerups,
            tankCollision: this.tankCollision,
            wallCollision: this.wallCollision,
            missileCollision: this.missileCollision,
            missiles: this.missiles,
            retained: this.retained,
            victoryMessage: this.victoryMessage,
            angleTo: (x, y) => Math.atan2(y - this.y, x - this.x) * 180 / Math.PI,
            angleFrom: (x, y) => Math.atan2(this.y - y, this.x - x) * 180 / Math.PI,
            distanceTo: (x, y) => Math.sqrt((y - this.y) ** 2 + (x - this.x) ** 2),
            fire: (energy) => this.fire(arena, energy),
        }
        
        const arenaData = {
            height: arena.height,
            width: arena.width,
            tanksRemaining: arena.tanksRemaining,
            gameCount: arena.gameCount,
            gameSpeed: selGameSpeed.value,
            animate: showAnimation.checked,
            sound: enableSound.checked,
            missileInterception: arena.missileInterception,
            powerupsSpawned: arena.powerupsSpawned,
            contains: (x, y, margin = 0) => {
                return Math.abs(x) < arena.width / 2 - margin && Math.abs(y) < arena.height / 2 - margin;
            },
            nearestWallDistance: (x, y) => {
                const leftWallDistance = Math.abs(-arena.width / 2 - x);
                const rightWallDistance = Math.abs(arena.width / 2 - x);
                const topWallDistance = Math.abs(-arena.height / 2 - y);
                const bottomWallDistance = Math.abs(arena.height / 2 - y);
                return Math.min(leftWallDistance, rightWallDistance, topWallDistance, bottomWallDistance);
            },
            nearestWallAngle: (x, y) => {
                const leftWallDistance = Math.abs(-arena.width / 2 - x);
                const rightWallDistance = Math.abs(arena.width / 2 - x);
                const topWallDistance = Math.abs(-arena.height / 2 - y);
                const bottomWallDistance = Math.abs(arena.height / 2 - y);
                let wallDistance = Infinity;
                let wallAngle = 0;
                if (leftWallDistance < wallDistance) {
                    wallDistance = leftWallDistance;
                    wallAngle = 180;
                }
                if (rightWallDistance < wallDistance) {
                    wallDistance = rightWallDistance;
                    wallAngle = 0;
                }
                if (topWallDistance < wallDistance) {
                    wallDistance = topWallDistance;
                    wallAngle = -90;
                }
                if (bottomWallDistance < wallDistance) {
                    wallDistance = bottomWallDistance;
                    wallAngle = 90;
                }
                return wallAngle;
            }

        }

        try {
            // "Brain" function (gets user defined actions)
            const actions = this.brain(tankData, arenaData);
            const actionsAreValid = this.validateActions(actions);
            // Preform the actions
            if (actionsAreValid) {
                this.preformActions(arena, actions);
            }
            else {
                showError({ tank: this.name, message: "Tank function must return a tank object" })
            }
            
            // Update variables for next iteration
            this.iteration++;
            this.tankCollision = false;
            this.wallCollision = false;
            this.missileCollision = false;
        }
        catch (e) {
            console.error(`Error with "${this.name}"`);
            console.error(e);
            showError({ tank: this.name, message: e.message});
        }
    }
    
    
    validateActions(actions) {
        if (!actions) {
            return false
        }
        const required = [
            "index",
            "iteration",
            "name",
            "color",
            "fillColor",
            "treadColor",
            "gunColor",
            "radarColor",
            "size",
            "state",
            "energy",
            "x",
            "y",
            "bodyTurn",
            "bodyAim",
            "speed",
            "actualSpeed",
            "gunTurn",
            "gunAim",
            "gunHeat",
            "aimAccuracy",
            "radarTurn",
            "radarAim",
            "radarArc",
            "detectedTanks",
            "detectedMissiles",
            "tankCollision",
            "wallCollision",
            "missileCollision",
            "retained",
            "victoryMessage",
            "indicator",
        ]
        for (let action of required) {
            if (!actions.hasOwnProperty(action)) {
                return false;
            }
        }
        return true;
    }
    
    preformActions(arena, actions) {
        let errors = [];
        if (actions.color) {
            if (isValidHexColor(actions.color)) {
                this.color = actions.color;
            }
            else {
                errors.push("Invalid hexidecimal color code for tank.color");
            }
        }
        if (actions.fillColor) {
            if (isValidHexColor(actions.fillColor)) {
                this.fillColor = actions.fillColor;
            }
            else {
                errors.push("Invalid hexidecimal color code for tank.fillColor");
            }
        }
        if (actions.treadColor) {
            if (isValidHexColor(actions.treadColor)) {
                this.treadColor = actions.treadColor;
            }
            else {
                errors.push("Invalid hexidecimal color code for tank.treadColor");
            }
        }
        if (actions.gunColor) {
            if (isValidHexColor(actions.gunColor)) {
                this.gunColor = actions.gunColor;
            }
            else {
                errors.push("Invalid hexidecimal color code for tank.gunColor");
            }
        }
        if (actions.radarColor) {
            if (isValidHexColor(actions.radarColor)) {
                this.radarColor = actions.radarColor;
            }
            else {
                errors.push("Invalid hexidecimal color code for tank.radarColor");
            }
        }
        if (actions.name) {
            this.name = actions.name.substring(0, 20);
        }
        if (actions.speed || actions.speed === 0) {
            if (!isNaN(actions.speed)) {
                if (actions.speed < -1) actions.speed = -1;
                if (actions.speed > +1) actions.speed = +1;
                this.speed = actions.speed;
                this.actualSpeed = this.speed * MAX_ACTUAL_SPEED;
            }
            else {
                errors.push("tank.speed must be a number between -1 and 1");
            }
        }
        if (actions.bodyTurn || actions.bodyTurn === 0) {
            if (!isNaN(actions.bodyTurn)) {
                if (actions.bodyTurn < -1) actions.bodyTurn = -1;
                if (actions.bodyTurn > +1) actions.bodyTurn = +1;
                this.bodyTurn = actions.bodyTurn;
            }
            else {
                errors.push("tank.bodyTurn must be a number between -1 and 1");
            }
        }
        if (actions.gunTurn || actions.gunTurn === 0) {
            if (!isNaN(actions.gunTurn)) {
                if (actions.gunTurn < -1) actions.gunTurn = -1;
                if (actions.gunTurn > +1) actions.gunTurn = +1;
                this.gunTurn = actions.gunTurn;
            }
            else {
                errors.push("tank.gunTurn must be a number between -1 and 1");
            }
        }
        if (actions.radarTurn || actions.radarTurn === 0) {
            if (!isNaN(actions.radarTurn)) {
                if (actions.radarTurn < -1) actions.radarTurn = -1;
                if (actions.radarTurn > +1) actions.radarTurn = +1;
                this.radarTurn = actions.radarTurn;
            }
            else {
                errors.push("tank.radarTurn must be a number between -1 and 1");
            }
        }
        if (actions.radarArc) {
            if (!isNaN(actions.radarArc)) {
                if (actions.radarArc <= 0) actions.radarArc = 0;
                if (actions.radarArc > 1) actions.radarArc = 1;
                this.radarArc = actions.radarArc;
            }
            else {
                errors.push("tank.radarArc must be a number between 0 and 1");
            }
        }
        if (actions.retained) {
            if (["object", undefined].includes(typeof actions.retained)) {
                for (let property in actions.retained) {
                    this.retained[property] = actions.retained[property];
                }
            }
            else {
                errors.push("tank.retained must be a valid JSON object");
            }
        }
        if (actions.victoryMessage) {
            this.victoryMessage = actions.victoryMessage.toString().substring(0, 256);
        }
        if (actions.handicap) {
            if (!isNaN(actions.handicap)) {
                if (!isNaN(actions.handicap) && actions.handicap > 0 && actions.handicap <= 1) {
                    this.handicap = actions.handicap;
                }
            }
            else {
                errors.push("tank.handicap must be a number between 0 and 1");
            }
        }
        if (actions.indicator) {
            if (actions.indicator.color) {
                if (isValidHexColor(actions.indicator.color)) {
                    this.indicator.color = actions.indicator.color;
                }
                else {
                    errors.push("Invalid hexidecimal color code for tank.indicator.color");
                }
                if (!isNaN(actions.indicator.intensity) && actions.indicator.intensity >= 0 && actions.indicator.intensity <= 1) {
                    this.indicator.intensity = actions.indicator.intensity;
                }
                else {
                    console.log(actions.indicator)
                    errors.push("tank.indicator.intensity must be a number between 0 and 1");
                }
            }
        }
        if (errors.length > 0) {
            showError({ tank: this.name, errors})
        }
    }
    
    
    draw(ctx) {

        // Exit conditions
        if (this.state === "dead") return;
        ctx.save();
        
        ctx.translate(arena.width / 2, arena.height / 2);
        ctx.translate(this.x, this.y);
        ctx.strokeStyle = this.color;
        ctx.fillStyle = this.color;
        ctx.lineWidth = 2;
        
        // Determine fill color
        if (!this.fillColor) {
            let brightness = getRelativeBrightness(this.color);
            let colorAdjustment = 0.5;
            if (Math.abs(1 - brightness * 2) < 0.5) {
                colorAdjustment = 0.75;
            }
            if (brightness >= 0.5) {
                this.fillColor = adjustBrightness(this.color, -colorAdjustment);
            }
            else {
                this.fillColor = adjustBrightness(this.color, colorAdjustment);
            }
        }
        ctx.fillStyle = this.fillColor;

        // Draw the tanks powerup state
        if (this.powerup.amount > 0) {
            const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, this.size * 2.5);
            gradient.addColorStop(0, "rgba(0, 0, 0, 0)");
            gradient.addColorStop(0.9, `${this.powerup.color}32`);
            gradient.addColorStop(1, `${this.powerup.color}66`);
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(0, 0, this.size * 2.5, 0, 2 * Math.PI);
            ctx.closePath();
            ctx.fill();
        }

        // Draw the body of the tank
        ctx.rotate(this.bodyAim * Math.PI / 180);
        ctx.beginPath();
        ctx.moveTo(0, -this.size);
        ctx.lineTo(this.size, -this.size);
        ctx.lineTo(this.size, this.size);
        ctx.arc(0, 0, this.size, Math.PI / 2, Math.PI * 1.5);
        ctx.closePath();
        ctx.stroke();
        ctx.fill();

        // Draw the tanks indicator light
        ctx.globalAlpha = this.indicator.intensity;
        ctx.beginPath();
        ctx.moveTo(0, this.size * 0.9);
        ctx.arc(this.size * 0.7, this.size * 0.7, this.size * 0.2, 0, 2 * Math.PI);
        ctx.fillStyle = this.indicator.color;
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;

        // Define tread properties
        ctx.fillStyle = this.treadColor || this.color;
        const treadWidth = this.size * 0.05;
        const treadHeight = this.size * 0.15;
        const treadSpacing = this.size * 0.15;
        const numTreads = 9;

        for (let i = 0; i < numTreads; i++) {
            // Draw the left tread
            let xLeft = -this.size / 2 - treadHeight + i * (treadSpacing + treadWidth);
            let yLeft = -this.size * 1.8;
            let width = this.size / 2;
            let height = treadWidth / 2;
            ctx.beginPath();
            ctx.roundRect(xLeft, yLeft, treadHeight, width, height);
            ctx.fill();
            // Draw the right tread
            let xRight = -this.size / 2 - treadHeight + i * (treadSpacing + treadWidth);
            let yRight = this.size * 1.15 + treadHeight;
            ctx.beginPath();
            ctx.roundRect(xRight, yRight, treadHeight, width, height);
            ctx.fill();
        }
    
        // Draw the turret
        ctx.strokeStyle = this.gunColor || this.color;
        ctx.lineWidth = 2;
        ctx.rotate(this.gunAim * Math.PI / 180);
        const turretLength = this.size * 1.5;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(turretLength, 0);
        ctx.stroke();
        ctx.closePath();

        // Draw the radar as a filled half-circle
        ctx.fillStyle = this.radarColor || this.color;
        ctx.rotate((90 + this.radarAim) * Math.PI / 180);
        ctx.beginPath();
        ctx.arc(0, 0, this.size * 0.6, 0, Math.PI);
        ctx.closePath();
        ctx.fill();

        ctx.restore();

        // Draw whatever message the tank is displaying
        if (this.showMessage) {
            const topOrBottom = (this.y < -arena.height / 2 + this.size * 4) ? -1 : 1;
            const opacity = (this.showMessage < 15) ? this.showMessage / 15 : 1;
            ctx.save();
            ctx.translate(arena.width / 2, arena.height / 2);
            ctx.font = "10px Roboto";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
            ctx.fillText(this.message, this.x, this.y - this.size * 3 * topOrBottom);
            ctx.restore();
        }
    }
    

    explode(ctx, desiredSize = this.size * 2) {
        if (!showAnimation.checked) {
            this.state = 0;
            this.energy = 0
            return;
        }

        if (!this.explosionSize) {
            this.explosionSize = 0;
            soundExplosion(1, 0.7);
        }
        this.explosionSize += 2;
        ctx.save();
        ctx.translate(arena.width / 2, arena.height / 2);
        ctx.translate(this.x, this.y);
        ctx.rotate(this.bodyAim * Math.PI / 180);
        ctx.beginPath();
        ctx.arc(0, 0, this.explosionSize, 0, Math.PI * 2);
        ctx.fillStyle = ["red", "orange", "yellow", "white"][~~(Math.random() * 4)];
        ctx.fill();
        ctx.closePath();
        ctx.restore();
        if (this.explosionSize >= desiredSize) {
            this.state = "dead";
            this.energy = 0;
        }
    }


    
    checkForWalls(arena) {
        const arenaWidth = arena.width / 2;
        const arenaHeight = arena.height / 2;
        
        this.wallCollision = (
            this.x < -arenaWidth + this.size / 2 || this.x > arenaWidth - this.size / 2 ||
            this.y < -arenaHeight + this.size / 2 || this.y > arenaHeight - this.size / 2
        );
    
        if (this.wallCollision) {
            let collisionAngle = 0;
            
            // Increment collision counter
            this.wallCollisions++;

            // Calculate collision angle
            if (this.x < -arenaWidth + this.size) { // Left wall
                this.x = -arenaWidth + this.size;
                collisionAngle = (this.bodyAim + 180) % 360; // Angle relative to left wall
            }
            else if (this.x > arenaWidth - this.size) { // Right wall
                this.x = arenaWidth - this.size;
                collisionAngle = this.bodyAim; // Angle relative to right wall
            }
            if (this.y < -arenaHeight + this.size) { // Top wall
                this.y = -arenaHeight + this.size;
                collisionAngle = (this.bodyAim + 90) % 360; // Angle relative to top wall
            }
            else if (this.y > arenaHeight - this.size) { // Bottom wall
                this. y = arenaHeight - this.size;
                collisionAngle = (this.bodyAim + 270) % 360; // Angle relative to bottom wall
            }
    
            // Normalize collision angle to 0-180 range
            if (collisionAngle > 180) {
                collisionAngle = 360 - collisionAngle;
            }

            // Calculate multiplier based on collision angle
            const multiplier = Math.abs(Math.cos(collisionAngle * Math.PI / 180));
    
            // Calculate the kinetic energy of your tank
            const kineticEnergy = (this.size * Math.abs(this.actualSpeed)) ** 2;

            // Calculate the total damage done by the collision
            const damage = ~~(kineticEnergy * multiplier + 1);

            // Deduct the damage from the tanks energy
            this.energy = Math.max(0, this.energy - damage);
            
            // Set the timer to show the damage
            this.message = -damage;
            this.showMessage = 50;
            
            if (this.energy <= 0) {
                this.state = "exploding";
            }
            
            // Save the collision data
            this.wallCollision = {
                angle: this.bodyAim,
                damage: damage
            }
        }
    }
        
    checkForTanks(arena) {
        this.detectedTanks = [];
        this.tankCollision = false;
        const radarDirection = (this.radarAim + this.bodyAim + this.gunAim + 360000) % 360; // Radar direction in degrees (normalized)
    
        arena.tanks.forEach((other) => {
            if (this !== other && this.state === "alive" && other.state === "alive") {
                const dx = other.x - this.x;
                const dy = other.y - this.y;
                const distance = Math.sqrt(dx ** 2 + dy ** 2);
                const angleToOther = Math.atan2(dy, dx) * 180 / Math.PI;
    
                // Calculate the shortest angle difference
                let angleDifference = Math.abs(angleToOther - radarDirection + 36000) % 360;
                angleDifference = Math.min(angleDifference, 360 - angleDifference);
    
                // Calculate the actual radar arc size in degrees based on the normalized value
                const currentRadarArcDegrees = this.radarArc * MAX_RADAR_ARC_DEGREES;

                // Check if the target is within the radar's arc
                if (angleDifference <= currentRadarArcDegrees / 2 + Math.atan2(other.size, distance) * 180 / Math.PI) {
                    this.detectedTanks.push({
                        index: other.index,
                        name: other.name,
                        energy: other.energy,
                        gunHeat: other.gunHeat,
                        size: other.size,
                        color: other.color,
                        fillColor: other.fillColor,
                        gunColor: other.gunColor,
                        radarColor: other.radarColor,
                        treadColor: other.treadColor,
                        angleTo: angleToOther,
                        distance: distance,
                        x: other.x,
                        y: other.y,
                        bodyAim: other.bodyAim,
                        speed: other.speed,
                        actualSpeed: other.speed * other.size / 2.5
                    });
                    this.detectedTanks.sort((a, b) => {
                        return a.distance - b.distance;
                    });
                    if (distance < (this.size + other.size) * 2) {
                        this.tankCollision = true;
                    }
                }
                if (this.tankCollision) {
                    this.handleTankCollision(other);
                }
            }
        });
    }

    checkForMissiles(arena) {
        this.detectedMissiles = [];
        const radarDirection = (this.radarAim + this.bodyAim + this.gunAim + 360000) % 360; // Radar direction in degrees (normalized)
    
        // Define the maximum radar arc in degrees
        const MAX_RADAR_ARC_DEGREES = 90;
    
        arena.missiles.forEach((other) => {
            if (this.index !== other.owner.index && this.state === "alive" && other.state === "fired") {
                const dx = other.x - this.x;
                const dy = other.y - this.y;
                const distance = Math.sqrt(dx ** 2 + dy ** 2);
                const angleToOther = Math.atan2(dy, dx) * 180 / Math.PI;
    
                // Calculate the shortest angle difference
                let angleDifference = Math.abs(angleToOther - radarDirection + 360) % 360;
                angleDifference = Math.min(angleDifference, 360 - angleDifference);
    
                // Calculate the actual radar arc size in degrees based on the normalized value
                const currentRadarArcDegrees = this.radarArc * MAX_RADAR_ARC_DEGREES;

                // Check if the target is within the radar's arc
                if (angleDifference <= currentRadarArcDegrees / 2 + Math.atan2(other.size, distance) * 180 / Math.PI) {
                    this.detectedMissiles.push({
                        energy: other.energy,
                        size: other.size,
                        angleTo: angleToOther,
                        distance: distance,
                        x: other.x,
                        y: other.y,
                        aim: (other.aim + 36000) % 360,
                        speed: other.speed / 10,
                        actualSpeed: other.speed,
                        ownersIndex: other.owner.index,
                    });
                    this.detectedMissiles.sort((a, b) => {
                        return a.distance - b.distance;
                    });
                }
            }
        });
    }

    checkForPowerups(arena) {
        this.detectedPowerups = [];
        const radarDirection = (this.radarAim + this.bodyAim + this.gunAim + 360000) % 360; // Radar direction in degrees (normalized)
    
        // Define the maximum radar arc in degrees
        const MAX_RADAR_ARC_DEGREES = 90;
    
        arena.powerups.forEach((other) => {
            const dx = other.x - this.x;
            const dy = other.y - this.y;
            const distance = Math.sqrt(dx ** 2 + dy ** 2);
            const angleToOther = Math.atan2(dy, dx) * 180 / Math.PI;

            // Calculate the shortest angle difference
            let angleDifference = Math.abs(angleToOther - radarDirection + 360) % 360;
            angleDifference = Math.min(angleDifference, 360 - angleDifference);

            // Calculate the actual radar arc size in degrees based on the normalized value
            const currentRadarArcDegrees = this.radarArc * MAX_RADAR_ARC_DEGREES;

            // Check if the powerup is within the radar's arc
            if (angleDifference <= currentRadarArcDegrees / 2 + Math.atan2(other.size, distance) * 180 / Math.PI) {
                this.detectedPowerups.push({
                    type: other.type,
                    amount: other.amount,
                    angleTo: angleToOther,
                    distance: distance,
                    duration: other.duration,
                    x: other.x,
                    y: other.y,
                });
                this.detectedPowerups.sort((a, b) => {
                    return a.distance - b.distance;
                });
            }
            
            // Check if powerup is close enough to collect
            if (distance < other.size + this.size * 2) {
                other.collect(this);
            }
        });
    }


    handleTankCollision(other) {

        // Calculate collision angle
        const dx = other.x - this.x;
        const dy = other.y - this.y;
        const collisionAngle = Math.atan2(dy, dx) * 180 / Math.PI;

        // Calculate relative velocity
        const relativeVelocityX = (this.actualSpeed * Math.cos(this.bodyAim * Math.PI / 180)) - (other.speed * Math.cos(other.bodyAim * Math.PI / 180));
        const relativeVelocityY = (this.actualSpeed * Math.sin(this.bodyAim * Math.PI / 180)) - (other.speed * Math.sin(other.bodyAim * Math.PI / 180));
        const relativeSpeed = Math.sqrt(relativeVelocityX ** 2 + relativeVelocityY ** 2);

        // Calculate multiplier based on collision angle
        const angleDifference = Math.abs(collisionAngle - this.bodyAim + 360000) % 360;
        const normalizedAngleDifference = Math.min(angleDifference, 360 - angleDifference); // Ensure 0 to 180 range
        const multiplier = Math.abs(Math.cos(normalizedAngleDifference * Math.PI / 180));

        // Calculate kinetic energy
        const kineticEnergy = (this.size * relativeSpeed) ** 2;
        
        // Calculate damage
        const damage = (kineticEnergy * multiplier) / 2; // Divide the damage between the tanks

        // Increment match scores
        this.matchScore += Math.abs(Math.min(damage / 2, other.energy)) * DAMAGE_DEALT_POINTS;
        other.matchScore += Math.abs(Math.min(damage / 2, this.energy)) * DAMAGE_DEALT_POINTS;

        // Apply damage to both tanks
        this.energy = Math.max(0, this.energy - damage / 2);
        other.energy = Math.max(0, other.energy - damage / 2);

        // Save the collision data
        this.tankCollision = {
            id: other.id,
            angle: other.angleTo,
            damage: damage
        }

        // Increment collision counters
        this.tankCollisions++;
        other.tankCollisions++;

        // Set the timer to show the tanks damage
        this.message = ~~(damage * -1);
        this.showMessage = 50;
        other.message = ~~(damage * -1);
        other.showMessage = 50;

        // Check for death
        if (this.energy <= 0) {
            this.state = "exploding";
        }
        if (other.energy <= 0) {
            other.state = "exploding";
        }

        //Resolve collision, prevent tanks from overlapping.
        const distanceBetweenTanks = Math.sqrt((this.x - other.x) ** 2 + (this.y - other.y) ** 2);
        const overlap = (this.size + other.size) - distanceBetweenTanks;
        if (overlap > 0){

            // bounce back
            const dx = other.x - this.x;
            const dy = other.y - this.y;
            const angle = Math.atan2(dy, dx);
            const moveAmount = (this.size + overlap);
            this.x -= moveAmount * Math.cos(angle);
            this.y -= moveAmount * Math.sin(angle);
            other.x += moveAmount * Math.cos(angle);
            other.y += moveAmount * Math.sin(angle);
            
            // randomly adjust bodyAim of both tanks slightly
            const aimOffset = (this.index - other.index) * 5;
            this.bodyAim += aimOffset;
            other.bodyAim += aimOffset;
        }
    }
    
    fire(arena, energy) {
        
        // Exit conditions
        if (this.gunHeat > 0 || energy <= 0 || this.energy <= 1) return false;
        
        // Cap the amount of energy per shot to MAX_MISSILE_ENERGY
        if (energy >= MAX_MISSILE_ENERGY) energy = MAX_MISSILE_ENERGY;
        
        // Deduct the energy
        this.energy -= energy;
        
        // Increase the gun heat
        this.gunHeat += Math.min(MAX_GUN_HEAT, energy * GUN_HEAT_MULTIPLIER / this.gunCoolFactor);
        
        // Create the missile
        const missileEnergy = energy * MISSILE_ENERGY_MULTIPLIER * this.firePowerMultiplier * (1 - this.handicap);
        const missile = new Missile(this, this.missilesFired, this.x, this.y, this.bodyAim + this.gunAim, missileEnergy, this.size / 2);
        arena.missiles.push(missile);

        return this.missilesFired || false;
    }
    
}

