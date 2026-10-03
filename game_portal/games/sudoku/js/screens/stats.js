/**
 * Statistics Screen
 *
 * Displays per-difficulty game statistics including games played, win rate,
 * time records, streaks, and high scores. Supports tab switching between
 * difficulty levels and a reset function.
 *
 * @module screens/stats
 */

import { loadStats, saveStats } from '../utils/storage.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** @type {string[]} */
const DIFFICULTY_KEYS = ['easy', 'medium', 'hard', 'expert', 'master'];

// ---------------------------------------------------------------------------
// Module state
// ---------------------------------------------------------------------------

/** @type {object|null} */
let _app = null;

/** @type {string} Currently active difficulty tab */
let _activeDifficulty = 'easy';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Format seconds as "MM:SS". Returns "--:--" when value is 0 or falsy.
 *
 * @param {number} seconds
 * @returns {string}
 */
function formatTime(seconds) {
    if (!seconds || seconds <= 0) return '--:--';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Format a number with locale-appropriate thousands separators.
 *
 * @param {number} n
 * @returns {string}
 */
function formatNumber(n) {
    return (n || 0).toLocaleString();
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

/**
 * Populate the stat values for the currently selected difficulty.
 */
function renderStats() {
    const allStats = loadStats();
    const stats = allStats[_activeDifficulty] || allStats.easy || {};

    // Games section
    setValue('gamesStarted', formatNumber(stats.gamesStarted));
    setValue('gamesWon', formatNumber(stats.gamesWon));

    const winRate =
        stats.gamesStarted > 0
            ? Math.round((stats.gamesWon / stats.gamesStarted) * 100)
            : 0;
    setValue('winRate', `${winRate}%`);

    setValue('noMistakeWins', formatNumber(stats.noMistakeWins));

    // Time section
    setValue('bestTime', formatTime(stats.bestTime));

    const avgTime =
        stats.gamesWon > 0
            ? Math.round(stats.totalTime / stats.gamesWon)
            : 0;
    setValue('avgTime', formatTime(avgTime));

    // Streaks section
    setValue('currentStreak', formatNumber(stats.currentStreak));
    setValue('bestStreak', formatNumber(stats.bestStreak));

    // High scores section
    const hs = stats.highScores || {};
    setValue('hsToday', formatNumber(hs.today));
    setValue('hsWeek', formatNumber(hs.thisWeek));
    setValue('hsMonth', formatNumber(hs.thisMonth));
    setValue('hsAllTime', formatNumber(hs.allTime));

    // --- Progress bars ---
    // Win rate bar
    setBar('winRate', winRate);

    // No-mistake win rate bar
    const noMistakeRate =
        stats.gamesWon > 0
            ? Math.round((stats.noMistakeWins / stats.gamesWon) * 100)
            : 0;
    setBar('noMistakeWins', noMistakeRate);

    // High score bars (relative to max)
    const hsValues = [hs.today || 0, hs.thisWeek || 0, hs.thisMonth || 0, hs.allTime || 0];
    const hsMax = Math.max(...hsValues, 1);
    setBar('hsToday', Math.round((hsValues[0] / hsMax) * 100));
    setBar('hsWeek', Math.round((hsValues[1] / hsMax) * 100));
    setBar('hsMonth', Math.round((hsValues[2] / hsMax) * 100));
    setBar('hsAllTime', Math.round((hsValues[3] / hsMax) * 100));
}

/**
 * Set the text content of a stat element by its data-stat attribute.
 *
 * @param {string} statName - The value of the `data-stat` attribute.
 * @param {string} value - Text to display.
 */
function setValue(statName, value) {
    const el = document.querySelector(`#screen-stats .stat-val[data-stat="${statName}"]`);
    if (el) el.textContent = value;
}

/**
 * Add or update a progress bar below a stat row.
 *
 * @param {string} statName - The value of the `data-stat` attribute.
 * @param {number} percent - Fill percentage (0-100).
 */
function setBar(statName, percent) {
    const el = document.querySelector(`#screen-stats .stat-val[data-stat="${statName}"]`);
    if (!el) return;

    const row = el.closest('.stats-row');
    if (!row) return;

    row.classList.add('has-bar');

    let bar = row.querySelector('.stat-bar');
    if (!bar) {
        bar = document.createElement('div');
        bar.className = 'stat-bar';
        const fill = document.createElement('div');
        fill.className = 'stat-bar-fill';
        bar.appendChild(fill);
        row.appendChild(bar);
    }

    const fill = bar.querySelector('.stat-bar-fill');
    if (fill) {
        fill.style.width = `${Math.min(100, Math.max(0, percent))}%`;
    }
}

/**
 * Update active tab styling.
 */
function updateTabUI() {
    const tabs = document.querySelectorAll('#stats-tabs .stats-tab');
    tabs.forEach((tab) => {
        if (tab.getAttribute('data-difficulty') === _activeDifficulty) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });
}

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

/**
 * Handle difficulty tab click.
 *
 * @param {Event} e
 */
function onTabClick(e) {
    const tab = e.target.closest('.stats-tab');
    if (!tab) return;

    const difficulty = tab.getAttribute('data-difficulty');
    if (difficulty && DIFFICULTY_KEYS.includes(difficulty)) {
        _activeDifficulty = difficulty;
        updateTabUI();
        renderStats();
    }
}

/**
 * Handle reset stats button click.
 */
function onResetClick() {
    const confirmed = confirm('이 난이도의 통계를 초기화하시겠습니까?');
    if (!confirmed) return;

    const allStats = loadStats();
    allStats[_activeDifficulty] = {
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
        },
    };

    saveStats(allStats);
    renderStats();
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Initialise the statistics screen.
 *
 * @param {object} app - Application context with navigate, board, settings, sound.
 */
export function initStatsScreen(app) {
    _app = app;
    _activeDifficulty = 'easy';

    // Tab switching
    const tabsContainer = document.getElementById('stats-tabs');
    if (tabsContainer) {
        tabsContainer.addEventListener('click', onTabClick);
    }

    // Reset button
    const resetBtn = document.querySelector('#screen-stats .btn-reset-stats');
    if (resetBtn) {
        resetBtn.addEventListener('click', onResetClick);
    }

    // Re-render stats whenever the screen becomes visible
    document.addEventListener('screen-show', (e) => {
        const detail = /** @type {CustomEvent} */ (e).detail;
        if (detail.screen === 'stats') {
            renderStats();
        }
    });

    updateTabUI();
    renderStats();
}
