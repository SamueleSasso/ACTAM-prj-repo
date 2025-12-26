

/* =================================================================
   1. AUDIO ENGINE SETUP
   ================================================================= */
const statusEl = document.getElementById('status');
const startBtn = document.getElementById('startBtn');

// Central panner
const masterPanner = new Tone.Panner(0).toDestination();

// Samples list
const samples = {
    kick: "https://tonejs.github.io/audio/drum-samples/CR78/kick.mp3",
    snare: "https://tonejs.github.io/audio/drum-samples/CR78/snare.mp3",
    hihat: "https://tonejs.github.io/audio/drum-samples/CR78/hihat.mp3",
    tom: "https://tonejs.github.io/audio/drum-samples/CR78/tom1.mp3",
};

// We are building the players
const players = new Tone.Players(samples, {
    onload: () => {
        statusEl.textContent = "AUDIO READY";
        statusEl.style.color = "#2ecc71";
        console.log("Audio buffers loaded!");
    }
}).connect(masterPanner);

// Security Timeout
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
  // Aggiunti: eventId (per cancellare lo schedule) e currentStep (contatore interno)
  { id: 0, colorVar: '--track-1', radius: 260, steps: 16, pulses: 4, offset: 0, sample: 'kick', pattern: [], playingIdx: -1, eventId: null, currentStep: 0 },
  { id: 1, colorVar: '--track-2', radius: 200, steps: 12, pulses: 5, offset: 0, sample: 'snare', pattern: [], playingIdx: -1, eventId: null, currentStep: 0 },
  { id: 2, colorVar: '--track-3', radius: 140, steps: 8,  pulses: 3, offset: 0, sample: 'hihat', pattern: [], playingIdx: -1, eventId: null, currentStep: 0 },
  { id: 3, colorVar: '--track-4', radius: 80,  steps: 5,  pulses: 2, offset: 0, sample: 'tom',   pattern: [], playingIdx: -1, eventId: null, currentStep: 0 }
];

let isPlaying = false;

/* =================================================================
   3. KNOB CLASS
   ================================================================= */
class Knob {
  constructor(container, label, min, max, initialValue, colorVar, callback) {
    this.container = container;
    this.min = min;
    this.max = max;
    this.value = initialValue;
    this.callback = callback;
    
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
      let newValue = Math.round(this.startValue + valueChange);
      
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
    if(this.value > max) this.setValue(max);
    if(this.value < min) this.setValue(min);
  }

  updateUI() {
    const range = this.max - this.min;
    const angleRange = this.maxAngle - this.minAngle;
    
    let percent = 0;
    if (range > 0) percent = (this.value - this.min) / range;
    
    const angle = this.minAngle + (percent * angleRange);
    this.indicatorEl.style.transform = `translateX(-50%) rotate(${angle}deg)`;
    this.displayEl.textContent = this.value;
  }
}

/* =================================================================
   4. UI GENERATION
   ================================================================= */
const tracksContainer = document.getElementById('tracks-container');

function initInterface() {
  tracks.forEach((track, index) => {
    
    // Row Container
    const row = document.createElement('div');
    row.className = 'track-row';
    row.style.borderLeftColor = `var(${track.colorVar})`;

    // Header
    const header = document.createElement('div');
    header.className = 'track-header';
    header.innerHTML = `<span class="track-title" style="color:var(${track.colorVar})">TRACK ${index + 1}</span>`;
    
    // Select
    const select = document.createElement('select');
    Object.keys(samples).forEach(key => {
        const opt = document.createElement('option');
        opt.value = key;
        opt.innerText = key.toUpperCase();
        if(key === track.sample) opt.selected = true;
        select.appendChild(opt);
    });
    select.addEventListener('change', (e) => {
        track.sample = e.target.value;
        if(players.loaded) players.player(track.sample).start();
    });
    header.appendChild(select);
    row.appendChild(header);

    // Knobs Container
    const knobsRow = document.createElement('div');
    knobsRow.className = 'track-knobs';
    row.appendChild(knobsRow);

    // Create Knobs
    const stepsK = new Knob(knobsRow, 'STEPS', 1, 32, track.steps, track.colorVar, (v) => {
        track.steps = v;
        pulsesK.updateLimits(0, track.steps);
        offsetK.updateLimits(0, track.steps - 1);
        regenerateTrack(track);

        // --- AGGIUNTA IMPORTANTE ---
        // Se stiamo suonando, aggiorniamo il motore audio in tempo reale
        if(isPlaying) updateTrackScheduler(track);
    });

    const pulsesK = new Knob(knobsRow, 'PULSES', 0, track.steps, track.pulses, track.colorVar, (v) => {
        track.pulses = v;
        regenerateTrack(track);
    });

    const offsetK = new Knob(knobsRow, 'OFFSET', 0, track.steps - 1, track.offset, track.colorVar, (v) => {
        track.offset = v;
        regenerateTrack(track);
    });

    tracksContainer.appendChild(row);
    regenerateTrack(track);
  });
}

