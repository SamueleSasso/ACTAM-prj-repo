/* =================================================================
   AUDIO ENGINE SETUP + SAMPLES LOADING
   ================================================================= */
const statusEl = document.getElementById('status');
const startBtn = document.getElementById('startBtn');

//Central Panner
const masterPanner = new Tone.Panner(0).toDestination();

//Samples List
const samples = {
    Kick: "https://raw.githubusercontent.com/dadymazz/ACTAM-2025-26-EUCLIDEAN-SEQUENCER/main/samples/Kick.wav",
    Snare: "https://raw.githubusercontent.com/dadymazz/ACTAM-2025-26-EUCLIDEAN-SEQUENCER/main/samples/Snare.wav",
    ClosedHat: "https://raw.githubusercontent.com/dadymazz/ACTAM-2025-26-EUCLIDEAN-SEQUENCER/main/samples/ClosedHat.wav",
    OpenHat: "https://raw.githubusercontent.com/dadymazz/ACTAM-2025-26-EUCLIDEAN-SEQUENCER/main/samples/OpenHat.wav",
    Ride: "https://raw.githubusercontent.com/dadymazz/ACTAM-2025-26-EUCLIDEAN-SEQUENCER/main/samples/Ride.wav",
    MidTom: "https://raw.githubusercontent.com/dadymazz/ACTAM-2025-26-EUCLIDEAN-SEQUENCER/main/samples/MidTom.wav",
    LowTom: "https://raw.githubusercontent.com/dadymazz/ACTAM-2025-26-EUCLIDEAN-SEQUENCER/main/samples/LowTom.wav",
    RimShot: "https://raw.githubusercontent.com/dadymazz/ACTAM-2025-26-EUCLIDEAN-SEQUENCER/main/samples/RimShot.wav",
};

//Security Timeout
setTimeout(() => {
    if (!players.loaded) {
        statusEl.textContent = "Audio Loading Slow... (Press Start Anyway)";
        statusEl.style.color = "#e67e22";
    }
}, 3000);


/* =================================================================
   APP FOUNDAMENTAL DATA STRUCTURES
   ================================================================= */
const tracks = [
    { id: 0, colorVar: '--track-1', radius: 260, steps: 16, pulses: 4, offset: 0, sample: 'Kick', pattern: [], playingIdx: -1, timer: null },
    { id: 1, colorVar: '--track-2', radius: 200, steps: 12, pulses: 5, offset: 0, sample: 'Snare', pattern: [], playingIdx: -1, timer: null },
    { id: 2, colorVar: '--track-3', radius: 140, steps: 8, pulses: 3, offset: 0, sample: 'ClosedHat', pattern: [], playingIdx: -1, timer: null },
    { id: 3, colorVar: '--track-4', radius: 80, steps: 5, pulses: 2, offset: 0, sample: 'MidTom', pattern: [], playingIdx: -1, timer: null }
];
tracks.forEach(track => {
    track.velocity = new Array(track.steps).fill(100); // Initialize the velocity to 100 for each step
});


tracks.forEach(track => {
    track.gainNode = new Tone.Gain(1).connect(masterPanner);
});


// Player creation
const players = new Tone.Players(samples, {
    onload: () => {
        statusEl.textContent = "AUDIO READY";
        statusEl.style.color = "#2ecc71";
        console.log("Audio buffers loaded!");
    }
});

// Player pool for overlapping playback
const playerPools = {};
const poolCounters = {}; // to keep track for same 

Object.keys(samples).forEach((sampleKey, idx) => {
    playerPools[sampleKey] = [];
    for (let i = 0; i < 4; i++) {
        // Crea un gain dedicato per ogni player
        const playerGain = new Tone.Gain(1).connect(masterPanner);
        const p = new Tone.Player(samples[sampleKey]).connect(playerGain);
        p._gainNode = playerGain;
        playerPools[sampleKey].push(p);
    }
});

// Connect each player to its track's gain node
Object.keys(samples).forEach((sampleKey, idx) => {
    if (players.has(sampleKey) && tracks[idx]) {
        players.player(sampleKey).connect(tracks[idx].gainNode);
    }
});



let currentVelocityTrack = 0;
let isPlaying = false;

/* =================================================================
   KNOB CLASS
   ================================================================= */
class Knob {
    constructor(container, label, min, max, initialValue, colorVar, callback, step = 1, blockDuringPlayback = false) {
        this.container = container;
        this.min = min;
        this.max = max;
        this.value = initialValue;
        this.callback = callback;
        this.step = step;
        this.blockDuringPlayback = blockDuringPlayback;

        // define starting angles
        this.minAngle = -135;
        this.maxAngle = 135;
        this.indicatorColor = `var(${colorVar})`;

        // initialize dom
        this.wrapper = document.createElement('div');
        this.wrapper.className = 'knob-container';
        this.wrapper.innerHTML = `
      <div class="label-display">${label}</div>
      <div class="knob-wrapper">
        <div class="knob">
          <div class="knob-indicator" style="background:${this.indicatorColor}"></div>
        </div>
      </div>
      <div class="value-display">${this.value}</div>
    `;
        this.container.appendChild(this.wrapper);

        this.knobEl = this.wrapper.querySelector('.knob');
        this.indicatorEl = this.wrapper.querySelector('.knob-indicator');
        this.displayEl = this.wrapper.querySelector('.value-display');

        // dragging 
        this.dragging = false;
        this.startY = 0;
        this.startValue = 0;

        this.attachEvents();
        this.updateUI();
    }

