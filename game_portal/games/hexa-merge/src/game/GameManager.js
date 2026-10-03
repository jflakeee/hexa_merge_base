/**
 * @fileoverview Main game manager orchestrating game state, merges, scoring, and tile lifecycle.
 * Ported from Unity C# GameManager.cs to pure JavaScript ES Module.
 * Extends EventTarget for DOM-style event dispatching instead of C# events/delegates.
 */

import { HexGrid } from '../core/HexGrid.js';
import { HexCoord } from '../core/HexCoord.js';
import { MergeSystem } from '../core/MergeSystem.js';
import { ScoreManager } from './ScoreManager.js';
import * as TileHelper from '../core/TileHelper.js';
import * as SaveSystem from './SaveSystem.js';

/**
 * Game states.
 * @enum {string}
 */
export const GameState = Object.freeze({
    READY:     'ready',
    PLAYING:   'playing',
    ANIMATING: 'animating',
    PAUSED:    'paused',
    GAMEOVER:  'gameover'
});

/**
 * Number of tiles to place on initial board setup.
 * @type {number}
 */
const INITIAL_TILE_COUNT = 19;

/**
 * Main game manager.
 *
 * Events dispatched (via CustomEvent on EventTarget):
 * - 'statechange'  detail: { state: GameState }
 * - 'merge'        detail: { result: MergeResult }
 * - 'scoreupdate'  detail: { currentScore: number, highScore: number }
 * - 'newtiles'     detail: { cells: HexCell[] }
 * - 'crownchange'  detail: { crownCoords: HexCoord[] }
 */
export class GameManager extends EventTarget {
    /** @type {string} Current game state */
    state;

    /** @type {HexGrid} */
    grid;

    /** @type {MergeSystem} */
    mergeSystem;

    /** @type {ScoreManager} */
    score;

    constructor() {
        super();
        this.grid = new HexGrid();
        this.grid.initialize();
        this.mergeSystem = new MergeSystem(this.grid);
        this.score = new ScoreManager();
        this.state = GameState.READY;
        this._crownState = { highestValue: 0, key: '' };

        // Wire up score callbacks to dispatch events
        this.score.onScoreChanged.push((current) => {
            this._dispatch('scoreupdate', {
                currentScore: current,
                highScore: this.score.highScore
            });
        });
        this.score.onHighScoreChanged.push((high) => {
            this._dispatch('scoreupdate', {
                currentScore: this.score.currentScore,
                highScore: high
            });
        });
    }

    /**
     * Start a new game.
     * Reinitializes the grid, resets score, places initial tiles,
     * sets crowns, and transitions to Playing state.
     */
    startNewGame() {
        this.grid.initialize();
        this.score.reset();

        // Place initial tiles ensuring at least one merge is possible
        let attempts = 0;
        do {
            // Clear all cells
            const allCells = this.grid.getAllCells();
            for (const cell of allCells) {
                cell.clear();
            }

            // Pick INITIAL_TILE_COUNT random positions
            const allCoords = this.grid.allCoords;
            this._shuffle(allCoords);
            for (let i = 0; i < INITIAL_TILE_COUNT && i < allCoords.length; i++) {
                const cell = this.grid.getCell(allCoords[i]);
                cell.setValue(TileHelper.getInitialValue());
            }

            attempts++;
        } while (!this.grid.hasValidMerge() && attempts < 100);

        this.updateCrowns('init');
        this._setState(GameState.PLAYING);
    }

    /**
     * Restore a saved game state.
     * @param {import('./SaveSystem.js').GameSaveData} data
     */
    restoreGame(data) {
        SaveSystem.applyToGrid(data, this.grid);
        this.score.reset();
        this.score.currentScore = data.score;
        this.score._notifyScoreChanged();
        this.updateCrowns('restore');
        this._setState(GameState.PLAYING);
    }

