/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        accent: {
          50: '#f3f0ff',
          100: '#e9e3ff',
          200: '#d5ccff',
          300: '#b5a3ff',
          400: '#9171ff',
          500: '#7c3aed',
          600: '#6d28d9',
          700: '#5b21b6',
          800: '#4c1d95',
          900: '#3b0f7a',
        },
        surface: {
          DEFAULT: '#0f0f14',
          50: '#f8f8fa',
          100: '#e8e8ee',
          200: '#d1d1dd',
          300: '#a9a9c0',
          400: '#7a7a9a',
          500: '#5a5a78',
          600: '#3a3a50',
          700: '#2a2a3a',
          800: '#1a1a24',
          900: '#0f0f14',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};
