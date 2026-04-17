/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        serif: ['Playfair Display', 'Georgia', 'serif'],
        sans: ['Manrope', 'system-ui', 'sans-serif'],
      },
      colors: {
        primary: '#082c59',
        secondary: '#e2e8f0',
        'primary-dark': '#051d3d',
        'primary-light': '#0a3a75',
        champagne: '#C5A880',
        'champagne-dark': '#A98E64',
      }
    },
  },
  plugins: [],
}
