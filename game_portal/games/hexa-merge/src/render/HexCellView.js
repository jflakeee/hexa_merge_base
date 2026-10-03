/**
 * @fileoverview Hex cell visual rendering for Canvas.
 * Draws individual hex cells with flat-top orientation, gradients,
 * text labels, crown icons, and highlight effects.
 */

import { getColor } from '../config/tileColors.js';
import { formatValue } from '../core/TileHelper.js';

// ----------------------------------------------------------
// Hexagon Path
// ----------------------------------------------------------

/**
 * Draw a flat-top hexagon path with rounded corners on the given context.
 * Vertices at 0, 60, 120, 180, 240, 300 degrees.
 * Corner rounding uses arcTo for smooth radius at each vertex.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} cx - Center x
 * @param {number} cy - Center y
 * @param {number} size - Outer radius (center to vertex)
 */
export function drawHexagon(ctx, cx, cy, size) {
    const cornerRadius = size * 0.20;

    const vertices = [];
    for (let i = 0; i < 6; i++) {
        const angleRad = (Math.PI / 180) * (60 * i);
        vertices.push({
            x: cx + size * Math.cos(angleRad),
            y: cy + size * Math.sin(angleRad)
        });
    }

    ctx.beginPath();
    // Start at midpoint between last vertex and first vertex
    ctx.moveTo(
        (vertices[5].x + vertices[0].x) / 2,
        (vertices[5].y + vertices[0].y) / 2
    );

    for (let i = 0; i < 6; i++) {
        const next = (i + 1) % 6;
        ctx.arcTo(
            vertices[i].x, vertices[i].y,
            vertices[next].x, vertices[next].y,
            cornerRadius
        );
    }
    ctx.closePath();
}

// ----------------------------------------------------------
// Color Helpers
// ----------------------------------------------------------

/**
 * Darken a hex color string by a given factor.
 * @param {string} hex - CSS hex color (e.g. '#FF6B35')
 * @param {number} factor - 0 = same, 1 = black
 * @returns {string}
 */
function darkenColor(hex, factor) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const dr = Math.round(r * (1 - factor));
    const dg = Math.round(g * (1 - factor));
    const db = Math.round(b * (1 - factor));
    return `rgb(${dr},${dg},${db})`;
}

/**
 * Lighten a hex color string by a given factor.
 * @param {string} hex - CSS hex color
 * @param {number} factor - 0 = same, 1 = white
 * @returns {string}
 */
function lightenColor(hex, factor) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const lr = Math.round(r + (255 - r) * factor);
    const lg = Math.round(g + (255 - g) * factor);
    const lb = Math.round(b + (255 - b) * factor);
    return `rgb(${lr},${lg},${lb})`;
}

// ----------------------------------------------------------
// Cell Drawing
// ----------------------------------------------------------

/**
 * Draw a single hex cell with value, gradient, text, crown, and highlight.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} cx - Center x in canvas coordinates
 * @param {number} cy - Center y in canvas coordinates
 * @param {number} size - Hex outer radius
 * @param {number} value - Tile numeric value
 * @param {object} [options={}]
 * @param {boolean} [options.hasCrown=false]
 * @param {number} [options.scale=1]
 * @param {number} [options.alpha=1]
 */
