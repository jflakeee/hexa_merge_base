/**
 * @fileoverview How To Play overlay screen.
 * Displays game instructions as numbered hex-badge cards and a Got It button.
 * Matches the unified design system (inline SVG, gradient buttons, hex accents).
 * ES Module - pure web implementation.
 */

export class HowToPlayScreen {
    constructor() {
        /** @type {HTMLElement|null} */
        this._container = null;

        /** Callback when the screen is dismissed. @type {function|null} */
        this.onClose = null;
    }

    /**
     * Build the how-to-play screen DOM inside the given container.
     * @param {HTMLElement} container - The overlay container element (e.g., #screen-howtoplay)
     */
    init(container) {
        this._container = container;
        container.innerHTML = '';

        // Title
        const title = document.createElement('h2');
        title.textContent = 'HOW TO PLAY';
        container.appendChild(title);

        // Steps container — card list
        const list = document.createElement('div');
        list.style.cssText = [
            'display:flex',
            'flex-direction:column',
            'gap:10px',
            'max-width:340px',
            'width:100%',
            'padding:0 12px'
        ].join(';');
        container.appendChild(list);

        /** @type {Array<{title:string,body:string}>} */
        const steps = [
            { title: 'TAP TO MERGE',  body: 'Tap a tile to merge it with adjacent tiles of the same value.' },
            { title: 'CHAIN MATCH',   body: 'Two or more adjacent same-value tiles merge into one with a higher value.' },
            { title: 'PLAN AHEAD',    body: 'Set up combos to trigger chain reactions and reach bigger numbers.' },
            { title: 'AVOID JAMS',    body: 'The game ends when no merges are possible.' },
            { title: 'BEAT YOUR BEST', body: 'Push for a new high score every run!' }
        ];

        steps.forEach((step, i) => {
            list.appendChild(this._createStepCard(i + 1, step.title, step.body));
        });

        // GOT IT button — primary with check icon
        const gotItBtn = document.createElement('button');
        gotItBtn.className = 'overlay-btn primary';
        gotItBtn.style.cssText = 'display:inline-flex;align-items:center;gap:10px;margin-top:12px;';
        gotItBtn.innerHTML = this._iconSvg('check') + '<span>GOT IT!</span>';
        gotItBtn.addEventListener('click', () => {
            if (this.onClose) this.onClose();
        });
        container.appendChild(gotItBtn);
    }

    /**
     * Build a single instruction card with a hex number badge.
     * @param {number} index - 1-based step index
     * @param {string} title
     * @param {string} body
     * @returns {HTMLElement}
     */
    _createStepCard(index, title, body) {
        const card = document.createElement('div');
        card.style.cssText = [
            'display:flex',
            'align-items:flex-start',
            'gap:12px',
            'padding:10px 12px',
            'background:linear-gradient(135deg,rgba(255,105,180,0.08),rgba(155,48,255,0.04))',
            'border:1px solid rgba(255,105,180,0.18)',
            'border-radius:12px',
            'box-shadow:0 2px 8px rgba(0,0,0,0.25)',
            'text-align:left'
        ].join(';');

        // Hex badge with index
        const badge = document.createElement('div');
        badge.style.cssText = [
            'flex:0 0 auto',
            'width:36px',
            'height:36px',
            'position:relative',
            'display:flex',
            'align-items:center',
            'justify-content:center',
            'color:#fff',
            'font-weight:900',
            'font-size:16px'
        ].join(';');
        badge.innerHTML = `
            <svg viewBox="0 0 24 24" style="position:absolute;inset:0;width:100%;height:100%;">
                <polygon points="12,1 22,7 22,17 12,23 2,17 2,7" fill="url(#hexgrad${index})"/>
                <defs>
                    <linearGradient id="hexgrad${index}" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stop-color="#FF69B4"/>
                        <stop offset="100%" stop-color="#9B30FF"/>
                    </linearGradient>
                </defs>
            </svg>
            <span style="position:relative;text-shadow:0 1px 2px rgba(0,0,0,0.4);">${index}</span>
        `;
        card.appendChild(badge);

        // Text block
        const txt = document.createElement('div');
        txt.style.cssText = 'display:flex;flex-direction:column;gap:2px;min-width:0;';
        const t = document.createElement('div');
        t.style.cssText = 'color:#FFB6D9;font-weight:900;font-size:13px;letter-spacing:0.08em;';
        t.textContent = title;
        const b = document.createElement('div');
        b.style.cssText = 'color:#cfcfd5;font-weight:800;font-size:13px;line-height:1.4;';
        b.textContent = body;
        txt.appendChild(t);
        txt.appendChild(b);
        card.appendChild(txt);

        return card;
    }

    /** Show the how-to-play screen. Visibility managed by ScreenManager. */
    show() {}

    /** Hide the how-to-play screen. Visibility managed by ScreenManager. */
    hide() {}

    /**
     * Inline SVG icon (18px) — matches the system used in PauseScreen.
     * @param {'check'} name
     * @returns {string}
     */
    _iconSvg(name) {
        const base = 'width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"';
        switch (name) {
            case 'check':
                return `<svg ${base}><polyline points="5 12 10 17 19 7"/></svg>`;
            default:
                return '';
        }
    }
}