    /**
     * Callback for each merge step animation.
     * Set by main.js to handle animation + SFX per step.
     * Must return a Promise that resolves when the step animation is done.
     * @type {function(Object): Promise<void>|null}
     */
    onMergeStep = null;

    /**
     * Handle a tap on a hex coordinate.
     * Uses prepareMerge for step-by-step animated merging.
     * @param {import('../core/HexCoord.js').HexCoord} coord
     */
    async handleTap(coord) {
        if (this.state !== GameState.PLAYING) return;

        const result = this.mergeSystem.prepareMerge(coord);
        if (!result || !result.success) return;

        const previousMax = this._getHighestValue();
        this._setState(GameState.ANIMATING);

        const tapCell = this.grid.getCell(result.tapCoord);
        const cellValue = result.baseValue;

        // Step-by-step merge animation (deepest depth group first)
        for (let i = 0; i < result.depthGroups.length; i++) {
            const group = result.depthGroups[i];
            const stepValue = result.stepValues[i];

            // Clear source cells before animation (ghost cells handle the visual)
            for (const c of group) {
                this.grid.getCell(c).clear();
            }

            // Await step animation callback (direct async call, not event-based)
            if (this.onMergeStep) {
                await this.onMergeStep({
                    group,
                    cellValue,
                    tapCoord: result.tapCoord,
                    parentMap: result.parentMap,
                    stepValue,
                    stepIndex: i,
                    totalSteps: result.depthGroups.length,
                });
            }

            // Update tap cell to intermediate value
            tapCell.setValue(stepValue);
        }

        // Add score
        this.score.addScore(result.scoreGained);

        // Dispatch merge event (score popup, effects)
        this._dispatch('merge', { result });

        // 128x destruction rule
        if (result.resultValue > previousMax) {
            this.destroySmallBlocks(result.resultValue);
        }

        // Refill empty cells
        const filledCells = this.fillAllEmptyCells(false);
        this._dispatch('newtiles', { cells: filledCells });

        // Update crowns
        this.updateCrowns();

        // Resume playing and check game over
        this._setState(GameState.PLAYING);
        this.checkGameOver();
    }

    /**
     * Destroy all blocks with value <= maxValue / 128.
     * @param {number} maxValue - The new maximum value on the board
     */
    destroySmallBlocks(maxValue) {
        const threshold = maxValue / 128;
        if (threshold < TileHelper.MIN_VALUE) return;

        let destroyed = 0;
        const allCoords = this.grid.allCoords;
        for (let i = 0; i < allCoords.length; i++) {
            const cell = this.grid.getCell(allCoords[i]);
            if (cell && !cell.isEmpty && cell.value <= threshold) {
                cell.clear();
                destroyed++;
            }
        }

        if (destroyed > 0) {
            console.log(`[GameManager] 128x rule: destroyed ${destroyed} blocks <= ${threshold}`);
        }
    }

    /**
     * Fill all empty cells with tile values.
     * @param {boolean} useInitial - If true, use initial value distribution; otherwise use refill distribution.
     * @returns {import('../core/HexCell.js').HexCell[]} The cells that were filled.
     */
    fillAllEmptyCells(useInitial) {
        const minDisplayed = this.grid.getMinDisplayedValue();
        const emptyCells = this.grid.getEmptyCells();
        for (let i = 0; i < emptyCells.length; i++) {
            const value = useInitial
                ? TileHelper.getInitialValue()
                : TileHelper.getRefillValue(minDisplayed);
            emptyCells[i].setValue(value);
        }
        return emptyCells;
    }