    attachEvents() {
        this.knobEl.addEventListener('pointerdown', (e) => {
            if (isPlaying && this.blockDuringPlayback) {
                this.knobEl.style.cursor = 'not-allowed';
                return
            }
            this.dragging = true;
            this.startY = e.clientY;
            this.startValue = this.value;
            this.knobEl.setPointerCapture(e.pointerId);
            this.knobEl.style.cursor = 'grabbing';
        });

        this.knobEl.addEventListener('pointerup', (e) => {
            this.dragging = false;
            this.knobEl.releasePointerCapture(e.pointerId);
            this.knobEl.style.cursor = 'ns-resize';
        });

        this.knobEl.addEventListener('pointermove', (e) => {
            if (!this.dragging) return;

            const deltaY = this.startY - e.clientY;
            const range = this.max - this.min;
            const pixelsForFullRotation = 300;
            const valuePerPixel = range / pixelsForFullRotation;
            const valueChange = deltaY * valuePerPixel;
            let newValue = this.startValue + valueChange;

            if (this.step === 1) {
                newValue = Math.round(newValue);
            } else {
                newValue = Math.round(newValue / this.step) * this.step;
            }

            this.setValue(newValue);
        });
    }

    // VALUE BY ANGLE

    setValue(val) {
        this.value = Math.max(this.min, Math.min(this.max, val));
        this.updateUI();
        if (this.callback) this.callback(this.value);
    }

    updateLimits(min, max) {
        this.min = min; this.max = max;
        if (this.value > max) this.setValue(max);
        if (this.value < min) this.setValue(min);
    }

    updateUI() {
        const range = this.max - this.min;
        const angleRange = this.maxAngle - this.minAngle;

        let percent = 0;
        if (range > 0) percent = (this.value - this.min) / range;

        const angle = this.minAngle + (percent * angleRange);
        this.indicatorEl.style.transform = `translateX(-50%) rotate(${angle}deg)`;
        this.displayEl.textContent = (this.step === 1) ? this.value : this.value.toFixed(2);
    }
}

/* =================================================================
   PRESET DEFINITION
   ================================================================= */
