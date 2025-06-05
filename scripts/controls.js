
// Set up tool tips to explain controls
document.getElementById("btnLeaderboard").title = "View the leaderboard.";
document.getElementById("divSpeed").title = "Select the game speed.";
document.getElementById("divView").title = "Show animations:\nDisable to run game at max speed.";
document.getElementById("divSound").title = "Disable sounds:\nSounds are not recommended at height game speeds";
document.getElementById("divBlocking").title = "Allow blocking:\nWhen enabled missiles can intercept each other.";
document.getElementById("divPowerups").title = "Enable Powerups:\nWhen enabled powerups will randomly spawn.";

const btnLeaderboard = document.getElementById("btnLeaderboard");
const divLeaderboard = document.getElementById("divLeaderboard");
const btnNewGame = document.getElementById("btnNewGame");
const btnCancelNewGame = document.getElementById("btnCancelNewGame");
const btnStartNewGame = document.getElementById("btnStartGame");
const selGameSpeed = document.getElementById("selSpeed");
const showAnimation = document.getElementById("toggleView");
const enableSound = document.getElementById("toggleSound");
const allowBlocking = document.getElementById("toggleBlocking");
const powerupsEnabled = document.getElementById("togglePowerups");


let paused = false;
let resumeSpeed = 1;
let fps = 60;
let stepMode = false;
let stepNextFrame = true;

// Initialize game speed controller
for (let i = 99; i > -100; i--) {
    const option = document.createElement("option");
    option.value = `${i}`;
    if (i === 0) {
        option.textContent = "Stop";
    }
    else if (i < 0) {
        option.textContent = `/${Math.abs(i)}`;
    }
    else if (i > 0) {
        option.textContent = `X${i}`;
    }
    selGameSpeed.appendChild(option);
}
selGameSpeed.value = 1;

// Set default speed value
const fileURI = new URL(location.href);
const params = new URLSearchParams(fileURI.search);

if (params.has("pause")) {
    selGameSpeed.value = 0;
    paused = true;
}

if (params.has("speed")) {
    let speed = Number.parseFloat(params.get("speed"));
    if (isNaN(speed) || speed < 0 || speed > 99) {
        alert("Invalid game speed specified. Using default value (1)");
        speed = 1;
    }
    selGameSpeed.value = speed;
}


// Handle key presses
const keyDown = {};

document.addEventListener("keydown", (event) => {
    keyDown[event.key] = true;
});

document.addEventListener("keyup", (event) => {
    if (keyDown["Control"]) {
        const direction = keyDown["-"] ? -1 : 1;
        // Toggle max speed
        if (event.key === "0") {
            toggleView.checked = true;
            selGameSpeed.value = 99 * direction;
            stepMode = false;
            paused = false;
        }
        else if (!isNaN(Number.parseFloat(event.key))) {
            toggleView.checked = true;
            selGameSpeed.value = event.key * 10 * direction;
            stepMode = false;
            paused = false;
        }
    }

    // Toggle pause
    else if (event.key === "0") {
        toggleView.checked = true;
        paused = !paused;
        soundPause(paused);
        if (paused) {
            resumeSpeed = selGameSpeed.value;
            selGameSpeed.value = 0;
        }
        else {
            selGameSpeed.value = resumeSpeed;
        }
        stepMode = false;
    }
    else if (!isNaN(Number.parseFloat(event.key))) {
        toggleView.checked = true;
        const direction = keyDown["-"] ? -1 : 1;
        selGameSpeed.value = event.key * direction;
        stepMode = false;
    }

    if (event.key === "`") {
        toggleView.checked = true;
        selGameSpeed.value = 1;
        stepMode = true;
        stepNextFrame = true;
    }

    if (!isNaN(Number.parseFloat(event.key)) || event.key === "`") {
        toggleView.checked = true;
        selGameSpeed.focus();
    }
    
    keyDown[event.key] = false;
});


// Handle mouse movement
const mouse = {
    x: 0,
    y: 0,
    isDown: false,
};

let mouseArea = document.getElementById("canvas");

mouseArea.addEventListener("mousemove", (event) => {
    const rect = mouseArea.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;    // Get horizontal scaling ratio
    const scaleY = canvas.height / rect.height;  // Get vertical scaling ratio
    mouse.x = (event.clientX - rect.left) * scaleX - canvas.width / 2;
    mouse.y = (event.clientY - rect.top) * scaleY - canvas.height / 2;
});

mouseArea.addEventListener("touchstart", (event) => {
    event.preventDefault();
    const touch = event.touches[0];
    const rect = mouseArea.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    mouse.x = (touch.clientX - rect.left) * scaleX - canvas.width / 2;
    mouse.y = (touch.clientY - rect.top) * scaleY - canvas.height / 2;
    mouse.isDown = true;
}, { passive: false });

mouseArea.addEventListener("touchmove", (event) => {
    event.preventDefault();
    const touch = event.touches[0];
    const rect = mouseArea.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    mouse.x = (touch.clientX - rect.left) * scaleX - canvas.width / 2;
    mouse.y = (touch.clientY - rect.top) * scaleY - canvas.height / 2;
}, { passive: false });

mouseArea.addEventListener("mousedown", (_event) => {
    mouse.isDown = true;
});

mouseArea.addEventListener("mouseup", (_event) => {
    mouse.isDown = false;
});

mouseArea.addEventListener("touchend", (event) => {
    event.preventDefault();
    mouse.isDown = false;
}, { passive: false });

mouseArea.addEventListener("touchcancel", (event) => {
    event.preventDefault();
    mouse.isDown = false;
}, { passive: false });


btnStartGame.addEventListener("click", () => {
    let confirmed = true;
    if (selectedTankA === selectedTankB) {
        confirmed = confirm("Stats will be unavailable if you battle a tank against itself.");
    }
    if (confirmed) {
        divTanks.style.display = "none";
        startGame();
    }
});

selGameSpeed.addEventListener("change", () => {
    toggleView.checked = true;
});

btnLeaderboard.addEventListener("click", () => {
    if (divLeaderboard.style.display === "none") {
        btnLeaderboard.title = "Hide the leaderboard.";
        btnLeaderboard.innerHTML = "<center>Hide<br>Ranks</center>";
        divLeaderboard.style.display = "flex";
    }
    else {
        btnLeaderboard.title = "View the leaderboard.";
        btnLeaderboard.innerHTML = "<center>Show<br>Ranks</center>";
        divLeaderboard.style.display = "none";
    }
    
});