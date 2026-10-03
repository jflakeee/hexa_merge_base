/**
 * LocalStorage Wrapper
 *
 * Provides typed save/load helpers for all persistent game data:
 * current game state, statistics, settings, and daily challenge progress.
 *
 * Every public function catches JSON parse errors and returns a sensible
 * default so the rest of the app never has to worry about corrupt storage.
 *
 * @module utils/storage
 */

// ---------------------------------------------------------------------------
// Storage keys
// ---------------------------------------------------------------------------

const KEYS = {
    CURRENT_GAME: 'sudoku_currentGame',
    STATS: 'sudoku_stats',
    SETTINGS: 'sudoku_settings',
    DAILY_CHALLENGE: 'sudoku_dailyChallenge',
};

// ---------------------------------------------------------------------------
// Difficulties used for per-difficulty stat initialisation
// ---------------------------------------------------------------------------

const DIFFICULTIES = ['easy', 'normal', 'hard', 'expert', 'master'];

// ---------------------------------------------------------------------------
// Default objects
// ---------------------------------------------------------------------------

/**
 * Returns a fresh default settings object.
 *
 * @returns {{
 *   sound: boolean,
 *   vibration: boolean,
 *   autoLock: boolean,
 *   timer: boolean,
 *   scoreAnimation: boolean,
 *   statsMessage: boolean,
 *   smartHints: boolean,
 *   numberFirst: boolean,
 *   mistakeLimit: boolean
 * }}
 */
function getDefaultSettings() {
    return {
        sound: true,
        vibration: true,
        autoLock: false,
        timer: true,
        scoreAnimation: true,
        statsMessage: true,
        smartHints: true,
        numberFirst: false,
        mistakeLimit: true,
        darkMode: false,
    };
}

/**
 * Returns a fresh default stat block for a single difficulty level.
 *
 * @returns {{
 *   gamesStarted: number,
 *   gamesWon: number,
 *   noMistakeWins: number,
 *   bestTime: number,
 *   totalTime: number,
 *   currentStreak: number,
 *   bestStreak: number,
 *   highScores: {today: number, thisWeek: number, thisMonth: number, allTime: number}
 * }}
 */
function getDefaultDifficultyStats() {
    return {
        gamesStarted: 0,
        gamesWon: 0,
        noMistakeWins: 0,
        bestTime: 0,
        totalTime: 0,
        currentStreak: 0,
        bestStreak: 0,
        highScores: {
            today: 0,
            thisWeek: 0,
            thisMonth: 0,
            allTime: 0,
            lastDate: '',
        },
    };
}

/**
 * Returns a fresh default stats object keyed by difficulty.
 *
 * @returns {Record<string, ReturnType<typeof getDefaultDifficultyStats>>}
 */
function getDefaultStats() {
    /** @type {Record<string, ReturnType<typeof getDefaultDifficultyStats>>} */
    const stats = {};
    for (const diff of DIFFICULTIES) {
        stats[diff] = getDefaultDifficultyStats();
    }
    return stats;
}

/**
 * Returns a fresh default daily-challenge data object.
 *
 * @returns {{ completed: string[], streak: number }}
 */
