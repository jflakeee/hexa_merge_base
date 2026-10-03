/**
 * @fileoverview Statistics overlay screen (XUP benchmark style).
 * Purple gradient header, stats rows, close button.
 * ES Module - pure web implementation.
 */

import { formatValue } from '../core/TileHelper.js';
import { setScoreText } from '../core/ScoreFormatter.js';

export class StatsScreen {
    constructor() {
        /** @type {HTMLElement|null} */
        this._container = null;
        /** @type {Object<string, HTMLElement>} */
        this._els = {};
        /** Callback when "Close" is pressed. @type {function|null} */
        this.onClose = null;
    }

    /**
     * Build the stats screen DOM inside the given container.
     * @param {HTMLElement} container
     */
    init(container) {
        this._container = container;
        container.innerHTML = '';

        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'width:100%;max-width:360px;border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.5);';

        // --- Purple gradient header ---
        const header = document.createElement('div');
        header.style.cssText = 'background:linear-gradient(135deg,#7B1FA2,#9C27B0);padding:18px 20px;text-align:center;';
        const title = document.createElement('div');
        title.style.cssText = 'color:#FFF;font-size:24px;font-weight:900;letter-spacing:3px;';
        title.textContent = 'STATISTICS';
        header.appendChild(title);
        wrapper.appendChild(header);

        // --- Body ---
        const body = document.createElement('div');
        body.style.cssText = 'background:var(--card-bg, #1a1a1e);padding:24px 20px 28px;border-radius:0 0 16px 16px;';

        // Stat rows
        const stats = [
            { key: 'totalGames', label: 'Games Played', format: 'number' },
            { key: 'totalMerges', label: 'Total Merges', format: 'number' },
            { key: 'highScore', label: 'High Score', format: 'score' },
            { key: 'highestTile', label: 'Highest Tile', format: 'tile' },
            { key: 'longestChain', label: 'Longest Chain', format: 'number' },
            { key: 'totalScore', label: 'Total Score', format: 'score' },
        ];

        for (const stat of stats) {
            const row = document.createElement('div');
            row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid rgba(128,128,128,0.2);';

            const label = document.createElement('span');
            label.style.cssText = 'color:var(--text-secondary, #888);font-size:14px;font-weight:700;letter-spacing:1px;';
            label.textContent = stat.label;

            const value = document.createElement('span');
            value.style.cssText = 'color:var(--text-primary, #FFF);font-size:20px;font-weight:900;';
            value.textContent = '0';
            this._els[stat.key] = { el: value, format: stat.format };

            row.appendChild(label);
            row.appendChild(value);
            body.appendChild(row);
        }

        // Close button
        const closeBtn = document.createElement('button');
        closeBtn.style.cssText = 'width:100%;padding:14px 32px;border-radius:25px;border:none;background:#E91E63;color:#FFF;font-size:18px;font-weight:700;cursor:pointer;transition:transform 0.1s;min-height:44px;letter-spacing:1px;margin-top:20px;';
        closeBtn.textContent = 'CLOSE';
        closeBtn.addEventListener('click', () => {
            if (this.onClose) this.onClose();
        });
        closeBtn.addEventListener('pointerdown', () => { closeBtn.style.transform = 'scale(0.95)'; });
        closeBtn.addEventListener('pointerup', () => { closeBtn.style.transform = ''; });
        body.appendChild(closeBtn);

        wrapper.appendChild(body);
        container.appendChild(wrapper);
    }

    /**
     * Display the stats screen with current statistics.
     * @param {Object} stats - Stats object from StatsSystem.getStats()
     */
    show(stats) {
        if (!this._container) return;
        for (const [key, entry] of Object.entries(this._els)) {
            const val = stats[key];
            if (val !== undefined) {
                if (entry.format === 'score') {
                    setScoreText(entry.el, val);
                    continue;
                }
                entry.el.textContent = entry.format === 'tile'
                    ? formatValue(val)
                    : val.toLocaleString();
            }
        }
    }

    /** Hide the stats screen. */
    hide() {
        // Visibility managed by ScreenManager
    }
}
