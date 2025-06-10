/**
 * Tank Evaluator - A tool for evaluating tank performance and calculating ELO ratings
 *
 * This script allows you to run multiple matches between two tanks to evaluate their performance
 * and calculate their ELO ratings. It provides detailed statistics about the matches.
 */

class TankEvaluator {
    constructor() {
        this.matchCount = 100; // Default number of matches to run
        this.tankA = null;
        this.tankB = null;
        this.results = null;
        this.isRunning = false;
        this.currentMatchCount = 0; // Track the current number of matches
        this.evaluationComplete = false; // Flag to indicate if evaluation is complete
    }

    /**
     * Set the number of matches to run
     * @param {number} count - Number of matches
     */
    setMatchCount(count) {
        if (count > 0) {
            this.matchCount = count;
        }
    }

    /**
     * Set the tanks to evaluate
     * @param {string} tankAName - Name of the first tank
     * @param {string} tankBName - Name of the second tank
     */
    setTanks(tankAName, tankBName) {
        // First try to get the tank functions from the tankAIs object (populated by tankselector.js)
        // If not found there, try to get them from the global scope
        let tankAFunction = tankAIs[tankAName] || window[tankAName];
        let tankBFunction = tankAIs[tankBName] || window[tankBName];

        // If still not found, check if the tank name is in the tankList and try to load it
        if (typeof tankAFunction !== 'function' && tankList.includes(tankAName)) {
            // The tank might be in the list but not loaded yet, try to get it from the global scope
            // using the naming convention in tankselector.js
            const funcName = tankAName.replace(/\s+/g, '_');
            tankAFunction = window[funcName];
        }

        if (typeof tankBFunction !== 'function' && tankList.includes(tankBName)) {
            const funcName = tankBName.replace(/\s+/g, '_');
            tankBFunction = window[funcName];
        }

        if (typeof tankAFunction !== 'function') {
            throw new Error(`Tank "${tankAName}" not found or not a function`);
        }

        if (typeof tankBFunction !== 'function') {
            throw new Error(`Tank "${tankBName}" not found or not a function`);
        }

        this.tankA = {
            name: tankAName,
            function: tankAFunction
        };

        this.tankB = {
            name: tankBName,
            function: tankBFunction
        };
    }

