/**
 * @fileoverview HUD (Heads-Up Display) manager for in-game score and controls.
 * Binds to DOM elements and provides update methods for score, high score,
 * sound icon, and button callbacks.
 * ES Module - pure web implementation.
 */

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
     * Shows the FULL number (benchmark never abbreviates the score counter;
     * K/M abbreviation is only used on tile values).
     * @param {number} score
     */
    updateScore(score) {
        if (!this._scoreEl) return;

        const formatted = String(Math.floor(score));
        this._scoreEl.textContent = formatted;

        // Dynamic font size based on character length
        const len = formatted.length;
        if (len <= 4) {
            this._scoreEl.style.fontSize = '48px';
        } else if (len <= 6) {
            this._scoreEl.style.fontSize = '38px';
        } else if (len <= 8) {
            this._scoreEl.style.fontSize = '30px';
        } else {
            this._scoreEl.style.fontSize = '24px';
        }
    }

    /**
     * Update the displayed high score (full number, no abbreviation).
     * @param {number} score
     */
    updateHighScore(score) {
        if (!this._hiScoreEl) return;
        this._hiScoreEl.textContent = String(Math.floor(score));
    }

    /**
     * Update the sound button icon based on mute state.
     * Toggles between inline SVG variants embedded in the button.
     * @param {boolean} muted - true to show muted icon, false for speaker icon
     */
    setSoundIcon(muted) {
        if (!this._btnSound) return;
        const on = this._btnSound.querySelector('#icon-sound-on');
        const off = this._btnSound.querySelector('#icon-sound-off');
        if (on) on.style.display = muted ? 'none' : '';
        if (off) off.style.display = muted ? '' : 'none';
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
