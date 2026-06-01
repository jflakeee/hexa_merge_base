/**
 * @fileoverview Background fireworks effect — celebratory bursts shown when the
 * crown moves to a new block. Drawn behind the board (background layer).
 * Self-contained: update(dt) + draw(ctx); ES Module - pure web implementation.
 */

const PALETTE = [
    '#FECC33', '#E2491A', '#E26887', '#B61EC5',
    '#7953AE', '#305DEE', '#40C9A5', '#A1EF39', '#FFFFFF',
];

const GRAVITY = 150;        // px/s^2 downward pull
const PARTICLES_PER_BURST = 26;

export class Fireworks {
    constructor() {
        /** @type {Array<{x:number,y:number,vx:number,vy:number,life:number,maxLife:number,size:number,color:string}>} */
        this.particles = [];
        /** @type {Array<{t:number,x:number,y:number,color:string}>} */
        this.pending = [];
    }

    /**
     * Launch a short fireworks show across the background.
     * @param {number} width  - canvas CSS width
     * @param {number} height - canvas CSS height
     */
    celebrate(width, height) {
        const n = 4 + Math.floor(Math.random() * 3); // 4-6 sequential bursts
        for (let i = 0; i < n; i++) {
            this.pending.push({
                t: i * 0.16,
                x: width * (0.15 + Math.random() * 0.7),
                y: height * (0.10 + Math.random() * 0.42), // upper/background area
                color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
            });
        }
    }

    /** @private Spawn one radial explosion. */
    _burst(cx, cy, color) {
        const step = (Math.PI * 2) / PARTICLES_PER_BURST;
        for (let i = 0; i < PARTICLES_PER_BURST; i++) {
            const angle = step * i + (Math.random() - 0.5) * step;
            const speed = 110 + Math.random() * 150;
            const maxLife = 0.9 + Math.random() * 0.6;
            // Mostly the burst color, with occasional white sparkle.
            const c = Math.random() < 0.15 ? '#FFFFFF' : color;
            this.particles.push({
                x: cx, y: cy,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 0, maxLife,
                size: 2 + Math.random() * 2.5,
                color: c,
            });
        }
    }

    /**
     * Advance pending launches and live particles.
     * @param {number} dt - delta time (seconds)
     */
    update(dt) {
        for (let i = this.pending.length - 1; i >= 0; i--) {
            const p = this.pending[i];
            p.t -= dt;
            if (p.t <= 0) {
                this._burst(p.x, p.y, p.color);
                this.pending.splice(i, 1);
            }
        }
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const q = this.particles[i];
            q.life += dt;
            q.vy += GRAVITY * dt;
            q.x += q.vx * dt;
            q.y += q.vy * dt;
            if (q.life >= q.maxLife) this.particles.splice(i, 1);
        }
    }

    /**
     * Draw the fireworks with additive glow.
     * @param {CanvasRenderingContext2D} ctx
     */
    draw(ctx) {
        if (this.particles.length === 0) return;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (const q of this.particles) {
            const t = q.life / q.maxLife;
            const alpha = 1 - t * t;            // fade out, slow then fast
            if (alpha <= 0) continue;
            const r = q.size * (1 - t * 0.6);
            ctx.globalAlpha = alpha;
            ctx.fillStyle = q.color;
            ctx.beginPath();
            ctx.arc(q.x, q.y, r, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }

    /** @returns {boolean} */
    hasActive() {
        return this.particles.length > 0 || this.pending.length > 0;
    }

    /** Clear all fireworks. */
    clear() {
        this.particles.length = 0;
        this.pending.length = 0;
    }
}
