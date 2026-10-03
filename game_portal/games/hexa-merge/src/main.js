/**
 * @fileoverview Application bootstrap and game loop for Hexa Merge web version.
 * Initializes all subsystems, connects events, and runs the render loop.
 * ES Module entry point - loaded by index.html via <script type="module">.
 */

// --- Module imports ---
import { GameManager } from './game/GameManager.js';
import { ScoreManager } from './game/ScoreManager.js';
import { InputManager } from './game/InputManager.js';
import { Renderer } from './render/Renderer.js';
import { TileAnimator } from './animation/TileAnimator.js';
import { MergeEffect } from './animation/MergeEffect.js';
import { ProceduralSFX } from './audio/ProceduralSFX.js';
import { ScreenManager } from './ui/ScreenManager.js';
import { HUDManager } from './ui/HUDManager.js';
import { GameOverScreen } from './ui/GameOverScreen.js';
import { PauseScreen } from './ui/PauseScreen.js';
import { HowToPlayScreen } from './ui/HowToPlayScreen.js';
import { StatsScreen } from './ui/StatsScreen.js';
import * as SaveSystem from './game/SaveSystem.js';
import * as StatsSystem from './game/StatsSystem.js';
import { setEmptyCellColors } from './render/HexCellView.js';
import { HexCoord } from './core/HexCoord.js';
// ============================================================
// DOM References
// ============================================================
const canvas = document.getElementById('game-canvas');
const loadingScreen = document.getElementById('loading-screen');

// ============================================================
// Subsystem instances
// ============================================================
const sfx = new ProceduralSFX();
const renderer = new Renderer(canvas);
const inputManager = new InputManager(canvas, renderer);
const animator = new TileAnimator();
const effects = new MergeEffect();
const gameManager = new GameManager();
const screenManager = new ScreenManager();
const hudManager = new HUDManager();
const gameOverScreen = new GameOverScreen();
const pauseScreen = new PauseScreen();
const howToPlayScreen = new HowToPlayScreen();
const statsScreen = new StatsScreen();

// ============================================================
// Game state
// ============================================================
let lastTimestamp = 0;
let running = false;

// ============================================================
// Theme system
// ============================================================
const THEME_KEY = 'hexmerge_theme';

/**
 * Apply the current theme to Canvas rendering colors.
 * Reads CSS custom properties and updates HexCellView accordingly.
 */
function applyThemeToCanvas() {
    const style = getComputedStyle(document.body);
    const fill = style.getPropertyValue('--empty-cell-fill').trim();
    const stroke = style.getPropertyValue('--empty-cell-stroke').trim();
    if (fill && stroke) {
        setEmptyCellColors(fill, stroke);
    }
}

/**
 * Toggle between light and dark mode.
 * @returns {boolean} true if now in light mode
 */
function toggleTheme() {
    const isLight = document.body.classList.toggle('light-mode');
    localStorage.setItem(THEME_KEY, isLight ? 'light' : 'dark');
    applyThemeToCanvas();
    return isLight;
}

/**
 * Restore saved theme preference from localStorage.
 */
function restoreTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'light') {
        document.body.classList.add('light-mode');
    }
    applyThemeToCanvas();
}

// ============================================================
// Initialization sequence
// ============================================================

/**
 * Wait for first user gesture on the loading screen,
 * then initialize AudioContext and start the game.
 * AudioContext creation requires a user gesture on iOS and Chrome.
 */
function waitForUserGesture() {
    const btnPlay = document.getElementById('btn-play');

    const handler = () => {
        btnPlay.removeEventListener('click', handler);
        loadingScreen.removeEventListener('pointerdown', handler);

        // Initialize audio (requires user gesture for iOS/Chrome autoplay policy)
        sfx.init();

        // Hide loading screen with fade
        loadingScreen.classList.add('hidden');
        setTimeout(() => {
            loadingScreen.style.display = 'none';
        }, 500);

        // Start the game
        initGame();
    };

    // PLAY button or tap anywhere
    btnPlay.addEventListener('click', handler);
    loadingScreen.addEventListener('pointerdown', (e) => {
        // Only handle taps outside the button (button handles its own click)
        if (e.target !== btnPlay) handler();
    });
}

/**
 * Initialize all game subsystems and start the game loop.
 */
