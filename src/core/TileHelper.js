/**
 * @fileoverview Tile value utilities - random generation, formatting, validation.
 * Ported from Unity C# TileHelper.cs to pure JavaScript ES Module.
 * All random calls use Math.random() instead of UnityEngine.Random.
 */

/** Minimum tile value (smallest block). */
export const MIN_VALUE = 2;

/** Maximum tile value (practical upper bound for double precision). */
export const MAX_VALUE = 1e300;

/** Total number of conceptual levels. */
export const TOTAL_LEVELS = 100;

// ----------------------------------------------------------
// Validation
// ----------------------------------------------------------

/**
 * Check if a value is a valid tile value (power of 2 within range).
 * @param {number} value
 * @returns {boolean}
 */
export function isValidValue(value) {
    if (value < MIN_VALUE || value > MAX_VALUE) return false;
    const log2 = Math.log2(value);
    return Math.abs(log2 - Math.round(log2)) < 0.001;
}

// ----------------------------------------------------------
// Level
// ----------------------------------------------------------

/**
 * Convert a tile value to a 0-based level.
 * 2 -> 0, 4 -> 1, 8 -> 2, ..., 65536 -> 15
 * @param {number} value
 * @returns {number}
 */
export function getTileLevel(value) {
    if (value < 2) return 0;
    return Math.round(Math.log2(value)) - 1;
}

// ----------------------------------------------------------
// Merge / Progression
// ----------------------------------------------------------

/**
 * Return the next merge value (doubled). Capped at MAX_VALUE.
 * @param {number} value
 * @returns {number}
 */
export function getNextValue(value) {
    const next = value * 2;
    return next > MAX_VALUE ? MAX_VALUE : next;
}

// ----------------------------------------------------------
// Display
// ----------------------------------------------------------

/**
 * Format a tile value for UI display.
 * Uses SI-like suffixes: k, m, g, t, p, e, z, y, r, q.
 * Values exceeding 999q wrap by dividing by 1e33.
 * @param {number} value
 * @returns {string}
 */
export function formatValue(value) {
    if (value <= 0) return '0';

    // 999q 초과 시 단위 순환: 1e33 단위로 나누어 표시 초기화
    while (value >= 1e33) {
        value /= 1e33;
    }

    if (value >= 1e30) return Math.floor(value / 1e30) + 'q';
    if (value >= 1e27) return Math.floor(value / 1e27) + 'r';
    if (value >= 1e24) return Math.floor(value / 1e24) + 'y';
    if (value >= 1e21) return Math.floor(value / 1e21) + 'z';
    if (value >= 1e18) return Math.floor(value / 1e18) + 'e';
    if (value >= 1e15) return Math.floor(value / 1e15) + 'p';
    if (value >= 1e12) return Math.floor(value / 1e12) + 't';
    if (value >= 1e9)  return Math.floor(value / 1e9)  + 'g';
    if (value >= 1e6)  return Math.floor(value / 1e6)  + 'm';
    if (value >= 1e3)  return Math.floor(value / 1e3)  + 'k';
    return Math.floor(value).toString();
}

// ----------------------------------------------------------
// Random tile generation
// ----------------------------------------------------------

/**
 * Generate a new tile value: 90% chance of 2, 10% chance of 4.
 * @returns {number}
 */
export function getNewTileValue() {
    return Math.random() < 0.9 ? 2 : 4;
}

/**
 * Generate an initial board tile value with broader distribution.
 * 50% -> 2, 30% -> 4, 15% -> 8, 5% -> 16
 * @returns {number}
 */
export function getInitialValue() {
    const roll = Math.random();
    if (roll < 0.50) return 2;
    if (roll < 0.80) return 4;
    if (roll < 0.95) return 8;
    return 16;
}

/**
 * Generate a refill tile value based on the current minimum displayed value.
 * Range: minDisplayed to minDisplayed * 8, with weighted distribution (1/i).
 * Lower values are more likely.
 * @param {number} minDisplayed - The minimum tile value currently on the board
 * @returns {number}
 */
export function getRefillValue(minDisplayed) {
    if (minDisplayed < MIN_VALUE) minDisplayed = MIN_VALUE;
    let maxRange = minDisplayed * 8;
    if (maxRange > MAX_VALUE) maxRange = MAX_VALUE;

    // Count valid levels in range
    let levels = 0;
    let v = minDisplayed;
    while (v <= maxRange && v <= MAX_VALUE) {
        levels++;
        v *= 2;
    }

    if (levels <= 1) return minDisplayed;

    // Weighted random: lower values have higher probability (1/1, 1/2, 1/3, ...)
    let totalWeight = 0;
    for (let i = 1; i <= levels; i++) {
        totalWeight += 1 / i;
    }

    const roll = Math.random() * totalWeight;
    let cumulative = 0;
    let result = minDisplayed;
    for (let i = 1; i <= levels; i++) {
        cumulative += 1 / i;
        if (roll <= cumulative) {
            return result;
        }
        result *= 2;
    }

    return minDisplayed;
}
