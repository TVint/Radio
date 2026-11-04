/**
 * ============================================================================
 * TECHNICS SL-1200 // DIRECT DRIVE TURNTABLE SYSTEM
 * Real-Time Vinyl Jog/Scratch Physics, True Forward/Reverse Buffer Scrubbing,
 * Analog Vinyl Dust Crackle & Stroboscopic Quartz Lock Engine
 * File: js/technics/technics.js
 * ============================================================================
 */

class TechnicsSL1200Engine {
    constructor() {
        this.audio = document.getElementById('technics-audio');

        // 8 Classic 12" Vinyl Pressings in the DJ Crate
        this.vinylCrate = [
            { id: 1, title: 'GRANDMASTER CUTS (ORIGINAL 12")', artist: 'BRONX B-BOYS 1982', rpm: 33.3, offset: 0, labelColor: '#dc2626' },
            { id: 2, title: 'TECHNICS DMC BATTLE BREAKS', artist: 'DJ Q-BERT & MIX MASTER', rpm: 33.3, offset: 20, labelColor: '#2563eb' },
            { id: 3, title: 'SHIBUYA JAZZ HIP-HOP INSTRUMENTAL', artist: 'TOKYO WAX COLLECTIVE', rpm: 33.3, offset: 42, labelColor: '#d97706' },
            { id: 4, title: 'DETROIT DIRECT DRIVE TECHNO', artist: 'UNDERGROUND RESISTANCE', rpm: 45.0, offset: 64, labelColor: '#059669' },
            { id: 5, title: 'FRENCH TOUCH FILTERED DISCO LOOP', artist: 'ROULÉ / CRYDAMOURE 98', rpm: 33.3, offset: 86, labelColor: '#7c3aed' },
            { id: 6, title: 'BRISTOL TRIP-HOP DUBPLATE', artist: 'WILD BUNCH SOUND SYSTEM', rpm: 33.3, offset: 108, labelColor: '#db2777' },
            { id: 7, title: 'LONDON JUNGLE AMEN CHOPPER (45 RPM)', artist: 'METALHEADZ DUB', rpm: 45.0, offset: 130, labelColor: '#ea580c' },
            { id: 8, title: 'MILANO PIRATE RADIO LATE NIGHT WAX', artist: 'QDG ANALOG ARCHIVE', rpm: 33.3, offset: 150, labelColor: '#0284c7' }
        ];

        // Turntable Mechanical & Physics State
        this.powerOn = true;
        this.motorRunning = false;
        this.baseRpm = 33.333;        // 33.333 or 45.0
        this.pitchRange = 8;          // ±8% or ±16% (when x2 is active)
        this.pitchPct = 0.0;          // Current Pitch Fader percentage
        this.quartzLock = true;       // True when fader is at 0.0%
        this.targetLightOn = true;
        this.activeRecordIdx = 0;

        // Platter & Hand-On-Vinyl Jog/Scratch Physics
        this.platterAngle = 0;        // Current rotation angle in degrees
        this.currentRpm = 0;          // Instantaneous platter RPM (can be negative during backspin/scratch!)
        this.isHandOnVinyl = false;   // True while user is pressing/holding the vinyl record
        this.wasMotorRunningBeforeTouch = false;
        this.handAngularVelDegPerSec = 0; // Instantaneous angular velocity from user's hand drag
        this.virtualTime = 0;         // Scrubbable track position in seconds
        this.torqueFactor = 0.85;     // Direct-drive motor recovery torque (0.2 to 1.0)
        this.powerBrakeActive = false;

        // Web Audio API & True Forward/Reverse Scratch Synthesizer
        this.ctx = null;
        this.sourceNode = null;
        this.analyser = null;
        this.mediaGain = null;
        this.masterGain = null;
        this.crackleGain = null;

        // Real-time Vinyl Scratch Resonator (plays forward & reverse vocal/cut formants when scratching!)
        this.scratchOsc = null;
        this.scratchModOsc = null;
        this.scratchModGain = null;
        this.scratchFilter = null;
        this.scratchNoiseGain = null;
        this.scratchVoiceGain = null;

        // Decoded AudioBuffer for sample-accurate reverse/forward scrubbing when available
        this.decodedBuffer = null;
        this.scriptScratchNode = null;
        this.bufferPlayheadSamples = 0;

        this.init();
    }

    init() {
        this.renderVinylCrate();
        this.bindTurntableHardware();
        this.bindVinylScratchSurface();
        this.bindBattleMacrosAndSliders();
        this.syncHardwareUI();
        this.startPhysicsAndRenderLoop();
    }

