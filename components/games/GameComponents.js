import dynamic from "next/dynamic";
import GameLoadingInline from "./GameLoadingInline";

// Every game component receives exactly two props:
//   onFinish(score: number) — call once when the game ends
//   accentColor: string — the game's theme color from the games table
// The keys here must match a game's component_key column in Supabase.
//
// Each entry is a next/dynamic() import, NOT a static import — this is
// what makes visiting one game only download that game's code, instead
// of all 50+ games bundled together on every single game page. ssr:
// false because every game touches canvas/window/audio APIs that don't
// exist during server rendering.
export const GAME_COMPONENTS = {
  reflex: dynamic(() => import("./ReflexTap"), { ssr: false, loading: GameLoadingInline }),
  memory: dynamic(() => import("./MemoryMatch"), { ssr: false, loading: GameLoadingInline }),
  math: dynamic(() => import("./MathRush"), { ssr: false, loading: GameLoadingInline }),
  snake: dynamic(() => import("./NeonSnake"), { ssr: false, loading: GameLoadingInline }),
  whackamole: dynamic(() => import("./MoleRush"), { ssr: false, loading: GameLoadingInline }),
  simonsays: dynamic(() => import("./Sequence"), { ssr: false, loading: GameLoadingInline }),
  typing: dynamic(() => import("./TypingRush"), { ssr: false, loading: GameLoadingInline }),
  colormatch: dynamic(() => import("./ColorRush"), { ssr: false, loading: GameLoadingInline }),
  numbermemory: dynamic(() => import("./DigitSpan"), { ssr: false, loading: GameLoadingInline }),
  tictactoe: dynamic(() => import("./TicTacDuel"), { ssr: false, loading: GameLoadingInline }),
  wordscramble: dynamic(() => import("./WordScramble"), { ssr: false, loading: GameLoadingInline }),
  trivia: dynamic(() => import("./QuickTrivia"), { ssr: false, loading: GameLoadingInline }),
  lanedash: dynamic(() => import("./LaneDash"), { ssr: false, loading: GameLoadingInline }),
  pixeljumper: dynamic(() => import("./PixelJumper"), { ssr: false, loading: GameLoadingInline }),
  empirecommand: dynamic(() => import("./EmpireCommand"), { ssr: false, loading: GameLoadingInline }),
  turbocircuit: dynamic(() => import("./TurboCircuit"), { ssr: false, loading: GameLoadingInline }),
  colonyrush: dynamic(() => import("./ColonyRush"), { ssr: false, loading: GameLoadingInline }),
  echochase: dynamic(() => import("./EchoChase"), { ssr: false, loading: GameLoadingInline }),
  pulsemaze: dynamic(() => import("./PulseMaze"), { ssr: false, loading: GameLoadingInline }),
  strikezone: dynamic(() => import("./StrikeZone"), { ssr: false, loading: GameLoadingInline }),
  platformquest: dynamic(() => import("./PlatformQuest"), { ssr: false, loading: GameLoadingInline }),
  creatureclash: dynamic(() => import("./CreatureClash"), { ssr: false, loading: GameLoadingInline }),
  brickblaster: dynamic(() => import("./BrickBlaster"), { ssr: false, loading: GameLoadingInline }),
  blockcascade: dynamic(() => import("./BlockCascade"), { ssr: false, loading: GameLoadingInline }),
  mazemuncher: dynamic(() => import("./MazeMuncher"), { ssr: false, loading: GameLoadingInline }),
  apexcircuit: dynamic(() => import("./ApexCircuit"), { ssr: false, loading: GameLoadingInline }),
  dominion: dynamic(() => import("./Dominion"), { ssr: false, loading: GameLoadingInline }),
  territoryduel: dynamic(() => import("./TerritoryDuel"), { ssr: false, loading: GameLoadingInline }),
  grandprixduel: dynamic(() => import("./GrandPrixDuel"), { ssr: false, loading: GameLoadingInline }),
  stardefender: dynamic(() => import("./StarDefender"), { ssr: false, loading: GameLoadingInline }),
  voiddrifter: dynamic(() => import("./VoidDrifter"), { ssr: false, loading: GameLoadingInline }),
  swarmbreach: dynamic(() => import("./SwarmBreach"), { ssr: false, loading: GameLoadingInline }),
  skyraiders: dynamic(() => import("./SkyRaiders"), { ssr: false, loading: GameLoadingInline }),
  peakascent: dynamic(() => import("./PeakAscent"), { ssr: false, loading: GameLoadingInline }),
  horizonguardian: dynamic(() => import("./HorizonGuardian"), { ssr: false, loading: GameLoadingInline }),
  duelarena: dynamic(() => import("./DuelArena"), { ssr: false, loading: GameLoadingInline }),
  frontlinemarksman: dynamic(() => import("./FrontlineMarksman"), { ssr: false, loading: GameLoadingInline }),
  fruitchase: dynamic(() => import("./FruitChase"), { ssr: false, loading: GameLoadingInline }),
  ironfist: dynamic(() => import("./IronFist"), { ssr: false, loading: GameLoadingInline }),
  shellsquad: dynamic(() => import("./ShellSquad"), { ssr: false, loading: GameLoadingInline }),
  rimrockers: dynamic(() => import("./RimRockers"), { ssr: false, loading: GameLoadingInline }),
  beatrush: dynamic(() => import("./BeatRush"), { ssr: false, loading: GameLoadingInline }),
  titanarena: dynamic(() => import("./TitanArena"), { ssr: false, loading: GameLoadingInline }),
  duskward: dynamic(() => import("./Duskward"), { ssr: false, loading: GameLoadingInline }),
  bloodmoonsiege: dynamic(() => import("./BloodmoonSiege"), { ssr: false, loading: GameLoadingInline }),
  starfalloverrun: dynamic(() => import("./StarfallOverrun"), { ssr: false, loading: GameLoadingInline }),
  arcanesurvivor: dynamic(() => import("./ArcaneSurvivor"), { ssr: false, loading: GameLoadingInline }),
  arenasurvivor: dynamic(() => import("./ArenaSurvivor"), { ssr: false, loading: GameLoadingInline }),
  shadowfall: dynamic(() => import("./Shadowfall"), { ssr: false, loading: GameLoadingInline }),
  driftlight: dynamic(() => import("./Driftlight"), { ssr: false, loading: GameLoadingInline }),
  operationblacksite: dynamic(() => import("./OperationBlacksite"), { ssr: false, loading: GameLoadingInline }),
  neondrift: dynamic(() => import("./NeonDrift"), { ssr: false, loading: GameLoadingInline }),
  kingdomsofash: dynamic(() => import("./KingdomsOfAsh"), { ssr: false, loading: GameLoadingInline }),
  wrathofolympus: dynamic(() => import("./WrathOfOlympus"), { ssr: false, loading: GameLoadingInline }),
  emberlight: dynamic(() => import("./Emberlight"), { ssr: false, loading: GameLoadingInline }),
  eclipseprotocol: dynamic(() => import("./EclipseProtocol"), { ssr: false, loading: GameLoadingInline }),
  thelaststar: dynamic(() => import("./TheLastStar"), { ssr: false, loading: GameLoadingInline }),
  celestialdreams: dynamic(() => import("./CelestialDreams"), { ssr: false, loading: GameLoadingInline }),
  eternalfrontier: dynamic(() => import("./EternalFrontier"), { ssr: false, loading: GameLoadingInline }),
};
