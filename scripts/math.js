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


const ATAN2_TABLE_SIZE = SIN_TABLE_SIZE;
const ATAN2_LOOKUP = new Array(ATAN2_TABLE_SIZE);
for (let i = 0; i < ATAN2_TABLE_SIZE; i++) {
    const angle = (i / ATAN2_TABLE_SIZE) * 2 * Math.PI;
    ATAN2_LOOKUP[i] = Math.cos(angle);
}
Math.ATAN2 = (angle) => {
    let normalizedAngle = angle % (2 * Math.PI);
    if (normalizedAngle < 0) normalizedAngle += 2 * Math.PI;
    const index = Math.round((normalizedAngle / (2 * Math.PI)) * (ATAN2_TABLE_SIZE - 1));
    return ATAN2_LOOKUP[index];
};