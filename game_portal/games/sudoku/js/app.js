/**
 * App Entry Point & Screen Router
 *
 * Bootstraps the Sudoku application: initialises all UI components,
 * registers screen controllers, and provides navigation between screens.
 *
 * Loaded as the sole ES Module entry point from index.html.
 *
 * @module app
 */

import { Board } from './game/board.js';
import { InputHandler } from './game/input.js';
import { GridUI } from './ui/grid.js';
import { HighlightUI } from './ui/highlight.js';
import { NumberpadUI } from './ui/numberpad.js';
import { ToolbarUI } from './ui/toolbar.js';
import { loadSettings, saveSettings, loadGame, saveGame, loadStats, saveStats } from './utils/storage.js';
import { SoundManager } from './utils/sound.js';
import { initMainScreen } from './screens/main.js';
import { initGameScreen } from './screens/game.js';
import { initCompleteScreen } from './screens/complete.js';
import { initDailyScreen } from './screens/daily.js';
import { initProfileScreen } from './screens/profile.js';
import { initStatsScreen } from './screens/stats.js';
import { initAwardsScreen } from './screens/awards.js';
import { initSettingsScreen } from './screens/settings.js';
import { initTutorialScreen } from './screens/tutorial.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Screens that show the bottom navbar (main tab screens). */
const NAVBAR_SCREENS = new Set(['main', 'daily', 'profile']);

/** Auto-save interval in milliseconds. */
const AUTO_SAVE_INTERVAL = 30_000;

/** Difficulty label map (key → Korean). */
const DIFFICULTY_LABELS = {
    easy: '쉬움',
    medium: '보통',
    normal: '보통',
    hard: '어려움',
    expert: '전문가',
    master: '마스터',
};

// ---------------------------------------------------------------------------
// App state
// ---------------------------------------------------------------------------

/**
 * The global application object exposed to all screen controllers.
 * Populated during `init()`.
 */
const app = {
    /** Navigate to a named screen with optional parameters. */
    navigate: null,
    /** Go back to the previous screen. */
    goBack: null,

    // Game logic
    /** @type {Board | null} */
    board: null,
    /** @type {InputHandler | null} */
    input: null,

    // UI components
    /** @type {GridUI | null} */
    gridUI: null,
    /** @type {HighlightUI | null} */
    highlightUI: null,
    /** @type {NumberpadUI | null} */
    numberpadUI: null,
    /** @type {ToolbarUI | null} */
    toolbarUI: null,

    // Persistent data helpers (re-exported for convenience)
    settings: null,
    sound: null,

    // Utility references
    DIFFICULTY_LABELS,
};

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

/** @type {string[]} Screen history stack for back navigation. */
let screenHistory = [];

/** @type {string} Currently active screen name. */
let currentScreen = 'main';

/** @type {number | null} Auto-save interval id. */
let autoSaveId = null;

/** @type {number} Screen transition generation counter to invalidate stale cleanups. */
let transitionGen = 0;

/**
 * Navigate to a screen.
 *
 * @param {string} screenName - Target screen identifier (e.g. 'main', 'game').
 * @param {object}  [params]  - Optional parameters forwarded to the screen's
 *                               `onShow` handler.
 */
function navigate(screenName, params) {
    const target = document.getElementById(`screen-${screenName}`);
    if (!target) {
        console.warn(`[app] Unknown screen: ${screenName}`);
        return;
    }

    // Push current screen to history (unless navigating to same)
    if (currentScreen && currentScreen !== screenName) {
        screenHistory.push(currentScreen);
    }

    showScreen(screenName, params, 'forward');
}

/**
 * Go back to the previous screen in the history stack.
 */
function goBack() {
    const prev = screenHistory.pop();
    if (prev) {
        showScreen(prev, undefined, 'back');
    } else {
        showScreen('main', undefined, 'back');
    }
}

/**
 * Internal helper: activate a screen, hide all others, update navbar.
 *
 * @param {string} screenName
 * @param {object} [params]
 * @param {string} [direction] - 'forward', 'back', or undefined (no animation).
 */
