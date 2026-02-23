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

// ============================================================
// Game state
// ============================================================
let lastTimestamp = 0;
let running = false;

// ============================================================
// Initialization sequence
// ============================================================

/**
 * Wait for first user gesture on the loading screen,
 * then initialize AudioContext and start the game.
 * AudioContext creation requires a user gesture on iOS and Chrome.
 */
function waitForUserGesture() {
    const handler = () => {
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

    loadingScreen.addEventListener('pointerdown', handler);
}

/**
 * Initialize all game subsystems and start the game loop.
 */
function initGame() {
    // Renderer already initializes in constructor (calls resize()).
    // Listen for window resize to re-fit the grid.
    window.addEventListener('resize', () => {
        renderer.resize();
    });

    // Input
    inputManager.init();
    inputManager.onCellTap = (coord) => {
        sfx.play('tap');
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
        // Continue: remove 3 random tiles and resume
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

    // 'merge' event - detail: { result: MergeResult }
    gameManager.addEventListener('merge', (e) => {
        const { result } = e.detail;

        // Play merge SFX based on resulting tile value
        const soundName = sfx.getMergeSoundName(result.resultValue);
        sfx.play(soundName);

        // Score popup animation at merge target position
        if (result.tapCoord) {
            const pos = renderer.hexToPixel(result.tapCoord.q, result.tapCoord.r);
            animator.playScorePopup(pos.x, pos.y, result.scoreGained);
        }

        // Merge movement animation: source cells slide to target
        if (result.mergedCoords && result.tapCoord) {
            const fromPositions = result.mergedCoords.map((coord) => {
                return renderer.hexToPixel(coord.q, coord.r);
            });
            const toCoordKey = result.tapCoord.toKey();
            const toPosition = renderer.hexToPixel(result.tapCoord.q, result.tapCoord.r);
            animator.playMergeAnimation(fromPositions, toCoordKey, toPosition);
        }

        // Visual merge effect (particles / splash)
        if (result.tapCoord) {
            const pos = renderer.hexToPixel(result.tapCoord.q, result.tapCoord.r);
            effects.playSplash(pos.x, pos.y, '#FF69B4');
        }
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
            sfx.play('gameOver');
            const currentScore = gameManager.score.currentScore;
            const highScore = gameManager.score.highScore;
            const isNewRecord = currentScore > highScore;
            gameOverScreen.show(currentScore, highScore, isNewRecord);
            screenManager.showScreen('gameover');
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
    });

    // 'crownchange' event - detail: { crownCoords: HexCoord[] }
    gameManager.addEventListener('crownchange', (e) => {
        const { crownCoords } = e.detail;
        if (crownCoords && crownCoords.length > 0) {
            sfx.play('crownChange');
        }
    });

    // Start game
    startNewGame();
}

/**
 * Start a new game session.
 */
function startNewGame() {
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
waitForUserGesture();