const presets = {
    dub_techno: {

        bpm: 118,
        tracks: [

            { steps: 16, pulses: 4, offset: 0, sample: 'Kick', adsr: { attack: 0.01, decay: 0.3, sustain: 0.8, release: 0.2 } },

            { steps: 16, pulses: 3, offset: 2, sample: 'LowTom', adsr: { attack: 0.05, decay: 0.1, sustain: 0.4, release: 0.8 } },

            { steps: 16, pulses: 16, offset: 0, sample: 'Ride', adsr: { attack: 0.02, decay: 0.1, sustain: 0.3, release: 0.6 } },

            { steps: 12, pulses: 5, offset: 6, sample: 'RimShot', adsr: { attack: 0.001, decay: 0.05, sustain: 0.1, release: 0.05 } }
        ]
    },
    minimal: {

        bpm: 126,
        tracks: [
            { steps: 16, pulses: 4, offset: 0, sample: 'Kick', adsr: { attack: 0.001, decay: 0.1, sustain: 0.6, release: 0.1 } },

            { steps: 16, pulses: 2, offset: 4, sample: 'RimShot', adsr: { attack: 0.001, decay: 0.05, sustain: 0.1, release: 0.02 } },

            { steps: 13, pulses: 9, offset: 2, sample: 'ClosedHat', adsr: { attack: 0.001, decay: 0.03, sustain: 0.0, release: 0.03 } },

            { steps: 32, pulses: 3, offset: 16, sample: 'MidTom', adsr: { attack: 0.01, decay: 0.1, sustain: 0.2, release: 0.1 } }
        ]
    },
    jungle: {

        bpm: 165,
        tracks: [
            { steps: 16, pulses: 7, offset: 0, sample: 'Kick', adsr: { attack: 0.01, decay: 0.2, sustain: 0.6, release: 0.2 } },

            { steps: 16, pulses: 5, offset: 2, sample: 'Snare', adsr: { attack: 0.01, decay: 0.1, sustain: 0.4, release: 0.1 } },

            { steps: 8, pulses: 6, offset: 1, sample: 'ClosedHat', adsr: { attack: 0.005, decay: 0.05, sustain: 0.1, release: 0.05 } },

            { steps: 16, pulses: 4, offset: 2, sample: 'OpenHat', adsr: { attack: 0.01, decay: 0.1, sustain: 0.4, release: 0.3 } }
        ]
    },
    poly_groove: {

        bpm: 112,
        tracks: [
            { steps: 5, pulses: 2, offset: 0, sample: 'Kick', adsr: { attack: 0.01, decay: 0.2, sustain: 0.5, release: 0.2 } },
            { steps: 7, pulses: 3, offset: 1, sample: 'LowTom', adsr: { attack: 0.01, decay: 0.2, sustain: 0.6, release: 0.3 } },
            { steps: 11, pulses: 4, offset: 3, sample: 'MidTom', adsr: { attack: 0.01, decay: 0.15, sustain: 0.5, release: 0.2 } },
            { steps: 13, pulses: 5, offset: 5, sample: 'RimShot', adsr: { attack: 0.001, decay: 0.05, sustain: 0.2, release: 0.05 } }
        ]
    },
    tarantella: {
        bpm: 155, // Veloce e terzinato
        tracks: [
            // Kick su battito 1 e 4 (simulazione 6/8 usando 12 steps)
            { steps: 12, pulses: 2, offset: 0, sample: 'Kick', adsr: { attack: 0.01, decay: 0.1, sustain: 0.6, release: 0.1 } },
            // Tamburello/Rim in controtempo terzinato
            { steps: 12, pulses: 4, offset: 1, sample: 'RimShot', adsr: { attack: 0.001, decay: 0.05, sustain: 0.2, release: 0.05 } },
            // HiHat continuo per dare il "treno"
            { steps: 12, pulses: 12, offset: 0, sample: 'ClosedHat', adsr: { attack: 0.001, decay: 0.03, sustain: 0.1, release: 0.02 } },
            // Accento sul Tom
            { steps: 24, pulses: 2, offset: 6, sample: 'LowTom', adsr: { attack: 0.01, decay: 0.2, sustain: 0.4, release: 0.2 } }
        ]
    },
    reggae: {
        bpm: 70, // One Drop lento
        tracks: [
            // One Drop: La cassa non suona sull'1, ma sul 3.
            { steps: 16, pulses: 1, offset: 8, sample: 'Kick', adsr: { attack: 0.01, decay: 0.3, sustain: 0.7, release: 0.5 } },
            // Rimshot secco in sync con la cassa o in levare
            { steps: 16, pulses: 2, offset: 4, sample: 'RimShot', adsr: { attack: 0.001, decay: 0.05, sustain: 0.2, release: 0.05 } },
            // Skank (chitarra/piano) simulato con HiHat o Tom sugli off-beat
            { steps: 16, pulses: 8, offset: 2, sample: 'ClosedHat', adsr: { attack: 0.005, decay: 0.05, sustain: 0.1, release: 0.05 } },
            // Fill di Tom rilassato
            { steps: 12, pulses: 2, offset: 0, sample: 'MidTom', adsr: { attack: 0.01, decay: 0.2, sustain: 0.3, release: 0.2 } }
        ]
    },
    reggaeton: {
        bpm: 96, // Classico Dem Bow
        tracks: [
            // Cassa dritta "Four on the floor"
            { steps: 16, pulses: 4, offset: 0, sample: 'Kick', adsr: { attack: 0.01, decay: 0.2, sustain: 0.8, release: 0.2 } },
            // Il classico ritmo Dem Bow (3-3-2 approx euclidea)
            { steps: 16, pulses: 3, offset: 2, sample: 'Snare', adsr: { attack: 0.01, decay: 0.15, sustain: 0.5, release: 0.1 } },
            // HiHat sincopato
            { steps: 16, pulses: 6, offset: 1, sample: 'ClosedHat', adsr: { attack: 0.001, decay: 0.05, sustain: 0.1, release: 0.05 } },
            // Percussioni aggiuntive
            { steps: 32, pulses: 5, offset: 4, sample: 'LowTom', adsr: { attack: 0.01, decay: 0.1, sustain: 0.3, release: 0.1 } }
        ]
    },
    breakbeat: {
        bpm: 134, // Funky break
        tracks: [
            // Kick sincopato (non sull'1, 2, 3, 4 precisi)
            { steps: 16, pulses: 5, offset: 0, sample: 'Kick', adsr: { attack: 0.01, decay: 0.2, sustain: 0.7, release: 0.2 } },
            // Snare sul 2 e sul 4 (Backbeat solido)
            { steps: 16, pulses: 2, offset: 4, sample: 'Snare', adsr: { attack: 0.01, decay: 0.2, sustain: 0.6, release: 0.2 } },
            // Ghost notes sui piatti
            { steps: 16, pulses: 10, offset: 2, sample: 'ClosedHat', adsr: { attack: 0.001, decay: 0.03, sustain: 0.1, release: 0.03 } },
            // Ride in poliritmia
            { steps: 12, pulses: 4, offset: 0, sample: 'Ride', adsr: { attack: 0.05, decay: 0.3, sustain: 0.4, release: 0.5 } }
        ]
    },
    drill: {
        bpm: 142, // Dark e Half-time
        tracks: [
            // Kick molto rado e sincopato
            { steps: 16, pulses: 3, offset: 0, sample: 'Kick', adsr: { attack: 0.01, decay: 0.3, sustain: 0.8, release: 0.4 } },
            // Snare spostato (spesso sul beat 3 o in ritardo)
            { steps: 16, pulses: 2, offset: 8, sample: 'Snare', adsr: { attack: 0.01, decay: 0.1, sustain: 0.5, release: 0.1 } },
            // HiHats in terzine "skipping" (Drill signatures) - Usiamo 12 steps per le terzine
            { steps: 12, pulses: 7, offset: 2, sample: 'ClosedHat', adsr: { attack: 0.001, decay: 0.04, sustain: 0.1, release: 0.02 } },
            // Counter-snare o perc scura
            { steps: 16, pulses: 2, offset: 11, sample: 'RimShot', adsr: { attack: 0.001, decay: 0.05, sustain: 0.2, release: 0.05 } }
        ]
    },
    custom: {
        bpm: 120,
        tracks: [
            { steps: 16, pulses: 4, offset: 0, sample: 'Kick', adsr: { attack: 0.01, decay: 0.1, sustain: 0.7, release: 0.2 } },
            { steps: 16, pulses: 0, offset: 0, sample: 'Ride', adsr: { attack: 0.01, decay: 0.1, sustain: 0.7, release: 0.2 } },
            { steps: 16, pulses: 0, offset: 0, sample: 'RimShot', adsr: { attack: 0.01, decay: 0.1, sustain: 0.7, release: 0.2 } },
            { steps: 16, pulses: 0, offset: 0, sample: 'LowTom', adsr: { attack: 0.01, decay: 0.1, sustain: 0.7, release: 0.2 } }
        ]
    }
};
let currentPreset = 'custom';

// apply preset function
function applyPreset(presetName) {
    const preset = presets[presetName];
    if (!preset) return;

    // Stop sequencer if playing
    if (isPlaying) stopSequencer();

    // Update BPM
    document.getElementById('bpm').value = preset.bpm;

    // Update tracks
    preset.tracks.forEach((presetTrack, idx) => {
        const track = tracks[idx];
        track.steps = presetTrack.steps;
        track.pulses = presetTrack.pulses;
        track.offset = presetTrack.offset;
        track.sample = presetTrack.sample;
        track.adsr = { ...presetTrack.adsr };
        regenerateTrack(track);
    });

    // update KNOBS accordingly to the preset
    preset.tracks.forEach((presetTrack, idx) => {
        const track = tracks[idx];
        if (track.stepsKnob) {
            track.stepsKnob.setValue(track.steps);
        }
        if (track.pulsesKnob) {
            track.pulsesKnob.updateLimits(0, track.steps);
            track.pulsesKnob.setValue(track.pulses);
        }
        if (track.offsetKnob) {
            track.offsetKnob.updateLimits(0, Math.max(0, track.steps - 1));
            track.offsetKnob.setValue(track.offset);
        }
    });


    // Update sample accordingly to the preset
    preset.tracks.forEach((_, idx) => {
        const track = tracks[idx];
        const sel = track.sampleSelect;
        if (sel) {
            if (![...sel.options].some(o => o.value === track.sample)) {
                const opt = document.createElement('option');
                opt.value = track.sample;
                opt.innerText = track.sample;
                sel.appendChild(opt);
            }
            sel.value = track.sample;
            sel.dispatchEvent(new Event('change'));
        }
    });


    // update velocity and adsr
    renderVelocityBars();
    renderAdsrKnobs();

    // Update button state
    document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-preset') === presetName) {
            btn.classList.add('active');
        }
    });

    currentPreset = presetName;
    statusEl.textContent = `PRESET: ${presetName.toUpperCase()}`;
    statusEl.style.color = "#cecece";
}

