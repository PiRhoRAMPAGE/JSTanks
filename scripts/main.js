let gameOver = false;
let iteration = 0;
let tanks = [];
let arena = {};
let winCounts = [0, 0];
let powerupsSpawned = 0;
let powerupsCollected = [0, 0];
let powerupsCollectedPercentage = [0, 0];
let scores = [0, 0];
let scoreData = {};
let winsData = {};
let scorePercentage = {};
let scorePercentageDif = {};
let winPercentage = {};
let gameCount = 0;
let winBalance = {};
let missilesFired = [0, 0];
let missilesHit = [0, 0];
let tankCollisions = [0, 0];
let missileCollisions = [0, 0];
let wallCollisions = [0, 0];
let accuracy = {};
let accuracyPercentageDif = {};
let energy = [0, 0];
let avgEnergy = {};
let avgEnergyDif = {};
let totalGameDuration = 0;
let gameTimeInSeconds = 0;
let lastTime = 0;
let gameLooper = null;
let leaderboard = getMemory(GLOBAL_STORAGE_KEY) || {};


const background = document.getElementById("bgImage");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
canvas.width = ARENA_WIDTH;
canvas.height = ARENA_HEIGHT;
selTankA.focus();

document.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && divTanks.style.display !== "none") {
        let confirmed = true;
        if (getSelectedTankA() === getSelectedTankB()) {
            confirmed = confirm("Stats will be unavailable if you battle a tank against itself.");
        }
        if (confirmed) {
            divTanks.style.display = "none";
            startGame();
        }
    }
});


function startGame() {
    if (gameLooper) clearTimeout(gameLooper);
    canvas.focus();
    gameLooper = null;
    restart = true;
    gameOver = false;
    iteration = 0;
    tanks = [];
    arena = {};
    winCounts = [0, 0];
    powerupsSpawned = 0;
    powerupsCollected = [0, 0];
    powerupsCollectedPercentage = [0, 0];
    scores = [0, 0];
    scoreData = {};
    winsData = {};
    scorePercentage = {};
    scorePercentageDif = {};
    winPercentage = {};
    gameCount = 0;
    winBalance = {};
    missilesFired = [0, 0];
    missilesHit = [0, 0];
    tankCollisions = [0, 0];
    missileCollisions = [0, 0];
    wallCollisions = [0, 0];
    accuracy = {};
    accuracyPercentageDif = {};
    energy = [0, 0];
    avgEnergy = {};
    avgEnergyDif = {};
    totalGameDuration = 0;
    gameTimeInSeconds = 0;
    lastTime = 0;
    gameLoop();
}

function newGame() {
    iteration = 0;
    tanks = [];
    arena = {};
    gameOver = false;
    gameCount++;

    const distance = (Math.min(canvas.width, canvas.height) / 2) * 0.7;
    let angle = Math.random() * 360;

    // Define tanks
    let x = distance * Math.cos(angle * Math.PI / 180);
    let y = distance * Math.sin(angle * Math.PI / 180);
    // Use the selected tank A AI
    const tankAFunction = typeof getSelectedTankA === "function" ? getSelectedTankA() : tankAMain;
    tanks[0] = new Tank(tankAFunction, 0, x, y, getRandomColorHex());

    x = distance * Math.cos(180 + angle * Math.PI / 180);
    y = distance * Math.sin(180 + angle * Math.PI / 180);
    // Use the selected tank B AI
    const tankBFunction = typeof getSelectedTankB === "function" ? getSelectedTankB() : tankBMain;
    tanks[1] = new Tank(tankBFunction, 1, x, y, getRandomColorHex());

    // Randomize tank order to eliminate positional advantages
    tanks = tanks.sort(() => Math.random() - 0.5);

    // Define the arena
    arena = {
        time: 0,
        width: canvas.width,
        height: canvas.height,
        tanks: tanks,
        missiles: [],
        powerups: [],
        powerupsSpawned: 0,
    }
}


