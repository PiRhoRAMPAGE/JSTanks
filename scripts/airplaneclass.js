class Airplane {
    constructor(owner, amount) {
        if (Math.random() > 0.5) {
            this.x = (Math.random() * 2 - 1) * MAX_X;
            this.y = (MAX_Y + ARENA_WIDTH / 2) * (Math.random() > 0.5 ? 1 : -1);
        } 
        else {
            this.x = (MAX_X + ARENA_WIDTH / 2) * (Math.random() > 0.5 ? 1 : -1);
            this.y = (Math.random() * 2 - 1) * MAX_Y;
        }
        this.owner = owner;
        this.target = owner;
        let highestTargetEnergy = 0
        tanks.forEach(tank => {
            if (tank.index !== owner.index) {
                if (tank.energy > highestTargetEnergy) {
                    highestTargetEnergy = tank.energy;
                    this.target = tank;
                }
            }
        })
        this.angleRad = Math.atan2(this.target.y - this.y, this.target.x - this.x);
        this.amount = amount;
        this.symbol = "✈";
        this.state = "active";
        this.gunHeat = 0;
        this.index = this.owner.index;
        this.color = this.owner.color;
        this.trail = [];
        this.missiles = {};
        this.missilesFired = 0;
        this.missilesHit = 0;
        this.firePowerMultiplier = 1;
        this.turnRate = 2.5;
        this.ammo = 1 + Math.round(3 * this.amount / MAX_POWERUP_AMOUNT);
        this.iteration = 0;
        this.maxIterations = 300 + this.ammo * 50;
        this.motorSound = playSound("airplane", true);
        playSound("airstrike", 0.05, 1);
    }

    update(ctx, arena) {
        this.turnRate += 0.25 * (Math.random() - 0.5);
        const speed = MAX_ACTUAL_SPEED * 2;
        const angleToTarget = Math.atan2(this.target.y - this.y, this.target.x - this.x) * DEGREES;
        let currentAngleDeg = this.angleRad * DEGREES;
        let angleDiff = angleToTarget - currentAngleDeg;
        angleDiff = ((angleDiff + 180) % 360 + 360) % 360 - 180;
        currentAngleDeg += Math.sign(angleDiff) * this.turnRate;
        this.angleRad = currentAngleDeg * RADIANS;
        this.x += speed * Math.cos(this.angleRad);
        this.y += speed * Math.sin(this.angleRad);
        const desiredVolume = (1 - (Math.sqrt(this.x ** 2 + this.y ** 2) / ARENA_WIDTH)) / 2;
        if (this.motorSound) {
            this.motorSound.volume = Math.min(1, Math.max(0, desiredVolume));
        }
        this.trail.push({
            x: this.x,
            y: this.y,
            opacity: 1.0,
            size: TANK_SIZE
        });
        this.trail.forEach(p => {
            p.opacity -= 0.015;
            p.size += 0.1;
        });
        this.trail = this.trail.filter(p => p.opacity > 0);

        const ammoRemaining = this.missilesFired <= this.ammo;
        const outOfGas = this.iteration > this.maxIterations;
        const targetDead = this.target.energy <= 0;
        if (targetDead ||outOfGas || !ammoRemaining) {
            this.turnRate = 0;
        }
        const boundary = ARENA_WIDTH;
        if (Math.abs(this.x) > boundary || Math.abs(this.y) > boundary) {
            this.state = "dead";
            if (this.motorSound) {
                this.motorSound.pause()
            }
        } 
        if (this.gunHeat > 0) {
            this.gunHeat--;
        }
        const gunCool = this.gunHeat === 0;
        const targetAlive = this.target.energy > 0;
        const targetDistance = Math.sqrt((this.y - this.target.y) ** 2 + (this.x - this.target.x) ** 2);        
        const shotAligned = Math.abs(angleDiff) < 90;
        const inRange = targetDistance < MAX_X / 2;
        const notOwner = this.target.index !== this.owner.index;
        if (ammoRemaining && gunCool && targetAlive && shotAligned && inRange && notOwner) {
            const missile = new Missile(this, this.missilesFired, this.x, this.y, angleToTarget, 250);
            arena.missiles.push(missile);                
            this.gunHeat = 50;
        }
        this.iteration++;
    }

    draw(ctx, arena) {
        ctx.save();
        ctx.translate(arena.width / 2, arena.height / 2);
        ctx.translate(this.x, this.y);
        const correction = 45 * RADIANS; 
        ctx.rotate(this.angleRad + correction);
        ctx.font = `${TANK_SIZE * 4}px 'Press Start 2P'`;
        ctx.fillStyle = "#000000";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(this.symbol, 0, 0); 
        ctx.restore();
        ctx.save();
        ctx.translate(arena.width / 2, arena.height / 2);
        this.trail.forEach(p => {
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 255, ${p.opacity * 0.15})`;
            ctx.fill();
        });
        ctx.restore();        
    }
}
