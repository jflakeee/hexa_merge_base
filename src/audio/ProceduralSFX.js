/**
 * @fileoverview Procedural sound effects using Web Audio API.
 * Generates crystal-glass-like tones and various game SFX entirely through synthesis.
 * No external audio files required.
 * ES Module - pure web implementation.
 */

export class ProceduralSFX {
    constructor() {
        /** @type {AudioContext|null} */
        this.audioContext = null;
        /** @type {Object<string, {buffer: AudioBuffer, volume: number}>} */
        this.buffers = {};
        /** @type {boolean} */
        this.muted = false;
    }

    /**
     * Initialize the AudioContext and pre-generate all SFX buffers.
     * MUST be called after a user gesture (pointerdown/click) to comply with
     * autoplay policies on iOS/Chrome.
     */
    init() {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

        // Pre-generate all 13 SFX buffers
        this.createTapSound();
        this.createMergeBasicSound();
        this.createMergeMidSound();
        this.createMergeHighSound();
        this.createMergeUltraSound();
        this.createChainComboSound();
        this.createMilestoneSound();
        this.createCrownChangeSound();
        this.createGameOverSound();
        this.createGameStartSound();
        this.createButtonClickSound();
        this.createTileDropSound();
        this.createNumberUpSound();
    }

    // ----------------------------------------------------------
    // Core synthesis: crystal note
    // ----------------------------------------------------------

    /**
     * Generate a single crystal-glass tone sample.
     * Features: sharp attack, exponential decay, non-integer harmonics,
     * shimmer effect, noise transient, and sub-tone.
     *
     * @param {number} freq - Fundamental frequency in Hz
     * @param {number} duration - Total duration in seconds
     * @param {number} t - Current time in seconds (0..duration)
     * @param {number} p - Normalized progress (0..1)
     * @returns {number} Sample value in range approximately [-1, 1]
     */
    crystalNote(freq, duration, t, p) {
        const sampleRate = 44100;
        const twoPi = Math.PI * 2;

        // --- Envelope ---
        // Attack: 5ms ramp, then exponential decay with factor 3.5
        const attackTime = 0.005;
        let envelope;
        if (t < attackTime) {
            envelope = t / attackTime;
        } else {
            envelope = Math.exp(-3.5 * (t - attackTime) / duration);
        }

        // --- Noise transient (first 3% of duration) ---
        let noise = 0;
        if (p < 0.03) {
            noise = (Math.random() * 2 - 1) * (1 - p / 0.03) * 0.3;
        }

        // --- Fundamental ---
        const fundamental = Math.sin(twoPi * freq * t);

        // --- Non-integer harmonics with differential decay ---
        const h2 = Math.sin(twoPi * freq * 2.76 * t) * 0.35 * Math.exp(-p * 5);
        const h3 = Math.sin(twoPi * freq * 5.4 * t) * 0.15 * Math.exp(-p * 8);
        const h4 = Math.sin(twoPi * freq * 8.93 * t) * 0.06 * Math.exp(-p * 12);

        // --- Shimmering: slightly detuned copy of fundamental ---
        const shimmer = Math.sin(twoPi * freq * 1.003 * t) * 0.2 * Math.exp(-p * 4);

        // --- Sub-tone: one octave below ---
        const subTone = Math.sin(twoPi * freq * 0.5 * t) * 0.12 * Math.exp(-p * 6);

        // Combine all components
        const sample = envelope * (fundamental + h2 + h3 + h4 + shimmer + subTone + noise);
        return sample;
    }

    // ----------------------------------------------------------
    // Buffer creation
    // ----------------------------------------------------------

