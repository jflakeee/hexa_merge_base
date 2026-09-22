/**
 * @fileoverview How To Play overlay — visual merge demos matching the XUP benchmark.
 * Purple "HOW TO PLAY?" header, three "Merge at least N tiles → ×N" rows with
 * hexagon clusters and a result hex, plus a pink GOT IT! button.
 * See docs/benchmark-vs-impl-diff.md §5 (menu HOW TO PLAY screen).
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
     * @param {HTMLElement} container - The overlay container (#screen-howtoplay)
     */
    init(container) {
        this._container = container;
        container.innerHTML = '';

        const card = document.createElement('div');
        card.style.cssText = [
            'width:min(88vw,360px)',
            'background:#15151c',
            'border-radius:22px',
            'overflow:hidden',
            'box-shadow:0 18px 48px rgba(0,0,0,0.55)',
            'display:flex',
            'flex-direction:column',
        ].join(';');

        // Purple header
        const header = document.createElement('div');
        header.textContent = 'HOW TO PLAY?';
        header.style.cssText = [
            'background:#4A148C',
            'color:#FFFFFF',
            'font-weight:900',
            'font-size:24px',
            'letter-spacing:0.02em',
            'text-align:center',
            'padding:18px 0',
        ].join(';');
        card.appendChild(header);

        const body = document.createElement('div');
        body.style.cssText = 'padding:20px;display:flex;flex-direction:column;gap:18px;';
        card.appendChild(body);

        // [count, multiplier, resultValue]
        const steps = [
            { n: 2, by: 2, result: 4 },
            { n: 4, by: 4, result: 8 },
            { n: 8, by: 8, result: 16 },
        ];
        for (const s of steps) body.appendChild(this._stepRow(s));

        // GOT IT! button (solid pink)
        const gotIt = document.createElement('button');
        gotIt.textContent = 'GOT IT!';
        gotIt.style.cssText = [
            'width:100%',
            'min-height:54px',
            'margin-top:4px',
            'border-radius:14px',
            'border:none',
            'background:#EE4B6A',
            'color:#fff',
            'font-family:inherit',
            'font-weight:900',
            'font-size:20px',
            'letter-spacing:0.06em',
            'cursor:pointer',
            'box-shadow:0 4px 12px rgba(238,75,106,0.4)',
            'touch-action:manipulation',
        ].join(';');
        gotIt.addEventListener('click', () => { if (this.onClose) this.onClose(); });
        body.appendChild(gotIt);

        container.appendChild(card);
    }

    /**
     * @private Build one instruction row: text + source cluster → result hex.
     * @param {{n:number, by:number, result:number}} s
     */
    _stepRow(s) {
        const wrap = document.createElement('div');
        wrap.style.cssText = 'display:flex;flex-direction:column;gap:8px;';

        const text = document.createElement('div');
        text.style.cssText = 'color:#e8e8ee;font-weight:800;font-size:14px;line-height:1.3;';
        text.innerHTML = `Merge <span style="color:#EB3758">at least ${s.n} tiles</span> for multiply by <span style="color:#EB3758">${s.by}</span>`;
        wrap.appendChild(text);

        const demo = document.createElement('div');
        demo.style.cssText = 'display:flex;align-items:center;gap:8px;flex-wrap:wrap;';
        // source cluster (show up to 4 yellow "2" hexes)
        const shown = Math.min(s.n, 4);
        for (let i = 0; i < shown; i++) demo.innerHTML += this._hex('#FECC33', '2', 34);
        if (s.n > shown) {
            demo.innerHTML += `<span style="color:#9a9aa2;font-weight:900;font-size:16px;">+${s.n - shown}</span>`;
        }
        // arrow
        demo.innerHTML += `<span style="color:#9B30FF;font-size:22px;font-weight:900;">→</span>`;
        // result hex (pink)
        demo.innerHTML += this._hex('#EB3758', String(s.result), 40);
        wrap.appendChild(demo);

        return wrap;
    }

    /**
     * @private Inline mini flat-top hexagon with a centered number.
     * @param {string} color
     * @param {string} num
     * @param {number} size
     */
    _hex(color, num, size) {
        return `<div style="width:${size}px;height:${Math.round(size * 0.9)}px;`
            + `clip-path:polygon(25% 0%,75% 0%,100% 50%,75% 100%,25% 100%,0% 50%);`
            + `background:${color};display:inline-flex;align-items:center;justify-content:center;`
            + `color:#fff;font-weight:900;font-size:${Math.round(size * 0.42)}px;">${num}</div>`;
    }

    /** Show the how-to-play screen. Visibility managed by ScreenManager. */
    show() {}

    /** Hide the how-to-play screen. Visibility managed by ScreenManager. */
    hide() {}
}
