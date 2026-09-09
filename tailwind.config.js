/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        bgDeep: "#12092b",
        bgPanel: "#1d1046",
        bgPanel2: "#241154",
        bgPanel3: "#2a1560",
        accentAmber: "#ffb703",
        accentCyan: "#3ee6e0",
        accentMagenta: "#ff3ea5",
        textLight: "#f5f0ff",
        textDim: "#a99fd6",
        lineColor: "rgba(169,159,214,0.22)",
      },
      fontFamily: {
        pixel: ["'Press Start 2P'", "cursive"],
        body: ["'Space Grotesk'", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
      // Two additions for the animated-avatar catalog (lib/avatars.js)
      // — Tailwind only ships spin/pulse/bounce/ping by default, and
      // the avatar set needed a slower spin and a genuine glow pulse
      // neither of those covers.
      animation: {
        "spin-slow": "spin 3s linear infinite",
        glow: "glow 1.8s ease-in-out infinite",
        "announce-pulse": "announce-pulse 2.4s ease-in-out infinite",
      },
      keyframes: {
        glow: {
          "0%, 100%": { filter: "drop-shadow(0 0 2px currentColor)" },
          "50%": { filter: "drop-shadow(0 0 10px currentColor)" },
        },
        "announce-pulse": {
          "0%, 100%": { transform: "scale(1)", boxShadow: "0 0 0px rgba(255,183,3,0.4)" },
          "50%": { transform: "scale(1.015)", boxShadow: "0 0 24px rgba(255,183,3,0.4)" },
        },
      },
    },
  },
  plugins: [],
};
