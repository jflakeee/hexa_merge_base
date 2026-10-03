/**
 * Undo History Stack
 *
 * Maintains an ordered stack of player actions so that any input, note
 * toggle, or erase can be undone step-by-step.
 *
 * Each action object has the shape:
 * ```
 * {
 *   type: 'input' | 'note' | 'erase',
 *   row: number,
 *   col: number,
 *   prevValue: number,
 *   newValue: number,
 *   prevNotes?: number[],   // snapshot of notes before the action
 *   newNotes?: number[],    // snapshot of notes after the action
 * }
 * ```
 *
 * @module game/history
 */

/**
 * @typedef {Object} Action
 * @property {'input' | 'note' | 'erase'} type - Kind of action.
 * @property {number} row - Row index (0-8).
 * @property {number} col - Column index (0-8).
 * @property {number} prevValue - Cell value before the action.
 * @property {number} newValue - Cell value after the action.
 * @property {number[]} [prevNotes] - Notes array before the action.
 * @property {number[]} [newNotes] - Notes array after the action.
 */

/**
 * @class History
 */
export class History {
    /**
     * Create an empty undo stack.
     */
    constructor() {
        /** @type {Action[]} */
        this._stack = [];
    }

    // -----------------------------------------------------------------------
    // Public methods
    // -----------------------------------------------------------------------

    /**
     * Push a new action onto the undo stack.
     *
     * @param {Action} action - The action to record.
     */
    push(action) {
        this._stack.push(action);
    }

    /**
     * Pop and return the most recent action.
     *
     * @returns {Action | null} The last action, or `null` if the stack is empty.
     */
    pop() {
        if (this._stack.length === 0) return null;
        return this._stack.pop();
    }

    /**
     * Remove all entries from the stack.
     */
    clear() {
        this._stack = [];
    }

    /**
     * Check whether there is at least one action to undo.
     *
     * @returns {boolean}
     */
    canUndo() {
        return this._stack.length > 0;
    }

    /**
     * Serialise the stack for persistence (e.g. saving to localStorage).
     *
     * @returns {Action[]} Plain array of action objects (already JSON-safe).
     */
    toJSON() {
        return this._stack.map(action => ({ ...action }));
    }

    /**
     * Restore the stack from previously serialised data.
     *
     * @param {Action[]} data - Array of action objects produced by `toJSON()`.
     */
    fromJSON(data) {
        if (!Array.isArray(data)) {
            this._stack = [];
            return;
        }
        this._stack = data.map(action => ({ ...action }));
    }
}
