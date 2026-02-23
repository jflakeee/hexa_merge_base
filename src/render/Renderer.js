/**
 * @fileoverview Main Canvas renderer for the Hexa Merge web version.
 * Manages the canvas, coordinate transforms, and full-frame rendering pipeline.
 * Flat-top hex layout. Canvas origin is top-left, +x right, +y down.
 */

import { drawCell, drawEmptyCell } from './HexCellView.js';
import { HexCoord } from '../core/HexCoord.js';

/**
 * Main canvas renderer for the hex merge game.
 */
export class Renderer {
    /** @type {HTMLCanvasElement} */
    _canvas;

    /** @type {CanvasRenderingContext2D} */
    _ctx;

    /** @type {number} Device pixel ratio */
    _dpr;

    /** @type {number} Current hex size (outer radius in CSS pixels) */
    _hexSize;

    /** @type {number} Grid center offset X in CSS pixels */
    _offsetX;

    /** @type {number} Grid center offset Y in CSS pixels */
    _offsetY;

    /** @type {number} Grid radius (default 2 for 19-cell hex) */
    _gridRadius;

    /**
     * @param {HTMLCanvasElement} canvas
     * @param {number} [gridRadius=2]
     */
    constructor(canvas, gridRadius = 2) {
        this._canvas = canvas;
        this._ctx = canvas.getContext('2d');
        this._dpr = window.devicePixelRatio || 1;
        this._gridRadius = gridRadius;
        this._hexSize = 40;
        this._offsetX = 0;
        this._offsetY = 0;

        this.resize();
    }

    // ----------------------------------------------------------
    // Sizing
    // ----------------------------------------------------------

    /**
     * Resize the canvas to match its container and recalculate hexSize.
     * Call this on window resize or orientation change.
     */
    resize() {
        this._dpr = window.devicePixelRatio || 1;

        // Use the canvas element's own CSS layout dimensions (respects flex layout)
        const w = this._canvas.clientWidth;
        const h = this._canvas.clientHeight;

        // Set actual pixel size (scaled for DPR)
        this._canvas.width = Math.round(w * this._dpr);
        this._canvas.height = Math.round(h * this._dpr);

        // Scale context for DPR so we can work in CSS pixel coordinates
        this._ctx.setTransform(this._dpr, 0, 0, this._dpr, 0, 0);

        // Calculate hex size to fit the grid within the canvas area
        const gridDiameter = this._gridRadius * 2 + 1;
        this._hexSize = Math.min(w, h) * 0.85 / gridDiameter / Math.sqrt(3);

        // Center the grid in the canvas
        this._offsetX = w / 2;
        this._offsetY = h / 2;
    }

    // ----------------------------------------------------------
    // Coordinate Transforms
    // ----------------------------------------------------------

    /**
     * Convert hex axial coordinates (q, r) to screen pixel coordinates.
     * Flat-top hex layout. Returns position in CSS pixel space.
     * @param {number} q
     * @param {number} r
     * @returns {{x: number, y: number}}
     */
    hexToPixel(q, r) {
        const x = this._offsetX + this._hexSize * 1.5 * q;
        const y = this._offsetY + this._hexSize * Math.sqrt(3) * (r + q / 2);
        return { x, y };
    }

    /**
     * Convert screen pixel coordinates to the nearest hex coordinate.
     * Uses cube rounding for accurate inverse mapping.
     * @param {number} px - Pixel x in CSS coordinates
     * @param {number} py - Pixel y in CSS coordinates
     * @returns {HexCoord}
     */
    pixelToHex(px, py) {
        // Subtract offset to get hex-local coordinates
        const localX = px - this._offsetX;
        const localY = py - this._offsetY;

        // Inverse of flat-top hex: localX = hexSize * 1.5 * q
        //                           localY = hexSize * sqrt(3) * (r + q/2)
        const q = (2 / 3) * localX / this._hexSize;
        const r = (-1 / 3) * localX / this._hexSize
                + (Math.sqrt(3) / 3) * localY / this._hexSize;

        // Cube round
        const s = -q - r;
        let rq = Math.round(q);
        let rr = Math.round(r);
        const rs = Math.round(s);

        const dq = Math.abs(rq - q);
        const dr = Math.abs(rr - r);
        const ds = Math.abs(rs - s);

        if (dq > dr && dq > ds) {
            rq = -rr - rs;
        } else if (dr > ds) {
            rr = -rq - rs;
        }

        return new HexCoord(rq, rr);
    }

    // ----------------------------------------------------------
    // Main Render Pipeline
    // ----------------------------------------------------------

