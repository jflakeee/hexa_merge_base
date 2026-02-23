/**
 * @fileoverview Single hex cell on the board.
 * Ported from Unity C# HexCell.cs to pure JavaScript ES Module.
 */

import { formatValue } from './TileHelper.js';

/**
 * Represents a single cell in the hex grid.
 * Holds a coordinate, a numeric tile value, and a crown flag.
 */
export class HexCell {
    /** @type {import('./HexCoord.js').HexCoord} */
    coord;

    /** @type {number} Tile value (0 means empty) */
    value;

    /** @type {boolean} Whether this cell displays a crown (highest value indicator) */
    hasCrown;

    /**
     * @param {import('./HexCoord.js').HexCoord} coord
     */
    constructor(coord) {
        this.coord = coord;
        this.value = 0;
        this.hasCrown = false;
    }

    /**
     * Whether this cell is empty (no tile).
     * @returns {boolean}
     */
    get isEmpty() {
        return this.value <= 0;
    }

    /**
     * Set the tile value.
     * @param {number} val
     */
    setValue(val) {
        this.value = val;
    }

    /**
     * Clear the cell (set value to 0, remove crown).
     */
    clear() {
        this.value = 0;
        this.hasCrown = false;
    }

    /**
     * Get the current tile value.
     * @returns {number}
     */
    getValue() {
        return this.value;
    }

    /**
     * Get the formatted display text for this cell's value.
     * @returns {string} Empty string if the cell is empty.
     */
    getDisplayText() {
        if (this.value === 0) return '';
        return formatValue(this.value);
    }
}
