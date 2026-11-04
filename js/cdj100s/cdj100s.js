/**
 * ============================================================================
 * PIONEER CDJ-100S (1998) // DIGITAL COMPACT DISC PLAYER
 * Hardware Simulation & Web Audio "Digital Jog Break" Engine
 * File: js/cdj100s/cdj100s.js
 * ============================================================================
 */

class PioneerCDJ100SEngine {
    constructor() {
        this.audio = document.getElementById('cdj-audio');

        // 8 Pirate Radio CD-R Tracks in the DJ Wallet
        this.cdWallet = [
            { id: 1, title: 'QDG PIRATE ANTHEM (CLUB MIX)', artist: 'DJ VIANELLO', bpm: 128.0, offset: 0, badge: 'TRK 01 // 128 BPM' },
            { id: 2, title: 'IBIZA TERRACE 1999 (JET DUB)', artist: 'BALAERIC SYSTEM', bpm: 126.5, offset: 18, badge: 'TRK 02 // 126.5 BPM' },
            { id: 3, title: 'SILVER JOG BREAKDOWN', artist: 'TOKYO LABS 98', bpm: 130.0, offset: 36, badge: 'TRK 03 // 130 BPM' },
            { id: 4, title: 'ACID WAH FILTER (303 CUT)', artist: 'WAREHOUSE 909', bpm: 132.0, offset: 54, badge: 'TRK 04 // 132 BPM' },
            { id: 5, title: 'PROGRESSIVE LASER OPTICS', artist: 'PIONEER SESSION', bpm: 125.0, offset: 72, badge: 'TRK 05 // 125 BPM' },
            { id: 6, title: 'ZIP PITCH ROLLER (UK GARAGE)', artist: 'LONDON PIRATE FM', bpm: 134.0, offset: 90, badge: 'TRK 06 // 134 BPM' },
            { id: 7, title: 'MASTER TEMPO EUPHORIA', artist: 'TRANCE EUROPA', bpm: 138.0, offset: 108, badge: 'TRK 07 // 138 BPM' },
            { id: 8, title: 'AFTERHOURS NO DISC OUTRO', artist: 'MILANO UNDERGROUND', bpm: 122.0, offset: 126, badge: 'TRK 08 // 122 BPM' }
        ];

        // Dual CDJ-100S Deck State
        // Deck A starts loaded & ready; Deck B starts in exact "00 no dISC 0.0" state from the photo!
        this.decks = {
            A: {
                id: 'A',
                discLoaded: true,
                trackIndex: 0,
                isPlaying: false,
                cuePoint: 0,
                tempoPct: 0.0,
                masterTempo: true,
                autoCue: true,
                timeMode: 'ELAPSED', // 'ELAPSED' | 'REMAIN'
                activeFx: null,      // null | 'jet' | 'zip' | 'wah'
                fxHold: false,
                jogAngle: 0,
                jogModValue: 0,      // -1.0 to +1.0 modulated by Jog Wheel
                virtualTime: 0
            },
            B: {
                id: 'B',
                discLoaded: false,   // Matches "00 no dISC 0.0" in the user's photo!
                trackIndex: 1,
                isPlaying: false,
                cuePoint: 0,
                tempoPct: 0.0,
                masterTempo: true,
                autoCue: true,
                timeMode: 'ELAPSED',
                activeFx: null,
                fxHold: false,
                jogAngle: 0,
                jogModValue: 0,
                virtualTime: 0
            }
        };

        this.activeAudioDeck = 'A';
        this.vizMode = 'vfd';
        this.lfoPhase = 0;

        // Web Audio API Nodes
        this.ctx = null;
        this.sourceNode = null;
        this.analyser = null;
        this.eqLow = null;
        this.eqMid = null;
        this.eqHigh = null;
        this.wahFilter = null;
        this.jetDelay = null;
        this.jetFeedback = null;
        this.jetWetGain = null;
        this.dryGain = null;
        this.masterGain = null;

        this.init();
    }

    init() {
        this.buildVfdAddressBars();
        this.renderCdWallet();
        this.bindDeckControls('A');
        this.bindDeckControls('B');
        this.bindJogWheel('A');
        this.bindJogWheel('B');
        this.bindMixerAndHeaderControls();
        this.syncDeckUI('A');
        this.syncDeckUI('B');
        this.startRenderLoop();
    }

