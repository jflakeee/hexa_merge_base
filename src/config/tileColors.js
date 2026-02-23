/**
 * @fileoverview Tile color configuration for Hexa Merge.
 * Maps tile values to background and text colors.
 * For values beyond 65536, colors cycle based on tile level % 16.
 */

import { getTileLevel } from '../core/TileHelper.js';

/**
 * @typedef {Object} TileColor
 * @property {string} bg - Background color (hex string)
 * @property {string} text - Text color (hex string)
 */

/**
 * 16-color mapping for tile values 2 through 65536.
 * @type {Object<number, TileColor>}
 */
export const TILE_COLORS = {
    2:     { bg: '#FFD700', text: '#FFFFFF' },
    4:     { bg: '#FF6B35', text: '#FFFFFF' },
    8:     { bg: '#EC407A', text: '#FFFFFF' },
    16:    { bg: '#880E4F', text: '#FFFFFF' },
    32:    { bg: '#C2185B', text: '#FFFFFF' },
    64:    { bg: '#8E24AA', text: '#FFFFFF' },
    128:   { bg: '#4A148C', text: '#FFFFFF' },
    256:   { bg: '#7C4DFF', text: '#FFFFFF' },
    512:   { bg: '#1976D2', text: '#FFFFFF' },
    1024:  { bg: '#00897B', text: '#FFFFFF' },
    2048:  { bg: '#9ACD32', text: '#333333' },
    4096:  { bg: '#4CAF50', text: '#FFFFFF' },
    8192:  { bg: '#00695C', text: '#FFFFFF' },
    16384: { bg: '#FFB300', text: '#333333' },
    32768: { bg: '#E64A19', text: '#FFFFFF' },
    65536: { bg: '#E91E63', text: '#FFFFFF' },
};

/**
 * Color entries as an ordered array for level-based cycling.
 * Index 0 = level 0 (value 2), index 1 = level 1 (value 4), etc.
 * @type {TileColor[]}
 */
const COLOR_ENTRIES = [
    TILE_COLORS[2],
    TILE_COLORS[4],
    TILE_COLORS[8],
    TILE_COLORS[16],
    TILE_COLORS[32],
    TILE_COLORS[64],
    TILE_COLORS[128],
    TILE_COLORS[256],
    TILE_COLORS[512],
    TILE_COLORS[1024],
    TILE_COLORS[2048],
    TILE_COLORS[4096],
    TILE_COLORS[8192],
    TILE_COLORS[16384],
    TILE_COLORS[32768],
    TILE_COLORS[65536],
];

/** Background color for empty cells. */
export const emptyColor = '#383840';

/**
 * Get the background color for a tile value.
 * Direct match for values 2-65536; level-based cycling for higher values.
 * @param {number} value
 * @returns {string} Hex color string
 */
export function getColor(value) {
    if (value <= 0) return emptyColor;

    // Direct lookup first
    const direct = TILE_COLORS[value];
    if (direct) return direct.bg;

    // Level-based cycling for values beyond 65536
    const level = getTileLevel(value);
    const idx = level % COLOR_ENTRIES.length;
    return COLOR_ENTRIES[idx].bg;
}

/**
 * Get the text color for a tile value.
 * Direct match for values 2-65536; level-based cycling for higher values.
 * @param {number} value
 * @returns {string} Hex color string
 */
export function getTextColor(value) {
    if (value <= 0) return '#FFFFFF';

    // Direct lookup first
    const direct = TILE_COLORS[value];
    if (direct) return direct.text;

    // Level-based cycling for values beyond 65536
    const level = getTileLevel(value);
    const idx = level % COLOR_ENTRIES.length;
    return COLOR_ENTRIES[idx].text;
}
