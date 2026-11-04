/**
 * SHARP GF-9494 // STEREO AUDIO ENGINE (js/boombox/audio-engine.js)
 * Dual-channel Web Audio API graph:
 * [Source] -> [ChannelSplitter] -> [Left Analyser]  -> Left Needle
 *                              -> [Right Analyser] -> Right Needle
 *                              -> [Bass Filter]    -> Woofer Bumping
 *                              -> [Master Destination]
 */

export class BoomboxAudioEngine {
    constructor(audioElement) {
        this.audioEl = audioElement;
        this.ctx = null;
        this.sourceNode = null;
        this.splitter = null;
        this.analyserL = null;
        this.analyserR = null;
        this.bassFilter = null;
        this.bassAnalyser = null;

        this.dataL = null;
        this.dataR = null;
        this.bassData = null;

        this.isPlaying = false;
        this.currentTrackIndex = 0;
        this.usingSynth = false;
        this.synthTimer = null;
        this.synthStep = 0;

        // 7 APLD Mixtape programs
        this.tracks = [
            { id: 1, title: 'BALEARIC SUNSET // 118 BPM', bpm: 118, freq: 52 },
            { id: 2, title: 'DETROIT ACID TECHNO // 132 BPM', bpm: 132, freq: 62 },
            { id: 3, title: '90S RAVE REWIND // 138 BPM', bpm: 138, freq: 70 },
            { id: 4, title: 'VAPOR CASSETTE DUB // 105 BPM', bpm: 105, freq: 44 },
            { id: 5, title: 'JESOLO LAKESIDE BEATS // 124 BPM', bpm: 124, freq: 55 },
            { id: 6, title: 'GLITCH ART TRANSMISSION // 142 BPM', bpm: 142, freq: 82 },
            { id: 7, title: 'REBRUNCH CLOSING TALK // 120 BPM', bpm: 120, freq: 48 }
        ];
    }

    init() {
        if (this.ctx) {
            if (this.ctx.state === 'suspended') this.ctx.resume();
            return;
        }

        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioCtx();

        // Dual Channel Splitter for true Left/Right analog needles
        this.splitter = this.ctx.createChannelSplitter(2);

        this.analyserL = this.ctx.createAnalyser();
        this.analyserR = this.ctx.createAnalyser();
        this.analyserL.fftSize = 128;
        this.analyserR.fftSize = 128;
        this.analyserL.smoothingTimeConstant = 0.72;
        this.analyserR.smoothingTimeConstant = 0.72;

        this.dataL = new Uint8Array(this.analyserL.frequencyBinCount);
        this.dataR = new Uint8Array(this.analyserR.frequencyBinCount);

        // Dedicated Sub-Bass Filter to drive physical woofer excursion
        this.bassFilter = this.ctx.createBiquadFilter();
        this.bassFilter.type = 'lowpass';
        this.bassFilter.frequency.value = 160;

        this.bassAnalyser = this.ctx.createAnalyser();
        this.bassAnalyser.fftSize = 64;
        this.bassData = new Uint8Array(this.bassAnalyser.frequencyBinCount);

        // Connect media element
        try {
            this.sourceNode = this.ctx.createMediaElementSource(this.audioEl);
            this.sourceNode.connect(this.splitter);
            this.sourceNode.connect(this.bassFilter);
            this.sourceNode.connect(this.ctx.destination);

            this.splitter.connect(this.analyserL, 0); // Left channel
            this.splitter.connect(this.analyserR, 1); // Right channel
            this.bassFilter.connect(this.bassAnalyser);
        } catch (e) {
            console.warn('[BOOMBOX] MediaElement restricted, using built-in stereo synth bus.');
        }
    }

