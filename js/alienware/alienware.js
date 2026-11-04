/**
 * ============================================================================
 * ALIENWARE INVADER // THE SKINS FACTORY (js/alienware/alienware.js)
 * Creative Development & Audio Engineering:
 * - Web Audio API 10-Band BiquadFilter DSP + StereoPannerNode + Spatial Effects
 * - Shutter Morphing (Closed Pod preview.png <-> Open Cockpit main_back.png)
 * - 16-Step Curved Volume Arch (volume.png)
 * - 10-Band Tactile Sliders & Balance in eq_back.png (eq_thumb.png)
 * - 7 Authentic Alienware Sci-Fi Cyber Transmissions (alienskin_mix03_part*.wav)
 * - 60FPS Tactical Sonar Radar & Oscilloscope Canvas Visualizer
 * - Dynamic AlienFX RGB Colorway System (Cyan, Green, Purple, Red)
 * ============================================================================
 */

const EQ_FREQS = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
const EQ_X_SLOTS = [34, 50, 66, 82, 98, 114, 130, 146, 162, 178];

const EQ_PRESETS = [
    { name: 'ALIEN OVERDRIVE', gains: [ 8,  6,  3, -1, -2,  2,  5,  7,  9, 10] },
    { name: 'STEALTH GAMING',  gains: [ 5,  4,  2,  0,  1,  3,  6,  8,  8,  9] },
    { name: 'DEEP IMPACT SUB', gains: [11,  9,  5,  2, -1, -2,  1,  3,  4,  5] },
    { name: 'VOCAL CLARITY',   gains: [-4, -2,  1,  4,  7,  6,  4,  1, -1, -3] },
    { name: 'FLAT 0 dB',       gains: [ 0,  0,  0,  0,  0,  0,  0,  0,  0,  0] }
];

const RADIO_CHANNELS = [
    {
        title: 'CYBERIA 2004 (CORONA DUB)',
        artist: 'DJ MARCO BETTIN // QDG PIRATE ARCHIVE',
        duration: '03:42',
        offset: 0
    },
    {
        title: 'INVADER COMMAND (THE SKINS FACTORY)',
        artist: 'ALIENWARE SOUND LAB // AREA-51 VIP',
        duration: '04:15',
        offset: 24
    },
    {
        title: 'NEON MATRIX UPLINK',
        artist: 'CYBERPUNK COLLECTIVE // SUB-BASS MIX',
        duration: '03:58',
        offset: 52
    },
    {
        title: 'ANODIZED TITANIUM PULSE',
        artist: 'STEALTH UNIT // TECHNO TRANSIENTS',
        duration: '04:30',
        offset: 85
    },
    {
        title: 'DEEP SPACE SONAR 303',
        artist: 'ALIENFX LABS // ACID ENCOUNTER',
        duration: '05:02',
        offset: 115
    },
    {
        title: 'TACTICAL RADAR SHUTDOWN',
        artist: 'RADIOFAX OUTPOST // AMBIENT ECHO',
        duration: '03:20',
        offset: 142
    }
];