// Preset button bindings
document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const presetName = btn.getAttribute('data-preset');
        applyPreset(presetName);
    });
});

/* =================================================================
   UI GENERATION
   ================================================================= */
//velocity bars rendering
const velocityBarsContainer = document.getElementById('velocityBars');

function renderVelocityBars() {
    const track = tracks[currentVelocityTrack];
    velocityBarsContainer.innerHTML = '';
    if (!track.pattern || track.pattern.length === 0) return;

    for (let i = 0; i < track.steps; i++) {
        const container = document.createElement('div');
        container.className = `velocity-bar-container track-${currentVelocityTrack}`;
        container.setAttribute('data-step', i);

        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = 0;
        slider.max = 127;
        slider.value = track.velocity[i];
        slider.className = 'velocity-slider';

        //double click reset
        slider.addEventListener('dblclick', () => {
            track.velocity[i] = 100;
            slider.value = 100;

            // velocity value display update
            const valDisplay = container.querySelector('.velocity-value');
            if (valDisplay) valDisplay.textContent = track.velocity[i];
        });

        // not useful slider disabling 
        if (track.pattern[i] === 0) {
            slider.classList.add('inactive-slider');
        }


        slider.addEventListener('input', (e) => {
            track.velocity[i] = parseInt(e.target.value);
            const valDisplay = container.querySelector('.velocity-value');
            if (valDisplay) valDisplay.textContent = track.velocity[i];
        });

        // velocity lable
        const label = document.createElement('div');
        label.className = 'velocity-label';
        label.textContent = i + 1;

        const valueDisplay = document.createElement('div');
        valueDisplay.className = 'velocity-value';
        valueDisplay.textContent = track.velocity[i];

        container.appendChild(slider);
        container.appendChild(label);
        container.appendChild(valueDisplay);
        velocityBarsContainer.appendChild(container);
    }
}


// ASDR section rendering
const adsrDefaults = { attack: 0.01, decay: 0.1, sustain: 0.7, release: 0.2 };
tracks.forEach(track => {
    track.adsr = { ...adsrDefaults };
});

let currentAdsrTrack = 0;

const adsrKnobsContainer = document.getElementById('adsrKnobs');
const adsrParams = [
    { key: 'attack', label: 'ATTACK', min: 0.005, max: 2, step: 0.01 },
    { key: 'decay', label: 'DECAY', min: 0, max: 2, step: 0.01 },
    { key: 'sustain', label: 'SUSTAIN', min: 0, max: 1, step: 0.01 },
    { key: 'release', label: 'RELEASE', min: 0.01, max: 3, step: 0.01 }
];

//ADSR knobs
function renderAdsrKnobs() {
    adsrKnobsContainer.innerHTML = '';
    const track = tracks[currentAdsrTrack];
    adsrParams.forEach(param => {
        const knobDiv = document.createElement('div');
        //Small knob definition
        knobDiv.className = 'knob-container small';
        new Knob(
            knobDiv,
            param.label,
            param.min,
            param.max,
            track.adsr[param.key],
            track.colorVar,
            (v) => {
                track.adsr[param.key] = v;
            },
            param.step,
        );
        adsrKnobsContainer.appendChild(knobDiv);
    });
}

function initAdsrPanel() {
    const adsrTrackSelect = document.getElementById('adsrTrackSelect');
    adsrTrackSelect.addEventListener('change', (e) => {
        currentAdsrTrack = parseInt(e.target.value);
        renderAdsrKnobs();
    });
    renderAdsrKnobs();
}

// ADSR LOGIC: apply att. dec. sust. rel. to the gain 
function triggerEnvelope(gain, time, velocity, adsr, gainValue) {
    // clean eventual envelope
    gain.cancelScheduledValues(time);

    // reset (gain = 0 at time start)
    gain.setValueAtTime(0, time);

    // values calculation
    const peakValue = velocity * gainValue;
    const sustainValue = peakValue * adsr.sustain;

    // times calculation
    const attackEndTime = time + adsr.attack;
    const decayEndTime = attackEndTime + adsr.decay;
    // 50 ms hold before release
    const releaseStartTime = decayEndTime + 0.05;
    const releaseEndTime = releaseStartTime + adsr.release;

    // ramping for ATTACK
    gain.linearRampToValueAtTime(peakValue, attackEndTime);

    // ramping for DECAY
    gain.linearRampToValueAtTime(sustainValue, decayEndTime);

    //hold 
    gain.setValueAtTime(sustainValue, releaseStartTime);

    // ramp for RELEASE
    gain.linearRampToValueAtTime(0, releaseEndTime);
}
/* =================================================================
   VELOCITY PAINTING 
   ================================================================= */

let isDrawingVelocity = false;

