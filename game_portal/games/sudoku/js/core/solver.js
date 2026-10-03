/**
 * Sudoku Solver
 *
 * Backtracking-based solver for 9x9 Sudoku puzzles.
 * Board representation: 9x9 array of integers, 0 = empty cell.
 *
 * @module solver
 */

/**
 * Check whether placing `num` at (row, col) is valid according to
 * standard Sudoku rules (no duplicate in row, column, or 3x3 block).
 *
 * @param {number[][]} board - 9x9 Sudoku board (0 = empty)
 * @param {number} row - Row index (0-8)
 * @param {number} col - Column index (0-8)
 * @param {number} num - Number to test (1-9)
 * @returns {boolean} True if the placement is valid
 */
export function isValid(board, row, col, num) {
    // Check row
    for (let c = 0; c < 9; c++) {
        if (board[row][c] === num) return false;
    }

    // Check column
    for (let r = 0; r < 9; r++) {
        if (board[r][col] === num) return false;
    }

    // Check 3x3 block
    const blockRow = Math.floor(row / 3) * 3;
    const blockCol = Math.floor(col / 3) * 3;
    for (let r = blockRow; r < blockRow + 3; r++) {
        for (let c = blockCol; c < blockCol + 3; c++) {
            if (board[r][c] === num) return false;
        }
    }

    return true;
}

/**
 * Get the set of valid candidate numbers for a given empty cell.
 *
 * @param {number[][]} board - 9x9 Sudoku board (0 = empty)
 * @param {number} row - Row index (0-8)
 * @param {number} col - Column index (0-8)
 * @returns {Set<number>} Set of valid numbers (1-9) that can be placed
 */
export function getCandidates(board, row, col) {
    const candidates = new Set();

    if (board[row][col] !== 0) {
        return candidates;
    }

    for (let num = 1; num <= 9; num++) {
        if (isValid(board, row, col, num)) {
            candidates.add(num);
        }
    }

    return candidates;
}

/**
 * Find the next empty cell on the board, using the MRV (Minimum Remaining
 * Values) heuristic: pick the empty cell with the fewest candidates first.
 * This dramatically prunes the search tree.
 *
 * @param {number[][]} board - 9x9 Sudoku board
 * @returns {{row: number, col: number} | null} Position of the best empty cell, or null if none
 */
function findBestEmptyCell(board) {
    let bestCell = null;
    let minCandidates = 10;

    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            if (board[r][c] === 0) {
                const count = getCandidates(board, r, c).size;
                if (count < minCandidates) {
                    minCandidates = count;
                    bestCell = { row: r, col: c };
                    // Can't do better than 1
                    if (count === 1) return bestCell;
                }
            }
        }
    }

    return bestCell;
}

/**
 * Solve a Sudoku puzzle using backtracking with MRV heuristic.
 * The input board is not modified; a new solved board is returned.
 *
 * @param {number[][]} board - 9x9 Sudoku board (0 = empty)
 * @returns {number[][] | null} Solved 9x9 board, or null if no solution exists
 */
export function solve(board) {
    // Deep copy the board so we don't mutate the original
    const copy = board.map(row => [...row]);

    if (solveInPlace(copy)) {
        return copy;
    }

    return null;
}

/**
 * Internal recursive solver that mutates the board in place.
 *
 * @param {number[][]} board - 9x9 board (mutated in place)
 * @returns {boolean} True if the board was solved successfully
 */
function solveInPlace(board) {
    const cell = findBestEmptyCell(board);

    // No empty cell means the puzzle is complete
    if (!cell) return true;

    const { row, col } = cell;
    const candidates = getCandidates(board, row, col);

    for (const num of candidates) {
        board[row][col] = num;

        if (solveInPlace(board)) {
            return true;
        }

        board[row][col] = 0;
    }

    return false;
}

/**
 * Count the number of solutions for a given board, stopping early once
 * the count reaches `limit`. This is used to verify puzzle uniqueness
 * (a proper Sudoku puzzle must have exactly 1 solution).
 *
 * @param {number[][]} board - 9x9 Sudoku board (0 = empty)
 * @param {number} [limit=2] - Stop counting once this many solutions are found
 * @returns {number} Number of solutions found (capped at `limit`)
 */
export function countSolutions(board, limit = 2) {
    // Deep copy to avoid mutating the original
    const copy = board.map(row => [...row]);
    const counter = { count: 0 };

    countSolutionsRecursive(copy, limit, counter);

    return counter.count;
}

/**
 * Internal recursive solution counter.
 *
 * @param {number[][]} board - 9x9 board (mutated in place during recursion)
 * @param {number} limit - Maximum solutions to count
 * @param {{count: number}} counter - Mutable counter object
 */
function countSolutionsRecursive(board, limit, counter) {
    if (counter.count >= limit) return;

    const cell = findBestEmptyCell(board);

    // No empty cell — we found a complete valid solution
    if (!cell) {
        counter.count++;
        return;
    }

    const { row, col } = cell;
    const candidates = getCandidates(board, row, col);

    for (const num of candidates) {
        if (counter.count >= limit) return;

        board[row][col] = num;
        countSolutionsRecursive(board, limit, counter);
        board[row][col] = 0;
    }
}
