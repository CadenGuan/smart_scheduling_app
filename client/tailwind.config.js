/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        triadic: {
          teal: {
            DEFAULT: '#00B4DB',
            hover: '#0098ba',
            light: '#E0F7FA',
          },
          magenta: {
            DEFAULT: '#FF6B6B',
            hover: '#fa5252',
            light: '#FFEBEB',
          },
          yellow: {
            DEFAULT: '#F9CA24',
            hover: '#e5b613',
            light: '#FFFDE7',
          },
        },
      },
    },
  },
  plugins: [],
}

