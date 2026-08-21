export default function robots() {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/login", "/signup"],
        disallow: ["/dashboard", "/games/", "/api/"],
      },
    ],
    sitemap: "https://tapandscore.com/sitemap.xml",
  };
}
