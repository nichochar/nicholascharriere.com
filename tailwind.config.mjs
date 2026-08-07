/** @type {import('tailwindcss').Config} */
import Typography from "@tailwindcss/typography";
const defaultTheme = require("tailwindcss/defaultTheme");

export default {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
  darkMode: "class",
  plugins: [Typography],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Verdana", ...defaultTheme.fontFamily.sans],
      },
      colors: {
        page: "var(--color-page)",
        heading: "var(--color-heading)",
        body: "var(--color-body)",
        link: "var(--color-link)",
      },
    },
  },
};
