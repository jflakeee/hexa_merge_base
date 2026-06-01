/**
 * @fileoverview Merge system handling BFS-based tile merging with depth tracking.
 * Ported from Unity C# MergeSystem.cs to pure JavaScript ES Module.
 */

import { HexCoord } from './HexCoord.js';
import { MAX_VALUE } from './TileHelper.js';

/**
 * @typedef {Object} MergeResult
 * @property {boolean} success - Whether the merge was successful
 * @property {HexCoord} tapCoord - The coordinate that was tapped
 * @property {number} baseValue - The original value of the tapped tile
 * @property {number} resultValue - The final merged value
 * @property {number} scoreGained - Points earned from this merge
 * @property {number} mergedCount - Total number of cells involved in the merge
 * @property {HexCoord[]} mergedCoords - All merged coordinates (tap coord first, then deepest-first)
 * @property {number[]} stepValues - Intermediate values at each depth step
 * @property {HexCoord[][]} depthGroups - Groups of coords by depth (deepest first)
 * @property {Map<string, string>} parentMap - Child coord key -> parent coord key (BFS tree)
 */

/**
 * Handles tile merge operations on a HexGrid using BFS with depth tracking.
 */
export class MergeSystem {
    /**
     * @type {import('./HexGrid.js').HexGrid}
     * @private
     */
    _grid;

    /**
     * @param {import('./HexGrid.js').HexGrid} grid
     */
    constructor(grid) {
        this._grid = grid;
    }

    /**
     * Attempt a merge starting from the tapped coordinate.
     * Uses BFS to find all connected cells with the same value,
     * tracks depth for value calculation, and applies the merge.
     *
     * @param {HexCoord} tapCoord
     * @returns {MergeResult|null} null if merge is not possible
     */
    tryMerge(tapCoord) {
        const tapCell = this._grid.getCell(tapCoord);
        if (!tapCell || tapCell.isEmpty) return null;

        const baseValue = tapCell.value;

        // BFS with depth tracking + parent tracking
        const visited = new Set();
        const queue = [];
        /** @type {Map<string, number>} coord key -> depth */
        const depthMap = new Map();
        /** @type {Map<string, string>} child key -> parent key */
        const parentMap = new Map();

        const startKey = tapCoord.toKey();
        queue.push(tapCoord);
        visited.add(startKey);
        depthMap.set(startKey, 0);

        while (queue.length > 0) {
            const current = queue.shift();
            const currentKey = current.toKey();
            const currentDepth = depthMap.get(currentKey);

            const neighbors = current.getNeighbors();
            for (let i = 0; i < neighbors.length; i++) {
                const nCoord = neighbors[i];
                const nKey = nCoord.toKey();

                if (visited.has(nKey)) continue;

                const nCell = this._grid.getCell(nCoord);
                if (!nCell || nCell.value !== baseValue) continue;

                visited.add(nKey);
                depthMap.set(nKey, currentDepth + 1);
                parentMap.set(nKey, currentKey);
                queue.push(nCoord);
            }
        }

        const totalCells = visited.size;
        if (totalCells < 2) return null;

        // Build depth groups (depth 0 = tapCoord, excluded from groups)
        /** @type {Map<number, HexCoord[]>} */
        const depthGroupsMap = new Map();
        let maxDepth = 0;

        for (const [key, depth] of depthMap) {
            if (depth === 0) continue; // skip tap cell
            if (!depthGroupsMap.has(depth)) {
                depthGroupsMap.set(depth, []);
            }
            depthGroupsMap.get(depth).push(HexCoord.fromKey(key));
            if (depth > maxDepth) maxDepth = depth;
        }

        // depthLevels = number of distinct BFS depth levels (used only for the
        // cascade animation grouping, not for the merge value).
        const depthLevels = depthGroupsMap.size;

        // Merge value follows the tree structure: each parent node that absorbs
        // its children multiplies the value — ×2 for a single child, ×4 when the
        // parent has 2 or more children. The total exponent is the sum of these
        // per-parent contributions (×2 = exponent 1, ×4 = exponent 2).
        const childCount = new Map();
        for (const [, parentKey] of parentMap) {
            childCount.set(parentKey, (childCount.get(parentKey) || 0) + 1);
        }
        let mergeExponent = 0;
        for (const [, count] of childCount) {
            mergeExponent += count >= 2 ? 2 : 1;
        }
        const mergedValue = this._calculateMergeValue(baseValue, mergeExponent);

        // StepValues: one per doubling step (drives intermediate count-up visuals)
        const stepValues = [];
        let stepValue = baseValue;
        for (let d = 0; d < mergeExponent; d++) {
            stepValue = Math.min(stepValue * 2, MAX_VALUE);
            stepValues.push(stepValue);
        }

        // Clear all merged cells, then set final value at tap position
        for (const key of visited) {
            const coord = HexCoord.fromKey(key);
            this._grid.getCell(coord).clear();
        }
        tapCell.setValue(mergedValue);

        // DepthGroups list: deepest first (reversed)
        const depthGroups = [];
        for (let d = maxDepth; d >= 1; d--) {
            if (depthGroupsMap.has(d)) {
                depthGroups.push(depthGroupsMap.get(d));
            }
        }

        // MergedCoords: tapCoord first, then remaining in deepest-first order
        const mergedCoords = [tapCoord];
        for (let i = 0; i < depthGroups.length; i++) {
            for (let j = 0; j < depthGroups[i].length; j++) {
                mergedCoords.push(depthGroups[i][j]);
            }
        }

        return {
            success: true,
            tapCoord,
            baseValue,
            resultValue: mergedValue,
            scoreGained: mergedValue * mergeExponent,
            mergedCount: totalCells,
            mergedCoords,
            stepValues,
            depthGroups,
            parentMap
        };
    }