    /**
     * Initializes the Web Audio API graph:
     * 1. Main MediaElement source for normal quartz-locked playback
     * 2. Continuous Vinyl Dust & Needle Crackle generator
     * 3. Real-Time Bi-Directional Vinyl Scratch Synth + AudioBuffer Reverse Reader
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

        this.analyser = this.ctx.createAnalyser();
        this.analyser.fftSize = 256;
        this.analyser.smoothingTimeConstant = 0.75;

        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.90;

        this.mediaGain = this.ctx.createGain();
        this.mediaGain.gain.value = 1.0;

        this.sourceNode = this.ctx.createMediaElementSource(this.audio);
        this.sourceNode.connect(this.mediaGain);
        this.mediaGain.connect(this.masterGain);

        this.masterGain.connect(this.analyser);
        this.analyser.connect(this.ctx.destination);

        // Setup Continuous Analog Vinyl Dust Crackle + Real-Time Scratch Synthesizer
        this.setupVinylCrackleAndScratchNodes();

        // Attempt to decode test-track.mp3 into an AudioBuffer for true reverse sample scrubbing
        this.loadAndDecodeTrackBuffer();
    }

    setupVinylCrackleAndScratchNodes() {
        if (!this.ctx) return;

        // 1. Procedural Vinyl Surface Noise & Dust Pops Buffer (4 seconds looped)
        const sr = this.ctx.sampleRate;
        const noiseLen = sr * 4;
        const noiseBuf = this.ctx.createBuffer(1, noiseLen, sr);
        const data = noiseBuf.getChannelData(0);
        for (let i = 0; i < noiseLen; i++) {
            // Subtle warm surface hiss + occasional vinyl dust crackle pop
            const pop = Math.random() < 0.0018 ? (Math.random() * 2 - 1) * 0.85 : 0;
            data[i] = (Math.random() * 2 - 1) * 0.035 + pop;
        }

        const noiseSource = this.ctx.createBufferSource();
        noiseSource.buffer = noiseBuf;
        noiseSource.loop = true;

        const crackleBandpass = this.ctx.createBiquadFilter();
        crackleBandpass.type = 'bandpass';
        crackleBandpass.frequency.value = 2400;
        crackleBandpass.Q.value = 1.4;

        this.crackleGain = this.ctx.createGain();
        this.crackleGain.gain.value = 0.0; // Controlled by platter rotation & slider

        noiseSource.connect(crackleBandpass);
        crackleBandpass.connect(this.crackleGain);
        this.crackleGain.connect(this.masterGain);
        noiseSource.start();

        // 2. Real-Time Turntablist Scratch Resonator (Produces "Fresh/Ahhh" Vocal & Groove Cut on drag!)
        this.scratchOsc = this.ctx.createOscillator();
        this.scratchOsc.type = 'sawtooth';
        this.scratchOsc.frequency.value = 160;

        this.scratchModOsc = this.ctx.createOscillator();
        this.scratchModOsc.type = 'triangle';
        this.scratchModOsc.frequency.value = 28;

        this.scratchModGain = this.ctx.createGain();
        this.scratchModGain.gain.value = 45;

        this.scratchFilter = this.ctx.createBiquadFilter();
        this.scratchFilter.type = 'bandpass';
        this.scratchFilter.frequency.value = 650;
        this.scratchFilter.Q.value = 4.8;

        this.scratchVoiceGain = this.ctx.createGain();
        this.scratchVoiceGain.gain.value = 0.0; // Silent until user moves vinyl!

        this.scratchModOsc.connect(this.scratchModGain);
        this.scratchModGain.connect(this.scratchOsc.frequency);
        this.scratchOsc.connect(this.scratchFilter);
        this.scratchFilter.connect(this.scratchVoiceGain);
        this.scratchVoiceGain.connect(this.masterGain);

        this.scratchOsc.start();
        this.scratchModOsc.start();

        // 3. True Sample-Accurate Forward/Reverse AudioBuffer Scrubbing Node
        if (this.ctx.createScriptProcessor) {
            this.scriptScratchNode = this.ctx.createScriptProcessor(2048, 0, 2);
            this.scriptScratchNode.onaudioprocess = (e) => {
                const outL = e.outputBuffer.getChannelData(0);
                const outR = e.outputBuffer.getChannelData(1);

                // Only output buffer scrub audio while user is actively holding/scratching the vinyl
                // or during a negative-RPM backspin!
                const useBufferScrub = (this.isHandOnVinyl || this.currentRpm < -0.5) && this.decodedBuffer;

                if (!useBufferScrub) {
                    for (let i = 0; i < outL.length; i++) {
                        outL[i] = 0;
                        outR[i] = 0;
                    }
                    return;
                }

                const chanL = this.decodedBuffer.getChannelData(0);
                const chanR = this.decodedBuffer.numberOfChannels > 1
                    ? this.decodedBuffer.getChannelData(1)
                    : chanL;
                const totalSamples = chanL.length;

                // Speed ratio relative to normal 33.333 RPM forward playback
                const rate = this.currentRpm / 33.333;

                for (let i = 0; i < outL.length; i++) {
                    this.bufferPlayheadSamples += rate;
                    if (this.bufferPlayheadSamples < 0) {
                        this.bufferPlayheadSamples += totalSamples;
                    } else if (this.bufferPlayheadSamples >= totalSamples) {
                        this.bufferPlayheadSamples %= totalSamples;
                    }

                    const idx0 = Math.floor(this.bufferPlayheadSamples);
                    const idx1 = (idx0 + 1) % totalSamples;
                    const frac = this.bufferPlayheadSamples - idx0;

                    // Linear interpolation for smooth variable-pitch forward & reverse vinyl scrub
                    const amp = Math.min(1.0, Math.abs(rate) * 1.15);
                    outL[i] = (chanL[idx0] * (1 - frac) + chanL[idx1] * frac) * amp;
                    outR[i] = (chanR[idx0] * (1 - frac) + chanR[idx1] * frac) * amp;
                }
            };
            this.scriptScratchNode.connect(this.masterGain);
        }
    }

    async loadAndDecodeTrackBuffer() {
        try {
            const resp = await fetch('test-track.mp3');
            const arrayBuf = await resp.arrayBuffer();
            if (this.ctx) {
                this.decodedBuffer = await this.ctx.decodeAudioData(arrayBuf);
            }
        } catch (_) {
            // Fallback to formant scratch synth + currentTime scrubbing if fetch is restricted
        }
    }

    /**
     * Tactile Mechanical Click & Vinyl Stop Thud Synthesizer
     */
    playMechanicalSound(type) {
        this.initAudioEngine();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);

