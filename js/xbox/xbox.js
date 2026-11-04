/**
 * ============================================================================
 * OFFICIAL XBOX MP7.1 (2002) // BIO-PLASMA AUDIO & VISUAL ENGINE (js/xbox/xbox.js)
 * Built from the authentic slices & coordinates of xbox.wms / xbox.js (2002):
 * - 30-Frame Curved Volume Sprite (vol.png: 5040x28 -> 30 frames of 168px)
 * - 32-Frame Curved Seek Sprite (seek.png: 4192x13 -> 32 frames of 131px)
 * - 10-Band Radioactive Plasma Equalizer (eq_back.png + thumb.png / thumb2.png)
 * - Tactical Video/DSP Drawer (x_vid_drawer.png: Brightness, Contrast, Hue, Sat)
 * - 2002 Xbox Content Archive Deck (c_xbox.jpg, c_games.jpg, c_web.jpg, etc.)
 * - 60FPS Web Audio BIOS Flubber Plasma, X-Ray Scope & Jewel Ring Visualizer
 * ============================================================================
 */

// Exact 10 EQ Band frequencies & 2x X-positions from xbox.wms lines 98-107
const XBOX_EQ_BANDS = [
    { freq: 31,    left2x: 52,  label: '31Hz'  },
    { freq: 63,    left2x: 78,  label: '63Hz'  },
    { freq: 125,   left2x: 102, label: '125Hz' },
    { freq: 250,   left2x: 126, label: '250Hz' },
    { freq: 500,   left2x: 152, label: '500Hz' },
    { freq: 1000,  left2x: 176, label: '1kHz'  },
    { freq: 2000,  left2x: 202, label: '2kHz'  },
    { freq: 4000,  left2x: 226, label: '4kHz'  },
    { freq: 8000,  left2x: 250, label: '8kHz'  },
    { freq: 16000, left2x: 276, label: '16kHz' }
];

const XBOX_EQ_PRESETS = [
    { name: 'XBOX SUB-PLASMA',  gains: [ 9,  7,  4,  0, -2,  1,  4,  6,  8,  9] },
    { name: 'HALO MJOLNIR',     gains: [ 7,  6,  3,  1,  2,  4,  6,  7,  8,  7] },
    { name: 'JET SET FUTURE',   gains: [10,  8,  2, -3,  0,  3,  6,  9, 10, 10] },
    { name: 'PROJECT GOTHAM',   gains: [ 6,  4,  1,  3,  5,  4,  2,  5,  7,  8] },
    { name: 'FLAT DIRECTX 0dB', gains: [ 0,  0,  0,  0,  0,  0,  0,  0,  0,  0] }
];

const XBOX_CONTENT_SLIDES = [
    {
        banner: 'assets/xbox/c_xbox.jpg',
        textGif: 'assets/xbox/c_xbox_text.gif',
        tag: 'XBOX SYSTEM // GPU NV2A 233MHz'
    },
    {
        banner: 'assets/xbox/c_games.jpg',
        textGif: 'assets/xbox/c_games_text.gif',
        tag: 'XBOX GAMES // HALO & JSRF ARCHIVE'
    },
    {
        banner: 'assets/xbox/c_web.jpg',
        textGif: 'assets/xbox/c_web_text.gif',
        tag: 'XBOX LIVE // BROADBAND ONLINE'
    },
    {
        banner: 'assets/xbox/c_winmedia.jpg',
        textGif: 'assets/xbox/c_winmedia_text.gif',
        tag: 'WINDOWS MEDIA // CUSTOM SOUNDTRACKS'
    },
    {
        banner: 'assets/xbox/c_winmedia_cs.jpg',
        textGif: 'assets/xbox/c_winmedia_text_cs.gif',
        tag: 'THE SKINS FACTORY // MP7.1 EDITION'
    }
];

const XBOX_SOUNDTRACKS = [
    {
        title: 'HALO // MJOLNIR MIX (QDG DUB)',
        artist: 'DJ MARCO BETTIN',
        album: 'XBOX LAUNCH 2001',
        duration: '03:42',
        offset: 0
    },
    {
        title: 'CONCEPT OF LOVE (BIO-POD VIP)',
        artist: 'HIDEKI NAGANUMA // QDG',
        album: 'JSRF SEGA 2002',
        duration: '03:58',
        offset: 25
    },
    {
        title: 'GREEN FLUBBER BIOS TRANSMISSION',
        artist: 'DIRECTX AUDIO TEAM',
        album: 'KERNEL BOOT ROM',
        duration: '04:12',
        offset: 54
    },
    {
        title: 'PGR2 KUDOS BREAKBEAT SESSION',
        artist: 'BIZARRE CREATIONS // QDG',
        album: 'METROPOLIS STREET',
        duration: '03:35',
        offset: 82
    },
    {
        title: 'SPLINTER CELL NIGHTVISION DUB',
        artist: 'AMON TOBIN // STEALTH EDIT',
        album: 'THIRD ECHELON',
        duration: '04:20',
        offset: 112
    },
    {
        title: 'PANZER DRAGOON ORTA PULSE',
        artist: 'SMILEBIT SYNTH LAB',
        album: 'XBOX ARCHIVE 06',
        duration: '03:50',
        offset: 140
    }
];

