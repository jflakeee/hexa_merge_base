/**
 * Daily Challenge Screen
 *
 * Renders a calendar-based view of daily challenges with month tabs,
 * completion indicators, and a play button to start the daily puzzle.
 *
 * @module screens/daily
 */

import { loadDailyChallenge } from '../utils/storage.js';
import { getDailyDifficulty } from '../utils/daily-seed.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MONTH_NAMES = [
    '1월', '2월', '3월', '4월', '5월', '6월',
    '7월', '8월', '9월', '10월', '11월', '12월',
];

const WEEKDAY_COUNT = 7;
const MONTHS_TO_SHOW = 8;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Format a date as "YYYY-MM-DD".
 * @param {Date} d
 * @returns {string}
 */
function formatDate(d) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Get the number of days in a given month.
 * @param {number} year
 * @param {number} month - 0-indexed
 * @returns {number}
 */
function getDaysInMonth(year, month) {
    return new Date(year, month + 1, 0).getDate();
}

/**
 * Get the day of the week the first of the month falls on (0 = Sun).
 * @param {number} year
 * @param {number} month - 0-indexed
 * @returns {number}
 */
function getFirstDayOfWeek(year, month) {
    return new Date(year, month, 1).getDay();
}

// ---------------------------------------------------------------------------
// Module state
// ---------------------------------------------------------------------------

/** @type {object|null} */
let _app = null;

/** @type {Date} */
let _selectedMonth = new Date();

/** @type {string|null} Currently selected date string (YYYY-MM-DD) */
let _selectedDate = null;

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

/**
 * Generate the horizontal month tabs for the last N months.
 */
function renderMonthTabs() {
    const container = document.getElementById('daily-month-tabs');
    if (!container) return;

    container.innerHTML = '';

    const today = new Date();
    const months = [];

    for (let i = MONTHS_TO_SHOW - 1; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        months.push(d);
    }

    months.forEach((d) => {
        const btn = document.createElement('button');
        btn.className = 'month-tab';
        btn.textContent = MONTH_NAMES[d.getMonth()];
        btn.dataset.year = String(d.getFullYear());
        btn.dataset.month = String(d.getMonth());

        if (
            d.getFullYear() === _selectedMonth.getFullYear() &&
            d.getMonth() === _selectedMonth.getMonth()
        ) {
            btn.classList.add('active');
        }

        btn.addEventListener('click', () => {
            _selectedMonth = new Date(d.getFullYear(), d.getMonth(), 1);
            _selectedDate = null;
            renderMonthTabs();
            renderCalendar();
        });

        container.appendChild(btn);
    });

    // Scroll active tab into view
    const activeTab = container.querySelector('.month-tab.active');
    if (activeTab) {
        activeTab.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
}

/**
 * Render the calendar grid for the currently selected month.
 */
function renderCalendar() {
    const container = document.getElementById('daily-calendar');
    if (!container) return;

    // Remove old day cells but keep the weekday headers (first 7 children)
    const weekdayHeaders = Array.from(container.querySelectorAll('.calendar-weekday'));
    container.innerHTML = '';
    weekdayHeaders.forEach((h) => container.appendChild(h));

    const year = _selectedMonth.getFullYear();
    const month = _selectedMonth.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfWeek(year, month);

    const today = new Date();
    const todayStr = formatDate(today);
    const dailyData = loadDailyChallenge();
    const completedSet = new Set(dailyData.completed);

    // Update header text
    const yearMonthLabel = document.querySelector('.calendar-year-month');
    if (yearMonthLabel) {
        yearMonthLabel.textContent = `${year}년 ${month + 1}월`;
    }

    // Count completed days this month
    let completedCount = 0;
    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = formatDate(new Date(year, month, d));
        if (completedSet.has(dateStr)) completedCount++;
    }

    const starCount = document.querySelector('.calendar-star-count');
    if (starCount) {
        starCount.innerHTML = `&#x2B50; ${completedCount}/${daysInMonth}`;
    }

    // Empty cells for days before the first day of month
    for (let i = 0; i < firstDay; i++) {
        const empty = document.createElement('div');
        empty.className = 'calendar-day empty';
        container.appendChild(empty);
    }

    // Default selected date to today if in the viewed month, otherwise first day
    if (!_selectedDate) {
        if (
            today.getFullYear() === year &&
            today.getMonth() === month
        ) {
            _selectedDate = todayStr;
        } else {
            _selectedDate = formatDate(new Date(year, month, 1));
        }
    }

    // Day cells
    for (let d = 1; d <= daysInMonth; d++) {
        const dateObj = new Date(year, month, d);
        const dateStr = formatDate(dateObj);
        const isFuture = dateObj > today && dateStr !== todayStr;
        const isToday = dateStr === todayStr;
        const isCompleted = completedSet.has(dateStr);
        const isSelected = dateStr === _selectedDate;

        const cell = document.createElement('div');
        cell.className = 'calendar-day';
        if (isToday) cell.classList.add('today');
        if (isFuture) cell.classList.add('future');
        if (isCompleted) cell.classList.add('completed');
        if (isSelected) cell.classList.add('selected');

        const dayNum = document.createElement('span');
        dayNum.className = 'day-number';
        dayNum.textContent = String(d);
        cell.appendChild(dayNum);

        if (isCompleted) {
            const indicator = document.createElement('span');
            indicator.className = 'day-indicator';
            indicator.textContent = '\u2022'; // bullet dot
            cell.appendChild(indicator);
        }

        if (!isFuture) {
            cell.addEventListener('click', () => {
                _selectedDate = dateStr;
                renderCalendar();
            });
        }

        container.appendChild(cell);
    }
}

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

/**
 * Handle play button click.
 */
function onPlayClick() {
    if (!_app || !_selectedDate) return;

    const parts = _selectedDate.split('-').map(Number);
    const dateObj = new Date(parts[0], parts[1] - 1, parts[2]);
    const difficulty = getDailyDifficulty(dateObj);

    _app.navigate('game', {
        difficulty,
        daily: true,
        date: _selectedDate,
    });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Initialise the daily challenge screen.
 *
 * @param {object} app - Application context with navigate, board, settings, sound.
 */
export function initDailyScreen(app) {
    _app = app;

    const today = new Date();
    _selectedMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    _selectedDate = null;

    renderMonthTabs();
    renderCalendar();

    // Play button
    const playBtn = document.querySelector('.btn-daily-play');
    if (playBtn) {
        playBtn.addEventListener('click', onPlayClick);
    }
}
