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
// Values measured pixel-by-pixel from the XUP (GAMEGOS) benchmark recording.
// See docs/benchmark-vs-impl-diff.md §1. All numbers render white in the benchmark.
// 16384/32768 reuse the 4/16 hues (benchmark palette cycles at high values).
export const TILE_COLORS = {
    2:     { bg: '#FECC33', text: '#FFFFFF' },
    4:     { bg: '#E2491A', text: '#FFFFFF' },
    8:     { bg: '#E26887', text: '#FFFFFF' },
    16:    { bg: '#8F1A1E', text: '#FFFFFF' },
    32:    { bg: '#B61EC5', text: '#FFFFFF' },
    64:    { bg: '#7953AE', text: '#FFFFFF' },
    128:   { bg: '#661189', text: '#FFFFFF' },
    256:   { bg: '#45408A', text: '#FFFFFF' },
    512:   { bg: '#305DEE', text: '#FFFFFF' },
    1024:  { bg: '#40C9A5', text: '#FFFFFF' },
    2048:  { bg: '#A1EF39', text: '#FFFFFF' },
    4096:  { bg: '#33AA2D', text: '#FFFFFF' },
    8192:  { bg: '#0B656A', text: '#FFFFFF' },
    16384: { bg: '#E2491A', text: '#FFFFFF' },
    32768: { bg: '#8F1A1E', text: '#FFFFFF' },
    65536: { bg: '#B61EC5', text: '#FFFFFF' },
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
