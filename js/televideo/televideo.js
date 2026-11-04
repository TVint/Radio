/**
 * RADIOFAX // TELEVIDEO ARCHIVE - WEB AUDIO API LOGIC (js/televideo/televideo.js)
 * Pure Vanilla JS | Zero External Dependencies
 */

(() => {
    'use strict';

    const CONFIG = {
        fftSize: 256,
        smoothingTimeConstant: 0.76,
        vuTotalChars: 15,
        charFull: '█',
        charEmpty: '▒'
    };

    const state = {
        audioCtx: null,
        mediaSource: null,
        analyser: null,
        freqData: null,
        timeData: null,
        rafId: null,
        isPlaying: false,
        usingSynthFallback: false,
        synthTimer: null,
        synthStep: 0,
        synthStartTime: 0,
        activeRow: null
    };

    const audioEl       = document.getElementById('core-player');
    const statusEl      = document.getElementById('tx-status');
    const trackTimeEl   = document.getElementById('track-time');
    const clockEl       = document.getElementById('tx-clock');
    const marqueeEl     = document.getElementById('tx-marquee');
    const vcrVuEl       = document.getElementById('vcr-vu');
    const dbReadoutEl   = document.getElementById('db-readout');
    const oscPathEl     = document.getElementById('osc-path');
    const diagValEl     = document.getElementById('diag-val');
    const signalModeEl  = document.getElementById('signal-mode');
    const footerStateEl = document.getElementById('footer-state');
    const activePageEl  = document.getElementById('active-page-num');
    const logoMixEl     = document.getElementById('logo-mix');

    const ledEls    = Array.from(document.querySelectorAll('#led-strip .led'));
    const indexRows = Array.from(document.querySelectorAll('.index-row'));

    const btnPlay  = document.getElementById('btn-play');
    const btnStop  = document.getElementById('btn-stop');
    const btnNext  = document.getElementById('btn-next');
    const btnSynth = document.getElementById('btn-synth');

    function initAudioEngine() {
        if (!state.audioCtx) {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            state.audioCtx = new AudioContextClass();

            state.analyser = state.audioCtx.createAnalyser();
            state.analyser.fftSize = CONFIG.fftSize;
            state.analyser.smoothingTimeConstant = CONFIG.smoothingTimeConstant;

            state.freqData = new Uint8Array(state.analyser.frequencyBinCount);
            state.timeData = new Uint8Array(state.analyser.fftSize);

            try {
                state.mediaSource = state.audioCtx.createMediaElementSource(audioEl);
                state.mediaSource.connect(state.analyser);
            } catch (e) {
                console.warn('[RADIOFAX] MediaElementSource fallback to synth bus.');
            }

            state.analyser.connect(state.audioCtx.destination);
        }

        if (state.audioCtx.state === 'suspended') {
            state.audioCtx.resume();
        }
    }

    function startPirateSynth(bpm = 130, rootFreq = 55) {
        stopPirateSynth();
        initAudioEngine();

        state.usingSynthFallback = true;
        state.synthStartTime = state.audioCtx.currentTime;
        state.synthStep = 0;

        const stepDurationMs = ((60 / bpm) / 4) * 1000;
        const bassMultipliers = [1, 1, 1.5, 1, 1.2, 1, 1.8, 1.5];

        state.synthTimer = setInterval(() => {
            if (!state.isPlaying || !state.audioCtx) return;
            const now = state.audioCtx.currentTime;
            const step = state.synthStep % 16;

            if (step % 4 === 0) {
                const kickOsc = state.audioCtx.createOscillator();
                const kickGain = state.audioCtx.createGain();
                kickOsc.type = 'sine';
                kickOsc.frequency.setValueAtTime(150, now);
                kickOsc.frequency.exponentialRampToValueAtTime(38, now + 0.14);

                kickGain.gain.setValueAtTime(0.95, now);
                kickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

                kickOsc.connect(kickGain);
                kickGain.connect(state.analyser);
                kickOsc.start(now);
                kickOsc.stop(now + 0.23);
            }

            if (step % 2 === 1 || step === 2 || step === 14) {
                const bassOsc = state.audioCtx.createOscillator();
                const filter = state.audioCtx.createBiquadFilter();
                const bassGain = state.audioCtx.createGain();

                bassOsc.type = 'sawtooth';
                const mult = bassMultipliers[step % bassMultipliers.length];
                bassOsc.frequency.setValueAtTime(rootFreq * mult, now);

                filter.type = 'lowpass';
                filter.Q.value = 9;
                filter.frequency.setValueAtTime(280 + ((step % 5) * 320), now);
                filter.frequency.exponentialRampToValueAtTime(110, now + 0.12);

                bassGain.gain.setValueAtTime(0.35, now);
                bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);

                bassOsc.connect(filter);
                filter.connect(bassGain);
                bassGain.connect(state.analyser);
                bassOsc.start(now);
                bassOsc.stop(now + 0.14);
            }

            state.synthStep++;
            syncTrackTimer();
        }, stepDurationMs);
    }

    function stopPirateSynth() {
        if (state.synthTimer) {
            clearInterval(state.synthTimer);
            state.synthTimer = null;
        }
        state.usingSynthFallback = false;
    }

    function renderVisuals() {
        if (!state.isPlaying || !state.analyser) return;

        state.analyser.getByteFrequencyData(state.freqData);
        state.analyser.getByteTimeDomainData(state.timeData);

        let sum = 0;
        const binCount = state.freqData.length;
        for (let i = 0; i < binCount; i++) {
            sum += state.freqData[i];
        }
        const avgVolume = sum / binCount;
        const bassEnergy = (state.freqData[0] + state.freqData[1] + state.freqData[2] + state.freqData[3]) / 4;
        const peakNorm = Math.min(1, Math.max(avgVolume / 135, (bassEnergy / 255) * 0.92));

        const litLeds = Math.round(peakNorm * ledEls.length);
        for (let i = 0; i < ledEls.length; i++) {
            const led = ledEls[i];
            const ratio = (i + 1) / ledEls.length;
            const isActive = i < litLeds;

            led.classList.toggle('active', isActive);
            led.classList.toggle('lvl-green',  isActive && ratio <= 0.625);
            led.classList.toggle('lvl-yellow', isActive && ratio > 0.625 && ratio <= 0.85);
            led.classList.toggle('lvl-red',    isActive && ratio > 0.85);
        }

        if (vcrVuEl) {
            const fullChars  = Math.round(peakNorm * CONFIG.vuTotalChars);
            const emptyChars = CONFIG.vuTotalChars - fullChars;
            vcrVuEl.textContent =
                CONFIG.charFull.repeat(fullChars) +
                CONFIG.charEmpty.repeat(emptyChars);

            vcrVuEl.className = peakNorm > 0.85 ? 't-red' : (peakNorm > 0.65 ? 't-yel' : 't-grn');
        }

        if (dbReadoutEl) {
            const db = peakNorm > 0.01 ? (20 * Math.log10(peakNorm)).toFixed(1) : '-INF';
            dbReadoutEl.textContent = `${db} dB`;
        }

        if (oscPathEl) {
            const width = 260;
            const height = 54;
            const samples = state.timeData.length;
            const slice = width / (samples - 1);

            let pathString = '';
            for (let i = 0; i < samples; i++) {
                const v = (state.timeData[i] - 128) / 128.0;
                const y = (height / 2) + (v * (height * 0.45));
                const x = i * slice;
                pathString += (i === 0 ? `M ${x.toFixed(1)} ${y.toFixed(1)}` : ` L ${x.toFixed(1)} ${y.toFixed(1)}`);
            }
            oscPathEl.setAttribute('d', pathString);
            oscPathEl.style.stroke = peakNorm > 0.85 ? 'var(--tt-red)' : (peakNorm > 0.65 ? 'var(--tt-yellow)' : 'var(--tt-cyan)');
        }

        if (diagValEl) {
            diagValEl.textContent = String(Math.round((bassEnergy / 255) * 99)).padStart(2, '0');
        }
        if (logoMixEl) {
            const kickHit = bassEnergy > 205;
            logoMixEl.classList.toggle('bg-yel', kickHit);
            logoMixEl.classList.toggle('bg-wht', !kickHit);
        }

        state.rafId = requestAnimationFrame(renderVisuals);
    }

    function resetVisuals() {
        if (state.rafId) {
            cancelAnimationFrame(state.rafId);
            state.rafId = null;
        }
        ledEls.forEach((led) => led.classList.remove('active', 'lvl-green', 'lvl-yellow', 'lvl-red'));
        if (vcrVuEl) {
            vcrVuEl.textContent = CONFIG.charEmpty.repeat(CONFIG.vuTotalChars);
            vcrVuEl.className = 't-grn';
        }
        if (dbReadoutEl) dbReadoutEl.textContent = '-INF dB';
        if (oscPathEl) {
            oscPathEl.setAttribute('d', 'M 0 27 L 260 27');
            oscPathEl.style.stroke = 'var(--tt-cyan)';
        }
        if (diagValEl) diagValEl.textContent = '40';
        if (logoMixEl) {
            logoMixEl.classList.remove('bg-yel');
            logoMixEl.classList.add('bg-wht');
        }
    }

    function formatTime(sec) {
        if (!Number.isFinite(sec) || sec < 0) return '00:00';
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }

    function syncTrackTimer() {
        if (!trackTimeEl) return;
        if (state.usingSynthFallback && state.audioCtx) {
            const elapsed = state.audioCtx.currentTime - state.synthStartTime;
            trackTimeEl.textContent = `${formatTime(elapsed)} / LIVE`;
        } else {
            trackTimeEl.textContent = `${formatTime(audioEl.currentTime)} / ${formatTime(audioEl.duration || 2700)}`;
        }
    }

    function setUIState(mode, trackTitle = 'TECHNO SET', pageCode = '100') {
        const isLive = mode === 'ON AIR';

        if (statusEl) {
            statusEl.textContent = `P${pageCode} RADIOFAX 1 ${mode}`;
            statusEl.classList.toggle('bg-red', isLive);
            statusEl.classList.toggle('t-wht', isLive);
            statusEl.classList.toggle('blink', isLive);
        }

        if (activePageEl) activePageEl.textContent = pageCode;
        if (signalModeEl) signalModeEl.textContent = isLive ? (state.usingSynthFallback ? '[SYNTH LIVE]' : '[MP3 STREAM]') : `[${mode}]`;
        if (footerStateEl) footerStateEl.textContent = isLive ? `ON AIR // ${trackTitle}` : `AUDIO: ${mode}`;
        if (btnPlay) {
            btnPlay.innerHTML = isLive ? `<span class="t-wht">❚❚ PAUSE</span> 100` : `<span class="t-wht">► PLAY</span> 100`;
        }

        if (marqueeEl) {
            if (isLive) {
                marqueeEl.textContent = `*** ON AIR [P${pageCode}]: ${trackTitle} *** WEB AUDIO API ANALYSER ACTIVE *** REAL-TIME TELETEXT TELEMETRY ***`;
            } else if (mode === 'PAUSED') {
                marqueeEl.textContent = `*** TRANSMISSION PAUSED [P${pageCode}]: ${trackTitle} *** PRESS PLAY [100] TO RESUME ***`;
            } else {
                marqueeEl.textContent = `*** STANDBY // CLICK ANY ARCHIVE MIXTAPE ROW OR PRESS PLAY [100] TO START PIRATE TRANSMISSION ***`;
            }
        }
    }

    async function playTrack(rowEl = null, forceSynth = false) {
        initAudioEngine();

        const targetRow = rowEl || state.activeRow || indexRows[0];
        if (state.activeRow && state.activeRow !== targetRow) {
            state.activeRow.classList.remove('active');
        }
        state.activeRow = targetRow;
        state.activeRow.classList.add('active');

        const title = targetRow.querySelector('.cat')?.textContent.trim() || 'PIRATE MIX';
        const page  = targetRow.querySelector('.page')?.textContent.trim() || '100';
        const bpm   = Number(targetRow.dataset.bpm)  || 130;
        const freq  = Number(targetRow.dataset.freq) || 55;

        if (!forceSynth) {
            try {
                stopPirateSynth();
                await audioEl.play();
                state.isPlaying = true;
                setUIState('ON AIR', title, page);
                if (!state.rafId) state.rafId = requestAnimationFrame(renderVisuals);
                return;
            } catch (err) {
                console.info('[RADIOFAX] Using built-in Web Audio Synth Engine.');
            }
        }

        audioEl.pause();
        state.isPlaying = true;
        startPirateSynth(bpm, freq);
        setUIState('ON AIR', `${title} (${bpm} BPM)`, page);
        if (!state.rafId) state.rafId = requestAnimationFrame(renderVisuals);
    }

    function pauseTrack() {
        audioEl.pause();
        stopPirateSynth();
        state.isPlaying = false;
        resetVisuals();
        const title = state.activeRow?.querySelector('.cat')?.textContent.trim() || 'ARCHIVE';
        const page  = state.activeRow?.querySelector('.page')?.textContent.trim() || '100';
        setUIState('PAUSED', title, page);
    }

    function stopTrack() {
        audioEl.pause();
        audioEl.currentTime = 0;
        stopPirateSynth();
        state.isPlaying = false;
        resetVisuals();

        if (state.activeRow) {
            state.activeRow.classList.remove('active');
            state.activeRow = null;
        }
        if (state.audioCtx && state.audioCtx.state === 'running') {
            state.audioCtx.suspend();
        }
        syncTrackTimer();
        setUIState('STANDBY');
    }

    indexRows.forEach((row) => {
        row.addEventListener('click', () => {
            if (state.activeRow === row && state.isPlaying) {
                pauseTrack();
            } else {
                playTrack(row, false);
            }
        });
    });

    btnPlay?.addEventListener('click', () => {
        if (state.isPlaying) {
            pauseTrack();
        } else {
            playTrack(state.activeRow || indexRows[0], false);
        }
    });

    btnStop?.addEventListener('click', stopTrack);

    btnNext?.addEventListener('click', () => {
        const currentIdx = state.activeRow ? indexRows.indexOf(state.activeRow) : -1;
        const nextRow = indexRows[(currentIdx + 1) % indexRows.length];
        playTrack(nextRow, state.usingSynthFallback);
    });

    btnSynth?.addEventListener('click', () => {
        const row = state.activeRow || indexRows[4];
        playTrack(row, true);
    });

    audioEl.addEventListener('timeupdate', syncTrackTimer);
    audioEl.addEventListener('loadedmetadata', syncTrackTimer);
    audioEl.addEventListener('ended', stopTrack);

    const DAYS = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
    const MONTHS = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
    function tickClock() {
        if (!clockEl) return;
        const d = new Date();
        clockEl.textContent =
            `${DAYS[d.getDay()]} ${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]} ` +
            `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}/${String(d.getSeconds()).padStart(2, '0')}`;
    }
    setInterval(tickClock, 1000);
    tickClock();
})();
