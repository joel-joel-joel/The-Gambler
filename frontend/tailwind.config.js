/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      gridTemplateColumns: {
        '13': 'repeat(13, minmax(0, 1fr))',
      },
      colors: {
        gold: {
          DEFAULT: '#CA8A04',
          50: '#FEF9C3',
          100: '#FEF08A',
          200: '#FDE047',
          300: '#FACC15',
          400: '#EAB308',
          500: '#CA8A04',
          600: '#A16207',
          700: '#854D0E',
          800: '#713F12',
          900: '#422006',
        },
        surface: {
          DEFAULT: '#292524',
          deep: '#1C1917',
          raised: '#44403C',
          hover: '#57534E',
        },
      },
      fontFamily: {
        sans: ['Fira Sans', 'system-ui', 'sans-serif'],
        mono: ['Fira Code', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 15px rgba(202, 138, 4, 0.3)',
        'glow-sm': '0 0 8px rgba(202, 138, 4, 0.2)',
      },
    },
  },
  plugins: [],
}