function initGame() {
    // Load stats and sync high score from ScoreManager
    const stats = StatsSystem.load();
    if (gameManager.score.highScore > stats.highScore) {
        stats.highScore = gameManager.score.highScore;
        StatsSystem.save();
    }

    // Restore saved theme preference
    restoreTheme();

    // Renderer already initializes in constructor (calls resize()).
    // Listen for window resize to re-fit the grid.
    window.addEventListener('resize', () => {
        renderer.resize();
    });
    window.addEventListener('orientationchange', () => {
        setTimeout(() => renderer.resize(), 150);
    });

    // Input
    inputManager.init();
    inputManager.onCellTap = (coord) => {
        gameManager.handleTap(coord);
    };

    // Screen overlays
    screenManager.init();

    // HUD
    hudManager.init();
    hudManager.setButtonCallbacks({
        onSound: () => {
            const muted = !sfx.isMuted();
            sfx.setMuted(muted);
            hudManager.setSoundIcon(muted);
            pauseScreen.updateSoundButton(muted);
            sfx.play('buttonClick');
        },
        onMenu: () => {
            sfx.play('buttonClick');
            if (screenManager.getCurrentScreen() === 'gameplay') {
                gameManager.pauseGame();
                screenManager.showScreen('pause');
                pauseScreen.show();
            }
        },
        onHelp: () => {
            sfx.play('buttonClick');
            if (screenManager.getCurrentScreen() === 'gameplay') {
                screenManager.showScreen('howtoplay');
                howToPlayScreen.show();
            }
        }
    });

    // Game Over screen
    gameOverScreen.init(document.getElementById('screen-gameover'));
    gameOverScreen.onContinue = () => {
        screenManager.hideScreen('gameover');
        gameOverScreen.hide();
        // Continue: remove 3 random tiles and resume (auto-saved via newtiles handler)
        gameManager.continueAfterGameOver();
    };
    gameOverScreen.onPlayAgain = () => {
        screenManager.hideScreen('gameover');
        gameOverScreen.hide();
        startNewGame();
    };

    // Pause screen
    pauseScreen.init(document.getElementById('screen-pause'));
    pauseScreen.updateSoundButton(sfx.isMuted());
    pauseScreen.updateThemeButton(document.body.classList.contains('light-mode'));
    pauseScreen.onResume = () => {
        sfx.play('buttonClick');
        screenManager.hideScreen('pause');
        pauseScreen.hide();
        gameManager.resumeGame();
    };
    pauseScreen.onRestart = () => {
        sfx.play('buttonClick');
        screenManager.hideScreen('pause');
        pauseScreen.hide();
        startNewGame();
    };
    pauseScreen.onSoundToggle = () => {
        const muted = !sfx.isMuted();
        sfx.setMuted(muted);
        hudManager.setSoundIcon(muted);
        pauseScreen.updateSoundButton(muted);
        sfx.play('buttonClick');
    };
    pauseScreen.onThemeToggle = () => {
        sfx.play('buttonClick');
        const isLight = toggleTheme();
        pauseScreen.updateThemeButton(isLight);
    };

    // Stats button in pause screen
    pauseScreen.onStats = () => {
        sfx.play('buttonClick');
        screenManager.hideScreen('pause');
        pauseScreen.hide();
        statsScreen.show(StatsSystem.getStats());
        screenManager.showScreen('stats');
    };

    // Stats screen
    statsScreen.init(document.getElementById('screen-stats'));
    statsScreen.onClose = () => {
        sfx.play('buttonClick');
        screenManager.hideScreen('stats');
        statsScreen.hide();
        // Return to pause screen
        screenManager.showScreen('pause');
        pauseScreen.show();
    };

    // How To Play screen
    howToPlayScreen.init(document.getElementById('screen-howtoplay'));
    howToPlayScreen.onClose = () => {
        sfx.play('buttonClick');
        screenManager.hideScreen('howtoplay');
        howToPlayScreen.hide();
    };

    // ----------------------------------------------------------
    // GameManager event wiring (EventTarget / CustomEvent API)
    // ----------------------------------------------------------

    // Direct async callback for each merge step (not event-based)
    // Each step: ghost slide → SFX → scale punch, sequentially awaited
    gameManager.onMergeStep = async ({ group, cellValue, tapCoord, parentMap, stepValue, stepIndex, totalSteps }) => {
        // Each cell moves toward its BFS parent (not directly to tapCoord)
        const pairs = group.map((c) => {
            const source = renderer.hexToPixel(c.q, c.r);
            const parentKey = parentMap.get(c.toKey());
            const parentCoord = HexCoord.fromKey(parentKey);
            const target = renderer.hexToPixel(parentCoord.q, parentCoord.r);
            return { source, target };
        });

        // Ghost cells slide from source to their respective parent
        await animator.playStepMergeToParents(cellValue, pairs, 0.12);

        // Play merge step SFX with increasing pitch AFTER slide completes
        const pitchRate = 1.0 + stepIndex * 0.18;
        const stepSoundName = sfx.getMergeSoundName(stepValue);
        sfx.play(stepSoundName, 1, pitchRate);

        // Scale punch on target cell
        await animator._playScalePunch(tapCoord.toKey(), 0.08);
    };

    // 'merge' event - detail: { result: MergeResult }
    // Fires after all step animations complete (score popup, effects, stats)
    gameManager.addEventListener('merge', (e) => {
        const { result } = e.detail;

        // Play merge SFX at the next pitch continuing from the last step
        const finalPitch = 1.0 + result.depthGroups.length * 0.18;
        const finalSoundName = sfx.getMergeSoundName(result.resultValue);
        sfx.play(finalSoundName, 1, finalPitch);

        // Score popup animation at merge target position
        if (result.tapCoord) {
            const pos = renderer.hexToPixel(result.tapCoord.q, result.tapCoord.r);
            animator.playScorePopup(pos.x, pos.y, result.scoreGained);
        }

        // Visual merge effect (particles / splash)
        if (result.tapCoord) {
            const pos = renderer.hexToPixel(result.tapCoord.q, result.tapCoord.r);
            effects.playSplash(pos.x, pos.y, '#FF69B4');
        }

        // Record stats
        StatsSystem.recordMerge(result.depthGroups.length, result.resultValue);
    });

    // 'scoreupdate' event - detail: { currentScore, highScore }
    gameManager.addEventListener('scoreupdate', (e) => {
        const { currentScore, highScore } = e.detail;
        hudManager.updateScore(currentScore);
        hudManager.updateHighScore(highScore);
    });

    // 'statechange' event - detail: { state }
    gameManager.addEventListener('statechange', (e) => {
        const { state } = e.detail;
        if (state === 'gameover') {
            SaveSystem.deleteSave();
            sfx.play('gameOver');
            const currentScore = gameManager.score.currentScore;
            const highScore = gameManager.score.highScore;
            const isNewRecord = currentScore > highScore;
            const highestCell = gameManager.grid.getHighestValueCell();
            const maxTileValue = highestCell ? highestCell.value : 0;
            gameOverScreen.show(currentScore, highScore, isNewRecord, maxTileValue);
            screenManager.showScreen('gameover');

            // Record game over stats
            StatsSystem.recordGameOver(currentScore, highScore);
        }
    });

    // 'newtiles' event - detail: { cells: HexCell[] }
    gameManager.addEventListener('newtiles', (e) => {
        const { cells } = e.detail;
        if (cells && cells.length > 0) {
            cells.forEach((cell) => {
                const coordKey = cell.coord ? cell.coord.toKey() : null;
                if (coordKey) {
                    animator.playSpawnAnimation(coordKey);
                }
            });
            sfx.play('tileDrop');
        }

        // Auto-save after board refill (newtiles fires after fillAllEmptyCells)
        SaveSystem.save(gameManager.grid, gameManager.score.currentScore);
    });

    // 'crownchange' event - detail: { crownCoords: HexCoord[] }
    gameManager.addEventListener('crownchange', (e) => {
        const { playSound, soundVariant, reason } = e.detail;
        if (['init', 'restore', 'reset'].includes(reason)) sfx.stopCrown();
        if (playSound) sfx.play(soundVariant === 'upgrade' ? 'crownUpgrade' : 'crownChange');
    });

    // Restore saved game or start new
    const savedData = SaveSystem.load();
    if (savedData && savedData.cells.length > 0) {
        gameManager.restoreGame(savedData);
        hudManager.updateScore(gameManager.score.currentScore);
        hudManager.updateHighScore(gameManager.score.highScore);
        if (!running) {
            running = true;
            lastTimestamp = performance.now();
            requestAnimationFrame(gameLoop);
        }
    } else {
        startNewGame();
    }
}

