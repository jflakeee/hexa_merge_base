/**
 * Grid UI – DOM Renderer
 *
 * Creates and manages the 81 cell elements inside the Sudoku grid container.
 * All cell interactions use a single event-delegated listener on the grid for
 * optimal performance.
 *
 * Cell DOM structure (per cell):
 * ```html
 * <div class="cell" data-row="0" data-col="0">
 *   <span class="cell-value"></span>
 *   <div class="cell-notes">
 *     <span class="note note-1"></span>
 *     ...
 *     <span class="note note-9"></span>
 *   </div>
 * </div>
 * ```
 *
 * @module ui/grid
 */

// ---------------------------------------------------------------------------
// GridUI class
// ---------------------------------------------------------------------------

/**
 * @class GridUI
 */
export class GridUI {
    /**
     * @param {HTMLElement} containerEl - The `.sudoku-grid` container element.
     */
    constructor(containerEl) {
        /** @type {HTMLElement} */
        this._container = containerEl;

        /**
         * Flat lookup: cells[row * 9 + col] → cell element.
         * @type {HTMLElement[]}
         */
        this._cells = [];

        this._buildGrid();
    }

    // -----------------------------------------------------------------------
    // Rendering
    // -----------------------------------------------------------------------

    /**
     * Render (or re-render) the entire board.
     *
     * @param {number[][]} board - 9x9 board values (0 = empty).
     * @param {boolean[][]} given - 9x9 given flags.
     */
    renderBoard(board, given) {
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                const value = board[r][c];
                const state = given[r][c] ? 'given' : (value !== 0 ? 'user-input' : '');
                this.updateCell(r, c, value, state);
                // Clear any leftover notes when rendering full board
                this._clearNotes(r, c);
            }
        }
    }

    /**
     * Update a single cell's displayed value and visual state.
     *
     * @param {number} row
     * @param {number} col
     * @param {number} value - 0 to clear, 1-9 to show a digit.
     * @param {string} state - CSS modifier: 'given', 'user-input', 'error', or '' to reset.
     */
    updateCell(row, col, value, state) {
        const cell = this.getCell(row, col);
        if (!cell) return;

        const valueEl = cell.querySelector('.cell-value');
        const notesEl = cell.querySelector('.cell-notes');

        // Set displayed value
        if (value !== 0) {
            valueEl.textContent = String(value);
            valueEl.style.display = '';
            notesEl.style.display = 'none';
        } else {
            valueEl.textContent = '';
            valueEl.style.display = 'none';
            // Notes visibility is controlled by showNotes
        }

        // State classes
        cell.classList.remove('given', 'user-input', 'error');
        if (state) {
            cell.classList.add(state);
        }
    }

    /**
     * Display notes (pencil marks) inside a cell as a 3x3 mini-grid.
     *
     * @param {number} row
     * @param {number} col
     * @param {Set<number>|number[]} notes - The set/array of note digits (1-9).
     */
    showNotes(row, col, notes) {
        const cell = this.getCell(row, col);
        if (!cell) return;

        const valueEl = cell.querySelector('.cell-value');
        const notesEl = cell.querySelector('.cell-notes');

        const noteSet = notes instanceof Set ? notes : new Set(notes);

        // Hide the main value, show the notes container
        valueEl.style.display = 'none';
        notesEl.style.display = '';

        for (let n = 1; n <= 9; n++) {
            const noteSpan = notesEl.querySelector(`.note-${n}`);
            if (noteSpan) {
                noteSpan.textContent = noteSet.has(n) ? String(n) : '';
            }
        }
    }

    /**
     * Clear all content from a cell (value and notes).
     *
     * @param {number} row
     * @param {number} col
     */
    clearCell(row, col) {
        this.updateCell(row, col, 0, '');
        this._clearNotes(row, col);
    }

    /**
     * Get the DOM element for a specific cell.
     *
     * @param {number} row
     * @param {number} col
     * @returns {HTMLElement|null}
     */
    getCell(row, col) {
        return this._cells[row * 9 + col] || null;
    }

    // -----------------------------------------------------------------------
    // Animations
    // -----------------------------------------------------------------------

    /**
     * Play a quick "pop" (scale-up-then-back) animation on a cell.
     *
     * @param {number} row
     * @param {number} col
     */
    animatePop(row, col) {
        const cell = this.getCell(row, col);
        if (!cell) return;

        cell.classList.remove('pop');
        // Force reflow so the animation restarts even if the class was just removed
        void cell.offsetWidth;
        cell.classList.add('pop');

        cell.addEventListener('animationend', () => {
            cell.classList.remove('pop');
        }, { once: true });
    }

    /**
     * Play a sequential "wave" animation across all cells (used on game
     * completion). Each cell gets a staggered delay.
     *
     * @param {Function} [callback] - Called after the wave finishes.
     */
    animateWave(callback) {
        const totalCells = 81;
        const delayPerCell = 30; // ms
        let finished = 0;

        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                const cell = this.getCell(r, c);
                if (!cell) {
                    finished++;
                    continue;
                }

                const delay = (r + c) * delayPerCell;

                setTimeout(() => {
                    cell.classList.add('wave');

                    cell.addEventListener('animationend', () => {
                        cell.classList.remove('wave');
                        finished++;
                        if (finished >= totalCells && callback) {
                            callback();
                        }
                    }, { once: true });
                }, delay);
            }
        }
    }

    /**
     * Play a shake animation on a cell (used for wrong input).
     *
     * @param {number} row
     * @param {number} col
     */
    animateError(row, col) {
        const cell = this.getCell(row, col);
        if (!cell) return;

        cell.classList.remove('shake');
        void cell.offsetWidth;
        cell.classList.add('shake');

        cell.addEventListener('animationend', () => {
            cell.classList.remove('shake');
        }, { once: true });
    }

    /**
     * Show a floating "+250" score text above a cell that floats upward
     * and fades out.
     *
     * @param {number} row
     * @param {number} col
     * @param {number} score - The score value to display.
     */
    showScoreFloat(row, col, score) {
        const cell = this.getCell(row, col);
        if (!cell) return;

        const float = document.createElement('span');
        float.className = 'score-float';
        float.textContent = `+${score}`;

        cell.appendChild(float);

        float.addEventListener('animationend', () => {
            float.remove();
        }, { once: true });

        // Fallback removal in case animationend doesn't fire
        setTimeout(() => {
            if (float.parentNode) float.remove();
        }, 1500);
    }

    // -----------------------------------------------------------------------
    // Event delegation
    // -----------------------------------------------------------------------

    /**
     * Register a callback for cell click events using event delegation.
     * The callback receives (row, col) of the clicked cell.
     *
     * @param {(row: number, col: number) => void} callback
     */
    onCellClick(callback) {
        this._container.addEventListener('click', (e) => {
            const cellEl = /** @type {HTMLElement} */ (e.target).closest('.cell');
            if (!cellEl) return;

            const row = parseInt(cellEl.getAttribute('data-row'), 10);
            const col = parseInt(cellEl.getAttribute('data-col'), 10);

            if (!isNaN(row) && !isNaN(col)) {
                callback(row, col);
            }
        });
    }

    // -----------------------------------------------------------------------
    // Private helpers
    // -----------------------------------------------------------------------

    /**
     * Build the 81 cell DOM elements inside the grid container.
     * @private
     */
    _buildGrid() {
        this._container.innerHTML = '';
        this._cells = [];

        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                cell.setAttribute('data-row', String(r));
                cell.setAttribute('data-col', String(c));

                // Add block-boundary classes for thicker CSS borders
                if (c % 3 === 0 && c !== 0) cell.classList.add('block-left');
                if (r % 3 === 0 && r !== 0) cell.classList.add('block-top');

                // Value element
                const valueSpan = document.createElement('span');
                valueSpan.className = 'cell-value';
                cell.appendChild(valueSpan);

                // Notes container (3x3 mini-grid)
                const notesDiv = document.createElement('div');
                notesDiv.className = 'cell-notes';
                notesDiv.style.display = 'none';

                for (let n = 1; n <= 9; n++) {
                    const noteSpan = document.createElement('span');
                    noteSpan.className = `note note-${n}`;
                    notesDiv.appendChild(noteSpan);
                }

                cell.appendChild(notesDiv);
                this._container.appendChild(cell);
                this._cells.push(cell);
            }
        }
    }

    /**
     * Clear all note indicators in a cell.
     *
     * @param {number} row
     * @param {number} col
     * @private
     */
    _clearNotes(row, col) {
        const cell = this.getCell(row, col);
        if (!cell) return;

        const notesEl = cell.querySelector('.cell-notes');
        if (notesEl) {
            notesEl.style.display = 'none';
            for (let n = 1; n <= 9; n++) {
                const noteSpan = notesEl.querySelector(`.note-${n}`);
                if (noteSpan) noteSpan.textContent = '';
            }
        }
    }
}