    /**
     * Update crown flags: only the cell(s) with the highest value get crowns.
     */
    updateCrowns(reason = 'merge') {
        const allCells = this.grid.getAllCells();
        let highestValue = 0;

        for (let i = 0; i < allCells.length; i++) {
            if (allCells[i].value > highestValue) {
                highestValue = allCells[i].value;
            }
        }

        const crownCoords = [];
        for (let i = 0; i < allCells.length; i++) {
            const hasCrown = highestValue > 0 && allCells[i].value === highestValue;
            allCells[i].hasCrown = hasCrown;
            if (hasCrown) {
                crownCoords.push(allCells[i].coord);
            }
        }

        const key = crownCoords.map(c => `${c.q},${c.r}`).sort().join(';');
        const previousHighestValue = this._crownState.highestValue;
        const changed = highestValue !== previousHighestValue || key !== this._crownState.key;
        this._crownState = { highestValue, key };
        this._dispatch('crownchange', {
            crownCoords, previousHighestValue, highestValue, changed, reason,
            playSound: changed && highestValue > 0 && ['merge', 'continue'].includes(reason),
            soundVariant: highestValue > previousHighestValue ? 'upgrade' : 'basic',
        });
    }

    /**
     * Check if the game is over (board full and no valid merges).
     */
    checkGameOver() {
        if (this.grid.isFull() && !this.grid.hasValidMerge()) {
            this.score.saveHighScore();
            this._setState(GameState.GAMEOVER);
        }
    }

    /**
     * Continue playing after game over by removing 3 random tiles.
     */
    continueAfterGameOver() {
        if (this.state !== GameState.GAMEOVER) return;

        // If no empty cells, remove up to 3 random non-empty tiles
        if (this.grid.getEmptyCells().length === 0) {
            const nonEmpty = [];
            const allCoords = this.grid.allCoords;
            for (let i = 0; i < allCoords.length; i++) {
                const cell = this.grid.getCell(allCoords[i]);
                if (cell && !cell.isEmpty) {
                    nonEmpty.push(cell);
                }
            }

            const removeCount = Math.min(3, nonEmpty.length);
            for (let i = 0; i < removeCount; i++) {
                const idx = Math.floor(Math.random() * nonEmpty.length);
                nonEmpty[idx].clear();
                nonEmpty.splice(idx, 1);
            }
        }

        // Refill empty cells, update crowns, and resume
        const filledCells = this.fillAllEmptyCells(false);
        this._dispatch('newtiles', { cells: filledCells });
        this.updateCrowns('continue');
        this._setState(GameState.PLAYING);
        this.checkGameOver();
    }

    /**
     * Pause the game (only from Playing state).
     */
    pauseGame() {
        if (this.state === GameState.PLAYING) {
            this._setState(GameState.PAUSED);
        }
    }

    /**
     * Resume the game (only from Paused state).
     */
    resumeGame() {
        if (this.state === GameState.PAUSED) {
            this._setState(GameState.PLAYING);
        }
    }

    /**
     * Force game over (for testing purposes).
     */
    forceGameOver() {
        if (this.state === GameState.GAMEOVER) return;
        this.score.saveHighScore();
        this._setState(GameState.GAMEOVER);
    }

    /**
     * Get the highest tile value currently on the board.
     * @returns {number}
     * @private
     */
    _getHighestValue() {
        let max = 0;
        const allCoords = this.grid.allCoords;
        for (let i = 0; i < allCoords.length; i++) {
            const cell = this.grid.getCell(allCoords[i]);
            if (cell && cell.value > max) {
                max = cell.value;
            }
        }
        return max;
    }

    /**
     * Set the game state and dispatch a statechange event.
     * @param {string} newState
     * @private
     */
    _setState(newState) {
        if (this.state === newState) return;
        this.state = newState;
        this._dispatch('statechange', { state: newState });
    }

    /**
     * Dispatch a CustomEvent with the given type and detail data.
     * @param {string} type
     * @param {Object} detail
     * @private
     */
    _dispatch(type, detail) {
        this.dispatchEvent(new CustomEvent(type, { detail }));
    }

    /**
     * Fisher-Yates shuffle an array in place.
     * @param {Array} arr
     * @private
     */
    _shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const tmp = arr[i];
            arr[i] = arr[j];
            arr[j] = tmp;
        }
    }
}