    /**
     * Initializes the Web Audio API graph with:
     * - 3-Band Isolator EQ (Low, Mid, High)
     * - Digital Jog Break WAH Resonant Filter
     * - Digital Jog Break JET Flanger (Delay + Feedback loop)
     * - Digital Jog Break ZIP Pitch/Rate processor
     */
    initAudioEngine() {
        if (this.ctx) {
            if (this.ctx.state === 'suspended') {
                this.ctx.resume();
            }
            return;
        }

        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioCtx();

        this.sourceNode = this.ctx.createMediaElementSource(this.audio);
        this.analyser = this.ctx.createAnalyser();
        this.analyser.fftSize = 256;
        this.analyser.smoothingTimeConstant = 0.78;

        // 3-Band DJM-300 Isolator EQ
        this.eqLow = this.ctx.createBiquadFilter();
        this.eqLow.type = 'lowshelf';
        this.eqLow.frequency.value = 85;
        this.eqLow.gain.value = 2.0;

        this.eqMid = this.ctx.createBiquadFilter();
        this.eqMid.type = 'peaking';
        this.eqMid.frequency.value = 1000;
        this.eqMid.Q.value = 1.1;
        this.eqMid.gain.value = 0.0;

        this.eqHigh = this.ctx.createBiquadFilter();
        this.eqHigh.type = 'highshelf';
        this.eqHigh.frequency.value = 9500;
        this.eqHigh.gain.value = 3.0;

        // WAH Filter Node (High-Q Swept Band/Lowpass)
        this.wahFilter = this.ctx.createBiquadFilter();
        this.wahFilter.type = 'allpass';
        this.wahFilter.frequency.value = 1200;
        this.wahFilter.Q.value = 0.7;

        // JET Flanger Delay & Feedback Loop
        this.dryGain = this.ctx.createGain();
        this.dryGain.gain.value = 1.0;

        this.jetDelay = this.ctx.createDelay(0.05);
        this.jetDelay.delayTime.value = 0.003;

        this.jetFeedback = this.ctx.createGain();
        this.jetFeedback.gain.value = 0.0;

        this.jetWetGain = this.ctx.createGain();
        this.jetWetGain.gain.value = 0.0;

        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.88;

        // Connect Serial Chain: Source -> EQ Low -> EQ Mid -> EQ High -> WahFilter
        this.sourceNode.connect(this.eqLow);
        this.eqLow.connect(this.eqMid);
        this.eqMid.connect(this.eqHigh);
        this.eqHigh.connect(this.wahFilter);

        // Split into Dry + JET Flanger Wet Loop
        this.wahFilter.connect(this.dryGain);
        this.dryGain.connect(this.masterGain);

        this.wahFilter.connect(this.jetDelay);
        this.jetDelay.connect(this.jetFeedback);
        this.jetFeedback.connect(this.jetDelay);
        this.jetDelay.connect(this.jetWetGain);
        this.jetWetGain.connect(this.masterGain);

        this.masterGain.connect(this.analyser);
        this.analyser.connect(this.ctx.destination);
    }

    /**
     * Synthesizes authentic Pioneer CDJ-100S tactile hardware & slot-loader servo sounds
     */
    playHardwareSound(type) {
        this.initAudioEngine();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);

