let selectedTankA;
let selectedTankB;
let tankFileA;
let tankFileB;

const tankAIs = {};

function initTankSelectors() {
    loadTanks();
    const selTankA = document.getElementById("selTankA");
    const selTankB = document.getElementById("selTankB");
    selTankA.addEventListener("change", handleTankAChange);
    selTankB.addEventListener("change", handleTankBChange);
}

function addOption(selectElement, value, text) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = text;
    selectElement.appendChild(option);
}

function loadTanks() {
    const tanks = tankList.sort((a, b) => {
        const aStarts = a.startsWith('_');
        const bStarts = b.startsWith('_');
        if (aStarts && !bStarts) return 1;
        if (!aStarts && bStarts) return -1;
        return a.localeCompare(b);
    });

    const selTankA = document.getElementById("selTankA");
    const selTankB = document.getElementById("selTankB");
    let initTankA = tanks[~~(Math.random() * tanks.length)];
    let initTankB = tanks[~~(Math.random() * tanks.length)];
    while (initTankA.startsWith("_")) initTankA = tanks[~~(Math.random() * tanks.length)];
    while (initTankB.startsWith("_") || initTankB === initTankA) initTankB = tanks[~~(Math.random() * tanks.length)];
    if (urlParams.has("a")) {
        initTankA = urlParams.get("a");
    }
    if (urlParams.has("b")) {
        initTankB = urlParams.get("b");
    }

    tanks.forEach(tankName => {
        const funcName = tankName.replace(/\s+/g, '_');
        const displayName = tankName.charAt(0).toUpperCase() + tankName.slice(1);

        addOption(selTankA, funcName, displayName);
        addOption(selTankB, funcName, displayName);

        const script = document.createElement('script');
        script.src = `./tanks/${tankName}.js`;
        script.onload = () => {
            tankAIs[funcName] = window.main;
            if (tankName === initTankA) {
                tankFileA = initTankA;
                selectedTankA = tankAIs[funcName];
                selTankA.value = funcName;
            }
            if (tankName === initTankB) {
                tankFileB = initTankB;
                selectedTankB = tankAIs[funcName];
                selTankB.value = funcName;
            }
        };
        document.body.appendChild(script);
    });
}

function handleTankAChange(event) {
    if (event.target.value !== "tournament") {
        tankFileA = event.target.value;
        selectedTankA = tankAIs[event.target.value];
    }
}

function handleTankBChange(event) {
    if (event.target.value !== "tournament") {
        tankFileB = event.target.value;
        selectedTankB = tankAIs[event.target.value];
    }
}

function getTankFileA() {
    return tankFileA;
}

function getTankFileB() {
    return tankFileB;
}

function getSelectedTankA() { 
    if (isTournament) {
        tankFileA = tournamentMatch[tournamentIndex].a;
        selectedTankA = tankAIs[tankFileA];
    }
    return selectedTankA; 
}

function getSelectedTankB() { 
    if (isTournament) {
        tankFileB = tournamentMatch[tournamentIndex].b;
        selectedTankB = tankAIs[tankFileB];
    }
    return selectedTankB; 
}

document.addEventListener("DOMContentLoaded", initTankSelectors);