document.addEventListener("DOMContentLoaded", () => {
    gamepad.initialize();
});

function gameLoop() {
    lastTime = 0;
    newGame(); // Initialize the first game
    animate(0); // Start the animation loop
}

function animate(currentTime) {
    gameLooper = setTimeout(() => {
        // I would prefer to use requestAnimationFrame, but for some reason it was causing issues
        animate(Date.now());
    }, 1000 / fps);


    let gameSpeed;
    const speedValue = document.getElementById("selSpeed").value;
    if (speedValue < 0) {
        fps = 60 / (1 + Math.abs(speedValue));
        gameSpeed = 1;
    }
    else {
        fps = 60;
        gameSpeed = speedValue;
    }

    const deltaTime = (currentTime - lastTime) / 1000;
    lastTime = currentTime;
    const frameDuration = 1 / fps;

    if (deltaTime < frameDuration) {
        return;
    }

    if (paused) {
        ctx.fillStyle = "#000000";
        ctx.strokeStyle = "#ffffff";
        ctx.fillRect(0, 0, arena.width, arena.height);
        ctx.strokeRect(0, 0, arena.width, arena.height);
        ctx.save();
        ctx.translate(0, 0);
        ctx.font = "32px 'Press start 2P'";
        ctx.fillStyle = `#ffffff`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("Paused", arena.width / 2, arena.height / 2 - 16);
        ctx.font = "14px 'Press start 2P'";
        ctx.fillText(`Press "0" to resume`, arena.width / 2, arena.height / 2 + 5);
        ctx.restore();
        return;
    }

    if ((stepMode && !stepNextFrame)) return;
    stepNextFrame = !stepMode;

    if (!showAnimation.checked && !paused) gameSpeed = MAX_ITERATIONS;

    for (let i = 0; i < gameSpeed; i++) {
        // Update gamepad states
        gamepad.update();

        if (powerupsEnabled.checked && Math.random() < SPAWN_POWERUP_PROBABILITY) {
            spawnPowerup();
        }
        arena.powerupsSpawned = powerupsSpawned;

        // Clear the canvas
        if (showAnimation.checked) ctx.drawImage(background, 0, 0, arena.width, arena.height);

        // Show stats
        if (showAnimation.checked) {
            const players = tanks.sort((a, b) => { return a.index - b.index });
            const p1 = players[0];
            const p2 = players[1];
            const energyBarWidth = 163;
            try {

                // Show timer
                ctx.save();
                ctx.translate(0, 0);
                ctx.font = "12px 'Press start 2P'";
                ctx.strokeStyle = "#000000";
                ctx.lineWidth = 1;
                ctx.fillStyle = `#ffffff`;
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.strokeText(iteration, arena.width / 2, 10);
                ctx.fillText(iteration, arena.width / 2, 10);
                ctx.restore();

                // Show tank A energy
                let energyWidth = Math.min(1000, p1.energy) / MAX_TANK_ENERGY;
                ctx.fillStyle = p1.color;
                ctx.fillRect(6, 3, energyBarWidth * energyWidth, 10);
                ctx.strokeStyle = "#ffffff";
                ctx.strokeRect(6, 3, energyBarWidth, 10);

                // Show tank A name
                ctx.font = "8px 'Press start 2P'";
                ctx.strokeStyle = "#000000";
                ctx.lineWidth = 0.7;
                ctx.fillStyle = "#ffffff";
                ctx.textAlign = "left";
                ctx.textBaseline = "middle";
                ctx.strokeText(p1.name, 8, 8);
                ctx.fillText(p1.name, 8, 8);

                // Show tank A score
                let pickup = (p1.powerup.amount) > 0 ? p1.powerup.symbol : "";
                ctx.font = "7px 'Press start 2P'";
                ctx.strokeStyle = "#000000";
                ctx.lineWidth = 1;
                ctx.fillStyle = "#ffffff";
                ctx.strokeText(`${~~scores[p1.index] + ~~p1.matchScore}`, 6, 19);
                ctx.fillText(`${~~scores[p1.index] + ~~p1.matchScore} ${pickup}`, 6, 19);

                // Show tank A wins
                ctx.textAlign = "right";
                ctx.strokeStyle = "#000000";
                ctx.lineWidth = 1;
                ctx.strokeText(`${winCounts[p1.index]}`, energyBarWidth + 6, 19);
                ctx.fillText(`${winCounts[p1.index]}`, energyBarWidth + 6, 19);
                ctx.restore();


                // Show tank B energy
                energyWidth = Math.min(1000, p2.energy) / MAX_TANK_ENERGY;
                ctx.fillStyle = p2.color;
                ctx.fillRect(arena.width - 6 - energyBarWidth * energyWidth, 3, energyBarWidth * energyWidth, 10);
                ctx.strokeStyle = "#ffffff";
                ctx.strokeRect(arena.width - 6 - energyBarWidth, 3, energyBarWidth, 10);


                // Show tank B name
                ctx.save();
                ctx.font = "8px 'Press start 2P'";
                ctx.strokeStyle = "#000000";
                ctx.lineWidth = 0.7;
                ctx.fillStyle = "#ffffff";
                ctx.textAlign = "right";
                ctx.textBaseline = "middle";
                ctx.strokeText(p2.name, arena.width - 8, 8);
                ctx.fillText(p2.name, arena.width - 8, 8);

                // Show tank B score
                pickup = (p2.powerup.amount) > 0 ? p2.powerup.symbol : "";
                ctx.font = "7px 'Press start 2P'";
                ctx.strokeStyle = "#000000";
                ctx.lineWidth = 1;
                ctx.fillStyle = "#ffffff";
                ctx.strokeText(`${~~scores[p2.index] + ~~p2.matchScore}`, arena.width - 6, 19);
                ctx.fillText(`${pickup} ${~~scores[p2.index] + ~~p2.matchScore}`, arena.width - 6, 19);

                // Show tank B wins
                ctx.textAlign = "left";
                ctx.strokeStyle = "#000000";
                ctx.lineWidth = 1;
                ctx.strokeText(`${winCounts[p2.index]}`, arena.width - energyBarWidth - 6, 19);
                ctx.fillText(`${winCounts[p2.index]}`, arena.width - energyBarWidth - 6, 19);
                ctx.restore();

            } catch (e) { console.error(e) }
        }

        arena.gameCount = gameCount;
        arena.tanksRemaining = arena.tanks.length;
        arena.missileInterception = allowBlocking.checked;

        arena.powerups = arena.powerups.filter((powerup) => {
            if (showAnimation.checked && powerup.draw) powerup.draw(ctx, arena);
            return powerup.state !== "dead";
        });

        arena.missiles = arena.missiles.filter((missile) => {
            missile.update(ctx, arena);
            if (showAnimation.checked) missile.draw(ctx, arena);
            return missile.state !== "dead";
        });

        arena.tanks = arena.tanks.filter((tank) => {
            for (let tSpeed = 0; tSpeed < tank.speedMultiplier; tSpeed++) {
                tank.update(ctx, arena);
            }
            if (showAnimation.checked) tank.draw(ctx);
            return tank.state !== "dead";
        });

        // Game over
        if (iteration === MAX_ITERATIONS) {
            let winner = { name: "Draw" };
            if (tanks[0].energy > tanks[1].energy) {
                winner = tanks[0];
            }
            else if (tanks[1].energy > tanks[0].energy) {
                winner = tanks[1];
            }
            if (winner.index || winner.index === 0) {
                winCounts[winner.index]++;
                const energyBonus = ~~Math.max(0, winner.energy * SURVIVAL_BONUS_POINTS);
                const accuracyBonus = ~~Math.max(0, winner.accuracy * ACCURACY_BONUS_POINTS);
                scores[winner.index] += energyBonus + accuracyBonus;
            }
            logGameData(winner);
            tanks[0].state = "dead";
            tanks[1].state = "dead";
        }
        if (arena.tanks.length === 0 && !gameOver) {
            let winner = { name: "Draw" };
            logGameData(winner);
            newGame();
        }
        if (arena.tanks.length < 2 && !gameOver) {
            gameOver = true;
            const winner = arena.tanks[0];
            if (!winCounts[winner.index]) {
                winCounts[winner.index] = 0;
            }
            winner.message = winner.victoryMessage;
            winner.showMessage = 50;
            winCounts[winner.index]++;
            const energyBonus = ~~Math.max(0, winner.energy * SURVIVAL_BONUS_POINTS);
            const accuracyBonus = ~~Math.max(0, winner.accuracy * ACCURACY_BONUS_POINTS);
            scores[winner.index] += energyBonus + accuracyBonus;
            logGameData(winner);
            if (gameSpeed < 100) {
                setTimeout(newGame, 1000 / gameSpeed);
            }
            else {
                newGame();
            }
        }

        // Increment iteration
        if (!gameOver) {
            iteration++;
        }
        else {
            break;
        }
    }
}


