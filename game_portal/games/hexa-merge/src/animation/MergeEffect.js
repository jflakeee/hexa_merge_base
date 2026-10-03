/**
 * @fileoverview Visual effects for merge actions: splashes, splats, and particle bursts.
 * All effects are self-contained and rendered via the draw() method each frame.
 */

import { easeOutQuad, easeInQuad } from './TileAnimator.js';

// ----------------------------------------------------------
// Data Structures
// ----------------------------------------------------------

/**
 * @typedef {object} Particle
 * @property {number} x - Current x position
 * @property {number} y - Current y position
 * @property {number} vx - Velocity x (px/s)
 * @property {number} vy - Velocity y (px/s)
 * @property {number} size - Current radius in pixels
 * @property {string} color - CSS color string
 * @property {number} alpha - Current opacity [0,1]
 * @property {number} life - Time elapsed (seconds)
 * @property {number} maxLife - Total lifetime (seconds)
 * @property {number} startSize - Initial size for lerp calculations
 */

/**
 * @typedef {object} Splash
 * @property {number} x - Center x
 * @property {number} y - Center y
 * @property {string} color - CSS color string
 * @property {number} duration - Total duration in seconds
 * @property {number} elapsed - Time elapsed in seconds
 * @property {number} scale - Current scale factor
 * @property {number} alpha - Current opacity
 */

/**
 * @typedef {object} Splat
 * @property {number} srcX - Source x
 * @property {number} srcY - Source y
 * @property {number} tgtX - Target x
 * @property {number} tgtY - Target y
 * @property {number} x - Current x position
 * @property {number} y - Current y position
 * @property {string} color - CSS color string
 * @property {number} duration - Total duration in seconds
 * @property {number} elapsed - Time elapsed in seconds
 * @property {number} scale - Current scale factor
 * @property {number} alpha - Current opacity
 * @property {number} baseSize - Base blob size in pixels
 */

// ----------------------------------------------------------
// Helper
// ----------------------------------------------------------

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

/**
 * Parse a hex color to {r, g, b} values.
 * @param {string} hex
 * @returns {{r: number, g: number, b: number}}
 */
function parseHex(hex) {
    const cleaned = hex.replace('#', '');
    return {
        r: parseInt(cleaned.slice(0, 2), 16),
        g: parseInt(cleaned.slice(2, 4), 16),
        b: parseInt(cleaned.slice(4, 6), 16),
    };
}

/**
 * Create an rgba color string from a hex color and alpha.
 * @param {string} hex
 * @param {number} alpha
 * @returns {string}
 */
function hexToRGBA(hex, alpha) {
    const { r, g, b } = parseHex(hex);
    return `rgba(${r},${g},${b},${alpha})`;
}

// ----------------------------------------------------------
// MergeEffect Class
// ----------------------------------------------------------

/**
 * Manages visual merge effects: splash circles, viscous splats, and particle bursts.
 */
export class MergeEffect {
    /** @type {Particle[]} */
    particles;

    /** @type {Splash[]} */
    splashes;

    /** @type {Splat[]} */
    splats;

    constructor() {
        this.particles = [];
        this.splashes = [];
        this.splats = [];
    }

    // ----------------------------------------------------------
    // Core Update & Draw
    // ----------------------------------------------------------

    /**
     * Update all active effects. Call once per frame.
     * @param {number} dt - Delta time in seconds
     */
    update(dt) {
        this._updateSplashes(dt);
        this._updateSplats(dt);
        this._updateParticles(dt);
    }

    /**
     * Draw all active effects onto the canvas context.
     * @param {CanvasRenderingContext2D} ctx
     */
    draw(ctx) {
        this._drawSplashes(ctx);
        this._drawSplats(ctx);
        this._drawParticles(ctx);
    }

    // ----------------------------------------------------------
    // Splash
    // ----------------------------------------------------------

    /**
     * Play a circular splash effect at the given position.
     * Scale expands from 0 to 2.5, alpha fades from 0.8 to 0.
     * @param {number} x
     * @param {number} y
     * @param {string} color - CSS hex color
     * @param {number} [duration=0.4]
     */
    playSplash(x, y, color, duration = 0.4) {
        this.splashes.push({
            x,
            y,
            color,
            duration,
            elapsed: 0,
            scale: 0,
            alpha: 0.8,
        });
    }

    /** @private */
    _updateSplashes(dt) {
        for (let i = this.splashes.length - 1; i >= 0; i--) {
            const s = this.splashes[i];
            s.elapsed += dt;
            const t = Math.min(s.elapsed / s.duration, 1);
            const eased = easeOutQuad(t);

            s.scale = lerp(0, 2.5, eased);
            s.alpha = lerp(0.8, 0, eased);

            if (s.elapsed >= s.duration) {
                this.splashes.splice(i, 1);
            }
        }
    }

    /** @private */
    _drawSplashes(ctx) {
        for (const s of this.splashes) {
            if (s.alpha <= 0) continue;

            ctx.save();
            ctx.globalAlpha = s.alpha;
            ctx.beginPath();
            ctx.arc(s.x, s.y, 20 * s.scale, 0, Math.PI * 2);
            ctx.fillStyle = hexToRGBA(s.color, 1);
            ctx.fill();
            ctx.restore();
        }
    }

    // ----------------------------------------------------------
    // Splat (3-phase viscous liquid)
    // ----------------------------------------------------------