    /**
     * Create an AudioBuffer from a wave-generating function.
     * @param {string} name - Buffer name for storage and playback
     * @param {number} duration - Duration in seconds
     * @param {function(number, number, number): number} waveFunc - (t, p, sampleRate) => sample
     * @param {number} [volume=1] - Playback volume (stored alongside buffer)
     */
    createBuffer(name, duration, waveFunc, volume = 1) {
        const sampleRate = 44100;
        const length = Math.ceil(sampleRate * duration);
        const buffer = this.audioContext.createBuffer(1, length, sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < length; i++) {
            const t = i / sampleRate;
            const p = i / length; // normalized progress 0..1
            let sample = waveFunc(t, p, sampleRate);
            // Clamp to valid range
            if (sample > 1) sample = 1;
            if (sample < -1) sample = -1;
            data[i] = sample;
        }

        this.buffers[name] = { buffer, volume };
    }

    // ----------------------------------------------------------
    // Playback
    // ----------------------------------------------------------

    /**
     * Play a previously created buffer by name.
     * @param {string} name - The SFX buffer name
     * @param {number} [volume=1] - Volume multiplier (combined with stored volume)
     */
    play(name, volume = 1) {
        if (this.muted) return;
        if (!this.audioContext) return;

        const entry = this.buffers[name];
        if (!entry) return;

        const source = this.audioContext.createBufferSource();
        source.buffer = entry.buffer;

        const gainNode = this.audioContext.createGain();
        gainNode.gain.value = entry.volume * volume;

        source.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        source.start(0);
    }

    /**
     * Set muted state.
     * @param {boolean} muted
     */
    setMuted(muted) {
        this.muted = muted;
    }

    /**
     * @returns {boolean}
     */
    isMuted() {
        return this.muted;
    }

    // ----------------------------------------------------------
    // 13 SFX generators
    // ----------------------------------------------------------

    /** Tap feedback - short E5 crystal ping */
    createTapSound() {
        const freq = 659.25; // E5
        this.createBuffer('tap', 0.07, (t, p) => {
            return this.crystalNote(freq, 0.07, t, p);
        }, 0.5);
    }

    /** Merge basic (2-64) - C5 crystal tone */
    createMergeBasicSound() {
        const freq = 523.25; // C5
        this.createBuffer('mergeBasic', 0.20, (t, p) => {
            return this.crystalNote(freq, 0.20, t, p);
        }, 0.8);
    }

    /** Merge mid (128-512) - E5 crystal tone */
    createMergeMidSound() {
        const freq = 659.25; // E5
        this.createBuffer('mergeMid', 0.20, (t, p) => {
            return this.crystalNote(freq, 0.20, t, p);
        }, 0.8);
    }

    /** Merge high (1024-4096) - G5 crystal tone */
    createMergeHighSound() {
        const freq = 783.99; // G5
        this.createBuffer('mergeHigh', 0.25, (t, p) => {
            return this.crystalNote(freq, 0.25, t, p);
        }, 0.85);
    }

    /** Merge ultra (8192+) - C6 crystal tone */
    createMergeUltraSound() {
        const freq = 1046.5; // C6
        this.createBuffer('mergeUltra', 0.25, (t, p) => {
            return this.crystalNote(freq, 0.25, t, p);
        }, 0.9);
    }

    /** Chain combo - C5->E5->G5 arpeggio */
    createChainComboSound() {
        const freqs = [523.25, 659.25, 783.99]; // C5, E5, G5
        const duration = 0.25;
        this.createBuffer('chainCombo', duration, (t, p) => {
            const noteLen = duration / 3;
            const noteIndex = Math.min(Math.floor(t / noteLen), 2);
            const noteT = t - noteIndex * noteLen;
            const noteP = noteT / noteLen;
            return this.crystalNote(freqs[noteIndex], noteLen, noteT, noteP);
        }, 0.7);
    }

    /** Milestone - C5->E5->G5->C6 ascending arpeggio */
    createMilestoneSound() {
        const freqs = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
        const duration = 0.35;
        this.createBuffer('milestone', duration, (t, p) => {
            const noteLen = duration / 4;
            const noteIndex = Math.min(Math.floor(t / noteLen), 3);
            const noteT = t - noteIndex * noteLen;
            const noteP = noteT / noteLen;
            return this.crystalNote(freqs[noteIndex], noteLen, noteT, noteP);
        }, 0.75);
    }

