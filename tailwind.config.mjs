import colors from 'tailwindcss/colors';

/** @type {import('tailwindcss').Config} */
export default {
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
        // Remap the neutral scale to a slate (blue-tinted) tone so every
        // existing gray-* class — including ones inside JS innerHTML
        // templates — picks up the refreshed look without code changes.
        gray: colors.slate,
        // Unify the two competing accents (purple + indigo) onto violet so
        // buttons and badges read as one brand color app-wide.
        purple: colors.violet,
        indigo: colors.violet,
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
