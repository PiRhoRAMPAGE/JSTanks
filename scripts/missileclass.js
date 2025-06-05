class Missile {

    constructor(owner, id, x, y, aim, energy, maxSize) {
        this.owner = owner;
        this.id = id;
        this.x = x;
        this.y = y;
        this.aim = (aim + 360000) % 360;
        this.energy = energy;
        this.speed = MISSILE_SPEED;
        this.state = "fired";

        // Set the initial size of the missile
        this.size = Math.max(MIN_MISSILE_SIZE, MAX_MISSILE_SIZE * this.energy / MAX_MISSILE_ENERGY * this.owner.firePowerMultiplier);
        this.owner.missiles[this.id] = {
            x: this.x,
            y: this.y,
            aim: this.aim,
            energy: this.energy,
            size: this.size,
            hit: false,
            miss: false,
            iterationFired: this.owner.iteration,
        }

        // Play the sound
        this.volume = (1 + (Math.min(MAX_MISSILE_SIZE, this.size) / 6) ** 2) / 2;
        this.pitch = 2.05 - (this.volume) ** 2;
        soundExplosion(this.volume / 2, this.pitch);
    }
    
    update(ctx, arena) {
        if (this.state === "dead") return;
        if (this.state === "exploding") {
            this.explode(ctx, arena);
            return;
        }
        if (this.energy > 1) {
            this.energy -= 1;
        }
        else {
            this.energy = 1 / Number.MAX_SAFE_INTEGER;
        }
        const moveStep = (xAmount, yAmount) => {
            this.x += xAmount;
            this.y += yAmount;
            this.checkForTanks(arena);
            if (this.x < -arena.width / 2 || this.x > arena.width / 2 || this.y < -arena.height / 2 || this.y > arena.height / 2) {
                this.state = "dead";
                this.owner.missiles[this.id].miss = true;
            }
            this.owner.missiles[this.id].x = this.x;
            this.owner.missiles[this.id].y = this.y;
            this.owner.missiles[this.id].energy = this.energy;
            this.owner.missiles[this.id].size = this.size;
        };
        const speedFactor = this.speed / 2;
        const remainder = speedFactor - Math.floor(speedFactor);
        const moveX = Math.cos(this.aim * Math.PI / 180) * 2;
        const moveY = Math.sin(this.aim * Math.PI / 180) * 2;
        for (let i = 0; i < Math.floor(speedFactor); i++) {
            moveStep(moveX, moveY);
        }
        if (remainder) {
            moveStep(moveX * remainder, moveY * remainder);
        }
        this.checkForWalls(arena);
        this.checkForTanks(arena);
        if (allowBlocking.checked) {
            this.checkForMissiles(arena);
        }
    }
    
    draw(ctx, arena) {
        if (this.state !== "fired") return;
        const energyScore = Math.max(1, this.energy / MAX_MISSILE_ENERGY);
        const hexOpacity = (~~(energyScore * 255)).toString(16).padStart(2, "0");
        const missileSize = Math.max(MAX_MISSILE_SIZE, MAX_MISSILE_SIZE * energyScore);
        this.size = Math.max(MIN_MISSILE_SIZE, missileSize);
        ctx.save();
        ctx.translate(arena.width / 2, arena.height / 2);
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size * 0.5, 0, 2 * Math.PI);
        ctx.lineWidth = this.energy / 100;
        ctx.strokeStyle = "#ffffff";
        ctx.stroke();
        ctx.fillStyle = this.owner.color;
        ctx.fill();
        ctx.closePath();
        ctx.restore();
    }

    checkForWalls(arena) {
        const wallCollision = (
            Math.abs(this.x) > arena.width / 2 ||
            Math.abs(this.y) > arena.height / 2
        );
        if (wallCollision) {
            this.owner.missilesFired++;
            this.energy = 0;
            this.state = "dead";
            this.owner.missiles[this.id].miss = true;
        }
    }
    
    checkForTanks(arena) {
        if (this.state !== "fired") return;
        arena.tanks.forEach((tank) => {
            if (this.state === "fired" && tank.state === "alive" && tank.index !== this.owner.index) {
                const dx = tank.x - this.x;
                const dy = tank.y - this.y;
                const distance = Math.sqrt(dx ** 2 + dy ** 2);
                const damage = 1 + ~~this.energy;
                const collisionAngle = (Math.atan2(this.y - tank.y, this.x - tank.x) * 180 / Math.PI + 360000) % 360;
                if (distance < this.size + tank.size) {
                    tank.missileCollision = {
                        ownerId: this.owner.id,
                        angle: collisionAngle,
                        damage: damage
                    };
                    this.owner.missilesFired++;
                    this.owner.missilesHit++;
                    this.owner.matchScore += Math.max(0, damage) * DAMAGE_DEALT_POINTS;
                    tank.energy = Math.max(0, tank.energy - damage);
                    if (tank.energy <= 0) {
                        tank.state = "exploding";
                    }
                    tank.missileCollisions++;
                    tank.message = damage * -1;
                    tank.showMessage = 50;
                    this.state = "exploding";
                    this.owner.missiles[this.id].hit = true;
                }
            }
        });
    }

    checkForMissiles(arena) {
        if (this.state !== "fired") return;
        arena.missiles.forEach((other) => {
            if (this !== other && this.state === "fired" && other.state === "fired") {
                const dx = other.x - this.x;
                const dy = other.y - this.y;
                const distance = Math.sqrt(dx ** 2 + dy ** 2);
                if (distance < this.size + other.size) {
                    if (this.energy > other.energy) {
                        this.energy -= other.energy;
                        other.state = "exploding";
                        if (!this.hasHit) {
                            this.owner.missilesHit++;
                            this.hasHit = true;
                        }
                    }
                    else if (other.energy > this.energy) {
                        other.energy -= this.energy;
                        this.state = "exploding";
                        if (!other.hasHit) {
                            other.owner.missilesHit++;
                            other.hasHit = true;
                        }
                    }
                    else if (this.energy === other.energy) {
                        this.state = "exploding";
                        other.state = "exploding";
                    }
                    if (other.energy < 0) {
                        other.health += other.energy;
                        other.energy = 0;
                    }
                }
            }
        });
    }

    explode(ctx, arena) {
        if (!showAnimation.checked) return;
        if (!this.explosionSize) {
            this.explosionSize = 0;
            this.desiredExplosionSize = this.energy / 20;
            this.energy = 0;
            soundExplosion(this.volume, this.pitch * 0.75);
        }
        this.explosionSize += this.desiredExplosionSize / 5;
        ctx.save();
        ctx.beginPath();
        ctx.translate(arena.width / 2, arena.height / 2);
        ctx.translate(this.x, this.y);
        ctx.rotate(this.bodyAim * Math.PI / 180);
        ctx.arc(0, 0, this.explosionSize, 0, Math.PI * 2);
        ctx.fillStyle = ["red", "orange", "yellow", "white"][~~(Math.random() * 4)];
        ctx.fill();
        ctx.closePath();
        ctx.restore();
        if (this.explosionSize >= this.desiredExplosionSize) {
            this.state = "dead";
            this.energy = 0;
        }
    }
    
}