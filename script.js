/* =================================================================
   1. AUDIO ENGINE SETUP
   ================================================================= */
const statusEl = document.getElementById('status');
const startBtn = document.getElementById('startBtn');

// Panner centrale
const masterPanner = new Tone.Panner(0).toDestination();

// Lista campioni
const samples = {
    kick: "https://tonejs.github.io/audio/drum-samples/CR78/kick.mp3",
    snare: "https://tonejs.github.io/audio/drum-samples/CR78/snare.mp3",
    hihat: "https://tonejs.github.io/audio/drum-samples/CR78/hihat.mp3",
    tom: "https://tonejs.github.io/audio/drum-samples/CR78/tom1.mp3",
};

// Timeout di sicurezza
setTimeout(() => {
    if (!players.loaded) {
        statusEl.textContent = "Audio Loading Slow... (Press Start Anyway)";
        statusEl.style.color = "#e67e22";
    }
}, 3000);


/* =================================================================
   2. APP STATE
   ================================================================= */
const tracks = [
    { id: 0, colorVar: '--track-1', radius: 260, steps: 16, pulses: 4, offset: 0, sample: 'kick', pattern: [], playingIdx: -1, timer: null },
    { id: 1, colorVar: '--track-2', radius: 200, steps: 12, pulses: 5, offset: 0, sample: 'snare', pattern: [], playingIdx: -1, timer: null },
    { id: 2, colorVar: '--track-3', radius: 140, steps: 8, pulses: 3, offset: 0, sample: 'hihat', pattern: [], playingIdx: -1, timer: null },
    { id: 3, colorVar: '--track-4', radius: 80, steps: 5, pulses: 2, offset: 0, sample: 'tom', pattern: [], playingIdx: -1, timer: null }
];
tracks.forEach(track => {
    track.velocity = new Array(track.steps).fill(100); // Inizializza velocity a 100 per ogni step
});


// Add gain nodes for each track
tracks.forEach(track => {
    track.gainNode = new Tone.Gain(1).connect(masterPanner);
});


// Creiamo i player
const players = new Tone.Players(samples, {
    onload: () => {
        statusEl.textContent = "AUDIO READY";
        statusEl.style.color = "#2ecc71";
        console.log("Audio buffers loaded!");
    }
});

// Player pool for overlapping playback
const playerPools = {};
Object.keys(samples).forEach(sampleKey => {
    playerPools[sampleKey] = [];
    for (let i = 0; i < 4; i++) { // Pool size 4, adjust as needed
        const p = new Tone.Player(samples[sampleKey]).connect(masterPanner);
        playerPools[sampleKey].push(p);
    }
});

// Connect each player to its track's gain node
Object.keys(samples).forEach((sampleKey, idx) => {
    if (players.has(sampleKey) && tracks[idx]) {
        players.player(sampleKey).connect(tracks[idx].gainNode);
    }
});



let currentVelocityTrack = 0; // Traccia selezionata nel velocity panel
let isPlaying = false;

/* =================================================================
   3. KNOB CLASS
   ================================================================= */
class Knob {
    constructor(container, label, min, max, initialValue, colorVar, callback, step = 1) {
        this.container = container;
        this.min = min;
        this.max = max;
        this.value = initialValue;
        this.callback = callback;
        this.step = step;

        // UI Config
        this.minAngle = -135;
        this.maxAngle = 135;
        this.indicatorColor = `var(${colorVar})`;

        // Create DOM
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

        // Drag State
        this.dragging = false;
        this.startY = 0;
        this.startValue = 0;

        this.attachEvents();
        this.updateUI();
    }

