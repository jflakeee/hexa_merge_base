/**
 * @fileoverview Game Over overlay screen.
 * Displays final score, high score, optional NEW RECORD label,
 * and Continue / Play Again buttons.
 * ES Module - pure web implementation.
 */

import { formatValue } from '../core/TileHelper.js';

export class GameOverScreen {
    constructor() {
        /** @type {HTMLElement|null} */
        this._container = null;
        /** @type {HTMLElement|null} */
        this._scoreEl = null;
        /** @type {HTMLElement|null} */
        this._hiScoreEl = null;
        /** @type {HTMLElement|null} */
        this._newRecordEl = null;
        /** @type {HTMLButtonElement|null} */
        this._continueBtn = null;
        /** @type {HTMLButtonElement|null} */
        this._playAgainBtn = null;

        /**
         * Callback when "Continue" is pressed (e.g., watch ad for extra moves).
         * @type {function|null}
         */
        this.onContinue = null;

        /**
         * Callback when "Play Again" is pressed.
         * @type {function|null}
         */
        this.onPlayAgain = null;
    }

    /**
     * Build the game over screen DOM inside the given container.
     * @param {HTMLElement} container - The overlay container element (e.g., #screen-gameover)
     */
    init(container) {
        this._container = container;

        // Clear any existing content
        container.innerHTML = '';

        // Title
        const title = document.createElement('h2');
        title.textContent = 'GAME OVER';
        container.appendChild(title);

        // Score section
        const scoreLabel = document.createElement('div');
        scoreLabel.className = 'label';
        scoreLabel.textContent = 'SCORE';
        container.appendChild(scoreLabel);

        this._scoreEl = document.createElement('div');
        this._scoreEl.className = 'score-display';
        this._scoreEl.textContent = '0';
        container.appendChild(this._scoreEl);

        // High score section
        const hiLabel = document.createElement('div');
        hiLabel.className = 'label';
        hiLabel.textContent = 'BEST';
        container.appendChild(hiLabel);

        this._hiScoreEl = document.createElement('div');
        this._hiScoreEl.className = 'score-display';
        this._hiScoreEl.style.fontSize = '28px';
        this._hiScoreEl.style.color = '#888';
        this._hiScoreEl.textContent = '0';
        container.appendChild(this._hiScoreEl);

        // New record label (hidden by default)
        this._newRecordEl = document.createElement('div');
        this._newRecordEl.className = 'new-record';
        this._newRecordEl.textContent = 'NEW RECORD!';
        this._newRecordEl.style.display = 'none';
        container.appendChild(this._newRecordEl);

        // Button container
        const btnContainer = document.createElement('div');
        btnContainer.style.display = 'flex';
        btnContainer.style.flexDirection = 'column';
        btnContainer.style.gap = '12px';
        btnContainer.style.marginTop = '20px';
        container.appendChild(btnContainer);

        // Continue button
        this._continueBtn = document.createElement('button');
        this._continueBtn.className = 'overlay-btn secondary';
        this._continueBtn.textContent = 'Continue';
        this._continueBtn.addEventListener('click', () => {
            if (this.onContinue) this.onContinue();
        });
        btnContainer.appendChild(this._continueBtn);

        // Play Again button
        this._playAgainBtn = document.createElement('button');
        this._playAgainBtn.className = 'overlay-btn primary';
        this._playAgainBtn.textContent = 'Play Again';
        this._playAgainBtn.addEventListener('click', () => {
            if (this.onPlayAgain) this.onPlayAgain();
        });
        btnContainer.appendChild(this._playAgainBtn);
    }

    /**
     * Display the game over screen with score information.
     * @param {number} score - Final score
     * @param {number} highScore - All-time high score
     * @param {boolean} isNewRecord - Whether this score is a new record
     */
    show(score, highScore, isNewRecord) {
        if (!this._container) return;

        this._scoreEl.textContent = formatValue(score);
        this._hiScoreEl.textContent = formatValue(highScore);

        if (isNewRecord) {
            this._newRecordEl.style.display = 'block';
        } else {
            this._newRecordEl.style.display = 'none';
        }
    }

    /**
     * Hide the game over screen.
     */
    hide() {
        // Visibility is controlled by ScreenManager; this is for cleanup
        if (this._newRecordEl) {
            this._newRecordEl.style.display = 'none';
        }
    }
}
