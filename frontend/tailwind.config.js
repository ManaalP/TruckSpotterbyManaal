/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--color-background)',
        surface: 'var(--color-surface)',
        border: 'var(--color-border)',
        primary: {
          DEFAULT: 'var(--color-accent)',
          dark: 'var(--color-accent-hover)',
          light: 'var(--color-accent-light)',
        },
        text: {
          primary: 'var(--color-text-primary)',
          muted: 'var(--color-text-muted)',
        },
        risk: {
          low: 'var(--color-risk-low)',
          moderate: 'var(--color-risk-moderate)',
          high: 'var(--color-risk-high)',
          severe: 'var(--color-risk-severe)',
          notravel: 'var(--color-risk-no-travel)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '8px',
      },
    },
  },
  plugins: [],
}
