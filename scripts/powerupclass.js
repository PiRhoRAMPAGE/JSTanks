
function spawnPowerup(powerupType) {
    if (arena.powerups.length > 0) return;
    const options = [
        { type: "armor", amount: MAX_POWERUP_AMOUNT },
        { type: "energy", amount: MAX_POWERUP_AMOUNT },
        { type: "speed", amount: MAX_POWERUP_AMOUNT },
        { type: "guncool", amount: MAX_POWERUP_AMOUNT },
        { type: "firepower", amount: MAX_POWERUP_AMOUNT },
        { type: "airstrike", amount: MAX_POWERUP_AMOUNT },
    ];
    const numAvailable = (arena.airplanes.length > 0) ? 4 : 5;
    const selectedIndex = (typeof powerupType === "number") ? powerupType : ~~(Math.random() * numAvailable);
    const selectedPowerup = options[selectedIndex];
    let powerup = new PowerUp(selectedPowerup.type, selectedPowerup.amount)
    powerup.amount = Math.max(MIN_POWERUP_AMOUNT, MAX_POWERUP_AMOUNT * Math.random());
    powerupsSpawned++;
    arena.powerups.push(powerup);
}

class PowerUp {
    constructor(type, amount) {
        this.type = type;
        this.amount = amount;
        this.state = "active";
        this.size = TANK_SIZE;
        this.duration = POWERUP_PICKUP_DURATION;
        const margin = this.size * 5;
        this.x = (-ARENA_WIDTH / 2 + margin) + (Math.random() * ARENA_WIDTH - margin * 2);
        this.y = (-ARENA_HEIGHT / 2 + margin) + (Math.random() * ARENA_HEIGHT - margin *  2);
        if (this.x < -ARENA_WIDTH / 2 + margin) {
            this.x = -ARENA_WIDTH / 2 + margin;
        }
        if (this.x > ARENA_WIDTH / 2 - margin) {
            this.x = ARENA_WIDTH / 2 - margin;
        }
        if (this.y < -ARENA_HEIGHT / 2 + margin) {
            this.y = -ARENA_HEIGHT / 2 + margin;
        }
        if (this.y > ARENA_HEIGHT / 2 - margin) {
            this.y = ARENA_HEIGHT / 2 - margin;
        }
        if (type === "armor") {
            this.color = "#ffffff";
            this.symbol = "🛡️";
        }
        if (type === "energy") {
            this.color = "#00ff00"
            this.symbol = "🔋";
        }
        if (type === "speed") {
            this.color = "#ffd500"
            this.symbol = "⚡️";
        }
        if (type === "guncool") {
            this.color = "#6666ff"
            this.symbol = "❄️";
        }
        if (type === "firepower") {
            this.color = "#ff3200"
            this.symbol = "🔥";
        }
        if (type === "airstrike") {
            this.color = "#ffffff";
            this.symbol = "✈";
        }
    }
    
    collect(tank) {
        if (this.state !== "active") return;
        if (this.type === "armor") {
            tank.powerup.amount = (this.type === tank.powerup?.type) ? tank.powerup.amount + this.amount : this.amount;
            tank.powerup.symbol = this.symbol;
            tank.powerup.color = tank.color;
            tank.powerup.rippleColor = tank.color;
            tank.powerup.type = this.type;
        }
        else if (this.type === "energy") {
            tank.energy += this.amount;
            tank.powerup.rippleColor = this.color;
        }
        else if (this.type === "airstrike") {
            tank.powerup.amount = (this.type === tank.powerup?.type) ? tank.powerup.amount + this.amount : this.amount;
            tank.powerup.symbol = this.symbol;
            tank.powerup.color = this.color;
            tank.powerup.rippleColor = this.color;
            arena.airplanes.push(new Airplane(tank, this.amount));
        }
        else {
            tank.powerup.amount = (this.type === tank.powerup?.type) ? tank.powerup.amount + this.amount : this.amount;
            tank.powerup.symbol = this.symbol;
            tank.powerup.color = this.color;
            tank.powerup.rippleColor = this.color;
            tank.powerup.type = this.type;
        }
        tank.powerupsCollected++;
        tank.message = this.type[0].toUpperCase() + this.type.substring(1);
        tank.showMessage = 50;
        this.state = "dead";
        playSound("collect");
    }

    draw(ctx, arena) {
        if (this.duration <= 0) this.state = "dead";
        if (this.state !== "active") return;
        this.duration--;
        const opacity = (this.duration / POWERUP_PICKUP_DURATION) ** (1 / 5);
        ctx.save();
        ctx.translate(arena.width / 2, arena.height / 2);
        ctx.font = `${this.size * 2}px 'Press Start 2P'`;
        ctx.fillStyle = `rgba(0, 0, 0, ${opacity})`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(this.symbol, this.x, this.y - 2);
        ctx.restore();
    }
}
