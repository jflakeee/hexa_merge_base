/**
 * @fileoverview Hexagonal grid storing HexCells in a Map keyed by coordinate string.
 * Ported from Unity C# HexGrid.cs to pure JavaScript ES Module.
 */

import { HexCoord } from './HexCoord.js';
import { HexCell } from './HexCell.js';

/**
 * A hexagonal grid of cells using cube coordinates.
 * Internally uses a Map<string, HexCell> where keys are "q,r" strings.
 */
export class HexGrid {
    /**
     * @type {Map<string, HexCell>}
     * @private
     */
    _cells;

    constructor() {
        this._cells = new Map();
    }

    /**
     * Initialize (or reinitialize) the grid with a hexagonal shape of the given radius.
     * radius=2 produces 19 cells (3-4-5-4-3 pattern).
     * @param {number} [radius=2]
     */
    initialize(radius = 2) {
        this._cells.clear();

        for (let q = -radius; q <= radius; q++) {
            const r1 = Math.max(-radius, -q - radius);
            const r2 = Math.min(radius, -q + radius);

            for (let r = r1; r <= r2; r++) {
                const coord = new HexCoord(q, r);
                this._cells.set(coord.toKey(), new HexCell(coord));
            }
        }
    }

    /**
     * Get the cell at the given coordinate, or null if not part of the grid.
     * @param {HexCoord} coord
     * @returns {HexCell|null}
     */
    getCell(coord) {
        return this._cells.get(coord.toKey()) || null;
    }

    /**
     * Get all neighbor cells that exist on the grid for the given coordinate.
     * @param {HexCoord} coord
     * @returns {HexCell[]}
     */
    getNeighbors(coord) {
        const neighbors = [];
        const neighborCoords = coord.getNeighbors();
        for (let i = 0; i < neighborCoords.length; i++) {
            const cell = this._cells.get(neighborCoords[i].toKey());
            if (cell) {
                neighbors.push(cell);
            }
        }
        return neighbors;
    }

    /**
     * Get all empty cells on the grid.
     * @returns {HexCell[]}
     */
    getEmptyCells() {
        const empty = [];
        for (const cell of this._cells.values()) {
            if (cell.isEmpty) empty.push(cell);
        }
        return empty;
    }

    /**
     * Get all cells on the grid.
     * @returns {HexCell[]}
     */
    getAllCells() {
        return Array.from(this._cells.values());
    }

    /**
     * Check if every cell on the grid is occupied (non-empty).
     * @returns {boolean}
     */
    isFull() {
        for (const cell of this._cells.values()) {
            if (cell.isEmpty) return false;
        }
        return true;
    }

    /**
     * Check if there is at least one valid merge on the board.
     * A valid merge exists when two adjacent cells share the same non-zero value.
     * @returns {boolean}
     */
    hasValidMerge() {
        for (const [key, cell] of this._cells) {
            if (cell.isEmpty) continue;

            const coord = HexCoord.fromKey(key);
            const neighborCoords = coord.getNeighbors();
            for (let i = 0; i < neighborCoords.length; i++) {
                const neighbor = this._cells.get(neighborCoords[i].toKey());
                if (neighbor && neighbor.value === cell.value) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * Get the cell with the highest tile value on the grid.
     * @returns {HexCell|null}
     */
    getHighestValueCell() {
        let highest = null;
        let maxValue = 0;
        for (const cell of this._cells.values()) {
            if (cell.value > maxValue) {
                maxValue = cell.value;
                highest = cell;
            }
        }
        return highest;
    }

    /**
     * Get the minimum non-zero tile value on the grid.
     * Returns 2 if no non-empty cells exist.
     * @returns {number}
     */
    getMinDisplayedValue() {
        let min = Number.MAX_VALUE;
        for (const cell of this._cells.values()) {
            if (!cell.isEmpty && cell.value < min) {
                min = cell.value;
            }
        }
        return min >= Number.MAX_VALUE ? 2 : min;
    }

    /**
     * Number of cells in the grid.
     * @returns {number}
     */
    get cellCount() {
        return this._cells.size;
    }

    /**
     * All coordinate keys in the grid.
     * @returns {HexCoord[]}
     */
    get allCoords() {
        const coords = [];
        for (const key of this._cells.keys()) {
            coords.push(HexCoord.fromKey(key));
        }
        return coords;
    }
}
