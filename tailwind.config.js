/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          dark: '#0d2b22',
          mid:  '#1a4a3a',
          light: '#4a8a6a',
          50:   '#f0f7f0',
          100:  '#d9edd9',
          500:  '#4a8a6a',
          700:  '#1a4a3a',
          900:  '#0d2b22',
        }
      },
    },
  },
  plugins: [],
}
