/**
 * @fileoverview Tile animation system for Hexa Merge web version.
 * Manages spawn, merge, score popup, crown transition, and game over animations.
 * All animation methods return Promises that resolve when the animation completes.
 */

// ----------------------------------------------------------
// Easing Functions
// ----------------------------------------------------------

/**
 * @param {number} t - Normalized time [0,1]
 * @returns {number}
 */
export function easeOutQuad(t) {
    return 1 - (1 - t) * (1 - t);
}

/**
 * Elastic ease-out with overshoot.
 * @param {number} t
 * @returns {number}
 */
export function easeOutElastic(t) {
    if (t === 0) return 0;
    if (t === 1) return 1;
    return Math.sin(-13 * (Math.PI / 2) * (t + 1)) * Math.pow(2, -10 * t) + 1;
}

/**
 * @param {number} t
 * @returns {number}
 */
export function easeInQuad(t) {
    return t * t;
}

/**
 * @param {number} t
 * @returns {number}
 */
export function easeOutBack(t) {
    const c1 = 1.70158;
    const c3 = c1 + 1; // 2.70158
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

/**
 * Linear interpolation.
 * @param {number} a
 * @param {number} b
 * @param {number} t
 * @returns {number}
 */
function lerp(a, b, t) {
    return a + (b - a) * t;
}

// ----------------------------------------------------------
// Animation Types
// ----------------------------------------------------------

/**
 * @typedef {object} Animation
 * @property {string} type - Animation type identifier
 * @property {string} [coordKey] - Hex coordinate key this animation affects
 * @property {number} duration - Total duration in seconds
 * @property {number} elapsed - Time elapsed in seconds
 * @property {Function} resolve - Promise resolve callback
 * @property {object} [data] - Type-specific data
 */

// ----------------------------------------------------------
// TileAnimator Class
// ----------------------------------------------------------

/**
 * Manages all active tile animations and provides per-cell animation state.
 */
export class TileAnimator {
    /** @type {Animation[]} */
    activeAnimations;

    /** @type {Array<{x:number,y:number,score:number,duration:number,elapsed:number,alpha:number,scale:number}>} */
    scorePopups;

    /** @type {{shakeX: number, shakeY: number}} */
    shakeOffset;

    constructor() {
        this.activeAnimations = [];
        this.scorePopups = [];
        this.shakeOffset = { shakeX: 0, shakeY: 0 };
    }

    // ----------------------------------------------------------
    // Core Update
    // ----------------------------------------------------------

    /**
     * Update all active animations. Call once per frame.
     * @param {number} dt - Delta time in seconds
     */
    update(dt) {
        // Update cell animations
        for (let i = this.activeAnimations.length - 1; i >= 0; i--) {
            const anim = this.activeAnimations[i];
            anim.elapsed += dt;

            if (anim.elapsed >= anim.duration) {
                anim.elapsed = anim.duration;
                // Fire resolve callback
                if (anim.resolve) {
                    anim.resolve();
                    anim.resolve = null;
                }
                this.activeAnimations.splice(i, 1);
            }
        }

        // Update score popups
        for (let i = this.scorePopups.length - 1; i >= 0; i--) {
            const popup = this.scorePopups[i];
            popup.elapsed += dt;

            const t = Math.min(popup.elapsed / popup.duration, 1);

            // Rise upward
            popup.y = popup.startY - 50 * easeOutQuad(t);

            // Scale: 0.5 -> 1.2 -> 1
            if (t < 0.3) {
                popup.scale = lerp(0.5, 1.2, t / 0.3);
            } else {
                popup.scale = lerp(1.2, 1.0, (t - 0.3) / 0.7);
            }

            // Fade out
            popup.alpha = 1 - easeInQuad(t);

            if (popup.elapsed >= popup.duration) {
                this.scorePopups.splice(i, 1);
            }
        }
    }

    /**
     * Check if there are any active animations.
     * @returns {boolean}
     */
    hasActiveAnimations() {
        return this.activeAnimations.length > 0
            || this.scorePopups.length > 0;
    }

    /**
     * Get the current animation state for a specific cell coordinate.
     * Returns null if no animation is active for this cell.
     * @param {string} coordKey - Cell coordinate key (e.g. "0,0")
     * @returns {{scale: number, alpha: number, offsetX: number, offsetY: number}|null}
     */
    getAnimationState(coordKey) {
        // Find the most recent animation affecting this coordKey
        for (let i = this.activeAnimations.length - 1; i >= 0; i--) {
            const anim = this.activeAnimations[i];
            if (anim.coordKey !== coordKey) continue;

            const t = Math.min(anim.elapsed / anim.duration, 1);

            switch (anim.type) {
                case 'spawn':
                    return {
                        scale: easeOutElastic(t),
                        alpha: 1,
                        offsetX: 0,
                        offsetY: 0,
                    };

                case 'merge_move': {
                    const eased = easeOutQuad(t);
                    return {
                        scale: 1,
                        alpha: 1,
                        offsetX: lerp(anim.data.startOffsetX, 0, eased),
                        offsetY: lerp(anim.data.startOffsetY, 0, eased),
                    };
                }

                case 'scale_punch': {
                    // 1 -> 1.3 -> 1
                    let scale;
                    if (t < 0.4) {
                        scale = lerp(1.0, 1.3, easeOutQuad(t / 0.4));
                    } else {
                        scale = lerp(1.3, 1.0, easeOutQuad((t - 0.4) / 0.6));
                    }
                    return {
                        scale,
                        alpha: 1,
                        offsetX: 0,
                        offsetY: 0,
                    };
                }

                case 'crown_fadeout':
                    return {
                        scale: 1,
                        alpha: lerp(1, 0, easeOutQuad(t)),
                        offsetX: 0,
                        offsetY: 0,
                    };

                case 'crown_appear': {
                    // scale 0 -> 1.2 -> 1
                    let scale;
                    if (t < 0.6) {
                        scale = lerp(0, 1.2, easeOutQuad(t / 0.6));
                    } else {
                        scale = lerp(1.2, 1.0, easeOutQuad((t - 0.6) / 0.4));
                    }
                    return {
                        scale,
                        alpha: 1,
                        offsetX: 0,
                        offsetY: 0,
                    };
                }

                case 'game_over_shake': {
                    const shakeDamping = 1 - t;
                    return {
                        scale: 1,
                        alpha: 1,
                        offsetX: Math.sin(t * 30) * 5 * shakeDamping,
                        offsetY: Math.cos(t * 25) * 3 * shakeDamping,
                    };
                }

                default:
                    return null;
            }
        }

        return null;
    }

    /**
     * Get the current board shake offset (for game over animation).
     * @returns {{shakeX: number, shakeY: number}}
     */
    getShakeOffset() {
        for (const anim of this.activeAnimations) {
            if (anim.type === 'game_over_shake') {
                const t = Math.min(anim.elapsed / anim.duration, 1);
                const damping = 1 - t;
                return {
                    shakeX: Math.sin(t * 30) * 5 * damping,
                    shakeY: Math.cos(t * 25) * 3 * damping,
                };
            }
        }
        return { shakeX: 0, shakeY: 0 };
    }

    // ----------------------------------------------------------
    // Animation Methods (all return Promises)
    // ----------------------------------------------------------

    /**
     * Play a spawn animation: scale 0 -> 1 with elastic overshoot.
     * @param {string} coordKey - Coordinate key of the spawning cell
     * @param {number} [duration=0.35]
     * @returns {Promise<void>}
     */
    playSpawnAnimation(coordKey, duration = 0.35) {
        return new Promise((resolve) => {
            this.activeAnimations.push({
                type: 'spawn',
                coordKey,
                duration,
                elapsed: 0,
                resolve,
                data: {},
            });
        });
    }

    /**
     * Play a merge animation: multiple cells move to a target, then scale-punch.
     * @param {Array<{x: number, y: number}>} fromPositions - Screen positions of source cells
     * @param {string} toCoordKey - Coordinate key of the merge target
     * @param {{x: number, y: number}} toPosition - Screen position of the target
     * @param {number} [duration=0.25]
     * @returns {Promise<void>}
     */
    playMergeAnimation(fromPositions, toCoordKey, toPosition, duration = 0.25) {
        const movePromises = fromPositions.map((fromPos) => {
            return new Promise((resolve) => {
                this.activeAnimations.push({
                    type: 'merge_move',
                    coordKey: toCoordKey,
                    duration,
                    elapsed: 0,
                    resolve,
                    data: {
                        startOffsetX: fromPos.x - toPosition.x,
                        startOffsetY: fromPos.y - toPosition.y,
                    },
                });
            });
        });

        // After all moves complete, play a scale punch on the target
        return Promise.all(movePromises).then(() => {
            return this._playScalePunch(toCoordKey, 0.15);
        });
    }

    /**
     * Internal: play a scale punch on a cell (1 -> 1.3 -> 1).
     * @param {string} coordKey
     * @param {number} [duration=0.15]
     * @returns {Promise<void>}
     * @private
     */
    _playScalePunch(coordKey, duration = 0.15) {
        return new Promise((resolve) => {
            this.activeAnimations.push({
                type: 'scale_punch',
                coordKey,
                duration,
                elapsed: 0,
                resolve,
                data: {},
            });
        });
    }

    /**
     * Play a score popup: text rises and fades.
     * @param {number} x - Screen x position
     * @param {number} y - Screen y position
     * @param {number} score - Score value to display
     * @param {number} [duration=0.8]
     * @returns {Promise<void>}
     */
    playScorePopup(x, y, score, duration = 0.8) {
        return new Promise((resolve) => {
            this.scorePopups.push({
                x,
                y,
                startY: y,
                score,
                duration,
                elapsed: 0,
                alpha: 1,
                scale: 0.5,
                resolve,
            });

            // Auto-resolve when duration expires (handled in update loop)
            // But we also set a safety timeout
            setTimeout(() => {
                if (resolve) resolve();
            }, duration * 1000 + 50);
        });
    }

    /**
     * Play a crown transition: old crown fades out, new crown scales in.
     * @param {string} oldCoordKey - Coordinate of the cell losing the crown
     * @param {string} newCoordKey - Coordinate of the cell gaining the crown
     * @param {number} [duration=0.35]
     * @returns {Promise<void>}
     */
    playCrownTransition(oldCoordKey, newCoordKey, duration = 0.35) {
        const fadeOutDuration = duration * 0.4;  // ~0.14s
        const fadeInDuration = duration * 0.6;   // ~0.21s

        const fadeOutPromise = new Promise((resolve) => {
            this.activeAnimations.push({
                type: 'crown_fadeout',
                coordKey: oldCoordKey,
                duration: fadeOutDuration,
                elapsed: 0,
                resolve,
                data: {},
            });
        });

        const fadeInPromise = new Promise((resolve) => {
            this.activeAnimations.push({
                type: 'crown_appear',
                coordKey: newCoordKey,
                duration: fadeInDuration,
                elapsed: 0,
                resolve,
                data: {},
            });
        });

        return Promise.all([fadeOutPromise, fadeInPromise]);
    }

    /**
     * Play the game over board shake animation.
     * Applies sinusoidal shake with damping to all cells.
     * shakeX = sin(t * 30) * 5 * (1 - t)
     * shakeY = cos(t * 25) * 3 * (1 - t)
     * @param {number} [duration=0.5]
     * @returns {Promise<void>}
     */
    playGameOverAnimation(duration = 0.5) {
        return new Promise((resolve) => {
            this.activeAnimations.push({
                type: 'game_over_shake',
                coordKey: '__board__',
                duration,
                elapsed: 0,
                resolve,
                data: {},
            });
        });
    }

    /**
     * Remove all active animations immediately.
     */
    clear() {
        // Resolve any pending promises
        for (const anim of this.activeAnimations) {
            if (anim.resolve) {
                anim.resolve();
                anim.resolve = null;
            }
        }
        this.activeAnimations.length = 0;

        for (const popup of this.scorePopups) {
            if (popup.resolve) {
                popup.resolve();
                popup.resolve = null;
            }
        }
        this.scorePopups.length = 0;
    }
}
