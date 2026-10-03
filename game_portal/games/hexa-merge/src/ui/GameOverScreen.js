/**
 * @fileoverview Game Over overlay screen (XUP benchmark style).
 * Purple gradient header, large score, hex badge for max tile,
 * hi-score, and Play Again / Continue buttons.
 * ES Module - pure web implementation.
 */

import { formatValue } from '../core/TileHelper.js';
import { setScoreText } from '../core/ScoreFormatter.js';
import { getColor } from '../config/tileColors.js';

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
        /** @type {HTMLElement|null} */
        this._badgeEl = null;
        /** @type {HTMLElement|null} */
        this._badgeValueEl = null;
        /** @type {HTMLButtonElement|null} */
        this._continueBtn = null;
        /** @type {HTMLButtonElement|null} */
        this._playAgainBtn = null;

        /** Callback when "Continue" is pressed. @type {function|null} */
        this.onContinue = null;
        /** Callback when "Play Again" is pressed. @type {function|null} */
        this.onPlayAgain = null;
    }

    /**
     * Build the game over screen DOM inside the given container.
     * @param {HTMLElement} container
     */
    init(container) {
        this._container = container;
        container.innerHTML = '';

        // Wrapper with max-width
        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'width:100%;max-width:360px;border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.5);';

        // --- Purple gradient header ---
        const header = document.createElement('div');
        header.style.cssText = 'background:linear-gradient(135deg,#7B1FA2,#9C27B0);padding:18px 20px;text-align:center;';

        const logo = document.createElement('div');
        logo.style.cssText = 'font-size:28px;font-weight:900;letter-spacing:3px;';
        logo.innerHTML = '<span style="color:#FFF;">HEXA</span><span style="color:#FF80AB;">&nbsp;MERGE</span>';
        header.appendChild(logo);
        wrapper.appendChild(header);

        // --- Body ---
        const body = document.createElement('div');
        body.style.cssText = 'background:var(--card-bg, #1a1a1e);padding:24px 20px 28px;text-align:center;border-radius:0 0 16px 16px;';

        // GAME OVER title
        const title = document.createElement('div');
        title.style.cssText = 'color:var(--text-secondary, #888);font-size:14px;font-weight:700;letter-spacing:3px;margin-bottom:4px;';
        title.textContent = 'GAME OVER';
        body.appendChild(title);

        // SCORE label
        const scoreLabel = document.createElement('div');
        scoreLabel.style.cssText = 'color:var(--text-primary, #FFF);font-size:14px;font-weight:700;letter-spacing:2px;margin-bottom:2px;';
        scoreLabel.textContent = 'SCORE';
        body.appendChild(scoreLabel);

        // Score value (large pink)
        this._scoreEl = document.createElement('div');
        this._scoreEl.style.cssText = 'color:#E91E63;font-size:56px;font-weight:900;line-height:1.1;margin-bottom:12px;';
        this._scoreEl.textContent = '0';
        body.appendChild(this._scoreEl);

        // New record label (hidden by default)
        this._newRecordEl = document.createElement('div');
        this._newRecordEl.style.cssText = 'color:#FFD700;font-size:18px;font-weight:700;margin-bottom:8px;display:none;animation:pulse 1s infinite;';
        this._newRecordEl.textContent = 'NEW RECORD!';
        body.appendChild(this._newRecordEl);

        // Celebration + badge area
        const celebrationArea = document.createElement('div');
        celebrationArea.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:12px;margin-bottom:16px;';

        const leftEmoji = document.createElement('span');
        leftEmoji.style.cssText = 'font-size:32px;';
        leftEmoji.textContent = '\u{1F389}';
        celebrationArea.appendChild(leftEmoji);

        // Hex badge for max tile value
        this._badgeEl = document.createElement('div');
        this._badgeEl.style.cssText = 'width:72px;height:72px;clip-path:polygon(50% 0%,93% 25%,93% 75%,50% 100%,7% 75%,7% 25%);display:flex;align-items:center;justify-content:center;background:#E91E63;';
        this._badgeValueEl = document.createElement('span');
        this._badgeValueEl.style.cssText = 'color:#FFF;font-size:18px;font-weight:900;text-align:center;';
        this._badgeValueEl.textContent = '2';
        this._badgeEl.appendChild(this._badgeValueEl);
        celebrationArea.appendChild(this._badgeEl);

        const rightEmoji = document.createElement('span');
        rightEmoji.style.cssText = 'font-size:32px;';
        rightEmoji.textContent = '\u{1F389}';
        celebrationArea.appendChild(rightEmoji);

        body.appendChild(celebrationArea);

        // HI-SCORE label
        const hiLabel = document.createElement('div');
        hiLabel.style.cssText = 'color:var(--text-secondary, #888);font-size:12px;font-weight:700;letter-spacing:2px;margin-bottom:2px;';
        hiLabel.textContent = 'HI-SCORE';
        body.appendChild(hiLabel);

        // Hi-score value
        this._hiScoreEl = document.createElement('div');
        this._hiScoreEl.style.cssText = 'color:var(--text-secondary, #AAA);font-size:28px;font-weight:900;margin-bottom:24px;';
        this._hiScoreEl.textContent = '0';
        body.appendChild(this._hiScoreEl);

        // Button container
        const btnContainer = document.createElement('div');
        btnContainer.style.cssText = 'display:flex;flex-direction:column;gap:12px;align-items:center;';

        // Play Again button (outlined style)
        this._playAgainBtn = document.createElement('button');
        this._playAgainBtn.style.cssText = 'width:100%;padding:14px 32px;border-radius:25px;border:2px solid #E91E63;background:transparent;color:#E91E63;font-size:18px;font-weight:700;cursor:pointer;transition:transform 0.1s;min-height:44px;letter-spacing:1px;';
        this._playAgainBtn.textContent = 'PLAY AGAIN';
        this._playAgainBtn.addEventListener('click', () => {
            if (this.onPlayAgain) this.onPlayAgain();
        });
        this._playAgainBtn.addEventListener('pointerdown', () => { this._playAgainBtn.style.transform = 'scale(0.95)'; });
        this._playAgainBtn.addEventListener('pointerup', () => { this._playAgainBtn.style.transform = ''; });
        btnContainer.appendChild(this._playAgainBtn);

        // Continue button (solid pink)
        this._continueBtn = document.createElement('button');
        this._continueBtn.style.cssText = 'width:100%;padding:14px 32px;border-radius:25px;border:none;background:#E91E63;color:#FFF;font-size:18px;font-weight:700;cursor:pointer;transition:transform 0.1s;min-height:44px;letter-spacing:1px;';
        this._continueBtn.textContent = 'CONTINUE';
        this._continueBtn.addEventListener('click', () => {
            if (this.onContinue) this.onContinue();
        });
        this._continueBtn.addEventListener('pointerdown', () => { this._continueBtn.style.transform = 'scale(0.95)'; });
        this._continueBtn.addEventListener('pointerup', () => { this._continueBtn.style.transform = ''; });
        btnContainer.appendChild(this._continueBtn);

        body.appendChild(btnContainer);
        wrapper.appendChild(body);
        container.appendChild(wrapper);
    }

    /**
     * Display the game over screen with score information.
     * @param {number} score - Final score
     * @param {number} highScore - All-time high score
     * @param {boolean} isNewRecord - Whether this score is a new record
     * @param {number} [maxTileValue=0] - Highest tile value reached
     */
    show(score, highScore, isNewRecord, maxTileValue = 0) {
        if (!this._container) return;

        setScoreText(this._scoreEl, score);
        setScoreText(this._hiScoreEl, highScore);

        if (isNewRecord) {
            this._newRecordEl.style.display = 'block';
        } else {
            this._newRecordEl.style.display = 'none';
        }

        // Update hex badge with max tile value
        if (maxTileValue > 0) {
            this._badgeValueEl.textContent = formatValue(maxTileValue);
            this._badgeEl.style.background = getColor(maxTileValue);
        }
    }

    /** Hide the game over screen. */
    hide() {
        if (this._newRecordEl) {
            this._newRecordEl.style.display = 'none';
        }
    }
}
