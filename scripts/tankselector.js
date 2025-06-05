// Tank AI selector functionality
let selectedTankA;
let selectedTankB;

// Store references to the tank AI functions
const tankAIs = {};

// Initialize the tank selectors
function initTankSelectors() {
    // Load the "others" tank AIs
    loadTanks();

    const selTankA = document.getElementById("selTankA");
    const selTankB = document.getElementById("selTankB");

    // Add event listeners
    selTankA.addEventListener("change", handleTankAChange);
    selTankB.addEventListener("change", handleTankBChange);

}


// Add an option to a select element
function addOption(selectElement, value, text) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = text;
    selectElement.appendChild(option);
}

function loadTanks() {
    const tanks = tankList;

    const selTankA = document.getElementById("selTankA");
    const selTankB = document.getElementById("selTankB");

    let initTankA = tanks[~~(Math.random() * tanks.length)];
    let initTankB = tanks[~~(Math.random() * tanks.length)];
    while (initTankA === "manual") {
        initTankA = tanks[~~(Math.random() * tanks.length)];
    }
    while (initTankB === "manual") {
        initTankB = tanks[~~(Math.random() * tanks.length)];
    }
    while (initTankA === initTankB) {
        initTankB = tanks[~~(Math.random() * tanks.length)];
    }

    tanks.forEach((tankName) => {
        const script = document.createElement("script");
        script.src = `./tanks/${tankName}.js`;
        script.onload = () => {
            const funcName = `${tankName.replace(/\s+/g, '_')}`;
            tankAIs[funcName] = window.main;
            const displayName = tankName.charAt(0).toUpperCase() + tankName.slice(1);
            addOption(selTankA, funcName, displayName);
            addOption(selTankB, funcName, displayName);
            if (tankName === initTankA) {
                selectedTankAName = tankName;
                selectedTankA = tankAIs[funcName];
                selTankA.value = tankName;
            }
            if (tankName === initTankB) {
                selectedTankBName = tankName;
                selectedTankB = tankAIs[funcName];
                selTankB.value = tankName;
            }
        };
        document.body.appendChild(script);
    });

}

// Handle tank A selection change
function handleTankAChange(event) {
    const selectedValue = event.target.value;
    selectedTankA = tankAIs[selectedValue];
}

// Handle tank B selection change
function handleTankBChange(event) {
    const selectedValue = event.target.value;
    selectedTankB = tankAIs[selectedValue];
}

// Get the selected tank A AI function
function getSelectedTankA() {
    return selectedTankA;
}

// Get the selected tank B AI function
function getSelectedTankB() {
    return selectedTankB;
}


// Initialize the selectors when the DOM is loaded
document.addEventListener("DOMContentLoaded", initTankSelectors);