// X/Y axist to velocity mapping
function updateVelocityFromPointer(e) {
    const track = tracks[currentVelocityTrack];
    const rect = velocityBarsContainer.getBoundingClientRect();

    // calculate the step we're touching
    const relativeX = e.clientX - rect.left;
    const stepWidth = rect.width / track.steps;

    let stepIndex = Math.floor(relativeX / stepWidth);

    // limit to 127
    stepIndex = Math.max(0, Math.min(stepIndex, track.steps - 1));

    // calculate velocity value
    const relativeY = e.clientY - rect.top;

    // normalize on 0-1 value range (to use with tone.js)
    let normalizedVal = 1 - (relativeY / rect.height);

    // clamping on vertical constraints (non usciamo dai bordi verticali)
    normalizedVal = Math.max(0, Math.min(normalizedVal, 1));

    const newVelocity = Math.round(normalizedVal * 127);

    // update velocyty per step
    track.velocity[stepIndex] = newVelocity;

    //new velocity value display
    const stepContainer = velocityBarsContainer.children[stepIndex];
    if (stepContainer) {
        const slider = stepContainer.querySelector('.velocity-slider');
        const display = stepContainer.querySelector('.velocity-value');

        if (slider) slider.value = newVelocity;
        if (display) display.textContent = newVelocity;
    }
}


function initVelocityPanel() {
    const velocityTrackSelect = document.getElementById('velocityTrackSelect');

    // header selection
    velocityTrackSelect.addEventListener('change', (e) => {
        currentVelocityTrack = parseInt(e.target.value);
        renderVelocityBars();
    });
    // velocity drawing start
    velocityBarsContainer.addEventListener('mousedown', (e) => {
        isDrawingVelocity = true;
        updateVelocityFromPointer(e);
    });
    window.addEventListener('mousemove', (e) => {
        if (isDrawingVelocity) {
            e.preventDefault();
            updateVelocityFromPointer(e);
        }
    });

    // Drawing event end
    window.addEventListener('mouseup', () => {
        isDrawingVelocity = false;
    });

    renderVelocityBars();
}

// INITINTERFACE (SEQUENCE CONTROLS AND ACTIONS)
function initInterface() {
    const trackTitles = [
        { label: "Sequence 1 (Outer)", color: "var(--track-1)" },
        { label: "Sequence 2", color: "var(--track-2)" },
        { label: "Sequence 3", color: "var(--track-3)" },
        { label: "Sequence 4 (Inner)", color: "var(--track-4)" }
    ];
    tracks.forEach((track, index) => {
        const trackContainer = document.getElementById(`track-${index}`);

        // Colored title
        const header = document.createElement('div');
        header.className = 'track-title';
        header.textContent = trackTitles[index].label;
        header.style.color = trackTitles[index].color;
        trackContainer.appendChild(header);

        // Steps knob row
        const stepsRow = document.createElement('div');
        stepsRow.className = 'knob-row';
        stepsRow.innerHTML = `<div class="knob-label">Steps</div>`;
        stepsRow.appendChild(document.createElement('div'));
        trackContainer.appendChild(stepsRow);

        // Pulses knob row
        const pulsesRow = document.createElement('div');
        pulsesRow.className = 'knob-row';
        pulsesRow.innerHTML = `<div class="knob-label">Pulses</div>`;
        pulsesRow.appendChild(document.createElement('div'));
        trackContainer.appendChild(pulsesRow);

        // Offset knob row
        const offsetRow = document.createElement('div');
        offsetRow.className = 'knob-row';
        offsetRow.innerHTML = `<div class="knob-label">Offset</div>`;
        offsetRow.appendChild(document.createElement('div'));
        trackContainer.appendChild(offsetRow);

        // Gain knob row
        const gainRow = document.createElement('div');
        gainRow.className = 'knob-row';
        gainRow.innerHTML = `<div class="knob-label">Gain</div>`;
        gainRow.appendChild(document.createElement('div'));
        trackContainer.appendChild(gainRow);
        const gainKnob = new Knob(gainRow.lastChild, 'GAIN', 0, 2, 1, track.colorVar, (v) => {
            track.gainNode.gain.value = v;
        }, 0.01);

        // RESET GAIN when double click
        gainKnob.knobEl.addEventListener('dblclick', () => {
            gainKnob.setValue(1.00);
        });


        // Sound select + file input
        const soundGroup = document.createElement('div');
        soundGroup.className = 'standard-input-group';
        soundGroup.style.marginTop = "10px";
        soundGroup.innerHTML = `<label>Sound</label>`;
        const select = document.createElement('select');
        Object.keys(samples).forEach(key => {
            const opt = document.createElement('option');
            opt.value = key;
            opt.innerText = key.charAt(0).toUpperCase() + key.slice(1);
            if (key === track.sample) opt.selected = true;
            select.appendChild(opt);
        });
        soundGroup.appendChild(select)

        track.sampleSelect = select;


        // File input per sample custom
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'audio/*';
        fileInput.style.display = 'none';

        // custom button 
        const customLoadBtn = document.createElement('button');
        customLoadBtn.textContent = "LOAD SAMPLE";
        customLoadBtn.className = 'custom-file-btn';
        customLoadBtn.addEventListener('click', () => {
            fileInput.click();
        });
        soundGroup.appendChild(customLoadBtn);
        soundGroup.appendChild(fileInput);

        trackContainer.appendChild(soundGroup);

        // sequence knobs logic
        const stepsK = new Knob(stepsRow.lastChild, 'STEPS', 1, 32, track.steps, track.colorVar, (v) => {
            track.steps = v;
            pulsesK.updateLimits(0, track.steps);
            offsetK.updateLimits(0, track.steps - 1);
            regenerateTrack(track);
            if (currentVelocityTrack === index) {
                renderVelocityBars();
            }
        }, 1, true);

        const pulsesK = new Knob(pulsesRow.lastChild, 'PULSES', 0, track.steps, track.pulses, track.colorVar, (v) => {
            track.pulses = v;
            regenerateTrack(track);

            if (currentVelocityTrack === index) {
                renderVelocityBars();
            }
        });
        const offsetK = new Knob(offsetRow.lastChild, 'OFFSET', 0, track.steps - 1, track.offset, track.colorVar, (v) => {
            track.offset = v;
            regenerateTrack(track);

            if (currentVelocityTrack === index) {
                renderVelocityBars();
            }
        });


        track.stepsKnob = stepsK;
        track.pulsesKnob = pulsesK;
        track.offsetKnob = offsetK;


        // change player
        select.addEventListener('change', async (e) => {
            track.sample = e.target.value;
            // ensure tone.js is active
            if (Tone.context.state !== 'running') {
                await Tone.start();
            }
            // user sample preview
            if (track.sample.startsWith('user_') && track.customPlayer) {
                // Connect if needed (safety check)
                if (track.customPlayerGain) { track.customPlayer.connect(track.customPlayerGain) };
                track.customPlayer.start();
            }
            // native samples preview
            else if (players.has(track.sample)) {
                const previewPlayer = players.player(track.sample);
                // force connection 
                previewPlayer.connect(track.gainNode);
                // check if not loaded say waiting
                if (previewPlayer.loaded) {
                    previewPlayer.start();
                } else {
                    console.log("Sample still loading...");
                }
            }
        });
        // sample custom load
        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            if (!file.type.startsWith('audio/')) {
                statusEl.textContent = "File non audio!";
                statusEl.style.color = "#e74c3c";
                return;
            }

            statusEl.textContent = "Loading...";
            statusEl.style.color = "#fff";
            const url = URL.createObjectURL(file);
            const userSampleName = `user_${track.id}_${Date.now()}`;

            try {
                const customGain = new Tone.Gain(1).connect(masterPanner);
                const customPlayer = new Tone.Player(url).connect(customGain);

                // waiting for loading buffer
                await customPlayer.load(url);

                // remove old user sample
                if (track.userSampleOpt) {
                    select.removeChild(track.userSampleOpt);
                    track.userSampleOpt = null;
                }

                // desconnect old custom plauer (if not buffer crash)
                if (track.customPlayer) {
                    track.customPlayer.dispose();
                }

                // set new sample
                track.customPlayer = customPlayer;
                track.customPlayerGain = customGain;
                track.sample = userSampleName;

                // new user sample option
                track.userSampleOpt = document.createElement('option');
                track.userSampleOpt.value = userSampleName;
                track.userSampleOpt.innerText = "User Sample";
                select.appendChild(track.userSampleOpt);
                select.value = userSampleName;

                // trigger when ready 
                if (Tone.context.state !== 'running') {
                    await Tone.start();
                }
                if (track.customPlayer._envelope) {
                    // standard envelope for review
                    track.customPlayer._envelope.attack = 0.01;
                    track.customPlayer._envelope.decay = 0.5;
                    track.customPlayer._envelope.sustain = 1;
                    track.customPlayer._envelope.release = 1;

                    track.customPlayer._envelope.triggerAttackRelease(0.5);
                }

                track.customPlayer.start();

                statusEl.textContent = "Sample loaded!";
                statusEl.style.color = "#2ecc71";
                URL.revokeObjectURL(url);

            } catch (err) {
                console.error("Errore caricamento sample:", err);
                statusEl.textContent = "Sample load error: " + err.message;
                statusEl.style.color = "#e74c3c";
                URL.revokeObjectURL(url);
            }
        });
        regenerateTrack(track);
    });
}
/* =================================================================
   MATH & DRAW
   ================================================================= */