function logGameData(winner) {
    // Don't log stats if the tanks are the same or itll prolly fuck shit up
    if (tanks[0].name === tanks[1].name) {
        return;
    }
    tanks = tanks.sort((a, b) => a.index - b.index);
    energy[0] += tanks[0].energy;
    energy[1] += tanks[1].energy;
    powerupsCollected[0] += tanks[0].powerupsCollected;
    powerupsCollected[1] += tanks[1].powerupsCollected;
    if (powerupsSpawned > 0) {
        powerupsCollectedPercentage[0] = Math.round((powerupsCollected[0] / powerupsSpawned) * 10000) / 100;
        powerupsCollectedPercentage[1] = Math.round((powerupsCollected[1] / powerupsSpawned) * 10000) / 100;
    }
    else {
        powerupsCollectedPercentage[0] = 0;
        powerupsCollectedPercentage[1] = 0;
    }
    tankCollisions[0] += tanks[0].tankCollisions;
    tankCollisions[1] += tanks[1].tankCollisions;
    wallCollisions[0] += tanks[0].wallCollisions;
    wallCollisions[1] += tanks[1].wallCollisions;
    missileCollisions[0] += tanks[0].missileCollisions;
    missileCollisions[1] += tanks[1].missileCollisions;
    avgEnergy[tanks[0].name] = ~~(energy[0] / gameCount);
    avgEnergy[tanks[1].name] = ~~(energy[1] / gameCount);
    avgEnergyDif[tanks[0].name] = avgEnergy[tanks[0].name] - avgEnergy[tanks[1].name];
    avgEnergyDif[tanks[1].name] = avgEnergy[tanks[1].name] - avgEnergy[tanks[0].name];
    scores[0] += tanks[0].matchScore;
    scores[1] += tanks[1].matchScore;
    scoreData[tanks[0].name] = scores[0];
    scoreData[tanks[1].name] = scores[1];
    scorePercentage[tanks[0].name] = ~~(scores[0] / (scores[0] + scores[1]) * 10000) / 100;
    scorePercentage[tanks[1].name] = ~~(scores[1] / (scores[0] + scores[1]) * 10000) / 100;
    scorePercentageDif[tanks[0].name] = ~~((scorePercentage[tanks[0].name] - scorePercentage[tanks[1].name]) * 100) / 100;
    scorePercentageDif[tanks[1].name] = ~~((scorePercentage[tanks[1].name] - scorePercentage[tanks[0].name]) * 100) / 100;
    winsData[tanks[0].name] = winCounts[0];
    winsData[tanks[1].name] = winCounts[1];
    winPercentage[tanks[0].name] = ~~((winCounts[0] / gameCount) * 10000) / 100;
    winPercentage[tanks[1].name] = ~~((winCounts[1] / gameCount) * 10000) / 100;
    winBalance[tanks[0].name] = ~~((winPercentage[tanks[0].name] - winPercentage[tanks[1].name]) * 100) / 100;
    winBalance[tanks[1].name] = ~~((winPercentage[tanks[1].name] - winPercentage[tanks[0].name]) * 100) / 100;
    missilesHit[0] += tanks[0].missilesHit;
    missilesHit[1] += tanks[1].missilesHit;
    missilesFired[0] += tanks[0].missilesFired;
    missilesFired[1] += tanks[1].missilesFired;
    accuracy[tanks[0].name] = ~~((missilesHit[0] / missilesFired[0]) * 10000) / 100;
    accuracy[tanks[1].name] = ~~((missilesHit[1] / missilesFired[1]) * 10000) / 100;
    accuracyPercentageDif[tanks[0].name] = ~~((accuracy[tanks[0].name] - accuracy[tanks[1].name]) * 100) / 100;
    accuracyPercentageDif[tanks[1].name] = ~~((accuracy[tanks[1].name] - accuracy[tanks[0].name]) * 100) / 100;
    totalGameDuration += iteration;

    tanks[0].elo = tanks[0]?.elo || leaderboard[tanks[0].name]?.elo || 1500;
    tanks[1].elo = tanks[1]?.elo || leaderboard[tanks[1].name]?.elo || 1500;
    const elos = calculateElos(tanks[0], tanks[1], winner);
    tanks[0].elo = elos.a;
    tanks[1].elo = elos.b;

    if (winner.name !== "Draw") {
        updateLeaderboard(winner, tanks);
    }

    const shouldUpdate = gameCount % 100 === 0;
    if (!showAnimation.checked && !shouldUpdate) return;

    const matchStats = [
        {
            "Statistic": "Wins",
            ...{ [tanks[0].name]: winsData[tanks[0].name] },
            ...{ [tanks[1].name]: winsData[tanks[1].name] },
            "Difference": Math.abs(winsData[tanks[0].name] - winsData[tanks[1].name]),
        },
        {
            "Statistic": "Win %",
            ...{ [tanks[0].name]: winPercentage[tanks[0].name] },
            ...{ [tanks[1].name]: winPercentage[tanks[1].name] },
            "Difference": ~~(Math.abs(winPercentage[tanks[0].name] - winPercentage[tanks[1].name]) * 100) / 100,
        },
        {
            "Statistic": "Elo",
            ...{ [tanks[0].name]: Math.round(tanks[0].elo) },
            ...{ [tanks[1].name]: Math.round(tanks[1].elo) },
            "Difference": Math.abs(Math.round(tanks[0].elo - tanks[1].elo)),
        },
        {
            "Statistic": "Score",
            ...{ [tanks[0].name]: ~~scoreData[tanks[0].name] },
            ...{ [tanks[1].name]: ~~scoreData[tanks[1].name] },
            "Difference": ~~Math.abs(scoreData[tanks[0].name] - scoreData[tanks[1].name]),
        },
        {
            "Statistic": "Score %",
            ...{ [tanks[0].name]: scorePercentage[tanks[0].name] },
            ...{ [tanks[1].name]: scorePercentage[tanks[1].name] },
            "Difference": Math.abs(scorePercentageDif[tanks[0].name]),
        },
        {
            "Statistic": "Avg Energy",
            ...{ [tanks[0].name]: avgEnergy[tanks[0].name] },
            ...{ [tanks[1].name]: avgEnergy[tanks[1].name] },
            "Difference": Math.abs(avgEnergyDif[tanks[0].name]),
        },
        {
            "Statistic": "Accuracy %",
            ...{ [tanks[0].name]: accuracy[tanks[0].name] },
            ...{ [tanks[1].name]: accuracy[tanks[1].name] },
            "Difference": Math.abs(accuracyPercentageDif[tanks[0].name]),
        },
        {
            "Statistic": "Powerups Collected",
            ...{ [tanks[0].name]: powerupsCollected[0] },
            ...{ [tanks[1].name]: powerupsCollected[1] },
            "Difference": ~~Math.abs(powerupsCollected[0] - powerupsCollected[1]),
        },
        {
            "Statistic": "Powerups Collected %",
            ...{ [tanks[0].name]: powerupsCollectedPercentage[0] },
            ...{ [tanks[1].name]: powerupsCollectedPercentage[1] },
            "Difference": ~~Math.abs(powerupsCollectedPercentage[tanks[0].name] - powerupsCollectedPercentage[tanks[1].name]),
        },
        {
            "Statistic": "Tank Collisions",
            ...{ [tanks[0].name]: tankCollisions[0] },
            ...{ [tanks[1].name]: tankCollisions[1] },
            "Difference": 0,
        },
        {
            "Statistic": "Missile Collisions",
            ...{ [tanks[0].name]: missileCollisions[0] },
            ...{ [tanks[1].name]: missileCollisions[1] },
            "Difference": Math.abs(missileCollisions[0] - missileCollisions[1]),
        },
        {
            "Statistic": "Wall Collisions",
            ...{ [tanks[0].name]: wallCollisions[0] },
            ...{ [tanks[1].name]: wallCollisions[1] },
            "Difference": Math.abs(wallCollisions[0] - wallCollisions[1]),
        },
    ];
    
    const gameWinner = (winCounts[0] > winCounts[1]) ? ((winCounts[0] === winCounts[1]) ? "Draw" : tanks[0].name) : tanks[1].name;
    const draws = Math.abs(gameCount - winCounts[0] - winCounts[1]);
    const gameStats = {
        "Total Matches": gameCount,
        "Total Game Time": formatTime(gameTimeInSeconds),
        "Average FPS": ~~(totalGameDuration / gameTimeInSeconds),
        "Total Game Iterations": totalGameDuration,
        "Last Match Iterations": iteration,
        "Average Match Iterations": Math.round(totalGameDuration / gameCount),
        "Total Powerups Spawned": arena.powerupsSpawned,
        "Number of Draws": draws + ` (${Math.round(draws / gameCount * 10000) / 100}%)`,
        "Victory Message": (winner.victoryMessage || "Draw."),
        "Match Winner": winner.name,
        "Game Winner": `${gameWinner} (${winPercentage[gameWinner]}%)`,
    }
    console.log(`%c Matches ${gameCount}`, "font-size: 32px;");
    console.table(gameStats);
    console.table(matchStats);
    console.log();
}

