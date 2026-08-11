import type { Config } from "tailwindcss";

/**
 * Design tokens for the portal (ARCHITECTURE.md section 8).
 *
 * The palette is a deliberate academic indigo/brass rather than the
 * cream/terracotta that generic AI-generated UI tends to land on. Indigo
 * carries the institutional/scholarly weight; brass is the accent reserved
 * for earned progress — milestones, verification, completion — so the
 * accent colour always means "you achieved something", never just decoration.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#12142b",
          muted: "#4a4f6d",
          faint: "#767b96",
        },
        indigo: {
          50: "#f0f1fa",
          100: "#dfe1f4",
          200: "#c3c6ea",
          300: "#9ea3dc",
          400: "#787fcb",
          500: "#5b60b8",
          600: "#474a9c",
          700: "#3a3c7e",
          800: "#2c2e60",
          900: "#1e2044",
          950: "#12142b",
        },
        brass: {
          50: "#fdf8ed",
          100: "#f8eccd",
          200: "#f0d798",
          300: "#e6bd62",
          400: "#dda43c",
          500: "#c9882a",
          600: "#a86a22",
          700: "#864f20",
          800: "#6f4021",
          900: "#5e361f",
        },
        parchment: {
          DEFAULT: "#faf9f6",
          sunk: "#f3f1eb",
        },
        success: "#2f7d5d",
        warning: "#b4761c",
        danger: "#b23b3b",
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "Cambria", "serif"],
        sans: [
          "var(--font-body)",
          "Segoe UI",
          "system-ui",
          "-apple-system",
          "sans-serif",
        ],
      },
      borderRadius: {
        card: "0.875rem",
      },
      boxShadow: {
        card: "0 1px 2px rgba(18,20,43,0.04), 0 8px 24px -12px rgba(18,20,43,0.18)",
        lift: "0 2px 4px rgba(18,20,43,0.06), 0 16px 40px -16px rgba(18,20,43,0.28)",
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.4s ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
