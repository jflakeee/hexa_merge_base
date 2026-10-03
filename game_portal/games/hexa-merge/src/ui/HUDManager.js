/**
 * @fileoverview HUD (Heads-Up Display) manager for in-game score and controls.
 * Binds to DOM elements and provides update methods for score, high score,
 * sound icon, and button callbacks.
 * ES Module - pure web implementation.
 */

import { formatScore, setScoreText } from '../core/ScoreFormatter.js';

export class HUDManager {
    constructor() {
        /** @type {HTMLElement|null} */
        this._scoreEl = null;
        /** @type {HTMLElement|null} */
        this._hiScoreEl = null;
        /** @type {HTMLButtonElement|null} */
        this._btnSound = null;
        /** @type {HTMLButtonElement|null} */
        this._btnMenu = null;
        /** @type {HTMLButtonElement|null} */
        this._btnHelp = null;
    }

    /**
     * Initialize by binding to DOM elements.
     * Must be called after the DOM is ready.
     */
    init() {
        this._scoreEl = document.getElementById('score');
        this._hiScoreEl = document.getElementById('hi-score');
        this._btnSound = document.getElementById('btn-sound');
        this._btnMenu = document.getElementById('btn-menu');
        this._btnHelp = document.getElementById('btn-help');
    }

    /**
     * Update the displayed score with dynamic font sizing based on digit count.
     * - 1-3 digits: 48px
     * - 4-6 digits: 36px
     * - 7+ digits: 28px
     * Uses formatScore for large number abbreviation.
     * @param {number} score
     */
    updateScore(score) {
        if (!this._scoreEl) return;

        const formatted = formatScore(score);
        setScoreText(this._scoreEl, score);

        // Dynamic font size based on character length
        const len = formatted.length;
        let basePx;
        if (len <= 3) {
            basePx = 56;
        } else if (len <= 6) {
            basePx = 42;
        } else {
            basePx = 32;
        }

        // Viewport-based scale factor for small screens
        const vw = window.innerWidth;
        let scale = 1;
        if (vw <= 320) {
            scale = 0.58;
        } else if (vw <= 360) {
            scale = 0.67;
        } else if (vw <= 480) {
            scale = 0.83;
        }

        this._scoreEl.style.fontSize = Math.round(basePx * scale) + 'px';
    }

    /**
     * Update the displayed high score.
     * @param {number} score
     */
    updateHighScore(score) {
        if (!this._hiScoreEl) return;
        setScoreText(this._hiScoreEl, score);
    }

    /**
     * Update the sound button icon based on mute state.
     * @param {boolean} muted - true to show muted icon, false for speaker icon
     */
    setSoundIcon(muted) {
        if (!this._btnSound) return;
        this._btnSound.textContent = muted ? '\u{1F507}' : '\u{1F50A}';
    }

    /**
     * Register callbacks for HUD buttons.
     * @param {object} callbacks
     * @param {function} [callbacks.onSound] - Sound toggle button callback
     * @param {function} [callbacks.onMenu] - Menu/pause button callback
     * @param {function} [callbacks.onHelp] - Help button callback
     */
    setButtonCallbacks(callbacks) {
        if (this._btnSound && callbacks.onSound) {
            this._btnSound.addEventListener('click', callbacks.onSound);
        }
        if (this._btnMenu && callbacks.onMenu) {
            this._btnMenu.addEventListener('click', callbacks.onMenu);
        }
        if (this._btnHelp && callbacks.onHelp) {
            this._btnHelp.addEventListener('click', callbacks.onHelp);
        }
    }
}
