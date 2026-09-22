/**
 * @fileoverview Game Over overlay — celebration card matching the XUP benchmark.
 * Dark card: XUP header, SCORE + big number, confetti + stats row,
 * HI-SCORE readout, PLAY AGAIN (coral outline) and SHARE! (solid pink).
 * See docs/benchmark-vs-impl-diff.md §5 (end screen).
 * ES Module - pure web implementation.
 */

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

        /** Callback when "Play Again" is pressed. @type {function|null} */
        this.onPlayAgain = null;
        /** Callback when "Share" is pressed. @type {function|null} */
        this.onShare = null;
        /** Retained for compatibility (benchmark has no watch-ad button). @type {function|null} */
        this.onContinue = null;
    }

    /**
     * Build the game over screen DOM inside the given container.
     * @param {HTMLElement} container - The overlay container (#screen-gameover)
     */
    init(container) {
        this._container = container;
        container.innerHTML = '';

        const card = document.createElement('div');
        card.style.cssText = [
            'width:min(86vw,360px)',
            'background:#15151c',
            'border-radius:22px',
            'overflow:hidden',
            'box-shadow:0 18px 48px rgba(0,0,0,0.55)',
            'display:flex',
            'flex-direction:column',
        ].join(';');

        // XUP header strip (purple)
        const header = document.createElement('div');
        header.innerHTML = '<span style="color:#fff">X</span><span style="color:#EB3758">UP</span>';
        header.style.cssText = [
            'background:linear-gradient(135deg,#5B1A9E,#3D1066)',
            'font-weight:900',
            'font-size:28px',
            'letter-spacing:0.02em',
            'text-align:center',
            'padding:14px 0',
        ].join(';');
        card.appendChild(header);

        const body = document.createElement('div');
        body.style.cssText = 'padding:22px 22px 24px;display:flex;flex-direction:column;align-items:center;gap:6px;';
        card.appendChild(body);

        // SCORE label + value
        body.appendChild(this._label('SCORE'));
        this._scoreEl = document.createElement('div');
        this._scoreEl.style.cssText = 'color:#F23A5B;font-size:48px;font-weight:900;line-height:1;text-shadow:0 0 10px rgba(242,58,91,0.4);';
        this._scoreEl.textContent = '0';
        body.appendChild(this._scoreEl);

        // Celebration row: best hex + confetti + stats
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:14px;margin:12px 0;';
        row.innerHTML =
            this._hexBadge('#EB3758', '★') +
            '<div style="font-size:46px;line-height:1;">🎉</div>' +
            this._statsIcon();
        body.appendChild(row);

        // NEW RECORD (only when applicable)
        this._newRecordEl = document.createElement('div');
        this._newRecordEl.textContent = 'NEW RECORD!';
        this._newRecordEl.style.cssText = 'display:none;color:#FFD700;font-weight:900;font-size:15px;letter-spacing:0.08em;text-shadow:0 0 10px rgba(255,215,0,0.5);';
        body.appendChild(this._newRecordEl);

        // HI-SCORE label + value
        body.appendChild(this._label('HI-SCORE'));
        this._hiScoreEl = document.createElement('div');
        this._hiScoreEl.style.cssText = 'color:#8a8a92;font-size:26px;font-weight:900;letter-spacing:0.02em;margin-bottom:14px;';
        this._hiScoreEl.textContent = '0';
        body.appendChild(this._hiScoreEl);

        // PLAY AGAIN (coral outline)
        const playAgain = document.createElement('button');
        playAgain.textContent = 'PLAY AGAIN';
        playAgain.style.cssText = this._pillStyle() +
            'background:transparent;color:#F2674F;border:2.5px solid #F2674F;';
        playAgain.addEventListener('click', () => { if (this.onPlayAgain) this.onPlayAgain(); });
        body.appendChild(playAgain);

        // SHARE! (solid pink)
        const share = document.createElement('button');
        share.textContent = 'SHARE!';
        share.style.cssText = this._pillStyle() +
            'background:#EE4B6A;color:#fff;border:none;box-shadow:0 4px 12px rgba(238,75,106,0.4);margin-top:10px;';
        share.addEventListener('click', () => this._handleShare());
        body.appendChild(share);

        container.appendChild(card);
    }

    /**
     * Display the game over screen with score information.
     * @param {number} score
     * @param {number} highScore
     * @param {boolean} isNewRecord
     */
    show(score, highScore, isNewRecord) {
        if (!this._container) return;
        this._scoreEl.textContent = String(Math.floor(score));
        this._hiScoreEl.textContent = String(Math.floor(highScore));
        this._newRecordEl.style.display = isNewRecord ? 'block' : 'none';
    }

    /** Hide the game over screen. Visibility managed by ScreenManager. */
    hide() {
        if (this._newRecordEl) this._newRecordEl.style.display = 'none';
    }

    /** @private */
    _handleShare() {
        if (this.onShare) { this.onShare(); return; }
        const data = { title: 'XUP', text: 'Score: ' + (this._scoreEl ? this._scoreEl.textContent : '') };
        if (navigator.share) { navigator.share(data).catch(() => {}); }
    }

    /** @private */
    _label(text) {
        const el = document.createElement('div');
        el.textContent = text;
        el.style.cssText = 'color:#cfcfd5;font-size:14px;font-weight:900;letter-spacing:0.16em;';
        return el;
    }

    /** @private Pill button shared style. */
    _pillStyle() {
        return [
            'width:100%',
            'min-height:54px',
            'border-radius:14px',
            'font-family:inherit',
            'font-weight:900',
            'font-size:19px',
            'letter-spacing:0.06em',
            'cursor:pointer',
            'touch-action:manipulation',
            '',
        ].join(';');
    }

    /** @private Small hexagon badge with centered glyph. */
    _hexBadge(color, glyph) {
        return `<div style="width:54px;height:54px;display:flex;align-items:center;justify-content:center;`
            + `clip-path:polygon(25% 0%,75% 0%,100% 50%,75% 100%,25% 100%,0% 50%);`
            + `background:${color};color:#fff;font-size:24px;font-weight:900;">${glyph}</div>`;
    }

    /** @private Green bar-chart stats icon. */
    _statsIcon() {
        return `<svg width="46" height="46" viewBox="0 0 24 24" fill="#33AA2D">`
            + `<rect x="3" y="12" width="4.5" height="9" rx="1"/>`
            + `<rect x="9.7" y="7" width="4.5" height="14" rx="1"/>`
            + `<rect x="16.5" y="14" width="4.5" height="7" rx="1"/></svg>`;
    }
}