        if (type === 'startstop') {
            // Heavy Technics SL-1200 micro-switch click
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(920, now);
            osc.frequency.exponentialRampToValueAtTime(140, now + 0.035);
            gain.gain.setValueAtTime(0.24, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.038);
            osc.start(now);
            osc.stop(now + 0.04);
        } else if (type === 'handgrab') {
            // Soft low-frequency vinyl hand-stop thump
            osc.type = 'sine';
            osc.frequency.setValueAtTime(110, now);
            osc.frequency.exponentialRampToValueAtTime(38, now + 0.06);
            gain.gain.setValueAtTime(0.22, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);
            osc.start(now);
            osc.stop(now + 0.07);
        } else if (type === 'button') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(1350, now);
            osc.frequency.exponentialRampToValueAtTime(320, now + 0.02);
            gain.gain.setValueAtTime(0.14, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.022);
            osc.start(now);
            osc.stop(now + 0.025);
        }
    }

    /**
     * ========================================================================
     * CORE FEATURE: INTERACTIVE VINYL JOG & SCRATCH SURFACE
     * - Pressing down on the vinyl stops the music immediately
     * - Dragging clockwise / counter-clockwise scratches forward & backward!
     * ========================================================================
     */
    bindVinylScratchSurface() {
        const vinyl = document.getElementById('sl-vinyl-disc');
        const touchHalo = document.getElementById('vinyl-touch-halo');
        const liveText = document.getElementById('scratch-live-text');
        const stateBadge = document.getElementById('scratch-state-badge');
        if (!vinyl) return;

        let prevAngleDeg = 0;
        let lastMoveTime = performance.now();

        const getPointerAngle = (clientX, clientY) => {
            const rect = vinyl.getBoundingClientRect();
            const cx = rect.left + rect.width / 2;
            const cy = rect.top + rect.height / 2;
            return Math.atan2(clientY - cy, clientX - cx) * (180 / Math.PI);
        };

        // 1. HAND PRESSES DOWN ON VINYL -> MUSIC STOPS IMMEDIATELY
        vinyl.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            this.initAudioEngine();
            this.playMechanicalSound('handgrab');

            vinyl.setPointerCapture(e.pointerId);
            vinyl.classList.add('is-scratching');
            if (touchHalo) touchHalo.classList.add('active');

            this.isHandOnVinyl = true;
            this.wasMotorRunningBeforeTouch = this.motorRunning;

            // Sync sample playhead with current audio time before pausing media element
            this.virtualTime = this.audio.currentTime || this.virtualTime;
            if (this.decodedBuffer) {
                const dur = this.decodedBuffer.duration || 1;
                this.bufferPlayheadSamples = ((this.virtualTime % dur) / dur) * this.decodedBuffer.length;
            }

            // Immediately stop normal forward playback (hand holds the record still on the slipmat!)
            this.audio.pause();
            this.currentRpm = 0;
            this.handAngularVelDegPerSec = 0;

            prevAngleDeg = getPointerAngle(e.clientX, e.clientY);
            lastMoveTime = performance.now();

            if (liveText) {
                liveText.innerHTML = '🛑 <strong>MANO SUL VINILE (MUSICA FERMA):</strong> Ruota il cursore avanti o indietro per <strong>Scratchare</strong> il disco!';
            }
            if (stateBadge) {
                stateBadge.textContent = 'HAND ON VINYL // HOLD';
            }
        });

        // 2. HAND ROTATES VINYL CLOCKWISE (FWD) OR COUNTER-CLOCKWISE (REV) -> SCRATCH!
        vinyl.addEventListener('pointermove', (e) => {
            if (!this.isHandOnVinyl) return;

            const now = performance.now();
            const dt = Math.max(0.004, (now - lastMoveTime) / 1000);
            lastMoveTime = now;

            const curAngleDeg = getPointerAngle(e.clientX, e.clientY);
            let deltaDeg = curAngleDeg - prevAngleDeg;
            if (deltaDeg > 180) deltaDeg -= 360;
            if (deltaDeg < -180) deltaDeg += 360;
            prevAngleDeg = curAngleDeg;

            // Rotate vinyl platter 1:1 with finger/mouse
            this.platterAngle += deltaDeg;
            vinyl.style.transform = `rotate(${this.platterAngle.toFixed(2)}deg)`;

            // Compute instantaneous angular velocity (deg/s) and equivalent RPM
            // Note: 33.333 RPM = 200 degrees per second
            const instVelDegPerSec = deltaDeg / dt;
            this.handAngularVelDegPerSec = this.handAngularVelDegPerSec * 0.35 + instVelDegPerSec * 0.65;
            this.currentRpm = this.handAngularVelDegPerSec / 6.0; // (deg/s) / 6 = RPM

            // Scrub virtualTime & audio.currentTime forward or backward!
            const deltaSeconds = deltaDeg / 200.0;
            const dur = this.audio.duration || 180;
            this.virtualTime = Math.max(0, Math.min(dur - 0.05, this.virtualTime + deltaSeconds));
            if (Number.isFinite(this.virtualTime)) {
                this.audio.currentTime = this.virtualTime;
            }

            // Trigger real-time Vinyl Scratch Resonator voice proportional to hand speed
            this.modulateScratchSynth(this.currentRpm);

            if (stateBadge) {
                const dir = this.currentRpm >= 0 ? 'FWD ▶' : 'REV ◀';
                stateBadge.textContent = `SCRATCH ${dir} (${this.currentRpm.toFixed(1)} RPM)`;
            }
        });

        // 3. HAND RELEASES VINYL -> RESUME MOTOR PLAYBACK FROM NEW SCRATCHED POSITION
        const releaseVinyl = () => {
            if (!this.isHandOnVinyl) return;
            this.isHandOnVinyl = false;
            vinyl.classList.remove('is-scratching');
            if (touchHalo) touchHalo.classList.remove('active');

            // Silence scratch synth voice smoothly
            if (this.scratchVoiceGain && this.ctx) {
                this.scratchVoiceGain.gain.setTargetAtTime(0.0, this.ctx.currentTime, 0.025);
            }

            // Sync audio.currentTime with where the buffer playhead ended up
            if (this.decodedBuffer && this.audio.duration) {
                const newSec = (this.bufferPlayheadSamples / this.decodedBuffer.length) * this.decodedBuffer.duration;
                if (Number.isFinite(newSec) && newSec >= 0) {
                    this.virtualTime = newSec;
                    this.audio.currentTime = newSec;
                }
            }

            // If motor was running (or if user started scratching from standby, auto-start motor!), resume playback
            if (this.wasMotorRunningBeforeTouch || Math.abs(this.currentRpm) > 8) {
                this.motorRunning = true;
                this.powerBrakeActive = false;
                this.applyMotorPlaybackRate();
                this.audio.play().catch(() => {});
            }

            if (liveText) {
                liveText.innerHTML = '🖐️ <strong>MODALITÀ JOG VINILE:</strong> Tieni premuto sul disco per bloccare la musica, muovi in senso orario/antiorario per <strong>Scratchare avanti e indietro</strong>!';
            }
            this.syncHardwareUI();
        };

        vinyl.addEventListener('pointerup', releaseVinyl);
        vinyl.addEventListener('pointercancel', releaseVinyl);
    }

    /**
     * Modulates the Analog Vinyl Scratch Resonator based on instantaneous platter RPM
     */
    modulateScratchSynth(rpm) {
        if (!this.ctx || !this.scratchVoiceGain) return;

        const now = this.ctx.currentTime;
        const speedRatio = Math.abs(rpm) / 33.333;

        if (speedRatio < 0.03) {
            // Hand is holding the vinyl stationary -> total silence!
            this.scratchVoiceGain.gain.setTargetAtTime(0.0, now, 0.015);
            return;
        }

        // Map scratch speed to vocal formant pitch & resonant filter sweep ("Fresh / Chirp" texture)
        const baseFreq = rpm >= 0 ? 135 : 115;
        const pitchFreq = Math.max(55, Math.min(980, baseFreq * (0.45 + speedRatio * 1.45)));
        const filterCutoff = Math.max(220, Math.min(4800, 380 + speedRatio * 1850));

        this.scratchOsc.frequency.setTargetAtTime(pitchFreq, now, 0.012);
        this.scratchFilter.frequency.setTargetAtTime(filterCutoff, now, 0.012);

        // If decodedBuffer is playing the real track samples, keep synth subtle as stylus friction;
        // otherwise let the synth carry the full turntablist cut!
        const maxGain = this.decodedBuffer ? 0.08 : 0.28;
        const targetGain = Math.min(maxGain, speedRatio * (this.decodedBuffer ? 0.06 : 0.22));
        this.scratchVoiceGain.gain.setTargetAtTime(targetGain, now, 0.012);
    }

    /**
     * Binds all Technics SL-1200 physical controls on the plinth
     */
    bindTurntableHardware() {
        // 1. START · STOP Button
        const btnStartStop = document.getElementById('btn-start-stop');
        if (btnStartStop) {
            btnStartStop.addEventListener('click', () => {
                this.playMechanicalSound('startstop');
                if (!this.powerOn) {
                    this.powerOn = true;
                }
                this.motorRunning = !this.motorRunning;
                this.powerBrakeActive = false;

                if (this.motorRunning) {
                    this.applyMotorPlaybackRate();
                    this.audio.play().catch(() => {});
                } else {
                    this.audio.pause();
                }
                this.syncHardwareUI();
            });
        }

        // 2. 33 & 45 RPM Speed Buttons
        const btn33 = document.getElementById('btn-rpm-33');
        const btn45 = document.getElementById('btn-rpm-45');
        if (btn33) {
            btn33.addEventListener('click', () => {
                this.playMechanicalSound('button');
                this.baseRpm = 33.333;
                this.applyMotorPlaybackRate();
                this.syncHardwareUI();
            });
        }
        if (btn45) {
            btn45.addEventListener('click', () => {
                this.playMechanicalSound('button');
                this.baseRpm = 45.0;
                this.applyMotorPlaybackRate();
                this.syncHardwareUI();
            });
        }

        // 3. Strobe Tower Rotary ON/OFF Switch
        const btnPower = document.getElementById('btn-sl-power');
        if (btnPower) {
            btnPower.addEventListener('click', () => {
                this.playMechanicalSound('button');
                this.powerOn = !this.powerOn;
                if (!this.powerOn) {
                    this.motorRunning = false;
                    this.audio.pause();
                }
                this.syncHardwareUI();
            });
        }

        // 4. Stylus Target Light Pop-up Cylinder
        const btnStylusLight = document.getElementById('btn-stylus-light');
        if (btnStylusLight) {
            btnStylusLight.addEventListener('click', () => {
                this.playMechanicalSound('button');
                this.targetLightOn = !this.targetLightOn;
                this.syncHardwareUI();
            });
        }

        // 5. Pitch Range ×2 Button (±8% / ±16%)
        const btnX2 = document.getElementById('btn-pitch-x2');
        const pitchSlider = document.getElementById('sl-pitch-slider');
        if (btnX2 && pitchSlider) {
            btnX2.addEventListener('click', () => {
                this.playMechanicalSound('button');
                this.pitchRange = this.pitchRange === 8 ? 16 : 8;
                pitchSlider.min = String(-this.pitchRange);
                pitchSlider.max = String(this.pitchRange);
                this.pitchPct = Math.max(-this.pitchRange, Math.min(this.pitchRange, this.pitchPct));
                pitchSlider.value = String(this.pitchPct);
                this.applyMotorPlaybackRate();
                this.syncHardwareUI();
            });
        }

        // 6. Pitch RESET (Quartz Lock 0.0%) Button
        const btnReset = document.getElementById('btn-pitch-reset');
        if (btnReset && pitchSlider) {
            btnReset.addEventListener('click', () => {
                this.playMechanicalSound('button');
                this.pitchPct = 0.0;
                this.quartzLock = true;
                pitchSlider.value = '0';
                this.applyMotorPlaybackRate();
                this.syncHardwareUI();
            });
        }

        // 7. Vertical Slotted PITCH ADJ. Fader
        if (pitchSlider) {
            pitchSlider.addEventListener('input', () => {
                let val = parseFloat(pitchSlider.value);
                if (Math.abs(val) < 0.25) {
                    val = 0.0;
                    pitchSlider.value = '0';
                    this.quartzLock = true;
                } else {
                    this.quartzLock = false;
                }
                this.pitchPct = val;
                this.applyMotorPlaybackRate();
                this.syncHardwareUI();
            });
        }

        // 8. Top-Left 45 RPM Adapter -> Triggers a High-Speed Backspin Whip!
        const btn45Adapter = document.getElementById('btn-45-adapter');
        const btnHeaderAdapter = document.getElementById('btn-header-45adapter');
        [btn45Adapter, btnHeaderAdapter].forEach((el) => {
            if (el) {
                el.addEventListener('click', () => this.triggerBackspinMacro());
            }
        });

        // 9. Slipmat / Vinyl Visual Style Switcher (Header)
        const plinth = document.getElementById('sl1200-plinth');
        document.querySelectorAll('.sl-style-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                this.playMechanicalSound('button');
                document.querySelectorAll('.sl-style-btn').forEach((b) => b.classList.remove('active'));
                btn.classList.add('active');
                const matMode = btn.getAttribute('data-mat');
                if (plinth) {
                    plinth.setAttribute('data-mat-mode', matMode);
                }
            });
        });
    }

    /**
     * Binds Turntablist Macro Buttons (Baby Scratch, Backspin, Transformer Cut, Power Brake)
     */
    bindBattleMacrosAndSliders() {
        // 1. BABY SCRATCH Macro
        const btnBaby = document.getElementById('btn-macro-baby');
        if (btnBaby) {
            btnBaby.addEventListener('click', () => {
                this.initAudioEngine();
                if (!this.motorRunning) {
                    this.motorRunning = true;
                    this.audio.play().catch(() => {});
                }
                let step = 0;
                const swings = [68, -62, 75, -70, 52, -48, 33.3];
                const timer = setInterval(() => {
                    if (step >= swings.length) {
                        clearInterval(timer);
                        if (this.scratchVoiceGain && this.ctx) {
                            this.scratchVoiceGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.03);
                        }
                        this.applyMotorPlaybackRate();
                        return;
                    }
                    this.currentRpm = swings[step];
                    this.modulateScratchSynth(this.currentRpm);
                    step++;
                }, 95);
            });
        }

        // 2. BACKSPIN WHIP Macro
        const btnBackspin = document.getElementById('btn-macro-backspin');
        if (btnBackspin) {
            btnBackspin.addEventListener('click', () => this.triggerBackspinMacro());
        }

        // 3. TRANSFORMER CUT Macro (Rapid Crossfader Stutter)
        const btnTrans = document.getElementById('btn-macro-transformer');
        if (btnTrans) {
            btnTrans.addEventListener('click', () => {
                this.initAudioEngine();
                if (!this.mediaGain) return;
                let cuts = 0;
                const cutInterval = setInterval(() => {
                    this.mediaGain.gain.value = cuts % 2 === 0 ? 0.0 : 1.0;
                    cuts++;
                    if (cuts >= 12) {
                        clearInterval(cutInterval);
                        this.mediaGain.gain.value = 1.0;
                    }
                }, 55);
            });
        }

        // 4. POWER BRAKE Macro (Slow Turntable Motor Down to 0 RPM)
        const btnBrake = document.getElementById('btn-macro-brake');
        if (btnBrake) {
            btnBrake.addEventListener('click', () => {
                this.playMechanicalSound('startstop');
                this.powerBrakeActive = true;
                this.motorRunning = false;
                this.syncHardwareUI();
            });
        }

        // Analog Sliders (Vinyl Crackle, Torque, Phono Volume)
        const crackleSlider = document.getElementById('sl-crackle-vol');
        const valCrackle = document.getElementById('val-crackle');
        if (crackleSlider) {
            crackleSlider.addEventListener('input', () => {
                if (valCrackle) valCrackle.textContent = `${crackleSlider.value}%`;
            });
        }

        const torqueSlider = document.getElementById('sl-torque-feel');
        const valTorque = document.getElementById('val-torque');
        if (torqueSlider) {
            torqueSlider.addEventListener('input', () => {
                const v = parseInt(torqueSlider.value, 10);
                this.torqueFactor = v / 100;
                if (valTorque) {
                    valTorque.textContent = `${v >= 70 ? 'HIGH' : v >= 45 ? 'MID' : 'LOW'} (${v}%)`;
                }
            });
        }

        const volSlider = document.getElementById('sl-master-vol');
        const valVol = document.getElementById('val-phono-vol');
        if (volSlider) {
            volSlider.addEventListener('input', () => {
                this.initAudioEngine();
                const v = parseInt(volSlider.value, 10);
                if (this.masterGain) this.masterGain.gain.value = v / 100;
                if (valVol) valVol.textContent = `${v}%`;
            });
        }
    }

    triggerBackspinMacro() {
        this.initAudioEngine();
        this.playMechanicalSound('handgrab');
        this.currentRpm = -135; // High-speed reverse whip!
        this.modulateScratchSynth(this.currentRpm);
        setTimeout(() => {
            if (this.scratchVoiceGain && this.ctx) {
                this.scratchVoiceGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.08);
            }
        }, 420);
    }

    /**
     * Populates the 8 12" Vinyl Records in the DJ Crate
     */
    renderVinylCrate() {
        const list = document.getElementById('sl-vinyl-crate-list');
        if (!list) return;

        list.innerHTML = '';
        this.vinylCrate.forEach((rec, idx) => {
            const item = document.createElement('div');
            item.className = `crate-record-item ${idx === this.activeRecordIdx ? 'active' : ''}`;
            item.innerHTML = `
                <div class="crate-mini-vinyl" style="background: radial-gradient(circle, ${rec.labelColor} 0%, ${rec.labelColor} 28%, #111318 30%, #272b35 60%, #090a0d 100%);"></div>
                <div class="crate-meta">
                    <span class="crate-title">0${rec.id} // ${rec.title}</span>
                    <span class="crate-sub">${rec.artist}</span>
                </div>
                <span class="crate-rpm-tag">${rec.rpm === 45 ? '45 RPM' : '33⅓ RPM'}</span>
            `;

            item.addEventListener('click', () => {
                this.loadRecordOnPlatter(idx);
            });
            list.appendChild(item);
        });
    }

    loadRecordOnPlatter(idx) {
        this.playMechanicalSound('handgrab');
        this.activeRecordIdx = idx;
        const rec = this.vinylCrate[idx];
        this.baseRpm = rec.rpm === 45 ? 45.0 : 33.333;

        const labelEl = document.getElementById('vinyl-center-label');
        const labelTitle = document.getElementById('vinyl-label-title');
        if (labelEl) {
            labelEl.style.background = `radial-gradient(circle, ${rec.labelColor} 0%, #111827 90%)`;
        }
        if (labelTitle) {
            labelTitle.textContent = `TRK 0${rec.id} // ${rec.rpm === 45 ? '45' : '33⅓'} RPM`;
        }

        if (this.audio.readyState >= 1) {
            const dur = this.audio.duration || 180;
            this.virtualTime = rec.offset % dur;
            this.audio.currentTime = this.virtualTime;
        }

        this.motorRunning = true;
        this.powerBrakeActive = false;
        this.applyMotorPlaybackRate();
        this.audio.play().catch(() => {});

        this.renderVinylCrate();
        this.syncHardwareUI();
    }

    /**
     * Computes and applies playbackRate from baseRpm (33.3 / 45) and Pitch Slider (±8% / ±16%)
     */
    applyMotorPlaybackRate() {
        const rpmRatio = this.baseRpm / 33.333;
        const pitchMultiplier = 1.0 + (this.pitchPct / 100.0);
        const rate = Math.max(0.25, Math.min(2.5, rpmRatio * pitchMultiplier));

        // Analog turntable changes pitch naturally with speed (preservesPitch = false)
        if ('preservesPitch' in this.audio) {
            this.audio.preservesPitch = false;
        } else if ('mozPreservesPitch' in this.audio) {
            this.audio.mozPreservesPitch = false;
        } else if ('webkitPreservesPitch' in this.audio) {
            this.audio.webkitPreservesPitch = false;
        }

        this.audio.playbackRate = rate;
    }

    /**
     * Synchronizes all LEDs, Strobe Lights, Pitch Cap, and Header Telemetry
     */
    syncHardwareUI() {
        const led33 = document.getElementById('led-rpm-33');
        const led45 = document.getElementById('led-rpm-45');
        const btn33 = document.getElementById('btn-rpm-33');
        const btn45 = document.getElementById('btn-rpm-45');
        const strobeEmitter = document.getElementById('strobe-emitter-led');
        const strobeGlow = document.getElementById('sl-strobe-glow');
        const targetBtn = document.getElementById('btn-stylus-light');
        const targetGlow = document.getElementById('sl-target-glow');
        const ledX2 = document.getElementById('led-pitch-x2');
        const ledZero = document.getElementById('led-pitch-zero');
        const pitchCap = document.getElementById('sl-pitch-cap');
        const rpmReadout = document.getElementById('sl-rpm-readout');
        const stateBadge = document.getElementById('scratch-state-badge');

        const is45 = Math.abs(this.baseRpm - 45.0) < 0.5;
        if (led33) led33.classList.toggle('on', this.powerOn && !is45);
        if (led45) led45.classList.toggle('on', this.powerOn && is45);
        if (btn33) btn33.classList.toggle('active', !is45);
        if (btn45) btn45.classList.toggle('active', is45);

        if (strobeEmitter) strobeEmitter.classList.toggle('on', this.powerOn);
        if (strobeGlow) strobeGlow.classList.toggle('off', !this.powerOn);

        if (targetBtn) targetBtn.classList.toggle('on', this.powerOn && this.targetLightOn);
        if (targetGlow) targetGlow.classList.toggle('off', !(this.powerOn && this.targetLightOn));

        if (ledX2) ledX2.classList.toggle('on', this.powerOn && this.pitchRange === 16);
        if (ledZero) ledZero.classList.toggle('on', this.powerOn && Math.abs(this.pitchPct) < 0.05);

        // Vertical Pitch Knob Cap Position (-pitchRange..+pitchRange mapped to 12%..88%)
        if (pitchCap) {
            const norm = (this.pitchPct + this.pitchRange) / (this.pitchRange * 2);
            const topPct = 12 + norm * 76;
            pitchCap.style.top = `${topPct}%`;
        }

        if (rpmReadout) {
            const sign = this.pitchPct > 0 ? '+' : '';
            const lockText = Math.abs(this.pitchPct) < 0.05 ? 'QUARTZ LOCK' : `PITCH ${sign}${this.pitchPct.toFixed(1)}%`;
            rpmReadout.textContent = `${is45 ? '45.0' : '33.3'} RPM // ${lockText}`;
        }

        if (stateBadge && !this.isHandOnVinyl) {
            stateBadge.textContent = this.motorRunning ? 'DIRECT DRIVE: LOCKED' : 'MOTOR: STANDBY';
        }
    }

    /**
     * 60FPS Direct-Drive Motor Physics, Tonearm Tracking & Scratch Scope Loop
     */
    startPhysicsAndRenderLoop() {
        const vinyl = document.getElementById('sl-vinyl-disc');
        const tonearm = document.getElementById('tonearm-pivot-group');
        const canvas = document.getElementById('sl-scratch-canvas');
        const ctx2d = canvas ? canvas.getContext('2d') : null;
        const freqData = new Uint8Array(128);
        const timeData = new Uint8Array(128);

        let lastFrameTime = performance.now();

        const loop = (now) => {
            const dt = Math.min(0.05, Math.max(0.001, (now - lastFrameTime) / 1000));
            lastFrameTime = now;

            // 1. Platter Angular Velocity & Direct-Drive Motor Torque Physics
            if (!this.isHandOnVinyl) {
                const targetRpm = (this.powerOn && this.motorRunning)
                    ? this.baseRpm * (1.0 + this.pitchPct / 100.0)
                    : 0.0;

                // Apply high-torque quartz motor acceleration or smooth power-brake deceleration
                const accelRate = this.powerBrakeActive ? 1.8 : (3.5 + this.torqueFactor * 8.5);
                this.currentRpm += (targetRpm - this.currentRpm) * Math.min(1, accelRate * dt);

                if (Math.abs(this.currentRpm) < 0.05 && targetRpm === 0) {
                    this.currentRpm = 0;
                }

                // Advance platter angle: 1 RPM = 6 degrees per second
                const deltaDeg = this.currentRpm * 6.0 * dt;
                this.platterAngle = (this.platterAngle + deltaDeg) % 360;
                if (vinyl) {
                    vinyl.style.transform = `rotate(${this.platterAngle.toFixed(2)}deg)`;
                }

                // If motor is coasting down during Power Brake, smoothly lower audio playbackRate
                if (!this.audio.paused && !this.motorRunning && this.currentRpm > 0.5) {
                    this.audio.playbackRate = Math.max(0.15, this.currentRpm / 33.333);
                } else if (!this.audio.paused && !this.motorRunning && this.currentRpm <= 0.5) {
                    this.audio.pause();
                }
            }

            // 2. Modulate Vinyl Dust Crackle proportional to platter rotation speed
            if (this.crackleGain && this.ctx) {
                const crackleSlider = document.getElementById('sl-crackle-vol');
                const userCrackle = crackleSlider ? parseInt(crackleSlider.value, 10) / 100 : 0.28;
                const speedFactor = Math.min(1.4, Math.abs(this.currentRpm) / 33.333);
                this.crackleGain.gain.setTargetAtTime(userCrackle * speedFactor * 0.25, this.ctx.currentTime, 0.03);
            }

            // 3. Update S-Shaped Gimbal Tonearm Angle across the Vinyl Grooves
            if (tonearm) {
                const dur = this.audio.duration || 180;
                const curT = this.isHandOnVinyl ? this.virtualTime : (this.audio.currentTime || this.virtualTime);
                const progress = Math.max(0, Math.min(1, curT / dur));
                // Pivots from 15.5 deg (outer lead-in groove) to 27.5 deg (inner run-out groove)
                const armAngle = (this.motorRunning || this.isHandOnVinyl)
                    ? (15.5 + progress * 12.0)
                    : 8.5;
                tonearm.style.transform = `rotate(${armAngle.toFixed(2)}deg)`;
            }

            // 4. Update Telemetry HUD
            const hudAngle = document.getElementById('hud-angle-deg');
            const hudVel = document.getElementById('hud-velocity-rpm');
            const hudPos = document.getElementById('hud-time-pos');
            if (hudAngle) {
                const normAng = ((this.platterAngle % 360) + 360) % 360;
                hudAngle.textContent = `ANGLE: ${normAng.toFixed(0)}°`;
            }
            if (hudVel) {
                hudVel.textContent = `VEL: ${this.currentRpm >= 0 ? '+' : ''}${this.currentRpm.toFixed(1)} RPM`;
            }
            if (hudPos) {
                const t = this.isHandOnVinyl ? this.virtualTime : (this.audio.currentTime || 0);
                const mins = Math.floor(t / 60);
                const secs = (t % 60).toFixed(1).padStart(4, '0');
                hudPos.textContent = `POS: ${String(mins).padStart(2, '0')}:${secs}`;
            }

            // 5. Render Scratch Velocity & Groove Oscilloscope Canvas
            if (ctx2d && canvas) {
                this.drawScratchScope(ctx2d, canvas.width, canvas.height, freqData, timeData);
            }

            requestAnimationFrame(loop);
        };

        requestAnimationFrame(loop);
    }

    drawScratchScope(ctx2d, w, h, freqData, timeData) {
        ctx2d.fillStyle = '#07080b';
        ctx2d.fillRect(0, 0, w, h);

        // Stroboscopic Grid Lines
        ctx2d.strokeStyle = 'rgba(148, 163, 184, 0.08)';
        ctx2d.lineWidth = 1;
        for (let x = 0; x < w; x += 28) {
            ctx2d.beginPath();
            ctx2d.moveTo(x, 0);
            ctx2d.lineTo(x, h);
            ctx2d.stroke();
        }

        if (this.analyser && (!this.audio.paused || this.isHandOnVinyl)) {
            this.analyser.getByteFrequencyData(freqData);
            this.analyser.getByteTimeDomainData(timeData);
        } else {
            for (let i = 0; i < 64; i++) {
                freqData[i] = 8;
                timeData[i] = 128;
            }
        }

        // Draw Red Stroboscopic Frequency Bars
        const bars = 32;
        const barW = (w - 20) / bars;
        for (let i = 0; i < bars; i++) {
            const val = freqData[i * 2] / 255;
            const barH = val * (h - 34);
            ctx2d.fillStyle = this.isHandOnVinyl ? '#facc15' : '#ef4444';
            ctx2d.fillRect(10 + i * barW, h - 8 - barH, barW - 3, barH);
        }

        // Draw Stylus Groove Waveform Overlay
        ctx2d.lineWidth = 2;
        ctx2d.strokeStyle = this.isHandOnVinyl ? '#38bdf8' : '#f8fafc';
        ctx2d.beginPath();
        for (let i = 0; i < 64; i++) {
            const x = (i / 63) * w;
            const y = (timeData[i] / 255) * (h - 20) + 10;
            if (i === 0) ctx2d.moveTo(x, y);
            else ctx2d.lineTo(x, y);
        }
        ctx2d.stroke();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.technicsEngine = new TechnicsSL1200Engine();
});
