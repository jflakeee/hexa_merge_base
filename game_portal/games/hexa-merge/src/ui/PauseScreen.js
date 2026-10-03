/**
 * @fileoverview Pause overlay screen (XUP benchmark style).
 * Purple gradient header, icon buttons row, Restart/Continue buttons.
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

        /** @type {HTMLButtonElement|null} */
        this._moonBtn = null;
        /** @type {HTMLButtonElement|null} */
        this._statsBtn = null;

        /** Callback when "Resume" is pressed. @type {function|null} */
        this.onResume = null;
        /** Callback when "Restart" is pressed. @type {function|null} */
        this.onRestart = null;
        /** Callback when sound toggle is pressed. @type {function|null} */
        this.onSoundToggle = null;
        /** Callback when theme toggle is pressed. @type {function|null} */
        this.onThemeToggle = null;
        /** Callback when stats button is pressed. @type {function|null} */
        this.onStats = null;
    }

    /**
     * Build the pause screen DOM inside the given container.
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
        const title = document.createElement('div');
        title.style.cssText = 'color:#FFF;font-size:24px;font-weight:900;letter-spacing:3px;';
        title.textContent = 'PAUSED';
        header.appendChild(title);
        wrapper.appendChild(header);

        // --- Body ---
        const body = document.createElement('div');
        body.style.cssText = 'background:var(--card-bg, #1a1a1e);padding:24px 20px 28px;text-align:center;border-radius:0 0 16px 16px;';

        // Icon buttons row
        const iconRow = document.createElement('div');
        iconRow.style.cssText = 'display:flex;justify-content:center;gap:16px;margin-bottom:28px;';

        const iconBtnStyle = 'width:56px;height:56px;border-radius:14px;border:none;font-size:24px;cursor:pointer;transition:transform 0.1s;display:flex;align-items:center;justify-content:center;';

        // Sound toggle (cyan)
        this._soundBtn = document.createElement('button');
        this._soundBtn.style.cssText = iconBtnStyle + 'background:#00BCD4;';
        this._soundBtn.textContent = '\u{1F50A}';
        this._soundBtn.title = 'Sound';
        this._soundBtn.addEventListener('click', () => {
            if (this.onSoundToggle) this.onSoundToggle();
        });
        this._soundBtn.addEventListener('pointerdown', () => { this._soundBtn.style.transform = 'scale(0.9)'; });
        this._soundBtn.addEventListener('pointerup', () => { this._soundBtn.style.transform = ''; });
        iconRow.appendChild(this._soundBtn);

        // Star (yellow) - decorative
        const starBtn = document.createElement('button');
        starBtn.style.cssText = iconBtnStyle + 'background:#FFC107;';
        starBtn.textContent = '\u{2B50}';
        starBtn.title = 'Rate';
        iconRow.appendChild(starBtn);

        // Moon/theme (blue)
        this._moonBtn = document.createElement('button');
        this._moonBtn.style.cssText = iconBtnStyle + 'background:#42A5F5;';
        this._moonBtn.textContent = '\u{1F319}';
        this._moonBtn.title = 'Theme';
        this._moonBtn.addEventListener('click', () => {
            if (this.onThemeToggle) this.onThemeToggle();
        });
        this._moonBtn.addEventListener('pointerdown', () => { this._moonBtn.style.transform = 'scale(0.9)'; });
        this._moonBtn.addEventListener('pointerup', () => { this._moonBtn.style.transform = ''; });
        iconRow.appendChild(this._moonBtn);

        // Stats (green)
        this._statsBtn = document.createElement('button');
        this._statsBtn.style.cssText = iconBtnStyle + 'background:#66BB6A;';
        this._statsBtn.textContent = '\u{1F4CA}';
        this._statsBtn.title = 'Stats';
        this._statsBtn.addEventListener('click', () => {
            if (this.onStats) this.onStats();
        });
        this._statsBtn.addEventListener('pointerdown', () => { this._statsBtn.style.transform = 'scale(0.9)'; });
        this._statsBtn.addEventListener('pointerup', () => { this._statsBtn.style.transform = ''; });
        iconRow.appendChild(this._statsBtn);

        body.appendChild(iconRow);

        // Button container
        const btnContainer = document.createElement('div');
        btnContainer.style.cssText = 'display:flex;flex-direction:column;gap:12px;align-items:center;';

        // Restart button (outlined coral/pink border)
        this._restartBtn = document.createElement('button');
        this._restartBtn.style.cssText = 'width:100%;padding:14px 32px;border-radius:25px;border:2px solid #E91E63;background:transparent;color:#E91E63;font-size:18px;font-weight:700;cursor:pointer;transition:transform 0.1s;min-height:44px;letter-spacing:1px;';
        this._restartBtn.textContent = 'RESTART';
        this._restartBtn.addEventListener('click', () => {
            if (this.onRestart) this.onRestart();
        });
        this._restartBtn.addEventListener('pointerdown', () => { this._restartBtn.style.transform = 'scale(0.95)'; });
        this._restartBtn.addEventListener('pointerup', () => { this._restartBtn.style.transform = ''; });
        btnContainer.appendChild(this._restartBtn);

        // Continue button (solid pink)
        this._resumeBtn = document.createElement('button');
        this._resumeBtn.style.cssText = 'width:100%;padding:14px 32px;border-radius:25px;border:none;background:#E91E63;color:#FFF;font-size:18px;font-weight:700;cursor:pointer;transition:transform 0.1s;min-height:44px;letter-spacing:1px;';
        this._resumeBtn.textContent = 'CONTINUE';
        this._resumeBtn.addEventListener('click', () => {
            if (this.onResume) this.onResume();
        });
        this._resumeBtn.addEventListener('pointerdown', () => { this._resumeBtn.style.transform = 'scale(0.95)'; });
        this._resumeBtn.addEventListener('pointerup', () => { this._resumeBtn.style.transform = ''; });
        btnContainer.appendChild(this._resumeBtn);

        body.appendChild(btnContainer);
        wrapper.appendChild(body);
        container.appendChild(wrapper);
    }

    /** Show the pause screen. */
    show() {
        // Visibility managed by ScreenManager
    }

    /** Hide the pause screen. */
    hide() {
        // Visibility managed by ScreenManager
    }

    /**
     * Update the sound toggle button label.
     * @param {boolean} muted
     */
    updateSoundButton(muted) {
        if (!this._soundBtn) return;
        this._soundBtn.textContent = muted ? '\u{1F507}' : '\u{1F50A}';
        this._soundBtn.style.background = muted ? '#78909C' : '#00BCD4';
    }

    /**
     * Update the theme toggle button icon.
     * @param {boolean} isLight - true if currently in light mode
     */
    updateThemeButton(isLight) {
        if (!this._moonBtn) return;
        this._moonBtn.textContent = isLight ? '\u{2600}\u{FE0F}' : '\u{1F319}';
    }
}