function showScreen(screenName, params, direction) {
    const target = document.getElementById(`screen-${screenName}`);

    // Clear any in-progress animations first to prevent race conditions
    const animClasses = ['screen-enter', 'screen-exit', 'screen-enter-back', 'screen-exit-back'];
    document.querySelectorAll('.screen').forEach(s => {
        s.classList.remove(...animClasses);
        if (s.id !== `screen-${screenName}`) {
            s.classList.remove('active');
        }
    });

    const prevScreenEl = currentScreen
        ? document.getElementById(`screen-${currentScreen}`)
        : null;

    // Skip animation for navbar-tab switches between main tabs
    const isTabSwitch = NAVBAR_SCREENS.has(screenName) && NAVBAR_SCREENS.has(currentScreen);

    // Increment generation to invalidate any pending cleanup from prior transition
    const gen = ++transitionGen;

    if (direction && prevScreenEl && target && prevScreenEl !== target && !isTabSwitch) {
        // Animate transition
        const enterClass = direction === 'back' ? 'screen-enter-back' : 'screen-enter';
        const exitClass = direction === 'back' ? 'screen-exit-back' : 'screen-exit';

        // Show both for the duration of the animation
        prevScreenEl.classList.add('active');
        target.classList.add('active', enterClass);
        prevScreenEl.classList.add(exitClass);

        const cleanup = () => {
            // Skip if a newer transition has started
            if (gen !== transitionGen) return;
            prevScreenEl.classList.remove('active', exitClass);
            target.classList.remove(enterClass);
        };

        target.addEventListener('animationend', cleanup, { once: true });
        // Fallback cleanup
        setTimeout(cleanup, 350);
    } else {
        // No animation: just switch
        if (target) {
            target.classList.add('active');
        }
    }

    currentScreen = screenName;

    // Navbar visibility & active tab
    const navbar = document.getElementById('navbar');
    if (navbar) {
        navbar.style.display = NAVBAR_SCREENS.has(screenName) ? '' : 'none';

        // Update active tab
        navbar.querySelectorAll('.nav-tab').forEach(tab => {
            const tabTarget = tab.getAttribute('data-navigate');
            tab.classList.toggle('active', tabTarget === screenName);
        });
    }

    // Dispatch custom event that screens can listen on
    document.dispatchEvent(new CustomEvent('screen-show', {
        detail: { screen: screenName, params: params || {} },
    }));

    // Auto-save management: only active when on game screen
    manageAutoSave(screenName);
}

/**
 * Start or stop the periodic auto-save depending on the active screen.
 *
 * @param {string} screenName
 */
function manageAutoSave(screenName) {
    if (screenName === 'game') {
        if (!autoSaveId) {
            autoSaveId = setInterval(() => {
                try {
                    if (app.board) {
                        saveGame(app.board.toJSON());
                    }
                } catch { /* ignore save failures */ }
            }, AUTO_SAVE_INTERVAL);
        }
    } else {
        if (autoSaveId) {
            clearInterval(autoSaveId);
            autoSaveId = null;
        }
    }
}

// ---------------------------------------------------------------------------
// Difficulty modal
// ---------------------------------------------------------------------------

/**
 * Show the difficulty selection modal.
 */
function showDifficultyModal() {
    const modal = document.getElementById('difficulty-modal');
    if (modal) modal.style.display = '';
}

/**
 * Hide the difficulty selection modal.
 */
function hideDifficultyModal() {
    const modal = document.getElementById('difficulty-modal');
    if (modal) modal.style.display = 'none';
}

// ---------------------------------------------------------------------------
// Pause overlay
// ---------------------------------------------------------------------------

/**
 * Show the pause overlay and pause the game timer.
 */
function showPauseOverlay() {
    const overlay = document.getElementById('pause-overlay');
    if (overlay) overlay.style.display = '';
    if (app.board && app.board.timer) {
        app.board.timer.pause();
    }
}

/**
 * Hide the pause overlay and resume the game timer.
 */
function hidePauseOverlay() {
    const overlay = document.getElementById('pause-overlay');
    if (overlay) overlay.style.display = 'none';
    if (app.board && app.board.timer) {
        app.board.timer.start();
    }
}

// ---------------------------------------------------------------------------
// Initialisation
// ---------------------------------------------------------------------------

/**
 * Bootstrap the entire application.  Called once on DOMContentLoaded.
 */