setInterval(() => {
    if (!paused && document.getElementById("selSpeed").value !== 0) {
        gameTimeInSeconds++;
    }
}, 1000);

window.addEventListener("error", (e) => {
    selGameSpeed.value = 0;
    console.error(e);
});


function spawnPowerup() {
    if (arena.powerups.length > 0) return;
    const options = [
        { type: "speed", amount: MAX_POWERUP_AMOUNT },
        { type: "guncool", amount: MAX_POWERUP_AMOUNT },
        { type: "firepower", amount: MAX_POWERUP_AMOUNT },
        { type: "energy", amount: MAX_POWERUP_AMOUNT },
    ];
    const selectedPowerup = options[~~(Math.random() * options.length)];
    let powerup = new PowerUp(selectedPowerup.type, selectedPowerup.amount)
    powerup.amount = Math.max(MIN_POWERUP_AMOUNT, MAX_POWERUP_AMOUNT * Math.random());
    powerupsSpawned++;
    arena.powerups.push(powerup);
}


function showError(error) {
    error = JSON.stringify(error, null, 2);
    const overlay = document.getElementById("overlay");
    overlay.style.zIndex = "9999";
    overlay.innerHTML = `<pre>${error}</pre>`;
    overlay.style.display = "block";
}

function formatTime(seconds) {
    const s = seconds % 60;
    const m = Math.floor((seconds / 60) % 60);
    const h = Math.floor(seconds / (60 * 60));
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}




