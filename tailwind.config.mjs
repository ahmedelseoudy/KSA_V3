import colors from 'tailwindcss/colors';

// Builds a Tailwind color-shade object that points each stop at a CSS variable
// (`--<prefix>-<stop>`, defined in src/styles/global.css) instead of a fixed
// value, so swapping the `.dark`/`.light` class on <html> re-themes every
// utility using that color — including ones inside JS innerHTML templates —
// without touching page markup. See CLAUDE.md "Frontend Design System".
function themedShades(prefix, stops) {
  return Object.fromEntries(stops.map((stop) => [stop, `rgb(var(--${prefix}-${stop}) / <alpha-value>)`]));
}

const NEUTRAL_STOPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
const ACCENT_STOPS = [300, 400, 500, 600, 700];

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
      colors: {
        // Neutral scale (slate-based) — themed via CSS vars, see src/styles/global.css.
        gray: themedShades('gray', NEUTRAL_STOPS),
        // `white` is theme-aware (inverts to near-black in light mode) for
        // heading/body text on the neutral surface scale. `oncolor` stays
        // literal white in both themes for text/icons on a solid brand-color
        // surface (buttons, the logo tile, active tab pills) — those never
        // sit on the neutral scale, so they must not invert.
        white: `rgb(var(--white) / <alpha-value>)`,
        oncolor: '#ffffff',
        // Brand accent (violet). indigo aliases the same vars as purple so both
        // utilities stay unified onto one brand color, as before.
        purple: { ...colors.violet, ...themedShades('purple', ACCENT_STOPS) },
        indigo: { ...colors.violet, ...themedShades('purple', ACCENT_STOPS) },
        // Status colors: only 300-700 are themed (the shades actually used for
        // soft badges app-wide); other stops fall back to stock Tailwind values.
        red: { ...colors.red, ...themedShades('red', ACCENT_STOPS) },
        green: { ...colors.green, ...themedShades('green', ACCENT_STOPS) },
        yellow: { ...colors.yellow, ...themedShades('yellow', ACCENT_STOPS) },
        blue: { ...colors.blue, ...themedShades('blue', ACCENT_STOPS) },
        orange: { ...colors.orange, ...themedShades('orange', ACCENT_STOPS) },
        // Module accent colors (Products/Companies/Availability/Analytics/Admin).
        cyan: { ...colors.cyan, ...themedShades('cyan', ACCENT_STOPS) },
        sky: { ...colors.sky, ...themedShades('sky', ACCENT_STOPS) },
        emerald: { ...colors.emerald, ...themedShades('emerald', ACCENT_STOPS) },
        amber: { ...colors.amber, ...themedShades('amber', ACCENT_STOPS) },
        fuchsia: { ...colors.fuchsia, ...themedShades('fuchsia', ACCENT_STOPS) },
        rose: { ...colors.rose, ...themedShades('rose', ACCENT_STOPS) },
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(0 0 0 / 0.25), 0 0 0 1px rgb(255 255 255 / 0.03)',
        modal: '0 25px 50px -12px rgb(0 0 0 / 0.6)',
      },
      borderRadius: {
        xl: '0.875rem',
      },
    },
  },
  plugins: [],
};
