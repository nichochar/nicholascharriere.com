/** @type {import('tailwindcss').Config} */
const defaultTheme = require("tailwindcss/defaultTheme");

export default {
	content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Roboto", "InterVariable", ...defaultTheme.fontFamily.sans],
      },
      colors: {
        bg: "#F5E9D4",
        medium: "#B79C94",
        text: {
          50: "#f7f7f6",
          100: "#e6e4e1",
          200: "#cdc9c2",
          300: "#aca79c",
          400: "#8a8477",
          500: "#646054",
          600: "#585549",
          700: "#48453d",
          800: "#3c3a33",
          900: "#34322d",
          950: "#1c1b17",
        },
        froly: {
          50: "#fdf3f3",
          100: "#fce5e4",
          200: "#fbcecd",
          300: "#f7acaa",
          400: "#ef6f6c",
          500: "#e5514e",
          600: "#d23430",
          700: "#b02825",
          800: "#922522",
          900: "#792523",
          950: "#420e0d",
        },
      },
    },
  },
	plugins: [],
}
