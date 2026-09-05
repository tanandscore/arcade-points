// VideoGame structured data (schema.org) for individual game pages —
// shared between the public, signed-out landing view and the
// logged-in page, since the game's own facts don't change based on
// who's viewing it. Deliberately limited to fields backed by real
// data this project actually has: no invented ratings, no fabricated
// publish dates, nothing that would misrepresent the game to a
// search engine reading this. image points at the site-wide OG image
// as an honest fallback — there's no per-game image asset yet, and
// this at least gives a real, on-brand image rather than none.
export function gameVideoGameJsonLd(game) {
  const json = {
    "@context": "https://schema.org",
    "@type": "VideoGame",
    name: game.name,
    description: game.tagline,
    url: `https://tapandscore.com/games/${game.slug}`,
    image: "https://tapandscore.com/og-image.png",
    genre: game.category || undefined,
    isAccessibleForFree: game.accessType === "free",
  };
  // Only genuinely one-time-purchase games get an Offer block — a
  // subscription's pricePaise is a monthly recurring amount, and
  // representing that as a flat Offer price would misstate what it
  // actually costs to access the game. Simpler and honest to omit it
  // for subscription games rather than approximate something schema.org's
  // basic Offer type isn't really built to express accurately.
  if (game.accessType === "onetime" && game.pricePaise != null) {
    json.offers = {
      "@type": "Offer",
      price: (game.pricePaise / 100).toFixed(2),
      priceCurrency: "INR",
      availability: "https://schema.org/InStock",
    };
  }
  return json;
}
