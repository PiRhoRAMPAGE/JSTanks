
const lerp = (a, b, lerpFactor) => {
    return a * (1 - lerpFactor) + b * lerpFactor;
};

const clamp = (number, min, max) => {
    return Math.max(min, Math.min(max, number));
};

const getDistance = (x1, y1, x2, y2) => {
    return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
};

const getAngle = (x1, y1, x2, y2) => {
    return Math.atan2(y2 - y1, x2 - x1) * DEGREES;
};

const normalizeAngle = (angleDegrees) => {
    angleDegrees %= 360;
    if (angleDegrees > 180) angleDegrees -= 360;
    if (angleDegrees < -180) angleDegrees += 360;
    return angleDegrees;
};

const dotProduct2D = (x1, y1, x2, y2) => {
    return (x1 * x2) + (y1 * y2);
}



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