"use client";

import GameCard from "./GameCard";
import Shelf from "./Shelf";
import { useFavs } from "./Favs";

// The player's favourites (kept in this browser). Shows nothing until there is at least one.
export default function FavShelf({ games }) {
  const { favs, ready } = useFavs();
  if (!ready) return null;
  const mine = favs.map((s) => games.find((g) => g.slug === s)).filter(Boolean);
  if (!mine.length) return null;
  return (
    <Shelf id="favourites" title="Favourites" note="Games you marked with the heart. They are kept in this browser." cols={4}>
      {mine.map((g) => <GameCard key={g.slug} game={g} />)}
    </Shelf>
  );
}
