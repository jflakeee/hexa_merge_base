/**
 * @fileoverview Pause overlay screen.
 * Provides Resume, Restart, How To Play, and Sound toggle buttons,
 * plus a Best Score readout.
 * ES Module - pure web implementation.
 */

import { formatValue } from '../core/TileHelper.js';

export class PauseScreen {
    constructor() {
        /** @type {HTMLElement|null} */
        this._container = null;
        /** @type {HTMLButtonElement|null} */
        this._resumeBtn = null;
        /** @type {HTMLButtonElement|null} */
        this._restartBtn = null;
        /** @type {HTMLButtonElement|null} */
        this._soundBtn = null;
        /** @type {HTMLButtonElement|null} */
        this._howToPlayBtn = null;
        /** @type {HTMLElement|null} */
        this._bestScoreEl = null;

        /** Callback when "Resume" is pressed. @type {function|null} */
        this.onResume = null;
        /** Callback when "Restart" is pressed. @type {function|null} */
        this.onRestart = null;
        /** Callback when sound toggle is pressed. @type {function|null} */
        this.onSoundToggle = null;
        /** Callback when "How to Play" is pressed. @type {function|null} */
        this.onHowToPlay = null;
    }

    /**
     * Build the pause screen DOM inside the given container.
     * @param {HTMLElement} container - The overlay container element (e.g., #screen-pause)
     */
    init(container) {
        this._container = container;
        container.innerHTML = '';

        // Title
        const title = document.createElement('h2');
        title.textContent = 'PAUSED';
        container.appendChild(title);

        // Best score readout
        const bestWrap = document.createElement('div');
        bestWrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:4px;margin-bottom:8px;';
        const bestLabel = document.createElement('div');
        bestLabel.className = 'label';
        bestLabel.textContent = 'BEST';
        bestWrap.appendChild(bestLabel);
        this._bestScoreEl = document.createElement('div');
        this._bestScoreEl.style.cssText = 'color:#FFD700;font-size:32px;font-weight:900;letter-spacing:0.04em;text-shadow:0 0 10px rgba(255,215,0,0.45);';
        this._bestScoreEl.textContent = '0';
        bestWrap.appendChild(this._bestScoreEl);
        container.appendChild(bestWrap);

        // Button container
        const btnContainer = document.createElement('div');
        btnContainer.style.cssText = 'display:flex;flex-direction:column;gap:12px;margin-top:12px;align-items:center;';
        container.appendChild(btnContainer);

        // Resume button (primary)
        this._resumeBtn = document.createElement('button');
        this._resumeBtn.className = 'overlay-btn primary';
        this._resumeBtn.innerHTML = this._iconSvg('play') + '<span>RESUME</span>';
        this._resumeBtn.style.cssText = 'display:inline-flex;align-items:center;gap:10px;';
        this._resumeBtn.addEventListener('click', () => {
            if (this.onResume) this.onResume();
        });
        btnContainer.appendChild(this._resumeBtn);

        // Restart button
        this._restartBtn = document.createElement('button');
        this._restartBtn.className = 'overlay-btn secondary';
        this._restartBtn.innerHTML = this._iconSvg('restart') + '<span>RESTART</span>';
        this._restartBtn.style.cssText = 'display:inline-flex;align-items:center;gap:10px;';
        this._restartBtn.addEventListener('click', () => {
            if (this.onRestart) this.onRestart();
        });
        btnContainer.appendChild(this._restartBtn);

        // How to Play button
        this._howToPlayBtn = document.createElement('button');
        this._howToPlayBtn.className = 'overlay-btn secondary';
        this._howToPlayBtn.innerHTML = this._iconSvg('help') + '<span>HOW TO PLAY</span>';
        this._howToPlayBtn.style.cssText = 'display:inline-flex;align-items:center;gap:10px;';
        this._howToPlayBtn.addEventListener('click', () => {
            if (this.onHowToPlay) this.onHowToPlay();
        });
        btnContainer.appendChild(this._howToPlayBtn);

        // Sound toggle button
        this._soundBtn = document.createElement('button');
        this._soundBtn.className = 'overlay-btn secondary';
        this._soundBtn.style.cssText = 'display:inline-flex;align-items:center;gap:10px;';
        this._soundBtn.addEventListener('click', () => {
            if (this.onSoundToggle) this.onSoundToggle();
        });
        btnContainer.appendChild(this._soundBtn);
        this.updateSoundButton(false);
    }

    /**
     * Show the pause screen and refresh best-score readout.
     * @param {number} [bestScore]
     */
    show(bestScore) {
        if (this._bestScoreEl && typeof bestScore === 'number') {
            this._bestScoreEl.textContent = formatValue(bestScore);
        }
    }

    /** Hide the pause screen. Visibility managed by ScreenManager. */
    hide() {}

    /**
     * Update the sound toggle button label.
     * @param {boolean} muted
     */
    updateSoundButton(muted) {
        if (!this._soundBtn) return;
        const icon = this._iconSvg(muted ? 'sound-off' : 'sound-on');
        const label = muted ? 'SOUND: OFF' : 'SOUND: ON';
        this._soundBtn.innerHTML = icon + '<span>' + label + '</span>';
    }

    /**
     * Returns an inline SVG string for the named icon, sized 18px.
     * @param {'play'|'restart'|'help'|'sound-on'|'sound-off'} name
     * @returns {string}
     */
    _iconSvg(name) {
        const base = 'width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"';
        switch (name) {
            case 'play':
                return `<svg ${base}><path d="M6 4l14 8-14 8V4z" fill="currentColor"/></svg>`;
            case 'restart':
                return `<svg ${base}><path d="M3 12a9 9 0 1 0 3-6.7"/><polyline points="3 4 3 10 9 10"/></svg>`;
            case 'help':
                return `<svg ${base}><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 1-1 1.7v.5"/><circle cx="12" cy="17" r="1.1" fill="currentColor" stroke="none"/></svg>`;
            case 'sound-on':
                return `<svg ${base}><path d="M3 9.5v5a1 1 0 0 0 1 1h3l4 3.5a1 1 0 0 0 1.6-.8V4.8a1 1 0 0 0-1.6-.8L7 8.5H4a1 1 0 0 0-1 1z" fill="currentColor"/><path d="M15.5 8.5a4.5 4.5 0 0 1 0 7"/><path d="M18.5 5.5a8 8 0 0 1 0 13"/></svg>`;
            case 'sound-off':
                return `<svg ${base}><path d="M3 9.5v5a1 1 0 0 0 1 1h3l4 3.5a1 1 0 0 0 1.6-.8V4.8a1 1 0 0 0-1.6-.8L7 8.5H4a1 1 0 0 0-1 1z" fill="currentColor"/><line x1="16" y1="9" x2="22" y2="15"/><line x1="22" y1="9" x2="16" y2="15"/></svg>`;
            default:
                return '';
        }
    }
}