    /**
     * Run the evaluation
     * @returns {Promise} A promise that resolves when the evaluation is complete
     */
    async evaluate() {
        if (!this.tankA || !this.tankB) {
            throw new Error("Tanks not set. Call setTanks() first.");
        }

        if (this.isRunning) {
            throw new Error("Evaluation already running");
        }

        this.isRunning = true;
        this.currentMatchCount = 0; // Reset the current match count
        this.evaluationComplete = false; // Reset the evaluation complete flag

        this.results = {
            matchCount: this.matchCount,
            tankA: {
                name: this.tankA.name,
                wins: 0,
                elo: leaderboard[this.tankA.name]?.elo || 1500
            },
            tankB: {
                name: this.tankB.name,
                wins: 0,
                elo: leaderboard[this.tankB.name]?.elo || 1500
            },
            draws: 0,
            startTime: Date.now()
        };

        // Configure the game for fast evaluation
        const originalShowAnimation = showAnimation.checked;
        const originalSpeed = document.getElementById("selSpeed").value;
        const originalPowerups = powerupsEnabled.checked;

        // Set up for fast evaluation
        showAnimation.checked = false;
        document.getElementById("selSpeed").value = MAX_ITERATIONS;
        powerupsEnabled.checked = false;

        // Set the tanks in the UI
        const tankASelect = document.getElementById("selTankA");
        const tankBSelect = document.getElementById("selTankB");

        // Find the index of the tanks in the select elements
        let tankAIndex = -1;
        let tankBIndex = -1;

        for (let i = 0; i < tankASelect.options.length; i++) {
            if (tankASelect.options[i].value === this.tankA.name) {
                tankAIndex = i;
            }
            if (tankBSelect.options[i].value === this.tankB.name) {
                tankBIndex = i;
            }
        }

        if (tankAIndex === -1 || tankBIndex === -1) {
            throw new Error("Tank not found in select options");
        }

        tankASelect.selectedIndex = tankAIndex;
        tankBSelect.selectedIndex = tankBIndex;

        // Create a progress display
        const overlay = document.getElementById("overlay");
        overlay.style.zIndex = "9999";
        overlay.style.display = "block";
        overlay.innerHTML = `
            <div style="background-color: rgba(0,0,0,0.8); padding: 20px; border-radius: 10px; max-width: 80%; margin: 0 auto;">
                <h2>Evaluating Tanks</h2>
                <p>${this.tankA.name} vs ${this.tankB.name}</p>
                <p>Running ${this.matchCount} matches...</p>
                <div style="background-color: #333; border-radius: 5px; height: 20px; width: 100%; margin-top: 10px;">
                    <div id="progress-bar" style="background-color: #0f0; height: 100%; width: 0%; border-radius: 5px;"></div>
                </div>
                <p id="progress-text">0/${this.matchCount} (0%)</p>
                <p id="estimated-time">Estimated time remaining: calculating...</p>
            </div>
        `;

        // Start the evaluation
        let completedMatches = 0;
        let startTime = Date.now();
        let estimatedTimeRemaining = "calculating...";

        // Create a promise that resolves when the evaluation is complete
        return new Promise((resolve) => {
            // Store original functions to restore later
            const originalStartGame = window.startGame;
            const originalNewGame = window.newGame;
            const originalLogGameData = window.logGameData;
            const originalAnimate = window.animate;

            // Function to clean up and complete the evaluation
            const completeEvaluation = () => {
                if (this.evaluationComplete) return; // Prevent multiple calls
                this.evaluationComplete = true;

                // Stop the game loop
                if (gameLooper) {
                    clearTimeout(gameLooper);
                    gameLooper = null;
                }

                // Restore original functions
                window.startGame = originalStartGame;
                window.newGame = originalNewGame;
                window.logGameData = originalLogGameData;
                window.animate = originalAnimate;

                // Restore original settings
                showAnimation.checked = originalShowAnimation;
                document.getElementById("selSpeed").value = originalSpeed;
                powerupsEnabled.checked = originalPowerups;

                // Hide the progress display
                overlay.style.display = "none";

                this.isRunning = false;
                this.results.endTime = Date.now();
                this.results.duration = (this.results.endTime - this.results.startTime) / 1000;

                // Calculate final statistics
                this.calculateFinalStats();

                // Resolve the promise with the results
                resolve(this.results);
            };

            // Override the animate function to stop the game loop when we're done
            window.animate = function (currentTime) {
                // Only continue the animation if we're still running matches and evaluation is not complete
                if (!tankEvaluator.evaluationComplete && tankEvaluator.currentMatchCount < tankEvaluator.matchCount) {
                    originalAnimate.call(this, currentTime);
                } else if (gameLooper) {
                    // Clear the game loop timeout when we're done
                    clearTimeout(gameLooper);
                    gameLooper = null;
                }
            };

            // Override the logGameData function to capture results
            window.logGameData = (winner) => {
                // Skip if evaluation is already complete
                if (this.evaluationComplete) return;

                // Call the original function to maintain game state
                originalLogGameData(winner);

                // Only process if we're still running matches
                if (this.currentMatchCount < this.matchCount) {
                    completedMatches++;
                    this.currentMatchCount++;

                    // Update progress
                    const progressBar = document.getElementById("progress-bar");
                    const progressText = document.getElementById("progress-text");
                    const estimatedTimeElement = document.getElementById("estimated-time");

                    const progress = completedMatches / this.matchCount;
                    progressBar.style.width = `${progress * 100}%`;
                    progressText.textContent = `${completedMatches}/${this.matchCount} (${Math.round(progress * 100)}%)`;

                    // Calculate estimated time remaining
                    const elapsedTime = Date.now() - startTime;
                    const timePerMatch = elapsedTime / completedMatches;
                    const remainingMatches = this.matchCount - completedMatches;
                    const estimatedRemainingTime = timePerMatch * remainingMatches;

                    if (estimatedRemainingTime > 0) {
                        estimatedTimeRemaining = this.formatTime(estimatedRemainingTime);
                        estimatedTimeElement.textContent = `Estimated time remaining: ${estimatedTimeRemaining}`;
                    }

                    // Update results
                    if (winCounts[0] > winCounts[1]) {
                        this.results.tankA.wins++;
                    } else if (winCounts[1] > winCounts[0]) {
                        this.results.tankB.wins++;
                    } else {
                        this.results.draws++;
                    }

                    // Get the current ELO ratings
                    this.results.tankA.elo = leaderboard[this.tankA.name]?.elo || 1500;
                    this.results.tankB.elo = leaderboard[this.tankB.name]?.elo || 1500;

                    // Check if we've completed all matches
                    if (this.currentMatchCount >= this.matchCount) {
                        // Complete the evaluation
                        setTimeout(completeEvaluation, 0);
                    } else {
                        // Start the next match
                        setTimeout(() => {
                            if (!this.evaluationComplete) {
                                originalStartGame();
                            }
                        }, 0);
                    }
                }
            };

            // Override newGame to prevent infinite loops
            window.newGame = function () {
                // Only call the original newGame if we're still running matches and evaluation is not complete
                if (!tankEvaluator.evaluationComplete && tankEvaluator.currentMatchCount < tankEvaluator.matchCount) {
                    originalNewGame.apply(this, arguments);
                }
            };

            // Start the first match
            originalStartGame();

            // Set a timeout to complete the evaluation if it takes too long
            setTimeout(() => {
                if (!this.evaluationComplete) {
                    console.warn("Evaluation timed out after 5 minutes. Forcing completion.");
                    completeEvaluation();
                }
            }, 5 * 60 * 1000); // 5 minutes timeout
        });
    }

