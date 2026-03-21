import type { Config } from "tailwindcss";

// NOTE: This project uses Tailwind CSS v4.
// Primary token configuration lives in src/app/globals.css via @theme.
// This file exists as a placeholder for Story 1.2 design token work.
// To activate this config with v4, add @config "./tailwind.config.ts" to globals.css.
const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // Design tokens will be added in Story 1.2
    },
  },
  plugins: [],
};

export default config;
