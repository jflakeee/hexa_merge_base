/**
 * @fileoverview Game Over overlay screen.
 * Displays final score, high score, optional NEW RECORD label,
 * and Watch Ad / Play Again buttons with the unified design system
 * (inline SVG icons, gradient primary buttons, gold-glow BEST readout).
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

        /** Callback when "Continue" (watch ad) is pressed. @type {function|null} */
        this.onContinue = null;
        /** Callback when "Play Again" is pressed. @type {function|null} */
        this.onPlayAgain = null;
    }

    /**
     * Build the game over screen DOM inside the given container.
     * @param {HTMLElement} container - The overlay container element (e.g., #screen-gameover)
     */
    init(container) {
        this._container = container;
        container.innerHTML = '';

        // Title
        const title = document.createElement('h2');
        title.textContent = 'GAME OVER';
        container.appendChild(title);

        // Score block (current run)
        const scoreLabel = document.createElement('div');
        scoreLabel.className = 'label';
        scoreLabel.textContent = 'SCORE';
        container.appendChild(scoreLabel);

        this._scoreEl = document.createElement('div');
        this._scoreEl.className = 'score-display';
        this._scoreEl.textContent = '0';
        container.appendChild(this._scoreEl);

        // BEST block — gold glow to match PauseScreen
        const bestWrap = document.createElement('div');
        bestWrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:4px;margin-top:4px;';
        const hiLabel = document.createElement('div');
        hiLabel.className = 'label';
        hiLabel.textContent = 'BEST';
        bestWrap.appendChild(hiLabel);
        this._hiScoreEl = document.createElement('div');
        this._hiScoreEl.style.cssText = 'color:#FFD700;font-size:32px;font-weight:900;letter-spacing:0.04em;text-shadow:0 0 10px rgba(255,215,0,0.45);';
        this._hiScoreEl.textContent = '0';
        bestWrap.appendChild(this._hiScoreEl);
        container.appendChild(bestWrap);

        // NEW RECORD ribbon with trophy icon
        this._newRecordEl = document.createElement('div');
        this._newRecordEl.className = 'new-record';
        this._newRecordEl.style.cssText = 'display:none;align-items:center;gap:8px;';
        this._newRecordEl.innerHTML = this._iconSvg('trophy') + '<span>NEW RECORD!</span>';
        container.appendChild(this._newRecordEl);

        // Button container
        const btnContainer = document.createElement('div');
        btnContainer.style.cssText = 'display:flex;flex-direction:column;gap:12px;margin-top:14px;align-items:center;';
        container.appendChild(btnContainer);

        // Play Again — primary
        this._playAgainBtn = document.createElement('button');
        this._playAgainBtn.className = 'overlay-btn primary';
        this._playAgainBtn.style.cssText = 'display:inline-flex;align-items:center;gap:10px;';
        this._playAgainBtn.innerHTML = this._iconSvg('restart') + '<span>PLAY AGAIN</span>';
        this._playAgainBtn.addEventListener('click', () => {
            if (this.onPlayAgain) this.onPlayAgain();
        });
        btnContainer.appendChild(this._playAgainBtn);

        // Continue (watch ad) — secondary
        this._continueBtn = document.createElement('button');
        this._continueBtn.className = 'overlay-btn secondary';
        this._continueBtn.style.cssText = 'display:inline-flex;align-items:center;gap:10px;';
        this._continueBtn.innerHTML = this._iconSvg('ad') + '<span>WATCH AD &amp; CONTINUE</span>';
        this._continueBtn.addEventListener('click', () => {
            if (this.onContinue) this.onContinue();
        });
        btnContainer.appendChild(this._continueBtn);
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
        this._newRecordEl.style.display = isNewRecord ? 'inline-flex' : 'none';
    }

    /** Hide the game over screen. Visibility managed by ScreenManager. */
    hide() {
        if (this._newRecordEl) this._newRecordEl.style.display = 'none';
    }

    /**
     * Inline SVG icon (18px) — matches the system used in PauseScreen.
     * @param {'restart'|'ad'|'trophy'} name
     * @returns {string}
     */
    _iconSvg(name) {
        const base = 'width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"';
        switch (name) {
            case 'restart':
                return `<svg ${base}><path d="M3 12a9 9 0 1 0 3-6.7"/><polyline points="3 4 3 10 9 10"/></svg>`;
            case 'ad':
                return `<svg ${base}><polygon points="5 4 19 12 5 20 5 4" fill="currentColor" stroke="none"/></svg>`;
            case 'trophy':
                return `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M18 4h-2V2H8v2H6a2 2 0 0 0-2 2v2a4 4 0 0 0 4 4 5 5 0 0 0 3 2.2V18H8v2h8v-2h-3v-3.8A5 5 0 0 0 16 12a4 4 0 0 0 4-4V6a2 2 0 0 0-2-2zM6 8V6h2v3.9A2 2 0 0 1 6 8zm12 0a2 2 0 0 1-2 1.9V6h2z"/></svg>`;
            default:
                return '';
        }
    }
}