    /** Crown change - Cmaj7 chord (C5, E5, G5, B5) */
    createCrownChangeSound() {
        const freqs = [523.25, 659.25, 783.99, 987.77]; // C5, E5, G5, B5
        const duration = 0.20;
        this.createBuffer('crownChange', duration, (t, p) => {
            let sum = 0;
            for (let i = 0; i < freqs.length; i++) {
                sum += this.crystalNote(freqs[i], duration, t, p) * 0.25;
            }
            return sum;
        }, 0.85);
    }

    /** Game over - E4->C4->A3 descending tones */
    createGameOverSound() {
        const freqs = [329.63, 261.63, 220.00]; // E4, C4, A3
        const duration = 1.2;
        this.createBuffer('gameOver', duration, (t, p) => {
            const noteLen = duration / 3;
            const noteIndex = Math.min(Math.floor(t / noteLen), 2);
            const noteT = t - noteIndex * noteLen;
            const noteP = noteT / noteLen;
            // Slower, sadder decay for game over
            const freq = freqs[noteIndex];
            const twoPi = Math.PI * 2;

            // Envelope: gentle attack, slow decay
            const attackTime = 0.01;
            let envelope;
            if (noteT < attackTime) {
                envelope = noteT / attackTime;
            } else {
                envelope = Math.exp(-2.0 * (noteT - attackTime) / noteLen);
            }

            const fundamental = Math.sin(twoPi * freq * noteT);
            const h2 = Math.sin(twoPi * freq * 2.76 * noteT) * 0.3 * Math.exp(-noteP * 4);
            const h3 = Math.sin(twoPi * freq * 5.4 * noteT) * 0.1 * Math.exp(-noteP * 7);
            const subTone = Math.sin(twoPi * freq * 0.5 * noteT) * 0.15 * Math.exp(-noteP * 5);

            return envelope * (fundamental + h2 + h3 + subTone);
        }, 1.0);
    }

    /** Game start - C5->E5->G5 ascending bright tones */
    createGameStartSound() {
        const freqs = [523.25, 659.25, 783.99]; // C5, E5, G5
        const duration = 0.30;
        this.createBuffer('gameStart', duration, (t, p) => {
            const noteLen = duration / 3;
            const noteIndex = Math.min(Math.floor(t / noteLen), 2);
            const noteT = t - noteIndex * noteLen;
            const noteP = noteT / noteLen;
            return this.crystalNote(freqs[noteIndex], noteLen, noteT, noteP);
        }, 0.35);
    }

    /** Button click - short C6 crystal ping */
    createButtonClickSound() {
        const freq = 1046.5; // C6
        this.createBuffer('buttonClick', 0.06, (t, p) => {
            return this.crystalNote(freq, 0.06, t, p);
        }, 0.45);
    }

    /** Tile drop - G4 thud with fast decay */
    createTileDropSound() {
        const freq = 392; // G4
        this.createBuffer('tileDrop', 0.10, (t, p) => {
            return this.crystalNote(freq, 0.10, t, p);
        }, 0.55);
    }

    /** Number up - C5->C6 glissando */
    createNumberUpSound() {
        const startFreq = 523.25; // C5
        const endFreq = 1046.5;   // C6
        const duration = 0.15;
        this.createBuffer('numberUp', duration, (t, p) => {
            // Linear frequency glissando
            const freq = startFreq + (endFreq - startFreq) * p;
            return this.crystalNote(freq, duration, t, p);
        }, 0.7);
    }

    // ----------------------------------------------------------
    // Utility
    // ----------------------------------------------------------

    /**
     * Get the appropriate merge SFX name for a given tile value.
     * @param {number} value - The merged tile value
     * @returns {string} SFX buffer name
     */
    getMergeSoundName(value) {
        if (value >= 8192) return 'mergeUltra';
        if (value >= 1024) return 'mergeHigh';
        if (value >= 128) return 'mergeMid';
        return 'mergeBasic';
    }
}
