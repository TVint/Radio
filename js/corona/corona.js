/**
 * ============================================================================
 * Y2K CORONA // 9-SERIES LIQUID CHROME BENTO ENGINE (js/corona/corona.js)
 * Art Direction & Creative Development:
 * - Web Audio API 8-Band BiquadFilterNode DSP + StereoPannerNode + AnalyserNode
 * - Tactile 3D Bitmap Faders (equalizer_track.png + equalizer_thumb.png)
 * - Magnetic Hover Physics on Metaball Transport Orbs & Bitmap Capsules
 * - Clip-Path Polygon/Circle Reveals on Track Changes & Mobile Drawer
 * - 3-Mode Y2K Holographic Canvas Visualizer (Liquid Orb, Spectrum 3D, Cyber Scope)
 * ============================================================================
 */

const EQ_BANDS = [
    { freq: 60,    label: '60',   type: 'lowshelf'  },
    { freq: 150,   label: '150',  type: 'peaking'   },
    { freq: 400,   label: '400',  type: 'peaking'   },
    { freq: 1000,  label: '1K',   type: 'peaking'   },
    { freq: 2400,  label: '2.4K', type: 'peaking'   },
    { freq: 6000,  label: '6K',   type: 'peaking'   },
    { freq: 12000, label: '12K',  type: 'peaking'   },
    { freq: 16000, label: '16K',  type: 'highshelf' }
];

const EQ_PRESETS = [
    { name: 'Y2K CLUB BASS',   gains: [ 8.5,  6.0,  1.5, -1.5,  1.0,  4.0,  6.5,  7.5] },
    { name: 'LIQUID CHROME',   gains: [ 4.5,  2.0, -2.5,  2.5,  5.0,  7.0,  8.5,  9.0] },
    { name: 'CYBER V-CURVE',   gains: [ 9.5,  5.5, -4.0, -5.5, -2.0,  4.5,  8.0,  9.5] },
    { name: 'SUB OVERDRIVE',   gains: [11.0,  8.5,  3.5,  0.0, -1.5,  1.0,  3.0,  4.0] },
    { name: 'RADIO TELEPHONY', gains: [-9.0, -6.0,  4.5,  9.0,  7.5, -4.0, -8.5, -9.5] },
    { name: 'FLAT REFERENCE',  gains: [ 0.0,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0] }
];

const RADIO_TRANSMISSIONS = [
    {
        id: 'CH_01',
        title: 'CYBERIA 2004 (CORONA DUB)',
        artist: 'DJ MARCO BETTIN // QDG PIRATE ARCHIVE',
        channel: 'CH_01 // LIQUID BREAKBEAT TRANSMISSION',
        streamCode: 'STREAM // QDG-Y2K-909',
        bpm: 134.0,
        offsetSec: 0,
        pitch: 1.00,
        presetIdx: 0
    },
    {
        id: 'CH_02',
        title: 'METABALL HORIZON (9-SERIES VIP)',
        artist: 'NICO V. // COBALT SYNTHESIS LAB',
        channel: 'CH_02 // DETROIT ELECTRO & ACID',
        streamCode: 'STREAM // QDG-Y2K-303',
        bpm: 138.5,
        offsetSec: 22,
        pitch: 1.03,
        presetIdx: 1
    },
    {
        id: 'CH_03',
        title: 'TRANSPARENT MAGENTA (#FF00FF)',
        artist: 'SKINNERS COLLECTIVE // WINAMP-KILLER',
        channel: 'CH_03 // ATMOSPHERIC JUNGLE 2003',
        streamCode: 'STREAM // QDG-Y2K-170',
        bpm: 164.0,
        offsetSec: 48,
        pitch: 1.06,
        presetIdx: 2
    },
    {
        id: 'CH_04',
        title: 'PERIWINKLE CHROME DRIFT',
        artist: 'QDG SYSTEM // LATE NIGHT TELEMETRY',
        channel: 'CH_04 // MICROHOUSE & DUB TECHNO',
        streamCode: 'STREAM // QDG-Y2K-404',
        bpm: 126.0,
        offsetSec: 75,
        pitch: 0.96,
        presetIdx: 3
    },
    {
        id: 'CH_05',
        title: 'BENTO MATRIX OVERLOAD',
        artist: 'HYPER-INDUSTRIAL UNIT // LIVE SET',
        channel: 'CH_05 // HARDGROOVE & SCHRANZ',
        streamCode: 'STREAM // QDG-Y2K-808',
        bpm: 142.0,
        offsetSec: 105,
        pitch: 1.08,
        presetIdx: 0
    },
    {
        id: 'CH_06',
        title: 'SUB-ZERO TELETEXT ECHO',
        artist: 'RADIOFAX ARCHIVE // CROSSOVER DUB',
        channel: 'CH_06 // AMBIENT IDM & GLITCH',
        streamCode: 'STREAM // QDG-Y2K-101',
        bpm: 118.0,
        offsetSec: 132,
        pitch: 0.92,
        presetIdx: 5
    }
];