    attachEvents() {
        this.knobEl.addEventListener('pointerdown', (e) => {
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

            // Snap to step
            if (this.step === 1) {
                newValue = Math.round(newValue);
            } else {
                newValue = Math.round(newValue / this.step) * this.step;
            }

            this.setValue(newValue);
        });
    }

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
   4. UI GENERATION
   ================================================================= */
const velocityBarsContainer = document.getElementById('velocityBars');

function renderVelocityBars() {
    const track = tracks[currentVelocityTrack];
    velocityBarsContainer.innerHTML = '';

    // Controllo di sicurezza: se la traccia non ha pattern generato (es. init), evita errori
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

        slider.addEventListener('dblclick', () => {
            track.velocity[i] = 100; // Reset logico
            slider.value = 100;      // Reset visivo

            // Aggiorna il testo della percentuale
            const valDisplay = container.querySelector('.velocity-value');
            if (valDisplay) valDisplay.textContent = track.velocity[i];
        });

        // --- MODIFICA RICHIESTA: Gestione stato attivo/inattivo ---
        // Se il pulse in questo step è 0 (assente), aggiungiamo la classe inattiva
        if (track.pattern[i] === 0) {
            slider.classList.add('inactive-slider');
        }
        // ----------------------------------------------------------

        slider.addEventListener('input', (e) => {
            track.velocity[i] = parseInt(e.target.value);
            // Aggiorna il display del valore solo per questo slider
            const valDisplay = container.querySelector('.velocity-value');
            if (valDisplay) valDisplay.textContent = track.velocity[i];
        });

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

function initVelocityPanel() {

    const velocityTrackSelect = document.getElementById('velocityTrackSelect');

    // Cambio traccia nel select
    velocityTrackSelect.addEventListener('change', (e) => {
        currentVelocityTrack = parseInt(e.target.value);
        renderVelocityBars();
    });

    renderVelocityBars();
}


/* =================================================================
   LOGICA VELOCITY PAINTING (Minimal & Functional)
   ================================================================= */

let isDrawingVelocity = false;

// Funzione di calcolo: trasforma la posizione X/Y del mouse in Step/Velocity
function updateVelocityFromPointer(e) {
    const track = tracks[currentVelocityTrack];
    const rect = velocityBarsContainer.getBoundingClientRect();

    // 1. Calcola quale step stiamo toccando (Asse X)
    // Sottraiamo il padding sinistro se necessario, ma col calcolo relativo al width totale è più fluido
    const relativeX = e.clientX - rect.left;
    const stepWidth = rect.width / track.steps;

    let stepIndex = Math.floor(relativeX / stepWidth);

    // Sicurezza: restiamo nei limiti dell'array (0 -> steps-1)
    stepIndex = Math.max(0, Math.min(stepIndex, track.steps - 1));

    // 2. Calcola il valore di velocity (Asse Y)
    // Nota: in basso è 0, in alto è 127. Mouse Y cresce scendendo.
    const relativeY = e.clientY - rect.top;

    // Normalizziamo da 0 a 1 (1 = basso/0 vel, 0 = alto/127 vel)
    let normalizedVal = 1 - (relativeY / rect.height);

    // Clamping (non usciamo dai bordi verticali)
    normalizedVal = Math.max(0, Math.min(normalizedVal, 1));

    const newVelocity = Math.round(normalizedVal * 127);

    // 3. APPLICA I CAMBIAMENTI

    // A) Aggiorna il dato nel modello
    track.velocity[stepIndex] = newVelocity;

    // B) Aggiorna visivamente lo slider specifico e il numero
    // Recuperiamo il container dello step specifico
    // Nota: children[stepIndex] corrisponde all'ordine di creazione
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

    // Cambio traccia dal menu a tendina
    velocityTrackSelect.addEventListener('change', (e) => {
        currentVelocityTrack = parseInt(e.target.value);
        renderVelocityBars();
    });

    // === GESTIONE PAINTING (Mouse & Touch) ===

    // Quando premiamo il mouse nel contenitore velocity
    velocityBarsContainer.addEventListener('mousedown', (e) => {
        isDrawingVelocity = true;
        // Aggiorna subito il punto cliccato senza aspettare il movimento
        updateVelocityFromPointer(e);
    });

    // Quando muoviamo il mouse OVUNQUE (window), se stiamo disegnando
    window.addEventListener('mousemove', (e) => {
        if (isDrawingVelocity) {
            // Impedisce selezione testo o comportamenti strani di drag nativo
            e.preventDefault();
            updateVelocityFromPointer(e);
        }
    });

    // Quando rilasciamo il click
    window.addEventListener('mouseup', () => {
        isDrawingVelocity = false;
    });

    // Render iniziale
    renderVelocityBars();
}

function initInterface() {
    const trackTitles = [
        { label: "Sequence 1 (Outer)", color: "var(--track-1)" },
        { label: "Sequence 2", color: "var(--track-2)" },
        { label: "Sequence 3", color: "var(--track-3)" },
        { label: "Sequence 4 (Inner)", color: "var(--track-4)" }
    ];
    tracks.forEach((track, index) => {
        const trackContainer = document.getElementById(`track-${index}`);

        // Titolo colorato
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

        // Gain knob (0 to 2, default 1, step 0.01)
        new Knob(gainRow.lastChild, 'GAIN', 0, 2, 1, track.colorVar, (v) => {
            track.gainNode.gain.value = v;
        }, 0.01);

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
        soundGroup.appendChild(select);

        track.userSampleOpt = null;

        // File input per sample custom
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'audio/*';
        fileInput.style.marginTop = "6px";
        soundGroup.appendChild(fileInput);

        trackContainer.appendChild(soundGroup);

        // Inizializza i knob nelle rispettive righe
        new Knob(stepsRow.lastChild, 'STEPS', 1, 32, track.steps, track.colorVar, (v) => {
            track.steps = v;
            pulsesK.updateLimits(0, track.steps);
            offsetK.updateLimits(0, track.steps - 1);
            regenerateTrack(track);
            if (currentVelocityTrack === index) {
                renderVelocityBars();
            }
        });
        const pulsesK = new Knob(pulsesRow.lastChild, 'PULSES', 0, track.steps, track.pulses, track.colorVar, (v) => {
            track.pulses = v;
            regenerateTrack(track);

            if (currentVelocityTrack === index) { //update 
                renderVelocityBars();
            }
        });
        const offsetK = new Knob(offsetRow.lastChild, 'OFFSET', 0, track.steps - 1, track.offset, track.colorVar, (v) => {
            track.offset = v;
            regenerateTrack(track);

            if (currentVelocityTrack === index) { //update
                renderVelocityBars();
            }
        });

        // Cambia sample (default o custom)
        select.addEventListener('change', (e) => {
            track.sample = e.target.value;

            // Se è un sample custom, usa il player salvato
            if (track.sample.startsWith('user_') && track.customPlayer) {
                track.customPlayer.start();
            } else if (players.loaded && players.has(track.sample)) {
                // Altrimenti usa i sample di default
                players.player(track.sample).start();
            }
        });
        // Caricamento sample custom
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
                // Crea un nuovo Player isolato per il sample custom
                const customPlayer = new Tone.Player(url).connect(track.gainNode);

                // Aspetta che il buffer sia caricato
                await customPlayer.load(url);

                // Rimuovi la vecchia option "User Sample" se esiste
                if (track.userSampleOpt) {
                    select.removeChild(track.userSampleOpt);
                    track.userSampleOpt = null;
                }

                // Se c'era un player custom precedente, disconnettilo
                if (track.customPlayer) {
                    track.customPlayer.dispose();
                }

                // Salva il nuovo player sulla traccia
                track.customPlayer = customPlayer;
                track.sample = userSampleName;

                // Aggiungi la nuova option "User Sample"
                track.userSampleOpt = document.createElement('option');
                track.userSampleOpt.value = userSampleName;
                track.userSampleOpt.innerText = "User Sample";
                select.appendChild(track.userSampleOpt);
                select.value = userSampleName;

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
   5. MATH & DRAW
   ================================================================= */
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

function regenerateTrack(track) {
    let pat = generateEuclideanPattern(track.steps, track.pulses);
    track.pattern = rotateArray(pat, track.offset);



    const oldVelocity = track.velocity || [];
    const oldLength = oldVelocity.length;
    const newLength = track.steps;

    if (newLength > oldLength) {
        // CASO 1: Aggiungi steps → riempi i nuovi con 100 (default)
        track.velocity = [...oldVelocity, ...new Array(newLength - oldLength).fill(100)];
    } else if (newLength < oldLength) {
        // CASO 2: Rimuovi steps → taglia l'array
        track.velocity = oldVelocity.slice(0, newLength);
    }

    drawAllCircles();
}

const tracksGroup = document.getElementById('tracksGroup');

function polarPos(i, totalSteps, radius) {
    const angle = (2 * Math.PI * i / totalSteps) - Math.PI / 2;
    return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
}

function drawAllCircles() {
    tracksGroup.innerHTML = '';
    tracks.forEach((track, tIdx) => {
        // Guide
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

            // Manual Toggle
            dot.onclick = () => {
                track.pattern[i] = track.pattern[i] ? 0 : 1;
                drawAllCircles();

                // Se stiamo modificando la traccia attualmente selezionata nel pannello Velocity,
                // dobbiamo aggiornare le barre per riflettere il cambio di stato (colore/grigio).
                if (tIdx === currentVelocityTrack) {
                    renderVelocityBars();
                }
            };

            tracksGroup.appendChild(dot);
        }
    });
}
/* =================================================================
   6. POLY-SEQUENCER ENGINE (MCM & CLOCK GLOBALE) - VERSIONE Tone.Transport
   ================================================================= */
let globalStep = 0;
let transportEventId = null;

// Funzione principale chiamata dal clock di Tone.Transport
function playStep(time) {
    // Calcola la risoluzione globale (MCM)
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

            // Audio Trigger (usando il tempo fornito da Tone.Transport)
            if (track.pattern[stepIdx] === 1) {
                const velocity = track.velocity[stepIdx] / 127; // Normalizza da 0-127 a 0-1

                // Se è un sample custom, usa il player salvato
                if (track.sample.startsWith('user_') && track.customPlayer) {
                    track.customPlayer.volume.value = Tone.gainToDb(velocity);
                    track.customPlayer.start(time);
                }
                // Altrimenti usa i sample di default
                else if (players.loaded && players.has(track.sample)) {
                    // Use a player from the pool for overlapping playback
                    const pool = playerPools[track.sample];
                    if (pool) {
                        // Find a player that's not currently playing
                        let found = false;
                        for (let i = 0; i < pool.length; i++) {
                            const p = pool[i];
                            if (!p.state || p.state === "stopped") {
                                p.volume.value = Tone.gainToDb(velocity);
                                p.start(time);
                                found = true;
                                break;
                            }
                        }
                        // If all are busy, force the first one to play (may cut off previous sound)
                        if (!found) {
                            pool[0].volume.value = Tone.gainToDb(velocity);
                            pool[0].start(time);
                        }
                    }
                }
            }
        }
    });

    // Avanza step
    globalStep = (globalStep + 1) % stepsPerBar;
}

// Funzioni per MCM
function gcd(a, b) {
    return b === 0 ? a : gcd(b, a % b);
}
function lcm(a, b) {
    return (a * b) / gcd(a, b);
}
async function startSequencer() {
    if (isPlaying) return;
    await Tone.start();
    isPlaying = true;
    startBtn.style.background = "#222";
    startBtn.style.color = "#888";
    globalStep = 0;

    // Imposta BPM
    const bpm = parseInt(document.getElementById('bpm').value) || 120;
    Tone.Transport.bpm.value = bpm;

    // Calcola steps per bar (MCM)
    const stepsPerBar = tracks.reduce((acc, t) => lcm(acc, t.steps), 1);

    // Imposta la risoluzione dei tick del Transport (PPQ = stepsPerBar * 4)
    Tone.Transport.PPQ = stepsPerBar;

    // Rimuovi eventuali eventi precedenti
    if (transportEventId !== null) {
        Tone.Transport.clear(transportEventId);
    }

    // Schedula playStep ogni 4 tick ("4i" = ogni step)
    transportEventId = Tone.Transport.scheduleRepeat(playStep, "4i");

    Tone.Transport.start("+0.05");
}

function stopSequencer() {
    // stop sound from all players
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

/* =================================================================
   7. MIDI EXPORT ENGINE (HYBRID: ORIGINAL MULTITRACK + SORTED MERGE)
   ================================================================= */

const exportBtn = document.getElementById('exportBtn');

function downloadMIDI(options) {
    if (typeof MidiWriter === 'undefined') {
        alert("Errore critico: Libreria MidiWriter non caricata.");
        return;
    }

    // 1. SETUP OPZIONI (con fallback per sicurezza)
    const settings = {
        velocity: (options && options.velocity !== undefined) ? options.velocity : true,
        merge: (options && options.merge !== undefined) ? options.merge : false,
        selectedTracks: (options && options.selectedTracks) ? options.selectedTracks : [0, 1, 2, 3]
    };

    if (settings.selectedTracks.length === 0) {
        alert("Nessuna traccia selezionata.");
        return;
    }

    const midiMap = { kick: 36, snare: 38, hihat: 42, tom: 47 };
    const PPQ = 128; 
    const TICKS_PER_BAR = PPQ * 4; // 512
    const BARS_TO_EXPORT = 4;
    
    const midiTracks = [];

    // =========================================================
    // BRANCH A: MERGE (Logica adattata per traccia unica)
    // =========================================================
    if (settings.merge) {
        const mergedTrack = new MidiWriter.Track();
        mergedTrack.addTrackName(`Actam Merged`);
        
        let allEvents = [];

        // 1. RACCOLTA EVENTI (Usa la TUA matematica originale)
        settings.selectedTracks.forEach(tIdx => {
            const t = tracks[tIdx];
            if (!t) return;

            const noteNumber = midiMap[t.sample] || 36;
            const totalSteps = t.steps * BARS_TO_EXPORT;

            for (let i = 0; i < totalSteps; i++) {
                const patternIdx = i % t.steps;
                if (t.pattern[patternIdx] === 1) {
                    
                    // Calcolo Tick esatto (Original Logic)
                    const absStartBar = i / t.steps;
                    const absEndBar = (i + 1) / t.steps;
                    
                    const startTick = Math.round(absStartBar * TICKS_PER_BAR);
                    const endTick = Math.round(absEndBar * TICKS_PER_BAR);
                    
                    const vel = settings.velocity ? (t.velocity[patternIdx] || 100) : 100;

                    // Decomponiamo in On/Off per permettere sovrapposizioni
                    allEvents.push({ type: 'on', pitch: noteNumber, velocity: vel, tick: startTick });
                    allEvents.push({ type: 'off', pitch: noteNumber, velocity: 0, tick: endTick });
                }
            }
        });

        // 2. ORDINAMENTO CRONOLOGICO (Obbligatorio per il merge)
        allEvents.sort((a, b) => a.tick - b.tick);

        // 3. SCRITTURA (Calcolo Delta)
        let lastCursorTick = 0;
        allEvents.forEach(evt => {
            const waitTicks = Math.max(0, evt.tick - lastCursorTick);
            
            if (evt.type === 'on') {
                mergedTrack.addEvent(new MidiWriter.NoteOnEvent({
                    pitch: [evt.pitch],
                    velocity: evt.velocity,
                    wait: 'T' + waitTicks,
                    channel: 10
                }));
            } else {
                mergedTrack.addEvent(new MidiWriter.NoteOffEvent({
                    pitch: [evt.pitch],
                    duration: '0',
                    wait: 'T' + waitTicks,
                    channel: 10
                }));
            }
            lastCursorTick = evt.tick;
        });
        
        midiTracks.push(mergedTrack);
    } 
    
    // =========================================================
    // BRANCH B: MULTITRACK (IL TUO CODICE ORIGINALE RIPRISTINATO)
    // =========================================================
    else {
        settings.selectedTracks.forEach(tIdx => {
            const t = tracks[tIdx];
            if (!t) return;

            const track = new MidiWriter.Track();
            track.addTrackName(`Track ${tIdx + 1} - ${t.sample.toUpperCase()}`);

            const noteNumber = midiMap[t.sample] || 36;
            const totalStepsToExport = t.steps * BARS_TO_EXPORT;
            
            let waitBuffer = 0;

            for (let i = 0; i < totalStepsToExport; i++) {
                const patternIdx = i % t.steps;
                const isActive = t.pattern[patternIdx] === 1;

                // Calcolo Temporale (Originale)
                const absStartBar = i / t.steps;
                const absEndBar = (i + 1) / t.steps;

                const tickStart = Math.round(absStartBar * TICKS_PER_BAR);
                const tickEnd = Math.round(absEndBar * TICKS_PER_BAR);

                const currentStepDuration = tickEnd - tickStart;

                if (isActive) {
                    // Unica aggiunta: controllo opzione Velocity
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
            midiTracks.push(track);
        });
    }

    // GENERAZIONE FILE
    try {
        const writer = new MidiWriter.Writer(midiTracks);
        const blob = new Blob([writer.buildFile()], { type: "audio/midi" });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        
        // Nome file dinamico come richiesto
        let filename = "actam_poly";
        if (settings.merge) filename += "_merged";
        
        // Aggiungo suffisso velocity per feedback
        filename += settings.velocity ? "_vel-ON.mid" : "_vel-OFF.mid";

        a.download = filename;
        document.body.appendChild(a);
        a.click();
        
        setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(a.href); }, 100);

    } catch (e) {
        console.error("Errore scrittura MIDI:", e);
        alert("Errore generazione MIDI.");
    }
}

// BINDING PULSANTE
// Usa replaceChild per garantire che non ci siano listener duplicati (safe-mode)
/* =================================================================
   8. UI MODALE & BINDINGS (Sostituisce il vecchio binding)
   ================================================================= */

// Elementi DOM
const modalOverlay = document.getElementById('midiModal');
const confirmExportBtn = document.getElementById('confirmExportBtn');
const cycleBtns = document.querySelectorAll('.cycle-btn');

// Stato locale della modale
let exportSettings = {
    velocity: true,
    merge: false,
    selectedTracks: [0, 1, 2, 3] // Default: tutte le tracce (ID 0-3)
};

// 1. GESTIONE APERTURA (Tasto Export Principale)
if (exportBtn) {
    const newBtn = exportBtn.cloneNode(true);
    if (exportBtn.parentNode) {
        exportBtn.parentNode.replaceChild(newBtn, exportBtn);
        newBtn.addEventListener('click', () => {
            modalOverlay.classList.remove('hidden');
        });
    }
}

// 2. GESTIONE CHIUSURA
modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) {
        modalOverlay.classList.add('hidden');
    }
});