//fundamental math for pattern
function generateEuclideanPattern(steps, pulses) {
    if (pulses >= steps) return Array(steps).fill(1);
    if (pulses <= 0) return Array(steps).fill(0);
    let divisor = steps - pulses;
    let remainders = [pulses];
    let counts = [];
    let level = 0;
    while (remainders[level] > 1) {
        counts.push(Math.floor(divisor / remainders[level]));
        remainders.push(divisor % remainders[level]);
        divisor = remainders[level];
        level++;
    }
    counts.push(divisor);
    function build(l) {
        if (l === -1) return [0];
        if (l === -2) return [1];
        let res = [];
        let seq = build(l - 1);
        let alt = build(l - 2);
        for (let i = 0; i < counts[l]; i++) res = res.concat(seq);
        if (remainders[l] !== 0) res = res.concat(alt);
        return res;
    }
    return build(level).slice(0, steps);
}

function rotateArray(arr, shift) {
    const n = arr.length;
    if (n === 0) return arr;
    shift = ((shift % n) + n) % n;
    return arr.slice(-shift).concat(arr.slice(0, -shift));
}

// regeneratetrack call the function to modify/regenerate array pattern
function regenerateTrack(track) {
    let pat = generateEuclideanPattern(track.steps, track.pulses);
    track.pattern = rotateArray(pat, track.offset);



    const oldVelocity = track.velocity || [];
    const oldLength = oldVelocity.length;
    const newLength = track.steps;

    if (newLength > oldLength) {
        track.velocity = [...oldVelocity, ...new Array(newLength - oldLength).fill(100)];
    } else if (newLength < oldLength) {
        track.velocity = oldVelocity.slice(0, newLength);
    }

    drawAllCircles();
}

const tracksGroup = document.getElementById('tracksGroup');

/* =================================================================
   CIRCLES DRAWING
   ================================================================= */

function polarPos(i, totalSteps, radius) {
    const angle = (2 * Math.PI * i / totalSteps) - Math.PI / 2;
    return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
}

