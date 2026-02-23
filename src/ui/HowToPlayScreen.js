/**
 * @fileoverview How To Play overlay screen.
 * Displays game instructions and a "Got It!" dismiss button.
 * ES Module - pure web implementation.
 */

export class HowToPlayScreen {
    constructor() {
        /** @type {HTMLElement|null} */
        this._container = null;

        /**
         * Callback when the screen is dismissed.
         * @type {function|null}
         */
        this.onClose = null;
    }

    /**
     * Build the how-to-play screen DOM inside the given container.
     * @param {HTMLElement} container - The overlay container element (e.g., #screen-howtoplay)
     */
    init(container) {
        this._container = container;

        // Clear any existing content
        container.innerHTML = '';

        // Title
        const title = document.createElement('h2');
        title.textContent = 'HOW TO PLAY';
        container.appendChild(title);

        // Instructions container
        const instructions = document.createElement('div');
        instructions.style.maxWidth = '320px';
        instructions.style.textAlign = 'center';
        instructions.style.color = '#CCC';
        instructions.style.fontSize = '15px';
        instructions.style.lineHeight = '1.6';
        instructions.style.padding = '0 20px';
        container.appendChild(instructions);

        const steps = [
            'Tap a tile to merge it with adjacent tiles of the same value.',
            'When two or more adjacent tiles share the same value, they merge into one tile with a higher value!',
            'Plan your moves carefully to create chain reactions and reach higher numbers.',
            'The game ends when the board is full and no more merges are possible.',
            'Try to beat your high score!'
        ];

        steps.forEach((text, index) => {
            const step = document.createElement('p');
            step.style.marginBottom = '12px';
            step.innerHTML = `<strong style="color: #FF69B4;">${index + 1}.</strong> ${text}`;
            instructions.appendChild(step);
        });

        // Got It! button
        const gotItBtn = document.createElement('button');
        gotItBtn.className = 'overlay-btn primary';
        gotItBtn.textContent = 'Got It!';
        gotItBtn.style.marginTop = '20px';
        gotItBtn.addEventListener('click', () => {
            if (this.onClose) this.onClose();
        });
        container.appendChild(gotItBtn);
    }

    /**
     * Show the how-to-play screen.
     */
    show() {
        // Visibility managed by ScreenManager
    }

    /**
     * Hide the how-to-play screen.
     */
    hide() {
        // Visibility managed by ScreenManager
    }
}
