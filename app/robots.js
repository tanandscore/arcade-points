export default function robots() {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/login", "/signup"],
        // /games/ no longer blocked — every game page now shows a
        // real public landing view for signed-out visitors instead
        // of an immediate login redirect, so there's genuine content
        // here worth crawling. /dashboard and /api/ stay disallowed
        // since those still require a login and expose nothing new
        // to a crawler.
        disallow: ["/dashboard", "/api/"],
      },
    ],
    sitemap: "https://tapandscore.com/sitemap.xml",
  };
}