function drawAllCircles() {
    tracksGroup.innerHTML = '';
    tracks.forEach((track, tIdx) => {
        // svg
        const guide = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        guide.setAttribute("r", track.radius);
        guide.setAttribute("class", "guide");
        guide.style.stroke = "rgba(255, 255, 255, 0.5)";
        tracksGroup.appendChild(guide);

        // Dots
        for (let i = 0; i < track.steps; i++) {
            const p = polarPos(i, track.steps, track.radius);
            const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");

            dot.setAttribute("cx", p.x);
            dot.setAttribute("cy", p.y);
            dot.setAttribute("r", track.pattern[i] ? 6 : 4.5);

            let className = "dot";
            if (track.pattern[i]) className += ` t${tIdx}-fill`;

            dot.style.opacity = track.pattern[i] ? 0.9 : 0.5;
            if (!track.pattern[i]) dot.style.fill = "#ffffff8a";

            dot.setAttribute("class", className);
            dot.id = `dot-${tIdx}-${i}`;

            // Manual Toggle modify array
            dot.onclick = () => {
                track.pattern[i] = track.pattern[i] ? 0 : 1;
                drawAllCircles();

                // velocity bars activity update
                if (tIdx === currentVelocityTrack) {
                    renderVelocityBars();
                }
            };

            tracksGroup.appendChild(dot);
        }
    });
}
/* =================================================================
   SEQUENCER ENGINE (MCM and CLOCK) -- Tone.Transport
   ================================================================= */
let globalStep = 0;
let transportEventId = null;

// main clock/sequencing function
function playStep(time) {
    // mcm calculation
    const stepsPerBar = tracks.reduce((acc, t) => lcm(acc, t.steps), 1);

    tracks.forEach((track, tIdx) => {
        const division = stepsPerBar / track.steps;
        if (globalStep % division === 0) {
            const stepIdx = (globalStep / division) % track.steps;
            track.playingIdx = stepIdx;

            // Visuals
            for (let i = 0; i < track.steps; i++) {
                const d = document.getElementById(`dot-${track.id}-${i}`);
                if (d) d.classList.remove('playing');
            }
            const currentDot = document.getElementById(`dot-${track.id}-${stepIdx}`);
            if (currentDot) {
                currentDot.classList.add('playing');
                if (track.pattern[stepIdx]) {
                    currentDot.style.r = 9;
                    setTimeout(() => currentDot.style.r = 6, 80);
                }
            }

            // Audio Trigger
            if (track.pattern[stepIdx] === 1) {
                const velocity = track.velocity[stepIdx] / 127; // velocity normalization


                // check which player 
                if (track.sample.startsWith('user_') && track.customPlayer && track.customPlayerGain) {

                    triggerEnvelope(track.customPlayerGain.gain, time, velocity, track.adsr, track.gainNode.gain.value);
                    track.customPlayer.start(time);
                }
                else if (players.loaded && players.has(track.sample)) {
                    const pool = playerPools[track.sample];

                    // controls if the pool exists and has a player connected
                    if (pool && pool.length > 0) {

                        //if the counter doesn't exist we create that now to 0
                        if (typeof poolCounters[track.sample] === 'undefined') {
                            poolCounters[track.sample] = 0;
                        }

                        // index recovery
                        let currentIdx = poolCounters[track.sample];

                        // player selection
                        const p = pool[currentIdx];

                        // player existence check
                        if (p) {
                            // envelope applied using p._gainNode.gain as a safe destination
                            if (p._gainNode && p._gainNode.gain) {
                                triggerEnvelope(p._gainNode.gain, time, velocity, track.adsr, track.gainNode.gain.value);
                            }

                            // START
                            // If the player is already playing, Tone.js restarts it without errors.
                            p.start(time);

                            // ROTATION
                            // We update the counter for the next hit
                            poolCounters[track.sample] = (currentIdx + 1) % pool.length;

                        }
                    }
                }
            }
        }
    });

    globalStep = (globalStep + 1) % stepsPerBar;
}

// MCM
function gcd(a, b) {
    return b === 0 ? a : gcd(b, a % b);
}
function lcm(a, b) {
    return (a * b) / gcd(a, b);
}

//start/stop sequencer
async function startSequencer() {
    if (isPlaying) return;
    await Tone.start();
    isPlaying = true;
    startBtn.style.background = "#222";
    startBtn.style.color = "#888";
    globalStep = 0;

    const bpm = parseInt(document.getElementById('bpm').value) || 120;
    Tone.Transport.bpm.value = bpm;

    // steps per bar
    const stepsPerBar = tracks.reduce((acc, t) => lcm(acc, t.steps), 1);
    Tone.Transport.PPQ = stepsPerBar;

    // remove previous events
    if (transportEventId !== null) {
        Tone.Transport.clear(transportEventId);
    }

    transportEventId = Tone.Transport.scheduleRepeat(playStep, "4i");
    Tone.Transport.start("+0.05");
}

function stopSequencer() {
    // stop sound from all players when stop
    Object.keys(samples).forEach(sampleKey => {
        if (players.has(sampleKey)) {
            players.player(sampleKey).stop();
        }
    });
    tracks.forEach(track => {
        if (track.customPlayer) {
            track.customPlayer.stop();
        }
    });


    isPlaying = false;
    startBtn.style.background = "#2ecc71";
    startBtn.style.color = "#000";
    if (transportEventId !== null) {
        Tone.Transport.clear(transportEventId);
        transportEventId = null;
    }
    Tone.Transport.stop();
    globalStep = 0;
    tracks.forEach(track => track.playingIdx = -1);
    document.querySelectorAll('.dot').forEach(d => d.classList.remove('playing'));
    drawAllCircles();
}

// Bindings
startBtn.onclick = startSequencer;
document.getElementById('stopBtn').onclick = stopSequencer;

// Spacebar binding
document.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {

        // prevent the browser from scolling when pressing space
        e.preventDefault();

        // toggle play/stop
        if (isPlaying) {
            stopSequencer();
        } else {
            startSequencer();
        }
    }
});


/* =================================================================
   MIDI EXPORT ENGINE
   ================================================================= */

const exportBtn = document.getElementById('exportBtn');

