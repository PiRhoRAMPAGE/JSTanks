const urlParams = new URLSearchParams(window.location.search);

const GLOBAL_STORAGE_KEY = "_JSTanks";

// Mathematical constants
const PI = Math.PI;
const DEGREES = 180 / Math.PI;
const RADIANS = Math.PI / 180;
const EPSILON = Number.EPSILON;

// Game duration
const MAX_MATCHES = urlParams.has("matches") ? urlParams.get("matches") : (urlParams.has("tournament") ? 1000 : 1000000);
const MAX_ITERATIONS = 9999;

// Arena
const ARENA_WIDTH = 400;
const ARENA_HEIGHT = 400;
const MIN_X = -ARENA_WIDTH / 2;
const MAX_X = ARENA_WIDTH / 2;
const MIN_Y = -ARENA_HEIGHT / 2;
const MAX_Y = ARENA_HEIGHT / 2;
const MAX_DISTANCE = Math.sqrt(ARENA_WIDTH ** 2 + ARENA_HEIGHT ** 2);

// Tanks
const TANK_SIZE = 6;
const MAX_TANK_ENERGY = 1000;
const MIN_ACTUAL_SPEED = -TANK_SIZE / 2.5;
const MAX_ACTUAL_SPEED = TANK_SIZE / 2.5;
const TANK_ACCELERATION = MAX_ACTUAL_SPEED / 5;
const MAX_BODY_TURN_DEGREES = 10;
const MAX_GUN_TURN_DEGREES = 15;
const MAX_RADAR_TURN_DEGREES = 45;
const MAX_RADAR_ARC_DEGREES = 90;
const MAX_COLLISION_DAMAGE = MAX_TANK_ENERGY / 4;
const MOVEMENT_COST_MULTIPLIER = 0.25;

// Missiles
const MISSILE_SPEED = 10;
const MIN_MISSILE_SIZE = 1;
const MAX_MISSILE_SIZE = TANK_SIZE / 10;
const MAX_MISSILE_ENERGY = 50;
const MISSILE_FLIGHT_COST = 1;
const MISSILE_ENERGY_MULTIPLIER = 4;
const GUN_HEAT_MULTIPLIER = 10;
const MAX_GUN_HEAT = MAX_MISSILE_ENERGY * GUN_HEAT_MULTIPLIER;

// Powerups
const SPAWN_POWERUP_PROBABILITY = urlParams.get("pspawn") || 0.002;
const MIN_POWERUP_AMOUNT = 100;
const MAX_POWERUP_AMOUNT = 1000;
const POWERUP_PICKUP_DURATION = 250;

// Scoring
const DAMAGE_DEALT_POINTS = 1;
const SURVIVAL_BONUS_POINTS = 1000;
const ACCURACY_BONUS_POINTS = 1000;
const TANK_SPEED_BONUS_POINTS = 1000;

