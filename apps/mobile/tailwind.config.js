/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        olive: {
          DEFAULT: '#5c6b3a',
          dark: '#4a5530',
          subtle: '#eef2e6',
        },
        cream: '#f5f1e8',
      },
      fontFamily: {
        sans: ['System'],
      },
    },
  },
  plugins: [],
};
