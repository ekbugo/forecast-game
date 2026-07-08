/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#b9e5fe',
          300: '#7cd1fd',
          400: '#36b9fa',
          500: '#0c9feb',
          600: '#007fc9',
          700: '#0165a3',
          800: '#065586',
          900: '#0b476f',
          950: '#072d4a'
        }
      }
    }
  },
  plugins: []
};
