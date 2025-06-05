function playSound(fileUri, volume = 1, playbackRate = 1, loop = false) {
    // Exit conditions
    if (document.getElementById("toggleSound").checked) {
        return;
    }

    const audioElement = new Audio(fileUri);
    audioElement.volume = volume;
    audioElement.playbackRate = playbackRate;
    audioElement.loop = loop;
    audioElement.play();
    return audioElement;
}

function soundExplosion(volume = 0.8, playbackRate = 1) {
    return playSound("./assets/pow.mp3", volume, playbackRate);
}


function soundNote(frequency, duration, volume = 1, waveShape = "sine") {
    // Exit conditions
    if (document.getElementById("toggleSound").checked) {
        return;
    }
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

async function soundPause(paused) {
    const noteDuration = 150;
    const volume = 0.25;
    if (paused) {
        await soundNote(440, noteDuration, volume, "square");
        await soundNote(164.81, noteDuration, volume, "square");
    }
    else {
        await soundNote(164.81, noteDuration, volume, "square");
        await soundNote(440, noteDuration, volume, "square");
    }
}