    /**
     * Play a 3-phase viscous splat effect from source to target.
     * Phase 1 (0~0.1s): Appear, scale 0 -> 1
     * Phase 2 (0.1~0.32s): Flow to target, position interpolation, EaseIn
     * Phase 3 (0.32~0.44s): Absorb, scale 1 -> 0, alpha 1 -> 0
     * @param {number} srcX
     * @param {number} srcY
     * @param {number} tgtX
     * @param {number} tgtY
     * @param {string} color - CSS hex color
     * @param {number} [duration=0.44]
     */
    playSplat(srcX, srcY, tgtX, tgtY, color, duration = 0.44) {
        this.splats.push({
            srcX,
            srcY,
            tgtX,
            tgtY,
            x: srcX,
            y: srcY,
            color,
            duration,
            elapsed: 0,
            scale: 0,
            alpha: 1,
            baseSize: 8,
        });
    }

    /** @private */
    _updateSplats(dt) {
        for (let i = this.splats.length - 1; i >= 0; i--) {
            const s = this.splats[i];
            s.elapsed += dt;
            const totalT = Math.min(s.elapsed / s.duration, 1);

            // Phase boundaries (normalized)
            const p1End = 0.1 / s.duration;   // ~0.227
            const p2End = 0.32 / s.duration;  // ~0.727
            // p3End = 1.0

            if (totalT <= p1End) {
                // Phase 1: Appear
                const phaseT = totalT / p1End;
                s.scale = easeOutQuad(phaseT);
                s.alpha = 1;
                s.x = s.srcX;
                s.y = s.srcY;
            } else if (totalT <= p2End) {
                // Phase 2: Flow to target
                const phaseT = (totalT - p1End) / (p2End - p1End);
                const eased = easeInQuad(phaseT);
                s.x = lerp(s.srcX, s.tgtX, eased);
                s.y = lerp(s.srcY, s.tgtY, eased);
                s.scale = 1;
                s.alpha = 1;
            } else {
                // Phase 3: Absorb
                const phaseT = (totalT - p2End) / (1 - p2End);
                const eased = easeOutQuad(phaseT);
                s.x = s.tgtX;
                s.y = s.tgtY;
                s.scale = lerp(1, 0, eased);
                s.alpha = lerp(1, 0, eased);
            }

            if (s.elapsed >= s.duration) {
                this.splats.splice(i, 1);
            }
        }
    }

    /** @private */
    _drawSplats(ctx) {
        for (const s of this.splats) {
            if (s.alpha <= 0 || s.scale <= 0) continue;

            ctx.save();
            ctx.globalAlpha = s.alpha;

            // Draw as an elongated blob
            const radius = s.baseSize * s.scale;
            ctx.beginPath();
            ctx.arc(s.x, s.y, radius, 0, Math.PI * 2);
            ctx.fillStyle = hexToRGBA(s.color, 1);
            ctx.fill();

            ctx.restore();
        }
    }

    // ----------------------------------------------------------
    // Particle Burst
    // ----------------------------------------------------------

    /**
     * Play a radial particle burst effect.
     * Particles fly outward from the center with fading alpha and shrinking size.
     * @param {number} x - Center x
     * @param {number} y - Center y
     * @param {string} color - CSS hex color
     * @param {number} [count=6]
     * @param {number} [duration=0.5]
     */
    playParticleBurst(x, y, color, count = 6, duration = 0.5) {
        const angleStep = (Math.PI * 2) / count;

        for (let i = 0; i < count; i++) {
            // Base angle with +-15 degree random dispersion
            const baseAngle = angleStep * i;
            const dispersion = ((Math.random() - 0.5) * 2) * (15 * Math.PI / 180);
            const angle = baseAngle + dispersion;

            // Speed: 100-150 px/s
            const speed = 100 + Math.random() * 50;

            // Size: 3-5 px
            const size = 3 + Math.random() * 2;

            this.particles.push({
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                size,
                startSize: size,
                color,
                alpha: 1,
                life: 0,
                maxLife: duration,
            });
        }
    }

    /** @private */
    _updateParticles(dt) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.life += dt;

            // Move
            p.x += p.vx * dt;
            p.y += p.vy * dt;

            const t = Math.min(p.life / p.maxLife, 1);

            // Fade: alpha 1 -> 0 (easeInQuad)
            p.alpha = 1 - easeInQuad(t);

            // Shrink gradually
            p.size = p.startSize * (1 - t);

            if (p.life >= p.maxLife) {
                this.particles.splice(i, 1);
            }
        }
    }

    /** @private */
    _drawParticles(ctx) {
        for (const p of this.particles) {
            if (p.alpha <= 0 || p.size <= 0) continue;

            ctx.save();
            ctx.globalAlpha = p.alpha;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fillStyle = hexToRGBA(p.color, 1);
            ctx.fill();
            ctx.restore();
        }
    }

    // ----------------------------------------------------------
    // Utility
    // ----------------------------------------------------------

    /**
     * Remove all active effects immediately.
     */
    clear() {
        this.particles.length = 0;
        this.splashes.length = 0;
        this.splats.length = 0;
    }

    /**
     * Check if there are any active effects.
     * @returns {boolean}
     */
    hasActiveEffects() {
        return this.particles.length > 0
            || this.splashes.length > 0
            || this.splats.length > 0;
    }
}