    /**
     * Calculate final statistics
     */
    calculateFinalStats() {
        const tankA = this.results.tankA;
        const tankB = this.results.tankB;

        // Calculate win percentages
        tankA.winPercentage = (tankA.wins / this.matchCount) * 100;
        tankB.winPercentage = (tankB.wins / this.matchCount) * 100;
        this.results.drawPercentage = (this.results.draws / this.matchCount) * 100;

        // Get head-to-head stats from the leaderboard
        if (leaderboard[tankA.name] && leaderboard[tankA.name][tankB.name]) {
            tankA.h2h = leaderboard[tankA.name][tankB.name];
        }

        if (leaderboard[tankB.name] && leaderboard[tankB.name][tankA.name]) {
            tankB.h2h = leaderboard[tankB.name][tankA.name];
        }
    }

    /**
     * Format time in milliseconds to a human-readable string
     * @param {number} ms - Time in milliseconds
     * @returns {string} Formatted time string
     */
    formatTime(ms) {
        const seconds = Math.floor(ms / 1000);
        if (seconds < 60) {
            return `${seconds} seconds`;
        } else if (seconds < 3600) {
            const minutes = Math.floor(seconds / 60);
            const remainingSeconds = seconds % 60;
            return `${minutes} minute${minutes !== 1 ? 's' : ''} ${remainingSeconds} second${remainingSeconds !== 1 ? 's' : ''}`;
        } else {
            const hours = Math.floor(seconds / 3600);
            const remainingMinutes = Math.floor((seconds % 3600) / 60);
            return `${hours} hour${hours !== 1 ? 's' : ''} ${remainingMinutes} minute${remainingMinutes !== 1 ? 's' : ''}`;
        }
    }