class AlienwareInvaderEngine {
    constructor() {
        this.audioEl = document.getElementById('alienware-audio');
        this.audioCtx = null;
        this.sourceNode = null;
        this.eqFilters = [];
        this.pannerNode = null;
        this.wowFilter = null;
        this.trubassFilter = null;
        this.masterGain = null;
        this.analyser = null;

        // Sound FX audio buffers
        this.sfxBuffers = {};
        this.sfxNames = {
            click: 'assets/alienware/click.wav',
            window: 'assets/alienware/window.wav',
            shutter: 'assets/alienware/shutter_close.wav',
            tx1: 'assets/alienware/alienskin_mix03_part01v2.wav',
            tx2: 'assets/alienware/alienskin_mix03_part02v2.wav',
            tx3: 'assets/alienware/alienskin_mix03_part03v2.wav',
            tx4: 'assets/alienware/alienskin_mix03_part04v2.wav',
            tx5: 'assets/alienware/alienskin_mix03_part05v2.wav',
            tx6: 'assets/alienware/alienskin_mix03_part06v2.wav',
            tx7: 'assets/alienware/alienskin_mix03_part07v2.wav'
        };

        // State
        this.isPlaying = false;
        this.isMuted = false;
        this.volume = 0.85; // 0..1
        this.balance = 0.0; // -1..+1
        this.wowActive = true;
        this.trubassActive = true;
        this.isPodOpen = true;
        this.currentTrackIdx = 0;
        this.currentGains = [...EQ_PRESETS[0].gains];
        this.vizMode = 'radar'; // 'radar' | 'spectrum' | 'scope'
        this.radarAngle = 0;

        // Visualizer Canvas
        this.canvas = document.getElementById('alien-radar-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.freqData = new Uint8Array(256);
        this.timeData = new Uint8Array(256);

        this.init();
    }

    init() {
        this.initAlienFXTheme();
        this.initHeroPodAndVolume();
        this.initHardwareEqualizer();
        this.initVoiceFxButtons();
        this.initPlaylistDOM();
        this.initScrubberAndControls();
        this.initVisualizer();
        this.preloadSfx();

        // 60FPS Render Loop
        requestAnimationFrame((t) => this.renderLoop(t));
    }

    /* ========================================================================
       1. WEB AUDIO API DSP GRAPH (10-BAND EQ + SPATIAL WOW + SRS TRUBASS)
       ======================================================================== */
    ensureAudioContext() {
        if (!this.audioCtx) {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            this.audioCtx = new AudioContextClass();

            this.sourceNode = this.audioCtx.createMediaElementSource(this.audioEl);

            // 10 BiquadFilterNodes
            this.eqFilters = EQ_FREQS.map((freq, idx) => {
                const f = this.audioCtx.createBiquadFilter();
                f.type = idx === 0 ? 'lowshelf' : (idx === EQ_FREQS.length - 1 ? 'highshelf' : 'peaking');
                f.frequency.value = freq;
                f.Q.value = 1.4;
                f.gain.value = this.currentGains[idx];
                return f;
            });

            // Stereo Panner Node
            this.pannerNode = this.audioCtx.createStereoPanner();
            this.pannerNode.pan.value = this.balance;

            // SRS TruBass Low-End Saturation Filter
            this.trubassFilter = this.audioCtx.createBiquadFilter();
            this.trubassFilter.type = 'lowshelf';
            this.trubassFilter.frequency.value = 85;
            this.trubassFilter.gain.value = this.trubassActive ? 6.5 : 0;

            // WOW Spatial Enhancer Filter (high-shelf sparkle)
            this.wowFilter = this.audioCtx.createBiquadFilter();
            this.wowFilter.type = 'highshelf';
            this.wowFilter.frequency.value = 6500;
            this.wowFilter.gain.value = this.wowActive ? 4.0 : 0;

            // Master Gain
            this.masterGain = this.audioCtx.createGain();
            this.masterGain.gain.value = this.isMuted ? 0 : this.volume;

            // Analyser
            this.analyser = this.audioCtx.createAnalyser();
            this.analyser.fftSize = 512;
            this.analyser.smoothingTimeConstant = 0.84;
            this.freqData = new Uint8Array(this.analyser.frequencyBinCount);
            this.timeData = new Uint8Array(this.analyser.frequencyBinCount);

            // Audio Graph Routing:
            // Source -> EQ[0..9] -> TruBass -> WOW -> StereoPanner -> MasterGain -> Analyser -> Dest
            let prev = this.sourceNode;
            this.eqFilters.forEach((filterNode) => {
                prev.connect(filterNode);
                prev = filterNode;
            });
            prev.connect(this.trubassFilter);
            this.trubassFilter.connect(this.wowFilter);
            this.wowFilter.connect(this.pannerNode);
            this.pannerNode.connect(this.masterGain);
            this.masterGain.connect(this.analyser);
            this.analyser.connect(this.audioCtx.destination);
        }

        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
    }

    async preloadSfx() {
        // Preload sound effects asynchronously
        for (const [key, path] of Object.entries(this.sfxNames)) {
            try {
                const res = await fetch(path);
                const arrayBuf = await res.arrayBuffer();
                if (this.audioCtx) {
                    this.sfxBuffers[key] = await this.audioCtx.decodeAudioData(arrayBuf);
                } else {
                    // Fallback using HTMLAudioElement
                    const a = new Audio(path);
                    this.sfxBuffers[key] = a;
                }
            } catch (_) {}
        }
    }

    playSfx(key, volume = 0.7) {
        try {
            this.ensureAudioContext();
            const buf = this.sfxBuffers[key];
            if (buf instanceof AudioBuffer && this.audioCtx) {
                const src = this.audioCtx.createBufferSource();
                const gain = this.audioCtx.createGain();
                gain.gain.value = volume;
                src.buffer = buf;
                src.connect(gain);
                gain.connect(this.audioCtx.destination);
                src.start();
            } else if (buf instanceof Audio) {
                buf.volume = volume;
                buf.currentTime = 0;
                buf.play().catch(() => {});
            } else if (this.sfxNames[key]) {
                const a = new Audio(this.sfxNames[key]);
                a.volume = volume;
                a.play().catch(() => {});
            }
        } catch (_) {}
    }

    /* ========================================================================
       2. ALIENFX RGB LIGHTING THEME SWITCHER
       ======================================================================== */
    initAlienFXTheme() {
        const swatches = document.querySelectorAll('.alienfx-swatch');
        swatches.forEach((swatch) => {
            swatch.addEventListener('click', () => {
                const color = swatch.dataset.color;
                document.body.setAttribute('data-alienfx', color);
                swatches.forEach((s) => s.classList.toggle('active', s === swatch));
                this.playSfx('click', 0.5);

                const status = document.getElementById('alien-rig-status');
                if (status) {
                    status.textContent = `TACTICAL AUDIO RIG // ALIENFX [${color.toUpperCase()}] // OVERCLOCK LOCKED`;
                }
            });
        });

        // Logo Head Easter Egg: click plays cyber servo sound
        document.getElementById('alien-logo-head').addEventListener('click', () => {
            this.playSfx('window', 0.85);
        });
    }

    /* ========================================================================
       3. HERO INTERACTIVE INVADER POD (preview.png <-> main_back.png)
       ======================================================================== */
    initHeroPodAndVolume() {
        const podChassis = document.getElementById('invader-pod-chassis');
        const closedView = document.getElementById('pod-shutter-closed');
        const toggleBtn = document.getElementById('btn-toggle-pod');
        const statusChip = document.getElementById('pod-mode-status');

        const setPodState = (isOpen) => {
            this.isPodOpen = isOpen;
            podChassis.classList.toggle('is-open', isOpen);
            podChassis.classList.toggle('is-closed', !isOpen);

            if (isOpen) {
                statusChip.innerHTML = '<span style="width:6px;height:6px;border-radius:50%;background:currentColor;"></span> COCKPIT OPEN';
                statusChip.style.color = 'var(--fx-primary)';
                this.playSfx('window', 0.8);
            } else {
                statusChip.innerHTML = '<span style="width:6px;height:6px;border-radius:50%;background:currentColor;"></span> SHUTTER CLOSED';
                statusChip.style.color = '#94a3b8';
                this.playSfx('shutter', 0.85);
            }
        };

        toggleBtn.addEventListener('click', () => setPodState(!this.isPodOpen));
        closedView.addEventListener('click', () => setPodState(true));

        // 16-Step Curved Volume Arch (volume.png 560x85, each frame 35px)
        const volArch = document.getElementById('pod-volume-arch');
        const volLabel = document.getElementById('volume-pct-label');

        const updateVolVisual = (norm) => {
            const frame = Math.max(0, Math.min(15, Math.floor(norm * 16)));
            volArch.style.backgroundPosition = `-${frame * 35}px 0`;
            const pct = Math.round(norm * 100);
            if (volLabel) volLabel.textContent = `VOL: ${pct}%`;
        };

        const setVolumeFromClientY = (clientY) => {
            const rect = volArch.getBoundingClientRect();
            // Inverted vertical drag (top = high volume, bottom = 0)
            const norm = 1 - Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
            this.volume = norm;
            this.isMuted = false;

            if (this.masterGain && this.audioCtx) {
                this.masterGain.gain.setTargetAtTime(this.volume, this.audioCtx.currentTime, 0.02);
            } else {
                this.audioEl.volume = this.volume;
            }

            updateVolVisual(norm);
        };

        volArch.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            volArch.setPointerCapture(e.pointerId);
            volArch.classList.add('dragging');
            this.playSfx('click', 0.4);
            setVolumeFromClientY(e.clientY);
        });