    /**
     * Render a full frame.
     * @param {import('../core/HexGrid.js').HexGrid} grid - The game grid
     * @param {import('../animation/TileAnimator.js').TileAnimator} [animations=null]
     * @param {import('../animation/MergeEffect.js').MergeEffect} [effects=null]
     */
    render(grid, animations = null, effects = null) {
        const ctx = this._ctx;
        const canvas = this._canvas;
        const containerW = canvas.width / this._dpr;
        const containerH = canvas.height / this._dpr;

        // 1) Clear entire canvas
        ctx.clearRect(0, 0, containerW, containerH);

        // 2) Draw board background (empty cell placeholders)
        this._drawBackground(ctx, grid);

        // 3) Draw tiles
        this._drawTiles(ctx, grid, animations);

        // 4) Draw effects (particles, splashes)
        if (effects) {
            effects.draw(ctx);
        }

        // 5) Draw overlay animations (score popups, etc.)
        if (animations) {
            this._drawAnimations(ctx, animations);
        }
    }

    /**
     * Draw empty cell hexagons as background placeholders.
     * @param {CanvasRenderingContext2D} ctx
     * @param {import('../core/HexGrid.js').HexGrid} grid
     */
    _drawBackground(ctx, grid) {
        const allCells = grid.getAllCells();
        for (const cell of allCells) {
            const { x, y } = this.hexToPixel(cell.coord.q, cell.coord.r);
            drawEmptyCell(ctx, x, y, this._hexSize);
        }
    }

    /**
     * Draw all non-empty tiles on the grid.
     * Applies animation state (scale, alpha, offset) if available.
     * @param {CanvasRenderingContext2D} ctx
     * @param {import('../core/HexGrid.js').HexGrid} grid
     * @param {import('../animation/TileAnimator.js').TileAnimator|null} animations
     */
    _drawTiles(ctx, grid, animations) {
        const allCells = grid.getAllCells();
        for (const cell of allCells) {
            if (cell.isEmpty) continue;

            const coordKey = cell.coord.toKey();
            const { x, y } = this.hexToPixel(cell.coord.q, cell.coord.r);

            // Check for active animation on this cell
            let scale = 1;
            let alpha = 1;
            let offX = 0;
            let offY = 0;

            if (animations) {
                const animState = animations.getAnimationState(coordKey);
                if (animState) {
                    scale = animState.scale;
                    alpha = animState.alpha;
                    offX = animState.offsetX;
                    offY = animState.offsetY;
                }
            }

            drawCell(ctx, x + offX, y + offY, this._hexSize, cell.value, {
                hasCrown: cell.hasCrown,
                scale,
                alpha,
                highlight: true,
            });
        }
    }

    /**
     * Draw animation overlays (score popups, board shake, etc.).
     * @param {CanvasRenderingContext2D} ctx
     * @param {import('../animation/TileAnimator.js').TileAnimator} animations
     */
    _drawAnimations(ctx, animations) {
        // Score popups
        if (animations.scorePopups) {
            for (const popup of animations.scorePopups) {
                if (popup.elapsed >= popup.duration) continue;

                ctx.save();
                ctx.globalAlpha = popup.alpha;

                const fontSize = Math.round(20 * popup.scale);
                ctx.font = `bold ${fontSize}px 'Nunito ExtraBold', 'Nunito', 'Arial Black', sans-serif`;
                ctx.fillStyle = '#FFFFFF';
                ctx.strokeStyle = '#000000';
                ctx.lineWidth = 3;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';

                ctx.strokeText(`+${popup.score}`, popup.x, popup.y);
                ctx.fillText(`+${popup.score}`, popup.x, popup.y);

                ctx.restore();
            }
        }

        // Board shake (game over)
        // The shake offset is applied globally via animations.getShakeOffset()
        // This is handled by the game loop wrapping calls with ctx.translate()
    }

    // ----------------------------------------------------------
    // Accessors
    // ----------------------------------------------------------

    /**
     * Get the current hex size (outer radius).
     * @returns {number}
     */
    getHexSize() {
        return this._hexSize;
    }

    /**
     * Get the canvas element reference.
     * @returns {HTMLCanvasElement}
     */
    getCanvas() {
        return this._canvas;
    }

    /**
     * Get the 2D rendering context.
     * @returns {CanvasRenderingContext2D}
     */
    getContext() {
        return this._ctx;
    }

    /**
     * Get the grid center offset.
     * @returns {{x: number, y: number}}
     */
    getOffset() {
        return { x: this._offsetX, y: this._offsetY };
    }

    /**
     * Get the device pixel ratio.
     * @returns {number}
     */
    getDPR() {
        return this._dpr;
    }
}