class XboxBioPlasmaEngine {
    constructor() {
        this.audioEl = document.getElementById('xbox-audio');
        this.audioCtx = null;
        this.sourceNode = null;
        this.eqNodes = [];
        this.subDriveNode = null;
        this.masterGain = null;
        this.analyser = null;

        // State
        this.isPlaying = false;
        this.volume = 0.85; // 0..1
        this.shutterClosed = false;
        this.lensEqOpen = false;
        this.shuffleOn = false;
        this.repeatOn = true;
        this.currentTrackIdx = 0;
        this.currentPresetIdx = 0;
        this.currentContentIdx = 0;
        this.currentGains = [...XBOX_EQ_PRESETS[0].gains];
        this.vizMode = 'flubber'; // 'flubber' | 'xray' | 'ring'
        this.warpRates = [1.0, 1.12, 0.88];
        this.warpIdx = 0;

        // Video Drawer Matrix Parameters (-1..+1, 0 = nominal)
        this.drawerParams = {
            brightness: 0,
            contrast: 0,
            hue: 0,
            saturation: 0
        };

        this.canvas = document.getElementById('xbox-plasma-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.freqData = new Uint8Array(256);
        this.timeData = new Uint8Array(256);

        this.init();
    }

    init() {
        this.initBioPodControls();
        this.initVolumeAndSeekSprites();
        this.init10BandPlasmaEq();
        this.initVideoDrawerSliders();
        this.initContentShowcase();
        this.initPlaylistTable();
        this.initSynthPads();
        this.initVisualizerModes();
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());

        requestAnimationFrame((t) => this.renderLoop(t));
    }