    /**
     * Display the evaluation results
     */
    displayResults() {
        if (!this.results) {
            console.error("No results available. Run evaluate() first.");
            return;
        }

        const tankA = this.results.tankA;
        const tankB = this.results.tankB;

        console.log("%c Tank Evaluation Results", "font-size: 24px; font-weight: bold;");
        console.log(`%c ${tankA.name} vs ${tankB.name}`, "font-size: 18px;");
        console.log(`Matches: ${this.results.matchCount}`);
        console.log(`Duration: ${this.formatTime(this.results.duration * 1000)}`);
        console.log("");

        console.log("%c ELO Ratings", "font-size: 18px;");
        console.log(`${tankA.name}: ${Math.round(tankA.elo)}`);
        console.log(`${tankB.name}: ${Math.round(tankB.elo)}`);
        console.log(`Difference: ${Math.abs(Math.round(tankA.elo - tankB.elo))}`);
        console.log("");

        console.log("%c Match Results", "font-size: 18px;");
        console.log(`${tankA.name} wins: ${tankA.wins} (${tankA.winPercentage.toFixed(2)}%)`);
        console.log(`${tankB.name} wins: ${tankB.wins} (${tankB.winPercentage.toFixed(2)}%)`);
        console.log(`Draws: ${this.results.draws} (${this.results.drawPercentage.toFixed(2)}%)`);

        // Create a table for the results
        const resultsTable = [
            {
                "Statistic": "Wins",
                [tankA.name]: tankA.wins,
                [tankB.name]: tankB.wins,
                "Difference": Math.abs(tankA.wins - tankB.wins)
            },
            {
                "Statistic": "Win %",
                [tankA.name]: tankA.winPercentage.toFixed(2) + "%",
                [tankB.name]: tankB.winPercentage.toFixed(2) + "%",
                "Difference": Math.abs(tankA.winPercentage - tankB.winPercentage).toFixed(2) + "%"
            },
            {
                "Statistic": "ELO",
                [tankA.name]: Math.round(tankA.elo),
                [tankB.name]: Math.round(tankB.elo),
                "Difference": Math.abs(Math.round(tankA.elo - tankB.elo))
            }
        ];

        console.table(resultsTable);

        // If head-to-head stats are available, display them
        if (tankA.h2h && tankB.h2h) {
            console.log("%c Head-to-Head Stats", "font-size: 18px;");

            const h2hTable = [
                {
                    "Statistic": "Total Matches",
                    [tankA.name]: tankA.h2h.matches,
                    [tankB.name]: tankB.h2h.matches
                },
                {
                    "Statistic": "Wins",
                    [tankA.name]: tankA.h2h.wins,
                    [tankB.name]: tankB.h2h.wins
                },
                {
                    "Statistic": "Losses",
                    [tankA.name]: tankA.h2h.losses,
                    [tankB.name]: tankB.h2h.losses
                },
                {
                    "Statistic": "Win %",
                    [tankA.name]: tankA.h2h.average.toFixed(2) + "%",
                    [tankB.name]: tankB.h2h.average.toFixed(2) + "%"
                }
            ];

            console.table(h2hTable);
        }
    }
}

// Create a global instance of the evaluator
const tankEvaluator = new TankEvaluator();

/**
 * Run an evaluation between two tanks
 * @param {string} tankA - Name of the first tank (optional, will use selected tank from UI if not provided)
 * @param {string} tankB - Name of the second tank (optional, will use selected tank from UI if not provided)
 * @param {number} matches - Number of matches to run
 * @returns {Promise} A promise that resolves when the evaluation is complete
 */
async function evaluateTanks(tankA, tankB, matches = 100) {
    // If tank names are not provided, use the selected tanks from the UI
    if (!tankA || !tankB) {
        const selTankA = document.getElementById('selTankA');
        const selTankB = document.getElementById('selTankB');

        if (!selTankA || !selTankB) {
            throw new Error("Tank selectors not found in the UI");
        }

        tankA = tankA || selTankA.value;
        tankB = tankB || selTankB.value;

        if (!tankA || !tankB) {
            throw new Error("No tanks selected in the UI");
        }
    }

    tankEvaluator.setTanks(tankA, tankB);
    tankEvaluator.setMatchCount(matches);
    await tankEvaluator.evaluate();
    tankEvaluator.displayResults();
    return tankEvaluator.results;
}

/**
 * Get the ELO rating for a tank
 * @param {string} tankName - Name of the tank
 * @returns {number} The ELO rating of the tank
 */
function getTankELO(tankName) {
    return leaderboard[tankName]?.elo || 1500;
}

/**
 * Get all available tanks with their ELO ratings
 * @returns {Array} Array of tank objects with name and ELO
 */
function getAllTankELOs() {
    const tanks = [];

    for (const tankName of Object.keys(leaderboard)) {
        tanks.push({
            name: tankName,
            elo: Math.round(leaderboard[tankName]?.elo || 1500)
        });
    }

    // Sort by ELO (highest first)
    tanks.sort((a, b) => b.elo - a.elo);

    return tanks;
}

// Add a button to the UI for running evaluations
document.addEventListener('DOMContentLoaded', () => {
    const divOptions = document.getElementById('divOptions');

    const divEvaluate = document.createElement('div');
    divEvaluate.id = 'divEvaluate';
    divEvaluate.title = 'Evaluate tanks';

    const btnEvaluate = document.createElement('button');
    btnEvaluate.id = 'btnEvaluate';
    btnEvaluate.innerHTML = '<center>Evaluate<br>Tanks</center>';
    btnEvaluate.addEventListener('click', () => {
        const tankA = document.getElementById('selTankA').value;
        const tankB = document.getElementById('selTankB').value;
        const matches = parseInt(prompt('Number of matches to run:', '100')) || 100;

        evaluateTanks(tankA, tankB, matches);
    });

    divEvaluate.appendChild(btnEvaluate);
    divOptions.appendChild(divEvaluate);
});