export function drawCell(ctx, cx, cy, size, value, options = {}) {
    const {
        hasCrown = false,
        scale = 1,
        alpha = 1,
    } = options;

    if (value <= 0) return;

    const effectiveSize = size * scale;
    if (effectiveSize <= 0) return;

    ctx.save();
    ctx.globalAlpha = alpha;

    // --- Flat fill with very subtle gradient (5% variation) ---
    const bgColor = getColor(value);
    const lightBg = lightenColor(bgColor, 0.05);
    const darkBg = darkenColor(bgColor, 0.05);

    const grad = ctx.createLinearGradient(
        cx - effectiveSize, cy - effectiveSize,
        cx + effectiveSize, cy + effectiveSize
    );
    grad.addColorStop(0, lightBg);
    grad.addColorStop(1, darkBg);

    drawHexagon(ctx, cx, cy, effectiveSize);
    ctx.fillStyle = grad;
    ctx.fill();

    // --- Thick black border ---
    drawHexagon(ctx, cx, cy, effectiveSize);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.stroke();

    // --- Text: formatValue(value) - bold white with strong contrast ---
    const display = formatValue(value);
    if (display) {
        const len = display.length;
        let fontSize;
        if (len <= 1) fontSize = effectiveSize * 0.75;
        else if (len <= 2) fontSize = effectiveSize * 0.6;
        else if (len <= 3) fontSize = effectiveSize * 0.5;
        else fontSize = effectiveSize * 0.38;

        ctx.font = `bold ${Math.round(fontSize)}px 'Nunito ExtraBold', 'Nunito', 'Arial Black', sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Dark outline for contrast
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.lineWidth = 2;
        ctx.strokeText(display, cx, cy + 1);

        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(display, cx, cy + 1);
    }

    // --- Crown icon above the cell ---
    if (hasCrown) {
        const crownSize = effectiveSize * 0.35;
        const crownY = cy - effectiveSize * 0.72;
        drawCrown(ctx, cx, crownY, crownSize);
    }

    ctx.restore();
}

// ----------------------------------------------------------
// Empty Cell (theme-aware)
// ----------------------------------------------------------

/** @type {string} */
let _emptyCellFill = '#1a1a1e';
/** @type {string} */
let _emptyCellStroke = '#333333';

/**
 * Update empty cell colors for theme switching.
 * @param {string} fill - Fill color
 * @param {string} stroke - Stroke color
 */
export function setEmptyCellColors(fill, stroke) {
    _emptyCellFill = fill;
    _emptyCellStroke = stroke;
}

/**
 * Draw an empty cell placeholder hexagon.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} cx
 * @param {number} cy
 * @param {number} size
 */
export function drawEmptyCell(ctx, cx, cy, size) {
    ctx.save();

    drawHexagon(ctx, cx, cy, size);
    ctx.fillStyle = _emptyCellFill;
    ctx.fill();

    drawHexagon(ctx, cx, cy, size);
    ctx.strokeStyle = _emptyCellStroke;
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.restore();
}

// ----------------------------------------------------------
// Crown Icon
// ----------------------------------------------------------

/**
 * Draw a crown icon at the specified position.
 * 5 peaks with a bottom band and 3 circular gems at peak tips.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} cx - Center x of the crown
 * @param {number} cy - Center y of the crown
 * @param {number} crownSize - Overall size reference
 */
export function drawCrown(ctx, cx, cy, crownSize) {
    const w = crownSize * 2;       // total width
    const h = crownSize * 1.4;     // total height
    const halfW = w / 2;
    const halfH = h / 2;

    // Crown base rectangle
    const baseTop = cy + halfH * 0.15;
    const baseBottom = cy + halfH;
    const baseLeft = cx - halfW * 0.85;
    const baseRight = cx + halfW * 0.85;

    // 5 peak positions (x, y) - from left to right
    const peaks = [
        { x: cx - halfW * 0.8,  y: cy - halfH * 0.6 },
        { x: cx - halfW * 0.4,  y: cy - halfH * 0.35 },
        { x: cx,                 y: cy - halfH },
        { x: cx + halfW * 0.4,  y: cy - halfH * 0.35 },
        { x: cx + halfW * 0.8,  y: cy - halfH * 0.6 },
    ];

    // Valley depth between peaks
    const valleyY = cy + halfH * 0.05;

    ctx.save();

    // Draw crown body path
    ctx.beginPath();
    ctx.moveTo(baseLeft, baseBottom);
    ctx.lineTo(baseLeft, valleyY);

    // Zigzag through peaks
    ctx.lineTo(peaks[0].x, peaks[0].y);
    ctx.lineTo((peaks[0].x + peaks[1].x) / 2, valleyY);
    ctx.lineTo(peaks[1].x, peaks[1].y);
    ctx.lineTo((peaks[1].x + peaks[2].x) / 2, valleyY);
    ctx.lineTo(peaks[2].x, peaks[2].y);
    ctx.lineTo((peaks[2].x + peaks[3].x) / 2, valleyY);
    ctx.lineTo(peaks[3].x, peaks[3].y);
    ctx.lineTo((peaks[3].x + peaks[4].x) / 2, valleyY);
    ctx.lineTo(peaks[4].x, peaks[4].y);

    ctx.lineTo(baseRight, valleyY);
    ctx.lineTo(baseRight, baseBottom);
    ctx.closePath();

    // Gold fill with gradient
    const crownGrad = ctx.createLinearGradient(cx, cy - halfH, cx, cy + halfH);
    crownGrad.addColorStop(0, '#FFE44D');
    crownGrad.addColorStop(0.5, '#FFD700');
    crownGrad.addColorStop(1, '#DAA520');
    ctx.fillStyle = crownGrad;
    ctx.fill();

    // Dark gold stroke
    ctx.strokeStyle = '#B8860B';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Circular gems at 3 main peak tips (indices 0, 2, 4)
    const gemRadius = crownSize * 0.12;
    const gemPeaks = [peaks[0], peaks[2], peaks[4]];
    for (const peak of gemPeaks) {
        ctx.beginPath();
        ctx.arc(peak.x, peak.y, gemRadius, 0, Math.PI * 2);
        ctx.fillStyle = '#FF4444';
        ctx.fill();
        ctx.strokeStyle = '#CC0000';
        ctx.lineWidth = 0.5;
        ctx.stroke();
    }

    ctx.restore();
}
