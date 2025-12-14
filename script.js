

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

// Creiamo i player
const players = new Tone.Players(samples, {
    onload: () => {
        statusEl.textContent = "AUDIO READY";
        statusEl.style.color = "#2ecc71";
        console.log("Audio buffers loaded!");
    }
}).connect(masterPanner);

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
  { id: 2, colorVar: '--track-3', radius: 140, steps: 8,  pulses: 3, offset: 0, sample: 'hihat', pattern: [], playingIdx: -1, timer: null },
  { id: 3, colorVar: '--track-4', radius: 80,  steps: 5,  pulses: 2, offset: 0, sample: 'tom',   pattern: [], playingIdx: -1, timer: null }
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
   6. POLY-SEQUENCER ENGINE (MOTORE BASATO SUL TEMPO REALE)
   ================================================================= */
// Variabili per gestire il tempo reale
let lastFrameTime = 0;
let currentBarPhase = 0.0; // Da 0.0 (inizio battuta) a 1.0 (fine battuta)
let animationFrameId = null;

function playLoop(timestamp) {
    if (!isPlaying) return;

    // Se è il primo fotogramma, sincronizziamo il tempo
    if (!lastFrameTime) lastFrameTime = timestamp;
    
    // Calcoliamo quanto tempo reale è passato dall'ultimo controllo
    const deltaTime = timestamp - lastFrameTime;
    lastFrameTime = timestamp;

    // Recuperiamo i BPM dall'interfaccia
    const bpm = parseInt(document.getElementById('bpm').value) || 120;
    
    // Calcoliamo quanto dura una battuta intera (4 quarti) in millisecondi
    // Esempio: 120 BPM = 2000ms per battuta
    const barDurationMs = (60000 / bpm) * 4;

    // Avanziamo nella battuta in base al tempo passato
    // Se deltaTime è 16ms e la battuta è 2000ms, avanziamo dello 0.8%
    currentBarPhase += deltaTime / barDurationMs;

    // Se siamo arrivati alla fine della battuta (1.0), ricominciamo da capo
    if (currentBarPhase >= 1.0) {
        currentBarPhase -= 1.0; 
        // Resettiamo la memoria delle note suonate per il nuovo giro
        tracks.forEach(t => t.lastPlayedStep = -1); 
    }

    // CONTROLLO TRACCE
    tracks.forEach((track) => {
        // Calcoliamo matematicamente in quale step dovremmo essere ORA.
        // Esempio: Se siamo al 50% della battuta (0.5) e la traccia ha 4 step -> Step 2
        const currentStepIndex = Math.floor(currentBarPhase * track.steps);

        // Se lo step calcolato è diverso dall'ultimo suonato, significa che siamo entrati in uno step nuovo
        if (currentStepIndex !== track.lastPlayedStep) {
            
            // Aggiorniamo la memoria per non suonare questo step 100 volte di fila
            track.lastPlayedStep = currentStepIndex; 
            track.playingIdx = currentStepIndex;

            // --- GESTIONE GRAFICA (VISUALS) ---
            // Spegniamo tutti i pallini
            for(let i = 0; i < track.steps; i++) {
                const d = document.getElementById(`dot-${track.id}-${i}`);
                if(d) d.classList.remove('playing');
            }
            // Accendiamo quello corrente
            const currentDot = document.getElementById(`dot-${track.id}-${currentStepIndex}`);
            if(currentDot) {
                currentDot.classList.add('playing');
                // Effetto "Pulse"
                if(track.pattern[currentStepIndex]) {
                    currentDot.style.r = 9;
                    setTimeout(() => currentDot.style.r = 6, 80);
                }
            }

            // --- GESTIONE AUDIO ---
            if (track.pattern[currentStepIndex] === 1) {
                if(players.loaded && players.has(track.sample)) {
                    // Start(0) assicura che il sample riparta dall'inizio
                    players.player(track.sample).start(0);
                }
            }
        }
    });

    // Richiediamo al browser il prossimo controllo appena possibile
    animationFrameId = requestAnimationFrame(playLoop);
}

async function startSequencer() {
    if(isPlaying) return;
    
    // Avvia l'audio context di Tone.js (fondamentale per i browser moderni)
    await Tone.start();
    
    isPlaying = true;
    startBtn.style.background = "#222";
    startBtn.style.color = "#888";
    
    // Resettiamo tutte le variabili di tempo
    lastFrameTime = 0;
    currentBarPhase = 0.0;
    tracks.forEach(t => t.lastPlayedStep = -1);
    
    // Avviamo il loop
    animationFrameId = requestAnimationFrame(playLoop);
}