function downloadMIDI(options) {
    //check if library is loaded
    if (typeof MidiWriter === 'undefined') {
        alert("Errore critico: Libreria MidiWriter non caricata.");
        return;
    }

    // options setup
    const settings = {
        velocity: (options && options.velocity !== undefined) ? options.velocity : true,
        selectedTracks: (options && options.selectedTracks) ? options.selectedTracks : [0, 1, 2, 3]
    };

    // alert no selection
    if (settings.selectedTracks.length === 0) {
        alert("Nessuna traccia selezionata.");
        return;
    }

    const TICKS_PER_BAR = 512;
    const BARS_TO_EXPORT = 4;
    const currentBpm = parseInt(document.getElementById('bpm').value) || 120;

    //tracks array
    const midiTracks = [];

    // iteration for download for each selected track
    settings.selectedTracks.forEach((tIdx, index) => {

        const t = tracks[tIdx];
        if (!t) return;

        // creation midi track
        const track = new MidiWriter.Track();
        track.addTrackName(`Seq ${tIdx + 1} - ${t.sample.toUpperCase()}`);
        track.setTempo(currentBpm);
        track.setTimeSignature(4, 4);

        //fix note as C3
        const noteNumber = 60;

        const totalStepsToExport = t.steps * BARS_TO_EXPORT;
        let waitBuffer = 0;

        // midi creation 
        for (let i = 0; i < totalStepsToExport; i++) {
            const patternIdx = i % t.steps;
            const isActive = t.pattern[patternIdx] === 1;

            const absStartBar = i / t.steps;
            const absEndBar = (i + 1) / t.steps;
            const tickStart = Math.round(absStartBar * TICKS_PER_BAR);
            const tickEnd = Math.round(absEndBar * TICKS_PER_BAR);
            const currentStepDuration = tickEnd - tickStart;

            if (isActive) {
                const finalVelocity = settings.velocity ? (t.velocity[patternIdx] || 100) : 100;

                track.addEvent(new MidiWriter.NoteEvent({
                    pitch: [noteNumber],
                    duration: 'T' + currentStepDuration,
                    wait: 'T' + waitBuffer,
                    channel: 10,
                    velocity: finalVelocity
                }));
                waitBuffer = 0;
            } else {
                waitBuffer += currentStepDuration;
            }
        }

        // add tracks to export array
        midiTracks.push(track);
    });
    // download file
    try {
        // define writer for every track
        const writer = new MidiWriter.Writer(midiTracks);
        const blob = new Blob([writer.buildFile()], { type: "audio/midi" });



        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);

        // project name file
        let filename = `Actam_Project`;
        filename += settings.velocity ? "_vel.mid" : ".mid";

        a.download = filename;
        document.body.appendChild(a);
        a.click();

        // Cleanup variables
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(a.href);
        }, 100);



    } catch (e) {
        console.error("Errore export MIDI:", e);
        alert("Errore nella generazione del file MIDI.");
    }

}


/* =================================================================
   RESET BUTTON VELOCITY
   ================================================================= */

const globalResetBtn = document.getElementById('resetVelocityBtn');

if (globalResetBtn) {
    globalResetBtn.addEventListener('click', function () {
        console.log("Tasto Reset Premuto!"); // Controllo in console

        // 1. Reset Logico
        if (tracks[currentVelocityTrack] && tracks[currentVelocityTrack].velocity) {
            tracks[currentVelocityTrack].velocity.fill(100);
        }

        // 2. Reset Visivo (Ridisegna le barre)
        // Assicurati che questa funzione sia raggiungibile
        renderVelocityBars();
    });
} else {
    console.error("ERRORE: Il tasto resetVelocityBtn non è stato trovato nell'HTML.");
}

/* =================================================================
   MODALS & BINDINGS 
   ================================================================= */
// define dom modals
const modalOverlay = document.getElementById('midiModal');
const confirmExportBtn = document.getElementById('confirmExportBtn');
const cycleBtns = document.querySelectorAll('.cycle-btn');

// Stato locale della modale
let exportSettings = {
    velocity: true,
    merge: false,
    selectedTracks: [0, 1, 2, 3]
};

// open modals button
if (exportBtn) {
    const newBtn = exportBtn.cloneNode(true);
    if (exportBtn.parentNode) {
        exportBtn.parentNode.replaceChild(newBtn, exportBtn);
        newBtn.addEventListener('click', () => {
            modalOverlay.classList.remove('hidden');
        });
    }
}

// close modal button
modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) {
        modalOverlay.classList.add('hidden');
    }
});

// selector tracks
cycleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        btn.classList.toggle('active');

        const val = parseInt(btn.getAttribute('data-val'));
        const trackId = val - 1;

        if (btn.classList.contains('active')) {
            if (!exportSettings.selectedTracks.includes(trackId)) {
                exportSettings.selectedTracks.push(trackId);
            }
        } else {
            exportSettings.selectedTracks = exportSettings.selectedTracks.filter(id => id !== trackId);
        }

        exportSettings.selectedTracks.sort((a, b) => a - b);
        console.log("Selected Tracks:", exportSettings.selectedTracks);
    });
});

// CONFIRM EXPORT BUTTON
confirmExportBtn.addEventListener('click', () => {
    const options = {
        //velocity check
        velocity: document.getElementById('optVelocity').checked,

        //MERGE PERCHEEEE
        //  merge: document.getElementById('optMerge').checked,
        selectedTracks: exportSettings.selectedTracks
    };

    //console log export
    console.log("Exporting...", options);

    // call download midi
    downloadMIDI(options);

    // close modal when export
    modalOverlay.classList.add('hidden');


});

// Init
applyPreset('custom');
initInterface();
initVelocityPanel();
initAdsrPanel();

/* =================================================================
   WELCOME MODAL 
   ================================================================= */

(function () {
    const welcomeModal = document.getElementById('welcomeModal');
    const welcomeCloseBtn = document.getElementById('welcomeCloseBtn');
    if (!welcomeModal || !welcomeCloseBtn) return;

    // Always show modal on page load
    welcomeModal.classList.remove('hidden');

    welcomeCloseBtn.addEventListener('click', () => {
        welcomeModal.classList.add('hidden');
    });
})();
