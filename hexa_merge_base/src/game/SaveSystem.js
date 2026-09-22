/**
 * @fileoverview Game state persistence using localStorage and JSON.
 * Ported from Unity C# SaveSystem.cs to pure JavaScript ES Module.
 * Uses localStorage instead of PlayerPrefs, JSON.parse/stringify instead of JsonUtility.
 */

import { HexCoord } from '../core/HexCoord.js';

const SAVE_KEY = 'hexamerge_save';

/**
 * @typedef {Object} CellSaveData
 * @property {number} q
 * @property {number} r
 * @property {number} value
 */

/**
 * @typedef {Object} GameSaveData
 * @property {number} score
 * @property {CellSaveData[]} cells
 */

/**
 * Save the current grid state and score to localStorage.
 * Only non-empty cells are stored.
 * @param {import('../core/HexGrid.js').HexGrid} grid
 * @param {number} score
 */
export function save(grid, score) {
    /** @type {GameSaveData} */
    const data = {
        score,
        cells: []
    };

    const allCoords = grid.allCoords;
    for (let i = 0; i < allCoords.length; i++) {
        const coord = allCoords[i];
        const cell = grid.getCell(coord);
        if (cell && !cell.isEmpty) {
            data.cells.push({
                q: coord.q,
                r: coord.r,
                value: cell.value
            });
        }
    }

    try {
        const json = JSON.stringify(data);
        localStorage.setItem(SAVE_KEY, json);
    } catch (e) {
        console.warn('[SaveSystem] Failed to save game:', e);
    }
}

/**
 * Load saved game data from localStorage.
 * @returns {GameSaveData|null} Parsed save data, or null if no save exists or parsing fails.
 */
export function load() {
    try {
        const json = localStorage.getItem(SAVE_KEY);
        if (!json) return null;

        const data = JSON.parse(json);
        if (!data || typeof data.score !== 'number' || !Array.isArray(data.cells)) {
            return null;
        }

        return data;
    } catch (e) {
        console.warn('[SaveSystem] Failed to load game:', e);
        return null;
    }
}

/**
 * Check whether a save exists in localStorage.
 * @returns {boolean}
 */
export function hasSave() {
    try {
        return localStorage.getItem(SAVE_KEY) !== null;
    } catch (e) {
        return false;
    }
}

/**
 * Delete the save data from localStorage.
 */
export function deleteSave() {
    try {
        localStorage.removeItem(SAVE_KEY);
    } catch (e) {
        console.warn('[SaveSystem] Failed to delete save:', e);
    }
}

/**
 * Apply loaded save data to a grid.
 * Clears all cells first, then sets values from the save data.
 * @param {GameSaveData} data
 * @param {import('../core/HexGrid.js').HexGrid} grid
 */
export function applyToGrid(data, grid) {
    // Clear all cells first
    const allCoords = grid.allCoords;
    for (let i = 0; i < allCoords.length; i++) {
        const cell = grid.getCell(allCoords[i]);
        if (cell) cell.clear();
    }

    // Apply saved cell values
    for (let i = 0; i < data.cells.length; i++) {
        const cellData = data.cells[i];
        const coord = new HexCoord(cellData.q, cellData.r);
        const cell = grid.getCell(coord);
        if (cell) {
            cell.setValue(cellData.value);
        }
    }
}