    /**
     * Find all connected cells with the same value starting from a coordinate.
     * @param {HexCoord} startCoord
     * @returns {import('./HexCell.js').HexCell[]}
     */
    findConnectedGroup(startCoord) {
        const result = [];
        const startCell = this._grid.getCell(startCoord);
        if (!startCell || startCell.isEmpty) return result;

        const targetValue = startCell.value;
        const visited = new Set();
        const queue = [];

        const startKey = startCoord.toKey();
        queue.push(startCoord);
        visited.add(startKey);

        while (queue.length > 0) {
            const current = queue.shift();
            const cell = this._grid.getCell(current);
            result.push(cell);

            const neighbors = current.getNeighbors();
            for (let i = 0; i < neighbors.length; i++) {
                const nCoord = neighbors[i];
                const nKey = nCoord.toKey();

                if (visited.has(nKey)) continue;

                const nCell = this._grid.getCell(nCoord);
                if (!nCell || nCell.value !== targetValue) continue;

                visited.add(nKey);
                queue.push(nCoord);
            }
        }

        return result;
    }

    /**
     * Check whether a merge is possible at the given coordinate.
     * A merge requires at least 2 connected cells with the same value.
     * @param {HexCoord} coord
     * @returns {boolean}
     */
    canMerge(coord) {
        const cell = this._grid.getCell(coord);
        if (!cell || cell.isEmpty) return false;
        return this.findConnectedGroup(coord).length >= 2;
    }

    /**
     * Calculate the merged value: baseValue doubled `exponent` times.
     * exponent = floor(log2(totalMergedTiles)) per the benchmark rule.
     * @param {number} baseValue
     * @param {number} exponent - number of doublings
     * @returns {number}
     * @private
     */
    _calculateMergeValue(baseValue, exponent) {
        let value = baseValue;
        for (let i = 0; i < exponent; i++) {
            value *= 2;
            if (value >= MAX_VALUE) return MAX_VALUE;
        }
        return value;
    }
}
