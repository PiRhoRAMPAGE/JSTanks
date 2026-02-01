let tournamentMatch = [];
let tournamentIndex = urlParams.has("tournamentindex") ? urlParams.get("tournamentindex") : 0;
const isTournament = urlParams.has("tournament");

if (urlParams.has("tournament")) {
    const tanks = tankList.sort((a, b) => a.localeCompare(b)).filter(name => !name.startsWith("_"));
    tanks.forEach((tankA) => {
        tanks.forEach((tankB) => {
            if (tankA !== tankB) {
                tournamentMatch.push({a: tankA, b: tankB});
            }
        });
    });
    tournamentMatch = deterministicShuffle(tournamentMatch, tanks.length * 100);
    document.getElementById("btnLeaderboard").title = "Hide the leaderboard.";
    document.getElementById("btnLeaderboard").innerHTML = "<center>Hide<br>Ranks</center>";
    document.getElementById("divLeaderboard").style.display = "flex";
}

function startTournament() {
    let url = location;
    url = `${location.origin + location.pathname}?tournament&start&headless`;
    if (urlParams.has("matches")) url += `&matches=${urlParams.get("matches")}`
    if (urlParams.has("pspawn")) url += `&pspawn=${urlParams.get("pspawn")}`
    location = url;
}

function getNextMatch() {
    if (tournamentIndex < tournamentMatch.length) {
        const match = tournamentMatch[tournamentIndex];
        tankFileA = match.a;
        tankFileB = match.b;
        tournamentIndex++;
        return true;
    }
    return false;
}

function deterministicShuffle(array, seed) {
    let cyrb128 = (str) => {
        let h1 = 1779033703, h2 = 2557915919, h3 = 3572992451, h4 = 2800113503;
        for (let i = 0, k; i < str.length; i++) {
            k = str.charCodeAt(i);
            h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
            h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
            h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
            h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
        }
        return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
    };
    let sfc32 = (a, b, c, d) => {
        return function() {
            a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0; 
            var t = (a + b | 0) + d | 0;
            d = d + 1 | 0;
            a = b ^ b >>> 9;
            b = c + (c << 3) | 0;
            c = (c << 21 | c >>> 11);
            c = c + t | 0;
            return (t >>> 0) / 4294967296;
        };
    };
    const seedData = cyrb128(seed.toString());
    const rand = sfc32(seedData[0], seedData[1], seedData[2], seedData[3]);
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}