function getMemory(key) {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : null;
    }
    catch (e) {
        console.error("Error parsing memory for key \"" + key + "\":", e);
        return null;
    }
}

function commitMemory(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify(data, null, 2));
    }
    catch (e) {
        console.error("Error committing memory for key \"" + key + "\":", e);
    }
}


function calculateTotals(tankName) {
    let totalWinPercentages = 0;
    let numberOfOpponents = 0;
    let totalWins = 0;
    let totalLosses = 0;
    let totalMatches = 0;
    if (!leaderboard[tankName]) {
        return { average: 0, wins: 0, losses: 0, matches: 0 };
    }
    for (const adversaryName of Object.keys(leaderboard[tankName])) {
        if (adversaryName.startsWith("_")) {
            continue;
        }
        const stats = leaderboard[tankName][adversaryName];
        if (stats && typeof stats.average && stats.matches > 0) {
            totalWinPercentages += stats.average;
            totalWins += stats.wins;
            totalLosses += stats.losses;
            totalMatches += stats.matches;
            numberOfOpponents++;
        }
    }
    const averageOfH2HPct = numberOfOpponents > 0 ? totalWinPercentages / numberOfOpponents : 0;
    return {
        average: averageOfH2HPct,
        wins: totalWins,
        losses: totalLosses,
        matches: totalMatches,
    };
}

