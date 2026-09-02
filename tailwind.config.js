/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts}"],
  theme: {
    extend: {
      fontFamily: {
        mono: ['"JetBrains Mono"', 'monospace'],
        display: ['"Space Grotesk"', 'sans-serif'],
      },
      colors: {
        ink: "#0a0a0f",
        paper: "#f5f1e8",
        amber: { 500: "#f59e0b", 400: "#fbbf24" },
      }
    },
  },
  plugins: [],
}
