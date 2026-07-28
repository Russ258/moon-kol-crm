import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        orange: {
          DEFAULT: "#F7931A",
          hover: "#E38318",
        },
        dark: "#212121",
        panel: "#F7F7F7",
        border: "#E0E0E0",
      },
    },
  },
  plugins: [],
};
export default config;
