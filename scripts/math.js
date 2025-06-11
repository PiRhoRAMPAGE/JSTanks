const SIN_TABLE_SIZE = 4096;
const SIN_LOOKUP = new Array(SIN_TABLE_SIZE);
for (let i = 0; i < SIN_TABLE_SIZE; i++) {
    const angle = (i / SIN_TABLE_SIZE) * 2 * Math.PI; // Normalize angle to 0 to 2*PI
    SIN_LOOKUP[i] = Math.sin(angle);
}
Math.sin = (angle) => {
    let normalizedAngle = angle % (2 * Math.PI);
    if (normalizedAngle < 0) normalizedAngle += 2 * Math.PI;
    const index = Math.round((normalizedAngle / (2 * Math.PI)) * (SIN_TABLE_SIZE - 1));
    return SIN_LOOKUP[index];
};


const COS_TABLE_SIZE = SIN_TABLE_SIZE;
const COS_LOOKUP = new Array(COS_TABLE_SIZE);
for (let i = 0; i < COS_TABLE_SIZE; i++) {
    const angle = (i / COS_TABLE_SIZE) * 2 * Math.PI;
    COS_LOOKUP[i] = Math.cos(angle);
}
Math.cos = (angle) => {
    let normalizedAngle = angle % (2 * Math.PI);
    if (normalizedAngle < 0) normalizedAngle += 2 * Math.PI;
    const index = Math.round((normalizedAngle / (2 * Math.PI)) * (COS_TABLE_SIZE - 1));
    return COS_LOOKUP[index];
};

class Angle {
    constructor(radians) {
        this._radians = radians;
    }

    static fromDegrees(degrees) {
        return new Angle(degrees * Math.PI / 180.0)
    }

    get degrees() {
        return this._radians * 180.0 / Math.PI;
    }

    get radians() {
        return this._radians;
    }

    div(scalar) {
        return new Angle(this.radians / scalar);
    }

    difference(other) {
        const normalization = Math.PI * 2000;
        let a1 = (this._radians + normalization) % (2.0 * Math.PI);
        let a2 = (other._radians + normalization) % (2.0 * Math.PI);
        if (a1 > Math.PI) a1 -= (2.0 * Math.PI);
        if (a2 > Math.PI) a2 -= (2.0 * Math.PI);
        return new Angle((a2 - a1 + Math.PI) % (2.0 * Math.PI) - Math.PI);
    }

    clamp(min, max) {
        return new Angle(Math.max(min.radians, Math.min(max.radians, this.radians)));
    }
}

class Vector2 {
    constructor(x, y) {
        this._x = x;
        this._y = y;
    }

    polarOffset(speed, angle) {
        return new Vector2(this._x + speed * Math.cos(angle.radians), this._y + speed * Math.sin(angle.radians))
    }

    distanceTo(other) {
        return Math.sqrt((this._x - other._x) ** 2 + (this._y - other._y) ** 2)
    }
}

