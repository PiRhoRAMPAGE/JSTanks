function main(tank, arena) {
    const Q_STORAGE_KEY = `qlearning_${encodeURIComponent('Q-Learner')}`;
    const LEARNING_ENABLED = true;
    const saved = tank.retained;

    // Helper methods (must be defined before use)
    tank.angleDifference = (a1, a2) => {
        a1 = (a1 + 360000) % 360;
        a2 = (a2 + 360000) % 360;
        if (a1 > 180) a1 -= 360;
        if (a2 > 180) a2 -= 360;
        return (a2 - a1 + 180) % 360 - 180;
    };
    tank.calculateGunTurn = (x, y) => {
        const targetAngle = tank.angleTo(x, y);
        let gunAngleDifference = tank.angleDifference(tank.bodyAim + tank.gunAim, targetAngle);
        return Math.max(-1, Math.min(1, gunAngleDifference / 10));
    };
    
    // Add perpendicularSpeedComponent helper
    tank.perpendicularSpeedComponent = (target) => {
        let angleDifference = (target.angleTo - target.bodyAim + 360000) % 360;
        if (Math.abs(angleDifference) > 90) {
            angleDifference += (angleDifference > 0) ? -180 : 180;
        }
        return Math.cos(angleDifference * DEGREES);
    };

    // Add missile priority helper
    tank.getMissilePriority = (missile) => {
        const perfectTrajectory = (Math.atan2(tank.y - missile.y, tank.x - missile.x) * RADIANS + 36000) % 360;
        const trajectoryDifference = tank.angleDifference(perfectTrajectory, missile.aim);
        const trajectoryFactor = (1 - Math.abs(trajectoryDifference) / 180);
        const distanceFactor = 1 - (missile.distance / MAX_DISTANCE);
        const energyFactor = 1 - (missile.energy - MAX_MISSILE_ENERGY);
        return trajectoryFactor * 0.4 + distanceFactor * 0.4 + energyFactor * 0.2;
    };

    // Add memory helper functions
    tank.commitMemory = (key, value) => {
        localStorage.setItem(`tank_${encodeURIComponent(tank.name)}_${encodeURIComponent(key)}`, JSON.stringify(value))
    };
    tank.forgetMemory = (key) => {
        localStorage.removeItem(`tank_${encodeURIComponent(tank.name)}_${encodeURIComponent(key)}`)
    };
    tank.getMemory = (key) => {
        const value = localStorage.getItem(`tank_${encodeURIComponent(tank.name)}_${encodeURIComponent(key)}`);
        return (value) ? JSON.parse(value) : undefined;
    };

    // Add random color generator helper
    tank.getRandomColor = () => {
        const letters = '0123456789ABCDEF';
        let color = '#';
        for (let i = 0; i < 6; i++) {
            color += letters[Math.floor(Math.random() * 16)];
        }
        return color;
    };

    // Load existing Q-learning state, but don't initialize defaults
    if (!saved.qState) {
        try {
            const stored = localStorage.getItem(Q_STORAGE_KEY);
            if (stored) {
                saved.qState = JSON.parse(stored);
                // Share references to sub-tables
                saved.wallQ = saved.qState.wallQ;
                saved.targetQ = saved.qState.targetQ;
            }
        } catch (e) {
            console.log('Error loading Q-state:', e);
        }
    }

    // Set initial cosmetic values only
    if (tank.iteration === 0) {
        tank.name = "Q-Learner";
        tank.color = tank.getRandomColor();
        // Generate random colors for all tank parts
        tank.color = tank.getRandomColor();
        tank.fillColor = tank.getRandomColor();
        tank.treadColor = tank.getRandomColor();
        tank.gunColor = tank.getRandomColor();
        tank.radarColor = tank.getRandomColor();
        tank.radarArc = 1;
        tank.speed = 1;
        tank.gunTurn = tank.calculateGunTurn(0, 0);
        tank.bodyTurn = tank.bodyTurn;
        
        // Load existing state or initialize new one
        const storedState = loadQState();
        
        // Initialize state while preserving existing Q-tables and stats
        saved.qState = {
            qTable: storedState.qTable || {},
            wallQ: storedState.wallQ || {},
            targetQ: storedState.targetQ || {},
            energyQ: storedState.energyQ || {},
            thresholds: storedState.thresholds || {
                collisionCooldownTime: { value: 36, min: 20, max: 500, step: 2 },
                lowEnergyThreshold: { value: 500, min: 50, max: 1000, step: 25 },
                criticalEnergyThreshold: { value: 250, min: 50, max: 1000, step: 25 },
                optimalEnergy: { value: 1000, min: 800, max: 1200, step: 50 },
                emergencyRechargeThreshold: { value: 100, min: 50, max: 1000, step: 25 },
                desiredEnergyLevel: { value: 800, min: 100, max: 1000, step: 50 },
                chargeOpportunityThreshold: { value: 0.7, min: 0.4, max: 0.9, step: 0.05 },
                maxChargingTime: { value: 100, min: 60, max: 1000, step: 10 },
                minChargingTime: { value: 30, min: 15, max: 1000, step: 5 },
                minSafeDistance: { value: 300, min: 200, max: 400, step: 5 }
            },
            stats: {
                ...storedState.stats || {
                    wins: 0,
                    matches: 0,
                    totalReward: 0,
                    lastUpdate: Date.now()
                },
                // Ensure these don't get overwritten if they exist
                matchesSinceReset: storedState.stats?.matchesSinceReset || 0,
                winsSinceReset: storedState.stats?.winsSinceReset || 0,
                // Preserve learning parameters if they exist
                baseEpsilon: storedState.stats?.baseEpsilon ?? 0.3,
                minEpsilon: storedState.stats?.minEpsilon ?? 0.05,
                epsilonDecay: storedState.stats?.epsilonDecay ?? 0.995,
                alpha: storedState.stats?.alpha ?? 0.2,
                gamma: storedState.stats?.gamma ?? 0.98
            }
        };

        // Preserve reference consistency
        saved.wallQ = saved.qState.wallQ;
        saved.targetQ = saved.qState.targetQ;

        // Rest of initialization
        saved.wanderPattern = 0;
        saved.previousTargetData = [];
        saved.missileEvasionReverse = 0;
        saved.target = null;
        saved.scanDirection = 0;
        saved.targets = {};
        saved.wallCollisions = 0;
        saved.learningSaved = false;
        saved.prevState = null;
        saved.prevAction = null;
        saved.prevEnergy = tank.energy;
        saved.prevTargetEnergy = Infinity;
        saved.firedMissiles = [];
        saved.lastMissileId = false;

        // Initialize wall avoidance settings
        saved.wallAvoidance = {
            slowDown: 0.6,
            threshold: 8,
            learningRate: 0.01,
            learningDecay: 0.001,
            collisions: 0,
            adjustmentAmount: 0,
            adjustmentCount: 0,
            adjustmentMatchCurrent: 0,
            adjustmentMatchTarget: 1000,
            matchesSinceCollisionBest: 0,
            matchesSinceCollisionCurrent: 0,
            rewardsPositive: 0,
            rewardsNegative: 0,
            trainingIteration: 0,
            largestUnsafe: {
                slowDown: 0,
                threshold: 0
            }
        };

        // Load all Q-learning states from storage
        saved.qState = storedState;
        saved.wallQ = storedState.wallQ || {};
        saved.targetQ = storedState.targetQ || {};

        // Initialize if not loaded
        if (!saved.qState.qTable) {
            saved.qState = {
                qTable: {},
                wallQ: {},
                targetQ: {},
                stats: {
                    wins: 0,
                    matches: 0,
                    totalReward: 0,
                    lastUpdate: Date.now(),
                    // Add performance tracking
                    lastReset: Date.now(),
                    matchesSinceReset: 0,
                    winsSinceReset: 0,
                    // Store learning parameters
                    baseEpsilon: 0.3,
                    minEpsilon: 0.05,
                    epsilonDecay: 0.995,
                    alpha: 0.2,
                    gamma: 0.98
                }
            };
        }
    }

    // --- ML Model Setup ---
    const SAVE_INTERVAL = 1000;
    const EXPERIENCE_BUFFER_SIZE = 1000;
    const MIN_EXPERIENCE_SIZE = 100;
    const MAX_INTERCEPT_ITERATIONS = 3;  // Maximum iterations for calculating missile intercept
    
    // Add missing ML constants
    const BASE_EPSILON = saved.qState?.stats?.baseEpsilon ?? 0.3;
    const MIN_EPSILON = saved.qState?.stats?.minEpsilon ?? 0.05;
    const EPSILON_DECAY = saved.qState?.stats?.epsilonDecay ?? 0.995;
    const ALPHA = saved.qState?.stats?.alpha ?? 0.2;
    const GAMMA = saved.qState?.stats?.gamma ?? 0.98;

    // Add missing ACTIONS constant
    const ACTIONS = {
        movement: [
            { speed: 1, turn: 0 },      // Forward
            { speed: -1, turn: 0 },     // Backward
            { speed: 0.5, turn: 0.5 },  // Forward + Right
            { speed: 0.5, turn: -0.5 }, // Forward + Left
            { speed: -0.5, turn: 0.5 }, // Backward + Right
            { speed: -0.5, turn: -0.5 },// Backward + Left
            { speed: 0, turn: 1 },      // Turn Right
            { speed: 0, turn: -1 },     // Turn Left
            { speed: 0, turn: 0 }       // Stop
        ],
        fire: [10, 20, 30, 40, 50]     // Different fire powers
    };

    // Add experience replay buffer
    if (tank.iteration === 0 && !saved.experienceBuffer) {
        saved.experienceBuffer = [];
        saved.performanceHistory = [];
        saved.adaptiveLearning = {
            currentEpsilon: BASE_EPSILON,
            currentAlpha: ALPHA,
            successRate: 0.5,
            lastResetEpoch: 0
        };
    }

    // Add adaptive learning rate adjustment
    function updateLearningParameters() {
        const al = saved.adaptiveLearning;
        const stats = saved.qState.stats;
        
        // Calculate win rate over last 100 matches
        const recentWinRate = stats.winsSinceReset / Math.max(1, stats.matchesSinceReset);
        
        // Adjust learning rate based on performance
        if (recentWinRate < 0.4) {
            al.currentAlpha = Math.min(0.5, al.currentAlpha * 1.1); // Increase learning rate
            al.currentEpsilon = Math.min(0.4, al.currentEpsilon * 1.2); // Increase exploration
        } else if (recentWinRate > 0.6) {
            al.currentAlpha = Math.max(0.1, al.currentAlpha * 0.95); // Decrease learning rate
            al.currentEpsilon = Math.max(0.05, al.currentEpsilon * 0.9); // Decrease exploration
        }
    }

    // Modify updateQ function to use experience replay
    function updateQ(state, action, reward, nextState) {
        // Add experience to buffer
        saved.experienceBuffer.push({state, action, reward, nextState});
        if (saved.experienceBuffer.length > EXPERIENCE_BUFFER_SIZE) {
            saved.experienceBuffer.shift();
        }
        
        // Only start replay when we have enough experiences
        if (saved.experienceBuffer.length >= MIN_EXPERIENCE_SIZE) {
            // Replay random experiences
            for (let i = 0; i < 10; i++) {
                const idx = Math.floor(Math.random() * saved.experienceBuffer.length);
                const exp = saved.experienceBuffer[idx];
                
                const currentState = getQState(exp.state);
                const nextStateQ = getQState(exp.nextState);
                
                // Prioritize learning from high-reward experiences
                const learningPriority = Math.abs(exp.reward) / 1000;
                const effectiveAlpha = saved.adaptiveLearning.currentAlpha * (1 + learningPriority);
                
                currentState.values[exp.action] = (1 - effectiveAlpha) * currentState.values[exp.action] +
                                               effectiveAlpha * (exp.reward + GAMMA * Math.max(...nextStateQ.values));
            }
        }
    }

    // Modify reward calculation to better shape learning
    function getReward(tank, prevEnergy) {
        let reward = 0;
        
        // Progressive rewards for survival
        reward += Math.sqrt(tank.iteration) * 0.1;
        
        // Winning reward scales with remaining energy
        if (arena.tanksRemaining === 1) {
            reward += 1000 * (tank.energy / 1000);
        }
        
        // Energy management rewards
        const energyDelta = tank.energy - prevEnergy;
        if (energyDelta > 0) {
            // Higher reward for charging when energy is low
            const needFactor = Math.pow(1 - (prevEnergy / 1000), 2);
            reward += energyDelta * needFactor * 10;
        }
        
        // Positioning rewards
        if (saved.target) {
            // Reward maintaining optimal distance
            const optimalDistance = arena.width / 4;
            const distanceError = Math.abs(saved.target.distance - optimalDistance);
            reward += 10 * (1 - distanceError / optimalDistance);
            
            // Reward perpendicular positioning more strongly
            const angleToTarget = Math.abs(tank.angleDifference(tank.bodyAim, saved.target.angleTo));
            const perpendicularBonus = (1 - Math.abs(angleToTarget - 90) / 90) * 20;
            reward += perpendicularBonus;
        }
        
        // Stronger penalties for dangerous situations
        if (tank.wallCollision) reward -= 200;
        if (tank.missileCollision) reward -= 150;
        if (tank.tankCollision) reward -= 100;
        
        return reward;
    }

    // Only initialize Q-tables when accessing if they don't exist
    function getQState(state) {
        if (!saved.qState) {
            saved.qState = { qTable: {}, wallQ: {}, targetQ: {}, stats: { totalReward: 0, matches: 0, wins: 0 } };
            saved.wallQ = saved.qState.wallQ;
            saved.targetQ = saved.qState.targetQ;
        }
        if (!saved.qState.qTable[state]) {
            saved.qState.qTable[state] = {
                values: Array(ACTIONS.movement.length * ACTIONS.fire.length).fill(0),
                lastUsed: Date.now()
            };
        }
        return saved.qState.qTable[state];
    }

    // Load Q-learning state from localStorage with error handling
    function loadQState() {
        try {
            const stored = localStorage.getItem(Q_STORAGE_KEY);
            if (!stored) return initializeQState();
            
            const state = JSON.parse(stored); // Fix: Parse the stored string
            return state;
        } catch (e) {
            console.log('Error loading Q-state:', e);
            return initializeQState();
        }
    }

    // Initialize fresh Q-learning state - only called when no state exists
    function initializeQState() {
        return {
            qTable: {},
            wallQ: {},
            targetQ: {},
            thresholds: {
                collisionCooldownTime: { value: 36, min: 20, max: 50, step: 2 },
                lowEnergyThreshold: { value: 500, min: 300, max: 700, step: 25 },
                criticalEnergyThreshold: { value: 250, min: 150, max: 350, step: 25 },
                optimalEnergy: { value: 1000, min: 800, max: 1200, step: 50 },
                emergencyRechargeThreshold: { value: 200, min: 100, max: 300, step: 25 },
                desiredEnergyLevel: { value: 800, min: 600, max: 1000, step: 50 },
                chargeOpportunityThreshold: { value: 0.7, min: 0.4, max: 0.9, step: 0.05 },
                maxChargingTime: { value: 100, min: 60, max: 140, step: 10 },
                minChargingTime: { value: 30, min: 15, max: 45, step: 5 },
                minSafeDistance: { value: 300, min: 200, max: 400, step: 25 }
            },
            stats: {
                wins: 0,
                matches: 0,
                totalReward: 0,
                lastUpdate: Date.now()
            }
        };
    }

    // Save Q-learning state with storage limit handling
    function saveQState(state) {
        try {
            // Create deep copy to avoid reference issues
            const stateToSave = {
                qTable: { ...state.qTable },
                wallQ: { ...state.wallQ },
                targetQ: { ...state.targetQ },
                energyQ: { ...state.energyQ },
                thresholds: { ...state.thresholds },
                stats: {
                    ...state.stats,
                    lastUpdate: Date.now(),
                    // Explicitly preserve these values
                    matchesSinceReset: state.stats.matchesSinceReset || 0,
                    winsSinceReset: state.stats.winsSinceReset || 0,
                    // Preserve learning parameters
                    baseEpsilon: state.stats.baseEpsilon,
                    minEpsilon: state.stats.minEpsilon,
                    epsilonDecay: state.stats.epsilonDecay,
                    alpha: state.stats.alpha,
                    gamma: state.stats.gamma
                }
            };
            
            // Get existing state to check for data preservation
            const existingState = localStorage.getItem(Q_STORAGE_KEY);
            if (existingState) {
                const parsedExisting = JSON.parse(existingState);
                // Preserve any additional fields we might not know about
                stateToSave.stats = {
                    ...parsedExisting.stats,
                    ...stateToSave.stats
                };
            }

            localStorage.setItem(Q_STORAGE_KEY, JSON.stringify(stateToSave));
        } catch (e) {
            console.log('Error saving Q-state:', e);
        }
    }

    // Prune rarely used Q-table entries
    function pruneQTables(state) {
        const pruneTables = (table) => {
            const entries = Object.entries(table);
            // Keep only the most recently used entries
            entries.sort((a, b) => (b[1].lastUsed || 0) - (a[1].lastUsed || 0));
            const pruned = Object.fromEntries(entries.slice(0, 1000)); // Keep top 1000 states
            return pruned;
        };

        state.qTable = pruneTables(state.qTable);
        state.wallQ = pruneTables(state.wallQ);
        state.targetQ = pruneTables(state.targetQ);
    }

    // Discretize continuous values into bins
    function discretize(value, bins, min, max) {
        const step = (max - min) / bins;
        return Math.min(bins - 1, Math.max(0, Math.floor((value - min) / step)));
    }

    // Get state string for Q-table lookup
    function getState(tank, target, wallDistance) {
        if (!target) return 'no_target';
        
        const d = discretize(target.distance, STATE_BINS.distance, 0, MAX_DISTANCE);
        const a = discretize(Math.abs(tank.angleDifference(tank.bodyAim + tank.gunAim, target.angleTo)),
                           STATE_BINS.angle, 0, 180);
        const s = discretize(Math.abs(target.speed), STATE_BINS.speed, 0, 1);
        const e = discretize(tank.energy, STATE_BINS.energy, 0, 1000);
        const ed = discretize(tank.energy - saved.prevEnergy, STATE_BINS.energyDelta, -50, 50);
        const td = discretize(target.distance, STATE_BINS.targetDistance, 0, MAX_DISTANCE);
        const w = discretize(wallDistance, STATE_BINS.wallDistance, 0, 300);
        const gh = discretize(tank.gunHeat, STATE_BINS.gunHeat, 0, 50);
        const te = discretize(target.energy, STATE_BINS.targetEnergy, 0, 1000);
        const ts = discretize(Math.abs(target.actualSpeed), STATE_BINS.targetSpeed, 0, MAX_ACTUAL_SPEED);
        const mt = discretize(saved.missileThreat || 0, STATE_BINS.missileThreats, 0, 200);
        
        return `${d}_${a}_${s}_${e}_${w}_${gh}_${te}_${ts}_${mt}_${ed}_${td}`;
    }


    // --- Wall Q-learning Setup ---
    const WALL_Q_BINS = {
        distance: 6,
        angle: 8
    };
    
    const WALL_ACTIONS = [
        { slowDown: 0.3, threshold: 6 },
        { slowDown: 0.5, threshold: 8 },
        { slowDown: 0.7, threshold: 10 },
        { slowDown: 0.9, threshold: 12 }
    ];

    // Get wall avoidance state
    function getWallQState(distance, angle) {
        const d = discretize(distance, WALL_Q_BINS.distance, 0, 300);
        const a = discretize(Math.abs(angle), WALL_Q_BINS.angle, 0, 180);
        return `wall_${d}_${a}`;
    }

    // Initialize wall Q-table if not exists
    saved.wallQ = saved.wallQ || {};

    // Load Q-learning state from localStorage
    function loadQState() {
        try {
            const stored = localStorage.getItem(Q_STORAGE_KEY);
            return stored ? JSON.parse(stored) : {
                qTable: {},
                stats: {
                    wins: 0,
                    matches: 0,
                    totalReward: 0,
                    lastUpdate: Date.now()
                }
            };
        } catch {
            return { qTable: {}, stats: { wins: 0, matches: 0, totalReward: 0, lastUpdate: Date.now() } };
        }
    }

    

    // Discretize continuous values into bins
    function discretize(value, bins, min, max) {
        const step = (max - min) / bins;
        return Math.min(bins - 1, Math.max(0, Math.floor((value - min) / step)));
    }

    // Get state string for Q-table lookup
    function getState(tank, target, wallDistance) {
        if (!target) return 'no_target';
        
        const d = discretize(target.distance, STATE_BINS.distance, 0, MAX_DISTANCE);
        const a = discretize(Math.abs(tank.angleDifference(tank.bodyAim + tank.gunAim, target.angleTo)),
                           STATE_BINS.angle, 0, 180);
        const s = discretize(Math.abs(target.speed), STATE_BINS.speed, 0, 1);
        const e = discretize(tank.energy, STATE_BINS.energy, 0, 1000);
        const w = discretize(wallDistance, STATE_BINS.wallDistance, 0, 300);
        
        return `${d}_${a}_${s}_${e}_${w}`;
    }

    // --- Targeting Q-learning Setup ---
    const TARGET_Q_BINS = {
        distance: 6,
        speed: 4,
        angle: 8
    };
    
    const TARGET_ACTIONS = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50];  // Different fire powers

    // Get targeting state
    function getTargetQState(distance, speed, angleDiff) {
        const d = discretize(distance, TARGET_Q_BINS.distance, 0, MAX_DISTANCE);
        const s = discretize(Math.abs(speed), TARGET_Q_BINS.speed, 0, 1);
        const a = discretize(Math.abs(angleDiff), TARGET_Q_BINS.angle, 0, 180);
        return `target_${d}_${s}_${a}`;
    }

    // Initialize targeting Q-table if not exists
    saved.targetQ = saved.targetQ || {};


    // Initialize or load Q-learning state
    saved.qState = saved.qState || loadQState();

    // Only initialize Q-tables when accessing if they don't exist
    function getQState(state) {
        if (!saved.qState) {
            saved.qState = { qTable: {}, wallQ: {}, targetQ: {}, stats: { totalReward: 0, matches: 0, wins: 0 } };
            saved.wallQ = saved.qState.wallQ;
            saved.targetQ = saved.qState.targetQ;
        }
        if (!saved.qState.qTable[state]) {
            saved.qState.qTable[state] = {
                values: Array(ACTIONS.movement.length * ACTIONS.fire.length).fill(0),
                lastUsed: Date.now()
            };
        }
        return saved.qState.qTable[state];
    }

    // Update Q-value with timestamp and adaptive learning rate
    function updateQ(state, action, reward, nextState) {
        const currentState = getQState(state);
        const nextStateQ = getQState(nextState);
        
        // Calculate visit count for state-action pair
        currentState.visits = currentState.visits || {};
        currentState.visits[action] = (currentState.visits[action] || 0) + 1;
        
        // Adaptive learning rate based on visit count
        const adaptiveAlpha = ALPHA / Math.sqrt(currentState.visits[action]);
        
        const currentValues = currentState.values;
        const nextValues = nextStateQ.values;
        
        currentState.lastUsed = Date.now();
        
        const maxNextQ = Math.max(...nextValues);
        currentValues[action] = (1 - adaptiveAlpha) * currentValues[action] +
                              adaptiveAlpha * (reward + GAMMA * maxNextQ);
        
        if (saved.qState.stats) {
            saved.qState.stats.totalReward += reward;
        }
    }

    // Get best action with dynamic exploration
    function getBestAction(state) {
        if (!saved.qState.totalIterations) {
            saved.qState.totalIterations = 0;
        }
        saved.qState.totalIterations++;

        // Calculate current epsilon based on total iterations
        const currentEpsilon = Math.max(
            MIN_EPSILON,
            BASE_EPSILON * Math.pow(EPSILON_DECAY, saved.qState.totalIterations / 1000)
        );

        // Initialize state if needed
        if (!saved.qState.qTable[state]) {
            saved.qState.qTable[state] = {
                values: Array(ACTIONS.movement.length * ACTIONS.fire.length).fill(0),
                lastUsed: Date.now()
            };
        }

        const qValues = saved.qState.qTable[state].values;
        
        // Use epsilon-greedy with optimistic initialization for unexplored actions
        if (Math.random() < currentEpsilon) {
            // Prioritize unexplored actions
            const unexploredActions = qValues.map((val, idx) => ({val, idx}))
                                           .filter(({val}) => val === 0);
            if (unexploredActions.length > 0) {
                // Pick random unexplored action
                return unexploredActions[Math.floor(Math.random() * unexploredActions.length)].idx;
            }
            return Math.floor(Math.random() * qValues.length);
        }
        
        // Find action with maximum value using softmax selection
        const temperature = 0.1;
        const expValues = qValues.map(q => Math.exp(q / temperature));
        const sumExp = expValues.reduce((a, b) => a + b, 0);
        const probs = expValues.map(exp => exp / sumExp);
        
        let rand = Math.random();
        let cumSum = 0;
        for (let i = 0; i < probs.length; i++) {
            cumSum += probs[i];
            if (rand < cumSum) return i;
        }
        return 0;
    }

    // Initialize thresholds at the top level for consistent access
    const DEFAULT_THRESHOLDS = {
        collisionCooldownTime: { value: 36, min: 20, max: 50, step: 2 },
        lowEnergyThreshold: { value: 500, min: 300, max: 700, step: 25 },
        criticalEnergyThreshold: { value: 250, min: 150, max: 350, step: 25 },
        optimalEnergy: { value: 1000, min: 800, max: 1200, step: 50 },
        emergencyRechargeThreshold: { value: 200, min: 100, max: 300, step: 25 },
        desiredEnergyLevel: { value: 800, min: 600, max: 1000, step: 50 },
        chargeOpportunityThreshold: { value: 0.7, min: 0.4, max: 0.9, step: 0.05 },
        maxChargingTime: { value: 100, min: 60, max: 140, step: 10 },
        minChargingTime: { value: 30, min: 15, max: 45, step: 5 },
        minSafeDistance: { value: 300, min: 200, max: 400, step: 25 }
    };

    // Ensure thresholds exist in qState
    if (!saved.qState) {
        saved.qState = {
            qTable: {},
            wallQ: {},
            targetQ: {},
            thresholds: { ...DEFAULT_THRESHOLDS },
            stats: {
                wins: 0,
                matches: 0,
                totalReward: 0,
                lastUpdate: Date.now()
            }
        };
    } else if (!saved.qState.thresholds) {
        saved.qState.thresholds = { ...DEFAULT_THRESHOLDS };
    }

    // Get reference to thresholds
    const thresholds = saved.qState.thresholds;

    // Create local constants from thresholds
    const COLLISION_COOLDOWN_TIME = thresholds.collisionCooldownTime;
    const LOW_ENERGY_THRESHOLD = thresholds.lowEnergyThreshold;
    const CRITICAL_ENERGY_THRESHOLD = thresholds.criticalEnergyThreshold;
    const OPTIMAL_ENERGY = thresholds.optimalEnergy;
    const EMERGENCY_RECHARGE_THRESHOLD = thresholds.emergencyRechargeThreshold;
    const DESIRED_ENERGY_LEVEL = thresholds.desiredEnergyLevel;
    const CHARGE_OPPORTUNITY_THRESHOLD = thresholds.chargeOpportunityThreshold;
    const MAX_CHARGING_TIME = thresholds.maxChargingTime;
    const MIN_CHARGING_TIME = thresholds.minChargingTime;
    const MIN_SAFE_DISTANCE = thresholds.minSafeDistance;

    // Add STATE_BINS constant
    const STATE_BINS = {
        distance: 8,          // Distance to target
        angle: 12,           // Angle difference
        speed: 6,            // Target speed
        energy: 10,          // Tank energy
        energyDelta: 4,      // Energy change rate
        targetDistance: 8,    // Distance for recharge decisions
        wallDistance: 6,      // Distance to nearest wall
        gunHeat: 4,          // Gun heat level
        targetEnergy: 4,      // Target's energy
        targetSpeed: 4,      // Target's actual speed
        missileThreats: 3    // Number of incoming missiles
    };

    // Calculate reward with more factors
    function getReward(tank, prevEnergy) {
        let reward = 0;
        if (arena.tanksRemaining === 1) {
            reward += 1000; // Large reward for winning
        }
        
        // Add survival reward based on frames lasted
        reward += tank.iteration * 1; // Small constant reward for each frame survived
        
        // Energy state rewards
        const energyDelta = tank.energy - prevEnergy;
        const thresholds = saved.qState.thresholds;
        
        // Reward maintaining high energy
        if (tank.energy > thresholds.optimalEnergy) {
            reward += 20;
        }
        
        // Progressive rewards for charging based on need
        if (energyDelta > 0 && tank.speed === 0) {
            const needFactor = Math.max(0, 1 - (prevEnergy / thresholds.desiredEnergyLevel));
            reward += energyDelta * needFactor * 5;
            
            // Extra reward for successful charging in combat
            if (saved.target && saved.target.gunHeat < 15) {
                reward += energyDelta * 2;
            }
        }
        
        // Penalize taking damage while charging
        if (energyDelta < 0 && Math.abs(tank.speed) < 0.1) {
            reward -= Math.abs(energyDelta) * 3;
        }
        
        // Extra reward for maintaining high energy
        if (tank.energy > OPTIMAL_ENERGY) {
            reward += 10;
        }

        // Modify energy reward to only consider recharge when completely stopped
        const energyGained = tank.energy - prevEnergy;
        if (energyGained > 0 && Math.abs(tank.speed) === 0) {
            // Triple the recharge reward when low on energy
            const lowEnergyFactor = Math.max(0, 1 - (prevEnergy / 1000)) * 3;
            reward += energyGained * lowEnergyFactor * 3;
        }

        // Add stronger rewards for stopping in safe positions to recharge
        if (saved.target && Math.abs(tank.speed) === 0) {
            const isSafeToRecharge = !tank.missileCollision &&
                                   !tank.detectedMissiles.length &&
                                   saved.target.gunHeat > 10 &&
                                   tank.energy < saved.target.energy;
            
            if (isSafeToRecharge) {
                reward += 5;  // Reward for choosing to stop in safe conditions
            } else {
                reward -= 10; // Penalty for stopping in dangerous conditions
            }
        }

        // Reward for dealing damage
        if (saved.target && saved.target.energy < saved.prevTargetEnergy) {
            reward += (saved.prevTargetEnergy - saved.target.energy) * 3;
        }
        
        // Penalty for taking damage
        if (tank.energy < prevEnergy) {
            const damageTaken = prevEnergy - tank.energy;
            reward -= damageTaken * 2;
        }
        
        // Penalty for wall collisions
        if (tank.wallCollision) {
            reward -= 100;
        }
        
        // Small penalty for being close to walls
        if (tank.isNearWall) {
            reward -= 20;
        }
        
        // Tactical positioning rewards
        if (saved.target) {
            // Reward maintaining optimal combat distance
            const optimalDistance = arena.width / 4;
            const distanceScore = 1 - Math.abs(saved.target.distance - optimalDistance) / optimalDistance;
            reward += distanceScore * 10;
            
            // Reward perpendicular positioning for evasion
            const angleToTarget = tank.angleDifference(tank.bodyAim, saved.target.angleTo);
            const perpendicularScore = Math.abs(Math.abs(angleToTarget) - 90) / 90;
            reward += (1 - perpendicularScore) * 5;
        }

        // Additional reward factors
        if (saved.target) {
            // Reward for maintaining optimal firing position
            const optimalRange = arena.width / 3;
            const rangeError = Math.abs(saved.target.distance - optimalRange);
            reward += (1 - rangeError / optimalRange) * 15;

            // Reward for good energy management
            if (tank.energy > saved.target.energy) {
                reward += 10 * (tank.energy - saved.target.energy) / tank.energy;
            }

            // Reward for dodging shots
            if (tank.detectedMissiles.length > 0 && !tank.missileCollision) {
                reward += 20;
            }
        }

        // Penalty for staying still too long
        if (Math.abs(tank.speed) < 0.1) {
            reward -= 5;
        }
        
        return reward;
    }

    // Store previous state for learning
    if (tank.iteration === 0) {
        saved.prevState = null;
        saved.prevAction = null;
        saved.prevEnergy = tank.energy;
        saved.prevTargetEnergy = Infinity;
    }

    // Calculate distances to each wall (moved this section up)
    let wallDistance = Infinity;
    let wallAngle = 0;
    const leftWallDistance = Math.abs(-arena.width / 2 - tank.x);
    const rightWallDistance = Math.abs(arena.width / 2 - tank.x);
    const topWallDistance = Math.abs(-arena.height / 2 - tank.y);
    const bottomWallDistance = Math.abs(arena.height / 2 - tank.y);

    // Determine the nearest wall and the angle to it
    if (leftWallDistance < wallDistance) {
        wallDistance = leftWallDistance;
        wallAngle = 180;
    }
    if (rightWallDistance < wallDistance) {
        wallDistance = rightWallDistance;
        wallAngle = 0
    }
    if (topWallDistance < wallDistance) {
        wallDistance = topWallDistance;
        wallAngle = -90;
    }
    if (bottomWallDistance < wallDistance) {
        wallDistance = bottomWallDistance;
        wallAngle = 90;
    }

    // Main Q-learning logic now has access to wallDistance
    const currentState = getState(tank, saved.target, wallDistance);
    
    // Learn from previous action
    if (saved.prevState && saved.prevAction !== null) {
        const reward = getReward(tank, saved.prevEnergy);
        updateQ(saved.prevState, saved.prevAction, reward, currentState);
    }

    // Critical energy override - check this BEFORE selecting action
    const inCriticalEnergy = tank.energy < EMERGENCY_RECHARGE_THRESHOLD;
    const missileImmediatelyDangerous = tank.detectedMissiles.length > 0 &&
                                tank.detectedMissiles[0].distance < 50;
    const tankImmediatelyDangerous = saved.target && saved.target.distance < 100 && saved.target.gunHeat < 5;
    const immediatelyDangerous = missileImmediatelyDangerous || tankImmediatelyDangerous;
    
    // Determine if we should be charging
    const needsCharge = tank.energy < DESIRED_ENERGY_LEVEL;
    const safeToCharge = saved.target &&
                        saved.target.distance > MIN_SAFE_DISTANCE &&
                        saved.target.gunHeat > 10 &&
                        !tank.detectedMissiles.length;
    
    // Track charging state and duration
    if (!saved.isCharging && (needsCharge && safeToCharge) || inCriticalEnergy) {
        saved.isCharging = true;
        saved.chargingStartTime = tank.iteration;
    }
    
    const chargingDuration = tank.iteration - saved.chargingStartTime;
    const shouldCharge = saved.isCharging && (
        chargingDuration < MIN_CHARGING_TIME ||
        ((needsCharge && safeToCharge) || inCriticalEnergy)
    );

    // Reset charging state if conditions are no longer met and minimum time passed
    if (saved.isCharging && chargingDuration >= MIN_CHARGING_TIME && !needsCharge && !inCriticalEnergy) {
        saved.isCharging = false;
    }

    let actionIndex = 0;
    let fireIndex = 0;
    
    // Force stop when charging unless in immediate danger
    if (shouldCharge && !immediatelyDangerous) {
        tank.speed = 0;
        tank.gunHeat = 50; // Prevent firing by maxing out gun heat
        // Try to maintain perpendicular angle to target while recharging
        if (saved.target) {
            tank.bodyTurn = tank.angleDifference(tank.bodyAim, saved.target.angleTo + 90) / 180;
        }
        // Use stop action index for learning
        actionIndex = ACTIONS.movement.findIndex(m => m.speed === 0 && m.turn === 0);
        fireIndex = 0; // Don't fire when recharging
    } else {
        // Select and execute action only if not charging
        actionIndex = getBestAction(currentState);
        const movementIndex = Math.floor(actionIndex / ACTIONS.fire.length);
        fireIndex = actionIndex % ACTIONS.fire.length;
        const movement = ACTIONS.movement[movementIndex];
        tank.speed = movement.speed;
        tank.bodyTurn = movement.turn;
    }

    // Apply selected fire power if conditions are met and not charging
    if (tank.gunHeat === 0 && saved.target && !shouldCharge) {
        const firePower = ACTIONS.fire[fireIndex];
        saved.lastMissileId = tank.fire(firePower);
    }

    // Override any other movement commands if in critical energy
    if (inCriticalEnergy && !immediatelyDangerous) {
        tank.speed = 0;
    }

    // Store current state for next iteration
    saved.prevState = currentState;
    saved.prevAction = actionIndex;
    saved.prevEnergy = tank.energy;
    saved.prevTargetEnergy = saved.target?.energy || Infinity;

    // Save Q-state periodically and on match end
    if (arena.tanksRemaining === 1 || tank.iteration % SAVE_INTERVAL === 0) {
        if (arena.tanksRemaining === 1) {
            saved.qState.stats.winsSinceReset++;
        }
        // Update stats
        saved.qState.stats.matches++;
        if (!saved.wallCollisions) {
            saved.qState.stats.wins++;
        }
        
        // Merge all Q-tables into one state
        const stateToSave = {
            ...saved.qState,
            wallQ: saved.wallQ,
            targetQ: saved.targetQ,
            stats: saved.qState.stats,
            lastUpdate: Date.now()
        };
        
        // Save to localStorage
        saveQState(stateToSave);
    }


    // --- Wall Avoidance ML ---
    // Calculate state
    const wallProximityThreshold = saved.wallAvoidance?.threshold * tank.size || 8 * tank.size;
    const nextX = tank.x + tank.actualSpeed * Math.cos(tank.bodyAim * DEGREES);
    const nextY = tank.y + tank.actualSpeed * Math.sin(tank.bodyAim * DEGREES);
    tank.isNearWall = (
        Math.abs(nextX) > arena.width / 2 - wallProximityThreshold ||
        Math.abs(nextY) > arena.height / 2 - wallProximityThreshold
    );
    
    // Calculate number of frames until wall collision
    let predictedAim = tank.bodyAim + tank.bodyTurn * MAX_BODY_TURN_DEGREES;
    let predictedX = tank.x + tank.actualSpeed * Math.cos(predictedAim * DEGREES);
    let predictedY = tank.y + tank.actualSpeed * Math.sin(predictedAim * DEGREES);
    let collision = Math.abs(predictedX) > arena.width / 2 - tank.size || Math.abs(predictedY) > arena.height / 2 - tank.size;
    // --- Optimize wall collision prediction ---
    let framesUntilWallCollision = 0;
    const MAX_PREDICTION_FRAMES = 30; // Reduced from 100 to prevent long loops
    while (framesUntilWallCollision < MAX_PREDICTION_FRAMES && !collision) {
        predictedAim += tank.bodyTurn * MAX_BODY_TURN_DEGREES;
        predictedX += tank.actualSpeed * Math.cos(predictedAim * DEGREES);
        predictedY += tank.actualSpeed * Math.sin(predictedAim * DEGREES);
        collision = Math.abs(predictedX) > arena.width / 2 - tank.size ||
                   Math.abs(predictedY) > arena.height / 2 - tank.size;
        framesUntilWallCollision++;
        
        // Safety break if position calculations go NaN
        if (isNaN(predictedX) || isNaN(predictedY)) {
            framesUntilWallCollision = 1;
            break;
        }
    }


    // Calculate distances to each wall (already declared above)
    wallDistance = Infinity;
    wallAngle = 0;
    // leftWallDistance, rightWallDistance, topWallDistance, bottomWallDistance already declared above

    // Determine the nearest wall and the angle to it
    if (leftWallDistance < wallDistance) {
        wallDistance = leftWallDistance;
        wallAngle = 180;
    }
    if (rightWallDistance < wallDistance) {
        wallDistance = rightWallDistance;
        wallAngle = 0
    }
    if (topWallDistance < wallDistance) {
        wallDistance = topWallDistance;
        wallAngle = -90;
    }
    if (bottomWallDistance < wallDistance) {
        wallDistance = bottomWallDistance;
        wallAngle = 90;
    }

    // Calculate state for Q-table
    const wallState = getWallQState(wallDistance, tank.angleDifference(tank.bodyAim, wallAngle));
    // Pick best action for this state
    let wallQ = saved.wallQ[wallState] || Array(WALL_ACTIONS.length).fill(0);
    let wallActionIdx = wallQ.indexOf(Math.max(...wallQ));
    if (Math.random() < 0.1) wallActionIdx = Math.floor(Math.random() * WALL_ACTIONS.length); // epsilon-greedy
    const wallAction = WALL_ACTIONS[wallActionIdx];

    // Apply ML wall avoidance if near wall
    if (tank.isNearWall) {
        tank.speed = (1 - wallAction.slowDown) + (wallAction.slowDown * (wallDistance / wallProximityThreshold));
        tank.savedWallActionIdx = wallActionIdx;
        tank.savedWallState = wallState;
    }
    
    // Update fired missile information
    if (saved.lastMissileId) {
        const missile = tank.missiles[saved.lastMissileId];
        saved.firedMissiles.push(missile);
        saved.lastMissileId = false;
    }


    // Update targets information
    saved.maxTargetEnergy = 0;
    if (tank.detectedTanks.length > 0) {
        tank.detectedTanks.forEach((detected) => {
            saved.targets[detected.index] = detected;
            saved.targets[detected.index].iteration = tank.iteration;
            if (detected.energy > saved.maxTargetEnergy) {
                saved.maxTargetEnergy = detected.energy;
            }
        });
    }
    
    
    // Remove dead targets
    const deadTargetsExist = () => Object.keys(saved.targets).length > arena.tanksRemaining - 1;
    // --- Add safety checks for infinite loops ---
    const MAX_DEAD_TARGET_ITERATIONS = 10;
    let deadTargetIterations = 0;
    while (deadTargetsExist() && deadTargetIterations < MAX_DEAD_TARGET_ITERATIONS) {
        let removalIndex = longestAbscence = -1;
        for (const targetIndex of Object.keys(saved.targets)) {
            const target = saved.targets[targetIndex];
            const abscenseTime = tank.iteration - target.iteration;
            if (abscenseTime > longestAbscence) {
                removalIndex = targetIndex;
                longestAbscence = abscenseTime;
            }
        }
        delete saved.targets[removalIndex];
        deadTargetIterations++;
    }

    // Low energy mode
    if (tank.energy < LOW_ENERGY_THRESHOLD) {
        tank.energyLow = true;
        let energyFactor =  tank.energy / LOW_ENERGY_THRESHOLD;
        let direction =  Math.sign(tank.speed)
        let desiredSpeed = 0.5 + 0.5 * energyFactor * direction;
        if (Math.abs(tank.speed) > Math.abs(desiredSpeed)) {
            tank.speed = desiredSpeed;
        }
    }
    
    // Wander around the arena (default action)
    const wanderSeed = 0.3 + Math.random() * 0.4;
    saved.wanderPatterns = [
        Math.cos(tank.iteration / 10) * wanderSeed + Math.sin(tank.iteration / 33) * (1 - wanderSeed),
        Math.sin(tank.iteration / 11) * wanderSeed + Math.cos(tank.iteration / 32) * (1 - wanderSeed),
        Math.cos(tank.iteration / 12) * wanderSeed + Math.sin(tank.iteration / 31) * (1 - wanderSeed),
        Math.sin(tank.iteration / 13) * wanderSeed + Math.cos(tank.iteration / 30) * (1 - wanderSeed),
    ];
    const patternChanger = (15 + tank.index) + ~~(Math.random() * 15 + (1 - tank.index));
    if ((tank.iteration + tank.index) % patternChanger === 0) {
        saved.wanderPattern = ~~(Math.random() * saved.wanderPatterns.length);
        // Go straight half of the time
        if (Math.random() > 0.5) {
            saved.wanderPattern = 0;
        }
    }
    tank.bodyTurn = saved.wanderPatterns[saved.wanderPattern];


    // Handle detected tanks
    if (tank.detectedTanks.length > 0) {

        // Reset radar scan
        saved.scanSpeed = 1;
        saved.scanDirection = 0;
        saved.scanRotation = 0;

        // Save primary target
        tank.detectedTanks = tank.detectedTanks.sort((a, b) => { return tank.getTargetPriority(a) - tank.getTargetPriority(b) });
        let target = tank.detectedTanks[0];
        saved.target = { ...target };

        // Set a victory message (in case target is destroyed)
        const taunts = [
            "🖕",
            "I win!",
            "Ur dead.",
            "Get rekt.",
            `Fuck u, ${target.name}!`,
        ];
        tank.victoryMessage = taunts[~~(Math.random() * taunts.length)];

        // Conserve energy
        const targetsFarEnough = target.distance > arena.width / 4;
        const targetsGunIsCoolEnough = target.gunHeat < target.distance / 80;
        const shouldConserveEnergy = target.energy * 3 > tank.energy;
        if (shouldConserveEnergy && targetsFarEnough && targetsGunIsCoolEnough) {
            tank.speed = 0;
        }

        // Store and average previous target data for velocity
        saved.previousTargetData.push({ x: target.x, y: target.y, angle: target.bodyAim, time: tank.iteration });
        if (saved.previousTargetData.length > 5) {
            saved.previousTargetData.shift();
        }

        // --- Optimize target velocity calculation ---
        let avgVelocityX = 0, avgVelocityY = 0;
        const MAX_HISTORY = 3; // Reduced from 5 to limit data processing
        if (tank.detectedTanks.length > 0) {
            // Calculate average velocity over the stored history
            let totalDeltaTime = 0;
            for (let i = 1; i < saved.previousTargetData.length; i++) {
                const last = saved.previousTargetData[i];
                const prev = saved.previousTargetData[i - 1];
                const deltaTime = last.time - prev.time;
                avgVelocityX += (last.x - prev.x);
                avgVelocityY += (last.y - prev.y);
                totalDeltaTime += deltaTime;
            }
            avgVelocityX /= Math.max(1, totalDeltaTime); // Avoid division by zero
            avgVelocityY /= Math.max(1, totalDeltaTime);
        }
        else {
            avgVelocityX = target.actualSpeed * Math.cos(target.bodyAim * DEGREES);
            avgVelocityY = target.actualSpeed * Math.sin(target.bodyAim * DEGREES);
        }

        // Calculate missile intercept time
        let timeToIntercept = target.distance / MISSILE_SPEED;
        const baseIterations = 5;
        const velocityFactor = Math.abs(target.speed);
        const distanceFactor = target.distance / arena.width;
        const additionalIterations = (velocityFactor + distanceFactor) * baseIterations;
        const interceptCalculationIterations = MAX_INTERCEPT_ITERATIONS;
        for (let i = 0; i < interceptCalculationIterations; i++) {
            const predictedTargetX = target.x + avgVelocityX * timeToIntercept;
            const predictedTargetY = target.y + avgVelocityY * timeToIntercept;
            timeToIntercept = tank.distanceTo(predictedTargetX, predictedTargetY) / MISSILE_SPEED;
        }

        // Calculate final predicted target position
        let predictedTargetX = target.x + avgVelocityX * timeToIntercept;
        let predictedTargetY = target.y + avgVelocityY * timeToIntercept;

        // Turn gun to the desired angle
        tank.gunTurn = tank.calculateGunTurn(predictedTargetX, predictedTargetY);

        // Calculate firing conditions
        const aimAccuracyThreshold = 5;
        const predictedTargetAngle = tank.angleTo(predictedTargetX, predictedTargetY);
        const gunAngleDifference = tank.angleDifference(tank.bodyAim + tank.gunAim, predictedTargetAngle);
        const aimError = Math.abs(gunAngleDifference);
        const distanceOverArena = target.distance / arena.width;
        const distanceOverMax = target.distance / MAX_DISTANCE;
        const aimErrorThreshold = aimAccuracyThreshold * (1 - distanceOverArena);
        const perpendicularSpeedComponent = Math.abs(tank.perpendicularSpeedComponent(target));
        const historicAccuracy = tank.aimAccuracy || 0.5;
        const probabilityOfHit = (
            (1 - aimError / aimErrorThreshold) *
            (1 - distanceOverMax) *
            (1 - perpendicularSpeedComponent)
        );

        // --- ML Targeting Q-table (define variables before use) ---
        // Calculate state for Q-table
        const targetState = getTargetQState(target.distance, target.speed, gunAngleDifference);
        let targetQ = saved.targetQ[targetState] || Array(TARGET_ACTIONS.length).fill(0);
        // Find max value and its index in one pass
        let targetActionIdx = 0, maxQ = targetQ[0];
        for (let i = 1; i < targetQ.length; i++) {
            if (targetQ[i] > maxQ) {
                maxQ = targetQ[i];
                targetActionIdx = i;
            }
        }
        if (Math.random() < 0.1) targetActionIdx = Math.floor(Math.random() * TARGET_ACTIONS.length); // epsilon-greedy
        const firePowerML = TARGET_ACTIONS[targetActionIdx];

        if (aimError < aimErrorThreshold) {
            const minFirePower = 5;
            let firePower = firePowerML;
            
            // Severely restrict firing when critically low on energy
            if (tank.energy < EMERGENCY_RECHARGE_THRESHOLD) {
                firePower = 0;  // Don't fire at all
            } else if (tank.energy < CRITICAL_ENERGY_THRESHOLD) {
                firePower = Math.min(firePower, 10);
                // Only fire if target is very close and threatening
                if (target.distance > arena.width / 6) {
                    firePower = 0;
                }
            }
            
            // Only fire if we have enough energy cushion
            const energyCost = firePower * MISSILE_ENERGY_MULTIPLIER;
            const safeToFire = tank.energy > energyCost * 2;
            
            if (safeToFire && firePower > minFirePower) {
                saved.lastMissileId = tank.fire(firePower);
                tank.savedTargetActionIdx = targetActionIdx;
                tank.savedTargetState = targetState;
            }
        }
    }
    
    // If no tank is detected
    else {
        
        // Calculate scan direction
        if (!saved.scanDirection) {
            let aimAtX = saved?.target?.x || 0;
            let aimAtY = saved?.target?.y || 0;
            const desiredGunTurn = tank.calculateGunTurn(aimAtX, aimAtY);
            const randomDirection = 1 - Math.round(Math.random() * 2);
            saved.scanDirection = Math.sign(desiredGunTurn) || randomDirection;
        }
        
        // Calculate scan speed and turn gun (radar will follow gun)
        const rotationAmount = saved.scanDirection * saved.scanSpeed;
        tank.gunTurn = saved.scanDirection * saved.scanSpeed;
        saved.scanRotation += Math.abs(rotationAmount * MAX_GUN_TURN_DEGREES);
        const fullRotations = ~~(saved.scanRotation / 360);
        const slowDownRate = Math.min(4, fullRotations) / 4;
        saved.scanSpeed = 1 - 0.5 * slowDownRate;
        if (fullRotations === 5) {
            saved.scanRotation = 0;
            saved.scanDirection *= -1;
        }
    }


    // Wall avoidance logic
    if (tank.isNearWall) {
        
        // Learn from wall collisions
        if (LEARNING_ENABLED && tank.wallCollision) {
            if (saved.wallAvoidance.slowDown > saved.wallAvoidance.largestUnsafe.slowDown) {
                saved.wallAvoidance.largestUnsafe.slowDown = saved.wallAvoidance.slowDown;
            }
            if (saved.wallAvoidance.threshold > saved.wallAvoidance.largestUnsafe.threshold) {
                saved.wallAvoidance.largestUnsafe.threshold = saved.wallAvoidance.threshold;
            }
            saved.wallCollisions++;
            saved.wallAvoidance.collisions++;
            saved.wallAvoidance.adjustmentCount++;
            saved.wallAvoidance.rewardsNegative++;
            saved.wallAvoidance.adjustmentAmount += saved.wallAvoidance.learningRate;
            saved.wallAvoidance.slowDown *= (1 + saved.wallAvoidance.learningRate);
            saved.wallAvoidance.threshold *= (1 + saved.wallAvoidance.learningRate);
            saved.wallAvoidance.matchesSinceCollisionBest = saved.wallAvoidance.matchesSinceCollisionCurrent;
            saved.wallAvoidance.matchesSinceCollisionCurrent = 0;
            tank.commitMemory("wallAvoidance", saved.wallAvoidance);
        }

        // Slow down for better handling
        const wallOffset = Math.abs(tank.angleDifference(tank.bodyAim, wallAngle));
        const directionFactor =  1 - (wallOffset / 90);
        const distanceFactor = wallDistance / wallProximityThreshold;
        const slowDownFactor = saved.wallAvoidance.slowDown * directionFactor;
        tank.speed =  (1 - slowDownFactor) + (slowDownFactor * distanceFactor);

        // If collision is likely slow down even more
        if (framesUntilWallCollision < 15) {
            tank.speed /= 16 - framesUntilWallCollision;
        }
        
        // If collision is imminent then stop
        if (framesUntilWallCollision === 1) {
            tank.speed = 0;
        }

        // Turn away fom the wall
        const angleToCenter = tank.angleTo(0, 0);
        let bodyAngleDifference = tank.angleDifference(tank.bodyAim, angleToCenter);
        tank.bodyTurn = bodyAngleDifference / 180;

        // Always take the shortest turn path
        if (Math.abs(bodyAngleDifference) > 180) {
            tank.speed *= -1;
            tank.bodyTurn *= -1;
        }

    }


    // Distance from wall is safe
    else {

        // Handle detected missiles
        if (tank.detectedMissiles.length > 0) {
            saved.underRapidFire = Math.max(0, tank.detectedMissiles.length - 1) * COLLISION_COOLDOWN_TIME;
            tank.detectedMissiles = tank.detectedMissiles.sort((a, b) => { return tank.getMissilePriority(b) - tank.getMissilePriority(a) });
            const missile = tank.detectedMissiles[0];
            const perfectTrajectory = tank.angleFrom(missile.x, missile.y);
            const trajectoryDifference = tank.angleDifference(perfectTrajectory, missile.aim);
            const aimError = Math.abs(trajectoryDifference);
            const timeToImpactEstimate = missile.distance / missile.actualSpeed;
            const interceptionAimThreshold = 3 + 3 * missile.distance / MAX_DISTANCE;
            const threatAngle = (saved.target?.angleTo) || missile.angleTo;
            // Move out of missiles path
            const evasionExceptions = saved.missileEvasionReverse || tank.isNearWall;
            if (aimError < interceptionAimThreshold && !evasionExceptions) {
                saved.missileEvasion = COLLISION_COOLDOWN_TIME;
                tank.bodyTurn = tank.angleDifference(tank.bodyAim, threatAngle + 90) / 10;
                tank.speed = 1;
                if (trajectoryDifference < 0) {
                    tank.speed *= -1;
                    saved.missileEvasionReverse = ~~(missile.distance / missile.speed);
                }
            }
            // Conserve energy if safe
            else if (arena.tanksRemaining === 2 && saved.target?.gunHeat > 10) {
                if (saved.collisionCoolDown || saved.underRapidFire) {
                    tank.speed = Math.sign(tank.speed) || 1;
                }
                else {
                    if (!saved.missileEvasion) {
                        tank.speed = 0;
                    }
                }
            }
            
            // Calculate the threat level of all detected missiles
            saved.missileThreat = tank.detectedMissiles.reduce((sum, nissile) => { return sum + missile.energy });
            if (saved.missileThreat > tank.energy) {
                tank.bodyColor = "#ff0000";
            }
        }
        
        // If no missiles are detected
        else {
            saved.missileEvasion = 0;
            if (saved.underRapidFire > 0) {
                saved.underRapidFire--;
            }
            saved.missileEvasionReverse = 0;
            if (!saved.isUnderRapidFire && saved.target?.gunHeat > 1) {
                tank.speed = 0;
            }
            else {
                tank.speed = 1;
            }
            saved.missileThreat = 0;
        }


        // Handle missile and tank collisions
        const collision = tank.tankCollision || tank.missileCollision;
        if (collision) {
            saved.collisionAngle = collision.angle;
            saved.collisionDamage = collision.damage;
            saved.collisionCoolDown = COLLISION_COOLDOWN_TIME;
        }
        const collisionIsBiggestThreat = saved.collisionDamage > saved.missileThreat;
        if (saved.collisionCoolDown && collisionIsBiggestThreat && arena.tanksRemaining > 2) {
            const desiredGunTurn = tank.angleDifference(tank.bodyAim + tank.gunAim, saved.collisionAngle);
            tank.gunTurn = desiredGunTurn / 10;
        }
        if (tank.isNearWall && saved.collisionCoolDown && !saved.underRapidFire) {
            const directionDifference = tank.angleDifference(tank.bodyAim, saved.collisionAngle + 90);
            tank.bodyTurn = directionDifference / 10;
            tank.speed = saved.collisionCoolDown / COLLISION_COOLDOWN_TIME;
            if (Math.abs(saved.collisionAngle) > 90) {
                tank.bodyTurn *= -tank.bodyTurn;
                tank.speed *= -1;
            }
        }
    
    
        // Orient tanks body perpendicular to target for missile evasion
        if (saved.target && !tank.isNearWall) {
            const angleDifference = tank.angleDifference(tank.bodyAim, saved.target.angleTo + 90);
            tank.bodyTurn = angleDifference / 180;
        }
    
    }

    // Handle cool downs
    if (saved.missileEvasion) {
        saved.missileEvasion = Math.max(0, saved.missileEvasion - 1);
    }
    if (saved.missileEvasionReverse > 0) {
        saved.missileEvasionReverse = Math.max(0, saved.missileEvasionReverse - 1);
    }
    if (saved.collisionCoolDown) {
        saved.collisionCoolDown = Math.max(0, saved.collisionCoolDown - 1);
    }


    // Correct gun turn for steering changes
    tank.gunTurn -= tank.bodyTurn;
    
    // Learn from successful wall avoidance
    if (LEARNING_ENABLED && arena.tanksRemaining === 1 && !saved.wallCollisions && !saved.learningSaved) {
        saved.learningSaved = true;
        if (saved.wallAvoidance.matchesSinceCollisionCurrent > saved.wallAvoidance.matchesSinceCollisionBest) {
            saved.wallAvoidance.matchesSinceCollisionBest = saved.wallAvoidance.matchesSinceCollisionCurrent;
        }
        saved.wallAvoidance.trainingIteration++;
        saved.wallAvoidance.adjustmentMatchCurrent++;
        saved.wallAvoidance.matchesSinceCollisionCurrent++;
        tank.commitMemory("wallAvoidance", saved.wallAvoidance);
        let current = saved.wallAvoidance.adjustmentMatchCurrent;
        let best = saved.wallAvoidance.adjustmentMatchTarget;
        if (current >= best * 1.05) {
            const nextSlowDown = saved.wallAvoidance.slowDown * (1 - saved.wallAvoidance.learningDecay);
            const nextThreshold = saved.wallAvoidance.Threshold * (1 - saved.wallAvoidance.learningDecay);
            if (nextSlowDown > saved.wallAvoidance.largestUnsafe.slowDown && nextThreshold > saved.wallAvoidance.largestUnsafe.threshold) {
                saved.wallAvoidance.rewardsPositive++;
                saved.wallAvoidance.adjustmentCount++;
                saved.wallAvoidance.adjustmentMatchCurrent = 0;
                saved.wallAvoidance.adjustmentMatchTarget = current;
                saved.wallAvoidance.adjustmentAmount -= saved.wallAvoidance.learningDecay;
                saved.wallAvoidance.slowDown = nextSlowDown;
                saved.wallAvoidance.threshold = nextThreshold;
                tank.commitMemory("wallAvoidance", saved.wallAvoidance);
            }
        }
    }


    // Color tank
    const colorTankPart = (amount) => {
        const r = Math.round((1 - amount) * 255);
        return r.toString(16).padStart(2, 0);
    }

    // Make fill color indicate when actively recharging
    const energyGrade = Math.min(1, tank.energy / 1000);
    const isRecharging = Math.abs(tank.speed) === 0;
    tank.fillColor = isRecharging ? "#00FF00" : tank.getRandomColor(); // Random fill color

    // Tread color based on movement
    tank.treadColor = tank.speed === 0 ? tank.getRandomColor() : tank.getRandomColor();

    // Gun color based on heat
    tank.gunColor = tank.gunHeat === 0 ? tank.getRandomColor() : tank.getRandomColor();

    // Radar color based on detection
    tank.radarColor = (tank.detectedTanks > 9 || tank.detectedMissiles.length > 0) ?
        tank.getRandomColor() : tank.getRandomColor();

    // Change body color when threatened by missiles
    if (saved.missileThreat > tank.energy) {
        tank.bodyColor = tank.getRandomColor();
    }


    // This function must return the tank object
    return tank;

    
}