class CoronaBentoEngine {
    constructor() {
        this.audioEl = document.getElementById('corona-audio');
        this.audioCtx = null;
        this.sourceNode = null;
        this.eqNodes = [];
        this.pannerNode = null;
        this.masterGain = null;
        this.analyser = null;

        this.freqData = new Uint8Array(256);
        this.timeData = new Uint8Array(256);

        // State
        this.isPlaying = false;
        this.isMuted = false;
        this.eqEnabled = true;
        this.volume = 0.85;
        this.balance = 0.0; // -1 (L) to +1 (R)
        this.currentPresetIdx = 0;
        this.currentTrackIdx = 0;
        this.currentGains = [...EQ_PRESETS[0].gains];
        this.vizMode = 'plasma'; // 'plasma' | 'matrix' | 'scope'
        this.pitchModes = [1.0, 1.12, 0.86];
        this.pitchModeIdx = 0;

        // DOM Elements
        this.canvas = document.getElementById('y2k-plasma-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.metaballPod = document.getElementById('metaball-pod');

        this.init();
    }

    init() {
        this.buildEqualizerDOM();
        this.buildTracklistDOM();
        this.bindTransportControls();
        this.bindScrubberAndVolume();
        this.bindBalanceFader();
        this.bindPresetAndEqButtons();
        this.bindCyberPadsAndModes();
        this.bindMagneticTargets();
        this.bindHolographicCursor();
        this.startSystemClock();
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());

        // Start 60FPS Holographic Render Loop
        this.lastFrameTime = performance.now();
        requestAnimationFrame((t) => this.renderLoop(t));
    }

    /* ========================================================================
       1. WEB AUDIO API DSP GRAPH (8-BAND BIQUAD EQ + STEREO PANNER + ANALYSER)
       ======================================================================== */
    ensureAudioContext() {
        if (!this.audioCtx) {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            this.audioCtx = new AudioContextClass();

            this.sourceNode = this.audioCtx.createMediaElementSource(this.audioEl);

            // Create 8 BiquadFilterNodes in series
            this.eqNodes = EQ_BANDS.map((band, idx) => {
                const filter = this.audioCtx.createBiquadFilter();
                filter.type = band.type;
                filter.frequency.value = band.freq;
                filter.Q.value = 1.35;
                filter.gain.value = this.eqEnabled ? this.currentGains[idx] : 0;
                return filter;
            });

            // Stereo Panner Node
            this.pannerNode = this.audioCtx.createStereoPanner();
            this.pannerNode.pan.value = this.balance;

            // Master Volume Gain
            this.masterGain = this.audioCtx.createGain();
            this.masterGain.gain.value = this.isMuted ? 0 : this.volume;

            // High-Resolution Analyser
            this.analyser = this.audioCtx.createAnalyser();
            this.analyser.fftSize = 512;
            this.analyser.smoothingTimeConstant = 0.82;
            this.freqData = new Uint8Array(this.analyser.frequencyBinCount);
            this.timeData = new Uint8Array(this.analyser.frequencyBinCount);

            // Connect Graph: Source -> EQ[0..7] -> StereoPanner -> MasterGain -> Analyser -> Destination
            let prevNode = this.sourceNode;
            this.eqNodes.forEach((filterNode) => {
                prevNode.connect(filterNode);
                prevNode = filterNode;
            });
            prevNode.connect(this.pannerNode);
            this.pannerNode.connect(this.masterGain);
            this.masterGain.connect(this.analyser);
            this.analyser.connect(this.audioCtx.destination);
        }

        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
    }

    /* Tactile UI Micro-Click Sound Synthesizer */
    playUiTick(freq = 1200, duration = 0.035) {
        try {
            this.ensureAudioContext();
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(freq * 0.45, this.audioCtx.currentTime + duration);

            gain.gain.setValueAtTime(0.08, this.audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + duration);

            osc.connect(gain);
            gain.connect(this.audioCtx.destination);
            osc.start();
            osc.stop(this.audioCtx.currentTime + duration);
        } catch (_) {
            // Ignore if audio context not yet unlocked
        }
    }

