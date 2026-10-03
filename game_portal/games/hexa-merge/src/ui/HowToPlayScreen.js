/**
 * @fileoverview How To Play overlay screen (XUP benchmark style).
 * Purple gradient header, visual merge diagrams with hex tiles,
 * and a "GOT IT!" dismiss button.
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
        title.style.cssText = 'color:#FFF;font-size:22px;font-weight:900;letter-spacing:2px;';
        title.textContent = 'HOW TO PLAY?';
        header.appendChild(title);
        wrapper.appendChild(header);

        // --- Body ---
        const body = document.createElement('div');
        body.style.cssText = 'background:var(--card-bg, #1a1a1e);padding:20px 16px 24px;border-radius:0 0 16px 16px;';

        // Merge diagrams
        const examples = [
            { count: 2, mult: 2, fromVal: 2, toVal: 4, fromColor: '#FFD700', toColor: '#FF6B35' },
            { count: 4, mult: 4, fromVal: 4, toVal: 16, fromColor: '#FF6B35', toColor: '#880E4F' },
            { count: 8, mult: 8, fromVal: 8, toVal: 64, fromColor: '#EC407A', toColor: '#8E24AA' },
        ];

        examples.forEach((ex, idx) => {
            const row = this._createMergeDiagram(ex);
            if (idx < examples.length - 1) {
                row.style.marginBottom = '16px';
            }
            body.appendChild(row);
        });

        // Description text
        const desc = document.createElement('div');
        desc.style.cssText = 'color:#999;font-size:13px;text-align:center;margin-top:20px;line-height:1.5;';
        desc.textContent = 'Tap a tile to merge it with adjacent tiles of the same value. The game ends when the board is full and no more merges are possible.';
        body.appendChild(desc);

        // GOT IT! button
        const gotItBtn = document.createElement('button');
        gotItBtn.style.cssText = 'width:100%;padding:14px 32px;border-radius:25px;border:none;background:#E91E63;color:#FFF;font-size:18px;font-weight:700;cursor:pointer;transition:transform 0.1s;min-height:44px;letter-spacing:1px;margin-top:20px;';
        gotItBtn.textContent = 'GOT IT!';
        gotItBtn.addEventListener('click', () => {
            if (this.onClose) this.onClose();
        });
        gotItBtn.addEventListener('pointerdown', () => { gotItBtn.style.transform = 'scale(0.95)'; });
        gotItBtn.addEventListener('pointerup', () => { gotItBtn.style.transform = ''; });
        body.appendChild(gotItBtn);

        wrapper.appendChild(body);
        container.appendChild(wrapper);
    }

    /**
     * Create a merge diagram row.
     * @param {{count:number, mult:number, fromVal:number, toVal:number, fromColor:string, toColor:string}} ex
     * @returns {HTMLElement}
     */
    _createMergeDiagram(ex) {
        const row = document.createElement('div');
        row.style.cssText = 'background:#252528;border-radius:12px;padding:14px 12px;';

        // Label
        const label = document.createElement('div');
        label.style.cssText = 'color:#CCC;font-size:12px;font-weight:600;text-align:center;margin-bottom:10px;line-height:1.4;';
        label.innerHTML = `Merge at least <span style="color:#E91E63;font-weight:800;">${ex.count}</span> tiles for multiply by <span style="color:#E91E63;font-weight:800;">${ex.mult}</span>`;
        row.appendChild(label);

        // Visual: hex tiles → result hex
        const visual = document.createElement('div');
        visual.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:4px;flex-wrap:wrap;';

        // Source hex tiles (show min of count and 4 for space)
        const showCount = Math.min(ex.count, 4);
        for (let i = 0; i < showCount; i++) {
            visual.appendChild(this._createMiniHex(ex.fromVal, ex.fromColor));
            if (i < showCount - 1) {
                const plus = document.createElement('span');
                plus.style.cssText = 'color:#666;font-size:12px;font-weight:700;margin:0 1px;';
                plus.textContent = '+';
                visual.appendChild(plus);
            }
        }

        // Ellipsis for 8 tiles
        if (ex.count > 4) {
            const dots = document.createElement('span');
            dots.style.cssText = 'color:#666;font-size:14px;font-weight:700;margin:0 2px;';
            dots.textContent = '+...';
            visual.appendChild(dots);
        }

        // Arrow
        const arrow = document.createElement('span');
        arrow.style.cssText = 'color:#E91E63;font-size:18px;font-weight:700;margin:0 6px;';
        arrow.textContent = '\u{2192}';
        visual.appendChild(arrow);

        // Pointer emoji
        const pointer = document.createElement('span');
        pointer.style.cssText = 'font-size:16px;margin-right:4px;';
        pointer.textContent = '\u{1F446}';
        visual.appendChild(pointer);

        // Result hex tile
        visual.appendChild(this._createMiniHex(ex.toVal, ex.toColor, true));

        row.appendChild(visual);
        return row;
    }

    /**
     * Create a small hexagonal tile element.
     * @param {number} value
     * @param {string} bgColor
     * @param {boolean} [isResult=false]
     * @returns {HTMLElement}
     */
    _createMiniHex(value, bgColor, isResult = false) {
        const size = isResult ? 44 : 36;
        const fontSize = isResult ? 14 : 12;
        const hex = document.createElement('div');
        hex.style.cssText = `width:${size}px;height:${size}px;clip-path:polygon(50% 0%,93% 25%,93% 75%,50% 100%,7% 75%,7% 25%);background:${bgColor};display:flex;align-items:center;justify-content:center;flex-shrink:0;`;
        const txt = document.createElement('span');
        txt.style.cssText = `color:#FFF;font-size:${fontSize}px;font-weight:900;`;
        txt.textContent = String(value);
        hex.appendChild(txt);
        return hex;
    }

    /** Show the how-to-play screen. */
    show() {
        // Visibility managed by ScreenManager
    }

    /** Hide the how-to-play screen. */
    hide() {
        // Visibility managed by ScreenManager
    }
}
