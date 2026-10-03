/**
 * @fileoverview Statistics tracking system with localStorage persistence.
 * Tracks cumulative game stats across sessions.
 * ES Module - pure web implementation.
 */

const STATS_KEY = 'hexmerge_stats';

/** @type {Object|null} */
let _stats = null;

function defaultStats() {
    return {
        totalGames: 0,
        totalMerges: 0,
        totalScore: 0,
        highScore: 0,
        highestTile: 0,
        longestChain: 0,
    };
}

/** Load stats from localStorage. */
export function load() {
    try {
        const saved = localStorage.getItem(STATS_KEY);
        _stats = saved ? { ...defaultStats(), ...JSON.parse(saved) } : defaultStats();
    } catch {
        _stats = defaultStats();
    }
    return _stats;
}

/** Save current stats to localStorage. */
export function save() {
    if (!_stats) return;
    try {
        localStorage.setItem(STATS_KEY, JSON.stringify(_stats));
    } catch (e) {
        console.warn('[StatsSystem] save failed:', e);
    }
}

/**
 * Get a copy of current stats.
 * @returns {Object}
 */
export function getStats() {
    if (!_stats) load();
    return { ..._stats };
}

/**
 * Record a merge event.
 * @param {number} depthLevels - Number of depth levels in the merge
 * @param {number} resultValue - Final merged tile value
 */
export function recordMerge(depthLevels, resultValue) {
    if (!_stats) load();
    _stats.totalMerges++;
    if (depthLevels > _stats.longestChain) _stats.longestChain = depthLevels;
    if (resultValue > _stats.highestTile) _stats.highestTile = resultValue;
    save();
}

/**
 * Record a game over event.
 * @param {number} score - Final score of this game
 * @param {number} highScore - Current all-time high score
 */
export function recordGameOver(score, highScore) {
    if (!_stats) load();
    _stats.totalGames++;
    _stats.totalScore += score;
    if (highScore > _stats.highScore) _stats.highScore = highScore;
    save();
}