function getDefaultDailyChallenge() {
    return {
        completed: [],
        streak: 0,
    };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Safely read and JSON-parse a localStorage value.
 *
 * @param {string} key - localStorage key
 * @returns {*} Parsed value, or `null` when the key is missing / corrupt.
 */
function readJSON(key) {
    try {
        const raw = localStorage.getItem(key);
        if (raw === null) return null;
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

/**
 * JSON-stringify and persist a value to localStorage.
 *
 * @param {string} key - localStorage key
 * @param {*} value - Serialisable value
 */
function writeJSON(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch {
        // Quota exceeded or other storage error — silently ignore.
    }
}

// ---------------------------------------------------------------------------
// Current game
// ---------------------------------------------------------------------------

/**
 * Save the current game state.
 *
 * @param {object} gameState - Full game state object (board, solution, given,
 *   notes, difficulty, score, mistakes, time, history, etc.)
 */
export function saveGame(gameState) {
    writeJSON(KEYS.CURRENT_GAME, gameState);
}

/**
 * Load the previously saved game state.
 *
 * @returns {object | null} Parsed game state, or `null` if none exists.
 */
export function loadGame() {
    return readJSON(KEYS.CURRENT_GAME);
}

/**
 * Remove the saved current-game entry.
 */
export function clearGame() {
    try {
        localStorage.removeItem(KEYS.CURRENT_GAME);
    } catch {
        // Ignore errors.
    }
}

// ---------------------------------------------------------------------------
// Statistics
// ---------------------------------------------------------------------------

/**
 * Save statistics.
 *
 * @param {object} stats - Stats object keyed by difficulty.
 */
export function saveStats(stats) {
    writeJSON(KEYS.STATS, stats);
}

/**
 * Load statistics, falling back to a full default stats object when nothing
 * has been persisted yet.
 *
 * @returns {Record<string, object>} Per-difficulty stats.
 */
export function loadStats() {
    const stored = readJSON(KEYS.STATS);
    if (!stored || typeof stored !== 'object') {
        return getDefaultStats();
    }

    // Ensure every expected difficulty key exists (forward-compatible).
    const merged = getDefaultStats();
    for (const diff of DIFFICULTIES) {
        if (stored[diff] && typeof stored[diff] === 'object') {
            merged[diff] = { ...merged[diff], ...stored[diff] };
            // Also ensure nested highScores is complete.
            merged[diff].highScores = {
                ...getDefaultDifficultyStats().highScores,
                ...(stored[diff].highScores || {}),
            };
        }
    }

    return merged;
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

/**
 * Save user settings.
 *
 * @param {object} settings - Settings object.
 */
export function saveSettings(settings) {
    writeJSON(KEYS.SETTINGS, settings);
}

/**
 * Load user settings, falling back to defaults for any missing keys.
 *
 * @returns {ReturnType<typeof getDefaultSettings>} Merged settings.
 */
export function loadSettings() {
    const stored = readJSON(KEYS.SETTINGS);
    if (!stored || typeof stored !== 'object') {
        return getDefaultSettings();
    }

    return { ...getDefaultSettings(), ...stored };
}

// ---------------------------------------------------------------------------
// High score period reset
// ---------------------------------------------------------------------------

/**
 * Get ISO week number for a given date.
 *
 * @param {Date} date
 * @returns {number}
 */
function getISOWeek(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

/**
 * Check if high scores need to be reset based on date changes.
 * Resets today/thisWeek/thisMonth scores when the period changes.
 *
 * @param {object} hs - The highScores object to check and mutate.
 */
export function checkAndResetHighScores(hs) {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    if (!hs.lastDate || hs.lastDate === todayStr) {
        hs.lastDate = todayStr;
        return;
    }

    const last = new Date(hs.lastDate + 'T00:00:00');

    // Different day → reset today
    if (todayStr !== hs.lastDate) {
        hs.today = 0;
    }

    // Different ISO week → reset thisWeek
    if (getISOWeek(now) !== getISOWeek(last) || now.getFullYear() !== last.getFullYear()) {
        hs.thisWeek = 0;
    }

    // Different month → reset thisMonth
    if (now.getMonth() !== last.getMonth() || now.getFullYear() !== last.getFullYear()) {
        hs.thisMonth = 0;
    }

    hs.lastDate = todayStr;
}

// ---------------------------------------------------------------------------
// Daily challenge
// ---------------------------------------------------------------------------

/**
 * Save daily-challenge progress data.
 *
 * @param {{ completed: string[], streak: number }} data
 */
export function saveDailyChallenge(data) {
    writeJSON(KEYS.DAILY_CHALLENGE, data);
}

/**
 * Load daily-challenge progress, falling back to defaults.
 *
 * @returns {{ completed: string[], streak: number }}
 */
export function loadDailyChallenge() {
    const stored = readJSON(KEYS.DAILY_CHALLENGE);
    if (!stored || typeof stored !== 'object') {
        return getDefaultDailyChallenge();
    }

    return {
        completed: Array.isArray(stored.completed) ? stored.completed : [],
        streak: typeof stored.streak === 'number' ? stored.streak : 0,
    };
}