    /* ========================================================================
       2. 8-BAND TACTILE BITMAP EQUALIZER (equalizer_track.png + thumb)
       ======================================================================== */
    buildEqualizerDOM() {
        const matrix = document.getElementById('eq-fader-matrix');
        matrix.innerHTML = '';

        EQ_BANDS.forEach((band, idx) => {
            const col = document.createElement('div');
            col.className = 'eq-band-column';
            col.dataset.bandIdx = idx;

            const tooltip = document.createElement('div');
            tooltip.className = 'eq-db-tooltip';
            tooltip.id = `eq-db-${idx}`;
            tooltip.textContent = this.formatDb(this.currentGains[idx]);

            const track = document.createElement('div');
            track.className = 'eq-bitmap-track';
            track.title = `${band.freq} Hz // Trascina o usa la rotella (Doppio click per 0 dB)`;

            const neonFill = document.createElement('div');
            neonFill.className = 'eq-neon-fill';
            neonFill.id = `eq-fill-${idx}`;

            const thumb = document.createElement('div');
            thumb.className = 'eq-bitmap-thumb';
            thumb.id = `eq-thumb-${idx}`;

            track.appendChild(neonFill);
            track.appendChild(thumb);

            const label = document.createElement('div');
            label.className = 'eq-freq-label';
            label.textContent = band.label;

            col.appendChild(tooltip);
            col.appendChild(track);
            col.appendChild(label);
            matrix.appendChild(col);

            // Bind Tactile Pointer Drag & Wheel Events
            const updateFromPointer = (clientY) => {
                const rect = track.getBoundingClientRect();
                const pad = 11; // half thumb height
                const clampedY = Math.max(pad, Math.min(rect.height - pad, clientY - rect.top));
                const normalized = 1 - (clampedY - pad) / (rect.height - pad * 2); // 0 (bottom) to 1 (top)
                const dbVal = (normalized * 24) - 12; // -12 dB to +12 dB
                this.setEqBandGain(idx, dbVal);
            };

            track.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                track.setPointerCapture(e.pointerId);
                col.classList.add('dragging');
                this.playUiTick(980, 0.025);
                updateFromPointer(e.clientY);
            });

            track.addEventListener('pointermove', (e) => {
                if (!col.classList.contains('dragging')) return;
                updateFromPointer(e.clientY);
            });

            const endDrag = () => {
                if (col.classList.contains('dragging')) {
                    col.classList.remove('dragging');
                    this.playUiTick(1420, 0.025);
                }
            };
            track.addEventListener('pointerup', endDrag);
            track.addEventListener('pointercancel', endDrag);

            // Double click resets band to 0 dB
            track.addEventListener('dblclick', () => {
                this.playUiTick(1600, 0.04);
                this.setEqBandGain(idx, 0);
            });

            // Mouse wheel fine-tuning
            track.addEventListener('wheel', (e) => {
                e.preventDefault();
                const delta = e.deltaY < 0 ? 0.8 : -0.8;
                this.setEqBandGain(idx, this.currentGains[idx] + delta);
            }, { passive: false });
        });

        // Apply initial positions
        this.currentGains.forEach((g, idx) => this.updateEqBandVisual(idx, g));
    }

    formatDb(val) {
        const rounded = Math.round(val * 10) / 10;
        return `${rounded > 0 ? '+' : ''}${rounded.toFixed(1)}`;
    }

    setEqBandGain(idx, dbValue) {
        const clamped = Math.max(-12, Math.min(12, dbValue));
        this.currentGains[idx] = clamped;

        if (this.eqNodes[idx] && this.audioCtx) {
            const target = this.eqEnabled ? clamped : 0;
            this.eqNodes[idx].gain.setTargetAtTime(target, this.audioCtx.currentTime, 0.02);
        }

        this.updateEqBandVisual(idx, clamped);
    }

    updateEqBandVisual(idx, dbValue) {
        const thumb = document.getElementById(`eq-thumb-${idx}`);
        const fill = document.getElementById(`eq-fill-${idx}`);
        const tooltip = document.getElementById(`eq-db-${idx}`);
        if (!thumb || !fill || !tooltip) return;

        // Normalize -12..+12 dB to 0..1
        const norm = (dbValue + 12) / 24;
        const trackHeight = 108;
        const thumbHeight = 22;
        const maxTravel = trackHeight - thumbHeight;
        const topPx = (1 - norm) * maxTravel;

        thumb.style.top = `${topPx}px`;
        fill.style.height = `${Math.max(6, norm * (trackHeight - 14))}px`;
        fill.style.opacity = this.eqEnabled ? '0.72' : '0.2';
        tooltip.textContent = this.formatDb(dbValue);
    }

    applyEqPreset(presetIdx) {
        this.currentPresetIdx = (presetIdx + EQ_PRESETS.length) % EQ_PRESETS.length;
        const preset = EQ_PRESETS[this.currentPresetIdx];

        const lcd = document.getElementById('eq-preset-lcd');
        if (lcd) {
            lcd.style.clipPath = 'polygon(0 0, 0 0, 0 100%, 0 100%)';
            setTimeout(() => {
                lcd.textContent = preset.name;
                lcd.style.transition = 'clip-path 0.35s cubic-bezier(0.22, 1, 0.36, 1)';
                lcd.style.clipPath = 'polygon(0 0, 100% 0, 100% 100%, 0 100%)';
            }, 60);
        }

        preset.gains.forEach((gainVal, i) => {
            this.setEqBandGain(i, gainVal);
        });
    }

    bindPresetAndEqButtons() {
        const btnPower = document.getElementById('btn-eq-power');
        const btnReset = document.getElementById('btn-eq-reset');
        const btnPrev = document.getElementById('btn-preset-prev');
        const btnNext = document.getElementById('btn-preset-next');
        const badge = document.getElementById('eq-status-badge');

        btnPower.addEventListener('click', () => {
            this.eqEnabled = !this.eqEnabled;
            btnPower.classList.toggle('active', this.eqEnabled);
            this.playUiTick(this.eqEnabled ? 1480 : 620, 0.05);

            if (badge) {
                badge.textContent = this.eqEnabled ? 'DSP ACTIVE' : 'DSP BYPASSED';
                badge.style.color = this.eqEnabled ? 'var(--y2k-acid-green)' : 'var(--y2k-warning-amber)';
            }

            this.currentGains.forEach((g, idx) => {
                if (this.eqNodes[idx] && this.audioCtx) {
                    this.eqNodes[idx].gain.setTargetAtTime(this.eqEnabled ? g : 0, this.audioCtx.currentTime, 0.03);
                }
                this.updateEqBandVisual(idx, g);
            });
        });

        btnReset.addEventListener('click', () => {
            this.playUiTick(1250, 0.04);
            this.applyEqPreset(5); // FLAT REFERENCE
        });

        btnPrev.addEventListener('click', () => {
            this.playUiTick(1100, 0.035);
            this.applyEqPreset(this.currentPresetIdx - 1);
        });

        btnNext.addEventListener('click', () => {
            this.playUiTick(1350, 0.035);
            this.applyEqPreset(this.currentPresetIdx + 1);
        });
    }

    /* ========================================================================
       3. STEREO BALANCE PANNER (equalizer_balance_track.png)
       ======================================================================== */
    bindBalanceFader() {
        const track = document.getElementById('balance-track');
        const thumb = document.getElementById('balance-thumb');
        const readout = document.getElementById('balance-readout');

        const setBalanceFromClientX = (clientX) => {
            const rect = track.getBoundingClientRect();
            const pad = 10;
            const x = Math.max(pad, Math.min(rect.width - pad, clientX - rect.left));
            const norm = (x - pad) / (rect.width - pad * 2); // 0..1
            this.balance = (norm * 2) - 1; // -1..+1

            if (this.pannerNode && this.audioCtx) {
                this.pannerNode.pan.setTargetAtTime(this.balance, this.audioCtx.currentTime, 0.02);
            }

            thumb.style.left = `calc(${norm * 100}% - 10px)`;
            if (Math.abs(this.balance) < 0.06) {
                readout.textContent = 'CENTER';
            } else if (this.balance < 0) {
                readout.textContent = `L ${Math.round(Math.abs(this.balance) * 100)}%`;
            } else {
                readout.textContent = `R ${Math.round(this.balance * 100)}%`;
            }
        };

        track.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            track.setPointerCapture(e.pointerId);
            track.classList.add('dragging');
            this.playUiTick(1020, 0.025);
            setBalanceFromClientX(e.clientX);
        });

        track.addEventListener('pointermove', (e) => {
            if (!track.classList.contains('dragging')) return;
            setBalanceFromClientX(e.clientX);
        });

        const endDrag = () => track.classList.remove('dragging');
        track.addEventListener('pointerup', endDrag);
        track.addEventListener('pointercancel', endDrag);

        track.addEventListener('dblclick', () => {
            this.balance = 0;
            if (this.pannerNode && this.audioCtx) {
                this.pannerNode.pan.setTargetAtTime(0, this.audioCtx.currentTime, 0.02);
            }
            thumb.style.left = 'calc(50% - 10px)';
            readout.textContent = 'CENTER';
            this.playUiTick(1500, 0.04);
        });
    }

    /* ========================================================================
       4. METABALL LIQUID-CHROME TRANSPORT & BITMAP SPRITE STATE MACHINE
       ======================================================================== */
    bindTransportControls() {
        const btnPlay = document.getElementById('btn-meta-play');
        const btnStop = document.getElementById('btn-meta-stop');
        const btnPrev = document.getElementById('btn-meta-prev');
        const btnNext = document.getElementById('btn-meta-next');
        const btnMute = document.getElementById('btn-meta-mute');

        // Sprite hover & active states for the Metaball Pod (transports_hover.png / transports_down.png)
        const allHitButtons = [btnPlay, btnStop, btnPrev, btnNext, btnMute];
        allHitButtons.forEach((btn, idx) => {
            btn.addEventListener('pointerenter', () => {
                this.metaballPod.style.backgroundImage = "url('assets/corona/transports_hover.png')";
                if (idx === 0) this.metaballPod.classList.add('play-hover');
            });
            btn.addEventListener('pointerleave', () => {
                this.metaballPod.style.backgroundImage = "url('assets/corona/transports.png')";
                this.metaballPod.classList.remove('play-hover', 'play-down');
            });
            btn.addEventListener('pointerdown', () => {
                this.metaballPod.style.backgroundImage = "url('assets/corona/transports_down.png')";
                if (idx === 0) this.metaballPod.classList.add('play-down');
            });
            btn.addEventListener('pointerup', () => {
                this.metaballPod.style.backgroundImage = "url('assets/corona/transports_hover.png')";
                this.metaballPod.classList.remove('play-down');
            });
        });

        btnPlay.addEventListener('click', () => this.togglePlay());
        btnStop.addEventListener('click', () => this.stopPlayback());
        btnPrev.addEventListener('click', () => this.selectTransmission(this.currentTrackIdx - 1, true));
        btnNext.addEventListener('click', () => this.selectTransmission(this.currentTrackIdx + 1, true));
        btnMute.addEventListener('click', () => this.toggleMute());

        // Top Seek Capsule Buttons (-5s / +5s)
        document.getElementById('btn-seek-back').addEventListener('click', () => {
            this.playUiTick(920, 0.03);
            if (this.audioEl.duration) {
                this.audioEl.currentTime = Math.max(0, this.audioEl.currentTime - 5);
            }
        });

        document.getElementById('btn-seek-fwd').addEventListener('click', () => {
            this.playUiTick(1380, 0.03);
            if (this.audioEl.duration) {
                this.audioEl.currentTime = Math.min(this.audioEl.duration - 1, this.audioEl.currentTime + 5);
            }
        });

        // Mobile Clip-Path Drawer Toggles
        const drawer = document.getElementById('card-tracklist-drawer');
        document.getElementById('btn-drawer-toggle').addEventListener('click', () => {
            this.playUiTick(1400, 0.045);
            drawer.classList.toggle('drawer-open');
        });
        document.getElementById('btn-drawer-close').addEventListener('click', () => {
            this.playUiTick(880, 0.04);
            drawer.classList.remove('drawer-open');
        });
    }

    async togglePlay() {
        this.ensureAudioContext();
        this.playUiTick(this.isPlaying ? 740 : 1560, 0.045);

        if (this.audioEl.paused) {
            try {
                await this.audioEl.play();
                this.isPlaying = true;
                this.metaballPod.classList.add('is-playing');
                this.updateTelemetryState('LOCKED // STREAMING', 'var(--y2k-acid-green)');
            } catch (err) {
                console.warn('Playback error:', err);
            }
        } else {
            this.audioEl.pause();
            this.isPlaying = false;
            this.metaballPod.classList.remove('is-playing');
            this.updateTelemetryState('PAUSED // HOLD', 'var(--y2k-warning-amber)');
        }
    }

    stopPlayback() {
        this.playUiTick(520, 0.06);
        this.audioEl.pause();
        this.audioEl.currentTime = 0;
        this.isPlaying = false;
        this.metaballPod.classList.remove('is-playing');
        this.updateTelemetryState('STOPPED // STANDBY', 'var(--y2k-cyber-cyan)');
    }

    toggleMute() {
        this.ensureAudioContext();
        this.isMuted = !this.isMuted;
        this.playUiTick(this.isMuted ? 480 : 1320, 0.04);

        if (this.masterGain && this.audioCtx) {
            this.masterGain.gain.setTargetAtTime(this.isMuted ? 0 : this.volume, this.audioCtx.currentTime, 0.02);
        }

        const volLabel = document.getElementById('vol-label-pct');
        if (volLabel) {
            volLabel.textContent = this.isMuted ? 'MUTE' : `VOL ${Math.round(this.volume * 100)}%`;
            volLabel.style.color = this.isMuted ? 'var(--y2k-glitch-magenta)' : '';
        }
    }

    updateTelemetryState(text, color) {
        const vec = document.getElementById('stat-vector-state');
        const dockState = document.getElementById('dock-footer-state');
        if (vec) {
            vec.textContent = text.split(' // ')[0];
            vec.style.color = color;
        }
        if (dockState) {
            dockState.textContent = `STATE: ${text}`;
        }
    }

    /* ========================================================================
       5. SCRUBBER SEEK BAR & VOLUME RAMP (track_bar.png & volume_bar_filled.png)
       ======================================================================== */
    bindScrubberAndVolume() {
        const scrubberTrack = document.getElementById('scrubber-track');
        const scrubberFill = document.getElementById('scrubber-fill');
        const scrubberThumb = document.getElementById('scrubber-thumb');
        const timeCurrent = document.getElementById('time-current');
        const timeTotal = document.getElementById('time-total');

        const formatTime = (sec) => {
            if (!isFinite(sec) || sec < 0) return '00:00';
            const m = Math.floor(sec / 60);
            const s = Math.floor(sec % 60);
            return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        };

        this.audioEl.addEventListener('loadedmetadata', () => {
            timeTotal.textContent = formatTime(this.audioEl.duration);
        });

        this.audioEl.addEventListener('timeupdate', () => {
            if (scrubberTrack.classList.contains('dragging')) return;
            const dur = this.audioEl.duration || 220;
            const pct = Math.min(100, Math.max(0, (this.audioEl.currentTime / dur) * 100));
            scrubberFill.style.width = `${pct}%`;
            scrubberThumb.style.left = `${pct}%`;
            timeCurrent.textContent = formatTime(this.audioEl.currentTime);
        });

        const seekFromClientX = (clientX) => {
            const rect = scrubberTrack.getBoundingClientRect();
            const norm = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
            const pct = norm * 100;
            scrubberFill.style.width = `${pct}%`;
            scrubberThumb.style.left = `${pct}%`;
            if (this.audioEl.duration) {
                this.audioEl.currentTime = norm * this.audioEl.duration;
                timeCurrent.textContent = formatTime(this.audioEl.currentTime);
            }
        };

        scrubberTrack.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            scrubberTrack.setPointerCapture(e.pointerId);
            scrubberTrack.classList.add('dragging');
            seekFromClientX(e.clientX);
        });
        scrubberTrack.addEventListener('pointermove', (e) => {
            if (!scrubberTrack.classList.contains('dragging')) return;
            seekFromClientX(e.clientX);
        });
        const stopScrub = () => scrubberTrack.classList.remove('dragging');
        scrubberTrack.addEventListener('pointerup', stopScrub);
        scrubberTrack.addEventListener('pointercancel', stopScrub);

        // Volume Ramp
        const volRamp = document.getElementById('volume-ramp');
        const volFill = document.getElementById('volume-fill');
        const volThumb = document.getElementById('volume-thumb');
        const volLabel = document.getElementById('vol-label-pct');

        const setVolumeFromClientX = (clientX) => {
            const rect = volRamp.getBoundingClientRect();
            const norm = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
            this.volume = norm;
            this.isMuted = false;

            if (this.masterGain && this.audioCtx) {
                this.masterGain.gain.setTargetAtTime(this.volume, this.audioCtx.currentTime, 0.02);
            } else {
                this.audioEl.volume = this.volume;
            }

            const pct = Math.round(norm * 100);
            volFill.style.width = `${pct}%`;
            volThumb.style.left = `${pct}%`;
            volLabel.textContent = `VOL ${pct}%`;
            volLabel.style.color = '';
        };

        volRamp.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            volRamp.setPointerCapture(e.pointerId);
            volRamp.classList.add('dragging');
            setVolumeFromClientX(e.clientX);
        });
        volRamp.addEventListener('pointermove', (e) => {
            if (!volRamp.classList.contains('dragging')) return;
            setVolumeFromClientX(e.clientX);
        });
        const stopVol = () => volRamp.classList.remove('dragging');
        volRamp.addEventListener('pointerup', stopVol);
        volRamp.addEventListener('pointercancel', stopVol);
    }

    /* ========================================================================
       6. TRACKLIST ARCHIVE MATRIX & CLIP-PATH TRACK SWITCH REVEALS
       ======================================================================== */
    buildTracklistDOM() {
        const container = document.getElementById('tracklist-container');
        container.innerHTML = '';

        RADIO_TRANSMISSIONS.forEach((item, idx) => {
            const row = document.createElement('div');
            row.className = `corona-track-item${idx === this.currentTrackIdx ? ' active' : ''}`;
            row.dataset.idx = idx;

            row.innerHTML = `
                <div class="track-idx-pill">${String(idx + 1).padStart(2, '0')}</div>
                <div class="track-info-col">
                    <div class="track-name-line">${item.title}</div>
                    <div class="track-meta-line">${item.artist}</div>
                </div>
                <div class="track-bpm-badge">${item.bpm.toFixed(0)} BPM</div>
            `;

            row.addEventListener('click', () => {
                this.selectTransmission(idx, true);
                // On mobile, close drawer smoothly after selection
                document.getElementById('card-tracklist-drawer').classList.remove('drawer-open');
            });

            container.appendChild(row);
        });

        // Shuffle & Next Station buttons in Tracklist Header
        document.getElementById('btn-shuffle-tracks').addEventListener('click', (e) => {
            e.currentTarget.classList.toggle('active');
            const randomIdx = Math.floor(Math.random() * RADIO_TRANSMISSIONS.length);
            this.selectTransmission(randomIdx, true);
        });

        document.getElementById('btn-next-station').addEventListener('click', () => {
            this.selectTransmission(this.currentTrackIdx + 1, true);
        });
    }

    selectTransmission(index, autoPlay = false) {
        this.currentTrackIdx = (index + RADIO_TRANSMISSIONS.length) % RADIO_TRANSMISSIONS.length;
        const track = RADIO_TRANSMISSIONS[this.currentTrackIdx];
        this.playUiTick(1680, 0.05);

        // Highlight active track in DOM
        document.querySelectorAll('.corona-track-item').forEach((el, i) => {
            el.classList.toggle('active', i === this.currentTrackIdx);
        });

        // Animated Clip-Path Wipe on HUD Title
        const titleEl = document.getElementById('hud-track-title');
        const artistEl = document.getElementById('hud-artist-sub');
        const chanEl = document.getElementById('hud-channel-tag');
        const streamCodeEl = document.getElementById('viz-stream-code');
        const bpmEl = document.getElementById('stat-bpm-val');
        const pitchEl = document.getElementById('stat-pitch-val');

        titleEl.classList.remove('clip-reveal-anim');
        void titleEl.offsetWidth; // Reflow to restart animation
        titleEl.textContent = track.title;
        titleEl.classList.add('clip-reveal-anim');

        artistEl.textContent = track.artist;
        chanEl.textContent = track.channel;
        streamCodeEl.textContent = track.streamCode;
        bpmEl.textContent = `${track.bpm.toFixed(1)} BPM`;
        pitchEl.textContent = `${track.pitch.toFixed(2)}x WARP`;

        // Trigger Chromatic Glitch Burst on Visualizer Card
        this.triggerGlitchBurst();

        // Sync EQ Preset & Audio Playback Offset/Pitch
        this.applyEqPreset(track.presetIdx);
        this.audioEl.playbackRate = track.pitch;

        if (this.audioEl.duration && track.offsetSec < this.audioEl.duration) {
            this.audioEl.currentTime = track.offsetSec;
        }

        if (autoPlay) {
            this.ensureAudioContext();
            this.audioEl.play().then(() => {
                this.isPlaying = true;
                this.metaballPod.classList.add('is-playing');
                this.updateTelemetryState('LOCKED // STREAMING', 'var(--y2k-acid-green)');
            }).catch(() => {});
        }
    }

    /* ========================================================================
       7. Y2K CYBER SYNTH PADS, GLITCH FX & VISUALIZER MODE SWITCHER
       ======================================================================== */
    bindCyberPadsAndModes() {
        // Visualizer Mode Buttons
        document.querySelectorAll('.viz-mode-btn[data-viz-mode]').forEach((btn) => {
            btn.addEventListener('click', () => {
                this.playUiTick(1450, 0.035);
                this.vizMode = btn.dataset.vizMode;
                document.querySelectorAll('.viz-mode-btn[data-viz-mode]').forEach((b) => {
                    b.classList.toggle('active', b === btn);
                });
            });
        });

        // Top Glitch Capsule Button
        document.getElementById('btn-glitch-burst').addEventListener('click', () => {
            this.triggerGlitchBurst();
            this.playCyberDropSynth();
        });

        // Pad 1: Cyber Laser Drop Stinger
        document.getElementById('pad-laser-drop').addEventListener('click', () => {
            this.triggerGlitchBurst();
            this.playCyberDropSynth();
        });

        // Pad 2: Acid Resonance Sweep
        document.getElementById('pad-acid-sweep').addEventListener('click', () => {
            this.playAcidSweepSynth();
        });

        // Pad 3: Pitch Warp (Nightcore / Slow-Dub / Normal)
        document.getElementById('pad-tape-warp').addEventListener('click', () => {
            this.pitchModeIdx = (this.pitchModeIdx + 1) % this.pitchModes.length;
            const rate = this.pitchModes[this.pitchModeIdx];
            this.audioEl.playbackRate = rate;
            this.playUiTick(rate * 1100, 0.05);

            const labels = ['1.00x NORMAL', '1.12x NIGHTCORE', '0.86x DUB SLOW'];
            document.getElementById('stat-pitch-val').textContent = labels[this.pitchModeIdx];
        });
    }

    triggerGlitchBurst() {
        const vizCard = document.getElementById('card-visualizer');
        vizCard.classList.remove('bass-glitch-burst');
        void vizCard.offsetWidth;
        vizCard.classList.add('bass-glitch-burst');
    }

    playCyberDropSynth() {
        this.ensureAudioContext();
        const now = this.audioCtx.currentTime;
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(920, now);
        osc.frequency.exponentialRampToValueAtTime(55, now + 0.48);

        gain.gain.setValueAtTime(0.22, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

        osc.connect(gain);
        gain.connect(this.analyser);
        osc.start(now);
        osc.stop(now + 0.5);
    }

    playAcidSweepSynth() {
        this.ensureAudioContext();
        const now = this.audioCtx.currentTime;
        const osc = this.audioCtx.createOscillator();
        const filter = this.audioCtx.createBiquadFilter();
        const gain = this.audioCtx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(110, now);
        osc.frequency.setValueAtTime(165, now + 0.14);
        osc.frequency.setValueAtTime(82.4, now + 0.28);

        filter.type = 'lowpass';
        filter.Q.value = 14;
        filter.frequency.setValueAtTime(220, now);
        filter.frequency.exponentialRampToValueAtTime(3800, now + 0.25);
        filter.frequency.exponentialRampToValueAtTime(180, now + 0.55);

        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.58);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.analyser);
        osc.start(now);
        osc.stop(now + 0.58);
    }

    /* ========================================================================
       8. MAGNETIC HOVER PHYSICS & CURSOR HOLOGRAPHICS
       ======================================================================== */
    bindMagneticTargets() {
        const targets = document.querySelectorAll('.magnetic-target');
        targets.forEach((el) => {
            el.addEventListener('pointermove', (e) => {
                const rect = el.getBoundingClientRect();
                const centerX = rect.left + rect.width / 2;
                const centerY = rect.top + rect.height / 2;
                const deltaX = (e.clientX - centerX) * 0.28;
                const deltaY = (e.clientY - centerY) * 0.28;
                el.style.transform = `translate3d(${deltaX.toFixed(1)}px, ${deltaY.toFixed(1)}px, 0) scale(1.06)`;
            });

            el.addEventListener('pointerleave', () => {
                el.style.transform = '';
            });
        });
    }

    bindHolographicCursor() {
        const stage = document.getElementById('visualizer-stage');
        const holo = document.getElementById('viz-holo-grid');
        if (!stage || !holo) return;

        stage.addEventListener('pointermove', (e) => {
            const rect = stage.getBoundingClientRect();
            const xPct = ((e.clientX - rect.left) / rect.width) * 100;
            const yPct = ((e.clientY - rect.top) / rect.height) * 100;
            holo.style.setProperty('--cursor-x', `${xPct.toFixed(1)}%`);
            holo.style.setProperty('--cursor-y', `${yPct.toFixed(1)}%`);
        });
    }

    startSystemClock() {
        const clockEl = document.getElementById('sys-clock-readout');
        const update = () => {
            const now = new Date();
            clockEl.textContent = now.toTimeString().split(' ')[0];
        };
        update();
        setInterval(update, 1000);
    }

    /* ========================================================================
       9. 60FPS HOLOGRAPHIC CANVAS VISUALIZER
       Modes:
       - 'plasma': Liquid Chrome Metaball Orb + Concentric Harmonic Rings
       - 'matrix': 3D Isometric Y2K Spectrum Bars with Peak Hold
       - 'scope':  Dual-Channel Lissajous / Cyber Oscilloscope Ribbon
       ======================================================================== */
    resizeCanvas() {
        const stage = document.getElementById('visualizer-stage');
        if (!stage || !this.canvas) return;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        this.canvas.width = stage.clientWidth * dpr;
        this.canvas.height = stage.clientHeight * dpr;
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this.logicalWidth = stage.clientWidth;
        this.logicalHeight = stage.clientHeight;
    }

    renderLoop(timestamp) {
        const dt = timestamp - this.lastFrameTime;
        this.lastFrameTime = timestamp;

        const w = this.logicalWidth || 600;
        const h = this.logicalHeight || 300;
        const ctx = this.ctx;

        // Gather real Web Audio spectrum or synthesize idle harmonic pulse
        let bassAvg = 0;
        let midAvg = 0;
        if (this.analyser && this.isPlaying) {
            this.analyser.getByteFrequencyData(this.freqData);
            this.analyser.getByteTimeDomainData(this.timeData);

            for (let i = 0; i < 12; i++) bassAvg += this.freqData[i];
            bassAvg /= 12;

            for (let i = 12; i < 64; i++) midAvg += this.freqData[i];
            midAvg /= 52;
        } else {
            // Smooth procedural idle wave so the Y2K visualizer breathes even before pressing Play
            const t = timestamp * 0.0025;
            for (let i = 0; i < 128; i++) {
                this.freqData[i] = Math.floor(32 + 24 * Math.sin(t + i * 0.14) * Math.cos(t * 0.6 - i * 0.05));
                this.timeData[i] = Math.floor(128 + 18 * Math.sin(t * 2 + i * 0.2));
            }
            bassAvg = 38 + 15 * Math.sin(t * 1.5);
            midAvg = 28 + 10 * Math.cos(t);
        }

        // Update Telemetry HUD Readouts
        const bassPct = Math.min(100, Math.round((bassAvg / 255) * 100));
        const bassEl = document.getElementById('stat-bass-energy');
        if (bassEl) bassEl.textContent = `${String(bassPct).padStart(3, '0')}%`;

        const peakDbEl = document.getElementById('viz-peak-db');
        if (peakDbEl) {
            const db = bassAvg > 5 ? (20 * Math.log10(bassAvg / 255)).toFixed(1) : '-INF';
            peakDbEl.textContent = `PEAK: ${db} dB`;
        }

        // Trigger subtle chromatic glitch on heavy sub-bass transients (> 228)
        if (bassAvg > 228 && Math.random() < 0.18) {
            this.triggerGlitchBurst();
        }

        // Translucent Motion Trail Clear
        ctx.fillStyle = 'rgba(3, 7, 18, 0.28)';
        ctx.fillRect(0, 0, w, h);

        if (this.vizMode === 'plasma') {
            this.drawLiquidOrbMode(ctx, w, h, timestamp * 0.001, bassAvg, midAvg);
        } else if (this.vizMode === 'matrix') {
            this.drawSpectrumMatrixMode(ctx, w, h, timestamp * 0.001, bassAvg);
        } else {
            this.drawCyberScopeMode(ctx, w, h, timestamp * 0.001, bassAvg);
        }

        requestAnimationFrame((t) => this.renderLoop(t));
    }

    drawLiquidOrbMode(ctx, w, h, t, bass, mid) {
        const cx = w * 0.5;
        const cy = h * 0.46;
        const baseRadius = Math.min(w, h) * 0.22 + (bass / 255) * 34;

        ctx.save();
        // Outer Cobalt/Cyan Aura
        const grad = ctx.createRadialGradient(cx, cy, baseRadius * 0.15, cx, cy, baseRadius * 1.65);
        grad.addColorStop(0, 'rgba(0, 255, 102, 0.85)');
        grad.addColorStop(0.45, 'rgba(0, 240, 255, 0.45)');
        grad.addColorStop(0.78, 'rgba(104, 130, 200, 0.18)');
        grad.addColorStop(1, 'rgba(7, 11, 22, 0)');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, baseRadius * 1.65, 0, Math.PI * 2);
        ctx.fill();

        // Deforming Liquid-Chrome Metaball Contour (64 radial harmonic vertices)
        ctx.beginPath();
        const steps = 64;
        for (let i = 0; i <= steps; i++) {
            const angle = (i / steps) * Math.PI * 2;
            const bin = i % 32;
            const amp = (this.freqData[bin] / 255) * 28;
            const wave = Math.sin(angle * 4 + t * 3.2) * 8 + Math.cos(angle * 3 - t * 2.1) * 6;
            const r = baseRadius + amp + wave;
            const x = cx + Math.cos(angle) * r;
            const y = cy + Math.sin(angle) * r;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();

        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 2.4;
        ctx.shadowColor = '#00ff66';
        ctx.shadowBlur = 16;
        ctx.stroke();

        // Inner Specular Chrome Core
        ctx.fillStyle = 'rgba(226, 232, 248, 0.16)';
        ctx.fill();
        ctx.restore();
    }

    drawSpectrumMatrixMode(ctx, w, h, t, bass) {
        const numBars = 36;
        const marginX = 28;
        const usableW = w - marginX * 2;
        const barW = (usableW / numBars) * 0.68;
        const stepX = usableW / numBars;
        const baseY = h * 0.76;

        ctx.save();
        for (let i = 0; i < numBars; i++) {
            const val = this.freqData[i * 2] / 255;
            const barH = Math.max(6, val * (h * 0.54));
            const x = marginX + i * stepX;
            const y = baseY - barH;

            const grad = ctx.createLinearGradient(x, y, x, baseY);
            grad.addColorStop(0, '#00ff66');
            grad.addColorStop(0.5, '#00f0ff');
            grad.addColorStop(1, '#3b63d1');

            ctx.fillStyle = grad;
            ctx.fillRect(x, y, barW, barH);

            // Neon Top Cap
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(x, y - 4, barW, 2.5);
        }
        ctx.restore();
    }

    drawCyberScopeMode(ctx, w, h, t, bass) {
        ctx.save();
        ctx.beginPath();
        const sliceW = w / 128;
        const midY = h * 0.46;

        for (let i = 0; i < 128; i++) {
            const v = (this.timeData[i] - 128) / 128;
            const x = i * sliceW;
            const y = midY + v * (h * 0.36);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }

        ctx.strokeStyle = '#00ff66';
        ctx.lineWidth = 2.6;
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 14;
        ctx.stroke();
        ctx.restore();
    }
}

window.addEventListener('DOMContentLoaded', () => {
    window.coronaEngine = new CoronaBentoEngine();
});
