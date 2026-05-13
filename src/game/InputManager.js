/**
 * @fileoverview Input manager for hex grid tap detection.
 * Handles PointerEvent on canvas and converts pixel coordinates to hex coordinates.
 * ES Module - pure web implementation.
 */

export class InputManager {
    /**
     * @param {HTMLCanvasElement} canvas - The game canvas element
     * @param {object} renderer - Renderer instance with pixelToHex(canvasX, canvasY) method
     */
    constructor(canvas, renderer) {
        /** @private */
        this._canvas = canvas;
        /** @private */
        this._renderer = renderer;
        /** @private */
        this._handler = null;

        /**
         * Callback invoked when a valid hex cell is tapped.
         * @type {((coord: import('../core/HexCoord.js').HexCoord) => void)|null}
         */
        this.onCellTap = null;
    }

    /**
     * Register pointer event listeners on the canvas.
     * Sets touch-action: none to prevent default touch behaviors (scrolling, zooming).
     */
    init() {
        // Prevent default touch gestures on the canvas
        this._canvas.style.touchAction = 'none';

        this._handler = (e) => this._onPointerDown(e);
        this._canvas.addEventListener('pointerdown', this._handler);
    }

    /**
     * Handle pointerdown events.
     * Converts screen coordinates to canvas-local CSS pixel coordinates,
     * then converts to hex coordinates via the renderer.
     * Note: Renderer.pixelToHex operates in CSS pixel space (DPR is handled
     * internally via ctx.setTransform), so we do NOT multiply by DPR here.
     * @param {PointerEvent} e
     * @private
     */
    _onPointerDown(e) {
        // Prevent default to avoid text selection, context menus, etc.
        e.preventDefault();

        const rect = this._canvas.getBoundingClientRect();

        // Convert pointer position to canvas-local CSS pixel coordinates
        const canvasX = e.clientX - rect.left;
        const canvasY = e.clientY - rect.top;

        // Convert CSS pixel coordinates to hex coordinate
        const coord = this._renderer.pixelToHex(canvasX, canvasY);

        if (coord && this.onCellTap) {
            this.onCellTap(coord);
        }
    }

    /**
     * Remove all event listeners and clean up.
     */
    destroy() {
        if (this._handler) {
            this._canvas.removeEventListener('pointerdown', this._handler);
            this._handler = null;
        }
        this.onCellTap = null;
    }
}