/**
 * Start a new game session.
 */
function startNewGame() {
    SaveSystem.deleteSave();
    gameManager.startNewGame();

    sfx.play('gameStart');

    // Reset HUD with initial values from GameManager's internal ScoreManager
    hudManager.updateScore(0);
    hudManager.updateHighScore(gameManager.score.highScore);

    // Start the game loop if not already running
    if (!running) {
        running = true;
        lastTimestamp = performance.now();
        requestAnimationFrame(gameLoop);
    }
}

// ============================================================
// Game Loop
// ============================================================

/**
 * Main render/update loop using requestAnimationFrame.
 * @param {number} timestamp - High-resolution timestamp from rAF
 */
function gameLoop(timestamp) {
    if (!running) return;

    const dt = (timestamp - lastTimestamp) / 1000; // delta time in seconds
    lastTimestamp = timestamp;

    // Clamp dt to avoid huge jumps (e.g., when tab was hidden)
    const clampedDt = Math.min(dt, 0.1);

    // Update animations
    animator.update(clampedDt);
    effects.update(clampedDt);

    // Render the current frame
    renderer.render(gameManager.grid, animator, effects);

    // Next frame
    requestAnimationFrame(gameLoop);
}

// ============================================================
// Entry point
// ============================================================

// Apply saved theme immediately (before game init, so landing page respects theme)
const savedTheme = localStorage.getItem(THEME_KEY);
if (savedTheme === 'light') {
    document.body.classList.add('light-mode');
}

waitForUserGesture();
