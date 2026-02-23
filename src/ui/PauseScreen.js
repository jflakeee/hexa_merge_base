/**
 * @fileoverview Pause overlay screen.
 * Provides Resume, Restart, and Sound toggle buttons.
 * ES Module - pure web implementation.
 */

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

        /**
         * Callback when "Resume" is pressed.
         * @type {function|null}
         */
        this.onResume = null;

        /**
         * Callback when "Restart" is pressed.
         * @type {function|null}
         */
        this.onRestart = null;

        /**
         * Callback when sound toggle is pressed.
         * @type {function|null}
         */
        this.onSoundToggle = null;
    }

    /**
     * Build the pause screen DOM inside the given container.
     * @param {HTMLElement} container - The overlay container element (e.g., #screen-pause)
     */
    init(container) {
        this._container = container;

        // Clear any existing content
        container.innerHTML = '';

        // Title
        const title = document.createElement('h2');
        title.textContent = 'PAUSED';
        container.appendChild(title);

        // Button container
        const btnContainer = document.createElement('div');
        btnContainer.style.display = 'flex';
        btnContainer.style.flexDirection = 'column';
        btnContainer.style.gap = '12px';
        btnContainer.style.marginTop = '20px';
        container.appendChild(btnContainer);

        // Resume button
        this._resumeBtn = document.createElement('button');
        this._resumeBtn.className = 'overlay-btn primary';
        this._resumeBtn.textContent = 'Resume';
        this._resumeBtn.addEventListener('click', () => {
            if (this.onResume) this.onResume();
        });
        btnContainer.appendChild(this._resumeBtn);

        // Restart button
        this._restartBtn = document.createElement('button');
        this._restartBtn.className = 'overlay-btn secondary';
        this._restartBtn.textContent = 'Restart';
        this._restartBtn.addEventListener('click', () => {
            if (this.onRestart) this.onRestart();
        });
        btnContainer.appendChild(this._restartBtn);

        // Sound toggle button
        this._soundBtn = document.createElement('button');
        this._soundBtn.className = 'overlay-btn secondary';
        this._soundBtn.textContent = '\u{1F50A} Sound: ON';
        this._soundBtn.addEventListener('click', () => {
            if (this.onSoundToggle) this.onSoundToggle();
        });
        btnContainer.appendChild(this._soundBtn);
    }

    /**
     * Show the pause screen.
     */
    show() {
        // Visibility managed by ScreenManager
    }

    /**
     * Hide the pause screen.
     */
    hide() {
        // Visibility managed by ScreenManager
    }

    /**
     * Update the sound toggle button label.
     * @param {boolean} muted
     */
    updateSoundButton(muted) {
        if (!this._soundBtn) return;
        if (muted) {
            this._soundBtn.textContent = '\u{1F507} Sound: OFF';
        } else {
            this._soundBtn.textContent = '\u{1F50A} Sound: ON';
        }
    }
}