/* ====================================
   5. MATH & DRAW
   ==================================== */
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
        guide.style.stroke = "rgba(255,255,255,0.1)";
        tracksGroup.appendChild(guide);

        // Dots
        for (let i = 0; i < track.steps; i++) {
            const p = polarPos(i, track.steps, track.radius);
            const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            
            dot.setAttribute("cx", p.x);
            dot.setAttribute("cy", p.y);
            dot.setAttribute("r", track.pattern[i] ? 6 : 3);
            
            let className = "dot";
            if(track.pattern[i]) className += ` t${tIdx}-fill`; 
            
            dot.style.opacity = track.pattern[i] ? 0.9 : 0.3;
            if(!track.pattern[i]) dot.style.fill = "#444";
            
            dot.setAttribute("class", className);
            dot.id = `dot-${tIdx}-${i}`;
            
            // Manual Toggle
            dot.onclick = () => {
                track.pattern[i] = track.pattern[i] ? 0 : 1;
                drawAllCircles();
            };

            tracksGroup.appendChild(dot);
        }
    });
}

/* =================================================================
   6. POLY-SEQUENCER ENGINE (TONE.TRANSPORT EVENT BASED)
   ================================================================= */

// Funzione Core: Schedula (o ri-schedula) una singola traccia
function updateTrackScheduler(track) {
    // 1. Pulizia: Se c'era già un loop programmato per questa traccia, cancellalo.
    // Questo è fondamentale quando giri la manopola Steps mentre suona.
    if (track.eventId !== null) {
        Tone.Transport.clear(track.eventId);
        track.eventId = null;
    }

    // Se il sequencer è fermo, non scheduliamo nulla (lo farà startSequencer)
    // Ma se stiamo suonando e cambiamo manopola, dobbiamo rischedulare al volo.
    // Per semplicità, qui configuriamo solo l'evento, Tone lo gestirà se Transport è 'started'.
    
    // 2. Calcolo Intervallo Matematico
    // "1m" indica 1 misura (4 quarti). Dividiamo per il numero di step.
    // Tone.Time("1m").toSeconds() ci dà la durata in secondi a BPM attuali, diviso gli step.
    // Usiamo una funzione callback per ricalcolarlo dinamicamente se i BPM cambiano? 
    // No, meglio passare un valore tempo relativo.
    // Tone.js supporta la stringa "1m / 16" ma per sicurezza usiamo i secondi relativi.
    
    const interval = Tone.Time("1m").toSeconds() / track.steps;

    // 3. Creazione Loop
    // scheduleRepeat esegue la callback ogni 'interval' secondi esatti.
    track.eventId = Tone.Transport.scheduleRepeat((time) => {
        // A. Logica Step: Avanziamo di 1
        track.currentStep = (track.currentStep + 1) % track.steps;
        track.playingIdx = track.currentStep;

        // B. Audio: Usiamo 'time' per la precisione assoluta (zero jitter)
        const stepIdx = track.currentStep;
        if (track.pattern[stepIdx] === 1) {
            if (players.loaded && players.has(track.sample)) {
                players.player(track.sample).start(time);
            }
        }

        // C. Visuals: Tone.Draw sincronizza la UI con l'audio (che è leggermente nel futuro)
        Tone.Draw.schedule(() => {
            // Spegni precedenti
            for(let i = 0; i < track.steps; i++) {
                const d = document.getElementById(`dot-${track.id}-${i}`);
                if(d) d.classList.remove('playing');
            }
            // Accendi corrente
            const currentDot = document.getElementById(`dot-${track.id}-${stepIdx}`);
            if(currentDot) {
                currentDot.classList.add('playing');
                if(track.pattern[stepIdx]) {
                    currentDot.style.r = 9;
                    setTimeout(() => currentDot.style.r = 6, 80);
                }
            }
        }, time);

    }, interval);
}

// Funzione BPM Listener
const bpmInput = document.getElementById('bpm');
bpmInput.addEventListener('input', (e) => {
    const val = parseInt(e.target.value) || 120;
    Tone.Transport.bpm.value = val;
    // Quando cambiano i BPM, bisogna rischedulare perché l'intervallo in secondi cambia?
    // Tone.Transport scala automaticamente se usiamo notazione musicale, 
    // ma qui abbiamo calcolato in secondi fissi all'istante della creazione.
    // Per robustezza, rigeneriamo gli scheduler al cambio BPM o Steps.
    if(isPlaying) tracks.forEach(t => updateTrackScheduler(t));
});