// 3. GESTIONE SELETTORE TRACCE (Multi-Select)
cycleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        btn.classList.toggle('active'); // Toggle visuale

        const val = parseInt(btn.getAttribute('data-val'));
        const trackId = val - 1;

        if (btn.classList.contains('active')) {
            // Aggiungi trackId se manca
            if (!exportSettings.selectedTracks.includes(trackId)) {
                exportSettings.selectedTracks.push(trackId);
            }
        } else {
            // Rimuovi trackId se presente
            exportSettings.selectedTracks = exportSettings.selectedTracks.filter(id => id !== trackId);
        }

        exportSettings.selectedTracks.sort((a, b) => a - b);
        console.log("Selected Tracks:", exportSettings.selectedTracks);
    });
});

// 4. GESTIONE CONFERMA
confirmExportBtn.addEventListener('click', () => {
    // Raccogliamo i dati dalla modale
    const options = {
        velocity: document.getElementById('optVelocity').checked, // TRUE o FALSE
        merge: document.getElementById('optMerge').checked, // <--- NUOVO PARAMETRO
        selectedTracks: exportSettings.selectedTracks // Mantiene la selezione fatta coi bottoni 1-2-3-4
    };
    
    console.log("Exporting...", options); // Debug per essere sicuri

    // Chiudiamo la modale
    modalOverlay.classList.add('hidden');
    
    // Chiamiamo la TUA funzione passandogli le opzioni
    downloadMIDI(options); 
});

// Init

initInterface();
initVelocityPanel();