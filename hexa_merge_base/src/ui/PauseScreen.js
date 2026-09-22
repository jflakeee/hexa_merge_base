/**
 * @fileoverview Pause overlay screen — "MENU" card matching the XUP benchmark.
 * Purple header, a 2x2 grid of colored icon buttons, plus RESTART / CONTINUE.
 * See docs/benchmark-vs-impl-diff.md §5 (menu_02).
 * ES Module - pure web implementation.
 */

export class PauseScreen {
    constructor() {
        /** @type {HTMLElement|null} */
        this._container = null;
        /** @type {HTMLElement|null} */
        this._bestScoreEl = null;

        /** Callback when "Continue" is pressed. @type {function|null} */
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
     * @param {HTMLElement} container - The overlay container element (#screen-pause)
     */
    init(container) {
        this._container = container;
        container.innerHTML = '';

        // ----- MENU card -----
        const card = document.createElement('div');
        card.style.cssText = [
            'width:min(86vw,340px)',
            'background:#FFFFFF',
            'border-radius:22px',
            'overflow:hidden',
            'box-shadow:0 18px 48px rgba(0,0,0,0.45)',
            'display:flex',
            'flex-direction:column',
        ].join(';');

        // Purple header
        const header = document.createElement('div');
        header.textContent = 'MENU';
        header.style.cssText = [
            'background:#4A148C',
            'color:#FFFFFF',
            'font-weight:900',
            'font-size:30px',
            'letter-spacing:0.04em',
            'text-align:center',
            'padding:20px 0',
        ].join(';');
        card.appendChild(header);

        // Body
        const body = document.createElement('div');
        body.style.cssText = 'padding:20px;display:flex;flex-direction:column;gap:14px;';
        card.appendChild(body);

        // 2x2 icon grid
        const grid = document.createElement('div');
        grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:14px;';
        body.appendChild(grid);

        // [icon, bgColor, callbackName]
        const cells = [
            ['thumb', '#4ECDE6', 'onHowToPlay'],
            ['star', '#FFC02E', null],
            ['sun', '#3E9BD6', 'onSoundToggle'],
            ['chart', '#8BD93C', null],
        ];
        for (const [icon, bg, cb] of cells) {
            grid.appendChild(this._gridButton(icon, bg, cb));
        }

        // RESTART (outline)
        const restart = document.createElement('button');
        restart.textContent = 'RESTART';
        restart.style.cssText = this._pillStyle() +
            'background:#FFFFFF;color:#F2674F;border:2.5px solid #F2674F;';
        restart.addEventListener('click', () => { if (this.onRestart) this.onRestart(); });
        body.appendChild(restart);

        // CONTINUE (solid)
        const cont = document.createElement('button');
        cont.textContent = 'CONTINUE';
        cont.style.cssText = this._pillStyle() +
            'background:#EE4B6A;color:#FFFFFF;border:none;box-shadow:0 4px 12px rgba(238,75,106,0.4);';
        cont.addEventListener('click', () => { if (this.onResume) this.onResume(); });
        body.appendChild(cont);

        container.appendChild(card);
    }

    /** @private Shared pill-button style. */
    _pillStyle() {
        return [
            'width:100%',
            'min-height:54px',
            'border-radius:14px',
            'font-family:inherit',
            'font-weight:900',
            'font-size:20px',
            'letter-spacing:0.06em',
            'cursor:pointer',
            'touch-action:manipulation',
            '',
        ].join(';');
    }

    /**
     * @private Build a colored icon button for the 2x2 grid.
     * @param {string} icon
     * @param {string} bg
     * @param {string|null} cbName
     */
    _gridButton(icon, bg, cbName) {
        const b = document.createElement('button');
        b.style.cssText = [
            'height:66px',
            `background:${bg}`,
            'border:none',
            'border-radius:14px',
            'display:flex',
            'align-items:center',
            'justify-content:center',
            'color:#FFFFFF',
            'cursor:pointer',
            'box-shadow:0 3px 8px rgba(0,0,0,0.18)',
            'touch-action:manipulation',
        ].join(';');
        b.innerHTML = this._iconSvg(icon);
        b.addEventListener('click', () => {
            const cb = cbName ? this[cbName] : null;
            if (cb) cb();
        });
        return b;
    }

    /**
     * Show the pause screen.
     * @param {number} [bestScore] - unused (HUD shows score); kept for compatibility
     */
    show(bestScore) { void bestScore; }

    /** Hide the pause screen. Visibility managed by ScreenManager. */
    hide() {}

    /**
     * Kept for compatibility with main.js; sound toggle lives in the HUD speaker.
     * @param {boolean} muted
     */
    updateSoundButton(muted) { void muted; }

    /**
     * Inline SVG icon (white, 30px) for the menu grid.
     * @param {'thumb'|'star'|'sun'|'chart'} name
     * @returns {string}
     */
    _iconSvg(name) {
        const f = 'width="30" height="30" viewBox="0 0 24 24" fill="#FFFFFF"';
        switch (name) {
            case 'thumb':
                return `<svg ${f}><path d="M2 10h3v11H2zM7 21h9.3a2 2 0 0 0 2-1.5l1.6-7A1.6 1.6 0 0 0 18.3 10H14V5a2 2 0 0 0-2-2l-3 8v10z"/></svg>`;
            case 'star':
                return `<svg ${f}><path d="M12 2l2.9 6.1 6.6.9-4.8 4.6 1.2 6.6L12 17.8 6.1 20.8l1.2-6.6L2.5 9l6.6-.9z"/></svg>`;
            case 'sun':
                return `<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="4.2" fill="#FFFFFF" stroke="none"/><g><line x1="12" y1="2.5" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="21.5"/><line x1="2.5" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="21.5" y2="12"/><line x1="5.2" y1="5.2" x2="7" y2="7"/><line x1="17" y1="17" x2="18.8" y2="18.8"/><line x1="18.8" y1="5.2" x2="17" y2="7"/><line x1="7" y1="17" x2="5.2" y2="18.8"/></g></svg>`;
            case 'chart':
                return `<svg ${f}><rect x="3" y="12" width="4.5" height="9" rx="1"/><rect x="9.7" y="7" width="4.5" height="14" rx="1"/><rect x="16.5" y="14" width="4.5" height="7" rx="1"/></svg>`;
            default:
                return '';
        }
    }
}
