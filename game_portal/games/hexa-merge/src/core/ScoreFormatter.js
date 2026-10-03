/** Compact score labels without changing the stored numeric value. */
const UNITS = ['', 'K', 'M', 'B', 'T', 'P', 'E', 'Z', 'Y', 'R', 'Q'];

export function formatScore(value, { compact = true, signed = false } = {}) {
    if (!Number.isFinite(value) || value < 0) return '—';
    const prefix = signed && value > 0 ? '+' : '';
    if (!compact) return prefix + Math.floor(value).toLocaleString('en-US', { maximumFractionDigits: 0 });
    if (value < 1000) return prefix + Math.floor(value);
    // Keep extreme scores short and monotonic; never cycle back to small units.
    if (value >= 1e33) {
        const exponent = Math.floor(Math.log10(value));
        const mantissa = Math.floor(value / 10 ** exponent * 10) / 10;
        return `${prefix}${mantissa}e${exponent}`;
    }
    let unit = 0;
    while (unit + 1 < UNITS.length && value >= 1000 ** (unit + 1)) unit++;
    const scaled = Math.floor(value / (1000 ** unit) * 10) / 10;
    return prefix + scaled + UNITS[unit];
}

/** Preserve the full score for assistive technology and pointer inspection. */
export function setScoreText(element, value) {
    element.textContent = formatScore(value);
    const full = formatScore(value, { compact: false });
    element.setAttribute('aria-label', full);
    element.title = full;
}
