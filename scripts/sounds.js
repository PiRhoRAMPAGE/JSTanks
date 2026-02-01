let sounds = [];
let soundEnabled = false;

// Defune all sounds used in game
const SOUND_CONFIG = {
    pause:          { src: "./assets/pause.mp3",        count: 1  },
    unpause:        { src: "./assets/unpause.mp3",      count: 1  },
    pow:            { src: "./assets/pow.mp3",          count: 20 },
    collect:        { src: "./assets/collect.mp3",      count: 4  },
    motor:          { src: "./assets/motor.mp3",        count: 2  },
    airplane:       { src: "./assets/plane.mp3",        count: 1  },
    airstrike:      { src: "./assets/airstrike.mp3",    count: 1  },
};

// Initialize a pool of preloaded sounds
const SOUND_LIBRARY = {};
for (const [key, config] of Object.entries(SOUND_CONFIG)) {
    SOUND_LIBRARY[key] = {
        pool: Array.from({ length: config.count }, () => {
            const audio = new Audio(config.src);
            audio.preload = "auto";
            return audio;
        }),
        index: 0
    };
}

function playSound(name, volume = 1, playbackRate = 1, loop = false) {
    if (!soundEnabled || !SOUND_LIBRARY[name]) return;
    try {
        const item = SOUND_LIBRARY[name];
        const sound = item.pool[item.index];
        item.index = (item.index + 1) % item.pool.length;
        sound.pause();
        sound.currentTime = 0; 
        sound.volume = volume;
        sound.playbackRate = playbackRate;
        sound.loop = loop;
        sound.play().catch((e) => console.warn(e));
        sounds.push(sound);
        return sound;
    }
    catch (e) {
        console.warn(e);
    }
}

// Toggle sounds on and off
enableSound.addEventListener("click", (e) => {
    soundEnabled = !e.target.checked;
    if (!soundEnabled) {
        sounds.forEach(sound => sound.pause());
    }
    else {
        arena.tanks?.forEach(tank => tank.motorSound = playSound("motor", 0.01, 0.1, true));
        arena.airplanes?.forEach(tank => tank.motorSound = playSound("airplane", 0.01, 0.1, true));
        sounds.forEach(sound => sound.play());
    }
})

// Play a note at a specified frequency
function soundNote(frequency, duration, volume = 1, waveShape = "sine") {
    // Exit conditions
    if (!soundEnabled) return;
    return new Promise((resolve, reject) => {
        if (typeof AudioContext !== "undefined" || typeof webkitAudioContext !== "undefined") {
            try {
                const audioContext = new (AudioContext || webkitAudioContext)();
                const oscillator = audioContext.createOscillator();
                oscillator.type = waveShape;
                oscillator.frequency.value = frequency; // Set the frequency in Hz
                const gainNode = audioContext.createGain();
                gainNode.gain.value = volume;
                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);
                oscillator.start();
                setTimeout(() => {
                    oscillator.stop();
                    audioContext.close();
                    resolve();
                }, duration);
            }
            catch (error) {
                reject(error);
            }
        }
        else {
            reject(new Error("Web Audio API is not supported in this browser."));
        }
    });
}
