/**
 * @fileoverview Hex coordinate system using cube coordinates (flat-top layout).
 * Ported from Unity C# HexCoord.cs to pure JavaScript ES Module.
 */

/**
 * Hex direction enum (0-based).
 * @enum {number}
 */
export const Direction = Object.freeze({
    NE: 0,
    E:  1,
    SE: 2,
    SW: 3,
    W:  4,
    NW: 5
});

/**
 * Immutable hex coordinate in cube coordinate system.
 * Uses axial coordinates (q, r) with derived s = -q - r.
 */
export class HexCoord {
    /**
     * The six direction offsets in cube coordinates.
     * Order: NE, E, SE, SW, W, NW
     * @type {ReadonlyArray<HexCoord>}
     */
    static DIRECTIONS = Object.freeze([
        new HexCoord(+1, -1), // NE
        new HexCoord(+1,  0), // E
        new HexCoord( 0, +1), // SE
        new HexCoord(-1, +1), // SW
        new HexCoord(-1,  0), // W
        new HexCoord( 0, -1), // NW
    ]);

    /** @type {number} */
    q;
    /** @type {number} */
    r;

    /**
     * @param {number} q - Axial q coordinate
     * @param {number} r - Axial r coordinate
     */
    constructor(q, r) {
        this.q = q;
        this.r = r;
    }

    /**
     * Derived cube coordinate s = -q - r.
     * @returns {number}
     */
    get s() {
        return -this.q - this.r;
    }

    /**
     * Get the neighbor coordinate in the given direction.
     * @param {number} direction - Direction enum value (0-5)
     * @returns {HexCoord}
     */
    getNeighbor(direction) {
        const offset = HexCoord.DIRECTIONS[direction];
        return new HexCoord(this.q + offset.q, this.r + offset.r);
    }

    /**
     * Get all six neighbor coordinates.
     * @returns {HexCoord[]}
     */
    getNeighbors() {
        const neighbors = new Array(6);
        for (let i = 0; i < 6; i++) {
            const d = HexCoord.DIRECTIONS[i];
            neighbors[i] = new HexCoord(this.q + d.q, this.r + d.r);
        }
        return neighbors;
    }

    /**
     * Calculate the hex distance to another coordinate.
     * @param {HexCoord} other
     * @returns {number}
     */
    distanceTo(other) {
        return (Math.abs(this.q - other.q)
              + Math.abs(this.r - other.r)
              + Math.abs(this.s - other.s)) / 2;
    }

    /**
     * Check equality with another HexCoord.
     * @param {HexCoord} other
     * @returns {boolean}
     */
    equals(other) {
        if (!other) return false;
        return this.q === other.q && this.r === other.r;
    }

    /**
     * Convert to a string key suitable for use as Map key.
     * @returns {string} Format: "q,r"
     */
    toKey() {
        return `${this.q},${this.r}`;
    }

    /**
     * Create a HexCoord from a string key.
     * @param {string} key - Format: "q,r"
     * @returns {HexCoord}
     */
    static fromKey(key) {
        const parts = key.split(',');
        return new HexCoord(parseInt(parts[0], 10), parseInt(parts[1], 10));
    }

    /**
     * Convert hex coordinate to pixel position (flat-top layout).
     * @param {number} hexSize - Hex cell size (outer radius)
     * @returns {{x: number, y: number}}
     */
    toPixel(hexSize) {
        const x = hexSize * 1.5 * this.q;
        const y = hexSize * Math.sqrt(3) * (this.r + this.q / 2);
        return { x, y };
    }

    /**
     * Convert pixel position to the nearest hex coordinate (flat-top layout).
     * Uses cube rounding for accurate conversion.
     * @param {number} x - Pixel x
     * @param {number} y - Pixel y
     * @param {number} hexSize - Hex cell size (outer radius)
     * @returns {HexCoord}
     */
    static pixelToHex(x, y, hexSize) {
        // Inverse of flat-top toPixel
        const q = (2 / 3) * x / hexSize;
        const r = (-1 / 3) * x / hexSize + (Math.sqrt(3) / 3) * y / hexSize;

        // Cube round
        const s = -q - r;

        let rq = Math.round(q);
        let rr = Math.round(r);
        let rs = Math.round(s);

        const dq = Math.abs(rq - q);
        const dr = Math.abs(rr - r);
        const ds = Math.abs(rs - s);

        if (dq > dr && dq > ds) {
            rq = -rr - rs;
        } else if (dr > ds) {
            rr = -rq - rs;
        }
        // else rs = -rq - rr (not needed since we only store q, r)

        return new HexCoord(rq, rr);
    }

    /**
     * Add two HexCoords.
     * @param {HexCoord} other
     * @returns {HexCoord}
     */
    add(other) {
        return new HexCoord(this.q + other.q, this.r + other.r);
    }

    /**
     * Subtract another HexCoord.
     * @param {HexCoord} other
     * @returns {HexCoord}
     */
    subtract(other) {
        return new HexCoord(this.q - other.q, this.r - other.r);
    }

    /**
     * @returns {string}
     */
    toString() {
        return `(${this.q}, ${this.r}, ${this.s})`;
    }
}
