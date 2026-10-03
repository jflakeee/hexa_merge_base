/**
 * Settings Screen
 *
 * Loads persisted settings, reflects them in toggle switches, and saves
 * changes immediately when the user flips a toggle. Certain settings
 * are applied in real-time (sound, timer visibility, mistake limit).
 *
 * @module screens/settings
 */

import { loadSettings, saveSettings } from '../utils/storage.js';

// ---------------------------------------------------------------------------
// Module state
// ---------------------------------------------------------------------------

/** @type {object|null} */
let _app = null;

/** @type {object} Local copy of settings */
let _settings = {};

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

/**
 * Reflect stored settings into the toggle switches.
 */
function syncToggles() {
    const screen = document.getElementById('screen-settings');
    if (!screen) return;

    const toggles = screen.querySelectorAll('input[data-setting]');
    toggles.forEach((toggle) => {
        const key = toggle.getAttribute('data-setting');
        if (key && key in _settings) {
            toggle.checked = !!_settings[key];
        }
    });
}

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

/**
 * Handle a toggle switch change.
 *
 * @param {Event} e
 */
function onToggleChange(e) {
    const toggle = e.target;
    if (!toggle || !toggle.dataset.setting) return;

    const key = toggle.dataset.setting;
    _settings[key] = toggle.checked;
    saveSettings(_settings);

    applySettingImmediately(key, toggle.checked);
}

/**
 * Apply a setting change immediately where applicable.
 *
 * @param {string} key - Setting key name.
 * @param {boolean} value - New value.
 */
function applySettingImmediately(key, value) {
    if (!_app) return;

    switch (key) {
        case 'sound':
            if (_app.sound) {
                _app.sound.setEnabled(value);
            }
            break;

        case 'timer': {
            const timerEl = document.querySelector('.info-timer');
            if (timerEl) {
                timerEl.style.display = value ? '' : 'none';
            }
            break;
        }

        case 'mistakeLimit': {
            const mistakesEl = document.querySelector('.info-mistakes');
            if (mistakesEl) {
                mistakesEl.style.display = value ? '' : 'none';
            }
            break;
        }

        case 'darkMode':
            document.body.classList.toggle('dark-mode', value);
            // Update theme-color meta for PWA/browser chrome
            {
                const meta = document.querySelector('meta[name="theme-color"]');
                if (meta) meta.setAttribute('content', value ? '#1E1E30' : '#2979FF');
            }
            break;

        default:
            break;
    }

    // Keep the app-level settings reference up to date
    if (_app.settings) {
        Object.assign(_app.settings, _settings);
    }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Initialise the settings screen.
 *
 * @param {object} app - Application context with navigate, board, settings, sound.
 */
export function initSettingsScreen(app) {
    _app = app;
    _settings = loadSettings();

    syncToggles();

    // Listen for toggle changes
    const screen = document.getElementById('screen-settings');
    if (screen) {
        screen.addEventListener('change', onToggleChange);
    }

}