async function startSequencer() {
    if(isPlaying) return;
    await Tone.start(); // Necessario per browser policy
    
    // Reset stato
    tracks.forEach(t => {
        t.currentStep = -1; 
        // Generiamo lo scheduler per ogni traccia
        updateTrackScheduler(t);
    });

    // Imposta BPM iniziali
    Tone.Transport.bpm.value = parseInt(bpmInput.value) || 120;
    
    // START
    Tone.Transport.start();
    isPlaying = true;
    
    startBtn.style.background = "#222";
    startBtn.style.color = "#888";
}

function stopSequencer() {
    // STOP
    Tone.Transport.stop();
    // Cancelliamo tutti gli eventi schedulati per pulizia
    Tone.Transport.cancel();
    tracks.forEach(t => t.eventId = null);
    
    isPlaying = false;
    startBtn.style.background = "#2ecc71";
    startBtn.style.color = "#000";
    
    // Reset Visuals
    tracks.forEach(track => {
        track.playingIdx = -1;
    });
    document.querySelectorAll('.dot').forEach(d => d.classList.remove('playing'));
}

// Bindings
startBtn.onclick = startSequencer;
document.getElementById('stopBtn').onclick = stopSequencer;



/* ===========================
   7. MIDI EXPORT ENGINE
   ===========================*/

const exportBtn = document.getElementById('exportBtn');

function downloadMIDI() {
    // SECURITY CHECK: Verify library loading
    if (typeof MidiWriter === 'undefined') {
        alert("Errore critico: Libreria MidiWriter non caricata. Controlla la connessione o il link CDN.");
        return;
    }

    // CONFIGURATION
    // Instruments mapping (GM Standard Channel 10)
    const midiMap = {
        kick: 36,  // C1
        snare: 38, // D1
        hihat: 42, // F#1
        tom: 47    // B1
    };

    // Time constants
    const PPQ = 128; // Standard MIDI resolution
    const TICKS_PER_BAR = PPQ * 4; // 512 Ticks per 4/4
    const BARS_TO_EXPORT = 4; // Loop Lenght

    // Inizialization of MIDI tracks
    const midiTracks = [];

    // TRACKS ITERATION
    // we use the global array 'tracks' defined at the section 2
    tracks.forEach(t => {
        const track = new MidiWriter.Track();
        
        // Track's Metadata
        track.addTrackName(`Track ${t.id + 1} - ${t.sample.toUpperCase()}`);
        
        // parameters for the calculus
        const noteNumber = midiMap[t.sample] || 36; //Kick fallback if undefined
        const totalStepsToExport = t.steps * BARS_TO_EXPORT;
        
        // WAITING BUFFER ( Delta-Time accumulator)
        // It handles silences by accumulating the duration of empty steps
        // to apply them as a delay (wait) to the next active note.
        let waitBuffer = 0;

        for (let i = 0; i < totalStepsToExport; i++) {
            // 1. Euclidean Pattern Logic 
            const patternIdx = i % t.steps;
            const isActive = t.pattern[patternIdx] === 1;

            // 2. Precise Timing Calculation (with Floating Point Compensation)
            // We calculate the absolute start and end ticks for this specific step.
            // Difference = Exact Duration (integer) which compensates for rounding.
            const absStartBar = i / t.steps; 
            const absEndBar = (i + 1) / t.steps;
            
            const tickStart = Math.round(absStartBar * TICKS_PER_BAR);
            const tickEnd = Math.round(absEndBar * TICKS_PER_BAR);
            
            const currentStepDuration = tickEnd - tickStart;

            // 3. Events transcripting
            if (isActive) {
                // ON note
                track.addEvent(new MidiWriter.NoteEvent({
                    pitch: [noteNumber],
                    duration: 'T' + currentStepDuration,
                    wait: 'T' + waitBuffer,              
                    channel: 10,
                    velocity: 100
                }));
                
                // Buffer reset after the wait
                waitBuffer = 0;
            } else {
                // OFF note means pause (export shortcut)
                // we accumulate time writing anything on the midi
                waitBuffer += currentStepDuration;
            }
        }
        
        midiTracks.push(track);
    });

    // FILE GENERATION
    try {
        const writer = new MidiWriter.Writer(midiTracks);
        const blob = new Blob([writer.buildFile()], {type: "audio/midi"});
        
        // Forced download
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'euclidean_poly_rhythm.mid';
        document.body.appendChild(a);
        a.click();
        
        // Garbage collection
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);
        
    } catch (e) {
        console.error("Errore durante la scrittura del file MIDI:", e);
        alert("Errore nella generazione del file MIDI. Vedi console.");
    }
}

// export button BINDINGS
// replaceChild guarantees there are no duplicated listeners (safe-mode)
if(exportBtn) {
    const newBtn = exportBtn.cloneNode(true);
    if(exportBtn.parentNode) {
        exportBtn.parentNode.replaceChild(newBtn, exportBtn);
        newBtn.addEventListener('click', downloadMIDI);
    }
}

// Init
initInterface();