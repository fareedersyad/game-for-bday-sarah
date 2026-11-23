/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        rosy: { DEFAULT: '#e8899e', dusty: '#d8a7b1', deep: '#b85c78', soft: '#f6d3dc' },
        ivory: '#F8F6EF',
        champagne: '#e7c98f',
        sage: { DEFAULT: '#A3B18A', soft: '#CCD5AE', deep: '#6F8560' },
        forest: '#344E41',
        strawberry: { DEFAULT: '#D94B55', soft: '#F3D6D8' },
        gold: { soft: '#f3dca4', DEFAULT: '#D4AF70', deep: '#a87c2a' },
        lavender: { soft: '#ece4f7', DEFAULT: '#c3b1e1', deep: '#8f78b8' },
        cream: '#F3EBDD',
        pearl: '#fbf8f6',
        plum: { DEFAULT: '#5a3553', deep: '#2e1a2c' },
      },
      fontFamily: {
        serif: ['"Cormorant Garamond"', 'Georgia', '"Times New Roman"', 'serif'],
        script: ['"Dancing Script"', '"Brush Script MT"', 'cursive'],
        sans: ['Nunito', 'system-ui', '-apple-system', '"Segoe UI"', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        royal: '0 10px 40px -10px rgba(120, 50, 90, 0.45), 0 0 0 1px rgba(231, 201, 143, 0.55)',
        glow: '0 0 24px rgba(243, 220, 164, 0.75)',
      },
    },
  },
  plugins: [],
};