    /**
     * Mechanical clunk sound of tape deck keys
     */
    playMechanicalClunk() {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(120, now);
        osc.frequency.exponentialRampToValueAtTime(30, now + 0.08);

        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.09);
    }

    /**
     * Radio static tuning noise when moving dial
     */
    playTuningStatic() {
        if (!this.ctx) return;
        const bufferSize = this.ctx.sampleRate * 0.15;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const output = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            output[i] = Math.random() * 2 - 1;
        }
        const whiteNoise = this.ctx.createBufferSource();
        whiteNoise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 1400;
        filter.Q.value = 4;

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.18, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.14);

        whiteNoise.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);
        whiteNoise.start();
    }

    /**
     * Real-time 4/4 Stereo Synthesizer with panning and acid bass
     */
    startStereoSynth(bpm = 124, rootFreq = 55) {
        this.stopStereoSynth();
        this.init();

        this.usingSynth = true;
        this.synthStep = 0;
        const stepMs = ((60 / bpm) / 4) * 1000;

        this.synthTimer = setInterval(() => {
            if (!this.isPlaying || !this.ctx) return;
            const now = this.ctx.currentTime;
            const step = this.synthStep % 16;

            // 1. Kick drum (Center)
            if (step % 4 === 0) {
                const kickOsc = this.ctx.createOscillator();
                const kickGain = this.ctx.createGain();
                kickOsc.type = 'sine';
                kickOsc.frequency.setValueAtTime(140, now);
                kickOsc.frequency.exponentialRampToValueAtTime(36, now + 0.16);

                kickGain.gain.setValueAtTime(0.95, now);
                kickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

                kickOsc.connect(kickGain);
                this._routeToAnalysisAndMaster(kickGain, 0);
                kickOsc.start(now);
                kickOsc.stop(now + 0.23);
            }

            // 2. Off-beat Bassline (Alternating Left/Right for dual needle bounce!)
            if (step % 2 === 1 || step === 2 || step === 14) {
                const bassOsc = this.ctx.createOscillator();
                const filter = this.ctx.createBiquadFilter();
                const bassGain = this.ctx.createGain();

                bassOsc.type = 'sawtooth';
                const notes = [1, 1.25, 1.5, 1, 1.8, 1.33, 1.5, 2];
                bassOsc.frequency.setValueAtTime(rootFreq * notes[step % notes.length], now);

                filter.type = 'lowpass';
                filter.Q.value = 8;
                filter.frequency.setValueAtTime(260 + (step * 85), now);
                filter.frequency.exponentialRampToValueAtTime(110, now + 0.14);

                bassGain.gain.setValueAtTime(0.4, now);
                bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

                const pan = (step % 4 === 1) ? -0.7 : 0.7;
                bassOsc.connect(filter);
                filter.connect(bassGain);
                this._routeToAnalysisAndMaster(bassGain, pan);
                bassOsc.start(now);
                bassOsc.stop(now + 0.16);
            }

            this.synthStep++;
        }, stepMs);
    }

    stopStereoSynth() {
        if (this.synthTimer) {
            clearInterval(this.synthTimer);
            this.synthTimer = null;
        }
        this.usingSynth = false;
    }

    _routeToAnalysisAndMaster(sourceGain, pan = 0) {
        if (!this.ctx) return;
        const panner = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
        if (panner) {
            panner.pan.value = pan;
            sourceGain.connect(panner);
            panner.connect(this.splitter);
            panner.connect(this.bassFilter);
            panner.connect(this.ctx.destination);
        } else {
            sourceGain.connect(this.splitter);
            sourceGain.connect(this.bassFilter);
            sourceGain.connect(this.ctx.destination);
        }
    }

    async play(trackIndex = 0) {
        this.init();
        this.playMechanicalClunk();
        this.currentTrackIndex = Math.max(0, Math.min(this.tracks.length - 1, trackIndex));
        const trk = this.tracks[this.currentTrackIndex];

        try {
            await this.audioEl.play();
            this.isPlaying = true;
            this.stopStereoSynth();
            return trk;
        } catch {
            this.isPlaying = true;
            this.startStereoSynth(trk.bpm, trk.freq);
            return trk;
        }
    }

    pause() {
        this.playMechanicalClunk();
        this.audioEl.pause();
        this.stopStereoSynth();
        this.isPlaying = false;
    }

    stop() {
        this.playMechanicalClunk();
        this.audioEl.pause();
        this.audioEl.currentTime = 0;
        this.stopStereoSynth();
        this.isPlaying = false;
    }

    getTelemetry() {
        if (!this.analyserL || !this.analyserR) {
            return { leftNorm: 0, rightNorm: 0, bassNorm: 0 };
        }
        this.analyserL.getByteFrequencyData(this.dataL);
        this.analyserR.getByteFrequencyData(this.dataR);
        this.bassAnalyser.getByteFrequencyData(this.bassData);

        let sumL = 0;
        let sumR = 0;
        let sumBass = 0;
        for (let i = 0; i < this.dataL.length; i++) sumL += this.dataL[i];
        for (let i = 0; i < this.dataR.length; i++) sumR += this.dataR[i];
        for (let i = 0; i < this.bassData.length; i++) sumBass += this.bassData[i];

        const avgL = sumL / this.dataL.length;
        const avgR = sumR / this.dataR.length;
        const avgBass = sumBass / this.bassData.length;

        return {
            leftNorm:  Math.min(1, avgL / 140),
            rightNorm: Math.min(1, avgR / 140),
            bassNorm:  Math.min(1, avgBass / 170)
        };
    }
}
