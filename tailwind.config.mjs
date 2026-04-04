/** @type {import('tailwindcss').Config} */
import Typography from "@tailwindcss/typography";
const defaultTheme = require("tailwindcss/defaultTheme");

export default {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
  plugins: [Typography],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Verdana", ...defaultTheme.fontFamily.sans],
      },
      colors: {
        heading: "#222",
        body: "#444",
        link: "#3273dc",
      },
    },
  },
};
