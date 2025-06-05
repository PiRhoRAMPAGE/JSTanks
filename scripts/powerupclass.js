
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
        if (type === "energy") {
            this.color = "#ffffff"
            this.symbol = "🔋";
        }
    }
    
    collect(tank) {
        // Handle energy differently, so you dont lose oter powerups if you pick it up.
        if (this.type === "energy") {
            tank.energy += this.amount;
        }
        else {
            tank.powerup.amount = (this.type === tank.powerup?.type) ? tank.powerup.amount + this.amount : this.amount;
            tank.powerup.symbol = this.symbol;
            tank.powerup.color = this.color;
            tank.powerup.type = this.type;
        }
        tank.powerupsCollected++;
        tank.message = this.type[0].toUpperCase() + this.type.substring(1);
        tank.showMessage = 50;
        this.state = "dead";
    }

    draw(ctx, arena) {
        if (this.duration <= 0) this.state = "dead";
        if (this.state !== "active") return;
        this.duration--;
        const lowDuration = POWERUP_PICKUP_DURATION / 5;
        const opacity = (this.duration > lowDuration)
            ? 1
            : (this.duration / lowDuration) ** (1 / 3);
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