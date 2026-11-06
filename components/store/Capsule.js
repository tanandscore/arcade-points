import SafeImg from "./SafeImg";

// The drawn stand-in for a picture: the game's own colour with its emoji on top. It is what a game that is announced but not built
// yet looks like, and what shows instead of a picture if the file is ever missing, so the store never has a broken image.
export function DrawnArt({ accent = "#3ee6e0", icon = "🎮", size }) {
  return (
    <div className="absolute inset-0" style={{ background: `radial-gradient(120% 90% at 78% 12%, ${accent}55, transparent 58%), linear-gradient(155deg, #2e1768, #150a35 70%)` }}>
      <div className="st-soonart" aria-hidden style={size ? { fontSize: size } : undefined}>{icon}</div>
    </div>
  );
}

// The picture of a game. Playable games use their capsule image; the picture is decorative (the game's name is always written
// next to it), so it carries no alt text unless one is asked for.
export default function Capsule({ game, priority = false, alt = "" }) {
  const drawn = <DrawnArt accent={game.accentColor} icon={game.icon} />;
  if (game.status === "soon" || !game.capsule) return drawn;
  return <SafeImg src={game.capsule} alt={alt} loading={priority ? "eager" : "lazy"} decoding="async" width="1280" height="720" draggable="false" fallback={drawn} />;
}
