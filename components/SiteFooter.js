const YEAR = new Date().getFullYear();

// A real, if modest, legal step: puts the world on notice of
// copyright and clarifies Tap & Score isn't affiliated with any of
// the real games, films, or franchises individual titles draw
// creative inspiration from. This doesn't make anything "uncopyable"
// — nothing can — but it's genuine, standard, and worth having.
export default function SiteFooter() {
  return (
    <footer className="w-full py-6 px-4 text-center border-t border-lineColor/40 mt-auto">
      <p className="font-mono text-[10px] text-textDim">
        © {YEAR} Tap & Score. All rights reserved.
      </p>
      <p className="font-mono text-[10px] text-textDim mt-1 max-w-xl mx-auto leading-relaxed">
        Tap & Score is an independent entertainment platform. Individual games may draw creative inspiration from
        genres and styles associated with other media, but Tap & Score is not affiliated with, endorsed by, or
        sponsored by any third-party game, studio, or franchise.
      </p>
    </footer>
  );
}
