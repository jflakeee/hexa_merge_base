/**
 * @fileoverview Score management with localStorage persistence.
 * Ported from Unity C# ScoreManager.cs to pure JavaScript ES Module.
 * Uses localStorage instead of PlayerPrefs.
 */

const HIGH_SCORE_KEY = 'hexamerge_highscore';

/**
 * Manages current score and high score with callback notifications.
 */
export class ScoreManager {
    /** @type {number} */
    currentScore;

    /** @type {number} */
    highScore;

    /**
     * Array of callbacks invoked when the current score changes.
     * Each callback receives the new current score.
     * @type {Array<function(number): void>}
     */
    onScoreChanged;

    /**
     * Array of callbacks invoked when the high score is updated.
     * Each callback receives the new high score.
     * @type {Array<function(number): void>}
     */
    onHighScoreChanged;

    constructor() {
        this.currentScore = 0;
        this.highScore = 0;
        this.onScoreChanged = [];
        this.onHighScoreChanged = [];

        this.loadHighScore();
    }

    /**
     * Add points to the current score.
     * Automatically updates high score if surpassed.
     * @param {number} points - Points to add (must be positive)
     */
    addScore(points) {
        if (points <= 0) return;

        this.currentScore += points;
        this._notifyScoreChanged();

        if (this.currentScore > this.highScore) {
            this.highScore = this.currentScore;
            this.saveHighScore();
            this._notifyHighScoreChanged();
        }
    }

    /**
     * Reset the current score to 0.
     */
    reset() {
        this.currentScore = 0;
        this._notifyScoreChanged();
    }

    /**
     * Save the high score to localStorage.
     */
    saveHighScore() {
        try {
            localStorage.setItem(HIGH_SCORE_KEY, this.highScore.toString());
        } catch (e) {
            // localStorage may be unavailable (private browsing, etc.)
            console.warn('[ScoreManager] Failed to save high score:', e);
        }
    }

    /**
     * Load the high score from localStorage.
     */
    loadHighScore() {
        try {
            const saved = localStorage.getItem(HIGH_SCORE_KEY);
            if (saved !== null) {
                const parsed = parseFloat(saved);
                this.highScore = isNaN(parsed) ? 0 : parsed;
            }
        } catch (e) {
            console.warn('[ScoreManager] Failed to load high score:', e);
            this.highScore = 0;
        }
    }

    /**
     * Notify all onScoreChanged listeners.
     * @private
     */
    _notifyScoreChanged() {
        for (let i = 0; i < this.onScoreChanged.length; i++) {
            this.onScoreChanged[i](this.currentScore);
        }
    }

    /**
     * Notify all onHighScoreChanged listeners.
     * @private
     */
    _notifyHighScoreChanged() {
        for (let i = 0; i < this.onHighScoreChanged.length; i++) {
            this.onHighScoreChanged[i](this.highScore);
        }
    }
}