function updateLeaderboard(winner, tanks) {
    const sortedTanks = [...tanks].sort((a, b) => { return a.name.localeCompare(b.name) });
    const tankA = sortedTanks[0];
    const tankB = sortedTanks[1];
    const tankAName = tankA.name;
    const tankBName = tankB.name;
    if (!leaderboard[tankAName]) {
        leaderboard[tankAName] = {};
    }
    if (!leaderboard[tankBName]) {
        leaderboard[tankBName] = {};
    }
    if (!leaderboard[tankAName][tankBName]) {
        leaderboard[tankAName][tankBName] = { average: 0, wins: 0, losses: 0, matches: 0 };
    }
    if (!leaderboard[tankBName][tankAName]) {
        leaderboard[tankBName][tankAName] = { average: 0, wins: 0, losses: 0, matches: 0 };
    }
    const h2hAB = leaderboard[tankAName][tankBName];
    const h2hBA = leaderboard[tankBName][tankAName];
    h2hAB.matches++;
    h2hBA.matches++;
    if (winner && winner.name && winner.name !== "Draw") {
        if (winner.name === tankAName) {
            h2hAB.wins++;
            h2hBA.losses++;
            h2hAB.average = Math.round(h2hAB.wins / h2hAB.matches * 10000) / 100;
        }
        else if (winner.name === tankBName) {
            h2hBA.wins++;
            h2hAB.losses++;
            h2hBA.average = Math.round(h2hBA.wins / h2hBA.matches * 10000) / 100;
        }
    }
    const totalsA = calculateTotals(tankAName);
    const totalsB = calculateTotals(tankBName);
    leaderboard[tankAName].elo = tankA.elo;
    leaderboard[tankAName]._average = totalsA.average;
    leaderboard[tankAName]._total = totalsA.matches;
    leaderboard[tankAName]._total_wins = totalsA.wins;
    leaderboard[tankAName]._total_losses = totalsA.losses;
    leaderboard[tankBName].elo = tankB.elo;
    leaderboard[tankBName]._average = totalsB.average;
    leaderboard[tankBName]._total = totalsB.matches;
    leaderboard[tankBName]._total_wins = totalsB.wins;
    leaderboard[tankBName]._total_losses = totalsB.losses;
    document.getElementById("divLeaderboard").innerHTML = generateLeaderboardTable();
    commitMemory(GLOBAL_STORAGE_KEY, leaderboard);
}

