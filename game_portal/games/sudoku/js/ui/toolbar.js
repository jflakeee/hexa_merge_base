/**
 * Toolbar UI Controller
 *
 * Manages the four tool buttons below the Sudoku grid: Undo, Erase, Notes,
 * and Hint. Reads `data-action` attributes from `.tool-btn` elements and
 * dispatches a unified callback.
 *
 * @module ui/toolbar
 */

// ---------------------------------------------------------------------------
// ToolbarUI class
// ---------------------------------------------------------------------------

/**
 * @class ToolbarUI
 */
export class ToolbarUI {
    /**
     * @param {HTMLElement} containerEl - The `.toolbar` container element.
     */
    constructor(containerEl) {
        /** @type {HTMLElement} */
        this._container = containerEl;

        /** @type {HTMLElement|null} */
        this._notesBtn = containerEl.querySelector('.tool-btn[data-action="notes"]');

        /** @type {HTMLElement|null} */
        this._hintBtn = containerEl.querySelector('.tool-btn[data-action="hint"]');

        /** @type {HTMLElement|null} */
        this._undoBtn = containerEl.querySelector('.tool-btn[data-action="undo"]');

        /** @type {HTMLElement|null} */
        this._eraseBtn = containerEl.querySelector('.tool-btn[data-action="erase"]');
    }

    // -----------------------------------------------------------------------
    // Public methods
    // -----------------------------------------------------------------------

    /**
     * Update the Notes button visual to reflect whether note mode is active.
     *
     * @param {boolean} active - `true` = ON, `false` = OFF.
     */
    setNoteMode(active) {
        if (!this._notesBtn) return;

        const statusEl = this._notesBtn.querySelector('.tool-status');
        if (statusEl) {
            statusEl.textContent = active ? 'ON' : 'OFF';
        }

        this._notesBtn.classList.toggle('active', active);
    }

    /**
     * Update the hint badge number displayed next to the Hint button.
     *
     * @param {number} count - Remaining hint uses.
     */
    setHintCount(count) {
        if (!this._hintBtn) return;

        const badgeEl = this._hintBtn.querySelector('.tool-badge');
        if (badgeEl) {
            badgeEl.textContent = String(count);

            // Hide badge when 0
            badgeEl.style.display = count > 0 ? '' : 'none';
        }
    }

    /**
     * Enable or disable the Undo button.
     *
     * @param {boolean} enabled
     */
    setUndoEnabled(enabled) {
        if (!this._undoBtn) return;

        this._undoBtn.classList.toggle('disabled', !enabled);
        this._undoBtn.disabled = !enabled;
    }

    /**
     * Register a unified callback for all toolbar button clicks.
     * Uses event delegation on the toolbar container.
     *
     * @param {(action: 'undo'|'erase'|'notes'|'hint') => void} callback
     */
    onAction(callback) {
        this._container.addEventListener('click', (e) => {
            const btn = /** @type {HTMLElement} */ (e.target).closest('.tool-btn[data-action]');
            if (!btn) return;

            // Don't fire for disabled buttons
            if (btn.classList.contains('disabled') || btn.disabled) return;

            const action = btn.getAttribute('data-action');

            if (action === 'undo' || action === 'erase' || action === 'notes' || action === 'hint') {
                callback(/** @type {'undo'|'erase'|'notes'|'hint'} */ (action));
            }
        });
    }
}
