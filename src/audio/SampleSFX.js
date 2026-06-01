/**
 * @fileoverview Sample-based sound effects — plays real SFX recorded from the
 * XUP benchmark (extracted from the original gameplay capture, no background
 * music present so the clips are clean). Drop-in replacement for ProceduralSFX:
 * same public API (init / play / setMuted / isMuted / getMergeSoundName).
 * Clips live in /audio/sfx/*.wav. See docs/benchmark-vs-impl-diff.md §3.
 * ES Module - pure web implementation.
 */

export class SampleSFX {
    constructor() {
        /** @type {AudioContext|null} */
        this.audioContext = null;
        /** @type {Object<string, AudioBuffer>} */
        this.buffers = {};
        /** @type {boolean} */
        this.muted = false;

        // Distinct recorded clips extracted from the benchmark.
        this._files = {
            tap: 'audio/sfx/tap.wav',
            merge: 'audio/sfx/merge.wav',
            chain: 'audio/sfx/chain.wav',
            celebrate: 'audio/sfx/celebrate.wav',
        };

        // Logical event name -> clip + volume.
        this._map = {
            tap:         { clip: 'tap',   vol: 0.55 },
            buttonClick: { clip: 'tap',   vol: 0.5 },
            tileDrop:    { clip: 'tap',   vol: 0.5 },
            numberUp:    { clip: 'tap',   vol: 0.5 },
            mergeBasic:  { clip: 'merge', vol: 0.85 },
            mergeMid:    { clip: 'merge', vol: 0.9 },
            mergeHigh:   { clip: 'chain', vol: 0.85 },
            mergeUltra:  { clip: 'chain', vol: 0.95 },
            // Per-cascade-level merge tick (pitch raised per step by the caller).
            mergeStep:   { clip: 'merge', vol: 0.6 },
            chainCombo:  { clip: 'chain', vol: 0.9 },
            milestone:   { clip: 'celebrate', vol: 0.85 },
            // Crown move — dramatic: richer chain clip, played deep + loud.
            crownChange: { clip: 'chain', vol: 1.0 },
            // gameStart intentionally silent — the benchmark plays no start sound
            // (landing video is silent; main capture is silent until first tap).
            gameOver:    { clip: 'celebrate', vol: 0.9 },
        };
    }

    /**
     * Initialize the AudioContext and load all clips.
     * MUST be called after a user gesture (autoplay policy).
     */
    init() {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        for (const [name, url] of Object.entries(this._files)) {
            this._load(name, url);
        }
    }

    /**
     * Fetch + decode a clip into an AudioBuffer.
     * @param {string} name
     * @param {string} url
     * @private
     */
    async _load(name, url) {
        try {
            const resp = await fetch(url);
            const data = await resp.arrayBuffer();
            this.buffers[name] = await this.audioContext.decodeAudioData(data);
        } catch (err) {
            // Leave the buffer absent; play() will no-op for it.
            console.warn('SFX load failed:', url, err);
        }
    }

    /**
     * Play an SFX by logical event name.
     * @param {string} name
     * @param {number} [volume=1] - extra multiplier
     * @param {number} [playbackRate=1] - pitch/speed; >1 higher, <1 lower/deeper
     */
    play(name, volume = 1, playbackRate = 1) {
        if (this.muted || !this.audioContext) return;
        const entry = this._map[name];
        if (!entry) return;
        const buffer = this.buffers[entry.clip];
        if (!buffer) return;

        const source = this.audioContext.createBufferSource();
        source.buffer = buffer;
        if (playbackRate !== 1) source.playbackRate.value = playbackRate;
        const gain = this.audioContext.createGain();
        gain.gain.value = entry.vol * volume;
        source.connect(gain);
        gain.connect(this.audioContext.destination);
        source.start(0);
    }

    /** @param {boolean} muted */
    setMuted(muted) { this.muted = muted; }

    /** @returns {boolean} */
    isMuted() { return this.muted; }

    /**
     * Map a merged tile value to a merge SFX name (same tiers as before).
     * @param {number} value
     * @returns {string}
     */
    getMergeSoundName(value) {
        if (value >= 8192) return 'mergeUltra';
        if (value >= 1024) return 'mergeHigh';
        if (value >= 128) return 'mergeMid';
        return 'mergeBasic';
    }
}
