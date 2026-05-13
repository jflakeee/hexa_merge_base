/**
 * @fileoverview Hex cell visual rendering for Canvas.
 * Draws individual hex cells with flat-top orientation, gradients,
 * text labels, crown icons, and highlight effects.
 */

import { getColor, getTextColor } from '../config/tileColors.js';
import { formatValue } from '../core/TileHelper.js';

// ----------------------------------------------------------
// Hexagon Path
// ----------------------------------------------------------

/**
 * Draw a flat-top hexagon path on the given context.
 * Vertices at 0, 60, 120, 180, 240, 300 degrees.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} cx - Center x
 * @param {number} cy - Center y
 * @param {number} size - Outer radius (center to vertex)
 */
export function drawHexagon(ctx, cx, cy, size) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
        const angleDeg = 60 * i;
        const angleRad = (Math.PI / 180) * angleDeg;
        const vx = cx + size * Math.cos(angleRad);
        const vy = cy + size * Math.sin(angleRad);
        if (i === 0) {
            ctx.moveTo(vx, vy);
        } else {
            ctx.lineTo(vx, vy);
        }
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
 * @param {boolean} [options.highlight=true]
 */
export function drawCell(ctx, cx, cy, size, value, options = {}) {
    const {
        hasCrown = false,
        scale = 1,
        alpha = 1,
        highlight = true,
    } = options;

    if (value <= 0) return;

    const effectiveSize = size * scale;
    if (effectiveSize <= 0) return;

    ctx.save();
    ctx.globalAlpha = alpha;

    // --- Background gradient (bright top-left to darker bottom-right) ---
    const bgColor = getColor(value);
    const lightBg = lightenColor(bgColor, 0.2);
    const darkBg = darkenColor(bgColor, 0.2);

    const grad = ctx.createLinearGradient(
        cx - effectiveSize, cy - effectiveSize,
        cx + effectiveSize, cy + effectiveSize
    );
    grad.addColorStop(0, lightBg);
    grad.addColorStop(1, darkBg);

    drawHexagon(ctx, cx, cy, effectiveSize);
    ctx.fillStyle = grad;
    ctx.fill();

    // --- Border stroke (slightly darker than background) ---
    const borderColor = darkenColor(bgColor, 0.35);
    drawHexagon(ctx, cx, cy, effectiveSize);
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    // --- Highlight: top-half semi-transparent white gradient (glass effect) ---
    if (highlight) {
        ctx.save();
        drawHexagon(ctx, cx, cy, effectiveSize);
        ctx.clip();

        const hlGrad = ctx.createLinearGradient(cx, cy - effectiveSize, cx, cy);
        hlGrad.addColorStop(0, 'rgba(255,255,255,0.35)');
        hlGrad.addColorStop(1, 'rgba(255,255,255,0.0)');
        ctx.fillStyle = hlGrad;
        ctx.fillRect(cx - effectiveSize, cy - effectiveSize, effectiveSize * 2, effectiveSize);
        ctx.restore();
    }

    // --- Text: formatValue(value) with dynamic font size ---
    const display = formatValue(value);
    if (display) {
        const textColor = getTextColor(value);
        const len = display.length;
        let fontSize;
        if (len <= 1) fontSize = effectiveSize * 0.7;
        else if (len <= 2) fontSize = effectiveSize * 0.55;
        else if (len <= 3) fontSize = effectiveSize * 0.45;
        else fontSize = effectiveSize * 0.35;

        ctx.fillStyle = textColor;
        ctx.font = `bold ${Math.round(fontSize)}px 'Nunito ExtraBold', 'Nunito', 'Arial Black', sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(display, cx, cy + 1); // +1 for visual centering
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
// Empty Cell
// ----------------------------------------------------------

/**
 * Draw an empty cell placeholder (dark gray hexagon).
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} cx
 * @param {number} cy
 * @param {number} size
 */
export function drawEmptyCell(ctx, cx, cy, size) {
    ctx.save();

    drawHexagon(ctx, cx, cy, size);
    ctx.fillStyle = '#383840';
    ctx.fill();

    // Subtle border
    drawHexagon(ctx, cx, cy, size);
    ctx.strokeStyle = '#2a2a30';
    ctx.lineWidth = 1.5;
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
