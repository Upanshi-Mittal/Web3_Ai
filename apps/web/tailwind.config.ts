import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#eef8f1",
        panel: "#ffffff",
        panel2: "#f5faf6",
        border: "#d7e7dc",
        ink: "#102a21",
        muted: "#60756b",
        teal: "#138a61",
        violet: "#7357d9",
        coral: "#ea715f",
        danger: "#d94b58",
        warning: "#b7791f",
        success: "#16845b"
      },
      boxShadow: {
        glow: "0 1px 2px rgba(16,42,33,0.05), 0 18px 50px rgba(32,93,68,0.10)",
        lift: "0 10px 30px rgba(32,93,68,0.12)"
      }
    }
  },
  plugins: []
};

export default config;