function generateLeaderboardTable() {
    let tableHTML = `<br><h3>Tank's Ranks</h3><table id="tblLeaderboard">`;
    const tankNames = Object.keys(leaderboard).sort((a, b) => {
        const avgA = leaderboard[a]._average || 0;
        const avgB = leaderboard[b]._average || 0;
        return avgB - avgA;
    });
    if (tankNames.length > 0) {
        // Add the table header (<thead>) here
        tableHTML += `<thead>`;
        tableHTML += `<tr>`;
        tableHTML += `<th>Tank</th>`;
        tableHTML += `<th>Elo</th>`;
        tableHTML += `<th>Win %</th>`;
        tableHTML += `<th>Matches</th>`;
        tableHTML += `</tr>`;
        tableHTML += `</thead>`;
        tableHTML += `<tbody>`;
    }
    tankNames.forEach((tankAName) => {
        const tankAOverallStats = leaderboard[tankAName];
        const tankAOverallWinPct = tankAOverallStats ? (tankAOverallStats._average || 0) : 0;
        tableHTML += `<tr class="trHeader">`;
        tableHTML += `<td><strong>${tankAName}</strong></td>`;
        tableHTML += `<td><strong>${Math.round(tankAOverallStats.elo)}</strong></td>`;
        tableHTML += `<td><strong>${tankAOverallWinPct.toFixed(2)}%</strong></td>`;
        tableHTML += `<td><strong>${tankAOverallStats._total}</strong></td>`;
        tableHTML += `</tr>`;
        tankNames.forEach((tankBName) => {
            if (tankAName === tankBName) {
                return;
            }
            const h2hAB = leaderboard[tankAName] ? leaderboard[tankAName][tankBName] : null;
            const h2hBA = leaderboard[tankBName] ? leaderboard[tankBName][tankAName] : null;
            let tankAWinPct = 0;
            if (h2hAB && h2hAB.matches > 0) {
                tankAWinPct = (h2hAB.wins / h2hAB.matches) * 100;
                let tankBWinPct = 0;
                if (h2hBA && h2hBA.matches > 0) {
                    tankBWinPct = (h2hBA.wins / h2hBA.matches) * 100;
                }
                tableHTML += `<tr>`;
                tableHTML += `<td>vs. ${tankBName}</td>`;
                tableHTML += `<td></td>`;
                tableHTML += `<td>${tankAWinPct.toFixed(2)}%</td>`;
                tableHTML += `<td>${h2hAB.matches}</td>`;
                tableHTML += `</tr>`;
            }
        });
    });
    if (tankNames.length > 0) {
        tableHTML += `</tbody></table><button id="btnResetLeaderboard" onclick="resetRanks()">Reset Ranks</button>`;
    }
    else {
        tableHTML += "<br>You must run at least one match first.";
    }
    return tableHTML;
}

