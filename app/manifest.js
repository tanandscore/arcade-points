export default function manifest() {
  return {
    name: "Tap & Score — Free Online Games",
    short_name: "Tap & Score",
    description: "Free online arcade games and leaderboards. Quick breaks, real scores.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#12092b",
    theme_color: "#12092b",
    icons: [
      { src: "/icon-192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-192", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
