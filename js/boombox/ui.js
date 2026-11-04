/**
 * SHARP GF-9494 // BOOMBOX UI CONTROLLER (js/boombox/ui.js)
 * Real-time analog needle deflection, tape counter, woofer bump,
 * tuning dial interaction, and APLD program switcher.
 */

import { BoomboxAudioEngine } from './audio-engine.js';

document.addEventListener('DOMContentLoaded', () => {
    const audioEl = document.getElementById('boombox-audio');
    const engine = new BoomboxAudioEngine(audioEl);

    // DOM References
    const needleL = document.getElementById('needle-left');
    const needleR = document.getElementById('needle-right');
    const ledPower = document.getElementById('led-power');
    const ledStereo = document.getElementById('led-stereo');
    const ledMixing = document.getElementById('led-mixing');

    const wooferLeft = document.getElementById('woofer-left-cone');
    const wooferRight = document.getElementById('woofer-right-cone');
    const tapeReels = Array.from(document.querySelectorAll('.tape-reel'));
    const counterDigits = document.getElementById('counter-digits');
    const btnCounterReset = document.getElementById('btn-counter-reset');
    const cassetteLabel = document.getElementById('cassette-track-title');

    const btnPlay  = document.getElementById('btn-bb-play');
    const btnStop  = document.getElementById('btn-bb-stop');
    const btnPause = document.getElementById('btn-bb-pause');
    const btnRew   = document.getElementById('btn-bb-rew');
    const btnFf    = document.getElementById('btn-bb-ff');
    const btnRec   = document.getElementById('btn-bb-rec');

    const apldBtns = Array.from(document.querySelectorAll('.apld-btn'));
    const tunerWindow = document.getElementById('tuner-window');
    const tunerNeedle = document.getElementById('tuner-needle');

    let counterValue = 0;
    let counterInterval = null;
    let rafId = null;

    // ------------------------------------------------------------------------
    // 1. DUAL ANALOG NEEDLES & WOOFER PUMP (60fps requestAnimationFrame)
    // ------------------------------------------------------------------------
    function updateVisuals() {
        if (!engine.isPlaying) return;

        const { leftNorm, rightNorm, bassNorm } = engine.getTelemetry();

        // Map 0..1 to -34deg .. +26deg
        const degL = -34 + (leftNorm * 60);
        const degR = -34 + (rightNorm * 60);

        if (needleL) needleL.style.transform = `rotate(${degL.toFixed(1)}deg)`;
        if (needleR) needleR.style.transform = `rotate(${degR.toFixed(1)}deg)`;

        // Woofer excursion: physical bump on kick & sub-bass
        const scale = 1 + (bassNorm * 0.055);
        if (wooferLeft)  wooferLeft.style.transform  = `scale(${scale.toFixed(3)})`;
        if (wooferRight) wooferRight.style.transform = `scale(${scale.toFixed(3)})`;

        // Peak red flash on mixing LED
        if (ledMixing) {
            ledMixing.classList.toggle('on', bassNorm > 0.85);
        }

        rafId = requestAnimationFrame(updateVisuals);
    }

    function resetVisuals() {
        if (rafId) {
            cancelAnimationFrame(rafId);
            rafId = null;
        }
        if (needleL) needleL.style.transform = 'rotate(-34deg)';
        if (needleR) needleR.style.transform = 'rotate(-34deg)';
        if (wooferLeft)  wooferLeft.style.transform  = 'scale(1)';
        if (wooferRight) wooferRight.style.transform = 'scale(1)';
        if (ledStereo) ledStereo.classList.remove('on');
        if (ledMixing) ledMixing.classList.remove('on');
        tapeReels.forEach(r => r.classList.remove('spinning'));
    }

    // ------------------------------------------------------------------------
    // 2. MECHANICAL TAPE COUNTER [000]
    // ------------------------------------------------------------------------
    function startCounter() {
        stopCounter();
        counterInterval = setInterval(() => {
            if (!engine.isPlaying) return;
            counterValue = (counterValue + 1) % 1000;
            if (counterDigits) {
                counterDigits.textContent = String(counterValue).padStart(3, '0');
            }
        }, 1000);
    }

    function stopCounter() {
        if (counterInterval) {
            clearInterval(counterInterval);
            counterInterval = null;
        }
    }

    btnCounterReset?.addEventListener('click', () => {
        engine.playMechanicalClunk();
        counterValue = 0;
        if (counterDigits) counterDigits.textContent = '000';
    });

    // ------------------------------------------------------------------------
    // 3. TRANSPORT CONTROLS (PLAY, STOP, PAUSE, REW, FF)
    // ------------------------------------------------------------------------
    async function handlePlay(trackIndex = 0) {
        const trk = await engine.play(trackIndex);
        btnPlay?.classList.add('active');
        btnPause?.classList.remove('pressed');

        tapeReels.forEach(r => r.classList.add('spinning'));
        if (ledPower) ledPower.classList.add('on');
        if (ledStereo) ledStereo.classList.add('on');
        if (cassetteLabel) cassetteLabel.textContent = trk.title;

        // Highlight active APLD button
        apldBtns.forEach((b, i) => b.classList.toggle('active', i === trackIndex));

        startCounter();
        if (!rafId) rafId = requestAnimationFrame(updateVisuals);
    }

    function handlePause() {
        engine.pause();
        btnPlay?.classList.remove('active');
        btnPause?.classList.add('pressed');
        tapeReels.forEach(r => r.classList.remove('spinning'));
        stopCounter();
        resetVisuals();
    }

    function handleStop() {
        engine.stop();
        btnPlay?.classList.remove('active');
        btnPause?.classList.remove('pressed');
        btnRec?.classList.remove('pressed');
        stopCounter();
        resetVisuals();
    }

    btnPlay?.addEventListener('click', () => {
        if (!engine.isPlaying) handlePlay(engine.currentTrackIndex);
    });

    btnPause?.addEventListener('click', () => {
        if (engine.isPlaying) handlePause();
        else handlePlay(engine.currentTrackIndex);
    });

    btnStop?.addEventListener('click', handleStop);

    btnRew?.addEventListener('click', () => {
        engine.playMechanicalClunk();
        const prev = (engine.currentTrackIndex - 1 + engine.tracks.length) % engine.tracks.length;
        handlePlay(prev);
    });

    btnFf?.addEventListener('click', () => {
        engine.playMechanicalClunk();
        const next = (engine.currentTrackIndex + 1) % engine.tracks.length;
        handlePlay(next);
    });

    btnRec?.addEventListener('click', () => {
        engine.playMechanicalClunk();
        btnRec.classList.toggle('pressed');
        if (!engine.isPlaying) handlePlay(0);
    });

    // ------------------------------------------------------------------------
    // 4. APLD SYSTEM (AUTO PROGRAM LOCATE DEVICE BUTTONS 1-7)
    // ------------------------------------------------------------------------
    apldBtns.forEach((btn, idx) => {
        btn.addEventListener('click', () => {
            handlePlay(idx);
        });
    });

    // ------------------------------------------------------------------------
    // 5. INTERACTIVE ANALOG RADIO TUNING DIAL
    // ------------------------------------------------------------------------
    let isTuning = false;
    function updateTunerFromEvent(e) {
        if (!tunerWindow || !tunerNeedle) return;
        const rect = tunerWindow.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const ratio = Math.max(0.04, Math.min(0.96, (clientX - rect.left) / rect.width));
        tunerNeedle.style.left = `${(ratio * 100).toFixed(1)}%`;

        engine.playTuningStatic();

        const targetTrackIdx = Math.floor(ratio * engine.tracks.length);
        if (targetTrackIdx !== engine.currentTrackIndex && engine.isPlaying) {
            handlePlay(targetTrackIdx);
        }
    }

    tunerWindow?.addEventListener('pointerdown', (e) => {
        isTuning = true;
        updateTunerFromEvent(e);
    });
    window.addEventListener('pointermove', (e) => {
        if (isTuning) updateTunerFromEvent(e);
    });
    window.addEventListener('pointerup', () => { isTuning = false; });

    // Initialize with Power LED ready
    if (ledPower) ledPower.classList.add('on');
    resetVisuals();
});
