import ReflexTap from "./ReflexTap";
import MemoryMatch from "./MemoryMatch";
import MathRush from "./MathRush";
import NeonSnake from "./NeonSnake";
import MoleRush from "./MoleRush";
import Sequence from "./Sequence";
import TypingRush from "./TypingRush";
import ColorRush from "./ColorRush";
import DigitSpan from "./DigitSpan";
import TicTacDuel from "./TicTacDuel";
import WordScramble from "./WordScramble";
import QuickTrivia from "./QuickTrivia";
import LaneDash from "./LaneDash";
import PixelJumper from "./PixelJumper";
import EmpireCommand from "./EmpireCommand";
import TurboCircuit from "./TurboCircuit";

// Every game component receives exactly two props:
//   onFinish(score: number) — call once when the game ends
//   accentColor: string — the game's theme color from the games table
// The keys here must match a game's component_key column in Supabase.
export const GAME_COMPONENTS = {
  reflex: ReflexTap,
  memory: MemoryMatch,
  math: MathRush,
  snake: NeonSnake,
  whackamole: MoleRush,
  simonsays: Sequence,
  typing: TypingRush,
  colormatch: ColorRush,
  numbermemory: DigitSpan,
  tictactoe: TicTacDuel,
  wordscramble: WordScramble,
  trivia: QuickTrivia,
  lanedash: LaneDash,
  pixeljumper: PixelJumper,
  empirecommand: EmpireCommand,
  turbocircuit: TurboCircuit,
};