        volArch.addEventListener('pointermove', (e) => {
            if (!volArch.classList.contains('dragging')) return;
            setVolumeFromClientY(e.clientY);
        });

        const stopVolDrag = () => volArch.classList.remove('dragging');
        volArch.addEventListener('pointerup', stopVolDrag);
        volArch.addEventListener('pointercancel', stopVolDrag);

        // Initial volume visual
        updateVolVisual(this.volume);

        // Cockpit Transport Buttons
        const btnPlay = document.getElementById('btn-pod-play');
        const btnStop = document.getElementById('btn-pod-stop');
        const btnPrev = document.getElementById('btn-pod-prev');
        const btnNext = document.getElementById('btn-pod-next');
        const btnMute = document.getElementById('btn-pod-mute');
        const pauseOverlay = document.getElementById('pod-pause-overlay');

        btnPlay.addEventListener('click', () => this.togglePlay());
        pauseOverlay.addEventListener('click', () => this.togglePlay());
        btnStop.addEventListener('click', () => this.stopPlayback());
        btnPrev.addEventListener('click', () => this.selectTrack(this.currentTrackIdx - 1, true));
        btnNext.addEventListener('click', () => this.selectTrack(this.currentTrackIdx + 1, true));

        btnMute.addEventListener('click', () => {
            this.isMuted = !this.isMuted;
            this.playSfx('click', 0.5);
            if (this.masterGain && this.audioCtx) {
                this.masterGain.gain.setTargetAtTime(this.isMuted ? 0 : this.volume, this.audioCtx.currentTime, 0.02);
            }
            if (volLabel) volLabel.textContent = this.isMuted ? 'VOL: MUTE' : `VOL: ${Math.round(this.volume * 100)}%`;
        });
    }

    async togglePlay() {
        this.ensureAudioContext();
        this.playSfx('click', 0.6);

        const pauseOverlay = document.getElementById('pod-pause-overlay');

        if (this.audioEl.paused) {
            try {
                await this.audioEl.play();
                this.isPlaying = true;
                pauseOverlay.classList.add('active');
            } catch (_) {}
        } else {
            this.audioEl.pause();
            this.isPlaying = false;
            pauseOverlay.classList.remove('active');
        }
    }

    stopPlayback() {
        this.playSfx('click', 0.5);
        this.audioEl.pause();
        this.audioEl.currentTime = 0;
        this.isPlaying = false;
        document.getElementById('pod-pause-overlay').classList.remove('active');
    }

    /* ========================================================================
       4. SCRUBBER SEEK BAR & TIME DISPLAY
       ======================================================================== */
    initScrubberAndControls() {
        const scrubber = document.getElementById('invader-scrubber');
        const scrubberFill = document.getElementById('invader-scrubber-fill');
        const timeCur = document.getElementById('scrubber-time-cur');
        const timeTot = document.getElementById('scrubber-time-tot');
        const lcdTime = document.getElementById('pod-lcd-time');

        const formatTime = (sec) => {
            if (!isFinite(sec) || sec < 0) return '00:00';
            const m = Math.floor(sec / 60);
            const s = Math.floor(sec % 60);
            return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        };

        this.audioEl.addEventListener('loadedmetadata', () => {
            timeTot.textContent = formatTime(this.audioEl.duration);
        });

        this.audioEl.addEventListener('timeupdate', () => {
            if (scrubber.classList.contains('dragging')) return;
            const dur = this.audioEl.duration || 222;
            const pct = Math.min(100, Math.max(0, (this.audioEl.currentTime / dur) * 100));
            scrubberFill.style.width = `${pct}%`;
            const formatted = formatTime(this.audioEl.currentTime);
            timeCur.textContent = formatted;
            if (lcdTime) lcdTime.textContent = formatted;
        });

        const seekFromClientX = (clientX) => {
            const rect = scrubber.getBoundingClientRect();
            const norm = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
            scrubberFill.style.width = `${norm * 100}%`;
            if (this.audioEl.duration) {
                this.audioEl.currentTime = norm * this.audioEl.duration;
            }
        };

        scrubber.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            scrubber.setPointerCapture(e.pointerId);
            scrubber.classList.add('dragging');
            seekFromClientX(e.clientX);
        });
        scrubber.addEventListener('pointermove', (e) => {
            if (!scrubber.classList.contains('dragging')) return;
            seekFromClientX(e.clientX);
        });
        const stopScrub = () => scrubber.classList.remove('dragging');
        scrubber.addEventListener('pointerup', stopScrub);
        scrubber.addEventListener('pointercancel', stopScrub);
    }

    /* ========================================================================
       5. 10-BAND TACTILE EQUALIZER & BALANCE INSIDE eq_back.png
       ======================================================================== */
    initHardwareEqualizer() {
        const rack = document.getElementById('eq-slots-rack');
        rack.innerHTML = '';

        EQ_X_SLOTS.forEach((slotX, idx) => {
            const slot = document.createElement('div');
            slot.className = 'eq-slider-slot';
            slot.style.left = `${slotX}px`;
            slot.title = `${EQ_FREQS[idx]} Hz // Trascina o usa la rotella (-12dB / +12dB)`;

            const thumb = document.createElement('div');
            thumb.className = 'eq-slider-thumb';
            thumb.id = `aw-eq-thumb-${idx}`;
            slot.appendChild(thumb);
            rack.appendChild(slot);

            const updateFromPointer = (clientY) => {
                const rect = slot.getBoundingClientRect();
                const pad = 9; // half thumb height
                const y = Math.max(pad, Math.min(rect.height - pad, clientY - rect.top));
                const norm = 1 - (y - pad) / (rect.height - pad * 2); // 0 (bottom) to 1 (top)
                const db = (norm * 24) - 12; // -12 to +12 dB
                this.setEqBand(idx, db);
            };

            slot.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                slot.setPointerCapture(e.pointerId);
                slot.classList.add('dragging');
                this.playSfx('click', 0.35);
                updateFromPointer(e.clientY);
            });

            slot.addEventListener('pointermove', (e) => {
                if (!slot.classList.contains('dragging')) return;
                updateFromPointer(e.clientY);
            });

            const endDrag = () => slot.classList.remove('dragging');
            slot.addEventListener('pointerup', endDrag);
            slot.addEventListener('pointercancel', endDrag);

            slot.addEventListener('wheel', (e) => {
                e.preventDefault();
                const delta = e.deltaY < 0 ? 1.0 : -1.0;
                this.setEqBand(idx, this.currentGains[idx] + delta);
            }, { passive: false });

            slot.addEventListener('dblclick', () => {
                this.setEqBand(idx, 0);
            });
        });

        // Balance Slider in eq_back.png (x: 209 to 327)
        const balSlot = document.getElementById('eq-balance-slot');
        const balThumb = document.getElementById('balance-thumb');
        const balReadout = document.getElementById('eq-balance-readout');

        const setBalFromClientX = (clientX) => {
            const rect = balSlot.getBoundingClientRect();
            const pad = 4;
            const x = Math.max(pad, Math.min(rect.width - pad, clientX - rect.left));
            const norm = (x - pad) / (rect.width - pad * 2);
            this.balance = (norm * 2) - 1;

            if (this.pannerNode && this.audioCtx) {
                this.pannerNode.pan.setTargetAtTime(this.balance, this.audioCtx.currentTime, 0.02);
            }

            balThumb.style.left = `calc(${norm * 100}% - 4px)`;
            if (Math.abs(this.balance) < 0.08) {
                balReadout.textContent = 'BAL: CENTER';
            } else if (this.balance < 0) {
                balReadout.textContent = `BAL: L ${Math.round(Math.abs(this.balance) * 100)}%`;
            } else {
                balReadout.textContent = `BAL: R ${Math.round(this.balance * 100)}%`;
            }
        };

        balSlot.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            balSlot.setPointerCapture(e.pointerId);
            balSlot.classList.add('dragging');
            this.playSfx('click', 0.35);
            setBalFromClientX(e.clientX);
        });

        balSlot.addEventListener('pointermove', (e) => {
            if (!balSlot.classList.contains('dragging')) return;
            setBalFromClientX(e.clientX);
        });

        const stopBalDrag = () => balSlot.classList.remove('dragging');
        balSlot.addEventListener('pointerup', stopBalDrag);
        balSlot.addEventListener('pointercancel', stopBalDrag);

        balSlot.addEventListener('dblclick', () => {
            this.balance = 0;
            if (this.pannerNode && this.audioCtx) {
                this.pannerNode.pan.setTargetAtTime(0, this.audioCtx.currentTime, 0.02);
            }
            balThumb.style.left = 'calc(50% - 4px)';
            balReadout.textContent = 'BAL: CENTER';
        });

        // WOW & TruBass Toggles
        const btnWow = document.getElementById('btn-toggle-wow');
        const btnTru = document.getElementById('btn-toggle-trubass');

        btnWow.addEventListener('click', () => {
            this.wowActive = !this.wowActive;
            btnWow.classList.toggle('active', this.wowActive);
            this.playSfx('click', 0.45);
            if (this.wowFilter && this.audioCtx) {
                this.wowFilter.gain.setTargetAtTime(this.wowActive ? 4.0 : 0, this.audioCtx.currentTime, 0.03);
            }
        });

        btnTru.addEventListener('click', () => {
            this.trubassActive = !this.trubassActive;
            btnTru.classList.toggle('active', this.trubassActive);
            this.playSfx('click', 0.45);
            if (this.trubassFilter && this.audioCtx) {
                this.trubassFilter.gain.setTargetAtTime(this.trubassActive ? 6.5 : 0, this.audioCtx.currentTime, 0.03);
            }
        });

        // Presets Ribbon
        const pills = document.querySelectorAll('.eq-preset-pill');
        pills.forEach((pill) => {
            pill.addEventListener('click', () => {
                const pIdx = parseInt(pill.dataset.preset, 10);
                pills.forEach((p) => p.classList.toggle('active', p === pill));
                this.playSfx('click', 0.45);
                this.applyEqPreset(pIdx);
            });
        });

        // Set initial visuals
        this.currentGains.forEach((g, idx) => this.updateEqThumbVisual(idx, g));
    }

    setEqBand(idx, db) {
        const clamped = Math.max(-12, Math.min(12, db));
        this.currentGains[idx] = clamped;

        if (this.eqFilters[idx] && this.audioCtx) {
            this.eqFilters[idx].gain.setTargetAtTime(clamped, this.audioCtx.currentTime, 0.02);
        }

        this.updateEqThumbVisual(idx, clamped);
    }

    updateEqThumbVisual(idx, db) {
        const thumb = document.getElementById(`aw-eq-thumb-${idx}`);
        if (!thumb) return;
        const norm = (db + 12) / 24; // 0..1
        const maxTravel = 114 - 19; // slot height - thumb height
        const topPx = (1 - norm) * maxTravel;
        thumb.style.top = `${topPx}px`;
    }

    applyEqPreset(pIdx) {
        const preset = EQ_PRESETS[pIdx];
        if (!preset) return;
        preset.gains.forEach((gain, i) => {
            this.setEqBand(i, gain);
        });
    }

    /* ========================================================================
       6. CYBER TRANSMISSIONS / VOICE FX (alienskin_mix03_part*.wav)
       ======================================================================== */
    initVoiceFxButtons() {
        const btns = document.querySelectorAll('.voice-fx-btn');
        btns.forEach((btn) => {
            btn.addEventListener('click', () => {
                const sndIdx = btn.dataset.sound;
                const sfxKey = `tx${sndIdx}`;

                btns.forEach((b) => b.classList.remove('playing'));
                btn.classList.add('playing');

                // Duck music slightly while voice transmission plays
                if (this.masterGain && this.audioCtx) {
                    this.masterGain.gain.setTargetAtTime(this.volume * 0.35, this.audioCtx.currentTime, 0.1);
                }

                this.playSfx(sfxKey, 0.95);

                // Restore music after estimated duration
                setTimeout(() => {
                    btn.classList.remove('playing');
                    if (this.masterGain && this.audioCtx) {
                        this.masterGain.gain.setTargetAtTime(this.isMuted ? 0 : this.volume, this.audioCtx.currentTime, 0.2);
                    }
                }, 4000);
            });
        });
    }

    /* ========================================================================
       7. PLAYLIST QUEUE & SELECTION
       ======================================================================== */
    initPlaylistDOM() {
        const container = document.getElementById('playlist-container');
        container.innerHTML = '';

        RADIO_CHANNELS.forEach((ch, idx) => {
            const row = document.createElement('div');
            row.className = `tactical-track-item${idx === this.currentTrackIdx ? ' active' : ''}`;
            row.dataset.idx = idx;

            row.innerHTML = `
                <div class="track-index-num">${String(idx + 1).padStart(2, '0')}</div>
                <div>
                    <div class="track-title-text">${ch.title}</div>
                    <div class="track-artist-text">${ch.artist}</div>
                </div>
                <div class="track-length-chip">${ch.duration}</div>
            `;

            row.addEventListener('click', () => {
                this.selectTrack(idx, true);
            });

            container.appendChild(row);
        });
    }

    selectTrack(idx, autoPlay = false) {
        this.currentTrackIdx = (idx + RADIO_CHANNELS.length) % RADIO_CHANNELS.length;
        const track = RADIO_CHANNELS[this.currentTrackIdx];
        this.playSfx('window', 0.6);

        document.querySelectorAll('.tactical-track-item').forEach((el, i) => {
            el.classList.toggle('active', i === this.currentTrackIdx);
        });

        document.getElementById('hud-track-title').textContent = track.title;
        document.getElementById('hud-track-artist').textContent = track.artist;

        if (this.audioEl.duration && track.offset < this.audioEl.duration) {
            this.audioEl.currentTime = track.offset;
        }

        if (autoPlay) {
            this.ensureAudioContext();
            this.audioEl.play().then(() => {
                this.isPlaying = true;
                document.getElementById('pod-pause-overlay').classList.add('active');
            }).catch(() => {});
        }
    }

    /* ========================================================================
       8. 60FPS TACTICAL SONAR RADAR & OSCILLOSCOPE CANVAS
       ======================================================================== */
    initVisualizer() {
        const modeChips = document.querySelectorAll('.viz-mode-chip');
        modeChips.forEach((chip) => {
            chip.addEventListener('click', () => {
                this.vizMode = chip.dataset.mode;
                modeChips.forEach((c) => c.classList.toggle('active', c === chip));
                this.playSfx('click', 0.4);
            });
        });

        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
    }

    resizeCanvas() {
        const stage = document.getElementById('tactical-hud-stage');
        if (!stage || !this.canvas) return;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        this.canvas.width = stage.clientWidth * dpr;
        this.canvas.height = stage.clientHeight * dpr;
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this.cw = stage.clientWidth;
        this.ch = stage.clientHeight;
    }

    renderLoop(timestamp) {
        const w = this.cw || 500;
        const h = this.ch || 280;
        const ctx = this.ctx;

        let bass = 0;
        if (this.analyser && this.isPlaying) {
            this.analyser.getByteFrequencyData(this.freqData);
            this.analyser.getByteTimeDomainData(this.timeData);
            for (let i = 0; i < 16; i++) bass += this.freqData[i];
            bass /= 16;
        } else {
            // Idle ambient radar wave
            const t = timestamp * 0.003;
            for (let i = 0; i < 128; i++) {
                this.freqData[i] = Math.floor(35 + 25 * Math.sin(t + i * 0.15));
                this.timeData[i] = Math.floor(128 + 20 * Math.sin(t * 2 + i * 0.1));
            }
            bass = 40 + 20 * Math.sin(t);
        }

        // Peak readout
        const peakEl = document.getElementById('hud-peak-db');
        if (peakEl) {
            const db = bass > 5 ? (20 * Math.log10(bass / 255)).toFixed(1) : '-INF';
            peakEl.textContent = `PEAK: ${db} dB`;
        }

        // Translucent trail clear
        ctx.fillStyle = 'rgba(3, 6, 12, 0.28)';
        ctx.fillRect(0, 0, w, h);

        if (this.vizMode === 'radar') {
            this.drawSonarRadar(ctx, w, h, timestamp * 0.001, bass);
        } else if (this.vizMode === 'spectrum') {
            this.draw3DSpectrum(ctx, w, h, bass);
        } else {
            this.drawOscilloscope(ctx, w, h);
        }

        requestAnimationFrame((t) => this.renderLoop(t));
    }

    drawSonarRadar(ctx, w, h, t, bass) {
        const cx = w * 0.5;
        const cy = h * 0.48;
        const maxR = Math.min(w, h) * 0.38;

        this.radarAngle += 0.035 + (bass / 255) * 0.04;

        ctx.save();
        // Concentric Tactical Circles
        for (let r = 1; r <= 4; r++) {
            ctx.beginPath();
            ctx.arc(cx, cy, (maxR / 4) * r, 0, Math.PI * 2);
            ctx.strokeStyle = r === 4 ? 'rgba(0, 240, 255, 0.4)' : 'rgba(0, 240, 255, 0.15)';
            ctx.lineWidth = 1;
            ctx.stroke();
        }

        // Crosshairs
        ctx.beginPath();
        ctx.moveTo(cx - maxR, cy); ctx.lineTo(cx + maxR, cy);
        ctx.moveTo(cx, cy - maxR); ctx.lineTo(cx, cy + maxR);
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.2)';
        ctx.stroke();

        // Sweeping Sonar Beam
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, maxR, this.radarAngle - 0.45, this.radarAngle);
        ctx.closePath();

        const sweepGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR);
        sweepGrad.addColorStop(0, 'rgba(0, 240, 255, 0.35)');
        sweepGrad.addColorStop(1, 'rgba(0, 240, 255, 0.0)');
        ctx.fillStyle = sweepGrad;
        ctx.fill();

        // Reactive Audio Blips
        for (let i = 0; i < 8; i++) {
            const val = this.freqData[i * 8] / 255;
            if (val > 0.4) {
                const angle = i * (Math.PI / 4) + t * 0.2;
                const dist = maxR * (0.3 + val * 0.6);
                const bx = cx + Math.cos(angle) * dist;
                const by = cy + Math.sin(angle) * dist;

                ctx.beginPath();
                ctx.arc(bx, by, 3 + val * 4, 0, Math.PI * 2);
                ctx.fillStyle = '#00f0ff';
                ctx.shadowColor = '#00f0ff';
                ctx.shadowBlur = 10;
                ctx.fill();
            }
        }
        ctx.restore();
    }

    draw3DSpectrum(ctx, w, h, bass) {
        const numBars = 32;
        const barW = (w / numBars) * 0.72;
        const stepX = w / numBars;
        const baseY = h * 0.78;

        ctx.save();
        for (let i = 0; i < numBars; i++) {
            const val = this.freqData[i * 2] / 255;
            const barH = Math.max(4, val * (h * 0.52));
            const x = i * stepX + 4;
            const y = baseY - barH;

            const grad = ctx.createLinearGradient(x, y, x, baseY);
            grad.addColorStop(0, '#00f0ff');
            grad.addColorStop(0.6, '#0077ff');
            grad.addColorStop(1, '#061324');

            ctx.fillStyle = grad;
            ctx.fillRect(x, y, barW, barH);

            // Glowing AlienFX Top Cap
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(x, y - 3, barW, 2);
        }
        ctx.restore();
    }

    drawOscilloscope(ctx, w, h) {
        ctx.save();
        ctx.beginPath();
        const sliceW = w / 128;
        const midY = h * 0.48;

        for (let i = 0; i < 128; i++) {
            const v = (this.timeData[i] - 128) / 128;
            const x = i * sliceW;
            const y = midY + v * (h * 0.38);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }

        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 2.4;
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 14;
        ctx.stroke();
        ctx.restore();
    }
}

window.addEventListener('DOMContentLoaded', () => {
    window.alienwareEngine = new AlienwareInvaderEngine();
});
