/**
 * Highlight UI Manager
 *
 * Manages the visual highlighting of the Sudoku grid when a cell is selected.
 * Applies CSS classes for:
 *  - `selected`    – the clicked cell itself
 *  - `highlighted` – all cells sharing the same row, column, or 3x3 block
 *  - `same-number` – all cells containing the same non-zero digit
 *
 * Uses validator helpers ({@link getRowCells}, {@link getColCells},
 * {@link getBlockCells}) to determine the related cells.
 *
 * @module ui/highlight
 */

import { getRowCells, getColCells, getBlockCells } from '../core/validator.js';

// ---------------------------------------------------------------------------
// CSS class names
// ---------------------------------------------------------------------------

const CLS_SELECTED    = 'selected';
const CLS_HIGHLIGHTED = 'highlighted';
const CLS_SAME_NUMBER = 'same-number';

// ---------------------------------------------------------------------------
// HighlightUI class
// ---------------------------------------------------------------------------

/**
 * @class HighlightUI
 */
export class HighlightUI {
    /**
     * Accepts either a GridUI instance (which has a `getCell` method) or a
     * raw grid container DOM element. When a DOM element is passed, cell
     * lookup is performed via `querySelector`.
     *
     * @param {import('./grid.js').GridUI | HTMLElement} gridUIOrEl - Grid
     *   renderer or the `.sudoku-grid` DOM element.
     */
    constructor(gridUIOrEl) {
        if (gridUIOrEl && typeof gridUIOrEl.getCell === 'function') {
            /** @type {import('./grid.js').GridUI} */
            this._gridUI = gridUIOrEl;
            this._container = null;
        } else {
            this._gridUI = null;
            /** @type {HTMLElement} */
            this._container = /** @type {HTMLElement} */ (gridUIOrEl);
        }
    }

    // -----------------------------------------------------------------------
    // Public methods
    // -----------------------------------------------------------------------

    /**
     * Apply all highlights for a selected cell:
     *  1. Clear every previous highlight.
     *  2. Mark the selected cell with `selected`.
     *  3. Mark same row / column / block cells with `highlighted`.
     *  4. Mark cells with the same non-zero digit with `same-number`.
     *
     * @param {number} row - Row index (0-8) of the selected cell.
     * @param {number} col - Column index (0-8) of the selected cell.
     * @param {number[][]} board - Current 9x9 board values for same-number lookup.
     */
    highlightSelection(row, col, board) {
        // 1. Clear all previous highlights
        this.clearAll();

        // 2. Selected cell
        const selectedCell = this._getCell(row, col);
        if (selectedCell) {
            selectedCell.classList.add(CLS_SELECTED);
        }

        // 3. Highlighted: same row, column, and block
        const relatedCells = [
            ...getRowCells(row),
            ...getColCells(col),
            ...getBlockCells(row, col),
        ];

        // De-duplicate using a position key set
        const seen = new Set();
        for (const pos of relatedCells) {
            const key = pos.row * 9 + pos.col;
            if (seen.has(key)) continue;
            seen.add(key);

            // Don't double-style the selected cell with 'highlighted'
            if (pos.row === row && pos.col === col) continue;

            const cellEl = this._getCell(pos.row, pos.col);
            if (cellEl) {
                cellEl.classList.add(CLS_HIGHLIGHTED);
            }
        }

        // 4. Same number
        const selectedValue = board[row][col];
        if (selectedValue !== 0) {
            for (let r = 0; r < 9; r++) {
                for (let c = 0; c < 9; c++) {
                    if (board[r][c] === selectedValue) {
                        const cellEl = this._getCell(r, c);
                        if (cellEl) {
                            cellEl.classList.add(CLS_SAME_NUMBER);
                        }
                    }
                }
            }
        }
    }

    /**
     * Remove all highlight-related classes from every cell on the grid.
     */
    clearAll() {
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                const cellEl = this._getCell(r, c);
                if (cellEl) {
                    cellEl.classList.remove(CLS_SELECTED, CLS_HIGHLIGHTED, CLS_SAME_NUMBER);
                }
            }
        }
    }

    // -----------------------------------------------------------------------
    // Private helpers
    // -----------------------------------------------------------------------

    /**
     * Get a cell DOM element by row and column. Delegates to the GridUI
     * instance if available, otherwise queries the container element.
     *
     * @param {number} row
     * @param {number} col
     * @returns {HTMLElement|null}
     * @private
     */
    _getCell(row, col) {
        if (this._gridUI) {
            return this._gridUI.getCell(row, col);
        }
        if (this._container) {
            return this._container.querySelector(
                `.cell[data-row="${row}"][data-col="${col}"]`
            );
        }
        return null;
    }
}