        if (type === 'click') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(1400, now);
            osc.frequency.exponentialRampToValueAtTime(280, now + 0.025);
            gain.gain.setValueAtTime(0.18, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.025);
            osc.start(now);
            osc.stop(now + 0.028);
        } else if (type === 'eject' || type === 'insert') {
            // Slot-In CD Mechanical Servo Motor Whir
            osc.type = 'sawtooth';
            const startFreq = type === 'insert' ? 190 : 310;
            const endFreq = type === 'insert' ? 340 : 160;
            osc.frequency.setValueAtTime(startFreq, now);
            osc.frequency.linearRampToValueAtTime(endFreq, now + 0.22);
            osc.frequency.setValueAtTime(endFreq * 1.25, now + 0.24);
            osc.frequency.exponentialRampToValueAtTime(90, now + 0.42);

            gain.gain.setValueAtTime(0.08, now);
            gain.gain.linearRampToValueAtTime(0.12, now + 0.2);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.44);
            osc.start(now);
            osc.stop(now + 0.45);
        } else if (type === 'subdrop') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(145, now);
            osc.frequency.exponentialRampToValueAtTime(32, now + 0.65);
            gain.gain.setValueAtTime(0.45, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.68);
            osc.start(now);
            osc.stop(now + 0.7);
        }
    }

    /**
     * Creates the 24-segment VFD Playing Address LED bar inside each deck's screen
     */
    buildVfdAddressBars() {
        ['a', 'b'].forEach((suffix) => {
            const bar = document.getElementById(`vfd-bar-${suffix}`);
            if (!bar) return;
            bar.innerHTML = '';
            for (let i = 0; i < 24; i++) {
                const seg = document.createElement('span');
                seg.className = 'vfd-addr-seg';
                bar.appendChild(seg);
            }
        });
    }

    /**
     * Populates the 8 CD-R Discs inside the Club Wallet
     */
    renderCdWallet() {
        const list = document.getElementById('cd-wallet-list');
        if (!list) return;

        list.innerHTML = '';
        this.cdWallet.forEach((disc, idx) => {
            const row = document.createElement('div');
            const isA = this.decks.A.discLoaded && this.decks.A.trackIndex === idx;
            const isB = this.decks.B.discLoaded && this.decks.B.trackIndex === idx;
            row.className = `cd-wallet-item ${isA ? 'active-a' : ''} ${isB ? 'active-b' : ''}`;

            row.innerHTML = `
                <div class="cd-mini-disc"></div>
                <div class="cd-item-meta">
                    <span class="cd-item-title">0${disc.id} // ${disc.title}</span>
                    <span class="cd-item-sub">${disc.artist} · ${disc.bpm.toFixed(1)} BPM</span>
                </div>
                <button type="button" class="cd-load-pill" data-load-deck="A" data-idx="${idx}">LOAD A</button>
                <button type="button" class="cd-load-pill" data-load-deck="B" data-idx="${idx}">LOAD B</button>
            `;

            row.querySelectorAll('.cd-load-pill').forEach((btn) => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const targetDeck = btn.getAttribute('data-load-deck');
                    this.loadTrackIntoDeck(targetDeck, idx, true);
                });
            });

            row.addEventListener('click', () => {
                this.loadTrackIntoDeck(this.activeAudioDeck, idx, true);
            });

            list.appendChild(row);
        });
    }

    /**
     * Loads a CD-R from the wallet into Deck A or Deck B and starts slot-in animation
     */
    loadTrackIntoDeck(deckId, trackIdx, autoPlay = false) {
        const deck = this.decks[deckId];
        if (!deck) return;

        this.playHardwareSound('insert');
        deck.discLoaded = true;
        deck.trackIndex = (trackIdx + this.cdWallet.length) % this.cdWallet.length;
        const track = this.cdWallet[deck.trackIndex];
        deck.cuePoint = track.offset;
        deck.virtualTime = track.offset;

        this.activeAudioDeck = deckId;

        if (this.audio.readyState >= 1) {
            const targetTime = track.offset % Math.max(1, this.audio.duration || 180);
            this.audio.currentTime = targetTime;
        }

        if (autoPlay) {
            this.startDeckPlayback(deckId);
        } else {
            this.syncDeckUI(deckId);
            this.renderCdWallet();
        }
    }

    /**
     * Binds all buttons & pitch fader for Deck A or Deck B
     */
    bindDeckControls(deckId) {
        const s = deckId.toLowerCase();
        const deck = this.decks[deckId];

        // PLAY / PAUSE Button
        const btnPlay = document.getElementById(`btn-play-${s}`);
        if (btnPlay) {
            btnPlay.addEventListener('click', () => {
                this.playHardwareSound('click');
                if (!deck.discLoaded) {
                    // Auto-insert disc if user presses PLAY on an ejected deck!
                    this.toggleEject(deckId);
                }
                if (deck.isPlaying) {
                    this.pauseDeckPlayback(deckId);
                } else {
                    this.startDeckPlayback(deckId);
                }
            });
        }

        // CUE Button
        const btnCue = document.getElementById(`btn-cue-${s}`);
        if (btnCue) {
            btnCue.addEventListener('click', () => {
                this.playHardwareSound('click');
                if (!deck.discLoaded) return;

                if (deck.isPlaying) {
                    // Return to CUE point and pause
                    deck.isPlaying = false;
                    if (this.activeAudioDeck === deckId) {
                        this.audio.pause();
                        this.audio.currentTime = deck.cuePoint % Math.max(1, this.audio.duration || 180);
                    }
                    deck.virtualTime = deck.cuePoint;
                } else {
                    // Set current position as new CUE point
                    if (this.activeAudioDeck === deckId) {
                        deck.cuePoint = this.audio.currentTime;
                    }
                }
                this.syncDeckUI(deckId);
            });
        }

        // EJECT Button & Optical Disc Click
        const btnEject = document.getElementById(`btn-eject-${s}`);
        const discEl = document.getElementById(`cdj-disc-${s}`);
        if (btnEject) {
            btnEject.addEventListener('click', () => this.toggleEject(deckId));
        }
        if (discEl) {
            discEl.addEventListener('click', () => this.toggleEject(deckId));
        }

        // TRACK SEARCH |<< and >>|
        const btnPrev = document.getElementById(`btn-prev-${s}`);
        const btnNext = document.getElementById(`btn-next-${s}`);
        if (btnPrev) {
            btnPrev.addEventListener('click', () => {
                this.playHardwareSound('click');
                if (!deck.discLoaded) return;
                this.loadTrackIntoDeck(deckId, deck.trackIndex - 1, deck.isPlaying);
            });
        }
        if (btnNext) {
            btnNext.addEventListener('click', () => {
                this.playHardwareSound('click');
                if (!deck.discLoaded) return;
                this.loadTrackIntoDeck(deckId, deck.trackIndex + 1, deck.isPlaying);
            });
        }

        // SEARCH << and >> (Frame Scrub)
        const btnRew = document.getElementById(`btn-rew-${s}`);
        const btnFf = document.getElementById(`btn-ff-${s}`);
        if (btnRew) {
            btnRew.addEventListener('click', () => {
                this.playHardwareSound('click');
                if (!deck.discLoaded) return;
                if (this.activeAudioDeck === deckId) {
                    this.audio.currentTime = Math.max(0, this.audio.currentTime - 4);
                }
                deck.virtualTime = Math.max(0, deck.virtualTime - 4);
            });
        }
        if (btnFf) {
            btnFf.addEventListener('click', () => {
                this.playHardwareSound('click');
                if (!deck.discLoaded) return;
                if (this.activeAudioDeck === deckId) {
                    this.audio.currentTime = Math.min(this.audio.duration || 180, this.audio.currentTime + 4);
                }
                deck.virtualTime += 4;
            });
        }

        // DIGITAL JOG BREAK Blue Translucent Buttons (JET, ZIP, WAH)
        ['jet', 'zip', 'wah'].forEach((fxName) => {
            const btnFx = document.getElementById(`btn-${fxName}-${s}`);
            if (btnFx) {
                btnFx.addEventListener('click', () => {
                    this.playHardwareSound('click');
                    this.activeAudioDeck = deckId;
                    if (deck.activeFx === fxName) {
                        deck.activeFx = null;
                    } else {
                        deck.activeFx = fxName;
                    }
                    this.applyDigitalJogBreakDSP();
                    this.syncDeckUI(deckId);
                });
            }
        });

        // HOLD Button
        const btnHold = document.getElementById(`btn-hold-${s}`);
        if (btnHold) {
            btnHold.addEventListener('click', () => {
                this.playHardwareSound('click');
                deck.fxHold = !deck.fxHold;
                btnHold.classList.toggle('active', deck.fxHold);
                this.syncDeckUI(deckId);
            });
        }

        // TIME MODE / AUTO CUE Button
        const btnTimeMode = document.getElementById(`btn-timemode-${s}`);
        if (btnTimeMode) {
            btnTimeMode.addEventListener('click', () => {
                this.playHardwareSound('click');
                deck.timeMode = deck.timeMode === 'ELAPSED' ? 'REMAIN' : 'ELAPSED';
                this.syncDeckUI(deckId);
            });
        }

        // MASTER TEMPO Button
        const btnMt = document.getElementById(`btn-mt-${s}`);
        if (btnMt) {
            btnMt.addEventListener('click', () => {
                this.playHardwareSound('click');
                deck.masterTempo = !deck.masterTempo;
                this.applyPitchAndTempo(deckId);
                this.syncDeckUI(deckId);
            });
        }

        // TEMPO PITCH SLIDER (±10%)
        const pitchSlider = document.getElementById(`pitch-slider-${s}`);
        if (pitchSlider) {
            pitchSlider.addEventListener('input', () => {
                let val = parseFloat(pitchSlider.value);
                // Center quartz detent snap around 0.0%
                if (Math.abs(val) < 0.25) {
                    val = 0.0;
                    pitchSlider.value = '0';
                }
                deck.tempoPct = val;
                this.activeAudioDeck = deckId;
                this.applyPitchAndTempo(deckId);
                this.syncDeckUI(deckId);
            });

            pitchSlider.addEventListener('dblclick', () => {
                deck.tempoPct = 0.0;
                pitchSlider.value = '0';
                this.applyPitchAndTempo(deckId);
                this.syncDeckUI(deckId);
            });
        }
    }

    /**
     * Toggles the Slot-In Compact Disc Eject / Load state (switches VFD to "00 no dISC 0.0"!)
     */
    toggleEject(deckId) {
        const deck = this.decks[deckId];
        if (!deck) return;

        if (deck.discLoaded) {
            // Eject the CD!
            this.playHardwareSound('eject');
            deck.discLoaded = false;
            deck.isPlaying = false;
            if (this.activeAudioDeck === deckId) {
                this.audio.pause();
            }
        } else {
            // Insert the CD!
            this.playHardwareSound('insert');
            deck.discLoaded = true;
        }

        const btnEject = document.getElementById(`btn-eject-${deckId.toLowerCase()}`);
        if (btnEject) btnEject.classList.remove('pulse-hint');

        this.syncDeckUI(deckId);
        this.renderCdWallet();
    }

    startDeckPlayback(deckId) {
        this.initAudioEngine();
        const deck = this.decks[deckId];
        if (!deck || !deck.discLoaded) return;

        // Pause the other deck if switching active stream
        const otherId = deckId === 'A' ? 'B' : 'A';
        this.decks[otherId].isPlaying = false;
        this.activeAudioDeck = deckId;

        deck.isPlaying = true;
        this.applyPitchAndTempo(deckId);
        this.applyDigitalJogBreakDSP();

        this.audio.play().catch(() => {});
        this.syncDeckUI('A');
        this.syncDeckUI('B');
        this.renderCdWallet();
    }

    pauseDeckPlayback(deckId) {
        const deck = this.decks[deckId];
        if (!deck) return;
        deck.isPlaying = false;
        if (this.activeAudioDeck === deckId) {
            this.audio.pause();
        }
        this.syncDeckUI(deckId);
    }

    /**
     * Applies Tempo Slider (±10%) and Master Tempo (Key Lock) to the audio element
     */
    applyPitchAndTempo(deckId) {
        const deck = this.decks[deckId];
        if (!deck || this.activeAudioDeck !== deckId) return;

        const baseRate = 1.0 + (deck.tempoPct / 100);
        // Master Tempo locks musical pitch while time-stretching BPM
        if ('preservesPitch' in this.audio) {
            this.audio.preservesPitch = deck.masterTempo;
        } else if ('mozPreservesPitch' in this.audio) {
            this.audio.mozPreservesPitch = deck.masterTempo;
        } else if ('webkitPreservesPitch' in this.audio) {
            this.audio.webkitPreservesPitch = deck.masterTempo;
        }

        this.audio.playbackRate = Math.max(0.25, Math.min(2.5, baseRate));
    }

    /**
     * Updates the Web Audio DSP nodes for Pioneer CDJ-100S DIGITAL JOG BREAK:
     * - JET: Metallic Flanger sweep (Delay + Feedback loop)
     * - ZIP: Real-time Pitch-Bend / Turntable Brake & Speed-up
     * - WAH: High-Q Resonant Bandpass/Lowpass filter sweep
     */
    applyDigitalJogBreakDSP() {
        this.initAudioEngine();
        if (!this.ctx) return;

        const deck = this.decks[this.activeAudioDeck];
        const fx = deck ? deck.activeFx : null;
        const now = this.ctx.currentTime;

        const dspReadout = document.getElementById('cdj-dsp-readout');
        const scopeStatus = document.getElementById('scope-fx-status');

        // Reset defaults before applying active FX
        this.wahFilter.type = 'allpass';
        this.wahFilter.Q.setTargetAtTime(0.7, now, 0.03);
        this.jetWetGain.gain.setTargetAtTime(0.0, now, 0.03);
        this.jetFeedback.gain.setTargetAtTime(0.0, now, 0.03);

        if (!fx) {
            this.applyPitchAndTempo(this.activeAudioDeck);
            if (dspReadout) dspReadout.textContent = 'DSP: BYPASS // 44.1 kHz';
            if (scopeStatus) scopeStatus.textContent = 'JOG BREAK: STANDBY';
            return;
        }

        if (fx === 'jet') {
            // Iconic CDJ-100S JET Flanger!
            this.jetWetGain.gain.setTargetAtTime(0.85, now, 0.02);
            this.jetFeedback.gain.setTargetAtTime(0.76, now, 0.02);
            if (dspReadout) dspReadout.textContent = 'DSP: JET FLANGER // DOPPLER ACTIVE';
            if (scopeStatus) scopeStatus.textContent = 'JOG BREAK: JET (SWEEP JOG WHEEL)';
        } else if (fx === 'zip') {
            // Iconic CDJ-100S ZIP Pitch/Time Warp!
            this.wahFilter.type = 'lowshelf';
            this.wahFilter.frequency.setTargetAtTime(240, now, 0.03);
            this.wahFilter.gain.setTargetAtTime(5.0, now, 0.03);
            if (dspReadout) dspReadout.textContent = 'DSP: ZIP PITCH-WARP // ACTIVE';
            if (scopeStatus) scopeStatus.textContent = 'JOG BREAK: ZIP (TURN JOG REV/FWD)';
        } else if (fx === 'wah') {
            // Iconic CDJ-100S WAH Resonant Filter!
            this.wahFilter.type = 'bandpass';
            this.wahFilter.Q.setTargetAtTime(6.5, now, 0.02);
            if (dspReadout) dspReadout.textContent = 'DSP: WAH RESONANT FILTER // ACTIVE';
            if (scopeStatus) scopeStatus.textContent = 'JOG BREAK: WAH (SWEEP JOG WHEEL)';
        }
    }

    /**
     * Interactive 10cm Jog Dial with angular drag tracking, pitch nudge, and DSP sweep
     */
    bindJogWheel(deckId) {
        const s = deckId.toLowerCase();
        const wheel = document.getElementById(`jog-wheel-${s}`);
        const rotor = document.getElementById(`jog-rotor-${s}`);
        const deck = this.decks[deckId];
        if (!wheel || !rotor) return;

        let isDragging = false;
        let prevAngle = 0;

        const getAngleFromCenter = (clientX, clientY) => {
            const rect = wheel.getBoundingClientRect();
            const cx = rect.left + rect.width / 2;
            const cy = rect.top + rect.height / 2;
            return Math.atan2(clientY - cy, clientX - cx) * (180 / Math.PI);
        };

        wheel.addEventListener('pointerdown', (e) => {
            isDragging = true;
            this.activeAudioDeck = deckId;
            wheel.setPointerCapture(e.pointerId);
            prevAngle = getAngleFromCenter(e.clientX, e.clientY);
        });

        wheel.addEventListener('pointermove', (e) => {
            if (!isDragging) return;
            const curAngle = getAngleFromCenter(e.clientX, e.clientY);
            let delta = curAngle - prevAngle;
            if (delta > 180) delta -= 360;
            if (delta < -180) delta += 360;
            prevAngle = curAngle;

            deck.jogAngle += delta;
            rotor.style.transform = `rotate(${deck.jogAngle.toFixed(1)}deg)`;

            // Normalize Jog Modulation value (-1.0 to +1.0)
            if (!deck.fxHold) {
                deck.jogModValue = Math.max(-1, Math.min(1, deck.jogModValue + delta / 110));
            }

            // If paused with a disc loaded, frame-scrub the audio!
            if (deck.discLoaded && !deck.isPlaying && this.activeAudioDeck === deckId) {
                this.audio.currentTime = Math.max(
                    0,
                    Math.min(this.audio.duration || 180, this.audio.currentTime + delta * 0.015)
                );
            } else if (deck.discLoaded && deck.isPlaying && !deck.activeFx && this.activeAudioDeck === deckId) {
                // Temporary pitch bend nudge when no Jog Break FX is active
                const baseRate = 1.0 + (deck.tempoPct / 100);
                const nudge = (delta / 45) * 0.12;
                this.audio.playbackRate = Math.max(0.3, Math.min(2.2, baseRate + nudge));
            }

            const hudAngle = document.getElementById('hud-jog-angle');
            if (hudAngle) {
                hudAngle.textContent = `JOG ${deckId}: ${Math.round(deck.jogAngle)}°`;
            }
        });

        const endDrag = () => {
            if (!isDragging) return;
            isDragging = false;
            if (deck.discLoaded && !deck.activeFx) {
                this.applyPitchAndTempo(deckId);
            }
        };

        wheel.addEventListener('pointerup', endDrag);
        wheel.addEventListener('pointercancel', endDrag);
    }

    /**
     * Synchronizes all visual LEDs, VFD digits, pitch cap position, and disc state
     */
    syncDeckUI(deckId) {
        const s = deckId.toLowerCase();
        const deck = this.decks[deckId];
        if (!deck) return;

        const discEl = document.getElementById(`cdj-disc-${s}`);
        const discLabel = document.getElementById(`cd-disc-label-${s}`);
        const prismDisc = document.getElementById(`prism-disc-${s}`);
        const vfdTrack = document.getElementById(`vfd-track-${s}`);
        const vfdTime = document.getElementById(`vfd-time-${s}`);
        const vfdTempo = document.getElementById(`vfd-tempo-${s}`);
        const vfdTimeLabel = document.getElementById(`vfd-timemode-label-${s}`);
        const vfdAutoCue = document.getElementById(`vfd-autocue-${s}`);
        const vfdMt = document.getElementById(`vfd-mt-${s}`);
        const vfdFxBadge = document.getElementById(`vfd-fx-badge-${s}`);
        const ledPlay = document.getElementById(`led-play-${s}`);
        const ledCue = document.getElementById(`led-cue-${s}`);
        const ledMtBtn = document.getElementById(`led-mt-btn-${s}`);
        const pitchCap = document.getElementById(`pitch-cap-${s}`);

        const track = this.cdWallet[deck.trackIndex];

        // 1. Optical Disc Slot Animation
        if (discEl) {
            discEl.classList.toggle('inserted', deck.discLoaded);
            discEl.classList.toggle('ejected', !deck.discLoaded);
        }
        if (discLabel && track) {
            discLabel.textContent = deck.discLoaded ? track.badge : 'CLICK TO INSERT';
        }

        // 2. Green Prism Window Spinning CD Reflection
        if (prismDisc) {
            prismDisc.classList.toggle('spinning', deck.discLoaded && deck.isPlaying);
        }

        // 3. VFD Readouts (Exact "00 | no dISC | 0.0" when ejected!)
        if (!deck.discLoaded) {
            if (vfdTrack) vfdTrack.textContent = '00';
            if (vfdTime) vfdTime.textContent = 'no dISC';
            if (vfdTimeLabel) vfdTimeLabel.textContent = 'STATUS';
            if (vfdFxBadge) vfdFxBadge.textContent = 'NO DISC ⏏';
        } else {
            if (vfdTrack) vfdTrack.textContent = String(track.id).padStart(2, '0');
            if (vfdTimeLabel) vfdTimeLabel.textContent = deck.timeMode;
            if (vfdFxBadge) {
                vfdFxBadge.textContent = deck.activeFx
                    ? `FX: ${deck.activeFx.toUpperCase()}${deck.fxHold ? ' [HOLD]' : ''}`
                    : 'JOG BREAK: OFF';
            }
        }

        if (vfdTempo) {
            const sign = deck.tempoPct > 0 ? '+' : '';
            vfdTempo.textContent = `${sign}${deck.tempoPct.toFixed(1)}`;
        }

        if (vfdAutoCue) vfdAutoCue.classList.toggle('active', deck.autoCue);
        if (vfdMt) vfdMt.classList.toggle('active', deck.masterTempo);
        if (ledMtBtn) ledMtBtn.classList.toggle('on', deck.masterTempo);

        // 4. Digital Jog Break Blue Buttons
        ['jet', 'zip', 'wah'].forEach((fxName) => {
            const btn = document.getElementById(`btn-${fxName}-${s}`);
            if (btn) {
                btn.classList.toggle('active', deck.activeFx === fxName);
            }
        });

        // 5. Transport Play / Cue LEDs
        if (ledPlay) {
            ledPlay.classList.toggle('playing', deck.discLoaded && deck.isPlaying);
            ledPlay.classList.toggle('paused', deck.discLoaded && !deck.isPlaying);
        }
        if (ledCue) {
            ledCue.classList.toggle('ready', deck.discLoaded);
        }

        // 6. Pitch Fader Cap Position (-10% to +10% mapped to 8%..92%)
        if (pitchCap) {
            const pct = ((deck.tempoPct + 10) / 20) * 84 + 8;
            pitchCap.style.left = `${pct}%`;
        }
    }

    /**
     * Binds Header View Mode Switcher, Mobile Tabs, and DJM-300 Mixer Controls
     */
    bindMixerAndHeaderControls() {
        // View Layout Switcher (Dual Deck / Single Focus / 90° Photo Orientation)
        const tabletop = document.getElementById('cdj-twins-tabletop');
        document.querySelectorAll('.cdj-view-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                this.playHardwareSound('click');
                document.querySelectorAll('.cdj-view-btn').forEach((b) => b.classList.remove('active'));
                btn.classList.add('active');
                const mode = btn.getAttribute('data-layout');
                if (tabletop) {
                    tabletop.classList.toggle('layout-single', mode === 'single');
                    tabletop.classList.toggle('layout-rotated', mode === 'rotated');
                }
            });
        });

        // Mobile Quick Tabs
        document.querySelectorAll('.cdj-mob-tab').forEach((tab) => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.cdj-mob-tab').forEach((t) => t.classList.remove('active'));
                tab.classList.add('active');
                const target = tab.getAttribute('data-mob-target');
                const unitA = document.getElementById('cdj-unit-a');
                const unitB = document.getElementById('cdj-unit-b');
                const mixerPane = document.getElementById('cdj-mixer-pane');

                if (unitA) unitA.classList.toggle('active-mobile-pane', target === 'deckA');
                if (unitB) unitB.classList.toggle('active-mobile-pane', target === 'deckB');
                if (mixerPane) mixerPane.classList.toggle('hidden-mobile-pane', target !== 'mixer');
            });
        });

        // 3-Band EQ & Booth Volume Sliders
        const bindSlider = (id, valId, cb) => {
            const el = document.getElementById(id);
            const valEl = document.getElementById(valId);
            if (!el) return;
            el.addEventListener('input', () => {
                this.initAudioEngine();
                const v = parseFloat(el.value);
                cb(v, valEl);
            });
        };

        bindSlider('eq-low', 'val-eq-low', (v, label) => {
            if (this.eqLow) this.eqLow.gain.value = v;
            if (label) label.textContent = `${v > 0 ? '+' : ''}${v.toFixed(1)} dB`;
        });
        bindSlider('eq-mid', 'val-eq-mid', (v, label) => {
            if (this.eqMid) this.eqMid.gain.value = v;
            if (label) label.textContent = `${v > 0 ? '+' : ''}${v.toFixed(1)} dB`;
        });
        bindSlider('eq-high', 'val-eq-high', (v, label) => {
            if (this.eqHigh) this.eqHigh.gain.value = v;
            if (label) label.textContent = `${v > 0 ? '+' : ''}${v.toFixed(1)} dB`;
        });
        bindSlider('master-vol', 'val-master-vol', (v, label) => {
            if (this.masterGain) this.masterGain.gain.value = v / 100;
            if (label) label.textContent = `${Math.round(v)}%`;
        });

        // Visualizer Mode Switcher
        document.querySelectorAll('.scope-mode-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.scope-mode-btn').forEach((b) => b.classList.remove('active'));
                btn.classList.add('active');
                this.vizMode = btn.getAttribute('data-viz');
            });
        });

        // Utility Buttons
        const btnReset = document.getElementById('btn-reset-dsp');
        if (btnReset) {
            btnReset.addEventListener('click', () => {
                this.playHardwareSound('click');
                ['A', 'B'].forEach((id) => {
                    this.decks[id].tempoPct = 0.0;
                    this.decks[id].activeFx = null;
                    this.decks[id].fxHold = false;
                    this.decks[id].jogModValue = 0;
                    const slider = document.getElementById(`pitch-slider-${id.toLowerCase()}`);
                    if (slider) slider.value = '0';
                    this.syncDeckUI(id);
                });
                this.applyPitchAndTempo(this.activeAudioDeck);
                this.applyDigitalJogBreakDSP();
            });
        }

        const btnHorn = document.getElementById('btn-club-horn');
        if (btnHorn) {
            btnHorn.addEventListener('click', () => this.playHardwareSound('subdrop'));
        }

        const btnSyncDecks = document.getElementById('btn-sync-decks');
        if (btnSyncDecks) {
            btnSyncDecks.addEventListener('click', () => {
                this.playHardwareSound('insert');
                this.decks.A.discLoaded = true;
                this.decks.B.discLoaded = true;
                this.syncDeckUI('A');
                this.syncDeckUI('B');
                this.renderCdWallet();
            });
        }

        const badgeLaser = document.getElementById('cdj-laser-badge');
        if (badgeLaser) {
            badgeLaser.addEventListener('click', () => this.playHardwareSound('subdrop'));
        }
    }

    /**
     * Formats seconds into Pioneer CDJ-100S 75fps Frame format (MM:SS:FF)
     */
    formatCdjTime(seconds) {
        const safeSec = Math.max(0, seconds || 0);
        const mins = Math.floor(safeSec / 60);
        const secs = Math.floor(safeSec % 60);
        const frames = Math.floor((safeSec % 1) * 75); // 75 Compact Disc frames per second!
        return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}:${String(frames).padStart(2, '0')}`;
    }

    /**
     * 60FPS Real-Time Render Loop:
     * - Updates VFD 75fps CD Frame Time & Playing Address Bars
     * - Continuously modulates JET, ZIP, WAH DSP parameters from LFO + Jog Wheel
     * - Draws the DJM-300 VFD Spectrum & Laser Phase Canvas
     */
    startRenderLoop() {
        const canvas = document.getElementById('cdj-scope-canvas');
        const ctx2d = canvas ? canvas.getContext('2d') : null;
        const freqData = new Uint8Array(128);
        const timeData = new Uint8Array(128);

        const tick = () => {
            this.lfoPhase += 0.045;
            const activeDeck = this.decks[this.activeAudioDeck];

            // 1. Update Continuous Digital Jog Break Modulation (LFO + Jog Wheel)
            if (this.ctx && activeDeck && activeDeck.activeFx) {
                if (!activeDeck.fxHold) {
                    // Gently decay manual jog modulation toward LFO center
                    activeDeck.jogModValue *= 0.985;
                }
                const lfo = Math.sin(this.lfoPhase);
                const combinedMod = Math.max(-1, Math.min(1, lfo * 0.45 + activeDeck.jogModValue * 0.85));

                if (activeDeck.activeFx === 'jet' && this.jetDelay) {
                    // Sweep flanger delay between 0.8ms and 9.5ms
                    const delaySec = 0.0048 + combinedMod * 0.0038;
                    this.jetDelay.delayTime.setTargetAtTime(Math.max(0.0006, delaySec), this.ctx.currentTime, 0.015);
                } else if (activeDeck.activeFx === 'wah' && this.wahFilter) {
                    // Sweep resonant bandpass filter between 180Hz and 5200Hz
                    const cutoff = 1400 * Math.pow(3.6, combinedMod);
                    this.wahFilter.frequency.setTargetAtTime(Math.max(140, Math.min(6500, cutoff)), this.ctx.currentTime, 0.015);
                } else if (activeDeck.activeFx === 'zip') {
                    // Pitch-warp playbackRate modulation
                    const baseRate = 1.0 + (activeDeck.tempoPct / 100);
                    const warpedRate = Math.max(0.28, Math.min(2.2, baseRate + combinedMod * 0.38));
                    this.audio.playbackRate = warpedRate;
                }
            }

            // 2. Update Both Decks' VFD Displays & Playing Address Bars
            ['A', 'B'].forEach((id) => {
                const d = this.decks[id];
                const s = id.toLowerCase();
                const vfdTime = document.getElementById(`vfd-time-${s}`);
                const rotor = document.getElementById(`jog-rotor-${s}`);
                const bar = document.getElementById(`vfd-bar-${s}`);

                if (!d.discLoaded) {
                    if (vfdTime && vfdTime.textContent !== 'no dISC') {
                        vfdTime.textContent = 'no dISC';
                    }
                    if (bar) {
                        Array.from(bar.children).forEach((seg) => seg.classList.remove('lit', 'cue-mark'));
                    }
                    return;
                }

                // Compute elapsed/remaining time
                let curT = d.virtualTime;
                const dur = this.audio.duration || 180;
                if (this.activeAudioDeck === id) {
                    curT = this.audio.currentTime;
                    d.virtualTime = curT;
                } else if (d.isPlaying) {
                    d.virtualTime = (d.virtualTime + 0.016) % dur;
                    curT = d.virtualTime;
                }

                const displaySec = d.timeMode === 'REMAIN' ? Math.max(0, dur - curT) : curT;
                if (vfdTime) {
                    vfdTime.textContent = this.formatCdjTime(displaySec);
                }

                // Auto-rotate Jog Wheel subtle indicator while playing
                if (d.isPlaying && rotor) {
                    d.jogAngle = (d.jogAngle + 0.9 * (1 + d.tempoPct / 100)) % 360;
                    rotor.style.transform = `rotate(${d.jogAngle.toFixed(1)}deg)`;
                }

                // Update 24-segment VFD Playing Address Bar
                if (bar) {
                    const progressSegs = Math.floor((curT / dur) * 24);
                    const cueSeg = Math.floor(((d.cuePoint % dur) / dur) * 24);
                    Array.from(bar.children).forEach((seg, idx) => {
                        seg.classList.toggle('lit', d.timeMode === 'REMAIN' ? idx >= progressSegs : idx <= progressSegs);
                        seg.classList.toggle('cue-mark', idx === cueSeg);
                    });
                }
            });

            // 3. Update HUD BPM & Pitch Readouts
            if (activeDeck) {
                const track = this.cdWallet[activeDeck.trackIndex];
                const effectiveBpm = track.bpm * (1 + activeDeck.tempoPct / 100);
                const hudBpm = document.getElementById('hud-bpm-readout');
                const hudPitch = document.getElementById('hud-pitch-readout');
                if (hudBpm) hudBpm.textContent = `${effectiveBpm.toFixed(1)} BPM`;
                if (hudPitch) {
                    const sign = activeDeck.tempoPct > 0 ? '+' : '';
                    hudPitch.textContent = `PITCH: ${sign}${activeDeck.tempoPct.toFixed(1)}%`;
                }
            }

            // 4. Draw Scope Canvas
            if (ctx2d && canvas) {
                this.drawScopeCanvas(ctx2d, canvas.width, canvas.height, freqData, timeData);
            }

            requestAnimationFrame(tick);
        };

        requestAnimationFrame(tick);
    }

    drawScopeCanvas(ctx2d, w, h, freqData, timeData) {
        ctx2d.fillStyle = '#07080a';
        ctx2d.fillRect(0, 0, w, h);

        // Subtle VFD Grid
        ctx2d.strokeStyle = 'rgba(148, 163, 184, 0.08)';
        ctx2d.lineWidth = 1;
        for (let x = 0; x < w; x += 32) {
            ctx2d.beginPath();
            ctx2d.moveTo(x, 0);
            ctx2d.lineTo(x, h);
            ctx2d.stroke();
        }
        for (let y = 0; y < h; y += 30) {
            ctx2d.beginPath();
            ctx2d.moveTo(0, y);
            ctx2d.lineTo(w, y);
            ctx2d.stroke();
        }

        if (this.analyser && !this.audio.paused) {
            this.analyser.getByteFrequencyData(freqData);
            this.analyser.getByteTimeDomainData(timeData);
        } else {
            // Idle ambient VFD heartbeat
            for (let i = 0; i < 64; i++) {
                freqData[i] = 14 + Math.sin(this.lfoPhase * 2 + i * 0.25) * 10;
                timeData[i] = 128 + Math.sin(this.lfoPhase + i * 0.2) * 8;
            }
        }

        if (this.vizMode === 'vfd') {
            // Pioneer VFD Vacuum Fluorescent Segmented Bars (Cyan-White + Orange Peak)
            const bars = 32;
            const barW = (w - 24) / bars;
            for (let i = 0; i < bars; i++) {
                const val = freqData[i * 2] / 255;
                const segCount = Math.floor(val * 14);
                for (let s = 0; s < segCount; s++) {
                    const y = h - 14 - s * 8;
                    ctx2d.fillStyle = s > 10 ? '#ff7b1c' : s > 7 ? '#7ce625' : '#e2f1ff';
                    ctx2d.fillRect(12 + i * barW, y, barW - 3, 5);
                }
            }
        } else if (this.vizMode === 'laser') {
            // Optical Green & Periwinkle-Blue Waveform
            ctx2d.lineWidth = 2.2;
            ctx2d.strokeStyle = '#7ce625';
            ctx2d.beginPath();
            for (let i = 0; i < 64; i++) {
                const x = (i / 63) * w;
                const y = (timeData[i] / 255) * h;
                if (i === 0) ctx2d.moveTo(x, y);
                else ctx2d.lineTo(x, y);
            }
            ctx2d.stroke();
        } else {
            // Jog Break Circular Phase Radar
            const cx = w / 2;
            const cy = h / 2 + 6;
            const baseR = 36;
            ctx2d.strokeStyle = '#60a5fa';
            ctx2d.lineWidth = 2;
            ctx2d.beginPath();
            for (let i = 0; i < 64; i++) {
                const ang = (i / 64) * Math.PI * 2 + this.lfoPhase * 0.5;
                const r = baseR + (freqData[i] / 255) * 34;
                const x = cx + Math.cos(ang) * r;
                const y = cy + Math.sin(ang) * r;
                if (i === 0) ctx2d.moveTo(x, y);
                else ctx2d.lineTo(x, y);
            }
            ctx2d.closePath();
            ctx2d.stroke();
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.cdj100sEngine = new PioneerCDJ100SEngine();
});