    /* ========================================================================
       1. WEB AUDIO API 10-BAND BIQUAD DSP & SUB-DRIVE GRAPH
       ======================================================================== */
    ensureAudioContext() {
        if (!this.audioCtx) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            this.audioCtx = new AudioCtx();

            this.sourceNode = this.audioCtx.createMediaElementSource(this.audioEl);

            this.eqNodes = XBOX_EQ_BANDS.map((band, idx) => {
                const f = this.audioCtx.createBiquadFilter();
                f.type = idx === 0 ? 'lowshelf' : (idx === XBOX_EQ_BANDS.length - 1 ? 'highshelf' : 'peaking');
                f.frequency.value = band.freq;
                f.Q.value = 1.4;
                f.gain.value = this.currentGains[idx];
                return f;
            });

            // Sub-Drive Low-Shelf controlled by the Video Drawer Saturation slider
            this.subDriveNode = this.audioCtx.createBiquadFilter();
            this.subDriveNode.type = 'lowshelf';
            this.subDriveNode.frequency.value = 75;
            this.subDriveNode.gain.value = 3.0;

            this.masterGain = this.audioCtx.createGain();
            this.masterGain.gain.value = this.volume;

            this.analyser = this.audioCtx.createAnalyser();
            this.analyser.fftSize = 512;
            this.analyser.smoothingTimeConstant = 0.82;
            this.freqData = new Uint8Array(this.analyser.frequencyBinCount);
            this.timeData = new Uint8Array(this.analyser.frequencyBinCount);

            let prev = this.sourceNode;
            this.eqNodes.forEach((node) => {
                prev.connect(node);
                prev = node;
            });
            prev.connect(this.subDriveNode);
            this.subDriveNode.connect(this.masterGain);
            this.masterGain.connect(this.analyser);
            this.analyser.connect(this.audioCtx.destination);
        }

        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
    }

    playXboxBeep(freq = 880, dur = 0.045) {
        try {
            this.ensureAudioContext();
            const now = this.audioCtx.currentTime;
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now);
            osc.frequency.exponentialRampToValueAtTime(freq * 1.35, now + dur);
            gain.gain.setValueAtTime(0.08, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
            osc.connect(gain);
            gain.connect(this.audioCtx.destination);
            osc.start(now);
            osc.stop(now + dur);
        } catch (_) {}
    }

    /* ========================================================================
       2. BIO-POD CONSOLE CONTROLS & GREEN DOME IRIS SHUTTER
       ======================================================================== */
    initBioPodControls() {
        const transportBar = document.getElementById('pod-transport-bar');
        const hitBtns = transportBar.querySelectorAll('.biopod-hit-btn');

        hitBtns.forEach((btn) => {
            btn.addEventListener('pointerdown', () => transportBar.classList.add('active-down'));
            btn.addEventListener('pointerup', () => transportBar.classList.remove('active-down'));
            btn.addEventListener('pointerleave', () => transportBar.classList.remove('active-down'));
        });

        document.getElementById('btn-pod-play').addEventListener('click', () => this.togglePlay());
        document.getElementById('btn-pod-stop').addEventListener('click', () => this.stopPlayback());
        document.getElementById('btn-pod-prev').addEventListener('click', () => this.selectTrack(this.currentTrackIdx - 1, true));
        document.getElementById('btn-pod-next').addEventListener('click', () => this.selectTrack(this.currentTrackIdx + 1, true));
        document.getElementById('btn-pod-open').addEventListener('click', () => this.selectTrack(this.currentTrackIdx + 1, true));

        // Green Dome Iris Shutter (reverse_no.png + intro_anim.gif / intro_anim_rev.gif)
        const shutterBtn = document.getElementById('btn-pod-shutter');
        const domeIris = document.getElementById('pod-dome-iris');

        const toggleShutter = () => {
            this.shutterClosed = !this.shutterClosed;
            shutterBtn.classList.toggle('closed', this.shutterClosed);
            this.playXboxBeep(this.shutterClosed ? 520 : 1180, 0.08);

            if (this.shutterClosed) {
                domeIris.style.backgroundImage = "url('assets/xbox/intro_anim_rev.gif')";
                domeIris.classList.add('shutter-closed');
            } else {
                domeIris.style.backgroundImage = "url('assets/xbox/intro_anim.gif')";
                setTimeout(() => {
                    if (!this.shutterClosed) domeIris.classList.remove('shutter-closed');
                }, 420);
            }
        };

        shutterBtn.addEventListener('click', toggleShutter);
        document.getElementById('btn-pod-min').addEventListener('click', toggleShutter);

        // Cradle Micro-Buttons (EQ, Vis, Playlist)
        const btnCradleEq = document.getElementById('btn-cradle-eq');
        const lensEq = document.getElementById('pod-lens-eq');
        btnCradleEq.addEventListener('click', () => {
            this.lensEqOpen = !this.lensEqOpen;
            btnCradleEq.classList.toggle('active', this.lensEqOpen);
            lensEq.classList.toggle('visible', this.lensEqOpen);
            this.playXboxBeep(960, 0.04);
        });

        document.getElementById('btn-cradle-vis').addEventListener('click', () => {
            const modes = ['flubber', 'xray', 'ring'];
            const nextIdx = (modes.indexOf(this.vizMode) + 1) % modes.length;
            this.setVisualizerMode(modes[nextIdx]);
        });

        document.getElementById('btn-cradle-pl').addEventListener('click', () => {
            const rnd = Math.floor(Math.random() * XBOX_SOUNDTRACKS.length);
            this.selectTrack(rnd, true);
        });

        document.getElementById('btn-pod-full').addEventListener('click', () => {
            const modes = ['flubber', 'xray', 'ring'];
            const nextIdx = (modes.indexOf(this.vizMode) + 1) % modes.length;
            this.setVisualizerMode(modes[nextIdx]);
        });

        document.getElementById('btn-pod-close').addEventListener('click', () => this.stopPlayback());

        // Pulsing Xbox Jewel triggers the 2001 BIOS Swell
        document.getElementById('btn-pod-jewel').addEventListener('click', () => this.playBiosBootChime());
        document.getElementById('header-xbox-jewel').addEventListener('click', () => this.playBiosBootChime());
        document.getElementById('btn-xbox-boot-chime').addEventListener('click', () => this.playBiosBootChime());
    }

    async togglePlay() {
        this.ensureAudioContext();
        this.playXboxBeep(this.isPlaying ? 640 : 1320, 0.05);

        const pauseOverlay = document.getElementById('pod-pause-overlay');
        if (this.audioEl.paused) {
            try {
                await this.audioEl.play();
                this.isPlaying = true;
                pauseOverlay.classList.add('is-playing');
            } catch (_) {}
        } else {
            this.audioEl.pause();
            this.isPlaying = false;
            pauseOverlay.classList.remove('is-playing');
        }
    }

    stopPlayback() {
        this.playXboxBeep(440, 0.06);
        this.audioEl.pause();
        this.audioEl.currentTime = 0;
        this.isPlaying = false;
        document.getElementById('pod-pause-overlay').classList.remove('is-playing');
    }

    /* ========================================================================
       3. 30-FRAME CURVED VOLUME SPRITE (vol.png) & 32-FRAME SEEK SPRITE (seek.png)
       ======================================================================== */
    initVolumeAndSeekSprites() {
        const volArch = document.getElementById('pod-vol-arch');
        const volFooter = document.getElementById('pod-footer-vol');

        const updateVolSprite = (norm) => {
            const clamped = Math.max(0, Math.min(1, norm));
            this.volume = clamped;
            if (this.masterGain && this.audioCtx) {
                this.masterGain.gain.setTargetAtTime(clamped, this.audioCtx.currentTime, 0.02);
            } else {
                this.audioEl.volume = clamped;
            }
            // vol.png is 5040x28 = 30 frames of 168px
            const frame = Math.min(29, Math.floor(clamped * 30));
            volArch.style.backgroundPosition = `-${frame * 168}px 0`;
            if (volFooter) volFooter.textContent = `VOL: ${Math.round(clamped * 100)}%`;
        };

        const handleVolPointer = (clientX) => {
            const rect = volArch.getBoundingClientRect();
            const norm = (clientX - rect.left) / rect.width;
            updateVolSprite(norm);
        };

        volArch.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            volArch.setPointerCapture(e.pointerId);
            volArch.classList.add('dragging');
            handleVolPointer(e.clientX);
        });
        volArch.addEventListener('pointermove', (e) => {
            if (!volArch.classList.contains('dragging')) return;
            handleVolPointer(e.clientX);
        });
        const endVol = () => volArch.classList.remove('dragging');
        volArch.addEventListener('pointerup', endVol);
        volArch.addEventListener('pointercancel', endVol);

        updateVolSprite(this.volume);

        // 32-Frame Seek Sprite (seek.png is 4192x13 = 32 frames of 131px)
        const seekArch = document.getElementById('pod-seek-arch');
        const podTime = document.getElementById('pod-time-readout');
        const vizTime = document.getElementById('xbox-time-chip');

        const formatTime = (sec) => {
            if (!isFinite(sec) || sec < 0) return '00:00';
            const m = Math.floor(sec / 60);
            const s = Math.floor(sec % 60);
            return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        };

        this.audioEl.addEventListener('timeupdate', () => {
            if (seekArch.classList.contains('dragging')) return;
            const dur = this.audioEl.duration || 222;
            const norm = Math.max(0, Math.min(1, this.audioEl.currentTime / dur));
            const frame = Math.min(31, Math.floor(norm * 32));
            seekArch.style.backgroundPosition = `-${frame * 131}px 0`;

            const curStr = formatTime(this.audioEl.currentTime);
            const totStr = formatTime(dur);
            if (podTime) podTime.textContent = curStr;
            if (vizTime) vizTime.textContent = `${curStr} / ${totStr}`;
        });

        this.audioEl.addEventListener('ended', () => {
            if (this.repeatOn) {
                const nextIdx = this.shuffleOn
                    ? Math.floor(Math.random() * XBOX_SOUNDTRACKS.length)
                    : this.currentTrackIdx + 1;
                this.selectTrack(nextIdx, true);
            }
        });

        const seekFromClientX = (clientX) => {
            const rect = seekArch.getBoundingClientRect();
            const norm = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
            const frame = Math.min(31, Math.floor(norm * 32));
            seekArch.style.backgroundPosition = `-${frame * 131}px 0`;
            if (this.audioEl.duration) {
                this.audioEl.currentTime = norm * this.audioEl.duration;
            }
        };

        seekArch.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            seekArch.setPointerCapture(e.pointerId);
            seekArch.classList.add('dragging');
            seekFromClientX(e.clientX);
        });
        seekArch.addEventListener('pointermove', (e) => {
            if (!seekArch.classList.contains('dragging')) return;
            seekFromClientX(e.clientX);
        });
        const endSeek = () => seekArch.classList.remove('dragging');
        seekArch.addEventListener('pointerup', endSeek);
        seekArch.addEventListener('pointercancel', endSeek);
    }

    /* ========================================================================
       4. 10-BAND RADIOACTIVE PLASMA EQUALIZER (eq_back.png + thumb.png)
       ======================================================================== */
    init10BandPlasmaEq() {
        const container = document.getElementById('xbox-eq-bands-container');
        container.innerHTML = '';

        XBOX_EQ_BANDS.forEach((band, idx) => {
            const slot = document.createElement('div');
            slot.className = 'xbox-eq-band-slot';
            slot.style.left = `${band.left2x}px`;
            slot.title = `${band.label} // Trascina o usa la rotella (-14dB..+14dB)`;

            const thumb = document.createElement('div');
            thumb.className = 'xbox-eq-thumb';
            thumb.id = `xbox-eq-thumb-${idx}`;
            slot.appendChild(thumb);
            container.appendChild(slot);

            const updateFromY = (clientY) => {
                const rect = slot.getBoundingClientRect();
                const pad = 4;
                const y = Math.max(pad, Math.min(rect.height - pad, clientY - rect.top));
                const norm = 1 - (y - pad) / (rect.height - pad * 2);
                const db = (norm * 28) - 14; // -14 to +14 dB matching xbox.wms lines 98-107
                this.setEqGain(idx, db);
            };

            slot.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                slot.setPointerCapture(e.pointerId);
                slot.classList.add('dragging');
                this.playXboxBeep(700 + idx * 90, 0.025);
                updateFromY(e.clientY);
            });
            slot.addEventListener('pointermove', (e) => {
                if (!slot.classList.contains('dragging')) return;
                updateFromY(e.clientY);
            });
            const stopDrag = () => slot.classList.remove('dragging');
            slot.addEventListener('pointerup', stopDrag);
            slot.addEventListener('pointercancel', stopDrag);

            slot.addEventListener('wheel', (e) => {
                e.preventDefault();
                this.setEqGain(idx, this.currentGains[idx] + (e.deltaY < 0 ? 1.2 : -1.2));
            }, { passive: false });

            slot.addEventListener('dblclick', () => this.setEqGain(idx, 0));
        });

        this.currentGains.forEach((g, i) => this.updateEqThumbPos(i, g));

        document.getElementById('btn-eq-prev').addEventListener('click', () => {
            this.applyEqPreset(this.currentPresetIdx - 1);
        });
        document.getElementById('btn-eq-next').addEventListener('click', () => {
            this.applyEqPreset(this.currentPresetIdx + 1);
        });
        document.getElementById('btn-eq-flat').addEventListener('click', () => {
            this.applyEqPreset(4); // FLAT DIRECTX 0dB
        });
    }

    setEqGain(idx, db) {
        const clamped = Math.max(-14, Math.min(14, db));
        this.currentGains[idx] = clamped;
        if (this.eqNodes[idx] && this.audioCtx) {
            this.eqNodes[idx].gain.setTargetAtTime(clamped, this.audioCtx.currentTime, 0.02);
        }
        this.updateEqThumbPos(idx, clamped);
    }

    updateEqThumbPos(idx, db) {
        const thumb = document.getElementById(`xbox-eq-thumb-${idx}`);
        if (!thumb) return;
        const norm = (db + 14) / 28; // 0..1
        const maxTravel = 84 - 8;
        thumb.style.top = `${(1 - norm) * maxTravel}px`;
    }

    applyEqPreset(idx) {
        this.currentPresetIdx = (idx + XBOX_EQ_PRESETS.length) % XBOX_EQ_PRESETS.length;
        const preset = XBOX_EQ_PRESETS[this.currentPresetIdx];
        this.playXboxBeep(1120, 0.04);

        const label = document.getElementById('xbox-eq-preset-name');
        if (label) label.textContent = preset.name;

        preset.gains.forEach((g, i) => this.setEqGain(i, g));
    }

    /* ========================================================================
       5. TACTICAL VIDEO/DSP SETTINGS DRAWER (x_vid_drawer.png)
       ======================================================================== */
    initVideoDrawerSliders() {
        // Mini Transport Buttons inside Drawer
        document.querySelectorAll('.drawer-mini-hit').forEach((btn) => {
            btn.addEventListener('click', () => {
                const act = btn.dataset.dact;
                if (act === 'play' || act === 'pause') this.togglePlay();
                else if (act === 'stop') this.stopPlayback();
                else if (act === 'prev') this.selectTrack(this.currentTrackIdx - 1, true);
                else if (act === 'next' || act === 'open') this.selectTrack(this.currentTrackIdx + 1, true);
            });
        });

        // 4 Horizontal Sliders (brightness, contrast, hue, saturation)
        document.querySelectorAll('.drawer-slider-track').forEach((track) => {
            const param = track.dataset.param;
            const thumb = document.getElementById(`dthumb-${param}`);

            const setFromX = (clientX) => {
                const rect = track.getBoundingClientRect();
                const norm = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
                this.drawerParams[param] = (norm * 2) - 1; // -1..+1
                thumb.style.left = `calc(${norm * 100}% - 4px)`;
                this.applyDrawerMatrix();
            };

            track.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                track.setPointerCapture(e.pointerId);
                track.classList.add('dragging');
                setFromX(e.clientX);
            });
            track.addEventListener('pointermove', (e) => {
                if (!track.classList.contains('dragging')) return;
                setFromX(e.clientX);
            });
            const end = () => track.classList.remove('dragging');
            track.addEventListener('pointerup', end);
            track.addEventListener('pointercancel', end);
        });

        // Reset buttons on left labels
        document.querySelectorAll('.drawer-reset-hit').forEach((btn) => {
            btn.addEventListener('click', () => {
                const p = btn.dataset.reset;
                this.drawerParams[p] = 0;
                const thumb = document.getElementById(`dthumb-${p}`);
                if (thumb) thumb.style.left = 'calc(50% - 4px)';
                this.applyDrawerMatrix();
                this.playXboxBeep(980, 0.03);
            });
        });

        document.getElementById('btn-reset-viz-filters').addEventListener('click', () => {
            ['brightness', 'contrast', 'hue', 'saturation'].forEach((p) => {
                this.drawerParams[p] = 0;
                const thumb = document.getElementById(`dthumb-${p}`);
                if (thumb) thumb.style.left = 'calc(50% - 4px)';
            });
            this.applyDrawerMatrix();
            this.playXboxBeep(1240, 0.04);
        });
    }

    applyDrawerMatrix() {
        const b = 100 + Math.round(this.drawerParams.brightness * 45);
        const c = 100 + Math.round(this.drawerParams.contrast * 55);
        const h = Math.round(this.drawerParams.hue * 180);
        const s = 100 + Math.round(this.drawerParams.saturation * 80);

        this.canvas.style.filter = `brightness(${b}%) contrast(${c}%) hue-rotate(${h}deg) saturate(${s}%)`;

        if (this.subDriveNode && this.audioCtx) {
            const subBoost = 3.0 + this.drawerParams.saturation * 7.0;
            this.subDriveNode.gain.setTargetAtTime(subBoost, this.audioCtx.currentTime, 0.03);
        }

        const readout = document.getElementById('viz-filter-readout');
        if (readout) {
            readout.textContent = `B:${b}% C:${c}% H:${h}° S:${s}%`;
        }
    }

    /* ========================================================================
       6. 2002 XBOX CONTENT SHOWCASE DECK (c_xbox.jpg / c_games.jpg / c_web.jpg)
       ======================================================================== */
    initContentShowcase() {
        const updateSlide = (idx) => {
            this.currentContentIdx = (idx + XBOX_CONTENT_SLIDES.length) % XBOX_CONTENT_SLIDES.length;
            const slide = XBOX_CONTENT_SLIDES[this.currentContentIdx];
            this.playXboxBeep(1040, 0.035);

            document.getElementById('xbox-content-banner').style.backgroundImage = `url('${slide.banner}')`;
            document.getElementById('xbox-content-gif').style.backgroundImage = `url('${slide.textGif}')`;
            document.getElementById('xbox-content-tag').textContent = slide.tag;
            document.getElementById('content-slide-counter').textContent = `SLIDE 0${this.currentContentIdx + 1} / 05`;
        };

        document.getElementById('btn-c-up').addEventListener('click', () => updateSlide(this.currentContentIdx - 1));
        document.getElementById('btn-c-down').addEventListener('click', () => updateSlide(this.currentContentIdx + 1));
        document.getElementById('btn-content-next-top').addEventListener('click', () => updateSlide(this.currentContentIdx + 1));
    }

    /* ========================================================================
       7. XBOX PLAYLIST TABLE & SHUFFLE/REPEAT CONTROLS
       ======================================================================== */
    initPlaylistTable() {
        const container = document.getElementById('xbox-playlist-rows');
        container.innerHTML = '';

        XBOX_SOUNDTRACKS.forEach((tr, idx) => {
            const row = document.createElement('div');
            row.className = `xbox-pl-row${idx === this.currentTrackIdx ? ' active' : ''}`;
            row.innerHTML = `
                <span>${String(idx + 1).padStart(2, '0')}</span>
                <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${tr.title} — ${tr.artist}</span>
                <span class="xbox-pl-cell-album" style="opacity:0.85;">${tr.album}</span>
                <span style="text-align:right;">${tr.duration}</span>
            `;
            row.addEventListener('click', () => this.selectTrack(idx, true));
            container.appendChild(row);
        });

        const btnShuff = document.getElementById('btn-pl-shuffle');
        const btnRep = document.getElementById('btn-pl-repeat');
        const modeReadout = document.getElementById('pl-mode-readout');

        const updateModeText = () => {
            if (modeReadout) {
                modeReadout.textContent = `SHUFFLE: ${this.shuffleOn ? 'ON' : 'OFF'} // REPEAT: ${this.repeatOn ? 'ON' : 'OFF'}`;
            }
        };

        btnShuff.addEventListener('click', () => {
            this.shuffleOn = !this.shuffleOn;
            btnShuff.classList.toggle('active', this.shuffleOn);
            this.playXboxBeep(1260, 0.04);
            updateModeText();
        });

        btnRep.addEventListener('click', () => {
            this.repeatOn = !this.repeatOn;
            btnRep.classList.toggle('active', this.repeatOn);
            this.playXboxBeep(1140, 0.04);
            updateModeText();
        });
    }

    selectTrack(idx, autoPlay = false) {
        this.currentTrackIdx = (idx + XBOX_SOUNDTRACKS.length) % XBOX_SOUNDTRACKS.length;
        const tr = XBOX_SOUNDTRACKS[this.currentTrackIdx];
        this.playXboxBeep(1420, 0.045);

        document.querySelectorAll('.xbox-pl-row').forEach((row, i) => {
            row.classList.toggle('active', i === this.currentTrackIdx);
        });

        document.getElementById('xbox-now-title').textContent = tr.title;
        document.getElementById('xbox-now-artist').textContent = `${tr.artist} // ${tr.album}`;
        document.getElementById('pod-marquee-text').textContent = `${tr.artist} - ${tr.title}`;

        if (this.audioEl.duration && tr.offset < this.audioEl.duration) {
            this.audioEl.currentTime = tr.offset;
        }

        if (autoPlay) {
            this.ensureAudioContext();
            this.audioEl.play().then(() => {
                this.isPlaying = true;
                document.getElementById('pod-pause-overlay').classList.add('is-playing');
            }).catch(() => {});
        }
    }

    /* ========================================================================
       8. XBOX 2001 BIOS BOOT SWELL & SYNTH STINGERS
       ======================================================================== */
    initSynthPads() {
        document.getElementById('pad-bios-swell').addEventListener('click', () => this.playBiosBootChime());
        document.getElementById('pad-shield-charge').addEventListener('click', () => this.playShieldRechargeSynth());
        document.getElementById('pad-plasma-drop').addEventListener('click', () => this.playPlasmaBassDrop());
        document.getElementById('pad-overclock-pitch').addEventListener('click', () => {
            this.warpIdx = (this.warpIdx + 1) % this.warpRates.length;
            const rate = this.warpRates[this.warpIdx];
            this.audioEl.playbackRate = rate;
            document.getElementById('warp-rate-label').textContent = `${rate.toFixed(2)}x`;
            this.playXboxBeep(rate * 1000, 0.05);
        });
    }

    playBiosBootChime() {
        this.ensureAudioContext();
        const now = this.audioCtx.currentTime;
        // Lush 3-oscillator harmonic fifth chord swell inspired by the 2001 Xbox Boot Intro
        [146.83, 220.0, 440.0, 587.33].forEach((freq, i) => {
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();
            osc.type = i % 2 === 0 ? 'sawtooth' : 'triangle';
            osc.frequency.setValueAtTime(freq * 0.5, now);
            osc.frequency.exponentialRampToValueAtTime(freq, now + 0.35);

            gain.gain.setValueAtTime(0.001, now);
            gain.gain.linearRampToValueAtTime(0.07, now + 0.25);
            gain.gain.exponentialRampToValueAtTime(0.0008, now + 1.15);

            osc.connect(gain);
            gain.connect(this.analyser);
            osc.start(now);
            osc.stop(now + 1.18);
        });
    }

    playShieldRechargeSynth() {
        this.ensureAudioContext();
        const now = this.audioCtx.currentTime;
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(1760, now + 0.55);

        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.58);

        osc.connect(gain);
        gain.connect(this.analyser);
        osc.start(now);
        osc.stop(now + 0.6);
    }

    playPlasmaBassDrop() {
        this.ensureAudioContext();
        const now = this.audioCtx.currentTime;
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(160, now);
        osc.frequency.exponentialRampToValueAtTime(38, now + 0.65);

        gain.gain.setValueAtTime(0.28, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.68);

        osc.connect(gain);
        gain.connect(this.analyser);
        osc.start(now);
        osc.stop(now + 0.7);
    }

    /* ========================================================================
       9. 60FPS XBOX BIOS FLUBBER PLASMA, X-RAY SCOPE & JEWEL RING CANVAS
       ======================================================================== */
    initVisualizerModes() {
        document.querySelectorAll('.xbox-mode-pill').forEach((pill) => {
            pill.addEventListener('click', () => {
                this.setVisualizerMode(pill.dataset.vmode);
            });
        });
    }

    setVisualizerMode(mode) {
        this.vizMode = mode;
        this.playXboxBeep(1200, 0.035);
        document.querySelectorAll('.xbox-mode-pill').forEach((p) => {
            p.classList.toggle('active', p.dataset.vmode === mode);
        });
    }

    resizeCanvas() {
        const stage = document.getElementById('xbox-viz-stage');
        if (!stage || !this.canvas) return;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        this.canvas.width = stage.clientWidth * dpr;
        this.canvas.height = stage.clientHeight * dpr;
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this.cw = stage.clientWidth;
        this.ch = stage.clientHeight;
    }

    renderLoop(timestamp) {
        const w = this.cw || 560;
        const h = this.ch || 270;
        const ctx = this.ctx;
        const t = timestamp * 0.001;

        let bass = 0;
        if (this.analyser && this.isPlaying) {
            this.analyser.getByteFrequencyData(this.freqData);
            this.analyser.getByteTimeDomainData(this.timeData);
            for (let i = 0; i < 14; i++) bass += this.freqData[i];
            bass /= 14;
        } else {
            for (let i = 0; i < 128; i++) {
                this.freqData[i] = Math.floor(38 + 26 * Math.sin(t * 2.5 + i * 0.14));
                this.timeData[i] = Math.floor(128 + 22 * Math.sin(t * 4 + i * 0.15));
            }
            bass = 42 + 18 * Math.sin(t * 2);
        }

        const peakEl = document.getElementById('xbox-peak-meter');
        if (peakEl) {
            const db = bass > 5 ? (20 * Math.log10(bass / 255)).toFixed(1) : '-INF';
            peakEl.textContent = `PEAK: ${db} dB`;
        }

        ctx.fillStyle = 'rgba(2, 6, 1, 0.26)';
        ctx.fillRect(0, 0, w, h);

        if (this.vizMode === 'flubber') {
            this.drawBiosFlubber(ctx, w, h, t, bass);
        } else if (this.vizMode === 'xray') {
            this.drawXrayScope(ctx, w, h, t);
        } else {
            this.drawJewelRing(ctx, w, h, t, bass);
        }

        requestAnimationFrame((ts) => this.renderLoop(ts));
    }

    drawBiosFlubber(ctx, w, h, t, bass) {
        const cx = w * 0.5;
        const cy = h * 0.48;
        const baseR = Math.min(w, h) * 0.21 + (bass / 255) * 32;

        ctx.save();
        // Outer Radioactive Green Glow
        const aura = ctx.createRadialGradient(cx, cy, baseR * 0.1, cx, cy, baseR * 1.85);
        aura.addColorStop(0, 'rgba(210, 255, 140, 0.92)');
        aura.addColorStop(0.38, 'rgba(126, 197, 9, 0.55)');
        aura.addColorStop(0.75, 'rgba(54, 145, 8, 0.18)');
        aura.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = aura;
        ctx.beginPath();
        ctx.arc(cx, cy, baseR * 1.85, 0, Math.PI * 2);
        ctx.fill();

        // Organic Morphing Xbox BIOS Flubber Blob
        ctx.beginPath();
        const vertices = 72;
        for (let i = 0; i <= vertices; i++) {
            const ang = (i / vertices) * Math.PI * 2;
            const bin = i % 36;
            const audioAmp = (this.freqData[bin] / 255) * 28;
            const organic = Math.sin(ang * 3 + t * 3.4) * 11 + Math.cos(ang * 5 - t * 2.6) * 8;
            const r = baseR + audioAmp + organic;
            const x = cx + Math.cos(ang) * r;
            const y = cy + Math.sin(ang) * r;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fillStyle = 'rgba(126, 197, 9, 0.28)';
        ctx.fill();
        ctx.strokeStyle = '#9ef161';
        ctx.lineWidth = 2.5;
        ctx.shadowColor = '#7ec509';
        ctx.shadowBlur = 18;
        ctx.stroke();
        ctx.restore();
    }

    drawXrayScope(ctx, w, h, t) {
        ctx.save();
        // Subtle green grid lines
        ctx.strokeStyle = 'rgba(126, 197, 9, 0.14)';
        ctx.lineWidth = 1;
        for (let x = 0; x < w; x += 36) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
            ctx.stroke();
        }

        // Main Cathode Waveform
        ctx.beginPath();
        const slice = w / 128;
        const midY = h * 0.48;
        for (let i = 0; i < 128; i++) {
            const v = (this.timeData[i] - 128) / 128;
            const x = i * slice;
            const y = midY + v * (h * 0.38);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = '#9ef161';
        ctx.lineWidth = 2.6;
        ctx.shadowColor = '#7ec509';
        ctx.shadowBlur = 14;
        ctx.stroke();
        ctx.restore();
    }

    drawJewelRing(ctx, w, h, t, bass) {
        const cx = w * 0.5;
        const cy = h * 0.48;
        const rInner = Math.min(w, h) * 0.19;
        const numSpokes = 48;

        ctx.save();
        for (let i = 0; i < numSpokes; i++) {
            const ang = (i / numSpokes) * Math.PI * 2 + t * 0.4;
            const val = this.freqData[i] / 255;
            const len = 8 + val * (Math.min(w, h) * 0.22);
            const x1 = cx + Math.cos(ang) * rInner;
            const y1 = cy + Math.sin(ang) * rInner;
            const x2 = cx + Math.cos(ang) * (rInner + len);
            const y2 = cy + Math.sin(ang) * (rInner + len);

            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.strokeStyle = val > 0.6 ? '#ffffff' : '#9ef161';
            ctx.lineWidth = 3;
            ctx.shadowColor = '#7ec509';
            ctx.shadowBlur = 10;
            ctx.stroke();
        }

        // Iconic X-Cut inside the ring
        const xSize = rInner * 0.62 + (bass / 255) * 8;
        ctx.strokeStyle = '#7ec509';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(cx - xSize, cy - xSize);
        ctx.lineTo(cx + xSize, cy + xSize);
        ctx.moveTo(cx + xSize, cy - xSize);
        ctx.lineTo(cx - xSize, cy + xSize);
        ctx.stroke();
        ctx.restore();
    }
}

window.addEventListener('DOMContentLoaded', () => {
    window.xboxEngine = new XboxBioPlasmaEngine();
});