function init() {
    // ----- Settings & sound -----
    app.settings = loadSettings();

    // Apply dark mode from saved settings
    if (app.settings.darkMode) {
        document.body.classList.add('dark-mode');
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.setAttribute('content', '#1E1E30');
    }

    try {
        app.sound = new SoundManager(app.settings);
    } catch {
        app.sound = null;
    }

    // ----- Core game instances -----
    app.board = new Board();
    app.input = new InputHandler(app.board, app.settings);

    // ----- UI components -----
    const gridEl = document.getElementById('sudoku-grid');
    const numpadEl = document.getElementById('numberpad');
    const toolbarEl = document.querySelector('.toolbar');

    app.gridUI = new GridUI(gridEl);
    app.highlightUI = new HighlightUI(app.gridUI);
    app.numberpadUI = new NumberpadUI(numpadEl);
    app.toolbarUI = new ToolbarUI(toolbarEl);

    // ----- Navigation helpers on the app object -----
    app.navigate = navigate;
    app.goBack = goBack;
    app.showDifficultyModal = showDifficultyModal;
    app.hideDifficultyModal = hideDifficultyModal;
    app.showPauseOverlay = showPauseOverlay;
    app.hidePauseOverlay = hidePauseOverlay;

    // ----- Initialise screen controllers -----
    initMainScreen(app);
    initGameScreen(app);
    initCompleteScreen(app);
    initDailyScreen(app);
    initProfileScreen(app);
    initStatsScreen(app);
    initAwardsScreen(app);
    initSettingsScreen(app);
    initTutorialScreen(app);

    // ----- Global event delegation -----
    document.addEventListener('click', (e) => {
        const target = /** @type {HTMLElement} */ (e.target.closest('[data-navigate]'));
        if (target) {
            const screen = target.getAttribute('data-navigate');
            // Let individual screens handle special cases via their own listeners
            // but also do generic navigation
            navigate(screen);
            return;
        }

        const actionTarget = /** @type {HTMLElement} */ (e.target.closest('[data-action]'));
        if (actionTarget) {
            const action = actionTarget.getAttribute('data-action');
            handleGlobalAction(action, actionTarget);
        }
    });

    // ----- Keyboard input (PC) -----
    document.addEventListener('keydown', (e) => {
        // Only handle keys when on the game screen
        if (currentScreen !== 'game') return;
        // Ignore if a modal/overlay is visible
        const pauseOverlay = document.getElementById('pause-overlay');
        if (pauseOverlay && pauseOverlay.style.display !== 'none') return;
        const diffModal = document.getElementById('difficulty-modal');
        if (diffModal && diffModal.style.display !== 'none') return;

        const key = e.key;

        // Number keys 1-9
        if (key >= '1' && key <= '9') {
            e.preventDefault();
            if (app.input) {
                app.input.inputNumber(parseInt(key, 10));
                try { app.sound?.play('place'); } catch { /* ignore */ }
            }
            return;
        }

        // Arrow keys - move selection
        if (key.startsWith('Arrow') && app.input && app.board) {
            e.preventDefault();
            const sel = app.input.getSelectedCell();
            let row = sel ? sel.row : 4;
            let col = sel ? sel.col : 4;

            switch (key) {
                case 'ArrowUp':    row = Math.max(0, row - 1); break;
                case 'ArrowDown':  row = Math.min(8, row + 1); break;
                case 'ArrowLeft':  col = Math.max(0, col - 1); break;
                case 'ArrowRight': col = Math.min(8, col + 1); break;
            }

            app.input.selectCell(row, col);
            if (app.highlightUI) {
                app.highlightUI.highlightSelection(row, col, app.board.getBoard());
            }
            if (app.numberpadUI) {
                app.numberpadUI.highlightNumber(app.board.getCellValue(row, col));
            }
            try { app.sound?.play('tap'); } catch { /* ignore */ }
            return;
        }

        // Backspace/Delete - erase
        if (key === 'Backspace' || key === 'Delete') {
            e.preventDefault();
            if (app.input) {
                app.input.erase();
                try { app.sound?.play('tap'); } catch { /* ignore */ }
            }
            return;
        }

        // Ctrl+Z - undo
        if ((e.ctrlKey || e.metaKey) && key === 'z') {
            e.preventDefault();
            if (app.input) {
                app.input.undo();
                try { app.sound?.play('undo'); } catch { /* ignore */ }
            }
            return;
        }

        // N - toggle notes
        if (key === 'n' || key === 'N') {
            e.preventDefault();
            if (app.input) {
                const isOn = app.input.toggleNotes();
                if (app.toolbarUI) {
                    app.toolbarUI.setNoteMode(isOn);
                }
            }
            return;
        }

        // H - hint
        if (key === 'h' || key === 'H') {
            e.preventDefault();
            if (app.input) {
                app.input.useHint();
            }
            return;
        }

        // Escape - deselect
        if (key === 'Escape') {
            e.preventDefault();
            if (app.input) {
                app.input.selectCell(-1, -1);
            }
            if (app.highlightUI) {
                app.highlightUI.clearAll();
            }
            if (app.numberpadUI) {
                app.numberpadUI.clearHighlight();
            }
            return;
        }
    });

    // ----- Difficulty modal events -----
    const difficultyModal = document.getElementById('difficulty-modal');
    if (difficultyModal) {
        // Click overlay background to close
        difficultyModal.addEventListener('click', (e) => {
            if (e.target === difficultyModal) {
                hideDifficultyModal();
            }
        });

        // Difficulty option selected
        difficultyModal.querySelectorAll('.difficulty-option').forEach(btn => {
            btn.addEventListener('click', () => {
                const difficulty = btn.getAttribute('data-difficulty');
                hideDifficultyModal();
                navigate('game', { difficulty, daily: false, loadSaved: false });
            });
        });
    }

    // ----- Initial screen -----
    showScreen('main');
}

/**
 * Handle global data-action clicks that are not screen-specific.
 *
 * @param {string} action
 * @param {HTMLElement} target
 */
function handleGlobalAction(action, target) {
    switch (action) {
        case 'back':
            goBack();
            break;

        case 'new-game':
            showDifficultyModal();
            break;

        case 'pause':
            showPauseOverlay();
            break;

        case 'resume':
            hidePauseOverlay();
            break;

        // Toolbar actions are handled by InputHandler / ToolbarUI,
        // but we provide sound feedback here.
        case 'undo':
        case 'erase':
        case 'notes':
        case 'hint':
            // Handled by screen-specific logic; no global override needed.
            break;

        default:
            break;
    }
}

// ---------------------------------------------------------------------------
// Service Worker registration
// ---------------------------------------------------------------------------

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(() => {
            // SW registration failed – app works fine without it.
        });
    });
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', init);

// Expose for screen modules
export default app;