function resetRanks() {
    const confirmed = confirm("Are, you sure you want to reset the ranks. This action can not be undone.");
    if (confirmed) {
        leaderboard = {};
        commitMemory(GLOBAL_STORAGE_KEY, {});
        document.getElementById("divLeaderboard").innerHTML = generateLeaderboardTable();
    }
}


function calculateElos(a, b, winner) {
    const K_FACTOR = 32;
    const RATING_A = a.elo || 1500;
    const RATING_B = b.elo || 1500;
    const expectedScoreA = 1 / (1 + Math.pow(10, (RATING_B - RATING_A) / 400));
    const expectedScoreB = 1 / (1 + Math.pow(10, (RATING_A - RATING_B) / 400));
    let actualScoreA;
    let actualScoreB;
    if (winner.brain === a.brain) {
        actualScoreA = 1;
        actualScoreB = 0;
    }
    else if (winner.brain === b.brain) {
        actualScoreA = 0;
        actualScoreB = 1;
    }
    else {
        actualScoreA = 0.5;
        actualScoreB = 0.5;
    }
    // Calculate new Elo ratings
    const newEloA = RATING_A + K_FACTOR * (actualScoreA - expectedScoreA);
    const newEloB = RATING_B + K_FACTOR * (actualScoreB - expectedScoreB);
    return {
        a: newEloA,
        b: newEloB
    };
}

document.getElementById("divLeaderboard").innerHTML = generateLeaderboardTable();
