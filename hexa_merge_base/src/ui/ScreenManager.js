/**
 * @fileoverview Screen overlay manager for game UI screens.
 * Manages show/hide transitions for overlay screens (game over, pause, how-to-play).
 * ES Module - pure web implementation.
 */

export class ScreenManager {
    constructor() {
        /**
         * Screen name to DOM element mapping.
         * @type {Object<string, HTMLElement>}
         */
        this.screens = {};

        /**
         * Currently displayed screen name, or 'gameplay' if no overlay is active.
         * @type {string}
         */
        this.currentScreen = 'gameplay';
    }

    /**
     * Initialize by finding all screen overlay elements in the DOM.
     * Screens are identified by the data-screen attribute.
     */
    init() {
        const overlays = document.querySelectorAll('[data-screen]');
        overlays.forEach((el) => {
            const name = el.getAttribute('data-screen');
            this.screens[name] = el;
        });
    }

    /**
     * Show a screen overlay with a fade-in transition.
     * Hides the current overlay first (if any), then shows the new one.
     * @param {string} name - Screen name matching data-screen attribute
     * @param {number} [fadeMs=300] - Fade transition duration in milliseconds
     */
    showScreen(name, fadeMs = 300) {
        const screen = this.screens[name];
        if (!screen) return;

        // Hide current overlay if one is active
        if (this.currentScreen !== 'gameplay') {
            this.hideScreen(this.currentScreen);
        }

        // Set up for fade-in
        screen.style.transition = `opacity ${fadeMs}ms ease`;
        screen.style.opacity = '0';
        screen.style.display = 'flex';

        // Force reflow to ensure the transition starts from opacity 0
        screen.offsetHeight; // eslint-disable-line no-unused-expressions

        // Trigger fade-in
        screen.style.opacity = '1';
        screen.classList.add('active');

        this.currentScreen = name;
    }

    /**
     * Hide a screen overlay with a fade-out transition.
     * @param {string} name - Screen name to hide
     * @param {number} [fadeMs=200] - Fade transition duration in milliseconds
     */
    hideScreen(name, fadeMs = 200) {
        const screen = this.screens[name];
        if (!screen) return;

        screen.style.transition = `opacity ${fadeMs}ms ease`;
        screen.style.opacity = '0';
        screen.classList.remove('active');

        if (this.currentScreen === name) {
            this.currentScreen = 'gameplay';
        }

        setTimeout(() => {
            screen.style.display = 'none';
        }, fadeMs);
    }

    /**
     * Get the name of the currently active screen.
     * @returns {string} Screen name or 'gameplay' if no overlay is shown
     */
    getCurrentScreen() {
        return this.currentScreen;
    }
}