function stopSequencer() {
    isPlaying = false;
    startBtn.style.background = "#2ecc71";
    startBtn.style.color = "#000";
    
    // Cancelliamo il loop
    if(animationFrameId) cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
    
    // Pulizia visiva finale
    tracks.forEach(track => {
        track.playingIdx = -1;
        track.lastPlayedStep = -1;
    });
    document.querySelectorAll('.dot').forEach(d => d.classList.remove('playing'));
}

// Bindings
startBtn.onclick = startSequencer;
document.getElementById('stopBtn').onclick = stopSequencer;



/* =================================================================
   7. MIDI EXPORT ENGINE (ENGINEERING GRADE v2.0)
   ================================================================= */

const exportBtn = document.getElementById('exportBtn');

function downloadMIDI() {
    // SECURITY CHECK: Verifica caricamento libreria
    if (typeof MidiWriter === 'undefined') {
        alert("Errore critico: Libreria MidiWriter non caricata. Controlla la connessione o il link CDN.");
        return;
    }

    // CONFIGURAZIONE
    // Mapping strumenti (GM Standard Channel 10)
    const midiMap = {
        kick: 36,  // C1
        snare: 38, // D1
        hihat: 42, // F#1
        tom: 47    // B1
    };

    // Costanti temporali
    const PPQ = 128; // Standard MIDI resolution
    const TICKS_PER_BAR = PPQ * 4; // 512 Ticks per 4/4
    const BARS_TO_EXPORT = 4; // Lunghezza Loop

    // Inizializzazione Tracce MIDI
    const midiTracks = [];

    // ITERAZIONE TRACCE
    // Usa l'array globale 'tracks' definito nella sezione 2
    tracks.forEach(t => {
        const track = new MidiWriter.Track();
        
        // Metadata Traccia
        track.addTrackName(`Track ${t.id + 1} - ${t.sample.toUpperCase()}`);
        
        // Parametri per il calcolo
        const noteNumber = midiMap[t.sample] || 36; // Fallback a Kick se undefined
        const totalStepsToExport = t.steps * BARS_TO_EXPORT;
        
        // BUFFER DI ATTESA (Accumulatore Delta-Time)
        // Gestisce i silenzi accumulando la durata degli step vuoti
        // per applicarli come ritardo (wait) alla prima nota attiva successiva.
        let waitBuffer = 0;

        for (let i = 0; i < totalStepsToExport; i++) {
            // 1. Logica Pattern (Rotazione + Euclideo)
            const patternIdx = i % t.steps;
            const isActive = t.pattern[patternIdx] === 1;

            // 2. Calcolo Temporale di Precisione (Floating Point Compensation)
            // Calcoliamo i tick assoluti di inizio e fine per questo step specifico
            // Differenza = Durata esatta (intero) che compensa gli arrotondamenti
            const absStartBar = i / t.steps; 
            const absEndBar = (i + 1) / t.steps;
            
            const tickStart = Math.round(absStartBar * TICKS_PER_BAR);
            const tickEnd = Math.round(absEndBar * TICKS_PER_BAR);
            
            const currentStepDuration = tickEnd - tickStart;

            // 3. Scrittura Eventi
            if (isActive) {
                // NOTA ON
                track.addEvent(new MidiWriter.NoteEvent({
                    pitch: [noteNumber],
                    duration: 'T' + currentStepDuration, // Durata nota piena (Legato)
                    wait: 'T' + waitBuffer,              // Applica il ritardo accumulato
                    channel: 10,
                    velocity: 100
                }));
                
                // Reset buffer dopo aver "speso" l'attesa
                waitBuffer = 0;
            } else {
                // NOTA OFF (Pausa)
                // Non scriviamo nulla sul MIDI, accumuliamo solo il tempo
                waitBuffer += currentStepDuration;
            }
        }
        
        midiTracks.push(track);
    });

    // GENERAZIONE FILE
    try {
        const writer = new MidiWriter.Writer(midiTracks);
        const blob = new Blob([writer.buildFile()], {type: "audio/midi"});
        
        // Download forzato
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

// BINDING PULSANTE
// Usa replaceChild per garantire che non ci siano listener duplicati (safe-mode)
if(exportBtn) {
    const newBtn = exportBtn.cloneNode(true);
    if(exportBtn.parentNode) {
        exportBtn.parentNode.replaceChild(newBtn, exportBtn);
        newBtn.addEventListener('click', downloadMIDI);
    }
}

// Init
initInterface();