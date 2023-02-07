const defaultTheme = require('tailwindcss/defaultTheme')
module.exports = {
  purge: ['./src/**/*.{js,jsx,ts,tsx}', './public/index.html'],
  darkMode: 'class', // or 'media' or 'class'
  theme: {
    extend: {
      colors: {
        'primary': '#3D95CE',
        'secondary': '#95CE3D',
        'tertiary': '#CD3C94',
        'warn': '#D4AA00',
        'background': 'rgb(33, 36, 38)'
      },
      fontFamily: {
        'montserrat': ['Montserrat'],
        'sans': ['Roboto', ...defaultTheme.fontFamily.sans],
      },
      height: {
        '50vh': '50vh',
        'sidebar': 'calc(50vh - 2rem)'
      },
    },
  },
  variants: {
    extend: {},
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
}