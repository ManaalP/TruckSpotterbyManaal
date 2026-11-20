/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#F7F8FA',
        surface: '#FFFFFF',
        border: '#E1E5EA',
        primary: {
          DEFAULT: '#1F5FBF',
          dark: '#174A96',
          light: '#EBF2FC',
        },
        text: {
          primary: '#1B2430',
          muted: '#5B6675',
        },
        risk: {
          low: '#2E8B57',
          moderate: '#E5B800',
          high: '#E07A1F',
          severe: '#C62828',
          notravel: '#4A0E1A',
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
