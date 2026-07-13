/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        'uchb-teal': '#06363a',
        'uchb-gold': '#b08a3e',
        'uchb-cream': '#f9eadf',
      },
    },
  },
  plugins: [],
}
